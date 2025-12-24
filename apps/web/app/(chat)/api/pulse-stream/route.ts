import {
  type UIMessage,
  type LanguageModel,
  streamText,
  convertToModelMessages,
} from "ai";
import { after } from "next/server";

import { auth } from "@/app/(auth)/auth";
import { NARRATOR_MODEL } from "@pulse/core/ai/models";
import { systemPrompt } from "@pulse/core/ai/prompts/system";
import { getStoryById, DEFAULT_STORY_ID } from "@pulse/core/ai/stories";
import {
  getChatById,
  saveChat,
  saveMessages,
  updateMessageImageUrl,
  startFreeStory,
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
import { createElevenLabsStream } from "@/lib/ai/elevenlabs-websocket";

export const maxDuration = 60;

// Protocol markers for multiplexed stream
const TEXT_MARKER = "T:"; // Text chunk
const AUDIO_MARKER = "A:"; // Audio chunk (base64)
const DONE_MARKER = "D:"; // Stream complete

/**
 * Streaming chat endpoint with real-time audio narration.
 * Returns a multiplexed stream of text and audio chunks.
 *
 * Protocol:
 * - T:<text>\n - Text chunk (plain text)
 * - A:<base64>\n - Audio chunk (base64 encoded MP3)
 * - D:\n - Done signal
 */
export async function POST(request: Request) {
  const {
    id,
    messages,
    selectedStoryId = DEFAULT_STORY_ID,
    language = "en",
    enableAudio = true,
  }: {
    id: string;
    messages: Array<UIMessage>;
    selectedStoryId?: string;
    language?: string;
    enableAudio?: boolean;
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

  // Get user model based on their tier
  let model: LanguageModel;
  let usingUserKey = false;
  let isDegraded = false;

  try {
    const modelResult = await createUserModel({
      userId,
      modelId: NARRATOR_MODEL,
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

  // Track free story start
  if (!usingUserKey) {
    const settings = await getUserSettings(userId);
    if (!settings?.freeStoryId) {
      await startFreeStory(userId, selectedStoryId);
    }
  }

  // Periodic misuse sampling
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
      console.warn(`Misuse detected for user ${userId}: ${evaluation.reason}`);
    }
  }

  const chat = await getChatById({ id });

  if (!chat) {
    const userTitle = await generateTitleFromUserMessage({
      message: userMessage,
    });
    const story = getStoryById(selectedStoryId);
    const storyPrefix = story ? `[${story.title}] ` : "";
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

  const getSystemPromptForLanguage = (language: string) =>
    systemPrompt({
      storyGuide: getStoryById(selectedStoryId)?.storyGuide || "",
      language: language === "es" ? "spanish" : "english",
    });

  const modelMessages = convertToModelMessages(messages);
  const assistantMessageId = crypto.randomUUID();

  // Create a TransformStream for the multiplexed response
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let fullText = "";
      let elevenLabsStream: ReturnType<typeof createElevenLabsStream> | null =
        null;

      // Initialize ElevenLabs WebSocket if audio is enabled
      if (enableAudio) {
        try {
          elevenLabsStream = createElevenLabsStream({
            onAudioChunk: (chunk) => {
              // Send audio chunk to client
              const base64Audio = chunk.toString("base64");
              controller.enqueue(
                encoder.encode(`${AUDIO_MARKER}${base64Audio}\n`)
              );
            },
            onError: (error) => {
              console.error("[Chat Stream] ElevenLabs error:", error);
            },
          });

          await elevenLabsStream.waitForConnection();
          console.log("[Chat Stream] ElevenLabs WebSocket connected");
        } catch (error) {
          console.error("[Chat Stream] Failed to connect ElevenLabs:", error);
          elevenLabsStream = null;
        }
      }

      // Buffer for accumulating text to send in sentence-sized chunks
      let textBuffer = "";
      const sentenceEndRegex = /[.!?]\s+|[.!?]$/;

      try {
        // Stream text from the narrator
        const result = streamText({
          model,
          system: getSystemPromptForLanguage(language),
          messages: modelMessages,
          experimental_telemetry: {
            isEnabled: true,
            functionId: "stream-text-with-audio",
          },
        });

        // Process the text stream
        for await (const chunk of result.textStream) {
          fullText += chunk;
          textBuffer += chunk;

          // Send text chunk to client immediately
          controller.enqueue(encoder.encode(`${TEXT_MARKER}${chunk}\n`));

          // Send to ElevenLabs when we have a complete sentence
          if (elevenLabsStream?.isOpen() && sentenceEndRegex.test(textBuffer)) {
            elevenLabsStream.sendText(textBuffer);
            textBuffer = "";
          }
        }

        // Flush any remaining text to ElevenLabs
        if (elevenLabsStream?.isOpen()) {
          if (textBuffer.length > 0) {
            elevenLabsStream.sendText(textBuffer);
          }
          elevenLabsStream.flush();

          // Wait a bit for final audio chunks
          await new Promise((resolve) => setTimeout(resolve, 2000));
          elevenLabsStream.close();
        }

        // Check for garbage output
        if (isGarbageOutput(fullText)) {
          const reason = describeGarbageReason(fullText);
          console.warn(`Narrator garbage detected: ${reason}`);
        }

        // Save the assistant message and generate image in background
        await saveMessages({
          messages: [
            {
              id: assistantMessageId,
              chatId: id,
              role: "assistant",
              content: fullText,
              createdAt: new Date(),
              imageUrl: null,
              audioUrl: null,
            },
          ],
        });

        // Generate image in background
        after(async () => {
          try {
            const imageResult = await generatePulseImage({
              storyId: selectedStoryId,
              pulse: fullText,
              messageId: assistantMessageId,
            });

            if (imageResult?.url) {
              await updateMessageImageUrl({
                id: assistantMessageId,
                imageUrl: imageResult.url,
              });
            }
          } catch (error) {
            console.error("[After] Failed to generate image:", error);
          }
        });

        // Send done signal
        controller.enqueue(encoder.encode(`${DONE_MARKER}\n`));
        controller.close();
      } catch (error) {
        console.error("[Chat Stream] Error:", error);
        elevenLabsStream?.close();
        controller.error(error);
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Transfer-Encoding": "chunked",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      ...(isDegraded && { "X-Degraded-Mode": "true" }),
    },
  });
}
