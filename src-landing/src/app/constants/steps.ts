export const STEPS = [
  {
    number: 1,
    icon: "📂",
    title: "Add Your Source Folders",
    description: "Drag and drop or browse to add one or more folders containing your photos. Perfect for pulling from multiple SD cards simultaneously.",
  },
  {
    number: 2,
    icon: "⚙️",
    title: "Configure Your Settings",
    description: "Choose your camera brand to auto-fill RAW extensions. Set a filename format, prefix, and output folder. Preview the output filename in real time.",
  },
  {
    number: 3,
    icon: "🔍",
    title: "Preview with Dry Run",
    description: "Click 'Dry Run' to see exactly what will happen — every file's source and destination path — without touching any files. Review the full log before committing.",
  },
  {
    number: 4,
    icon: "▶",
    title: "Run and Relax",
    description: "Hit 'Run'. Watch the real-time log as LightOps renames and organizes your files. A progress bar tracks every file processed.",
  },
] as const;
