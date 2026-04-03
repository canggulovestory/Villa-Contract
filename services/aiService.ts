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
    model: 'gemini-2.0-flash',
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
    console.error('Failed to parse inquiry with Gemini — falling back to regex parser:', error);
    return parseRawTextFallback(rawText);
  }
};

/** Regex-based fallback parser used when Gemini AI is unavailable or API key is not set. */
function parseRawTextFallback(raw: string): Record<string, any> {
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
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash',
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
