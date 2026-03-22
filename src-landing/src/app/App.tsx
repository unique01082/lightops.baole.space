import { Navbar } from "./components/Navbar";
import { Hero } from "./components/Hero";
import { Features } from "./components/Features";
import { Download } from "./components/Download";
import { HowItWorks } from "./components/HowItWorks";
import { Screenshots } from "./components/Screenshots";
import { Changelog } from "./components/Changelog";
import { OpenSource } from "./components/OpenSource";
import { Footer } from "./components/Footer";

export default function App() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f0c29] via-[#302b63] to-[#24243e] text-white overflow-x-hidden">
      <Navbar />
      <main>
        <Hero />
        <Features />
        <Download />
        <HowItWorks />
        <Screenshots />
        <Changelog />
        <OpenSource />
      </main>
      <Footer />
    </div>
  );
}
