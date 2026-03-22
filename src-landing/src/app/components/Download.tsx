import { ScrollReveal } from "./ScrollReveal";
import { SectionHeading } from "./SectionHeading";
import { PlatformCard } from "./PlatformCard";
import { BadgePill } from "./BadgePill";
import { Star, GitFork, AlertCircle } from "lucide-react";
import { PLATFORMS } from "../constants/platforms";
import { APP_DATA } from "../constants/app";

export function Download() {
  return (
    <section id="download" className="py-20 md:py-32 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <ScrollReveal>
          <SectionHeading
            title="Download LightOps"
            subtitle="Free, open source, no sign-up required. Pick your platform."
          />
        </ScrollReveal>

        {/* Version badge */}
        <ScrollReveal delay={0.1}>
          <div className="flex justify-center mb-12">
            <a
              href={APP_DATA.githubReleases}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block"
            >
              <BadgePill variant="gradient">Latest: v{APP_DATA.version}</BadgePill>
            </a>
          </div>
        </ScrollReveal>

        {/* Platform cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {PLATFORMS.map((platform, index) => (
            <ScrollReveal key={platform.name} delay={0.1 + index * 0.1}>
              <PlatformCard {...platform} />
            </ScrollReveal>
          ))}
        </div>

        {/* GitHub links */}
        <ScrollReveal delay={0.4}>
          <div className="flex flex-wrap justify-center gap-4 mb-8">
            <a
              href={APP_DATA.githubRepo}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-white/70 hover:text-white transition-colors"
              style={{ fontFamily: "'Inter', sans-serif" }}
            >
              <Star size={16} />
              <span>Star on GitHub</span>
            </a>
            <span className="text-white/30">·</span>
            <a
              href={APP_DATA.githubReleases}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-white/70 hover:text-white transition-colors"
              style={{ fontFamily: "'Inter', sans-serif" }}
            >
              <GitFork size={16} />
              <span>View all releases</span>
            </a>
            <span className="text-white/30">·</span>
            <a
              href={`${APP_DATA.githubRepo}/issues`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-white/70 hover:text-white transition-colors"
              style={{ fontFamily: "'Inter', sans-serif" }}
            >
              <AlertCircle size={16} />
              <span>Report a bug</span>
            </a>
          </div>
        </ScrollReveal>

        <ScrollReveal delay={0.5}>
          <p
            className="text-white/50 text-center text-sm mb-8 max-w-3xl mx-auto"
            style={{ fontFamily: "'Inter', sans-serif" }}
          >
            All releases are signed and available on{" "}
            <a
              href={APP_DATA.githubReleases}
              target="_blank"
              rel="noopener noreferrer"
              className="text-violet-400 hover:text-violet-300 transition-colors"
            >
              GitHub Releases
            </a>
            . Source code is MIT licensed.
          </p>
        </ScrollReveal>

        {/* Auto-update note */}
        <ScrollReveal delay={0.6}>
          <div className="max-w-2xl mx-auto bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6">
            <div className="flex items-start gap-4">
              <div className="text-2xl">🔄</div>
              <div>
                <h4
                  className="text-white font-semibold mb-2"
                  style={{ fontFamily: "'Space Grotesk', sans-serif" }}
                >
                  Already installed?
                </h4>
                <p
                  className="text-white/60 text-sm"
                  style={{ fontFamily: "'Inter', sans-serif" }}
                >
                  LightOps checks for updates automatically on startup. You'll be notified in-app when a new version
                  is available.
                </p>
              </div>
            </div>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
