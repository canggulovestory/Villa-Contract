import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import { saveAs } from 'file-saver';
import { ContractData, ComputedData } from '../types';
import { formatIDR, formatDate } from '../utils/format';

// ─── generateDocument ─────────────────────────────────────────────────────
// Reads a .docx template (File or ArrayBuffer), injects all contract data,
// and returns { buffer, filename } so the caller can either download locally
// or upload to Google Drive.
//
// Accepts File | ArrayBuffer so it works with both local uploads and the
// ArrayBuffer returned by fetchTemplateFromDrive().

export const generateDocument = async (
  template: File | ArrayBuffer,
  data: ContractData,
  computed: ComputedData
): Promise<{ buffer: ArrayBuffer; filename: string }> => {
  // Resolve to ArrayBuffer regardless of input type
  const buffer = template instanceof File
    ? await template.arrayBuffer()
    : template;

  const zip = new PizZip(buffer);
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
  });

  // ── 1. Flatten guest data into numbered tags (guest1Name, guest2Name, …)
  const guestData: Record<string, string> = {};
  data.guests.forEach((guest, index) => {
    const num = index + 1;
    guestData[`guest${num}Name`]        = guest.name;
    guestData[`guest${num}Passport`]    = guest.passportNumber;
    guestData[`guest${num}Nationality`] = guest.nationality;
    guestData[`guest${num}Phone`]       = guest.phone;
    guestData[`guest${num}Birthday`]    = guest.birthday ? formatDate(guest.birthday) : '';
  });

  // ── 2. Backward-compatible tags for older templates
  const primaryGuest = data.guests[0];
  const legacyGuestData: Record<string, string> = {
    lesseeName:     primaryGuest?.name           ?? '',
    passportNumber: primaryGuest?.passportNumber ?? '',
  };

  // ── 3. Build the full template context
  const templateData = {
    ...data,
    ...computed,
    ...legacyGuestData,
    ...guestData,
    checkInDate:     formatDate(data.checkInDate),
    checkOutDate:    formatDate(data.checkOutDate),
    paymentDueDate:  formatDate(data.paymentDueDate),
    totalPrice:      formatIDR(data.totalPrice),
    monthlyPrice:    formatIDR(data.monthlyPrice),
    securityDeposit: formatIDR(computed.securityDeposit),
    totalPriceRaw:      data.totalPrice,
    monthlyPriceRaw:    data.monthlyPrice,
    securityDepositRaw: computed.securityDeposit,
  };

  // ── 4. Render
  try {
    doc.render(templateData);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown template error';
    throw new Error(`Template rendering failed: ${message}`);
  }

  // ── 5. Build filename
  const guestFirstName = primaryGuest?.name?.split(' ')[0] || 'Guest';
  const villaSlug = data.villaName
    ? data.villaName.replace(/\s+/g, '_')
    : 'Contract';
  const filename = `Contract_${villaSlug}_${guestFirstName.replace(/\s+/g, '_')}.docx`;

  // ── 6. Return buffer (caller decides whether to download or upload)
  const outBuffer = doc.getZip().generate({
    type: 'arraybuffer',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  }) as ArrayBuffer;

  return { buffer: outBuffer, filename };
};

// ─── downloadContractLocally ───────────────────────────────────────────────
// Triggers a browser download of the generated contract buffer.

export const downloadContractLocally = (buffer: ArrayBuffer, filename: string): void => {
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
  saveAs(blob, filename);
};
