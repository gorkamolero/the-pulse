import { auth } from "@/app/(auth)/auth";
import { createRoom, addPlayerToRoom, updateRoom } from "@/lib/db/queries";
import { generateInviteCode } from "@/lib/multiplayer/invite-code";
import { getPlayerColor } from "@/lib/multiplayer/types";

// POST /api/room - Create a new room
export async function POST(request: Request) {
  try {
    const session = await auth();

    // Only authenticated users can create rooms
    if (!session?.user?.id) {
      return Response.json(
        { error: "Authentication required to create a room" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { displayName, storyId } = body;

    // Generate a unique invite code
    const inviteCode = generateInviteCode();

    // Create the room with selected story
    const newRoom = await createRoom({ inviteCode, storyId });

    // Add the host as the first player
    const userId = session.user.id;
    const playerDisplayName = displayName || session.user.email || "Host";

    const hostPlayer = await addPlayerToRoom({
      roomId: newRoom.id,
      userId,
      displayName: playerDisplayName,
      color: getPlayerColor(0),
      isHost: true,
    });

    // Update room with host and spokesperson
    const updatedRoom = await updateRoom(newRoom.id, {
      hostPlayerId: hostPlayer.id,
      spokespersonPlayerId: hostPlayer.id,
    });

    return Response.json({
      room: updatedRoom,
      player: hostPlayer,
      inviteCode: newRoom.inviteCode,
    });
  } catch (error) {
    console.error("Failed to create room:", error);
    return Response.json({ error: "Failed to create room" }, { status: 500 });
  }
}
