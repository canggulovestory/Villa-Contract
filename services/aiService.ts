// ─── AI service (client) ────────────────────────────────────────────────────
// The Gemini API key NEVER lives in the browser. All Gemini calls go through the
// server-side proxy at /api/gemini (see api/gemini.ts), which holds the key in
// process.env.GEMINI_API_KEY. The client only sends { action, ... } and reads JSON.

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
 * AI features are served by the backend proxy; the client can't see the key, so we
 * optimistically assume availability and let the proxy return a clear error (503)
 * when GEMINI_API_KEY isn't configured. Callers already handle the fallback path.
 */
export const isGeminiAvailable = (): boolean => true;

/** POST to the server-side Gemini proxy. Throws with the server's message on failure. */
async function callGemini(payload: Record<string, unknown>): Promise<any> {
  const res = await fetch('/api/gemini', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    let msg = `AI request failed (${res.status})`;
    try { const j = await res.json(); if (j?.error) msg = j.error; } catch { /* ignore */ }
    throw new Error(msg);
  }
  return res.json();
}

/**
 * Parses raw text from an inquiry (e.g. WhatsApp message) into structured ContractData overrides.
 * Returns `{ data, usedAI, aiError }` — usedAI is true when Gemini parsed successfully.
 */
export const parseInquiryText = async (rawText: string): Promise<{ data: ParsedInquiry; usedAI: boolean; aiError?: string }> => {
  try {
    const { data } = await callGemini({ action: 'parseInquiry', rawText });
    return { data: data as ParsedInquiry, usedAI: true };
  } catch (error) {
    const aiError = error instanceof Error ? error.message : 'AI unavailable';
    console.error('Gemini auto-fill failed, using regex fallback:', aiError);
    return { data: parseRawTextFallback(rawText), usedAI: false, aiError };
  }
};

/** Regex-based fallback parser used when the AI proxy is unavailable. */
function parseRawTextFallback(raw: string): ParsedInquiry {
  // Normalise: "Label:\nValue" → "Label: Value"
  const txt = raw.replace(/:\s*\r?\n\s*([^\n:]+)/g, ': $1').replace(/\r\n/g, '\n');

  const extract = (patterns: RegExp[]): string => {
    for (const p of patterns) { const m = txt.match(p); if (m?.[1]) return m[1].trim().replace(/\*+/g,'').trim(); }
    return '';
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

  return { name, nationality, passport, phone: phone.replace(/\s+/g,' ').trim(),
    villaName, checkInDate: toISODate(checkInRaw), checkOutDate: toISODate(checkOutRaw) };
}

/** Convert a browser File to { data(base64), mimeType } for the proxy. */
const fileToInlineData = async (file: File): Promise<{ data: string; mimeType: string }> => {
  const base64 = await new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
    reader.readAsDataURL(file);
  });
  let mimeType = file.type;
  if (!mimeType || mimeType === 'application/octet-stream') {
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    if (ext === 'heic' || ext === 'heif') mimeType = 'image/heic';
    else if (ext === 'jpg' || ext === 'jpeg') mimeType = 'image/jpeg';
    else if (ext === 'png') mimeType = 'image/png';
    else mimeType = 'image/jpeg';
  }
  return { data: base64, mimeType };
};

/**
 * Extracts Full Name and Passport Number from a passport image via the server proxy (Gemini Vision).
 */
export const extractPassportData = async (file: File): Promise<{ extractedName: string; extractedPassport: string }> => {
  try {
    const image = await fileToInlineData(file);
    const r = await callGemini({ action: 'extractPassport', image });
    return { extractedName: r.extractedName || '', extractedPassport: r.extractedPassport || '' };
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'Unknown error';
    console.error('Gemini passport scan failed:', reason);
    throw new Error(`Passport scan failed: ${reason} — please enter details manually.`);
  }
};
