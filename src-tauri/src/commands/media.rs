use super::process_utils::output_with_timeout;
use image::{
    codecs::{jpeg::JpegEncoder, png::PngEncoder, tiff::TiffEncoder, webp::WebPEncoder},
    DynamicImage, GenericImageView, ImageDecoder, ImageEncoder, ImageFormat, ImageReader,
};
use parking_lot::Mutex;
use serde::{Deserialize, Serialize};
use std::{
    fs,
    io::{BufReader, Cursor},
    path::{Path, PathBuf},
    process::Command,
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc,
    },
    time::Duration,
};
use tauri::{AppHandle, Emitter, Manager, State};
use tauri_plugin_clipboard_manager::ClipboardExt;

pub const JOB_PROGRESS_EVENT: &str = "lightops://job-progress";
pub const JOB_FINISHED_EVENT: &str = "lightops://job-finished";

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ToolId {
    IngestRename,
    Resize,
    Minimize,
    SequenceGrouper,
    MetadataCleaner,
    BeforeAfter,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ResizeMode {
    Width,
    Height,
    LongEdge,
    Percentage,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ResizeOptions {
    pub mode: ResizeMode,
    pub value: f64,
    pub allow_upscale: bool,
    pub output_format: Option<String>,
    pub quality: Option<u8>,
    pub suffix: String,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum MinimizeMode {
    Lossless,
    Compressed,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MinimizeOptions {
    pub mode: MinimizeMode,
    pub quality: u8,
    pub target_bytes: Option<u64>,
    pub output_format: Option<String>,
    pub suffix: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ToolOptions {
    Resize(ResizeOptions),
    Minimize(MinimizeOptions),
    SequenceGrouper { max_gap_seconds: f64 },
    MetadataCleaner { categories: Vec<String> },
    BeforeAfter { format: String },
    IngestRename,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ToolJobRequest {
    pub schema_version: u8,
    pub job_id: String,
    pub tool_id: ToolId,
    pub inputs: Vec<String>,
    pub output_dir: String,
    pub options: ToolOptions,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MediaAsset {
    pub id: String,
    pub path: String,
    pub format: String,
    pub width: u32,
    pub height: u32,
    pub byte_size: u64,
    pub bit_depth: u8,
    pub has_alpha: bool,
    pub has_icc_profile: bool,
    pub orientation: u8,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OutputAsset {
    pub source_path: String,
    pub output_path: String,
    pub byte_size: u64,
    pub width: u32,
    pub height: u32,
    pub savings_bytes: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum JobStatus {
    Completed,
    Cancelled,
    Failed,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct JobResult {
    pub job_id: String,
    pub status: JobStatus,
    pub outputs: Vec<OutputAsset>,
    pub warnings: Vec<String>,
    pub manifest_path: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct JobProgress {
    pub job_id: String,
    pub phase: String,
    pub current: usize,
    pub total: usize,
    pub item_id: Option<String>,
    pub message_key: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StartJobResult {
    pub job_id: String,
}

type ActiveJob = Option<(String, Arc<AtomicBool>)>;

#[derive(Clone, Default)]
pub struct JobState {
    active: Arc<Mutex<ActiveJob>>,
}

pub(crate) struct ProcessingGuard {
    state: JobState,
    job_id: String,
    pub cancelled: Arc<AtomicBool>,
}

impl Drop for ProcessingGuard {
    fn drop(&mut self) {
        let mut active = self.state.active.lock();
        if active.as_ref().is_some_and(|(id, _)| id == &self.job_id) {
            *active = None;
        }
    }
}

impl JobState {
    pub(crate) fn begin(&self, job_id: String) -> Result<ProcessingGuard, String> {
        let cancelled = Arc::new(AtomicBool::new(false));
        let mut active = self.active.lock();
        if active.is_some() {
            return Err("Another processing job is already running".into());
        }
        *active = Some((job_id.clone(), cancelled.clone()));
        Ok(ProcessingGuard {
            state: self.clone(),
            job_id,
            cancelled,
        })
    }

    pub(crate) fn cancel(&self, job_id: &str) -> Result<(), String> {
        let active = self.active.lock();
        let (_, cancelled) = active
            .as_ref()
            .filter(|(active_id, _)| active_id == job_id)
            .ok_or_else(|| "Job is not active".to_string())?;
        cancelled.store(true, Ordering::Relaxed);
        Ok(())
    }
}

pub fn calculate_resize_dimensions(width: u32, height: u32, options: &ResizeOptions) -> (u32, u32) {
    let scale = match options.mode {
        ResizeMode::Width => options.value / f64::from(width),
        ResizeMode::Height => options.value / f64::from(height),
        ResizeMode::LongEdge => options.value / f64::from(width.max(height)),
        ResizeMode::Percentage => options.value / 100.0,
    };
    let scale = if options.allow_upscale {
        scale
    } else {
        scale.min(1.0)
    }
    .max(1.0 / f64::from(width.max(height)));

    (
        (f64::from(width) * scale).round().max(1.0) as u32,
        (f64::from(height) * scale).round().max(1.0) as u32,
    )
}

pub(crate) fn read_orientation(path: &Path) -> u8 {
    let Ok(file) = fs::File::open(path) else {
        return 1;
    };
    let mut reader = BufReader::new(file);
    exif::Reader::new()
        .read_from_container(&mut reader)
        .ok()
        .and_then(|metadata| {
            metadata
                .get_field(exif::Tag::Orientation, exif::In::PRIMARY)
                .and_then(|field| field.value.get_uint(0))
        })
        .and_then(|value| u8::try_from(value).ok())
        .filter(|value| (1..=8).contains(value))
        .unwrap_or(1)
}

pub(crate) fn normalize_orientation(image: DynamicImage, orientation: u8) -> DynamicImage {
    match orientation {
        2 => image.fliph(),
        3 => image.rotate180(),
        4 => image.flipv(),
        5 => image.rotate90().fliph(),
        6 => image.rotate90(),
        7 => image.rotate270().fliph(),
        8 => image.rotate270(),
        _ => image,
    }
}

pub fn collision_safe_path(desired: &Path) -> PathBuf {
    if !desired.exists() {
        return desired.to_path_buf();
    }

    let parent = desired.parent().unwrap_or_else(|| Path::new("."));
    let stem = desired
        .file_stem()
        .and_then(|value| value.to_str())
        .unwrap_or("output");
    let extension = desired.extension().and_then(|value| value.to_str());

    for index in 2.. {
        let filename = match extension {
            Some(extension) => format!("{stem}-{index}.{extension}"),
            None => format!("{stem}-{index}"),
        };
        let candidate = parent.join(filename);
        if !candidate.exists() {
            return candidate;
        }
    }
    unreachable!("collision loop always returns")
}

fn format_from_path(path: &Path) -> Result<ImageFormat, String> {
    let extension = path
        .extension()
        .and_then(|value| value.to_str())
        .ok_or_else(|| format!("Missing file extension: {}", path.display()))?;
    ImageFormat::from_extension(extension)
        .filter(|format| {
            matches!(
                format,
                ImageFormat::Jpeg | ImageFormat::Png | ImageFormat::Tiff | ImageFormat::WebP
            )
        })
        .ok_or_else(|| format!("Unsupported image format: {extension}"))
}

#[tauri::command]
pub fn expand_media_paths(paths: Vec<String>) -> Vec<String> {
    let mut expanded = Vec::new();
    for input in paths {
        let path = Path::new(&input);
        if path.is_file() {
            if format_from_path(path).is_ok() {
                expanded.push(input);
            }
            continue;
        }
        if path.is_dir() {
            expanded.extend(
                walkdir::WalkDir::new(path)
                    .follow_links(false)
                    .into_iter()
                    .filter_map(Result::ok)
                    .filter(|entry| entry.file_type().is_file())
                    .map(|entry| entry.into_path())
                    .filter(|path| format_from_path(path).is_ok())
                    .map(|path| path.to_string_lossy().into_owned()),
            );
        }
    }
    expanded.sort();
    expanded.dedup();
    expanded
}

fn format_extension(format: ImageFormat) -> &'static str {
    match format {
        ImageFormat::Jpeg => "jpg",
        ImageFormat::Png => "png",
        ImageFormat::Tiff => "tiff",
        ImageFormat::WebP => "webp",
        _ => "img",
    }
}

fn requested_format(source: &Path, requested: Option<&str>) -> Result<ImageFormat, String> {
    match requested {
        Some(value) if !value.eq_ignore_ascii_case("source") => ImageFormat::from_extension(value)
            .filter(|format| {
                matches!(
                    format,
                    ImageFormat::Jpeg | ImageFormat::Png | ImageFormat::Tiff | ImageFormat::WebP
                )
            })
            .ok_or_else(|| format!("Unsupported output format: {value}")),
        _ => format_from_path(source),
    }
}

fn output_path(source: &Path, output_dir: &Path, suffix: &str, format: ImageFormat) -> PathBuf {
    let stem = source
        .file_stem()
        .and_then(|value| value.to_str())
        .unwrap_or("image");
    collision_safe_path(&output_dir.join(format!("{stem}{suffix}.{}", format_extension(format))))
}

fn write_atomic(path: &Path, bytes: &[u8]) -> Result<(), String> {
    write_atomic_with(path, bytes, |temporary, data| fs::write(temporary, data))
}

fn write_atomic_with(
    path: &Path,
    bytes: &[u8],
    write: impl FnOnce(&Path, &[u8]) -> std::io::Result<()>,
) -> Result<(), String> {
    let filename = path
        .file_name()
        .and_then(|value| value.to_str())
        .ok_or_else(|| "Invalid output filename".to_string())?;
    let temporary = path.with_file_name(format!(".{filename}.lightops-part"));
    if let Err(error) = write(&temporary, bytes).and_then(|()| fs::rename(&temporary, path)) {
        let _ = fs::remove_file(&temporary);
        return Err(error.to_string());
    }
    Ok(())
}

fn read_icc_profile(path: &Path) -> Result<Option<Vec<u8>>, String> {
    let reader = ImageReader::open(path)
        .map_err(|error| error.to_string())?
        .with_guessed_format()
        .map_err(|error| error.to_string())?;
    let mut decoder = reader.into_decoder().map_err(|error| error.to_string())?;
    decoder.icc_profile().map_err(|error| error.to_string())
}

fn apply_icc(encoder: &mut impl ImageEncoder, profile: &Option<Vec<u8>>) -> Result<(), String> {
    if let Some(profile) = profile {
        encoder
            .set_icc_profile(profile.clone())
            .map_err(|error| error.to_string())?;
    }
    Ok(())
}

fn channel_bit_depth(image: &DynamicImage) -> u16 {
    let color = image.color();
    color.bits_per_pixel() / u16::from(color.channel_count().max(1))
}

fn lossless_constraints_match(
    source: &DynamicImage,
    format: ImageFormat,
    candidate: &[u8],
    expected_icc: &Option<Vec<u8>>,
) -> Result<bool, String> {
    let decoded = image::load_from_memory_with_format(candidate, format)
        .map_err(|error| error.to_string())?;
    if decoded.dimensions() != source.dimensions()
        || channel_bit_depth(&decoded) != channel_bit_depth(source)
        || decoded.to_rgba16() != source.to_rgba16()
    {
        return Ok(false);
    }
    let reader = ImageReader::new(Cursor::new(candidate))
        .with_guessed_format()
        .map_err(|error| error.to_string())?;
    let mut decoder = reader.into_decoder().map_err(|error| error.to_string())?;
    Ok(decoder.icc_profile().map_err(|error| error.to_string())? == *expected_icc)
}

fn encode_image(
    image: &DynamicImage,
    format: ImageFormat,
    quality: u8,
    icc_profile: &Option<Vec<u8>>,
) -> Result<Vec<u8>, String> {
    match format {
        ImageFormat::Jpeg => {
            let mut bytes = Vec::new();
            let mut encoder = JpegEncoder::new_with_quality(&mut bytes, quality.clamp(1, 100));
            apply_icc(&mut encoder, icc_profile)?;
            image
                .write_with_encoder(encoder)
                .map_err(|error| error.to_string())?;
            Ok(bytes)
        }
        ImageFormat::Png => {
            let mut bytes = Vec::new();
            let mut encoder = PngEncoder::new(&mut bytes);
            apply_icc(&mut encoder, icc_profile)?;
            image
                .write_with_encoder(encoder)
                .map_err(|error| error.to_string())?;
            Ok(bytes)
        }
        ImageFormat::Tiff => {
            let mut cursor = Cursor::new(Vec::new());
            let mut encoder = TiffEncoder::new(&mut cursor);
            apply_icc(&mut encoder, icc_profile)?;
            image
                .write_with_encoder(encoder)
                .map_err(|error| error.to_string())?;
            Ok(cursor.into_inner())
        }
        ImageFormat::WebP => {
            if quality < 100 {
                let rgba = image.to_rgba8();
                return Ok(
                    webp::Encoder::from_rgba(rgba.as_raw(), rgba.width(), rgba.height())
                        .encode(f32::from(quality.clamp(1, 100)))
                        .to_vec(),
                );
            }
            let mut bytes = Vec::new();
            let mut encoder = WebPEncoder::new_lossless(&mut bytes);
            apply_icc(&mut encoder, icc_profile)?;
            image
                .write_with_encoder(encoder)
                .map_err(|error| error.to_string())?;
            Ok(bytes)
        }
        _ => Err("Unsupported output image format".into()),
    }
}

fn encode_to_target(
    image: &DynamicImage,
    format: ImageFormat,
    target: u64,
    icc_profile: &Option<Vec<u8>>,
) -> Result<(Vec<u8>, bool), String> {
    if !matches!(format, ImageFormat::Jpeg | ImageFormat::WebP) {
        return encode_image(image, format, 80, icc_profile).map(|bytes| {
            let reached = bytes.len() as u64 <= target + target / 20;
            (bytes, reached)
        });
    }

    let mut low = 1_u8;
    let mut high = 100_u8;
    let mut best = encode_image(image, format, low, icc_profile)?;
    for _ in 0..8 {
        let quality = low.saturating_add(high).saturating_div(2).max(1);
        let candidate = encode_image(image, format, quality, icc_profile)?;
        if candidate.len() as u64 <= target + target / 20 {
            best = candidate;
            low = quality.saturating_add(1);
        } else {
            high = quality.saturating_sub(1);
        }
        if low > high {
            break;
        }
    }
    let reached = best.len() as u64 >= target.saturating_sub(target / 20)
        && best.len() as u64 <= target + target / 20;
    Ok((best, reached))
}

fn jpegtran_path(app: &AppHandle) -> Result<PathBuf, String> {
    if let Ok(path) = std::env::var("LIGHTOPS_JPEGTRAN_PATH") {
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
        "jpegtran.exe"
    } else {
        "jpegtran"
    };
    [
        resource_dir.join("bin").join(filename),
        resource_dir.join(filename),
    ]
    .into_iter()
    .find(|candidate| candidate.is_file())
    .ok_or_else(|| {
        "Bundled jpegtran is missing. Reinstall LightOps from an official package.".into()
    })
}

fn optimize_jpeg_lossless(source: &Path, optimizer: &Path) -> Result<Vec<u8>, String> {
    let temporary = source.with_file_name(format!(
        ".{}.{}.lightops-part.jpg",
        source
            .file_stem()
            .and_then(|value| value.to_str())
            .unwrap_or("image"),
        uuid::Uuid::new_v4()
    ));
    let mut command = Command::new(optimizer);
    command
        .args(["-copy", "all", "-optimize", "-outfile"])
        .arg(&temporary)
        .arg(source);
    let output = output_with_timeout(&mut command, Duration::from_secs(120), "jpegtran")?;
    if !output.status.success() {
        let _ = fs::remove_file(&temporary);
        return Err(String::from_utf8_lossy(&output.stderr).trim().to_string());
    }
    let bytes = fs::read(&temporary).map_err(|error| error.to_string());
    let _ = fs::remove_file(&temporary);
    bytes
}

fn copy_compatible_metadata(
    source: &Path,
    destination: &Path,
    exiftool: &Path,
    normalized_orientation: bool,
) -> Result<(), String> {
    let mut command = Command::new(exiftool);
    command.arg("-TagsFromFile").arg(source).arg("-all:all");
    if normalized_orientation {
        command.arg("-Orientation=1");
    }
    command.arg("-overwrite_original").arg(destination);
    let output = output_with_timeout(
        &mut command,
        Duration::from_secs(120),
        "ExifTool metadata copy",
    )?;
    if output.status.success() {
        Ok(())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).trim().to_string())
    }
}

fn process_resize(
    source: &Path,
    output_dir: &Path,
    options: &ResizeOptions,
    exiftool: Option<&Path>,
) -> Result<(OutputAsset, Vec<String>), String> {
    let source_size = fs::metadata(source)
        .map_err(|error| error.to_string())?
        .len();
    let orientation = read_orientation(source);
    let image = normalize_orientation(
        image::open(source).map_err(|error| error.to_string())?,
        orientation,
    );
    let (width, height) = image.dimensions();
    let (target_width, target_height) = calculate_resize_dimensions(width, height, options);
    let resized = if (target_width, target_height) == (width, height) {
        image
    } else {
        image.resize_exact(
            target_width,
            target_height,
            image::imageops::FilterType::Lanczos3,
        )
    };
    let format = requested_format(source, options.output_format.as_deref())?;
    let icc_profile = read_icc_profile(source)?;
    let destination = output_path(source, output_dir, &options.suffix, format);
    let bytes = encode_image(
        &resized,
        format,
        options.quality.unwrap_or(90),
        &icc_profile,
    )?;
    write_atomic(&destination, &bytes)?;
    let warnings = if let Some(exiftool) = exiftool {
        copy_compatible_metadata(source, &destination, exiftool, true)?;
        Vec::new()
    } else {
        vec!["ExifTool is unavailable; ICC was preserved but other compatible metadata could not be copied.".into()]
    };
    let output_size = fs::metadata(&destination)
        .map_err(|error| error.to_string())?
        .len();

    Ok((
        OutputAsset {
            source_path: source.to_string_lossy().into_owned(),
            output_path: destination.to_string_lossy().into_owned(),
            byte_size: output_size,
            width: target_width,
            height: target_height,
            savings_bytes: source_size as i64 - output_size as i64,
        },
        warnings,
    ))
}

fn process_minimize(
    source: &Path,
    output_dir: &Path,
    options: &MinimizeOptions,
    jpegtran: Option<&Path>,
    exiftool: Option<&Path>,
) -> Result<(OutputAsset, Vec<String>), String> {
    let source_bytes = fs::read(source).map_err(|error| error.to_string())?;
    let source_size = source_bytes.len() as u64;
    let image = image::open(source).map_err(|error| error.to_string())?;
    let (width, height) = image.dimensions();
    let source_format = format_from_path(source)?;
    let format = requested_format(source, options.output_format.as_deref())?;
    if options.mode == MinimizeMode::Lossless && format != source_format {
        return Err("Lossless minimization must keep the source format".into());
    }
    let icc_profile = read_icc_profile(source)?;
    let destination = output_path(source, output_dir, &options.suffix, format);
    let mut warnings: Vec<String> = Vec::new();

    let output_bytes = match options.mode {
        MinimizeMode::Lossless => {
            let candidate = if format == ImageFormat::Jpeg {
                if let Some(optimizer) = jpegtran {
                    optimize_jpeg_lossless(source, optimizer)?
                } else {
                    warnings.push(
                        "jpegtran is unavailable; retained the original JPEG without optimization."
                            .into(),
                    );
                    source_bytes.clone()
                }
            } else {
                encode_image(&image, format, 100, &icc_profile)?
            };
            if candidate.len() < source_bytes.len()
                && lossless_constraints_match(&image, format, &candidate, &icc_profile)
                    .unwrap_or(false)
            {
                candidate
            } else {
                warnings
                    .push("No savings: copied the original bytes without pixel changes.".into());
                source_bytes.clone()
            }
        }
        MinimizeMode::Compressed => match options.target_bytes {
            Some(target) => {
                let (bytes, reached) = encode_to_target(&image, format, target, &icc_profile)?;
                if !reached {
                    warnings
                        .push("The requested target size could not be reached within ±5%.".into());
                }
                bytes
            }
            None => encode_image(&image, format, options.quality, &icc_profile)?,
        },
    };
    write_atomic(&destination, &output_bytes)?;
    let metadata_needs_copy = options.mode == MinimizeMode::Compressed
        || (format != ImageFormat::Jpeg && output_bytes.len() as u64 != source_size);
    if metadata_needs_copy {
        if let Some(exiftool) = exiftool {
            copy_compatible_metadata(source, &destination, exiftool, false)?;
        } else {
            warnings.push(
                "ExifTool is unavailable; ICC was preserved but other compatible metadata could not be copied."
                    .into(),
            );
        }
    }
    let mut output_size = fs::metadata(&destination)
        .map_err(|error| error.to_string())?
        .len();
    if options.mode == MinimizeMode::Lossless {
        let final_bytes = fs::read(&destination).map_err(|error| error.to_string())?;
        let verified =
            lossless_constraints_match(&image, format, &final_bytes, &icc_profile).unwrap_or(false);
        if output_size >= source_size || !verified {
            write_atomic(&destination, &source_bytes)?;
            output_size = source_size;
            if !warnings
                .iter()
                .any(|warning| warning.starts_with("No savings"))
            {
                warnings
                    .push("No savings: copied the original bytes without pixel changes.".into());
            }
        }
    }

    Ok((
        OutputAsset {
            source_path: source.to_string_lossy().into_owned(),
            output_path: destination.to_string_lossy().into_owned(),
            byte_size: output_size,
            width,
            height,
            savings_bytes: source_size as i64 - output_size as i64,
        },
        warnings,
    ))
}

fn run_job_with_tools(
    request: &ToolJobRequest,
    cancelled: &AtomicBool,
    jpegtran: Option<&Path>,
    exiftool: Option<&Path>,
    mut progress: impl FnMut(JobProgress),
) -> JobResult {
    let mut outputs = Vec::new();
    let mut warnings = Vec::new();
    let output_dir = Path::new(&request.output_dir);
    if let Err(error) = fs::create_dir_all(output_dir) {
        return JobResult {
            job_id: request.job_id.clone(),
            status: JobStatus::Failed,
            outputs,
            warnings: vec![error.to_string()],
            manifest_path: None,
        };
    }

    for (index, input) in request.inputs.iter().enumerate() {
        if cancelled.load(Ordering::Relaxed) {
            return JobResult {
                job_id: request.job_id.clone(),
                status: JobStatus::Cancelled,
                outputs,
                warnings,
                manifest_path: None,
            };
        }
        progress(JobProgress {
            job_id: request.job_id.clone(),
            phase: "processing".into(),
            current: index,
            total: request.inputs.len(),
            item_id: Some(input.clone()),
            message_key: "jobs.processing".into(),
        });

        let processed = match &request.options {
            ToolOptions::Resize(options) => {
                process_resize(Path::new(input), output_dir, options, exiftool)
            }
            ToolOptions::Minimize(options) => {
                process_minimize(Path::new(input), output_dir, options, jpegtran, exiftool)
            }
            _ => Err("This tool does not yet use the image processing pipeline".into()),
        };
        match processed {
            Ok((output, item_warnings)) => {
                outputs.push(output);
                warnings.extend(item_warnings);
            }
            Err(error) => warnings.push(format!("{input}: {error}")),
        }
    }

    JobResult {
        job_id: request.job_id.clone(),
        status: if outputs.is_empty() && !request.inputs.is_empty() {
            JobStatus::Failed
        } else {
            JobStatus::Completed
        },
        outputs,
        warnings,
        manifest_path: None,
    }
}

#[cfg(test)]
pub fn run_job(
    request: &ToolJobRequest,
    cancelled: &AtomicBool,
    progress: impl FnMut(JobProgress),
) -> JobResult {
    run_job_with_tools(request, cancelled, None, None, progress)
}

#[tauri::command]
pub fn inspect_media(paths: Vec<String>) -> Result<Vec<MediaAsset>, String> {
    paths
        .into_iter()
        .map(|path| {
            let source = Path::new(&path);
            let metadata = fs::metadata(source).map_err(|error| error.to_string())?;
            let reader = ImageReader::open(source)
                .map_err(|error| error.to_string())?
                .with_guessed_format()
                .map_err(|error| error.to_string())?;
            let format = reader
                .format()
                .ok_or_else(|| format!("Unknown image format: {path}"))?;
            let mut decoder = reader.into_decoder().map_err(|error| error.to_string())?;
            let (raw_width, raw_height) = decoder.dimensions();
            let color = decoder.color_type();
            let channels = color.channel_count().max(1);
            let bit_depth = (color.bits_per_pixel() / u16::from(channels)) as u8;
            let has_icc_profile = decoder
                .icc_profile()
                .map_err(|error| error.to_string())?
                .is_some();

            let orientation = read_orientation(source);
            let (width, height) = if (5..=8).contains(&orientation) {
                (raw_height, raw_width)
            } else {
                (raw_width, raw_height)
            };

            Ok(MediaAsset {
                id: uuid::Uuid::new_v4().to_string(),
                path,
                format: format_extension(format).into(),
                width,
                height,
                byte_size: metadata.len(),
                bit_depth,
                has_alpha: color.has_alpha(),
                has_icc_profile,
                orientation,
            })
        })
        .collect()
}

#[tauri::command]
pub fn analyze_tool(request: ToolJobRequest) -> Result<serde_json::Value, String> {
    let assets = inspect_media(request.inputs)?;
    Ok(serde_json::json!({
        "toolId": request.tool_id,
        "assets": assets,
        "warnings": Vec::<String>::new(),
    }))
}

#[tauri::command]
pub fn start_tool_job(
    app: AppHandle,
    state: State<'_, JobState>,
    request: ToolJobRequest,
) -> Result<StartJobResult, String> {
    if request.schema_version != 1 {
        return Err("Unsupported job schema version".into());
    }
    let guard = state.begin(request.job_id.clone())?;
    let cancelled = guard.cancelled.clone();

    let job_id = request.job_id.clone();
    let jpegtran = jpegtran_path(&app).ok();
    let exiftool = super::metadata::exiftool_path(&app).ok();
    tauri::async_runtime::spawn_blocking(move || {
        let _guard = guard;
        let result = run_job_with_tools(
            &request,
            &cancelled,
            jpegtran.as_deref(),
            exiftool.as_deref(),
            |event| {
                let _ = app.emit(JOB_PROGRESS_EVENT, event);
            },
        );
        let _ = app.emit(JOB_FINISHED_EVENT, &result);
    });

    Ok(StartJobResult { job_id })
}

#[tauri::command]
pub fn cancel_tool_job(state: State<'_, JobState>, job_id: String) -> Result<(), String> {
    state.cancel(&job_id)
}

#[tauri::command]
pub fn copy_output_image(app: AppHandle, path: String) -> Result<(), String> {
    let decoded = image::open(&path).map_err(|error| error.to_string())?;
    let rgba = decoded.to_rgba8();
    let (width, height) = rgba.dimensions();
    let image = tauri::image::Image::new_owned(rgba.into_raw(), width, height);
    app.clipboard()
        .write_image(&image)
        .map_err(|error| error.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn proportional_resize_honors_long_edge_without_upscaling() {
        let options = ResizeOptions {
            mode: ResizeMode::LongEdge,
            value: 2000.0,
            allow_upscale: false,
            output_format: None,
            quality: None,
            suffix: "-resized".into(),
        };

        assert_eq!(
            calculate_resize_dimensions(4000, 3000, &options),
            (2000, 1500)
        );
        assert_eq!(
            calculate_resize_dimensions(1000, 750, &options),
            (1000, 750)
        );
    }

    #[test]
    fn every_resize_mode_preserves_aspect_ratio_and_upscale_is_explicit() {
        let options = |mode, value, allow_upscale| ResizeOptions {
            mode,
            value,
            allow_upscale,
            output_format: None,
            quality: None,
            suffix: "-resized".into(),
        };

        assert_eq!(
            calculate_resize_dimensions(4000, 3000, &options(ResizeMode::Width, 1000.0, false)),
            (1000, 750)
        );
        assert_eq!(
            calculate_resize_dimensions(4000, 3000, &options(ResizeMode::Height, 600.0, false)),
            (800, 600)
        );
        assert_eq!(
            calculate_resize_dimensions(4000, 3000, &options(ResizeMode::Percentage, 25.0, false)),
            (1000, 750)
        );
        assert_eq!(
            calculate_resize_dimensions(400, 300, &options(ResizeMode::Width, 800.0, false)),
            (400, 300)
        );
        assert_eq!(
            calculate_resize_dimensions(400, 300, &options(ResizeMode::Width, 800.0, true)),
            (800, 600)
        );
    }

    #[test]
    fn collision_safe_path_never_overwrites_existing_output() {
        let dir = tempfile::tempdir().expect("temp dir");
        let desired = dir.path().join("photo-resized.jpg");
        fs::write(&desired, b"existing").expect("fixture");

        assert_eq!(
            collision_safe_path(&desired),
            dir.path().join("photo-resized-2.jpg")
        );
    }

    #[test]
    fn orientation_is_applied_before_resize_dimensions_are_calculated() {
        let image = DynamicImage::new_rgb8(400, 300);
        assert_eq!(normalize_orientation(image, 6).dimensions(), (300, 400));
    }

    #[test]
    fn resize_preserves_source_bytes_and_icc_profile() {
        let directory = tempfile::tempdir().expect("temp dir");
        let source = directory.path().join("source.png");
        let output = directory.path().join("output");
        let profile = Some(b"lightops-fixture-icc".to_vec());
        let source_bytes = encode_image(
            &DynamicImage::new_rgb8(40, 20),
            ImageFormat::Png,
            90,
            &profile,
        )
        .expect("fixture encode");
        fs::write(&source, &source_bytes).expect("fixture write");

        let result = run_job(
            &ToolJobRequest {
                schema_version: 1,
                job_id: "resize-fixture".into(),
                tool_id: ToolId::Resize,
                inputs: vec![source.to_string_lossy().into_owned()],
                output_dir: output.to_string_lossy().into_owned(),
                options: ToolOptions::Resize(ResizeOptions {
                    mode: ResizeMode::LongEdge,
                    value: 20.0,
                    allow_upscale: false,
                    output_format: Some("png".into()),
                    quality: None,
                    suffix: "-resized".into(),
                }),
            },
            &AtomicBool::new(false),
            |_| {},
        );

        assert_eq!(result.status, JobStatus::Completed);
        assert_eq!(fs::read(&source).expect("source read"), source_bytes);
        let destination = Path::new(&result.outputs[0].output_path);
        assert_eq!(read_icc_profile(destination).expect("icc read"), profile);
    }

    #[cfg(unix)]
    #[test]
    fn lossless_jpeg_runs_the_coefficient_optimizer() {
        use std::os::unix::fs::PermissionsExt;

        let directory = tempfile::tempdir().expect("temp dir");
        let source = directory.path().join("source.jpg");
        let marker = directory.path().join("optimizer-was-run");
        let optimizer = directory.path().join("jpegtran");
        fs::write(&source, b"jpeg-coefficients").expect("source");
        fs::write(
            &optimizer,
            format!(
                "#!/bin/sh\nout=''\nwhile [ $# -gt 1 ]; do\n  if [ \"$1\" = '-outfile' ]; then out=\"$2\"; shift 2; else shift; fi\ndone\ncp \"$1\" \"$out\"\ntouch '{}'\n",
                marker.display()
            ),
        )
        .expect("optimizer fixture");
        fs::set_permissions(&optimizer, fs::Permissions::from_mode(0o755)).expect("executable");

        let optimized = optimize_jpeg_lossless(&source, &optimizer).expect("optimized bytes");

        assert_eq!(optimized, b"jpeg-coefficients");
        assert!(marker.exists(), "jpegtran fixture was not invoked");
    }

    #[cfg(unix)]
    #[test]
    fn resized_output_copies_metadata_and_normalizes_orientation_tag() {
        use std::os::unix::fs::PermissionsExt;

        let directory = tempfile::tempdir().expect("temp dir");
        let source = directory.path().join("source.jpg");
        let destination = directory.path().join("resized.jpg");
        let arguments = directory.path().join("arguments");
        let exiftool = directory.path().join("exiftool");
        fs::write(&source, b"source").expect("source");
        fs::write(&destination, b"output").expect("output");
        fs::write(
            &exiftool,
            format!(
                "#!/bin/sh\nprintf '%s\\n' \"$@\" > '{}'\n",
                arguments.display()
            ),
        )
        .expect("exiftool fixture");
        fs::set_permissions(&exiftool, fs::Permissions::from_mode(0o755)).expect("executable");

        copy_compatible_metadata(&source, &destination, &exiftool, true).expect("metadata copy");

        let arguments = fs::read_to_string(arguments).expect("captured arguments");
        assert!(arguments.contains("-TagsFromFile"));
        assert!(arguments.contains("-all:all"));
        assert!(arguments.contains("-Orientation=1"));
        assert!(arguments.contains(source.to_string_lossy().as_ref()));
        assert!(arguments.contains(destination.to_string_lossy().as_ref()));
    }

    #[test]
    fn lossless_png_never_grows_and_preserves_decoded_pixels() {
        let directory = tempfile::tempdir().expect("temp dir");
        let source = directory.path().join("source.png");
        let output = directory.path().join("output");
        fs::create_dir(&output).expect("output dir");
        let image = image::RgbImage::from_fn(32, 24, |x, y| {
            image::Rgb([(x * 7) as u8, (y * 11) as u8, ((x + y) * 3) as u8])
        });
        image.save(&source).expect("fixture");
        let source_bytes = fs::read(&source).expect("source bytes");
        let request = ToolJobRequest {
            schema_version: 1,
            job_id: "lossless-png".into(),
            tool_id: ToolId::Minimize,
            inputs: vec![source.to_string_lossy().into_owned()],
            output_dir: output.to_string_lossy().into_owned(),
            options: ToolOptions::Minimize(MinimizeOptions {
                mode: MinimizeMode::Lossless,
                quality: 100,
                target_bytes: None,
                output_format: Some("source".into()),
                suffix: "-min".into(),
            }),
        };

        let result = run_job(&request, &AtomicBool::new(false), |_| {});
        let destination = Path::new(&result.outputs[0].output_path);

        assert_eq!(fs::read(&source).expect("source after"), source_bytes);
        assert!(
            fs::metadata(destination).expect("output metadata").len() <= source_bytes.len() as u64
        );
        assert_eq!(
            image::open(destination).expect("output image").to_rgba16(),
            image::open(&source).expect("source image").to_rgba16()
        );
    }

    #[test]
    fn target_size_search_reports_a_result_within_five_percent() {
        let image = DynamicImage::ImageRgb8(image::RgbImage::from_fn(128, 128, |x, y| {
            image::Rgb([
                ((x * 17 + y * 13) % 256) as u8,
                ((x * 29 + y * 7) % 256) as u8,
                ((x * 3 + y * 31) % 256) as u8,
            ])
        }));
        let target = encode_image(&image, ImageFormat::Jpeg, 55, &None)
            .expect("target fixture")
            .len() as u64;

        let (encoded, reached) =
            encode_to_target(&image, ImageFormat::Jpeg, target, &None).expect("target encode");

        assert!(reached);
        assert!((encoded.len() as u64).abs_diff(target) <= target / 20);
    }

    #[test]
    fn impossible_target_size_returns_best_result_with_unreached_flag() {
        let image = DynamicImage::new_rgb8(128, 128);
        let (encoded, reached) =
            encode_to_target(&image, ImageFormat::Jpeg, 1, &None).expect("target encode");

        assert!(!reached);
        assert!(!encoded.is_empty());
    }

    #[test]
    fn corrupt_input_does_not_discard_successful_batch_outputs() {
        let directory = tempfile::tempdir().expect("temp dir");
        let valid = directory.path().join("valid.png");
        let corrupt = directory.path().join("corrupt.jpg");
        let output = directory.path().join("output");
        DynamicImage::new_rgba8(40, 20)
            .save(&valid)
            .expect("valid fixture");
        fs::write(&corrupt, b"not an image").expect("corrupt fixture");
        let valid_before = fs::read(&valid).expect("source hash fixture");
        let corrupt_before = fs::read(&corrupt).expect("corrupt source fixture");

        let result = run_job(
            &ToolJobRequest {
                schema_version: 1,
                job_id: "partial-batch".into(),
                tool_id: ToolId::Resize,
                inputs: vec![
                    valid.to_string_lossy().into_owned(),
                    corrupt.to_string_lossy().into_owned(),
                ],
                output_dir: output.to_string_lossy().into_owned(),
                options: ToolOptions::Resize(ResizeOptions {
                    mode: ResizeMode::Width,
                    value: 20.0,
                    allow_upscale: false,
                    output_format: None,
                    quality: None,
                    suffix: "-resized".into(),
                }),
            },
            &AtomicBool::new(false),
            |_| {},
        );

        assert_eq!(result.status, JobStatus::Completed);
        assert_eq!(result.outputs.len(), 1);
        assert!(result
            .warnings
            .iter()
            .any(|warning| warning.contains("corrupt.jpg")));
        assert_eq!(fs::read(valid).expect("valid source after"), valid_before);
        assert_eq!(
            fs::read(corrupt).expect("corrupt source after"),
            corrupt_before
        );
    }

    #[test]
    fn cancelled_batch_creates_no_partial_files() {
        let directory = tempfile::tempdir().expect("temp dir");
        let source = directory.path().join("source.png");
        let output = directory.path().join("output");
        DynamicImage::new_rgb8(20, 10)
            .save(&source)
            .expect("fixture");
        let cancelled = AtomicBool::new(true);
        let result = run_job(
            &ToolJobRequest {
                schema_version: 1,
                job_id: "cancelled-batch".into(),
                tool_id: ToolId::Resize,
                inputs: vec![source.to_string_lossy().into_owned()],
                output_dir: output.to_string_lossy().into_owned(),
                options: ToolOptions::Resize(ResizeOptions {
                    mode: ResizeMode::Width,
                    value: 10.0,
                    allow_upscale: false,
                    output_format: None,
                    quality: None,
                    suffix: "-resized".into(),
                }),
            },
            &cancelled,
            |_| {},
        );

        assert_eq!(result.status, JobStatus::Cancelled);
        assert!(result.outputs.is_empty());
        assert!(fs::read_dir(output)
            .expect("output directory")
            .next()
            .is_none());
    }

    #[test]
    fn disk_full_during_atomic_write_removes_partial_file() {
        let directory = tempfile::tempdir().expect("temp dir");
        let destination = directory.path().join("output.png");

        let result = write_atomic_with(&destination, b"complete output", |temporary, _bytes| {
            fs::write(temporary, b"partial")?;
            Err(std::io::Error::new(
                std::io::ErrorKind::StorageFull,
                "fixture disk full",
            ))
        });

        assert!(result.is_err());
        assert!(!destination.exists());
        assert_eq!(
            fs::read_dir(directory.path()).expect("directory").count(),
            0
        );
    }

    #[cfg(unix)]
    #[test]
    fn output_permission_error_preserves_source_and_leaves_no_partial_file() {
        use std::os::unix::fs::PermissionsExt;

        let directory = tempfile::tempdir().expect("temp dir");
        let source = directory.path().join("source.png");
        let output = directory.path().join("readonly-output");
        DynamicImage::new_rgb8(20, 10)
            .save(&source)
            .expect("source fixture");
        fs::create_dir(&output).expect("output directory");
        fs::set_permissions(&output, fs::Permissions::from_mode(0o500)).expect("readonly output");
        let source_before = fs::read(&source).expect("source before");

        let result = run_job(
            &ToolJobRequest {
                schema_version: 1,
                job_id: "permission-error".into(),
                tool_id: ToolId::Resize,
                inputs: vec![source.to_string_lossy().into_owned()],
                output_dir: output.to_string_lossy().into_owned(),
                options: ToolOptions::Resize(ResizeOptions {
                    mode: ResizeMode::Width,
                    value: 10.0,
                    allow_upscale: false,
                    output_format: None,
                    quality: None,
                    suffix: "-resized".into(),
                }),
            },
            &AtomicBool::new(false),
            |_| {},
        );

        fs::set_permissions(&output, fs::Permissions::from_mode(0o700)).expect("restore output");
        assert!(result.outputs.is_empty());
        assert!(result
            .warnings
            .iter()
            .any(|warning| warning.contains("source.png")));
        assert_eq!(fs::read(&source).expect("source after"), source_before);
        assert_eq!(fs::read_dir(&output).expect("output after").count(), 0);
    }

    #[test]
    fn resize_accepts_tiff_and_webp_fixtures() {
        for (extension, format) in [("tiff", ImageFormat::Tiff), ("webp", ImageFormat::WebP)] {
            let directory = tempfile::tempdir().expect("temp dir");
            let source = directory.path().join(format!("source.{extension}"));
            let output = directory.path().join("output");
            DynamicImage::new_rgba8(48, 24)
                .save_with_format(&source, format)
                .expect("format fixture");

            let result = run_job(
                &ToolJobRequest {
                    schema_version: 1,
                    job_id: format!("resize-{extension}"),
                    tool_id: ToolId::Resize,
                    inputs: vec![source.to_string_lossy().into_owned()],
                    output_dir: output.to_string_lossy().into_owned(),
                    options: ToolOptions::Resize(ResizeOptions {
                        mode: ResizeMode::LongEdge,
                        value: 24.0,
                        allow_upscale: false,
                        output_format: None,
                        quality: None,
                        suffix: "-resized".into(),
                    }),
                },
                &AtomicBool::new(false),
                |_| {},
            );

            assert_eq!(result.status, JobStatus::Completed, "{extension}");
            assert_eq!(result.outputs.len(), 1, "{extension}");
            assert_eq!(
                image::image_dimensions(&result.outputs[0].output_path).expect("output dimensions"),
                (24, 12),
                "{extension}"
            );
        }
    }

    #[cfg(unix)]
    #[test]
    fn lossless_metadata_copy_cannot_make_output_larger_than_source() {
        use std::io::Write;
        use std::os::unix::fs::PermissionsExt;

        let directory = tempfile::tempdir().expect("temp dir");
        let source = directory.path().join("source.png");
        let output = directory.path().join("output");
        DynamicImage::new_rgb8(32, 16)
            .save(&source)
            .expect("image fixture");
        let mut source_file = fs::OpenOptions::new()
            .append(true)
            .open(&source)
            .expect("append fixture padding");
        source_file
            .write_all(&vec![0_u8; 5_000])
            .expect("fixture padding");
        let source_bytes = fs::read(&source).expect("source bytes");
        let exiftool = directory.path().join("exiftool");
        fs::write(
            &exiftool,
            "#!/bin/sh\nfor last; do :; done\ndd if=/dev/zero bs=10000 count=1 >> \"$last\" 2>/dev/null\n",
        )
        .expect("exiftool fixture");
        fs::set_permissions(&exiftool, fs::Permissions::from_mode(0o755)).expect("executable");

        let result = run_job_with_tools(
            &ToolJobRequest {
                schema_version: 1,
                job_id: "lossless-metadata-growth".into(),
                tool_id: ToolId::Minimize,
                inputs: vec![source.to_string_lossy().into_owned()],
                output_dir: output.to_string_lossy().into_owned(),
                options: ToolOptions::Minimize(MinimizeOptions {
                    mode: MinimizeMode::Lossless,
                    quality: 100,
                    target_bytes: None,
                    output_format: Some("source".into()),
                    suffix: "-min".into(),
                }),
            },
            &AtomicBool::new(false),
            None,
            Some(&exiftool),
            |_| {},
        );

        let output_bytes = fs::read(&result.outputs[0].output_path).expect("output bytes");
        assert_eq!(output_bytes, source_bytes);
        assert!(result
            .warnings
            .iter()
            .any(|warning| warning.contains("No savings")));
    }

    #[test]
    fn lossless_runtime_audit_rejects_bit_depth_reduction() {
        let source = DynamicImage::ImageRgb16(image::ImageBuffer::from_pixel(
            4,
            2,
            image::Rgb([1024_u16, 2048_u16, 4096_u16]),
        ));
        let reduced = DynamicImage::ImageRgb8(source.to_rgb8());
        let candidate =
            encode_image(&reduced, ImageFormat::Png, 100, &None).expect("reduced candidate");

        assert!(
            !lossless_constraints_match(&source, ImageFormat::Png, &candidate, &None)
                .expect("runtime audit")
        );
    }
}
