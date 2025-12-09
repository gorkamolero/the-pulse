/**
 * Player Agent Factory
 *
 * Dynamically creates player agents from archetypes + story context.
 * Each agent gets a unique name, backstory, and system prompt.
 */

import type { ArchetypeId, PlayerModel } from '../archetypes/types';
import { ARCHETYPE_BY_ID } from '../archetypes/definitions';
import { ARCHETYPE_MODEL_MAP } from '../archetypes/types';

export interface PlayerAgent {
  archetype: ArchetypeId;
  name: string;
  model: PlayerModel;
  modelId: string;
  generatedBackstory: string;
  characterForStory: string;
  systemPrompt: string;
}

export interface StoryContext {
  storyId: string;
  storyTitle: string;
  storySetting: string;
  storyGenre: string;
}

/**
 * Generate a character name appropriate to the story setting
 */
export function generateName(): string {
  // Pool of names that work across most story settings
  // In a full implementation, this could be LLM-generated or setting-specific
  const firstNames = [
    'Alex',
    'Morgan',
    'Sam',
    'Jordan',
    'Casey',
    'Taylor',
    'Riley',
    'Avery',
    'Quinn',
    'Parker',
    'Drew',
    'Reese',
    'Jamie',
    'Skyler',
    'Dakota',
    'Devon',
    'Emerson',
    'Finley',
    'Harley',
    'Kai',
  ];

  // Return a random name
  return firstNames[Math.floor(Math.random() * firstNames.length)] || 'Alex';
}

/**
 * Generate a backstory for the agent based on archetype + story context
 *
 * Note: In the full implementation, this would use an LLM to generate
 * unique, story-appropriate backstories. For now, we template them.
 */
export function generateBackstory(
  archetypeId: ArchetypeId,
  name: string,
  storyContext: StoryContext,
): string {
  const archetype = ARCHETYPE_BY_ID[archetypeId];
  if (!archetype) {
    throw new Error(`Unknown archetype: ${archetypeId}`);
  }

  // Template-based backstory that incorporates archetype context
  // In full implementation, use LLM to generate unique variations
  return `${name} - ${archetype.context}. ${generateStoryConnection(storyContext)}`;
}

function generateStoryConnection(storyContext: StoryContext): string {
  const connections = [
    `Heard about ${storyContext.storyTitle} from a friend.`,
    `Always been curious about ${storyContext.storyGenre} stories.`,
    `Looking for an adventure.`,
    `Interested in exploring ${storyContext.storySetting}.`,
    `Wants to experience something new.`,
  ];

  return connections[Math.floor(Math.random() * connections.length)] || connections[0];
}

/**
 * Generate character description for the specific story
 */
export function generateCharacter(
  name: string,
  backstory: string,
  storyContext: StoryContext,
): string {
  // Simple character description
  // In full implementation, this could be more detailed and LLM-generated
  return `${name}, a player interested in ${storyContext.storyGenre}. ${backstory}`;
}

/**
 * Compose system prompt for player agent
 */
export function composeSystemPrompt(
  archetype: ArchetypeId,
  name: string,
  character: string,
  storyContext: StoryContext,
): string {
  const archetypeData = ARCHETYPE_BY_ID[archetype];
  if (!archetypeData) {
    throw new Error(`Unknown archetype: ${archetype}`);
  }

  return `You are ${name}, a player in an interactive fiction story called "${storyContext.storyTitle}".

CHARACTER:
${character}

PLAY STYLE:
${archetypeData.style}

BEHAVIORAL PATTERNS:
${archetypeData.patterns.map((p) => `- ${p}`).join('\n')}

IMPORTANT INSTRUCTIONS:
- You are ONE player in a GROUP of 2-5 players experiencing this story together
- Respond naturally as ${name} would respond to the narrative
- Your responses should be conversational and in-character
- About ${Math.round(archetypeData.quirkFrequency * 100)}% of your responses should show your personality quirk
- The remaining ${Math.round((1 - archetypeData.quirkFrequency) * 100)}% should be normal, engaged play
- NEVER break character or refer to yourself as an AI
- Keep responses concise (1-3 sentences typically)
- React to what the narrator tells you and what your fellow players do
- Sometimes you'll be asked to share your reaction with the group
- Other times you might get private information just for you

Remember: You're a real person playing a game with friends. Stay in character and have fun with the story!`;
}

/**
 * Create a player agent from an archetype + story context
 */
export function createPlayerAgent(
  archetypeId: ArchetypeId,
  storyContext: StoryContext,
): PlayerAgent {
  const archetype = ARCHETYPE_BY_ID[archetypeId];
  if (!archetype) {
    throw new Error(`Unknown archetype: ${archetypeId}`);
  }

  const name = generateName();
  const backstory = generateBackstory(archetypeId, name, storyContext);
  const character = generateCharacter(name, backstory, storyContext);
  const systemPrompt = composeSystemPrompt(archetypeId, name, character, storyContext);

  return {
    archetype: archetypeId,
    name,
    model: archetype.model,
    modelId: ARCHETYPE_MODEL_MAP[archetype.model] || '',
    generatedBackstory: backstory,
    characterForStory: character,
    systemPrompt,
  };
}

/**
 * Create multiple player agents (for a group)
 */
export function createPlayerAgents(
  archetypeIds: ArchetypeId[],
  storyContext: StoryContext,
): PlayerAgent[] {
  return archetypeIds.map((id) => createPlayerAgent(id, storyContext));
}
