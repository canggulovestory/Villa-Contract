import React, { useState } from 'react';
import { FileText, Copy, Check } from 'lucide-react';

// ─── Template Variables Reference ─────────────────────────────────────────
// Fixed:
//  1. Clearly marks legacy tags as (legacy) so users know which to prefer.
//  2. Adds copy-to-clipboard button per tag — no more manual selection.
//  3. Groups tags with clear headings.

interface TemplateVar {
  tag: string;
  desc: string;
  legacy?: boolean;
}

const VARIABLES: TemplateVar[] = [
  // Villa
  { tag: '{{villaName}}',     desc: 'Name of the Villa' },
  { tag: '{{villaAddress}}',  desc: 'Address of the Villa' },
  { tag: '{{bedrooms}}',      desc: 'Number of bedrooms' },

  // Guest 1
  { tag: '{{guest1Name}}',        desc: 'Guest 1 — Full Name' },
  { tag: '{{guest1Passport}}',    desc: 'Guest 1 — Passport Number' },
  { tag: '{{guest1Nationality}}', desc: 'Guest 1 — Nationality' },
  { tag: '{{guest1Phone}}',       desc: 'Guest 1 — Phone' },
  { tag: '{{guest1Birthday}}',    desc: 'Guest 1 — Date of Birth' },

  // Guest 2
  { tag: '{{guest2Name}}',        desc: 'Guest 2 — Full Name (if applicable)' },
  { tag: '{{guest2Passport}}',    desc: 'Guest 2 — Passport Number' },
  { tag: '{{guest2Nationality}}', desc: 'Guest 2 — Nationality' },
  { tag: '{{guest2Phone}}',       desc: 'Guest 2 — Phone' },

  // Dates
  { tag: '{{checkInDate}}',    desc: 'Check-in Date' },
  { tag: '{{checkOutDate}}',   desc: 'Check-out Date' },
  { tag: '{{paymentDueDate}}', desc: 'Payment Deadline' },

  // Stay calculations
  { tag: '{{numberOfNights}}', desc: 'Total nights' },
  { tag: '{{numberOfMonths}}', desc: 'Total months' },

  // Money
  { tag: '{{monthlyPrice}}',   desc: 'Monthly Price (IDR formatted)' },
  { tag: '{{totalPrice}}',     desc: 'Total Price (IDR formatted)' },
  { tag: '{{securityDeposit}}',desc: '10% Security Deposit (IDR formatted)' },
  { tag: '{{totalPriceRaw}}',  desc: 'Total Price (raw number for math)' },

  // Inclusions
  { tag: '{{inclusionsList}}', desc: 'Comma-separated list of inclusions' },

  // ─── Legacy tags (kept for backward compatibility) ───────────────────
  // These work but {{guest1Name}} / {{guest1Passport}} are preferred.
  { tag: '{{lesseeName}}',     desc: 'Guest 1 Name (legacy alias)', legacy: true },
  { tag: '{{passportNumber}}', desc: 'Guest 1 Passport (legacy alias)', legacy: true },
];

// ─── CopyButton ───────────────────────────────────────────────────────────

const CopyButton: React.FC<{ text: string }> = ({ text }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.preventDefault();
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Fallback for browsers that block clipboard access
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  return (
    <button
      onClick={handleCopy}
      title="Copy tag"
      className="p-1 rounded hover:bg-emerald-100 text-emerald-500 hover:text-emerald-700 transition-colors"
    >
      {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
    </button>
  );
};

// ─── TemplateGuide ────────────────────────────────────────────────────────

export const TemplateGuide: React.FC = () => {
  const active = VARIABLES.filter((v) => !v.legacy);
  const legacy = VARIABLES.filter((v) => v.legacy);

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-emerald-100">
      <div className="flex items-center gap-2 mb-1">
        <FileText className="w-5 h-5 text-emerald-600" />
        <h3 className="text-lg font-bold text-emerald-900">Template Guide</h3>
      </div>
      <p className="text-sm text-slate-600 mb-4">
        Copy these tags into your Microsoft Word (.docx) template. Click the{' '}
        <Copy className="w-3 h-3 inline" /> icon to copy a tag instantly.
      </p>

      {/* Active tags */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-4">
        {active.map((v) => (
          <div
            key={v.tag}
            className="flex flex-col bg-emerald-50 p-3 rounded-lg border border-emerald-100"
          >
            <div className="flex justify-between items-center">
              <code className="text-emerald-800 font-mono text-xs font-bold">{v.tag}</code>
              <CopyButton text={v.tag} />
            </div>
            <span className="text-xs text-emerald-600 mt-1">{v.desc}</span>
          </div>
        ))}
      </div>

      {/* Legacy tags — collapsed by default */}
      <details className="group">
        <summary className="cursor-pointer text-xs text-slate-400 hover:text-slate-600 select-none">
          ▶ Show legacy tags (for older templates)
        </summary>
        <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2">
          {legacy.map((v) => (
            <div
              key={v.tag}
              className="flex flex-col bg-slate-50 p-3 rounded-lg border border-slate-200 opacity-75"
            >
              <div className="flex justify-between items-center">
                <code className="text-slate-500 font-mono text-xs font-bold">{v.tag}</code>
                <CopyButton text={v.tag} />
              </div>
              <span className="text-xs text-slate-400 mt-1">{v.desc}</span>
            </div>
          ))}
        </div>
        <p className="text-xs text-amber-600 mt-2 bg-amber-50 p-2 rounded">
          ⚠️ Legacy tags only reference Guest 1. Use <code>{'{{guest1Name}}'}</code> and{' '}
          <code>{'{{guest1Passport}}'}</code> for new templates.
        </p>
      </details>
    </div>
  );
};
