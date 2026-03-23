export const CHANGELOG = [
  {
    version: "v1.0.0-beta",
    date: "2026-03-23",
    type: "Beta Release",
    badgeColor: "accent_lightops",
    highlights: [
      "Video support: scan and rename .mp4, .mov, .mts, .m4v, .avi, .mkv, .3gp companion files alongside photos",
      "Preset Manager: save, load, and delete named configuration presets stored locally",
      "Log table mode: toggle between text log and table view with clickable paths that open folders in your OS file manager",
    ],
  },
  {
    version: "v0.1.1",
    date: "2026-03-23",
    type: "Patch",
    badgeColor: "accent_lightops",
    highlights: [
      "Preserve original extension case during rename (e.g. .JPG stays .JPG, .NEF stays .NEF)",
      "Sequence counter (NNNN) now zero-pads to 4 digits instead of 6",
    ],
  },
  {
    version: "v0.1.0",
    date: "2026-03",
    type: "Initial Release",
    badgeColor: "accent_lightops",
    highlights: [
      "Initial public release of LightOps",
      "Multi-source folder support with drag & drop",
      "EXIF-based rename using shooting date/time",
      "Camera presets: Nikon, Canon, Sony, Fujifilm, Panasonic, Olympus, Pentax, Leica",
      "4 filename formats with live preview",
      "Dry run mode for safe preview",
      "Copy or Move file operations",
      "Organize into date subfolders",
      "Paired JPG + RAW handling",
      "Real-time color-coded log panel",
      "i18n support (English + Vietnamese)",
    ],
  },
] as const;
