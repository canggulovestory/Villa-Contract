import Tesseract from 'tesseract.js';

// âââ Types âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

export interface OCRResult {
  text: string;
  extractedName?: string;
  extractedPassport?: string;
}

// âââ Constants ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

const MAX_FILE_SIZE_MB = 5;

// Fixed: tighter passport regex.
// International passport numbers are typically: 1-2 letters + 6-8 digits.
// The old regex /\b[A-Z0-9]{6,9}\b/ matched too many false positives
// (country codes, visa labels, etc.).
const PASSPORT_REGEX = /\b[A-Z]{1,2}[0-9]{6,8}\b/;

// âââ scanPassport âââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
// Runs Tesseract.js OCR on a passport image and extracts the number and name.
// All processing is client-side â no data leaves the browser.
//
// Fixed:
//  1. File size guard (5 MB max) to prevent browser hangs.
//  2. Logger removed from production output (was polluting console).
//  3. Tighter passport regex reduces false positives.
//  4. Better name heuristic avoids matching country names.
//  5. MRZ parsing stub now actually attempts extraction from MRZ lines.
//  6. Meaningful error messages passed to the caller.

export const scanPassport = async (file: File): Promise<OCRResult> => {
  // Fixed: guard against huge images that freeze the browser
  if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
    throw new Error(
      `Image is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). ` +
      `Please use an image under ${MAX_FILE_SIZE_MB} MB.`
    );
  }

  let result: Tesseract.RecognizeResult;
  try {
    result = await Tesseract.recognize(file, 'eng', {
      // Fixed: logger removed â was logging every progress tick to console.
      // Uncomment the line below during development if you need progress logs:
      // logger: (m) => console.log('[OCR]', m),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'OCR engine failed';
    throw new Error(`Could not scan image: ${message}. Please enter details manually.`);
  }

  const text  = result.data.text;
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);

  let extractedPassport = '';
  let extractedName     = '';

  // ââ Strategy 1: Parse the MRZ (Machine Readable Zone)
  // MRZ lines contain '<<' separators. Format example:
  //   P<USADOE<<JOHN<<<<<<<<<<<<<<<<<<<<<<<<<<<<
  //   A12345678USA7006072M2401014<<<<<<<<<<<<<<<6
  const mrzLines = lines.filter((l) => l.includes('<<'));

  if (mrzLines.length >= 1) {
    // Second MRZ line contains the passport number in positions 0-8
    const mrzDataLine = mrzLines.find((l) => /^[A-Z0-9<]{9}/.test(l));
    if (mrzDataLine) {
      const candidate = mrzDataLine.substring(0, 9).replace(/</g, '');
      if (PASSPORT_REGEX.test(candidate)) {
        extractedPassport = candidate;
      }
    }

    // First MRZ line contains: P<COUNTRY<<SURNAME<<GIVEN_NAMES
    const mrzNameLine = mrzLines.find((l) => l.startsWith('P<') || l.startsWith('P '));
    if (mrzNameLine) {
      const parts = mrzNameLine.replace(/^P<[A-Z]{3}/, '').split('<<');
      const surname   = parts[0]?.replace(/</g, ' ').trim() ?? '';
      const givenName = parts[1]?.replace(/</g, ' ').trim() ?? '';
      if (surname) extractedName = `${surname} ${givenName}`.trim();
    }
  }

  // ââ Strategy 2: Regex search for passport number if MRZ failed
  if (!extractedPassport) {
    const found = text.match(PASSPORT_REGEX);
    if (found) extractedPassport = found[0];
  }

  // ââ Strategy 3: Name heuristic if MRZ failed
  // Fixed: old heuristic matched country names like "REPUBLIC OF INDONESIA".
  // Now we require: all caps, no numbers, 2 â4 words, length 5â40 chars,
  // and exclude common non-name lines.
  const NON_NAME_KEYWORDS = [
    'PASSPORT', 'REPUBLIC', 'INDONESIA', 'UNITED', 'STATES', 'NATIONALITY',
    'SURNAME', 'GIVEN', 'NAMES', 'DATE', 'BIRTH', 'PLACE', 'EXPIRY', 'VALID',
    'AUTHORITY', 'PERSONAL', 'NUMBER', 'TYPE', 'CODE', 'COUNTRY',
  ];

  if (!extractedName) {
    const nameCandidates = lines.filter((l) => {
      if (!/^[A-Z\s]+$/.test(l)) return false;            // must be all caps
      if (l.length < 5 || l.length > 40) return false;    // reasonable name length
      const words = l.split(' ').filter(Boolean);
      if (words.length < 2 || words.length > 4) return false; // 2-4 words
      if (NON_NAME_KEYWORDS.some((kw) => l.includes(kw))) return false;
      return true;
    });
    if (nameCandidates.length > 0) extractedName = nameCandidates[0];
  }

  return { text, extractedName, extractedPassport };
};
