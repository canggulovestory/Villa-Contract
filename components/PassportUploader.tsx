import React, { useState } from 'react';
import { Upload, ScanLine, AlertCircle, CheckCircle2 } from 'lucide-react';
import { scanPassport } from '../services/ocrService';

interface PassportUploaderProps {
  guestIndex: number;
  onScanComplete: (name: string, passport: string) => void;
}

export const PassportUploader: React.FC<PassportUploaderProps> = ({ guestIndex, onScanComplete }) => {
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsScanning(true);
    setError(null);
    setSuccess(false);

    try {
      const result = await scanPassport(file);

      // Heuristic fallback: if scan works but regex fails, we still consider it "scanned"
      // but maybe alert user to check fields.
      const name = result.extractedName || '';
      const pass = result.extractedPassport || '';

      onScanComplete(name, pass);
      setSuccess(true);

      if (!name && !pass) {
        setError("Scan complete, but couldn't auto-detect fields. Please extract manually from the text below if needed: " + result.text.substring(0, 50) + "...");
      }
    } catch (err) {
      setError("Could not scan image. Please enter details manually.");
    } finally {
      setIsScanning(false);
    }
  };

  return (
    <div className="bg-emerald-50 border-2 border-dashed border-emerald-300 rounded-xl p-6 text-center transition-colors hover:bg-emerald-100">
      <input
        type="file"
        id={`passport-upload-${guestIndex}`}
        accept="image/png, image/jpeg, image/jpg"
        className="hidden"
        onChange={handleFileChange}
        disabled={isScanning}
      />
      <label htmlFor={`passport-upload-${guestIndex}`} className="cursor-pointer flex flex-col items-center gap-3">
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
            <p className="text-sm text-emerald-600">Supports JPG/PNG. Auto-fills Name & Number.</p>
          </>
        )}
      </label>

      {error && (
        <div className="mt-4 flex items-center justify-center gap-2 text-red-600 bg-red-50 p-2 rounded text-sm">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}

      {success && !error && (
        <div className="mt-4 flex items-center justify-center gap-2 text-emerald-700 bg-white/50 p-2 rounded text-sm">
          <CheckCircle2 className="w-4 h-4" />
          Scanned successfully! Check the fields below.
        </div>
      )}
    </div>
  );
};