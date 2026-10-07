import { after } from "next/server";
import { auth } from "@/app/(auth)/auth";
import { getStoryById } from "@pulse/core/ai/stories";
import {
  ensureGuestUser,
  getChatById,
  saveChat,
  saveMessages,
  updateMessageImageUrl,
} from "@/lib/db/queries";
import {
  generateImagePrompt,
  generateImageFromPrompt,
} from "@/lib/ai/tools/generate-image";
import { generateSceneAmbience } from "@/lib/ai/sound-effects";

export const maxDuration = 60;

/**
 * Save one turn narrated by an ElevenLabs agent (the voice already played in the
 * browser), then generate the scene image and ambience the same way /api/pulse does.
 */
export async function POST(request: Request) {
  const {
    chatId,
    storyId,
    userText,
    userMessageId,
    narration,
    assistantMessageId,
    solo = true,
  }: {
    chatId: string;
    storyId: string;
    userText?: string | null;
    userMessageId?: string;
    narration: string;
    assistantMessageId: string;
    solo?: boolean;
  } = await request.json();

  const story = getStoryById(storyId);
  if (!story || !chatId || !assistantMessageId || !narration?.trim()) {
    return Response.json({ error: "BAD_REQUEST" }, { status: 400 });
  }

  const session = await auth();
  const userId = session?.user?.id;

  if (!(await getChatById({ id: chatId }))) {
    await saveChat({
      id: chatId,
      userId: userId || (await ensureGuestUser()),
      title: userId ? `[${story.title}] Live narrator` : `[Guest] ${story.title}`,
      storyId,
      soloMode: solo,
    });
  }

  const now = Date.now();
  await saveMessages({
    messages: [
      ...(userText?.trim()
        ? [{
            // Same id the other players in a room were shown, when the browser sent one
            id: userMessageId ?? crypto.randomUUID(),
            chatId,
            role: "user",
            content: userText,
            createdAt: new Date(now),
            imageUrl: null,
            audioUrl: null,
            wordTimings: null,
          }]
        : []),
      {
        id: assistantMessageId,
        chatId,
        role: "assistant",
        content: narration,
        createdAt: new Date(now + 1),
        imageUrl: null,
        audioUrl: null,
        wordTimings: null,
      },
    ],
  });

  after(async () => {
    try {
      const imagePrompt = await generateImagePrompt({ storyId, pulse: narration });
      const imageResult = await generateImageFromPrompt({ imagePrompt, messageId: assistantMessageId });
      if (imageResult.success) {
        await updateMessageImageUrl({ id: assistantMessageId, imageUrl: imageResult.url });
      }
    } catch {
      // Image generation failed - non-critical
    }

    try {
      await generateSceneAmbience({
        storyId,
        sceneText: narration,
        messageId: assistantMessageId,
        durationSeconds: 22,
      });
    } catch {
      // Ambience generation failed - non-critical
    }
  });

  return Response.json({ ok: true });
}
