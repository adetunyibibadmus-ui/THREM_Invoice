
import { GoogleGenAI, Type } from "@google/genai";

// Robust process.env fallback
const getApiKey = () => {
  try {
    return (window as any).process?.env?.API_KEY || "";
  } catch {
    return "";
  }
};

const ai = new GoogleGenAI({ apiKey: getApiKey() });

export async function parseInvoiceInput(input: string) {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Parse text into invoice JSON: "${input}"`,
      config: {
        responseMimeType: "application/json",
        systemInstruction: "Assistant for Threm Multilinks Venture (cement depot). Extract customer name, phone, address, cement brands (Dangote, BUA, etc), quantity, unit price, and delivery fees. Defaults: Dangote 9000, BUA 8500 if not stated.",
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
                  description: { type: Type.STRING },
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
    console.error("Gemini Error:", error);
    return null;
  }
}
