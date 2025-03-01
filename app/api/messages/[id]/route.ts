import { NextRequest, NextResponse } from 'next/server';
import { getMessageById } from '@/lib/db/queries';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // If no ID is provided in the URL, return an error
    if (!params || !params.id) {
      return NextResponse.json({ error: 'No ID provided' }, { status: 400 });
    }
    
    const messages = await getMessageById({ id: params.id });
    
    if (!messages || messages.length === 0) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 });
    }
    
    return NextResponse.json(messages[0]);
  } catch (error) {
    console.error('Error fetching message:', error);
    return NextResponse.json({ error: 'Failed to fetch message' }, { status: 500 });
  }
} 