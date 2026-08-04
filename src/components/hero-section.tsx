"use client";

import { motion, useReducedMotion } from "framer-motion";
import Image from "next/image";
import { MotionReveal } from "./motion-reveal";

export function HeroSection() {
  const reduceMotion = useReducedMotion();

  const copyInitial = reduceMotion ? { opacity: 0 } : { opacity: 0, y: 14 };
  const copyAnimate = { opacity: 1, y: 0 };
  const mediaInitial = reduceMotion ? { opacity: 0 } : { opacity: 0, y: 18, scale: 0.985 };
  const mediaAnimate = { opacity: 1, y: 0, scale: 1 };

  return (
    <MotionReveal as="header" className="hero" inView>
      <motion.div
        className="hero-copy"
        initial={copyInitial}
        whileInView={copyAnimate}
        viewport={{ once: true, amount: 0.35 }}
        transition={{ duration: 0.32, ease: [0, 0, 0.2, 1], delay: 0.06 }}
      >
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
      </motion.div>
      <motion.div
        className="hero-media"
        initial={mediaInitial}
        whileInView={mediaAnimate}
        viewport={{ once: true, amount: 0.3 }}
        transition={{ duration: 0.42, ease: [0, 0, 0.2, 1], delay: 0.12 }}
      >
        <Image
          src="/pc-spa-hero.png"
          alt="Illustration of a modern PC workstation"
          width={1024}
          height={1024}
          priority
          sizes="(max-width: 900px) calc(100vw - 4rem), 50vw"
        />
      </motion.div>
    </MotionReveal>
  );
}
