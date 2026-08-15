use super::{
    exif::get_exif_datetime,
    media::{
        collision_safe_path, JobProgress, JobResult, JobState, JobStatus, OutputAsset,
        JOB_FINISHED_EVENT, JOB_PROGRESS_EVENT,
    },
};
use image::GenericImageView;
use serde::{Deserialize, Serialize};
use std::{
    collections::HashMap,
    fs::{self, File},
    io::BufReader,
    path::{Path, PathBuf},
    sync::atomic::Ordering,
    time::UNIX_EPOCH,
};
use tauri::{AppHandle, Emitter, State};

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum SequenceKind {
    Hdr,
    Panorama,
    Focus,
    Burst,
    Review,
}

#[derive(Debug, Clone)]
pub struct SequenceSignal {
    path: String,
    captured_at: i64,
    exposure_seconds: Option<f64>,
    focus_distance: Option<f64>,
    focal_length: Option<f64>,
    width: u32,
    height: u32,
    visual_hash: u64,
    histogram: [f64; 16],
    camera_id: Option<String>,
}

#[cfg(test)]
impl SequenceSignal {
    fn fixture(path: &str, captured_at: i64, exposure_seconds: Option<f64>) -> Self {
        Self {
            path: path.into(),
            captured_at,
            exposure_seconds,
            focus_distance: None,
            focal_length: Some(50.0),
            width: 4000,
            height: 3000,
            visual_hash: 0x0f0f_0f0f_0f0f_0f0f,
            histogram: [1.0 / 16.0; 16],
            camera_id: Some("fixture-camera".into()),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SequenceGroup {
    pub id: String,
    pub kind: SequenceKind,
    pub confidence: f64,
    pub paths: Vec<String>,
    pub evidence: Vec<String>,
    pub excluded: bool,
}

#[derive(Debug, Clone)]
pub struct PairSignal {
    path: String,
    width: u32,
    height: u32,
    captured_at: i64,
}

#[cfg(test)]
impl PairSignal {
    fn fixture(path: &str, width: u32, height: u32) -> Self {
        Self {
            path: path.into(),
            width,
            height,
            captured_at: 1_700_000_000,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BeforeAfterPair {
    pub id: String,
    pub before_path: String,
    pub after_path: String,
    pub confidence: f64,
    pub evidence: Vec<String>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum MetadataCategory {
    Location,
    DeviceIdentity,
    People,
    EditHistory,
    EmbeddedPreview,
    CopyrightCreator,
    Capture,
    ColorOrientation,
}

pub fn safe_share_categories() -> Vec<MetadataCategory> {
    vec![
        MetadataCategory::Location,
        MetadataCategory::DeviceIdentity,
        MetadataCategory::People,
        MetadataCategory::EditHistory,
        MetadataCategory::EmbeddedPreview,
    ]
}

fn hash_similarity(left: u64, right: u64) -> f64 {
    1.0 - f64::from((left ^ right).count_ones()) / 64.0
}

fn histogram_similarity(left: &[f64; 16], right: &[f64; 16]) -> f64 {
    1.0 - left
        .iter()
        .zip(right)
        .map(|(left, right)| (left - right).abs())
        .sum::<f64>()
        / 2.0
}

fn classify_group(frames: &[SequenceSignal]) -> (SequenceKind, f64, Vec<String>) {
    let exposures: Vec<f64> = frames
        .iter()
        .filter_map(|frame| frame.exposure_seconds)
        .collect();
    if exposures.len() >= 2 {
        let minimum = exposures.iter().copied().fold(f64::INFINITY, f64::min);
        let maximum = exposures.iter().copied().fold(0.0, f64::max);
        if maximum / minimum.max(f64::EPSILON) >= 2.0 {
            return (
                SequenceKind::Hdr,
                0.92,
                vec!["Exposure time changes across adjacent frames".into()],
            );
        }
    }

    let focus_distances: Vec<f64> = frames
        .iter()
        .filter_map(|frame| frame.focus_distance)
        .collect();
    if focus_distances.len() >= 2 {
        let minimum = focus_distances
            .iter()
            .copied()
            .fold(f64::INFINITY, f64::min);
        let maximum = focus_distances.iter().copied().fold(0.0, f64::max);
        if maximum - minimum > 0.05 {
            return (
                SequenceKind::Focus,
                0.88,
                vec!["Subject distance changes while framing stays stable".into()],
            );
        }
    }

    let first = &frames[0];
    let visual_similarity = frames
        .windows(2)
        .map(|pair| hash_similarity(pair[0].visual_hash, pair[1].visual_hash))
        .sum::<f64>()
        / (frames.len().saturating_sub(1).max(1) as f64);
    let histogram_stability = frames
        .windows(2)
        .map(|pair| histogram_similarity(&pair[0].histogram, &pair[1].histogram))
        .sum::<f64>()
        / (frames.len().saturating_sub(1).max(1) as f64);
    let focal_lengths = frames
        .iter()
        .filter_map(|frame| frame.focal_length)
        .collect::<Vec<_>>();
    let stable_focal_length = focal_lengths.len() < 2
        || focal_lengths.iter().copied().fold(f64::INFINITY, f64::min)
            / focal_lengths.iter().copied().fold(0.0, f64::max).max(0.001)
            > 0.95;
    let framing_shift = frames.iter().any(|frame| {
        frame.width.abs_diff(first.width) > first.width / 10
            || frame.height.abs_diff(first.height) > first.height / 10
    }) || (histogram_stability > 0.72 && visual_similarity < 0.7);
    if framing_shift && stable_focal_length {
        return (
            SequenceKind::Panorama,
            0.8,
            vec![format!(
                "Framing shifts while focal length and color distribution stay stable ({:.0}% histogram similarity)",
                histogram_stability * 100.0,
            )],
        );
    }

    if frames.len() >= 3 && visual_similarity >= 0.7 {
        return (
            SequenceKind::Burst,
            (0.65 + visual_similarity * 0.3).min(0.95),
            vec![format!(
                "Visual similarity {:.0}% across a fast sequence",
                visual_similarity * 100.0
            )],
        );
    }

    (
        SequenceKind::Review,
        0.45,
        vec!["Timing suggests a sequence but evidence is ambiguous".into()],
    )
}

pub fn classify_sequences(
    mut frames: Vec<SequenceSignal>,
    max_gap_seconds: f64,
) -> Vec<SequenceGroup> {
    frames.sort_by_key(|frame| frame.captured_at);
    let mut candidates: Vec<Vec<SequenceSignal>> = Vec::new();
    for frame in frames {
        let belongs = candidates
            .last()
            .and_then(|group| group.last())
            .is_some_and(|previous| {
                let gap = frame.captured_at.saturating_sub(previous.captured_at) as f64;
                let same_camera = frame.camera_id.is_none()
                    || previous.camera_id.is_none()
                    || frame.camera_id == previous.camera_id;
                gap <= max_gap_seconds && same_camera
            });
        if belongs {
            if let Some(group) = candidates.last_mut() {
                group.push(frame);
            }
        } else {
            candidates.push(vec![frame]);
        }
    }

    candidates
        .into_iter()
        .filter(|group| group.len() >= 2)
        .enumerate()
        .map(|(index, group)| {
            let (kind, confidence, evidence) = classify_group(&group);
            SequenceGroup {
                id: format!("sequence-{}", index + 1),
                kind,
                confidence,
                paths: group.into_iter().map(|frame| frame.path).collect(),
                evidence,
                excluded: false,
            }
        })
        .collect()
}

fn normalized_pair_name(path: &str) -> (String, Option<&'static str>) {
    let stem = Path::new(path)
        .file_stem()
        .and_then(|value| value.to_str())
        .unwrap_or(path)
        .to_lowercase();
    let before_tokens = ["before", "original", "orig", "raw"];
    let after_tokens = ["after", "edited", "edit", "retouched", "final"];
    for token in before_tokens {
        if stem.contains(token) {
            return (
                stem.replace(token, "").replace(['_', '-', ' '], ""),
                Some("before"),
            );
        }
    }
    for token in after_tokens {
        if stem.contains(token) {
            return (
                stem.replace(token, "").replace(['_', '-', ' '], ""),
                Some("after"),
            );
        }
    }
    (stem.replace(['_', '-', ' '], ""), None)
}

pub fn suggest_pairs(signals: Vec<PairSignal>) -> Vec<BeforeAfterPair> {
    let mut grouped: HashMap<String, Vec<(PairSignal, Option<&'static str>)>> = HashMap::new();
    for signal in signals {
        let (name, role) = normalized_pair_name(&signal.path);
        grouped.entry(name).or_default().push((signal, role));
    }

    grouped
        .into_values()
        .filter_map(|candidates| {
            let before = candidates
                .iter()
                .find(|(_, role)| *role == Some("before"))?;
            let after = candidates.iter().find(|(_, role)| *role == Some("after"))?;
            let same_dimensions =
                before.0.width == after.0.width && before.0.height == after.0.height;
            let capture_gap = before.0.captured_at.abs_diff(after.0.captured_at);
            let capture_close = capture_gap <= 24 * 60 * 60;
            let confidence = 0.72
                + if same_dimensions { 0.14 } else { 0.0 }
                + if capture_close { 0.1 } else { 0.0 };
            Some(BeforeAfterPair {
                id: uuid::Uuid::new_v4().to_string(),
                before_path: before.0.path.clone(),
                after_path: after.0.path.clone(),
                confidence,
                evidence: vec![
                    "Normalized filenames match".into(),
                    if same_dimensions {
                        "Dimensions match".into()
                    } else {
                        "Dimensions differ; alignment review required".into()
                    },
                    if capture_close {
                        "Capture times are within 24 hours".into()
                    } else {
                        "Capture times differ by more than 24 hours".into()
                    },
                ],
            })
        })
        .collect()
}

fn exif_numeric(path: &Path, tag: exif::Tag) -> Option<f64> {
    let file = File::open(path).ok()?;
    let mut reader = BufReader::new(file);
    let exif = exif::Reader::new().read_from_container(&mut reader).ok()?;
    let field = exif.get_field(tag, exif::In::PRIMARY)?;
    match &field.value {
        exif::Value::Rational(values) => values.first().map(|value| value.to_f64()),
        exif::Value::SRational(values) => values.first().map(|value| value.to_f64()),
        _ => None,
    }
}

fn exif_text(path: &Path, tag: exif::Tag) -> Option<String> {
    let file = File::open(path).ok()?;
    let mut reader = BufReader::new(file);
    let metadata = exif::Reader::new().read_from_container(&mut reader).ok()?;
    metadata
        .get_field(tag, exif::In::PRIMARY)
        .map(|field| field.display_value().with_unit(&metadata).to_string())
}

fn average_hash(path: &Path) -> Result<u64, String> {
    let image = image::open(path).map_err(|error| error.to_string())?;
    let grayscale = image.thumbnail_exact(8, 8).to_luma8();
    let average = grayscale
        .pixels()
        .map(|pixel| u64::from(pixel[0]))
        .sum::<u64>()
        / 64;
    Ok(grayscale
        .pixels()
        .enumerate()
        .fold(0_u64, |hash, (index, pixel)| {
            hash | (u64::from(u64::from(pixel[0]) >= average) << index)
        }))
}

fn thumbnail_histogram(path: &Path) -> Result<[f64; 16], String> {
    let grayscale = image::open(path)
        .map_err(|error| error.to_string())?
        .thumbnail(128, 128)
        .to_luma8();
    let mut histogram = [0.0; 16];
    for pixel in grayscale.pixels() {
        histogram[usize::from(pixel[0]) / 16] += 1.0;
    }
    let total = f64::from(grayscale.width()) * f64::from(grayscale.height());
    histogram.iter_mut().for_each(|value| *value /= total);
    Ok(histogram)
}

fn capture_timestamp(path: &Path) -> i64 {
    get_exif_datetime(path)
        .and_then(|value| value.and_utc().timestamp().into())
        .or_else(|| {
            fs::metadata(path)
                .ok()?
                .modified()
                .ok()?
                .duration_since(UNIX_EPOCH)
                .ok()
                .map(|duration| duration.as_secs() as i64)
        })
        .unwrap_or_default()
}

fn sequence_signal(path: &Path) -> Result<SequenceSignal, String> {
    let image = image::open(path).map_err(|error| error.to_string())?;
    let (width, height) = image.dimensions();
    Ok(SequenceSignal {
        path: path.to_string_lossy().into_owned(),
        captured_at: capture_timestamp(path),
        exposure_seconds: exif_numeric(path, exif::Tag::ExposureTime),
        focus_distance: exif_numeric(path, exif::Tag::SubjectDistance),
        focal_length: exif_numeric(path, exif::Tag::FocalLength),
        width,
        height,
        visual_hash: average_hash(path)?,
        histogram: thumbnail_histogram(path)?,
        camera_id: [
            exif_text(path, exif::Tag::Make),
            exif_text(path, exif::Tag::Model),
            exif_text(path, exif::Tag::BodySerialNumber),
        ]
        .into_iter()
        .flatten()
        .reduce(|left, right| format!("{left}|{right}")),
    })
}

#[tauri::command]
pub fn analyze_sequences(
    paths: Vec<String>,
    max_gap_seconds: f64,
) -> Result<Vec<SequenceGroup>, String> {
    let signals = paths
        .iter()
        .map(|path| sequence_signal(Path::new(path)))
        .collect::<Result<Vec<_>, _>>()?;
    Ok(classify_sequences(
        signals,
        max_gap_seconds.clamp(0.5, 30.0),
    ))
}

#[tauri::command]
pub fn suggest_before_after_pairs(paths: Vec<String>) -> Result<Vec<BeforeAfterPair>, String> {
    let signals = paths
        .iter()
        .map(|path| {
            let image = image::open(path).map_err(|error| error.to_string())?;
            let (width, height) = image.dimensions();
            Ok(PairSignal {
                path: path.clone(),
                width,
                height,
                captured_at: capture_timestamp(Path::new(path)),
            })
        })
        .collect::<Result<Vec<_>, String>>()?;
    Ok(suggest_pairs(signals))
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SequenceExportRequest {
    pub output_dir: String,
    pub groups: Vec<SequenceGroup>,
}

fn sequence_folder(kind: SequenceKind) -> &'static str {
    match kind {
        SequenceKind::Hdr => "HDR",
        SequenceKind::Panorama => "Panorama",
        SequenceKind::Focus => "Focus",
        SequenceKind::Burst => "Burst",
        SequenceKind::Review => "Review",
    }
}

#[tauri::command]
pub fn export_sequences(
    app: AppHandle,
    state: State<'_, JobState>,
    request: SequenceExportRequest,
) -> Result<String, String> {
    let guard = state.begin("sequence_grouper".into())?;
    let total = request
        .groups
        .iter()
        .filter(|group| !group.excluded)
        .map(|group| group.paths.len())
        .sum();
    let mut current = 0usize;
    let mut output_assets = Vec::new();
    let root = PathBuf::from(&request.output_dir);
    fs::create_dir_all(&root).map_err(|error| error.to_string())?;
    let mut counters: HashMap<&str, usize> = HashMap::new();
    let mut manifest_groups = Vec::new();
    for group in request.groups.iter().filter(|group| !group.excluded) {
        if guard.cancelled.load(Ordering::Relaxed) {
            return Err("Sequence export was cancelled".into());
        }
        let label = sequence_folder(group.kind);
        let counter = counters.entry(label).or_default();
        *counter += 1;
        let folder = collision_safe_path(&root.join(format!("{label}-{:03}", *counter)));
        fs::create_dir_all(&folder).map_err(|error| error.to_string())?;
        let mut assets = Vec::new();
        for source in &group.paths {
            if guard.cancelled.load(Ordering::Relaxed) {
                let _ = app.emit(
                    JOB_FINISHED_EVENT,
                    JobResult {
                        job_id: "sequence_grouper".into(),
                        status: JobStatus::Cancelled,
                        outputs: output_assets,
                        warnings: Vec::new(),
                        manifest_path: None,
                    },
                );
                return Err("Sequence export was cancelled".into());
            }
            let _ = app.emit(
                JOB_PROGRESS_EVENT,
                JobProgress {
                    job_id: "sequence_grouper".into(),
                    phase: "processing".into(),
                    current,
                    total,
                    item_id: Some(source.clone()),
                    message_key: "jobs.processing".into(),
                },
            );
            let filename = Path::new(source)
                .file_name()
                .ok_or_else(|| format!("Invalid source path: {source}"))?;
            let destination = collision_safe_path(&folder.join(filename));
            let temporary = destination.with_file_name(format!(
                ".{}.lightops-part",
                destination
                    .file_name()
                    .and_then(|value| value.to_str())
                    .unwrap_or("image")
            ));
            if let Err(error) = fs::copy(source, &temporary) {
                let _ = fs::remove_file(&temporary);
                return Err(error.to_string());
            }
            if let Err(error) = fs::rename(&temporary, &destination) {
                let _ = fs::remove_file(&temporary);
                return Err(error.to_string());
            }
            output_assets.push(OutputAsset {
                source_path: source.clone(),
                output_path: destination.to_string_lossy().into_owned(),
                byte_size: fs::metadata(&destination)
                    .map(|metadata| metadata.len())
                    .unwrap_or(0),
                width: 0,
                height: 0,
                savings_bytes: 0,
            });
            current += 1;
            assets.push(serde_json::json!({
                "sourcePath": source,
                "copiedPath": destination.to_string_lossy(),
            }));
        }
        manifest_groups.push(serde_json::json!({
            "id": group.id,
            "type": group.kind,
            "confidence": group.confidence,
            "evidence": group.evidence,
            "assets": assets,
        }));
    }
    let manifest = collision_safe_path(&root.join("lightops-sequences.json"));
    let payload = serde_json::json!({ "schemaVersion": 1, "sequences": manifest_groups });
    let temporary_manifest = root.join(".lightops-sequences.lightops-part");
    fs::write(
        &temporary_manifest,
        serde_json::to_vec_pretty(&payload).map_err(|error| error.to_string())?,
    )
    .map_err(|error| error.to_string())?;
    if let Err(error) = fs::rename(&temporary_manifest, &manifest) {
        let _ = fs::remove_file(&temporary_manifest);
        return Err(error.to_string());
    }
    let manifest_path = manifest.to_string_lossy().into_owned();
    let _ = app.emit(
        JOB_FINISHED_EVENT,
        JobResult {
            job_id: "sequence_grouper".into(),
            status: JobStatus::Completed,
            outputs: output_assets,
            warnings: Vec::new(),
            manifest_path: Some(manifest_path.clone()),
        },
    );
    Ok(manifest_path)
}

#[tauri::command]
pub fn metadata_safe_share_categories() -> Vec<MetadataCategory> {
    safe_share_categories()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn exposure_variation_is_classified_as_hdr() {
        let frames = vec![
            SequenceSignal::fixture("a.jpg", 0, Some(1.0 / 250.0)),
            SequenceSignal::fixture("b.jpg", 1, Some(1.0 / 60.0)),
            SequenceSignal::fixture("c.jpg", 2, Some(1.0 / 15.0)),
        ];

        let groups = classify_sequences(frames, 5.0);
        assert_eq!(groups.len(), 1);
        assert_eq!(groups[0].kind, SequenceKind::Hdr);
        assert!(groups[0].confidence >= 0.8);
    }

    #[test]
    fn focus_distance_variation_is_classified_as_focus_stack() {
        let mut frames = vec![
            SequenceSignal::fixture("a.jpg", 0, None),
            SequenceSignal::fixture("b.jpg", 1, None),
            SequenceSignal::fixture("c.jpg", 2, None),
        ];
        frames[0].focus_distance = Some(0.5);
        frames[1].focus_distance = Some(0.8);
        frames[2].focus_distance = Some(1.2);

        let groups = classify_sequences(frames, 5.0);
        assert_eq!(groups[0].kind, SequenceKind::Focus);
        assert!(groups[0].evidence[0].contains("distance"));
    }

    #[test]
    fn stable_histogram_with_framing_shift_is_classified_as_panorama() {
        let mut frames = vec![
            SequenceSignal::fixture("a.jpg", 0, None),
            SequenceSignal::fixture("b.jpg", 1, None),
            SequenceSignal::fixture("c.jpg", 2, None),
        ];
        frames[1].visual_hash = u64::MAX;
        frames[2].visual_hash = 0;

        let groups = classify_sequences(frames, 5.0);
        assert_eq!(groups[0].kind, SequenceKind::Panorama);
        assert!(groups[0].confidence >= 0.8);
    }

    #[test]
    fn visually_similar_fast_frames_are_classified_as_burst() {
        let frames = vec![
            SequenceSignal::fixture("a.jpg", 0, None),
            SequenceSignal::fixture("b.jpg", 1, None),
            SequenceSignal::fixture("c.jpg", 2, None),
        ];

        let groups = classify_sequences(frames, 5.0);
        assert_eq!(groups[0].kind, SequenceKind::Burst);
    }

    #[test]
    fn ambiguous_two_frame_sequence_requires_review() {
        let frames = vec![
            SequenceSignal::fixture("a.jpg", 0, None),
            SequenceSignal::fixture("b.jpg", 1, None),
        ];

        let groups = classify_sequences(frames, 5.0);
        assert_eq!(groups[0].kind, SequenceKind::Review);
        assert!(groups[0].confidence < 0.5);
    }

    #[test]
    fn time_gap_and_camera_identity_split_sequences() {
        let mut frames = vec![
            SequenceSignal::fixture("a.jpg", 0, None),
            SequenceSignal::fixture("b.jpg", 1, None),
            SequenceSignal::fixture("c.jpg", 20, None),
            SequenceSignal::fixture("d.jpg", 21, None),
            SequenceSignal::fixture("e.jpg", 22, None),
            SequenceSignal::fixture("f.jpg", 23, None),
        ];
        frames[4].camera_id = Some("second-camera".into());
        frames[5].camera_id = Some("second-camera".into());

        let groups = classify_sequences(frames, 5.0);
        assert_eq!(groups.len(), 3);
        assert_eq!(groups[0].paths, vec!["a.jpg", "b.jpg"]);
        assert_eq!(groups[1].paths, vec!["c.jpg", "d.jpg"]);
        assert_eq!(groups[2].paths, vec!["e.jpg", "f.jpg"]);
    }

    #[test]
    fn normalized_before_after_names_are_paired() {
        let pairs = suggest_pairs(vec![
            PairSignal::fixture("/shoot/portrait_before.jpg", 2000, 3000),
            PairSignal::fixture("/shoot/portrait-after.jpg", 2000, 3000),
            PairSignal::fixture("/shoot/unrelated.jpg", 1000, 1000),
        ]);

        assert_eq!(pairs.len(), 1);
        assert_eq!(pairs[0].before_path, "/shoot/portrait_before.jpg");
        assert_eq!(pairs[0].after_path, "/shoot/portrait-after.jpg");
        assert!(pairs[0].confidence >= 0.9);
    }

    #[test]
    fn safe_share_selects_only_private_metadata_categories() {
        assert_eq!(
            safe_share_categories(),
            vec![
                MetadataCategory::Location,
                MetadataCategory::DeviceIdentity,
                MetadataCategory::People,
                MetadataCategory::EditHistory,
                MetadataCategory::EmbeddedPreview,
            ]
        );
    }
}
