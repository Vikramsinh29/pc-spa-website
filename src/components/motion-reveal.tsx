"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";

type MotionRevealProps = {
  children: ReactNode;
  className?: string;
  id?: string;
  as?: "div" | "header" | "section";
  delay?: number;
  inView?: boolean;
};

export function MotionReveal({
  children,
  className,
  id,
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
    className,
    initial: hidden,
    transition: { duration: 0.35, ease: [0, 0, 0.2, 1] as const, delay },
    ...animationProps,
  };

  if (as === "header") {
    return <motion.header {...sharedProps}>{children}</motion.header>;
  }

  if (as === "section") {
    return <motion.section {...sharedProps}>{children}</motion.section>;
  }

  return <motion.div {...sharedProps}>{children}</motion.div>;
}
