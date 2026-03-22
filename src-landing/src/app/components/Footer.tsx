import { ApertureLogo } from "./ApertureLogo";
import { APP_DATA } from "../constants/app";

export function Footer() {
  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <footer className="border-t border-white/10 bg-black/40 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Top section */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-8 mb-8">
          {/* Left - Logo */}
          <div className="flex items-center gap-3">
            <ApertureLogo size={20} />
            <span
              className="text-white font-bold text-lg"
              style={{ fontFamily: "'Space Grotesk', sans-serif" }}
            >
              {APP_DATA.name}
            </span>
          </div>

          {/* Center - Links */}
          <div className="flex flex-wrap justify-center gap-6">
            <button
              onClick={() => scrollToSection("features")}
              className="text-white/60 hover:text-white transition-colors text-sm"
              style={{ fontFamily: "'Inter', sans-serif" }}
            >
              Features
            </button>
            <button
              onClick={() => scrollToSection("download")}
              className="text-white/60 hover:text-white transition-colors text-sm"
              style={{ fontFamily: "'Inter', sans-serif" }}
            >
              Download
            </button>
            <button
              onClick={() => scrollToSection("how-it-works")}
              className="text-white/60 hover:text-white transition-colors text-sm"
              style={{ fontFamily: "'Inter', sans-serif" }}
            >
              How It Works
            </button>
            <button
              onClick={() => scrollToSection("changelog")}
              className="text-white/60 hover:text-white transition-colors text-sm"
              style={{ fontFamily: "'Inter', sans-serif" }}
            >
              Changelog
            </button>
            <a
              href={APP_DATA.githubRepo}
              target="_blank"
              rel="noopener noreferrer"
              className="text-white/60 hover:text-white transition-colors text-sm"
              style={{ fontFamily: "'Inter', sans-serif" }}
            >
              GitHub
            </a>
          </div>

          {/* Right - Ecosystem link */}
          <div>
            <a
              href={APP_DATA.ecosystemHome}
              target="_blank"
              rel="noopener noreferrer"
              className="text-white/50 hover:text-white/70 transition-colors text-sm"
              style={{ fontFamily: "'Inter', sans-serif" }}
            >
              Part of the{" "}
              <span className="text-violet-400">baole.space</span> ecosystem
            </a>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="pt-8 border-t border-white/10">
          <div className="flex flex-col md:flex-row justify-center items-center gap-2 md:gap-4 text-white/40 text-sm">
            <span style={{ fontFamily: "'Inter', sans-serif" }}>
              © 2025{" "}
              <a
                href={APP_DATA.authorUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-white/60 transition-colors"
              >
                {APP_DATA.author}
              </a>{" "}
              — {APP_DATA.license} License
            </span>
            <span className="hidden md:inline">·</span>
            <span style={{ fontFamily: "'Inter', sans-serif" }}>
              Built with Tauri + Rust + React
            </span>
            <span className="hidden md:inline">·</span>
            <span style={{ fontFamily: "'Inter', sans-serif" }}>
              Made with ❤️ and +0.3 EV
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
