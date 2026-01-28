#!/usr/bin/env npx tsx
/**
 * Velocity Test - Measure narrator response times
 *
 * Usage:
 *   pnpm velocity-test                    # Test current guest model
 *   pnpm velocity-test --model deepseek   # Test specific model
 *   pnpm velocity-test --compare          # Compare multiple models
 */

const API_URL = process.env.API_URL || 'http://localhost:7272/api/pulse';

// Models to test (OpenRouter format)
const MODELS: Record<string, string> = {
  'deepseek': 'deepseek/deepseek-chat',
  'deepseek-r1': 'deepseek/deepseek-r1',
  'gemini-flash': 'google/gemini-2.0-flash-001',
  'gemini-pro': 'google/gemini-2.0-pro-exp-02-05',
  'llama-70b': 'meta-llama/llama-3.1-70b-instruct',
  'qwen': 'qwen/qwen-2.5-72b-instruct',
  'kimi': 'moonshotai/kimi-k2.5',
};

interface TestResult {
  model: string;
  responseTimeMs: number;
  firstTokenMs: number | null;
  tokensGenerated: number;
  tokensPerSecond: number;
  success: boolean;
  error?: string;
}

async function testModel(modelId: string): Promise<TestResult> {
  const chatId = crypto.randomUUID();
  const startTime = performance.now();
  let firstTokenTime: number | null = null;
  let responseText = '';

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: chatId,
        messages: [
          {
            id: crypto.randomUUID(),
            role: 'user',
            content: 'Let\'s start the story "Shadow Over Innsmouth".',
          },
        ],
        selectedStoryId: 'shadow-over-innsmouth',
        language: 'en',
        guestPulseCount: 0,
        // Override model for testing (requires backend support)
        _testModel: modelId,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    // Read streaming response
    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      responseText += chunk;

      if (firstTokenTime === null && chunk.length > 0) {
        firstTokenTime = performance.now() - startTime;
      }
    }

    const endTime = performance.now();
    const totalTimeMs = endTime - startTime;

    // Rough token estimate (4 chars per token)
    const tokensGenerated = Math.round(responseText.length / 4);
    const tokensPerSecond = tokensGenerated / (totalTimeMs / 1000);

    return {
      model: modelId,
      responseTimeMs: Math.round(totalTimeMs),
      firstTokenMs: firstTokenTime ? Math.round(firstTokenTime) : null,
      tokensGenerated,
      tokensPerSecond: Math.round(tokensPerSecond),
      success: true,
    };
  } catch (error) {
    return {
      model: modelId,
      responseTimeMs: Math.round(performance.now() - startTime),
      firstTokenMs: null,
      tokensGenerated: 0,
      tokensPerSecond: 0,
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function runVelocityTest(modelKeys: string[]) {
  console.log('\n🚀 Narrator Velocity Test\n');
  console.log('─'.repeat(70));

  const results: TestResult[] = [];

  for (const key of modelKeys) {
    const modelId = MODELS[key] || key;
    process.stdout.write(`Testing ${key.padEnd(15)} `);

    const result = await testModel(modelId);
    results.push(result);

    if (result.success) {
      const ttft = result.firstTokenMs ? `${(result.firstTokenMs / 1000).toFixed(1)}s TTFT, ` : '';
      console.log(
        `✓ ${(result.responseTimeMs / 1000).toFixed(1)}s total, ${ttft}~${result.tokensPerSecond} tok/s`
      );
    } else {
      console.log(`✗ ${result.error}`);
    }
  }

  console.log('─'.repeat(70));

  // Summary table
  console.log('\n📊 Results Summary:\n');
  console.log('Model'.padEnd(20) + 'Total'.padStart(10) + 'TTFT'.padStart(10) + 'Tokens/s'.padStart(12));
  console.log('─'.repeat(52));

  for (const r of results.sort((a, b) => a.responseTimeMs - b.responseTimeMs)) {
    if (r.success) {
      const ttftStr = r.firstTokenMs ? `${(r.firstTokenMs / 1000).toFixed(1)}s` : 'N/A';
      console.log(
        r.model.split('/').pop()?.padEnd(20) +
        `${(r.responseTimeMs / 1000).toFixed(1)}s`.padStart(10) +
        ttftStr.padStart(10) +
        `${r.tokensPerSecond}`.padStart(12)
      );
    }
  }

  console.log('\n');
}

// Parse args
const args = process.argv.slice(2);
const compareMode = args.includes('--compare');
const modelArg = args.find(a => a.startsWith('--model='))?.split('=')[1];

if (compareMode) {
  // Test all models
  runVelocityTest(Object.keys(MODELS));
} else if (modelArg) {
  // Test specific model
  runVelocityTest([modelArg]);
} else {
  // Test current guest model (deepseek)
  runVelocityTest(['deepseek']);
}
