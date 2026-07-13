import {
  Cormorant_Garamond,
  EB_Garamond,
  Libre_Baskerville,
  Lora,
  Source_Serif_4,
} from 'next/font/google';

/**
 * Each story's typeface (declared in its theme in @pulse/core stories),
 * baked in via next/font so doors and title pages render in the story's
 * own script — self-hosted, subsetted, no runtime Google request.
 * Gameplay keeps its lazy loader (lib/font-loader.ts) for narration text.
 */

const ebGaramond = EB_Garamond({
  subsets: ['latin'],
  weight: ['400', '600'],
  variable: '--font-story-innsmouth',
  display: 'swap',
});

const lora = Lora({
  subsets: ['latin'],
  weight: ['400', '600'],
  variable: '--font-story-hollow-choir',
  display: 'swap',
});

const libreBaskerville = Libre_Baskerville({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-story-whispering-pines',
  display: 'swap',
});

const sourceSerif = Source_Serif_4({
  subsets: ['latin'],
  weight: ['400', '600'],
  variable: '--font-story-red-dust',
  display: 'swap',
});

const cormorantGaramond = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['500', '700'],
  variable: '--font-story-endless-path',
  display: 'swap',
});

/** Attach to <body> so the variables exist everywhere. */
export const storyFontVariables = [
  ebGaramond,
  lora,
  libreBaskerville,
  sourceSerif,
  cormorantGaramond,
]
  .map((f) => f.variable)
  .join(' ');

const STORY_TYPE: Record<string, { family: string; weight: number }> = {
  'shadow-over-innsmouth': {
    family: 'var(--font-story-innsmouth)',
    weight: 400,
  },
  'the-hollow-choir': {
    family: 'var(--font-story-hollow-choir)',
    weight: 400,
  },
  'whispering-pines': {
    family: 'var(--font-story-whispering-pines)',
    weight: 400,
  },
  'siren-of-the-red-dust': {
    family: 'var(--font-story-red-dust)',
    weight: 400,
  },
  // Cormorant runs light — needs the heavier cut to hold its own
  'endless-path': { family: 'var(--font-story-endless-path)', weight: 700 },
};

/** Inline style for a title set in the story's own script. */
export function storyTitleStyle(id: string): React.CSSProperties {
  const t = STORY_TYPE[id];
  if (!t) return { fontFamily: 'var(--font-serif-family)' };
  return {
    fontFamily: `${t.family}, var(--font-serif-family)`,
    fontWeight: t.weight,
  };
}
