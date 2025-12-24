import { streamText, convertToModelMessages } from 'ai';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { systemPrompt } from '@pulse/core/ai/prompts/system';
import { getStoryById } from '@pulse/core/ai/stories';
import { MAX_GUEST_PULSES } from '@/lib/guest-session';

export const maxDuration = 60;

// Rate limiting: simple in-memory store (resets on deploy)
const ipRequestCounts = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 10; // 10 requests per minute per IP

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = ipRequestCounts.get(ip);

  if (!record || record.resetAt < now) {
    ipRequestCounts.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }

  if (record.count >= RATE_LIMIT_MAX_REQUESTS) {
    return false;
  }

  record.count++;
  return true;
}

export async function POST(request: Request) {
  // Get client IP for rate limiting
  const forwardedFor = request.headers.get('x-forwarded-for');
  const ip = forwardedFor?.split(',')[0]?.trim() || 'unknown';

  if (!checkRateLimit(ip)) {
    return new Response(
      JSON.stringify({
        error: 'RATE_LIMITED',
        message: 'Too many requests. Please wait a moment before trying again.',
      }),
      {
        status: 429,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  const { messages, pulseCount } = await request.json();

  // Server-side validation of pulse count
  if (typeof pulseCount !== 'number' || pulseCount >= MAX_GUEST_PULSES) {
    return new Response(
      JSON.stringify({
        error: 'GUEST_LIMIT_REACHED',
        message: 'Create a free account to continue your adventure.',
        pulseCount,
      }),
      {
        status: 402,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  // Validate messages array
  if (!Array.isArray(messages) || messages.length === 0) {
    return new Response(
      JSON.stringify({
        error: 'INVALID_REQUEST',
        message: 'Messages array is required.',
      }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  // Use cost-effective model for guests
  const openrouter = createOpenRouter({
    apiKey: process.env.OPENROUTER_API_KEY,
  });

  // Use a smaller, cheaper model for guests
  // Claude 3 Haiku is fast and cost-effective
  const model = openrouter('anthropic/claude-3-haiku-20240307');

  // Always use Shadow Over Innsmouth for guests
  const story = getStoryById('shadow-over-innsmouth');

  if (!story) {
    return new Response(
      JSON.stringify({
        error: 'STORY_NOT_FOUND',
        message: 'Story configuration error.',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  try {
    const result = streamText({
      model,
      system: systemPrompt({
        storyGuide: story.storyGuide,
        language: 'en',
      }),
      messages: convertToModelMessages(messages),
    });

    return result.toTextStreamResponse();
  } catch (error) {
    console.error('Guest chat error:', error);
    return new Response(
      JSON.stringify({
        error: 'GENERATION_ERROR',
        message: 'Failed to generate response. Please try again.',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
