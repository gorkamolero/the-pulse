import { auth } from "@/app/(auth)/auth";
import {
  getRoomWithPlayers,
  addPlayerToRoom,
  getPlayerInRoom,
} from "@/lib/db/queries";
import { getPlayerColor } from "@/lib/multiplayer/types";
import { nanoid } from "nanoid";

// POST /api/room/[roomId]/join - Join an existing room
export async function POST(
  request: Request,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const { roomId } = await params;
    const session = await auth();
    const body = await request.json();
    const { displayName, guestId: providedGuestId } = body;

    // Get room
    const room = await getRoomWithPlayers(roomId);
    if (!room) {
      return Response.json({ error: "Room not found" }, { status: 404 });
    }

    // Check room status
    if (room.status !== "lobby") {
      return Response.json(
        { error: "Room is no longer accepting players" },
        { status: 400 }
      );
    }

    // Determine player identity
    const userId = session?.user?.id;
    const guestId = userId ? undefined : (providedGuestId || nanoid(16));
    const playerDisplayName = displayName || session?.user?.email || "Player";

    // Check if player already in room
    const existingPlayer = await getPlayerInRoom({
      roomId,
      userId,
      guestId,
    });

    if (existingPlayer) {
      return Response.json({
        room,
        player: existingPlayer,
        alreadyJoined: true,
      });
    }

    // Assign a color based on player count
    const playerIndex = room.players.length;
    const color = getPlayerColor(playerIndex);

    // Add player to room
    const player = await addPlayerToRoom({
      roomId,
      userId,
      guestId,
      displayName: playerDisplayName,
      color,
      isHost: false,
    });

    // Refresh room data
    const updatedRoom = await getRoomWithPlayers(roomId);

    return Response.json({
      room: updatedRoom,
      player,
      alreadyJoined: false,
    });
  } catch (error) {
    console.error("Failed to join room:", error);
    return Response.json({ error: "Failed to join room" }, { status: 500 });
  }
}
