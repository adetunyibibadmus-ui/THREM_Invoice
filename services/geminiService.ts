import { GoogleGenAI, Type } from "@google/genai";

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
      },
      required: ["name"]
    },
    items: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          description: { type: Type.STRING },
          quantity: { type: Type.NUMBER },
          unitPrice: { type: Type.NUMBER }
        },
        required: ["description", "quantity", "unitPrice"]
      }
    },
    deliveryFee: { type: Type.NUMBER },
    notes: { type: Type.STRING }
  }
};

const SYSTEM_INSTRUCTION = `You are an expert invoice assistant for Threm Multilinks Venture, a major cement depot.
Your task is to extract customer and order details from text or audio.

Business Context:
- Primary products: Cement (Dangote, BUA, etc.)
- Location: Eyenkorin, Ilorin, Kwara State.
- Default prices if not specified: Dangote ₦9,000, BUA ₦8,500.

Rules:
1. Always return valid JSON matching the schema.
2. If the user mentions "bags", that is the quantity.
3. Extract phone numbers carefully.
4. If a delivery fee is mentioned, include it.
5. If some information is missing, leave it null or use defaults for prices.`;

export async function parseInvoiceInput(input: string) {
  try {
    if (!process.env.API_KEY) throw new Error("API Key is missing.");

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Process this order for Threm Multilinks: "${input}"`,
      config: {
        responseMimeType: "application/json",
        systemInstruction: SYSTEM_INSTRUCTION,
        responseSchema: INVOICE_SCHEMA
      }
    });

    const text = response.text;
    if (text) {
      return JSON.parse(text.trim());
    }
    return null;
  } catch (error) {
    console.error("AI Text Parsing Error:", error);
    return null;
  }
}

export async function parseVoiceInput(base64Audio: string, mimeType: string) {
  try {
    if (!process.env.API_KEY) throw new Error("API Key is missing.");

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
            text: "Extract customer name, phone, address, cement type, quantity, and delivery fee from this voice note for an invoice."
          }
        ]
      },
      config: {
        responseMimeType: "application/json",
        systemInstruction: SYSTEM_INSTRUCTION,
        responseSchema: INVOICE_SCHEMA
      }
    });

    const text = response.text;
    if (text) {
      return JSON.parse(text.trim());
    }
    return null;
  } catch (error) {
    console.error("AI Voice Parsing Error:", error);
    return null;
  }
}