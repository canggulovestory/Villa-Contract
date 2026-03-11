import React from 'react';
import { Handshake, ChevronDown, FolderOpen, Save, Check, X } from 'lucide-react';
import { ContractData, HandleChange, AgentData, AgentPlatforms, PartnershipType } from '../types';
import { Toggle } from '../components/Toggle';
import { PassportUploader } from '../components/PassportUploader';

interface Props {
  data: ContractData;
  handleInputChange: HandleChange;
  onAgentChange: (field: keyof AgentData, value: string | boolean) => void;
  onAgentPlatformChange: (platform: keyof AgentPlatforms) => void;
  savedAgents: AgentData[];
  onLoadAgent: (c: AgentData) => void;
  onSaveAgent: () => void;
  onDeleteAgent: (key: string) => void;
  agentIdFile: File | null;
  onAgentIdFile: (file: File | null) => void;
}

export const Section7Agent: React.FC<Props> = ({
  data, onAgentChange, onAgentPlatformChange,
  savedAgents, onLoadAgent, onSaveAgent, onDeleteAgent,
  agentIdFile, onAgentIdFile,
}) => (
  <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
    {/* Purple header */}
    <div className="px-4 sm:px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-purple-50/80 to-white flex items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <span className="w-7 h-7 bg-purple-600 text-white rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">8</span>
        <div>
          <h2 className="font-bold text-slate-800 flex items-center gap-2">
            <Handshake className="w-4 h-4 text-purple-600" /> Agent / Partner
          </h2>
          <p className="text-xs text-purple-600 mt-0.5">
            {data.agent.enabled
              ? 'Agent data enabled — will appear in contract'
              : 'This deal came through an agent? Enable to register them.'}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3 flex-shrink-0">
        <Toggle checked={data.agent.enabled} onChange={() => onAgentChange('enabled', !data.agent.enabled)} />
        <ChevronDown className={`w-4 h-4 text-purple-400 transition-transform ${data.agent.enabled ? 'rotate-180' : ''}`} />
      </div>
    </div>

    {data.agent.enabled && (
      <div className="px-4 sm:px-6 py-5 space-y-6">

        {/* 📂 Saved Agents */}
        {savedAgents.length > 0 && (
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-1.5">
              <FolderOpen className="w-3.5 h-3.5" /> Load from Saved
            </p>
            <div className="flex flex-wrap gap-2">
              {savedAgents.map(a => {
                const key = (a.company || a.fullName || a.picName).trim();
                return (
                  <div key={key} className="flex items-center gap-1 bg-purple-50 border border-purple-200 rounded-full px-3 py-1">
                    <button onClick={() => onLoadAgent(a)} className="text-xs font-semibold text-purple-800 hover:text-purple-600">
                      {key}
                    </button>
                    <button onClick={() => onDeleteAgent(key)} className="text-purple-400 hover:text-red-500 transition ml-1">
                      <X size={11} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 📷 ID / Business Card OCR upload */}
        <div>
          <p className="text-xs font-bold text-purple-700 uppercase tracking-widest mb-2">Scan ID / Business Card</p>
          <PassportUploader
            id="agent-id-upload"
            onScanComplete={(name, idNo, file) => {
              if (name) onAgentChange('fullName', name);
              if (idNo) onAgentChange('idNumber', idNo);
              if (file) onAgentIdFile(file);
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
              <button
                key={type}
                type="button"
                onClick={() => onAgentChange('partnershipType', type)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold border-2 transition active:scale-95 ${
                  data.agent.partnershipType === type
                    ? 'bg-purple-600 border-purple-600 text-white shadow-sm'
                    : 'bg-white border-purple-200 text-purple-700 hover:border-purple-500 hover:bg-purple-50'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
          {data.agent.partnershipType === 'Others' && (
            <input
              type="text"
              value={data.agent.partnershipTypeOther}
              onChange={e => onAgentChange('partnershipTypeOther', e.target.value)}
              placeholder="Describe partnership type…"
              className="mt-2 w-full px-3 py-2 border border-purple-300 rounded-xl text-sm focus:ring-2 focus:ring-purple-400 outline-none transition"
            />
          )}
        </div>

        {/* B. Company Information */}
        <div>
          <p className="text-xs font-bold text-purple-700 uppercase tracking-widest mb-3">B. Company Information</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {([
              { field: 'company' as const,     label: 'Company Name',        ph: 'e.g. Bali Travel Co' },
              { field: 'officePhone' as const,  label: 'Office Phone Number', ph: '+62 …' },
              { field: 'picName' as const,      label: 'Agent PIC',           ph: 'Person in Charge' },
            ] as const).map(({ field, label, ph }) => (
              <div key={field}>
                <label className="block text-xs font-semibold text-slate-600 mb-1">{label}</label>
                <input
                  type="text"
                  value={data.agent[field] as string}
                  onChange={e => onAgentChange(field, e.target.value)}
                  placeholder={ph}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-purple-400 outline-none transition"
                />
              </div>
            ))}
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-600 mb-1">Office Address</label>
              <input
                type="text"
                value={data.agent.officeAddress}
                onChange={e => onAgentChange('officeAddress', e.target.value)}
                placeholder="Office address"
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-purple-400 outline-none transition"
              />
            </div>
          </div>
        </div>

        {/* C. PIC Personal Data */}
        <div>
          <p className="text-xs font-bold text-purple-700 uppercase tracking-widest mb-3">C. PIC / Agent Personal Data</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-600 mb-1">Full Name (as per ID)</label>
              <input
                type="text"
                value={data.agent.fullName}
                onChange={e => onAgentChange('fullName', e.target.value)}
                placeholder="As written on ID / Passport"
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-purple-400 outline-none transition"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Gender</label>
              <select
                value={data.agent.gender}
                onChange={e => onAgentChange('gender', e.target.value as 'Male' | 'Female' | '')}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-purple-400 outline-none transition bg-white"
              >
                <option value="">Select…</option>
                <option>Male</option>
                <option>Female</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Marital Status</label>
              <select
                value={data.agent.maritalStatus}
                onChange={e => onAgentChange('maritalStatus', e.target.value as AgentData['maritalStatus'])}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-purple-400 outline-none transition bg-white"
              >
                <option value="">Select…</option>
                <option>Single</option>
                <option>Married</option>
                <option>Divorced</option>
                <option>Widowed</option>
              </select>
            </div>
            {([
              { field: 'birthplace' as const,  label: 'Place of Birth',               type: 'text',  ph: 'e.g. Jakarta' },
              { field: 'birthday' as const,    label: 'Date of Birth',                type: 'date',  ph: '' },
              { field: 'nationality' as const, label: 'Nationality',                  type: 'text',  ph: 'e.g. Indonesian' },
              { field: 'idNumber' as const,    label: 'ID / Passport / Biz Card No.', type: 'text',  ph: '' },
              { field: 'phone' as const,       label: 'Active Phone / WhatsApp',      type: 'text',  ph: '+62 …' },
              { field: 'email' as const,       label: 'Email Address',                type: 'email', ph: 'agent@email.com' },
            ] as const).map(({ field, label, type, ph }) => (
              <div key={field}>
                <label className="block text-xs font-semibold text-slate-600 mb-1">{label}</label>
                <input
                  type={type}
                  value={data.agent[field] as string}
                  onChange={e => onAgentChange(field, e.target.value)}
                  placeholder={ph}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-purple-400 outline-none transition"
                />
              </div>
            ))}
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-600 mb-1">Address (as per ID)</label>
              <input
                type="text"
                value={data.agent.idAddress}
                onChange={e => onAgentChange('idAddress', e.target.value)}
                placeholder="Address as written on ID"
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-purple-400 outline-none transition"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-600 mb-1">Current Address (if different)</label>
              <input
                type="text"
                value={data.agent.currentAddress}
                onChange={e => onAgentChange('currentAddress', e.target.value)}
                placeholder="Leave blank if same as ID address"
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-purple-400 outline-none transition"
              />
            </div>
          </div>
        </div>

        {/* D. Sales Platforms */}
        <div>
          <p className="text-xs font-bold text-purple-700 uppercase tracking-widest mb-3">D. Sales Platforms</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {([
              { key: 'facebook'        as const, label: '📘 Facebook'         },
              { key: 'instagram'       as const, label: '📸 Instagram'        },
              { key: 'tiktok'          as const, label: '🎵 TikTok'           },
              { key: 'website'         as const, label: '🌐 Website'          },
              { key: 'bookingCom'      as const, label: '🏨 Booking.com'      },
              { key: 'agoda'           as const, label: '🟠 Agoda'            },
              { key: 'traveloka'       as const, label: '✈️ Traveloka'        },
              { key: 'tiketCom'        as const, label: '🎫 Tiket.com'        },
              { key: 'personalNetwork' as const, label: '🤝 Personal Network' },
              { key: 'others'          as const, label: '➕ Others'           },
            ] as { key: keyof AgentPlatforms; label: string }[]).map(({ key, label }) => {
              const on = data.agent.platforms[key];
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => onAgentPlatformChange(key)}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border-2 text-left text-xs font-semibold transition-all active:scale-95 ${
                    on
                      ? 'border-purple-500 bg-purple-50 text-purple-800'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-purple-200 hover:bg-purple-50/40'
                  }`}
                >
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
            {([
              { field: 'bankName' as const,          label: 'Bank Name',           ph: 'e.g. BCA' },
              { field: 'bankAccountHolder' as const,  label: 'Account Holder Name', ph: 'Full name' },
              { field: 'bankAccountNumber' as const,  label: 'Account Number',      ph: '1234567890' },
            ] as const).map(({ field, label, ph }) => (
              <div key={field}>
                <label className="block text-xs font-semibold text-purple-700 mb-1">{label}</label>
                <input
                  type="text"
                  value={data.agent[field] as string}
                  onChange={e => onAgentChange(field, e.target.value)}
                  placeholder={ph}
                  className="w-full px-3 py-2 border border-purple-300 bg-white rounded-xl text-sm focus:ring-2 focus:ring-purple-400 outline-none transition"
                />
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
          <button
            onClick={onSaveAgent}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-purple-600 hover:bg-purple-700 text-white text-sm font-bold rounded-xl transition active:scale-95"
          >
            <Save className="w-4 h-4" /> Save Agent to Contacts
          </button>
        )}

      </div>
    )}
  </section>
);
