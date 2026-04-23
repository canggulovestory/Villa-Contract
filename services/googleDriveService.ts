// Google Drive Service (Browser-based) — SECURE (env vars)
// Uses Google Identity Services (GIS) for OAuth 2.0 in the browser
// and Google Drive API v3 via fetch to download/upload .docx files.
//
// Required: Load the GIS script in index.html:
//   <script src="https://accounts.google.com/gsi/client" async defer></script>
// ⚠️ IMPORTANT: Never hardcode API credentials in source code!

const CLIENT_ID       = import.meta.env.VITE_GOOGLE_CLIENT_ID  || '';
const API_KEY         = import.meta.env.VITE_GOOGLE_API_KEY    || '';
const TEMPLATE_FILE_ID        = import.meta.env.VITE_TEMPLATE_FILE_ID        || '';  // 3rd Party / Agent contract
const DIRECT_TEMPLATE_FILE_ID = import.meta.env.VITE_DIRECT_TEMPLATE_FILE_ID || '';  // Direct / Guest contract
const SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/spreadsheets',        // read + write (upgraded from readonly)
].join(' ');
const ROOT_FOLDER_NAME = 'Villa Contracts - TVM';

// ─── Sheets / Villa List ──────────────────────────────────────────────────────
const VILLA_SHEET_ID  = import.meta.env.VITE_VILLA_SHEET_ID   || '';
const VILLA_SHEET_GID = Number(import.meta.env.VITE_VILLA_SHEET_GID || '1674333214');

// ─── State ────────────────────────────────────────────────────────────────────
let accessToken: string | null = null;
let tokenClient: any = null;

// ─── Auth ─────────────────────────────────────────────────────────────────────
export const initGoogleAuth = (): Promise<void> => {
  return new Promise((resolve) => {
    let attempts = 0;
    const MAX_ATTEMPTS = 25; // 25 × 200ms = 5 s max wait for GIS script
    const check = () => {
      if (typeof google !== 'undefined' && (google as any).accounts?.oauth2) {
        tokenClient = (google as any).accounts.oauth2.initTokenClient({
          client_id: CLIENT_ID,
          scope: SCOPES,
          callback: () => {},
        });
        // Restore token from sessionStorage if available (from previous session)
        const savedToken = sessionStorage.getItem('google_access_token');
        if (savedToken) {
          accessToken = savedToken;
        }
        resolve();
      } else if (attempts >= MAX_ATTEMPTS) {
        // GIS script failed to load — resolve without token so app still starts
        console.warn('Google Identity Services script did not load within 5 s. Drive features will be unavailable.');
        resolve();
      } else {
        attempts++;
        setTimeout(check, 200);
      }
    };
    check();
  });
};

export const signInToGoogle = (): Promise<string> => {
  return new Promise((resolve, reject) => {
    if (!CLIENT_ID) {
      reject(new Error('Google Drive is not configured for this app. The VITE_GOOGLE_CLIENT_ID environment variable is missing. Please contact the administrator.'));
      return;
    }
    if (!tokenClient) {
      reject(new Error('Google Auth not initialised. Call initGoogleAuth() first.'));
      return;
    }
    tokenClient.callback = (response: any) => {
      if (response.error) {
        reject(new Error('Google sign-in failed: ' + response.error));
        return;
      }
      accessToken = response.access_token;
      // Persist token to sessionStorage so it survives page refresh
      sessionStorage.setItem('google_access_token', response.access_token);
      resolve(response.access_token);
    };
    // Use prompt: '' so returning users skip the consent screen (only shown on first auth)
    tokenClient.requestAccessToken({ prompt: '' });
  });
};

export const signOutFromGoogle = (): void => {
  if (accessToken && typeof google !== 'undefined') {
    (google as any).accounts.oauth2.revoke(accessToken, () => {});
  }
  accessToken = null;
  // Clear persisted token on logout
  sessionStorage.removeItem('google_access_token');
};

export const isSignedIn     = (): boolean       => accessToken !== null;
export const getAccessToken = (): string | null => accessToken;

// ─── Template Fetch ───────────────────────────────────────────────────────────

/** Fetch any Drive file — works for BOTH Google Docs (export) and uploaded .docx files (raw download). */
const fetchFileFromDrive = async (fileId: string): Promise<ArrayBuffer> => {
  if (!accessToken) throw new Error('Not signed in to Google');
  if (!fileId) throw new Error('Template file ID is not configured. Please set VITE_DIRECT_TEMPLATE_FILE_ID or VITE_TEMPLATE_FILE_ID in Vercel environment variables.');

  const authHeader = { Authorization: 'Bearer ' + accessToken };
  const DOCX_MIME  = 'application%2Fvnd.openxmlformats-officedocument.wordprocessingml.document';

  // ── Path 1: Google Doc export (converts Google Doc → .docx) ──────────────
  const exportUrl = `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=${DOCX_MIME}`;
  const exportRes = await fetch(exportUrl, { headers: authHeader });

  if (exportRes.ok) return exportRes.arrayBuffer();

  // 401 on export = token expired — clear and surface immediately
  if (exportRes.status === 401) {
    accessToken = null;
    sessionStorage.removeItem('google_access_token');
    throw new Error('Google session expired. Please reconnect Drive.');
  }

  // ── Path 2: Raw binary download (for uploaded .docx / .pdf files) ────────
  // The export API returns 4xx for non-Google-Workspace files (plain .docx uploads).
  // Fall back to the media download endpoint which works for any binary file.
  const downloadUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
  const downloadRes = await fetch(downloadUrl, { headers: authHeader });

  if (downloadRes.ok) return downloadRes.arrayBuffer();

  if (downloadRes.status === 401) {
    accessToken = null;
    sessionStorage.removeItem('google_access_token');
    throw new Error('Google session expired. Please reconnect Drive.');
  }

  // Both paths failed — surface the most useful error
  const errText = await downloadRes.text().catch(() => '');
  throw new Error(`Failed to fetch template from Drive (${downloadRes.status}). Make sure the file ID is correct and the file is shared with your Google account. ${errText}`);
};

/** Fetch the 3rd-Party / Agent contract template. */
export const fetchTemplateFromDrive = (): Promise<ArrayBuffer> =>
  fetchFileFromDrive(TEMPLATE_FILE_ID);

/** Fetch the Direct / Guest lease agreement template. */
export const fetchDirectTemplateFromDrive = (): Promise<ArrayBuffer> =>
  fetchFileFromDrive(DIRECT_TEMPLATE_FILE_ID);

// ─── Internal Helpers ─────────────────────────────────────────────────────────

/** Build a multipart/related body for Drive uploads */
const buildMultipart = (
  metadata: object,
  fileBytes: Uint8Array,
  fileMimeType: string,
  boundary: string
): Uint8Array => {
  const enc = new TextEncoder();
  const metaPart  = enc.encode(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`);
  const filePart  = enc.encode(`--${boundary}\r\nContent-Type: ${fileMimeType}\r\n\r\n`);
  const closePart = enc.encode(`\r\n--${boundary}--`);
  const body      = new Uint8Array(metaPart.length + filePart.length + fileBytes.length + closePart.length);
  let off = 0;
  body.set(metaPart,  off); off += metaPart.length;
  body.set(filePart,  off); off += filePart.length;
  body.set(fileBytes, off); off += fileBytes.length;
  body.set(closePart, off);
  return body;
};

/** Upload any file to a specific folder. Returns the new Drive file ID. */
const uploadFile = async (
  content: ArrayBuffer | File,
  filename: string,
  mimeType: string,
  folderId: string
): Promise<string> => {
  if (!accessToken) throw new Error('Not signed in to Google');

  const bytes    = content instanceof ArrayBuffer
    ? new Uint8Array(content)
    : new Uint8Array(await content.arrayBuffer());

  const boundary = 'tvm_boundary_' + Date.now();
  const body     = buildMultipart(
    { name: filename, parents: [folderId], mimeType },
    bytes, mimeType, boundary
  );

  const res = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: body.buffer,
    }
  );

  if (!res.ok) {
    if (res.status === 401) {
      accessToken = null;
      sessionStorage.removeItem('google_access_token');
      throw new Error('Google session expired. Please reconnect Drive.');
    }
    throw new Error(`Upload failed (${res.status}): ${await res.text()}`);
  }
  const json = await res.json();
  return json.id as string;
};

/**
 * Find a Drive folder by name (optionally under a parent).
 * Returns the folder ID if found, or null if not found.
 */
const findFolder = async (name: string, parentId?: string): Promise<string | null> => {
  if (!accessToken) throw new Error('Not signed in to Google');

  // Escape single quotes so villa names like "Villa D'Amour" don't break the query
  const escapedName = name.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  const q = parentId
    ? `name='${escapedName}' and mimeType='application/vnd.google-apps.folder' and '${parentId}' in parents and trashed=false`
    : `name='${escapedName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;

  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name)&pageSize=1`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!res.ok) throw new Error(`Folder search failed (${res.status})`);
  const json = await res.json();
  return json.files?.length > 0 ? (json.files[0].id as string) : null;
};

/** Create a Drive folder (optionally under a parent). Returns the folder ID. */
const createFolder = async (name: string, parentId?: string): Promise<string> => {
  if (!accessToken) throw new Error('Not signed in to Google');

  const meta: Record<string, unknown> = {
    name,
    mimeType: 'application/vnd.google-apps.folder',
  };
  if (parentId) meta.parents = [parentId];

  const res = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(meta),
  });

  if (!res.ok) throw new Error(`Folder creation failed (${res.status}): ${await res.text()}`);
  const json = await res.json();
  return json.id as string;
};

/** Find or create a folder. Returns folder ID. */
const getOrCreateFolder = async (name: string, parentId?: string): Promise<string> => {
  const existing = await findFolder(name, parentId);
  if (existing) return existing;
  return createFolder(name, parentId);
};

// ─── Deal Folder ──────────────────────────────────────────────────────────────

export interface PassportFile {
  file: File;
  guestName: string;
}

export interface DealSaveResult {
  folderLink: string;    // https://drive.google.com/drive/folders/...
  folderId:   string;
  contractFileLink: string; // https://drive.google.com/file/d/.../view
}

/**
 * Creates a deal folder under "Villa Contracts - TVM" and saves:
 *  - All passport images
 *  - A copy of the template
 *  - The generated contract
 *
 * Folder structure:
 *   Villa Contracts - TVM/
 *     └── VillaSentosa_JohnSmith_20250401/
 *           ├── Passport_JohnSmith.jpg
 *           ├── Passport_JaneSmith.jpg
 *           ├── Template_VillaSentosa_JohnSmith_CLIENT.docx
 *           └── Contract_VillaSentosa_JohnSmith_CLIENT.docx
 */
export const saveDealToDrive = async (
  contractBuffer:   ArrayBuffer,
  contractFilename: string,
  templateBuffer:   ArrayBuffer,
  passportFiles:    PassportFile[],
  dealFolderName:   string
): Promise<DealSaveResult> => {
  if (!accessToken) throw new Error('Not signed in to Google');

  // 1. Get/create root folder "Villa Contracts - TVM"
  const rootFolderId = await getOrCreateFolder(ROOT_FOLDER_NAME);

  // 2. Create deal subfolder (always unique — append timestamp if name taken)
  const safeName = dealFolderName.replace(/[/\\:*?"<>|]/g, '_');
  let folderId: string;
  const existingId = await findFolder(safeName, rootFolderId);
  if (existingId) {
    // Use existing folder (same deal re-generated)
    folderId = existingId;
  } else {
    folderId = await createFolder(safeName, rootFolderId);
  }

  // 3. Upload passport images
  for (const { file, guestName } of passportFiles) {
    const ext      = file.name.includes('.') ? file.name.split('.').pop()! : 'jpg';
    const safeFn   = `Passport_${guestName.replace(/\s+/g, '_')}.${ext}`;
    const mime     = file.type || 'image/jpeg';
    await uploadFile(file, safeFn, mime, folderId);
  }

  // 4. Upload template copy
  const templateFilename = `Template_${contractFilename}`;
  const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  await uploadFile(templateBuffer, templateFilename, DOCX_MIME, folderId);

  // 5. Upload generated contract
  const contractFileId = await uploadFile(contractBuffer, contractFilename, DOCX_MIME, folderId);

  return {
    folderLink:       `https://drive.google.com/drive/folders/${folderId}`,
    folderId,
    contractFileLink: `https://drive.google.com/file/d/${contractFileId}/view`,
  };
};

export const getTemplateFileId = (): string => TEMPLATE_FILE_ID;

// ─── Villa List from Sheets ───────────────────────────────────────────────────

export interface VillaRow {
  name: string;
  address: string;
  bedrooms: number;
  propertyCode: string;
  monthlyPrice?: number;   // from "Price month" column if present
}

/**
 * Fetch the villa list from the configured Google Sheet.
 * 1. Resolves VILLA_SHEET_GID → sheet title via spreadsheets metadata.
 * 2. Fetches the sheet values (first 500 rows).
 * 3. Maps header columns dynamically (case-insensitive) to VillaRow fields.
 */
export const fetchVillaListFromSheets = async (): Promise<VillaRow[]> => {
  if (!accessToken) throw new Error('Not signed in to Google');

  // Step 1: get sheet name from GID
  const metaRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${VILLA_SHEET_ID}?fields=sheets.properties`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!metaRes.ok) throw new Error(`Sheets metadata error: ${metaRes.status}`);
  const meta = await metaRes.json();
  const sheetProps = (meta.sheets as any[]).find(
    (s: any) => s.properties.sheetId === VILLA_SHEET_GID
  )?.properties;
  if (!sheetProps) throw new Error(`Sheet with GID ${VILLA_SHEET_GID} not found`);
  const sheetTitle: string = sheetProps.title;

  // Step 2: fetch values (up to 2000 rows — well above any realistic villa list)
  const range = encodeURIComponent(`${sheetTitle}!A1:Z2000`);
  const valRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${VILLA_SHEET_ID}/values/${range}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!valRes.ok) throw new Error(`Sheets values error: ${valRes.status}`);
  const valJson = await valRes.json();
  const rows: string[][] = valJson.values ?? [];
  if (rows.length < 2) return [];

  // Step 3: map headers — case-insensitive, supports your sheet's exact column names
  const headers = rows[0].map((h: string) => h.trim().toLowerCase());

  // colExact: match header exactly; colContains: match if header contains any key
  const colExact    = (keys: string[]): number => headers.findIndex(h => keys.includes(h));
  const colContains = (keys: string[]): number => headers.findIndex(h => keys.some(k => h.includes(k)));
  const firstValid  = (...idxs: number[]): number => idxs.find(i => i !== -1) ?? -1;

  // "Listing title" (exact) > "villa name" / "name" / "villa" (contains)
  const nameCol    = firstValid(colExact(['listing title', 'listing']), colContains(['villa name', 'name', 'villa', 'title']));
  // "Area" (exact) > "address" / "location"
  const addrCol    = firstValid(colExact(['area', 'address', 'location', 'alamat']), colContains(['address', 'location', 'area', 'alamat']));
  // "BR" (exact) > "bedroom" / "beds"
  const bedroomCol = firstValid(colExact(['br', 'bedroom', 'bedrooms', 'beds', 'kamar']), colContains(['bedroom', 'beds', 'kamar']));
  // "Code" (exact) > "property code" / "ref"
  const codeCol    = firstValid(colExact(['code', 'kode', 'ref']), colContains(['property code', 'code', 'kode', 'ref']));
  // "Price month" (exact) > "monthly price"
  const priceMonthCol = firstValid(colExact(['price month', 'price/month', 'monthly price', 'harga bulan']), colContains(['price month', 'monthly price']));

  if (nameCol === -1) throw new Error('Could not find a villa name column ("Listing title" / "Name") in the sheet');

  // Parse a price cell — strips non-numeric chars (Rp, commas, spaces) → number
  const parsePrice = (raw: string): number => {
    const n = parseFloat(raw.replace(/[^\d.]/g, ''));
    return isNaN(n) ? 0 : n;
  };

  const villas: VillaRow[] = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const name = r[nameCol]?.trim();
    if (!name) continue;           // skip empty rows
    const villa: VillaRow = {
      name,
      address:      addrCol      !== -1 ? (r[addrCol]      ?? '').trim() : '',
      bedrooms:     bedroomCol   !== -1 ? (parseInt(r[bedroomCol] ?? '1') || 1) : 1,
      propertyCode: codeCol      !== -1 ? (r[codeCol]      ?? '').trim() : '',
    };
    if (priceMonthCol !== -1 && r[priceMonthCol]) {
      const p = parsePrice(r[priceMonthCol]);
      if (p > 0) villa.monthlyPrice = p;
    }
    villas.push(villa);
  }
  return villas;
};

declare const google: any;
