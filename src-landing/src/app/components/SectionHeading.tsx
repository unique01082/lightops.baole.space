import { ReactNode } from "react";

interface SectionHeadingProps {
  title: string;
  subtitle?: string | ReactNode;
  className?: string;
}

export function SectionHeading({ title, subtitle, className = "" }: SectionHeadingProps) {
  return (
    <div className={`text-center mb-12 md:mb-16 ${className}`}>
      <h2 className="text-4xl md:text-5xl font-bold mb-4" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
        {title}
      </h2>
      {subtitle && (
        <p className="text-lg md:text-xl text-white/60 max-w-2xl mx-auto" style={{ fontFamily: "'Inter', sans-serif" }}>
          {subtitle}
        </p>
      )}
    </div>
  );
}
