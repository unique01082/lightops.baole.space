export const CHANGELOG = [
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
