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
 * Story definition
 */
export interface Story {
  id: string;
  title: string;
  description: string;
  storyGuide: string;
  /** Optional narrator configuration - uses defaults if not specified */
  narrator?: NarratorConfig;
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
