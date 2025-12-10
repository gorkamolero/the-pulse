/**
 * Group-Aware Character Generation
 *
 * Generates friend groups with shared history and relationships,
 * then creates individual characters within that context.
 */

import { generateText } from 'ai';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import type { GroupContext, PlayerIdentity, ArchetypeId } from '../archetypes/types';
import { ARCHETYPE_BY_ID } from '../archetypes/definitions';

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
});

/**
 * Story context for character generation
 */
export interface StoryContext {
  storyId: string;
  title: string;
  description: string;
  genre: string;
}

/**
 * Generate friend group context
 *
 * Single LLM call that establishes how the players know each other,
 * shared history, and why they're playing together tonight.
 */
export async function generateGroupContext(
  storyContext: StoryContext,
  archetypeIds: ArchetypeId[],
): Promise<GroupContext> {
  const archetypeDescriptions = archetypeIds
    .map((id) => {
      const archetype = ARCHETYPE_BY_ID[id];
      return `${archetype.name}: ${archetype.style}`;
    })
    .join(', ');

  const prompt = `Generate a friend group context for ${archetypeIds.length} people about to play an interactive fiction game.

Story they're playing: "${storyContext.title}" - ${storyContext.description}

The group has these personality types: ${archetypeDescriptions}

Create a believable friend group. They should:
- Have a clear relationship (how they met, how long ago)
- Have a reason for tonight's session (game night, birthday, killing time, etc.)
- Have someone who suggested this specific story
- Have 2-3 shared memories they might reference during play (inside jokes, shared experiences)
- Feel like real friends, not strangers

Output ONLY valid JSON matching this exact schema:
{
  "relationship": "string describing how they know each other",
  "history": "string describing how long they've known each other",
  "occasion": "string describing why they're playing tonight",
  "organizer": "string naming who found The Pulse and suggested it",
  "storyReason": "string explaining why they picked this specific story",
  "dynamic": "string describing the group's vibe/energy",
  "sharedMemories": ["memory 1", "memory 2", "memory 3"]
}

Be creative. Make them feel like actual friends with history.`;

  const result = await generateText({
    model: openrouter('x-ai/grok-4'),
    prompt,
    temperature: 0.8,
  });

  // Parse JSON response
  const jsonMatch = result.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Failed to parse group context JSON from LLM response');
  }

  const groupContext = JSON.parse(jsonMatch[0]) as GroupContext;

  // Validate required fields
  if (
    !groupContext.relationship ||
    !groupContext.history ||
    !groupContext.occasion ||
    !groupContext.organizer ||
    !groupContext.storyReason ||
    !groupContext.dynamic ||
    !Array.isArray(groupContext.sharedMemories)
  ) {
    throw new Error('Invalid group context structure from LLM');
  }

  return groupContext;
}

/**
 * Generate individual player identity within group context
 *
 * Called sequentially for each player, so each can see the players
 * already generated and form relationships with them.
 */
export async function generatePlayerIdentity(
  groupContext: GroupContext,
  archetypeId: ArchetypeId,
  existingPlayers: PlayerIdentity[],
  storyContext: StoryContext,
): Promise<PlayerIdentity> {
  const archetype = ARCHETYPE_BY_ID[archetypeId];

  const existingPlayersDesc =
    existingPlayers.length > 0
      ? existingPlayers.map((p) => `- ${p.name}: ${p.groupRole}`).join('\n')
      : 'None yet - this is the first player';

  const prompt = `Generate a player character for a group interactive fiction session.

GROUP CONTEXT:
${JSON.stringify(groupContext, null, 2)}

OTHER PLAYERS ALREADY CREATED:
${existingPlayersDesc}

THIS PLAYER'S ARCHETYPE:
${archetype.name}: ${archetype.style}
Behavioral patterns: ${archetype.patterns.join(', ')}

Generate a character who:
- Fits naturally into this friend group
- Has specific relationships to the other players (use their actual names: ${existingPlayers.map((p) => p.name).join(', ') || 'none yet'})
- Has a reason for being here tonight that fits the occasion
- Matches the archetype's personality
- Feels like a real person, not a game character

Output ONLY valid JSON matching this exact schema:
{
  "name": "string - a natural first name",
  "groupRole": "string - their role in friend group (e.g., 'the responsible one', 'always late')",
  "relationships": {
    ${existingPlayers.map((p) => `"${p.name}": "string describing relationship"`).join(',\n    ')}
  },
  "personalReason": "string - why they're here tonight specifically",
  "currentState": "string - their mood/energy tonight",
  "backstory": "string - 2-3 sentences about their background for narrator personality questions"
}

Be creative and natural. Make them feel real.`;

  const result = await generateText({
    model: openrouter('x-ai/grok-4'),
    prompt,
    temperature: 0.8,
  });

  // Parse JSON response
  const jsonMatch = result.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Failed to parse player identity JSON from LLM response');
  }

  const identity = JSON.parse(jsonMatch[0]) as PlayerIdentity;

  // Validate required fields
  if (
    !identity.name ||
    !identity.groupRole ||
    !identity.personalReason ||
    !identity.currentState ||
    !identity.backstory
  ) {
    throw new Error('Invalid player identity structure from LLM');
  }

  // Ensure relationships object exists (might be empty for first player)
  if (!identity.relationships) {
    identity.relationships = {};
  }

  return identity;
}
