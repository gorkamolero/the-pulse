/**
 * ElevenLabs TTS Provider
 */

import { VOICES, DEFAULT_VOICE_ID } from "@pulse/core/ai/models";
import type { ITTSProvider, TTSRequest, TTSResult, TTSVoice, WordTiming } from "./types";

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
export const DEFAULT_ELEVENLABS_SPEED = 1.08;
export const DEFAULT_ELEVENLABS_VOICE_SETTINGS = {
  stability: 0.65,
  similarityBoost: 0.78,
  style: 0.12,
  useSpeakerBoost: true,
} as const;

type ElevenLabsAlignment = {
  characters: string[];
  character_start_times_seconds: number[];
  character_end_times_seconds: number[];
};

type ElevenLabsTimestampResponse = {
  audio_base64?: string;
  alignment?: ElevenLabsAlignment;
  normalized_alignment?: ElevenLabsAlignment;
};

function getWordTimingsFromAlignment(
  text: string,
  alignment?: ElevenLabsAlignment
): WordTiming[] {
  if (!alignment) return [];

  const charStartTimesMs = Array.from<number | undefined>({ length: text.length });
  const charEndTimesMs = Array.from<number | undefined>({ length: text.length });
  let textIndex = 0;

  for (let i = 0; i < alignment.characters.length; i++) {
    const startSeconds = alignment.character_start_times_seconds[i];
    const endSeconds = alignment.character_end_times_seconds[i];

    while (textIndex < text.length && text[textIndex] !== alignment.characters[i]) {
      textIndex++;
    }

    if (textIndex >= text.length) {
      break;
    }

    if (typeof startSeconds === "number" && typeof endSeconds === "number") {
      charStartTimesMs[textIndex] = Math.round(startSeconds * 1000);
      charEndTimesMs[textIndex] = Math.round(endSeconds * 1000);
    }

    textIndex++;
  }

  const wordTimings: WordTiming[] = [];
  const wordRegex = /\S+/g;
  let match = wordRegex.exec(text);

  while (match !== null) {
    const word = match[0];
    const startChar = match.index;
    const endChar = startChar + word.length;
    const characterIndexes = Array.from(
      { length: endChar - startChar },
      (_, index) => startChar + index
    ).filter(
      (index) =>
        typeof charStartTimesMs[index] === "number" &&
        typeof charEndTimesMs[index] === "number"
    );

    const firstTimedIndex = characterIndexes[0];
    const lastTimedIndex = characterIndexes.at(-1);

    if (typeof firstTimedIndex !== "number" || typeof lastTimedIndex !== "number") {
      continue;
    }

    wordTimings.push({
      word,
      startMs: charStartTimesMs[firstTimedIndex] ?? 0,
      endMs: charEndTimesMs[lastTimedIndex] ?? 0,
      startChar,
      endChar,
    });

    match = wordRegex.exec(text);
  }

  return wordTimings;
}

export class ElevenLabsProvider implements ITTSProvider {
  readonly name = "elevenlabs" as const;
  private model: string;

  constructor(model: string = DEFAULT_ELEVENLABS_MODEL) {
    this.model = model;
  }

  async generateSpeech(request: TTSRequest): Promise<TTSResult> {
    const model = request.model || this.model;
    const apiKey = process.env.ELEVENLABS_API_KEY;

    if (!apiKey) {
      throw new Error("ELEVENLABS_API_KEY environment variable is required");
    }

    const voiceSettings = request.elevenLabsVoiceSettings ?? DEFAULT_ELEVENLABS_VOICE_SETTINGS;

    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${request.voiceId}/with-timestamps`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "xi-api-key": apiKey,
        },
        body: JSON.stringify({
          text: request.text,
          model_id: model,
          output_format: "mp3_44100_128",
          voice_settings: {
            stability: voiceSettings.stability,
            similarity_boost: voiceSettings.similarityBoost,
            style: voiceSettings.style,
            use_speaker_boost: voiceSettings.useSpeakerBoost,
            speed: request.speed ?? DEFAULT_ELEVENLABS_SPEED,
          },
        }),
      },
    );

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      throw new Error(
        `ElevenLabs: Failed to generate speech (${response.status})${errorBody ? ` ${errorBody}` : ""}`
      );
    }

    const result = (await response.json()) as ElevenLabsTimestampResponse;
    const audioBase64 = result.audio_base64;

    if (!audioBase64) {
      throw new Error("ElevenLabs: No audio data received");
    }

    return {
      audioBase64,
      contentType: "audio/mpeg",
      wordTimings: getWordTimingsFromAlignment(
        request.text,
        result.alignment ?? result.normalized_alignment
      ),
    };
  }

  getVoices(): TTSVoice[] {
    return ELEVENLABS_VOICES;
  }
}
