import WebSocket from "ws";
import { DEFAULT_VOICE_ID } from "@pulse/core/ai/models";

// Eleven v4 Turbo streams only over the Text to Dialogue WebSocket, which takes
// eleven_v3* / eleven_v4* models and exactly one registered voice for v4 Turbo.
export const DEFAULT_STREAMING_MODEL = "eleven_v4_turbo";

// The server ends a connection after 20s without a client message
const KEEP_ALIVE_MS = 10_000;
// Longest finish() waits for the final audio before closing anyway
const FINISH_TIMEOUT_MS = 8_000;

export interface DialogueAlignment {
  chars: string[];
  char_start_times_ms: number[];
  char_durations_ms: number[];
}

interface ElevenLabsStreamOptions {
  voiceId?: string;
  modelId?: string;
  /** Ask for character timings on each audio chunk */
  syncAlignment?: boolean;
  onAudioChunk?: (chunk: Buffer, alignment?: DialogueAlignment) => void;
  onError?: (error: Error) => void;
  onClose?: () => void;
}

interface DialogueMessage {
  audio?: string; // base64 encoded audio
  alignment?: DialogueAlignment | null;
  is_final?: boolean;
  error?: string;
  message?: string;
}

/**
 * Creates a streaming connection to the ElevenLabs Text to Dialogue WebSocket.
 * Returns an object with methods to send text and close the connection.
 */
export function createElevenLabsStream(options: ElevenLabsStreamOptions = {}) {
  const {
    voiceId = DEFAULT_VOICE_ID,
    modelId = DEFAULT_STREAMING_MODEL,
    syncAlignment = false,
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
    "wss://api.elevenlabs.io/v1/text-to-dialogue/stream-input"
  );
  wsUrl.searchParams.set("model_id", modelId);
  wsUrl.searchParams.set("output_format", "mp3_44100_128");
  if (syncAlignment) {
    wsUrl.searchParams.set("sync_alignment", "true");
  }

  const ws = new WebSocket(wsUrl.toString(), {
    headers: {
      "xi-api-key": apiKey,
    },
  });

  let isConnected = false;
  let keepAlive: ReturnType<typeof setInterval> | null = null;
  let onFinal: (() => void) | null = null;
  let connectionPromiseResolve: (() => void) | null = null;
  let connectionPromiseReject: ((error: Error) => void) | null = null;

  const connectionPromise = new Promise<void>((resolve, reject) => {
    connectionPromiseResolve = resolve;
    connectionPromiseReject = reject;
  });

  const send = (payload: object) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(payload));
    }
  };

  ws.on("open", () => {
    isConnected = true;

    // First message registers the narrator voice for the session
    send({ voices: [voiceId] });
    keepAlive = setInterval(() => send({ keep_alive: true }), KEEP_ALIVE_MS);

    connectionPromiseResolve?.();
  });

  ws.on("message", (data: Buffer) => {
    let message: DialogueMessage;
    try {
      message = JSON.parse(data.toString());
    } catch {
      return;
    }

    if (message.error) {
      onError?.(new Error(message.message ?? message.error));
      return;
    }

    if (message.audio) {
      // Decode base64 audio and send to callback
      onAudioChunk?.(
        Buffer.from(message.audio, "base64"),
        message.alignment ?? undefined
      );
    }

    if (message.is_final) {
      onFinal?.();
    }
  });

  ws.on("error", (error) => {
    onError?.(error);
    connectionPromiseReject?.(error);
  });

  ws.on("close", () => {
    isConnected = false;
    if (keepAlive) {
      clearInterval(keepAlive);
    }
    onFinal?.();
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

      send({ inputs: [{ text, voice_id: voiceId }] });
    },

    /**
     * Force generation of any buffered text without closing
     */
    flush: () => {
      if (!isConnected) {
        return;
      }

      send({ flush: true });
    },

    /**
     * Flush remaining text and resolve once the final audio chunk has arrived.
     * The server closes the connection after that.
     */
    finish: () =>
      new Promise<void>((resolve) => {
        if (!isConnected) {
          resolve();
          return;
        }

        const timeout = setTimeout(() => {
          ws.close();
        }, FINISH_TIMEOUT_MS);
        onFinal = () => {
          clearTimeout(timeout);
          onFinal = null;
          resolve();
        };
        send({ close_socket: true });
      }),

    /**
     * Close the WebSocket connection immediately
     */
    close: () => {
      if (keepAlive) {
        clearInterval(keepAlive);
      }
      if (ws.readyState === WebSocket.OPEN) {
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
    });

    stream
      .waitForConnection()
      .then(() => {
        stream.sendText(text);
        return stream.finish();
      })
      .then(() => resolve(Buffer.concat(chunks)), reject);
  });
}
