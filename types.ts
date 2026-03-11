// ─── Type Definitions ─────────────────────────────────────────────────────

export interface Guest {
  id: string;            // unique internal key for React lists
  name: string;
  birthday: string;      // ISO date string e.g. "1990-05-12"
  nationality: string;
  phone: string;
  passportNumber: string;
}

export interface ContractData {
  // Villa Details
  villaName: string;
  villaAddress: string;
  bedrooms: number;       // must be >= 1

  // Guests (Min 1, Max 4)
  guests: Guest[];

  // Stay Details
  checkInDate: string;
  checkOutDate: string;

  // Financials (IDR)
  monthlyPrice: number;
  totalPrice: number;
  paymentDueDate: string;

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
  // Fixed: use crypto.randomUUID so IDs are always unique
  id: typeof crypto !== 'undefined' ? crypto.randomUUID() : String(Date.now() + num),
  name: '',
  birthday: '',
  nationality: '',
  phone: '',
  passportNumber: '',
});

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
  // Fixed: all inclusions default to false — users should consciously select
  // what is included rather than having everything pre-ticked.
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
