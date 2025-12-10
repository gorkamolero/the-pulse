/**
 * Player Agent Factory
 *
 * Creates player agents using group-aware character generation.
 * Generates friend group context first, then individual characters
 * with relationships and shared history.
 */

import type { ArchetypeId, PlayerModel, GroupContext, PlayerIdentity } from '../archetypes/types';
import { ARCHETYPE_BY_ID } from '../archetypes/definitions';
import { ARCHETYPE_MODEL_MAP } from '../archetypes/types';
import {
  generateGroupContext,
  generatePlayerIdentity,
  type StoryContext as GeneratorStoryContext,
} from './character-generator';

export interface PlayerAgent {
  archetype: ArchetypeId;
  name: string;
  model: PlayerModel;
  modelId: string;
  identity: PlayerIdentity;
  systemPrompt: string;
}

export interface StoryContext {
  storyId: string;
  storyTitle: string;
  storySetting: string;
  storyGenre: string;
}

/**
 * Compose system prompt for player agent with group context
 */
export function composeSystemPrompt(
  archetypeId: ArchetypeId,
  identity: PlayerIdentity,
  groupContext: GroupContext,
  otherPlayers: PlayerIdentity[],
  storyContext: StoryContext,
): string {
  const archetype = ARCHETYPE_BY_ID[archetypeId];
  if (!archetype) {
    throw new Error(`Unknown archetype: ${archetypeId}`);
  }

  // Build relationships section
  const relationshipsText =
    otherPlayers.length > 0
      ? otherPlayers
          .map((p) => {
            const relationship = identity.relationships[p.name] || 'friend';
            return `- ${p.name}: ${relationship}`;
          })
          .join('\n')
      : '- Playing solo tonight (no other players)';

  const sharedMemoriesText = groupContext.sharedMemories
    .map((m) => `- ${m}`)
    .join('\n');

  return `You are ${identity.name}, playing an interactive fiction game with friends.

## Your Friend Group
${groupContext.relationship}. You've ${groupContext.history}.

Tonight: ${groupContext.occasion}

${groupContext.organizer} suggested "${storyContext.storyTitle}" because ${groupContext.storyReason}.

Group vibe: ${groupContext.dynamic}

## Your Friends Tonight
${relationshipsText}

## Shared History
You might naturally reference these memories during tangents:
${sharedMemoriesText}

## Who You Are
In the group: ${identity.groupRole}

Why you're here: ${identity.personalReason}

Tonight you're ${identity.currentState}.

Background: ${identity.backstory}

## Your Play Style
${archetype.style}

Behavioral patterns:
${archetype.patterns.map((p) => `- ${p}`).join('\n')}

## How to Play
- Respond as ${identity.name} would with these specific friends
- Reference shared history naturally when tangents happen (don't force it)
- React to friends by name: "${otherPlayers.map((p) => p.name).join('", "')}"
- Your personality quirk shows ~${Math.round(archetype.quirkFrequency * 100)}% of the time
- Stay in character but adapt to what the story needs
- Keep responses concise (1-3 sentences typically)
- You're ONE player in a GROUP - listen, contribute, don't dominate

IMPORTANT:
- NEVER break character or refer to yourself as an AI
- You're with friends playing a game - be natural, be yourself
- Tangents are fine - you have shared history to reference
- When the narrator asks you a personality question, draw from your backstory`;
}

/**
 * Create multiple player agents with group-aware generation
 *
 * This is now async because it calls LLMs to generate group context
 * and individual identities.
 */
export async function createPlayerAgents(
  archetypeIds: ArchetypeId[],
  storyContext: StoryContext,
): Promise<PlayerAgent[]> {
  // Convert to generator story context format
  const generatorContext: GeneratorStoryContext = {
    storyId: storyContext.storyId,
    title: storyContext.storyTitle,
    description: storyContext.storySetting,
    genre: storyContext.storyGenre,
  };

  // Step 1: Generate group context
  console.log('  Generating group context...');
  const groupContext = await generateGroupContext(generatorContext, archetypeIds);

  // Step 2: Generate player identities sequentially
  console.log('  Generating player identities...');
  const identities: PlayerIdentity[] = [];

  for (const archetypeId of archetypeIds) {
    const identity = await generatePlayerIdentity(
      groupContext,
      archetypeId,
      identities, // Pass existing players so they can form relationships
      generatorContext,
    );
    identities.push(identity);
    console.log(`    Created: ${identity.name} (${ARCHETYPE_BY_ID[archetypeId]?.name})`);
  }

  // Step 3: Compose system prompts for all players
  console.log('  Composing system prompts...');
  const agents: PlayerAgent[] = [];

  for (let i = 0; i < archetypeIds.length; i++) {
    const archetypeId = archetypeIds[i];
    const identity = identities[i];
    const archetype = ARCHETYPE_BY_ID[archetypeId];

    if (!archetype || !identity) {
      throw new Error(`Failed to create agent for archetype ${archetypeId}`);
    }

    // Other players (everyone except this one)
    const otherPlayers = identities.filter((_, idx) => idx !== i);

    const systemPrompt = composeSystemPrompt(
      archetypeId,
      identity,
      groupContext,
      otherPlayers,
      storyContext,
    );

    agents.push({
      archetype: archetypeId,
      name: identity.name,
      model: archetype.model,
      modelId: ARCHETYPE_MODEL_MAP[archetype.model] || '',
      identity,
      systemPrompt,
    });
  }

  return agents;
}

/**
 * Create a single player agent
 *
 * For single-player scenarios, we still generate a minimal group context.
 */
export async function createPlayerAgent(
  archetypeId: ArchetypeId,
  storyContext: StoryContext,
): Promise<PlayerAgent> {
  const agents = await createPlayerAgents([archetypeId], storyContext);
  return agents[0] || ({} as PlayerAgent);
}
