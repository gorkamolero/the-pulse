import { put } from "@vercel/blob";
import {
  getTTSProvider,
  getDefaultVoiceId,
  type TTSProvider,
} from "../tts";

/**
 * Generate audio narration for a story pulse and upload to Vercel Blob
 *
 * Supports multiple TTS providers (ElevenLabs, MiniMax) via the TTS_PROVIDER env var
 * or explicit provider parameter
 */
export async function generatePulseAudio({
  text,
  messageId,
  voiceId,
  provider,
}: {
  text: string;
  messageId: string;
  /** Voice ID (provider-specific) */
  voiceId?: string;
  /** Override the default provider */
  provider?: TTSProvider;
}) {
  try {
    // Get the TTS provider (respects TTS_PROVIDER env var)
    const ttsProvider = getTTSProvider(provider);

    // Use provided voice or default for the provider
    const effectiveVoiceId =
      voiceId || getDefaultVoiceId(ttsProvider.name);

    // Generate speech
    const result = await ttsProvider.generateSpeech({
      text,
      voiceId: effectiveVoiceId,
    });

    // Upload to Vercel Blob
    const filename = `pulse-audio-${messageId}.mp3`;
    const buffer = Buffer.from(result.audioBase64, "base64");

    const { url } = await put(filename, buffer, {
      contentType: result.contentType,
      access: "public",
    });

    return { success: true, url, provider: ttsProvider.name };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to generate audio";
    return { success: false, error: message };
  }
}
