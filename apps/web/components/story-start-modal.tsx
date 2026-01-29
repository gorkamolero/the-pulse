"use client";

import { Volume2, VolumeX, Users, UserRound, Loader2 } from "lucide-react";
import { useAtom } from "jotai";
import Link from "next/link";
import { audioEnabledAtom } from "@/lib/atoms";
import { Button } from "./ui/button";
import type { Story } from "@pulse/core/ai/stories";

interface StoryStartModalProps {
  story: Story | null;
  epigraph?: { quote: string; author: string };
  onStartSolo: () => void;
  onStartGroup: () => void;
  onStartMultiplayer: () => void;
  onClose: () => void;
  isAuthenticated: boolean;
  isCreatingRoom?: boolean;
}

export function StoryStartModal({
  story,
  epigraph,
  onStartSolo,
  onStartGroup,
  onStartMultiplayer,
  onClose,
  isAuthenticated,
  isCreatingRoom = false,
}: StoryStartModalProps) {
  const [audioEnabled, setAudioEnabled] = useAtom(audioEnabledAtom);

  if (!story) return null;

  const accentColor = story.theme?.accentHex || "#888888";

  return (
    <>
      {/* Backdrop */}
      <div
        role="button"
        tabIndex={0}
        aria-label="Close modal"
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md"
        onClick={onClose}
        onKeyDown={(e) => e.key === "Escape" && onClose()}
      >
        {/* Modal content */}
        <div
          role="dialog"
          aria-modal="true"
          className="max-w-lg w-full mx-4 p-8 md:p-10 bg-background/95 rounded-lg shadow-2xl relative overflow-hidden"
          style={{
            borderLeft: `4px solid ${accentColor}`,
            boxShadow: `0 0 60px rgba(0,0,0,0.5), inset 0 0 40px rgba(0,0,0,0.2), 0 0 30px ${accentColor}20`,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Vignette inside modal */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: `radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.3) 100%)`,
            }}
          />

          {/* Content */}
          <div className="relative z-10">
            {/* Title */}
            <h2 className="text-2xl md:text-3xl font-literary font-semibold text-center mb-8 tracking-wide">
              {story.title}
            </h2>

            {/* Epigraph */}
            {epigraph && (
              <blockquote
                className="pl-5 mb-8"
                style={{ borderLeft: `3px solid ${accentColor}60` }}
              >
                <p className="text-base font-literary italic text-muted-foreground/80 mb-2 leading-relaxed">
                  "{epigraph.quote}"
                </p>
                <cite className="text-sm text-muted-foreground/60 not-italic">
                  — {epigraph.author}
                </cite>
              </blockquote>
            )}

            {/* Description */}
            <p className="text-sm text-muted-foreground/70 text-center mb-8 leading-relaxed">
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
                style={{
                  borderColor: audioEnabled ? accentColor : undefined,
                  borderWidth: audioEnabled ? "1px" : undefined,
                }}
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
            <p className="text-xs text-muted-foreground/40 text-center mb-6 tracking-wide">
              ~30 minutes · Your choices shape the narrative
            </p>

            {/* Action Buttons */}
            <div className="flex flex-col gap-3">
              {/* Row 1: Solo options */}
              <div className="flex flex-row gap-3">
                {/* Begin Alone (narrator treats as single traveler) */}
                <Button
                  size="lg"
                  onClick={onStartSolo}
                  className="flex-1 font-literary text-base gap-2 tracking-wide"
                  style={{
                    backgroundColor: accentColor,
                    borderColor: accentColor,
                  }}
                  disabled={isCreatingRoom}
                >
                  <UserRound className="w-4 h-4" />
                  <span>Begin Alone</span>
                </Button>

                {/* Begin with Group (narrator treats as multiple travelers, for Discord etc) */}
                <Button
                  size="lg"
                  variant="outline"
                  onClick={onStartGroup}
                  className="flex-1 font-literary text-base gap-2 tracking-wide"
                  style={{
                    borderColor: `${accentColor}60`,
                  }}
                  disabled={isCreatingRoom}
                  title="Play with friends on Discord or voice chat"
                >
                  <Users className="w-4 h-4" />
                  <span>With Group</span>
                </Button>
              </div>

              {/* Row 2: Multiplayer room (requires auth) */}
              <Button
                size="lg"
                variant="ghost"
                onClick={onStartMultiplayer}
                className="w-full font-literary text-sm gap-2 tracking-wide text-muted-foreground/70 hover:text-foreground"
                disabled={!isAuthenticated || isCreatingRoom}
                title={!isAuthenticated ? "Sign in to host a gathering" : "Create a room for others to join"}
              >
                {isCreatingRoom ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Creating room...</span>
                  </>
                ) : (
                  <>
                    <span>Or create a shared room</span>
                  </>
                )}
              </Button>
            </div>

            {/* Sign in link for guests */}
            {!isAuthenticated && (
              <p className="text-xs text-muted-foreground/50 text-center mt-5">
                <Link href="/login" className="text-foreground/70 hover:text-foreground hover:underline transition-colors">
                  Sign in
                </Link>
                {" "}to host a gathering or save your progress
              </p>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
