import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export type AIPersona = 'empathetic' | 'direct' | 'humorous';

const SYSTEM_PROMPTS: Record<AIPersona, string> = {
  empathetic: "You are a highly empathetic, supportive, and kind companion providing gentle advice and comfort.",
  direct: "You are a direct, pragmatic, and objective companion providing clear, actionable, and no-nonsense advice while remaining polite.",
  humorous: "You are a witty, lighthearted, and playful companion providing advice with a touch of humor, gentle sarcasm, and positivity."
};

export async function getAIAdvice(content: string, emotion: string, contextPost?: string, persona: AIPersona = 'empathetic'): Promise<string> {
  try {
    const prompt = contextPost
      ? `Original Post: "${contextPost}" (Emotion: ${emotion}).\nUser's Reply: "${content}".\nPlease provide a short piece of advice or opinion regarding the user's reply, responding directly to them as a companion. Tone: ${persona}. Keep it to 2-3 sentences.`
      : `A user posted their feelings. Emotion: ${emotion}. Content: "${content}". \nPlease provide a short piece of advice. Share a nice opinion. Respond directly to them as a companion. Tone: ${persona}. Keep it to 2-3 sentences.`;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_PROMPTS[persona],
      }
    });
    return response.text || "I'm here for you, take a deep breath.";
  } catch (err) {
    console.error("Gemini Error:", err);
    return "I am here for you. Keep staying strong.";
  }
}
