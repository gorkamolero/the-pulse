'use client';

import type { User } from 'next-auth';
import Link from 'next/link';
import { Sparkles } from 'lucide-react';

import { SidebarHistory } from '@/components/sidebar-history';
import { SidebarUserNav } from '@/components/sidebar-user-nav';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  useSidebar,
} from '@/components/ui/sidebar';

export function AppSidebar({ user }: { user: User | undefined }) {
  const { setOpenMobile } = useSidebar();

  return (
    <Sidebar className="group-data-[side=left]:border-r-0">
      <SidebarHeader>
        <SidebarMenu>
          <div className="flex flex-row items-center">
            <Link
              className="flex flex-row items-center gap-3"
              href="/"
              onClick={() => {
                setOpenMobile(false);
              }}
            >
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 via-fuchsia-500 to-pink-500 flex items-center justify-center shadow-lg shadow-violet-500/20 flex-shrink-0">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <span className="cursor-pointer font-semibold text-lg">
                The Pulse
              </span>
            </Link>
          </div>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarHistory user={user} />
      </SidebarContent>
      <SidebarFooter>{user && <SidebarUserNav user={user} />}</SidebarFooter>
    </Sidebar>
  );
}
