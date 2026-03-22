import { ScrollReveal } from "./ScrollReveal";
import { SectionHeading } from "./SectionHeading";
import { GradientButton } from "./GradientButton";
import { GhostButton } from "./GhostButton";
import { BadgePill } from "./BadgePill";
import { Star, GitFork, AlertCircle } from "lucide-react";
import { APP_DATA } from "../constants/app";

export function OpenSource() {
  return (
    <section className="py-20 md:py-32 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <ScrollReveal>
          <SectionHeading
            title="Open Source & Free"
            subtitle={
              <>
                Built with ❤️ by a photographer-developer
              </>
            }
          />
        </ScrollReveal>

        <div className="max-w-3xl mx-auto text-center">
          {/* License badge */}
          <ScrollReveal delay={0.2}>
            <div className="flex justify-center mb-6">
              <BadgePill variant="success">{APP_DATA.license} License</BadgePill>
            </div>
          </ScrollReveal>

          {/* GitHub stats */}
          <ScrollReveal delay={0.3}>
            <div className="flex flex-wrap justify-center gap-4 mb-8">
              <a
                href={APP_DATA.githubRepo}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block"
              >
                <BadgePill variant="muted">
                  <Star size={14} />
                  <span>-- Stars</span>
                </BadgePill>
              </a>
              <a
                href={`${APP_DATA.githubRepo}/fork`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block"
              >
                <BadgePill variant="muted">
                  <GitFork size={14} />
                  <span>-- Forks</span>
                </BadgePill>
              </a>
              <a
                href={`${APP_DATA.githubRepo}/issues`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block"
              >
                <BadgePill variant="muted">
                  <AlertCircle size={14} />
                  <span>-- Issues</span>
                </BadgePill>
              </a>
            </div>
            <p
              className="text-white/40 text-sm mb-8"
              style={{ fontFamily: "'Inter', sans-serif" }}
            >
              Live stats on GitHub
            </p>
          </ScrollReveal>

          {/* Description */}
          <ScrollReveal delay={0.4}>
            <p
              className="text-white/60 text-lg mb-10 leading-relaxed max-w-2xl mx-auto"
              style={{ fontFamily: "'Inter', sans-serif" }}
            >
              LightOps is completely free and open source. The source code is available on GitHub under the MIT
              license. Contributions, bug reports, and feature requests are welcome.
            </p>
          </ScrollReveal>

          {/* Action buttons */}
          <ScrollReveal delay={0.5}>
            <div className="flex flex-col sm:flex-row justify-center gap-4 mb-10">
              <GradientButton href={APP_DATA.githubRepo}>
                ⭐ Star on GitHub
              </GradientButton>
              <GhostButton href={`${APP_DATA.githubRepo}/fork`}>
                🍴 Fork & Contribute
              </GhostButton>
              <GhostButton href={`${APP_DATA.githubRepo}/issues`}>
                🐛 Report an Issue
              </GhostButton>
            </div>
          </ScrollReveal>

          {/* Tech stack badges */}
          <ScrollReveal delay={0.6}>
            <div className="flex flex-wrap justify-center gap-3">
              {APP_DATA.techStack.map((tech) => (
                <BadgePill key={tech} variant="default">
                  {tech}
                </BadgePill>
              ))}
            </div>
          </ScrollReveal>
        </div>
      </div>
    </section>
  );
}
