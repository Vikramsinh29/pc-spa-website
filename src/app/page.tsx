import { FeatureGrid } from "../components/feature-grid";
import { HeroSection } from "../components/hero-section";
import { MotionReveal } from "../components/motion-reveal";

export default function Home() {
  return (
    <MotionReveal className="page-shell" delay={0.05}>
      <HeroSection />
      <main id="about">
        <FeatureGrid />
      </main>
    </MotionReveal>
  );
}
