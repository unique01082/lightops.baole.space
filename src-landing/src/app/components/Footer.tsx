import { useTranslation } from "react-i18next";
import { ApertureLogo } from "./ApertureLogo";
import { APP_DATA } from "../constants/app";

export function Footer() {
  const { t } = useTranslation();
  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <footer className="bg-black/40 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Bottom bar */}
        <div className="flex flex-col md:flex-row justify-center items-center gap-2 md:gap-4 text-white/40 text-sm">
          <div className="flex items-center gap-3">
            <ApertureLogo size={20} />
            <span
              className="text-white font-bold text-lg"
              style={{ fontFamily: "'Space Grotesk', sans-serif" }}
            >
              {APP_DATA.name}
            </span>
          </div>
          <a
            href={APP_DATA.ecosystemHome}
            target="_blank"
            rel="noopener noreferrer"
            className="text-white/50 hover:text-white/70 transition-colors text-sm"
            style={{ fontFamily: "'Inter', sans-serif" }}
          >
            Part of the{" "}
            <span className="text-violet-400">{APP_DATA.partOfEcosystem}</span>{" "}
            ecosystem
          </a>
          <span className="hidden md:inline">·</span>
          <span style={{ fontFamily: "'Inter', sans-serif" }}>
            {t("footer.copyrightPrefix")}{" "}
            <a
              href={APP_DATA.authorUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white/60 transition-colors"
            >
              {APP_DATA.author}
            </a>
          </span>
          <span className="hidden md:inline">·</span>
          <span style={{ fontFamily: "'Inter', sans-serif" }}>
            {t("footer.madeWith")}
          </span>
        </div>
      </div>
    </footer>
  );
}
