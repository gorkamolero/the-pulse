import { gateway, createGateway, type LanguageModel } from 'ai';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { getUserSettings } from '@/lib/db/queries';
import { decrypt } from '@/lib/crypto';
import { getModelTierForUser } from '@/lib/free-tier';

// Degraded model for users with misuse warnings
const DEGRADED_MODEL = 'google/gemini-2.5-flash-lite';

export type ModelResult = {
  model: LanguageModel;
  usingUserKey: boolean;
  isDegraded: boolean;
  provider: 'ai-gateway' | 'openrouter' | 'server';
};

export type CreateModelOptions = {
  userId: string;
  modelId: string;
  preferredProvider?: 'ai-gateway' | 'openrouter';
};

/**
 * Create a model instance for a user, handling:
 * - User's own API key (if configured)
 * - Free tier access (if available)
 * - Degraded mode (if misuse detected)
 *
 * @throws Error with code 'FREE_TIER_EXHAUSTED' if user has no access
 */
export async function createUserModel({
  userId,
  modelId,
  preferredProvider = 'ai-gateway',
}: CreateModelOptions): Promise<ModelResult> {
  const settings = await getUserSettings(userId);
  const tier = await getModelTierForUser(userId);

  // Check if user has access at all
  if (!tier.canUse) {
    const error = new Error(tier.reason || 'Access denied');
    error.name = 'FREE_TIER_EXHAUSTED';
    throw error;
  }

  // User has their own API key - use it
  if (tier.usingUserKey && settings) {
    // Prefer AI Gateway key if available, otherwise use OpenRouter
    if (settings.aiGatewayApiKey) {
      const decryptedKey = decrypt(settings.aiGatewayApiKey);
      const customGateway = createGateway({ apiKey: decryptedKey });
      return {
        model: customGateway(modelId),
        usingUserKey: true,
        isDegraded: false,
        provider: 'ai-gateway',
      };
    }

    if (settings.openrouterApiKey) {
      const decryptedKey = decrypt(settings.openrouterApiKey);
      const openrouter = createOpenRouter({ apiKey: decryptedKey });
      return {
        model: openrouter(modelId),
        usingUserKey: true,
        isDegraded: false,
        provider: 'openrouter',
      };
    }
  }

  // User in degraded mode - use cheap model with server key
  if (tier.isDegraded) {
    return {
      model: gateway(DEGRADED_MODEL),
      usingUserKey: false,
      isDegraded: true,
      provider: 'server',
    };
  }

  // Free tier - use server key with requested model
  return {
    model: gateway(modelId),
    usingUserKey: false,
    isDegraded: false,
    provider: 'server',
  };
}

/**
 * Get a simple model for non-user-specific tasks (like title generation)
 * Uses server key
 */
export function getServerModel(modelId: string): LanguageModel {
  return gateway(modelId);
}
