import React, { useState, useRef, useCallback } from 'react';
import { Upload, ScanLine, AlertCircle, CheckCircle2, ImageIcon, X } from 'lucide-react';
import { scanPassport } from '../services/ocrService';

// ─── Types ────────────────────────────────────────────────────────────────

interface PassportUploaderProps {
  id: string;
  onScanComplete: (name: string, passport: string, file?: File) => void;
}

// ─── Constants ────────────────────────────────────────────────────────────

const MAX_FILE_SIZE_MB = 10;
const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/heic', 'image/heif'];

/** HEIC/HEIF files often have empty file.type in browsers. Detect by extension. */
const getEffectiveMimeType = (file: File): string => {
  if (file.type && file.type !== 'application/octet-stream') return file.type;
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  if (ext === 'heic' || ext === 'heif') return 'image/heic';
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  if (ext === 'png') return 'image/png';
  return 'image/jpeg'; // safe fallback for unknown image
};

// ─── PassportUploader ─────────────────────────────────────────────────────

export const PassportUploader: React.FC<PassportUploaderProps> = ({ id, onScanComplete }) => {
  const [isScanning, setIsScanning]   = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const [status, setStatus]           = useState<'idle' | 'success' | 'partial'>('idle');
  const [preview, setPreview]         = useState<string | null>(null);
  const [fileName, setFileName]       = useState<string>('');
  const [isDragOver, setIsDragOver]   = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback(async (file: File) => {
    // Validate size
    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      setError(`Image is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Max ${MAX_FILE_SIZE_MB} MB.`);
      return;
    }

    // Validate type
    const mime = getEffectiveMimeType(file);
    if (!ACCEPTED_TYPES.includes(mime) && !file.name.match(/\.(jpe?g|png|heic|heif)$/i)) {
      setError('Unsupported file type. Use JPG, PNG, or HEIC.');
      return;
    }

    // Fix HEIC mime type issue — create a new File with correct type if needed
    let processedFile = file;
    if (!file.type || file.type === 'application/octet-stream') {
      processedFile = new File([file], file.name, { type: mime });
    }

    setIsScanning(true);
    setError(null);
    setStatus('idle');
    setFileName(file.name);

    // Generate preview thumbnail
    try {
      if (mime.startsWith('image/') && mime !== 'image/heic' && mime !== 'image/heif') {
        const url = URL.createObjectURL(file);
        setPreview(url);
      } else {
        setPreview(null); // HEIC can't preview natively in most browsers
      }
    } catch { setPreview(null); }

    try {
      const result = await scanPassport(processedFile);
      const name     = result.extractedName     || '';
      const passport = result.extractedPassport || '';

      onScanComplete(name, passport, processedFile);

      if (name || passport) {
        setStatus('success');
      } else {
        setStatus('partial');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Could not scan image.';
      setError(message);
      // Still pass the file to parent so it can be uploaded to Drive even if OCR fails
      onScanComplete('', '', processedFile);
    } finally {
      setIsScanning(false);
    }
  }, [onScanComplete]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processFile(file);
    e.target.value = ''; // Reset so same file can be re-uploaded
  };

  // ─── Drag & Drop ─────────────────────────────────────────────────────
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    await processFile(file);
  }, [processFile]);

  const clearFile = () => {
    setPreview(null);
    setFileName('');
    setError(null);
    setStatus('idle');
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div
      className={`border-2 border-dashed rounded-xl p-5 text-center transition-colors ${
        isDragOver
          ? 'border-emerald-500 bg-emerald-100'
          : isScanning
          ? 'border-emerald-300 bg-emerald-50'
          : 'border-emerald-300 bg-emerald-50 hover:bg-emerald-100'
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <input
        ref={inputRef}
        type="file"
        id={id}
        accept="image/png, image/jpeg, image/jpg, image/heic, image/heif"
        className="hidden"
        onChange={handleFileChange}
        disabled={isScanning}
      />

      {/* Scanning state */}
      {isScanning && (
        <div className="animate-pulse flex flex-col items-center gap-2 py-2">
          <ScanLine className="w-10 h-10 text-emerald-600 animate-bounce" />
          <span className="text-emerald-700 font-medium">Scanning passport…</span>
          <span className="text-xs text-emerald-600">Sending to Gemini AI for extraction</span>
        </div>
      )}

      {/* Idle / ready state */}
      {!isScanning && !preview && (
        <label htmlFor={id} className="cursor-pointer flex flex-col items-center gap-2 py-2">
          <Upload className="w-8 h-8 text-emerald-600" />
          <div className="text-emerald-900 font-medium text-sm">
            {isDragOver ? 'Drop passport image here' : 'Click or drag passport image here'}
          </div>
          <p className="text-xs text-emerald-600">
            JPG / PNG / HEIC · Max {MAX_FILE_SIZE_MB} MB
          </p>
        </label>
      )}

      {/* Preview + result state */}
      {!isScanning && preview && (
        <div className="flex items-start gap-3">
          <div className="relative flex-shrink-0">
            <img src={preview} alt="Passport preview" className="w-20 h-14 object-cover rounded-lg border border-emerald-200" />
            <button onClick={clearFile}
              className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs hover:bg-red-600 transition">
              <X className="w-3 h-3" />
            </button>
          </div>
          <div className="text-left flex-1 min-w-0">
            <p className="text-xs text-slate-500 truncate">{fileName}</p>
            <label htmlFor={id} className="text-xs text-emerald-600 hover:text-emerald-700 cursor-pointer underline">
              Upload different file
            </label>
          </div>
        </div>
      )}

      {/* File uploaded but no preview (HEIC) */}
      {!isScanning && !preview && fileName && (
        <div className="flex items-center gap-2 mt-2 justify-center">
          <ImageIcon className="w-4 h-4 text-emerald-500" />
          <span className="text-xs text-slate-600 truncate">{fileName}</span>
          <button onClick={clearFile} className="text-xs text-red-400 hover:text-red-600 underline ml-1">Remove</button>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="mt-3 flex items-start gap-2 text-red-600 bg-red-50 p-3 rounded-lg text-sm text-left">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Success */}
      {status === 'success' && !error && (
        <div className="mt-3 flex items-center justify-center gap-2 text-emerald-700 bg-white/60 p-2 rounded-lg text-sm">
          <CheckCircle2 className="w-4 h-4" />
          Extracted name &amp; passport number. Verify below.
        </div>
      )}

      {/* Partial — scan ran but no data */}
      {status === 'partial' && !error && (
        <div className="mt-3 flex items-start gap-2 text-amber-700 bg-amber-50 p-3 rounded-lg text-sm text-left">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          Could not detect fields from image. Please enter name and passport number manually.
        </div>
      )}
    </div>
  );
};
