import { Suspense } from 'react';

import { Chat } from '@/components/chat';
import { generateUUID } from '@/lib/utils';
import { DataStreamHandler } from '@/components/data-stream-handler';
import { auth } from '@/app/(auth)/auth';

async function ChatPage() {
  const session = await auth();
  const id = generateUUID();

  return (
    <>
      <Chat
        key={id}
        id={id}
        initialMessages={[]}
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
