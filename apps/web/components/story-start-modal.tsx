"use client";

import { Link2, Loader2, UserRound, Users, Volume2, VolumeX } from "lucide-react";
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
            <div className="space-y-3">
              <div className="text-center">
                <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground/50">
                  Choose play mode
                </p>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Button
                  size="lg"
                  onClick={onStartSolo}
                  className="group h-auto min-h-20 items-center justify-start gap-3 whitespace-normal rounded-lg px-5 py-4 text-left font-literary tracking-wide shadow-[0_1px_0_rgba(255,255,255,0.16)_inset,0_14px_36px_rgba(0,0,0,0.22)] transition-[transform,box-shadow,background-color] duration-200 active:scale-[0.96]"
                  style={{
                    backgroundColor: accentColor,
                    borderColor: accentColor,
                  }}
                  disabled={isCreatingRoom}
                >
                  <UserRound className="w-4 h-4 shrink-0 transition-transform duration-200 group-hover:scale-110" />
                  <span className="flex min-w-0 flex-1 flex-col leading-tight">
                    <span className="text-lg">Solo</span>
                    <span className="mt-1 max-w-full text-xs font-sans font-normal leading-relaxed opacity-75">
                      Play by yourself
                    </span>
                  </span>
                </Button>

                <Button
                  size="lg"
                  variant="outline"
                  onClick={onStartGroup}
                  className="group h-auto min-h-20 items-center justify-start gap-3 whitespace-normal rounded-lg border bg-background/70 px-5 py-4 text-left font-literary tracking-wide shadow-[0_1px_0_rgba(255,255,255,0.08)_inset,0_12px_30px_rgba(0,0,0,0.18)] transition-[transform,box-shadow,background-color,border-color] duration-200 hover:bg-background active:scale-[0.96]"
                  style={{
                    borderColor: `${accentColor}60`,
                  }}
                  disabled={isCreatingRoom}
                  title="One browser session for friends playing together in person or over voice chat"
                >
                  <Users className="w-4 h-4 shrink-0 transition-transform duration-200 group-hover:scale-110" />
                  <span className="flex min-w-0 flex-1 flex-col leading-tight">
                    <span className="text-lg">Same Screen</span>
                    <span className="mt-1 max-w-full text-xs font-sans font-normal leading-relaxed opacity-75">
                      Pass the device around
                    </span>
                  </span>
                </Button>
              </div>

              <div>
                <Button
                  size="lg"
                  variant="outline"
                  onClick={onStartMultiplayer}
                  className="group h-auto min-h-14 w-full items-center justify-center gap-3 whitespace-normal rounded-lg border bg-background/45 px-5 py-3 text-center font-literary tracking-wide shadow-[0_1px_0_rgba(255,255,255,0.08)_inset,0_12px_30px_rgba(0,0,0,0.18)] transition-[transform,box-shadow,background-color,border-color,opacity] duration-200 hover:bg-background active:scale-[0.96] disabled:cursor-not-allowed"
                  style={{
                    borderColor: isAuthenticated
                      ? `${accentColor}60`
                      : "hsl(var(--border) / 0.5)",
                  }}
                  disabled={!isAuthenticated || isCreatingRoom}
                  title={
                    !isAuthenticated
                      ? "Sign in to create an invite room"
                      : "Create a room with an invite link for others to join from their own devices"
                  }
                >
                  {isCreatingRoom ? (
                    <>
                      <Loader2 className="w-4 h-4 shrink-0 animate-spin" />
                      <span className="min-w-0 leading-tight">
                        Creating invite room...
                      </span>
                    </>
                  ) : (
                    <>
                      <Link2 className="w-4 h-4 shrink-0 transition-transform duration-200 group-hover:scale-110" />
                      <span className="min-w-0 leading-tight">
                        Invite Room
                        <span className="font-sans text-xs font-normal text-muted-foreground">
                          {" "}
                          · friends join by link
                        </span>
                      </span>
                    </>
                  )}
                </Button>
              </div>
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
