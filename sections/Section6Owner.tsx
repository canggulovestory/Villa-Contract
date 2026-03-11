import React from 'react';
import { Building2, ChevronDown, FolderOpen, Save, X } from 'lucide-react';
import { ContractData, HandleChange, LessorData } from '../types';
import { Toggle } from '../components/Toggle';

interface Props {
  data: ContractData;
  handleInputChange: HandleChange;
  onLessorChange: (field: keyof LessorData, value: string | boolean) => void;
  savedOwners: LessorData[];
  onLoadOwner: (c: LessorData) => void;
  onSaveOwner: () => void;
  onDeleteOwner: (name: string) => void;
}

export const Section6Owner: React.FC<Props> = ({
  data, onLessorChange, savedOwners, onLoadOwner, onSaveOwner, onDeleteOwner,
}) => (
  <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
    {/* Amber header */}
    <div className="px-4 sm:px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-amber-50/80 to-white flex items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <span className="w-7 h-7 bg-amber-500 text-white rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">7</span>
        <div>
          <h2 className="font-bold text-slate-800 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-amber-600" /> Lessor / Property Owner
          </h2>
          <p className="text-xs text-amber-600 mt-0.5">
            {data.lessor.enabled
              ? 'Owner data enabled — will appear in contract'
              : 'Owner data available for this deal? Enable to enter details.'}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3 flex-shrink-0">
        <Toggle checked={data.lessor.enabled} onChange={() => onLessorChange('enabled', !data.lessor.enabled)} />
        <ChevronDown className={`w-4 h-4 text-amber-400 transition-transform ${data.lessor.enabled ? 'rotate-180' : ''}`} />
      </div>
    </div>

    {data.lessor.enabled && (
      <div className="px-4 sm:px-6 py-5 space-y-4">
        {/* Saved contacts */}
        {savedOwners.length > 0 && (
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-1.5">
              <FolderOpen className="w-3.5 h-3.5" /> Load from Saved
            </p>
            <div className="flex flex-wrap gap-2 mb-3">
              {savedOwners.map(o => (
                <div key={o.name} className="flex items-center gap-1 bg-amber-50 border border-amber-200 rounded-full px-3 py-1">
                  <button onClick={() => onLoadOwner(o)} className="text-xs font-semibold text-amber-800 hover:text-amber-600">
                    {o.name}
                  </button>
                  <button onClick={() => onDeleteOwner(o.name)} className="text-amber-400 hover:text-red-500 transition ml-1">
                    <X size={11} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {([
            { field: 'name' as const,       label: 'Full Name',          req: true,  ph: 'Owner full name' },
            { field: 'idNumber' as const,    label: 'KTP / Passport No.', req: false, ph: 'ID number' },
            { field: 'nationality' as const, label: 'Nationality',        req: false, ph: 'e.g. Indonesian' },
            { field: 'phone' as const,       label: 'Phone',              req: false, ph: '+62 …' },
            { field: 'email' as const,       label: 'Email',              req: false, ph: 'owner@email.com' },
          ] as const).map(({ field, label, req, ph }) => (
            <div key={field}>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                {label} {req && <span className="text-red-400">*</span>}
              </label>
              <input
                type="text"
                value={data.lessor[field] as string}
                onChange={e => onLessorChange(field, e.target.value)}
                placeholder={ph}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-amber-400 outline-none transition"
              />
            </div>
          ))}
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-600 mb-1">Address</label>
            <input
              type="text"
              value={data.lessor.address}
              onChange={e => onLessorChange('address', e.target.value)}
              placeholder="Owner's address"
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-amber-400 outline-none transition"
            />
          </div>
        </div>

        {/* Save button */}
        {data.lessor.name.trim() && (
          <button
            onClick={onSaveOwner}
            className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-xl transition active:scale-95"
          >
            <Save className="w-3.5 h-3.5" /> Save to Contacts
          </button>
        )}
      </div>
    )}
  </section>
);
