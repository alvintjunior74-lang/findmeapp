export function speak(text: string) {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    // Optional: could customize voice/pitch/rate here
    window.speechSynthesis.speak(utterance);
  } else {
    alert("Text-to-speech is not supported in your browser.");
  }
}

export function stopSpeaking() {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}
