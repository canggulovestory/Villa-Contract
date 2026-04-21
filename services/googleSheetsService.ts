// ─── Google Sheets Write Service ──────────────────────────────────────────────
// Writes contract, agent, and owner data to Google Sheets tabs.
// Uses the same OAuth token from googleDriveService.ts (spreadsheets scope required).
//
// Tab names are fixed by convention — created automatically if missing:
//   "Contracts"  — one row per generated contract
//   "Agents"     — one row per agent profile
//   "Owners"     — one row per owner/lessor profile

import { getAccessToken } from './googleDriveService';
import type { ContractData, ComputedData, AgentData, LessorData } from '../types';

// ─── Config ──────────────────────────────────────────────────────────────────
const SHEET_ID = import.meta.env.VITE_VILLA_SHEET_ID || '';

const CONTRACTS_TAB = 'Contracts';
const AGENTS_TAB    = 'Agents';
const OWNERS_TAB    = 'Owners';

const CONTRACTS_HEADERS = [
  'Contract Date', 'Villa', 'Property Code', 'Guest Name', 'Passport No.',
  'Nationality', 'Phone', 'Check-in', 'Check-out', 'Nights',
  'Currency', 'Monthly Price', 'Total Price', 'Security Deposit',
  'Agent', 'Commission', 'Copy Type', 'Drive Link', 'Status', 'Additional Guests',
];

const AGENTS_HEADERS = [
  'Company', 'Partnership Type', 'PIC Name', 'Phone', 'Email',
  'ID Number', 'Bank Name', 'Bank Account', 'Platforms', 'Date Added',
];

const OWNERS_HEADERS = [
  'Name', 'ID Number', 'Nationality', 'Address', 'Phone', 'Email', 'Date Added',
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

const sheetsApi = (path: string, init?: RequestInit) => {
  const token = getAccessToken();
  if (!token) throw new Error('Not signed in to Google');
  return fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  });
};

/** Get all sheet/tab names in the spreadsheet */
const getTabNames = async (): Promise<string[]> => {
  const res = await sheetsApi('?fields=sheets.properties.title');
  if (!res.ok) throw new Error(`Sheets metadata error: ${res.status}`);
  const json = await res.json();
  return (json.sheets as any[]).map((s: any) => s.properties.title as string);
};

/** Create a new tab with headers in row 1 */
const createTab = async (tabName: string, headers: string[]): Promise<void> => {
  // 1. Add the sheet
  const addRes = await sheetsApi(':batchUpdate', {
    method: 'POST',
    body: JSON.stringify({
      requests: [{
        addSheet: { properties: { title: tabName } },
      }],
    }),
  });
  if (!addRes.ok) {
    const err = await addRes.text();
    throw new Error(`Failed to create tab "${tabName}": ${err}`);
  }

  // 2. Write header row
  const range = encodeURIComponent(`${tabName}!A1`);
  const writeRes = await sheetsApi(`/values/${range}?valueInputOption=RAW`, {
    method: 'PUT',
    body: JSON.stringify({ values: [headers] }),
  });
  if (!writeRes.ok) {
    const err = await writeRes.text();
    throw new Error(`Failed to write headers to "${tabName}": ${err}`);
  }
};

/** Ensure a tab exists; create it with headers if it doesn't */
const ensureTab = async (tabName: string, headers: string[]): Promise<void> => {
  const tabs = await getTabNames();
  if (!tabs.includes(tabName)) {
    await createTab(tabName, headers);
  }
};

/** Append a single row to a tab using values.append */
const appendRow = async (tabName: string, values: (string | number)[]): Promise<void> => {
  const range = encodeURIComponent(`${tabName}!A:A`);
  const res = await sheetsApi(
    `/values/${range}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    {
      method: 'POST',
      body: JSON.stringify({ values: [values] }),
    }
  );
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to append row to "${tabName}": ${err}`);
  }
};

/** Find a row index by matching a value in a specific column (0-indexed). Returns -1 if not found. */
const findRowByValue = async (tabName: string, colIndex: number, searchValue: string): Promise<number> => {
  const colLetter = String.fromCharCode(65 + colIndex); // A=0, B=1, etc.
  const range = encodeURIComponent(`${tabName}!${colLetter}:${colLetter}`);
  const res = await sheetsApi(`/values/${range}`);
  if (!res.ok) return -1;
  const json = await res.json();
  const rows: string[][] = json.values ?? [];
  for (let i = 1; i < rows.length; i++) { // skip header
    if (rows[i][0]?.trim().toLowerCase() === searchValue.trim().toLowerCase()) {
      return i + 1; // 1-indexed for Sheets API
    }
  }
  return -1;
};

/** Update a specific row in a tab */
const updateRow = async (tabName: string, rowNumber: number, values: (string | number)[]): Promise<void> => {
  const range = encodeURIComponent(`${tabName}!A${rowNumber}`);
  const res = await sheetsApi(`/values/${range}?valueInputOption=USER_ENTERED`, {
    method: 'PUT',
    body: JSON.stringify({ values: [values] }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to update row ${rowNumber} in "${tabName}": ${err}`);
  }
};

// ─── Public API ──────────────────────────────────────────────────────────────

const today = () => new Date().toISOString().split('T')[0];

/**
 * Log a generated contract to the Contracts tab.
 * Called after saveDealToDrive or handleDownload succeeds.
 */
export const appendContractRow = async (
  data: ContractData,
  computed: ComputedData,
  driveLink: string = '',
): Promise<void> => {
  if (!SHEET_ID) throw new Error('VITE_VILLA_SHEET_ID not configured');

  await ensureTab(CONTRACTS_TAB, CONTRACTS_HEADERS);

  const additionalGuests = data.guests
    .slice(1)
    .map(g => g.name)
    .filter(Boolean)
    .join(', ');

  const row: (string | number)[] = [
    today(),                                      // Contract Date
    data.villaName,                               // Villa
    data.propertyCode,                            // Property Code
    data.guests[0]?.name || '',                   // Guest Name
    data.guests[0]?.passportNumber || '',          // Passport No.
    data.guests[0]?.nationality || '',             // Nationality
    data.guests[0]?.phone || '',                   // Phone
    data.checkInDate,                              // Check-in
    data.checkOutDate,                             // Check-out
    computed.numberOfNights,                        // Nights
    data.paymentCurrency,                          // Currency
    data.monthlyPrice,                             // Monthly Price
    data.totalPrice,                               // Total Price
    computed.securityDeposit,                       // Security Deposit
    data.agent.enabled ? data.agent.company : '',  // Agent
    data.commissionAmount,                         // Commission
    data.copyType,                                 // Copy Type
    driveLink,                                     // Drive Link
    'Generated',                                   // Status
    additionalGuests,                              // Additional Guests
  ];

  await appendRow(CONTRACTS_TAB, row);
};

/**
 * Log or update an agent profile in the Agents tab.
 * Deduplicates by company name — updates existing row if found.
 */
export const saveAgentToSheet = async (agent: AgentData): Promise<void> => {
  if (!SHEET_ID) throw new Error('VITE_VILLA_SHEET_ID not configured');
  if (!agent.enabled) return; // skip if agent section is disabled

  await ensureTab(AGENTS_TAB, AGENTS_HEADERS);

  const platforms = Object.entries(agent.platforms)
    .filter(([, v]) => v)
    .map(([k]) => k)
    .join(', ');

  // Use same dedup key logic for the Company column so lookups always match
  const agentKey = (agent.company || agent.fullName || agent.picName).trim();
  const row: (string | number)[] = [
    agentKey,                        // Company (dedup key — company or name)
    agent.partnershipType,           // Partnership Type
    agent.fullName,                  // PIC Name
    agent.phone,                     // Phone
    agent.email,                     // Email
    agent.idNumber,                  // ID Number
    agent.bankName,                  // Bank Name
    agent.bankAccountNumber,         // Bank Account
    platforms,                       // Platforms
    today(),                         // Date Added
  ];

  // Dedup key: prefer company name, fall back to full name, then pic name
  const dedupKey = (agent.company || agent.fullName || agent.picName).trim();
  if (!dedupKey) {
    // No identifier to dedup on — just append so we don't accidentally match empty rows
    await appendRow(AGENTS_TAB, row);
    return;
  }

  const existingRow = await findRowByValue(AGENTS_TAB, 0, dedupKey);
  if (existingRow > 0) {
    await updateRow(AGENTS_TAB, existingRow, row);
  } else {
    await appendRow(AGENTS_TAB, row);
  }
};

/**
 * Log or update an owner/lessor profile in the Owners tab.
 * Deduplicates by name — updates existing row if found.
 */
export const saveOwnerToSheet = async (lessor: LessorData): Promise<void> => {
  if (!SHEET_ID) throw new Error('VITE_VILLA_SHEET_ID not configured');
  if (!lessor.enabled) return; // skip if lessor section is disabled

  await ensureTab(OWNERS_TAB, OWNERS_HEADERS);

  const row: (string | number)[] = [
    lessor.name,                     // Name
    lessor.idNumber,                 // ID Number
    lessor.nationality,              // Nationality
    lessor.address,                  // Address
    lessor.phone,                    // Phone
    lessor.email,                    // Email
    today(),                         // Date Added
  ];

  // Try to find existing row by name (column A = index 0)
  const existingRow = await findRowByValue(OWNERS_TAB, 0, lessor.name);
  if (existingRow > 0) {
    await updateRow(OWNERS_TAB, existingRow, row);
  } else {
    await appendRow(OWNERS_TAB, row);
  }
};

/**
 * Check if Sheets write is available (SHEET_ID configured + signed in).
 */
export const isSheetsWriteAvailable = (): boolean => {
  return SHEET_ID.length > 0 && getAccessToken() !== null;
};
