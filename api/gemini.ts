import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';

// ─── Server-side Gemini proxy (Vercel Serverless Function) ──────────────────
// The Gemini API key lives ONLY in the server environment (process.env.GEMINI_API_KEY)
// and is never shipped to the browser bundle. The client calls POST /api/gemini
// with { action, ... } and gets back structured JSON — the key stays server-side.

export const config = { runtime: 'nodejs' };

const apiKey = process.env.GEMINI_API_KEY || '';
const genAI = new GoogleGenerativeAI(apiKey);

const inquirySchema = {
  type: SchemaType.OBJECT,
  properties: {
    villaName: { type: SchemaType.STRING },
    checkInDate: { type: SchemaType.STRING, description: 'Format: YYYY-MM-DD' },
    checkOutDate: { type: SchemaType.STRING, description: 'Format: YYYY-MM-DD' },
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
} as const;

function inquiryPrompt(rawText: string, currentYear: number): string {
  return `
You are a smart assistant for a Bali villa rental company. Extract contract information from the raw message below.
The message may be a WhatsApp chat, a forwarded inquiry, a quick note, or any casual text — it will NOT necessarily use labels or structured formatting.

Use context clues, common sense, and Bali rental conventions to extract:
- villaName: the name of the villa or property (e.g. "Villa Serenity", "Seminyak 3BR villa")
- checkInDate: arrival/start date — output strictly as YYYY-MM-DD (assume year ${currentYear} if not stated)
- checkOutDate: departure/end date — output strictly as YYYY-MM-DD (assume year ${currentYear} if not stated)
- monthlyPrice: the monthly / per-month rental rate as a plain integer (IDR amounts like "30jt", "30 juta", "30 mill", "30 million", "IDR 30.000.000" -> 30000000; USD "3000" -> 3000)
- totalPrice: the total agreed price as a plain integer (same conversion rules)
- bedrooms: number of bedrooms as an integer
- securityDeposit: security deposit amount as a plain integer
- paymentCurrency: "IDR", "USD", "EUR", or "USDT" — infer from context (Rp/juta/IDR -> IDR; $ -> USD)
- paymentTerms: any stated payment arrangement (e.g. "50% upfront")
- agent: name of the booking agent or agency (if mentioned)
- name: full name of the primary guest/tenant
- nationality: guest's nationality or country
- passport: passport number (letters + digits, e.g. "A1234567")
- phone: guest's phone or WhatsApp number
- numberOfGuests: total number of guests / people staying

Rules:
- Omit any field you cannot confidently infer — do NOT guess
- Never output 0 for numeric fields; omit them instead
- If the text mentions "2 months" or "6 weeks" without an explicit checkout date, calculate checkOutDate from checkInDate
- Prices written as "30" or "30k" with Rp context -> IDR 30,000,000; written as "$30" -> USD 30
- If only one date is mentioned and context says "from X for 1 month", derive checkOutDate
- Dates like "1 April", "April 1st", "1/4", "01-04" should resolve to ${currentYear}-04-01
- Current year for assumptions: ${currentYear}

Message:
"""
${rawText}
"""
  `;
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') { res.status(405).json({ error: 'POST only' }); return; }
  if (!apiKey) { res.status(503).json({ error: 'GEMINI_API_KEY not configured on the server.' }); return; }

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const { action } = body;

  try {
    if (action === 'parseInquiry') {
      const model = genAI.getGenerativeModel({
        model: 'gemini-2.5-flash',
        generationConfig: { responseMimeType: 'application/json', responseSchema: inquirySchema as any, temperature: 0.1 },
      });
      const result = await model.generateContent(inquiryPrompt(String(body.rawText || ''), new Date().getFullYear()));
      res.status(200).json({ data: JSON.parse(result.response.text()) });
      return;
    }

    if (action === 'extractPassport') {
      // body.image = { data: base64, mimeType }
      const model = genAI.getGenerativeModel({
        model: 'gemini-2.5-flash',
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: SchemaType.OBJECT,
            properties: {
              extractedName: { type: SchemaType.STRING, description: 'The full name of the passport holder' },
              extractedPassport: { type: SchemaType.STRING, description: 'The passport number' },
            },
          } as any,
          temperature: 0.1,
        },
      });
      const prompt = 'Read this passport image and extract the full name and the passport number. Use the Machine Readable Zone (MRZ) at the bottom for maximum accuracy if visible, otherwise read the text fields. Only return the final JSON.';
      const result = await model.generateContent([prompt, { inlineData: body.image }]);
      const parsed = JSON.parse(result.response.text());
      res.status(200).json({ extractedName: parsed.extractedName || '', extractedPassport: parsed.extractedPassport || '' });
      return;
    }

    res.status(400).json({ error: `Unknown action: ${action}` });
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Gemini request failed' });
  }
}
