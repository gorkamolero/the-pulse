import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getRoomWithPlayers, getPlayerInRoom } from "@/lib/db/queries";
import { auth } from "@/app/(auth)/auth";
import { GameLobby } from "@/components/multiplayer/game-lobby";
import { getStoryById } from "@pulse/core/ai/stories";

interface LobbyPageProps {
  params: Promise<{ roomId: string }>;
}

export default async function LobbyPage({ params }: LobbyPageProps) {
  const { roomId } = await params;
  const session = await auth();
  const cookieStore = await cookies();
  const guestId = cookieStore.get("guest-id")?.value;

  // Get room data
  const room = await getRoomWithPlayers(roomId);

  if (!room) {
    redirect("/");
  }

  // If game has started, redirect to play
  if (room.status === "playing") {
    redirect(`/room/${roomId}/play`);
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

  // If not in room, redirect to join
  if (!player) {
    redirect(`/join/${room.inviteCode}`);
  }

  // Get the selected story if one was chosen
  const story = room.storyId ? getStoryById(room.storyId) : undefined;

  return (
    <GameLobby
      room={room}
      currentPlayerId={player.id}
      guestId={guestId}
      story={story}
    />
  );
}
