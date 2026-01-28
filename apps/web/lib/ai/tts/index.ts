/**
 * TTS Provider Factory
 *
 * Creates and manages TTS providers (ElevenLabs, MiniMax, Hume, LMNT)
 * Use getTTSProvider() to get the configured provider
 */

import type { ITTSProvider, TTSProvider, TTSVoice } from "./types";
import {
  ElevenLabsProvider,
  DEFAULT_ELEVENLABS_VOICE_ID,
} from "./elevenlabs-provider";
import {
  MiniMaxProvider,
  DEFAULT_MINIMAX_VOICE_ID,
} from "./minimax-provider";
import {
  HumeProvider,
  DEFAULT_HUME_VOICE_ID,
} from "./hume-provider";
import {
  LMNTProvider,
  DEFAULT_LMNT_VOICE_ID,
} from "./lmnt-provider";

export * from "./types";
export {
  ElevenLabsProvider,
  DEFAULT_ELEVENLABS_VOICE_ID,
} from "./elevenlabs-provider";
export {
  MiniMaxProvider,
  DEFAULT_MINIMAX_VOICE_ID,
} from "./minimax-provider";
export {
  HumeProvider,
  DEFAULT_HUME_VOICE_ID,
} from "./hume-provider";
export {
  LMNTProvider,
  DEFAULT_LMNT_VOICE_ID,
} from "./lmnt-provider";

/**
 * Get the default TTS provider based on environment configuration
 *
 * Set TTS_PROVIDER env var to: elevenlabs | minimax | hume | lmnt
 * Defaults to elevenlabs
 */
export function getTTSProvider(
  providerOverride?: TTSProvider
): ITTSProvider {
  const provider =
    providerOverride ||
    (process.env.TTS_PROVIDER as TTSProvider) ||
    "elevenlabs";

  switch (provider) {
    case "minimax":
      return new MiniMaxProvider();
    case "hume":
      return new HumeProvider();
    case "lmnt":
      return new LMNTProvider();
    case "elevenlabs":
    default:
      return new ElevenLabsProvider();
  }
}

/**
 * Get the default voice ID for a provider
 */
export function getDefaultVoiceId(provider: TTSProvider): string {
  switch (provider) {
    case "minimax":
      return DEFAULT_MINIMAX_VOICE_ID;
    case "hume":
      return DEFAULT_HUME_VOICE_ID;
    case "lmnt":
      return DEFAULT_LMNT_VOICE_ID;
    case "elevenlabs":
    default:
      return DEFAULT_ELEVENLABS_VOICE_ID;
  }
}

/**
 * Get all available voices across all providers
 */
export function getAllVoices(): TTSVoice[] {
  const providers: ITTSProvider[] = [
    new ElevenLabsProvider(),
  ];

  // Only include providers with API keys configured
  if (process.env.MINIMAX_API_KEY) {
    providers.push(new MiniMaxProvider());
  }
  if (process.env.HUME_API_KEY) {
    providers.push(new HumeProvider());
  }
  if (process.env.LMNT_API_KEY) {
    providers.push(new LMNTProvider());
  }

  return providers.flatMap((p) => p.getVoices());
}

/**
 * Get voices for a specific provider
 */
export function getVoicesForProvider(provider: TTSProvider): TTSVoice[] {
  const ttsProvider = getTTSProvider(provider);
  return ttsProvider.getVoices();
}

/**
 * Check if a provider is available (has required API keys)
 */
export function isProviderAvailable(provider: TTSProvider): boolean {
  switch (provider) {
    case "minimax":
      return !!process.env.MINIMAX_API_KEY;
    case "hume":
      return !!process.env.HUME_API_KEY;
    case "lmnt":
      return !!process.env.LMNT_API_KEY;
    case "elevenlabs":
      return !!process.env.ELEVENLABS_API_KEY;
    default:
      return false;
  }
}
