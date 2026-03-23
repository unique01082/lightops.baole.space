import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ScrollReveal } from "./ScrollReveal";
import { SectionHeading } from "./SectionHeading";
import { PlatformCard } from "./PlatformCard";
import { BadgePill } from "./BadgePill";
import { Star, GitFork, AlertCircle } from "lucide-react";
import { APP_DATA } from "../constants/app";
import { useGithubRelease } from "../hooks/useGithubRelease";

type OS = "windows" | "macos" | "linux" | "unknown";

function detectOS(): OS {
  const ua = navigator.userAgent;
  if (/windows/i.test(ua)) return "windows";
  if (/macintosh|mac os x/i.test(ua)) return "macos";
  if (/linux/i.test(ua)) return "linux";
  return "unknown";
}

export function Download() {
  const { t } = useTranslation();
  const detectedOS = useMemo(() => detectOS(), []);
  const release = useGithubRelease();

  const platformTexts = t("download.platforms", {
    returnObjects: true,
  }) as Array<{
    name: string;
    description: string;
    primaryLabel: string;
    secondaryLabel: string;
    note: string;
  }>;

  const platforms = useMemo(
    () => [
      {
        name: platformTexts[0]?.name ?? "Windows",
        icon: "🪟",
        description: platformTexts[0]?.description ?? "Windows 10 / 11 (64-bit)",
        primaryButton: {
          label: platformTexts[0]?.primaryLabel ?? "Download .exe",
          url: release.assets.windowsExe,
        },
        secondaryButton: {
          label: platformTexts[0]?.secondaryLabel ?? "Download .msi",
          url: release.assets.windowsMsi,
        },
        note: platformTexts[0]?.note ?? "NSIS installer · WiX MSI also available",
        highlight: detectedOS === "windows",
      },
      {
        name: platformTexts[1]?.name ?? "macOS",
        icon: "🍎",
        description: platformTexts[1]?.description ?? "macOS 11 Big Sur and later",
        primaryButton: {
          label: platformTexts[1]?.primaryLabel ?? "Download .dmg",
          url: release.assets.macDmg,
        },
        secondaryButton: {
          label: platformTexts[1]?.secondaryLabel ?? "Download .app.tar.gz",
          url: release.assets.macTarGz,
        },
        note: platformTexts[1]?.note ?? "Universal binary (Intel + Apple Silicon)",
        highlight: detectedOS === "macos",
      },
      {
        name: platformTexts[2]?.name ?? "Linux",
        icon: "🐧",
        description: platformTexts[2]?.description ?? "Ubuntu, Fedora, Arch and more",
        primaryButton: {
          label: platformTexts[2]?.primaryLabel ?? "Download .AppImage",
          url: release.assets.linuxAppImage,
        },
        secondaryButton: {
          label: platformTexts[2]?.secondaryLabel ?? ".deb / .rpm",
          url: release.releasePageUrl,
        },
        note: platformTexts[2]?.note ?? "AppImage · Debian · RPM packages",
        highlight: detectedOS === "linux",
      },
    ],
    [detectedOS, release, platformTexts],
  );

  return (
    <section id="download" className="py-20 md:py-32 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <ScrollReveal>
          <SectionHeading
            title={t("download.title")}
            subtitle={t("download.subtitle")}
          />
        </ScrollReveal>

        {/* Version badge */}
        <ScrollReveal delay={0.1}>
          <div className="flex justify-center mb-12">
            <a
              href={release.releasePageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block"
            >
              <BadgePill variant="gradient">
                {t("download.latest", { version: release.version })}
              </BadgePill>
            </a>
          </div>
        </ScrollReveal>

        {/* Platform cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {platforms.map((platform, index) => (
            <ScrollReveal key={platform.name} delay={0.1 + index * 0.1}>
              <PlatformCard {...platform} />
            </ScrollReveal>
          ))}
        </div>

        {/* GitHub links */}
        {false && (
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
        )}

        {false && (
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
        )}

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
                  {t("download.alreadyInstalledTitle")}
                </h4>
                <p
                  className="text-white/60 text-sm"
                  style={{ fontFamily: "'Inter', sans-serif" }}
                >
                  {t("download.alreadyInstalledDesc")}
                </p>
              </div>
            </div>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
