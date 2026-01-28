/**
 * MiniMax TTS Provider
 *
 * Uses MiniMax T2A V2 API for high-quality text-to-speech
 * https://platform.minimax.io/docs/api-reference/speech-t2a-http
 */

import type { ITTSProvider, TTSRequest, TTSResult, TTSVoice } from "./types";

// MiniMax voice catalog
const MINIMAX_VOICES: TTSVoice[] = [
  {
    id: "English_expressive_narrator",
    name: "Expressive Narrator",
    description: "Dramatic English narrator with emotional range",
    provider: "minimax",
  },
  {
    id: "Deep_Voice_Man",
    name: "Deep Voice Man",
    description: "Deep, resonant male voice",
    provider: "minimax",
  },
  {
    id: "Wise_Woman",
    name: "Wise Woman",
    description: "Warm, wise female narrator",
    provider: "minimax",
  },
  {
    id: "male-qn-qingse",
    name: "Qingse (Male)",
    description: "Clear male voice",
    provider: "minimax",
  },
  {
    id: "female-shaonv",
    name: "Shaonv (Female)",
    description: "Young female voice",
    provider: "minimax",
  },
  {
    id: "presenter_male",
    name: "Presenter Male",
    description: "Professional male presenter",
    provider: "minimax",
  },
  {
    id: "presenter_female",
    name: "Presenter Female",
    description: "Professional female presenter",
    provider: "minimax",
  },
];

export const DEFAULT_MINIMAX_MODEL = "speech-02-hd";
export const DEFAULT_MINIMAX_VOICE_ID = "English_expressive_narrator";

const MINIMAX_API_URL = "https://api.minimax.io/v1/t2a_v2";

interface MiniMaxT2ARequest {
  model: string;
  text: string;
  stream: boolean;
  language_boost: string;
  output_format: string;
  voice_setting: {
    voice_id: string;
    speed: number;
    vol: number;
    pitch: number;
  };
  audio_setting: {
    sample_rate: number;
    bitrate: number;
    format: string;
    channel: number;
  };
}

interface MiniMaxT2AResponse {
  base_resp?: {
    status_code: number;
    status_msg: string;
  };
  data?: {
    audio: string; // hex-encoded audio
  };
  audio_file?: string; // Alternative field name
  extra_info?: {
    audio_length: number;
    audio_sample_rate: number;
    audio_size: number;
  };
}

export class MiniMaxProvider implements ITTSProvider {
  readonly name = "minimax" as const;
  private apiKey: string;
  private model: string;

  constructor(apiKey?: string, model: string = DEFAULT_MINIMAX_MODEL) {
    this.apiKey = apiKey || process.env.MINIMAX_API_KEY || "";
    this.model = model;

    if (!this.apiKey) {
      throw new Error("MiniMax API key is required");
    }
  }

  async generateSpeech(request: TTSRequest): Promise<TTSResult> {
    const model = request.model || this.model;

    const requestBody: MiniMaxT2ARequest = {
      model,
      text: request.text,
      stream: false,
      language_boost: "auto",
      output_format: "hex",
      voice_setting: {
        voice_id: request.voiceId,
        speed: 1,
        vol: 1,
        pitch: 0,
      },
      audio_setting: {
        sample_rate: 32000,
        bitrate: 128000,
        format: "mp3",
        channel: 1,
      },
    };

    const response = await fetch(MINIMAX_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`MiniMax API error: ${response.status} - ${errorText}`);
    }

    const result: MiniMaxT2AResponse = await response.json();

    // Check for API error
    if (result.base_resp && result.base_resp.status_code !== 0) {
      throw new Error(
        `MiniMax error: ${result.base_resp.status_msg} (code: ${result.base_resp.status_code})`
      );
    }

    // Get hex-encoded audio data
    const hexAudio = result.data?.audio || result.audio_file;
    if (!hexAudio) {
      throw new Error("MiniMax: No audio data received");
    }

    // Convert hex to base64
    const audioBuffer = Buffer.from(hexAudio, "hex");
    const audioBase64 = audioBuffer.toString("base64");

    return {
      audioBase64,
      contentType: "audio/mpeg",
    };
  }

  getVoices(): TTSVoice[] {
    return MINIMAX_VOICES;
  }
}
