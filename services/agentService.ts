import { AgentData, ContractData } from '../types';

/**
 * Generates a printable Agent Registration form in a new browser tab.
 * The user can then print it or save as PDF.
 */
export const generateAgentRegistration = (data: ContractData) => {
  const a = data.agent;
  const today = new Date().toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric'
  });

  const row = (label: string, value: string) =>
    value
      ? `<tr><td class="label">${label}</td><td class="value">${value || '–'}</td></tr>`
      : `<tr><td class="label">${label}</td><td class="value empty">–</td></tr>`;

  const platform = (label: string, value: string) =>
    `<div class="platform-row ${value ? 'active' : ''}">`
    + `<span class="platform-label">${label}</span>`
    + `<span class="platform-value">${value || '–'}</span>`
    + `</div>`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Agent Registration – PT The Villa Managers</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');

    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: 'Inter', sans-serif;
      background: #f8faf8;
      color: #1a2e1a;
      padding: 40px 20px;
    }

    .page {
      max-width: 780px;
      margin: 0 auto;
      background: #fff;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 4px 24px rgba(0,0,0,0.08);
    }

    /* Header */
    .header {
      background: #14532d;
      color: #fff;
      padding: 32px 40px;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    }
    .header-left h1 { font-size: 22px; font-weight: 700; letter-spacing: 0.5px; }
    .header-left p { font-size: 13px; color: #86efac; margin-top: 4px; }
    .header-right { text-align: right; font-size: 12px; color: #86efac; line-height: 1.7; }
    .header-right strong { color: #fff; display: block; font-size: 13px; margin-bottom: 2px; }

    /* Partner badge */
    .badge {
      display: inline-block;
      background: #dcfce7;
      color: #15803d;
      border-radius: 20px;
      padding: 4px 16px;
      font-size: 12px;
      font-weight: 600;
      margin: 20px 40px 0;
    }

    /* Deal reference */
    .deal-ref {
      background: #f0fdf4;
      border-left: 4px solid #16a34a;
      margin: 16px 40px;
      padding: 12px 16px;
      border-radius: 0 8px 8px 0;
      font-size: 13px;
      color: #166534;
    }
    .deal-ref strong { display: block; font-size: 14px; margin-bottom: 4px; }

    /* Sections */
    .section {
      padding: 24px 40px;
      border-top: 1px solid #e7f3e7;
    }
    .section-title {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 1.5px;
      color: #16a34a;
      margin-bottom: 14px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .section-title::after {
      content: '';
      flex: 1;
      height: 1px;
      background: #dcfce7;
    }

    /* Tables */
    table { width: 100%; border-collapse: collapse; }
    table td { padding: 8px 0; font-size: 13.5px; vertical-align: top; }
    td.label {
      width: 42%;
      color: #4b5563;
      font-weight: 500;
      padding-right: 16px;
    }
    td.value { color: #111827; font-weight: 500; }
    td.value.empty { color: #9ca3af; font-style: italic; }
    table tr + tr td { border-top: 1px dashed #f0fdf4; }

    /* Platforms grid */
    .platforms-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 8px;
    }
    .platform-row {
      display: flex;
      flex-direction: column;
      background: #f9fafb;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 8px 12px;
    }
    .platform-row.active {
      background: #f0fdf4;
      border-color: #86efac;
    }
    .platform-label {
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      color: #6b7280;
    }
    .platform-value {
      font-size: 13px;
      font-weight: 500;
      color: #111827;
      margin-top: 2px;
      word-break: break-all;
    }

    /* Bank highlight */
    .bank-box {
      background: #f0fdf4;
      border: 1.5px solid #86efac;
      border-radius: 10px;
      padding: 16px 20px;
    }

    /* Document note */
    .doc-note {
      background: #fffbeb;
      border: 1px solid #fde68a;
      border-radius: 8px;
      padding: 12px 16px;
      font-size: 12.5px;
      color: #92400e;
      margin-top: 8px;
    }

    /* Signatures */
    .signatures {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 24px;
      padding: 28px 40px;
      border-top: 1px solid #e7f3e7;
    }
    .sig-box { text-align: center; }
    .sig-line {
      border-bottom: 1.5px solid #374151;
      height: 56px;
      margin-bottom: 8px;
    }
    .sig-label { font-size: 12px; color: #4b5563; font-weight: 500; }
    .sig-sub { font-size: 11px; color: #9ca3af; margin-top: 2px; }

    /* Footer */
    .footer {
      background: #f9faf9;
      padding: 14px 40px;
      font-size: 11px;
      color: #9ca3af;
      border-top: 1px solid #e5e7eb;
      display: flex;
      justify-content: space-between;
    }

    @media print {
      body { background: #fff; padding: 0; }
      .page { box-shadow: none; border-radius: 0; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="page">

    <!-- Header -->
    <div class="header">
      <div class="header-left">
        <h1>🤝 Agent / Partner Registration</h1>
        <p>Partnership Application Form – PT The Villa Managers</p>
      </div>
      <div class="header-right">
        <strong>PT The Villa Managers</strong>
        NIB: 0702250138139<br>
        Jl Intan Permai, Kerobokan Kelod<br>
        Bali, Indonesia<br>
        +62821-1511-1211
      </div>
    </div>

    <!-- Partnership type badge -->
    <div style="padding: 16px 40px 0">
      <span class="badge">
        Partnership Type: ${a.partnershipType || '–'}${a.partnershipTypeOther ? ' – ' + a.partnershipTypeOther : ''}
      </span>
    </div>

    <!-- Deal reference (if applicable) -->
    ${data.villaName || data.guests[0]?.name ? `
    <div class="deal-ref">
      <strong>📋 Linked Deal Reference</strong>
      ${data.villaName ? `Property: <strong>${data.villaName}</strong>` : ''}
      ${data.propertyCode ? ` · Code: <strong>${data.propertyCode}</strong>` : ''}
      ${data.guests[0]?.name ? ` · Client: <strong>${data.guests[0].name}</strong>` : ''}
      ${data.checkInDate ? ` · Check-in: <strong>${new Date(data.checkInDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</strong>` : ''}
    </div>` : ''}

    <!-- A. Partnership Type already shown as badge -->

    <!-- B. Company Information -->
    <div class="section">
      <div class="section-title">B. Company Information</div>
      <table>
        ${row('Company Name', a.companyName)}
        ${row('Office Address', a.officeAddress)}
        ${row('Office Phone', a.officePhone)}
        ${row('Agent PIC (Person in Charge)', a.agentPIC)}
      </table>
    </div>

    <!-- C. PIC / Agent Data -->
    <div class="section">
      <div class="section-title">C. PIC / Agent Personal Data</div>
      <table>
        ${row('Full Name (as per ID)', a.picFullName)}
        ${row('Gender', a.gender)}
        ${row('Place of Birth', a.placeOfBirth)}
        ${row('Date of Birth', a.dateOfBirth ? new Date(a.dateOfBirth).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '')}
        ${row('Nationality', a.picNationality)}
        ${row('Marital Status', a.maritalStatus)}
        ${row('ID / Passport / Business Card No.', a.idOrPassportNumber)}
        ${row('Address (as per ID)', a.addressAsPerID)}
        ${row('Current Address', a.currentAddress || a.addressAsPerID)}
        ${row('WhatsApp / Phone', a.whatsappNumber)}
        ${row('Email Address', a.agentEmail)}
      </table>
    </div>

    <!-- D. Sales Platforms -->
    <div class="section">
      <div class="section-title">D. Sales Platforms</div>
      <div class="platforms-grid">
        ${platform('Facebook', a.facebook)}
        ${platform('Instagram', a.instagram)}
        ${platform('TikTok', a.tiktok)}
        ${platform('Website', a.website)}
        ${platform('Booking.com', a.bookingCom)}
        ${platform('Agoda', a.agoda)}
        ${platform('Traveloka', a.traveloka)}
        ${platform('Tiket.com', a.tiketCom)}
        ${platform('Personal Network', a.personalNetwork)}
        ${platform('Others', a.otherPlatform)}
      </div>
    </div>

    <!-- E. Bank Details -->
    <div class="section">
      <div class="section-title">E. Bank Details (for commission payment)</div>
      <div class="bank-box">
        <table>
          ${row('Bank Name', a.bankName)}
          ${row('Account Holder Name', a.accountHolderName)}
          ${row('Bank Account Number', a.bankAccountNumber)}
        </table>
      </div>
    </div>

    <!-- F. Supporting Document Note -->
    <div class="section">
      <div class="section-title">F. Supporting Document</div>
      <div class="doc-note">
        📎 <strong>Required:</strong> Please attach a photo of the PIC's ID (KTP / Passport), or alternatively a <strong>Business Card</strong> or <strong>Company Profile</strong> is accepted as a supporting document.
      </div>
    </div>

    <!-- Signatures -->
    <div class="signatures">
      <div class="sig-box">
        <div class="sig-line"></div>
        <div class="sig-label">Agent / Partner</div>
        <div class="sig-sub">${a.picFullName || a.companyName || '________________'}</div>
      </div>
      <div class="sig-box">
        <div class="sig-line"></div>
        <div class="sig-label">PT The Villa Managers</div>
        <div class="sig-sub">Authorized Representative</div>
      </div>
    </div>

    <!-- Footer -->
    <div class="footer">
      <span>Registration Date: ${today}</span>
      <span>PT The Villa Managers · NIB 0702250138139 · Kerobokan Kelod, Bali</span>
    </div>

  </div>

  <!-- Print button (hidden on print) -->
  <div class="no-print" style="text-align:center; margin-top: 24px;">
    <button onclick="window.print()"
      style="background:#14532d;color:#fff;border:none;padding:12px 32px;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;letter-spacing:0.3px;">
      🖨️ Print / Save as PDF
    </button>
  </div>

</body>
</html>`;

  // Open in new tab
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, '_blank');
  if (!win) {
    alert('Popup was blocked. Please allow popups for this site to open the agent registration form.');
  }
};
