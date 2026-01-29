"use client";

import { motion } from "framer-motion";

interface FogLayerProps {
  /** Fog opacity (0-1) */
  opacity?: number;
  /** Fog color - defaults to a subtle warm gray */
  color?: string;
  /** Number of fog layers */
  layers?: number;
  /** Animation speed multiplier */
  speed?: number;
  /** Additional class names */
  className?: string;
}

/**
 * Animated fog/mist overlay for atmospheric depth
 * Creates drifting wisps that enhance the literary horror aesthetic
 */
export function FogLayer({
  opacity = 0.15,
  color = "rgba(180, 170, 160, 0.3)",
  layers = 3,
  speed = 1,
  className = "",
}: FogLayerProps) {
  return (
    <div
      className={`pointer-events-none fixed inset-0 overflow-hidden ${className}`}
      style={{ zIndex: 1 }}
    >
      {/* Primary fog layers - static configuration, never reorder */}
      {["fog-a", "fog-b", "fog-c"].slice(0, layers).map((id, i) => (
        <motion.div
          key={id}
          className="absolute inset-0"
          style={{
            background: `radial-gradient(ellipse at ${30 + i * 20}% ${40 + i * 15}%, ${color} 0%, transparent 50%)`,
            opacity: opacity * (1 - i * 0.2),
          }}
          animate={{
            x: ["-5%", "5%", "-5%"],
            y: ["-3%", "3%", "-3%"],
            scale: [1, 1.1, 1],
          }}
          transition={{
            duration: (20 + i * 5) / speed,
            repeat: Number.POSITIVE_INFINITY,
            ease: "easeInOut",
            delay: i * 2,
          }}
        />
      ))}

      {/* Secondary fog wisps - static, never reorder */}
      {[0, 1].map((i) => (
        <motion.div
          key={i === 0 ? "wisp-left" : "wisp-right"}
          className="absolute"
          style={{
            width: "60%",
            height: "40%",
            left: i === 0 ? "-10%" : "50%",
            top: i === 0 ? "20%" : "50%",
            background: `radial-gradient(ellipse, ${color} 0%, transparent 70%)`,
            opacity: opacity * 0.5,
            filter: "blur(40px)",
          }}
          animate={{
            x: i === 0 ? ["0%", "15%", "0%"] : ["0%", "-15%", "0%"],
            opacity: [opacity * 0.3, opacity * 0.6, opacity * 0.3],
          }}
          transition={{
            duration: (25 + i * 10) / speed,
            repeat: Number.POSITIVE_INFINITY,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}

/**
 * Vignette overlay - darkens edges for focus
 */
export function Vignette({
  intensity = 0.6,
  className = "",
}: {
  intensity?: number;
  className?: string;
}) {
  return (
    <div
      className={`pointer-events-none fixed inset-0 ${className}`}
      style={{
        zIndex: 2,
        background: `radial-gradient(ellipse at center, transparent 0%, transparent 40%, rgba(0, 0, 0, ${intensity}) 100%)`,
      }}
    />
  );
}
