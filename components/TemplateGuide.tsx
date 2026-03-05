import React, { useState } from 'react';
import { FileText, ChevronDown, ChevronUp } from 'lucide-react';

const VARIABLES = [
  // Property
  { tag: '{{propertyCode}}', desc: 'Property code (e.g. 4BW2)' },
  { tag: '{{villaName}}', desc: 'Official name of the property' },
  { tag: '{{villaAddress}}', desc: 'Full physical address' },
  { tag: '{{bedrooms}}', desc: 'Total number of bedrooms' },
  // Lessor (Party 1)
  { tag: '{{lessorName}}', desc: 'Lessor / property owner full name' },
  { tag: '{{lessorAddressOrBirth}}', desc: 'Lessor address or place & DOB' },
  { tag: '{{lessorCountry}}', desc: 'Country of incorporation / nationality' },
  { tag: '{{lessorNIK}}', desc: 'Lessor NIK / ID / Passport number' },
  // Lessee / Lead Guest (Party 2)
  { tag: '{{lesseeName}}', desc: 'Primary lessee / tenant name' },
  { tag: '{{passportNumber}}', desc: 'Lead guest ID / Passport / Business Card no.' },
  { tag: '{{nationality}}', desc: 'Lead guest nationality' },
  { tag: '{{phone}}', desc: 'Lead guest phone number' },
  { tag: '{{birthday}}', desc: 'Lead guest place & date of birth' },
  // Additional Guests
  { tag: '{{guest2Name}}', desc: 'Guest 2 full name' },
  { tag: '{{guest2Passport}}', desc: 'Guest 2 ID / passport' },
  { tag: '{{guest3Name}}', desc: 'Guest 3 full name' },
  { tag: '{{guest3Passport}}', desc: 'Guest 3 ID / passport' },
  { tag: '{{guest4Name}}', desc: 'Guest 4 full name' },
  { tag: '{{guest4Passport}}', desc: 'Guest 4 ID / passport' },
  // Agency (Party 3 — always PT The Villa Managers)
  { tag: '{{agencyName}}', desc: 'Agency name (PT The Villa Managers)' },
  { tag: '{{agencyAddress}}', desc: 'Agency registered address' },
  { tag: '{{agencyNIB}}', desc: 'Agency NIB / business reg. number' },
  // Stay & Timeline
  { tag: '{{checkInDate}}', desc: 'Start of rental period (formatted)' },
  { tag: '{{checkOutDate}}', desc: 'End of rental period (formatted)' },
  { tag: '{{numberOfNights}}', desc: 'Total duration in nights' },
  { tag: '{{numberOfMonths}}', desc: 'Duration in months (pro-rated)' },
  { tag: '{{todayDate}}', desc: 'Today\'s date (auto-filled)' },
  { tag: '{{copyLabel}}', desc: '⭐ Which copy: CLIENT COPY / OWNER COPY / AGENT COPY' },
  { tag: '{{copyFor}}', desc: '⭐ Recipient label: Lessee / Lessor / Agency' },
  // Financial
  { tag: '{{paymentCurrency}}', desc: 'Currency: IDR / USD / EUR / USDT' },
  { tag: '{{monthlyPrice}}', desc: 'Monthly / base rent amount' },
  { tag: '{{totalPrice}}', desc: 'Total agreed rent amount' },
  { tag: '{{securityDeposit}}', desc: 'Security deposit amount' },
  { tag: '{{paymentDueDate}}', desc: 'Payment deadline date' },
  { tag: '{{paymentTerms}}', desc: 'Payment terms description' },
  { tag: '{{firstPaymentAmount}}', desc: 'First payment amount' },
  { tag: '{{firstPaymentDueDate}}', desc: 'First payment due date' },
  { tag: '{{followingPaymentAmount}}', desc: 'Following / installment amount' },
  { tag: '{{followingPaymentDueDate}}', desc: 'Following payment due date' },
  // Payment method & accounts
  { tag: '{{paymentMethod}}', desc: 'Payment method (Bank / WISE / Crypto)' },
  { tag: '{{bankDetailsIDR}}', desc: 'IDR bank account details' },
  { tag: '{{wiseEuroAccount}}', desc: 'Wise / EUR account details' },
  { tag: '{{cryptoWalletAddress}}', desc: 'USDT TRC20 wallet address' },
  // Inclusions
  { tag: '{{inclusionsList}}', desc: 'Comma-separated list of inclusions' },
  // Agent (optional)
  { tag: '{{hasAgent}}', desc: 'Yes / No — is agent involved?' },
  { tag: '{{agentCompanyName}}', desc: 'Agent company name' },
  { tag: '{{agentPIC}}', desc: 'Agent person in charge name' },
  { tag: '{{agentPhone}}', desc: 'Agent WhatsApp / phone' },
  { tag: '{{agentEmail}}', desc: 'Agent email address' },
  { tag: '{{agentPartnershipType}}', desc: 'Agent partnership type' },
];

const GROUPS = [
  { label: '🏠 Property', tags: VARIABLES.slice(0, 4) },
  { label: '👤 Lessor / Owner (Party 1)', tags: VARIABLES.slice(4, 8) },
  { label: '🛂 Lessee / Lead Guest (Party 2)', tags: VARIABLES.slice(8, 13) },
  { label: '👥 Additional Guests', tags: VARIABLES.slice(13, 19) },
  { label: '🏢 Agency (Party 3 — Auto)', tags: VARIABLES.slice(19, 22) },
  { label: '📅 Stay & Timeline', tags: VARIABLES.slice(22, 27) },
  { label: '💰 Financials & Currency', tags: VARIABLES.slice(27, 37) },
  { label: '🏦 Payment Accounts', tags: VARIABLES.slice(37, 40) },
  { label: '✅ Inclusions', tags: VARIABLES.slice(40, 41) },
  { label: '🤝 Agent / Partner (Optional)', tags: VARIABLES.slice(41) },
];

export const TemplateGuide: React.FC = () => {
  const [open, setOpen] = useState(false);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-emerald-100 overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-emerald-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-emerald-600" />
          <span className="text-base font-bold text-emerald-900">Template Placeholder Guide (3-Party)</span>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-emerald-600" /> : <ChevronDown className="w-4 h-4 text-emerald-600" />}
      </button>

      {open && (
        <div className="px-6 pb-6 border-t border-emerald-100">
          <p className="text-sm text-slate-500 mt-4 mb-5">
            Copy these tags into your Microsoft Word (.docx) template exactly as shown. The system will replace them with the actual data when generating the contract.
          </p>

          <div className="space-y-5">
            {GROUPS.map((group) => (
              <div key={group.label}>
                <h4 className="text-xs font-bold uppercase tracking-widest text-emerald-700 mb-2">{group.label}</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {group.tags.map((v) => (
                    <div key={v.tag} className="flex flex-col bg-emerald-50 p-3 rounded-lg border border-emerald-100">
                      <code className="text-emerald-800 font-mono text-xs font-bold">{v.tag}</code>
                      <span className="text-xs text-emerald-600 mt-1">{v.desc}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 p-4 bg-blue-50 border border-blue-100 rounded-lg">
            <p className="text-xs font-semibold text-blue-800 mb-1">💡 How to use in your Word template</p>
            <p className="text-xs text-blue-600">
              In your .docx file, type the tag exactly as shown (e.g. <code className="bg-blue-100 px-1 rounded">{'{{lessorName}}'}</code>) wherever you want the data to appear.
              Upload the template, fill in the form, then click "Download 3-Party Contract".
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
