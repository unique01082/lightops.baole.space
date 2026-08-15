use super::{
    advanced::MetadataCategory,
    media::{
        collision_safe_path, JobProgress, JobResult, JobState, JobStatus, OutputAsset,
        JOB_FINISHED_EVENT, JOB_PROGRESS_EVENT,
    },
    process_utils::output_with_timeout,
};
use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};
use std::{
    fs,
    path::{Path, PathBuf},
    process::Command,
    sync::atomic::Ordering,
    time::Duration,
};
use tauri::{AppHandle, Emitter, Manager, State};

const PROTECTED_TAGS: &[&str] = &[
    "Copyright",
    "Creator",
    "Artist",
    "DateTimeOriginal",
    "ExposureTime",
    "FNumber",
    "ISO",
    "FocalLength",
    "ICC_Profile",
    "Orientation",
    "ImageWidth",
    "ImageHeight",
];

pub fn removal_arguments(categories: &[MetadataCategory]) -> Vec<String> {
    let mut arguments = Vec::new();
    for category in categories {
        let tags: &[&str] = match category {
            MetadataCategory::Location => &[
                "-GPS:all=",
                "-XMP:Location=",
                "-XMP:City=",
                "-XMP:State=",
                "-XMP:Country=",
            ],
            MetadataCategory::DeviceIdentity => &[
                "-EXIF:SerialNumber=",
                "-EXIF:InternalSerialNumber=",
                "-EXIF:LensSerialNumber=",
                "-XMP:OwnerName=",
            ],
            MetadataCategory::People => &[
                "-XMP:RegionInfo=",
                "-IPTC:PersonInImage=",
                "-XMP:PersonInImage=",
            ],
            MetadataCategory::EditHistory => &[
                "-XMP:History=",
                "-XMP:DerivedFrom=",
                "-XMP:DocumentAncestors=",
            ],
            MetadataCategory::EmbeddedPreview => {
                &["-ThumbnailImage=", "-PreviewImage=", "-JpgFromRaw="]
            }
            MetadataCategory::CopyrightCreator
            | MetadataCategory::Capture
            | MetadataCategory::ColorOrientation => &[],
        };
        arguments.extend(tags.iter().map(|tag| (*tag).to_string()));
    }
    arguments.sort();
    arguments.dedup();
    arguments
}

pub(crate) fn exiftool_path(app: &AppHandle) -> Result<PathBuf, String> {
    if let Ok(path) = std::env::var("LIGHTOPS_EXIFTOOL_PATH") {
        let path = PathBuf::from(path);
        if path.is_file() {
            return Ok(path);
        }
    }
    let resource_dir = app
        .path()
        .resource_dir()
        .map_err(|error| error.to_string())?;
    let filename = if cfg!(windows) {
        "exiftool.exe"
    } else {
        "exiftool"
    };
    let candidates = [
        resource_dir.join("bin").join(filename),
        resource_dir.join(filename),
    ];
    candidates
        .into_iter()
        .find(|candidate| candidate.is_file())
        .ok_or_else(|| {
            "Bundled ExifTool is missing. Reinstall LightOps from an official package.".into()
        })
}

fn audit_file(exiftool: &Path, path: &Path) -> Result<Map<String, Value>, String> {
    let mut command = Command::new(exiftool);
    command.args(["-json", "-G1", "-s"]).arg(path);
    let output = output_with_timeout(&mut command, Duration::from_secs(30), "ExifTool audit")?;
    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).trim().to_string());
    }
    let mut records: Vec<Map<String, Value>> =
        serde_json::from_slice(&output.stdout).map_err(|error| error.to_string())?;
    records
        .pop()
        .ok_or_else(|| format!("ExifTool returned no metadata for {}", path.display()))
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MetadataAudit {
    path: String,
    tags: Map<String, Value>,
    safe_share_categories: Vec<MetadataCategory>,
}

#[tauri::command]
pub fn audit_metadata(app: AppHandle, paths: Vec<String>) -> Result<Vec<MetadataAudit>, String> {
    let exiftool = exiftool_path(&app)?;
    paths
        .into_iter()
        .map(|path| {
            let tags = audit_file(&exiftool, Path::new(&path))?;
            Ok(MetadataAudit {
                path,
                tags,
                safe_share_categories: super::advanced::safe_share_categories(),
            })
        })
        .collect()
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MetadataCleanRequest {
    paths: Vec<String>,
    output_dir: String,
    categories: Vec<MetadataCategory>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MetadataCleanResult {
    outputs: Vec<String>,
    warnings: Vec<String>,
}

fn tag_matches(key: &str, needle: &str) -> bool {
    key.rsplit(':')
        .next()
        .is_some_and(|name| name.eq_ignore_ascii_case(needle))
}

fn private_tag_names(categories: &[MetadataCategory]) -> Vec<&'static str> {
    categories
        .iter()
        .flat_map(|category| match category {
            MetadataCategory::Location => vec![
                "GPSLatitude",
                "GPSLongitude",
                "Location",
                "City",
                "State",
                "Country",
            ],
            MetadataCategory::DeviceIdentity => vec![
                "SerialNumber",
                "InternalSerialNumber",
                "LensSerialNumber",
                "OwnerName",
            ],
            MetadataCategory::People => vec!["RegionInfo", "PersonInImage"],
            MetadataCategory::EditHistory => vec!["History", "DerivedFrom", "DocumentAncestors"],
            MetadataCategory::EmbeddedPreview => {
                vec!["ThumbnailImage", "PreviewImage", "JpgFromRaw"]
            }
            _ => vec![],
        })
        .collect()
}

fn selected_private_tag_remaining(key: &str, categories: &[MetadataCategory]) -> bool {
    let upper = key.to_ascii_uppercase();
    categories.iter().any(|category| match category {
        MetadataCategory::Location => {
            upper.starts_with("GPS:")
                || ["Location", "City", "State", "Country"]
                    .iter()
                    .any(|tag| tag_matches(key, tag))
        }
        category => private_tag_names(&[*category])
            .iter()
            .any(|tag| tag_matches(key, tag)),
    })
}

fn verify_post_audit(
    source: &Path,
    destination: &Path,
    before: &Map<String, Value>,
    after: &Map<String, Value>,
    categories: &[MetadataCategory],
) -> Result<(), String> {
    for key in after.keys() {
        if selected_private_tag_remaining(key, categories) {
            return Err(format!(
                "Post-audit failed: {key} remains in {}",
                source.display()
            ));
        }
    }
    for protected in PROTECTED_TAGS {
        let before_value = before.iter().find(|(key, _)| tag_matches(key, protected));
        let after_value = after.iter().find(|(key, _)| tag_matches(key, protected));
        if before_value.is_some()
            && before_value.map(|(_, value)| value) != after_value.map(|(_, value)| value)
        {
            return Err(format!(
                "Post-audit failed: protected tag {protected} changed in {}",
                source.display()
            ));
        }
    }
    let icc_tags = |tags: &Map<String, Value>| {
        tags.iter()
            .filter(|(key, _)| key.to_ascii_uppercase().starts_with("ICC_PROFILE:"))
            .map(|(key, value)| (key.clone(), value.clone()))
            .collect::<Vec<_>>()
    };
    if icc_tags(before) != icc_tags(after) {
        return Err(format!(
            "Post-audit failed: ICC profile changed in {}",
            source.display()
        ));
    }
    let before_dimensions = image::image_dimensions(source)
        .map_err(|error| format!("Post-audit failed to inspect {}: {error}", source.display()))?;
    let after_dimensions = image::image_dimensions(destination).map_err(|error| {
        format!(
            "Post-audit failed to inspect {}: {error}",
            destination.display()
        )
    })?;
    if before_dimensions != after_dimensions {
        return Err(format!(
            "Post-audit failed: pixel dimensions changed in {} ({}x{} to {}x{})",
            source.display(),
            before_dimensions.0,
            before_dimensions.1,
            after_dimensions.0,
            after_dimensions.1
        ));
    }
    Ok(())
}

#[tauri::command]
pub fn clean_metadata(
    app: AppHandle,
    state: State<'_, JobState>,
    request: MetadataCleanRequest,
) -> Result<MetadataCleanResult, String> {
    let guard = state.begin("metadata_cleaner".into())?;
    let exiftool = exiftool_path(&app)?;
    let output_dir = PathBuf::from(&request.output_dir);
    fs::create_dir_all(&output_dir).map_err(|error| error.to_string())?;
    let removal_args = removal_arguments(&request.categories);
    if removal_args.is_empty() {
        return Err("Select at least one removable metadata category".into());
    }
    let mut outputs = Vec::new();
    let warnings = Vec::new();

    for (index, source) in request.paths.iter().enumerate() {
        if guard.cancelled.load(Ordering::Relaxed) {
            let _ = app.emit(
                JOB_FINISHED_EVENT,
                JobResult {
                    job_id: "metadata_cleaner".into(),
                    status: JobStatus::Cancelled,
                    outputs: outputs
                        .iter()
                        .map(|output: &String| OutputAsset {
                            source_path: String::new(),
                            output_path: output.clone(),
                            byte_size: fs::metadata(output)
                                .map(|metadata| metadata.len())
                                .unwrap_or(0),
                            width: 0,
                            height: 0,
                            savings_bytes: 0,
                        })
                        .collect(),
                    warnings: Vec::new(),
                    manifest_path: None,
                },
            );
            return Err("Metadata cleaning was cancelled".into());
        }
        let _ = app.emit(
            JOB_PROGRESS_EVENT,
            JobProgress {
                job_id: "metadata_cleaner".into(),
                phase: "processing".into(),
                current: index,
                total: request.paths.len(),
                item_id: Some(source.clone()),
                message_key: "jobs.processing".into(),
            },
        );
        let source_path = Path::new(source);
        let before = audit_file(&exiftool, source_path)?;
        let stem = source_path
            .file_stem()
            .and_then(|value| value.to_str())
            .unwrap_or("image");
        let extension = source_path
            .extension()
            .and_then(|value| value.to_str())
            .unwrap_or("jpg");
        let destination =
            collision_safe_path(&output_dir.join(format!("{stem}-clean.{extension}")));
        let temporary = destination.with_file_name(format!(".{stem}-clean.lightops-part"));

        let mut command = Command::new(&exiftool);
        command
            .args(&removal_args)
            .args(["-overwrite_original", "-o"])
            .arg(&temporary)
            .arg(source_path);
        let output = output_with_timeout(
            &mut command,
            Duration::from_secs(120),
            "ExifTool metadata cleaner",
        )?;
        if !output.status.success() {
            let _ = fs::remove_file(&temporary);
            return Err(String::from_utf8_lossy(&output.stderr).trim().to_string());
        }
        if let Err(error) = fs::rename(&temporary, &destination) {
            let _ = fs::remove_file(&temporary);
            return Err(error.to_string());
        }
        let after = audit_file(&exiftool, &destination)?;

        if let Err(error) = verify_post_audit(
            source_path,
            &destination,
            &before,
            &after,
            &request.categories,
        ) {
            let _ = fs::remove_file(&destination);
            return Err(error);
        }
        outputs.push(destination.to_string_lossy().into_owned());
    }

    let output_assets = request
        .paths
        .iter()
        .zip(&outputs)
        .map(|(source, output)| OutputAsset {
            source_path: source.clone(),
            output_path: output.clone(),
            byte_size: fs::metadata(output)
                .map(|metadata| metadata.len())
                .unwrap_or(0),
            width: 0,
            height: 0,
            savings_bytes: 0,
        })
        .collect();
    let _ = app.emit(
        JOB_FINISHED_EVENT,
        JobResult {
            job_id: "metadata_cleaner".into(),
            status: JobStatus::Completed,
            outputs: output_assets,
            warnings: warnings.clone(),
            manifest_path: None,
        },
    );
    Ok(MetadataCleanResult { outputs, warnings })
}

#[cfg(test)]
mod tests {
    use super::*;
    use image::{ImageBuffer, Rgba};

    #[test]
    fn safe_share_arguments_remove_private_groups_without_all_metadata() {
        let args = removal_arguments(&[
            MetadataCategory::Location,
            MetadataCategory::People,
            MetadataCategory::EmbeddedPreview,
        ]);

        assert!(args.contains(&"-GPS:all=".to_string()));
        assert!(args.contains(&"-XMP:RegionInfo=".to_string()));
        assert!(args.contains(&"-ThumbnailImage=".to_string()));
        assert!(!args.contains(&"-all=".to_string()));
    }

    #[test]
    fn post_audit_rejects_changed_pixel_dimensions_even_without_dimension_tags() {
        let directory = tempfile::tempdir().expect("temp dir");
        let source = directory.path().join("source.png");
        let destination = directory.path().join("destination.png");
        ImageBuffer::from_pixel(10, 8, Rgba([1_u8, 2, 3, 255]))
            .save(&source)
            .expect("source fixture");
        ImageBuffer::from_pixel(12, 8, Rgba([1_u8, 2, 3, 255]))
            .save(&destination)
            .expect("destination fixture");

        let result = verify_post_audit(
            &source,
            &destination,
            &Map::new(),
            &Map::new(),
            &[MetadataCategory::Location],
        );

        assert!(result.is_err());
        assert!(result
            .expect_err("dimensions must be protected")
            .contains("pixel dimensions changed"));
    }
}
