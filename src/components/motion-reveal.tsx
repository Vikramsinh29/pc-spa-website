"use client";

import { domAnimation, LazyMotion, m, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";

type MotionRevealProps = {
  children: ReactNode;
  className?: string;
  id?: string;
  "aria-label"?: string;
  as?: "div" | "header" | "section";
  delay?: number;
  inView?: boolean;
};

export function MotionReveal({
  children,
  className,
  id,
  "aria-label": ariaLabel,
  as = "div",
  delay = 0,
  inView = false,
}: MotionRevealProps) {
  const reduceMotion = useReducedMotion();

  const hidden = reduceMotion ? { opacity: 0 } : { opacity: 0, y: 18 };
  const visible = reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 };
  const animationProps = inView
    ? {
        whileInView: visible,
        viewport: { once: true, amount: 0.2 },
      }
    : {
        animate: visible,
      };

  const sharedProps = {
    id,
    "aria-label": ariaLabel,
    className,
    initial: hidden,
    transition: { duration: 0.35, ease: [0, 0, 0.2, 1] as const, delay },
    ...animationProps,
  };

  if (as === "header") {
    return (
      <LazyMotion features={domAnimation}>
        <m.header {...sharedProps}>{children}</m.header>
      </LazyMotion>
    );
  }

  if (as === "section") {
    return (
      <LazyMotion features={domAnimation}>
        <m.section {...sharedProps}>{children}</m.section>
      </LazyMotion>
    );
  }

  return (
    <LazyMotion features={domAnimation}>
      <m.div {...sharedProps}>{children}</m.div>
    </LazyMotion>
  );
}
