import React from 'react';

interface SectionHeaderProps {
  num: number;
  icon: React.ReactNode;
  title: string;
  right?: React.ReactNode;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({ num, icon, title, right }) => (
  <div className="px-4 sm:px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-emerald-50/80 to-white flex flex-wrap items-center justify-between gap-2">
    <div className="flex items-center gap-3">
      <span className="w-7 h-7 bg-emerald-600 text-white rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">
        {num}
      </span>
      <h2 className="font-bold text-slate-800 flex items-center gap-2">{icon} {title}</h2>
    </div>
    {right && <div className="flex-shrink-0">{right}</div>}
  </div>
);
