export function encryptSim(text: string) {
  try { return btoa(encodeURIComponent(text)); } catch(e) { return text; }
}

export function decryptSim(text: string) {
  try { return decodeURIComponent(atob(text)); } catch(e) { return text; }
}
