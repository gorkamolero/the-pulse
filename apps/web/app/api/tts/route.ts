import { experimental_generateSpeech as generateSpeech } from "ai";
import { openai } from "@ai-sdk/openai";
import { elevenlabs } from "@ai-sdk/elevenlabs";
import { type NextRequest, NextResponse } from "next/server";

// Provider types
export type Provider = "openai" | "elevenlabs";

// Default voice IDs
const DEFAULT_ELEVENLABS_VOICE_ID = "qNkzaJoHLLdpvgh5tISm"; // Carter
const DEFAULT_OPENAI_VOICE_ID = "alloy";

/**
 * POST handler for text-to-speech API
 * @param request The incoming request
 * @returns Response with audio data
 */
export async function POST(request: NextRequest) {
  try {
    // Parse the request body
    const { text, provider, voiceId } = await request.json();

    // Validate the request
    if (!text) {
      return NextResponse.json({ error: "Text is required" }, { status: 400 });
    }

    if (!provider || (provider !== "openai" && provider !== "elevenlabs")) {
      return NextResponse.json(
        { error: "Valid provider (openai or elevenlabs) is required" },
        { status: 400 }
      );
    }

    if (!voiceId) {
      return NextResponse.json(
        { error: "Voice ID is required" },
        { status: 400 }
      );
    }

    console.log(
      `[TTS API] Generating speech with ${provider} using voice ${voiceId}`
    );

    // Generate speech based on provider
    if (provider === "openai") {
      // Cast the voiceId to the appropriate type for OpenAI
      const openaiVoice = voiceId as
        | "alloy"
        | "echo"
        | "fable"
        | "onyx"
        | "nova"
        | "shimmer";

      console.log(`[TTS API] Using OpenAI voice: ${openaiVoice}`);

      const { audio } = await generateSpeech({
        model: openai.speech("tts-1"),
        text,
        voice: openaiVoice,
      });

      // Return the audio data
      return new NextResponse(Buffer.from(audio.base64, "base64"), {
        headers: {
          "Content-Type": audio.mediaType,
          "Content-Disposition": `attachment; filename="speech.${audio.format}"`,
        },
      });
    } else {
      console.log(`[TTS API] Using ElevenLabs voice: ${voiceId}`);

      const { audio } = await generateSpeech({
        model: elevenlabs.speech("eleven_flash_v2_5"),
        text,
        voice: voiceId,
      });

      // Return the audio data
      return new NextResponse(Buffer.from(audio.base64, "base64"), {
        headers: {
          "Content-Type": audio.mediaType,
          "Content-Disposition": `attachment; filename="speech.${audio.format}"`,
        },
      });
    }
  } catch (error) {
    console.error(`[TTS API] Error generating speech:`, error);
    return NextResponse.json(
      { error: "Failed to generate speech" },
      { status: 500 }
    );
  }
}
