import { NextRequest, NextResponse } from 'next/server';
import { getMessageById } from '@/lib/db/queries';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // Log the params to debug
  console.log('Params received:', params);
  
  try {
    // If no ID is provided in the URL, return an error
    if (!params || !params.id) {
      return NextResponse.json({ error: 'No ID provided' }, { status: 400 });
    }
    
    const messages = await getMessageById({id: params.id});
    console.log(messages[0]?.imageUrl);
    return NextResponse.json(messages[0] || null);
  } catch (error) {
    console.error('Error fetching message:', error);
    return NextResponse.json({ error: 'Failed to fetch message' }, { status: 500 });
  }
}