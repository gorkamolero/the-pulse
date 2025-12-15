/**
 * Orate service for text-to-speech functionality
 * Provides a unified API for multiple TTS providers
 */
import { toast } from "sonner";

// Provider types
export type Provider = "openai" | "elevenlabs";

// Default voice IDs
export const DEFAULT_ELEVENLABS_VOICE_ID = "qNkzaJoHLLdpvgh5tISm"; // Carter
export const DEFAULT_OPENAI_VOICE_ID = "alloy";

// ElevenLabs voice options
export const ELEVENLABS_VOICES = [
  {
    id: DEFAULT_ELEVENLABS_VOICE_ID,
    name: "Carter the Mountain King",
    description: "Rich, smooth, & rugged",
    provider: "elevenlabs" as Provider,
  },
  {
    id: "uVKHymY7OYMd6OailpG5",
    name: "Frederick",
    description: "Old Gnarly Narrator",
    provider: "elevenlabs" as Provider,
  },
  {
    id: "dAcds2QMcvmv86jQMC3Y",
    name: "Jayce",
    description: "The Gangster",
    provider: "elevenlabs" as Provider,
  },
  {
    id: "flHkNRp1BlvT73UL6gyz",
    name: "Jessica Anne Bogart",
    description: "Smooth female voice",
    provider: "elevenlabs" as Provider,
  },
  {
    id: "0dPqNXnhg2bmxQv1WKDp",
    name: "Grandpa Oxley",
    description: "Wise elder voice",
    provider: "elevenlabs" as Provider,
  },
];

// OpenAI voice options
export const OPENAI_VOICES = [
  {
    id: "alloy",
    name: "Alloy",
    description: "Versatile, balanced voice",
    provider: "openai" as Provider,
  },
  {
    id: "echo",
    name: "Echo",
    description: "Crisp, clear voice",
    provider: "openai" as Provider,
  },
  {
    id: "fable",
    name: "Fable",
    description: "Narrative, warm voice",
    provider: "openai" as Provider,
  },
  {
    id: "onyx",
    name: "Onyx",
    description: "Deep, authoritative voice",
    provider: "openai" as Provider,
  },
  {
    id: "nova",
    name: "Nova",
    description: "Energetic, bright voice",
    provider: "openai" as Provider,
  },
  {
    id: "shimmer",
    name: "Shimmer",
    description: "Gentle, melodic voice",
    provider: "openai" as Provider,
  },
];

// Combined voices
export const ALL_VOICES = [...ELEVENLABS_VOICES, ...OPENAI_VOICES];

/**
 * Generate speech using server-side API
 * @param text The text to convert to speech
 * @param provider The provider to use (openai or elevenlabs)
 * @param voiceId The voice ID to use
 * @returns A Promise that resolves to a Blob containing the audio
 */
export async function generateSpeech(
  text: string,
  provider: Provider,
  voiceId: string
): Promise<Blob> {
  try {
    console.log(
      `%c[Orate] Requesting speech with ${provider} using voice ${voiceId}`,
      `color: ${
        provider === "openai" ? "#10a37f" : "#e91e63"
      }; font-weight: bold`
    );

    // Call the server-side API
    const response = await fetch("/api/tts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text,
        provider,
        voiceId,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Failed to generate speech");
    }

    // Get the audio blob from the response
    const audioBlob = await response.blob();
    return audioBlob;
  } catch (error) {
    console.error(`[Orate] Error generating speech:`, error);
    toast.error(`Failed to generate audio narration with ${provider}`);
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
  // Create audio URL and element
  const audioUrl = URL.createObjectURL(audioBlob);
  const audioElement = new Audio(audioUrl);

  // Configure audio element
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

  return { audioElement };
}
