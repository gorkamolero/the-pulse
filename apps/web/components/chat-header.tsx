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

export function ChatHeader({
  user,
}: {
  user?: User;
}) {
  const [historyOpen, setHistoryOpen] = useState(false);

  return (
    <header className="flex items-center justify-between px-4 py-3 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      {/* Left: Logo */}
      <Link href="/" className="flex items-center gap-2 group">
        <span className="font-bold text-xl tracking-tight">The Pulse</span>
      </Link>

      {/* Right: Actions */}
      <div className="flex items-center gap-2">
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
