import {
  type UIMessage,
  type LanguageModel,
  streamText,
  convertToModelMessages,
} from "ai";
import { after } from "next/server";

import { auth } from "@/app/(auth)/auth";
import { systemPrompt } from "@pulse/core/ai/prompts/system";
import {
  getStoryById,
  getNarratorConfig,
  DEFAULT_STORY_ID,
} from "@pulse/core/ai/stories";
import {
  deleteChatById,
  getChatById,
  saveChat,
  saveMessages,
  updateMessageImageUrl,
  updateMessageAudioUrl,
  startFreeStory,
  addMisuseWarning,
  getUserSettings,
} from "@/lib/db/queries";
import {
  getMostRecentUserMessage,
  getUIMessageContent,
} from "@/lib/utils";
import {
  isGarbageOutput,
  describeGarbageReason,
} from "@pulse/core/narrator/validation";
import { createUserModel } from "@/lib/ai/create-model";
import {
  evaluateMessage,
  shouldSampleMessage,
  isMisuseConfirmed,
} from "@/lib/ai/misuse-evaluator";

import { generateTitleFromUserMessage } from "../../actions";
import { generatePulseImage } from "@/lib/ai/tools/generate-image";
import { generatePulseAudio } from "@/lib/ai/tools/generate-audio";

export const maxDuration = 60;

export async function POST(request: Request) {
  const {
    id,
    messages,
    selectedStoryId = DEFAULT_STORY_ID,
    language = "en",
  }: {
    id: string;
    messages: Array<UIMessage>;
    selectedStoryId?: string;
    language?: string;
  } = await request.json();

  const session = await auth();

  if (!session || !session.user || !session.user.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const userId = session.user.id;
  const userMessage = getMostRecentUserMessage(messages);

  if (!userMessage) {
    return new Response("No user message found", { status: 400 });
  }

  // Get narrator config for this story (model + voice)
  const narratorConfig = getNarratorConfig(selectedStoryId);

  // Get user model based on their tier (own key, free tier, or degraded)
  let model: LanguageModel;
  let usingUserKey = false;
  let isDegraded = false;

  try {
    const modelResult = await createUserModel({
      userId,
      modelId: narratorConfig.modelId,
    });
    model = modelResult.model;
    usingUserKey = modelResult.usingUserKey;
    isDegraded = modelResult.isDegraded;
  } catch (error) {
    if (error instanceof Error && error.name === "FREE_TIER_EXHAUSTED") {
      return new Response(
        JSON.stringify({
          error: "FREE_TIER_EXHAUSTED",
          message:
            "Your free story has been completed. Please add your own API key to continue playing.",
          redirectTo: "/settings",
        }),
        {
          status: 402,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
    throw error;
  }

  // Track free story start (if using server key and first message)
  if (!usingUserKey) {
    const settings = await getUserSettings(userId);
    if (!settings?.freeStoryId) {
      await startFreeStory(userId, selectedStoryId);
    }
  }

  // Periodic misuse sampling (only for server key users)
  const messageCount = messages.filter((m) => m.role === "user").length;

  if (!usingUserKey && shouldSampleMessage(messageCount)) {
    const story = getStoryById(selectedStoryId);
    const lastAssistantMsg = messages
      .filter((m) => m.role === "assistant")
      .slice(-1)[0];
    const recentNarration = lastAssistantMsg
      ? getUIMessageContent(lastAssistantMsg)
      : undefined;

    const evaluation = await evaluateMessage(getUIMessageContent(userMessage), {
      storyId: selectedStoryId,
      storyTitle: story?.title,
      recentNarration,
    });

    if (isMisuseConfirmed(evaluation)) {
      const warnings = await addMisuseWarning(userId);
      console.warn(
        `Misuse detected for user ${userId}: ${evaluation.reason} (warning ${warnings})`
      );
    }
  }

  const chat = await getChatById({ id });

  if (!chat) {
    const userTitle = await generateTitleFromUserMessage({
      message: userMessage,
    });
    const story = getStoryById(selectedStoryId);
    const storyPrefix = story ? `[${story.title}] ` : "";

    // Generate a random 4-character string
    const randomChars = Math.random().toString(36).substring(2, 6);

    const title = `${storyPrefix}${userTitle} (${randomChars})`;
    await saveChat({ id, userId, title });
  }

  // Save user message
  await saveMessages({
    messages: [
      {
        id: crypto.randomUUID(),
        role: userMessage.role,
        content: getUIMessageContent(userMessage),
        createdAt: new Date(),
        chatId: id,
        imageUrl: null,
        audioUrl: null,
      },
    ],
  });

  // Select the appropriate system prompt based on the language
  const getSystemPromptForLanguage = (language: string) =>
    systemPrompt({
      storyGuide: getStoryById(selectedStoryId)?.storyGuide || "",
      language: language === "es" ? "spanish" : "english",
    });

  // Convert UIMessages to ModelMessages for the AI SDK
  const modelMessages = convertToModelMessages(messages);

  // Stream the response
  const result = streamText({
    model,
    system: getSystemPromptForLanguage(language),
    messages: modelMessages,
    experimental_telemetry: {
      isEnabled: true,
      functionId: "stream-text",
    },
    onError: ({ error }) => {
      console.error("Narrator streaming error:", error);
    },
  });

  // Return streaming response with AI SDK v6 best practices
  return result.toUIMessageStreamResponse({
    // Use UUIDs for message IDs so they match database format
    generateMessageId: () => crypto.randomUUID(),
    // Pass original messages to prevent duplicates
    originalMessages: messages,
    // Persist message after streaming completes
    onFinish: async ({ responseMessage }) => {
      const messageId = responseMessage.id;
      const text = responseMessage.parts
        .filter((p): p is { type: "text"; text: string } => p.type === "text")
        .map((p) => p.text)
        .join("");

      // Check for garbage output
      if (isGarbageOutput(text)) {
        const reason = describeGarbageReason(text);
        console.warn(`Narrator garbage detected: ${reason}`);
      }

      // Save the assistant message
      try {
        await saveMessages({
          messages: [
            {
              id: messageId,
              chatId: id,
              role: "assistant",
              content: text,
              createdAt: new Date(),
              imageUrl: null,
              audioUrl: null,
            },
          ],
        });

        // Schedule image and audio generation to run AFTER response is sent
        after(async () => {
          // Generate image
          try {
            const imageResult = await generatePulseImage({
              storyId: selectedStoryId,
              pulse: text,
              messageId,
            });

            if (imageResult?.url) {
              await updateMessageImageUrl({
                id: messageId,
                imageUrl: imageResult.url,
              });
              console.log(`[After] Image saved for message ${messageId}`);
            }
          } catch (error) {
            console.error("[After] Failed to generate image:", error);
          }

          // Generate audio with story-specific voice
          try {
            const audioResult = await generatePulseAudio({
              text,
              messageId,
              voiceId: narratorConfig.voiceId,
            });

            if (audioResult?.url) {
              await updateMessageAudioUrl({
                id: messageId,
                audioUrl: audioResult.url,
              });
              console.log(`[After] Audio saved for message ${messageId}`);
            }
          } catch (error) {
            console.error("[After] Failed to generate audio:", error);
          }
        });
      } catch (error) {
        console.error("Failed to save assistant message:", error);
      }
    },
    headers: {
      ...(isDegraded && { "X-Degraded-Mode": "true" }),
    },
  });
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return new Response("Not Found", { status: 404 });
  }

  const session = await auth();

  if (!session || !session.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const chat = await getChatById({ id });

    if (chat.userId !== session.user.id) {
      return new Response("Unauthorized", { status: 401 });
    }

    await deleteChatById({ id });

    return new Response("Chat deleted", { status: 200 });
  } catch {
    return new Response("An error occurred while processing your request", {
      status: 500,
    });
  }
}
