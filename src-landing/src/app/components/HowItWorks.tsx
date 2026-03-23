import { useTranslation } from "react-i18next";
import { ScrollReveal } from "./ScrollReveal";
import { SectionHeading } from "./SectionHeading";
import { STEPS } from "../constants/steps";

export function HowItWorks() {
  const { t } = useTranslation();
  const steps = t("howItWorks.steps", { returnObjects: true }) as Array<{
    title: string;
    description: string;
  }>;
  return (
    <section id="how-it-works" className="py-20 md:py-32 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <ScrollReveal>
          <SectionHeading
            title={t("howItWorks.title")}
            subtitle={t("howItWorks.subtitle")}
          />
        </ScrollReveal>

        {/* Desktop: Horizontal stepper */}
        <div className="hidden md:block">
          <div className="relative">
            {/* Connecting line */}
            <div className="absolute top-12 left-0 right-0 h-0.5 bg-gradient-to-r from-violet-500/20 via-fuchsia-500/20 to-violet-500/20" />

            <div className="grid grid-cols-4 gap-8">
              {STEPS.map((step, index) => (
                <ScrollReveal key={step.number} delay={index * 0.15}>
                  <div className="relative">
                    {/* Step number with gradient */}
                    <div className="relative mb-6">
                      <div className="w-24 h-24 mx-auto bg-gradient-to-br from-violet-500 to-fuchsia-500 rounded-full flex items-center justify-center text-white text-4xl font-bold shadow-lg shadow-violet-500/30 transition-all duration-300 hover:scale-110 hover:shadow-xl hover:shadow-violet-500/50">
                        {step.number}
                      </div>
                    </div>

                    {/* Card */}
                    <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6 hover:border-white/20 transition-all duration-300 hover:-translate-y-1">
                      <div className="text-3xl mb-3 text-center">{step.icon}</div>
                      <h3
                        className="text-lg font-semibold text-white mb-3 text-center"
                        style={{ fontFamily: "'Space Grotesk', sans-serif" }}
                      >
                        {steps[index]?.title ?? step.title}
                      </h3>
                      <p
                        className="text-white/60 text-sm text-center leading-relaxed"
                        style={{ fontFamily: "'Inter', sans-serif" }}
                      >
                        {steps[index]?.description ?? step.description}
                      </p>
                    </div>
                  </div>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </div>

        {/* Mobile: Vertical steps */}
        <div className="md:hidden space-y-8">
          {STEPS.map((step, index) => (
            <ScrollReveal key={step.number} delay={index * 0.1}>
              <div className="flex gap-4">
                {/* Step number */}
                <div className="flex-shrink-0">
                  <div className="w-16 h-16 bg-gradient-to-br from-violet-500 to-fuchsia-500 rounded-full flex items-center justify-center text-white text-2xl font-bold shadow-lg shadow-violet-500/30">
                    {step.number}
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-5">
                  <div className="text-2xl mb-2">{step.icon}</div>
                  <h3
                    className="text-lg font-semibold text-white mb-2"
                    style={{ fontFamily: "'Space Grotesk', sans-serif" }}
                  >
                    {steps[index]?.title ?? step.title}
                  </h3>
                  <p
                    className="text-white/60 text-sm leading-relaxed"
                    style={{ fontFamily: "'Inter', sans-serif" }}
                  >
                    {steps[index]?.description ?? step.description}
                  </p>
                </div>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
