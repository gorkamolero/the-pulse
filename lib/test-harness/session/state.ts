/**
 * Game State Tracking
 *
 * Tracks player→character mappings, inventory, location, NPCs.
 * Injected before each narrator turn for consistency.
 */

import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { generateObject } from 'ai';
import { z } from 'zod';
import type { PlayerAgent } from '../agents/player';
import { getNextFallbackModel } from '../archetypes/types';

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
  const openrouter = createOpenRouter({
    apiKey: process.env.OPENROUTER_API_KEY,
  });

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

  const triedModels: string[] = [];
  let currentModelId = 'google/gemini-2.5-flash';

  while (true) {
    triedModels.push(currentModelId);

    try {
      const result = await generateObject({
        model: openrouter(currentModelId),
        schema,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
      });

      return result.object.characters.map((c) => ({
        odName: c.playerName,
        idName: c.characterName,
        idDescription: c.description,
        items: c.items,
        role: c.playerName === spokespersonName ? 'spokesperson' : 'player',
      }));
    } catch (error) {
      console.warn(`State extraction failed (${currentModelId}), trying fallback...`);

      const nextModel = getNextFallbackModel(triedModels);
      if (nextModel) {
        currentModelId = nextModel;
        continue;
      }

      console.error('All models failed for state extraction');
      return [];
    }
  }
}

/**
 * Update game state based on narrator response
 */
export async function updateGameState(
  currentState: GameState,
  narratorResponse: string,
): Promise<GameState> {
  const openrouter = createOpenRouter({
    apiKey: process.env.OPENROUTER_API_KEY,
  });

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

  const triedModels: string[] = [];
  let currentModelId = 'google/gemini-2.5-flash';

  while (true) {
    triedModels.push(currentModelId);

    try {
      const result = await generateObject({
        model: openrouter(currentModelId),
        schema,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
      });

      const updates = result.object;

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
    } catch (error) {
      console.warn(`State update failed (${currentModelId}), trying fallback...`);

      const nextModel = getNextFallbackModel(triedModels);
      if (nextModel) {
        currentModelId = nextModel;
        continue;
      }

      console.error('All models failed for state update, keeping current state');
      return currentState;
    }
  }
}
