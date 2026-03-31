import React from 'react';
import { ListTodo, Check } from 'lucide-react';
import { ContractData, HandleChange } from '../types';
import { SectionHeader } from '../components/SectionHeader';

const INCLUSIONS = [
  { key: 'cleaning2x' as const,  label: 'Cleaning 2x per week',         emoji: '🧹' },
  { key: 'pool2x' as const,      label: 'Pool Maintenance 2x per week', emoji: '🏊' },
  { key: 'internet' as const,    label: 'Internet / WiFi',               emoji: '📶' },
  { key: 'laundry' as const,     label: 'Laundry Linen & Towels 1x',    emoji: '👕' },
  { key: 'banjarFee' as const,   label: 'Banjar Fee',                    emoji: '🏘' },
  { key: 'rubbishFee' as const,  label: 'Rubbish Collection Fee',        emoji: '🗑' },
  { key: 'electricity' as const, label: 'Electricity',                   emoji: '⚡' },
];

interface Props {
  data: ContractData;
  handleInputChange: HandleChange;
  onInclusionChange: (key: keyof ContractData['inclusions']) => void;
}

export const Section5Inclusions: React.FC<Props> = ({ data, handleInputChange, onInclusionChange }) => (
  <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
    <SectionHeader num={6} icon={<ListTodo className="w-4 h-4 text-emerald-600" />} title="Inclusions" />
    <div className="px-4 sm:px-6 py-5 space-y-2.5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {INCLUSIONS.map(({ key, label, emoji }) => {
          const checked = data.inclusions[key];
          return (
            <button
              key={key}
              type="button"
              onClick={() => onInclusionChange(key)}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-left transition-all active:scale-95 ${
                checked
                  ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-emerald-200 hover:bg-emerald-50/40'
              }`}
            >
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
      {/* Other Inclusions — full-width, same pill style */}
      <div className="flex items-center gap-3 px-4 py-3 rounded-xl border-2 border-dashed border-slate-200 bg-white hover:border-emerald-300 transition-all">
        <span className="text-base flex-shrink-0">✏️</span>
        <input
          type="text"
          value={data.otherInclusions}
          onChange={e => handleInputChange('otherInclusions', e.target.value)}
          className="flex-1 text-sm font-medium bg-transparent outline-none placeholder-slate-400 text-slate-700"
          placeholder="Other inclusions — e.g. Gardening, Water heater, Daily breakfast…"
        />
      </div>
    </div>
  </section>
);
