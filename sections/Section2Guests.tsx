import React from 'react';
import { Users, Plus, X } from 'lucide-react';
import { ContractData, HandleChange, makeNewGuest } from '../types';
import { SectionHeader } from '../components/SectionHeader';
import { PassportUploader } from '../components/PassportUploader';

const MAX_GUESTS = 4;
const MIN_GUESTS = 1;

interface Props {
  data: ContractData;
  handleInputChange: HandleChange;
  onAddGuest: () => void;
  onRemoveGuest: (index: number) => void;
  onUpdateGuest: (index: number, field: keyof Omit<ReturnType<typeof makeNewGuest>, 'id'>, value: string) => void;
  onPassportScan: (index: number, name: string, passport: string, file?: File) => void;
}

export const Section2Guests: React.FC<Props> = ({
  data, onAddGuest, onRemoveGuest, onUpdateGuest, onPassportScan,
}) => (
  <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
    <SectionHeader
      num={2}
      icon={<Users className="w-4 h-4 text-emerald-600" />}
      title={`Guests (${data.guests.length}/${MAX_GUESTS})`}
      right={data.guests.length < MAX_GUESTS ? (
        <button
          onClick={onAddGuest}
          className="flex items-center gap-1.5 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition px-3 py-1.5 rounded-xl active:scale-95"
        >
          <Plus className="w-3.5 h-3.5" /> Add Guest
        </button>
      ) : undefined}
    />
    <div className="px-4 sm:px-6 py-5 space-y-5">
      {data.guests.map((guest, index) => (
        <div key={guest.id} className="border border-emerald-100 rounded-2xl overflow-hidden">
          <div className="px-4 py-2.5 bg-emerald-50 flex items-center justify-between border-b border-emerald-100">
            <span className="text-xs font-bold text-emerald-700 uppercase tracking-widest">Guest {index + 1}</span>
            {index > 0 && (
              <button
                onClick={() => onRemoveGuest(index)}
                className="text-slate-400 hover:text-red-500 transition p-0.5 rounded-lg hover:bg-red-50"
              >
                <X size={14} />
              </button>
            )}
          </div>
          <div className="p-4 space-y-3">
            <PassportUploader
              id={`passport-upload-${index}`}
              onScanComplete={(name, passport, file) => onPassportScan(index, name, passport, file)}
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {([
                { field: 'name' as const,          label: 'Full Name',        req: true,  type: 'text', ph: 'As on passport' },
                { field: 'passportNumber' as const, label: 'Passport No.',     req: true,  type: 'text', ph: 'e.g. A1234567' },
                { field: 'nationality' as const,    label: 'Nationality',      req: true,  type: 'text', ph: 'e.g. Australian' },
                { field: 'phone' as const,          label: 'Phone / WhatsApp', req: false, type: 'text', ph: '+62 …' },
                { field: 'birthplace' as const,     label: 'Place of Birth',   req: false, type: 'text', ph: 'e.g. London' },
                { field: 'birthday' as const,       label: 'Date of Birth',    req: false, type: 'date', ph: '' },
              ] as const).map(({ field, label, req, type, ph }) => (
                <div key={field}>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    {label} {req && <span className="text-red-400">*</span>}
                  </label>
                  <input
                    type={type}
                    value={(guest as unknown as Record<string, string>)[field] || ''}
                    onChange={e => onUpdateGuest(index, field, e.target.value)}
                    placeholder={ph}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-400 outline-none transition"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  </section>
);
