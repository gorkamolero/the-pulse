import { getStoryById, stories } from "@/lib/ai/stories";
import type { Session } from "next-auth";

interface DataStream {
  append: (data: { type: string; [key: string]: unknown }) => void;
}

interface SelectStoryParams {
  session: Session;
  dataStream: DataStream;
}

interface SelectStoryInput {
  storyId: string;
}

export const selectStory = ({ session, dataStream }: SelectStoryParams) => {
  return async ({ storyId }: SelectStoryInput) => {
    const story = getStoryById(storyId);

    if (!story) {
      return {
        error: `Story with ID "${storyId}" not found.`,
        availableStories: stories.map((s) => ({ id: s.id, title: s.title })),
      };
    }

    // Send the story guide to the data stream
    dataStream.append({
      type: "story-selected",
      storyId: story.id,
      storyTitle: story.title,
    });

    return {
      success: true,
      storyId: story.id,
      storyTitle: story.title,
      storyGuide: story.storyGuide,
    };
  };
};
