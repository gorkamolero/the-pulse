import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

import { auth } from '@/app/(auth)/auth';
import { Chat } from '@/components/chat';
import { getChatById, getMessagesByChatId, GUEST_USER_ID } from '@/lib/db/queries';
import { convertToUIMessages } from '@/lib/utils';
import { DataStreamHandler } from '@/components/data-stream-handler';
import { getStoryById } from '@pulse/core/ai/stories';

export async function generateMetadata(props: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await props.params;
  const chatData = await getChatById({ id }).catch(() => null);
  const story = chatData?.storyId ? getStoryById(chatData.storyId) : undefined;
  const storyTitle = story?.title ?? 'The Pulse';

  return {
    title: `${storyTitle} — The Pulse`,
    description: `Join this AI-narrated ${storyTitle} session on The Pulse — interactive fiction where your choices shape the story.`,
    openGraph: {
      title: `${storyTitle} — The Pulse`,
      description: 'AI-powered interactive fiction. No prep. No DM. Just play.',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: `${storyTitle} — The Pulse`,
      description: 'AI-powered interactive fiction. No prep. No DM. Just play.',
    },
  };
}

export default async function Page(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const { id } = params;
  const chat = await getChatById({ id });

  if (!chat) {
    notFound();
  }

  const session = await auth();

  // Guest chats are ephemeral - URL acts as access token (UUIDs are unguessable)
  const isGuestChat = chat.userId === GUEST_USER_ID;

  if (chat.visibility === 'private' && !isGuestChat) {
    if (!session || !session.user) {
      return notFound();
    }

    if (session.user.id !== chat.userId) {
      return notFound();
    }
  }

  const messagesFromDb = await getMessagesByChatId({
    id,
  });

  return (
    <>
      <Chat
        id={chat.id}
        initialMessages={convertToUIMessages(messagesFromDb)}
        selectedVisibilityType={chat.visibility}
        isReadonly={!isGuestChat && session?.user?.id !== chat.userId}
        user={session?.user}
        initialStoryId={chat.storyId ?? undefined}
        initialSoloMode={chat.soloMode ?? true}
      />
      <DataStreamHandler id={id} />
    </>
  );
}
