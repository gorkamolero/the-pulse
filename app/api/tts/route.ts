import { speak } from "orate";
import { openai } from "orate/openai";
import { elevenlabs } from "orate/elevenlabs";
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
      `[Orate API] Generating speech with ${provider} using voice ${voiceId}`
    );

    // Generate speech based on provider
    let audioFile: File;

    if (provider === "openai") {
      // Cast the voiceId to the appropriate type for OpenAI
      const openaiVoice = voiceId as
        | "alloy"
        | "echo"
        | "fable"
        | "onyx"
        | "nova"
        | "shimmer";

      console.log(`[Orate API] Using OpenAI voice: ${openaiVoice}`);

      audioFile = await speak({
        model: openai.tts("tts-1", openaiVoice),
        prompt: text,
      });
    } else {
      console.log(`[Orate API] Using ElevenLabs voice: ${voiceId}`);

      audioFile = await speak({
        model: elevenlabs.tts("flash_v2_5", voiceId),
        prompt: text,
      });
    }

    // Convert File to ArrayBuffer
    const arrayBuffer = await audioFile.arrayBuffer();

    // Return the audio data
    return new NextResponse(arrayBuffer, {
      headers: {
        "Content-Type": audioFile.type,
        "Content-Disposition": `attachment; filename="speech.${
          audioFile.type.split("/")[1]
        }"`,
      },
    });
  } catch (error) {
    console.error(`[Orate API] Error generating speech:`, error);
    return NextResponse.json(
      { error: "Failed to generate speech" },
      { status: 500 }
    );
  }
}
