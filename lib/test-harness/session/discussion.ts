/**
 * Discussion Phase System
 *
 * General-purpose multi-round group deliberation.
 * Agents discuss amongst themselves, then spokesperson synthesizes for narrator.
 */

import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { streamText, type LanguageModelUsage } from 'ai';
import type { PlayerAgent } from '../agents/player';
import type { CostTracker } from './cost';
import { getNextFallbackModel } from '../archetypes/types';

export interface DiscussionResult {
  /** What each agent said during discussion */
  messages: Array<{ agent: PlayerAgent; message: string }>;
  /** Spokesperson's synthesis for the narrator */
  spokespersonMessage: string;
}

/**
 * Run a discussion phase
 *
 * Each agent responds to the narrator's prompt, seeing what others said.
 * Then spokesperson synthesizes everything for the narrator.
 */
export async function runDiscussion(
  narratorPrompt: string,
  agents: PlayerAgent[],
  spokesperson: PlayerAgent,
  costTracker: CostTracker,
): Promise<DiscussionResult> {
  console.log('\n🗣️  Discussion phase\n');

  const messages: Array<{
    agent: PlayerAgent;
    message: string;
    usage?: LanguageModelUsage;
  }> = [];

  // Each agent responds, seeing previous responses
  for (const agent of agents) {
    const previousMessages = messages
      .map((m) => `${m.agent.name}: "${m.message}"`)
      .join('\n\n');

    const prompt = `The narrator just said:
"${narratorPrompt}"

${previousMessages ? `Your friends have said:\n${previousMessages}\n\n` : ''}What do you think? Discuss with your friends.`;

    const response = await generateAgentResponse(agent, prompt, costTracker);
    messages.push({ agent, message: response.text, usage: response.usage });

    console.log(`   ${agent.name}: "${response.text}"`);
  }

  // Spokesperson synthesizes
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
): Promise<{ text: string; usage: LanguageModelUsage }> {
  const openrouter = createOpenRouter({
    apiKey: process.env.OPENROUTER_API_KEY,
  });

  const triedModels: string[] = [];
  let currentModelId = agent.modelId;

  while (true) {
    triedModels.push(currentModelId);

    try {
      const result = streamText({
        model: openrouter(currentModelId),
        messages: [
          { role: 'system', content: agent.systemPrompt },
          { role: 'user', content: prompt },
        ],
        temperature: 0.8,
      });

      let text = '';
      if (stream) {
        const modelNote =
          currentModelId !== agent.modelId ? ` [${currentModelId}]` : '';
        process.stdout.write(`   🎙️ ${agent.name}${modelNote} (spokesperson): `);
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
