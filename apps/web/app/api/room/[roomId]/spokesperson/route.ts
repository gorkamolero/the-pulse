import { auth } from "@/app/(auth)/auth";
import {
  getRoomWithPlayers,
  updateRoom,
  getPlayerInRoom,
  getPlayerById,
} from "@/lib/db/queries";

// PATCH /api/room/[roomId]/spokesperson - Change spokesperson
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const { roomId } = await params;
    const session = await auth();
    const body = await request.json();
    const { spokespersonPlayerId, guestId } = body;

    // Get room
    const room = await getRoomWithPlayers(roomId);
    if (!room) {
      return Response.json({ error: "Room not found" }, { status: 404 });
    }

    // Find the requesting player
    const requestingPlayer = await getPlayerInRoom({
      roomId,
      userId: session?.user?.id,
      guestId,
    });

    // Only host can change spokesperson
    if (!requestingPlayer?.isHost) {
      return Response.json(
        { error: "Only the host can change the spokesperson" },
        { status: 403 }
      );
    }

    // Verify the new spokesperson is in the room
    const newSpokesperson = await getPlayerById(spokespersonPlayerId);
    if (!newSpokesperson || newSpokesperson.roomId !== roomId) {
      return Response.json(
        { error: "Player not found in this room" },
        { status: 400 }
      );
    }

    // Update spokesperson
    const updated = await updateRoom(roomId, { spokespersonPlayerId });

    return Response.json({
      room: updated,
      spokesperson: newSpokesperson,
    });
  } catch (error) {
    console.error("Failed to change spokesperson:", error);
    return Response.json(
      { error: "Failed to change spokesperson" },
      { status: 500 }
    );
  }
}
