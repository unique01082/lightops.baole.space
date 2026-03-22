interface ApertureLogoProps {
  size?: number;
  className?: string;
}

export function ApertureLogo({ size = 24, className = "" }: ApertureLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <linearGradient id="apertureGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#a855f7" />
          <stop offset="100%" stopColor="#e879f9" />
        </linearGradient>
      </defs>
      {/* Hexagonal aperture blades */}
      <path
        d="M50 10 L75 25 L75 50 L50 65 L25 50 L25 25 Z"
        fill="url(#apertureGradient)"
        opacity="0.8"
      />
      <path
        d="M50 20 L70 32 L70 50 L50 62 L30 50 L30 32 Z"
        fill="none"
        stroke="url(#apertureGradient)"
        strokeWidth="2"
      />
      <circle cx="50" cy="50" r="12" fill="none" stroke="url(#apertureGradient)" strokeWidth="3" />
      {/* Aperture blade lines */}
      <line x1="50" y1="10" x2="50" y2="25" stroke="url(#apertureGradient)" strokeWidth="2" opacity="0.6" />
      <line x1="75" y1="25" x2="68" y2="35" stroke="url(#apertureGradient)" strokeWidth="2" opacity="0.6" />
      <line x1="75" y1="50" x2="65" y2="50" stroke="url(#apertureGradient)" strokeWidth="2" opacity="0.6" />
      <line x1="50" y1="65" x2="50" y2="55" stroke="url(#apertureGradient)" strokeWidth="2" opacity="0.6" />
      <line x1="25" y1="50" x2="35" y2="50" stroke="url(#apertureGradient)" strokeWidth="2" opacity="0.6" />
      <line x1="25" y1="25" x2="32" y2="35" stroke="url(#apertureGradient)" strokeWidth="2" opacity="0.6" />
    </svg>
  );
}
