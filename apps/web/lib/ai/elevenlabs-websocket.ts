import WebSocket from "ws";
import { DEFAULT_VOICE_ID } from "@pulse/core/ai/models";

interface ElevenLabsStreamOptions {
  voiceId?: string;
  modelId?: string;
  onAudioChunk?: (chunk: Buffer) => void;
  onError?: (error: Error) => void;
  onClose?: () => void;
}

interface AudioChunkMessage {
  audio?: string; // base64 encoded audio
  isFinal?: boolean;
  normalizedAlignment?: {
    char_start_times_ms: number[];
    chars_durations_ms: number[];
    chars: string[];
  };
}

/**
 * Creates a streaming connection to ElevenLabs WebSocket TTS API.
 * Returns an object with methods to send text and close the connection.
 */
export function createElevenLabsStream(options: ElevenLabsStreamOptions = {}) {
  const {
    voiceId = DEFAULT_VOICE_ID,
    modelId = "eleven_flash_v2_5",
    onAudioChunk,
    onError,
    onClose,
  } = options;

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    throw new Error("ELEVENLABS_API_KEY environment variable is required");
  }

  // Build WebSocket URL with query parameters
  const wsUrl = new URL(
    `wss://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream-input`
  );
  wsUrl.searchParams.set("model_id", modelId);
  wsUrl.searchParams.set("output_format", "mp3_44100_128");
  wsUrl.searchParams.set("auto_mode", "true"); // Lower latency for full sentences

  const ws = new WebSocket(wsUrl.toString(), {
    headers: {
      "xi-api-key": apiKey,
    },
  });

  let isConnected = false;
  let connectionPromiseResolve: (() => void) | null = null;
  let connectionPromiseReject: ((error: Error) => void) | null = null;

  const connectionPromise = new Promise<void>((resolve, reject) => {
    connectionPromiseResolve = resolve;
    connectionPromiseReject = reject;
  });

  ws.on("open", () => {
    isConnected = true;

    // Send initialization message with voice settings
    ws.send(
      JSON.stringify({
        text: " ", // Initial empty text to prime the connection
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
          style: 0.0,
          use_speaker_boost: true,
        },
        generation_config: {
          chunk_length_schedule: [120, 160, 250, 290],
        },
      })
    );

    connectionPromiseResolve?.();
  });

  ws.on("message", (data: Buffer) => {
    try {
      const message: AudioChunkMessage = JSON.parse(data.toString());

      if (message.audio) {
        // Decode base64 audio and send to callback
        const audioBuffer = Buffer.from(message.audio, "base64");
        onAudioChunk?.(audioBuffer);
      }

    } catch (error) {
      // Non-JSON message, might be binary audio
      if (Buffer.isBuffer(data)) {
        onAudioChunk?.(data);
      }
    }
  });

  ws.on("error", (error) => {
    onError?.(error);
    connectionPromiseReject?.(error);
  });

  ws.on("close", () => {
    isConnected = false;
    onClose?.();
  });

  return {
    /**
     * Wait for the WebSocket connection to be established
     */
    waitForConnection: () => connectionPromise,

    /**
     * Send a text chunk to be converted to speech
     */
    sendText: (text: string) => {
      if (!isConnected) {
        return;
      }

      ws.send(
        JSON.stringify({
          text,
          try_trigger_generation: true,
        })
      );
    },

    /**
     * Flush any remaining text and signal end of input
     */
    flush: () => {
      if (!isConnected) {
        return;
      }

      ws.send(
        JSON.stringify({
          text: "",
          flush: true,
        })
      );
    },

    /**
     * Close the WebSocket connection
     */
    close: () => {
      if (ws.readyState === WebSocket.OPEN) {
        // Send close message
        ws.send(JSON.stringify({ close: true }));
        ws.close();
      }
    },

    /**
     * Check if the connection is open
     */
    isOpen: () => isConnected && ws.readyState === WebSocket.OPEN,
  };
}

/**
 * Streams text to ElevenLabs and collects all audio chunks into a single buffer.
 * Useful for simpler use cases where you don't need real-time streaming.
 */
export async function textToSpeechStream(
  text: string,
  options: Omit<ElevenLabsStreamOptions, "onAudioChunk" | "onClose"> = {}
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];

    const stream = createElevenLabsStream({
      ...options,
      onAudioChunk: (chunk) => {
        chunks.push(chunk);
      },
      onError: (error) => {
        reject(error);
      },
      onClose: () => {
        resolve(Buffer.concat(chunks));
      },
    });

    stream.waitForConnection().then(() => {
      stream.sendText(text);
      stream.flush();

      // Close after a delay to ensure all audio is received
      setTimeout(() => {
        stream.close();
      }, 5000);
    });
  });
}
