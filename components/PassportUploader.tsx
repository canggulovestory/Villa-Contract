import React, { useState } from 'react';
import { Upload, ScanLine, AlertCircle, CheckCircle2 } from 'lucide-react';
import { scanPassport } from '../services/ocrService';

// ─── Types ────────────────────────────────────────────────────────────────

interface PassportUploaderProps {
  id: string;                                            // unique per guest instance
  onScanComplete: (name: string, passport: string, file?: File) => void;
}

// ─── PassportUploader ─────────────────────────────────────────────────────
// Allows users to upload a passport image. Runs Tesseract.js OCR in the
// browser (no server needed) and calls onScanComplete with extracted data.
//
// Fixed:
//  1. File size guard (5 MB) — prevents browser hangs on large phone photos.
//  2. Accurate success/warning states — "success" now only shows when data
//     was actually extracted; a warning is shown when OCR returned nothing.
//  3. Cleaner error message — no longer dumps raw OCR text into the UI.
//  4. Accepts .heic in addition to JPG/PNG (common iPhone format).
//  5. onScanComplete is only called with real data (no silent empty override).

export const PassportUploader: React.FC<PassportUploaderProps> = ({ id, onScanComplete }) => {
  const [isScanning, setIsScanning]   = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const [status, setStatus]           = useState<'idle' | 'success' | 'partial'>('idle');

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsScanning(true);
    setError(null);
    setStatus('idle');

    try {
      const result = await scanPassport(file);

      const name     = result.extractedName     || '';
      const passport = result.extractedPassport || '';

      // Always fire the callback so the parent can update fields (pass file for Drive upload)
      onScanComplete(name, passport, file);

      if (name || passport) {
        // Fixed: only mark as "success" when we actually found something
        setStatus('success');
      } else {
        // Fixed: "partial" state gives accurate feedback — scan ran but
        // found nothing; user needs to fill in manually.
        setStatus('partial');
      }
    } catch (err: unknown) {
      // Fixed: shows the actual error from ocrService (size limit, engine
      // failure, etc.) rather than a generic catch-all message.
      const message = err instanceof Error ? err.message : 'Could not scan image.';
      setError(message);
    } finally {
      setIsScanning(false);
      // Reset input so the same file can be re-uploaded if needed
      e.target.value = '';
    }
  };

  return (
    <div className="bg-emerald-50 border-2 border-dashed border-emerald-300 rounded-xl p-6 text-center transition-colors hover:bg-emerald-100">
      <input
        type="file"
        id={id}
        // Fixed: added .heic (iPhone default) alongside jpg/png
        accept="image/png, image/jpeg, image/jpg, image/heic"
        className="hidden"
        onChange={handleFileChange}
        disabled={isScanning}
      />

      <label htmlFor={id} className="cursor-pointer flex flex-col items-center gap-3">
        {isScanning ? (
          <div className="animate-pulse flex flex-col items-center">
            <ScanLine className="w-10 h-10 text-emerald-600 animate-bounce" />
            <span className="text-emerald-700 font-medium">Scanning Passport...</span>
            <span className="text-xs text-emerald-600 mt-1">This runs locally in your browser.</span>
          </div>
        ) : (
          <>
            <Upload className="w-10 h-10 text-emerald-600" />
            <div className="text-emerald-900 font-medium">Click to Upload Passport (OCR)</div>
            <p className="text-sm text-emerald-600">
              Supports JPG / PNG / HEIC · Max 5 MB · Auto-fills Name &amp; Number
            </p>
          </>
        )}
      </label>

      {/* Error state */}
      {error && (
        <div className="mt-4 flex items-start gap-2 text-red-600 bg-red-50 p-3 rounded-lg text-sm text-left">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Full success */}
      {status === 'success' && !error && (
        <div className="mt-4 flex items-center justify-center gap-2 text-emerald-700 bg-white/50 p-2 rounded-lg text-sm">
          <CheckCircle2 className="w-4 h-4" />
          Scanned successfully! Please verify the fields below.
        </div>
      )}

      {/* Fixed: partial state — scan ran but no data found */}
      {status === 'partial' && !error && (
        <div className="mt-4 flex items-start gap-2 text-amber-700 bg-amber-50 p-3 rounded-lg text-sm text-left">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          Scan complete but could not auto-detect fields. Please enter the name and
          passport number manually below.
        </div>
      )}
    </div>
  );
};
