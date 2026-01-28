import { motion } from "framer-motion";

/**
 * The Pulse - An atmospheric, organic loading animation
 * Evokes a heartbeat in darkness, fitting the horror/mystery aesthetic
 */
export const Pulse = ({ size = "md" }: { size?: "sm" | "md" | "lg" }) => {
  const sizeMap = {
    sm: { container: "size-12", core: "size-3" },
    md: { container: "size-20", core: "size-4" },
    lg: { container: "size-32", core: "size-6" },
  };

  const s = sizeMap[size];

  return (
    <div className={`relative ${s.container} flex items-center justify-center`}>
      {/* Outer ethereal rings - expand and fade */}
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="absolute inset-0 rounded-full border border-foreground/20"
          initial={{ scale: 0.3, opacity: 0 }}
          animate={{
            scale: [0.3, 1.2, 1.5],
            opacity: [0, 0.4, 0],
          }}
          transition={{
            duration: 3,
            repeat: Number.POSITIVE_INFINITY,
            delay: i * 0.8,
            ease: "easeOut",
          }}
        />
      ))}

      {/* Middle glow layer */}
      <motion.div
        className="absolute inset-2 rounded-full bg-foreground/5"
        animate={{
          scale: [1, 1.1, 1],
          opacity: [0.3, 0.6, 0.3],
        }}
        transition={{
          duration: 2,
          repeat: Number.POSITIVE_INFINITY,
          ease: "easeInOut",
        }}
      />

      {/* Inner pulsing ring */}
      <motion.div
        className="absolute inset-4 rounded-full border-2 border-foreground/30"
        animate={{
          scale: [0.8, 1, 0.8],
          opacity: [0.5, 1, 0.5],
        }}
        transition={{
          duration: 1.5,
          repeat: Number.POSITIVE_INFINITY,
          ease: "easeInOut",
        }}
      />

      {/* Core - the heartbeat */}
      <motion.div
        className={`relative ${s.core} rounded-full bg-foreground`}
        animate={{
          scale: [1, 1.3, 1, 1.15, 1],
          opacity: [0.8, 1, 0.8, 0.95, 0.8],
        }}
        transition={{
          duration: 1.2,
          repeat: Number.POSITIVE_INFINITY,
          ease: "easeInOut",
          times: [0, 0.15, 0.4, 0.55, 1], // Double-beat like a real heartbeat
        }}
      >
        {/* Core glow */}
        <motion.div
          className="absolute inset-0 rounded-full bg-foreground blur-sm"
          animate={{
            scale: [1, 1.8, 1, 1.5, 1],
            opacity: [0.5, 0.8, 0.4, 0.6, 0.5],
          }}
          transition={{
            duration: 1.2,
            repeat: Number.POSITIVE_INFINITY,
            ease: "easeInOut",
            times: [0, 0.15, 0.4, 0.55, 1],
          }}
        />
      </motion.div>
    </div>
  );
};