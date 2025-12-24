import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getMessageById } from '@/lib/db/queries';

// UUID regex for validation
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json({ error: 'No ID provided' }, { status: 400 });
    }

    // Only query DB if it's a valid UUID (AI SDK generates nanoids which won't be in DB)
    if (!UUID_REGEX.test(id)) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 });
    }

    const messages = await getMessageById({ id });

    if (!messages || messages.length === 0) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 });
    }

    return NextResponse.json(messages[0]);
  } catch (error) {
    console.error('Error fetching message:', error);
    return NextResponse.json({ error: 'Failed to fetch message' }, { status: 500 });
  }
}
