"use client";

import { useState, useRef } from "react";
import { Button } from "./ui/button";
import { Mic, StopCircle } from "lucide-react";
import { toast } from "sonner";
import { transcribeAudio } from "@/app/actions/speech-to-text";

interface RecordButtonProps {
  onTranscriptionComplete: (text: string) => void;
  disabled?: boolean;
}

export function RecordButton({
  onTranscriptionComplete,
  disabled = false,
}: RecordButtonProps) {
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const startRecording = async () => {
    audioChunksRef.current = [];
    
    try {
      // Check if browser supports getUserMedia
      if (!navigator.mediaDevices) {
        toast.error("Your browser doesn't support audio recording");
        return;
      }
      
      if (!navigator.mediaDevices.getUserMedia) {
        toast.error("Your browser doesn't support audio recording");
        return;
      }
      
      
      // Try with a simpler approach - just audio
      navigator.mediaDevices.getUserMedia({ audio: true })
        .then(handleSuccessfulStream)
        .catch(handleMediaError);
      
      
    } catch (error) {
      toast.error("Could not access microphone");
    }
  };
  
  // Handle successful media stream acquisition
  const handleSuccessfulStream = (stream: MediaStream) => {
    
    // Check if MediaRecorder is supported
    if (!window.MediaRecorder) {
      toast.error("Your browser doesn't support MediaRecorder");
      stream.getTracks().forEach(track => track.stop());
      return;
    }
    
    const mediaRecorder = new MediaRecorder(stream);
    mediaRecorderRef.current = mediaRecorder;
    
    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        audioChunksRef.current.push(event.data);
      }
    };
    
    mediaRecorder.onstop = async () => {
      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
      const audioFile = new File([audioBlob], 'recording.wav', { type: 'audio/wav' });
      
      try {
        // Create FormData and append the audio file
        const formData = new FormData();
        formData.append('audio', audioFile);
        
        // Call the server action to transcribe the audio
        const result = await transcribeAudio(formData);
        
        if ('error' in result) {
          toast.error(result.error);
        } else {
          onTranscriptionComplete(result.text);
        }
      } catch (error) {
        toast.error("Failed to transcribe audio");
      }
      
      // Stop all tracks in the stream to release the microphone
      stream.getTracks().forEach(track => track.stop());
    };
    
    mediaRecorder.start();
    setIsRecording(true);
  };
  
  // Handle media errors
  const handleMediaError = (error: Error) => {
    // More specific error messages based on the error name
    if (error instanceof DOMException) {
      if (error.name === "NotAllowedError" || error.name === "PermissionDeniedError") {
        toast.error("Microphone permission denied. Please allow access in your browser settings.");
      } else if (error.name === "NotFoundError" || error.name === "DevicesNotFoundError") {
        toast.error("No microphone found. Please connect a microphone and try again.");
      } else if (error.name === "NotReadableError" || error.name === "TrackStartError") {
        toast.error("Could not access microphone. It may be in use by another application.");
      } else {
        toast.error(`Microphone error: ${error.message || error.name}`);
      }
    } else {
      toast.error(`Microphone error: ${error.message || "Unknown error"}`);
    }
  };
  
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };
  
  const toggleRecording = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    
    if (isRecording) {
      stopRecording();
    } else {
      startRecording()
    }
  };
  
  return (
    <Button
      className={`aspect-square h-full max-h-24 flex items-center justify-center rounded-xl ${
        isRecording 
          ? "bg-red-500 hover:bg-red-600 text-white" 
          : "dark:border-zinc-700 hover:dark:bg-zinc-900 hover:bg-zinc-200"
      }`}
      onClick={toggleRecording}
      type="button"
      disabled={disabled}
      variant={isRecording ? "default" : "outline"}
      aria-label={isRecording ? "Stop recording" : "Start recording"}
    >
      {isRecording ? (
        <StopCircle size={32} />
      ) : (
        <Mic size={32} />
      )}
    </Button>
  );
} 