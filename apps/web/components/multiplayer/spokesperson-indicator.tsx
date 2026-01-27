"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface SpokespersonIndicatorProps {
  spokespersonName: string;
  isSpokesperson: boolean;
  className?: string;
}

export function SpokespersonIndicator({
  spokespersonName,
  isSpokesperson,
  className,
}: SpokespersonIndicatorProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "flex items-center gap-3 px-4 py-2",
        className
      )}
    >
      {/* Pulse indicator */}
      <div className="relative">
        <motion.div
          className={cn(
            "w-2 h-2 rounded-full",
            isSpokesperson ? "bg-foreground" : "bg-muted-foreground/40"
          )}
          animate={
            isSpokesperson
              ? {
                  scale: [1, 1.3, 1],
                  opacity: [0.8, 0.5, 0.8],
                }
              : {}
          }
          transition={{
            duration: 2,
            repeat: Number.POSITIVE_INFINITY,
            ease: "easeInOut",
          }}
        />
        {isSpokesperson && (
          <motion.div
            className="absolute inset-0 bg-foreground rounded-full"
            animate={{
              scale: [1, 2.5],
              opacity: [0.4, 0],
            }}
            transition={{
              duration: 2,
              repeat: Number.POSITIVE_INFINITY,
              ease: "easeOut",
            }}
          />
        )}
      </div>

      {/* Text */}
      <span
        className={cn(
          "text-xs tracking-wide",
          isSpokesperson
            ? "text-foreground/80"
            : "text-muted-foreground/60"
        )}
      >
        {isSpokesperson ? (
          <span className="italic">You speak for the party</span>
        ) : (
          <>
            <span className="font-medium text-foreground/70">
              {spokespersonName}
            </span>
            <span className="text-muted-foreground/50 ml-1">
              speaks for the party
            </span>
          </>
        )}
      </span>
    </motion.div>
  );
}
