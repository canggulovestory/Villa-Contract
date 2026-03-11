import React from 'react';

// ─── Checkbox ─────────────────────────────────────────────────────────────
// Extracted from the bottom of App.tsx into its own file so it's discoverable
// and reusable. Uses a visually styled label over a hidden native input for
// full accessibility (screen readers, keyboard navigation).

interface CheckboxProps {
  label: string;
  checked: boolean;
  onChange: () => void;
}

export const Checkbox: React.FC<CheckboxProps> = ({ label, checked, onChange }) => (
  <label
    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
      checked
        ? 'bg-emerald-50 border-emerald-500'
        : 'bg-slate-50 border-slate-200 hover:border-emerald-300'
    }`}
  >
    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${checked ? 'bg-emerald-500' : 'bg-white border-slate-300'}`} />
    <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
      {label}
    </div>
    <input type="checkbox" checked={checked} onChange={onChange} className="hidden" />
  </label>
);
