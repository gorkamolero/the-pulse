import { auth } from '@/app/(auth)/auth';
import {
  getUserSettings,
  saveUserSettings,
  deleteUserApiKey,
} from '@/lib/db/queries';
import { encrypt, maskApiKey, decrypt } from '@/lib/crypto';

export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const settings = await getUserSettings(session.user.id);

    if (!settings) {
      return Response.json({
        hasOpenrouterKey: false,
        hasAiGatewayKey: false,
        freeStoryUsed: false,
        freeStoryId: null,
        isDegraded: false,
        misuseWarnings: 0,
      });
    }

    return Response.json({
      hasOpenrouterKey: !!settings.openrouterApiKey,
      openrouterKeyMask: settings.openrouterApiKey
        ? maskApiKey(decrypt(settings.openrouterApiKey))
        : null,
      hasAiGatewayKey: !!settings.aiGatewayApiKey,
      aiGatewayKeyMask: settings.aiGatewayApiKey
        ? maskApiKey(decrypt(settings.aiGatewayApiKey))
        : null,
      freeStoryUsed: settings.freeStoryUsed,
      freeStoryId: settings.freeStoryId,
      isDegraded: settings.degradedMode,
      misuseWarnings: settings.misuseWarnings,
    });
  } catch (error) {
    console.error('Failed to get settings:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}

export async function PUT(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const body = await request.json();
    const { openrouterApiKey, aiGatewayApiKey } = body as {
      openrouterApiKey?: string;
      aiGatewayApiKey?: string;
    };

    // Validate at least one key is provided
    if (!openrouterApiKey && !aiGatewayApiKey) {
      return new Response('At least one API key must be provided', {
        status: 400,
      });
    }

    // Basic validation - keys should start with expected prefixes
    if (openrouterApiKey && !openrouterApiKey.startsWith('sk-or-')) {
      return new Response(
        'Invalid OpenRouter API key format. Keys should start with "sk-or-"',
        { status: 400 },
      );
    }

    // Encrypt and save
    const updates: {
      userId: string;
      openrouterApiKey?: string;
      aiGatewayApiKey?: string;
    } = {
      userId: session.user.id,
    };

    if (openrouterApiKey) {
      updates.openrouterApiKey = encrypt(openrouterApiKey);
    }

    if (aiGatewayApiKey) {
      updates.aiGatewayApiKey = encrypt(aiGatewayApiKey);
    }

    await saveUserSettings(updates);

    return Response.json({ success: true });
  } catch (error) {
    console.error('Failed to save settings:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const provider = searchParams.get('provider') as
      | 'openrouter'
      | 'aiGateway'
      | null;

    if (!provider || !['openrouter', 'aiGateway'].includes(provider)) {
      return new Response('Invalid provider. Must be "openrouter" or "aiGateway"', {
        status: 400,
      });
    }

    await deleteUserApiKey(session.user.id, provider);

    return Response.json({ success: true });
  } catch (error) {
    console.error('Failed to delete API key:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}
