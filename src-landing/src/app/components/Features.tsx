import { ScrollReveal } from "./ScrollReveal";
import { SectionHeading } from "./SectionHeading";
import { FeatureCard } from "./FeatureCard";
import { FEATURES } from "../constants/features";

export function Features() {
  return (
    <section id="features" className="py-20 md:py-32 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <ScrollReveal>
          <SectionHeading
            title="Everything You Need"
            subtitle="Powerful batch file management built specifically for photographers"
          />
        </ScrollReveal>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
          {FEATURES.map((feature, index) => (
            <ScrollReveal key={feature.id} delay={index * 0.1}>
              <FeatureCard
                icon={feature.icon}
                title={feature.title}
                description={feature.description}
                highlight={feature.highlight}
              />
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
