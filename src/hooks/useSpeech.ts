import { useState, useRef, useEffect, useCallback } from 'react';

export function useSpeech(onTextAppend: (text: string) => void) {
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  
  // Keep the latest callback in a ref to avoid recreating the recognition object
  const onTextAppendRef = useRef(onTextAppend);
  useEffect(() => {
    onTextAppendRef.current = onTextAppend;
  }, [onTextAppend]);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onresult = (event: any) => {
        const last = event.results.length - 1;
        const text = event.results[last][0].transcript;
        onTextAppendRef.current(text + ' ');
      };

      recognition.onend = () => setIsListening(false);
      recognition.onerror = (event: any) => {
        console.error("Speech recognition error:", event.error);
        setIsListening(false);
      };
      
      recognitionRef.current = recognition;
    }
  }, []);

  const toggle = useCallback(() => {
    if (!recognitionRef.current) {
      alert("Speech recognition is not supported in your browser.");
      return;
    }
    
    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (err) {
        console.error("Failed to start speech recognition", err);
        setIsListening(false);
      }
    }
  }, [isListening]);

  return { isListening, toggle, supported: !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition) };
}
