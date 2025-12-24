import { experimental_generateSpeech as generateSpeech } from "ai";
import { elevenlabs } from "@ai-sdk/elevenlabs";
import { put } from "@vercel/blob";

// Default voice for narration
const DEFAULT_VOICE_ID = "qNkzaJoHLLdpvgh5tISm"; // Carter

/**
 * Generate audio narration for a story pulse and upload to Vercel Blob
 */
export async function generatePulseAudio({
  text,
  messageId,
  voiceId = DEFAULT_VOICE_ID,
}: {
  text: string;
  messageId: string;
  voiceId?: string;
}) {
  try {
    console.log(`[Audio] Generating speech for message ${messageId}`);

    // Generate speech using ElevenLabs
    const { audio } = await generateSpeech({
      model: elevenlabs.speech("eleven_flash_v2_5"),
      text,
      voice: voiceId,
    });

    if (!audio?.base64) {
      console.error("[Audio] No audio data received");
      return { success: false, error: "No audio data received" };
    }

    // Upload to Vercel Blob
    const filename = `pulse-audio-${messageId}.mp3`;
    const buffer = Buffer.from(audio.base64, "base64");

    const { url } = await put(filename, buffer, {
      contentType: audio.mediaType || "audio/mpeg",
      access: "public",
    });

    console.log(`[Audio] Generated and uploaded: ${url}`);
    return { success: true, url };
  } catch (error) {
    console.error("[Audio] Error generating audio:", error);
    return { success: false, error: "Failed to generate audio" };
  }
}
