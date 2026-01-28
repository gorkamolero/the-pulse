/**
 * TTS Provider Abstraction Types
 *
 * Allows switching between ElevenLabs and MiniMax (or other providers)
 */

export type TTSProvider = "elevenlabs" | "minimax" | "hume" | "lmnt";

export interface TTSVoice {
  id: string;
  name: string;
  description?: string;
  provider: TTSProvider;
}

export interface TTSRequest {
  text: string;
  voiceId: string;
  /** Optional model override (provider-specific) */
  model?: string;
}

export interface TTSResult {
  /** Base64-encoded audio data */
  audioBase64: string;
  /** MIME type (e.g., "audio/mpeg") */
  contentType: string;
}

export interface TTSProviderConfig {
  provider: TTSProvider;
  apiKey: string;
  /** MiniMax requires group ID */
  groupId?: string;
  /** Default model for this provider */
  defaultModel?: string;
}

/**
 * Provider interface - each TTS provider implements this
 */
export interface ITTSProvider {
  readonly name: TTSProvider;

  /**
   * Generate speech from text
   */
  generateSpeech(request: TTSRequest): Promise<TTSResult>;

  /**
   * Get available voices for this provider
   */
  getVoices(): TTSVoice[];
}
