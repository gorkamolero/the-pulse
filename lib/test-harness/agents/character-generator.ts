/**
 * Group-Aware Character Generation
 *
 * Single LLM call generates the entire friend group:
 * - Group context (how they know each other, shared history)
 * - All individual characters with names and relationships
 */

import { generateObject } from 'ai';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { z } from 'zod';
import { faker } from '@faker-js/faker';
import type { ArchetypeId } from '../archetypes/types';
import { ARCHETYPE_BY_ID } from '../archetypes/definitions';

/**
 * Generate a diverse pool of name suggestions using Faker
 * Returns unique names from various origins for variety
 */
function generateNameSuggestions(count: number): string[] {
  const names = new Set<string>();

  // Use different faker methods to get diverse names
  const nameMethods = [
    () => faker.person.firstName(),
    () => faker.person.firstName('male'),
    () => faker.person.firstName('female'),
  ];

  // Generate more names than needed to ensure uniqueness and variety
  while (names.size < count * 3) {
    const method = nameMethods[Math.floor(Math.random() * nameMethods.length)];
    const name = method();
    // Filter out very short or very long names
    if (name.length >= 3 && name.length <= 12) {
      names.add(name);
    }
  }

  // Shuffle and return the requested count
  const shuffled = Array.from(names).sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

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
 * Generated player from the LLM
 */
export interface GeneratedPlayer {
  name: string;
  archetypeId: ArchetypeId;
  groupRole: string;
  relationships: Array<{ name: string; relationship: string }>;
  personalReason: string;
  currentState: string;
  backstory: string;
}

/**
 * Complete generated group output
 */
export interface GeneratedGroup {
  group: {
    relationship: string;
    history: string;
    occasion: string;
    organizer: string;
    storyReason: string;
    dynamic: string;
    sharedMemories: string[];
  };
  players: GeneratedPlayer[];
}

/**
 * Zod schema for structured output
 */
const generatedGroupSchema = z.object({
  group: z.object({
    relationship: z.string().describe('How they know each other (e.g., "College roommates", "Coworkers")'),
    history: z.string().describe('How long they have known each other'),
    occasion: z.string().describe('Why they are playing tonight'),
    organizer: z.string().describe('Name of the person who suggested The Pulse'),
    storyReason: z.string().describe('Why they picked this specific story'),
    dynamic: z.string().describe('The group vibe/energy'),
    sharedMemories: z.array(z.string()).describe('2-3 shared memories they might reference'),
  }),
  players: z.array(
    z.object({
      name: z.string().describe('Natural first name'),
      archetypeId: z.string().describe('The archetype ID assigned to this player'),
      groupRole: z.string().describe('Their role in the friend group'),
      relationships: z.array(
        z.object({
          name: z.string().describe('Name of the other player'),
          relationship: z.string().describe('Description of their relationship'),
        }),
      ).describe('Relationships to other players'),
      personalReason: z.string().describe('Why they are here tonight'),
      currentState: z.string().describe('Their mood/energy tonight'),
      backstory: z.string().describe('2-3 sentences about their background'),
    }),
  ),
});

/**
 * Simple spinner for waiting states
 */
function createSpinner() {
  const frames = ['\u28CB', '\u28D9', '\u28F9', '\u28F8', '\u28FC', '\u28F4', '\u28E6', '\u28E7', '\u28C7', '\u28CF'];
  let i = 0;
  let interval: ReturnType<typeof setInterval> | null = null;

  return {
    start() {
      process.stdout.write(' ');
      interval = setInterval(() => {
        process.stdout.write(`\r${frames[i++ % frames.length]} `);
      }, 80);
    },
    stop() {
      if (interval) {
        clearInterval(interval);
        process.stdout.write('\r  \r');
      }
    },
  };
}

/**
 * Generate complete friend group with all characters
 *
 * Single LLM call that creates coherent group context and all players
 * with proper names and cross-references.
 */
export async function generateGroup(
  storyContext: StoryContext,
  archetypeIds: ArchetypeId[],
  language = 'english',
): Promise<GeneratedGroup> {
  // Generate a fresh pool of name suggestions for variety
  const suggestedNames = generateNameSuggestions(archetypeIds.length * 4);

  const archetypeDescriptions = archetypeIds
    .map((id, index) => {
      const archetype = ARCHETYPE_BY_ID[id];
      return `Player ${index + 1} - ${archetype.name} (${id}): ${archetype.style}`;
    })
    .join('\n');

  const languageInstruction = language !== 'english'
    ? `\n\nIMPORTANT: Generate ALL content in ${language}. Names, relationships, backstories, memories - everything must be in ${language}.`
    : '';

  const prompt = `Generate a complete friend group for an interactive fiction game session.

STORY: "${storyContext.title}"
${storyContext.description}
Genre: ${storyContext.genre}

PLAYERS TO GENERATE (${archetypeIds.length} total):
${archetypeDescriptions}

NAME SUGGESTIONS (pick from these or use similar uncommon names):
${suggestedNames.join(', ')}

Create a believable friend group where:
- They have a clear shared history (how they met, how long ago)
- They have a reason for tonight's session (game night, birthday, etc.)
- One of them suggested this specific story for a reason
- They have 2-3 shared memories/inside jokes
- Each player has relationships with the OTHER players (use their actual names)
- Each player's personality matches their archetype
- The "organizer" field should contain one player's NAME (the one who suggested the game)

Make them feel like real friends with history, not strangers.${languageInstruction}`;

  const spinner = createSpinner();
  spinner.start();

  const result = await generateObject({
    model: openrouter('x-ai/grok-4'),
    schema: generatedGroupSchema,
    prompt,
    temperature: 0.8,
  });

  spinner.stop();

  // Ensure archetypeIds are properly assigned
  const output = result.object as GeneratedGroup;
  for (let i = 0; i < output.players.length; i++) {
    output.players[i].archetypeId = archetypeIds[i];
  }

  return output;
}
