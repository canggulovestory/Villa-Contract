import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  ContractData, ComputedData, CopyType,
  LessorData, AgentData, AgentPlatforms,
  INITIAL_DATA, INITIAL_LESSOR, INITIAL_AGENT,
  makeNewGuest,
} from './types';
import { SECURITY_DEPOSIT_RATE } from './utils/format';
import { VILLA_TEMPLATES } from './data/villaTemplates';
import { generateDocument, downloadContractLocally } from './services/docService';
import {
  initGoogleAuth, isSignedIn, signInToGoogle, signOutFromGoogle,
  fetchTemplateFromDrive, fetchDirectTemplateFromDrive,
  fetchVillaListFromSheets, VillaRow,
  saveContractToDrive, saveDealToDrive, PassportFile,
} from './services/googleDriveService';
import { parseInquiryText } from './services/aiService';
import {
  appendContractRow, saveAgentToSheet, saveOwnerToSheet, isSheetsWriteAvailable,
} from './services/googleSheetsService';
import { TemplateGuide } from './components/TemplateGuide';
import { PassportUploader } from './components/PassportUploader';
import { ErrorBoundary } from './components/ErrorBoundary';
import {
  FileDown, FolderOpen, Home, Plus, X, AlertCircle, CloudUpload, Link2, LogOut,
  ChevronDown, Check, Zap, Trash2, UserCog, FilePlus,
} from 'lucide-react';
// ─── Section sub-components ───────────────────────────────────────────────────
import { Section1Villa }       from './sections/Section1Villa';
import { Section2Guests }      from './sections/Section2Guests';
import { Section3Stay }        from './sections/Section3Stay';
import { Section4Financials }  from './sections/Section4Financials';
import { Section5Commission }  from './sections/Section5Commission';
import { Section5Inclusions }  from './sections/Section5Inclusions';
import { Section6Owner }       from './sections/Section6Owner';
import { Section7Agent }       from './sections/Section7Agent';

// ─── LocalStorage Keys ────────────────────────────────────────────────────────
const LS_OWNERS = 'tvm_saved_owners';
const LS_AGENTS = 'tvm_saved_agents';
const LS_FORM_DATA = 'tvm_form_data';

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

// ─── Smart AI Auto-Fill ───────────────────────────────────────────────────

// ─── App ──────────────────────────────────────────────────────────────────────
const App: React.FC = () => {
  const [data, setData]                           = useState<ContractData>(INITIAL_DATA);
  const [localTemplateFile, setLocalTemplateFile] = useState<File | null>(null);
  const [autoTemplate, setAutoTemplate]           = useState<ArrayBuffer | null>(null);       // 3rd Party template
  const [autoDirectTemplate, setAutoDirectTemplate] = useState<ArrayBuffer | null>(null);    // Direct / Guest template
  const [templateBanner, setTemplateBanner]       = useState('');
  const [sheetVillas, setSheetVillas]             = useState<VillaRow[]>([]);               // Live villa list from Sheets
  const [isGenerating, setIsGenerating]           = useState(false);
  const [formErrors, setFormErrors]               = useState<string[]>([]);
  const [generateError, setGenerateError]         = useState<string>('');
  const [driveConnected, setDriveConnected]       = useState(isSignedIn());
  const [driveStatus, setDriveStatus]             = useState<string>('');
  const [savedDriveLink, setSavedDriveLink]       = useState<string>('');
  const [autoFillText, setAutoFillText]           = useState('');
  const [autoFillOpen, setAutoFillOpen]           = useState(false);
  const [autoFillMsg, setAutoFillMsg]             = useState('');
  // commission section is now always-visible; no open/close state needed
  const [activeDurationPill, setActiveDurationPill] = useState<string>('');
  const [customWeeks, setCustomWeeks]               = useState<string>('2');
  const [savedOwners, setSavedOwners]             = useState<LessorData[]>([]);
  const [savedAgents, setSavedAgents]             = useState<AgentData[]>([]);
  const [isPriceManuallySet, setIsPriceManuallySet] = useState(false);
  const [guestPassportFiles, setGuestPassportFiles] = useState<(File | null)[]>([null]);
  const [dealFolderLink, setDealFolderLink]         = useState<string>('');
  const [agentIdFile, setAgentIdFile]               = useState<File | null>(null);
  const [sheetStatus, setSheetStatus]               = useState<string>('');

  // ─── Init Google Auth (GIS tokenClient) on mount ─────────────────────────
  // After init, check if a token was restored from sessionStorage and update UI state
  useEffect(() => {
    initGoogleAuth().then(() => {
      if (isSignedIn()) {
        setDriveConnected(true); // restores connected state after page refresh
      }
    });
  }, []);

  // ─── Load saved contacts from localStorage ───────────────────────────────
  useEffect(() => {
    try {
      const o = localStorage.getItem(LS_OWNERS);
      if (o) setSavedOwners(JSON.parse(o));
      const a = localStorage.getItem(LS_AGENTS);
      if (a) setSavedAgents(JSON.parse(a));
      // Load saved form data (auto-restored on refresh)
      const f = localStorage.getItem(LS_FORM_DATA);
      if (f) {
        const savedData = JSON.parse(f);
        setData(savedData);
      }
    } catch { /* ignore */ }
  }, []);

  // ─── Auto-save form data to localStorage ─────────────────────────────────
  useEffect(() => {
    try {
      localStorage.setItem(LS_FORM_DATA, JSON.stringify(data));
    } catch { /* ignore if quota exceeded */ }
  }, [data]);

  // ─── Auto-load BOTH templates + villa list from Drive/Sheets on connect ──
  useEffect(() => {
    if (!driveConnected) return;
    setTemplateBanner('loading');
    Promise.all([
      fetchTemplateFromDrive(),
      fetchDirectTemplateFromDrive(),
      fetchVillaListFromSheets().catch(() => [] as VillaRow[]), // non-fatal
    ]).then(([buf3p, bufDirect, villas]) => {
      setAutoTemplate(buf3p);
      setAutoDirectTemplate(bufDirect);
      setTemplateBanner('loaded');
      setSheetVillas(villas);
    }).catch((err: unknown) => {
      setTemplateBanner('failed');
      // If token expired while auto-loading, reset connected state so user sees reconnect button
      if (err instanceof Error && err.message.includes('session expired')) {
        setDriveConnected(false);
      }
    });
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
  }, [data.checkInDate, data.checkOutDate, data.totalPrice, data.securityDepositOverride, data.inclusions, data.otherInclusions]);

  // ─── Total price auto-calc ────────────────────────────────────────────────
  useEffect(() => {
    if (isPriceManuallySet) return;
    if (computedData.numberOfNights > 0 && data.monthlyPrice > 0) {
      setData(prev => ({ ...prev, totalPrice: Math.round((data.monthlyPrice / 30) * computedData.numberOfNights) }));
    }
  }, [data.monthlyPrice, computedData.numberOfNights]);

  // ─── Reset stale commission amounts when switching source mode ───────────
  const prevCommissionSource = useRef(data.commissionSource);
  useEffect(() => {
    if (prevCommissionSource.current === data.commissionSource) return;
    prevCommissionSource.current = data.commissionSource;
    if (data.commissionSource === 'from_owner') {
      // Switching away from split_agent — wipe agent and our-share amounts
      // so the from_owner fields start clean (commissionPercent still set)
      setData(prev => ({ ...prev, commissionAmount: 0, agentCommissionAmount: 0 }));
    } else {
      // Switching to split_agent — wipe from_owner commissionAmount so it
      // doesn't linger in the "We Receive" auto field
      setData(prev => ({ ...prev, commissionAmount: 0 }));
    }
  }, [data.commissionSource]);

  // ─── Commission auto-calc ─────────────────────────────────────────────────
  useEffect(() => {
    const base = data.commissionType === 'percent_monthly' ? data.monthlyPrice : data.totalPrice;

    if (data.commissionSource === 'split_agent') {
      if (data.commissionType === 'fixed') {
        // Fixed mode: agentCommissionAmount is entered manually;
        // auto-calculate our share from tvmSplitPercent
        if (data.agentCommissionAmount > 0 && data.tvmSplitPercent > 0) {
          const ourAmt = Math.round(data.agentCommissionAmount * data.tvmSplitPercent / 100);
          setData(prev => ({ ...prev, commissionAmount: ourAmt }));
        }
      } else {
        // Percent mode: derive agent total from percent, then our share
        if (data.agentCommissionPercent > 0 && base > 0) {
          const agentAmt = Math.round(base * data.agentCommissionPercent / 100);
          const ourAmt   = data.tvmSplitPercent > 0 ? Math.round(agentAmt * data.tvmSplitPercent / 100) : 0;
          setData(prev => ({ ...prev, agentCommissionAmount: agentAmt, commissionAmount: ourAmt }));
        }
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
    data.commissionPercent, data.agentCommissionPercent, data.agentCommissionAmount,
    data.tvmSplitPercent, data.totalPrice, data.monthlyPrice,
  ]);

  // ─── Handlers ─────────────────────────────────────────────────────────────
  const handleInputChange = <K extends keyof ContractData>(field: K, value: ContractData[K]) => {
    setData(prev => ({ ...prev, [field]: value }));
    if (field === 'monthlyPrice' || field === 'checkInDate' || field === 'checkOutDate') {
      setIsPriceManuallySet(false);
    }
    if (field === 'checkInDate' || field === 'checkOutDate') {
      setActiveDurationPill(''); // clear pill highlight on manual date change
    }
  };
  const handleTotalPriceChange = (value: number) => {
    setIsPriceManuallySet(true);
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
      setData(prev => ({ ...prev, villaName: '', villaAddress: '', bedrooms: 1, propertyCode: '' }));
    } else {
      // Check sheet villas first (live data), fall back to local templates
      const sv = sheetVillas.find(v => v.name === selected);
      if (sv) {
        setData(prev => ({
          ...prev,
          villaName:    sv.name,
          villaAddress: sv.address,
          bedrooms:     sv.bedrooms,
          propertyCode: sv.propertyCode || prev.propertyCode,
          ...(sv.monthlyPrice ? { monthlyPrice: sv.monthlyPrice } : {}),
        }));
        return;
      }
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

  // ─── New Contract Reset ───────────────────────────────────────────────────
  const handleNewContract = () => {
    if (!window.confirm('Start a new contract? All current data will be cleared.')) return;
    setData(INITIAL_DATA);
    setAutoFillText('');
    setAutoFillOpen(false);
    setAutoFillMsg('');
    setFormErrors([]);
    setGenerateError('');
    setSavedDriveLink('');
    setDealFolderLink('');
    setIsPriceManuallySet(false);
    setGuestPassportFiles([null]);
    setAgentIdFile(null);
    setActiveDurationPill('');
    setCustomWeeks('2');
    setLocalTemplateFile(null);
  };

  // ─── Smart Auto-Fill v2 ──────────────────────────────────────────────────
  const handleAutoFill = async () => {
    if (!autoFillText.trim()) return;

    const geminiKey = process.env.GEMINI_API_KEY || (import.meta as any).env?.VITE_GOOGLE_API_KEY || '';
    const isAIAvailable = geminiKey.length > 0;
    setAutoFillMsg(isAIAvailable ? '⏳ Parsing with AI...' : '⏳ Parsing...');
    const parsed = await parseInquiryText(autoFillText);

    // Count filled fields BEFORE setData (avoids async closure issue)
    let filled = Object.keys(parsed).filter(k => parsed[k] !== undefined && parsed[k] !== null && parsed[k] !== "").length;

    if (filled === 0) {
      setAutoFillMsg('⚠ No matching fields found — try adding labels like "Guest:", "Check-in:", "Villa:", etc.');
      setTimeout(() => setAutoFillMsg(''), 5000);
      return;
    }

    // Determine priceManuallySet BEFORE calling setData (can't call setState inside updater)
    const shouldManualPrice = Boolean(parsed.totalPrice && !parsed.monthlyPrice);
    setIsPriceManuallySet(shouldManualPrice);

    setData(prev => {
      const next = { ...prev };
      if (parsed.villaName)    next.villaName     = parsed.villaName;
      if (parsed.checkInDate)  next.checkInDate   = parsed.checkInDate;
      if (parsed.checkOutDate) next.checkOutDate  = parsed.checkOutDate;
      if (parsed.monthlyPrice) next.monthlyPrice  = parsed.monthlyPrice;
      if (parsed.totalPrice)   next.totalPrice    = parsed.totalPrice;
      // v2: new fields
      if (parsed.bedrooms)         next.bedrooms = parsed.bedrooms;
      if (parsed.securityDeposit)  next.securityDepositOverride = parsed.securityDeposit;
      if (parsed.paymentCurrency)  next.paymentCurrency = parsed.paymentCurrency;
      if (parsed.agent) {
        next.agent = { ...next.agent, enabled: true, company: parsed.agent };
      }
      // Guest info
      if (parsed.name || parsed.passport || parsed.nationality || parsed.phone) {
        const guest = { ...next.guests[0] };
        if (parsed.name)        guest.name           = parsed.name;
        if (parsed.passport)    guest.passportNumber = parsed.passport;
        if (parsed.nationality) guest.nationality    = parsed.nationality;
        if (parsed.phone)       guest.phone          = parsed.phone;
        next.guests = [guest, ...next.guests.slice(1)];
      }
      return next;
    });

    const geminiAvail = (process.env.GEMINI_API_KEY || (import.meta as any).env?.VITE_GOOGLE_API_KEY || '').length > 0;
    setAutoFillMsg(`✓ Auto-filled ${filled} field${filled > 1 ? 's' : ''}${geminiAvail ? ' with AI' : ''}`);
    setAutoFillOpen(false);
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
    setSavedDriveLink(''); setAutoTemplate(null); setAutoDirectTemplate(null); setTemplateBanner('');
    setSheetVillas([]);
  };
  /** Resolve the Direct / Guest lease template (for the "Download Contract" button). */
  const resolveTemplate = async (): Promise<File | ArrayBuffer | null> => {
    if (autoDirectTemplate) return autoDirectTemplate;
    if (driveConnected) {
      setDriveStatus('Fetching template…');
      try {
        const buf = await fetchDirectTemplateFromDrive();
        setAutoDirectTemplate(buf);
        setDriveStatus('Template ready ✓');
        return buf;
      }
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
  // ── Helper: log contract to sheet (non-blocking, best-effort) ──
  const logContractToSheet = async (driveLink: string = '') => {
    if (!isSheetsWriteAvailable()) return;
    setSheetStatus('Logging to sheet…');
    try {
      await appendContractRow(data, computedData, driveLink);
      if (data.agent.enabled) await saveAgentToSheet(data.agent);
      if (data.lessor.enabled) await saveOwnerToSheet(data.lessor);
      setSheetStatus('Logged to sheet ✓');
    } catch (sheetErr) {
      console.error('Sheet logging failed:', sheetErr);
      setSheetStatus('Sheet logging failed');
    }
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
      await logContractToSheet();
    } catch (e: unknown) { setGenerateError(e instanceof Error ? e.message : 'Error generating contract.'); }
    finally { setIsGenerating(false); }
  };
  const handleDownload = async () => {
    setFormErrors([]); setGenerateError(''); setSavedDriveLink('');
    if (runValidation().length > 0) return;
    const src = await resolveTemplate();
    if (!src) return;
    setIsGenerating(true);
    try {
      const { buffer, filename } = await generateDocument(src, data, computedData);
      downloadContractLocally(buffer, filename);
      await logContractToSheet();
    }
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
      await logContractToSheet(result.folderLink);
    } catch (e: unknown) { setGenerateError(e instanceof Error ? e.message : 'Error saving to Drive.'); setDriveStatus(''); }
    finally { setIsGenerating(false); }
  };

  const applyDuration = (months: number, days: number) => {
    if (!data.checkInDate) return;
    const d = new Date(data.checkInDate + 'T00:00:00');
    if (months > 0) d.setMonth(d.getMonth() + months);
    if (days   > 0) d.setDate(d.getDate() + days);
    handleInputChange('checkOutDate', d.toISOString().split('T')[0]);
    setIsPriceManuallySet(false);
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
                <p className="text-xs text-emerald-300 hidden sm:block">Clarity Homes Bali part of TVM</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {driveConnected && (
                <div className="hidden sm:flex items-center gap-1.5 bg-emerald-800 rounded-full px-3 py-1.5 text-xs">
                  <Check className="w-3 h-3 text-emerald-400" />
                  <span className="text-emerald-200 font-medium">Drive Connected</span>
                </div>
              )}
              <button
                onClick={handleNewContract}
                title="Start a new contract"
                className="flex items-center gap-1.5 bg-emerald-700 hover:bg-emerald-600 active:bg-emerald-800 transition text-white text-xs font-semibold px-3 py-1.5 rounded-lg"
              >
                <FilePlus className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">New Contract</span>
              </button>
              <span className="text-xs text-emerald-400 font-mono bg-emerald-800/50 px-2 py-1 rounded-lg">v3.2.0</span>
            </div>
          </div>
        </header>

        {/* ── Template Auto-Load Banner ── */}
        {templateBanner === 'loaded' && (
          <div className="max-w-6xl mx-auto px-4 sm:px-6 mt-4">
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2.5 flex items-center gap-2 text-sm text-emerald-700">
              <Check className="w-4 h-4 text-emerald-500 flex-shrink-0" />
              <span><strong>Guest contract auto-loaded</strong> — ready from Google Drive</span>
            </div>
          </div>
        )}
        {templateBanner === 'loading' && (
          <div className="max-w-6xl mx-auto px-4 sm:px-6 mt-4">
            <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 flex items-center gap-2 text-sm text-slate-500 animate-pulse">
              <span className="w-3 h-3 rounded-full bg-emerald-400 animate-ping" />
              Loading templates from Google Drive…
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
                    disabled={autoFillMsg.startsWith('⏳')}
                    className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 disabled:cursor-not-allowed text-white font-bold text-sm rounded-xl transition active:scale-95">
                    {autoFillMsg.startsWith('⏳') ? (
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" />
                    ) : (
                      <span>⚡</span>
                    )}
                    {autoFillMsg.startsWith('⏳') ? 'Parsing…' : 'Parse & Auto-Fill Form'}
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

          {/* ── Form Sections ── */}
          <div className="space-y-5">


              <Section1Villa
                data={data}
                handleInputChange={handleInputChange}
                onVillaTemplateChange={handleVillaTemplateChange}
                sheetVillas={sheetVillas}
              />

              <Section2Guests
                data={data}
                handleInputChange={handleInputChange}
                onAddGuest={addGuest}
                onRemoveGuest={removeGuest}
                onUpdateGuest={updateGuest}
                onPassportScan={handlePassportScan}
              />

              <Section3Stay
                data={data}
                handleInputChange={handleInputChange}
                computedData={computedData}
                activeDurationPill={activeDurationPill}
                setActiveDurationPill={setActiveDurationPill}
                customWeeks={customWeeks}
                setCustomWeeks={setCustomWeeks}
                onDurationPill={handleDurationPill}
                onApplyCustomWeeks={handleApplyCustomWeeks}
              />

              <Section4Financials
                data={data}
                handleInputChange={handleInputChange}
                computedData={computedData}
                isPriceManuallySet={isPriceManuallySet}
                onTotalPriceChange={handleTotalPriceChange}
                onSetIsPriceManuallySet={setIsPriceManuallySet}
              />

              <Section5Commission
                data={data}
                handleInputChange={handleInputChange}
              />

              <Section5Inclusions
                data={data}
                handleInputChange={handleInputChange}
                onInclusionChange={handleInclusionChange}
              />

              <Section6Owner
                data={data}
                handleInputChange={handleInputChange}
                onLessorChange={handleLessorChange}
                savedOwners={savedOwners}
                onLoadOwner={loadOwner}
                onSaveOwner={saveOwner}
                onDeleteOwner={deleteOwner}
              />

              <Section7Agent
                data={data}
                handleInputChange={handleInputChange}
                onAgentChange={handleAgentChange}
                onAgentPlatformChange={handleAgentPlatformChange}
                savedAgents={savedAgents}
                onLoadAgent={loadAgent}
                onSaveAgent={saveAgent}
                onDeleteAgent={deleteAgent}
                agentIdFile={agentIdFile}
                onAgentIdFile={setAgentIdFile}
              />

            {/* ── BOTTOM: Generate Contract ── */}
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
                            <span className="text-sm font-bold">Templates Connected</span>
                          </div>
                          <p className="text-xs pl-7 flex items-center gap-1.5">
                            <span className={autoDirectTemplate ? 'text-emerald-300' : 'text-yellow-300'}>
                              {autoDirectTemplate ? '✓' : '⏳'} Guest Contract
                            </span>
                            <span className="text-emerald-600">·</span>
                            <span className={autoTemplate ? 'text-emerald-300' : 'text-yellow-300'}>
                              {autoTemplate ? '✓' : '⏳'} 3rd Party Contract
                            </span>
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
                            Guest contract auto-loads from Drive on connect
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
                      {sheetStatus && (
                        <p className={`text-xs flex items-center gap-1.5 ${
                          sheetStatus.includes('✓') ? 'text-emerald-300' :
                          sheetStatus.includes('failed') ? 'text-yellow-300' :
                          'text-emerald-200 animate-pulse'
                        }`}>
                          <span className="w-1.5 h-1.5 rounded-full inline-block" style={{
                            backgroundColor: sheetStatus.includes('✓') ? '#6ee7b7' :
                              sheetStatus.includes('failed') ? '#fcd34d' : '#34d399'
                          }} />
                          {sheetStatus}
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
                      <div>
                        <button onClick={handleDownload3rdParty}
                          disabled={isGenerating || (!driveConnected && !autoTemplate)}
                          title={!driveConnected && !autoTemplate ? 'Connect Google Drive to use this template' : 'Agent ↔ TVM agreement for bookings sourced by an external agent'}
                          className="w-full py-3 bg-white hover:bg-emerald-50 disabled:bg-white/30 disabled:cursor-not-allowed text-emerald-800 disabled:text-emerald-600/40 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition shadow-sm active:scale-95">
                          <Zap className="w-4 h-4 text-yellow-500" />
                          {isGenerating ? 'Generating…' : '3rd Party Contract'}
                        </button>
                        <p className="text-xs text-center text-emerald-700/50 mt-1">For agent-sourced bookings — TVM ↔ Agent agreement</p>
                      </div>
                      <button onClick={handleDownload}
                        disabled={isGenerating || (!driveConnected && !autoDirectTemplate && !localTemplateFile)}
                        title={!driveConnected && !autoDirectTemplate && !localTemplateFile ? 'Connect Google Drive to use this template' : ''}
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
                      {driveConnected && isSheetsWriteAvailable() && (
                        <button onClick={() => logContractToSheet(dealFolderLink)} disabled={isGenerating || sheetStatus === 'Logging to sheet…'}
                          className="w-full py-2 bg-emerald-600/40 hover:bg-emerald-600/60 disabled:opacity-50 disabled:cursor-not-allowed text-emerald-200 rounded-xl font-semibold text-xs flex items-center justify-center gap-2 transition active:scale-95">
                          <FilePlus className="w-3.5 h-3.5" />
                          {sheetStatus === 'Logging to sheet…' ? 'Logging…' : 'Log to Sheet'}
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

                  </div>
                </div>


          </div>
        </main>

        <footer className="text-center py-6 text-xs text-slate-400">
          Villa Contract Generator v3.2.0 · Clarity Homes Bali 🌴
        </footer>

      </div>
    </ErrorBoundary>
  );
};

export default App;
