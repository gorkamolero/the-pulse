import { LandingPage } from '@/components/landing-page';

export const metadata = {
  title: 'The Pulse — No Prep. No DM. Just Play.',
  description:
    'An AI narrator runs the story in real-time. You make the choices. The story adapts. Solo or with friends — 5 story worlds, voice narration, no signup required.',
  openGraph: {
    title: 'The Pulse — No Prep. No DM. Just Play.',
    description:
      'An AI narrator runs the story in real-time. You make the choices. Solo or with friends. No signup required.',
  },
  twitter: {
    title: 'The Pulse — No Prep. No DM. Just Play.',
    description:
      'An AI narrator runs the story in real-time. You make the choices. Solo or with friends. No signup required.',
  },
};

export default function HomePage() {
  return <LandingPage />;
}
