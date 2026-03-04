export interface Guest {
  id: string;
  name: string;
  birthday: string;
  nationality: string;
  phone: string;
  passportNumber: string; // also accepts Business Card / Company Profile reference
}

// --- NEW: Lessor (Property Owner) ---
export interface LessorData {
  name: string;
  addressOrBirth: string; // Registered Address OR Place & Date of Birth
  country: string;        // Country of Incorporation / Nationality
  nik: string;            // National ID / NIK / Passport Number
}

// --- NEW: Agent / Partner Registration (A–F) ---
export interface AgentData {
  // A. Partnership Type
  partnershipType: string; // Travel Agency / Property Agent / Freelance Agent / OTA Partner / Others
  partnershipTypeOther: string;

  // B. Company Information
  companyName: string;
  officeAddress: string;
  officePhone: string;
  agentPIC: string; // Person in Charge

  // C. PIC / Agent Data
  picFullName: string;
  gender: string;
  placeOfBirth: string;
  dateOfBirth: string;
  picNationality: string;
  maritalStatus: string;
  idOrPassportNumber: string; // also accepts Business Card / Company Profile
  addressAsPerID: string;
  currentAddress: string;
  whatsappNumber: string;
  agentEmail: string;

  // D. Sales Platform
  facebook: string;
  instagram: string;
  tiktok: string;
  website: string;
  bookingCom: string;
  agoda: string;
  traveloka: string;
  tiketCom: string;
  personalNetwork: string;
  otherPlatform: string;

  // E. Bank Details (for commission payment)
  bankName: string;
  accountHolderName: string;
  bankAccountNumber: string;
}

export interface ContractData {
  // Villa / Property Details
  villaName: string;
  villaAddress: string;
  propertyCode: string; // NEW
  bedrooms: number;

  // Lessor (Property Owner) - NEW
  lessor: LessorData;

  // Guests / Lessee (Min 1, Max 4)
  guests: Guest[];

  // Stay Details
  checkInDate: string;
  checkOutDate: string;

  // Financials
  monthlyPrice: number;
  totalPrice: number;
  securityDeposit: number;
  paymentDueDate: string;

  // NEW payment fields
  paymentCurrency: string;    // IDR / USD / EUR / USDT
  paymentTerms: string;
  firstPaymentAmount: number;
  firstPaymentDueDate: string;
  followingPaymentAmount: number;
  followingPaymentDueDate: string;
  paymentMethod: string;      // IDR bank transfer / WISE / Crypto
  bankDetailsIDR: string;
  wiseEuroAccount: string;
  cryptoWalletAddress: string; // USDT TRC20

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

  // Agent / Partner - NEW
  hasAgent: boolean;
  agent: AgentData;
}

export interface ComputedData {
  numberOfNights: number;
  numberOfMonths: number;
  inclusionsList: string;
}

// ---- Initial / Default values ----

export const INITIAL_GUEST: Guest = {
  id: '1',
  name: '',
  birthday: '',
  nationality: '',
  phone: '',
  passportNumber: '',
};

export const INITIAL_LESSOR: LessorData = {
  name: '',
  addressOrBirth: '',
  country: '',
  nik: '',
};

export const INITIAL_AGENT: AgentData = {
  partnershipType: '',
  partnershipTypeOther: '',
  companyName: '',
  officeAddress: '',
  officePhone: '',
  agentPIC: '',
  picFullName: '',
  gender: '',
  placeOfBirth: '',
  dateOfBirth: '',
  picNationality: '',
  maritalStatus: '',
  idOrPassportNumber: '',
  addressAsPerID: '',
  currentAddress: '',
  whatsappNumber: '',
  agentEmail: '',
  facebook: '',
  instagram: '',
  tiktok: '',
  website: '',
  bookingCom: '',
  agoda: '',
  traveloka: '',
  tiketCom: '',
  personalNetwork: '',
  otherPlatform: '',
  bankName: '',
  accountHolderName: '',
  bankAccountNumber: '',
};

export const INITIAL_DATA: ContractData = {
  villaName: '',
  villaAddress: '',
  propertyCode: '',
  bedrooms: 1,
  lessor: { ...INITIAL_LESSOR },
  guests: [{ ...INITIAL_GUEST }],
  checkInDate: '',
  checkOutDate: '',
  monthlyPrice: 0,
  totalPrice: 0,
  securityDeposit: 0,
  paymentDueDate: '',
  paymentCurrency: 'IDR',
  paymentTerms: '',
  firstPaymentAmount: 0,
  firstPaymentDueDate: '',
  followingPaymentAmount: 0,
  followingPaymentDueDate: '',
  paymentMethod: 'IDR bank transfer',
  bankDetailsIDR: '',
  wiseEuroAccount: '',
  cryptoWalletAddress: '',
  inclusions: {
    cleaning2x: true,
    pool2x: true,
    internet: true,
    banjarFee: true,
    rubbishFee: true,
    laundry: true,
    electricity: true,
  },
  otherInclusions: '',
  hasAgent: false,
  agent: { ...INITIAL_AGENT },
};
