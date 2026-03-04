import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import { saveAs } from 'file-saver';
import { ContractData, ComputedData } from '../types';

// Helper for IDR formatting
const formatIDR = (value: number) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

// Helper for generic currency formatting
const formatCurrency = (value: number, currency: string) => {
  if (!value || value === 0) return '';
  if (currency === 'IDR') return formatIDR(value);
  // For USD, EUR, USDT — use standard number formatting
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value) + ' ' + currency;
};

export const generateDocument = async (
  templateFile: File,
  data: ContractData,
  computed: ComputedData
) => {
  const reader = new FileReader();

  return new Promise<void>((resolve, reject) => {
    reader.onload = (e) => {
      const content = e.target?.result;
      if (!content) {
        reject(new Error("Failed to read template file"));
        return;
      }

      try {
        const zip = new PizZip(content as string | ArrayBuffer);
        const doc = new Docxtemplater(zip, {
          paragraphLoop: true,
          linebreaks: true,
        });

        // 1. Guest data
        const guestData: Record<string, string> = {};
        data.guests.forEach((guest, index) => {
          const num = index + 1;
          guestData[`guest${num}Name`] = guest.name;
          guestData[`guest${num}Passport`] = guest.passportNumber;
          guestData[`guest${num}Nationality`] = guest.nationality;
          guestData[`guest${num}Phone`] = guest.phone;
          guestData[`guest${num}Birthday`] = guest.birthday
            ? new Date(guest.birthday).toLocaleDateString('en-GB')
            : '';
        });

        // Primary guest mapped to legacy/generic tags
        const primaryGuest = data.guests[0];
        const genericGuestData = {
          lesseeName: primaryGuest.name,
          passportNumber: primaryGuest.passportNumber,
          nationality: primaryGuest.nationality,
          phone: primaryGuest.phone,
          birthday: primaryGuest.birthday
            ? new Date(primaryGuest.birthday).toLocaleDateString('en-GB')
            : '',
        };

        // 2. Currency-aware financial formatting
        const cur = data.paymentCurrency || 'IDR';
        const fmtTotal = cur === 'IDR'
          ? formatIDR(data.totalPrice)
          : formatCurrency(data.totalPrice, cur);
        const fmtMonthly = cur === 'IDR'
          ? formatIDR(data.monthlyPrice)
          : formatCurrency(data.monthlyPrice, cur);
        const fmtDeposit = cur === 'IDR'
          ? formatIDR(data.securityDeposit)
          : formatCurrency(data.securityDeposit, cur);
        const fmtFirst = cur === 'IDR'
          ? formatIDR(data.firstPaymentAmount)
          : formatCurrency(data.firstPaymentAmount, cur);
        const fmtFollowing = cur === 'IDR'
          ? formatIDR(data.followingPaymentAmount)
          : formatCurrency(data.followingPaymentAmount, cur);

        // 3. Prepare full template data
        const templateData = {
          // ---- LESSOR (Property Owner) ----
          lessorName: data.lessor.name,
          lessorAddressOrBirth: data.lessor.addressOrBirth,
          lessorCountry: data.lessor.country,
          lessorNIK: data.lessor.nik,

          // ---- VILLA / PROPERTY ----
          villaName: data.villaName,
          villaAddress: data.villaAddress,
          propertyCode: data.propertyCode,
          bedrooms: data.bedrooms,

          // ---- LESSEE (Lead Guest + all guests) ----
          ...genericGuestData,
          ...guestData,

          // ---- STAY ----
          checkInDate: data.checkInDate
            ? new Date(data.checkInDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
            : '',
          checkOutDate: data.checkOutDate
            ? new Date(data.checkOutDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
            : '',
          numberOfNights: computed.numberOfNights,
          numberOfMonths: computed.numberOfMonths,

          // ---- FINANCIALS ----
          paymentCurrency: cur,
          paymentTerms: data.paymentTerms,
          totalPrice: fmtTotal,
          monthlyPrice: fmtMonthly,
          securityDeposit: fmtDeposit,
          paymentDueDate: data.paymentDueDate
            ? new Date(data.paymentDueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
            : '',
          firstPaymentAmount: fmtFirst,
          firstPaymentDueDate: data.firstPaymentDueDate
            ? new Date(data.firstPaymentDueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
            : '',
          followingPaymentAmount: fmtFollowing,
          followingPaymentDueDate: data.followingPaymentDueDate
            ? new Date(data.followingPaymentDueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
            : '',
          paymentMethod: data.paymentMethod,
          bankDetailsIDR: data.bankDetailsIDR,
          wiseEuroAccount: data.wiseEuroAccount,
          cryptoWalletAddress: data.cryptoWalletAddress,

          // Raw numbers (for math or custom formatting in doc)
          totalPriceRaw: data.totalPrice,
          firstPaymentRaw: data.firstPaymentAmount,
          followingPaymentRaw: data.followingPaymentAmount,

          // ---- INCLUSIONS ----
          inclusionsList: computed.inclusionsList,
          otherInclusions: data.otherInclusions,

          // ---- AGENCY (always PT The Villa Managers) ----
          agencyName: 'PT The Villa Managers',
          agencyAddress: 'Jl Intan Permai, Kerobokan Kelod, Indonesia',
          agencyCountry: 'Indonesia',
          agencyNIB: '0702250138139',

          // ---- AGENT (if applicable) ----
          hasAgent: data.hasAgent ? 'Yes' : 'No',
          agentCompanyName: data.agent.companyName,
          agentPIC: data.agent.agentPIC,
          agentPhone: data.agent.whatsappNumber,
          agentEmail: data.agent.agentEmail,
          agentPartnershipType: data.agent.partnershipType,

          // ---- TODAY'S DATE ----
          todayDate: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
        };

        doc.render(templateData);

        const out = doc.getZip().generate({
          type: 'blob',
          mimeType:
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        });

        const filename = data.villaName
          ? `Contract_${data.villaName.replace(/\s+/g, '_')}_${primaryGuest.name.split(' ')[0] || 'Guest'}.docx`
          : `Contract_${primaryGuest.name.replace(/\s+/g, '_') || 'Guest'}.docx`;

        saveAs(out, filename);
        resolve();
      } catch (error) {
        console.error("Doc Gen Error", error);
        reject(error);
      }
    };

    reader.onerror = () => reject(new Error("Error reading file"));
    reader.readAsBinaryString(templateFile);
  });
};
