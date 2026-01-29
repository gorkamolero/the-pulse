import { DEFAULT_NARRATOR_MODEL, DEFAULT_VOICE_ID } from "./models";
import { endlessPath } from "./stories/endless-path";
import { innsmouth } from "./stories/shadow-over-innsmouth";
import { sirenOfTheRedDust } from "./stories/siren-of-the-red-dust";
import { theHollowChoir } from "./stories/the-hollow-choir";
import { whisperingPines } from "./stories/whispering-pines";

/**
 * Narrator configuration for a story
 */
export interface NarratorConfig {
  /** Model ID for text generation (Vercel AI Gateway format) */
  modelId?: string;
  /** ElevenLabs voice ID for TTS */
  voiceId?: string;
}

/**
 * Ambient audio configuration for background atmosphere
 */
export interface AmbientAudioConfig {
  /** Path to audio file (relative to public folder) */
  src: string;
  /** Volume level 0-1 (default: 0.3) */
  volume?: number;
  /** Fade-in duration in ms (default: 3000) */
  fadeInMs?: number;
}

/**
 * Typography configuration for a story
 * Fonts are lazy-loaded only when the story session starts
 */
export interface StoryTypography {
  /** Google Font family name (e.g., "Crimson Text", "EB Garamond") */
  fontFamily: string;
  /** Font weights to load (default: ["400", "600"]) */
  weights?: string[];
  /** CSS font-family fallback stack */
  fallback: string;
  /** Base font size in rem (default: 1.1) */
  fontSize?: number;
  /** Line height multiplier (default: 1.8) */
  lineHeight?: number;
  /** Letter spacing in em (default: 0.01) */
  letterSpacing?: number;
}

/**
 * Visual theme for a story
 */
export interface StoryTheme {
  /** Primary accent color (HSL values, e.g., "168 45% 45%") */
  accent: string;
  /** Hex color for direct use */
  accentHex: string;
  /** Optional story-specific typography - uses default if not specified */
  typography?: StoryTypography;
}

/**
 * Story definition
 */
export interface Story {
  id: string;
  title: string;
  description: string;
  storyGuide: string;
  /** Optional narrator configuration - uses defaults if not specified */
  narrator?: NarratorConfig;
  /** Optional ambient audio to loop in background */
  ambientAudio?: AmbientAudioConfig;
  /** If true, story shows as "Coming Soon" and cannot be started */
  comingSoon?: boolean;
  /** Visual theme for the story */
  theme?: StoryTheme;
}

export const stories: Array<Story> = [
  innsmouth,
  theHollowChoir,
  whisperingPines,
  sirenOfTheRedDust,
  endlessPath,
];

export const DEFAULT_STORY_ID = "shadow-over-innsmouth";

export function getStoryById(id: string): Story | undefined {
  return stories.find((story) => story.id === id);
}

/**
 * Get narrator configuration for a story, with defaults
 */
export function getNarratorConfig(storyId: string): Required<NarratorConfig> {
  const story = getStoryById(storyId);
  return {
    modelId: story?.narrator?.modelId ?? DEFAULT_NARRATOR_MODEL,
    voiceId: story?.narrator?.voiceId ?? DEFAULT_VOICE_ID,
  };
}

// Re-export the individual story objects for direct access
export {
  innsmouth,
  theHollowChoir,
  whisperingPines,
  sirenOfTheRedDust,
  endlessPath,
};
