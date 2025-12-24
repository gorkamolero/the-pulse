'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useGuestSession } from '@/hooks/use-guest-session';
import { GuestChat } from '@/components/guest-chat';

export default function GuestPage() {
  const router = useRouter();
  const { session, isExpired, clearSession, initSession } = useGuestSession();

  useEffect(() => {
    // If no session or expired, redirect to homepage to start fresh
    if (!session) {
      // Initialize a new session if coming directly to /guest
      initSession(true);
    } else if (isExpired()) {
      clearSession();
      router.push('/');
    }
  }, [session, isExpired, clearSession, router, initSession]);

  // Show loading while checking session
  if (!session) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-background">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return <GuestChat />;
}
