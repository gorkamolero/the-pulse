import { auth } from '@/app/(auth)/auth';
import { redirect } from 'next/navigation';
import { LandingPage } from '@/components/landing-page';

export const metadata = {
  title: 'The Pulse - AI-Powered Interactive Fiction',
  description:
    'Immersive narrative fiction with AI narration, imagery, and choices that matter. Experience stories that breathe.',
};

export default async function HomePage() {
  const session = await auth();

  // Redirect authenticated users to their chat
  if (session?.user) {
    redirect('/chat');
  }

  return <LandingPage />;
}
