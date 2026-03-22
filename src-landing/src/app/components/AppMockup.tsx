import { ApertureLogo } from "./ApertureLogo";

interface AppMockupProps {
  width?: number;
  state?: "idle" | "dry-run" | "complete";
}

export function AppMockup({ width = 750, state = "idle" }: AppMockupProps) {
  const logEntries = {
    idle: [
      { type: "info", text: "Ready to process files..." },
      { type: "info", text: "Add source folders to begin" },
    ],
    "dry-run": [
      { type: "dry", text: "[DRY] D:\\DCIM\\100NIKON\\DSC_0001.NEF → D:\\Sorted\\20240315_143022_0001.nef" },
      { type: "dry", text: "[DRY] D:\\DCIM\\100NIKON\\DSC_0001.JPG → D:\\Sorted\\20240315_143022_0001.jpg" },
      { type: "dry", text: "[DRY] D:\\DCIM\\100NIKON\\DSC_0002.NEF → D:\\Sorted\\20240315_143025_0002.nef" },
      { type: "skip", text: "[SKIP] E:\\DCIM\\101NIKON\\DSC_0045.NEF (no paired JPG)" },
      { type: "dry", text: "[DRY] D:\\DCIM\\100NIKON\\DSC_0003.NEF → D:\\Sorted\\20240315_143030_0003.nef" },
    ],
    complete: [
      { type: "ok", text: "[OK] D:\\DCIM\\100NIKON\\DSC_0001.NEF → D:\\Sorted\\20240315_143022_0001.nef" },
      { type: "ok", text: "[OK] D:\\DCIM\\100NIKON\\DSC_0001.JPG → D:\\Sorted\\20240315_143022_0001.jpg" },
      { type: "ok", text: "[OK] D:\\DCIM\\100NIKON\\DSC_0002.NEF → D:\\Sorted\\20240315_143025_0002.nef" },
      { type: "ok", text: "[OK] D:\\DCIM\\100NIKON\\DSC_0002.JPG → D:\\Sorted\\20240315_143025_0002.jpg" },
      { type: "skip", text: "[SKIP] E:\\DCIM\\101NIKON\\DSC_0045.NEF (no paired JPG)" },
      { type: "ok", text: "[OK] D:\\DCIM\\100NIKON\\DSC_0003.NEF → D:\\Sorted\\20240315_143030_0003.nef" },
    ],
  };

  const stats = {
    idle: { ok: 0, skip: 0, err: 0 },
    "dry-run": { ok: 0, skip: 1, err: 0 },
    complete: { ok: 42, skip: 1, err: 0 },
  };

  const progress = {
    idle: 0,
    "dry-run": 0,
    complete: 35,
  };

  const logTypeColors = {
    ok: "text-emerald-400",
    dry: "text-gray-400",
    skip: "text-amber-400",
    err: "text-red-400",
    info: "text-white/50",
  };

  return (
    <div
      className="relative rounded-xl overflow-hidden shadow-2xl shadow-violet-500/20 w-full"
      style={{ maxWidth: width, fontFamily: "'Inter', sans-serif" }}
    >
      {/* Title bar */}
      <div className="bg-gradient-to-r from-violet-500/10 to-fuchsia-500/10 backdrop-blur-sm border-b border-white/10 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ApertureLogo size={20} />
          <div>
            <div className="text-white font-semibold text-sm" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              LightOps
            </div>
            <div className="text-white/50 text-xs">Photo File Manager</div>
          </div>
        </div>
        <div className="flex gap-2">
          <div className="w-3 h-3 rounded-full bg-red-500/80" />
          <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
          <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
        </div>
      </div>

      {/* Main content - two panels */}
      <div className="flex bg-[#0f0c29]/80 backdrop-blur-md">
        {/* Left panel - Configuration */}
        <div className="w-1/2 p-4 border-r border-white/10">
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg p-4 mb-3">
            <div className="text-white/70 text-xs mb-2 font-semibold">Source Folders</div>
            <div className="space-y-1">
              <div className="text-xs text-white/60 bg-white/5 px-2 py-1 rounded font-mono">D:\DCIM\100NIKON</div>
              <div className="text-xs text-white/60 bg-white/5 px-2 py-1 rounded font-mono">E:\DCIM\101NIKON</div>
            </div>
          </div>

          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg p-4 mb-3">
            <div className="text-white/70 text-xs mb-2 font-semibold">Output Folder</div>
            <div className="text-xs text-white/60 bg-white/5 px-2 py-1 rounded font-mono">D:\Sorted</div>
          </div>

          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg p-4 mb-3">
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-white/70">Camera</span>
                <span className="text-white/90 font-semibold">Nikon</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-white/70">Format</span>
                <span className="text-white/90 font-semibold">YYYYMMDD_HHMMSS_NNNN</span>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-r from-violet-500/20 to-fuchsia-500/20 border border-violet-500/30 rounded-lg p-3">
            <div className="text-white/70 text-xs mb-1">Preview</div>
            <div className="text-white font-mono text-xs">20240315_143022_0001.nef</div>
          </div>
        </div>

        {/* Right panel - Log */}
        <div className="w-1/2 p-4">
          <div className="bg-black/40 backdrop-blur-sm border border-white/10 rounded-lg p-4 h-full">
            <div className="flex items-center justify-between mb-3">
              <div className="text-white/70 text-xs font-semibold">Log Output</div>
              <div className="flex gap-2">
                <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400">✅ {stats[state].ok}</span>
                <span className="text-xs px-2 py-0.5 rounded bg-amber-500/20 text-amber-400">⚠ {stats[state].skip}</span>
                <span className="text-xs px-2 py-0.5 rounded bg-red-500/20 text-red-400">❌ {stats[state].err}</span>
              </div>
            </div>
            <div className="space-y-1 font-mono text-xs">
              {logEntries[state].map((entry, i) => (
                <div key={i} className={`${logTypeColors[entry.type as keyof typeof logTypeColors]} truncate`}>
                  {entry.text}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Progress bar */}
      {state === "complete" && (
        <div className="bg-black/60 backdrop-blur-sm border-t border-white/10 px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-white/70 text-xs">Processing files...</span>
            <span className="text-white/70 text-xs">{progress[state]} / 120 files</span>
          </div>
          <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-violet-500 to-fuchsia-500 transition-all duration-300"
              style={{ width: `${(progress[state] / 120) * 100}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}