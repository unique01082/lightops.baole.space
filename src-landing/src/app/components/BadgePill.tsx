import { ReactNode } from "react";

interface BadgePillProps {
  children: ReactNode;
  variant?: "default" | "gradient" | "success" | "muted";
  className?: string;
}

export function BadgePill({ children, variant = "default", className = "" }: BadgePillProps) {
  const variantClasses = {
    default: "bg-white/10 text-white/70 border border-white/10",
    gradient: "bg-gradient-to-r from-violet-500/20 to-fuchsia-500/20 text-white border border-violet-500/30",
    success: "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30",
    muted: "bg-white/5 text-white/50 border border-white/5",
  };

  return (
    <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${variantClasses[variant]} ${className}`}>
      {children}
    </span>
  );
}
