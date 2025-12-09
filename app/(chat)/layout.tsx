
import Script from 'next/script';

import { AppSidebar } from '@/components/app-sidebar';
import { auth } from '../(auth)/auth';

export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  return (
    <>
      <Script
        src="https://cdn.jsdelivr.net/pyodide/v0.23.4/full/pyodide.js"
        strategy="beforeInteractive"
      />
      <div className="flex h-screen w-screen overflow-hidden bg-zinc-950">
        {/* Sidebar - fixed width, takes up space in flex */}
        <AppSidebar user={session?.user} />

        {/* Main content - flex-1 takes remaining space */}
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {children}
        </main>
      </div>
    </>
  );
}
