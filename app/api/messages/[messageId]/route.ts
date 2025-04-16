import { auth } from "@/app/(auth)/auth";
import { getMessageById } from "@/lib/db/queries";
import { NextResponse } from "next/server";

import { type NextRequest } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: { messageId: string } }
) {
  const session = await auth();

  if (!session || !session.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const messageId = params.messageId;
    const messages = await getMessageById({ id: messageId });

    if (!messages || messages.length === 0) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 });
    }

    // Return the first message (getMessageById returns an array)
    console.log("[MessageAPI]", "Returning message:", {
      id: messages[0].id,
      hasImageUrl: !!messages[0].imageUrl,
      imageUrl: messages[0].imageUrl,
    });

    return NextResponse.json(messages[0]);
  } catch (error) {
    console.error("[MessageAPI]", "Error fetching message:", error);
    return NextResponse.json(
      { error: "Failed to fetch message" },
      { status: 500 }
    );
  }
}
