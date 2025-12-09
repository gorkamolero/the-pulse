import { cookies } from 'next/headers';
import { Suspense } from 'react';

import { Chat } from '@/components/chat';
import { DEFAULT_CHAT_MODEL } from '@/lib/ai/models';
import { generateUUID } from '@/lib/utils';
import { DataStreamHandler } from '@/components/data-stream-handler';
import { auth } from '@/app/(auth)/auth';

async function ChatPage() {
  const session = await auth();
  const cookieStore = await cookies();
  const id = generateUUID();

  const modelIdFromCookie = cookieStore.get('chat-model');

  if (!modelIdFromCookie) {
    return (
      <>
        <Chat
          key={id}
          id={id}
          initialMessages={[]}
          selectedChatModel={DEFAULT_CHAT_MODEL}
          selectedVisibilityType="private"
          isReadonly={false}
          user={session?.user}
        />
        <DataStreamHandler id={id} />
      </>
    );
  }

  return (
    <>
      <Chat
        key={id}
        id={id}
        initialMessages={[]}
        selectedChatModel={modelIdFromCookie.value ?? DEFAULT_CHAT_MODEL}
        selectedVisibilityType="private"
        isReadonly={false}
        user={session?.user}
      />
      <DataStreamHandler id={id} />
    </>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center">Loading...</div>}>
      <ChatPage />
    </Suspense>
  );
}
