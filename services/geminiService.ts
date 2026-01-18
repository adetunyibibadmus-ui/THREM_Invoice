
import { GoogleGenAI, Type } from "@google/genai";

// Ensure process.env exists or provide a fallback to prevent ReferenceError
if (typeof process === 'undefined') {
  (window as any).process = { env: {} };
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export async function parseInvoiceInput(input: string) {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Parse the following text into structured invoice data for a cement business: "${input}"`,
      config: {
        responseMimeType: "application/json",
        systemInstruction: "You are an assistant for Threm Multilinks Venture, a cement seller. Your goal is to extract customer details, items (cement brands, quantity, price), and any delivery fees from natural language. If specific prices aren't mentioned, use common defaults like 9,000 for Dangote, 8,500 for BUA. Return JSON with the specific structure requested.",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            customer: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                phone: { type: Type.STRING },
                address: { type: Type.STRING }
              }
            },
            items: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  description: { type: Type.STRING, description: "Brand name and grade of cement" },
                  quantity: { type: Type.NUMBER },
                  unitPrice: { type: Type.NUMBER }
                }
              }
            },
            deliveryFee: { type: Type.NUMBER },
            notes: { type: Type.STRING }
          }
        }
      }
    });

    if (response.text) {
      return JSON.parse(response.text.trim());
    }
    return null;
  } catch (error) {
    console.error("AI Parsing Error:", error);
    return null;
  }
}
