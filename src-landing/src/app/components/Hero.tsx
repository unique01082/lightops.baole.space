import { ChevronDown } from "lucide-react";
import { motion } from "motion/react";
import { useTranslation } from "react-i18next";
import { GradientOrb } from "./GradientOrb";
import { GradientButton } from "./GradientButton";
import { GhostButton } from "./GhostButton";
import { BadgePill } from "./BadgePill";
import { ApertureLogo } from "./ApertureLogo";
import { AppMockup } from "./AppMockup";
import { APP_DATA } from "../constants/app";
import { useGithubReleaseContext } from "../hooks/GithubReleaseContext";

export function Hero() {
  const { t } = useTranslation();
  const release = useGithubReleaseContext();

  const scrollToDownload = () => {
    const element = document.getElementById("download");
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-16">
      {/* Animated gradient orbs background */}
      <GradientOrb color="violet" size={500} top="10%" left="5%" delay={0} />
      <GradientOrb color="fuchsia" size={400} top="60%" left="70%" delay={2} />
      <GradientOrb color="blue" size={450} top="30%" left="80%" delay={4} />

      {/* Content */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center mb-12">
          {/* App icon with glow */}
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5 }}
            className="flex justify-center mb-6"
          >
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-violet-500 to-fuchsia-500 blur-2xl opacity-50" />
              <ApertureLogo size={72} className="relative" />
            </div>
          </motion.div>

          {/* Heading */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-6xl/24 md:text-7xl/28 lg:text-8xl/30 font-bold mb-6 bg-gradient-to-r from-violet-500 to-fuchsia-500 bg-clip-text text-transparent"
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          >
            {APP_DATA.name}
          </motion.h1>

          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="flex justify-center mb-6"
          >
            <BadgePill variant="gradient">
              🏷️{" "}
              {t("hero.badge", {
                version: release.version,
                license: APP_DATA.license,
              })}
            </BadgePill>
          </motion.div>

          {/* Tagline */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="text-2xl md:text-3xl text-white/70 mb-4 italic"
            style={{ fontFamily: "'Inter', sans-serif" }}
          >
            {APP_DATA.tagline}
          </motion.p>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="text-lg md:text-xl text-white/60 max-w-2xl mx-auto mb-10"
            style={{ fontFamily: "'Inter', sans-serif" }}
          >
            {APP_DATA.subtitle}
          </motion.p>

          {/* CTA Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.5 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8"
          >
            <GradientButton
              size="lg"
              href={APP_DATA.downloadSection}
              target="_self"
            >
              {t("hero.downloadNow")}
            </GradientButton>
            <GhostButton size="lg" href={APP_DATA.githubRepo}>
              {t("hero.starOnGithub")}
            </GhostButton>
          </motion.div>

          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.6 }}
            onClick={scrollToDownload}
            className="text-white/50 text-sm hover:text-white/70 transition-colors"
            style={{ fontFamily: "'Inter', sans-serif" }}
          >
            {t("hero.alsoAvailable")}
          </motion.button>
        </div>

        {/* App Mockup */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.7 }}
          className="flex justify-center px-4"
        >
          <div className="w-full max-w-[900px]">
            <AppMockup width={900} state="complete" />
          </div>
        </motion.div>
      </div>

      {/* Scroll indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1, delay: 1.5 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2"
      >
        <motion.div
          animate={{ y: [0, 10, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <ChevronDown className="text-white/30" size={32} />
        </motion.div>
      </motion.div>
    </section>
  );
}
