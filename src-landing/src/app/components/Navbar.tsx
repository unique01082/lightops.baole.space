import { useState, useEffect } from "react";
import { ApertureLogo } from "./ApertureLogo";
import { GradientButton } from "./GradientButton";
import { Menu, X } from "lucide-react";
import { APP_DATA } from "../constants/app";

export function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
      setIsMobileMenuOpen(false);
    }
  };

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled
          ? "bg-black/80 backdrop-blur-lg border-b border-white/10"
          : "bg-transparent"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <ApertureLogo size={24} />
            <span
              className="text-white font-bold text-xl"
              style={{ fontFamily: "'Space Grotesk', sans-serif" }}
            >
              LightOps
            </span>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-6">
            <button
              onClick={() => scrollToSection("features")}
              className="text-white/70 hover:text-white transition-colors"
              style={{ fontFamily: "'Inter', sans-serif" }}
            >
              Features
            </button>
            <button
              onClick={() => scrollToSection("download")}
              className="text-white/70 hover:text-white transition-colors"
              style={{ fontFamily: "'Inter', sans-serif" }}
            >
              Download
            </button>
            <button
              onClick={() => scrollToSection("how-it-works")}
              className="text-white/70 hover:text-white transition-colors"
              style={{ fontFamily: "'Inter', sans-serif" }}
            >
              How It Works
            </button>
            <button
              onClick={() => scrollToSection("changelog")}
              className="text-white/70 hover:text-white transition-colors"
              style={{ fontFamily: "'Inter', sans-serif" }}
            >
              Changelog
            </button>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-4">
            <a
              href={APP_DATA.ecosystemHome}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden lg:block text-white/40 text-xs hover:text-white/60 transition-colors"
              style={{ fontFamily: "'Inter', sans-serif" }}
            >
              Part of the baole.space ecosystem
            </a>
            <GradientButton size="sm" href={APP_DATA.githubLatestRelease}>
              Download
            </GradientButton>

            {/* Mobile menu button */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden text-white p-2"
            >
              {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden bg-black/95 backdrop-blur-lg border-t border-white/10">
          <div className="px-4 py-4 space-y-3">
            <button
              onClick={() => scrollToSection("features")}
              className="block w-full text-left text-white/70 hover:text-white py-2"
              style={{ fontFamily: "'Inter', sans-serif" }}
            >
              Features
            </button>
            <button
              onClick={() => scrollToSection("download")}
              className="block w-full text-left text-white/70 hover:text-white py-2"
              style={{ fontFamily: "'Inter', sans-serif" }}
            >
              Download
            </button>
            <button
              onClick={() => scrollToSection("how-it-works")}
              className="block w-full text-left text-white/70 hover:text-white py-2"
              style={{ fontFamily: "'Inter', sans-serif" }}
            >
              How It Works
            </button>
            <button
              onClick={() => scrollToSection("changelog")}
              className="block w-full text-left text-white/70 hover:text-white py-2"
              style={{ fontFamily: "'Inter', sans-serif" }}
            >
              Changelog
            </button>
          </div>
        </div>
      )}
    </nav>
  );
}
