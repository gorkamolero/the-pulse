import { auth } from "@/app/(auth)/auth";
import {
  getRoomWithPlayers,
  updateRoom,
  getPlayerInRoom,
} from "@/lib/db/queries";

// GET /api/room/[roomId] - Get room with players
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const { roomId } = await params;
    const room = await getRoomWithPlayers(roomId);

    if (!room) {
      return Response.json({ error: "Room not found" }, { status: 404 });
    }

    return Response.json({ room });
  } catch (error) {
    console.error("Failed to get room:", error);
    return Response.json({ error: "Failed to get room" }, { status: 500 });
  }
}

// PATCH /api/room/[roomId] - Update room (status, chatId, etc.)
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const { roomId } = await params;
    const session = await auth();
    const body = await request.json();
    const { status, chatId, guestId } = body;

    // Get room to check permissions
    const room = await getRoomWithPlayers(roomId);
    if (!room) {
      return Response.json({ error: "Room not found" }, { status: 404 });
    }

    // Find the requesting player
    const player = await getPlayerInRoom({
      roomId,
      userId: session?.user?.id,
      guestId,
    });

    // Only host can update room
    if (!player?.isHost) {
      return Response.json(
        { error: "Only the host can update the room" },
        { status: 403 }
      );
    }

    // Build update object with only allowed fields
    const updates: Parameters<typeof updateRoom>[1] = {};
    if (status && ["lobby", "playing", "ended"].includes(status)) {
      updates.status = status;
    }
    if (chatId) {
      updates.chatId = chatId;
    }

    const updated = await updateRoom(roomId, updates);
    return Response.json({ room: updated });
  } catch (error) {
    console.error("Failed to update room:", error);
    return Response.json({ error: "Failed to update room" }, { status: 500 });
  }
}
