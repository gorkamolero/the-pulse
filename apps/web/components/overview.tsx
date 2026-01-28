"use client";

import { motion } from "framer-motion";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { CreateUIMessage, UIMessage } from "ai";
import { stories, type Story } from "@pulse/core/ai/stories";
import { Pulse } from "./ui/pulse";
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
  onSelectStory?: (storyId: string) => void;
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
      onSelectStory(selectedStory.id);
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
      <div className="flex-1 overflow-y-auto">
        <motion.div
          key="overview"
          className="min-h-full flex flex-col items-center px-4 py-16 md:py-24"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6 }}
        >
          {/* Header with Pulse */}
          <motion.div
            className="flex flex-col items-center gap-6 mb-16"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Pulse />
            <div className="text-center">
              <h1 className="text-3xl md:text-4xl font-serif font-light tracking-wide mb-2">
                The Pulse
              </h1>
              <p className="text-muted-foreground text-sm italic">
                Interactive Fiction
              </p>
            </div>
          </motion.div>

          {/* Story Cards - Vertical Stack */}
          <div className="flex flex-col gap-4 max-w-2xl w-full">
            {stories.map((story, index) => {
              const flavor = storyFlavor[story.id] || {
                quote: "A story awaits...",
                author: "Unknown",
              };

              const isComingSoon = story.comingSoon;

              return (
                <motion.button
                  key={story.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 * index + 0.4 }}
                  whileHover={isComingSoon ? {} : { x: 8 }}
                  whileTap={isComingSoon ? {} : { scale: 0.995 }}
                  onClick={() => !isComingSoon && handleStoryClick(story)}
                  disabled={isComingSoon}
                  className={`
                    group text-left p-6 md:p-8
                    border-l-2 transition-all duration-300
                    ${isComingSoon
                      ? "border-muted-foreground/10 opacity-50 cursor-not-allowed"
                      : "border-muted-foreground/20 hover:border-foreground/60 bg-transparent hover:bg-muted/30"
                    }
                  `}
                >
                  {/* Title */}
                  <h2 className={`text-xl md:text-2xl font-serif font-normal mb-3 transition-colors ${
                    isComingSoon ? "text-muted-foreground/60" : "group-hover:text-foreground"
                  }`}>
                    {story.title}
                  </h2>

                  {/* Description */}
                  <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
                    {story.description}
                  </p>

                  {/* Epigraph */}
                  <blockquote className="border-l border-muted-foreground/30 pl-4 py-1">
                    <p className="text-xs italic text-muted-foreground/70 mb-1">
                      "{flavor.quote}"
                    </p>
                    <cite className="text-xs text-muted-foreground/50 not-italic">
                      — {flavor.author}
                    </cite>
                  </blockquote>

                  {/* Begin / Coming Soon indicator */}
                  <div className={`mt-4 flex items-center gap-2 text-xs transition-colors ${
                    isComingSoon
                      ? "text-muted-foreground/40"
                      : "text-muted-foreground/50 group-hover:text-muted-foreground"
                  }`}>
                    <span className="w-4 h-px bg-current" />
                    <span>{isComingSoon ? "Coming Soon" : "Begin"}</span>
                  </div>
                </motion.button>
              );
            })}
          </div>

          {/* Footer */}
          <motion.div
            className="mt-16 text-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.2 }}
          >
            <p className="text-xs text-muted-foreground/40 tracking-wide uppercase">
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
          onStartMultiplayer={handleStartMultiplayer}
          onClose={handleCloseModal}
          isAuthenticated={isAuthenticated}
          isCreatingRoom={isCreatingRoom}
        />
      )}
    </>
  );
};
