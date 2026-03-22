import { ReactNode } from "react";

interface GradientButtonProps {
  children: ReactNode;
  onClick?: () => void;
  href?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function GradientButton({ children, onClick, href, size = "md", className = "" }: GradientButtonProps) {
  const sizeClasses = {
    sm: "px-4 py-2 text-sm",
    md: "px-6 py-3 text-base",
    lg: "px-8 py-4 text-lg",
  };

  const classes = `inline-flex items-center justify-center ${sizeClasses[size]} bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white font-semibold rounded-lg transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-violet-500/50 active:scale-95 ${className}`;

  if (href) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={classes}>
        {children}
      </a>
    );
  }

  return (
    <button onClick={onClick} className={classes}>
      {children}
    </button>
  );
}