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
import {
  generateImagePrompt,
  generateImageFromPrompt,
} from "@/lib/ai/tools/generate-image";
import { createElevenLabsStream } from "@/lib/ai/elevenlabs-websocket";
import { generateSceneAmbience } from "@/lib/ai/sound-effects";

export const maxDuration = 60;

// Protocol markers for multiplexed stream
const TEXT_MARKER = "T:"; // Text chunk
const AUDIO_MARKER = "A:"; // Audio chunk (base64)
const SFX_MARKER = "S:"; // Sound effect URL
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

  // Get narrator config for this story (model + voice)
  const narratorConfig = getNarratorConfig(selectedStoryId);

  // Get user model based on their tier
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

      // Start ElevenLabs WebSocket connection in parallel (don't await yet)
      const elevenLabsPromise = enableAudio
        ? new Promise<ReturnType<typeof createElevenLabsStream> | null>(
            (resolve) => {
              try {
                const stream = createElevenLabsStream({
                  voiceId: narratorConfig.voiceId,
                  onAudioChunk: (chunk) => {
                    // Send audio chunk to client
                    const base64Audio = chunk.toString("base64");
                    controller.enqueue(
                      encoder.encode(`${AUDIO_MARKER}${base64Audio}\n`)
                    );
                  },
                  onError: () => {
                    // ElevenLabs connection error - audio will be skipped
                  },
                });

                stream.waitForConnection().then(() => resolve(stream));
              } catch {
                resolve(null);
              }
            }
          )
        : Promise.resolve(null);

      // Buffer for accumulating text to send in sentence-sized chunks
      let textBuffer = "";
      const sentenceEndRegex = /[.!?]\s+|[.!?]$/;

      // Early image prompt tracking
      let imagePromptPromise: Promise<string> | null = null;
      let imagePromptStarted = false;
      const EARLY_PROMPT_CHARS = 150; // Start generating prompt after this many chars

      // Scene ambience tracking
      let sceneAmbiencePromise: Promise<
        | { success: true; url: string }
        | { success: false; error: string }
        | null
      > = Promise.resolve(null);
      let sceneAmbienceStarted = false;
      const AMBIENCE_TRIGGER_CHARS = 200; // Start generating ambience after this many chars

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

        // Wait for ElevenLabs connection to be ready (should be fast since started early)
        elevenLabsStream = await elevenLabsPromise;

        // Process the text stream
        for await (const chunk of result.textStream) {
          fullText += chunk;
          textBuffer += chunk;

          // Send text chunk to client immediately
          controller.enqueue(encoder.encode(`${TEXT_MARKER}${chunk}\n`));

          // Start image prompt generation early (after we have enough context)
          if (!imagePromptStarted && fullText.length >= EARLY_PROMPT_CHARS) {
            imagePromptStarted = true;
            imagePromptPromise = generateImagePrompt({
              storyId: selectedStoryId,
              pulse: fullText,
            }).catch((err) => {
              console.error("Early image prompt generation failed:", err);
              return ""; // Fallback to empty, will retry with full text
            });
          }

          // Start scene ambience generation (creates unique atmosphere for this scene)
          if (!sceneAmbienceStarted && fullText.length >= AMBIENCE_TRIGGER_CHARS) {
            sceneAmbienceStarted = true;
            sceneAmbiencePromise = generateSceneAmbience({
              storyId: selectedStoryId,
              sceneText: fullText,
              messageId: assistantMessageId,
              durationSeconds: 22,
            }).then((result) => {
              if (result.success) {
                // Stream the ambience URL to client
                controller.enqueue(
                  encoder.encode(`${SFX_MARKER}${result.url}\n`)
                );
              }
              return result;
            }).catch((err) => {
              console.error("Scene ambience generation failed:", err);
              return null;
            });
          }

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

        // Save the assistant message
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

        // Generate image in background (using early prompt if available)
        after(async () => {
          try {
            let imagePrompt: string | undefined;

            // Use early-generated prompt if it completed successfully
            if (imagePromptPromise) {
              const earlyPrompt = await imagePromptPromise;
              if (earlyPrompt) {
                imagePrompt = earlyPrompt;
              }
            }

            // Fall back to generating with full text if early prompt failed
            if (!imagePrompt) {
              imagePrompt = await generateImagePrompt({
                storyId: selectedStoryId,
                pulse: fullText,
              });
            }

            // Generate the actual image
            const imageResult = await generateImageFromPrompt({
              imagePrompt,
              messageId: assistantMessageId,
            });

            if (imageResult?.url) {
              await updateMessageImageUrl({
                id: assistantMessageId,
                imageUrl: imageResult.url,
              });
            }
          } catch {
            // Image generation failed - non-critical
          }
        });

        // Send done signal
        controller.enqueue(encoder.encode(`${DONE_MARKER}\n`));
        controller.close();
      } catch (error) {
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
