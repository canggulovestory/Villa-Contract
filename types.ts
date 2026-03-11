// ─── Type Definitions ─────────────────────────────────────────────────────

export type CopyType = 'CLIENT' | 'OWNER' | 'AGENT';
export type CommissionType = 'percent_total' | 'percent_monthly' | 'fixed';

export interface Guest {
  id: string;            // unique internal key for React lists
  name: string;
  birthplace: string;    // Place of birth (separate from birthday)
  birthday: string;      // ISO date string e.g. "1990-05-12"
  nationality: string;
  phone: string;
  passportNumber: string;
}

// ─── Lessor / Property Owner ───────────────────────────────────────────────
export interface LessorData {
  enabled: boolean;
  name: string;
  idNumber: string;       // KTP / Passport number
  nationality: string;
  address: string;
  phone: string;
  email: string;
}

// ─── Agent / PIC ──────────────────────────────────────────────────────────
export interface AgentData {
  enabled: boolean;
  picName: string;        // Person in Charge full name
  company: string;        // defaults to PT The Villa Managers
  position: string;       // e.g. Property Manager
  phone: string;
  email: string;
}

export interface ContractData {
  // Villa Details
  villaName: string;
  villaAddress: string;
  bedrooms: number;

  // Guests (Min 1, Max 4)
  guests: Guest[];

  // Stay Details
  checkInDate: string;
  checkOutDate: string;

  // Financials (IDR)
  monthlyPrice: number;
  totalPrice: number;
  paymentDueDate: string;

  // Commission (for OWNER copy)
  commissionType: CommissionType;    // basis for commission calculation
  commissionPercent: number;         // e.g. 15 = 15%
  commissionAmount: number;          // calculated or manually entered
  commissionNotes: string;           // e.g. "Paid within 7 days of check-in"

  // Contract copy type
  copyType: CopyType;

  // Lessor / Property Owner (optional)
  lessor: LessorData;

  // Agent / PIC (optional)
  agent: AgentData;

  // Inclusions
  inclusions: {
    cleaning2x: boolean;
    pool2x: boolean;
    internet: boolean;
    banjarFee: boolean;
    rubbishFee: boolean;
    laundry: boolean;
    electricity: boolean;
  };
  otherInclusions: string;
}

export interface ComputedData {
  numberOfNights: number;
  numberOfMonths: number;
  securityDeposit: number;
  inclusionsList: string;
}

// ─── Default Values ───────────────────────────────────────────────────────

export const makeNewGuest = (num: number): Guest => ({
  id: typeof crypto !== 'undefined' ? crypto.randomUUID() : String(Date.now() + num),
  name: '',
  birthplace: '',
  birthday: '',
  nationality: '',
  phone: '',
  passportNumber: '',
});

export const INITIAL_LESSOR: LessorData = {
  enabled: false,
  name: '',
  idNumber: '',
  nationality: 'Indonesian',
  address: '',
  phone: '',
  email: '',
};

export const INITIAL_AGENT: AgentData = {
  enabled: false,
  picName: '',
  company: 'PT The Villa Managers',
  position: 'Property Manager',
  phone: '',
  email: '',
};

export const INITIAL_DATA: ContractData = {
  villaName: '',
  villaAddress: '',
  bedrooms: 1,
  guests: [makeNewGuest(1)],
  checkInDate: '',
  checkOutDate: '',
  monthlyPrice: 0,
  totalPrice: 0,
  paymentDueDate: '',
  commissionType: 'percent_total',
  commissionPercent: 0,
  commissionAmount: 0,
  commissionNotes: '',
  copyType: 'CLIENT' as CopyType,
  lessor: { ...INITIAL_LESSOR },
  agent: { ...INITIAL_AGENT },
  inclusions: {
    cleaning2x: false,
    pool2x: false,
    internet: false,
    banjarFee: false,
    rubbishFee: false,
    laundry: false,
    electricity: false,
  },
  otherInclusions: '',
};
