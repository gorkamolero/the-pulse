/**
 * LMNT TTS Provider
 *
 * Uses LMNT's ultra-fast, low-latency speech synthesis
 * Supports multiple languages and high-quality voices
 */

import { experimental_generateSpeech as generateSpeech } from "ai";
import { lmnt } from "@ai-sdk/lmnt";
import type { ITTSProvider, TTSRequest, TTSResult, TTSVoice } from "./types";

// LMNT voice catalog
// Full list available at https://docs.lmnt.com/reference/voices
const LMNT_VOICES: TTSVoice[] = [
  {
    id: "034b632b-df71-46c8-b440-86a42ffc3cf3",
    name: "Henry",
    description: "Warm, authoritative male narrator",
    provider: "lmnt",
  },
  {
    id: "ava",
    name: "Ava",
    description: "Clear, professional female voice",
    provider: "lmnt",
  },
  {
    id: "miles",
    name: "Miles",
    description: "Friendly, conversational male voice",
    provider: "lmnt",
  },
  {
    id: "sarah",
    name: "Sarah",
    description: "Warm, engaging female narrator",
    provider: "lmnt",
  },
  {
    id: "oliver",
    name: "Oliver",
    description: "British, sophisticated male voice",
    provider: "lmnt",
  },
];

export const DEFAULT_LMNT_MODEL = "aurora";
export const DEFAULT_LMNT_VOICE_ID = "034b632b-df71-46c8-b440-86a42ffc3cf3"; // Henry

export class LMNTProvider implements ITTSProvider {
  readonly name = "lmnt" as const;
  private model: string;
  private language?: string;

  constructor(model: string = DEFAULT_LMNT_MODEL, language?: string) {
    this.model = model;
    this.language = language || "en";
  }

  async generateSpeech(request: TTSRequest): Promise<TTSResult> {
    const model = request.model || this.model;

    const { audio } = await generateSpeech({
      model: lmnt.speech(model),
      text: request.text,
      voice: request.voiceId,
      providerOptions: {
        lmnt: {
          language: this.language,
        },
      },
    });

    if (!audio?.base64) {
      throw new Error("LMNT: No audio data received");
    }

    return {
      audioBase64: audio.base64,
      contentType: audio.mediaType || "audio/mpeg",
    };
  }

  getVoices(): TTSVoice[] {
    return LMNT_VOICES;
  }

  /**
   * Set the language for speech synthesis
   */
  setLanguage(language: string): void {
    this.language = language;
  }
}
