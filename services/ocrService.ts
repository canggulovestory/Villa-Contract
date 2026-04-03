import { extractPassportData } from './aiService';

// ─── Types ────────────────────────────────────────────────────────────────

export interface OCRResult {
  text: string;
  extractedName?: string;
  extractedPassport?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────

const MAX_FILE_SIZE_MB = 10; // Gemini can handle more, but 10MB is a good limit.

// ─── scanPassport ─────────────────────────────────────────────────────────

export const scanPassport = async (file: File): Promise<OCRResult> => {
  if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
    throw new Error(
      `Image is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). ` +
      `Please use an image under ${MAX_FILE_SIZE_MB} MB.`
    );
  }

  try {
    const { extractedName, extractedPassport } = await extractPassportData(file);
    return {
      text: "Parsed with Gemini 1.5 Flash Vision.", // stub since UI might not need raw text anymore
      extractedName,
      extractedPassport,
    };
  } catch (err: unknown) {
    // Pass through the original error — don't double-wrap
    if (err instanceof Error) throw err;
    throw new Error('Image scan failed. Please enter details manually.');
  }
};
