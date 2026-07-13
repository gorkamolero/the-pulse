import type { Metadata } from 'next';
import { Crimson_Text } from 'next/font/google';
import { Toaster } from 'sonner';

import { ThemeProvider } from '@/components/theme-provider';
import { storyFontVariables } from '@/lib/story-fonts';

import './globals.css';

const crimsonText = Crimson_Text({
  subsets: ['latin'],
  weight: ['400', '600', '700'],
  variable: '--font-serif',
  display: 'swap',
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://the-pulse.games';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'The Pulse — AI-Powered Interactive Fiction',
    template: '%s | The Pulse',
  },
  description:
    'No prep. No DM. Just play. An AI narrator runs the story in real-time — you make the choices, the story adapts. Solo or with friends. 5 story worlds.',
  keywords: [
    'interactive fiction',
    'AI storytelling',
    'multiplayer',
    'tabletop RPG',
    'D&D',
    'AI narrator',
    'collaborative fiction',
  ],
  openGraph: {
    type: 'website',
    siteName: 'The Pulse',
    title: 'The Pulse — AI-Powered Interactive Fiction',
    description:
      'No prep. No DM. Just play. An AI narrator runs the story in real-time — you make the choices, the story adapts. Solo or with friends.',
    url: SITE_URL,
    images: [
      {
        url: '/images/pulse.jpg',
        width: 1024,
        height: 768,
        alt: 'The Pulse — AI-Powered Interactive Fiction',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'The Pulse — AI-Powered Interactive Fiction',
    description:
      'No prep. No DM. Just play. An AI narrator runs the story — you make the choices.',
    images: ['/images/pulse.jpg'],
  },
  other: {
    'permissions-policy': 'microphone=self',
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1, // Disable auto-zoom on mobile Safari
};

// Dark mode only - no light theme
const DARK_THEME_COLOR = 'hsl(240deg 10% 3.92%)';
const THEME_COLOR_SCRIPT = `\
(function() {
  var meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.setAttribute('name', 'theme-color');
    document.head.appendChild(meta);
  }
  meta.setAttribute('content', '${DARK_THEME_COLOR}');
})();`;

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      // `next-themes` injects an extra classname to the body element to avoid
      // visual flicker before hydration. Hence the `suppressHydrationWarning`
      // prop is necessary to avoid the React hydration mismatch warning.
      // https://github.com/pacocoursey/next-themes?tab=readme-ov-file#with-app
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: THEME_COLOR_SCRIPT,
          }}
        />
        <meta httpEquiv="permissions-policy" content="microphone=self" />
      </head>
      <body
        className={`antialiased ${crimsonText.variable} ${storyFontVariables}`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          forcedTheme="dark"
          disableTransitionOnChange
        >
          <Toaster position="top-center" />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
