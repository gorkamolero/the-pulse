/**
 * Game State Tracking
 *
 * Tracks player→character mappings, inventory, location, NPCs.
 * Injected before each narrator turn for consistency.
 */

import { generateObject } from 'ai';
import { z } from 'zod';
import type { PlayerAgent } from '../agents/player';
import { getNextFallbackModel } from '../archetypes/types';
import { withModelFallback } from '../utils/retry';

/**
 * Commit character to player agent's system prompt
 * Called after character creation to lock in the INNER character name
 */
export function commitCharacterToAgent(
  agent: PlayerAgent,
  character: CharacterMapping,
): void {
  const itemsList = character.items.length > 0
    ? `\nEquipment: ${character.items.join(', ')}`
    : '';

  const description = character.idDescription
    ? `\n${character.idDescription}`
    : '';

  const commitment = `

## YOUR CHARACTER (LOCKED)

You are playing: **${character.idName}**${description}${itemsList}

- This character name is LOCKED for the rest of the story
- OOC commentary uses your real name: (${agent.name}: wow this is creepy!)`;

  // Mutate the agent's system prompt
  agent.systemPrompt += commitment;
}

export interface CharacterMapping {
  /** Outer dimension - real player name */
  odName: string;
  /** Inner dimension - story character name */
  idName: string;
  /** Brief character description */
  idDescription?: string;
  /** Items/inventory */
  items: string[];
  /** Role in the group */
  role: 'spokesperson' | 'player';
}

export interface GameState {
  characters: CharacterMapping[];
  location: string;
  npcsEncountered: string[];
  plotFlags: Record<string, boolean>;
}

/**
 * Create empty initial state
 */
export function createInitialState(): GameState {
  return {
    characters: [],
    location: 'Unknown',
    npcsEncountered: [],
    plotFlags: {},
  };
}

/**
 * Format state for injection into narrator context
 */
export function formatStateForInjection(state: GameState): string {
  if (state.characters.length === 0) {
    return '';
  }

  const characterLines = state.characters
    .map(
      (c) =>
        `- ${c.odName} (${c.role}) is playing "${c.idName}"${c.idDescription ? ` - ${c.idDescription}` : ''}`,
    )
    .join('\n');

  const inventoryLines = state.characters
    .filter((c) => c.items.length > 0)
    .map((c) => `- ${c.idName}: ${c.items.join(', ')}`)
    .join('\n');

  let output = `[GAME STATE]
Players and their characters:
${characterLines}
`;

  if (inventoryLines) {
    output += `
Items in play:
${inventoryLines}
`;
  }

  output += `
Current location: ${state.location}`;

  if (state.npcsEncountered.length > 0) {
    output += `
NPCs encountered: ${state.npcsEncountered.join(', ')}`;
  }

  output += `
[END GAME STATE]`;

  return output;
}

/**
 * Extract character mappings from spokesperson's introduction
 */
export async function extractCharacterMappings(
  spokespersonResponse: string,
  players: PlayerAgent[],
  spokespersonName: string,
): Promise<CharacterMapping[]> {
  const schema = z.object({
    characters: z.array(
      z.object({
        playerName: z.string(),
        characterName: z.string(),
        description: z.string().optional(),
        items: z.array(z.string()),
      }),
    ),
  });

  const prompt = `Extract the player-to-character mappings from this introduction.

Players in the game: ${players.map((p) => p.name).join(', ')}

Introduction text:
${spokespersonResponse}

For each player, identify:
- Their real name (playerName) - must match one from the list above
- Their story character name (characterName)
- Brief description if given
- Any items/equipment mentioned`;

  try {
    const { result } = await withModelFallback(
      'google/gemini-2.5-flash',
      async (modelId) => {
        const result = await generateObject({
          model: modelId,
          schema,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.2,
        });

        return result.object.characters.map((c): CharacterMapping => ({
          odName: c.playerName,
          idName: c.characterName,
          idDescription: c.description,
          items: c.items,
          role: c.playerName === spokespersonName ? 'spokesperson' : 'player',
        }));
      },
      {
        getNextModel: getNextFallbackModel,
        label: 'Character extraction',
      },
    );

    return result;
  } catch {
    console.error('All models failed for state extraction');
    return [];
  }
}

/**
 * Try to extract characters from a turn's player responses
 */
export async function tryExtractCharacters(
  state: GameState,
  history: Array<{ turn: number; role: string; player?: string; content: string }>,
  turn: number,
  players: PlayerAgent[],
  spokesperson: PlayerAgent,
): Promise<GameState> {
  const turnResponses = history
    .filter((m) => m.turn === turn && (m.role === 'player' || m.role === 'spokesperson'))
    .map((m) => `${m.player}: ${m.content}`)
    .join('\n\n');

  if (!turnResponses) return state;

  console.log('🎭 Extracting character mappings...');
  const characters = await extractCharacterMappings(turnResponses, players, spokesperson.name);

  if (characters.length === 0) return state;

  console.log(`   Mapped: ${characters.map((c) => `${c.odName}→${c.idName}`).join(', ')}`);

  // Commit to agents
  console.log('🔒 Committing characters to agent prompts...');
  for (const character of characters) {
    const agent = players.find((a) => a.name.toLowerCase() === character.odName.toLowerCase());
    if (agent) commitCharacterToAgent(agent, character);
  }

  return { ...state, characters };
}

/**
 * Update game state based on narrator response
 */
export async function updateGameState(
  currentState: GameState,
  narratorResponse: string,
): Promise<GameState> {
  const schema = z.object({
    locationChanged: z.string().nullable(),
    newItems: z.array(
      z.object({
        character: z.string(),
        item: z.string(),
      }),
    ),
    newNPCs: z.array(z.string()),
    plotFlags: z.record(z.string(), z.boolean()),
  });

  const characterNames = currentState.characters.map((c) => c.idName).join(', ');

  const prompt = `Analyze this narrator response for state changes.

Current characters: ${characterNames || 'none established yet'}
Current location: ${currentState.location}
Known NPCs: ${currentState.npcsEncountered.join(', ') || 'none'}

Narrator response:
${narratorResponse}

Extract any:
- Location change (null if no change, otherwise the new location name)
- New items given to characters (use their story character names)
- New NPCs introduced by name (not generic "a stranger" - only named NPCs)
- Significant plot events as boolean flags (e.g., "found_ledger": true)

Be conservative - only extract clear, explicit changes.`;

  try {
    const { result: updates } = await withModelFallback(
      'google/gemini-2.5-flash',
      async (modelId) => {
        const result = await generateObject({
          model: modelId,
          schema,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.2,
        });

        return result.object;
      },
      {
        getNextModel: getNextFallbackModel,
        label: 'State update',
      },
    );

    return {
      ...currentState,
      location: updates.locationChanged ?? currentState.location,
      characters: currentState.characters.map((c) => ({
        ...c,
        items: [
          ...c.items,
          ...updates.newItems
            .filter((i) => i.character.toLowerCase() === c.idName.toLowerCase())
            .map((i) => i.item),
        ],
      })),
      npcsEncountered: [
        ...new Set([...currentState.npcsEncountered, ...updates.newNPCs]),
      ],
      plotFlags: { ...currentState.plotFlags, ...updates.plotFlags },
    };
  } catch {
    console.error('All models failed for state update, keeping current state');
    return currentState;
  }
}
