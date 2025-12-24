"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Volume2, VolumeX } from "lucide-react";
import { useAtom } from "jotai";
import { audioEnabledAtom } from "@/lib/atoms";
import { Button } from "./ui/button";
import type { Story } from "@pulse/core/ai/stories";

interface StoryStartModalProps {
  story: Story | null;
  epigraph?: { quote: string; author: string };
  onStart: () => void;
  onClose: () => void;
}

export function StoryStartModal({
  story,
  epigraph,
  onStart,
  onClose,
}: StoryStartModalProps) {
  const [audioEnabled, setAudioEnabled] = useAtom(audioEnabledAtom);

  if (!story) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ delay: 0.1 }}
          className="max-w-lg w-full mx-4 p-8 bg-background border border-border rounded-lg shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Title */}
          <h2 className="text-2xl md:text-3xl font-serif text-center mb-6">
            {story.title}
          </h2>

          {/* Epigraph */}
          {epigraph && (
            <blockquote className="border-l-2 border-muted-foreground/30 pl-4 mb-8">
              <p className="text-sm italic text-muted-foreground mb-2">
                "{epigraph.quote}"
              </p>
              <cite className="text-xs text-muted-foreground/70 not-italic">
                — {epigraph.author}
              </cite>
            </blockquote>
          )}

          {/* Description */}
          <p className="text-sm text-muted-foreground text-center mb-8 leading-relaxed">
            {story.description}
          </p>

          {/* Audio Toggle */}
          <div className="flex items-center justify-center gap-4 mb-8">
            <button
              type="button"
              onClick={() => setAudioEnabled(!audioEnabled)}
              className={`
                flex items-center gap-2 px-4 py-2 rounded-full text-sm
                transition-all duration-200
                ${
                  audioEnabled
                    ? "bg-foreground/10 text-foreground"
                    : "bg-muted text-muted-foreground"
                }
              `}
            >
              {audioEnabled ? (
                <>
                  <Volume2 className="w-4 h-4" />
                  <span>Audio On</span>
                </>
              ) : (
                <>
                  <VolumeX className="w-4 h-4" />
                  <span>Audio Off</span>
                </>
              )}
            </button>
          </div>

          {/* Duration hint */}
          <p className="text-xs text-muted-foreground/50 text-center mb-6">
            ~30 minutes · Your choices shape the narrative
          </p>

          {/* Start Button */}
          <div className="flex justify-center">
            <Button
              size="lg"
              onClick={onStart}
              className="px-8 font-serif text-lg"
            >
              Begin
            </Button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
