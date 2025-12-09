'use client';

import type { User } from 'next-auth';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { History, Plus, Sparkles } from 'lucide-react';
import { useState } from 'react';

import { ModelSelector } from '@/components/model-selector';
import { StorySelector } from '@/components/story-selector';
import { SidebarHistory } from '@/components/sidebar-history';
import { SidebarUserNav } from '@/components/sidebar-user-nav';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import type { VisibilityType } from './visibility-selector';

export function ChatHeader({
  user,
  chatId,
  selectedModelId,
  selectedVisibilityType,
  isReadonly,
  selectedStoryId,
  onSelectStory,
}: {
  user?: User;
  chatId?: string;
  selectedModelId?: string;
  selectedVisibilityType?: VisibilityType;
  isReadonly?: boolean;
  selectedStoryId?: string;
  onSelectStory?: (storyId: string) => void;
}) {
  const router = useRouter();
  const [historyOpen, setHistoryOpen] = useState(false);

  return (
    <header className="flex items-center justify-between px-4 py-3 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      {/* Left: Logo */}
      <Link href="/" className="flex items-center gap-3 group">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 via-fuchsia-500 to-pink-500 flex items-center justify-center shadow-lg shadow-violet-500/20 group-hover:shadow-violet-500/40 transition-shadow">
          <Sparkles className="w-4 h-4 text-white" />
        </div>
        <span className="font-semibold text-lg hidden sm:block">The Pulse</span>
      </Link>

      {/* Center: Selectors */}
      {selectedModelId && selectedStoryId && onSelectStory && (
        <div className="flex items-center gap-2">
          <ModelSelector selectedModelId={selectedModelId} />
          <StorySelector
            selectedStoryId={selectedStoryId}
            onSelectStory={onSelectStory}
          />
        </div>
      )}

      {/* Right: Actions */}
      <div className="flex items-center gap-2">
        {/* New Chat Button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            router.push('/');
            router.refresh();
          }}
        >
          <Plus className="w-4 h-4 mr-2" />
          <span className="hidden sm:inline">New</span>
        </Button>

        {/* History Popover */}
        <Popover open={historyOpen} onOpenChange={setHistoryOpen}>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm">
              <History className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">History</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent
            className="w-80 p-0"
            align="end"
            sideOffset={8}
          >
            <div className="flex flex-col max-h-[60vh]">
              {/* Header */}
              <div className="px-4 py-3 border-b">
                <h3 className="font-semibold text-sm">Recent Sessions</h3>
              </div>

              {/* History List */}
              <div className="overflow-y-auto p-2">
                <SidebarHistory user={user} onClose={() => setHistoryOpen(false)} />
              </div>
            </div>
          </PopoverContent>
        </Popover>

        {/* User Menu */}
        {user && (
          <>
            <Separator orientation="vertical" className="h-6" />
            <SidebarUserNav user={user} />
          </>
        )}
      </div>
    </header>
  );
}
