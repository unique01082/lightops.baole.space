# LightOps

> *Every frame, perfectly named.*

A desktop photo file management tool for photographers. Batch rename, copy, or move RAW + JPG photo files based on EXIF shooting date.

**Built with:** Tauri v2 · Rust · React · TypeScript · Tailwind CSS

---

## Features

- Read EXIF date from RAW + JPG files
- Rename / copy / move with customizable naming patterns
- Support: Nikon (NEF/NRW), Canon (CR2/CR3), Sony (ARW), Fujifilm (RAF), Panasonic (RW2), Olympus (ORF), Pentax (PEF/DNG), Leica (DNG), Custom
- Multiple source folders (multi-card workflow)
- Real-time log with color-coded entries
- Dry-run mode (preview without touching files)
- Organize into `YYYY-MM-DD/` subfolders
- Recursive folder scan
- Auto-update via GitHub Releases
- Bilingual: English + Tiếng Việt

## Platforms

| Platform | Architectures |
|---|---|
| Windows | x86_64, ARM64 |
| macOS | Intel (x86_64) + Apple Silicon (arm64) — Universal Binary |

## Download

Download the latest installer from [Releases](https://github.com/unique01082/lightops/releases).

> **Note (v0.x):** No code signing yet. Windows will show a SmartScreen warning — click **"More info → Run anyway"**.

## Development

### Prerequisites

- [Rust](https://rustup.rs/) 1.77.2+
- [Node.js](https://nodejs.org/) 20+
- [Tauri v2 system dependencies](https://tauri.app/start/prerequisites/)

### Setup

```bash
git clone https://github.com/unique01082/lightops.git
cd lightops
npm install
npm run dev
```

### Build

```bash
npm run build
```

## Architecture

```
lightops/
├── src/                 # React + TypeScript UI
│   ├── app/
│   │   ├── App.tsx      # Main app — Tauri IPC calls
│   │   ├── components/  # UI components
│   │   └── i18n/        # Translations (EN + VI)
│   └── styles/
└── src-tauri/           # Rust backend (Tauri v2)
    └── src/commands/
        ├── scan.rs      # File scanning + EXIF collection
        ├── exif.rs      # EXIF datetime extraction
        ├── rename.rs    # Rename plan + execution
        └── dialog.rs    # Folder picker
```

## Contributing

1. Fork & clone
2. Create branch from `develop`: `git checkout -b feature/your-feature`
3. Commit using [Conventional Commits](https://www.conventionalcommits.org/)
4. Open a PR to `develop`

## License

MIT © [Bao Le](https://baole.space)
