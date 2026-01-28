/**
 * ElevenLabs TTS Provider
 */

import { experimental_generateSpeech as generateSpeech } from "ai";
import { elevenlabs } from "@ai-sdk/elevenlabs";
import type { ITTSProvider, TTSRequest, TTSResult, TTSVoice } from "./types";

// ElevenLabs voice catalog
const ELEVENLABS_VOICES: TTSVoice[] = [
  {
    id: "qNkzaJoHLLdpvgh5tISm",
    name: "Carter the Mountain King",
    description: "Rich, smooth, & rugged",
    provider: "elevenlabs",
  },
  {
    id: "uVKHymY7OYMd6OailpG5",
    name: "Frederick",
    description: "Old Gnarly Narrator",
    provider: "elevenlabs",
  },
  {
    id: "dAcds2QMcvmv86jQMC3Y",
    name: "Jayce",
    description: "The Gangster",
    provider: "elevenlabs",
  },
  {
    id: "flHkNRp1BlvT73UL6gyz",
    name: "Jessica Anne Bogart",
    description: "Smooth female voice",
    provider: "elevenlabs",
  },
  {
    id: "0dPqNXnhg2bmxQv1WKDp",
    name: "Grandpa Oxley",
    description: "Wise elder voice",
    provider: "elevenlabs",
  },
  {
    id: "tiCdiJK6pzWPIV4PqAPp",
    name: "Innsmouth Narrator",
    description: "Shadow Over Innsmouth voice",
    provider: "elevenlabs",
  },
];

export const DEFAULT_ELEVENLABS_MODEL = "eleven_flash_v2_5";
export const DEFAULT_ELEVENLABS_VOICE_ID = "qNkzaJoHLLdpvgh5tISm";

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
