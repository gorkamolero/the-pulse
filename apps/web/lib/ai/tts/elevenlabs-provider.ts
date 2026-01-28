/**
 * ElevenLabs TTS Provider
 */

import { experimental_generateSpeech as generateSpeech } from "ai";
import { elevenlabs } from "@ai-sdk/elevenlabs";
import { VOICES, DEFAULT_VOICE_ID } from "@pulse/core/ai/models";
import type { ITTSProvider, TTSRequest, TTSResult, TTSVoice } from "./types";

// Convert core voices to TTS provider format
const ELEVENLABS_VOICES: TTSVoice[] = VOICES.map((v) => ({
  id: v.id,
  name: v.name,
  description: v.description,
  provider: "elevenlabs" as const,
}));

// eleven_turbo_v2_5 = fast with good quality & emotional depth (best for narration)
// eleven_flash_v2_5 = fastest, lower emotional depth (best for chatbots)
// eleven_v3 = highest quality but 12x slower (~14s vs ~1s)
// eleven_multilingual_v2 = high quality but 6x slower
export const DEFAULT_ELEVENLABS_MODEL = "eleven_turbo_v2_5";
export const DEFAULT_ELEVENLABS_VOICE_ID = DEFAULT_VOICE_ID;

export class ElevenLabsProvider implements ITTSProvider {
  readonly name = "elevenlabs" as const;
  private model: string;

  constructor(model: string = DEFAULT_ELEVENLABS_MODEL) {
    this.model = model;
  }

  async generateSpeech(request: TTSRequest): Promise<TTSResult> {
    const model = request.model || this.model;

    const { audio } = await generateSpeech({
      model: elevenlabs.speech(model),
      text: request.text,
      voice: request.voiceId,
    });

    if (!audio?.base64) {
      throw new Error("ElevenLabs: No audio data received");
    }

    return {
      audioBase64: audio.base64,
      contentType: audio.mediaType || "audio/mpeg",
    };
  }

  getVoices(): TTSVoice[] {
    return ELEVENLABS_VOICES;
  }
}
