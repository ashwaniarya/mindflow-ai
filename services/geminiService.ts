import { GoogleGenAI, Type } from "@google/genai";
import { demoSubTopics, demoGuidedSubTopics } from "./demoContent";

const apiKey = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

export const generateSubTopics = async (topic: string, guidance = ''): Promise<string[]> => {
  if (!apiKey) {
    console.warn("API Key is missing. Returning demo data.");
    return guidance ? demoGuidedSubTopics(topic, guidance) : demoSubTopics(topic);
  }

  const focus = guidance ? ` The user wants them to focus on: "${guidance}".` : '';
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Generate 4 concise, creative, and relevant sub-topics for the mind map node: "${topic}".${focus} Keep them short (1-3 words).`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.STRING
          }
        }
      }
    });

    const jsonStr = response.text || "[]";
    const subTopics = JSON.parse(jsonStr);
    
    if (Array.isArray(subTopics)) {
      return subTopics;
    }
    return [];
  } catch (error) {
    console.error("Gemini API Error:", error);
    return [];
  }
};