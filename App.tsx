import React from 'react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { TemplateGuide } from './components/TemplateGuide';
import { VILLA_TEMPLATES } from './data/villaTemplates';
import { generateDocument, downloadContractLocally } from './services/docService';
import {
  initGoogleAuth,
  signInToGoogle,
  signOutFromGoogle,
  isSignedIn,
  fetchTemplateFromDrive,
  saveContractToDrive,
} from './services/googleDriveService';
import {
  ContractData,
  ComputedData,
  Guest,
  makeNewGuest,
  INITIAL_DATA,
} from './types';
import { formatIDR } from './utils/format';
import { FileText, CloudUpload, Link2, LogOut, Download, Plus, Trash2 } from 'lucide-react';

const SECURITY_DEPOSIT_RATE = 0.10;

const diffDays = (a: string, b: string): number => {
  if (!a || !b) return 0;
  return Math.max(0, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000));
};

const diffMonths = (a: string, b: string): number => {
  if (!a || !b) return 0;
  const d1 = new Date(a);
  const d2 = new Date(b);
  return Math.max(0, (d2.getFullYear() - d1.getFullYear()) * 12 + d2.getMonth() - d1.getMonth());
};

const INCLUSION_LABELS: Record<string, string> = {
  cleaning2x: 'Cleaning 2x/week',
  pool2x: 'Pool cleaning 2x/week',
  internet: 'Internet/WiFi',
  banjarFee: 'Banjar fee',
  rubbishFee: 'Rubbish collection fee',
  laundry: 'Laundry service',
  electricity: 'Electricity',
};

function App() {
  const [selectedVillaName, setSelectedVillaName] = React.useState<string | null>(null);
  const [guests, setGuests] = React.useState<Guest[]>([makeNewGuest(1)]);
  const [checkInDate, setCheckInDate] = React.useState('');
  const [checkOutDate, setCheckOutDate] = React.useState('');
  const [paymentDueDate, setPaymentDueDate] = React.useState('');
  const [totalPrice, setTotalPrice] = React.useState(0);
  const [monthlyPrice, setMonthlyPrice] = React.useState(0);
  const [inclusions, setInclusions] = React.useState(INITIAL_DATA.inclusions);
  const [otherInclusions, setOtherInclusions] = React.useState('');
  const [driveConnected, setDriveConnected] = React.useState(false);
  const [driveStatus, setDriveStatus] = React.useState('');
  const [savedDriveLink, setSavedDriveLink] = React.useState('');
  const [localTemplateFile, setLocalTemplateFile] = React.useState<File | null>(null);
  const [generating, setGenerating] = React.useState(false);
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    initGoogleAuth().catch(() => {
      console.warn('Google Identity Services not available yet');
    });
  }, []);

  const selectedVillaData = VILLA_TEMPLATES.find((v) => v.name === selectedVillaName) || null;
  const securityDeposit = Math.round(totalPrice * SECURITY_DEPOSIT_RATE);
  const numberOfNights = diffDays(checkInDate, checkOutDate);
  const numberOfMonths = diffMonths(checkInDate, checkOutDate);

  const addGuest = () => setGuests((prev) => [...prev, makeNewGuest(prev.length + 1)]);
  const removeGuest = (id: string) =>
    setGuests((prev) => (prev.length > 1 ? prev.filter((g) => g.id !== id) : prev));
  const updateGuest = (id: string, field: keyof Guest, value: string) =>
    setGuests((prev) => prev.map((g) => (g.id === id ? { ...g, [field]: value } : g)));

  const toggleInclusion = (key: string) =>
    setInclusions((prev) => ({ ...prev, [key]: !prev[key as keyof typeof prev] }));

  const handleConnectDrive = async () => {
    try {
      setDriveStatus('Connecting...');
      await signInToGoogle();
      setDriveConnected(true);
      setDriveStatus('Connected to Google Drive');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Connection failed';
      setDriveStatus(msg);
    }
  };

  const handleDisconnectDrive = () => {
    signOutFromGoogle();
    setDriveConnected(false);
    setDriveStatus('Disconnected');
    setSavedDriveLink('');
  };

  const resolveTemplate = async (): Promise<File | ArrayBuffer> => {
    if (driveConnected && isSignedIn()) {
      setDriveStatus('Fetching template from Drive...');
      const buf = await fetchTemplateFromDrive();
      setDriveStatus('Template loaded from Drive');
      return buf;
    }
    if (localTemplateFile) return localTemplateFile;
    throw new Error('No template available. Connect Google Drive or upload a local .docx template.');
  };

  const buildInclusionsList = (): string => {
    const active = Object.entries(inclusions)
      .filter(([, v]) => v)
      .map(([k]) => INCLUSION_LABELS[k] || k);
    if (otherInclusions) active.push(otherInclusions);
    return active.join(', ') || 'None';
  };

  const buildContractData = (): { data: ContractData; computed: ComputedData } => {
    if (!selectedVillaData) throw new Error('Please select a villa first.');
    if (!checkInDate || !checkOutDate) throw new Error('Please set check-in and check-out dates.');

    const data: ContractData = {
      villaName: selectedVillaData.name,
      villaAddress: selectedVillaData.address,
      bedrooms: selectedVillaData.bedrooms,
      guests,
      checkInDate,
      checkOutDate,
      monthlyPrice,
      totalPrice,
      paymentDueDate,
      inclusions,
      otherInclusions,
    };

    const computed: ComputedData = {
      numberOfNights,
      numberOfMonths,
      securityDeposit,
      inclusionsList: buildInclusionsList(),
    };

    return { data, computed };
  };

  const handleDownload = async () => {
    try {
      setGenerating(true);
      setError('');
      const template = await resolveTemplate();
      const { data, computed } = buildContractData();
      const result = await generateDocument(template, data, computed);
      downloadContractLocally(result.buffer, result.filename);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to generate contract');
    } finally {
      setGenerating(false);
    }
  };

  const handleSaveToDrive = async () => {
    try {
      setGenerating(true);
      setError('');
      setSavedDriveLink('');
      const template = await resolveTemplate();
      const { data, computed } = buildContractData();
      const result = await generateDocument(template, data, computed);
      setDriveStatus('Uploading to Drive...');
      const link = await saveContractToDrive(result.buffer, result.filename);
      setSavedDriveLink(link);
      setDriveStatus('Saved to Google Drive!');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save to Drive');
      setDriveStatus('Save failed');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-emerald-50">
        <header className="bg-white shadow-sm border-b border-emerald-100">
          <div className="max-w-7xl mx-auto px-4 py-6">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-3">
                <FileText className="w-8 h-8 text-emerald-600" />
                <div>
                  <h1 className="text-3xl font-bold text-emerald-900">Villa Contract Manager</h1>
                  <p className="text-slate-600 mt-1">Create and manage villa rental contracts</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {driveConnected ? (
                  <>
                    <span className="text-sm text-emerald-600 flex items-center gap-1">
                      <CloudUpload className="w-4 h-4" /> Drive Connected
                    </span>
                    <button onClick={handleDisconnectDrive}
                      className="flex items-center gap-1 px-3 py-1.5 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50">
                      <LogOut className="w-4 h-4" /> Disconnect
                    </button>
                  </>
                ) : (
                  <button onClick={handleConnectDrive}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                    <CloudUpload className="w-4 h-4" /> Connect Google Drive
                  </button>
                )}
              </div>
            </div>
            {driveStatus && <p className="text-sm text-slate-500 mt-2">{driveStatus}</p>}
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white p-6 rounded-xl shadow-sm border border-emerald-100">
                <h2 className="text-2xl font-bold text-emerald-900 mb-4">Select Villa</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {VILLA_TEMPLATES.map((villa) => (
                    <div key={villa.name} onClick={() => setSelectedVillaName(villa.name)}
                      className={'p-4 rounded-lg border-2 cursor-pointer transition-all ' +
                        (selectedVillaName === villa.name
                          ? 'border-emerald-600 bg-emerald-50'
                          : 'border-emerald-200 hover:border-emerald-400')}>
                      <h3 className="font-bold text-emerald-900">{villa.name}</h3>
                      <p className="text-sm text-slate-600">{villa.address}</p>
                      <p className="text-sm text-slate-500 mt-2">{villa.bedrooms} bedrooms</p>
                    </div>
                  ))}
                </div>
              </div>

              {selectedVillaData && (
                <div className="bg-white p-6 rounded-xl shadow-sm border border-emerald-100 space-y-6">
                  <h2 className="text-2xl font-bold text-emerald-900">
                    Contract Details - {selectedVillaData.name}
                  </h2>

                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-lg font-semibold text-emerald-800">Guests</h3>
                      <button onClick={addGuest}
                        className="flex items-center gap-1 px-3 py-1.5 text-sm bg-emerald-100 text-emerald-700 rounded-lg hover:bg-emerald-200">
                        <Plus className="w-4 h-4" /> Add Guest
                      </button>
                    </div>
                    {guests.map((guest, idx) => (
                      <div key={guest.id} className="border border-slate-200 rounded-lg p-4 mb-3">
                        <div className="flex justify-between items-center mb-2">
                          <span className="font-medium text-slate-700">Guest {idx + 1}</span>
                          {guests.length > 1 && (
                            <button onClick={() => removeGuest(guest.id)} className="text-red-400 hover:text-red-600">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <input placeholder="Full Name" value={guest.name}
                            onChange={(e) => updateGuest(guest.id, 'name', e.target.value)}
                            className="border border-slate-300 rounded-lg px-3 py-2 text-sm" />
                          <input placeholder="Passport Number" value={guest.passportNumber}
                            onChange={(e) => updateGuest(guest.id, 'passportNumber', e.target.value)}
                            className="border border-slate-300 rounded-lg px-3 py-2 text-sm" />
                          <input placeholder="Nationality" value={guest.nationality}
                            onChange={(e) => updateGuest(guest.id, 'nationality', e.target.value)}
                            className="border border-slate-300 rounded-lg px-3 py-2 text-sm" />
                          <input placeholder="Phone" value={guest.phone}
                            onChange={(e) => updateGuest(guest.id, 'phone', e.target.value)}
                            className="border border-slate-300 rounded-lg px-3 py-2 text-sm" />
                          <input type="date" value={guest.birthday || ''}
                            onChange={(e) => updateGuest(guest.id, 'birthday', e.target.value)}
                            className="border border-slate-300 rounded-lg px-3 py-2 text-sm" />
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Check-in</label>
                      <input type="date" value={checkInDate}
                        onChange={(e) => setCheckInDate(e.target.value)}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Check-out</label>
                      <input type="date" value={checkOutDate}
                        onChange={(e) => setCheckOutDate(e.target.value)}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Payment Due</label>
                      <input type="date" value={paymentDueDate}
                        onChange={(e) => setPaymentDueDate(e.target.value)}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
                    </div>
                  </div>

                  {numberOfNights > 0 && (
                    <p className="text-sm text-slate-600">{numberOfNights} nights / ~{numberOfMonths} months</p>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Monthly Price (IDR)</label>
                      <input type="number" value={monthlyPrice || ''}
                        onChange={(e) => setMonthlyPrice(Number(e.target.value))}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Total Price (IDR)</label>
                      <input type="number" value={totalPrice || ''}
                        onChange={(e) => setTotalPrice(Number(e.target.value))}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
                    </div>
                  </div>

                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                    <p className="text-sm text-amber-800">
                      <strong>Security Deposit (10%):</strong> {formatIDR(securityDeposit)}
                    </p>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold text-emerald-800 mb-3">Inclusions</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {Object.entries(INCLUSION_LABELS).map(([key, label]) => (
                        <label key={key} className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                          <input type="checkbox"
                            checked={inclusions[key as keyof typeof inclusions]}
                            onChange={() => toggleInclusion(key)}
                            className="rounded border-slate-300" />
                          {label}
                        </label>
                      ))}
                    </div>
                    <input placeholder="Other inclusions..." value={otherInclusions}
                      onChange={(e) => setOtherInclusions(e.target.value)}
                      className="mt-3 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
                  </div>

                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                    <h4 className="text-sm font-medium text-slate-700 mb-2">Template Source</h4>
                    {driveConnected ? (
                      <p className="text-sm text-emerald-600 flex items-center gap-1">
                        <CloudUpload className="w-4 h-4" />
                        Using template from Google Drive (Lease Agreement 3rd party)
                      </p>
                    ) : (
                      <div>
                        <p className="text-sm text-slate-500 mb-2">
                          Upload a local .docx template, or connect Google Drive above
                        </p>
                        <input type="file" accept=".docx"
                          onChange={(e) => setLocalTemplateFile(e.target.files?.[0] || null)}
                          className="text-sm" />
                      </div>
                    )}
                  </div>

                  {error && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                      <p className="text-sm text-red-700">{error}</p>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-3">
                    <button onClick={handleDownload} disabled={generating}
                      className="flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors">
                      <Download className="w-5 h-5" />
                      {generating ? 'Generating...' : 'Download Contract'}
                    </button>
                    {driveConnected && (
                      <button onClick={handleSaveToDrive} disabled={generating}
                        className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
                        <CloudUpload className="w-5 h-5" />
                        {generating ? 'Saving...' : 'Save Copy to Drive'}
                      </button>
                    )}
                  </div>

                  {savedDriveLink && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center gap-2">
                      <Link2 className="w-5 h-5 text-blue-600" />
                      <a href={savedDriveLink} target="_blank" rel="noopener noreferrer"
                        className="text-blue-600 underline text-sm">
                        Open saved contract in Google Drive
                      </a>
                    </div>
                  )}
                </div>
              )}
            </div>

            <aside className="lg:col-span-1">
              <TemplateGuide />
            </aside>
          </div>
        </main>

        <footer className="bg-white border-t border-emerald-100 mt-12">
          <div className="max-w-7xl mx-auto px-4 py-6 text-center text-slate-600">
            <p>Villa Contract Manager v2.5 - Built with React and TypeScript</p>
          </div>
        </footer>
      </div>
    </ErrorBoundary>
  );
}

export default App;
