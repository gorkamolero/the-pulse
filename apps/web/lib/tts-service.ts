/**
 * Orate service for text-to-speech functionality
 * Uses ElevenLabs exclusively
 */
import { toast } from "sonner";
import { VOICES, DEFAULT_VOICE_ID } from "@pulse/core/ai/models";

// Re-export for convenience
export { VOICES, DEFAULT_VOICE_ID };

/**
 * Generate speech using ElevenLabs via server-side API
 * @param text The text to convert to speech
 * @param voiceId The ElevenLabs voice ID to use
 * @returns A Promise that resolves to a Blob containing the audio
 */
export async function generateSpeech(
  text: string,
  voiceId: string = DEFAULT_VOICE_ID
): Promise<Blob> {
  try {
    const response = await fetch("/api/tts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text,
        voiceId,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Failed to generate speech");
    }

    return await response.blob();
  } catch (error) {
    toast.error("Failed to generate audio narration");
    throw error;
  }
}

/**
 * Convert a Blob to an audio element
 * @param audioBlob The Blob containing the audio data
 * @returns An object containing the audio element
 */
export function blobToAudio(audioBlob: Blob): {
  audioElement: HTMLAudioElement;
} {
  const audioUrl = URL.createObjectURL(audioBlob);
  const audioElement = new Audio(audioUrl);

  audioElement.preload = "auto";

  audioElement.onended = () => {
    URL.revokeObjectURL(audioUrl);
  };

  audioElement.onerror = () => {
    URL.revokeObjectURL(audioUrl);
  };

  return { audioElement };
}
