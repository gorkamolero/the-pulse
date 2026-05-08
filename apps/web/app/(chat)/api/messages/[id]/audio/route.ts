import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { auth } from '@/app/(auth)/auth';
import {
  GUEST_USER_ID,
  getChatById,
  getMessageById,
  updateMessageAudioUrl,
} from '@/lib/db/queries';
import { generatePulseAudio } from '@/lib/ai/tools/generate-audio';
import { DEFAULT_STORY_ID, getNarratorConfig } from '@pulse/core/ai/stories';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!UUID_REGEX.test(id)) {
    return NextResponse.json({ error: 'Message not found' }, { status: 404 });
  }

  const [message] = await getMessageById({ id });

  if (!message || message.role !== 'assistant') {
    return NextResponse.json({ error: 'Message not found' }, { status: 404 });
  }

  if (message.audioUrl) {
    return NextResponse.json({
      audioUrl: message.audioUrl,
      wordTimings: message.wordTimings,
    });
  }

  const chat = await getChatById({ id: message.chatId });

  if (!chat) {
    return NextResponse.json({ error: 'Chat not found' }, { status: 404 });
  }

  const isGuestChat = chat.userId === GUEST_USER_ID;
  const session = await auth();

  if (!isGuestChat && session?.user?.id !== chat.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (typeof message.content !== 'string' || !message.content.trim()) {
    return NextResponse.json({ error: 'Message has no narration text' }, { status: 400 });
  }

  const narratorConfig = getNarratorConfig(chat.storyId ?? DEFAULT_STORY_ID);
  const audioResult = await generatePulseAudio({
    text: message.content,
    messageId: message.id,
    voiceId: narratorConfig.voiceId,
  });

  if (!audioResult?.url) {
    return NextResponse.json(
      { error: audioResult?.error ?? 'Audio generation failed' },
      { status: 502 }
    );
  }

  await updateMessageAudioUrl({
    id: message.id,
    audioUrl: audioResult.url,
    wordTimings: audioResult.wordTimings,
  });

  return NextResponse.json({
    audioUrl: audioResult.url,
    wordTimings: audioResult.wordTimings,
  });
}
