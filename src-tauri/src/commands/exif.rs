use chrono::NaiveDateTime;
use std::fs::File;
use std::io::BufReader;
use std::path::Path;

#[derive(Debug, Clone)]
pub struct CameraInfo {
    pub make: Option<String>,
    pub model: Option<String>,
    pub datetime: Option<NaiveDateTime>,
}

fn read_ascii_field(exif: &exif::Exif, tag: exif::Tag) -> Option<String> {
    let field = exif.get_field(tag, exif::In::PRIMARY)?;
    if let exif::Value::Ascii(ref vecs) = field.value {
        let bytes = vecs.first()?;
        let value = std::str::from_utf8(bytes).ok()?.trim().to_string();
        if value.is_empty() {
            None
        } else {
            Some(value)
        }
    } else {
        None
    }
}

/// Extract the earliest available EXIF datetime from a file.
/// Tries DateTimeOriginal → DateTimeDigitized → DateTime in that order.
pub fn get_exif_datetime(path: &Path) -> Option<NaiveDateTime> {
    let file = File::open(path).ok()?;
    let mut reader = BufReader::new(file);
    let exif_reader = exif::Reader::new();
    let exif = exif_reader.read_from_container(&mut reader).ok()?;

    let tags = [
        exif::Tag::DateTimeOriginal,
        exif::Tag::DateTimeDigitized,
        exif::Tag::DateTime,
    ];

    for tag in &tags {
        if let Some(field) = exif.get_field(*tag, exif::In::PRIMARY) {
            if let exif::Value::Ascii(ref vecs) = field.value {
                if let Some(bytes) = vecs.first() {
                    if let Ok(s) = std::str::from_utf8(bytes) {
                        if let Ok(dt) = NaiveDateTime::parse_from_str(s.trim(), "%Y:%m:%d %H:%M:%S")
                        {
                            return Some(dt);
                        }
                    }
                }
            }
        }
    }

    None
}

pub fn get_camera_info(path: &Path) -> Option<CameraInfo> {
    let file = File::open(path).ok()?;
    let mut reader = BufReader::new(file);
    let exif_reader = exif::Reader::new();
    let exif = exif_reader.read_from_container(&mut reader).ok()?;

    let datetime = [
        exif::Tag::DateTimeOriginal,
        exif::Tag::DateTimeDigitized,
        exif::Tag::DateTime,
    ]
    .iter()
    .find_map(|tag| {
        read_ascii_field(&exif, *tag)
            .and_then(|value| NaiveDateTime::parse_from_str(value.trim(), "%Y:%m:%d %H:%M:%S").ok())
    });

    Some(CameraInfo {
        make: read_ascii_field(&exif, exif::Tag::Make),
        model: read_ascii_field(&exif, exif::Tag::Model),
        datetime,
    })
}

/// Extract datetime from a video file.
/// Tries embedded EXIF first (some cameras embed EXIF in MP4/MOV),
/// then falls back to the file's last-modified time.
pub fn get_video_datetime(path: &Path) -> Option<NaiveDateTime> {
    // Some cameras (Sony, Canon) embed EXIF in video containers
    if let Some(dt) = get_exif_datetime(path) {
        return Some(dt);
    }

    // Fall back to file system modification time
    let mtime = std::fs::metadata(path).ok()?.modified().ok()?;
    let secs = mtime.duration_since(std::time::UNIX_EPOCH).ok()?.as_secs() as i64;
    chrono::DateTime::from_timestamp(secs, 0).map(|dt| dt.naive_utc())
}
