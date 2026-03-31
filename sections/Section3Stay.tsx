import React from 'react';
import { Calendar } from 'lucide-react';
import { ContractData, HandleChange } from '../types';
import { ComputedData } from '../types';
import { SectionHeader } from '../components/SectionHeader';

const DURATION_PILLS = [
  { label: '1 Month',  months: 1,  days: 0 },
  { label: '2 Months', months: 2,  days: 0 },
  { label: '3 Months', months: 3,  days: 0 },
  { label: '6 Months', months: 6,  days: 0 },
  { label: '1 Year',   months: 12, days: 0 },
];

interface Props {
  data: ContractData;
  handleInputChange: HandleChange;
  computedData: ComputedData;
  activeDurationPill: string;
  setActiveDurationPill: (v: string) => void;
  customWeeks: string;
  setCustomWeeks: (v: string) => void;
  onDurationPill: (label: string, months: number, days: number) => void;
  onApplyCustomWeeks: (weeksStr: string) => void;
}

export const Section3Stay: React.FC<Props> = ({
  data, handleInputChange, computedData,
  activeDurationPill, setActiveDurationPill,
  customWeeks, setCustomWeeks,
  onDurationPill, onApplyCustomWeeks,
}) => (
  <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
    <SectionHeader num={3} icon={<Calendar className="w-4 h-4 text-emerald-600" />} title="Stay Details" />
    <div className="px-4 sm:px-6 py-5 space-y-4">

      {/* Check-in / Check-out — side by side */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1.5">
            Check-in <span className="text-red-400">*</span>
          </label>
          <input
            type="date"
            value={data.checkInDate}
            onChange={e => handleInputChange('checkInDate', e.target.value)}
            className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-400 outline-none transition"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1.5">
            Check-out <span className="text-red-400">*</span>
          </label>
          <input
            type="date"
            value={data.checkOutDate}
            onChange={e => handleInputChange('checkOutDate', e.target.value)}
            className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-400 outline-none transition"
          />
        </div>
      </div>

      {/* Duration — compact inline badge */}
      {computedData.numberOfNights > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1.5 bg-emerald-100 text-emerald-800 text-xs font-bold px-3 py-1.5 rounded-full border border-emerald-200">
            🌙 {computedData.numberOfNights} nights
          </span>
          {computedData.numberOfMonths >= 1 && (
            <span className="inline-flex items-center gap-1.5 bg-emerald-100 text-emerald-800 text-xs font-bold px-3 py-1.5 rounded-full border border-emerald-200">
              📅 {computedData.numberOfMonths} months
            </span>
          )}
        </div>
      )}

      {/* Quick Duration Pills */}
      <div>
        <p className="text-xs font-semibold text-slate-500 mb-2 flex items-center gap-1.5">
          <span>⚡</span> Quick Duration
          {!data.checkInDate && <span className="text-amber-500 font-normal ml-1">— set check-in first</span>}
        </p>
        <div className="flex flex-wrap gap-2">
          {DURATION_PILLS.map(({ label, months, days }) => (
            <button
              key={label}
              type="button"
              onClick={() => onDurationPill(label, months, days)}
              disabled={!data.checkInDate}
              className={`px-3 py-1.5 rounded-full text-xs font-bold border-2 transition active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed ${
                activeDurationPill === label
                  ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm'
                  : 'bg-white border-emerald-200 text-emerald-700 hover:border-emerald-500 hover:bg-emerald-50'
              }`}
            >
              {label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setActiveDurationPill(activeDurationPill === 'Other' ? '' : 'Other')}
            disabled={!data.checkInDate}
            className={`px-3 py-1.5 rounded-full text-xs font-bold border-2 transition active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed ${
              activeDurationPill === 'Other'
                ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm'
                : 'bg-white border-slate-200 text-slate-500 hover:border-emerald-300 hover:bg-emerald-50'
            }`}
          >
            Other…
          </button>
        </div>
        {activeDurationPill === 'Other' && (
          <div className="mt-2 flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">
            <span className="text-xs font-semibold text-emerald-700 flex-shrink-0">Weeks:</span>
            <input
              type="number" min={1} max={52} value={customWeeks}
              onChange={e => { setCustomWeeks(e.target.value); onApplyCustomWeeks(e.target.value); }}
              className="w-14 px-2 py-1 border-2 border-emerald-300 rounded-lg text-sm font-bold text-emerald-900 text-center outline-none focus:border-emerald-500 transition bg-white"
            />
            {data.checkOutDate && (
              <span className="text-xs text-emerald-600">
                → {new Date(data.checkOutDate + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
            )}
          </div>
        )}
      </div>

    </div>
  </section>
);
