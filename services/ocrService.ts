import Tesseract from 'tesseract.js';

interface OCRResult {
  text: string;
  extractedName?: string;
  extractedPassport?: string;
}

export const scanPassport = async (file: File): Promise<OCRResult> => {
  try {
    const result = await Tesseract.recognize(file, 'eng', {
      logger: (m) => console.log(m), // Optional: log progress
    });

    const text = result.data.text;
    
    // Very basic heuristics to find data. 
    // Note: Passport OCR is complex; this is a best-effort client-side attempt.
    const lines = text.split('\n');
    let extractedPassport = '';
    let extractedName = '';

    // Regex for Passport format (common international format: 1 letter + 7-8 digits, or similar)
    const passportRegex = /\b[A-Z0-9]{6,9}\b/;
    
    // Attempt to parse (naive implementation)
    // Often text contains "PASSPORT" or "P<" lines (MRZ).
    
    // 1. Look for MRZ (Machine Readable Zone) which is most reliable
    const mrzLine = lines.find(l => l.includes('<<'));
    if (mrzLine) {
       // MRZ parsing logic would go here, simplified for now:
       // P<USADOE<<JOHN<<<<<<<<<...
    }

    // 2. Simple regex search in full text if MRZ fails or for non-MRZ lines
    const foundPassport = text.match(passportRegex);
    if (foundPassport) {
      extractedPassport = foundPassport[0];
    }

    // 3. Name heuristic (This is hard without structured parsing)
    // We'll return the raw text mostly, but try to find lines that look like names (all caps, no numbers)
    const possibleNames = lines.filter(l => /^[A-Z\s]+$/.test(l.trim()) && l.length > 5 && !l.includes('PASSPORT'));
    if (possibleNames.length > 0) {
      extractedName = possibleNames[0]; // Take the first likely candidate
    }

    return {
      text,
      extractedName,
      extractedPassport
    };
  } catch (error) {
    console.error("OCR Failed", error);
    throw new Error("Failed to scan image.");
  }
};