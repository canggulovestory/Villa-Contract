import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import { saveAs } from 'file-saver';
import { ContractData, ComputedData } from '../types';
import { formatIDR, formatDate } from '../utils/format';

// ─── Hardcoded PT The Villa Managers Bank Details ─────────────────────────
const BANK = {
  name:        'BANK CIMB NIAGA',
  branch:      'Denpasar',
  accountName: 'PT THE VILLA MANAGERS',
  idr:         '800206006300',
  aud:         '800206009950',
  eur:         '800206008730',
  swift:       'BNIAIDJA',
  bankCode:    '022',
  branchCode:  '0424',
} as const;

// ─── generateDocument ─────────────────────────────────────────────────────
export interface GenerateResult {
  buffer: ArrayBuffer;
  filename: string;
}

export const generateDocument = async (
  templateSource: File | ArrayBuffer,
  data: ContractData,
  computed: ComputedData
): Promise<GenerateResult> => {
  const buffer =
    templateSource instanceof ArrayBuffer
      ? templateSource
      : await templateSource.arrayBuffer();

  const zip = new PizZip(buffer);
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    // Match the {{tag}} syntax shown in TemplateGuide and used in all official templates
    delimiters: { start: '{{', end: '}}' },
    // Return empty string for any tag present in the template but absent from templateData
    // (e.g. {{guest2Name}} when only 1 guest) — prevents a fatal render crash
    nullGetter: () => '',
  });

  // ── 1. Flatten guest data into numbered tags (guest1Name, guest2Name, …)
  const guestData: Record<string, string> = {};
  data.guests.forEach((guest, index) => {
    const num = index + 1;
    guestData[`guest${num}Name`]        = guest.name;
    guestData[`guest${num}Passport`]    = guest.passportNumber;
    guestData[`guest${num}Nationality`] = guest.nationality;
    guestData[`guest${num}Phone`]       = guest.phone;
    guestData[`guest${num}Birthplace`]     = guest.birthplace;
    guestData[`guest${num}Birthday`]       = guest.birthday ? formatDate(guest.birthday) : '';
    guestData[`guest${num}Email`]          = guest.email ?? '';
    guestData[`guest${num}PassportExpiry`] = guest.passportExpiry ? formatDate(guest.passportExpiry) : '';
    // Combined "Place & Date of Birth" — matches "PLACE & DATE OF BIRTH" in template
    guestData[`guest${num}PlaceAndDOB`] = [
      guest.birthplace,
      guest.birthday ? formatDate(guest.birthday) : '',
    ].filter(Boolean).join(', ');
  });

  // ── 2. Backward-compatible legacy guest tags
  const primaryGuest = data.guests[0];
  const legacyGuestData: Record<string, string> = {
    lesseeName:           primaryGuest?.name            ?? '',
    passportNumber:       primaryGuest?.passportNumber  ?? '',
    lesseeEmail:          primaryGuest?.email           ?? '',
    lesseePassportExpiry: primaryGuest?.passportExpiry ? formatDate(primaryGuest.passportExpiry) : '',
    lesseeBirthplace:     primaryGuest?.birthplace      ?? '',
    lesseeBirthday:       primaryGuest?.birthday ? formatDate(primaryGuest.birthday) : '',
    lesseePlaceAndDOB: [
      primaryGuest?.birthplace,
      primaryGuest?.birthday ? formatDate(primaryGuest.birthday) : '',
    ].filter(Boolean).join(', '),
  };

  // ── 3. Inclusion Yes/No flags (for table rows like "Banjar Fee: Yes/No")
  const inclusionYesNo = {
    cleaning2xYesNo:  data.inclusions.cleaning2x  ? 'Yes' : 'No',
    pool2xYesNo:      data.inclusions.pool2x       ? 'Yes' : 'No',
    internetYesNo:    data.inclusions.internet     ? 'Yes' : 'No',
    banjarFeeYesNo:   data.inclusions.banjarFee    ? 'Yes' : 'No',
    rubbishFeeYesNo:  data.inclusions.rubbishFee   ? 'Yes' : 'No',
    laundryYesNo:     data.inclusions.laundry      ? 'Yes' : 'No',
    electricityYesNo: data.inclusions.electricity  ? 'Yes' : 'No',
  };

  // ── 4. Lessor / Property Owner tags
  const lessor = data.lessor;
  const lessorData = {
    lessorName:        lessor.enabled ? lessor.name        : '',
    lessorIdNumber:    lessor.enabled ? lessor.idNumber     : '',
    lessorNationality: lessor.enabled ? lessor.nationality  : '',
    lessorAddress:     lessor.enabled ? lessor.address      : '',
    lessorPhone:       lessor.enabled ? lessor.phone        : '',
    lessorEmail:       lessor.enabled ? lessor.email        : '',
    hasLessor:         lessor.enabled,
  };

  // ── 5. Agent / PIC tags
  const agent = data.agent;
  const agentData = {
    // Agent — Partnership Type
    agentPartnershipType:  agent.enabled ? (agent.partnershipType === 'Others' ? agent.partnershipTypeOther : agent.partnershipType) : '',
    // Agent — Company
    agentCompany:       agent.enabled ? agent.company       : '',
    agentOfficeAddress: agent.enabled ? agent.officeAddress : '',
    agentOfficePhone:   agent.enabled ? agent.officePhone   : '',
    agentPicName:       agent.enabled ? agent.picName       : '',
    // Agent — PIC Personal Data
    agentFullName:      agent.enabled ? agent.fullName      : '',
    agentGender:        agent.enabled ? agent.gender        : '',
    agentMaritalStatus: agent.enabled ? agent.maritalStatus : '',
    agentBirthplace:    agent.enabled ? agent.birthplace    : '',
    agentBirthday:      agent.enabled && agent.birthday ? formatDate(agent.birthday) : '',
    agentNationality:   agent.enabled ? agent.nationality   : '',
    agentIdNumber:      agent.enabled ? agent.idNumber      : '',
    agentIdAddress:     agent.enabled ? agent.idAddress     : '',
    agentCurrentAddress: agent.enabled ? agent.currentAddress : '',
    agentPhone:         agent.enabled ? agent.phone         : '',
    agentEmail:         agent.enabled ? agent.email         : '',
    // Agent — Platforms (Yes/No flags)
    agentFacebook:       agent.enabled && agent.platforms.facebook       ? 'Yes' : 'No',
    agentInstagram:      agent.enabled && agent.platforms.instagram      ? 'Yes' : 'No',
    agentTiktok:         agent.enabled && agent.platforms.tiktok         ? 'Yes' : 'No',
    agentWebsite:        agent.enabled && agent.platforms.website        ? 'Yes' : 'No',
    agentBookingCom:     agent.enabled && agent.platforms.bookingCom     ? 'Yes' : 'No',
    agentAgoda:          agent.enabled && agent.platforms.agoda          ? 'Yes' : 'No',
    agentTraveloka:      agent.enabled && agent.platforms.traveloka      ? 'Yes' : 'No',
    agentTiketCom:       agent.enabled && agent.platforms.tiketCom       ? 'Yes' : 'No',
    agentPersonalNetwork: agent.enabled && agent.platforms.personalNetwork ? 'Yes' : 'No',
    // Agent — Bank Details
    agentBankName:          agent.enabled ? agent.bankName          : '',
    agentBankAccountHolder: agent.enabled ? agent.bankAccountHolder : '',
    agentBankAccountNumber: agent.enabled ? agent.bankAccountNumber : '',
    hasAgent: agent.enabled,
  };

  // ── 6. Commission calculation base label
  const isOwner = data.copyType === 'OWNER';
  let commissionBaseLabel = '';
  // On split-agent deals the rate shown must be the agent's %, not TVM's commissionPercent.
  const labelPercent = data.commissionSource === 'split_agent'
    ? data.agentCommissionPercent
    : data.commissionPercent;
  if (data.commissionType === 'percent_total')   commissionBaseLabel = `${labelPercent}% of Total Rent`;
  if (data.commissionType === 'percent_monthly') commissionBaseLabel = `${labelPercent}% of Monthly Rent`;
  if (data.commissionType === 'fixed')           commissionBaseLabel = 'Fixed Amount';

  // ── 6b. Currency-aware amount formatter
  const currency = data.paymentCurrency ?? 'IDR';
  const formatAmount = (n: number): string => {
    if (currency === 'IDR') return formatIDR(n);
    return new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(n);
  };

  // ── 6c. Template-exact aliases — these names match {{tag}} in LEASE_AGREEMENT_FINAL.docx
  const today = new Date().toISOString().split('T')[0];
  const templateExactAliases = {
    // {{createdDate}} — date the contract is generated
    createdDate: formatDate(today),

    // {{birthday}} — "Place & Date of Birth" combined (matches template row label)
    birthday: legacyGuestData.lesseePlaceAndDOB,

    // {{nationality}} / {{phone}} — short aliases for primary guest fields
    nationality: primaryGuest?.nationality ?? '',
    phone:       primaryGuest?.phone       ?? '',

    // {{propertyCode}} — property reference code
    propertyCode: data.propertyCode ?? '',

    // {{firstPaymentAmount}} — first payment amount (free text)
    firstPaymentAmount: data.firstPaymentAmount ?? '',

    // {{firstPaymentDueDate}} — alias for paymentDueDate
    firstPaymentDueDate: formatDate(data.paymentDueDate),

    // {{followingPayments}} — combines followingPaymentAmount + followingPaymentDueDate
    followingPayments: [
      data.followingPaymentAmount,
      data.followingPaymentDueDate ? `due ${formatDate(data.followingPaymentDueDate)}` : '',
    ].filter(Boolean).join(' — '),

    // {{paymentTerms}} — free text payment terms
    paymentTerms: data.paymentTerms ?? '',

    // {{paymentCurrency}} — selected currency
    paymentCurrency: currency,

    // Signature placeholders — left blank for manual signing
    lessorSignature: '',
    lesseeSignature: '',
  };

  // ── 7. Build full template context
  const templateData = {
    ...data,
    ...computed,
    ...legacyGuestData,
    ...guestData,
    ...inclusionYesNo,
    ...lessorData,
    ...agentData,
    ...templateExactAliases,   // ← must come AFTER guestData/legacyGuestData so aliases win

    // Dates — consistent Indonesian format
    checkInDate:    formatDate(data.checkInDate),
    checkOutDate:   formatDate(data.checkOutDate),
    paymentDueDate: formatDate(data.paymentDueDate),

    // Currency — formatted based on selected paymentCurrency
    totalPrice:      formatAmount(data.totalPrice),
    monthlyPrice:    formatAmount(data.monthlyPrice),
    securityDeposit: formatAmount(computed.securityDeposit),

    // Raw numeric values
    totalPriceRaw:      data.totalPrice,
    monthlyPriceRaw:    data.monthlyPrice,
    securityDepositRaw: computed.securityDeposit,

    // Copy type
    copyType:     data.copyType,
    isOwnerCopy:  data.copyType === 'OWNER',
    isClientCopy: data.copyType === 'CLIENT',
    isAgentCopy:  data.copyType === 'AGENT',

    // Commission — only injected on OWNER copy
    commissionSource:        isOwner ? data.commissionSource : '',
    commissionType:          data.commissionType,
    commissionTypeLabel:     commissionBaseLabel,
    commissionPercent:       data.commissionPercent,
    commissionAmount:        isOwner ? formatAmount(data.commissionAmount) : '',
    commissionAmountRaw:     isOwner ? data.commissionAmount : 0,
    commissionNotes:         isOwner ? data.commissionNotes : '',
    // Split-with-agent extras
    agentCommissionPercent:  isOwner ? data.agentCommissionPercent : 0,
    agentCommissionAmount:   isOwner ? formatAmount(data.agentCommissionAmount) : '',
    agentCommissionAmountRaw: isOwner ? data.agentCommissionAmount : 0,
    tvmSplitPercent:         isOwner ? data.tvmSplitPercent : 0,
    // Net to owner — deducts agent commission when split_agent, TVM commission when from_owner
    netOwnerAmount: isOwner
      ? formatAmount(data.totalPrice - (data.commissionSource === 'split_agent' ? data.agentCommissionAmount : data.commissionAmount))
      : '',
    netOwnerAmountRaw: isOwner
      ? data.totalPrice - (data.commissionSource === 'split_agent' ? data.agentCommissionAmount : data.commissionAmount)
      : 0,

    // Bank details — PT The Villa Managers / CIMB NIAGA (always injected)
    bankName:        BANK.name,
    bankBranch:      BANK.branch,
    bankAccountName: BANK.accountName,
    bankIDR:         BANK.idr,
    bankAUD:         BANK.aud,
    bankEUR:         BANK.eur,
    bankSWIFT:       BANK.swift,
    bankCode:        BANK.bankCode,
    bankBranchCode:  BANK.branchCode,
    // {{bankAccountNumber}} — picks the right account number for the chosen currency
    bankAccountNumber: currency === 'EUR' ? BANK.eur : currency === 'AUD' ? BANK.aud : BANK.idr,

    // {{securityDepositPercentage}} — e.g. "10%" or the override expressed as a %
    securityDepositPercentage: data.securityDepositOverride > 0 && data.totalPrice > 0
      ? `${Math.round(data.securityDepositOverride / data.totalPrice * 100)}%`
      : '10%',

    // {{paymentMethod}} — free text; defaults to "Bank Transfer" if not in paymentTerms
    paymentMethod: data.paymentTerms
      ? data.paymentTerms
      : 'Bank Transfer',

    // {{includedItems}} — same content as {{inclusionsList}}, alias for templates using this name
    includedItems: computed.inclusionsList,

    // {{excludedItems}} — the items NOT ticked; useful for templates that list exclusions
    excludedItems: (() => {
      const excluded: string[] = [];
      if (!data.inclusions.cleaning2x)  excluded.push('Cleaning 2x/week');
      if (!data.inclusions.pool2x)      excluded.push('Pool Maintenance 2x/week');
      if (!data.inclusions.internet)    excluded.push('Internet / WiFi');
      if (!data.inclusions.banjarFee)   excluded.push('Banjar Fee');
      if (!data.inclusions.rubbishFee)  excluded.push('Rubbish Collection Fee');
      if (!data.inclusions.laundry)     excluded.push('Laundry Linen & Towels');
      if (!data.inclusions.electricity) excluded.push('Electricity');
      return excluded.length > 0 ? excluded.join(', ') : 'None';
    })(),

    // ── UPPERCASE aliases for the "3RD PARTY LEASE AGREEMENT" template format ──────────────
    // Property
    PROPERTY_NAME:       data.villaName,
    PROPERTY_ADDRESS:    data.villaAddress,
    PROPERTY_CODE:       data.propertyCode ?? '',
    NUMBER_OF_BEDROOMS:  String(data.bedrooms),
    // Dates & Duration
    AGREEMENT_DATE:      formatDate(today),
    START_DATE:          formatDate(data.checkInDate),
    END_DATE:            formatDate(data.checkOutDate),
    CHECK_IN_DATE_TIME:  formatDate(data.checkInDate),
    CHECK_OUT_DATE_TIME: formatDate(data.checkOutDate),
    LEASE_DURATION:      computed.numberOfNights > 0
      ? `${computed.numberOfNights} nights (${computed.numberOfMonths} months)`
      : '',
    // Financials
    MONTHLY_RENT_AMOUNT:      formatAmount(data.monthlyPrice),
    TOTAL_RENT_AMOUNT:        formatAmount(data.totalPrice),
    CURRENCY:                 currency,
    SECURITY_DEPOSIT_AMOUNT:  formatAmount(computed.securityDeposit),
    FIRST_PAYMENT_AMOUNT:     data.firstPaymentAmount ?? '',
    FIRST_PAYMENT_DUE_DATE:   formatDate(data.paymentDueDate),
    FOLLOWING_PAYMENT_DETAILS: [
      data.followingPaymentAmount,
      data.followingPaymentDueDate ? `due ${formatDate(data.followingPaymentDueDate)}` : '',
    ].filter(Boolean).join(' — '),
    PAYMENT_METHOD: data.paymentTerms || 'Bank Transfer',
    // Lessee (Guest)
    LESSEE_NAME:           primaryGuest?.name            ?? '',
    LESSEE_NATIONALITY:    primaryGuest?.nationality     ?? '',
    LESSEE_PASSPORT_NUMBER: primaryGuest?.passportNumber ?? '',
    LESSEE_KTP_NUMBER:     primaryGuest?.passportNumber  ?? '', // same field
    LESSEE_PHONE:          primaryGuest?.phone           ?? '',
    LESSEE_BIRTH_PLACE_DATE: legacyGuestData.lesseePlaceAndDOB,
    LESSEE_ADDRESS:         '',  // not collected — fill manually
    LESSEE_EMAIL:           primaryGuest?.email ?? '',
    LESSEE_PASSPORT_EXPIRY: primaryGuest?.passportExpiry ? formatDate(primaryGuest.passportExpiry) : '',
    // Lessor (Property Owner)
    LESSOR_NAME:            lessor.enabled ? lessor.name        : '',
    LESSOR_NATIONALITY:     lessor.enabled ? lessor.nationality : '',
    LESSOR_ADDRESS:         lessor.enabled ? lessor.address     : '',
    LESSOR_PHONE:           lessor.enabled ? lessor.phone       : '',
    LESSOR_EMAIL:           lessor.enabled ? lessor.email       : '',
    LESSOR_KTP_NUMBER:      lessor.enabled ? lessor.idNumber      : '',
    LESSOR_PASSPORT_NUMBER: lessor.enabled ? lessor.idNumber      : '',
    LESSOR_BIRTH_PLACE_DATE: '', // not collected — fill manually
    LESSOR_PASSPORT_EXPIRY: lessor.enabled && lessor.passportExpiry
      ? formatDate(lessor.passportExpiry) : '',
    // Owner/TVM bank (where lessee pays)
    OWNER_BANK_NAME:      BANK.name,
    OWNER_ACCOUNT_NAME:   BANK.accountName,
    OWNER_ACCOUNT_NUMBER: currency === 'EUR' ? BANK.eur : currency === 'AUD' ? BANK.aud : BANK.idr,
    // Agent / Commission
    AGENT_REPRESENTATIVE_NAME: agent.enabled
      ? (agent.picName || agent.fullName || agent.company)
      : '',
    COMMISSION_PERCENTAGE: data.agentCommissionPercent > 0
      ? `${data.agentCommissionPercent}%`
      : data.commissionPercent > 0 ? `${data.commissionPercent}%` : '',
    COMMISSION_PAYMENT_TERMS: data.commissionNotes || '',
    REMITTANCE_DAYS: data.remittanceDays || '',
    // Inclusions — frequency text
    CLEANING_FREQUENCY:   data.inclusions.cleaning2x  ? '2x per week'  : 'Not included',
    POOL_CLEANING_FREQUENCY: data.inclusions.pool2x   ? '2x per week'  : 'Not included',
    LINEN_CHANGE_FREQUENCY:  data.inclusions.laundry  ? '1x per stay'  : 'Not included',
    BANJAR_FEES_YN:       data.inclusions.banjarFee   ? 'Yes' : 'No',
    GARBAGE_FEES_YN:      data.inclusions.rubbishFee  ? 'Yes' : 'No',
  };

  // ── 8. Render
  try {
    doc.render(templateData);
  } catch (err: unknown) {
    // Docxtemplater v3 throws a structured error object with a `properties.errors` array.
    // Surface the human-readable messages from each sub-error, falling back to err.message.
    if (err && typeof err === 'object' && 'properties' in err) {
      const dtErr = err as { properties?: { errors?: Array<{ message?: string }> } };
      const subMessages = dtErr.properties?.errors
        ?.map(e => e.message)
        .filter(Boolean)
        .join('; ');
      if (subMessages) throw new Error(`Template rendering failed: ${subMessages}`);
    }
    const message = err instanceof Error ? err.message : 'Unknown template error';
    throw new Error(`Template rendering failed: ${message}`);
  }

  // ── 9. Build filename with copy type suffix
  // Allowlist safe filename chars — villa/guest names may contain slashes, control
  // chars or reserved characters that would break the download or the OS.
  const safe = (s: string) => (s || '').replace(/[^\w.-]+/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '').slice(0, 60);
  const guestFirstName = safe(primaryGuest?.name?.split(' ')[0] || '') || 'Guest';
  const villaSlug      = safe(data.villaName || '') || 'Contract';
  const filename = `Contract_${villaSlug}_${guestFirstName}_${data.copyType}.docx`;

  const outBuffer = doc.getZip().generate({
    type: 'arraybuffer',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  }) as ArrayBuffer;

  return { buffer: outBuffer, filename };
};

/** Trigger a local browser download of a filled contract buffer. */
export const downloadContractLocally = (buffer: ArrayBuffer, filename: string): void => {
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
  saveAs(blob, filename);
};
