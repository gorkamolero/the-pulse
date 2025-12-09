'use client';

import type { User } from 'next-auth';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Plus, Sparkles, ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';

import { SidebarHistory } from '@/components/sidebar-history';
import { SidebarUserNav } from '@/components/sidebar-user-nav';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';
import { cn } from '@/lib/utils';

export function AppSidebar({ user }: { user: User | undefined }) {
  const router = useRouter();
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        "relative flex flex-col border-r border-zinc-800/50 backdrop-blur-xl transition-all duration-300 ease-in-out",
        isCollapsed ? "w-16" : "w-64"
      )}
      style={{
        background: 'linear-gradient(180deg, rgba(9, 9, 11, 0.95) 0%, rgba(24, 24, 27, 0.90) 100%)',
      }}
    >
      {/* Collapse Toggle */}
      <button
        type="button"
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="absolute -right-3 top-6 z-10 w-6 h-6 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center hover:bg-zinc-700 transition-colors"
      >
        {isCollapsed ? (
          <ChevronRight className="w-3 h-3 text-zinc-400" />
        ) : (
          <ChevronLeft className="w-3 h-3 text-zinc-400" />
        )}
      </button>

      {/* Header */}
      <div className="border-b border-zinc-800/50 p-4">
        {!isCollapsed ? (
          <div className="flex flex-col gap-4">
            {/* Logo / Brand */}
            <Link
              href="/"
              className="flex items-center gap-3 group"
            >
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 via-fuchsia-500 to-pink-500 flex items-center justify-center shadow-lg shadow-violet-500/20 group-hover:shadow-violet-500/40 transition-shadow flex-shrink-0">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-lg font-bold text-white tracking-tight truncate">
                  The Pulse
                </span>
                <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-medium">
                  Interactive Stories
                </span>
              </div>
            </Link>

            {/* New Story Button */}
            <Button
              variant="outline"
              className="w-full justify-start gap-2 bg-zinc-900/50 border-zinc-800 hover:bg-zinc-800/50 hover:border-zinc-700 text-zinc-300 hover:text-white transition-all"
              onClick={() => {
                router.push('/');
                router.refresh();
              }}
            >
              <Plus className="w-4 h-4 flex-shrink-0" />
              <span className="font-medium truncate">New Story</span>
            </Button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4">
            <Link href="/" className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 via-fuchsia-500 to-pink-500 flex items-center justify-center shadow-lg shadow-violet-500/20 hover:shadow-violet-500/40 transition-shadow flex-shrink-0">
              <Sparkles className="w-4 h-4 text-white" />
            </Link>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="w-8 h-8 bg-zinc-900/50 border-zinc-800 hover:bg-zinc-800/50 hover:border-zinc-700 text-zinc-300 hover:text-white"
                  onClick={() => {
                    router.push('/');
                    router.refresh();
                  }}
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">New Story</TooltipContent>
            </Tooltip>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-2">
        {!isCollapsed && (
          <div className="flex flex-col gap-2 py-2">
            <div className="px-2 mb-2">
              <h3 className="text-xs uppercase tracking-wider text-zinc-500 font-semibold">
                Recent Sessions
              </h3>
            </div>
            <SidebarHistory user={user} />
          </div>
        )}
      </div>

      {/* Footer */}
      {user && (
        <div className="border-t border-zinc-800/50 mt-auto">
          <SidebarUserNav user={user} />
        </div>
      )}
    </aside>
  );
}
