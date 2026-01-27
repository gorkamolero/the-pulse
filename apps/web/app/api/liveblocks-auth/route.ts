import { Liveblocks } from "@liveblocks/node";
import { auth } from "@/app/(auth)/auth";

const LIVEBLOCKS_SECRET_KEY = process.env.LIVEBLOCKS_SECRET_KEY;

export async function POST(request: Request) {
  if (!LIVEBLOCKS_SECRET_KEY) {
    return new Response("Liveblocks not configured", { status: 500 });
  }

  const liveblocks = new Liveblocks({
    secret: LIVEBLOCKS_SECRET_KEY,
  });

  // Get the user session if available
  const session = await auth();

  // Parse the request body to get room info
  const { room: roomId } = await request.json();

  if (!roomId) {
    return new Response("Missing room", { status: 400 });
  }

  let userId: string;
  let userName: string;
  let userColor: string;

  if (session?.user?.id) {
    // Authenticated user
    userId = session.user.id;
    userName = session.user.email || "Player";
    userColor = "#457B9D"; // Default blue for authenticated users
  } else {
    // Guest user - look for guest info in headers or generate
    const guestId = request.headers.get("x-guest-id");
    const guestName = request.headers.get("x-guest-name");
    const guestColor = request.headers.get("x-guest-color");

    if (!guestId || !guestName) {
      return new Response("Missing guest info", { status: 400 });
    }

    userId = `guest-${guestId}`;
    userName = guestName;
    userColor = guestColor || "#E63946";
  }

  const liveblocksSession = liveblocks.prepareSession(userId, {
    userInfo: {
      name: userName,
      color: userColor,
      isHost: false,
    },
  });

  // Give the user access to the room
  liveblocksSession.allow(roomId, liveblocksSession.FULL_ACCESS);

  // Authorize and return the result
  const { status, body } = await liveblocksSession.authorize();

  return new Response(body, { status });
}
