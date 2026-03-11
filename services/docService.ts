import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import { saveAs } from 'file-saver';
import { ContractData, ComputedData } from '../types';
// Fixed: import shared formatters instead of duplicating inline
import { formatIDR, formatDate } from '../utils/format';

// âââ generateDocument âââââââââââââââââââââââââââââââââââââââââââââââââââââ
// Reads a .docx template (from a local File OR an ArrayBuffer from Google
// Drive), injects all contract data, and returns the filled content as an
// ArrayBuffer so the caller can decide: download locally or save to Drive.
//
// Fixed:
//  1. Accepts File | ArrayBuffer â works with both local upload and Drive fetch.
//  2. Returns { buffer, filename } â caller chooses download or Drive upload.
//  3. Uses file.arrayBuffer() instead of the legacy FileReader callback API.
//  4. Uses shared formatIDR / formatDate from utils (no duplication).
//  5. Better filename fallback (no trailing underscore when name is empty).
//  6. Surfaces the actual Docxtemplater error message to the caller.
//  7. Consistent Indonesian date format regardless of browser locale.

export interface GenerateResult {
  buffer: ArrayBuffer;
  filename: string;
}

export const generateDocument = async (
  templateSource: File | ArrayBuffer,
  data: ContractData,
  computed: ComputedData
): Promise<GenerateResult> => {
  // Supports both a user-uploaded File and an ArrayBuffer fetched from Drive
  const buffer =
    templateSource instanceof ArrayBuffer
      ? templateSource
      : await templateSource.arrayBuffer();

  const zip = new PizZip(buffer);
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
  });

  // ââ 1. Flatten guest data into numbered tags (guest1Name, guest2Name, â¦)
  const guestData: Record<string, string> = {};
  data.guests.forEach((guest, index) => {
    const num = index + 1;
    guestData[`guest${num}Name`]        = guest.name;
    guestData[`guest${num}Passport`]    = guest.passportNumber;
    guestData[`guest${num}Nationality`] = guest.nationality;
    guestData[`guest${num}Phone`]       = guest.phone;
    guestData[`guest${num}Birthday`]    = guest.birthday ? formatDate(guest.birthday) : '';
  });

  // ââ 2. Backward-compatible tags for templates built before the numbered
  //       guest system existed ({{lesseeName}}, {{passportNumber}})
  const primaryGuest = data.guests[0];
  const legacyGuestData: Record<string, string> = {
    lesseeName:     primaryGuest?.name           ?? '',
    passportNumber: primaryGuest?.passportNumber ?? '',
  };

  // ââ 3. Build the full template context
  const templateData = {
    // Raw data
    ...data,
    // Derived values
    ...computed,
    // Legacy guest tags (backward compat)
    ...legacyGuestData,
    // Numbered guest tags
    ...guestData,

    // Dates â use formatDate for consistent Indonesian format
    checkInDate:     formatDate(data.checkInDate),
    checkOutDate:    formatDate(data.checkOutDate),
    paymentDueDate:  formatDate(data.paymentDueDate),

    // Currency â use shared formatIDR
    totalPrice:      formatIDR(data.totalPrice),
    monthlyPrice:    formatIDR(data.monthlyPrice),
    securityDeposit: formatIDR(computed.securityDeposit),

    // Raw numeric values, in case the template needs math
    totalPriceRaw:      data.totalPrice,
    monthlyPriceRaw:    data.monthlyPrice,
    securityDepositRaw: computed.securityDeposit,
  };

  // ââ 4. Render
  try {
    doc.render(templateData);
  } catch (err: unknown) {
    // Surface the actual Docxtemplater error (e.g. missing tag syntax)
    const message = err instanceof Error ? err.message : 'Unknown template error';
    throw new Error(`Template rendering failed: ${message}`);
  }

  // ââ 5. Build filename
  const guestFirstName = primaryGuest?.name?.split(' ')[0] || 'Guest';
  const villaSlug      = data.villaName
    ? data.villaName.replace(/\s+/g, '_')
    : 'Contract';
  const filename = `Contract_${villaSlug}_${guestFirstName.replace(/\s+/g, '_')}.docx`;

  // âââ 6. Return buffer + filename â$ caller decides download vs Drive upload
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
