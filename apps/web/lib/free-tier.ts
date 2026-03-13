import { getFreeStoryStatus, getUserSettings } from './db/queries';

export type FreeTierStatus = {
  allowed: boolean;
  reason?: 'no_free_story' | 'story_in_progress' | 'degraded_mode';
  storyId?: string;
};

/**
 * Check if a user can use the free story tier
 */
export async function canUseFreeStory(userId: string): Promise<FreeTierStatus> {
  const status = await getFreeStoryStatus(userId);

  // User is in degraded mode (misuse detected)
  if (status.isDegraded) {
    return {
      allowed: true, // Still allowed, but will use degraded model
      reason: 'degraded_mode',
    };
  }

  // User already has a story in progress
  if (status.storyInProgress) {
    return {
      allowed: true,
      reason: 'story_in_progress',
      storyId: status.storyInProgress,
    };
  }

  // User hasn't used their free story yet
  if (status.hasFreeTier) {
    return { allowed: true };
  }

  // User has already completed their free story
  return {
    allowed: false,
    reason: 'no_free_story',
  };
}

export type ModelTier = {
  canUse: boolean;
  usingUserKey: boolean;
  isDegraded: boolean;
  reason?: string;
};

/**
 * Determine which model tier a user can access
 */
export async function getModelTierForUser(userId: string): Promise<ModelTier> {
  const settings = await getUserSettings(userId);

  // User has their own API key - full access
  if (settings?.aiGatewayApiKey || settings?.openrouterApiKey) {
    return {
      canUse: true,
      usingUserKey: true,
      isDegraded: false,
    };
  }

  // User in degraded mode (misuse detected) - still allowed but on cheap model
  if (settings?.degradedMode) {
    return {
      canUse: true,
      usingUserKey: false,
      isDegraded: true,
      reason: 'Using limited model due to usage policy.',
    };
  }

  // All authenticated users play free — no gate for launch
  return {
    canUse: true,
    usingUserKey: false,
    isDegraded: false,
  };
}
