import { ScrollReveal } from "./ScrollReveal";
import { SectionHeading } from "./SectionHeading";
import { GhostButton } from "./GhostButton";
import { Check } from "lucide-react";
import { CHANGELOG } from "../constants/changelog";
import { APP_DATA } from "../constants/app";

export function Changelog() {
  return (
    <section id="changelog" className="py-20 md:py-32 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <ScrollReveal>
          <SectionHeading
            title="What's New"
            subtitle="Release history and updates"
          />
        </ScrollReveal>

        <div className="max-w-4xl mx-auto">
          {CHANGELOG.map((release, index) => (
            <ScrollReveal key={release.version} delay={0.2 + index * 0.1}>
              <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-8 mb-6">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 gap-4">
                  <div className="flex items-center gap-4">
                    <h3
                      className="text-3xl font-bold text-white"
                      style={{ fontFamily: "'Space Grotesk', sans-serif" }}
                    >
                      {release.version}
                    </h3>
                    <span className="px-3 py-1 rounded-full bg-gradient-to-r from-violet-500/20 to-fuchsia-500/20 text-violet-300 text-sm font-semibold border border-violet-500/30">
                      {release.type}
                    </span>
                  </div>
                  <span
                    className="text-white/50 text-sm"
                    style={{ fontFamily: "'Inter', sans-serif" }}
                  >
                    {release.date}
                  </span>
                </div>

                {/* Highlights */}
                <div className="space-y-3">
                  {release.highlights.map((highlight, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-5 h-5 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center mt-0.5">
                        <Check size={12} className="text-white" />
                      </div>
                      <p
                        className="text-white/70 leading-relaxed"
                        style={{ fontFamily: "'Inter', sans-serif" }}
                      >
                        {highlight}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </ScrollReveal>
          ))}

          <ScrollReveal delay={0.4}>
            <div className="flex justify-center">
              <GhostButton href={APP_DATA.githubReleases}>
                📋 View Full Changelog on GitHub →
              </GhostButton>
            </div>
          </ScrollReveal>
        </div>
      </div>
    </section>
  );
}
