import { motion } from "motion/react";

interface GradientOrbProps {
  color: "violet" | "fuchsia" | "blue";
  size?: number;
  top?: string;
  left?: string;
  delay?: number;
}

export function GradientOrb({ color, size = 400, top = "20%", left = "20%", delay = 0 }: GradientOrbProps) {
  const colors = {
    violet: "from-violet-500/30 to-purple-500/20",
    fuchsia: "from-fuchsia-500/30 to-pink-500/20",
    blue: "from-blue-500/30 to-cyan-500/20",
  };

  return (
    <motion.div
      className={`absolute rounded-full bg-gradient-to-br ${colors[color]} blur-3xl pointer-events-none`}
      style={{
        width: size,
        height: size,
        top,
        left,
      }}
      animate={{
        x: [0, 30, -30, 0],
        y: [0, -30, 30, 0],
        scale: [1, 1.1, 0.9, 1],
      }}
      transition={{
        duration: 20,
        repeat: Infinity,
        ease: "easeInOut",
        delay,
      }}
    />
  );
}
