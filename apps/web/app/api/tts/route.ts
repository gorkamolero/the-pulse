import { type NextRequest, NextResponse } from "next/server";
import { DEFAULT_VOICE_ID } from "@pulse/core/ai/models";
import { ElevenLabsProvider } from "@/lib/ai/tts";

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
    const provider = new ElevenLabsProvider();

    const audio = await provider.generateSpeech({
      text,
      voiceId: voice,
    });

    return new NextResponse(Buffer.from(audio.audioBase64, "base64"), {
      headers: {
        "Content-Type": audio.contentType,
        "Content-Disposition": "attachment; filename=\"speech.mp3\"",
      },
    });
  } catch (error) {
    console.error("[TTS] Error generating speech:", error);
    return NextResponse.json(
      {
        error: "Failed to generate speech",
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
