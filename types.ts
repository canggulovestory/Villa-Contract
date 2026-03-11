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

// ─── Agent / Partner ──────────────────────────────────────────────────────
export type PartnershipType = 'Travel Agency' | 'Property Agent' | 'Freelance Agent' | 'OTA Partner' | 'Others' | '';

export interface AgentPlatforms {
  facebook:       boolean;
  instagram:      boolean;
  tiktok:         boolean;
  website:        boolean;
  bookingCom:     boolean;
  agoda:          boolean;
  traveloka:      boolean;
  tiketCom:       boolean;
  personalNetwork: boolean;
  others:         boolean;
}

export interface AgentData {
  enabled: boolean;

  // A. Partnership Type
  partnershipType:      PartnershipType;
  partnershipTypeOther: string;   // free-text when "Others"

  // B. Company Information
  company:       string;
  officeAddress: string;
  officePhone:   string;
  picName:       string;          // Agent PIC at company level

  // C. PIC / Agent Personal Data
  fullName:       string;         // Full name as per ID
  gender:         'Male' | 'Female' | '';
  maritalStatus:  'Single' | 'Married' | 'Divorced' | 'Widowed' | '';
  birthplace:     string;
  birthday:       string;         // ISO date
  nationality:    string;
  idNumber:       string;         // ID / Passport / Business Card No.
  idAddress:      string;         // Address as per ID
  currentAddress: string;         // Current address if different
  phone:          string;
  email:          string;

  // D. Sales Platforms
  platforms: AgentPlatforms;

  // E. Bank Details (for commission payment)
  bankName:          string;
  bankAccountHolder: string;
  bankAccountNumber: string;
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
  paymentDueDate: string;        // kept for backward compat; docService also maps → firstPaymentDueDate
  firstPaymentAmount: string;    // free text e.g. "IDR 3,000,000 (security deposit)"
  followingPayments: string;     // free text e.g. "Balance due on check-in date"

  // Property Code
  propertyCode: string;          // e.g. "VS-001", maps → {{propertyCode}} in template

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

export const INITIAL_AGENT_PLATFORMS: AgentPlatforms = {
  facebook: false, instagram: false, tiktok: false, website: false,
  bookingCom: false, agoda: false, traveloka: false, tiketCom: false,
  personalNetwork: false, others: false,
};

export const INITIAL_AGENT: AgentData = {
  enabled: false,
  partnershipType: '',
  partnershipTypeOther: '',
  company: '',
  officeAddress: '',
  officePhone: '',
  picName: '',
  fullName: '',
  gender: '',
  maritalStatus: '',
  birthplace: '',
  birthday: '',
  nationality: '',
  idNumber: '',
  idAddress: '',
  currentAddress: '',
  phone: '',
  email: '',
  platforms: { ...INITIAL_AGENT_PLATFORMS },
  bankName: '',
  bankAccountHolder: '',
  bankAccountNumber: '',
};

export const INITIAL_DATA: ContractData = {
  villaName: '',
  villaAddress: '',
  bedrooms: 1,
  propertyCode: '',
  guests: [makeNewGuest(1)],
  checkInDate: '',
  checkOutDate: '',
  monthlyPrice: 0,
  totalPrice: 0,
  paymentDueDate: '',
  firstPaymentAmount: '',
  followingPayments: '',
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
