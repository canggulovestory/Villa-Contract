import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';

// Initialize the Gemini client. Vite makes env vars available via `import.meta.env`
// However, the vite config injects process.env.GEMINI_API_KEY explicitly.
const apiKey = process.env.GEMINI_API_KEY || (import.meta as any).env?.VITE_GOOGLE_API_KEY || '';
const genAI = new GoogleGenerativeAI(apiKey);

/** Returns true if the Gemini API key is configured — false means AI features won't work. */
export const isGeminiAvailable = (): boolean => !!apiKey;

/** Parse a Gemini API error to surface the real cause to the user. */
function parseGeminiError(error: unknown): string {
  const msg = error instanceof Error ? error.message : String(error);
  if (!apiKey) return 'Gemini API key is not configured. Ask your administrator to set GEMINI_API_KEY in Vercel environment variables.';
  if (msg.includes('API key not valid') || msg.includes('API_KEY_INVALID') || msg.includes('401'))
    return 'Gemini API key is invalid or expired. Please check the GEMINI_API_KEY in Vercel settings.';
  if (msg.includes('quota') || msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED'))
    return 'Gemini API quota exceeded. Try again in a few minutes.';
  if (msg.includes('404') || msg.includes('not found') || msg.includes('model'))
    return 'Gemini model not available. The API key may not have access to gemini-2.5-flash.';
  return msg || 'Unknown AI error';
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ParsedInquiry {
  villaName?: string;
  checkInDate?: string;
  checkOutDate?: string;
  monthlyPrice?: number;
  totalPrice?: number;
  bedrooms?: number;
  securityDeposit?: number;
  paymentCurrency?: string;
  paymentTerms?: string;
  agent?: string;
  name?: string;
  nationality?: string;
  passport?: string;
  phone?: string;
  numberOfGuests?: number;
}

/**
 * Parses raw text from an inquiry (e.g. WhatsApp message) into structured ContractData overrides.
 * Returns `{ data, usedAI, aiError }` — usedAI is true when Gemini parsed successfully.
 * aiError contains the human-readable reason when AI was unavailable.
 */
export const parseInquiryText = async (rawText: string): Promise<{ data: ParsedInquiry; usedAI: boolean; aiError?: string }> => {
  // Skip Gemini entirely if no API key — go straight to regex fallback
  if (!apiKey) {
    return {
      data: parseRawTextFallback(rawText),
      usedAI: false,
      aiError: 'Gemini API key not configured (GEMINI_API_KEY missing from Vercel environment variables). Using basic text parser instead.',
    };
  }

  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
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

  const currentYear = new Date().getFullYear();
  const prompt = `
You are a smart assistant for a Bali villa rental company. Extract contract information from the raw message below.
The message may be a WhatsApp chat, a forwarded inquiry, a quick note, or any casual text — it will NOT necessarily use labels or structured formatting.

Use context clues, common sense, and Bali rental conventions to extract:
- villaName: the name of the villa or property (e.g. "Villa Serenity", "Seminyak 3BR villa")
- checkInDate: arrival/start date — output strictly as YYYY-MM-DD (assume year ${currentYear} if not stated)
- checkOutDate: departure/end date — output strictly as YYYY-MM-DD (assume year ${currentYear} if not stated)
- monthlyPrice: the monthly / per-month rental rate as a plain integer (IDR amounts like "30jt", "30 juta", "30 mill", "30 million", "IDR 30.000.000" → 30000000; USD "3000" → 3000)
- totalPrice: the total agreed price as a plain integer (same conversion rules)
- bedrooms: number of bedrooms as an integer
- securityDeposit: security deposit amount as a plain integer
- paymentCurrency: "IDR", "USD", "EUR", or "USDT" — infer from context (Rp/juta/IDR → IDR; $ → USD)
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
- Prices written as "30" or "30k" with Rp context → IDR 30,000,000; written as "$30" → USD 30
- If only one date is mentioned and context says "from X for 1 month", derive checkOutDate
- Dates like "1 April", "April 1st", "1/4", "01-04" should resolve to ${currentYear}-04-01
- Current year for assumptions: ${currentYear}

Message:
"""
${rawText}
"""
  `;

  try {
    const result = await model.generateContent(prompt);
    const response = result.response;
    return { data: JSON.parse(response.text()) as ParsedInquiry, usedAI: true };
  } catch (error) {
    const aiError = parseGeminiError(error);
    console.error('Gemini auto-fill failed:', aiError, error);
    return { data: parseRawTextFallback(rawText), usedAI: false, aiError };
  }
};

/** Regex-based fallback parser used when Gemini AI is unavailable or API key is not set. */
function parseRawTextFallback(raw: string): ParsedInquiry {
  // Normalise: "Label:\nValue" → "Label: Value"
  const txt = raw.replace(/:\s*\r?\n\s*([^\n:]+)/g, ': $1').replace(/\r\n/g, '\n');

  const extract = (patterns: RegExp[]): string => {
    for (const p of patterns) { const m = txt.match(p); if (m?.[1]) return m[1].trim().replace(/\*+/g,'').trim(); }
    return '';
  };
  const extractNum = (patterns: RegExp[]): number => {
    const s = extract(patterns).replace(/[^\d.]/g,''); const n = parseFloat(s); return isNaN(n) ? 0 : n;
  };
  const toISODate = (s: string): string => {
    if (!s) return '';
    const M: Record<string,string> = {
      january:'01',february:'02',march:'03',april:'04',may:'05',june:'06',
      july:'07',august:'08',september:'09',october:'10',november:'11',december:'12',
      jan:'01',feb:'02',mar:'03',apr:'04',jun:'06',jul:'07',aug:'08',sep:'09',oct:'10',nov:'11',dec:'12',
    };
    s = s.trim().replace(/^(?:mon|tue|wed|thu|fri|sat|sun)\w*,?\s*/i,'');
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    let m = s.match(/(\d{1,2})[\/\-\s]([a-z]+)[\/\-\s,]*(\d{4})/i);
    if (m) { const mo = M[m[2].toLowerCase()]; if (mo) return `${m[3]}-${mo}-${m[1].padStart(2,'0')}`; }
    m = s.match(/([a-z]+)[\/\-\s,]*(\d{1,2})[\/\-\s,]*(\d{4})/i);
    if (m) { const mo = M[m[1].toLowerCase()]; if (mo) return `${m[3]}-${mo}-${m[2].padStart(2,'0')}`; }
    return '';
  };
  const COUNTRIES = ['indonesian','australian','american','british','french','german','dutch',
    'chinese','japanese','korean','singaporean','malaysian','thai','indian','canadian',
    'indonesia','australia','america','france','germany','netherlands','china','japan',
    'korea','singapore','malaysia','thailand','india','canada','britain'];

  const name     = extract([/(?:guest|name|tenant|tamu)[:\s*]+([^\n,\r]+)/i]);
  const nationality = (() => {
    const l = extract([/(?:nationality|citizen(?:ship)?|kewarganegaraan|warga)[:\s*]+([^\n,\r]+)/i]);
    if (l) return l;
    for (const line of txt.split('\n')) { if (COUNTRIES.includes(line.trim().toLowerCase())) return line.trim(); }
    return '';
  })();
  const passport  = extract([/(?:passport|paspor)(?:\s*(?:no|number|#))[:\s*]*([A-Z0-9]+)/i, /(?:passport|paspor)[:\s*]+([A-Z0-9]+)/i]);
  const phone     = extract([/(?:phone|tel|hp|wa|whatsapp|mobile)[:\s*]+([\+\d\s\-()]+)/i]);
  const villaName = extract([/(?:villa|property|rumah)[:\s*]+([^\n,\r]+)/i]);
  const checkInRaw  = extract([/check[-\s]?in\s*(?:date|tanggal)?[:\s*]+([^\n\r]+)/i, /arrival[:\s*]+([^\n\r]+)/i]);
  const checkOutRaw = extract([/check[-\s]?out\s*(?:date|tanggal)?[:\s*]+([^\n\r]+)/i, /departure[:\s*]+([^\n\r]+)/i]);
  const monthlyPrice = extractNum([/monthly(?:\s*(?:price|rent|rate))?[:\s*]+([\d,.]+)/i, /per\s*month[:\s*]+([\d,.]+)/i]);
  const totalPrice   = extractNum([/total(?:\s*(?:price|amount|payment))?[:\s*]+([\d,.]+)/i]);

  return { name, nationality, passport, phone: phone.replace(/\s+/g,' ').trim(),
    villaName, checkInDate: toISODate(checkInRaw), checkOutDate: toISODate(checkOutRaw),
    monthlyPrice: monthlyPrice || undefined, totalPrice: totalPrice || undefined };
}

/**
 * Helper to convert a browser File object to the generative part required by the Gemini SDK.
 */
const fileToGenerativePart = async (file: File) => {
  const base64EncodedDataPromise = new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
    reader.readAsDataURL(file);
  });
  // Fix: ensure mimeType is never empty (HEIC files often have empty file.type)
  let mimeType = file.type;
  if (!mimeType || mimeType === 'application/octet-stream') {
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    if (ext === 'heic' || ext === 'heif') mimeType = 'image/heic';
    else if (ext === 'jpg' || ext === 'jpeg') mimeType = 'image/jpeg';
    else if (ext === 'png') mimeType = 'image/png';
    else mimeType = 'image/jpeg'; // safe fallback
  }
  return {
    inlineData: {
      data: await base64EncodedDataPromise,
      mimeType,
    }
  };
};

/**
 * Extracts Full Name and Passport Number from a passport image photo using Gemini Vision.
 */
export const extractPassportData = async (file: File): Promise<{ extractedName: string; extractedPassport: string }> => {
  // Fail fast with a useful message if the API key is not configured
  if (!apiKey) {
    throw new Error('AI scan is not available — GEMINI_API_KEY is not configured in Vercel. Please enter passport details manually.');
  }

  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
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
    const reason = parseGeminiError(error);
    console.error('Gemini passport scan failed:', reason, error);
    throw new Error(`Passport scan failed: ${reason} — please enter details manually.`);
  }
};
