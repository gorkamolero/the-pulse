'use server';

import { experimental_transcribe as transcribe } from 'ai';
import { openai } from '@ai-sdk/openai';

/**
 * Transcribe audio using AI SDK with OpenAI's Whisper model
 * @param formData Form data containing the audio file
 * @returns The transcribed text or an error
 */
export async function transcribeAudio(formData: FormData): Promise<{ text: string } | { error: string }> {
  try {
    // Get the audio file from the form data
    const audioFile = formData.get('audio') as File;

    if (!audioFile) {
      return { error: 'No audio file provided' };
    }

    // Convert File to ArrayBuffer for the AI SDK
    const arrayBuffer = await audioFile.arrayBuffer();

    // Use AI SDK's transcribe function with OpenAI's Whisper model
    const { text } = await transcribe({
      model: openai.transcription('whisper-1'),
      audio: new Uint8Array(arrayBuffer),
    });

    return { text };
  } catch (error) {
    console.error('Error transcribing audio:', error);
    return { error: 'Failed to transcribe audio' };
  }
}
