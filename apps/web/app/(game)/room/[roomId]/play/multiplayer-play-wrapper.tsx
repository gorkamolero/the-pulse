"use client";

import type { UIMessage } from "ai";
import { Chat } from "@/components/chat";
import { DataStreamHandler } from "@/components/data-stream-handler";
import { MultiplayerRoomProvider } from "@/components/multiplayer/room-provider";
import { PlayerChat } from "@/components/multiplayer/player-chat";
import { SpokespersonIndicator } from "@/components/multiplayer/spokesperson-indicator";
import type { RoomWithPlayers } from "@/lib/multiplayer/types";
import { useMultiplayer } from "@/hooks/use-multiplayer";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";

interface MultiplayerPlayWrapperProps {
  room: RoomWithPlayers;
  chatId: string;
  initialMessages: UIMessage[];
  currentPlayerId: string;
  isSpokesperson: boolean;
  spokespersonName: string;
  guestId?: string;
  user?: {
    email?: string | null;
    name?: string | null;
    image?: string | null;
  };
}

export function MultiplayerPlayWrapper({
  room: initialRoom,
  chatId,
  initialMessages,
  currentPlayerId,
  isSpokesperson: initialIsSpokesperson,
  spokespersonName: initialSpokespersonName,
  guestId,
  user,
}: MultiplayerPlayWrapperProps) {
  const currentPlayer = initialRoom.players.find(
    (p) => p.id === currentPlayerId
  );

  if (!currentPlayer) {
    return <div>Error: Player not found</div>;
  }

  return (
    <MultiplayerRoomProvider
      roomId={initialRoom.id}
      playerId={currentPlayerId}
      displayName={currentPlayer.displayName}
      color={currentPlayer.color}
    >
      <MultiplayerPlayContent
        room={initialRoom}
        chatId={chatId}
        initialMessages={initialMessages}
        currentPlayerId={currentPlayerId}
        initialIsSpokesperson={initialIsSpokesperson}
        initialSpokespersonName={initialSpokespersonName}
        guestId={guestId}
        user={user}
      />
    </MultiplayerRoomProvider>
  );
}

interface MultiplayerPlayContentProps {
  room: RoomWithPlayers;
  chatId: string;
  initialMessages: UIMessage[];
  currentPlayerId: string;
  initialIsSpokesperson: boolean;
  initialSpokespersonName: string;
  guestId?: string;
  user?: {
    email?: string | null;
    name?: string | null;
    image?: string | null;
  };
}

function MultiplayerPlayContent({
  room: initialRoom,
  chatId,
  initialMessages,
  currentPlayerId,
  initialIsSpokesperson,
  initialSpokespersonName,
  guestId,
  user,
}: MultiplayerPlayContentProps) {
  const { room, chatMessages, sendChatMessage, setTyping } =
    useMultiplayer(initialRoom.id);

  // Use real-time data if available, fall back to initial
  const currentRoom = room || initialRoom;
  const currentIsSpokesperson =
    room?.spokespersonPlayerId === currentPlayerId || initialIsSpokesperson;

  // Find current spokesperson name
  const spokesperson = currentRoom.players.find(
    (p) => p.id === currentRoom.spokespersonPlayerId
  );
  const spokespersonName = spokesperson?.displayName || initialSpokespersonName;

  return (
    <div className="flex flex-col h-screen">
      {/* Spokesperson indicator bar */}
      <div className="flex items-center justify-center py-2 border-b bg-background/80 backdrop-blur">
        <SpokespersonIndicator
          spokespersonName={spokespersonName}
          isSpokesperson={currentIsSpokesperson}
        />
      </div>

      {/* Main content with resizable panels */}
      <ResizablePanelGroup direction="horizontal" className="flex-1">
        {/* Chat/Game Panel */}
        <ResizablePanel defaultSize={75} minSize={50}>
          <Chat
            id={chatId}
            initialMessages={initialMessages}
            selectedVisibilityType="private"
            isReadonly={false}
            user={user}
            disabled={!currentIsSpokesperson}
            disabledReason="Only the spokesperson can message the narrator"
          />
          <DataStreamHandler id={chatId} />
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* Player Chat Sidebar */}
        <ResizablePanel defaultSize={25} minSize={15} maxSize={40}>
          <PlayerChat
            messages={chatMessages}
            onSendMessage={sendChatMessage}
            onTypingChange={setTyping}
            currentPlayerId={currentPlayerId}
            className="h-full border-l"
          />
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
