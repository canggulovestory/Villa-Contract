import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  ContractData, ComputedData, CopyType, CommissionType, PaymentCurrency,
  LessorData, AgentData, AgentPlatforms, PartnershipType,
  INITIAL_DATA, INITIAL_LESSOR, INITIAL_AGENT,
  makeNewGuest,
} from './types';
import { SECURITY_DEPOSIT_RATE, formatIDR } from './utils/format';
import { VILLA_TEMPLATES } from './data/villaTemplates';
import { generateDocument, downloadContractLocally } from './services/docService';
import {
  isSignedIn, signInToGoogle, signOutFromGoogle,
  fetchTemplateFromDrive, saveContractToDrive,
  saveDealToDrive, PassportFile,
} from './services/googleDriveService';
import { TemplateGuide } from './components/TemplateGuide';
import { PassportUploader } from './components/PassportUploader';
import { ErrorBoundary } from './components/ErrorBoundary';
import {
  Calendar, CreditCard, ListTodo, FileDown, Home, Users, Plus, X,
  AlertCircle, CloudUpload, Link2, LogOut, ChevronDown, Check, Zap,
  Trash2, Building2, UserCog, Save, FolderOpen, Handshake,
} from 'lucide-react';

// ─── LocalStorage Keys ────────────────────────────────────────────────────────
const LS_OWNERS = 'tvm_saved_owners';
const LS_AGENTS = 'tvm_saved_agents';

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
    let m = s.match(/(\d{1,2})[\/\-\s]([a-z]+)[\/\-\s,\s]*(\d{4})/i);
    if (m) { const mo = MONTHS[m[2].toLowerCase()]; if (mo) return `${m[3]}-${mo}-${m[1].padStart(2,'0')}`; }
    m = s.match(/([a-z]+)[\/\-\s,\s]*(\d{1,2})[\/\-\s,\s]*(\d{4})/i);
    if (m) { const mo = MONTHS[m[1].toLowerCase()]; if (mo) return `${m[3]}-${mo}-${m[2].padStart(2,'0')}`; }
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

// ─── Toggle Switch Component ──────────────────────────────────────────────────
const Toggle: React.FC<{ checked: boolean; onChange: () => void }> = ({ checked, onChange }) => (
  <button
    type="button"
    onClick={onChange}
    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
      checked ? 'bg-emerald-500' : 'bg-slate-300'
    }`}
  >
    <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
      checked ? 'translate-x-5' : 'translate-x-0'
    }`} />
  </button>
);

// ─── App ──────────────────────────────────────────────────────────────────────
const App: React.FC = () => {
  const [data, setData]                           = useState<ContractData>(INITIAL_DATA);
  const [localTemplateFile, setLocalTemplateFile] = useState<File | null>(null);
  const [autoTemplate, setAutoTemplate]           = useState<ArrayBuffer | null>(null);
  const [templateBanner, setTemplateBanner]       = useState('');
  const [isGenerating, setIsGenerating]           = useState(false);
  const [formErrors, setFormErrors]               = useState<string[]>([]);
  const [generateError, setGenerateError]         = useState<string>('');
  const [driveConnected, setDriveConnected]       = useState(isSignedIn());
  const [driveStatus, setDriveStatus]             = useState<string>('');
  const [savedDriveLink, setSavedDriveLink]       = useState<string>('');
  const [autoFillText, setAutoFillText]           = useState('');
  const [autoFillOpen, setAutoFillOpen]           = useState(true);
  const [autoFillMsg, setAutoFillMsg]             = useState('');
  // commission section is now always-visible; no open/close state needed
  const [activeDurationPill, setActiveDurationPill] = useState<string>('');
  const [customWeeks, setCustomWeeks]               = useState<string>('2');
  const [savedOwners, setSavedOwners]             = useState<LessorData[]>([]);
  const [savedAgents, setSavedAgents]             = useState<AgentData[]>([]);
  const isPriceManuallySet                        = useRef(false);
  const [guestPassportFiles, setGuestPassportFiles] = useState<(File | null)[]>([null]);
  const [dealFolderLink, setDealFolderLink]         = useState<string>('');
  const [agentIdFile, setAgentIdFile]               = useState<File | null>(null);

  // ─── Load saved contacts from localStorage ───────────────────────────────
  useEffect(() => {
    try {
      const o = localStorage.getItem(LS_OWNERS);
      if (o) setSavedOwners(JSON.parse(o));
      const a = localStorage.getItem(LS_AGENTS);
      if (a) setSavedAgents(JSON.parse(a));
    } catch { /* ignore */ }
  }, []);

  // ─── Auto-load template from Drive on connect ────────────────────────────
  useEffect(() => {
    if (!driveConnected) return;
    setTemplateBanner('loading');
    fetchTemplateFromDrive()
      .then(buf => { setAutoTemplate(buf); setTemplateBanner('loaded'); })
      .catch(() => setTemplateBanner('failed'));
  }, [driveConnected]);

  // ─── computedData ────────────────────────────────────────────────────────
  const computedData: ComputedData = useMemo(() => {
    let numberOfNights = 0;
    if (data.checkInDate && data.checkOutDate) {
      const diff = new Date(data.checkOutDate).getTime() - new Date(data.checkInDate).getTime();
      numberOfNights = Math.max(0, Math.ceil(diff / 86400000));
    }
    const numberOfMonths  = numberOfNights > 0 ? parseFloat((numberOfNights / 30).toFixed(2)) : 0;
    const securityDeposit = data.securityDepositOverride > 0
      ? data.securityDepositOverride
      : data.totalPrice * SECURITY_DEPOSIT_RATE;
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

  // ─── Total price auto-calc ────────────────────────────────────────────────
  useEffect(() => {
    if (isPriceManuallySet.current) return;
    if (computedData.numberOfNights > 0 && data.monthlyPrice > 0) {
      setData(prev => ({ ...prev, totalPrice: Math.round((data.monthlyPrice / 30) * computedData.numberOfNights) }));
    }
  }, [data.monthlyPrice, computedData.numberOfNights]);

  // ─── Commission auto-calc ─────────────────────────────────────────────────
  useEffect(() => {
    const base = data.commissionType === 'percent_monthly' ? data.monthlyPrice : data.totalPrice;

    if (data.commissionSource === 'split_agent') {
      // Step 1: auto-calc agent's total commission amount
      if (data.commissionType !== 'fixed' && data.agentCommissionPercent > 0 && base > 0) {
        const agentAmt = Math.round(base * data.agentCommissionPercent / 100);
        // Step 2: TVM's share = agent amount × TVM split %
        const tvmAmt = data.tvmSplitPercent > 0 ? Math.round(agentAmt * data.tvmSplitPercent / 100) : 0;
        setData(prev => ({ ...prev, agentCommissionAmount: agentAmt, commissionAmount: tvmAmt }));
      }
      return;
    }

    // from_owner mode
    if (data.commissionType === 'fixed') return;
    if (data.commissionPercent > 0 && base > 0) {
      setData(prev => ({ ...prev, commissionAmount: Math.round(base * prev.commissionPercent / 100) }));
    }
  }, [
    data.commissionSource, data.commissionType,
    data.commissionPercent, data.agentCommissionPercent, data.tvmSplitPercent,
    data.totalPrice, data.monthlyPrice,
  ]);

  // ─── Handlers ─────────────────────────────────────────────────────────────
  const handleInputChange = <K extends keyof ContractData>(field: K, value: ContractData[K]) => {
    setData(prev => ({ ...prev, [field]: value }));
    if (field === 'monthlyPrice' || field === 'checkInDate' || field === 'checkOutDate') {
      isPriceManuallySet.current = false;
    }
    if (field === 'checkInDate' || field === 'checkOutDate') {
      setActiveDurationPill(''); // clear pill highlight on manual date change
    }
  };
  const handleTotalPriceChange = (value: number) => {
    isPriceManuallySet.current = true;
    setData(prev => ({ ...prev, totalPrice: value }));
  };
  const handleLessorChange = (field: keyof LessorData, value: string | boolean) => {
    setData(prev => ({ ...prev, lessor: { ...prev.lessor, [field]: value } }));
  };
  const handleAgentChange = (field: keyof AgentData, value: string | boolean) => {
    setData(prev => ({ ...prev, agent: { ...prev.agent, [field]: value } }));
  };
  const handleAgentPlatformChange = (platform: keyof AgentPlatforms) => {
    setData(prev => ({
      ...prev,
      agent: {
        ...prev.agent,
        platforms: { ...prev.agent.platforms, [platform]: !prev.agent.platforms[platform] },
      },
    }));
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
    setGuestPassportFiles(prev => [...prev, null]);
  };
  const removeGuest = (index: number) => {
    if (data.guests.length <= MIN_GUESTS) return;
    setData(prev => ({ ...prev, guests: prev.guests.filter((_, i) => i !== index) }));
    setGuestPassportFiles(prev => prev.filter((_, i) => i !== index));
  };
  const handlePassportScan = (index: number, name: string, passport: string, file?: File) => {
    const gs = [...data.guests];
    gs[index] = { ...gs[index], ...(name ? { name } : {}), ...(passport ? { passportNumber: passport } : {}) };
    setData(prev => ({ ...prev, guests: gs }));
    // Store the original File so we can upload it to Drive Deal Folder on generate
    if (file) {
      setGuestPassportFiles(prev => {
        const updated = [...prev];
        while (updated.length <= index) updated.push(null);
        updated[index] = file;
        return updated;
      });
    }
  };

  // ─── Saved Contacts ───────────────────────────────────────────────────────
  const saveOwner = () => {
    if (!data.lessor.name.trim()) return;
    const contact: LessorData = { ...data.lessor, enabled: true };
    const updated = savedOwners.some(o => o.name === contact.name)
      ? savedOwners.map(o => o.name === contact.name ? contact : o)
      : [...savedOwners, contact];
    setSavedOwners(updated);
    localStorage.setItem(LS_OWNERS, JSON.stringify(updated));
  };
  const loadOwner = (c: LessorData) => setData(prev => ({ ...prev, lessor: { ...c, enabled: true } }));
  const deleteOwner = (name: string) => {
    const updated = savedOwners.filter(o => o.name !== name);
    setSavedOwners(updated);
    localStorage.setItem(LS_OWNERS, JSON.stringify(updated));
  };
  const saveAgent = () => {
    const key = (data.agent.company || data.agent.fullName || data.agent.picName).trim();
    if (!key) return;
    const contact: AgentData = { ...data.agent, enabled: true };
    const updated = savedAgents.some(a =>
        (a.company || a.fullName || a.picName) === key
      )
      ? savedAgents.map(a => (a.company || a.fullName || a.picName) === key ? contact : a)
      : [...savedAgents, contact];
    setSavedAgents(updated);
    localStorage.setItem(LS_AGENTS, JSON.stringify(updated));
  };
  const loadAgent = (c: AgentData) => setData(prev => ({
    ...prev,
    agent: {
      ...INITIAL_AGENT,  // ensure all new fields exist if loaded from old localStorage
      ...c,
      enabled: true,
      platforms: { ...INITIAL_AGENT.platforms, ...(c.platforms ?? {}) },
    },
  }));
  const deleteAgent = (key: string) => {
    const updated = savedAgents.filter(a => (a.company || a.fullName || a.picName) !== key);
    setSavedAgents(updated);
    localStorage.setItem(LS_AGENTS, JSON.stringify(updated));
  };

  // ─── Smart Auto-Fill ──────────────────────────────────────────────────────
  const handleAutoFill = () => {
    if (!autoFillText.trim()) return;
    const parsed = parseRawText(autoFillText);
    let filled = 0;
    setData(prev => {
      const next = { ...prev };
      if (parsed.villaName)    { next.villaName    = parsed.villaName;   filled++; }
      if (parsed.checkInDate)  { next.checkInDate  = parsed.checkInDate; filled++; isPriceManuallySet.current = false; }
      if (parsed.checkOutDate) { next.checkOutDate = parsed.checkOutDate; filled++; isPriceManuallySet.current = false; }
      if (parsed.monthlyPrice) { next.monthlyPrice = parsed.monthlyPrice; filled++; isPriceManuallySet.current = false; }
      if (parsed.totalPrice)   { next.totalPrice   = parsed.totalPrice;  filled++; isPriceManuallySet.current = true; }
      if (parsed.name || parsed.passport || parsed.nationality || parsed.phone) {
        const guest = { ...next.guests[0] };
        if (parsed.name)        { guest.name          = parsed.name;       filled++; }
        if (parsed.passport)    { guest.passportNumber = parsed.passport;  filled++; }
        if (parsed.nationality) { guest.nationality   = parsed.nationality; filled++; }
        if (parsed.phone)       { guest.phone         = parsed.phone;      filled++; }
        next.guests = [guest, ...next.guests.slice(1)];
      }
      return next;
    });
    setAutoFillMsg(filled > 0 ? `✓ Auto-filled ${filled} field${filled > 1 ? 's' : ''}` : '⚠ No matching fields found — try adding labels like "Guest:", "Check-in:", etc.');
    setTimeout(() => setAutoFillMsg(''), 4000);
  };

  // ─── Drive ────────────────────────────────────────────────────────────────
  const handleConnectDrive = async () => {
    setDriveStatus('Connecting…'); setGenerateError('');
    try { await signInToGoogle(); setDriveConnected(true); setDriveStatus('Connected ✓'); }
    catch (e: unknown) { setGenerateError(e instanceof Error ? e.message : 'Sign-in failed.'); setDriveStatus(''); }
  };
  const handleDisconnectDrive = () => {
    signOutFromGoogle(); setDriveConnected(false); setDriveStatus('');
    setSavedDriveLink(''); setAutoTemplate(null); setTemplateBanner('');
  };
  const resolveTemplate = async (): Promise<File | ArrayBuffer | null> => {
    if (autoTemplate) return autoTemplate;
    if (driveConnected) {
      setDriveStatus('Fetching template…');
      try { const buf = await fetchTemplateFromDrive(); setDriveStatus('Template ready ✓'); return buf; }
      catch (e: unknown) { setGenerateError(e instanceof Error ? e.message : 'Failed to fetch template.'); setDriveStatus(''); return null; }
    }
    if (localTemplateFile) return localTemplateFile;
    setFormErrors(['Please connect Google Drive or upload a .docx template.']);
    return null;
  };

  // ─── Generate ─────────────────────────────────────────────────────────────
  const runValidation = () => {
    const errs = validateForm(data, computedData);
    if (errs.length > 0) { setFormErrors(errs); window.scrollTo({ top: 0, behavior: 'smooth' }); }
    return errs;
  };
  const handleDownload3rdParty = async () => {
    setFormErrors([]); setGenerateError(''); setSavedDriveLink('');
    if (!driveConnected && !autoTemplate) { setGenerateError('Connect Google Drive to use the 3rd Party Contract template.'); return; }
    if (runValidation().length > 0) return;
    setIsGenerating(true);
    try {
      const buf = autoTemplate ?? await fetchTemplateFromDrive();
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
    setFormErrors([]); setGenerateError(''); setSavedDriveLink(''); setDealFolderLink('');
    if (!driveConnected) { setGenerateError('Connect Google Drive first.'); return; }
    if (runValidation().length > 0) return;
    setIsGenerating(true); setDriveStatus('Creating Deal Folder…');
    try {
      const src = await resolveTemplate(); if (!src) return;

      // Convert template source to raw ArrayBuffer for Drive upload
      const templateBuffer: ArrayBuffer =
        src instanceof File ? await src.arrayBuffer() : src as ArrayBuffer;

      const { buffer, filename } = await generateDocument(src, data, computedData);

      // Build deal folder name: VillaSentosa_John_20250401
      const guestFirst   = (data.guests[0]?.name || 'Guest').split(' ')[0].replace(/\s+/g, '_');
      const villaSlug    = (data.villaName || 'Villa').replace(/\s+/g, '_');
      const dateSlug     = data.checkInDate ? data.checkInDate.replace(/-/g, '') : 'NoDate';
      const dealFolderName = `${villaSlug}_${guestFirst}_${dateSlug}`;

      // Collect passport files that were actually uploaded
      const passportFilesForDrive: PassportFile[] = guestPassportFiles
        .map((file, i) => file ? { file, guestName: data.guests[i]?.name || `Guest${i + 1}` } : null)
        .filter((x): x is PassportFile => x !== null);

      const result = await saveDealToDrive(
        buffer, filename, templateBuffer, passportFilesForDrive, dealFolderName
      );
      setSavedDriveLink(result.contractFileLink);
      setDealFolderLink(result.folderLink);
      setDriveStatus('Saved to Drive ✓');
    } catch (e: unknown) { setGenerateError(e instanceof Error ? e.message : 'Error saving to Drive.'); setDriveStatus(''); }
    finally { setIsGenerating(false); }
  };

  // ─── Quick Duration Pill logic ────────────────────────────────────────────
  const DURATION_PILLS = [
    { label: '1 Month',  months: 1,  days: 0 },
    { label: '2 Months', months: 2,  days: 0 },
    { label: '3 Months', months: 3,  days: 0 },
    { label: '6 Months', months: 6,  days: 0 },
    { label: '1 Year',   months: 12, days: 0 },
  ];
  const applyDuration = (months: number, days: number) => {
    if (!data.checkInDate) return;
    const d = new Date(data.checkInDate + 'T00:00:00');
    if (months > 0) d.setMonth(d.getMonth() + months);
    if (days   > 0) d.setDate(d.getDate() + days);
    handleInputChange('checkOutDate', d.toISOString().split('T')[0]);
    isPriceManuallySet.current = false;
  };
  const handleDurationPill = (label: string, months: number, days: number) => {
    applyDuration(months, days);
    setActiveDurationPill(label);
  };
  const handleApplyCustomWeeks = (weeksStr: string) => {
    const w = parseInt(weeksStr, 10);
    if (!w || w < 1) return;
    applyDuration(0, w * 7);
    setActiveDurationPill('Other');
  };

  // ─── Inclusion items ──────────────────────────────────────────────────────
  const INCLUSIONS = [
    { key: 'cleaning2x' as const,  label: 'Cleaning 2x per week',         emoji: '🧹' },
    { key: 'pool2x' as const,      label: 'Pool Maintenance 2x per week', emoji: '🏊' },
    { key: 'internet' as const,    label: 'Internet / WiFi',               emoji: '📶' },
    { key: 'laundry' as const,     label: 'Laundry Linen & Towels 1x',    emoji: '👕' },
    { key: 'banjarFee' as const,   label: 'Banjar Fee',                    emoji: '🏘' },
    { key: 'rubbishFee' as const,  label: 'Rubbish Collection Fee',        emoji: '🗑' },
    { key: 'electricity' as const, label: 'Electricity',                   emoji: '⚡' },
  ];

  // ─── Currency helpers ─────────────────────────────────────────────────────
  const CURRENCY_SYMBOLS: Record<PaymentCurrency, string> = { IDR: 'Rp', USD: '$', EUR: '€', USDT: 'USDT' };
  const currencySymbol = CURRENCY_SYMBOLS[data.paymentCurrency] ?? 'Rp';
  const isIDR = data.paymentCurrency === 'IDR';

  /** Format a number for display based on selected currency */
  const formatCurrencyDisplay = (n: number): string => {
    if (isIDR) return formatIDR(n);
    return `${data.paymentCurrency} ${new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(n)}`;
  };

  /** Parse an IDR-formatted string (strips dots) into a number */
  const parseIDRInput = (s: string): number => {
    const n = Number(s.replace(/\./g, '').replace(/[^\d]/g, ''));
    return isNaN(n) ? 0 : n;
  };

  // ─── Reusable section header ──────────────────────────────────────────────
  const SectionHeader = ({ num, icon, title, right }: {
    num: number; icon: React.ReactNode; title: string; right?: React.ReactNode;
  }) => (
    <div className="px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-emerald-50/80 to-white flex items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <span className="w-7 h-7 bg-emerald-600 text-white rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">{num}</span>
        <h2 className="font-bold text-slate-800 flex items-center gap-2">{icon} {title}</h2>
      </div>
      {right}
    </div>
  );

  // ─── Saved contact chips ───────────────────────────────────────────────────
  const OwnerChips = () => savedOwners.length > 0 ? (
    <div className="flex flex-wrap gap-2 mb-3">
      {savedOwners.map(o => (
        <div key={o.name} className="flex items-center gap-1 bg-amber-50 border border-amber-200 rounded-full px-3 py-1">
          <button onClick={() => loadOwner(o)} className="text-xs font-semibold text-amber-800 hover:text-amber-600">
            {o.name}
          </button>
          <button onClick={() => deleteOwner(o.name)} className="text-amber-400 hover:text-red-500 transition ml-1">
            <X size={11} />
          </button>
        </div>
      ))}
    </div>
  ) : null;

  const AgentChips = () => savedAgents.length > 0 ? (
    <div className="flex flex-wrap gap-2 mb-3">
      {savedAgents.map(a => {
        const key   = (a.company || a.fullName || a.picName) || 'Agent';
        const label = a.company
          ? `${a.company}${a.partnershipType ? ` · ${a.partnershipType}` : ''}`
          : (a.fullName || a.picName || 'Agent');
        return (
          <div key={key} className="flex items-center gap-1 bg-purple-50 border border-purple-200 rounded-full px-3 py-1">
            <button onClick={() => loadAgent(a)} className="text-xs font-semibold text-purple-800 hover:text-purple-600">
              {label}
            </button>
            <button onClick={() => deleteAgent(key)} className="text-purple-400 hover:text-red-500 transition ml-1">
              <X size={11} />
            </button>
          </div>
        );
      })}
    </div>
  ) : null;

  // ─── Render ───────────────────────────────────────────────────────────────
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
              <span className="text-xs text-emerald-400 font-mono bg-emerald-800/50 px-2 py-1 rounded-lg">v3.1.0</span>
            </div>
          </div>
        </header>

        {/* ── Template Auto-Load Banner ── */}
        {templateBanner === 'loaded' && (
          <div className="max-w-6xl mx-auto px-4 sm:px-6 mt-4">
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2.5 flex items-center gap-2 text-sm text-emerald-700">
              <Check className="w-4 h-4 text-emerald-500 flex-shrink-0" />
              <span><strong>Template auto-loaded</strong> — always uses latest version from Google Drive</span>
            </div>
          </div>
        )}
        {templateBanner === 'loading' && (
          <div className="max-w-6xl mx-auto px-4 sm:px-6 mt-4">
            <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 flex items-center gap-2 text-sm text-slate-500 animate-pulse">
              <span className="w-3 h-3 rounded-full bg-emerald-400 animate-ping" />
              Loading template from Google Drive…
            </div>
          </div>
        )}

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
                    rows={5}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-700 font-mono placeholder-slate-400 focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400 outline-none transition resize-y"
                    placeholder={`Paste anything here:\nGuest: John Smith · Nationality: British · Passport: AB123456\nCheck-in: 1 April 2025 · Check-out: 30 April 2025\nVilla: Villa Serenity · Monthly: 30,000,000`}
                  />
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                  <button onClick={handleAutoFill}
                    className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl transition active:scale-95">
                    <span>⚡</span> Parse &amp; Auto-Fill Form
                  </button>
                  {autoFillMsg && (
                    <span className={`text-sm font-semibold ${autoFillMsg.startsWith('✓') ? 'text-emerald-600' : 'text-amber-500'}`}>
                      {autoFillMsg}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500">
                  <span className="text-yellow-500">💡</span>{' '}
                  <strong className="text-slate-600">Supported labels:</strong>{' '}
                  Name · Passport · Nationality · Phone · Check in/out · Villa · Monthly · Total
                </p>
              </div>
            )}
          </div>

          {/* ── Two-Column Layout ── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* ── LEFT: Form Sections ── */}
            <div className="lg:col-span-2 space-y-5">

              {/* ── SECTION 1: Villa Details ── */}
              <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <SectionHeader num={1} icon={<Home className="w-4 h-4 text-emerald-600" />} title="Villa Details"
                  right={
                    <div className="relative">
                      <select onChange={handleVillaTemplateChange} defaultValue=""
                        className="appearance-none pl-3 pr-8 py-2 text-sm border border-emerald-200 bg-emerald-50 text-emerald-800 font-semibold rounded-xl focus:ring-2 focus:ring-emerald-400 outline-none cursor-pointer transition">
                        <option value="" disabled>Load Villa Template…</option>
                        <option value="custom">✏ Custom / New Villa</option>
                        <optgroup label="Saved Villas">
                          {VILLA_TEMPLATES.map(v => <option key={v.name} value={v.name}>{v.name}</option>)}
                        </optgroup>
                      </select>
                      <ChevronDown className="w-4 h-4 text-emerald-600 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                  }
                />
                <div className="px-6 py-5 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="sm:col-span-2">
                      <label className="block text-sm font-semibold text-slate-700 mb-1.5">Villa Name <span className="text-red-400">*</span></label>
                      <input type="text" value={data.villaName} onChange={e => handleInputChange('villaName', e.target.value)}
                        className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-400 outline-none transition"
                        placeholder="e.g. Villa Sentosa" />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1.5">Property Code</label>
                      <input type="text" value={data.propertyCode} onChange={e => handleInputChange('propertyCode', e.target.value)}
                        className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-400 outline-none transition"
                        placeholder="e.g. VS-001" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Villa Address <span className="text-red-400">*</span></label>
                    <input type="text" value={data.villaAddress} onChange={e => handleInputChange('villaAddress', e.target.value)}
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-400 outline-none transition"
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
                <SectionHeader num={2} icon={<Users className="w-4 h-4 text-emerald-600" />}
                  title={`Guests (${data.guests.length}/${MAX_GUESTS})`}
                  right={data.guests.length < MAX_GUESTS ? (
                    <button onClick={addGuest}
                      className="flex items-center gap-1.5 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition px-3 py-1.5 rounded-xl active:scale-95">
                      <Plus className="w-3.5 h-3.5" /> Add Guest
                    </button>
                  ) : undefined}
                />
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
                        <PassportUploader
                          id={`passport-upload-${index}`}
                          onScanComplete={(name, passport, file) => handlePassportScan(index, name, passport, file)}
                        />
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {[
                            { field: 'name' as const,          label: 'Full Name',        req: true,  type: 'text', ph: 'As on passport' },
                            { field: 'passportNumber' as const, label: 'Passport No.',     req: true,  type: 'text', ph: 'e.g. A1234567' },
                            { field: 'nationality' as const,    label: 'Nationality',      req: true,  type: 'text', ph: 'e.g. Australian' },
                            { field: 'phone' as const,          label: 'Phone / WhatsApp', req: false, type: 'text', ph: '+62 …' },
                            { field: 'birthplace' as const,     label: 'Place of Birth',   req: false, type: 'text', ph: 'e.g. London' },
                            { field: 'birthday' as const,       label: 'Date of Birth',    req: false, type: 'date', ph: '' },
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
                <SectionHeader num={3} icon={<Calendar className="w-4 h-4 text-emerald-600" />} title="Stay Details" />
                <div className="px-6 py-5 space-y-4">

                  {/* 1 — Check-in Date (first, so user sets it before clicking a pill) */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Check-in Date <span className="text-red-400">*</span></label>
                    <input type="date" value={data.checkInDate} onChange={e => handleInputChange('checkInDate', e.target.value)}
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-400 outline-none transition" />
                  </div>

                  {/* 2 — Quick Duration Pills */}
                  <div>
                    <p className="text-xs font-semibold text-slate-500 mb-2 flex items-center gap-1.5">
                      <span>🗓</span> Quick Duration
                      {!data.checkInDate && <span className="text-amber-500 font-normal ml-1">— set check-in first</span>}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {DURATION_PILLS.map(({ label, months, days }) => (
                        <button key={label} type="button"
                          onClick={() => handleDurationPill(label, months, days)}
                          disabled={!data.checkInDate}
                          className={`px-3 py-1.5 rounded-full text-xs font-bold border-2 transition active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed ${
                            activeDurationPill === label
                              ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm'
                              : 'bg-white border-emerald-200 text-emerald-700 hover:border-emerald-500 hover:bg-emerald-50'
                          }`}>
                          {label}
                        </button>
                      ))}
                      {/* Other — custom weeks */}
                      <button type="button"
                        onClick={() => setActiveDurationPill(activeDurationPill === 'Other' ? '' : 'Other')}
                        disabled={!data.checkInDate}
                        className={`px-3 py-1.5 rounded-full text-xs font-bold border-2 transition active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed ${
                          activeDurationPill === 'Other'
                            ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm'
                            : 'bg-white border-slate-200 text-slate-500 hover:border-emerald-300 hover:bg-emerald-50'
                        }`}>
                        Other…
                      </button>
                    </div>

                    {/* Custom weeks input — shown when Other is selected */}
                    {activeDurationPill === 'Other' && (
                      <div className="mt-3 flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2.5">
                        <span className="text-xs font-semibold text-emerald-700 flex-shrink-0">Number of weeks:</span>
                        <input
                          type="number" min={1} max={52}
                          value={customWeeks}
                          onChange={e => {
                            setCustomWeeks(e.target.value);
                            handleApplyCustomWeeks(e.target.value);
                          }}
                          className="w-16 px-2 py-1 border-2 border-emerald-300 rounded-lg text-sm font-bold text-emerald-900 text-center outline-none focus:border-emerald-500 transition bg-white"
                        />
                        <span className="text-xs font-semibold text-emerald-700">weeks</span>
                        {data.checkOutDate && (
                          <span className="text-xs text-emerald-600 ml-1">
                            → {new Date(data.checkOutDate + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* 3 — Check-out Date */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Check-out Date <span className="text-red-400">*</span></label>
                    <input type="date" value={data.checkOutDate} onChange={e => handleInputChange('checkOutDate', e.target.value)}
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-400 outline-none transition" />
                  </div>

                  {/* 4 — Duration summary */}
                  <div className={`rounded-xl overflow-hidden border transition-all ${computedData.numberOfNights > 0 ? 'border-emerald-200' : 'border-slate-100'}`}>
                    <div className={`px-4 py-2 border-b ${computedData.numberOfNights > 0 ? 'bg-emerald-600/10 border-emerald-200' : 'bg-slate-50 border-slate-100'}`}>
                      <span className="text-xs font-bold uppercase tracking-widest text-emerald-700">Duration</span>
                    </div>
                    <div className={`px-4 py-3 flex items-center gap-6 ${computedData.numberOfNights > 0 ? 'bg-emerald-50' : 'bg-slate-50'}`}>
                      <div className="text-center">
                        <span className="block text-2xl font-bold text-emerald-800">{computedData.numberOfNights}</span>
                        <span className="text-xs text-emerald-600 font-semibold uppercase tracking-wide">Nights</span>
                      </div>
                      {/* Only show months when ≥ 1 — "0.2 months" is misleading for short stays */}
                      {computedData.numberOfMonths >= 1 && (
                        <>
                          <div className="w-px h-10 bg-emerald-200" />
                          <div className="text-center">
                            <span className="block text-2xl font-bold text-emerald-800">{computedData.numberOfMonths}</span>
                            <span className="text-xs text-emerald-600 font-semibold uppercase tracking-wide">Months</span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                </div>
              </section>

              {/* ── SECTION 4: Financials ── */}
              <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <SectionHeader num={4} icon={<CreditCard className="w-4 h-4 text-emerald-600" />} title="Financials" />
                <div className="px-6 py-5 space-y-4">

                  {/* ① Currency Selector */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Payment Currency</label>
                    <div className="flex gap-2 flex-wrap">
                      {(['IDR', 'USD', 'EUR', 'USDT'] as PaymentCurrency[]).map(cur => (
                        <button key={cur} onClick={() => handleInputChange('paymentCurrency', cur)}
                          className={`px-5 py-2 rounded-xl text-sm font-bold border-2 transition active:scale-95 ${
                            data.paymentCurrency === cur
                              ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm'
                              : 'bg-white border-slate-200 text-slate-600 hover:border-emerald-300'
                          }`}>
                          {cur}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* ② Monthly / Base Price */}
                  <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl">
                    <label className="block text-sm font-bold text-blue-800 mb-2">
                      Monthly / Base Price <span className="text-red-400">*</span>
                    </label>
                    <div className="flex items-center border border-blue-200 rounded-xl overflow-hidden bg-white">
                      <span className="px-3 py-2.5 text-slate-500 font-bold text-sm bg-slate-50 border-r border-blue-200 flex-shrink-0">{currencySymbol}</span>
                      {isIDR ? (
                        <input type="text" inputMode="numeric"
                          value={data.monthlyPrice > 0 ? data.monthlyPrice.toLocaleString('id-ID') : ''}
                          onChange={e => { isPriceManuallySet.current = false; handleInputChange('monthlyPrice', parseIDRInput(e.target.value)); }}
                          className="flex-1 px-3 py-2.5 text-sm font-mono outline-none focus:bg-blue-50/30 transition"
                          placeholder="e.g. 30.000.000" />
                      ) : (
                        <input type="number" value={data.monthlyPrice || ''}
                          onChange={e => { isPriceManuallySet.current = false; handleInputChange('monthlyPrice', parseFloat(e.target.value) || 0); }}
                          className="flex-1 px-3 py-2.5 text-sm font-mono outline-none focus:bg-blue-50/30 transition"
                          placeholder="e.g. 3000" />
                      )}
                    </div>
                    {data.monthlyPrice > 0 && <p className="text-xs text-blue-500 font-bold mt-1.5">= {formatCurrencyDisplay(data.monthlyPrice)} / month</p>}
                    <p className="text-xs text-blue-400 mt-1">Auto-calculates Total Price based on nights (pro-rated)</p>
                  </div>

                  {/* ③ Total + Security Deposit */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Total Price */}
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1.5">Total Agreed Price <span className="text-red-400">*</span></label>
                      <div className="flex items-center border border-slate-300 rounded-xl overflow-hidden">
                        <span className="px-3 py-2.5 text-slate-500 font-bold text-sm bg-slate-50 border-r border-slate-200 flex-shrink-0">{currencySymbol}</span>
                        {isIDR ? (
                          <input type="text" inputMode="numeric"
                            value={data.totalPrice > 0 ? data.totalPrice.toLocaleString('id-ID') : ''}
                            onChange={e => handleTotalPriceChange(parseIDRInput(e.target.value))}
                            className="flex-1 px-3 py-2.5 text-sm font-mono outline-none transition"
                            placeholder="Auto-calculated" />
                        ) : (
                          <input type="number" value={data.totalPrice || ''}
                            onChange={e => handleTotalPriceChange(parseFloat(e.target.value) || 0)}
                            className="flex-1 px-3 py-2.5 text-sm font-mono outline-none transition"
                            placeholder="Auto-calculated" />
                        )}
                      </div>
                      {data.totalPrice > 0 && <p className="text-xs text-slate-500 mt-1 font-semibold">{formatCurrencyDisplay(data.totalPrice)}</p>}
                      {isPriceManuallySet.current && <p className="text-xs text-amber-600 mt-1">⚠ Manual override active</p>}
                    </div>
                    {/* Security Deposit — editable with Reset to 10% */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="block text-sm font-semibold text-slate-700">Security Deposit</label>
                        {data.securityDepositOverride > 0 && (
                          <button onClick={() => handleInputChange('securityDepositOverride', 0)}
                            className="text-xs text-blue-500 hover:text-blue-700 font-semibold transition">
                            Reset to 10%
                          </button>
                        )}
                      </div>
                      <div className="flex items-center border border-slate-300 rounded-xl overflow-hidden">
                        <span className="px-3 py-2.5 text-slate-500 font-bold text-sm bg-slate-50 border-r border-slate-200 flex-shrink-0">{currencySymbol}</span>
                        {isIDR ? (
                          <input type="text" inputMode="numeric"
                            value={computedData.securityDeposit > 0 ? computedData.securityDeposit.toLocaleString('id-ID') : ''}
                            onChange={e => handleInputChange('securityDepositOverride', parseIDRInput(e.target.value))}
                            className="flex-1 px-3 py-2.5 text-sm font-mono outline-none transition"
                            placeholder="Auto: 10% of total" />
                        ) : (
                          <input type="number" value={computedData.securityDeposit || ''}
                            onChange={e => handleInputChange('securityDepositOverride', parseFloat(e.target.value) || 0)}
                            className="flex-1 px-3 py-2.5 text-sm font-mono outline-none transition"
                            placeholder="Auto: 10% of total" />
                        )}
                      </div>
                      <p className="text-xs text-slate-400 mt-1">Auto-set to 10% — override as needed</p>
                    </div>
                  </div>

                  {/* ④ Payment Terms */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Payment Terms</label>
                    <input type="text" value={data.paymentTerms}
                      onChange={e => handleInputChange('paymentTerms', e.target.value)}
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-400 outline-none transition"
                      placeholder="e.g. Full upfront / 50% on check-in" />
                  </div>

                  {/* ⑤ Payment Schedule */}
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <div className="px-4 py-2 bg-slate-50 border-b border-slate-100">
                      <span className="text-xs font-bold uppercase tracking-widest text-slate-500">Payment Schedule</span>
                    </div>
                    <div className="px-4 py-4 space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm font-semibold text-slate-700 mb-1.5">First Payment Amount</label>
                          <input type="text" value={data.firstPaymentAmount}
                            onChange={e => handleInputChange('firstPaymentAmount', e.target.value)}
                            className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-400 outline-none transition"
                            placeholder="e.g. IDR 3,000,000 (security deposit)" />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-slate-700 mb-1.5">First Payment Due Date</label>
                          <input type="date" value={data.paymentDueDate}
                            onChange={e => handleInputChange('paymentDueDate', e.target.value)}
                            className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-400 outline-none transition" />
                        </div>
                      </div>
                      {/* Following Payment — toggled */}
                      {!data.showFollowingPayment ? (
                        <button onClick={() => handleInputChange('showFollowingPayment', true)}
                          className="flex items-center gap-1.5 text-sm text-emerald-600 hover:text-emerald-800 font-semibold transition">
                          <Plus className="w-4 h-4" /> Add following payment (optional)
                        </button>
                      ) : (
                        <div className="pt-1 space-y-3 border-t border-slate-100">
                          <div className="flex items-center justify-between pt-2">
                            <span className="text-sm font-semibold text-slate-600">Following Payment</span>
                            <button onClick={() => {
                              handleInputChange('showFollowingPayment', false);
                              handleInputChange('followingPaymentAmount', '');
                              handleInputChange('followingPaymentDueDate', '');
                            }} className="text-xs text-slate-400 hover:text-red-500 transition flex items-center gap-1">
                              <X className="w-3 h-3" /> Remove
                            </button>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Following Payment Amount</label>
                              <input type="text" value={data.followingPaymentAmount}
                                onChange={e => handleInputChange('followingPaymentAmount', e.target.value)}
                                className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-400 outline-none transition"
                                placeholder="e.g. Balance IDR 27,000,000" />
                            </div>
                            <div>
                              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Following Payment Due Date</label>
                              <input type="date" value={data.followingPaymentDueDate}
                                onChange={e => handleInputChange('followingPaymentDueDate', e.target.value)}
                                className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-400 outline-none transition" />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* ⑥ Commission / Agent Fee — always visible, amber section */}
                  <div className="border border-amber-200 rounded-xl overflow-hidden">
                    {/* Header */}
                    <div className="px-4 py-3 bg-amber-50 border-b border-amber-200 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-amber-500 text-base">💰</span>
                        <span className="font-bold text-amber-800 text-sm">Commission / Agent Fee</span>
                      </div>
                      <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full border border-amber-200 font-semibold">Owner copy only</span>
                    </div>

                    <div className="px-4 py-4 bg-white space-y-3">
                      {/* Source pills */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1.5">Commission Source</label>
                        <div className="grid grid-cols-2 gap-2">
                          {([
                            { value: 'from_owner',   label: '🏠 From Owner',        desc: 'Owner pays TVM' },
                            { value: 'split_agent',  label: '🤝 Split with Agent',  desc: "TVM's % of agent's fee" },
                          ] as { value: 'from_owner' | 'split_agent'; label: string; desc: string }[]).map(opt => (
                            <button key={opt.value} onClick={() => handleInputChange('commissionSource', opt.value)}
                              className={`py-2.5 px-3 rounded-xl text-left border-2 transition ${
                                data.commissionSource === opt.value
                                  ? 'bg-amber-500 border-amber-500 text-white'
                                  : 'bg-white border-slate-200 text-slate-600 hover:border-amber-300'
                              }`}>
                              <p className="text-xs font-bold">{opt.label}</p>
                              <p className={`text-xs mt-0.5 ${data.commissionSource === opt.value ? 'text-amber-100' : 'text-slate-400'}`}>{opt.desc}</p>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Commission Basis */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1.5">Commission Basis</label>
                        <div className="grid grid-cols-3 gap-2">
                          {([
                            { value: 'percent_total',   label: '% of Total' },
                            { value: 'percent_monthly', label: '% of Monthly' },
                            { value: 'fixed',           label: 'Fixed Amount' },
                          ] as { value: CommissionType; label: string }[]).map(opt => (
                            <button key={opt.value} onClick={() => handleInputChange('commissionType', opt.value)}
                              className={`py-2 text-xs font-semibold rounded-xl border-2 transition ${
                                data.commissionType === opt.value
                                  ? 'bg-amber-500 border-amber-500 text-white'
                                  : 'bg-white border-slate-200 text-slate-600 hover:border-amber-300'
                              }`}>
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* ── FROM OWNER fields ── */}
                      {data.commissionSource === 'from_owner' && (
                        <div className="grid grid-cols-2 gap-3">
                          {data.commissionType !== 'fixed' && (
                            <div>
                              <label className="block text-xs font-semibold text-slate-600 mb-1">TVM Rate (%)</label>
                              <div className="flex items-center border border-slate-300 rounded-xl overflow-hidden">
                                <input type="number" min={0} max={100} step={0.5}
                                  value={data.commissionPercent || ''}
                                  onChange={e => handleInputChange('commissionPercent', parseFloat(e.target.value) || 0)}
                                  className="flex-1 px-3 py-2 text-sm font-mono outline-none"
                                  placeholder="e.g. 15" />
                                <span className="px-3 py-2 text-slate-500 font-bold text-sm bg-slate-50 border-l border-slate-200">%</span>
                              </div>
                            </div>
                          )}
                          <div>
                            <label className="block text-xs font-semibold text-slate-600 mb-1">
                              TVM Amount ({currencySymbol}){data.commissionType !== 'fixed' && <span className="text-slate-400 font-normal"> — auto</span>}
                            </label>
                            <div className="flex items-center border border-slate-300 rounded-xl overflow-hidden">
                              <span className="px-2 py-2 text-slate-500 font-bold text-xs bg-slate-50 border-r border-slate-200">{currencySymbol}</span>
                              <input type="number" min={0}
                                value={data.commissionAmount || ''}
                                readOnly={data.commissionType !== 'fixed'}
                                onChange={e => data.commissionType === 'fixed' ? handleInputChange('commissionAmount', parseFloat(e.target.value) || 0) : undefined}
                                className={`flex-1 px-3 py-2 text-sm font-mono outline-none ${data.commissionType !== 'fixed' ? 'bg-slate-50 text-slate-400' : ''}`}
                                placeholder="0" />
                            </div>
                          </div>
                        </div>
                      )}

                      {/* ── SPLIT WITH AGENT fields ── */}
                      {data.commissionSource === 'split_agent' && (
                        <div className="space-y-3">
                          {/* Agent commission */}
                          <div className="grid grid-cols-2 gap-3">
                            {data.commissionType !== 'fixed' && (
                              <div>
                                <label className="block text-xs font-semibold text-slate-600 mb-1">Agent Commission (%)</label>
                                <div className="flex items-center border border-slate-300 rounded-xl overflow-hidden">
                                  <input type="number" min={0} max={100} step={0.5}
                                    value={data.agentCommissionPercent || ''}
                                    onChange={e => handleInputChange('agentCommissionPercent', parseFloat(e.target.value) || 0)}
                                    className="flex-1 px-3 py-2 text-sm font-mono outline-none"
                                    placeholder="e.g. 15" />
                                  <span className="px-3 py-2 text-slate-500 font-bold text-sm bg-slate-50 border-l border-slate-200">%</span>
                                </div>
                              </div>
                            )}
                            <div>
                              <label className="block text-xs font-semibold text-slate-600 mb-1">
                                Agent Total ({currencySymbol}){data.commissionType !== 'fixed' && <span className="text-slate-400 font-normal"> — auto</span>}
                              </label>
                              <div className="flex items-center border border-slate-300 rounded-xl overflow-hidden">
                                <span className="px-2 py-2 text-slate-500 font-bold text-xs bg-slate-50 border-r border-slate-200">{currencySymbol}</span>
                                <input type="number" min={0}
                                  value={data.agentCommissionAmount || ''}
                                  readOnly={data.commissionType !== 'fixed'}
                                  onChange={e => data.commissionType === 'fixed' ? handleInputChange('agentCommissionAmount', parseFloat(e.target.value) || 0) : undefined}
                                  className={`flex-1 px-3 py-2 text-sm font-mono outline-none ${data.commissionType !== 'fixed' ? 'bg-slate-50 text-slate-400' : ''}`}
                                  placeholder="0" />
                              </div>
                            </div>
                          </div>
                          {/* TVM split */}
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs font-semibold text-slate-600 mb-1">TVM Split (%)</label>
                              <div className="flex items-center border border-slate-300 rounded-xl overflow-hidden">
                                <input type="number" min={0} max={100} step={5}
                                  value={data.tvmSplitPercent || ''}
                                  onChange={e => handleInputChange('tvmSplitPercent', parseFloat(e.target.value) || 0)}
                                  className="flex-1 px-3 py-2 text-sm font-mono outline-none"
                                  placeholder="e.g. 50" />
                                <span className="px-3 py-2 text-slate-500 font-bold text-sm bg-slate-50 border-l border-slate-200">%</span>
                              </div>
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-slate-600 mb-1">TVM Receives — auto</label>
                              <div className="flex items-center border border-slate-300 rounded-xl overflow-hidden bg-slate-50">
                                <span className="px-2 py-2 text-slate-500 font-bold text-xs bg-slate-100 border-r border-slate-200">{currencySymbol}</span>
                                <input type="number" readOnly value={data.commissionAmount || ''}
                                  className="flex-1 px-3 py-2 text-sm font-mono outline-none bg-slate-50 text-slate-500"
                                  placeholder="0" />
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Summary box */}
                      {data.commissionAmount > 0 && data.totalPrice > 0 && (
                        <div className="bg-amber-50 rounded-xl px-4 py-3 border border-amber-200 space-y-1.5">
                          {data.commissionSource === 'split_agent' && data.agentCommissionAmount > 0 && (
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-amber-700">Agent commission:</span>
                              <span className="text-xs font-bold text-amber-800 font-mono">{formatCurrencyDisplay(data.agentCommissionAmount)}</span>
                            </div>
                          )}
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-amber-700">
                              {data.commissionSource === 'split_agent' ? 'TVM receives:' : 'Owner pays TVM:'}
                            </span>
                            <span className="text-xs font-bold text-amber-800 font-mono">{formatCurrencyDisplay(data.commissionAmount)}</span>
                          </div>
                          <div className="flex items-center justify-between border-t border-amber-200 pt-1.5">
                            <span className="text-xs font-bold text-amber-800">Net to Owner:</span>
                            <span className="text-sm font-bold text-amber-900 font-mono">
                              {formatCurrencyDisplay(data.totalPrice - (data.commissionSource === 'split_agent' ? data.agentCommissionAmount : data.commissionAmount))}
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Notes */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Payment Notes (optional)</label>
                        <input type="text" value={data.commissionNotes}
                          onChange={e => handleInputChange('commissionNotes', e.target.value)}
                          className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-amber-400 outline-none transition"
                          placeholder="e.g. Paid within 7 days of check-in" />
                      </div>
                    </div>
                  </div>

                </div>
              </section>

              {/* ── SECTION 5: Inclusions ── */}
              <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <SectionHeader num={5} icon={<ListTodo className="w-4 h-4 text-emerald-600" />} title="Inclusions" />
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

              {/* ── SECTION 6: Lessor / Property Owner ── */}
              <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-amber-50/80 to-white flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="w-7 h-7 bg-amber-500 text-white rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">6</span>
                    <div>
                      <h2 className="font-bold text-slate-800 flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-amber-600" /> Lessor / Property Owner
                      </h2>
                      <p className="text-xs text-amber-600 mt-0.5">
                        {data.lessor.enabled ? 'Owner data enabled — will appear in contract' : 'Owner data available for this deal? Enable to enter details.'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <Toggle checked={data.lessor.enabled} onChange={() => handleLessorChange('enabled', !data.lessor.enabled)} />
                    <ChevronDown className={`w-4 h-4 text-amber-400 transition-transform ${data.lessor.enabled ? 'rotate-180' : ''}`} />
                  </div>
                </div>

                {data.lessor.enabled && (
                  <div className="px-6 py-5 space-y-4">
                    {/* Saved contacts */}
                    {savedOwners.length > 0 && (
                      <div>
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                          <FolderOpen className="w-3.5 h-3.5" /> Load from Saved
                        </p>
                        <OwnerChips />
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {[
                        { field: 'name' as const,        label: 'Full Name',        req: true,  ph: 'Owner full name' },
                        { field: 'idNumber' as const,     label: 'KTP / Passport No.', req: false, ph: 'ID number' },
                        { field: 'nationality' as const,  label: 'Nationality',      req: false, ph: 'e.g. Indonesian' },
                        { field: 'phone' as const,        label: 'Phone',            req: false, ph: '+62 …' },
                        { field: 'email' as const,        label: 'Email',            req: false, ph: 'owner@email.com' },
                      ].map(({ field, label, req, ph }) => (
                        <div key={field}>
                          <label className="block text-xs font-semibold text-slate-600 mb-1">
                            {label} {req && <span className="text-red-400">*</span>}
                          </label>
                          <input type="text" value={data.lessor[field] as string}
                            onChange={e => handleLessorChange(field, e.target.value)}
                            placeholder={ph}
                            className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-amber-400 outline-none transition" />
                        </div>
                      ))}
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Address</label>
                        <input type="text" value={data.lessor.address}
                          onChange={e => handleLessorChange('address', e.target.value)}
                          placeholder="Owner's address"
                          className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-amber-400 outline-none transition" />
                      </div>
                    </div>

                    {/* Save button */}
                    {data.lessor.name.trim() && (
                      <button onClick={saveOwner}
                        className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-xl transition active:scale-95">
                        <Save className="w-3.5 h-3.5" /> Save to Contacts
                      </button>
                    )}
                  </div>
                )}
              </section>

              {/* ── SECTION 7: Agent / Partner ── */}
              <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                {/* Purple header */}
                <div className="px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-purple-50/80 to-white flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="w-7 h-7 bg-purple-600 text-white rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">7</span>
                    <div>
                      <h2 className="font-bold text-slate-800 flex items-center gap-2">
                        <Handshake className="w-4 h-4 text-purple-600" /> Agent / Partner
                      </h2>
                      <p className="text-xs text-purple-600 mt-0.5">
                        {data.agent.enabled ? 'Agent data enabled — will appear in contract' : 'This deal came through an agent? Enable to register them.'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <Toggle checked={data.agent.enabled} onChange={() => handleAgentChange('enabled', !data.agent.enabled)} />
                    <ChevronDown className={`w-4 h-4 text-purple-400 transition-transform ${data.agent.enabled ? 'rotate-180' : ''}`} />
                  </div>
                </div>

                {data.agent.enabled && (
                  <div className="px-6 py-5 space-y-6">

                    {/* 📂 Saved Agents */}
                    {savedAgents.length > 0 && (
                      <div>
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                          <FolderOpen className="w-3.5 h-3.5" /> Load from Saved
                        </p>
                        <AgentChips />
                      </div>
                    )}

                    {/* 📷 ID / Business Card OCR upload */}
                    <div>
                      <p className="text-xs font-bold text-purple-700 uppercase tracking-widest mb-2">Scan ID / Business Card</p>
                      <PassportUploader
                        id="agent-id-upload"
                        onScanComplete={(name, idNo, file) => {
                          if (name) handleAgentChange('fullName', name);
                          if (idNo) handleAgentChange('idNumber', idNo);
                          if (file) setAgentIdFile(file);
                        }}
                      />
                      {agentIdFile && (
                        <p className="text-xs text-purple-600 mt-1.5 flex items-center gap-1">
                          <Check className="w-3 h-3" /> {agentIdFile.name}
                        </p>
                      )}
                    </div>

                    {/* A. Partnership Type */}
                    <div>
                      <p className="text-xs font-bold text-purple-700 uppercase tracking-widest mb-2">A. Partnership Type</p>
                      <div className="flex flex-wrap gap-2">
                        {(['Travel Agency', 'Property Agent', 'Freelance Agent', 'OTA Partner', 'Others'] as PartnershipType[]).map(type => (
                          <button key={type} type="button"
                            onClick={() => handleAgentChange('partnershipType', type)}
                            className={`px-3 py-1.5 rounded-full text-xs font-bold border-2 transition active:scale-95 ${
                              data.agent.partnershipType === type
                                ? 'bg-purple-600 border-purple-600 text-white shadow-sm'
                                : 'bg-white border-purple-200 text-purple-700 hover:border-purple-500 hover:bg-purple-50'
                            }`}>
                            {type}
                          </button>
                        ))}
                      </div>
                      {data.agent.partnershipType === 'Others' && (
                        <input type="text" value={data.agent.partnershipTypeOther}
                          onChange={e => handleAgentChange('partnershipTypeOther', e.target.value)}
                          placeholder="Describe partnership type…"
                          className="mt-2 w-full px-3 py-2 border border-purple-300 rounded-xl text-sm focus:ring-2 focus:ring-purple-400 outline-none transition" />
                      )}
                    </div>

                    {/* B. Company Information */}
                    <div>
                      <p className="text-xs font-bold text-purple-700 uppercase tracking-widest mb-3">B. Company Information</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {[
                          { field: 'company' as const,       label: 'Company Name',        ph: 'e.g. Bali Travel Co', full: false },
                          { field: 'officePhone' as const,   label: 'Office Phone Number', ph: '+62 …',               full: false },
                          { field: 'picName' as const,       label: 'Agent PIC',           ph: 'Person in Charge',    full: false },
                        ].map(({ field, label, ph, full }) => (
                          <div key={field} className={full ? 'sm:col-span-2' : ''}>
                            <label className="block text-xs font-semibold text-slate-600 mb-1">{label}</label>
                            <input type="text" value={data.agent[field] as string}
                              onChange={e => handleAgentChange(field, e.target.value)}
                              placeholder={ph}
                              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-purple-400 outline-none transition" />
                          </div>
                        ))}
                        <div className="sm:col-span-2">
                          <label className="block text-xs font-semibold text-slate-600 mb-1">Office Address</label>
                          <input type="text" value={data.agent.officeAddress}
                            onChange={e => handleAgentChange('officeAddress', e.target.value)}
                            placeholder="Office address"
                            className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-purple-400 outline-none transition" />
                        </div>
                      </div>
                    </div>

                    {/* C. PIC Personal Data */}
                    <div>
                      <p className="text-xs font-bold text-purple-700 uppercase tracking-widest mb-3">C. PIC / Agent Personal Data</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {/* Full name — full width */}
                        <div className="sm:col-span-2">
                          <label className="block text-xs font-semibold text-slate-600 mb-1">Full Name (as per ID)</label>
                          <input type="text" value={data.agent.fullName}
                            onChange={e => handleAgentChange('fullName', e.target.value)}
                            placeholder="As written on ID / Passport"
                            className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-purple-400 outline-none transition" />
                        </div>
                        {/* Gender */}
                        <div>
                          <label className="block text-xs font-semibold text-slate-600 mb-1">Gender</label>
                          <select value={data.agent.gender} onChange={e => handleAgentChange('gender', e.target.value as 'Male' | 'Female' | '')}
                            className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-purple-400 outline-none transition bg-white">
                            <option value="">Select…</option>
                            <option>Male</option>
                            <option>Female</option>
                          </select>
                        </div>
                        {/* Marital Status */}
                        <div>
                          <label className="block text-xs font-semibold text-slate-600 mb-1">Marital Status</label>
                          <select value={data.agent.maritalStatus} onChange={e => handleAgentChange('maritalStatus', e.target.value as AgentData['maritalStatus'])}
                            className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-purple-400 outline-none transition bg-white">
                            <option value="">Select…</option>
                            <option>Single</option>
                            <option>Married</option>
                            <option>Divorced</option>
                            <option>Widowed</option>
                          </select>
                        </div>
                        {/* Remaining personal fields */}
                        {[
                          { field: 'birthplace' as const,  label: 'Place of Birth',              type: 'text', ph: 'e.g. Jakarta' },
                          { field: 'birthday' as const,    label: 'Date of Birth',               type: 'date', ph: '' },
                          { field: 'nationality' as const, label: 'Nationality',                 type: 'text', ph: 'e.g. Indonesian' },
                          { field: 'idNumber' as const,    label: 'ID / Passport / Biz Card No.', type: 'text', ph: '' },
                          { field: 'phone' as const,       label: 'Active Phone / WhatsApp',     type: 'text', ph: '+62 …' },
                          { field: 'email' as const,       label: 'Email Address',               type: 'email', ph: 'agent@email.com' },
                        ].map(({ field, label, type, ph }) => (
                          <div key={field}>
                            <label className="block text-xs font-semibold text-slate-600 mb-1">{label}</label>
                            <input type={type} value={data.agent[field] as string}
                              onChange={e => handleAgentChange(field, e.target.value)}
                              placeholder={ph}
                              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-purple-400 outline-none transition" />
                          </div>
                        ))}
                        {/* ID Address — full width */}
                        <div className="sm:col-span-2">
                          <label className="block text-xs font-semibold text-slate-600 mb-1">Address (as per ID)</label>
                          <input type="text" value={data.agent.idAddress}
                            onChange={e => handleAgentChange('idAddress', e.target.value)}
                            placeholder="Address as written on ID"
                            className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-purple-400 outline-none transition" />
                        </div>
                        {/* Current address — full width */}
                        <div className="sm:col-span-2">
                          <label className="block text-xs font-semibold text-slate-600 mb-1">Current Address (if different)</label>
                          <input type="text" value={data.agent.currentAddress}
                            onChange={e => handleAgentChange('currentAddress', e.target.value)}
                            placeholder="Leave blank if same as ID address"
                            className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-purple-400 outline-none transition" />
                        </div>
                      </div>
                    </div>

                    {/* D. Sales Platforms */}
                    <div>
                      <p className="text-xs font-bold text-purple-700 uppercase tracking-widest mb-3">D. Sales Platforms</p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {([
                          { key: 'facebook'        as const, label: '📘 Facebook'        },
                          { key: 'instagram'       as const, label: '📸 Instagram'       },
                          { key: 'tiktok'          as const, label: '🎵 TikTok'          },
                          { key: 'website'         as const, label: '🌐 Website'         },
                          { key: 'bookingCom'      as const, label: '🏨 Booking.com'     },
                          { key: 'agoda'           as const, label: '🟠 Agoda'           },
                          { key: 'traveloka'       as const, label: '✈️ Traveloka'       },
                          { key: 'tiketCom'        as const, label: '🎫 Tiket.com'       },
                          { key: 'personalNetwork' as const, label: '🤝 Personal Network'},
                          { key: 'others'          as const, label: '➕ Others'          },
                        ] as { key: keyof AgentPlatforms; label: string }[]).map(({ key, label }) => {
                          const on = data.agent.platforms[key];
                          return (
                            <button key={key} type="button" onClick={() => handleAgentPlatformChange(key)}
                              className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border-2 text-left text-xs font-semibold transition-all active:scale-95 ${
                                on ? 'border-purple-500 bg-purple-50 text-purple-800' : 'border-slate-200 bg-white text-slate-600 hover:border-purple-200 hover:bg-purple-50/40'
                              }`}>
                              <span className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 border transition ${on ? 'bg-purple-500 border-purple-500' : 'border-slate-300 bg-white'}`}>
                                {on && <Check className="w-2.5 h-2.5 text-white" />}
                              </span>
                              {label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* E. Bank Details */}
                    <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
                      <p className="text-xs font-bold text-purple-700 uppercase tracking-widest mb-3">E. Bank Details (for Commission Payment)</p>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {[
                          { field: 'bankName' as const,          label: 'Bank Name',           ph: 'e.g. BCA' },
                          { field: 'bankAccountHolder' as const,  label: 'Account Holder Name', ph: 'Full name' },
                          { field: 'bankAccountNumber' as const,  label: 'Account Number',      ph: '1234567890' },
                        ].map(({ field, label, ph }) => (
                          <div key={field}>
                            <label className="block text-xs font-semibold text-purple-700 mb-1">{label}</label>
                            <input type="text" value={data.agent[field] as string}
                              onChange={e => handleAgentChange(field, e.target.value)}
                              placeholder={ph}
                              className="w-full px-3 py-2 border border-purple-300 bg-white rounded-xl text-sm focus:ring-2 focus:ring-purple-400 outline-none transition" />
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* F. Supporting Document note */}
                    <div className="bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3 flex items-start gap-2.5">
                      <span className="text-yellow-500 text-base flex-shrink-0 mt-0.5">📎</span>
                      <p className="text-xs text-yellow-800">
                        <strong>Supporting Document:</strong> Please attach PIC's ID photo (KTP/Passport) above —
                        alternatively a <strong>Business Card</strong> or <strong>Company Profile</strong> is accepted.
                      </p>
                    </div>

                    {/* 💾 Save Agent to Contacts */}
                    {(data.agent.company || data.agent.fullName || data.agent.picName) && (
                      <button onClick={saveAgent}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-purple-600 hover:bg-purple-700 text-white text-sm font-bold rounded-xl transition active:scale-95">
                        <Save className="w-4 h-4" /> Save Agent to Contacts
                      </button>
                    )}

                  </div>
                )}
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
                          <p className="text-xs text-emerald-300 pl-7">
                            {autoTemplate ? '✓ Auto-loaded from Drive' : 'via Google Drive · 3rd Party'}
                          </p>
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
                          <p className="text-xs text-emerald-300 text-center">
                            Template auto-loads from Drive on connect
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

                    {/* Copy Type Selector */}
                    <div className="bg-emerald-800/30 rounded-xl p-4 space-y-2.5">
                      <p className="text-xs font-bold uppercase tracking-widest text-emerald-300">Contract Copy For</p>
                      <div className="grid grid-cols-3 gap-1.5">
                        {(['CLIENT', 'OWNER', 'AGENT'] as CopyType[]).map(ct => (
                          <button key={ct}
                            onClick={() => handleInputChange('copyType', ct)}
                            className={`py-2.5 text-xs font-bold rounded-xl transition active:scale-95 ${
                              data.copyType === ct
                                ? 'bg-white text-emerald-800 shadow-sm'
                                : 'bg-emerald-700/50 text-emerald-300 hover:bg-emerald-600/60'
                            }`}>
                            {ct}
                          </button>
                        ))}
                      </div>
                      {data.copyType === 'OWNER' && (
                        <p className="text-xs text-yellow-300 flex items-center gap-1">
                          <span>💰</span> Commission &amp; net amount included
                        </p>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div className="space-y-2">
                      <button onClick={handleDownload3rdParty}
                        disabled={isGenerating || (!driveConnected && !autoTemplate)}
                        className="w-full py-3 bg-white hover:bg-emerald-50 disabled:bg-white/30 disabled:cursor-not-allowed text-emerald-800 disabled:text-emerald-600/40 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition shadow-sm active:scale-95">
                        <Zap className="w-4 h-4 text-yellow-500" />
                        {isGenerating ? 'Generating…' : '3rd Party Contract'}
                      </button>
                      <button onClick={handleDownload}
                        disabled={isGenerating || (!driveConnected && !autoTemplate && !localTemplateFile)}
                        className="w-full py-3 bg-emerald-900 hover:bg-emerald-950 disabled:bg-emerald-900/50 disabled:cursor-not-allowed text-white disabled:text-white/40 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition shadow-md active:scale-95">
                        <FileDown className="w-4 h-4" />
                        {isGenerating ? 'Generating…' : 'Download Contract'}
                      </button>
                      {driveConnected && (
                        <button onClick={handleSaveToDrive} disabled={isGenerating}
                          className="w-full py-3 bg-blue-500 hover:bg-blue-400 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition active:scale-95">
                          <CloudUpload className="w-4 h-4" />
                          {isGenerating ? 'Saving…' : 'Save Copy to Drive'}
                        </button>
                      )}
                    </div>

                    {savedDriveLink && (
                      <a href={savedDriveLink} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-2 text-xs text-emerald-200 hover:text-white underline underline-offset-2 transition">
                        <Link2 className="w-3 h-3" /> Open contract in Drive →
                      </a>
                    )}
                    {dealFolderLink && (
                      <a href={dealFolderLink} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-2 text-xs text-sky-300 hover:text-white underline underline-offset-2 transition">
                        <FolderOpen className="w-3 h-3" /> 📁 Open Deal Folder →
                      </a>
                    )}
                    {generateError && (
                      <div className="text-xs text-red-200 bg-red-900/40 border border-red-700/50 rounded-xl p-3 flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                        <span>{generateError}</span>
                      </div>
                    )}

                    {/* Bank Details Reference */}
                    <div className="bg-emerald-800/20 border border-emerald-600/40 rounded-xl p-3.5 space-y-1.5">
                      <p className="text-xs font-bold uppercase tracking-widest text-emerald-300 mb-2">Payment To</p>
                      <p className="text-xs font-bold text-white">PT THE VILLA MANAGERS</p>
                      <p className="text-xs text-emerald-300">BANK CIMB NIAGA · Denpasar</p>
                      <div className="border-t border-emerald-700/50 pt-2 space-y-1">
                        <p className="text-xs text-emerald-200"><span className="text-emerald-400 font-semibold">IDR:</span> 800206006300</p>
                        <p className="text-xs text-emerald-200"><span className="text-emerald-400 font-semibold">AUD:</span> 800206009950</p>
                        <p className="text-xs text-emerald-200"><span className="text-emerald-400 font-semibold">EUR:</span> 800206008730</p>
                        <p className="text-xs text-emerald-200"><span className="text-emerald-400 font-semibold">SWIFT:</span> BNIAIDJA</p>
                      </div>
                    </div>

                    <p className="text-xs text-emerald-400 text-center pt-1">
                      Template: Lease Agreement 3rd party · IDR
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
          Villa Contract Generator v3.1.0 · Built for Bali Villa Rentals 🌴
        </footer>

      </div>
    </ErrorBoundary>
  );
};

export default App;
