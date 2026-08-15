Release builds replace this directory with the verified platform sidecar archive.

Required files are `ffmpeg`, `exiftool`, and `jpegtran` on macOS, or their `.exe` counterparts on Windows. The release workflow verifies their versions and the required native H.264 encoder before Tauri bundles them.
