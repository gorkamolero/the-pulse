/**
 * Utility functions for interacting with the ElevenLabs API
 */
import { toast } from "sonner";

// Default voice ID for ElevenLabs (Carter the Mountain King - rich, smooth, & rugged)
export const DEFAULT_VOICE_ID = "qNkzaJoHLLdpvgh5tISm";

/**
 * Convert text to speech using ElevenLabs API
 * @param text The text to convert to speech
 * @param voiceId The ElevenLabs voice ID to use
 * @param apiKey The ElevenLabs API key
 * @returns A Promise that resolves to an object containing the audio element and blob
 */
export async function textToSpeech(
  text: string,
  voiceId: string = DEFAULT_VOICE_ID,
  apiKey: string = process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY || ""
): Promise<{ audioElement: HTMLAudioElement; audioBlob: Blob }> {
  if (!text || !apiKey) {
    throw new Error("Text and API key are required for text-to-speech");
  }

  try {
    // Create the request to ElevenLabs API
    console.log(
      "%c[ElevenLabs] MAKING API CALL",
      "color: #e91e63; font-weight: bold"
    );

    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "xi-api-key": apiKey,
        },
        body: JSON.stringify({
          text,
          model_id: "eleven_multilingual_v2",
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.5,
          },
        }),
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        const errorMessage =
          "ElevenLabs rate limit exceeded. Please try again later.";
        toast.error(errorMessage);
        throw new Error(errorMessage);
      }

      const errorText = await response.text().catch(() => "Unknown error");
      const errorMessage = `ElevenLabs API error: ${response.status} ${
        response.statusText
      }${errorText ? ` - ${errorText}` : ""}`;
      toast.error("Audio narration failed. Please try again later.");
      throw new Error(errorMessage);
    }

    // Convert the response to a blob
    const audioBlob = await response.blob();
    const audioUrl = URL.createObjectURL(audioBlob);

    // Create and return the audio element
    const audioElement = new Audio(audioUrl);

    // Ensure the audio element is properly set up
    audioElement.preload = "auto";

    // Add cleanup for the object URL when the audio is done playing
    audioElement.onended = () => {
      URL.revokeObjectURL(audioUrl);
    };

    // Add error handling
    audioElement.onerror = (e) => {
      console.error("Audio element error:", e);
      URL.revokeObjectURL(audioUrl);
    };

    return { audioElement, audioBlob };
  } catch (error) {
    console.error("Error in textToSpeech:", error);
    // If it's not already a handled error with a toast, show a generic error
    if (!(error instanceof Error && error.message.includes("ElevenLabs"))) {
      toast.error("Failed to generate audio narration");
    }
    throw error;
  }
}
