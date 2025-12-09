'use client';

import type { User } from 'next-auth';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Plus, Sparkles } from 'lucide-react';

import { SidebarHistory } from '@/components/sidebar-history';
import { SidebarUserNav } from '@/components/sidebar-user-nav';
import { Button } from '@/components/ui/button';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  useSidebar,
} from '@/components/ui/sidebar';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';

export function AppSidebar({ user }: { user: User | undefined }) {
  const router = useRouter();
  const { setOpenMobile } = useSidebar();

  return (
    <Sidebar
      className="border-r border-zinc-800/50 backdrop-blur-xl"
      style={{
        background: 'linear-gradient(180deg, rgba(9, 9, 11, 0.95) 0%, rgba(24, 24, 27, 0.90) 100%)',
      }}
    >
      <SidebarHeader className="border-b border-zinc-800/50 pb-4">
        <SidebarMenu>
          <div className="flex flex-col gap-4 px-2">
            {/* Logo / Brand */}
            <Link
              href="/"
              onClick={() => setOpenMobile(false)}
              className="flex items-center gap-3 group"
            >
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 via-fuchsia-500 to-pink-500 flex items-center justify-center shadow-lg shadow-violet-500/20 group-hover:shadow-violet-500/40 transition-shadow">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <div className="flex flex-col">
                <span className="text-lg font-bold text-white tracking-tight">
                  The Pulse
                </span>
                <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-medium">
                  Interactive Stories
                </span>
              </div>
            </Link>

            {/* New Story Button */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-start gap-2 bg-zinc-900/50 border-zinc-800 hover:bg-zinc-800/50 hover:border-zinc-700 text-zinc-300 hover:text-white transition-all"
                  onClick={() => {
                    setOpenMobile(false);
                    router.push('/');
                    router.refresh();
                  }}
                >
                  <Plus className="w-4 h-4" />
                  <span className="font-medium">New Story</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Start a new interactive story</TooltipContent>
            </Tooltip>
          </div>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent className="px-2">
        <div className="flex flex-col gap-2 py-4">
          <div className="px-2 mb-2">
            <h3 className="text-xs uppercase tracking-wider text-zinc-500 font-semibold">
              Recent Sessions
            </h3>
          </div>
          <SidebarHistory user={user} />
        </div>
      </SidebarContent>

      {user && (
        <SidebarFooter className="border-t border-zinc-800/50 mt-auto">
          <SidebarUserNav user={user} />
        </SidebarFooter>
      )}
    </Sidebar>
  );
}
