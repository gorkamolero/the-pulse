'use client';

import { motion } from 'framer-motion';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import type { CreateUIMessage, UIMessage } from 'ai';
import { stories, type Story } from '@pulse/core/ai/stories';
import { StoryStartModal } from './story-start-modal';
import { STORY_META, StoryDoor } from './story-index';
import type { User } from 'next-auth';

type Attachment = {
  url: string;
  name?: string;
  contentType?: string;
};

type ChatRequestOptions = {
  experimental_attachments?: Attachment[];
  body?: Record<string, unknown>;
};

interface OverviewProps {
  chatId: string;
  append: (
    message: UIMessage | CreateUIMessage<UIMessage>,
    chatRequestOptions?: ChatRequestOptions,
  ) => Promise<string | null | undefined>;
  onSelectStory?: (storyId: string, solo: boolean) => void;
  user?: User;
}

export const Overview = ({
  chatId,
  append,
  onSelectStory,
  user,
}: OverviewProps) => {
  const router = useRouter();
  const [selectedStory, setSelectedStory] = useState<Story | null>(null);
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);

  const isAuthenticated = !!user?.id;

  const indexItems = stories.map((s) => ({
    id: s.id,
    title: s.title,
    description: s.description,
    accentHex: s.theme?.accentHex || '#888888',
    comingSoon: s.comingSoon,
  }));

  const handleSelect = (storyId: string) => {
    const story = stories.find((s) => s.id === storyId);
    if (story && !story.comingSoon) setSelectedStory(story);
  };

  const handleStartSolo = () => {
    if (!selectedStory) return;

    window.history.replaceState({}, '', `/pulse/${chatId}`);

    if (onSelectStory) {
      onSelectStory(selectedStory.id, true); // solo=true
    }

    append(
      {
        role: 'user',
        parts: [
          {
            type: 'text',
            text: `Let's start the story "${selectedStory.title}".`,
          },
        ],
      },
      {
        body: { selectedStoryId: selectedStory.id, solo: true },
      },
    );

    setSelectedStory(null);
  };

  const handleStartGroup = () => {
    if (!selectedStory) return;

    window.history.replaceState({}, '', `/pulse/${chatId}`);

    if (onSelectStory) {
      onSelectStory(selectedStory.id, false); // solo=false (group mode)
    }

    append(
      {
        role: 'user',
        parts: [
          {
            type: 'text',
            text: `Let's start the group session for "${selectedStory.title}". Ask for the number of players and each player's name before beginning the story.`,
          },
        ],
      },
      {
        body: { selectedStoryId: selectedStory.id, solo: false },
      },
    );

    setSelectedStory(null);
  };

  const handleStartMultiplayer = async () => {
    if (!selectedStory) return;
    if (!isAuthenticated) {
      toast.error('Sign in to host a gathering');
      return;
    }

    setIsCreatingRoom(true);

    try {
      const response = await fetch('/api/room', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storyId: selectedStory.id,
          displayName: user?.email || 'Host',
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        toast.error(data.error || 'Failed to create gathering');
        return;
      }

      const { room } = await response.json();
      router.push(`/room/${room.id}/lobby`);
    } catch (error) {
      console.error('Failed to create room:', error);
      toast.error('Failed to create gathering');
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
      <div className="flex-1 min-h-0 flex flex-col overflow-y-auto md:overflow-hidden">
        {/* Masthead */}
        <motion.header
          className="shrink-0 flex flex-col items-center text-center pt-6 pb-5 px-6"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        >
          <h1 className="font-literary uppercase tracking-[0.35em] pl-[0.35em] text-xl md:text-2xl text-white/95">
            The Pulse
          </h1>
          <p className="mt-2 font-mono text-[9px] uppercase tracking-[0.35em] pl-[0.35em] text-white/30">
            An anthology of living stories · Choose a door
          </p>
        </motion.header>

        {/* The shelf of doors */}
        <motion.div
          className="flex-1 min-h-0 px-3 pb-3 md:px-5 md:pb-5"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.25, duration: 1, ease: 'easeOut' }}
        >
          <div className="h-full flex flex-col md:flex-row gap-2 md:gap-2.5">
            {indexItems.map((story, index) => (
              <StoryDoor
                key={story.id}
                story={story}
                index={index}
                onSelect={handleSelect}
              />
            ))}
          </div>
        </motion.div>
      </div>

      {/* Story Start Modal */}
      {selectedStory && (
        <StoryStartModal
          story={selectedStory}
          epigraph={STORY_META[selectedStory.id]?.epigraph}
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
