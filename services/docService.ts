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
    guestData[`guest${num}Birthplace`]  = guest.birthplace;
    guestData[`guest${num}Birthday`]    = guest.birthday ? formatDate(guest.birthday) : '';
    // Combined "Place & Date of Birth" — matches "PLACE & DATE OF BIRTH" in template
    guestData[`guest${num}PlaceAndDOB`] = [
      guest.birthplace,
      guest.birthday ? formatDate(guest.birthday) : '',
    ].filter(Boolean).join(', ');
  });

  // ── 2. Backward-compatible legacy guest tags
  const primaryGuest = data.guests[0];
  const legacyGuestData: Record<string, string> = {
    lesseeName:       primaryGuest?.name            ?? '',
    passportNumber:   primaryGuest?.passportNumber  ?? '',
    lesseeBirthplace: primaryGuest?.birthplace      ?? '',
    lesseeBirthday:   primaryGuest?.birthday ? formatDate(primaryGuest.birthday) : '',
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
  if (data.commissionType === 'percent_total')   commissionBaseLabel = `${data.commissionPercent}% of Total Rent`;
  if (data.commissionType === 'percent_monthly') commissionBaseLabel = `${data.commissionPercent}% of Monthly Rent`;
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
  const guestFirstName = primaryGuest?.name?.split(' ')[0] || 'Guest';
  const villaSlug      = data.villaName
    ? data.villaName.replace(/\s+/g, '_')
    : 'Contract';
  const filename = `Contract_${villaSlug}_${guestFirstName.replace(/\s+/g, '_')}_${data.copyType}.docx`;

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
