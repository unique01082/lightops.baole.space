export const PLATFORMS = [
  {
    name: "Windows",
    icon: "🪟",
    description: "Windows 10 / 11 (64-bit)",
    primaryButton: {
      label: "Download .exe",
      url: "https://github.com/unique01082/lightops/releases/latest",
      style: "gradient primary",
    },
    secondaryButton: {
      label: "Download .msi",
      url: "https://github.com/unique01082/lightops/releases/latest",
      style: "ghost",
    },
    note: "NSIS installer · WiX MSI also available",
    highlight: true,
  },
  {
    name: "macOS",
    icon: "🍎",
    description: "macOS 11 Big Sur and later",
    primaryButton: {
      label: "Download .dmg",
      url: "https://github.com/unique01082/lightops/releases/latest",
      style: "gradient primary",
    },
    secondaryButton: {
      label: "Download .app.tar.gz",
      url: "https://github.com/unique01082/lightops/releases/latest",
      style: "ghost",
    },
    note: "Universal binary (Intel + Apple Silicon)",
    highlight: false,
  },
  {
    name: "Linux",
    icon: "🐧",
    description: "Ubuntu, Fedora, Arch and more",
    primaryButton: {
      label: "Download .AppImage",
      url: "https://github.com/unique01082/lightops/releases/latest",
      style: "gradient primary",
    },
    secondaryButton: {
      label: ".deb / .rpm",
      url: "https://github.com/unique01082/lightops/releases/latest",
      style: "ghost",
    },
    note: "AppImage · Debian · RPM packages",
    highlight: false,
  },
] as const;
