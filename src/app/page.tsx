import { FeatureGrid } from "../components/feature-grid";
import { HeroSection } from "../components/hero-section";

export default function Home() {
  return (
    <div className="page-shell">
      <HeroSection />
      <main id="about">
        <FeatureGrid />
      </main>
    </div>
  );
}
