import React from 'react';
import { CreditCard, Plus, X } from 'lucide-react';
import { ContractData, HandleChange, ComputedData, CommissionType, PaymentCurrency } from '../types';
import { SectionHeader } from '../components/SectionHeader';
import { formatCurrencyDisplay, parseIDRInput, CURRENCY_SYMBOLS } from '../utils/format';

interface Props {
  data: ContractData;
  handleInputChange: HandleChange;
  computedData: ComputedData;
  isPriceManuallySet: boolean;
  onTotalPriceChange: (value: number) => void;
  onSetIsPriceManuallySet: (v: boolean) => void;
}

export const Section4Financials: React.FC<Props> = ({
  data, handleInputChange, computedData,
  isPriceManuallySet, onTotalPriceChange, onSetIsPriceManuallySet,
}) => {
  const currencySymbol = CURRENCY_SYMBOLS[data.paymentCurrency] ?? 'Rp';
  const isIDR = data.paymentCurrency === 'IDR';
  const fmt = (n: number) => formatCurrencyDisplay(n, data.paymentCurrency);

  return (
    <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      <SectionHeader num={4} icon={<CreditCard className="w-4 h-4 text-emerald-600" />} title="Financials" />
      <div className="px-4 sm:px-6 py-5 space-y-4">

        {/* ① Currency Selector */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">Payment Currency</label>
          <div className="flex gap-2 flex-wrap">
            {(['IDR', 'USD', 'EUR', 'USDT'] as PaymentCurrency[]).map(cur => (
              <button
                key={cur}
                onClick={() => handleInputChange('paymentCurrency', cur)}
                className={`px-5 py-2 rounded-xl text-sm font-bold border-2 transition active:scale-95 ${
                  data.paymentCurrency === cur
                    ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm'
                    : 'bg-white border-slate-200 text-slate-600 hover:border-emerald-300'
                }`}
              >
                {cur}
              </button>
            ))}
          </div>
        </div>

        {/* ② Monthly / Base Price */}
        <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl">
          <label className="block text-sm font-bold text-blue-800 mb-2">
            Monthly / Base Price <span className="text-red-400">*</span>
          </label>
          <div className="flex items-center border border-blue-200 rounded-xl overflow-hidden bg-white">
            <span className="px-3 py-2.5 text-slate-500 font-bold text-sm bg-slate-50 border-r border-blue-200 flex-shrink-0">
              {currencySymbol}
            </span>
            {isIDR ? (
              <input
                type="text"
                inputMode="numeric"
                value={data.monthlyPrice > 0 ? data.monthlyPrice.toLocaleString('id-ID') : ''}
                onChange={e => { onSetIsPriceManuallySet(false); handleInputChange('monthlyPrice', parseIDRInput(e.target.value)); }}
                className="flex-1 px-3 py-2.5 text-sm font-mono outline-none focus:bg-blue-50/30 transition"
                placeholder="e.g. 30.000.000"
              />
            ) : (
              <input
                type="number"
                value={data.monthlyPrice || ''}
                onChange={e => { onSetIsPriceManuallySet(false); handleInputChange('monthlyPrice', parseFloat(e.target.value) || 0); }}
                className="flex-1 px-3 py-2.5 text-sm font-mono outline-none focus:bg-blue-50/30 transition"
                placeholder="e.g. 3000"
              />
            )}
          </div>
          {data.monthlyPrice > 0 && <p className="text-xs text-blue-500 font-bold mt-1.5">= {fmt(data.monthlyPrice)} / month</p>}
          <p className="text-xs text-blue-400 mt-1">Auto-calculates Total Price based on nights (pro-rated)</p>
        </div>

        {/* ③ Total + Security Deposit */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Total Price */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
              Total Agreed Price <span className="text-red-400">*</span>
            </label>
            <div className="flex items-center border border-slate-300 rounded-xl overflow-hidden">
              <span className="px-3 py-2.5 text-slate-500 font-bold text-sm bg-slate-50 border-r border-slate-200 flex-shrink-0">
                {currencySymbol}
              </span>
              {isIDR ? (
                <input
                  type="text"
                  inputMode="numeric"
                  value={data.totalPrice > 0 ? data.totalPrice.toLocaleString('id-ID') : ''}
                  onChange={e => onTotalPriceChange(parseIDRInput(e.target.value))}
                  className="flex-1 px-3 py-2.5 text-sm font-mono outline-none transition"
                  placeholder="Auto-calculated"
                />
              ) : (
                <input
                  type="number"
                  value={data.totalPrice || ''}
                  onChange={e => onTotalPriceChange(parseFloat(e.target.value) || 0)}
                  className="flex-1 px-3 py-2.5 text-sm font-mono outline-none transition"
                  placeholder="Auto-calculated"
                />
              )}
            </div>
            {data.totalPrice > 0 && <p className="text-xs text-slate-500 mt-1 font-semibold">{fmt(data.totalPrice)}</p>}
            {isPriceManuallySet && <p className="text-xs text-amber-600 mt-1">⚠ Manual override active</p>}
          </div>

          {/* Security Deposit */}
          {(() => {
            const autoDeposit = Math.round(data.totalPrice * 0.10);
            const isStale = data.securityDepositOverride > 0 && data.totalPrice > 0 &&
              Math.abs(data.securityDepositOverride - autoDeposit) > 1;
            return (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-sm font-semibold text-slate-700">Security Deposit</label>
                  {data.securityDepositOverride > 0 && (
                    <button
                      onClick={() => handleInputChange('securityDepositOverride', 0)}
                      className={`text-xs font-semibold transition flex items-center gap-1 ${isStale ? 'text-amber-600 hover:text-amber-800' : 'text-blue-500 hover:text-blue-700'}`}
                    >
                      {isStale && <span>⚠</span>} Reset to 10%
                    </button>
                  )}
                </div>
                <div className={`flex items-center border rounded-xl overflow-hidden ${isStale ? 'border-amber-300' : 'border-slate-300'}`}>
                  <span className="px-3 py-2.5 text-slate-500 font-bold text-sm bg-slate-50 border-r border-slate-200 flex-shrink-0">
                    {currencySymbol}
                  </span>
                  {isIDR ? (
                    <input
                      type="text"
                      inputMode="numeric"
                      value={computedData.securityDeposit > 0 ? computedData.securityDeposit.toLocaleString('id-ID') : ''}
                      onChange={e => handleInputChange('securityDepositOverride', parseIDRInput(e.target.value))}
                      className="flex-1 px-3 py-2.5 text-sm font-mono outline-none transition"
                      placeholder="Auto: 10% of total"
                    />
                  ) : (
                    <input
                      type="number"
                      value={computedData.securityDeposit || ''}
                      onChange={e => handleInputChange('securityDepositOverride', parseFloat(e.target.value) || 0)}
                      className="flex-1 px-3 py-2.5 text-sm font-mono outline-none transition"
                      placeholder="Auto: 10% of total"
                    />
                  )}
                </div>
                {isStale
                  ? <p className="text-xs text-amber-600 mt-1 font-semibold">⚠ Total price changed — deposit may be outdated (10% = {fmt(autoDeposit)})</p>
                  : <p className="text-xs text-slate-400 mt-1">Auto-set to 10% — override as needed</p>
                }
              </div>
            );
          })()}
        </div>

        {/* ④ Payment Terms */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1.5">Payment Terms</label>
          <input
            type="text"
            value={data.paymentTerms}
            onChange={e => handleInputChange('paymentTerms', e.target.value)}
            className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-400 outline-none transition"
            placeholder="e.g. Full upfront / 50% on check-in"
          />
        </div>

        {/* ⑤ Payment Schedule */}
        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-4 py-2 bg-slate-50 border-b border-slate-100">
            <span className="text-xs font-bold uppercase tracking-widest text-slate-500">Payment Schedule</span>
          </div>
          <div className="px-4 py-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-sm font-semibold text-slate-700">First Payment Amount</label>
                  <div className="flex items-center gap-1">
                    {computedData.securityDeposit > 0 && (
                      <button
                        type="button"
                        onClick={() => handleInputChange('firstPaymentAmount', fmt(computedData.securityDeposit))}
                        className="text-xs bg-blue-50 text-blue-600 hover:bg-blue-100 font-semibold px-2 py-0.5 rounded-full border border-blue-200 transition"
                        title="Use security deposit amount"
                      >
                        = Deposit
                      </button>
                    )}
                    {data.totalPrice > 0 && (
                      <button
                        type="button"
                        onClick={() => handleInputChange('firstPaymentAmount', fmt(data.totalPrice))}
                        className="text-xs bg-emerald-50 text-emerald-600 hover:bg-emerald-100 font-semibold px-2 py-0.5 rounded-full border border-emerald-200 transition"
                        title="Use full total price"
                      >
                        = Total
                      </button>
                    )}
                  </div>
                </div>
                <input
                  type="text"
                  value={data.firstPaymentAmount}
                  onChange={e => handleInputChange('firstPaymentAmount', e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-400 outline-none transition"
                  placeholder="e.g. 50% upfront or full amount"
                />
                <p className="text-xs text-slate-400 mt-1">Use the chips above to auto-fill from deposit or total price</p>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">First Payment Due Date</label>
                <input
                  type="date"
                  value={data.paymentDueDate}
                  onChange={e => handleInputChange('paymentDueDate', e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-400 outline-none transition"
                />
              </div>
            </div>
            {/* Following Payment — toggled */}
            {!data.showFollowingPayment ? (
              <button
                onClick={() => handleInputChange('showFollowingPayment', true)}
                className="flex items-center gap-1.5 text-sm text-emerald-600 hover:text-emerald-800 font-semibold transition"
              >
                <Plus className="w-4 h-4" /> Add following payment (optional)
              </button>
            ) : (
              <div className="pt-1 space-y-3 border-t border-slate-100">
                <div className="flex items-center justify-between pt-2">
                  <span className="text-sm font-semibold text-slate-600">Following Payment</span>
                  <button
                    onClick={() => {
                      handleInputChange('showFollowingPayment', false);
                      handleInputChange('followingPaymentAmount', '');
                      handleInputChange('followingPaymentDueDate', '');
                    }}
                    className="text-xs text-slate-400 hover:text-red-500 transition flex items-center gap-1"
                  >
                    <X className="w-3 h-3" /> Remove
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Following Payment Amount</label>
                    <input
                      type="text"
                      value={data.followingPaymentAmount}
                      onChange={e => handleInputChange('followingPaymentAmount', e.target.value)}
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-400 outline-none transition"
                      placeholder="e.g. Balance IDR 27,000,000"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Following Payment Due Date</label>
                    <input
                      type="date"
                      value={data.followingPaymentDueDate}
                      onChange={e => handleInputChange('followingPaymentDueDate', e.target.value)}
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-400 outline-none transition"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ⑥ Commission / Agent Fee */}
        <div className="border border-amber-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 bg-amber-50 border-b border-amber-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-amber-500 text-base">💰</span>
              <span className="font-bold text-amber-800 text-sm">Commission / Agent Fee</span>
            </div>
            <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full border border-amber-200 font-semibold">
              Owner copy only
            </span>
          </div>
          <div className="px-4 py-4 bg-white space-y-3">
            {/* Source pills */}
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
        </div>

      </div>
    </section>
  );
};
