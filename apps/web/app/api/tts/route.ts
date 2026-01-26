import { experimental_generateSpeech as generateSpeech } from "ai";
import { elevenlabs } from "@ai-sdk/elevenlabs";
import { type NextRequest, NextResponse } from "next/server";
import { DEFAULT_VOICE_ID } from "@pulse/core/ai/models";

/**
 * POST handler for text-to-speech API (ElevenLabs only)
 */
export async function POST(request: NextRequest) {
  try {
    const { text, voiceId } = await request.json();

    if (!text) {
      return NextResponse.json({ error: "Text is required" }, { status: 400 });
    }

    const voice = voiceId || DEFAULT_VOICE_ID;

    console.log(`[TTS API] Generating speech with ElevenLabs voice ${voice}`);

    const { audio } = await generateSpeech({
      model: elevenlabs.speech("eleven_flash_v2_5"),
      text,
      voice,
    });

    return new NextResponse(Buffer.from(audio.base64, "base64"), {
      headers: {
        "Content-Type": audio.mediaType,
        "Content-Disposition": `attachment; filename="speech.${audio.format}"`,
      },
    });
  } catch (error) {
    console.error(`[TTS API] Error generating speech:`, error);
    return NextResponse.json(
      { error: "Failed to generate speech" },
      { status: 500 }
    );
  }
}
