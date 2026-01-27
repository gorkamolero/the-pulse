'use client';

import type { User } from 'next-auth';
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
}

export function ChatHeader({
  user,
  isGuest = false,
  pulseCount = 0,
  maxPulses = 5,
}: ChatHeaderProps) {
  const [historyOpen, setHistoryOpen] = useState(false);

  return (
    <header className="flex items-center justify-between px-3 py-1.5 border-b border-border/50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      {/* Left: Logo + Guest Badge */}
      <div className="flex items-center gap-3">
        <Link href="/" className="flex items-center group">
          <span className="font-semibold text-sm tracking-tight">The Pulse</span>
        </Link>
        {isGuest && (
          <span className="text-xs text-muted-foreground px-2 py-0.5 bg-muted/50 rounded">
            Guest
          </span>
        )}
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-1">
        {/* Pulse counter for guests */}
        {isGuest && (
          <div className="text-xs text-muted-foreground mr-2">
            <span className="font-medium text-foreground">{pulseCount}</span>
            <span className="mx-0.5">/</span>
            <span>{maxPulses}</span>
            <span className="ml-1 hidden sm:inline">pulses</span>
          </div>
        )}

        {/* History Popover - only for authenticated users */}
        {user && (
          <Popover open={historyOpen} onOpenChange={setHistoryOpen}>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs">
                <History className="w-3.5 h-3.5 mr-1.5" />
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
        )}

        {/* User Menu for authenticated users */}
        {user && (
          <>
            <Separator orientation="vertical" className="h-4" />
            <SidebarUserNav user={user} />
          </>
        )}

        {/* Sign in link for guests */}
        {isGuest && (
          <Link
            href="/register"
            className="text-xs text-primary hover:underline ml-2"
          >
            Create Account
          </Link>
        )}
      </div>
    </header>
  );
}
