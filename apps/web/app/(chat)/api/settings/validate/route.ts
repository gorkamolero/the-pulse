import { auth } from '@/app/(auth)/auth';
import { generateText, createGateway, type LanguageModel } from 'ai';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';

const TEST_MODEL = 'google/gemini-2.5-flash-lite';
const TEST_PROMPT = 'Say "API key validated" in exactly 3 words.';

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const body = await request.json();
    const { apiKey, provider } = body as {
      apiKey: string;
      provider: 'openrouter' | 'aiGateway';
    };

    if (!apiKey || !provider) {
      return new Response('API key and provider are required', { status: 400 });
    }

    // Try a minimal generation to validate the key
    let model: LanguageModel;

    if (provider === 'openrouter') {
      const openrouter = createOpenRouter({ apiKey });
      model = openrouter(TEST_MODEL);
    } else {
      const customGateway = createGateway({ apiKey });
      model = customGateway(TEST_MODEL);
    }

    const result = await generateText({
      model,
      prompt: TEST_PROMPT,
      maxOutputTokens: 20,
    });

    return Response.json({
      valid: true,
      message: 'API key is valid',
      response: result.text,
    });
  } catch (error) {
    console.error('API key validation failed:', error);

    // Try to provide a helpful error message
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';

    if (
      errorMessage.includes('401') ||
      errorMessage.includes('unauthorized') ||
      errorMessage.includes('invalid')
    ) {
      return Response.json(
        {
          valid: false,
          message: 'Invalid API key. Please check your key and try again.',
        },
        { status: 400 },
      );
    }

    if (errorMessage.includes('rate') || errorMessage.includes('limit')) {
      return Response.json(
        {
          valid: false,
          message: 'Rate limited. The key may be valid but has hit its limit.',
        },
        { status: 400 },
      );
    }

    return Response.json(
      {
        valid: false,
        message: `Validation failed: ${errorMessage}`,
      },
      { status: 400 },
    );
  }
}
