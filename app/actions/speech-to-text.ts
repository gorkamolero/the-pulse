'use server';

import { transcribe } from 'orate';
import { replicate } from 'orate/replicate';

// Input transformer for Replicate's Whisper model
const inputTransformer = async (audio: File) => {
  // Convert the file to a base64 string
  const arrayBuffer = await audio.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const base64Audio = buffer.toString('base64');
  
  return {
    input: {
      audio: `data:${audio.type};base64,${base64Audio}`
    }
  };
};

// Output transformer for Replicate's Whisper model
const outputTransformer = (response: unknown) => {
  if (response && typeof response === 'object' && 'text' in response) {
    return (response as { text: string }).text;
  }
  return '';
};

/**
 * Transcribe audio using Orate with Replicate's speech-to-text model
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

    // Use Orate's transcribe function with Replicate's Whisper model
    const text = await transcribe({
      model: replicate.stt(
        'vaibhavs10/incredibly-fast-whisper:3ab86df6c8f54c11309d4d1f930ac292bad43ace52d10c80d87eb258b3c9f79c',
        inputTransformer,
        outputTransformer
      ),
      audio: audioFile
    });

    return { text };
  } catch (error) {
    console.error('Error transcribing audio:', error);
    return { error: 'Failed to transcribe audio' };
  }
} 