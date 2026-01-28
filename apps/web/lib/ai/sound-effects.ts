import { generateText } from "ai";
import { put } from "@vercel/blob";
import { getStoryById } from "@pulse/core/ai/stories";
import { TITLE_MODEL } from "@pulse/core/ai/models";

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;

/**
 * Generate a sound effect prompt from scene text.
 * Creates an ambient sound description suitable for 11Labs Sound Effects API.
 */
export async function generateSoundEffectPrompt({
  storyId,
  sceneText,
}: {
  storyId: string;
  sceneText: string;
}): Promise<string> {
  const story = getStoryById(storyId);

  const { text: soundPrompt } = await generateText({
    model: TITLE_MODEL,
    prompt: `Create a sound effect prompt for an immersive audio experience.

Story: "${story?.title || "Interactive Story"}"
Scene: "${sceneText.substring(0, 800)}"

Create a detailed ambient sound description (20-30 seconds) that captures:
1. Environmental sounds (weather, nature, location-specific ambience)
2. Distant background elements (creatures, machinery, city noise, etc.)
3. The emotional atmosphere (tense, peaceful, mysterious, etc.)

Use audio terminology like: ambience, texture, atmospheric, distant, subtle, layered.
Focus on sounds that would be heard in the background during narration.
Keep it under 50 words. No music, just ambient sounds and textures.

Sound Effect Prompt:`,
  });

  return soundPrompt.trim();
}

/**
 * Generate a scene ambience sound effect using 11Labs Sound Effects API.
 * Results are cached in Vercel Blob.
 */
export async function generateSceneAmbience({
  storyId,
  sceneText,
  messageId,
  durationSeconds = 22,
}: {
  storyId: string;
  sceneText: string;
  messageId: string;
  durationSeconds?: number;
}): Promise<{ success: true; url: string } | { success: false; error: string }> {
  if (!ELEVENLABS_API_KEY) {
    return { success: false, error: "ELEVENLABS_API_KEY not configured" };
  }

  try {
    // Generate the sound effect prompt
    const soundPrompt = await generateSoundEffectPrompt({ storyId, sceneText });

    console.log("[Sound Effects] Generating ambience:", {
      messageId,
      prompt: soundPrompt.substring(0, 100),
      duration: durationSeconds,
    });

    // Call 11Labs Sound Effects API
    const response = await fetch(
      "https://api.elevenlabs.io/v1/sound-generation",
      {
        method: "POST",
        headers: {
          "xi-api-key": ELEVENLABS_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: soundPrompt,
          duration_seconds: Math.min(Math.max(durationSeconds, 4), 30),
          prompt_influence: 0.7,
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[Sound Effects] API error:", errorText);
      return { success: false, error: `API error: ${response.status}` };
    }

    // Get audio data
    const audioBuffer = await response.arrayBuffer();

    // Upload to Vercel Blob for caching
    const filename = `pulse-sfx-${messageId}.mp3`;
    const { url } = await put(filename, Buffer.from(audioBuffer), {
      contentType: "audio/mpeg",
      access: "public",
    });

    console.log("[Sound Effects] Generated and cached:", { messageId, url });

    return { success: true, url };
  } catch (error) {
    console.error("[Sound Effects] Generation failed:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Hash a string for cache key generation
 */
function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

/**
 * Get a cache key for scene ambience based on story and scene content.
 * This allows reusing ambience for similar scenes.
 */
export function getSceneAmbienceCacheKey(
  storyId: string,
  sceneText: string
): string {
  // Use first 200 chars of scene to determine ambience type
  const sceneFingerprint = sceneText.substring(0, 200).toLowerCase().trim();
  return `${storyId}-${hashString(sceneFingerprint)}`;
}
