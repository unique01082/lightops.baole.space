# Changelog

All notable changes to LightOps will be documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Initial Tauri v2 desktop application
- Rust backend: EXIF reading (kamadak-exif), file scanning (walkdir), rename plan builder, file execution
- React UI with glass-morphism design (baole.space design system)
- Real-time log panel with color-coded entries streamed via Tauri events
- Bilingual support: English + Tiếng Việt (react-i18next)
- Auto-update via GitHub Releases (tauri-plugin-updater)
- Multi-platform builds: Windows x86_64/ARM64, macOS Universal Binary
- Camera presets: Nikon, Canon, Sony, Fujifilm, Panasonic, Olympus, Pentax, Leica, Custom
- Dry-run mode
- Copy / Move / Rename-in-place file operations
- Organize into YYYY-MM-DD/ subfolders
- Recursive directory scan
- Paired-only mode (skip unpaired JPG/RAW)
- Custom window decorations (frameless, OS titlebar hidden)
