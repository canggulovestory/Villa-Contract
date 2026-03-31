import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';

// Initialize the Gemini client. Vite makes env vars available via `import.meta.env`
// However, the vite config injects process.env.GEMINI_API_KEY explicitly.
const apiKey = process.env.GEMINI_API_KEY || (import.meta as any).env?.VITE_GOOGLE_API_KEY || '';
const genAI = new GoogleGenerativeAI(apiKey);

/**
 * Parses raw text from an inquiry (e.g. WhatsApp message) into structured ContractData overrides.
 */
export const parseInquiryText = async (rawText: string): Promise<any> => {
  // Try to use the faster, cheaper 1.5 Flash model
  const model = genAI.getGenerativeModel({
    model: 'gemini-1.5-flash',
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: SchemaType.OBJECT,
        properties: {
          villaName: { type: SchemaType.STRING },
          checkInDate: { type: SchemaType.STRING, description: "Format: YYYY-MM-DD" },
          checkOutDate: { type: SchemaType.STRING, description: "Format: YYYY-MM-DD" },
          monthlyPrice: { type: SchemaType.NUMBER },
          totalPrice: { type: SchemaType.NUMBER },
          bedrooms: { type: SchemaType.NUMBER },
          securityDeposit: { type: SchemaType.NUMBER },
          paymentCurrency: { type: SchemaType.STRING },
          paymentTerms: { type: SchemaType.STRING },
          agent: { type: SchemaType.STRING },
          name: { type: SchemaType.STRING },
          nationality: { type: SchemaType.STRING },
          passport: { type: SchemaType.STRING },
          phone: { type: SchemaType.STRING },
          numberOfGuests: { type: SchemaType.NUMBER },
        },
      },
      temperature: 0.1, // Keep it deterministic
    },
  });

  const prompt = `
Extract the relevant property rental contract information from the following unformatted text (such as a WhatsApp inquiry or email).
If a field is not present, omit it or leave it empty.
Map common aliases (e.g., "30 mill", "30 jt") to the exact number (30000000).
Ensure dates are strictly in YYYY-MM-DD format (use the current year if not specified).

Text:
"""
${rawText}
"""
  `;

  try {
    const result = await model.generateContent(prompt);
    const response = result.response;
    return JSON.parse(response.text());
  } catch (error) {
    console.error('Failed to parse inquiry with Gemini:', error);
    return {};
  }
};

/**
 * Helper to convert a browser File object to the generative part required by the Gemini SDK.
 */
const fileToGenerativePart = async (file: File) => {
  const base64EncodedDataPromise = new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
    reader.readAsDataURL(file);
  });
  return {
    inlineData: {
      data: await base64EncodedDataPromise,
      mimeType: file.type
    }
  };
};

/**
 * Extracts Full Name and Passport Number from a passport image photo using Gemini Vision.
 */
export const extractPassportData = async (file: File): Promise<{ extractedName: string; extractedPassport: string }> => {
  const model = genAI.getGenerativeModel({
    model: 'gemini-1.5-flash',
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: SchemaType.OBJECT,
        properties: {
          extractedName: { type: SchemaType.STRING, description: "The full name of the passport holder" },
          extractedPassport: { type: SchemaType.STRING, description: "The passport number" },
        },
      },
      temperature: 0.1,
    },
  });

  const prompt = `Read this passport image and extract the full name and the passport number. Use the Machine Readable Zone (MRZ) at the bottom for maximum accuracy if visible, otherwise read the text fields. Only return the final JSON.`;

  try {
    const imagePart = await fileToGenerativePart(file);
    const result = await model.generateContent([prompt, imagePart]);
    const parsed = JSON.parse(result.response.text());
    
    return {
      extractedName: parsed.extractedName || '',
      extractedPassport: parsed.extractedPassport || '',
    };
  } catch (error) {
    console.error('Failed to parse passport with Gemini Vision:', error);
    throw new Error('Image parsing failed. Please manually enter details.');
  }
};
