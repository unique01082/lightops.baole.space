import { useState } from "react";
import { ScrollReveal } from "./ScrollReveal";
import { SectionHeading } from "./SectionHeading";
import { AppMockup } from "./AppMockup";

const SCREENSHOT_STATES = [
  {
    id: "idle",
    label: "Idle / Ready",
    description:
      "Clean starting state — add folders and configure your settings.",
  },
  {
    id: "dry-run",
    label: "Dry Run Active",
    description: "Preview every file rename before committing. Zero risk.",
  },
  {
    id: "complete",
    label: "Rename Complete",
    description: "All files organized, color-coded log, stats at a glance.",
  },
] as const;

export function Screenshots() {
  const [activeTab, setActiveTab] = useState<"idle" | "dry-run" | "complete">(
    "complete",
  );

  return (
    <section className="py-20 md:py-32 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <ScrollReveal>
          <SectionHeading
            title="The Interface"
            subtitle="Clean, minimal, and powerful — designed for focus"
          />
        </ScrollReveal>

        <ScrollReveal delay={0.2}>
          <div className="max-w-5xl mx-auto">
            {/* Tab switcher */}
            <div className="flex flex-wrap justify-center gap-2 sm:gap-4 mb-8">
              {SCREENSHOT_STATES.map((state) => (
                <button
                  key={state.id}
                  onClick={() => setActiveTab(state.id)}
                  className={`px-4 sm:px-6 py-2 sm:py-3 rounded-lg font-medium transition-all duration-300 text-sm sm:text-base ${
                    activeTab === state.id
                      ? "bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white shadow-lg shadow-violet-500/30"
                      : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white/80 border border-white/10"
                  }`}
                  style={{ fontFamily: "'Space Grotesk', sans-serif" }}
                >
                  {state.label}
                </button>
              ))}
            </div>

            {/* Active mockup */}
            <div className="flex justify-center mb-6">
              <div className="w-full max-w-[800px]">
                <AppMockup width={800} state={activeTab} />
              </div>
            </div>

            {/* Description */}
            <p
              className="text-center text-white/60 mb-8"
              style={{ fontFamily: "'Inter', sans-serif" }}
            >
              {SCREENSHOT_STATES.find((s) => s.id === activeTab)?.description}
            </p>

            {/* Feature callouts */}
            <div className="flex flex-wrap justify-center gap-6 text-sm text-white/50">
              <div className="flex items-center gap-2">
                <span style={{ fontFamily: "'Inter', sans-serif" }}>
                  Multi-source folders
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span style={{ fontFamily: "'Inter', sans-serif" }}>
                  Real-time color log
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span style={{ fontFamily: "'Inter', sans-serif" }}>
                  Gradient progress bar
                </span>
              </div>
            </div>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
