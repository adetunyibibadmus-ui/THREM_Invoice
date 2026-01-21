import { GoogleGenAI, Type } from "@google/genai";

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

const SYSTEM_INSTRUCTION = `You are a professional sales assistant for "Threm Multilinks Venture", a major cement distributor.
Your goal is to extract order details into a structured format.

CEMENT BUSINESS CONTEXT:
- Products: Dangote Cement, BUA Cement, Ibeto, etc.
- Standard Pricing: If price is not mentioned, use Dangote = 9000, BUA = 8500.
- Quantity: Usually referred to as "bags".

INSTRUCTIONS:
1. Extract customer name, phone, and delivery address.
2. Identify cement brand and quantity.
3. Identify delivery or loading fees.
4. Output ONLY valid JSON according to the schema.
5. If details are vague, make your best guess based on cement industry standards.`;

export async function parseInvoiceInput(input: string) {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || "" });
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Extract order details from this message: "${input}"`,
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
    console.error("Smart Entry AI Error:", error);
    return null;
  }
}

export async function parseVoiceInput(base64Audio: string, mimeType: string) {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || "" });
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
            text: "Listen to this voice note and extract the cement order details (customer, items, price, delivery) for Threm Multilinks Venture into JSON format."
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
    console.error("Voice Entry AI Error:", error);
    return null;
  }
}