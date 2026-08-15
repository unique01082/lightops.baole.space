use super::{
    media::{
        collision_safe_path, normalize_orientation, read_orientation, JobProgress, JobResult,
        JobState, JobStatus, OutputAsset, JOB_FINISHED_EVENT, JOB_PROGRESS_EVENT,
    },
    metadata::exiftool_path,
    process_utils::{output_with_timeout, output_with_timeout_cancellable},
};
use base64::{engine::general_purpose::STANDARD, Engine};
use image::{imageops, DynamicImage, GenericImageView, ImageBuffer, ImageFormat, Rgba, RgbaImage};
use serde::{Deserialize, Serialize};
use std::{
    fs,
    path::{Path, PathBuf},
    process::Command,
    sync::atomic::Ordering,
    time::Duration,
};
use tauri::{AppHandle, Emitter, Manager, State};

#[cfg(test)]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum VideoPlatform {
    MacOs,
    Windows,
}

#[cfg(test)]
pub fn ffmpeg_video_arguments(
    frames_pattern: &str,
    output: &str,
    platform: VideoPlatform,
) -> Vec<String> {
    let encoder = match platform {
        VideoPlatform::MacOs => "h264_videotoolbox",
        VideoPlatform::Windows => "h264_mf",
    };
    [
        "-y",
        "-framerate",
        "30",
        "-i",
        frames_pattern,
        "-c:v",
        encoder,
        "-pix_fmt",
        "yuv420p",
        output,
    ]
    .into_iter()
    .map(str::to_string)
    .collect()
}

fn ffmpeg_path(app: &AppHandle) -> Result<PathBuf, String> {
    if let Ok(path) = std::env::var("LIGHTOPS_FFMPEG_PATH") {
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
        "ffmpeg.exe"
    } else {
        "ffmpeg"
    };
    [
        resource_dir.join("bin").join(filename),
        resource_dir.join(filename),
    ]
    .into_iter()
    .find(|candidate| candidate.is_file())
    .ok_or_else(|| "Bundled FFmpeg is missing. Reinstall LightOps from an official package.".into())
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportPair {
    id: String,
    before_path: String,
    after_path: String,
}

#[derive(Debug, Clone, Copy, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ComparisonFormat {
    SideBySide,
    Split,
    ContactSheet,
    Html,
    Mp4,
    Gif,
}

#[derive(Debug, Clone, Copy, Default, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum StillFormat {
    Jpeg,
    #[default]
    Png,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BeforeAfterExportRequest {
    output_dir: String,
    pairs: Vec<ExportPair>,
    formats: Vec<ComparisonFormat>,
    long_edge: u32,
    duration_seconds: f64,
    #[serde(default)]
    still_format: StillFormat,
    #[serde(default = "default_zoom")]
    zoom: f64,
    #[serde(default)]
    offset_x: i32,
    #[serde(default)]
    offset_y: i32,
}

fn default_zoom() -> f64 {
    1.0
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BeforeAfterExportResult {
    outputs: Vec<String>,
    warnings: Vec<String>,
}

fn fit_canvas(
    image: DynamicImage,
    canvas_width: u32,
    canvas_height: u32,
    zoom: f64,
    offset_x: i32,
    offset_y: i32,
) -> RgbaImage {
    let fitted = image.thumbnail(canvas_width, canvas_height);
    let zoom = zoom.clamp(0.25, 4.0);
    let fitted_width = (f64::from(fitted.width()) * zoom).round().max(1.0) as u32;
    let fitted_height = (f64::from(fitted.height()) * zoom).round().max(1.0) as u32;
    let fitted = fitted
        .resize_exact(fitted_width, fitted_height, imageops::FilterType::Lanczos3)
        .to_rgba8();
    let mut canvas = ImageBuffer::from_pixel(canvas_width, canvas_height, Rgba([18, 18, 24, 255]));
    let x = (i64::from(canvas_width) - i64::from(fitted.width())) / 2 + i64::from(offset_x);
    let y = (i64::from(canvas_height) - i64::from(fitted.height())) / 2 + i64::from(offset_y);
    imageops::overlay(&mut canvas, &fitted, x, y);
    canvas
}

fn aligned_pair(
    before: &Path,
    after: &Path,
    long_edge: u32,
    zoom: f64,
    offset_x: i32,
    offset_y: i32,
) -> Result<(RgbaImage, RgbaImage), String> {
    let after_image = normalize_orientation(
        image::open(after).map_err(|error| error.to_string())?,
        read_orientation(after),
    );
    let (after_width, after_height) = after_image.dimensions();
    let scale = f64::from(long_edge.max(1)) / f64::from(after_width.max(after_height));
    let canvas_width = (f64::from(after_width) * scale).round().max(1.0) as u32;
    let canvas_height = (f64::from(after_height) * scale).round().max(1.0) as u32;
    let before_image = normalize_orientation(
        image::open(before).map_err(|error| error.to_string())?,
        read_orientation(before),
    );
    Ok((
        fit_canvas(
            before_image,
            canvas_width,
            canvas_height,
            zoom,
            offset_x,
            offset_y,
        ),
        fit_canvas(after_image, canvas_width, canvas_height, 1.0, 0, 0),
    ))
}

fn write_png(path: &Path, image: &RgbaImage) -> Result<(), String> {
    DynamicImage::ImageRgba8(image.clone())
        .save_with_format(path, ImageFormat::Png)
        .map_err(|error| error.to_string())
}

fn write_still(path: &Path, image: &RgbaImage, format: StillFormat) -> Result<(), String> {
    let format = match format {
        StillFormat::Jpeg => ImageFormat::Jpeg,
        StillFormat::Png => ImageFormat::Png,
    };
    DynamicImage::ImageRgba8(image.clone())
        .save_with_format(path, format)
        .map_err(|error| error.to_string())
}

fn export_atomic(
    destination: &Path,
    export: impl FnOnce(&Path) -> Result<(), String>,
) -> Result<(), String> {
    let stem = destination
        .file_stem()
        .and_then(|value| value.to_str())
        .unwrap_or("output");
    let extension = destination
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or("part");
    let temporary = destination.with_file_name(format!(".{stem}.lightops-part.{extension}"));
    let _ = fs::remove_file(&temporary);
    if let Err(error) = export(&temporary) {
        let _ = fs::remove_file(&temporary);
        return Err(error);
    }
    if let Err(error) = fs::rename(&temporary, destination) {
        let _ = fs::remove_file(&temporary);
        return Err(error.to_string());
    }
    Ok(())
}

fn side_by_side(before: &RgbaImage, after: &RgbaImage) -> RgbaImage {
    let mut output =
        ImageBuffer::from_pixel(before.width() * 2, before.height(), Rgba([0, 0, 0, 255]));
    imageops::overlay(&mut output, before, 0, 0);
    imageops::overlay(&mut output, after, i64::from(before.width()), 0);
    output
}

fn split_image(before: &RgbaImage, after: &RgbaImage) -> RgbaImage {
    ImageBuffer::from_fn(before.width(), before.height(), |x, y| {
        if x < before.width() / 2 {
            *before.get_pixel(x, y)
        } else {
            *after.get_pixel(x, y)
        }
    })
}

fn contact_sheet(pairs: &[(RgbaImage, RgbaImage)]) -> Option<RgbaImage> {
    if pairs.is_empty() {
        return None;
    }
    let rows = pairs
        .iter()
        .map(|(before, after)| side_by_side(before, after));
    let width = pairs
        .iter()
        .map(|(before, after)| before.width() + after.width())
        .max()?;
    let height = pairs.iter().map(|(before, _)| before.height()).sum::<u32>();
    let mut sheet = ImageBuffer::from_pixel(width, height, Rgba([18, 18, 24, 255]));
    let mut y = 0_i64;
    for row in rows {
        imageops::overlay(&mut sheet, &row, 0, y);
        y += i64::from(row.height());
    }
    Some(sheet)
}

fn mime_for(path: &Path) -> &'static str {
    match path
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or("")
        .to_ascii_lowercase()
        .as_str()
    {
        "png" => "image/png",
        "webp" => "image/webp",
        "tif" | "tiff" => "image/tiff",
        _ => "image/jpeg",
    }
}

fn html_slider(before: &Path, after: &Path) -> Result<String, String> {
    let before_data = STANDARD.encode(fs::read(before).map_err(|error| error.to_string())?);
    let after_data = STANDARD.encode(fs::read(after).map_err(|error| error.to_string())?);
    Ok(format!(
        r#"<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>LightOps Before/After</title><style>*{{box-sizing:border-box}}body{{margin:0;background:#111;color:#fff;font:14px system-ui;display:grid;min-height:100vh;place-items:center}}.c{{position:relative;max-width:96vw;overflow:hidden}}img{{display:block;max-width:96vw;max-height:92vh}}.a{{position:absolute;inset:0;clip-path:inset(0 50% 0 0)}}input{{position:absolute;inset:auto 5% 16px;width:90%}}</style></head><body><div class="c"><img src="data:{};base64,{}" alt="After"><img class="a" id="before" src="data:{};base64,{}" alt="Before"><input aria-label="Before after position" type="range" min="0" max="100" value="50" oninput="before.style.clipPath=`inset(0 ${{100-this.value}}% 0 0)`"></div></body></html>"#,
        mime_for(after),
        after_data,
        mime_for(before),
        before_data
    ))
}

fn run_video_export(
    ffmpeg: &Path,
    before: &Path,
    after: &Path,
    output: &Path,
    duration: f64,
    gif: bool,
    cancelled: &std::sync::atomic::AtomicBool,
) -> Result<(), String> {
    let transition = duration.clamp(1.0, 30.0) / 3.0;
    let offset = duration.clamp(1.0, 30.0) / 2.0;
    let filter = format!(
        "[0:v]scale=1080:-2:force_original_aspect_ratio=decrease,pad=1080:1080:(ow-iw)/2:(oh-ih)/2[v0];[1:v]scale=1080:-2:force_original_aspect_ratio=decrease,pad=1080:1080:(ow-iw)/2:(oh-ih)/2[v1];[v0][v1]xfade=transition=wipeleft:duration={transition}:offset={offset}[v]"
    );
    let mut command = Command::new(ffmpeg);
    command
        .args([
            "-y",
            "-hide_banner",
            "-loglevel",
            "error",
            "-loop",
            "1",
            "-i",
        ])
        .arg(before)
        .args(["-loop", "1", "-i"])
        .arg(after)
        .args([
            "-filter_complex",
            &filter,
            "-map",
            "[v]",
            "-t",
            &duration.to_string(),
            "-r",
            "30",
        ]);
    if gif {
        command.args(["-f", "gif"]);
    } else {
        let encoder = if cfg!(target_os = "macos") {
            "h264_videotoolbox"
        } else {
            "h264_mf"
        };
        command.args(["-c:v", encoder, "-pix_fmt", "yuv420p"]);
    }
    command.arg(output);
    let result = output_with_timeout_cancellable(
        &mut command,
        Duration::from_secs(600),
        "FFmpeg before/after export",
        Some(cancelled),
    )?;
    if result.status.success() {
        Ok(())
    } else {
        Err(String::from_utf8_lossy(&result.stderr).trim().to_string())
    }
}

#[tauri::command]
pub fn export_before_after(
    app: AppHandle,
    state: State<'_, JobState>,
    request: BeforeAfterExportRequest,
) -> Result<BeforeAfterExportResult, String> {
    let guard = state.begin("before_after".into())?;
    let output_dir = PathBuf::from(&request.output_dir);
    fs::create_dir_all(&output_dir).map_err(|error| error.to_string())?;
    let needs_video = request
        .formats
        .iter()
        .any(|format| matches!(format, ComparisonFormat::Mp4 | ComparisonFormat::Gif));
    let ffmpeg = if needs_video {
        Some(ffmpeg_path(&app)?)
    } else {
        None
    };
    let mut outputs = Vec::new();
    let mut warnings = Vec::new();

    if request.formats.contains(&ComparisonFormat::ContactSheet) {
        let aligned = request
            .pairs
            .iter()
            .map(|pair| {
                aligned_pair(
                    Path::new(&pair.before_path),
                    Path::new(&pair.after_path),
                    request.long_edge.max(1),
                    request.zoom,
                    request.offset_x,
                    request.offset_y,
                )
            })
            .collect::<Result<Vec<_>, _>>()?;
        if let Some(sheet) = contact_sheet(&aligned) {
            let extension = match request.still_format {
                StillFormat::Jpeg => "jpg",
                StillFormat::Png => "png",
            };
            let destination =
                collision_safe_path(&output_dir.join(format!("contact-sheet.{extension}")));
            match export_atomic(&destination, |temporary| {
                write_still(temporary, &sheet, request.still_format)
            }) {
                Ok(()) => outputs.push(destination.to_string_lossy().into_owned()),
                Err(error) => warnings.push(format!("contact-sheet: {error}")),
            }
        }
    }

    for (pair_index, pair) in request.pairs.iter().enumerate() {
        if guard.cancelled.load(Ordering::Relaxed) {
            let _ = app.emit(
                JOB_FINISHED_EVENT,
                before_after_job_result(JobStatus::Cancelled, &outputs, &warnings),
            );
            return Err("Before/after export was cancelled".into());
        }
        let _ = app.emit(
            JOB_PROGRESS_EVENT,
            JobProgress {
                job_id: "before_after".into(),
                phase: "processing".into(),
                current: pair_index,
                total: request.pairs.len(),
                item_id: Some(pair.id.clone()),
                message_key: "jobs.processing".into(),
            },
        );
        let before_path = Path::new(&pair.before_path);
        let after_path = Path::new(&pair.after_path);
        let (before, after) = aligned_pair(
            before_path,
            after_path,
            request.long_edge.max(1),
            request.zoom,
            request.offset_x,
            request.offset_y,
        )?;
        let video_frames = if needs_video {
            let before_frame = output_dir.join(format!(".{}-before.lightops-frame.png", pair.id));
            let after_frame = output_dir.join(format!(".{}-after.lightops-frame.png", pair.id));
            if let Err(error) = write_png(&before_frame, &before) {
                let _ = fs::remove_file(&before_frame);
                return Err(error);
            }
            if let Err(error) = write_png(&after_frame, &after) {
                let _ = fs::remove_file(&before_frame);
                let _ = fs::remove_file(&after_frame);
                return Err(error);
            }
            Some((before_frame, after_frame))
        } else {
            None
        };
        for format in &request.formats {
            if guard.cancelled.load(Ordering::Relaxed) {
                if let Some((before_frame, after_frame)) = &video_frames {
                    let _ = fs::remove_file(before_frame);
                    let _ = fs::remove_file(after_frame);
                }
                let _ = app.emit(
                    JOB_FINISHED_EVENT,
                    before_after_job_result(JobStatus::Cancelled, &outputs, &warnings),
                );
                return Err("Before/after export was cancelled".into());
            }
            if *format == ComparisonFormat::ContactSheet {
                continue;
            }
            let still_extension = match request.still_format {
                StillFormat::Jpeg => "jpg",
                StillFormat::Png => "png",
            };
            let (suffix, extension) = match format {
                ComparisonFormat::SideBySide => ("side-by-side", still_extension),
                ComparisonFormat::Split => ("split", still_extension),
                ComparisonFormat::ContactSheet => unreachable!("handled once for all pairs"),
                ComparisonFormat::Html => ("slider", "html"),
                ComparisonFormat::Mp4 => ("transition", "mp4"),
                ComparisonFormat::Gif => ("transition", "gif"),
            };
            let destination =
                collision_safe_path(&output_dir.join(format!("{}-{suffix}.{extension}", pair.id)));
            let exported = export_atomic(&destination, |temporary| match format {
                ComparisonFormat::SideBySide => write_still(
                    temporary,
                    &side_by_side(&before, &after),
                    request.still_format,
                ),
                ComparisonFormat::Split => write_still(
                    temporary,
                    &split_image(&before, &after),
                    request.still_format,
                ),
                ComparisonFormat::Html => {
                    fs::write(temporary, html_slider(before_path, after_path)?)
                        .map_err(|error| error.to_string())
                }
                ComparisonFormat::Mp4 => run_video_export(
                    ffmpeg.as_deref().expect("FFmpeg resolved"),
                    &video_frames.as_ref().expect("frames resolved").0,
                    &video_frames.as_ref().expect("frames resolved").1,
                    temporary,
                    request.duration_seconds,
                    false,
                    &guard.cancelled,
                ),
                ComparisonFormat::Gif => run_video_export(
                    ffmpeg.as_deref().expect("FFmpeg resolved"),
                    &video_frames.as_ref().expect("frames resolved").0,
                    &video_frames.as_ref().expect("frames resolved").1,
                    temporary,
                    request.duration_seconds,
                    true,
                    &guard.cancelled,
                ),
                ComparisonFormat::ContactSheet => unreachable!("handled once for all pairs"),
            });
            match exported {
                Ok(()) => outputs.push(destination.to_string_lossy().into_owned()),
                Err(error) => warnings.push(format!("{}: {error}", pair.id)),
            }
        }
        if let Some((before_frame, after_frame)) = video_frames {
            let _ = fs::remove_file(before_frame);
            let _ = fs::remove_file(after_frame);
        }
    }
    let _ = app.emit(
        JOB_FINISHED_EVENT,
        before_after_job_result(JobStatus::Completed, &outputs, &warnings),
    );
    Ok(BeforeAfterExportResult { outputs, warnings })
}

fn before_after_job_result(
    status: JobStatus,
    outputs: &[String],
    warnings: &[String],
) -> JobResult {
    JobResult {
        job_id: "before_after".into(),
        status,
        outputs: outputs
            .iter()
            .map(|output| OutputAsset {
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
        warnings: warnings.to_vec(),
        manifest_path: None,
    }
}

#[tauri::command]
pub fn media_sidecar_status(app: AppHandle) -> serde_json::Value {
    let ffmpeg = ffmpeg_path(&app).ok();
    let exiftool = exiftool_path(&app).ok();
    let encoder = if cfg!(target_os = "macos") {
        "h264_videotoolbox"
    } else {
        "h264_mf"
    };
    let ffmpeg_version = ffmpeg.as_ref().and_then(|path| {
        let mut command = Command::new(path);
        command.arg("-version");
        output_with_timeout(&mut command, Duration::from_secs(10), "FFmpeg self-check")
            .ok()
            .filter(|output| output.status.success())
            .and_then(|output| String::from_utf8(output.stdout).ok())
            .and_then(|output| output.lines().next().map(str::to_string))
    });
    let encoder_available = ffmpeg.as_ref().is_some_and(|path| {
        let mut command = Command::new(path);
        command.args(["-hide_banner", "-encoders"]);
        output_with_timeout(
            &mut command,
            Duration::from_secs(10),
            "FFmpeg encoder self-check",
        )
        .ok()
        .filter(|output| output.status.success())
        .is_some_and(|output| String::from_utf8_lossy(&output.stdout).contains(encoder))
    });
    let exiftool_version = exiftool.as_ref().and_then(|path| {
        let mut command = Command::new(path);
        command.arg("-ver");
        output_with_timeout(&mut command, Duration::from_secs(10), "ExifTool self-check")
            .ok()
            .filter(|output| output.status.success())
            .and_then(|output| String::from_utf8(output.stdout).ok())
            .map(|output| output.trim().to_string())
    });
    serde_json::json!({
        "ffmpeg": ffmpeg_version.is_some(),
        "ffmpegVersion": ffmpeg_version,
        "ffmpegEncoder": encoder,
        "ffmpegEncoderAvailable": encoder_available,
        "exiftool": exiftool_version.is_some(),
        "exiftoolVersion": exiftool_version,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn macos_mp4_uses_lgpl_system_encoder() {
        let args =
            ffmpeg_video_arguments("frames/%04d.png", "comparison.mp4", VideoPlatform::MacOs);
        assert!(args
            .windows(2)
            .any(|pair| pair == ["-c:v", "h264_videotoolbox"]));
        assert!(!args.iter().any(|arg| arg.contains("libx264")));
    }

    #[test]
    fn windows_mp4_uses_media_foundation_encoder() {
        let args =
            ffmpeg_video_arguments("frames/%04d.png", "comparison.mp4", VideoPlatform::Windows);
        assert!(args.windows(2).any(|pair| pair == ["-c:v", "h264_mf"]));
    }

    #[test]
    fn failed_export_removes_partial_file() {
        let directory = tempfile::tempdir().expect("temp dir");
        let destination = directory.path().join("comparison.png");
        let result = export_atomic(&destination, |temporary| {
            fs::write(temporary, b"partial").expect("temporary write");
            Err("fixture failure".into())
        });
        assert!(result.is_err());
        assert!(!destination.exists());
        assert_eq!(
            fs::read_dir(directory.path()).expect("directory").count(),
            0
        );
    }

    #[test]
    fn contact_sheet_contains_every_pair_as_a_row() {
        let first = (
            ImageBuffer::from_pixel(10, 5, Rgba([1, 2, 3, 255])),
            ImageBuffer::from_pixel(10, 5, Rgba([4, 5, 6, 255])),
        );
        let second = (
            ImageBuffer::from_pixel(8, 7, Rgba([7, 8, 9, 255])),
            ImageBuffer::from_pixel(8, 7, Rgba([10, 11, 12, 255])),
        );
        let sheet = contact_sheet(&[first, second]).expect("sheet");
        assert_eq!(sheet.dimensions(), (20, 12));
        assert_eq!(sheet.get_pixel(0, 0), &Rgba([1, 2, 3, 255]));
        assert_eq!(sheet.get_pixel(0, 5), &Rgba([7, 8, 9, 255]));
    }

    #[test]
    fn side_by_side_and_split_keep_expected_pixels() {
        let before = ImageBuffer::from_pixel(10, 6, Rgba([10, 20, 30, 255]));
        let after = ImageBuffer::from_pixel(10, 6, Rgba([200, 210, 220, 255]));

        let side = side_by_side(&before, &after);
        assert_eq!(side.dimensions(), (20, 6));
        assert_eq!(side.get_pixel(0, 0), before.get_pixel(0, 0));
        assert_eq!(side.get_pixel(19, 0), after.get_pixel(9, 0));

        let split = split_image(&before, &after);
        assert_eq!(split.dimensions(), (10, 6));
        assert_eq!(split.get_pixel(4, 0), before.get_pixel(4, 0));
        assert_eq!(split.get_pixel(5, 0), after.get_pixel(5, 0));
    }

    #[test]
    fn mismatched_before_is_fitted_to_after_canvas_without_crop() {
        let directory = tempfile::tempdir().expect("temp dir");
        let before_path = directory.path().join("before.png");
        let after_path = directory.path().join("after.png");
        ImageBuffer::from_pixel(400, 100, Rgba([255_u8, 0, 0, 255]))
            .save(&before_path)
            .expect("before fixture");
        ImageBuffer::from_pixel(200, 300, Rgba([0_u8, 0, 255, 255]))
            .save(&after_path)
            .expect("after fixture");

        let (before, after) =
            aligned_pair(&before_path, &after_path, 300, 1.0, 0, 0).expect("aligned pair");

        assert_eq!(before.dimensions(), (200, 300));
        assert_eq!(after.dimensions(), (200, 300));
        assert_eq!(before.get_pixel(0, 0), &Rgba([18, 18, 24, 255]));
        assert_eq!(before.get_pixel(100, 150), &Rgba([255, 0, 0, 255]));
    }

    #[test]
    fn html_slider_is_self_contained_and_accessible() {
        let directory = tempfile::tempdir().expect("temp dir");
        let before_path = directory.path().join("before.png");
        let after_path = directory.path().join("after.png");
        ImageBuffer::from_pixel(2, 2, Rgba([1_u8, 2, 3, 255]))
            .save(&before_path)
            .expect("before fixture");
        ImageBuffer::from_pixel(2, 2, Rgba([4_u8, 5, 6, 255]))
            .save(&after_path)
            .expect("after fixture");

        let html = html_slider(&before_path, &after_path).expect("slider HTML");

        assert_eq!(html.matches("data:image/png;base64,").count(), 2);
        assert!(!html.contains("http://"));
        assert!(!html.contains("https://"));
        assert!(html.contains("aria-label=\"Before after position\""));
        assert!(html.contains("alt=\"Before\""));
        assert!(html.contains("alt=\"After\""));
    }
}
