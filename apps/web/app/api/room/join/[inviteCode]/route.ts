import { getRoomByInviteCode, getRoomWithPlayers } from "@/lib/db/queries";
import { normalizeInviteCode, isValidInviteCode } from "@/lib/multiplayer/invite-code";

// GET /api/room/join/[inviteCode] - Look up room by invite code
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ inviteCode: string }> }
) {
  try {
    const { inviteCode: rawCode } = await params;
    const inviteCode = normalizeInviteCode(rawCode);

    if (!isValidInviteCode(inviteCode)) {
      return Response.json({ error: "Invalid invite code format" }, { status: 400 });
    }

    const room = await getRoomByInviteCode(inviteCode);
    if (!room) {
      return Response.json({ error: "Room not found" }, { status: 404 });
    }

    // Get full room with players
    const roomWithPlayers = await getRoomWithPlayers(room.id);

    return Response.json({ room: roomWithPlayers });
  } catch (error) {
    console.error("Failed to find room by invite code:", error);
    return Response.json({ error: "Failed to find room" }, { status: 500 });
  }
}
