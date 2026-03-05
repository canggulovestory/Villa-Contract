// ─── Smart Paste Parser ──────────────────────────────────────────────────────
// Extracts contract fields from unstructured text (WhatsApp, emails, notes)
// Works with BOTH labeled format ("Name: John") AND free prose paragraphs

export interface SmartParseResult {
  detected: string[];
  // Guest / Lessee
  guestName: string;
  guestPassport: string;
  guestNationality: string;
  guestPhone: string;
  guestBirthday: string;
  // Villa
  villaName: string;
  propertyCode: string;
  // Stay
  checkInDate: string;
  checkOutDate: string;
  // Financial
  totalPrice: number;
  monthlyPrice: number;
  paymentCurrency: string;
  securityDeposit: number;
  // Lessor / Owner
  lessorName: string;
  lessorNIK: string;
  lessorCountry: string;
  lessorAddressOrBirth: string;
  // Agent
  agentCompanyName: string;
  agentPIC: string;
  agentPhone: string;
  agentEmail: string;
  agentPartnershipType: string;
}

// ─── Month lookup ────────────────────────────────────────────────────────────
const MONTHS: Record<string, string> = {
  jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
  jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
  january: '01', february: '02', march: '03', april: '04', june: '06',
  july: '07', august: '08', september: '09', october: '10', november: '11', december: '12',
};

// ─── Nationality adjective → country name ────────────────────────────────────
const NATIONALITY_MAP: Record<string, string> = {
  // English adjectives
  american: 'United States', australian: 'Australia', austrian: 'Austria',
  belgian: 'Belgium', brazilian: 'Brazil', british: 'United Kingdom',
  canadian: 'Canada', chinese: 'China', czech: 'Czech Republic',
  danish: 'Denmark', dutch: 'Netherlands', egyptian: 'Egypt',
  emirati: 'United Arab Emirates', english: 'United Kingdom', finnish: 'Finland',
  french: 'France', german: 'Germany', greek: 'Greece',
  hongkonger: 'Hong Kong', hungarian: 'Hungary', indian: 'India',
  indonesian: 'Indonesia', irish: 'Ireland', israeli: 'Israel',
  italian: 'Italy', japanese: 'Japan', jordanian: 'Jordan',
  korean: 'South Korea', kuwaiti: 'Kuwait', lebanese: 'Lebanon',
  malaysian: 'Malaysia', mexican: 'Mexico', moroccan: 'Morocco',
  nepalese: 'Nepal', 'new zealander': 'New Zealand', nigerian: 'Nigeria',
  norwegian: 'Norway', omani: 'Oman', pakistani: 'Pakistan',
  philippine: 'Philippines', polish: 'Poland', portuguese: 'Portugal',
  qatari: 'Qatar', romanian: 'Romania', russian: 'Russia',
  saudi: 'Saudi Arabia', scottish: 'United Kingdom', singaporean: 'Singapore',
  'south african': 'South Africa', spanish: 'Spain', 'sri lankan': 'Sri Lanka',
  swedish: 'Sweden', swiss: 'Switzerland', taiwanese: 'Taiwan',
  thai: 'Thailand', turkish: 'Turkey', ukrainian: 'Ukraine',
  uruguayan: 'Uruguay', venezuelan: 'Venezuela', vietnamese: 'Vietnam',
  welsh: 'United Kingdom',
  // Country names directly (common shorthands)
  uk: 'United Kingdom', usa: 'United States', uae: 'United Arab Emirates',
  us: 'United States', nz: 'New Zealand',
};

// ─── Date normalizer → yyyy-mm-dd ────────────────────────────────────────────
const parseDate = (raw: string): string => {
  if (!raw) return '';
  raw = raw.trim().replace(/['\"]/g, '');

  // Already ISO
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

  // dd/mm/yyyy  or  dd-mm-yyyy  or  dd.mm.yyyy
  let m = raw.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;

  // "15 March 2025"  /  "15th March 2025"
  m = raw.match(/^(\d{1,2})(?:st|nd|rd|th)?\s+([a-zA-Z]+)\s+(\d{4})$/i);
  if (m) {
    const mon = MONTHS[m[2].toLowerCase()];
    if (mon) return `${m[3]}-${mon}-${m[1].padStart(2, '0')}`;
  }

  // "March 15 2025" / "March 15, 2025"
  m = raw.match(/^([a-zA-Z]+)\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})$/i);
  if (m) {
    const mon = MONTHS[m[1].toLowerCase()];
    if (mon) return `${m[3]}-${mon}-${m[2].padStart(2, '0')}`;
  }

  // "15 Mar" or "15 March" — assume current or next year
  m = raw.match(/^(\d{1,2})(?:st|nd|rd|th)?\s+([a-zA-Z]+)$/i);
  if (m) {
    const mon = MONTHS[m[2].toLowerCase()];
    if (mon) {
      const year = new Date().getFullYear();
      return `${year}-${mon}-${m[1].padStart(2, '0')}`;
    }
  }

  // "Mar 15" or "March 15" (no year)
  m = raw.match(/^([a-zA-Z]+)\s+(\d{1,2})(?:st|nd|rd|th)?$/i);
  if (m) {
    const mon = MONTHS[m[1].toLowerCase()];
    if (mon) {
      const year = new Date().getFullYear();
      return `${year}-${mon}-${m[2].padStart(2, '0')}`;
    }
  }

  return '';
};

// ─── Add months/nights to a date ─────────────────────────────────────────────
const addToDate = (startISO: string, months?: number, nights?: number): string => {
  if (!startISO) return '';
  const d = new Date(startISO);
  if (months) d.setMonth(d.getMonth() + months);
  if (nights) d.setDate(d.getDate() + nights);
  return d.toISOString().split('T')[0];
};

// ─── Extract value after a label (handles "Label: value" or "Label value") ──
const extractLabel = (text: string, ...labels: string[]): string => {
  for (const label of labels) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(
      `(?:^|\\n)\\s*${escaped}\\s*[:\\-]?\\s*(.+?)\\s*(?:\\n|$)`,
      'im'
    );
    const m = text.match(regex);
    if (m) return m[1].trim().replace(/^["':*\-]+|["':*\-]+$/g, '').trim();
  }
  return '';
};

// ─── Price cleaner → integer ─────────────────────────────────────────────────
const extractPrice = (raw: string): number => {
  if (!raw) return 0;
  // Handle "45 million" / "45jt" / "45,000,000" / "45.000.000"
  const milM = raw.match(/(\d+(?:[.,]\d+)?)\s*(?:million|juta|jt|M\b)/i);
  if (milM) return Math.round(parseFloat(milM[1].replace(',', '.')) * 1_000_000);
  const cleaned = raw.replace(/[.,\s]/g, '');
  return parseInt(cleaned) || 0;
};

// ─── PROSE detectors (work without labels) ───────────────────────────────────

/** Detect nationality adjective anywhere in text → standard country name */
const detectNationality = (text: string): string => {
  // Try multi-word first (e.g. "South African", "New Zealander")
  for (const [adj, country] of Object.entries(NATIONALITY_MAP)) {
    if (adj.includes(' ')) {
      if (new RegExp(`\\b${adj}\\b`, 'i').test(text)) return country;
    }
  }
  // Single-word adjectives
  for (const [adj, country] of Object.entries(NATIONALITY_MAP)) {
    if (!adj.includes(' ') && new RegExp(`\\b${adj}\\b`, 'i').test(text)) return country;
  }
  return '';
};

/** Detect guest name from prose: "guest John Smith", "client John Smith", "for John Smith" */
const detectGuestNameFromProse = (text: string): string => {
  const patterns = [
    /\b(?:guest|client|lessee|tenant|tamu|untuk|for|nama)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,3})/,
    /\b(?:Hi|Hello|Dear)\s*,?\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})\b/,
    /([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})\s+(?:is|will|would|has|have|a\s+guest|arrives?|checking)/,
  ];
  for (const pat of patterns) {
    const m = text.match(pat);
    if (m) return m[1].trim();
  }
  return '';
};

/** Detect dates from prose: "arriving 1 April", "from April 1", "check in 1 April 2025" etc. */
const detectProseDate = (text: string, keywords: string[]): string => {
  for (const kw of keywords) {
    const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // keyword followed by date
    const fwd = new RegExp(
      `${escaped}\\s+(?:on\\s+)?(?:the\\s+)?(\\d{1,2}(?:st|nd|rd|th)?\\s+(?:[a-zA-Z]+)(?:\\s+\\d{4})?)`,
      'i'
    );
    let m = text.match(fwd);
    if (m) { const d = parseDate(m[1]); if (d) return d; }

    // date followed by keyword
    const bwd = new RegExp(
      `(\\d{1,2}(?:st|nd|rd|th)?\\s+(?:[a-zA-Z]+)(?:\\s+\\d{4})?)\\s+${escaped}`,
      'i'
    );
    m = text.match(bwd);
    if (m) { const d = parseDate(m[1]); if (d) return d; }

    // month name + day (e.g. "April 1st")
    const fwd2 = new RegExp(
      `${escaped}\\s+(?:on\\s+)?(?:the\\s+)?([a-zA-Z]+\\s+\\d{1,2}(?:st|nd|rd|th)?(?:\\s+\\d{4})?)`,
      'i'
    );
    m = text.match(fwd2);
    if (m) { const d = parseDate(m[1]); if (d) return d; }
  }
  return '';
};

/** Detect duration: "1 month", "3 months", "2 weeks", "30 nights", "30 days" */
const detectDuration = (text: string): { months?: number; nights?: number } => {
  let m = text.match(/(\d+)\s*month(?:s)?/i);
  if (m) return { months: parseInt(m[1]) };
  m = text.match(/(\d+)\s*(?:night|malam)(?:s)?/i);
  if (m) return { nights: parseInt(m[1]) };
  m = text.match(/(\d+)\s*(?:week)(?:s)?/i);
  if (m) return { nights: parseInt(m[1]) * 7 };
  m = text.match(/(\d+)\s*(?:day|hari)(?:s)?/i);
  if (m && parseInt(m[1]) > 1) return { nights: parseInt(m[1]) };
  return {};
};

/** Detect inline price from prose without a label */
const detectProsePrice = (text: string): number => {
  // "IDR 45,000,000" / "Rp 45.000.000" / "45 juta IDR" / "$5,000" / "5,000 USD"
  const patterns = [
    /(?:IDR|Rp\.?|USD|\$|EUR|€|USDT)\s*([\d.,]+\s*(?:juta|jt|million|M\b)?)/i,
    /([\d.,]+\s*(?:juta|jt|million|M\b))\s*(?:IDR|Rp\.?|USD|\$|EUR|USDT)/i,
    /([\d.,]+\s*(?:juta|jt|million))/i,  // "45 juta" without currency symbol
  ];
  for (const pat of patterns) {
    const m = text.match(pat);
    if (m) {
      const v = extractPrice(m[1]);
      if (v > 0) return v;
    }
  }
  return 0;
};

// ─── Main parser ─────────────────────────────────────────────────────────────
export const smartParse = (text: string): SmartParseResult => {
  const r: SmartParseResult = {
    detected: [],
    guestName: '', guestPassport: '', guestNationality: '', guestPhone: '', guestBirthday: '',
    villaName: '', propertyCode: '',
    checkInDate: '', checkOutDate: '',
    totalPrice: 0, monthlyPrice: 0, paymentCurrency: '', securityDeposit: 0,
    lessorName: '', lessorNIK: '', lessorCountry: '', lessorAddressOrBirth: '',
    agentCompanyName: '', agentPIC: '', agentPhone: '', agentEmail: '', agentPartnershipType: '',
  };

  // ── GUEST / LESSEE ─────────────────────────────────────────────────────────
  const nameRaw = extractLabel(text,
    'name', 'guest', 'client', 'lessee', 'tenant', 'tamu', 'nama', 'nama tamu', 'guest name',
    'client name', 'full name', 'nama lengkap',
  );
  if (nameRaw) { r.guestName = nameRaw; r.detected.push('Guest Name'); }
  else {
    const proseName = detectGuestNameFromProse(text);
    if (proseName) { r.guestName = proseName; r.detected.push('Guest Name'); }
  }

  // Passport / ID
  const passRaw = extractLabel(text,
    'passport', 'passport no', 'passport number', 'ktp', 'id no', 'id number', 'ic number',
    'no paspor', 'paspor',
  );
  if (passRaw) { r.guestPassport = passRaw; r.detected.push('Passport/ID'); }
  else {
    // Pattern: 1-2 letters + 6-9 digits (passport format)
    const m = text.match(/\b([A-Z]{1,2}\d{6,9})\b/);
    if (m) { r.guestPassport = m[1]; r.detected.push('Passport/ID'); }
  }

  // Nationality — label first, then prose adjective
  const natRaw = extractLabel(text,
    'nationality', 'citizen', 'kewarganegaraan', 'warga negara',
  );
  if (natRaw) { r.guestNationality = natRaw; r.detected.push('Nationality'); }
  else {
    const nat = detectNationality(text);
    if (nat) { r.guestNationality = nat; r.detected.push('Nationality'); }
  }

  // Phone
  const phoneRaw = extractLabel(text,
    'phone', 'wa', 'whatsapp', 'hp', 'mobile', 'tel', 'contact', 'handphone',
    'no hp', 'nomor', 'phone number', 'wa number', 'no telp',
  );
  if (phoneRaw) {
    r.guestPhone = phoneRaw.replace(/[^\d+\s\-()\.]/, '').trim();
    r.detected.push('Phone');
  } else {
    // Detect standalone phone number (international or local)
    const m = text.match(/(?<!\w)(\+?6?2?[\d\s\-]{9,15})(?!\w)/);
    if (m && m[1].replace(/\D/g, '').length >= 8) {
      r.guestPhone = m[1].trim();
      r.detected.push('Phone');
    }
  }

  // Birthday
  const bdRaw = extractLabel(text,
    'birthday', 'born', 'dob', 'date of birth', 'birth date', 'tanggal lahir', 'tgl lahir',
  );
  if (bdRaw) { r.guestBirthday = bdRaw; r.detected.push('Birthday'); }

  // ── VILLA ──────────────────────────────────────────────────────────────────
  const villaLabelRaw = extractLabel(text, 'villa', 'property', 'unit', 'properti', 'rumah');
  if (villaLabelRaw) { r.villaName = villaLabelRaw; r.detected.push('Villa Name'); }
  else {
    // Auto-detect "Villa XYZ" pattern (works in prose too)
    const m = text.match(/\b(villa\s+[A-Za-z]+(?:\s+[A-Za-z]+)?)\b/i);
    if (m) { r.villaName = m[1]; r.detected.push('Villa Name'); }
  }

  const codeRaw = extractLabel(text, 'property code', 'code', 'kode', 'unit code', 'villa code');
  if (codeRaw) { r.propertyCode = codeRaw; r.detected.push('Property Code'); }

  // ── DATES ──────────────────────────────────────────────────────────────────
  // Try label first
  const ciRaw = extractLabel(text,
    'check.in', 'check in', 'checkin', 'arrive', 'arrival', 'from', 'start date',
    'masuk', 'mulai', 'tgl masuk', 'tanggal masuk',
  );
  if (ciRaw) {
    const d = parseDate(ciRaw.split(/\s*[-–to]+\s*/i)[0].trim());
    if (d) { r.checkInDate = d; r.detected.push('Check-in'); }
  }

  const coRaw = extractLabel(text,
    'check.out', 'check out', 'checkout', 'depart', 'departure', 'until', 'till', 'end date',
    'keluar', 'selesai', 'tgl keluar', 'tanggal keluar',
  );
  if (coRaw) {
    const d = parseDate(coRaw);
    if (d) { r.checkOutDate = d; r.detected.push('Check-out'); }
  }

  // Date range patterns: "1 April - 30 April 2025" or "01/04/2025 - 30/04/2025"
  if (!r.checkInDate || !r.checkOutDate) {
    const rangePatterns = [
      /(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})\s*[-–to]+\s*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i,
      /(\d{1,2}(?:st|nd|rd|th)?\s+\w+(?:\s+\d{4})?)\s*[-–to]+\s*(\d{1,2}(?:st|nd|rd|th)?\s+\w+\s+\d{4})/i,
    ];
    for (const pat of rangePatterns) {
      const m = text.match(pat);
      if (m) {
        if (!r.checkInDate) { const d = parseDate(m[1]); if (d) { r.checkInDate = d; r.detected.push('Check-in'); } }
        if (!r.checkOutDate) { const d = parseDate(m[2]); if (d) { r.checkOutDate = d; r.detected.push('Check-out'); } }
        break;
      }
    }
  }

  // Prose date detection (no labels)
  if (!r.checkInDate) {
    const d = detectProseDate(text, ['arriving', 'arrives', 'arrival', 'check.?in', 'checking in', 'from', 'start', 'mulai', 'masuk', 'tanggal masuk']);
    if (d) { r.checkInDate = d; r.detected.push('Check-in'); }
  }
  if (!r.checkOutDate) {
    const d = detectProseDate(text, ['leaving', 'checkout', 'check.?out', 'departs?', 'until', 'till', 'to', 'end', 'selesai', 'keluar']);
    if (d) { r.checkOutDate = d; r.detected.push('Check-out'); }
  }

  // Duration-based checkout: if we have check-in but no check-out, use duration
  if (r.checkInDate && !r.checkOutDate) {
    const dur = detectDuration(text);
    if (dur.months || dur.nights) {
      const co = addToDate(r.checkInDate, dur.months, dur.nights);
      if (co) { r.checkOutDate = co; r.detected.push('Check-out'); }
    }
  }

  // ── FINANCIALS ─────────────────────────────────────────────────────────────
  // Detect currency first
  const currencyMap: [RegExp, string][] = [
    [/\bUSDT\b/i, 'USDT'],
    [/\bUSD\b|\$(?!\d)/i, 'USD'],
    [/\bEUR\b|€/i, 'EUR'],
    [/\bIDR\b|\bRp\.?\b|\brupiah\b/i, 'IDR'],
  ];
  for (const [pattern, cur] of currencyMap) {
    if (pattern.test(text)) { r.paymentCurrency = cur; break; }
  }

  const priceRaw = extractLabel(text, 'price', 'total price', 'total', 'harga', 'biaya', 'amount', 'rent', 'sewa');
  if (priceRaw) {
    r.totalPrice = extractPrice(priceRaw);
    if (r.totalPrice) r.detected.push('Total Price');
  } else {
    // Prose: "IDR 45,000,000" or "45,000,000 IDR" or "Rp 45.000.000" or "45 juta"
    const prosePrice = detectProsePrice(text);
    if (prosePrice) {
      r.totalPrice = prosePrice;
      r.detected.push('Total Price');
    }
  }

  const monthlyRaw = extractLabel(text, 'monthly', 'monthly price', 'monthly rate', 'per month', 'per bulan', 'monthly rent');
  if (monthlyRaw) {
    r.monthlyPrice = extractPrice(monthlyRaw);
    if (r.monthlyPrice) r.detected.push('Monthly Price');
  } else {
    // Detect "per month" / "per bulan" price in prose
    const monthlyM = text.match(/([\d.,]+\s*(?:juta|jt|million|M\b)?)\s*(?:per\s*month|per\s*bulan|\/month|\/bulan)/i);
    if (monthlyM) {
      r.monthlyPrice = extractPrice(monthlyM[1]);
      if (r.monthlyPrice) r.detected.push('Monthly Price');
    }
  }

  const depositRaw = extractLabel(text, 'deposit', 'security deposit', 'dp', 'down payment', 'uang jaminan');
  if (depositRaw) {
    r.securityDeposit = extractPrice(depositRaw);
    if (r.securityDeposit) r.detected.push('Security Deposit');
  }

  // ── EMAIL (anywhere in text) ───────────────────────────────────────────────
  const emailM = text.match(/[\w.+-]+@[\w-]+\.[a-zA-Z]{2,}/);
  if (emailM) { r.agentEmail = emailM[0]; r.detected.push('Email'); }

  // ── LESSOR / OWNER ─────────────────────────────────────────────────────────
  const ownerRaw = extractLabel(text, 'owner', 'lessor', 'landlord', 'pemilik', 'owner name');
  if (ownerRaw) { r.lessorName = ownerRaw; r.detected.push('Owner Name'); }

  const nikRaw = extractLabel(text, 'nik', 'ktp no', 'ktp number', 'national id');
  if (nikRaw) { r.lessorNIK = nikRaw; r.detected.push('NIK/ID'); }

  const lessorCountryRaw = extractLabel(text, 'owner country', 'owner nationality', 'lessor country');
  if (lessorCountryRaw) { r.lessorCountry = lessorCountryRaw; r.detected.push('Owner Country'); }

  // ── AGENT ──────────────────────────────────────────────────────────────────
  const agentRaw = extractLabel(text, 'agent', 'agency', 'company', 'perusahaan', 'agent company');
  if (agentRaw) { r.agentCompanyName = agentRaw; r.detected.push('Agent Company'); }

  const picRaw = extractLabel(text, 'pic', 'person in charge', 'contact person', 'agent pic', 'penanggung jawab');
  if (picRaw) { r.agentPIC = picRaw; r.detected.push('Agent PIC'); }

  const agentPhoneRaw = extractLabel(text, 'agent phone', 'agent wa', 'agent whatsapp', 'agent contact');
  if (agentPhoneRaw) { r.agentPhone = agentPhoneRaw; r.detected.push('Agent Phone'); }

  const agentTypeRaw = extractLabel(text, 'partnership type', 'partner type', 'agent type');
  if (agentTypeRaw) { r.agentPartnershipType = agentTypeRaw; r.detected.push('Partnership Type'); }

  return r;
};
