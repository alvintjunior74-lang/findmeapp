import { useState, useRef, useEffect, useCallback } from 'react';

export function useSpeech(onTextAppend: (text: string) => void, options: { continuous?: boolean } = {}) {
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  
  const onTextAppendRef = useRef(onTextAppend);
  useEffect(() => {
    onTextAppendRef.current = onTextAppend;
  }, [onTextAppend]);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = options.continuous ?? false;
      recognition.interimResults = false;

      recognition.onresult = (event: any) => {
        let text = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            text += event.results[i][0].transcript;
          }
        }
        if (text) {
          console.log("Speech recognized:", text);
          onTextAppendRef.current(text + ' ');
        }
      };

      recognition.onstart = () => {
        console.log("Speech recognition started");
        setIsListening(true);
      };

      recognition.onend = () => {
        console.log("Speech recognition ended");
        setIsListening(false);
      };

      recognition.onerror = (event: any) => {
        if (event.error === 'not-allowed') {
          alert("Microphone access was denied. Please ensure you have granted microphone permissions in your browser and that the application has the necessary permissions.");
        } else if (event.error === 'network') {
          alert("Speech recognition failed due to a network error. Please check your internet connection.");
        } else if (event.error !== 'no-speech') {
          console.error("Speech recognition error:", event.error);
        }
        setIsListening(false);
      };
      
      recognitionRef.current = recognition;
    }
  }, [options.continuous]);

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
