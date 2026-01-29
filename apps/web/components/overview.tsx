"use client";

import { motion } from "framer-motion";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { CreateUIMessage, UIMessage } from "ai";
import { stories, type Story } from "@pulse/core/ai/stories";
import { Pulse } from "./ui/pulse";
import { FogLayer, Vignette } from "./ui/fog-layer";
import { StoryStartModal } from "./story-start-modal";
import type { User } from "next-auth";

type Attachment = {
  url: string;
  name?: string;
  contentType?: string;
};

type ChatRequestOptions = {
  experimental_attachments?: Attachment[];
};

interface OverviewProps {
  chatId: string;
  append: (
    message: UIMessage | CreateUIMessage<UIMessage>,
    chatRequestOptions?: ChatRequestOptions
  ) => Promise<string | null | undefined>;
  onSelectStory?: (storyId: string, solo: boolean) => void;
  user?: User;
}

// Literary flavor for each story
const storyFlavor: Record<
  string,
  {
    quote: string;
    author: string;
  }
> = {
  "shadow-over-innsmouth": {
    quote: "The oldest and strongest emotion of mankind is fear, and the oldest and strongest kind of fear is fear of the unknown.",
    author: "H.P. Lovecraft",
  },
  "the-hollow-choir": {
    quote: "In the drowned city, even silence learns to sing.",
    author: "Anonymous",
  },
  "whispering-pines": {
    quote: "The cabin remembers what you've forgotten.",
    author: "Local Warning",
  },
  "siren-of-the-red-dust": {
    quote: "Mars keeps its secrets beneath the rust.",
    author: "Colony Proverb",
  },
  "endless-path": {
    quote: "Every step forward is a step into the unknown.",
    author: "The Wanderer",
  },
};

export const Overview = ({ chatId, append, onSelectStory, user }: OverviewProps) => {
  const router = useRouter();
  const [selectedStory, setSelectedStory] = useState<Story | null>(null);
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);

  const isAuthenticated = !!user?.id;

  const handleStoryClick = (story: Story) => {
    setSelectedStory(story);
  };

  const handleStartSolo = () => {
    if (!selectedStory) return;

    window.history.replaceState({}, "", `/pulse/${chatId}`);

    if (onSelectStory) {
      onSelectStory(selectedStory.id, true); // solo=true
    }

    append({
      role: "user",
      parts: [{ type: "text", text: `Let's start the story "${selectedStory.title}".` }],
    });

    setSelectedStory(null);
  };

  const handleStartGroup = () => {
    if (!selectedStory) return;

    window.history.replaceState({}, "", `/pulse/${chatId}`);

    if (onSelectStory) {
      onSelectStory(selectedStory.id, false); // solo=false (group mode)
    }

    append({
      role: "user",
      parts: [{ type: "text", text: `Let's start the story "${selectedStory.title}".` }],
    });

    setSelectedStory(null);
  };

  const handleStartMultiplayer = async () => {
    if (!selectedStory) return;
    if (!isAuthenticated) {
      toast.error("Sign in to host a gathering");
      return;
    }

    setIsCreatingRoom(true);

    try {
      const response = await fetch("/api/room", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storyId: selectedStory.id,
          displayName: user?.email || "Host",
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        toast.error(data.error || "Failed to create gathering");
        return;
      }

      const { room } = await response.json();
      router.push(`/room/${room.id}/lobby`);
    } catch (error) {
      console.error("Failed to create room:", error);
      toast.error("Failed to create gathering");
    } finally {
      setIsCreatingRoom(false);
    }
  };

  const handleCloseModal = () => {
    if (!isCreatingRoom) {
      setSelectedStory(null);
    }
  };

  return (
    <>
      {/* Atmospheric layers */}
      <FogLayer opacity={0.12} speed={0.7} />
      <Vignette intensity={0.7} />

      {/* Textured background */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
          opacity: 0.03,
          zIndex: 0,
        }}
      />

      <div className="flex-1 overflow-y-auto relative" style={{ zIndex: 10 }}>
        <motion.div
          key="overview"
          className="min-h-full flex flex-col items-center px-4 py-16 md:py-24"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8 }}
        >
          {/* Header with Pulse */}
          <motion.div
            className="flex flex-col items-center gap-8 mb-20"
            initial={{ opacity: 0, y: -30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.6 }}
          >
            <Pulse size="lg" />
            <div className="text-center">
              <h1 className="text-4xl md:text-5xl font-literary font-semibold tracking-[0.2em] uppercase mb-3 text-foreground/90">
                The Pulse
              </h1>
              <p className="text-muted-foreground/60 text-sm font-literary italic tracking-wide">
                Interactive Fiction
              </p>
            </div>
          </motion.div>

          {/* Story Cards - Vertical Stack with Bold Borders */}
          <div className="flex flex-col gap-5 max-w-2xl w-full">
            {stories.map((story, index) => {
              const flavor = storyFlavor[story.id] || {
                quote: "A story awaits...",
                author: "Unknown",
              };

              const isComingSoon = story.comingSoon;
              const accentColor = story.theme?.accentHex || "#888888";

              return (
                <motion.button
                  key={story.id}
                  initial={{ opacity: 0, x: -30 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.15 * index + 0.5 }}
                  whileHover={isComingSoon ? {} : { x: 6, transition: { duration: 0.2 } }}
                  whileTap={isComingSoon ? {} : { scale: 0.995 }}
                  onClick={() => !isComingSoon && handleStoryClick(story)}
                  disabled={isComingSoon}
                  className={`
                    group text-left p-6 md:p-8
                    transition-all duration-300
                    backdrop-blur-sm rounded-r-lg
                    ${isComingSoon
                      ? "opacity-40 cursor-not-allowed bg-black/20"
                      : "bg-black/40 hover:bg-black/50"
                    }
                  `}
                  style={{
                    borderLeft: `5px solid ${isComingSoon ? "rgba(136, 136, 136, 0.3)" : accentColor}`,
                    boxShadow: isComingSoon
                      ? "none"
                      : `inset 0 0 30px rgba(0,0,0,0.3), 0 0 20px rgba(0,0,0,0.2)`,
                  }}
                  type="button"
                >
                  {/* Title */}
                  <h2
                    className={`text-xl md:text-2xl font-literary font-semibold mb-3 transition-colors tracking-wide ${
                      isComingSoon ? "text-muted-foreground/40" : "text-foreground/90 group-hover:text-foreground"
                    }`}
                  >
                    {story.title}
                  </h2>

                  {/* Description */}
                  <p className={`text-sm leading-relaxed mb-4 ${
                    isComingSoon ? "text-muted-foreground/30" : "text-muted-foreground/70"
                  }`}>
                    {story.description}
                  </p>

                  {/* Epigraph */}
                  <blockquote
                    className={`border-l-2 pl-4 py-1 ${
                      isComingSoon ? "border-muted-foreground/10" : "border-muted-foreground/20"
                    }`}
                  >
                    <p className={`text-xs font-literary italic mb-1 ${
                      isComingSoon ? "text-muted-foreground/20" : "text-muted-foreground/50"
                    }`}>
                      "{flavor.quote}"
                    </p>
                    <cite className={`text-xs not-italic ${
                      isComingSoon ? "text-muted-foreground/15" : "text-muted-foreground/40"
                    }`}>
                      — {flavor.author}
                    </cite>
                  </blockquote>

                  {/* Begin / Coming Soon indicator */}
                  <div
                    className={`mt-5 flex items-center gap-3 text-xs uppercase tracking-widest transition-all ${
                      isComingSoon
                        ? "text-muted-foreground/20"
                        : "text-muted-foreground/40 group-hover:text-muted-foreground/70"
                    }`}
                  >
                    <span
                      className="w-6 h-px transition-all"
                      style={{
                        backgroundColor: isComingSoon ? "currentColor" : accentColor,
                        opacity: isComingSoon ? 0.3 : 0.6,
                      }}
                    />
                    <span className="font-literary">{isComingSoon ? "Coming Soon" : "Begin"}</span>
                  </div>
                </motion.button>
              );
            })}
          </div>

          {/* Footer */}
          <motion.div
            className="mt-20 text-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.4 }}
          >
            <p className="text-xs text-muted-foreground/30 tracking-[0.15em] uppercase font-literary">
              ~30 min · AI imagery · Your choices shape the narrative
            </p>
          </motion.div>
        </motion.div>
      </div>

      {/* Story Start Modal */}
      {selectedStory && (
        <StoryStartModal
          story={selectedStory}
          epigraph={storyFlavor[selectedStory.id]}
          onStartSolo={handleStartSolo}
          onStartGroup={handleStartGroup}
          onStartMultiplayer={handleStartMultiplayer}
          onClose={handleCloseModal}
          isAuthenticated={isAuthenticated}
          isCreatingRoom={isCreatingRoom}
        />
      )}
    </>
  );
};
