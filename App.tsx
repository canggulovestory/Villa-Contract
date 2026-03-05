import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  ContractData, ComputedData, INITIAL_DATA, INITIAL_GUEST,
  INITIAL_AGENT, LessorData, AgentData
} from './types';
import { generateDocument, CopyType } from './services/docService';
import { generateAgentRegistration } from './services/agentService';
import { openDrivePicker, fetchDriveFile, saveDefaultTemplate, loadDefaultTemplateMeta, clearDefaultTemplate, SavedTemplate } from './services/driveService';
import {
  getSavedOwners, saveOwner, deleteOwner, SavedOwner,
  getSavedAgents, saveAgent, deleteAgent, SavedAgent,
} from './services/contactsService';
import { smartParse, SmartParseResult } from './services/smartParseService';
import { TemplateGuide } from './components/TemplateGuide';
import { PassportUploader } from './components/PassportUploader';
import {
  User, Calendar, CreditCard, ListTodo, FileDown, Upload,
  Waves, Wifi, Zap, Shovel, Trash2, Home, Users, Plus, X,
  Building2, Handshake, ChevronDown, ChevronUp, Globe, Landmark, Wallet
} from 'lucide-react';

const VILLA_TEMPLATES = [
  { name: "Villa Serenity", address: "Jl. Raya Canggu No. 123, Bali", bedrooms: 3 },
  { name: "Villa Harmony", address: "Jl. Batu Bolong No. 45, Canggu", bedrooms: 2 },
  { name: "Villa Paradise", address: "Jl. Oberoi No. 10, Seminyak", bedrooms: 4 },
  { name: "Villa Ocean View", address: "Jl. Pantai Berawa No. 99, Canggu", bedrooms: 5 },
  { name: "Villa Tropical", address: "Jl. Umalas I No. 8, Kerobokan", bedrooms: 3 },
  { name: "Villa Sunset", address: "Jl. Petitenget No. 7, Seminyak", bedrooms: 2 },
  { name: "Villa Rice Field", address: "Jl. Pererenan No. 22, Mengwi", bedrooms: 4 },
  { name: "Villa Jungle", address: "Jl. Raya Ubud No. 88, Ubud", bedrooms: 3 },
  { name: "Villa Modern", address: "Jl. Mertanadi No. 55, Kerobokan", bedrooms: 3 },
  { name: "Villa Traditional", address: "Jl. Hanoman No. 15, Ubud", bedrooms: 2 },
];

const PARTNERSHIP_TYPES = [
  'Travel Agency',
  'Property Agent',
  'Freelance Agent',
  'OTA Partner',
  'Others',
];

const CURRENCIES = ['IDR', 'USD', 'EUR', 'USDT'];
const PAYMENT_METHODS = ['IDR bank transfer', 'WISE', 'Crypto (USDT TRC20)', 'IDR + WISE', 'IDR + Crypto'];

const App: React.FC = () => {
  const [data, setData] = useState<ContractData>(INITIAL_DATA);
  const [templateFile, setTemplateFile] = useState<File | null>(null);

  const [isDriveLoading, setIsDriveLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [agentOpen, setAgentOpen] = useState(false);
  const [lessorOpen, setLessorOpen] = useState(false);
  const [savedOwners, setSavedOwners] = useState<SavedOwner[]>(() => getSavedOwners());
  const [savedAgents, setSavedAgents] = useState<SavedAgent[]>(() => getSavedAgents());

  const handleSaveOwner = () => {
    if (!data.lessor.name.trim()) { alert('Please enter at least the owner name first.'); return; }
    saveOwner(data.lessor);
    setSavedOwners(getSavedOwners());
    alert(`✅ "${data.lessor.name}" saved to your owner contacts!`);
  };

  const handleLoadOwner = (id: string) => {
    const found = savedOwners.find(o => o.id === id);
    if (found) {
      const { id: _id, savedAt: _s, ...lessorData } = found;
      setData(prev => ({ ...prev, lessor: lessorData, hasLessor: true }));
      setLessorOpen(true);
    }
  };

  const handleDeleteOwner = (id: string) => {
    if (!confirm('Remove this owner from saved contacts?')) return;
    deleteOwner(id);
    setSavedOwners(getSavedOwners());
  };

  const handleSaveAgent = () => {
    if (!data.agent.companyName.trim() && !data.agent.agentPIC.trim()) {
      alert('Please enter at least the company name or agent PIC first.');
      return;
    }
    saveAgent(data.agent);
    setSavedAgents(getSavedAgents());
    alert(`✅ "${data.agent.companyName || data.agent.agentPIC}" saved to your agent contacts!`);
  };

  const handleLoadAgent = (id: string) => {
    const found = savedAgents.find(a => a.id === id);
    if (found) {
      setData(prev => ({ ...prev, agent: found.data, hasAgent: true }));
      setAgentOpen(true);
    }
  };

  const handleDeleteAgent = (id: string) => {
    if (!confirm('Remove this agent from saved contacts?')) return;
    deleteAgent(id);
    setSavedAgents(getSavedAgents());
  };
  const [savedTemplateMeta, setSavedTemplateMeta] = useState<SavedTemplate | null>(() => loadDefaultTemplateMeta());
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-load default template on startup
  useEffect(() => {
    const meta = loadDefaultTemplateMeta();
    if (meta) {
      fetchDriveFile(meta)
        .then(file => setTemplateFile(file))
        .catch(() => { /* silently fail */ });
    }
  }, []);

  // --- Calculations ---
  const computedData: ComputedData = useMemo(() => {
    let numberOfNights = 0;
    if (data.checkInDate && data.checkOutDate) {
      const start = new Date(data.checkInDate);
      const end = new Date(data.checkOutDate);
      const diffTime = end.getTime() - start.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      numberOfNights = diffDays > 0 ? diffDays : 0;
    }
    const numberOfMonths = numberOfNights > 0 ? parseFloat((numberOfNights / 30).toFixed(2)) : 0;

    const activeInclusions = [];
    if (data.inclusions.cleaning2x) activeInclusions.push('Cleaning 2x per week');
    if (data.inclusions.pool2x) activeInclusions.push('Pool Maintenance 2x per week');
    if (data.inclusions.internet) activeInclusions.push('Internet');
    if (data.inclusions.banjarFee) activeInclusions.push('Banjar Fee');
    if (data.inclusions.rubbishFee) activeInclusions.push('Rubbish Fee');
    if (data.inclusions.laundry) activeInclusions.push('Laundry linen & towels 1x per week');
    if (data.inclusions.electricity) activeInclusions.push('Electricity');
    if (data.otherInclusions) activeInclusions.push(data.otherInclusions);
    const inclusionsList = activeInclusions.length > 0 ? activeInclusions.join(', ') : 'None';

    return { numberOfNights, numberOfMonths, inclusionsList };
  }, [data]);

  // Auto-set security deposit to 10% of total price
  useEffect(() => {
    setData(prev => {
      const auto = Math.round(prev.totalPrice * 0.10);
      if (prev.securityDeposit === 0 || prev.securityDeposit === Math.round(prev.totalPrice * 0.10)) {
        return { ...prev, securityDeposit: auto };
      }
      return prev;
    });
  }, [data.totalPrice]);

  // Auto-set payment due date = check-in date
  useEffect(() => {
    if (data.checkInDate) {
      setData(prev => ({
        ...prev,
        paymentDueDate: data.checkInDate,
        firstPaymentDueDate: data.checkInDate,
      }));
    }
  }, [data.checkInDate]);

  // Auto-calculate total price from monthly + nights
  useEffect(() => {
    if (computedData.numberOfNights > 0 && data.monthlyPrice > 0) {
      const calculatedTotal = Math.round((data.monthlyPrice / 30) * computedData.numberOfNights);
      setData(prev => ({ ...prev, totalPrice: calculatedTotal }));
    }
  }, [data.monthlyPrice, computedData.numberOfNights]);

  // Auto-set first payment = total price + security deposit
  useEffect(() => {
    if (data.totalPrice > 0) {
      setData(prev => ({
        ...prev,
        firstPaymentAmount: prev.totalPrice + prev.securityDeposit,
      }));
    }
  }, [data.totalPrice, data.securityDeposit]);

  // --- Handlers ---
  const handleInputChange = (field: keyof ContractData, value: any) => {
    setData(prev => ({ ...prev, [field]: value }));
  };

  const handleLessorChange = (field: keyof LessorData, value: string) => {
    setData(prev => ({ ...prev, lessor: { ...prev.lessor, [field]: value } }));
  };

  const handleAgentChange = (field: keyof AgentData, value: string) => {
    setData(prev => ({ ...prev, agent: { ...prev.agent, [field]: value } }));
  };

  const handleVillaTemplateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedName = e.target.value;
    if (selectedName === 'custom') {
      setData(prev => ({ ...prev, villaName: '', villaAddress: '', bedrooms: 1 }));
    } else {
      const template = VILLA_TEMPLATES.find(v => v.name === selectedName);
      if (template) {
        setData(prev => ({
          ...prev,
          villaName: template.name,
          villaAddress: template.address,
          bedrooms: template.bedrooms,
        }));
      }
    }
  };

  const handleInclusionChange = (key: keyof typeof data.inclusions) => {
    setData(prev => ({
      ...prev,
      inclusions: { ...prev.inclusions, [key]: !prev.inclusions[key] },
    }));
  };

  // Guest Handlers
  const addGuest = () => {
    if (data.guests.length < 4) {
      setData(prev => ({
        ...prev,
        guests: [...prev.guests, { ...INITIAL_GUEST, id: Date.now().toString() }],
      }));
    }
  };

  const removeGuest = (index: number) => {
    if (data.guests.length > 1) {
      const newGuests = [...data.guests];
      newGuests.splice(index, 1);
      setData(prev => ({ ...prev, guests: newGuests }));
    }
  };

  const updateGuest = (index: number, field: keyof typeof INITIAL_GUEST, value: string) => {
    const newGuests = [...data.guests];
    newGuests[index] = { ...newGuests[index], [field]: value };
    setData(prev => ({ ...prev, guests: newGuests }));
  };

  const handlePassportScan = (index: number, name: string, passport: string) => {
    const newGuests = [...data.guests];
    newGuests[index] = {
      ...newGuests[index],
      name: name || newGuests[index].name,
      passportNumber: passport || newGuests[index].passportNumber,
    };
    setData(prev => ({ ...prev, guests: newGuests }));
  };

  const [smartPasteText, setSmartPasteText] = useState('');
  const [smartPasteResult, setSmartPasteResult] = useState<SmartParseResult | null>(null);
  const [smartPasteOpen, setSmartPasteOpen] = useState(true);

  const handleSmartParse = () => {
    if (!smartPasteText.trim()) return;
    const parsed = smartParse(smartPasteText);
    setSmartPasteResult(parsed);
    if (parsed.detected.length === 0) return;

    setData(prev => {
      const updated = { ...prev };
      // Guest fields
      if (parsed.guestName) updated.guests = [{ ...prev.guests[0], name: parsed.guestName }];
      if (parsed.guestPassport) updated.guests = [{ ...(updated.guests[0] || prev.guests[0]), passportNumber: parsed.guestPassport }];
      if (parsed.guestNationality) updated.guests = [{ ...(updated.guests[0] || prev.guests[0]), nationality: parsed.guestNationality }];
      if (parsed.guestPhone) updated.guests = [{ ...(updated.guests[0] || prev.guests[0]), phone: parsed.guestPhone }];
      if (parsed.guestBirthday) updated.guests = [{ ...(updated.guests[0] || prev.guests[0]), birthday: parsed.guestBirthday }];
      // Keep remaining guests (index 1+) intact
      if (prev.guests.length > 1) updated.guests = [updated.guests[0], ...prev.guests.slice(1)];
      // Villa
      if (parsed.villaName) updated.villaName = parsed.villaName;
      if (parsed.propertyCode) updated.propertyCode = parsed.propertyCode;
      // Stay
      if (parsed.checkInDate) updated.checkInDate = parsed.checkInDate;
      if (parsed.checkOutDate) updated.checkOutDate = parsed.checkOutDate;
      // Financials
      if (parsed.paymentCurrency) updated.paymentCurrency = parsed.paymentCurrency;
      if (parsed.totalPrice) updated.totalPrice = parsed.totalPrice;
      if (parsed.monthlyPrice) updated.monthlyPrice = parsed.monthlyPrice;
      if (parsed.securityDeposit) updated.securityDeposit = parsed.securityDeposit;
      // Lessor
      if (parsed.lessorName) {
        updated.hasLessor = true;
        updated.lessor = { ...prev.lessor, name: parsed.lessorName };
        setLessorOpen(true);
      }
      if (parsed.lessorNIK) updated.lessor = { ...updated.lessor, nik: parsed.lessorNIK };
      if (parsed.lessorCountry) updated.lessor = { ...updated.lessor, country: parsed.lessorCountry };
      // Agent
      if (parsed.agentCompanyName || parsed.agentPIC || parsed.agentEmail) {
        updated.hasAgent = true;
        updated.agent = {
          ...prev.agent,
          ...(parsed.agentCompanyName ? { companyName: parsed.agentCompanyName } : {}),
          ...(parsed.agentPIC ? { agentPIC: parsed.agentPIC, picFullName: parsed.agentPIC } : {}),
          ...(parsed.agentPhone ? { whatsappNumber: parsed.agentPhone, officePhone: parsed.agentPhone } : {}),
          ...(parsed.agentEmail ? { agentEmail: parsed.agentEmail } : {}),
          ...(parsed.agentPartnershipType ? { partnershipType: parsed.agentPartnershipType } : {}),
        };
        setAgentOpen(true);
      }
      return updated;
    });
  };

  const [generatingCopy, setGeneratingCopy] = useState<CopyType | null>(null);

  const handleGenerate = async (copyType: CopyType) => {
    if (!templateFile) {
      alert("Please upload a .docx template first!");
      return;
    }
    setGeneratingCopy(copyType);
    try {
      await generateDocument(templateFile, data, computedData, copyType);
    } catch (e) {
      alert("Error generating document. Check the console or ensure your template is valid.");
    } finally {
      setGeneratingCopy(null);
    }
  };

  const handleGenerateAgent = () => {
    if (!data.hasAgent) return;
    generateAgentRegistration(data);
  };

  const handleDrivePick = async () => {
    setIsDriveLoading(true);
    try {
      await openDrivePicker((file, meta) => {
        setTemplateFile(file);
        setSavedTemplateMeta(meta);
      });
    } catch (e: any) {
      const msg = e?.message || 'Unknown error';
      alert(`Google Drive error: ${msg}\n\nIf the popup was blocked, please allow popups for this site and try again.`);
    } finally {
      setIsDriveLoading(false);
    }
  };

  const handleSetDefault = () => {
    if (savedTemplateMeta) {
      saveDefaultTemplate(savedTemplateMeta);
      alert(`✅ "${savedTemplateMeta.fileName}" is now your default template. It will auto-load next time.`);
    }
  };

  const handleRemoveDefault = () => {
    clearDefaultTemplate();
    setSavedTemplateMeta(null);
    setTemplateFile(null);
    alert('Default template removed.');
  };

  const isIDR = data.paymentCurrency === 'IDR';
  const showCrypto = data.paymentMethod?.toLowerCase().includes('crypto');
  const showWise = data.paymentMethod?.toLowerCase().includes('wise');
  const showBank = data.paymentMethod?.toLowerCase().includes('idr') || data.paymentMethod?.toLowerCase().includes('bank');

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 pb-20">
      {/* Header */}
      <header className="bg-emerald-900 text-white shadow-lg sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Home className="w-6 h-6 text-emerald-300" />
            <h1 className="text-2xl font-bold tracking-wide">Villa Contract Generator 🌿</h1>
          </div>
          <div className="text-xs text-emerald-200 font-mono hidden sm:block">
            v3.0.0 (3-Party + Agent)
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-8">
        <div className="space-y-8">

          {/* ── SMART PASTE BOX ── */}
          <section className="bg-slate-900 rounded-xl shadow-lg border border-slate-700 overflow-hidden">
            <div
              className="px-5 py-4 flex items-center justify-between cursor-pointer hover:bg-slate-800 transition-colors"
              onClick={() => setSmartPasteOpen(v => !v)}
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">⚡</span>
                <div>
                  <h2 className="text-base font-bold text-white">Smart Auto-Fill</h2>
                  <p className="text-xs text-slate-400">Paste WhatsApp message, email, or any raw text — system detects & fills the form</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {smartPasteResult && smartPasteResult.detected.length > 0 && (
                  <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full font-semibold">
                    ✓ {smartPasteResult.detected.length} fields filled
                  </span>
                )}
                {smartPasteOpen
                  ? <ChevronUp className="w-4 h-4 text-slate-400" />
                  : <ChevronDown className="w-4 h-4 text-slate-400" />
                }
              </div>
            </div>

            {smartPasteOpen && (
              <div className="px-5 pb-5 space-y-3">
                <textarea
                  value={smartPasteText}
                  onChange={e => { setSmartPasteText(e.target.value); setSmartPasteResult(null); }}
                  rows={6}
                  className="w-full bg-slate-800 text-slate-100 placeholder-slate-500 border border-slate-600 rounded-lg p-3 text-sm font-mono focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 resize-y"
                  placeholder={`Paste anything here, e.g.:\n\nGuest: John Smith\nNationality: British\nPassport: AB123456\nPhone: +44 7911 123456\nCheck in: 1 April 2025\nCheck out: 30 April 2025\nVilla: Villa Serenity\nPrice: IDR 45,000,000\nAgent: Bali Tours, PIC: Made Wijaya`}
                />

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleSmartParse}
                    disabled={!smartPasteText.trim()}
                    className="px-5 py-2 bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed text-white font-bold rounded-lg transition-all text-sm flex items-center gap-2"
                  >
                    ⚡ Parse & Auto-Fill Form
                  </button>
                  {smartPasteText && (
                    <button
                      type="button"
                      onClick={() => { setSmartPasteText(''); setSmartPasteResult(null); }}
                      className="px-3 py-2 text-slate-400 hover:text-white text-xs rounded-lg border border-slate-600 hover:border-slate-400 transition-all"
                    >
                      Clear
                    </button>
                  )}
                </div>

                {/* Result summary */}
                {smartPasteResult && (
                  <div className={`p-3 rounded-lg text-xs ${smartPasteResult.detected.length > 0 ? 'bg-emerald-900/40 border border-emerald-700' : 'bg-red-900/30 border border-red-700'}`}>
                    {smartPasteResult.detected.length > 0 ? (
                      <>
                        <p className="text-emerald-400 font-bold mb-2">✅ Detected & filled {smartPasteResult.detected.length} fields:</p>
                        <div className="flex flex-wrap gap-1.5">
                          {smartPasteResult.detected.map(f => (
                            <span key={f} className="bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full">{f}</span>
                          ))}
                        </div>
                        <p className="text-slate-500 mt-2">Review the form below and correct anything if needed.</p>
                      </>
                    ) : (
                      <p className="text-red-400">⚠️ No fields detected. Try adding labels like "Name:", "Check in:", "Villa:", "Price:", etc.</p>
                    )}
                  </div>
                )}

                {/* Hints */}
                {!smartPasteResult && (
                  <div className="text-xs text-slate-500 space-y-1">
                    <p>💡 <span className="text-slate-400">Supported labels:</span> Name · Passport · Nationality · Phone · Check in/out · Villa · Price · Monthly · Deposit · Owner · Agent · PIC · Email</p>
                    <p>💡 Works with casual messages too — just paste and try!</p>
                  </div>
                )}
              </div>
            )}
          </section>

          {/* ── SECTION: Villa / Property Details ── */}
          <section className="bg-white p-6 rounded-xl shadow-sm border border-emerald-100">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-emerald-900 flex items-center gap-2">
                <Home className="w-5 h-5" /> Villa / Property Details
              </h2>
              <select
                onChange={handleVillaTemplateChange}
                className="text-sm border border-emerald-300 rounded-lg p-2 bg-emerald-50 text-emerald-900 focus:ring-2 focus:ring-emerald-500 outline-none"
                defaultValue=""
              >
                <option value="" disabled>Load Villa Template...</option>
                <option value="custom">✨ Custom / New Villa</option>
                <optgroup label="Saved Villas">
                  {VILLA_TEMPLATES.map(v => (
                    <option key={v.name} value={v.name}>{v.name}</option>
                  ))}
                </optgroup>
              </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-600 mb-1">Property Code</label>
                <input
                  type="text"
                  value={data.propertyCode}
                  onChange={e => handleInputChange('propertyCode', e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-emerald-500 outline-none transition"
                  placeholder="e.g. 4BW2"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-600 mb-1">Bedrooms</label>
                <input
                  type="number"
                  value={data.bedrooms}
                  onChange={e => handleInputChange('bedrooms', parseInt(e.target.value) || 0)}
                  className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-emerald-500 outline-none transition"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-slate-600 mb-1">Villa Name</label>
                <input
                  type="text"
                  value={data.villaName}
                  onChange={e => handleInputChange('villaName', e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-emerald-500 outline-none transition"
                  placeholder="e.g. Villa Sentosa"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-slate-600 mb-1">Property Address</label>
                <input
                  type="text"
                  value={data.villaAddress}
                  onChange={e => handleInputChange('villaAddress', e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-emerald-500 outline-none transition"
                  placeholder="e.g. Jln Tegal Sari Tibubeneng No.12"
                />
              </div>
            </div>
          </section>

          {/* ── SECTION: Lessor (Property Owner) — toggleable like Agent ── */}
          <section className="bg-white rounded-xl shadow-sm border border-amber-100 overflow-hidden">
            {/* Toggle header */}
            <div
              className="p-5 cursor-pointer hover:bg-amber-50 transition-colors"
              onClick={() => {
                setLessorOpen(v => !v);
                if (!data.hasLessor) handleInputChange('hasLessor', true);
              }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${data.hasLessor ? 'bg-amber-100' : 'bg-slate-100'}`}>
                    <Building2 className={`w-5 h-5 ${data.hasLessor ? 'text-amber-600' : 'text-slate-400'}`} />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-amber-900 flex items-center gap-2">
                      Lessor / Property Owner
                      {data.hasLessor && data.lessor.name && (
                        <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-semibold">{data.lessor.name}</span>
                      )}
                    </h2>
                    <p className="text-xs text-amber-500">Owner data available for this deal? Enable to enter details.</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={e => { e.stopPropagation(); handleInputChange('hasLessor', !data.hasLessor); setLessorOpen(!data.hasLessor); }}
                    className={`relative inline-flex w-12 h-6 rounded-full transition-colors ${data.hasLessor ? 'bg-amber-500' : 'bg-slate-300'}`}
                  >
                    <span className={`inline-block w-5 h-5 bg-white rounded-full shadow transform transition-transform mt-0.5 ${data.hasLessor ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                  {lessorOpen ? <ChevronUp className="w-5 h-5 text-amber-400" /> : <ChevronDown className="w-5 h-5 text-amber-400" />}
                </div>
              </div>
            </div>

            {/* Lessor Form — collapsible */}
            {lessorOpen && data.hasLessor && (
              <div className="border-t border-amber-100 p-6 space-y-4">

                {/* Saved owners selector */}
                {savedOwners.length > 0 && (
                  <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                    <label className="block text-xs font-bold text-amber-700 mb-2">📂 Load from Saved Owners</label>
                    <div className="flex flex-wrap gap-2">
                      {savedOwners.map(o => (
                        <div key={o.id} className="flex items-center gap-1 bg-white border border-amber-200 rounded-full pl-3 pr-1 py-1">
                          <button
                            type="button"
                            onClick={() => handleLoadOwner(o.id)}
                            className="text-xs font-semibold text-amber-800 hover:text-amber-600"
                          >
                            {o.name}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteOwner(o.id)}
                            className="w-4 h-4 text-slate-400 hover:text-red-500 flex items-center justify-center"
                          >
                            <X size={10} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-semibold text-slate-600 mb-1">Full Name / Company Name</label>
                    <input type="text" value={data.lessor.name} onChange={e => handleLessorChange('name', e.target.value)}
                      className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-amber-400 outline-none transition"
                      placeholder="e.g. Wayan Santosa / PT Property Owner" />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-semibold text-slate-600 mb-1">
                      Registered Address <span className="font-normal text-slate-400">or</span> Place & Date of Birth
                    </label>
                    <input type="text" value={data.lessor.addressOrBirth} onChange={e => handleLessorChange('addressOrBirth', e.target.value)}
                      className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-amber-400 outline-none transition"
                      placeholder="e.g. Jl. Sunset Road No. 5, Seminyak — or — Denpasar, 12 June 1980" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-600 mb-1">Country / Nationality</label>
                    <input type="text" value={data.lessor.country} onChange={e => handleLessorChange('country', e.target.value)}
                      className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-amber-400 outline-none transition"
                      placeholder="e.g. Indonesia" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-600 mb-1">NIK / National ID / Passport No.</label>
                    <input type="text" value={data.lessor.nik} onChange={e => handleLessorChange('nik', e.target.value)}
                      className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-amber-400 outline-none transition"
                      placeholder="e.g. 5171xxxxxxxxxxxxxx" />
                  </div>
                </div>

                {/* Save owner button */}
                <button
                  type="button"
                  onClick={handleSaveOwner}
                  className="mt-1 px-4 py-2 text-xs font-bold bg-amber-500 hover:bg-amber-400 text-white rounded-lg transition-all flex items-center gap-1"
                >
                  💾 Save Owner to Contacts
                </button>

                {/* Agency info — fixed, read-only */}
                <div className="p-3 bg-amber-50 rounded-lg border border-amber-100">
                  <p className="text-xs font-semibold text-amber-700 mb-1">Agency (Party 3) — Auto-filled</p>
                  <p className="text-xs text-amber-600">
                    <strong>PT The Villa Managers</strong> · Jl Intan Permai, Kerobokan Kelod, Indonesia · NIB: 0702250138139
                  </p>
                </div>
              </div>
            )}
          </section>

          {/* ── SECTION: Guests / Lessee ── */}
          <section className="bg-white p-6 rounded-xl shadow-sm border border-emerald-100">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-emerald-900 flex items-center gap-2">
                <Users className="w-5 h-5" /> Lessee / Guests ({data.guests.length})
              </h2>
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-400 hidden sm:block">ID / Passport / Business Card accepted</span>
                {data.guests.length < 4 && (
                  <button
                    onClick={addGuest}
                    className="text-xs bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full font-bold hover:bg-emerald-200 flex items-center gap-1"
                  >
                    <Plus size={14} /> Add Guest
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-6">
              {data.guests.map((guest, index) => (
                <div key={guest.id || index} className="p-4 border border-slate-200 rounded-lg bg-slate-50 relative">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-sm font-bold text-slate-500 uppercase tracking-wider">
                      {index === 0 ? '👤 Primary Lessee (Party 2)' : `Guest ${index + 1}`}
                    </span>
                    {index > 0 && (
                      <button onClick={() => removeGuest(index)} className="text-slate-400 hover:text-red-500">
                        <X size={16} />
                      </button>
                    )}
                  </div>

                  <div className="mb-4">
                    <PassportUploader guestIndex={index} onScanComplete={(n, p) => handlePassportScan(index, n, p)} />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Full Name</label>
                      <input
                        type="text"
                        value={guest.name}
                        onChange={e => updateGuest(index, 'name', e.target.value)}
                        className="w-full p-2 border border-slate-300 rounded text-sm focus:border-emerald-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">
                        ID / Passport / Business Card No.
                      </label>
                      <input
                        type="text"
                        value={guest.passportNumber}
                        onChange={e => updateGuest(index, 'passportNumber', e.target.value)}
                        className="w-full p-2 border border-slate-300 rounded text-sm focus:border-emerald-500 outline-none"
                        placeholder="Passport, ID, or Business Card ref"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Nationality</label>
                      <input
                        type="text"
                        value={guest.nationality}
                        onChange={e => updateGuest(index, 'nationality', e.target.value)}
                        className="w-full p-2 border border-slate-300 rounded text-sm focus:border-emerald-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Place & Date of Birth</label>
                      <input
                        type="text"
                        value={guest.birthday}
                        onChange={e => updateGuest(index, 'birthday', e.target.value)}
                        className="w-full p-2 border border-slate-300 rounded text-sm focus:border-emerald-500 outline-none"
                        placeholder="e.g. London, 15 March 1990"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Phone / WhatsApp</label>
                      <input
                        type="text"
                        value={guest.phone}
                        onChange={e => updateGuest(index, 'phone', e.target.value)}
                        className="w-full p-2 border border-slate-300 rounded text-sm focus:border-emerald-500 outline-none"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ── SECTION: Stay Details ── */}
          <section className="bg-white p-6 rounded-xl shadow-sm border border-emerald-100">
            <h2 className="text-xl font-bold text-emerald-900 mb-4 flex items-center gap-2">
              <Calendar className="w-5 h-5" /> Stay Details
            </h2>

            <div className="mb-4">
              <label className="block text-sm font-semibold text-slate-600 mb-2">Quick Duration</label>
              <div className="flex flex-wrap gap-2">
                {[
                  { label: '1 Week', days: 7 },
                  { label: '2 Weeks', days: 14 },
                  { label: '1 Month', days: 30 },
                  { label: '2 Months', days: 60 },
                  { label: '3 Months', days: 90 },
                  { label: '6 Months', days: 180 },
                  { label: '1 Year', days: 365 },
                ].map(({ label, days }) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => {
                      if (!data.checkInDate) { alert('Please set a check-in date first.'); return; }
                      const start = new Date(data.checkInDate);
                      start.setDate(start.getDate() + days);
                      handleInputChange('checkOutDate', start.toISOString().split('T')[0]);
                    }}
                    className="px-3 py-1.5 text-xs font-semibold rounded-full border border-emerald-300 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 hover:border-emerald-500 transition-all"
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-600 mb-1">Check-in Date</label>
                <input
                  type="date"
                  value={data.checkInDate}
                  onChange={e => handleInputChange('checkInDate', e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-emerald-500 outline-none transition"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-600 mb-1">Check-out Date</label>
                <input
                  type="date"
                  value={data.checkOutDate}
                  onChange={e => handleInputChange('checkOutDate', e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-emerald-500 outline-none transition"
                />
              </div>
            </div>

            <div className="mt-4 p-4 bg-emerald-50 rounded-lg flex gap-8">
              <div>
                <span className="block text-xs text-emerald-600 uppercase tracking-wide">Duration</span>
                <span className="text-xl font-bold text-emerald-800">{computedData.numberOfNights} Nights</span>
              </div>
              {computedData.numberOfMonths > 0 && (
                <div>
                  <span className="block text-xs text-emerald-600 uppercase tracking-wide">Approx.</span>
                  <span className="text-xl font-bold text-emerald-800">{computedData.numberOfMonths} Months</span>
                </div>
              )}
            </div>
          </section>

          {/* ── SECTION: Financials ── */}
          <section className="bg-white p-6 rounded-xl shadow-sm border border-emerald-100">
            <h2 className="text-xl font-bold text-emerald-900 mb-4 flex items-center gap-2">
              <CreditCard className="w-5 h-5" /> Financials & Payment
            </h2>

            {/* Currency selector */}
            <div className="mb-5">
              <label className="block text-sm font-semibold text-slate-600 mb-2">Payment Currency</label>
              <div className="flex flex-wrap gap-2">
                {CURRENCIES.map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => handleInputChange('paymentCurrency', c)}
                    className={`px-4 py-2 text-sm font-bold rounded-lg border transition-all ${data.paymentCurrency === c
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-white text-slate-600 border-slate-300 hover:border-emerald-400'
                      }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Monthly Price helper */}
              <div className="md:col-span-2 p-4 bg-blue-50 border border-blue-100 rounded-lg">
                <label className="block text-sm font-semibold text-blue-800 mb-1">
                  Monthly / Base Price ({data.paymentCurrency})
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-slate-500 font-bold">{data.paymentCurrency}</span>
                  {isIDR ? (
                    <CurrencyInput value={data.monthlyPrice} onChange={v => handleInputChange('monthlyPrice', v)} placeholder="e.g. 30.000.000" />
                  ) : (
                    <input
                      type="number"
                      value={data.monthlyPrice || ''}
                      onChange={e => handleInputChange('monthlyPrice', parseFloat(e.target.value) || 0)}
                      className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-emerald-500 outline-none font-mono"
                      placeholder="e.g. 2000"
                    />
                  )}
                </div>
                <p className="text-xs text-blue-600 mt-1">Auto-calculates Total Price based on nights (pro-rated).</p>
              </div>

              {/* Total Price */}
              <div>
                <label className="block text-sm font-semibold text-slate-600 mb-1">Total Agreed Price ({data.paymentCurrency})</label>
                <div className="flex items-center gap-2">
                  <span className="text-slate-500 font-bold">{data.paymentCurrency}</span>
                  {isIDR ? (
                    <CurrencyInput value={data.totalPrice} onChange={v => handleInputChange('totalPrice', v)} />
                  ) : (
                    <input
                      type="number"
                      value={data.totalPrice || ''}
                      onChange={e => handleInputChange('totalPrice', parseFloat(e.target.value) || 0)}
                      className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-emerald-500 outline-none font-mono"
                    />
                  )}
                </div>
              </div>

              {/* Security Deposit */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-semibold text-slate-600">Security Deposit ({data.paymentCurrency})</label>
                  <button
                    type="button"
                    onClick={() => handleInputChange('securityDeposit', Math.round(data.totalPrice * 0.10))}
                    className="text-xs text-emerald-600 hover:text-emerald-800 font-medium underline"
                  >
                    Reset to 10%
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-500 font-bold">{data.paymentCurrency}</span>
                  {isIDR ? (
                    <CurrencyInput value={data.securityDeposit} onChange={v => handleInputChange('securityDeposit', v)} />
                  ) : (
                    <input
                      type="number"
                      value={data.securityDeposit || ''}
                      onChange={e => handleInputChange('securityDeposit', parseFloat(e.target.value) || 0)}
                      className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-emerald-500 outline-none font-mono"
                    />
                  )}
                </div>
                <p className="text-xs text-slate-400 mt-1">Auto-set to 10% — override as needed.</p>
              </div>

              {/* Payment Due Date */}
              <div>
                <label className="block text-sm font-semibold text-slate-600 mb-1">Payment Due Date</label>
                <input
                  type="date"
                  value={data.paymentDueDate}
                  onChange={e => handleInputChange('paymentDueDate', e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-emerald-500 outline-none transition"
                />
              </div>

              {/* Payment Terms */}
              <div>
                <label className="block text-sm font-semibold text-slate-600 mb-1">Payment Terms</label>
                <input
                  type="text"
                  value={data.paymentTerms}
                  onChange={e => handleInputChange('paymentTerms', e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-emerald-500 outline-none transition"
                  placeholder="e.g. Full upfront / 50% on check-in"
                />
              </div>
            </div>

            {/* First & Following Payments */}
            <div className="mt-6 p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-4">
              <h3 className="text-sm font-bold text-slate-700">Payment Schedule</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">First Payment Amount ({data.paymentCurrency})</label>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400 text-xs">{data.paymentCurrency}</span>
                    {isIDR ? (
                      <CurrencyInput value={data.firstPaymentAmount} onChange={v => handleInputChange('firstPaymentAmount', v)} />
                    ) : (
                      <input
                        type="number"
                        value={data.firstPaymentAmount || ''}
                        onChange={e => handleInputChange('firstPaymentAmount', parseFloat(e.target.value) || 0)}
                        className="w-full p-2 border border-slate-300 rounded text-sm focus:border-emerald-500 outline-none font-mono"
                      />
                    )}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">First Payment Due Date</label>
                  <input
                    type="date"
                    value={data.firstPaymentDueDate}
                    onChange={e => handleInputChange('firstPaymentDueDate', e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded text-sm focus:border-emerald-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Following Payment Amount ({data.paymentCurrency})</label>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400 text-xs">{data.paymentCurrency}</span>
                    {isIDR ? (
                      <CurrencyInput value={data.followingPaymentAmount} onChange={v => handleInputChange('followingPaymentAmount', v)} />
                    ) : (
                      <input
                        type="number"
                        value={data.followingPaymentAmount || ''}
                        onChange={e => handleInputChange('followingPaymentAmount', parseFloat(e.target.value) || 0)}
                        className="w-full p-2 border border-slate-300 rounded text-sm focus:border-emerald-500 outline-none font-mono"
                      />
                    )}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Following Payment Due Date</label>
                  <input
                    type="date"
                    value={data.followingPaymentDueDate}
                    onChange={e => handleInputChange('followingPaymentDueDate', e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded text-sm focus:border-emerald-500 outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Payment Method */}
            <div className="mt-5">
              <label className="block text-sm font-semibold text-slate-600 mb-2">Payment Method</label>
              <div className="flex flex-wrap gap-2 mb-3">
                {PAYMENT_METHODS.map(m => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => handleInputChange('paymentMethod', m)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-full border transition-all ${data.paymentMethod === m
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-white text-slate-600 border-slate-300 hover:border-emerald-400'
                      }`}
                  >
                    {m}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-1 gap-3">
                {showBank && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1 flex items-center gap-1">
                      <Landmark size={12} /> Bank Details (IDR)
                    </label>
                    <input
                      type="text"
                      value={data.bankDetailsIDR}
                      onChange={e => handleInputChange('bankDetailsIDR', e.target.value)}
                      className="w-full p-2 border border-slate-300 rounded text-sm focus:border-emerald-500 outline-none"
                      placeholder="Bank name, Account holder, Account number"
                    />
                  </div>
                )}
                {showWise && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1 flex items-center gap-1">
                      <Globe size={12} /> Wise / EURO Account
                    </label>
                    <input
                      type="text"
                      value={data.wiseEuroAccount}
                      onChange={e => handleInputChange('wiseEuroAccount', e.target.value)}
                      className="w-full p-2 border border-slate-300 rounded text-sm focus:border-emerald-500 outline-none"
                      placeholder="Wise account email or account details"
                    />
                  </div>
                )}
                {showCrypto && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1 flex items-center gap-1">
                      <Wallet size={12} /> Crypto USDT — Network: TRC20 — Wallet Address
                    </label>
                    <input
                      type="text"
                      value={data.cryptoWalletAddress}
                      onChange={e => handleInputChange('cryptoWalletAddress', e.target.value)}
                      className="w-full p-2 border border-slate-300 rounded text-sm focus:border-emerald-500 outline-none font-mono"
                      placeholder="TRC20 wallet address"
                    />
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* ── SECTION: Inclusions ── */}
          <section className="bg-white p-6 rounded-xl shadow-sm border border-emerald-100">
            <h2 className="text-xl font-bold text-emerald-900 mb-4 flex items-center gap-2">
              <ListTodo className="w-5 h-5" /> Inclusions
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Checkbox label="Cleaning 2x per week" checked={data.inclusions.cleaning2x} onChange={() => handleInclusionChange('cleaning2x')} />
              <Checkbox label="Pool Maintenance 2x per week" checked={data.inclusions.pool2x} onChange={() => handleInclusionChange('pool2x')} />
              <Checkbox label="Internet" checked={data.inclusions.internet} onChange={() => handleInclusionChange('internet')} />
              <Checkbox label="Laundry linen & towels 1x" checked={data.inclusions.laundry} onChange={() => handleInclusionChange('laundry')} />
              <Checkbox label="Banjar Fee" checked={data.inclusions.banjarFee} onChange={() => handleInclusionChange('banjarFee')} />
              <Checkbox label="Rubbish / Garbage Fee" checked={data.inclusions.rubbishFee} onChange={() => handleInclusionChange('rubbishFee')} />
              <Checkbox label="Electricity" checked={data.inclusions.electricity} onChange={() => handleInclusionChange('electricity')} />
            </div>
            <div className="mt-4">
              <label className="block text-sm font-semibold text-slate-600 mb-1">Other Inclusions</label>
              <input
                type="text"
                value={data.otherInclusions}
                onChange={e => handleInputChange('otherInclusions', e.target.value)}
                className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-emerald-500 outline-none transition"
                placeholder="e.g. Scooter rental, Breakfast..."
              />
            </div>
          </section>

          {/* ── SECTION: Agent / Partner Registration — NEW ── */}
          <section className="bg-white rounded-xl shadow-sm border border-purple-100 overflow-hidden">
            {/* Toggle header */}
            <div
              className="p-5 cursor-pointer hover:bg-purple-50 transition-colors"
              onClick={() => {
                setAgentOpen(v => !v);
                if (!data.hasAgent) handleInputChange('hasAgent', true);
              }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${data.hasAgent ? 'bg-purple-100' : 'bg-slate-100'}`}>
                    <Handshake className={`w-5 h-5 ${data.hasAgent ? 'text-purple-600' : 'text-slate-400'}`} />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-purple-900 flex items-center gap-2">
                      Agent / Partner
                      {data.hasAgent && (
                        <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-semibold">Enabled</span>
                      )}
                    </h2>
                    <p className="text-xs text-purple-500">This deal came through an agent? Enable to register them.</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {/* Toggle switch */}
                  <button
                    type="button"
                    onClick={e => { e.stopPropagation(); handleInputChange('hasAgent', !data.hasAgent); setAgentOpen(!data.hasAgent); }}
                    className={`relative inline-flex w-12 h-6 rounded-full transition-colors ${data.hasAgent ? 'bg-purple-500' : 'bg-slate-300'}`}
                  >
                    <span className={`inline-block w-5 h-5 bg-white rounded-full shadow transform transition-transform mt-0.5 ${data.hasAgent ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                  {agentOpen
                    ? <ChevronUp className="w-5 h-5 text-purple-400" />
                    : <ChevronDown className="w-5 h-5 text-purple-400" />
                  }
                </div>
              </div>
            </div>

            {/* Agent Form — collapsible */}
            {agentOpen && data.hasAgent && (
              <div className="border-t border-purple-100 p-6 space-y-6">

                {/* Saved agents selector */}
                {savedAgents.length > 0 && (
                  <div className="p-3 bg-purple-50 rounded-lg border border-purple-200">
                    <label className="block text-xs font-bold text-purple-700 mb-2">📂 Load from Saved Agents</label>
                    <div className="flex flex-wrap gap-2">
                      {savedAgents.map(a => (
                        <div key={a.id} className="flex items-center gap-1 bg-white border border-purple-200 rounded-full pl-3 pr-1 py-1">
                          <button type="button" onClick={() => handleLoadAgent(a.id)} className="text-xs font-semibold text-purple-800 hover:text-purple-600">
                            {a.companyName || a.agentPIC}
                            <span className="ml-1 font-normal text-purple-400">{a.partnershipType}</span>
                          </button>
                          <button type="button" onClick={() => handleDeleteAgent(a.id)} className="w-4 h-4 text-slate-400 hover:text-red-500 flex items-center justify-center">
                            <X size={10} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* A. Partnership Type */}
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-widest text-purple-700 mb-3">A. Partnership Type</h3>
                  <div className="flex flex-wrap gap-2">
                    {PARTNERSHIP_TYPES.map(t => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => handleAgentChange('partnershipType', t)}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-full border transition-all ${data.agent.partnershipType === t
                          ? 'bg-purple-600 text-white border-purple-600'
                          : 'bg-white text-slate-600 border-slate-300 hover:border-purple-400'
                          }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                  {data.agent.partnershipType === 'Others' && (
                    <input
                      type="text"
                      value={data.agent.partnershipTypeOther}
                      onChange={e => handleAgentChange('partnershipTypeOther', e.target.value)}
                      className="mt-2 w-full p-2 border border-slate-300 rounded text-sm focus:border-purple-400 outline-none"
                      placeholder="Specify partnership type..."
                    />
                  )}
                </div>

                {/* B. Company Information */}
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-widest text-purple-700 mb-3">B. Company Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <AgentField label="Company Name" value={data.agent.companyName} onChange={v => handleAgentChange('companyName', v)} placeholder="e.g. Bali Tours Pte Ltd" />
                    <AgentField label="Office Address" value={data.agent.officeAddress} onChange={v => handleAgentChange('officeAddress', v)} />
                    <AgentField label="Office Phone Number" value={data.agent.officePhone} onChange={v => handleAgentChange('officePhone', v)} />
                    <AgentField label="Agent PIC (Person in Charge)" value={data.agent.agentPIC} onChange={v => handleAgentChange('agentPIC', v)} />
                  </div>
                </div>

                {/* C. PIC / Agent Data */}
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-widest text-purple-700 mb-3">C. PIC / Agent Personal Data</h3>
                  <p className="text-xs text-purple-400 mb-3">Note: Business Card or Company Profile accepted in place of ID / Passport</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <AgentField label="Full Name (as per ID)" value={data.agent.picFullName} onChange={v => handleAgentChange('picFullName', v)} className="md:col-span-2" />
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Gender</label>
                      <select
                        value={data.agent.gender}
                        onChange={e => handleAgentChange('gender', e.target.value)}
                        className="w-full p-2 border border-slate-300 rounded text-sm focus:border-purple-400 outline-none bg-white"
                      >
                        <option value="">Select...</option>
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Marital Status</label>
                      <select
                        value={data.agent.maritalStatus}
                        onChange={e => handleAgentChange('maritalStatus', e.target.value)}
                        className="w-full p-2 border border-slate-300 rounded text-sm focus:border-purple-400 outline-none bg-white"
                      >
                        <option value="">Select...</option>
                        <option value="Single">Single</option>
                        <option value="Married">Married</option>
                        <option value="Divorced">Divorced</option>
                        <option value="Widowed">Widowed</option>
                      </select>
                    </div>
                    <AgentField label="Place of Birth" value={data.agent.placeOfBirth} onChange={v => handleAgentChange('placeOfBirth', v)} />
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Date of Birth</label>
                      <input
                        type="date"
                        value={data.agent.dateOfBirth}
                        onChange={e => handleAgentChange('dateOfBirth', e.target.value)}
                        className="w-full p-2 border border-slate-300 rounded text-sm focus:border-purple-400 outline-none"
                      />
                    </div>
                    <AgentField label="Nationality" value={data.agent.picNationality} onChange={v => handleAgentChange('picNationality', v)} />
                    <AgentField label="ID / Passport / Business Card No." value={data.agent.idOrPassportNumber} onChange={v => handleAgentChange('idOrPassportNumber', v)} placeholder="ID, Passport, or Business Card ref" />
                    <AgentField label="Address (as per ID)" value={data.agent.addressAsPerID} onChange={v => handleAgentChange('addressAsPerID', v)} className="md:col-span-2" />
                    <AgentField label="Current Address (if different)" value={data.agent.currentAddress} onChange={v => handleAgentChange('currentAddress', v)} className="md:col-span-2" placeholder="Leave blank if same as above" />
                    <AgentField label="Active Phone / WhatsApp" value={data.agent.whatsappNumber} onChange={v => handleAgentChange('whatsappNumber', v)} />
                    <AgentField label="Email Address" value={data.agent.agentEmail} onChange={v => handleAgentChange('agentEmail', v)} type="email" />
                  </div>
                </div>

                {/* D. Sales Platforms */}
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-widest text-purple-700 mb-3">D. Sales Platforms</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <AgentField label="Facebook" value={data.agent.facebook} onChange={v => handleAgentChange('facebook', v)} placeholder="facebook.com/..." />
                    <AgentField label="Instagram" value={data.agent.instagram} onChange={v => handleAgentChange('instagram', v)} placeholder="@username" />
                    <AgentField label="TikTok" value={data.agent.tiktok} onChange={v => handleAgentChange('tiktok', v)} placeholder="@username" />
                    <AgentField label="Website" value={data.agent.website} onChange={v => handleAgentChange('website', v)} placeholder="https://..." />
                    <AgentField label="Booking.com" value={data.agent.bookingCom} onChange={v => handleAgentChange('bookingCom', v)} />
                    <AgentField label="Agoda" value={data.agent.agoda} onChange={v => handleAgentChange('agoda', v)} />
                    <AgentField label="Traveloka" value={data.agent.traveloka} onChange={v => handleAgentChange('traveloka', v)} />
                    <AgentField label="Tiket.com" value={data.agent.tiketCom} onChange={v => handleAgentChange('tiketCom', v)} />
                    <AgentField label="Personal Network" value={data.agent.personalNetwork} onChange={v => handleAgentChange('personalNetwork', v)} />
                    <AgentField label="Others" value={data.agent.otherPlatform} onChange={v => handleAgentChange('otherPlatform', v)} />
                  </div>
                </div>

                {/* E. Bank Details */}
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-widest text-purple-700 mb-3">E. Bank Details (for commission payment)</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-4 bg-purple-50 rounded-lg border border-purple-100">
                    <AgentField label="Bank Name" value={data.agent.bankName} onChange={v => handleAgentChange('bankName', v)} />
                    <AgentField label="Account Holder Name" value={data.agent.accountHolderName} onChange={v => handleAgentChange('accountHolderName', v)} />
                    <AgentField label="Bank Account Number" value={data.agent.bankAccountNumber} onChange={v => handleAgentChange('bankAccountNumber', v)} />
                  </div>
                </div>

                {/* F. Document note */}
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-xs font-semibold text-yellow-800">F. Supporting Document</p>
                  <p className="text-xs text-yellow-700 mt-1">
                    Please attach PIC's ID photo (KTP / Passport) — or alternatively a <strong>Business Card</strong> or <strong>Company Profile</strong> is accepted.
                  </p>
                </div>

                {/* Save agent button */}
                <button
                  type="button"
                  onClick={handleSaveAgent}
                  className="w-full py-2 text-sm font-bold bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition-all flex items-center justify-center gap-2"
                >
                  💾 Save Agent to Contacts
                </button>

              </div>
            )}
          </section>

        </div>

        {/* ── Generate Section ── */}
        <div className="bg-emerald-900 text-emerald-50 p-6 rounded-xl shadow-lg">
          <h3 className="text-lg font-bold mb-5 flex items-center gap-2">
            <FileDown className="w-5 h-5" /> Generate Documents
          </h3>

          {/* Template Upload */}
          <label className="block text-xs uppercase tracking-wider text-emerald-300 mb-2">1. Upload Contract Template (.docx / Google Docs)</label>
          <div
            className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer ${isDragging
              ? 'border-emerald-400 bg-emerald-800/60 scale-[1.01]'
              : templateFile
                ? 'border-emerald-500 bg-emerald-800/30'
                : 'border-emerald-600 bg-emerald-800/20 hover:bg-emerald-800/40 hover:border-emerald-500'
              }`}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              const file = e.dataTransfer.files?.[0];
              if (file && file.name.endsWith('.docx')) {
                setTemplateFile(file);
                setSavedTemplateMeta(null);
              } else {
                alert('Please drop a .docx file');
              }
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".docx"
              className="hidden"
              onChange={(e) => {
                setTemplateFile(e.target.files?.[0] || null);
                setSavedTemplateMeta(null);
              }}
            />
            {templateFile ? (
              <div className="flex flex-col items-center gap-2">
                <div className="w-12 h-12 bg-emerald-500/20 rounded-full flex items-center justify-center">
                  <FileDown className="w-6 h-6 text-emerald-300" />
                </div>
                <p className="text-emerald-200 font-semibold">{templateFile.name}</p>
                {savedTemplateMeta && loadDefaultTemplateMeta()?.fileId === savedTemplateMeta.fileId && (
                  <span className="text-xs bg-emerald-600/50 text-emerald-200 px-2 py-0.5 rounded-full">⭐ Default template</span>
                )}
                <p className="text-xs text-emerald-400">Click or drop a new file to replace</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <div className="w-12 h-12 bg-emerald-700/50 rounded-full flex items-center justify-center">
                  <Upload className="w-6 h-6 text-emerald-300" />
                </div>
                <p className="text-emerald-200 font-medium">
                  {isDragging ? 'Drop your .docx here!' : 'Drag & drop your .docx template here'}
                </p>
                <p className="text-xs text-emerald-500">or click to browse files</p>
              </div>
            )}
          </div>

          {/* Google Drive */}
          <button
            onClick={(e) => { e.stopPropagation(); handleDrivePick(); }}
            disabled={isDriveLoading}
            className="mt-3 w-full py-2.5 bg-white/10 hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed text-emerald-100 text-sm font-semibold rounded-lg border border-emerald-600 transition-all flex items-center justify-center gap-2"
          >
            {isDriveLoading ? '⏳ Opening Drive...' : '📂 Select from Google Drive or Google Docs'}
          </button>

          {savedTemplateMeta && (
            <div className="mt-3 flex items-center justify-between bg-emerald-800/40 rounded-lg px-4 py-2.5">
              <span className="text-xs text-emerald-300 truncate max-w-[60%]">📄 {savedTemplateMeta.fileName}</span>
              <div className="flex gap-2 flex-shrink-0">
                <button onClick={handleSetDefault} className="text-xs bg-yellow-500/20 hover:bg-yellow-500/40 text-yellow-300 font-semibold px-3 py-1 rounded-full transition-all">
                  ⭐ Set as Default
                </button>
                <button onClick={handleRemoveDefault} className="text-xs bg-red-500/20 hover:bg-red-500/40 text-red-300 font-semibold px-3 py-1 rounded-full transition-all">
                  ✕ Remove
                </button>
              </div>
            </div>
          )}

          {/* Generate buttons */}
          <label className="block text-xs uppercase tracking-wider text-emerald-300 mt-6 mb-3">2. Generate Documents</label>
          <div className="space-y-3">
            {/* Client Copy */}
            <button
              onClick={() => handleGenerate('CLIENT')}
              disabled={generatingCopy !== null || !templateFile}
              className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-bold rounded-lg shadow-md transition-all flex items-center justify-center gap-2 text-base"
            >
              {generatingCopy === 'CLIENT' ? '⏳ Generating...' : '📄 Download Client Copy'}
            </button>

            {/* Owner Copy */}
            <button
              onClick={() => handleGenerate('OWNER')}
              disabled={generatingCopy !== null || !templateFile || !data.hasLessor}
              title={!data.hasLessor ? 'Enable the Lessor/Property Owner section above first' : ''}
              className="w-full py-3 bg-amber-500 hover:bg-amber-400 disabled:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50 text-white font-bold rounded-lg shadow-md transition-all flex items-center justify-center gap-2 text-base"
            >
              {generatingCopy === 'OWNER' ? '⏳ Generating...' : (
                <span className="flex flex-col items-center leading-tight">
                  <span>🏠 Download Owner Copy</span>
                  {!data.hasLessor && <span className="text-xs font-normal opacity-70">Enable Owner section to unlock</span>}
                </span>
              )}
            </button>

            {/* Agent Contract Copy — always visible, disabled if no agent */}
            <button
              onClick={() => handleGenerate('AGENT')}
              disabled={generatingCopy !== null || !templateFile || !data.hasAgent}
              title={!data.hasAgent ? 'Enable the Agent/Partner section above first' : ''}
              className="w-full py-3 bg-purple-600 hover:bg-purple-500 disabled:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50 text-white font-bold rounded-lg shadow-md transition-all flex items-center justify-center gap-2 text-base"
            >
              {generatingCopy === 'AGENT' ? '⏳ Generating...' : (
                <span className="flex flex-col items-center leading-tight">
                  <span>🤝 Download Agent Copy</span>
                  {!data.hasAgent && <span className="text-xs font-normal opacity-70">Enable Agent section to unlock</span>}
                </span>
              )}
            </button>

            {/* Agent Registration Form — separate, only when agent enabled */}
            {data.hasAgent && (
              <button
                onClick={handleGenerateAgent}
                disabled={generatingCopy !== null}
                className="w-full py-2 bg-purple-900/60 hover:bg-purple-800/80 disabled:opacity-50 text-purple-200 font-semibold rounded-lg border border-purple-700 transition-all flex items-center justify-center gap-2 text-sm"
              >
                📋 Generate Agent Registration Form (printable)
              </button>
            )}
          </div>

          <p className="text-xs text-emerald-500 mt-3 text-center">
            Contract supports: IDR · USD · EUR · USDT · 3-party template tags
          </p>
        </div>

        <TemplateGuide />

      </main>
    </div>
  );
};

// ---- Reusable sub-components ----

const Checkbox: React.FC<{ label: string; checked: boolean; onChange: () => void }> = ({ label, checked, onChange }) => (
  <label className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${checked ? 'bg-emerald-50 border-emerald-500' : 'bg-slate-50 border-slate-200 hover:border-emerald-300'}`}>
    <div className={`w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 ${checked ? 'bg-emerald-500 border-emerald-500' : 'bg-white border-slate-300'}`}>
      {checked && <div className="w-2 h-2 bg-white rounded-full" />}
    </div>
    <span className="text-sm font-medium text-slate-700">{label}</span>
    <input type="checkbox" checked={checked} onChange={onChange} className="hidden" />
  </label>
);

const AgentField: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  className?: string;
}> = ({ label, value, onChange, placeholder = '', type = 'text', className = '' }) => (
  <div className={className}>
    <label className="block text-xs font-semibold text-slate-600 mb-1">{label}</label>
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full p-2 border border-slate-300 rounded text-sm focus:border-purple-400 focus:ring-1 focus:ring-purple-200 outline-none transition"
    />
  </div>
);

// Formats an integer as Indonesian dot-separated: 2000000 -> "2.000.000"
const formatDots = (n: number) =>
  n > 0 ? n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.') : '';

const CurrencyInput: React.FC<{
  value: number;
  onChange: (n: number) => void;
  placeholder?: string;
  className?: string;
}> = ({ value, onChange, placeholder = '0', className = '' }) => {
  const [display, setDisplay] = React.useState(formatDots(value));

  React.useEffect(() => {
    setDisplay(formatDots(value));
  }, [value]);

  return (
    <input
      type="text"
      inputMode="numeric"
      value={display}
      placeholder={placeholder}
      onChange={e => {
        const raw = e.target.value.replace(/\./g, '').replace(/[^0-9]/g, '');
        setDisplay(raw ? formatDots(parseInt(raw)) : '');
        onChange(raw ? parseInt(raw) : 0);
      }}
      className={`w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition font-mono ${className}`}
    />
  );
};

export default App;
