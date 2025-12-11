/**
 * Discussion Phase System
 *
 * Enables multi-round visible deliberation between player agents.
 * Used for character creation and major group decisions where
 * agents need to see each other's responses and build consensus.
 */

import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { generateObject, streamText, type LanguageModelUsage } from 'ai';
import { z } from 'zod';
import type { PlayerAgent } from '../agents/player';
import type { Message } from './turn';
import type { CostTracker } from './cost';
import { getNextFallbackModel } from '../archetypes/types';

/**
 * Inner character created during discussion
 * The persona the player will portray IN the story
 */
export interface CharacterChoice {
  /** In-game character name (e.g., "Elias Crowe") */
  inGameName: string;
  /** Character's role in the story (e.g., "Disgraced journalist") */
  role: string;
  /** Character backstory */
  backstory: string;
  /** Items the character carries */
  items: string[];
  /** Relationships to other players' characters */
  relationshipToOthers?: Record<string, string>;
}

/**
 * Agent's response during a discussion round
 */
export interface DiscussionResponse {
  /** Agent's archetype ID */
  agentId: string;
  /** Agent's outer character name */
  agentName: string;
  /** What they say to the group (outer character voice) */
  message: string;
  /** Their current decision state */
  decision: 'settled' | 'discussing' | 'needs-input';
  /** If settled, their character choice */
  characterChoice?: CharacterChoice;
  /** Token usage for this response */
  usage?: LanguageModelUsage;
}

/**
 * A single round of discussion
 */
export interface DiscussionRound {
  roundNumber: number;
  responses: DiscussionResponse[];
}

/**
 * Complete result of a discussion phase
 */
export interface DiscussionResult {
  /** All rounds of discussion */
  rounds: DiscussionRound[];
  /** Final character choices by agent ID */
  finalCharacters: Map<string, CharacterChoice>;
  /** Spokesperson's synthesis for the narrator */
  spokespersonMessage: string;
}

// Zod schema for structured discussion response
const characterChoiceSchema = z.object({
  inGameName: z.string().describe("Your character's name in the story"),
  role: z
    .string()
    .describe('Your character\'s role (e.g., "journalist", "professor")'),
  backstory: z.string().describe('Brief backstory for your character'),
  items: z.array(z.string()).describe('Items your character carries'),
  relationshipToOthers: z
    .record(z.string(), z.string())
    .optional()
    .describe('How your character knows other characters'),
});

const discussionResponseSchema = z.object({
  message: z
    .string()
    .describe('What you say to your friends (as yourself, not your character)'),
  decision: z
    .enum(['settled', 'discussing', 'needs-input'])
    .describe(
      "settled = you've decided your character, discussing = still thinking, needs-input = want suggestions from friends",
    ),
  characterChoice: characterChoiceSchema
    .optional()
    .describe('Only provide if decision is "settled"'),
});

/**
 * Build the discussion context prompt for an agent
 */
function buildDiscussionPrompt(
  agent: PlayerAgent,
  narratorPrompt: string,
  previousRounds: DiscussionRound[],
  settled: Map<string, CharacterChoice>,
  isAlreadySettled: boolean,
): string {
  // Build settled list
  const settledList = Array.from(settled.entries())
    .map(
      ([id, char]) => `- ${id} → playing "${char.inGameName}" (${char.role})`,
    )
    .join('\n');

  // Build discussion so far
  const discussionSoFar = previousRounds
    .flatMap((round) => round.responses)
    .map(
      (r) =>
        `${r.agentName}: "${r.message}"${r.decision === 'settled' ? ' [DECIDED]' : ''}`,
    )
    .join('\n\n');

  const settledInstruction = isAlreadySettled
    ? `\n\nYou've already decided your character. You can still comment on others' ideas briefly, but keep decision as "settled".`
    : '';

  return `The narrator just asked your group:
"${narratorPrompt}"

== IMPORTANT: CREATE A FICTIONAL CHARACTER ==
You need to INVENT a character to play in this story - NOT describe yourself.
- Give them a NAME (different from ${agent.name})
- Give them a ROLE (journalist, professor, drifter, local, etc.)
- Give them a REASON for being in the story
- Give them ITEMS they carry

Example: "I'll play Dr. Helena Marsh, an occult researcher from Boston. She carries a research journal and a magnifying glass."
NOT: "I'm ${agent.name}, I work as a designer..."

== DISCUSSION SO FAR ==
${discussionSoFar || "(No discussion yet—you're first to speak)"}

== WHO HAS DECIDED ==
${settledList || '(No one has finalized their character yet)'}

== YOUR TURN ==
As ${agent.name}, discuss with your friends what fictional characters you'll each play. You can:
- Propose what FICTIONAL character YOU want to play (with a name and role)
- React to others' character ideas
- Suggest character concepts for friends
- Coordinate: "I'll be the skeptic" / "Great, I'll be the believer"
- Build connections: "What if our characters know each other?"

When you've decided on your character, set decision to "settled" and fill in characterChoice with your INVENTED character details.

Remember: You're ${agent.name} talking to friends about what characters to PLAY.${settledInstruction}`;
}

/**
 * Generate a single agent's discussion response with model fallback
 */
export async function generateDiscussionResponse(
  agent: PlayerAgent,
  narratorPrompt: string,
  previousRounds: DiscussionRound[],
  settled: Map<string, CharacterChoice>,
  isAlreadySettled: boolean,
): Promise<DiscussionResponse> {
  const openrouter = createOpenRouter({
    apiKey: process.env.OPENROUTER_API_KEY,
  });

  const discussionPrompt = buildDiscussionPrompt(
    agent,
    narratorPrompt,
    previousRounds,
    settled,
    isAlreadySettled,
  );

  const messages = [
    { role: 'system' as const, content: agent.systemPrompt },
    { role: 'user' as const, content: discussionPrompt },
  ];

  // Track tried models for fallback
  const triedModels: string[] = [];
  let currentModelId = agent.modelId;

  while (true) {
    triedModels.push(currentModelId);

    try {
      const result = await generateObject({
        model: openrouter(currentModelId),
        schema: discussionResponseSchema,
        messages,
        temperature: 0.8,
      });

      // Log the response (note if using fallback model)
      const modelNote =
        currentModelId !== agent.modelId ? ` [${currentModelId}]` : '';
      const decisionIcon =
        result.object.decision === 'settled'
          ? '✓'
          : result.object.decision === 'needs-input'
            ? '?'
            : '…';
      console.log(
        `   ${decisionIcon} ${agent.name}${modelNote}: "${result.object.message}"`,
      );
      if (
        result.object.decision === 'settled' &&
        result.object.characterChoice
      ) {
        console.log(
          `      → Playing: ${result.object.characterChoice.inGameName} (${result.object.characterChoice.role})`,
        );
      }

      return {
        agentId: agent.archetype,
        agentName: agent.name,
        message: result.object.message,
        decision: result.object.decision,
        characterChoice: result.object.characterChoice as
          | CharacterChoice
          | undefined,
        usage: result.usage,
      };
    } catch (error) {
      console.warn(
        `   ⚠ ${agent.name} model failed (${currentModelId}), trying fallback...`,
      );

      // Try next fallback model
      const nextModel = getNextFallbackModel(triedModels);
      if (nextModel) {
        currentModelId = nextModel;
        continue;
      }

      // All models exhausted - fail hard
      console.error(`   ✗ All models failed for ${agent.name}`);
      throw error;
    }
  }
}

/**
 * Run the full discussion phase until consensus or max rounds
 */
export async function runDiscussion(
  narratorPrompt: string,
  agents: PlayerAgent[],
  spokesperson: PlayerAgent,
  _conversationHistory: Message[],
  costTracker: CostTracker,
): Promise<DiscussionResult> {
  const MAX_ROUNDS = 6;
  const rounds: DiscussionRound[] = [];
  const settled = new Map<string, CharacterChoice>();

  console.log('\n🗣️  Discussion phase started\n');

  for (let roundNum = 0; roundNum < MAX_ROUNDS; roundNum++) {
    console.log(`--- Discussion Round ${roundNum + 1} ---\n`);

    const roundResponses: DiscussionResponse[] = [];

    for (const agent of agents) {
      const isAlreadySettled = settled.has(agent.archetype);

      const response = await generateDiscussionResponse(
        agent,
        narratorPrompt,
        rounds,
        settled,
        isAlreadySettled,
      );

      roundResponses.push(response);

      // Track usage
      if (response.usage) {
        costTracker.recordPlayerUsage(response.usage);
      }

      // Track newly settled agents
      if (response.decision === 'settled' && !isAlreadySettled) {
        // If structured characterChoice exists, use it
        // Otherwise create a placeholder that will be filled in later
        const character = response.characterChoice || {
          inGameName: `${agent.name}'s Character`,
          role: 'Undecided',
          backstory: response.message.slice(0, 200), // Use their message as backstory hint
          items: [],
        };
        settled.set(agent.archetype, character);
        if (!response.characterChoice) {
          console.log(`      → Settled (character details pending)`);
        }
      }
    }

    rounds.push({
      roundNumber: roundNum,
      responses: roundResponses,
    });

    // Check if all agents have settled
    if (settled.size === agents.length) {
      console.log(`\n✅ Consensus reached in round ${roundNum + 1}\n`);
      break;
    }

    console.log(`\n   (${settled.size}/${agents.length} settled)\n`);
  }

  // If max rounds hit without full consensus, force remaining to settle
  if (settled.size < agents.length) {
    console.log(`\n⚠️  Max rounds reached, forcing remaining decisions\n`);

    for (const agent of agents) {
      if (!settled.has(agent.archetype)) {
        // Create a default character for unsettled agents
        const defaultChar: CharacterChoice = {
          inGameName: `${agent.name}'s Character`,
          role: 'Curious observer',
          backstory: 'Along for the adventure, still figuring things out.',
          items: ['Notebook'],
        };
        settled.set(agent.archetype, defaultChar);
        console.log(`   Defaulted ${agent.name} to: ${defaultChar.role}`);
      }
    }
  }

  // Log final character summary
  console.log('--- Final Characters ---\n');
  for (const [agentId, char] of settled) {
    const agent = agents.find((a) => a.archetype === agentId);
    const agentName = agent?.name || agentId;
    console.log(`   ${agentName} → ${char.inGameName} (${char.role})`);
    if (
      char.relationshipToOthers &&
      Object.keys(char.relationshipToOthers).length > 0
    ) {
      for (const [otherName, rel] of Object.entries(
        char.relationshipToOthers,
      )) {
        console.log(`      ↳ ${otherName}: ${rel}`);
      }
    }
  }
  console.log('');

  // Synthesize final message for narrator
  const spokespersonMessage = await synthesizeDiscussion(
    rounds,
    settled,
    spokesperson,
    costTracker,
  );

  return {
    rounds,
    finalCharacters: settled,
    spokespersonMessage,
  };
}

/**
 * Spokesperson synthesizes the discussion for the narrator
 */
async function synthesizeDiscussion(
  _rounds: DiscussionRound[],
  finalCharacters: Map<string, CharacterChoice>,
  spokesperson: PlayerAgent,
  costTracker: CostTracker,
): Promise<string> {
  const openrouter = createOpenRouter({
    apiKey: process.env.OPENROUTER_API_KEY,
  });

  // Build character summary
  const characterSummary = Array.from(finalCharacters.entries())
    .map(([_agentId, char]) => {
      const relationships = char.relationshipToOthers
        ? Object.entries(char.relationshipToOthers)
            .map(([name, rel]) => `${name}: ${rel}`)
            .join(', ')
        : '';
      return `- ${char.inGameName} (${char.role}): ${char.backstory}${relationships ? ` [Knows: ${relationships}]` : ''}`;
    })
    .join('\n');

  const synthesisPrompt = `Your group just finished discussing who you'll all play in this story.

Here's what everyone decided:
${characterSummary}

As ${spokesperson.name} (the spokesperson), summarize this for the narrator. Tell them who each person is playing, any relationships between characters, and that the group is ready to begin.

Keep it conversational - you're talking to the game master, not writing a formal document.`;

  try {
    const result = streamText({
      model: openrouter(spokesperson.modelId),
      messages: [
        { role: 'system', content: spokesperson.systemPrompt },
        { role: 'user', content: synthesisPrompt },
      ],
      temperature: 0.7,
    });

    // Stream to console
    let fullText = '';
    process.stdout.write(`\n🎙️ ${spokesperson.name} (to narrator): `);
    for await (const chunk of result.textStream) {
      process.stdout.write(chunk);
      fullText += chunk;
    }
    process.stdout.write('\n\n');

    const usage = await result.usage;
    costTracker.recordPlayerUsage(usage);

    return fullText;
  } catch (error) {
    console.error('Synthesis error:', error);
    // Fallback to simple list
    return `We're ready. ${Array.from(finalCharacters.values())
      .map((c) => `${c.inGameName} (${c.role})`)
      .join(', ')}.`;
  }
}

/**
 * Update an agent with their inner character after discussion
 */
export function updateAgentWithInnerCharacter(
  agent: PlayerAgent,
  innerCharacter: CharacterChoice,
): PlayerAgent {
  const relationshipsText = innerCharacter.relationshipToOthers
    ? `\nRelationships to other characters:\n${Object.entries(
        innerCharacter.relationshipToOthers,
      )
        .map(([name, rel]) => `- ${name}: ${rel}`)
        .join('\n')}`
    : '';

  const innerCharacterSection = `

== YOUR CHARACTER IN THIS STORY ==
You (${agent.name}) are playing: ${innerCharacter.inGameName}
Role: ${innerCharacter.role}
Backstory: ${innerCharacter.backstory}
Items: ${innerCharacter.items.join(', ')}${relationshipsText}

During gameplay:
- Respond as ${innerCharacter.inGameName} (your character), not as ${agent.name} (yourself)
- You can occasionally break character to comment as yourself ("This is terrifying!")
- Your character's choices should reflect their backstory and role
- When you break character, make it clear: "(${agent.name}: This is so creepy!)"`;

  return {
    ...agent,
    systemPrompt: agent.systemPrompt + innerCharacterSection,
  };
}
