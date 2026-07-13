'use client';

import type { User } from 'next-auth';
import type React from 'react';
import Link from 'next/link';
import { History } from 'lucide-react';
import { useState } from 'react';

import { SidebarHistory } from '@/components/sidebar-history';
import { SidebarUserNav } from '@/components/sidebar-user-nav';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';

interface ChatHeaderProps {
  user?: User;
  isGuest?: boolean;
  pulseCount?: number;
  maxPulses?: number;
  storyTitle?: string;
  shareSlot?: React.ReactNode;
}

export function ChatHeader({
  user,
  isGuest = false,
  pulseCount = 0,
  maxPulses = 5,
  storyTitle,
  shareSlot,
}: ChatHeaderProps) {
  const [historyOpen, setHistoryOpen] = useState(false);

  return (
    <header className="flex items-center justify-between px-3 py-1.5 border-b border-border/50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      {/* Left: Logo + Story Title */}
      <div className="flex items-center gap-2">
        <Link href="/" className="flex items-center group">
          <span className="font-literary uppercase tracking-[0.25em] text-xs text-foreground/90 group-hover:text-foreground transition-colors">
            The Pulse
          </span>
        </Link>
        {storyTitle && (
          <>
            <span className="text-muted-foreground/40">—</span>
            <span className="text-sm text-muted-foreground font-literary italic truncate max-w-[120px] sm:max-w-[200px]">
              {storyTitle}
            </span>
          </>
        )}
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-1">
        {/* Pulse counter for guests */}
        {isGuest && (
          <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground mr-2">
            <span className="text-foreground">{pulseCount}</span>
            <span className="mx-0.5">/</span>
            <span>{maxPulses}</span>
            <span className="ml-1 hidden sm:inline">pulses</span>
          </div>
        )}

        {/* Share slot — rendered when in active session */}
        {shareSlot}

        {/* History Popover - only for authenticated users */}
        {user && (
          <Popover open={historyOpen} onOpenChange={setHistoryOpen}>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                <History className="w-3.5 h-3.5" />
                <span className="sr-only">History</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent
              className="w-[min(320px,calc(100vw-1rem))] p-0 z-50"
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
                  <SidebarHistory
                    user={user}
                    onClose={() => setHistoryOpen(false)}
                  />
                </div>
              </div>
            </PopoverContent>
          </Popover>
        )}

        {/* User Menu for authenticated users */}
        {user && (
          <>
            <Separator orientation="vertical" className="h-4" />
            <SidebarUserNav user={user} />
          </>
        )}

        {/* Auth links for guests */}
        {isGuest && (
          <div className="ml-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.15em]">
            <Link
              href="/login"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Sign in
            </Link>
            <span className="text-muted-foreground/40">/</span>
            <Link
              href="/register"
              className="text-foreground/80 hover:text-foreground transition-colors"
            >
              Create account
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}
