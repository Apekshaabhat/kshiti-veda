/**
 * useVoiceAssistant.ts
 * 
 * Hook for browser-native voice recognition (Web Speech API).
 * Gracefully degrades when the API is unavailable (e.g., non-Chromium browsers).
 */
import { useState, useCallback, useRef } from 'react';

interface VoiceAssistantReturn {
  isListening: boolean;
  transcript: string;
  startListening: () => void;
  stopListening: () => void;
}

export const useVoiceAssistant = (): VoiceAssistantReturn => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const recognitionRef = useRef<any>(null);

  const startListening = useCallback(() => {
    // Check for Web Speech API support
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      console.warn('Voice recognition not supported in this browser.');
      return;
    }

    if (isListening) {
      // Toggle off
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-IN';
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => setIsListening(true);

    recognition.onresult = (event: any) => {
      const result = event.results[0]?.[0]?.transcript || '';
      setTranscript(result);
      console.log('[VoiceAssistant] Heard:', result);
    };

    recognition.onerror = (event: any) => {
      console.error('[VoiceAssistant] Error:', event.error);
      setIsListening(false);
    };

    recognition.onend = () => setIsListening(false);

    recognitionRef.current = recognition;
    recognition.start();
  }, [isListening]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setIsListening(false);
  }, []);

  return { isListening, transcript, startListening, stopListening };
};

