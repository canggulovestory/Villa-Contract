import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ContractData, ComputedData, INITIAL_DATA, makeNewGuest } from './types';
import { SECURITY_DEPOSIT_RATE, formatIDR } from './utils/format';
import { VILLA_TEMPLATES } from './data/villaTemplates';
import { generateDocument, downloadContractLocally } from './services/docService';
import {
  isSignedIn,
  signInToGoogle,
  signOutFromGoogle,
  fetchTemplateFromDrive,
  saveContractToDrive,
} from './services/googleDriveService';
import { TemplateGuide } from './components/TemplateGuide';
import { PassportUploader } from './components/PassportUploader';
import { Checkbox } from './components/Checkbox';
import { ErrorBoundary } from './components/ErrorBoundary';
import {
  User, Calendar, CreditCard, ListTodo, FileDown,
  Waves, Wifi, Zap, Shovel, Trash2, Home, Users, Plus, X, AlertCircle,
  CloudUpload, Link2, LogOut,
} from 'lucide-react';

// ─── Constants ────────────────────────────────────────────────────────────

const MAX_GUESTS = 4;
const MIN_GUESTS = 1;

// ─── Form Validation ──────────────────────────────────────────────────────
// Returns a list of human-readable error messages. Empty = valid.

function validateForm(data: ContractData, computed: ComputedData): string[] {
  const errors: string[] = [];

  if (!data.villaName.trim())    errors.push('Villa name is required.');
  if (!data.villaAddress.trim()) errors.push('Villa address is required.');
  if (data.bedrooms < 1)         errors.push('Bedrooms must be at least 1.');
  if (!data.checkInDate)         errors.push('Check-in date is required.');
  if (!data.checkOutDate)        errors.push('Check-out date is required.');
  if (computed.numberOfNights <= 0)
    errors.push('Check-out date must be after check-in date.');
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

// ─── App ──────────────────────────────────────────────────────────────────

const App: React.FC = () => {
  const [data, setData]                       = useState<ContractData>(INITIAL_DATA);
  const [localTemplateFile, setLocalTemplateFile] = useState<File | null>(null);
  const [isGenerating, setIsGenerating]       = useState(false);
  const [formErrors, setFormErrors]           = useState<string[]>([]);
  const [generateError, setGenerateError]     = useState<string>('');
  const [driveConnected, setDriveConnected]   = useState(isSignedIn());
  const [driveStatus, setDriveStatus]         = useState<string>('');
  const [savedDriveLink, setSavedDriveLink]   = useState<string>('');

  // Fixed: track whether the user has manually set totalPrice so the
  // auto-calculation effect doesn't silently wipe their override.
  const isPriceManuallySet = useRef(false);

  // ── Derived / Computed Values (never stored in state)
  const computedData: ComputedData = useMemo(() => {
    // 1. Nights & Months
    let numberOfNights = 0;
    if (data.checkInDate && data.checkOutDate) {
      const start    = new Date(data.checkInDate);
      const end      = new Date(data.checkOutDate);
      const diffTime = end.getTime() - start.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      numberOfNights = diffDays > 0 ? diffDays : 0;
    }
    const numberOfMonths =
      numberOfNights > 0 ? parseFloat((numberOfNights / 30).toFixed(2)) : 0;

    // 2. Security Deposit (uses shared constant — easy to change in one place)
    const securityDeposit = data.totalPrice * SECURITY_DEPOSIT_RATE;

    // 3. Inclusions string (fallback to 'None' so the contract field is never blank)
    const activeInclusions: string[] = [];
    if (data.inclusions.cleaning2x) activeInclusions.push('Cleaning 2x per week');
    if (data.inclusions.pool2x)     activeInclusions.push('Pool Maintenance 2x per week');
    if (data.inclusions.internet)   activeInclusions.push('Internet');
    if (data.inclusions.banjarFee)  activeInclusions.push('Banjar Fee');
    if (data.inclusions.rubbishFee) activeInclusions.push('Rubbish Fee');
    if (data.inclusions.laundry)    activeInclusions.push('Laundry Linen & Towels 1x');
    if (data.inclusions.electricity)activeInclusions.push('Electricity');
    if (data.otherInclusions.trim()) activeInclusions.push(data.otherInclusions.trim());
    const inclusionsList = activeInclusions.length > 0 ? activeInclusions.join(', ') : 'None';

    return { numberOfNights, numberOfMonths, securityDeposit, inclusionsList };
  }, [data.checkInDate, data.checkOutDate, data.totalPrice, data.inclusions, data.otherInclusions]);

  // ── Fixed: auto-calculate totalPrice only when the user hasn't manually
  //    overridden it. The ref is reset whenever monthlyPrice or dates change
  //    from user input, so a subsequent date/price change re-enables auto-calc.
  useEffect(() => {
    if (isPriceManuallySet.current) return;
    if (computedData.numberOfNights > 0 && data.monthlyPrice > 0) {
      const calculatedTotal = (data.monthlyPrice / 30) * computedData.numberOfNights;
      setData((prev) => ({ ...prev, totalPrice: Math.round(calculatedTotal) }));
    }
  }, [data.monthlyPrice, computedData.numberOfNights]);

  // ─── Handlers ─────────────────────────────────────────────────────────

  const handleInputChange = <K extends keyof ContractData>(
    field: K,
    value: ContractData[K]
  ) => {
    // Fixed: strongly typed generic — no more `value: any`
    setData((prev) => ({ ...prev, [field]: value }));
    // When the user edits monthlyPrice or dates, re-enable auto-calc
    if (field === 'monthlyPrice' || field === 'checkInDate' || field === 'checkOutDate') {
      isPriceManuallySet.current = false;
    }
  };

  const handleTotalPriceChange = (value: number) => {
    // Fixed: separate handler for totalPrice so we know the user is overriding
    isPriceManuallySet.current = true;
    setData((prev) => ({ ...prev, totalPrice: value }));
  };

  const handleVillaTemplateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selected = e.target.value;
    if (selected === 'custom') {
      setData((prev) => ({ ...prev, villaName: '', villaAddress: '', bedrooms: 1 }));
    } else {
      const template = VILLA_TEMPLATES.find((v) => v.name === selected);
      if (template) {
        setData((prev) => ({
          ...prev,
          villaName:    template.name,
          villaAddress: template.address,
          bedrooms:     template.bedrooms,
        }));
      }
    }
  };

  const handleInclusionChange = (key: keyof ContractData['inclusions']) => {
    setData((prev) => ({
      ...prev,
      inclusions: { ...prev.inclusions, [key]: !prev.inclusions[key] },
    }));
  };

  const updateGuest = (
    index: number,
    field: keyof Omit<ReturnType<typeof makeNewGuest>, 'id'>,
    value: string
  ) => {
    const newGuests = [...data.guests];
    newGuests[index] = { ...newGuests[index], [field]: value };
    setData((prev) => ({ ...prev, guests: newGuests }));
  };

  const addGuest = () => {
    if (data.guests.length >= MAX_GUESTS) return;
    setData((prev) => ({
      ...prev,
      guests: [...prev.guests, makeNewGuest(prev.guests.length + 1)],
    }));
  };

  const removeGuest = (index: number) => {
    if (data.guests.length <= MIN_GUESTS) return;
    setData((prev) => ({
      ...prev,
      guests: prev.guests.filter((_, i) => i !== index),
    }));
  };

  // Fixed: only apply passport scan results when they contain actual data
  const handlePassportScan = (index: number, name: string, passport: string) => {
    const newGuests = [...data.guests];
    newGuests[index] = {
      ...newGuests[index],
      // Only overwrite if the OCR found something
      ...(name     ? { name }           : {}),
      ...(passport ? { passportNumber: passport } : {}),
    };
    setData((prev) => ({ ...prev, guests: newGuests }));
  };

  // ── Google Drive ─────────────────────────────────────────────────────

  const handleConnectDrive = async () => {
    setDriveStatus('Connecting…');
    setGenerateError('');
    try {
      await signInToGoogle();
      setDriveConnected(true);
      setDriveStatus('Connected ✓');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Google sign-in failed.';
      setGenerateError(msg);
      setDriveStatus('');
    }
  };

  const handleDisconnectDrive = () => {
    signOutFromGoogle();
    setDriveConnected(false);
    setDriveStatus('');
    setSavedDriveLink('');
  };

  // ── Resolve the template source (Drive first, local fallback) ─────────
  const resolveTemplate = async (): Promise<File | ArrayBuffer | null> => {
    if (driveConnected) {
      // Primary: fetch from Google Drive
      setDriveStatus('Fetching template from Drive…');
      try {
        const buf = await fetchTemplateFromDrive();
        setDriveStatus('Template ready ✓');
        return buf;
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Failed to fetch template.';
        setGenerateError(msg);
        setDriveStatus('');
        return null;
      }
    }
    // Fallback: user-uploaded local file
    if (localTemplateFile) return localTemplateFile;
    setFormErrors(['Please connect Google Drive or upload a .docx template.']);
    return null;
  };

  // ── Download contract locally ─────────────────────────────────────────
  const handleDownload = async () => {
    setFormErrors([]);
    setGenerateError('');
    setSavedDriveLink('');

    const errors = validateForm(data, computedData);
    if (errors.length > 0) {
      setFormErrors(errors);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    const templateSource = await resolveTemplate();
    if (!templateSource) return;

    setIsGenerating(true);
    try {
      const { buffer, filename } = await generateDocument(templateSource, data, computedData);
      downloadContractLocally(buffer, filename);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Unknown error generating document.';
      setGenerateError(msg);
    } finally {
      setIsGenerating(false);
    }
  };

  // ── Save contract to Google Drive ─────────────────────────────────────
  const handleSaveToDrive = async () => {
    setFormErrors([]);
    setGenerateError('');
    setSavedDriveLink('');

    if (!driveConnected) {
      setGenerateError('Connect Google Drive first to use this option.');
      return;
    }

    const errors = validateForm(data, computedData);
    if (errors.length > 0) {
      setFormErrors(errors);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    setIsGenerating(true);
    setDriveStatus('Generating & saving to Drive…');
    try {
      const templateSource = await resolveTemplate();
      if (!templateSource) return;

      const { buffer, filename } = await generateDocument(templateSource, data, computedData);
      const link = await saveContractToDrive(buffer, filename);
      setSavedDriveLink(link);
      setDriveStatus('Saved to Drive ✓');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Unknown error saving to Drive.';
      setGenerateError(msg);
      setDriveStatus('');
    } finally {
      setIsGenerating(false);
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-slate-50 text-slate-800 pb-20">

        {/* Header */}
        <header className="bg-emerald-900 text-white shadow-lg sticky top-0 z-50">
          <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Home className="w-6 h-6 text-emerald-300" />
              <h1 className="text-2xl font-bold tracking-wide">Villa Contract Generator 🌿</h1>
            </div>
            <div className="text-xs text-emerald-200 font-mono hidden sm:block">v2.4.0</div>
          </div>
        </header>

        {/* Validation Errors Banner */}
        {formErrors.length > 0 && (
          <div className="max-w-5xl mx-auto px-6 mt-4">
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2 text-red-700 font-semibold">
                <AlertCircle className="w-5 h-5" />
                Please fix the following before generating:
              </div>
              <ul className="list-disc list-inside text-sm text-red-600 space-y-1">
                {formErrors.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            </div>
          </div>
        )}

        <main className="max-w-5xl mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* ── Left Column: Form ── */}
          <div className="lg:col-span-2 space-y-6">

            {/* Section: Villa Details */}
            <section className="bg-white p-6 rounded-xl shadow-sm border border-emerald-100">
              <h2 className="text-xl font-bold text-emerald-900 mb-4 flex items-center gap-2">
                <Home className="w-5 h-5" /> Villa Details
              </h2>

              {/* Template Picker */}
              <div className="mb-4">
                <label className="block text-sm font-semibold text-slate-600 mb-1">
                  Select a Saved Villa (optional)
                </label>
                <select
                  onChange={handleVillaTemplateChange}
                  className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-emerald-500 outline-none transition"
                  defaultValue=""
                >
                  <option value="" disabled>Choose a saved villa or fill in manually…</option>
                  <option value="custom">✏ Custom / New Villa</option>
                  <optgroup label="Saved Villas">
                    {VILLA_TEMPLATES.map((v) => (
                      <option key={v.name} value={v.name}>{v.name}</option>
                    ))}
                  </optgroup>
                </select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-slate-600 mb-1">Villa Name</label>
                  <input
                    type="text"
                    value={data.villaName}
                    onChange={(e) => handleInputChange('villaName', e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-emerald-500 outline-none transition"
                    placeholder="e.g. Villa Sentosa"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-slate-600 mb-1">Address</label>
                  <input
                    type="text"
                    value={data.villaAddress}
                    onChange={(e) => handleInputChange('villaAddress', e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-emerald-500 outline-none transition"
                    placeholder="e.g. Jalan Raya Canggu No. 12"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-600 mb-1">Bedrooms</label>
                  <input
                    type="number"
                    min={1}
                    value={data.bedrooms}
                    onChange={(e) =>
                      // Fixed: fallback to 1 (not 0) when field is cleared
                      handleInputChange('bedrooms', parseInt(e.target.value) || 1)
                    }
                    className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-emerald-500 outline-none transition"
                  />
                </div>
              </div>
            </section>

            {/* Section: Guests */}
            <section className="bg-white p-6 rounded-xl shadow-sm border border-emerald-100">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-emerald-900 flex items-center gap-2">
                  <Users className="w-5 h-5" /> Guests ({data.guests.length}/{MAX_GUESTS})
                </h2>
                {data.guests.length < MAX_GUESTS && (
                  <button
                    onClick={addGuest}
                    className="flex items-center gap-1 text-sm text-emerald-600 hover:text-emerald-800 font-semibold transition"
                  >
                    <Plus className="w-4 h-4" /> Add Guest
                  </button>
                )}
              </div>

              <div className="space-y-6">
                {data.guests.map((guest, index) => (
                  <div key={guest.id} className="border border-emerald-100 rounded-xl p-4 bg-emerald-50/30">
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-sm font-bold text-emerald-700 uppercase tracking-wider">
                        Guest {index + 1}
                      </span>
                      {index > 0 && (
                        <button
                          onClick={() => removeGuest(index)}
                          className="text-slate-400 hover:text-red-500 transition"
                          title="Remove guest"
                        >
                          <X size={16} />
                        </button>
                      )}
                    </div>

                    {/* OCR Passport Scanner */}
                    <div className="mb-4">
                      <PassportUploader
                        onScanComplete={(name, passport) =>
                          handlePassportScan(index, name, passport)
                        }
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Full Name *</label>
                        <input
                          type="text"
                          value={guest.name}
                          onChange={(e) => updateGuest(index, 'name', e.target.value)}
                          className="w-full p-2 border border-slate-300 rounded text-sm focus:border-emerald-500 outline-none"
                          placeholder="As on passport"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Passport No. *</label>
                        <input
                          type="text"
                          value={guest.passportNumber}
                          onChange={(e) => updateGuest(index, 'passportNumber', e.target.value)}
                          className="w-full p-2 border border-slate-300 rounded text-sm focus:border-emerald-500 outline-none"
                          placeholder="e.g. A1234567"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Nationality *</label>
                        <input
                          type="text"
                          value={guest.nationality}
                          onChange={(e) => updateGuest(index, 'nationality', e.target.value)}
                          className="w-full p-2 border border-slate-300 rounded text-sm focus:border-emerald-500 outline-none"
                          placeholder="e.g. Australian"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Phone</label>
                        <input
                          type="text"
                          value={guest.phone}
                          onChange={(e) => updateGuest(index, 'phone', e.target.value)}
                          className="w-full p-2 border border-slate-300 rounded text-sm focus:border-emerald-500 outline-none"
                          placeholder="+62 …"
                        />
                      </div>
                      {/* Fixed: birthday field was in types/docService but missing from the form */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Date of Birth</label>
                        <input
                          type="date"
                          value={guest.birthday}
                          onChange={(e) => updateGuest(index, 'birthday', e.target.value)}
                          className="w-full p-2 border border-slate-300 rounded text-sm focus:border-emerald-500 outline-none"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Section: Stay Details */}
            <section className="bg-white p-6 rounded-xl shadow-sm border border-emerald-100">
              <h2 className="text-xl font-bold text-emerald-900 mb-4 flex items-center gap-2">
                <Calendar className="w-5 h-5" /> Stay Details
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-600 mb-1">Check-in Date *</label>
                  <input
                    type="date"
                    value={data.checkInDate}
                    onChange={(e) => handleInputChange('checkInDate', e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-emerald-500 outline-none transition"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-600 mb-1">Check-out Date *</label>
                  <input
                    type="date"
                    value={data.checkOutDate}
                    onChange={(e) => handleInputChange('checkOutDate', e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-emerald-500 outline-none transition"
                  />
                </div>
              </div>
              {computedData.numberOfNights > 0 && (
                <div className="mt-4 p-4 bg-emerald-50 rounded-lg flex gap-8">
                  <div>
                    <span className="block text-xs text-emerald-600 uppercase">Duration</span>
                    <span className="text-xl font-bold text-emerald-800">{computedData.numberOfNights} Nights</span>
                  </div>
                  <div>
                    <span className="block text-xs text-emerald-600 uppercase">Months</span>
                    <span className="text-xl font-bold text-emerald-800">{computedData.numberOfMonths}</span>
                  </div>
                </div>
              )}
            </section>

            {/* Section: Financials */}
            <section className="bg-white p-6 rounded-xl shadow-sm border border-emerald-100">
              <h2 className="text-xl font-bold text-emerald-900 mb-4 flex items-center gap-2">
                <CreditCard className="w-5 h-5" /> Financials (IDR)
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                {/* Monthly Price */}
                <div className="md:col-span-2 p-4 bg-blue-50 border border-blue-100 rounded-lg">
                  <label className="block text-sm font-semibold text-blue-800 mb-1">
                    Monthly Price (Rp) *
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500 font-bold">Rp</span>
                    <input
                      type="number"
                      value={data.monthlyPrice || ''}
                      onChange={(e) =>
                        handleInputChange('monthlyPrice', parseFloat(e.target.value) || 0)
                      }
                      className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none transition font-mono"
                      placeholder="e.g. 30000000"
                    />
                  </div>
                  <p className="text-xs text-blue-600 mt-1">
                    Total price is auto-calculated from this. You can override total below.
                  </p>
                </div>

                {/* Total Price */}
                <div>
                  <label className="block text-sm font-semibold text-slate-600 mb-1">
                    Total Price (Rp) *
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500 font-bold">Rp</span>
                    <input
                      type="number"
                      value={data.totalPrice || ''}
                      onChange={(e) =>
                        // Fixed: separate handler marks price as manually overridden
                        handleTotalPriceChange(parseFloat(e.target.value) || 0)
                      }
                      className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-emerald-500 outline-none transition font-mono"
                      placeholder="Auto-calculated"
                    />
                  </div>
                  {isPriceManuallySet.current && (
                    <p className="text-xs text-amber-600 mt-1">
                      ⚠ Auto-calc paused. Change monthly price or dates to re-enable.
                    </p>
                  )}
                </div>

                {/* Security Deposit (display only) */}
                <div>
                  <label className="block text-sm font-semibold text-slate-600 mb-1">
                    Security Deposit (10%)
                  </label>
                  <div className="p-2 bg-slate-50 border border-slate-200 rounded-lg font-mono text-slate-700">
                    {formatIDR(computedData.securityDeposit)}
                  </div>
                </div>

                {/* Payment Due Date */}
                <div>
                  <label className="block text-sm font-semibold text-slate-600 mb-1">Payment Due Date</label>
                  <input
                    type="date"
                    value={data.paymentDueDate}
                    onChange={(e) => handleInputChange('paymentDueDate', e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-emerald-500 outline-none transition"
                  />
                </div>
              </div>
            </section>

            {/* Section: Inclusions */}
            <section className="bg-white p-6 rounded-xl shadow-sm border border-emerald-100">
              <h2 className="text-xl font-bold text-emerald-900 mb-4 flex items-center gap-2">
                <ListTodo className="w-5 h-5" /> Inclusions
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <Checkbox label="Cleaning 2x per week"           checked={data.inclusions.cleaning2x}  onChange={() => handleInclusionChange('cleaning2x')} />
                <Checkbox label="Pool Maintenance 2x per week"   checked={data.inclusions.pool2x}      onChange={() => handleInclusionChange('pool2x')} />
                <Checkbox label="Internet"                        checked={data.inclusions.internet}    onChange={() => handleInclusionChange('internet')} />
                <Checkbox label="Laundry Linen & Towels 1x"      checked={data.inclusions.laundry}     onChange={() => handleInclusionChange('laundry')} />
                <Checkbox label="Banjar Fee"                      checked={data.inclusions.banjarFee}   onChange={() => handleInclusionChange('banjarFee')} />
                <Checkbox label="Rubbish Fee"                     checked={data.inclusions.rubbishFee}  onChange={() => handleInclusionChange('rubbishFee')} />
                <Checkbox label="Electricity"                     checked={data.inclusions.electricity} onChange={() => handleInclusionChange('electricity')} />
              </div>
              <div className="mt-4">
                <label className="block text-sm font-semibold text-slate-600 mb-1">Other Inclusions</label>
                <input
                  type="text"
                  value={data.otherInclusions}
                  onChange={(e) => handleInputChange('otherInclusions', e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-emerald-500 outline-none transition"
                  placeholder="e.g. Gardening, Water heater"
                />
              </div>
            </section>
          </div>

          {/* ── Right Column: Generate + Guide ── */}
          <div className="space-y-6">

            {/* Generate Card */}
            <div className="bg-emerald-500 text-emerald-50 p-6 rounded-xl shadow-lg sticky top-20">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                <FileDown className="w-5 h-5" /> Generate Contract
              </h3>

              {/* ── Google Drive Connection ── */}
              <div className="mb-4 bg-emerald-600/50 rounded-lg p-3">
                <p className="text-xs uppercase tracking-wider text-emerald-300 mb-2">
                  Template Source
                </p>
                {driveConnected ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-emerald-100">
                      <CloudUpload className="w-4 h-4 text-emerald-300 flex-shrink-0" />
                      <span className="font-medium">Lease Agreement Template</span>
                    </div>
                    <p className="text-xs text-emerald-300 truncate">
                      via Google Drive
                    </p>
                    <button
                      onClick={handleDisconnectDrive}
                      className="flex items-center gap-1 text-xs text-emerald-300 hover:text-red-300 transition mt-1"
                    >
                      <LogOut className="w-3 h-3" /> Disconnect
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <button
                      onClick={handleConnectDrive}
                      className="w-full py-2 bg-white text-emerald-800 hover:bg-emerald-50 font-semibold rounded-lg text-sm transition flex items-center justify-center gap-2"
                    >
                      <CloudUpload className="w-4 h-4" />
                      Connect Google Drive
                    </button>
                    <p className="text-xs text-emerald-300 text-center">
                      Uses the standard lease template automatically
                    </p>
                    <div className="border-t border-emerald-500/50 pt-2">
                      <p className="text-xs text-emerald-300 mb-1">Or upload manually:</p>
                      <input
                        type="file"
                        accept=".docx"
                        onChange={(e) => setLocalTemplateFile(e.target.files?.[0] || null)}
                        className="block w-full text-xs text-emerald-100
                          file:mr-2 file:py-1 file:px-3
                          file:rounded-full file:border-0
                          file:text-xs file:font-semibold
                          file:bg-emerald-700 file:text-emerald-100
                          hover:file:bg-emerald-600"
                      />
                      {localTemplateFile && (
                        <p className="text-xs text-emerald-200 mt-1 truncate">✓ {localTemplateFile.name}</p>
                      )}
                    </div>
                  </div>
                )}
                {driveStatus && (
                  <p className="text-xs text-emerald-200 mt-2 animate-pulse">{driveStatus}</p>
                )}
              </div>

              {/* ── Download Buttons ── */}
              <div className="space-y-2">
                {/* Download locally */}
                <button
                  onClick={handleDownload}
                  disabled={isGenerating || (!driveConnected && !localTemplateFile)}
                  className="w-full py-3 bg-emerald-900 hover:bg-emerald-800 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-bold rounded-lg shadow-md transition-all flex items-center justify-center gap-2"
                >
                  <FileDown className="w-4 h-4" />
                  {isGenerating ? 'Generating…' : 'Download Contract'}
                </button>

                {/* Save to Drive (owner/agent copy) */}
                {driveConnected && (
                  <button
                    onClick={handleSaveToDrive}
                    disabled={isGenerating}
                    className="w-full py-3 bg-blue-700 hover:bg-blue-600 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-bold rounded-lg shadow-md transition-all flex items-center justify-center gap-2"
                  >
                    <CloudUpload className="w-4 h-4" />
                    {isGenerating ? 'Saving…' : 'Save Copy to Drive'}
                  </button>
                )}
              </div>

              {/* Drive link after save */}
              {savedDriveLink && (
                <a
                  href={savedDriveLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 flex items-center gap-2 text-xs text-emerald-200 hover:text-white underline underline-offset-2 transition"
                >
                  <Link2 className="w-3 h-3" />
                  Open in Google Drive →
                </a>
              )}

              {/* Fixed: inline generate error instead of alert() */}
              {generateError && (
                <div className="mt-3 text-xs text-red-200 bg-red-900/40 rounded p-2 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>{generateError}</span>
                </div>
              )}

              <p className="text-xs text-emerald-400 mt-3">
                Template: Lease Agreement 3rd party · IDR currency
              </p>
            </div>

            {/* Template Guide */}
            <TemplateGuide />
          </div>
        </main>
      </div>
    </ErrorBoundary>
  );
};

export default App;
