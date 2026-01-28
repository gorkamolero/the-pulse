/**
 * Hume TTS Provider
 *
 * Uses Hume's expressive AI voice synthesis
 * Supports emotional instructions for voice expression
 */

import { experimental_generateSpeech as generateSpeech } from "ai";
import { hume } from "@ai-sdk/hume";
import type { ITTSProvider, TTSRequest, TTSResult, TTSVoice } from "./types";

// Hume voice catalog - these are example voice IDs
// Full list available at https://dev.hume.ai/docs/text-to-speech/voices
const HUME_VOICES: TTSVoice[] = [
  {
    id: "ITO",
    name: "Ito",
    description: "Warm, articulate narrator",
    provider: "hume",
  },
  {
    id: "KORA",
    name: "Kora",
    description: "Friendly, engaging voice",
    provider: "hume",
  },
  {
    id: "STELLA",
    name: "Stella",
    description: "Professional, clear voice",
    provider: "hume",
  },
  {
    id: "DACHER",
    name: "Dacher",
    description: "Deep, authoritative voice",
    provider: "hume",
  },
];

export const DEFAULT_HUME_VOICE_ID = "ITO";

export class HumeProvider implements ITTSProvider {
  readonly name = "hume" as const;
  private instructions?: string;

  constructor(instructions?: string) {
    // Default emotional instructions for horror storytelling
    this.instructions = instructions || "A dramatic, atmospheric narrator with subtle tension in the voice.";
  }

  async generateSpeech(request: TTSRequest): Promise<TTSResult> {
    const { audio } = await generateSpeech({
      model: hume.speech(),
      text: request.text,
      voice: request.voiceId,
      providerOptions: {
        hume: {
          instructions: this.instructions,
        },
      },
    });

    if (!audio?.base64) {
      throw new Error("Hume: No audio data received");
    }

    return {
      audioBase64: audio.base64,
      contentType: audio.mediaType || "audio/mpeg",
    };
  }

  getVoices(): TTSVoice[] {
    return HUME_VOICES;
  }

  /**
   * Set emotional instructions for voice expression
   */
  setInstructions(instructions: string): void {
    this.instructions = instructions;
  }
}
