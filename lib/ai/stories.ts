import { innsmouth } from "./stories/shadow-over-innsmouth";
import { theHollowChoir } from "./stories/the-hollow-choir";

export interface Story {
  id: string;
  title: string;
  description: string;
  storyGuide: string;
}

export const stories: Array<Story> = [
  {
    id: "shadow-over-innsmouth",
    ...innsmouth,
  },
  {
    id: "the-hollow-choir",
    ...theHollowChoir,
  },
];

export const DEFAULT_STORY_ID = "shadow-over-innsmouth";

export function getStoryById(id: string): Story | undefined {
  return stories.find((story) => story.id === id);
}
