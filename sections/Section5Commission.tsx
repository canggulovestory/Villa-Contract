import React from 'react';
import { ContractData, HandleChange, CommissionType } from '../types';
import { SectionHeader } from '../components/SectionHeader';
import { formatCurrencyDisplay, CURRENCY_SYMBOLS } from '../utils/format';
import { DollarSign } from 'lucide-react';

interface Props {
  data: ContractData;
  handleInputChange: HandleChange;
}

export const Section5Commission: React.FC<Props> = ({ data, handleInputChange }) => {
  const currencySymbol = CURRENCY_SYMBOLS[data.paymentCurrency] ?? 'Rp';
  const fmt = (n: number) => formatCurrencyDisplay(n, data.paymentCurrency);

  return (
    <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      <SectionHeader
        num={5}
        icon={<DollarSign className="w-4 h-4 text-amber-500" />}
        title="Commission / Agent Fee"
        right={
          <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full border border-amber-200 font-semibold">
            Owner copy only
          </span>
        }
      />
      <div className="px-4 sm:px-6 py-5 space-y-4">

        {/* Commission Source */}
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1.5">Commission Source</label>
          <div className="grid grid-cols-2 gap-2">
            {([
              { value: 'from_owner',  label: '🏠 From Owner',       desc: 'Owner pays us directly' },
              { value: 'split_agent', label: '🤝 Split with Agent', desc: "Our share of agent's fee" },
            ] as { value: 'from_owner' | 'split_agent'; label: string; desc: string }[]).map(opt => (
              <button
                key={opt.value}
                onClick={() => handleInputChange('commissionSource', opt.value)}
                className={`py-2.5 px-3 rounded-xl text-left border-2 transition ${
                  data.commissionSource === opt.value
                    ? 'bg-amber-500 border-amber-500 text-white'
                    : 'bg-white border-slate-200 text-slate-600 hover:border-amber-300'
                }`}
              >
                <p className="text-xs font-bold">{opt.label}</p>
                <p className={`text-xs mt-0.5 ${data.commissionSource === opt.value ? 'text-amber-100' : 'text-slate-400'}`}>
                  {opt.desc}
                </p>
              </button>
            ))}
          </div>
        </div>

        {/* Commission Basis */}
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1.5">Commission Basis</label>
          <div className="grid grid-cols-3 gap-2">
            {([
              { value: 'percent_total',   label: '% of Total' },
              { value: 'percent_monthly', label: '% of Monthly' },
              { value: 'fixed',           label: 'Fixed Amount' },
            ] as { value: CommissionType; label: string }[]).map(opt => (
              <button
                key={opt.value}
                onClick={() => handleInputChange('commissionType', opt.value)}
                className={`py-2 text-xs font-semibold rounded-xl border-2 transition ${
                  data.commissionType === opt.value
                    ? 'bg-amber-500 border-amber-500 text-white'
                    : 'bg-white border-slate-200 text-slate-600 hover:border-amber-300'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* FROM OWNER fields */}
        {data.commissionSource === 'from_owner' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {data.commissionType !== 'fixed' && (
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Our Rate (%)</label>
                <div className="flex items-center border border-slate-300 rounded-xl overflow-hidden">
                  <input
                    type="number" min={0} max={100} step={0.5}
                    value={data.commissionPercent || ''}
                    onChange={e => handleInputChange('commissionPercent', parseFloat(e.target.value) || 0)}
                    className="flex-1 px-3 py-2 text-sm font-mono outline-none"
                    placeholder="e.g. 15"
                  />
                  <span className="px-3 py-2 text-slate-500 font-bold text-sm bg-slate-50 border-l border-slate-200">%</span>
                </div>
              </div>
            )}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Our Amount ({currencySymbol}){data.commissionType !== 'fixed' && <span className="text-slate-400 font-normal"> — auto</span>}
              </label>
              <div className="flex items-center border border-slate-300 rounded-xl overflow-hidden">
                <span className="px-2 py-2 text-slate-500 font-bold text-xs bg-slate-50 border-r border-slate-200">{currencySymbol}</span>
                <input
                  type="number" min={0}
                  value={data.commissionAmount || ''}
                  readOnly={data.commissionType !== 'fixed'}
                  onChange={e => data.commissionType === 'fixed' ? handleInputChange('commissionAmount', parseFloat(e.target.value) || 0) : undefined}
                  className={`flex-1 px-3 py-2 text-sm font-mono outline-none ${data.commissionType !== 'fixed' ? 'bg-slate-50 text-slate-400' : ''}`}
                  placeholder="0"
                />
              </div>
            </div>
          </div>
        )}

        {/* SPLIT WITH AGENT fields */}
        {data.commissionSource === 'split_agent' && (
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {data.commissionType !== 'fixed' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Agent Commission (%)</label>
                  <div className="flex items-center border border-slate-300 rounded-xl overflow-hidden">
                    <input
                      type="number" min={0} max={100} step={0.5}
                      value={data.agentCommissionPercent || ''}
                      onChange={e => handleInputChange('agentCommissionPercent', parseFloat(e.target.value) || 0)}
                      className="flex-1 px-3 py-2 text-sm font-mono outline-none"
                      placeholder="e.g. 15"
                    />
                    <span className="px-3 py-2 text-slate-500 font-bold text-sm bg-slate-50 border-l border-slate-200">%</span>
                  </div>
                </div>
              )}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Agent Total ({currencySymbol}){data.commissionType !== 'fixed' && <span className="text-slate-400 font-normal"> — auto</span>}
                </label>
                <div className="flex items-center border border-slate-300 rounded-xl overflow-hidden">
                  <span className="px-2 py-2 text-slate-500 font-bold text-xs bg-slate-50 border-r border-slate-200">{currencySymbol}</span>
                  <input
                    type="number" min={0}
                    value={data.agentCommissionAmount || ''}
                    readOnly={data.commissionType !== 'fixed'}
                    onChange={e => data.commissionType === 'fixed' ? handleInputChange('agentCommissionAmount', parseFloat(e.target.value) || 0) : undefined}
                    className={`flex-1 px-3 py-2 text-sm font-mono outline-none ${data.commissionType !== 'fixed' ? 'bg-slate-50 text-slate-400' : ''}`}
                    placeholder="0"
                  />
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Our Split (%)</label>
                <div className="flex items-center border border-slate-300 rounded-xl overflow-hidden">
                  <input
                    type="number" min={0} max={100} step={5}
                    value={data.tvmSplitPercent || ''}
                    onChange={e => handleInputChange('tvmSplitPercent', parseFloat(e.target.value) || 0)}
                    className="flex-1 px-3 py-2 text-sm font-mono outline-none"
                    placeholder="e.g. 50"
                  />
                  <span className="px-3 py-2 text-slate-500 font-bold text-sm bg-slate-50 border-l border-slate-200">%</span>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  We Receive{data.commissionType !== 'fixed' && <span className="text-slate-400 font-normal"> — auto</span>}
                </label>
                <div className={`flex items-center border rounded-xl overflow-hidden ${data.commissionType === 'fixed' ? 'border-slate-300' : 'bg-slate-50 border-slate-200'}`}>
                  <span className="px-2 py-2 text-slate-500 font-bold text-xs bg-slate-100 border-r border-slate-200">{currencySymbol}</span>
                  <input
                    type="number" min={0}
                    readOnly={data.commissionType !== 'fixed'}
                    value={data.commissionAmount || ''}
                    onChange={e => data.commissionType === 'fixed' ? handleInputChange('commissionAmount', parseFloat(e.target.value) || 0) : undefined}
                    className={`flex-1 px-3 py-2 text-sm font-mono outline-none ${data.commissionType !== 'fixed' ? 'bg-slate-50 text-slate-400' : ''}`}
                    placeholder="0"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Summary box */}
        {data.commissionAmount > 0 && data.totalPrice > 0 && (
          <div className="bg-amber-50 rounded-xl px-4 py-3 border border-amber-200 space-y-1.5">
            {data.commissionSource === 'split_agent' && data.agentCommissionAmount > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-amber-700">Agent commission:</span>
                <span className="text-xs font-bold text-amber-800 font-mono">{fmt(data.agentCommissionAmount)}</span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-xs text-amber-700">
                {data.commissionSource === 'split_agent' ? 'We receive:' : 'Our commission:'}
              </span>
              <span className="text-xs font-bold text-amber-800 font-mono">{fmt(data.commissionAmount)}</span>
            </div>
            <div className="flex items-center justify-between border-t border-amber-200 pt-1.5">
              <span className="text-xs font-bold text-amber-800">Net to Owner:</span>
              <span className="text-sm font-bold text-amber-900 font-mono">
                {fmt(data.totalPrice - (data.commissionSource === 'split_agent' ? data.agentCommissionAmount : data.commissionAmount))}
              </span>
            </div>
          </div>
        )}

        {/* Notes */}
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Payment Notes (optional)</label>
          <input
            type="text"
            value={data.commissionNotes}
            onChange={e => handleInputChange('commissionNotes', e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-amber-400 outline-none transition"
            placeholder="e.g. Paid within 7 days of check-in"
          />
        </div>

      </div>
    </section>
  );
};
