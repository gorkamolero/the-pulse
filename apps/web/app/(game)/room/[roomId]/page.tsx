import { redirect } from "next/navigation";
import { getRoomById } from "@/lib/db/queries";

interface RoomPageProps {
  params: Promise<{ roomId: string }>;
}

export default async function RoomPage({ params }: RoomPageProps) {
  const { roomId } = await params;
  const room = await getRoomById(roomId);

  if (!room) {
    redirect("/");
  }

  if (room.status === "lobby") {
    redirect(`/room/${roomId}/lobby`);
  }

  if (room.status === "playing") {
    redirect(`/room/${roomId}/play`);
  }

  redirect("/");
}
