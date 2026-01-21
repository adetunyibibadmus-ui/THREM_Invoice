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
    discountPercent: { type: Type.NUMBER },
    notes: { type: Type.STRING }
  },
  required: ["customer", "items"]
};

const SYSTEM_INSTRUCTION = `You are a professional sales automation assistant for "Threm Multilinks Venture", a cement depot.
Your task is to extract order details from text or audio.

BUSINESS CONTEXT:
- Products: Dangote Cement, BUA Cement, etc.
- Standard Pricing: If price is not mentioned, use Dangote = 9000, BUA = 8500.
- "Bags" = Quantity.

EXTRACTION RULES:
1. Identify Customer Name, Phone, and Delivery Address.
2. Identify Product, Quantity (bags), and Price.
3. Identify Delivery/Loading fees.
4. Output results in valid JSON matching the schema.`;

// Parse text input using Gemini 3 Pro
export async function parseInvoiceInput(input: string) {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: `Extract order details for Threm Multilinks: "${input}"`,
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
    console.error("AI Smart Entry Failed:", error);
    throw error;
  }
}

// Parse voice input using Gemini 3 Pro
export async function parseVoiceInput(base64Audio: string, mimeType: string) {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: {
        parts: [
          {
            inlineData: {
              data: base64Audio,
              mimeType: mimeType
            }
          },
          {
            text: "Extract order details from this voice note for Threm Multilinks Venture into JSON format."
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
    console.error("AI Voice Entry Failed:", error);
    throw error;
  }
}