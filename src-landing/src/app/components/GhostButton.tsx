import { ReactNode } from "react";

interface GhostButtonProps {
  children: ReactNode;
  onClick?: () => void;
  href?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function GhostButton({ children, onClick, href, size = "md", className = "" }: GhostButtonProps) {
  const sizeClasses = {
    sm: "px-4 py-2 text-sm",
    md: "px-6 py-3 text-base",
    lg: "px-8 py-4 text-lg",
  };

  const classes = `inline-flex items-center justify-center ${sizeClasses[size]} border border-white/20 text-white font-medium rounded-lg transition-all duration-300 hover:bg-white/5 hover:border-white/40 hover:scale-105 active:scale-95 ${className}`;

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