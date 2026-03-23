import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ScrollReveal } from "./ScrollReveal";
import { SectionHeading } from "./SectionHeading";
import { AppMockup } from "./AppMockup";

type ScreenshotId = "idle" | "dry-run" | "complete";

const SCREENSHOT_IDS: ScreenshotId[] = ["idle", "dry-run", "complete"];

export function Screenshots() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<ScreenshotId>("complete");

  const states = t("screenshots.states", { returnObjects: true }) as Array<{
    label: string;
    description: string;
  }>;

  const activeIndex = SCREENSHOT_IDS.indexOf(activeTab);

  return (
    <section className="py-20 md:py-32 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <ScrollReveal>
          <SectionHeading
            title={t("screenshots.title")}
            subtitle={t("screenshots.subtitle")}
          />
        </ScrollReveal>

        <ScrollReveal delay={0.2}>
          <div className="max-w-5xl mx-auto">
            {/* Tab switcher */}
            <div className="flex flex-wrap justify-center gap-2 sm:gap-4 mb-8">
              {SCREENSHOT_IDS.map((id, index) => (
                <button
                  key={id}
                  onClick={() => setActiveTab(id)}
                  className={`px-4 sm:px-6 py-2 sm:py-3 rounded-lg font-medium transition-all duration-300 text-sm sm:text-base ${
                    activeTab === id
                      ? "bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white shadow-lg shadow-violet-500/30"
                      : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white/80 border border-white/10"
                  }`}
                  style={{ fontFamily: "'Space Grotesk', sans-serif" }}
                >
                  {states[index]?.label ?? id}
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
              {states[activeIndex]?.description}
            </p>

            {/* Feature callouts */}
            <div className="flex flex-wrap justify-center gap-6 text-sm text-white/50">
              <div className="flex items-center gap-2">
                <span style={{ fontFamily: "'Inter', sans-serif" }}>
                  {t("screenshots.callouts.multiSource")}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span style={{ fontFamily: "'Inter', sans-serif" }}>
                  {t("screenshots.callouts.realtimeLog")}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span style={{ fontFamily: "'Inter', sans-serif" }}>
                  {t("screenshots.callouts.progressBar")}
                </span>
              </div>
            </div>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
