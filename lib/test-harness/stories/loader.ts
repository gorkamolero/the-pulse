/**
 * Story File Loader
 *
 * Load story definitions directly from lib/ai/stories/ TypeScript modules
 */

// Direct imports from the main codebase
import { innsmouth } from '../../ai/stories/shadow-over-innsmouth';
import { innsmouthNonlinear } from '../../ai/stories/shadow-over-innsmouth-non-linear';
import { theHollowChoir } from '../../ai/stories/the-hollow-choir';
import { whisperingPines } from '../../ai/stories/whispering-pines';
import { sirenOfTheRedDust } from '../../ai/stories/siren-of-the-red-dust';
import { endlessPath } from '../../ai/stories/endless-path';

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
