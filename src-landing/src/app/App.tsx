import { Changelog } from './components/Changelog';
import { Download } from './components/Download';
import { Features } from './components/Features';
import { Footer } from './components/Footer';
import { Hero } from './components/Hero';
import { HowItWorks } from './components/HowItWorks';
import { Navbar } from './components/Navbar';
import { OpenSource } from './components/OpenSource';
import { Screenshots } from './components/Screenshots';
import { GithubReleaseProvider } from './hooks/GithubReleaseContext';

export default function App() {
  return (
    <GithubReleaseProvider>
      <div className="min-h-screen bg-gradient-to-br from-[#0f0c29] via-[#302b63] to-[#24243e] text-white overflow-x-hidden">
        <Navbar />
        <main>
          <Hero />
          <Features />
          <Download />
          <HowItWorks />
          <Screenshots />
          <Changelog />
          {false && <OpenSource />}
        </main>
        <Footer />
      </div>
    </GithubReleaseProvider>
  );
}
