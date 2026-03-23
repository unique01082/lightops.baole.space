import { useTranslation } from "react-i18next";
import { ScrollReveal } from "./ScrollReveal";
import { SectionHeading } from "./SectionHeading";
import { FeatureCard } from "./FeatureCard";
import { FEATURES } from "../constants/features";

export function Features() {
  const { t } = useTranslation();
  const items = t("features.items", { returnObjects: true }) as Array<{
    title: string;
    description: string;
  }>;

  return (
    <section id="features" className="py-20 md:py-32 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <ScrollReveal>
          <SectionHeading
            title={t("features.title")}
            subtitle={t("features.subtitle")}
          />
        </ScrollReveal>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
          {FEATURES.map((feature, index) => (
            <ScrollReveal key={feature.id} delay={index * 0.1}>
              <FeatureCard
                icon={feature.icon}
                title={items[index]?.title ?? feature.title}
                description={items[index]?.description ?? feature.description}
                highlight={feature.highlight}
              />
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
