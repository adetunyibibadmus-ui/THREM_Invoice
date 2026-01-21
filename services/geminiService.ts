
import { GoogleGenAI, Type } from "@google/genai";

// Ensure we use the API key directly as per guidelines
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || "" });

const INVOICE_SCHEMA = {
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
};

const SYSTEM_INSTRUCTION = "Assistant for Threm Multilinks Venture (cement depot). Extract customer details, cement brands (Dangote, BUA, etc), quantity, unit price, and delivery fees. Defaults: Dangote 9000, BUA 8500 if not stated. If info is missing, leave null or default.";

export async function parseInvoiceInput(input: string) {
  try {
    if (!process.env.API_KEY) {
      console.warn("API Key is missing. AI features will not work.");
      return null;
    }

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Parse this message into a structured invoice: "${input}"`,
      config: {
        responseMimeType: "application/json",
        systemInstruction: SYSTEM_INSTRUCTION,
        responseSchema: INVOICE_SCHEMA
      }
    });

    if (response.text) {
      return JSON.parse(response.text.trim());
    }
    return null;
  } catch (error) {
    console.error("Gemini Text Error:", error);
    return null;
  }
}

export async function parseVoiceInput(base64Audio: string, mimeType: string) {
  try {
    if (!process.env.API_KEY) return null;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: {
        parts: [
          {
            inlineData: {
              data: base64Audio,
              mimeType: mimeType
            }
          },
          {
            text: "Listen to this audio and extract the customer and invoice details into a JSON format. This is for Threm Multilinks Venture."
          }
        ]
      },
      config: {
        responseMimeType: "application/json",
        systemInstruction: SYSTEM_INSTRUCTION,
        responseSchema: INVOICE_SCHEMA
      }
    });

    if (response.text) {
      return JSON.parse(response.text.trim());
    }
    return null;
  } catch (error) {
    console.error("Gemini Voice Error:", error);
    return null;
  }
}
