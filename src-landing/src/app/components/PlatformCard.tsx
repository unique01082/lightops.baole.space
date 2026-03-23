import { GradientButton } from "./GradientButton";
import { GhostButton } from "./GhostButton";

interface PlatformCardProps {
  name: string;
  icon: string;
  description: string;
  primaryButton: {
    label: string;
    url: string;
  };
  secondaryButton: {
    label: string;
    url: string;
  };
  note: string;
  highlight?: boolean;
}

export function PlatformCard({
  name,
  icon,
  description,
  primaryButton,
  secondaryButton,
  note,
  highlight = false,
}: PlatformCardProps) {
  return (
    <div
      className={`relative h-full bg-white/5 backdrop-blur-sm border rounded-2xl p-8 transition-all duration-300 hover:-translate-y-1 ${
        highlight
          ? "border-violet-500/50 shadow-lg shadow-violet-500/20"
          : "border-white/10 hover:border-white/20"
      }`}
    >
      {/* Gradient border effect */}
      <div
        className={`absolute inset-0 rounded-2xl bg-gradient-to-br from-violet-500/10 to-fuchsia-500/10 ${
          highlight ? "opacity-100" : "opacity-0 group-hover:opacity-100"
        } transition-opacity duration-300`}
      />

      {highlight && (
        <div className="absolute top-4 right-4">
          <span className="text-xs px-3 py-1 rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white font-semibold">
            Recommended
          </span>
        </div>
      )}

      <div className="relative">
        {/* Icon */}
        <div className="text-5xl mb-4">{icon}</div>

        {/* Platform name */}
        <h3
          className="text-2xl font-bold text-white mb-2"
          style={{ fontFamily: "'Space Grotesk', sans-serif" }}
        >
          {name}
        </h3>

        {/* Description */}
        <p
          className="text-white/60 mb-6"
          style={{ fontFamily: "'Inter', sans-serif" }}
        >
          {description}
        </p>

        {/* Buttons */}
        <div className="space-y-3 mb-4">
          <GradientButton href={primaryButton.url} className="w-full">
            {primaryButton.label}
          </GradientButton>
          <GhostButton href={secondaryButton.url} className="w-full" size="sm">
            {secondaryButton.label}
          </GhostButton>
        </div>

        {/* Note */}
        <p
          className="text-white/40 text-sm text-center"
          style={{ fontFamily: "'Inter', sans-serif" }}
        >
          {note}
        </p>
      </div>
    </div>
  );
}
