import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export type AIPersona = 'empathetic' | 'direct' | 'humorous';

const SYSTEM_PROMPTS: Record<AIPersona, string> = {
  empathetic: "You are a highly empathetic, supportive, and kind companion. Your goal is to help users understand their emotions by analyzing their situation, asking gentle clarifying questions (like 'why' or what might have triggered the feeling), and providing thoughtful advice and encouragement.",
  direct: "You are a direct, pragmatic, and objective companion. You analyze the user's emotional state, provide reasons based on their input, ask what triggered the situation, and offer clear, actionable advice and encouragement.",
  humorous: "You are a witty, lighthearted, and playful companion. You help users navigate their feelings with humor, analyze their situation playfully, ask about the 'why' behind their mood social-scientifically or wittily, and provide encouragement with a positive spin."
};

export async function getAIAdvice(content: string, emotion: string, contextPost?: string, persona: AIPersona = 'empathetic'): Promise<string> {
  try {
    const prompt = contextPost
      ? `Original Post: "${contextPost}" (Emotion: ${emotion}).\nUser's Reply: "${content}".\n
        1. Analyze why the user might be feeling this way based on the post.
        2. Give them specific advice and warm encouragement.
        3. Gently ask them what the deeper reason or trigger for this feeling might be.
        Tone: ${persona}. Respond directly to the user. Keep it concise (4-5 sentences).`
      : `User feeling: "${content}" (Emotion: ${emotion}). \n
        1. Analyze the situation and possible reasons for this feeling.
        2. Provide helpful advice and encouragement on what to do next.
        3. Ask the user about the specific reason or trigger behind what they are feeling.
        Tone: ${persona}. Respond directly to the user. Keep it concise (4-5 sentences).`;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        { role: "user", parts: [{ text: prompt }] }
      ],
      config: {
        systemInstruction: { role: "system", parts: [{ text: SYSTEM_PROMPTS[persona] }] },
      }
    });
    return response.text || "I'm here for you, take a deep breath.";
  } catch (err) {
    console.error("Gemini Error:", err);
    return "I am here for you. Keep staying strong.";
  }
}
