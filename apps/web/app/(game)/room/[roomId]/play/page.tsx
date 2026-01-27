import { redirect, notFound } from "next/navigation";
import { cookies } from "next/headers";
import {
  getRoomWithPlayers,
  getPlayerInRoom,
  getMessagesByChatId,
  saveChat,
  updateRoom,
} from "@/lib/db/queries";
import { auth } from "@/app/(auth)/auth";
import { convertToUIMessages } from "@/lib/utils";
import { randomUUID } from "node:crypto";
import { MultiplayerPlayWrapper } from "./multiplayer-play-wrapper";

interface PlayPageProps {
  params: Promise<{ roomId: string }>;
}

export default async function PlayPage({ params }: PlayPageProps) {
  const { roomId } = await params;
  const session = await auth();
  const cookieStore = await cookies();
  const guestId = cookieStore.get("guest-id")?.value;

  // Get room data
  const room = await getRoomWithPlayers(roomId);

  if (!room) {
    notFound();
  }

  // If game not started, redirect to lobby
  if (room.status === "lobby") {
    redirect(`/room/${roomId}/lobby`);
  }

  // If game has ended, redirect home
  if (room.status === "ended") {
    redirect("/");
  }

  // Find current player
  const player = await getPlayerInRoom({
    roomId,
    userId: session?.user?.id,
    guestId,
  });

  // If not in room, redirect to join (but game started so will show error)
  if (!player) {
    redirect(`/join/${room.inviteCode}`);
  }

  // Get or create chat for this room
  let chatId = room.chatId;
  let initialMessages: ReturnType<typeof convertToUIMessages> = [];

  if (!chatId) {
    // Create a new chat for this room
    // Use the host's userId, current user's ID, or any authenticated player's ID
    const hostPlayer = room.players.find((p) => p.id === room.hostPlayerId);
    const anyAuthPlayer = room.players.find((p) => p.userId);
    const chatUserId = hostPlayer?.userId || session?.user?.id || anyAuthPlayer?.userId;

    if (!chatUserId) {
      // Guest-only game - need at least one authenticated user to own the chat
      // Redirect to an error page explaining the issue
      redirect(`/room/${roomId}/lobby?error=auth_required`);
    }

    chatId = randomUUID();
    await saveChat({
      id: chatId,
      userId: chatUserId,
      title: `Multiplayer Game - Room ${room.inviteCode}`,
    });

    // Update room with chatId
    await updateRoom(roomId, { chatId });
  } else {
    // Load existing messages
    const messagesFromDb = await getMessagesByChatId({ id: chatId });
    initialMessages = convertToUIMessages(messagesFromDb);
  }

  // Check if current player is spokesperson
  const isSpokesperson = room.spokespersonPlayerId === player.id;

  // Find spokesperson name for display
  const spokesperson = room.players.find(
    (p) => p.id === room.spokespersonPlayerId
  );
  const spokespersonName = spokesperson?.displayName || "Unknown";

  return (
    <MultiplayerPlayWrapper
      room={room}
      chatId={chatId}
      initialMessages={initialMessages}
      currentPlayerId={player.id}
      isSpokesperson={isSpokesperson}
      spokespersonName={spokespersonName}
      guestId={guestId}
      user={session?.user}
    />
  );
}
