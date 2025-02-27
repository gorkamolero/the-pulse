import { innsmouth } from "./stories/shadow-over-innsmouth";
import { sirenOfTheRedDust } from "./stories/siren-of-the-red-dust";
import { theHollowChoir } from "./stories/the-hollow-choir";
import { whisperingPines } from "./stories/whispering-pines";

export interface Story {
  id: string;
  title: string;
  description: string;
  storyGuide: string;
}

export const stories: Array<Story> = [
  innsmouth,
  theHollowChoir,
  whisperingPines,
  sirenOfTheRedDust,
];

export const DEFAULT_STORY_ID = "shadow-over-innsmouth";

export function getStoryById(id: string): Story | undefined {
  return stories.find((story) => story.id === id);
}

// Re-export the individual story objects for direct access
export { innsmouth, theHollowChoir, whisperingPines, sirenOfTheRedDust };
