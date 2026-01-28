"use client";

import { Volume2, VolumeX, Users, Loader2 } from "lucide-react";
import { useAtom } from "jotai";
import Link from "next/link";
import { audioEnabledAtom } from "@/lib/atoms";
import { Button } from "./ui/button";
import type { Story } from "@pulse/core/ai/stories";

interface StoryStartModalProps {
  story: Story | null;
  epigraph?: { quote: string; author: string };
  onStartSolo: () => void;
  onStartMultiplayer: () => void;
  onClose: () => void;
  isAuthenticated: boolean;
  isCreatingRoom?: boolean;
}

export function StoryStartModal({
  story,
  epigraph,
  onStartSolo,
  onStartMultiplayer,
  onClose,
  isAuthenticated,
  isCreatingRoom = false,
}: StoryStartModalProps) {
  const [audioEnabled, setAudioEnabled] = useAtom(audioEnabledAtom);

  if (!story) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      >
        {/* Modal content */}
        <div
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

          {/* Action Buttons */}
          <div className="flex flex-row gap-3">
            {/* Primary: Begin Alone */}
            <Button
              size="lg"
              onClick={onStartSolo}
              className="flex-1 font-serif text-base"
              disabled={isCreatingRoom}
            >
              Begin Alone
            </Button>

            {/* Secondary: Gather Travelers */}
            <Button
              size="lg"
              variant="outline"
              onClick={onStartMultiplayer}
              className="flex-1 font-serif text-base gap-2"
              disabled={!isAuthenticated || isCreatingRoom}
              title={!isAuthenticated ? "Sign in to host a gathering" : undefined}
            >
              {isCreatingRoom ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Creating...</span>
                </>
              ) : (
                <>
                  <Users className="w-4 h-4" />
                  <span>Gather Travelers</span>
                </>
              )}
            </Button>
          </div>

          {/* Sign in link for guests */}
          {!isAuthenticated && (
            <p className="text-xs text-muted-foreground/60 text-center mt-4">
              <Link href="/login" className="text-foreground hover:underline">
                Sign in
              </Link>
              {" "}to host a gathering or save your progress
            </p>
          )}
        </div>
      </div>
    </>
  );
}
