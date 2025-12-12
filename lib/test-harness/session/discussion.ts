/**
 * Discussion Phase System
 *
 * General-purpose multi-round group deliberation.
 * Agents discuss amongst themselves, then spokesperson synthesizes for narrator.
 */

import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import {
  streamText,
  type LanguageModelUsage,
  type UserModelMessage,
} from 'ai';
import type { PlayerAgent } from '../agents/player';
import type { CostTracker } from './cost';
import { getNextFallbackModel } from '../archetypes/types';

export interface DiscussionResult {
  /** What each agent said during discussion */
  messages: Array<{ agent: PlayerAgent; message: string }>;
  /** Spokesperson's synthesis for the narrator (empty if skipped) */
  spokespersonMessage: string;
}

export interface DiscussionOptions {
  /** Skip the spokesperson synthesis step */
  skipSynthesis?: boolean;
  /** Conversation history for context */
  history?: Array<{ role: string; player?: string; content: string }>;
}

/**
 * Run a discussion phase
 *
 * Each agent responds to the narrator's prompt, seeing what others said.
 * Then spokesperson synthesizes everything for the narrator (unless skipped).
 */
export async function runDiscussion(
  narratorPrompt: string,
  agents: PlayerAgent[],
  spokesperson: PlayerAgent,
  costTracker: CostTracker,
  options: DiscussionOptions = {},
): Promise<DiscussionResult> {
  console.log('\n🗣️  Discussion phase\n');

  const messages: Array<{
    agent: PlayerAgent;
    message: string;
    usage?: LanguageModelUsage;
  }> = [];

  // Format recent history if provided
  const recentHistory = options.history?.slice(-10) || [];
  const historyContext = recentHistory.length > 0
    ? `${recentHistory.map((m) => `${m.player || m.role}: ${m.content}`).join('\n')}\n\n`
    : '';

  // Each agent responds, seeing previous responses
  for (const agent of agents) {
    const previousMessages = messages
      .map((m) => `${m.agent.name}: "${m.message}"`)
      .join('\n\n');

    const prompt = `${historyContext}The narrator just said:
"${narratorPrompt}"

${previousMessages ? `Your friends have said:\n${previousMessages}\n\n` : ''}What do you think? Discuss with your friends.`;

    const response = await generateAgentResponse(agent, prompt, costTracker, true, false);
    messages.push({ agent, message: response.text, usage: response.usage });
  }

  // Spokesperson synthesizes (unless skipped)
  if (options.skipSynthesis) {
    return {
      messages,
      spokespersonMessage: '',
    };
  }

  const allMessages = messages
    .map((m) => `${m.agent.name}: "${m.message}"`)
    .join('\n\n');

  const synthesisPrompt = `The narrator asked:
"${narratorPrompt}"

Your group discussed:
${allMessages}

As the spokesperson, relay the group's decision/response to the narrator. Be concise.`;

  console.log('');
  const synthesis = await generateAgentResponse(
    spokesperson,
    synthesisPrompt,
    costTracker,
    true,
    true,
  );

  return {
    messages,
    spokespersonMessage: synthesis.text,
  };
}

/**
 * Generate a single agent response with model fallback
 */
async function generateAgentResponse(
  agent: PlayerAgent,
  prompt: string,
  costTracker: CostTracker,
  stream = false,
  isSpokesperson = false,
): Promise<{ text: string; usage: LanguageModelUsage }> {
  const openrouter = createOpenRouter({
    apiKey: process.env.OPENROUTER_API_KEY,
  });

  const triedModels: string[] = [];
  let currentModelId = agent.modelId;

  while (true) {
    triedModels.push(currentModelId);

    try {
      const messages: Array<UserModelMessage> = [
        { role: 'user' as const, content: prompt },
      ];

      const result = streamText({
        model: openrouter(currentModelId),
        system: agent.systemPrompt,
        messages,
        temperature: 0.8,
      });

      let text = '';
      if (stream) {
        const modelNote =
          currentModelId !== agent.modelId ? ` [${currentModelId}]` : '';
        const label = isSpokesperson ? '🎙️' : '💬';
        const suffix = isSpokesperson ? ' (spokesperson)' : '';
        process.stdout.write(`   ${label} ${agent.name}${modelNote}${suffix}: `);
        for await (const chunk of result.textStream) {
          process.stdout.write(chunk);
          text += chunk;
        }
        process.stdout.write('\n');
      } else {
        for await (const chunk of result.textStream) {
          text += chunk;
        }
      }

      const usage = await result.usage;
      costTracker.recordPlayerUsage(usage);

      return { text, usage };
    } catch (error) {
      console.warn(
        `   ⚠ ${agent.name} model failed (${currentModelId}), trying fallback...`,
      );

      const nextModel = getNextFallbackModel(triedModels);
      if (nextModel) {
        currentModelId = nextModel;
        continue;
      }

      console.error(`   ✗ All models failed for ${agent.name}`);
      throw error;
    }
  }
}
