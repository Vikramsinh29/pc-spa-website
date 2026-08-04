import Image from "next/image";
import { MotionReveal } from "./motion-reveal";

export function HeroSection() {
  return (
    <MotionReveal as="header" className="hero" inView>
      <div className="hero-copy">
        <p className="eyebrow">PC SPA • Premium Care</p>
        <h1>Fast fixes, clean builds, and smoother everyday computing.</h1>
        <p className="lead">
          From diagnostics and tune-ups to custom setups, our team keeps your rig reliable,
          fast, and ready for the next big task.
        </p>
        <div className="cta-group">
          <a className="button primary" href="#services">
            Book a Tune-Up
          </a>
          <a className="button secondary" href="#about">
            Explore Services
          </a>
        </div>
      </div>
      <div className="hero-media">
        <Image
          src="/pc-spa-hero.png"
          alt="Illustration of a modern PC workstation"
          width={1024}
          height={1024}
          priority
          sizes="(max-width: 900px) calc(100vw - 4rem), 50vw"
        />
      </div>
    </MotionReveal>
  );
}
