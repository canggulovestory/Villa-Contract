import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ContractData, ComputedData, INITIAL_DATA, makeNewGuest } from './types';
import { SECURITY_DEPOSIT_RATE, formatIDR } from './utils/format';
import { VILLA_TEMPLATES } from './data/villaTemplates';
import { generateDocument, downloadContractLocally } from './services/docService';
import {
  isSignedIn, signInToGoogle, signOutFromGoogle,
  fetchTemplateFromDrive, saveContractToDrive,
} from './services/googleDriveService';
import { TemplateGuide } from './components/TemplateGuide';
import { PassportUploader } from './components/PassportUploader';
import { ErrorBoundary } from './components/ErrorBoundary';
import {
  Calendar, CreditCard, ListTodo, FileDown, Home, Users, Plus, X,
  AlertCircle, CloudUpload, Link2, LogOut, ChevronDown, Check, Zap,
  Waves, Wifi, Trash2,
} from 'lucide-react';

// ─── Constants ────────────────────────────────────────────────────────────────
const MAX_GUESTS = 4;
const MIN_GUESTS = 1;

// ─── Validation ───────────────────────────────────────────────────────────────
function validateForm(data: ContractData, computed: ComputedData): string[] {
  const errors: string[] = [];
  if (!data.villaName.trim())    errors.push('Villa name is required.');
  if (!data.villaAddress.trim()) errors.push('Villa address is required.');
  if (data.bedrooms < 1)         errors.push('Bedrooms must be at least 1.');
  if (!data.checkInDate)         errors.push('Check-in date is required.');
  if (!data.checkOutDate)        errors.push('Check-out date is required.');
  if (computed.numberOfNights <= 0) errors.push('Check-out must be after check-in.');
  if (data.monthlyPrice <= 0)    errors.push('Monthly price must be greater than 0.');
  if (data.totalPrice <= 0)      errors.push('Total price must be greater than 0.');
  data.guests.forEach((g, i) => {
    const n = i + 1;
    if (!g.name.trim())           errors.push(`Guest ${n}: Full name is required.`);
    if (!g.passportNumber.trim()) errors.push(`Guest ${n}: Passport number is required.`);
    if (!g.nationality.trim())    errors.push(`Guest ${n}: Nationality is required.`);
  });
  return errors;
}

// ─── Smart Auto-Fill Parser ───────────────────────────────────────────────────
function parseRawText(raw: string) {
  const txt = raw;

  const extract = (patterns: RegExp[]): string => {
    for (const p of patterns) {
      const m = txt.match(p);
      if (m?.[1]) return m[1].trim().replace(/\*+/g, '').trim();
    }
    return '';
  };
  const extractNum = (patterns: RegExp[]): number => {
    const s = extract(patterns).replace(/[^\d]/g, '');
    const n = parseFloat(s);
    return isNaN(n) ? 0 : n;
  };
  const toISODate = (s: string): string => {
    if (!s) return '';
    const MONTHS: Record<string, string> = {
      january:'01',february:'02',march:'03',april:'04',may:'05',june:'06',
      july:'07',august:'08',september:'09',october:'10',november:'11',december:'12',
      jan:'01',feb:'02',mar:'03',apr:'04',jun:'06',jul:'07',aug:'08',
      sep:'09',oct:'10',nov:'11',dec:'12',
    };
    s = s.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    // "1 April 2025" or "April 1, 2025"
    let m = s.match(/(\d{1,2})[\/\-\s]([a-z]+)[\/\-\s,\s]*(\d{4})/i);
    if (m) { const mo = MONTHS[m[2].toLowerCase()]; if (mo) return `${m[3]}-${mo}-${m[1].padStart(2,'0')}`; }
    m = s.match(/([a-z]+)[\/\-\s,\s]*(\d{1,2})[\/\-\s,\s]*(\d{4})/i);
    if (m) { const mo = MONTHS[m[1].toLowerCase()]; if (mo) return `${m[3]}-${mo}-${m[2].padStart(2,'0')}`; }
    // DD/MM/YYYY
    m = s.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
    if (m) return `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;
    return '';
  };

  const name        = extract([/(?:guest|name|tenant|tamu)[:\s*]+([^\n,\r]+)/i]);
  const nationality = extract([/(?:nationality|citizen(?:ship)?|warga)[:\s*]+([^\n,\r]+)/i]);
  const passport    = extract([/(?:passport|paspor)(?:\s*(?:no|number|#|:))[:\s*]*([A-Z0-9]+)/i,
                                /(?:passport|paspor)[:\s*]+([A-Z0-9]+)/i]);
  const phone       = extract([/(?:phone|tel|hp|wa|whatsapp|mobile)[:\s*]+([\+\d\s\-()]+)/i]);
  const villaName   = extract([/(?:villa|property|rumah)[:\s*]+([^\n,\r]+)/i]);
  const checkInRaw  = extract([/check[-\s]?in[:\s*]+([^\n\r]+)/i, /arrival[:\s*]+([^\n\r]+)/i, /masuk[:\s*]+([^\n\r]+)/i]);
  const checkOutRaw = extract([/check[-\s]?out[:\s*]+([^\n\r]+)/i, /departure[:\s*]+([^\n\r]+)/i, /keluar[:\s*]+([^\n\r]+)/i]);
  const monthly     = extractNum([/monthly(?:\s*(?:price|rent|rate))?[:\s*]+([\d,.]+)/i, /per\s*month[:\s*]+([\d,.]+)/i]);
  const total       = extractNum([/total(?:\s*(?:price|amount|payment))?[:\s*]+([\d,.]+)/i]);

  return {
    name, nationality, passport,
    phone: phone.replace(/\s+/g,' ').trim(),
    villaName,
    checkInDate:  toISODate(checkInRaw),
    checkOutDate: toISODate(checkOutRaw),
    monthlyPrice: monthly,
    totalPrice:   total,
  };
}

// ─── App ──────────────────────────────────────────────────────────────────────
const App: React.FC = () => {
  const [data, setData]                           = useState<ContractData>(INITIAL_DATA);
  const [localTemplateFile, setLocalTemplateFile] = useState<File | null>(null);
  const [isGenerating, setIsGenerating]           = useState(false);
  const [formErrors, setFormErrors]               = useState<string[]>([]);
  const [generateError, setGenerateError]         = useState<string>('');
  const [driveConnected, setDriveConnected]       = useState(isSignedIn());
  const [driveStatus, setDriveStatus]             = useState<string>('');
  const [savedDriveLink, setSavedDriveLink]       = useState<string>('');
  const [autoFillText, setAutoFillText]           = useState('');
  const [autoFillOpen, setAutoFillOpen]           = useState(true);
  const [autoFillMsg, setAutoFillMsg]             = useState('');
  const isPriceManuallySet                        = useRef(false);

  const computedData: ComputedData = useMemo(() => {
    let numberOfNights = 0;
    if (data.checkInDate && data.checkOutDate) {
      const diff = new Date(data.checkOutDate).getTime() - new Date(data.checkInDate).getTime();
      numberOfNights = Math.max(0, Math.ceil(diff / 86400000));
    }
    const numberOfMonths   = numberOfNights > 0 ? parseFloat((numberOfNights / 30).toFixed(2)) : 0;
    const securityDeposit  = data.totalPrice * SECURITY_DEPOSIT_RATE;
    const active: string[] = [];
    if (data.inclusions.cleaning2x)  active.push('Cleaning 2x per week');
    if (data.inclusions.pool2x)      active.push('Pool Maintenance 2x per week');
    if (data.inclusions.internet)    active.push('Internet');
    if (data.inclusions.banjarFee)   active.push('Banjar Fee');
    if (data.inclusions.rubbishFee)  active.push('Rubbish Fee');
    if (data.inclusions.laundry)     active.push('Laundry Linen & Towels 1x');
    if (data.inclusions.electricity) active.push('Electricity');
    if (data.otherInclusions.trim()) active.push(data.otherInclusions.trim());
    const inclusionsList = active.length > 0 ? active.join(', ') : 'None';
    return { numberOfNights, numberOfMonths, securityDeposit, inclusionsList };
  }, [data.checkInDate, data.checkOutDate, data.totalPrice, data.inclusions, data.otherInclusions]);

  useEffect(() => {
    if (isPriceManuallySet.current) return;
    if (computedData.numberOfNights > 0 && data.monthlyPrice > 0) {
      setData(prev => ({ ...prev, totalPrice: Math.round((data.monthlyPrice / 30) * computedData.numberOfNights) }));
    }
  }, [data.monthlyPrice, computedData.numberOfNights]);

  // ─── Handlers ───────────────────────────────────────────────────────────────
  const handleInputChange = <K extends keyof ContractData>(field: K, value: ContractData[K]) => {
    setData(prev => ({ ...prev, [field]: value }));
    if (field === 'monthlyPrice' || field === 'checkInDate' || field === 'checkOutDate') {
      isPriceManuallySet.current = false;
    }
  };
  const handleTotalPriceChange = (value: number) => {
    isPriceManuallySet.current = true;
    setData(prev => ({ ...prev, totalPrice: value }));
  };
  const handleVillaTemplateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selected = e.target.value;
    if (selected === 'custom') {
      setData(prev => ({ ...prev, villaName: '', villaAddress: '', bedrooms: 1 }));
    } else {
      const t = VILLA_TEMPLATES.find(v => v.name === selected);
      if (t) setData(prev => ({ ...prev, villaName: t.name, villaAddress: t.address, bedrooms: t.bedrooms }));
    }
  };
  const handleInclusionChange = (key: keyof ContractData['inclusions']) => {
    setData(prev => ({ ...prev, inclusions: { ...prev.inclusions, [key]: !prev.inclusions[key] } }));
  };
  const updateGuest = (index: number, field: keyof Omit<ReturnType<typeof makeNewGuest>, 'id'>, value: string) => {
    const gs = [...data.guests];
    gs[index] = { ...gs[index], [field]: value };
    setData(prev => ({ ...prev, guests: gs }));
  };
  const addGuest = () => {
    if (data.guests.length >= MAX_GUESTS) return;
    setData(prev => ({ ...prev, guests: [...prev.guests, makeNewGuest(prev.guests.length + 1)] }));
  };
  const removeGuest = (index: number) => {
    if (data.guests.length <= MIN_GUESTS) return;
    setData(prev => ({ ...prev, guests: prev.guests.filter((_, i) => i !== index) }));
  };
  const handlePassportScan = (index: number, name: string, passport: string) => {
    const gs = [...data.guests];
    gs[index] = { ...gs[index], ...(name ? { name } : {}), ...(passport ? { passportNumber: passport } : {}) };
    setData(prev => ({ ...prev, guests: gs }));
  };

  // ─── Smart Auto-Fill ────────────────────────────────────────────────────────
  const handleAutoFill = () => {
    if (!autoFillText.trim()) return;
    const parsed = parseRawText(autoFillText);
    let filled = 0;
    setData(prev => {
      const next = { ...prev };
      if (parsed.villaName)   { next.villaName    = parsed.villaName;   filled++; }
      if (parsed.checkInDate) { next.checkInDate  = parsed.checkInDate; filled++; isPriceManuallySet.current = false; }
      if (parsed.checkOutDate){ next.checkOutDate = parsed.checkOutDate; filled++; isPriceManuallySet.current = false; }
      if (parsed.monthlyPrice){ next.monthlyPrice = parsed.monthlyPrice; filled++; isPriceManuallySet.current = false; }
      if (parsed.totalPrice)  { next.totalPrice   = parsed.totalPrice;  filled++; isPriceManuallySet.current = true; }
      if (parsed.name || parsed.passport || parsed.nationality || parsed.phone) {
        const guest = { ...next.guests[0] };
        if (parsed.name)        { guest.name          = parsed.name;        filled++; }
        if (parsed.passport)    { guest.passportNumber = parsed.passport;   filled++; }
        if (parsed.nationality) { guest.nationality   = parsed.nationality; filled++; }
        if (parsed.phone)       { guest.phone         = parsed.phone;       filled++; }
        next.guests = [guest, ...next.guests.slice(1)];
      }
      return next;
    });
    setAutoFillMsg(filled > 0 ? `✓ Auto-filled ${filled} field${filled > 1 ? 's' : ''}` : '⚠ No matching fields found — try adding labels like "Guest:", "Check-in:", etc.');
    setTimeout(() => setAutoFillMsg(''), 4000);
  };

  // ─── Drive ──────────────────────────────────────────────────────────────────
  const handleConnectDrive = async () => {
    setDriveStatus('Connecting…'); setGenerateError('');
    try { await signInToGoogle(); setDriveConnected(true); setDriveStatus('Connected ✓'); }
    catch (e: unknown) { setGenerateError(e instanceof Error ? e.message : 'Sign-in failed.'); setDriveStatus(''); }
  };
  const handleDisconnectDrive = () => {
    signOutFromGoogle(); setDriveConnected(false); setDriveStatus(''); setSavedDriveLink('');
  };
  const resolveTemplate = async (): Promise<File | ArrayBuffer | null> => {
    if (driveConnected) {
      setDriveStatus('Fetching template…');
      try { const buf = await fetchTemplateFromDrive(); setDriveStatus('Template ready ✓'); return buf; }
      catch (e: unknown) { setGenerateError(e instanceof Error ? e.message : 'Failed to fetch template.'); setDriveStatus(''); return null; }
    }
    if (localTemplateFile) return localTemplateFile;
    setFormErrors(['Please connect Google Drive or upload a .docx template.']);
    return null;
  };

  // ─── Generate ───────────────────────────────────────────────────────────────
  const runValidation = () => {
    const errs = validateForm(data, computedData);
    if (errs.length > 0) { setFormErrors(errs); window.scrollTo({ top: 0, behavior: 'smooth' }); }
    return errs;
  };

  const handleDownload3rdParty = async () => {
    setFormErrors([]); setGenerateError(''); setSavedDriveLink('');
    if (!driveConnected) { setGenerateError('Connect Google Drive to use the 3rd Party Contract template.'); return; }
    if (runValidation().length > 0) return;
    setIsGenerating(true);
    try {
      const buf = await fetchTemplateFromDrive();
      const { buffer, filename } = await generateDocument(buf, data, computedData);
      downloadContractLocally(buffer, filename);
      setDriveStatus('');
    } catch (e: unknown) { setGenerateError(e instanceof Error ? e.message : 'Error generating contract.'); }
    finally { setIsGenerating(false); }
  };

  const handleDownload = async () => {
    setFormErrors([]); setGenerateError(''); setSavedDriveLink('');
    if (runValidation().length > 0) return;
    const src = await resolveTemplate();
    if (!src) return;
    setIsGenerating(true);
    try { const { buffer, filename } = await generateDocument(src, data, computedData); downloadContractLocally(buffer, filename); }
    catch (e: unknown) { setGenerateError(e instanceof Error ? e.message : 'Error generating contract.'); }
    finally { setIsGenerating(false); }
  };

  const handleSaveToDrive = async () => {
    setFormErrors([]); setGenerateError(''); setSavedDriveLink('');
    if (!driveConnected) { setGenerateError('Connect Google Drive first.'); return; }
    if (runValidation().length > 0) return;
    setIsGenerating(true); setDriveStatus('Generating & saving…');
    try {
      const src = await resolveTemplate(); if (!src) return;
      const { buffer, filename } = await generateDocument(src, data, computedData);
      const link = await saveContractToDrive(buffer, filename);
      setSavedDriveLink(link); setDriveStatus('Saved to Drive ✓');
    } catch (e: unknown) { setGenerateError(e instanceof Error ? e.message : 'Error saving to Drive.'); setDriveStatus(''); }
    finally { setIsGenerating(false); }
  };

  // ─── Inclusion items ────────────────────────────────────────────────────────
  const INCLUSIONS = [
    { key: 'cleaning2x' as const,  label: 'Cleaning 2x per week',         emoji: '🧹' },
    { key: 'pool2x' as const,      label: 'Pool Maintenance 2x per week', emoji: '🏊' },
    { key: 'internet' as const,    label: 'Internet / WiFi',               emoji: '📶' },
    { key: 'laundry' as const,     label: 'Laundry Linen & Towels 1x',    emoji: '👕' },
    { key: 'banjarFee' as const,   label: 'Banjar Fee',                    emoji: '🏘' },
    { key: 'rubbishFee' as const,  label: 'Rubbish Collection Fee',        emoji: '🗑' },
    { key: 'electricity' as const, label: 'Electricity',                   emoji: '⚡' },
  ];

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-emerald-50/40 text-slate-800 pb-16">

        {/* ── Header ── */}
        <header className="bg-emerald-900 text-white shadow-xl sticky top-0 z-50">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-emerald-700 rounded-xl flex items-center justify-center flex-shrink-0">
                <Home className="w-5 h-5 text-emerald-200" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold tracking-wide leading-tight">Villa Contract Generator 🌿</h1>
                <p className="text-xs text-emerald-300 hidden sm:block">Bali Villa Rental Agreements</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {driveConnected && (
                <div className="hidden sm:flex items-center gap-1.5 bg-emerald-800 rounded-full px-3 py-1.5 text-xs">
                  <Check className="w-3 h-3 text-emerald-400" />
                  <span className="text-emerald-200 font-medium">Drive Connected</span>
                </div>
              )}
              <span className="text-xs text-emerald-400 font-mono bg-emerald-800/50 px-2 py-1 rounded-lg">v3.0.0</span>
            </div>
          </div>
        </header>

        {/* ── Validation Banner ── */}
        {formErrors.length > 0 && (
          <div className="max-w-6xl mx-auto px-4 sm:px-6 mt-5">
            <div className="bg-red-50 border border-red-200 rounded-2xl p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-3 text-red-700 font-bold text-sm">
                <AlertCircle className="w-4 h-4" /> Please fix the following:
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {formErrors.map((e, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm text-red-600">
                    <span className="w-1.5 h-1.5 bg-red-400 rounded-full flex-shrink-0" />{e}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6">

          {/* ── SMART AUTO-FILL PANEL ── */}
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden mb-6 border border-emerald-100">
            <button
              onClick={() => setAutoFillOpen(o => !o)}
              className="w-full px-5 py-4 flex items-start justify-between gap-3 text-left hover:bg-emerald-50/60 transition"
            >
              <div className="flex items-start gap-3">
                <span className="text-yellow-500 text-xl mt-0.5">⚡</span>
                <div>
                  <p className="font-bold text-slate-800 text-base">Smart Auto-Fill</p>
                  <p className="text-slate-500 text-sm mt-0.5">
                    Paste WhatsApp message, email, or any raw text — system detects &amp; fills the form
                  </p>
                </div>
              </div>
              <span className="text-slate-400 text-lg mt-1">{autoFillOpen ? '∧' : '∨'}</span>
            </button>

            {autoFillOpen && (
              <div className="px-5 pb-5 space-y-3 border-t border-emerald-100">
                <div className="pt-3">
                  <textarea
                    value={autoFillText}
                    onChange={e => setAutoFillText(e.target.value)}
                    rows={6}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-700 font-mono placeholder-slate-400 focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400 outline-none transition resize-y"
                    placeholder={`Paste anything here, e.g.:\n\nGuest: John Smith\nNationality: British\nPassport: AB123456\nPhone: +44 7911 123456\nCheck-in: 1 April 2025\nCheck-out: 30 April 2025\nVilla: Villa Serenity\nMonthly: 30000000`}
                  />
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                  <button
                    onClick={handleAutoFill}
                    className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl transition active:scale-95"
                  >
                    <span>⚡</span> Parse &amp; Auto-Fill Form
                  </button>
                  {autoFillMsg && (
                    <span className={`text-sm font-semibold ${autoFillMsg.startsWith('✓') ? 'text-emerald-600' : 'text-amber-500'}`}>
                      {autoFillMsg}
                    </span>
                  )}
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-slate-500">
                    <span className="text-yellow-500">💡</span>{' '}
                    <strong className="text-slate-600">Supported labels:</strong>{' '}
                    Name · Passport · Nationality · Phone · Check in/out · Villa · Price · Monthly · Deposit · Owner · Agent · PIC · Email
                  </p>
                  <p className="text-xs text-slate-500">
                    <span className="text-yellow-500">💡</span> Works with casual messages too — just paste and try!
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* ── Two-Column Layout ── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* ── LEFT: Form Sections ── */}
            <div className="lg:col-span-2 space-y-5">

              {/* ── SECTION 1: Villa Details ── */}
              <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between gap-3 bg-gradient-to-r from-emerald-50/80 to-white">
                  <div className="flex items-center gap-3">
                    <span className="w-7 h-7 bg-emerald-600 text-white rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">1</span>
                    <h2 className="font-bold text-slate-800 flex items-center gap-2">
                      <Home className="w-4 h-4 text-emerald-600" /> Villa Details
                    </h2>
                  </div>
                  <div className="relative">
                    <select
                      onChange={handleVillaTemplateChange}
                      defaultValue=""
                      className="appearance-none pl-3 pr-8 py-2 text-sm border border-emerald-200 bg-emerald-50 text-emerald-800 font-semibold rounded-xl focus:ring-2 focus:ring-emerald-400 outline-none cursor-pointer transition"
                    >
                      <option value="" disabled>Load Villa Template…</option>
                      <option value="custom">✏ Custom / New Villa</option>
                      <optgroup label="Saved Villas">
                        {VILLA_TEMPLATES.map(v => <option key={v.name} value={v.name}>{v.name}</option>)}
                      </optgroup>
                    </select>
                    <ChevronDown className="w-4 h-4 text-emerald-600 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>
                <div className="px-6 py-5 space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Villa Name <span className="text-red-400">*</span></label>
                    <input type="text" value={data.villaName} onChange={e => handleInputChange('villaName', e.target.value)}
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400 outline-none transition"
                      placeholder="e.g. Villa Sentosa" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Villa Address <span className="text-red-400">*</span></label>
                    <input type="text" value={data.villaAddress} onChange={e => handleInputChange('villaAddress', e.target.value)}
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400 outline-none transition"
                      placeholder="e.g. Jalan Raya Canggu No. 12, Bali" />
                  </div>
                  <div className="w-36">
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Bedrooms <span className="text-red-400">*</span></label>
                    <input type="number" min={1} value={data.bedrooms}
                      onChange={e => handleInputChange('bedrooms', parseInt(e.target.value) || 1)}
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-400 outline-none transition text-center font-bold" />
                  </div>
                </div>
              </section>

              {/* ── SECTION 2: Guests ── */}
              <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-emerald-50/80 to-white">
                  <div className="flex items-center gap-3">
                    <span className="w-7 h-7 bg-emerald-600 text-white rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">2</span>
                    <h2 className="font-bold text-slate-800 flex items-center gap-2">
                      <Users className="w-4 h-4 text-emerald-600" /> Guests
                      <span className="text-xs font-normal text-slate-400">({data.guests.length}/{MAX_GUESTS})</span>
                    </h2>
                  </div>
                  {data.guests.length < MAX_GUESTS && (
                    <button onClick={addGuest}
                      className="flex items-center gap-1.5 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition px-3 py-1.5 rounded-xl active:scale-95">
                      <Plus className="w-3.5 h-3.5" /> Add Guest
                    </button>
                  )}
                </div>
                <div className="px-6 py-5 space-y-5">
                  {data.guests.map((guest, index) => (
                    <div key={guest.id} className="border border-emerald-100 rounded-2xl overflow-hidden">
                      <div className="px-4 py-2.5 bg-emerald-50 flex items-center justify-between border-b border-emerald-100">
                        <span className="text-xs font-bold text-emerald-700 uppercase tracking-widest">Guest {index + 1}</span>
                        {index > 0 && (
                          <button onClick={() => removeGuest(index)}
                            className="text-slate-400 hover:text-red-500 transition p-0.5 rounded-lg hover:bg-red-50">
                            <X size={14} />
                          </button>
                        )}
                      </div>
                      <div className="p-4 space-y-3">
                        <PassportUploader onScanComplete={(name, passport) => handlePassportScan(index, name, passport)} />
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {[
                            { field: 'name' as const,          label: 'Full Name',      req: true,  type: 'text',  ph: 'As on passport' },
                            { field: 'passportNumber' as const, label: 'Passport No.',   req: true,  type: 'text',  ph: 'e.g. A1234567' },
                            { field: 'nationality' as const,    label: 'Nationality',    req: true,  type: 'text',  ph: 'e.g. Australian' },
                            { field: 'phone' as const,          label: 'Phone',          req: false, type: 'text',  ph: '+62 …' },
                            { field: 'birthday' as const,       label: 'Date of Birth',  req: false, type: 'date',  ph: '' },
                          ].map(({ field, label, req, type, ph }) => (
                            <div key={field}>
                              <label className="block text-xs font-semibold text-slate-600 mb-1">
                                {label} {req && <span className="text-red-400">*</span>}
                              </label>
                              <input type={type} value={(guest as Record<string, string>)[field] || ''}
                                onChange={e => updateGuest(index, field, e.target.value)}
                                placeholder={ph}
                                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-400 outline-none transition" />
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* ── SECTION 3: Stay Details ── */}
              <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-emerald-50/80 to-white flex items-center gap-3">
                  <span className="w-7 h-7 bg-emerald-600 text-white rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">3</span>
                  <h2 className="font-bold text-slate-800 flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-emerald-600" /> Stay Details
                  </h2>
                </div>
                <div className="px-6 py-5 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1.5">Check-in Date <span className="text-red-400">*</span></label>
                      <input type="date" value={data.checkInDate} onChange={e => handleInputChange('checkInDate', e.target.value)}
                        className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-400 outline-none transition" />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1.5">Check-out Date <span className="text-red-400">*</span></label>
                      <input type="date" value={data.checkOutDate} onChange={e => handleInputChange('checkOutDate', e.target.value)}
                        className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-400 outline-none transition" />
                    </div>
                  </div>
                  <div className={`rounded-xl overflow-hidden border transition-all ${computedData.numberOfNights > 0 ? 'border-emerald-200' : 'border-slate-100'}`}>
                    <div className={`px-4 py-2 border-b ${computedData.numberOfNights > 0 ? 'bg-emerald-600/10 border-emerald-200' : 'bg-slate-50 border-slate-100'}`}>
                      <span className="text-xs font-bold uppercase tracking-widest text-emerald-700">Duration</span>
                    </div>
                    <div className={`px-4 py-3 flex items-center gap-6 ${computedData.numberOfNights > 0 ? 'bg-emerald-50' : 'bg-slate-50'}`}>
                      <div className="text-center">
                        <span className="block text-2xl font-bold text-emerald-800">{computedData.numberOfNights}</span>
                        <span className="text-xs text-emerald-600 font-semibold uppercase tracking-wide">Nights</span>
                      </div>
                      <div className="w-px h-10 bg-emerald-200" />
                      <div className="text-center">
                        <span className="block text-2xl font-bold text-emerald-800">{computedData.numberOfMonths}</span>
                        <span className="text-xs text-emerald-600 font-semibold uppercase tracking-wide">Months</span>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              {/* ── SECTION 4: Financials ── */}
              <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-emerald-50/80 to-white flex items-center gap-3">
                  <span className="w-7 h-7 bg-emerald-600 text-white rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">4</span>
                  <h2 className="font-bold text-slate-800 flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-emerald-600" /> Financials (IDR)
                  </h2>
                </div>
                <div className="px-6 py-5 space-y-4">
                  {/* Monthly Price */}
                  <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl">
                    <label className="block text-sm font-bold text-blue-800 mb-2">
                      Monthly Price (Rp) <span className="text-red-400">*</span>
                    </label>
                    <div className="flex items-center border border-blue-200 rounded-xl overflow-hidden bg-white">
                      <span className="px-3 py-2.5 text-slate-500 font-bold text-sm bg-slate-50 border-r border-blue-200 flex-shrink-0">Rp</span>
                      <input type="number" value={data.monthlyPrice || ''}
                        onChange={e => handleInputChange('monthlyPrice', parseFloat(e.target.value) || 0)}
                        className="flex-1 px-3 py-2.5 text-sm font-mono outline-none focus:bg-blue-50/30 transition"
                        placeholder="e.g. 30000000" />
                    </div>
                    <p className="text-xs text-blue-600 mt-1.5">Entering this auto-calculates the Total Price based on nights (pro-rated).</p>
                    {data.monthlyPrice > 0 && (
                      <p className="text-xs text-blue-500 font-bold mt-1">= {formatIDR(data.monthlyPrice)} / month</p>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Total Price */}
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                        Total Agreed Price (Rp) <span className="text-red-400">*</span>
                      </label>
                      <div className="flex items-center border border-slate-300 rounded-xl overflow-hidden">
                        <span className="px-3 py-2.5 text-slate-500 font-bold text-sm bg-slate-50 border-r border-slate-200 flex-shrink-0">Rp</span>
                        <input type="number" value={data.totalPrice || ''}
                          onChange={e => handleTotalPriceChange(parseFloat(e.target.value) || 0)}
                          className="flex-1 px-3 py-2.5 text-sm font-mono outline-none focus:bg-emerald-50/30 transition"
                          placeholder="Auto-calculated" />
                      </div>
                      {data.totalPrice > 0 && <p className="text-xs text-slate-500 mt-1 font-semibold">{formatIDR(data.totalPrice)}</p>}
                      {isPriceManuallySet.current && <p className="text-xs text-amber-600 mt-1">⚠ Manual override active</p>}
                    </div>

                    {/* Security Deposit */}
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1.5">Security Deposit (10% of Total)</label>
                      <div className="px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-xl">
                        <span className="text-sm font-bold text-amber-800 font-mono">{formatIDR(computedData.securityDeposit)}</span>
                      </div>
                      <p className="text-xs text-slate-400 mt-1">Auto-calculated · non-editable</p>
                    </div>
                  </div>

                  {/* Payment Due Date */}
                  <div className="max-w-xs">
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Payment Due Date</label>
                    <input type="date" value={data.paymentDueDate}
                      onChange={e => handleInputChange('paymentDueDate', e.target.value)}
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-400 outline-none transition" />
                  </div>
                </div>
              </section>

              {/* ── SECTION 5: Inclusions ── */}
              <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-emerald-50/80 to-white flex items-center gap-3">
                  <span className="w-7 h-7 bg-emerald-600 text-white rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">5</span>
                  <h2 className="font-bold text-slate-800 flex items-center gap-2">
                    <ListTodo className="w-4 h-4 text-emerald-600" /> Inclusions
                  </h2>
                </div>
                <div className="px-6 py-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {INCLUSIONS.map(({ key, label, emoji }) => {
                      const checked = data.inclusions[key];
                      return (
                        <button key={key} type="button" onClick={() => handleInclusionChange(key)}
                          className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-left transition-all active:scale-95 ${
                            checked
                              ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
                              : 'border-slate-200 bg-white text-slate-600 hover:border-emerald-200 hover:bg-emerald-50/40'
                          }`}>
                          <span className={`w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 transition-all border ${
                            checked ? 'bg-emerald-500 border-emerald-500' : 'bg-white border-slate-300'
                          }`}>
                            {checked && <Check className="w-3 h-3 text-white" />}
                          </span>
                          <span className="text-sm font-medium leading-snug">{emoji} {label}</span>
                        </button>
                      );
                    })}
                  </div>
                  <div className="mt-4">
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Other Inclusions</label>
                    <input type="text" value={data.otherInclusions}
                      onChange={e => handleInputChange('otherInclusions', e.target.value)}
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-400 outline-none transition"
                      placeholder="e.g. Gardening, Water heater, Daily breakfast…" />
                  </div>
                </div>
              </section>

            </div>{/* end left column */}

            {/* ── RIGHT: Sticky Generate Card ── */}
            <div className="lg:col-span-1">
              <div className="sticky top-24 space-y-4">

                {/* Generate Contract Card */}
                <div className="bg-gradient-to-b from-emerald-600 to-emerald-700 rounded-2xl shadow-xl overflow-hidden text-white">
                  <div className="px-5 py-4 bg-emerald-500 border-b border-emerald-600/60 flex items-center gap-2.5">
                    <div className="w-8 h-8 bg-emerald-400/30 rounded-xl flex items-center justify-center flex-shrink-0">
                      <FileDown className="w-4 h-4" />
                    </div>
                    <h3 className="font-bold text-lg">Generate Contract</h3>
                  </div>

                  <div className="p-5 space-y-4">
                    {/* Template Source */}
                    <div className="bg-emerald-800/30 rounded-xl p-4 space-y-3">
                      <p className="text-xs font-bold uppercase tracking-widest text-emerald-300">Template Source</p>

                      {driveConnected ? (
                        <div className="bg-emerald-600/30 border border-emerald-500/50 rounded-xl p-3 space-y-1.5">
                          <div className="flex items-center gap-2">
                            <div className="w-5 h-5 bg-emerald-400 rounded-full flex items-center justify-center flex-shrink-0">
                              <Check className="w-3 h-3 text-emerald-900" />
                            </div>
                            <span className="text-sm font-bold">Lease Agreement Template</span>
                          </div>
                          <p className="text-xs text-emerald-300 pl-7">via Google Drive · 3rd Party</p>
                          <button onClick={handleDisconnectDrive}
                            className="pl-7 flex items-center gap-1 text-xs text-emerald-400 hover:text-red-300 transition">
                            <LogOut className="w-3 h-3" /> Disconnect
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-2.5">
                          <button onClick={handleConnectDrive}
                            className="w-full py-2.5 bg-white text-emerald-800 hover:bg-emerald-50 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition shadow-sm active:scale-95">
                            <CloudUpload className="w-4 h-4" /> Connect Google Drive
                          </button>
                          <p className="text-xs text-emerald-300 text-center leading-relaxed">
                            Uses the standard lease template automatically
                          </p>
                          <div className="border-t border-emerald-600/50 pt-3">
                            <p className="text-xs text-emerald-400 mb-2 font-semibold">Or upload manually:</p>
                            <input type="file" accept=".docx"
                              onChange={e => setLocalTemplateFile(e.target.files?.[0] || null)}
                              className="block w-full text-xs text-emerald-200
                                file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0
                                file:text-xs file:font-bold file:bg-emerald-600 file:text-white
                                hover:file:bg-emerald-500 cursor-pointer" />
                            {localTemplateFile && (
                              <p className="text-xs text-emerald-300 mt-1.5 flex items-center gap-1">
                                <Check className="w-3 h-3" /> {localTemplateFile.name}
                              </p>
                            )}
                          </div>
                        </div>
                      )}

                      {driveStatus && (
                        <p className="text-xs text-emerald-200 animate-pulse flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-ping inline-block" />
                          {driveStatus}
                        </p>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div className="space-y-2">
                      {/* 3rd Party Contract — Drive only */}
                      <button onClick={handleDownload3rdParty}
                        disabled={isGenerating || !driveConnected}
                        className="w-full py-3 bg-white hover:bg-emerald-50 disabled:bg-white/30 disabled:cursor-not-allowed text-emerald-800 disabled:text-emerald-600/40 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition shadow-sm active:scale-95">
                        <Zap className="w-4 h-4 text-yellow-500" />
                        {isGenerating ? 'Generating…' : '3rd Party Contract'}
                      </button>

                      {/* Download Contract */}
                      <button onClick={handleDownload}
                        disabled={isGenerating || (!driveConnected && !localTemplateFile)}
                        className="w-full py-3 bg-emerald-900 hover:bg-emerald-950 disabled:bg-emerald-900/50 disabled:cursor-not-allowed text-white disabled:text-white/40 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition shadow-md active:scale-95">
                        <FileDown className="w-4 h-4" />
                        {isGenerating ? 'Generating…' : 'Download Contract'}
                      </button>

                      {/* Save to Drive */}
                      {driveConnected && (
                        <button onClick={handleSaveToDrive} disabled={isGenerating}
                          className="w-full py-3 bg-blue-500 hover:bg-blue-400 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition active:scale-95">
                          <CloudUpload className="w-4 h-4" />
                          {isGenerating ? 'Saving…' : 'Save Copy to Drive'}
                        </button>
                      )}
                    </div>

                    {/* Drive link */}
                    {savedDriveLink && (
                      <a href={savedDriveLink} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-2 text-xs text-emerald-200 hover:text-white underline underline-offset-2 transition">
                        <Link2 className="w-3 h-3" /> Open saved contract in Google Drive →
                      </a>
                    )}

                    {/* Error */}
                    {generateError && (
                      <div className="text-xs text-red-200 bg-red-900/40 border border-red-700/50 rounded-xl p-3 flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                        <span>{generateError}</span>
                      </div>
                    )}

                    <p className="text-xs text-emerald-400 text-center pt-1">
                      Template: Lease Agreement 3rd party · IDR currency
                    </p>
                  </div>
                </div>

                {/* Template Guide */}
                <TemplateGuide />

              </div>
            </div>

          </div>
        </main>

        <footer className="text-center py-6 text-xs text-slate-400">
          Villa Contract Generator v3.0.0 · Built for Bali Villa Rentals 🌴
        </footer>

      </div>
    </ErrorBoundary>
  );
};

export default App;
