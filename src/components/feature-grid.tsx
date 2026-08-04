import { MotionReveal } from "./motion-reveal";

const features = [
  {
    title: "Performance tuning",
    description: "Boost boot times, remove bloat, and restore a snappy experience.",
  },
  {
    title: "Custom builds",
    description: "Design a workstation that fits your workflow, budget, and aesthetic.",
  },
  {
    title: "Support plans",
    description: "Keep every machine protected with dependable service and maintenance.",
  },
];

export function FeatureGrid() {
  return (
    <MotionReveal as="section" className="feature-grid" id="services" inView delay={0.1}>
      {features.map((feature) => (
        <article className="card" key={feature.title}>
          <h2>{feature.title}</h2>
          <p>{feature.description}</p>
        </article>
      ))}
    </MotionReveal>
  );
}
