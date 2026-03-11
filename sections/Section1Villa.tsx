import React from 'react';
import { Home, ChevronDown } from 'lucide-react';
import { ContractData, HandleChange } from '../types';
import { VILLA_TEMPLATES } from '../data/villaTemplates';
import { VillaRow } from '../services/googleDriveService';
import { SectionHeader } from '../components/SectionHeader';

interface Props {
  data: ContractData;
  handleInputChange: HandleChange;
  onVillaTemplateChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  sheetVillas?: VillaRow[];
}

export const Section1Villa: React.FC<Props> = ({ data, handleInputChange, onVillaTemplateChange, sheetVillas = [] }) => (
  <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
    <SectionHeader
      num={1}
      icon={<Home className="w-4 h-4 text-emerald-600" />}
      title="Villa Details"
      right={
        <div className="relative">
          <select
            onChange={onVillaTemplateChange}
            defaultValue=""
            className="appearance-none pl-3 pr-8 py-2 text-sm border border-emerald-200 bg-emerald-50 text-emerald-800 font-semibold rounded-xl focus:ring-2 focus:ring-emerald-400 outline-none cursor-pointer transition"
          >
            <option value="" disabled>
              {sheetVillas.length > 0 ? `Load Villa… (${sheetVillas.length} from Sheets)` : 'Load Villa Template…'}
            </option>
            <option value="custom">✏ Custom / New Villa</option>
            {sheetVillas.length > 0 && (
              <optgroup label="📋 Live from Google Sheets">
                {sheetVillas.map(v => (
                  <option key={v.name} value={v.name}>{v.name}</option>
                ))}
              </optgroup>
            )}
            <optgroup label={sheetVillas.length > 0 ? 'Local Fallback Templates' : 'Saved Villas'}>
              {VILLA_TEMPLATES.map(v => (
                <option key={v.name} value={v.name}>{v.name}</option>
              ))}
            </optgroup>
          </select>
          <ChevronDown className="w-4 h-4 text-emerald-600 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
      }
    />
    <div className="px-4 sm:px-6 py-5 space-y-4">
      {/* Row 1: Villa Name | Bedrooms | Property Code */}
      <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
        <div className="sm:col-span-3">
          <label className="block text-sm font-semibold text-slate-700 mb-1.5">
            Villa Name <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={data.villaName}
            onChange={e => handleInputChange('villaName', e.target.value)}
            className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-400 outline-none transition"
            placeholder="e.g. Villa Sentosa"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1.5">
            Bedrooms <span className="text-red-400">*</span>
          </label>
          <input
            type="number"
            min={1}
            value={data.bedrooms}
            onChange={e => handleInputChange('bedrooms', parseInt(e.target.value) || 1)}
            className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-400 outline-none transition text-center font-bold"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1.5">Code</label>
          <input
            type="text"
            value={data.propertyCode}
            onChange={e => handleInputChange('propertyCode', e.target.value)}
            className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-400 outline-none transition"
            placeholder="VS-001"
          />
        </div>
      </div>
      {/* Row 2: Villa Address */}
      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-1.5">
          Villa Address <span className="text-red-400">*</span>
        </label>
        <input
          type="text"
          value={data.villaAddress}
          onChange={e => handleInputChange('villaAddress', e.target.value)}
          className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-400 outline-none transition"
          placeholder="e.g. Jalan Raya Canggu No. 12, Bali"
        />
      </div>
    </div>
  </section>
);
