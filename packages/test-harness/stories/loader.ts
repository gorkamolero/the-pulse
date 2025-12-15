/**
 * Story File Loader
 *
 * Load story definitions directly from lib/ai/stories/ TypeScript modules
 */

// Direct imports from @pulse/core
import { innsmouth } from '@pulse/core/ai/stories/shadow-over-innsmouth';
import { innsmouthNonlinear } from '@pulse/core/ai/stories/shadow-over-innsmouth-non-linear';
import { theHollowChoir } from '@pulse/core/ai/stories/the-hollow-choir';
import { whisperingPines } from '@pulse/core/ai/stories/whispering-pines';
import { sirenOfTheRedDust } from '@pulse/core/ai/stories/siren-of-the-red-dust';
import { endlessPath } from '@pulse/core/ai/stories/endless-path';

export interface Story {
  id: string;
  title: string;
  description?: string;
  storyGuide: string;
}

/**
 * All available stories loaded from the main app
 */
const ALL_STORIES = new Map<string, Story>([
  [innsmouth.id, innsmouth],
  [innsmouthNonlinear.id, innsmouthNonlinear],
  [theHollowChoir.id, theHollowChoir],
  [whisperingPines.id, whisperingPines],
  [sirenOfTheRedDust.id, sirenOfTheRedDust],
  [endlessPath.id, endlessPath],
]);

/**
 * Get all available stories
 */
export function getAllStories(): Map<string, Story> {
  return new Map(ALL_STORIES);
}

/**
 * Get a story by ID, throw if not found
 */
export function getStory(storyId: string): Story {
  const story = ALL_STORIES.get(storyId);

  if (!story) {
    const availableIds = Array.from(ALL_STORIES.keys()).join(', ');
    throw new Error(
      `Story "${storyId}" not found. Available stories: ${availableIds}`,
    );
  }

  return story;
}

/**
 * List all available story IDs
 */
export function listStoryIds(): string[] {
  return Array.from(ALL_STORIES.keys()).sort();
}

/**
 * Check if a story ID exists
 */
export function hasStory(storyId: string): boolean {
  return ALL_STORIES.has(storyId);
}
