/**
 * Player Agent Factory
 *
 * Creates player agents using unified group generation.
 * Single LLM call generates the entire friend group with
 * coherent names, relationships, and shared history.
 */

import type { ArchetypeId, PlayerModel } from '../archetypes/types';
import { ARCHETYPE_BY_ID } from '../archetypes/definitions';
import { ARCHETYPE_MODEL_MAP } from '../archetypes/types';
import {
  generateGroup,
  type StoryContext as GeneratorStoryContext,
  type GeneratedGroup,
  type GeneratedPlayer,
} from './character-generator';

export interface PlayerAgent {
  archetype: ArchetypeId;
  name: string;
  model: PlayerModel;
  modelId: string;
  identity: GeneratedPlayer;
  systemPrompt: string;
}

export interface StoryContext {
  storyId: string;
  storyTitle: string;
  storySetting: string;
  storyGenre: string;
}

/**
 * Compose system prompt for player agent
 */
function composeSystemPrompt(
  player: GeneratedPlayer,
  group: GeneratedGroup['group'],
  otherPlayers: GeneratedPlayer[],
  storyContext: StoryContext,
  language = 'english',
): string {
  const archetype = ARCHETYPE_BY_ID[player.archetypeId];
  if (!archetype) {
    throw new Error(`Unknown archetype: ${player.archetypeId}`);
  }

  // Build relationships section
  const relationshipsText =
    otherPlayers.length > 0
      ? otherPlayers
          .map((p) => {
            const rel = player.relationships.find((r) => r.name === p.name);
            return `- ${p.name}: ${rel?.relationship || 'friend'}`;
          })
          .join('\n')
      : '- Playing solo tonight (no other players)';

  const sharedMemoriesText = group.sharedMemories
    .map((m) => `- ${m}`)
    .join('\n');

  const languageInstruction =
    language !== 'english'
      ? `\n\nIMPORTANT: Respond ONLY in ${language}. All your dialogue and responses must be in ${language}.`
      : '';

  return `You are ${player.name}, playing an interactive fiction game with friends.

## Your Friend Group
${group.relationship}. You've ${group.history}.

Tonight: ${group.occasion}

${group.organizer} suggested "${storyContext.storyTitle}" because ${group.storyReason}.

Group vibe: ${group.dynamic}

## Your Friends Tonight
${relationshipsText}

## Shared History
You might naturally reference these memories during tangents:
${sharedMemoriesText}

## Who You Are
In the group: ${player.groupRole}

Why you're here: ${player.personalReason}

Tonight you're ${player.currentState}.

Background: ${player.backstory}

## Your Play Style
${archetype.style}

Behavioral patterns:
${archetype.patterns.map((p) => `- ${p}`).join('\n')}

## Two Layers of Character

You exist on two levels - this is CRITICAL to understand:

**OUTER Character (you, ${player.name}):**
- Your real identity sitting at game night
- ${player.backstory}
- This is who you are in REAL LIFE

**INNER Character (you CREATE this when the narrator asks):**
- A FICTIONAL persona you INVENT for the story
- NOT yourself - a completely different person
- Has their own NAME (not ${player.name}), ROLE, BACKSTORY
- Should fit the story's genre and setting
- Example: "I'll play Dr. Helena Marsh, an occult researcher from Boston"

## CRITICAL: When the Narrator Asks "Who Are You?"

When the narrator asks for your character, backstory, or who you are in the story:
- DO NOT describe yourself (${player.name}, your real job, your real life)
- INSTEAD: INVENT a fictional character to play
- Give them a NAME, a ROLE (journalist, professor, drifter, etc.), and a REASON for being in the story
- Coordinate with friends: "I'll be the skeptic" / "Great, I'll be the believer"

Example WRONG response: "I'm ${player.name}, I work as a designer and love horror games"
Example RIGHT response: "I'll play Eleanor Marsh, a local historian researching her family's connection to this town"

During gameplay after character creation, speak AS your inner character.
You can break character for commentary: "(${player.name}: This is so creepy!)"

## How to Play
- Respond as ${player.name} would with these specific friends
- Reference shared history naturally when tangents happen (don't force it)
- React to friends by name: "${otherPlayers.map((p) => p.name).join('", "')}"
- Your personality quirk shows ~${Math.round(archetype.quirkFrequency * 100)}% of the time
- Stay in character but adapt to what the story needs
- Keep responses concise (1-3 sentences typically)
- You're ONE player in a GROUP - listen, contribute, don't dominate

IMPORTANT:
- You're with friends playing a game - be natural, be yourself
- Tangents are fine - you have shared history to reference
- When the narrator asks you a personality question, draw from your backstory
- During discussions with friends, speak as yourself (${player.name})
- During gameplay, speak as your story character${languageInstruction}`;
}

/**
 * Create multiple player agents with unified group generation
 *
 * Single LLM call generates the entire group with coherent
 * names and relationships.
 */
export async function createPlayerAgents(
  archetypeIds: ArchetypeId[],
  storyContext: StoryContext,
  language = 'english',
): Promise<PlayerAgent[]> {
  // Convert to generator story context format
  const generatorContext: GeneratorStoryContext = {
    storyId: storyContext.storyId,
    title: storyContext.storyTitle,
    description: storyContext.storySetting,
    genre: storyContext.storyGenre,
  };

  console.log('\n--- Group Generation ---\n');

  // Single LLM call generates everything
  const generated = await generateGroup(
    generatorContext,
    archetypeIds,
    language,
  );

  // Log generated group
  console.log(
    `📋 ${generated.group.relationship} | ${generated.group.occasion}`,
  );
  console.log(`👥 ${generated.players.map((p) => p.name).join(', ')}\n`);

  // Log character backstories with archetypes
  for (let i = 0; i < generated.players.length; i++) {
    const player = generated.players[i];
    const archetypeId = archetypeIds[i];
    console.log(`   ${player.name} (${archetypeId}): ${player.backstory}`);
  }

  // Build player agents
  const agents: PlayerAgent[] = [];

  for (let i = 0; i < generated.players.length; i++) {
    const player = generated.players[i];
    const archetypeId = archetypeIds[i];
    const archetype = ARCHETYPE_BY_ID[archetypeId];

    if (!archetype || !player) {
      throw new Error(`Failed to create agent for archetype ${archetypeId}`);
    }

    // Other players (everyone except this one)
    const otherPlayers = generated.players.filter((_, idx) => idx !== i);

    const systemPrompt = composeSystemPrompt(
      player,
      generated.group,
      otherPlayers,
      storyContext,
      language,
    );

    agents.push({
      archetype: archetypeId,
      name: player.name,
      model: archetype.model,
      modelId: ARCHETYPE_MODEL_MAP[archetype.model] || '',
      identity: player,
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
