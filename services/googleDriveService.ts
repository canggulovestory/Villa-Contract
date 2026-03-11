// Google Drive Service (Browser-based)
// Uses Google Identity Services (GIS) for OAuth 2.0 in the browser
// and Google Drive API v3 via fetch to download/upload .docx files.
//
// Required: Load the GIS script in index.html:
//   <script src="https://accounts.google.com/gsi/client" async defer></script>

const CLIENT_ID       = '507384430794-f2699okdpdv912dbtsvhs702khbchcn5.apps.googleusercontent.com';
const API_KEY         = 'AIzaSyALPN_RpFprlabHCHpP4VVF8IsyzzxiWaM';
const TEMPLATE_FILE_ID = '1FaI-tBUkg2a8HBB4mGNoJ87z7p9AOX8x';
const SCOPES = 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.readonly';
const ROOT_FOLDER_NAME = 'Villa Contracts - TVM';

// ─── State ────────────────────────────────────────────────────────────────────
let accessToken: string | null = null;
let tokenClient: any = null;

// ─── Auth ─────────────────────────────────────────────────────────────────────
export const initGoogleAuth = (): Promise<void> => {
  return new Promise((resolve) => {
    const check = () => {
      if (typeof google !== 'undefined' && (google as any).accounts?.oauth2) {
        tokenClient = (google as any).accounts.oauth2.initTokenClient({
          client_id: CLIENT_ID,
          scope: SCOPES,
          callback: () => {},
        });
        resolve();
      } else {
        setTimeout(check, 200);
      }
    };
    check();
  });
};

export const signInToGoogle = (): Promise<string> => {
  return new Promise((resolve, reject) => {
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
      resolve(response.access_token);
    };
    tokenClient.requestAccessToken({ prompt: 'consent' });
  });
};

export const signOutFromGoogle = (): void => {
  if (accessToken && typeof google !== 'undefined') {
    (google as any).accounts.oauth2.revoke(accessToken, () => {});
  }
  accessToken = null;
};

export const isSignedIn     = (): boolean       => accessToken !== null;
export const getAccessToken = (): string | null => accessToken;

// ─── Template Fetch ───────────────────────────────────────────────────────────
export const fetchTemplateFromDrive = async (): Promise<ArrayBuffer> => {
  if (!accessToken) throw new Error('Not signed in to Google');

  const url =
    'https://www.googleapis.com/drive/v3/files/' +
    TEMPLATE_FILE_ID +
    '/export?mimeType=application%2Fvnd.openxmlformats-officedocument.wordprocessingml.document';

  const res = await fetch(url, {
    headers: { Authorization: 'Bearer ' + accessToken },
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error('Failed to fetch template from Drive (' + res.status + '): ' + errText);
  }

  return res.arrayBuffer();
};

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

  if (!res.ok) throw new Error(`Upload failed (${res.status}): ${await res.text()}`);
  const json = await res.json();
  return json.id as string;
};

/**
 * Find a Drive folder by name (optionally under a parent).
 * Returns the folder ID if found, or null if not found.
 */
const findFolder = async (name: string, parentId?: string): Promise<string | null> => {
  if (!accessToken) throw new Error('Not signed in to Google');

  const q = parentId
    ? `name='${name}' and mimeType='application/vnd.google-apps.folder' and '${parentId}' in parents and trashed=false`
    : `name='${name}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;

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

// ─── Simple single-file save (legacy / quick save) ────────────────────────────
export const saveContractToDrive = async (
  buffer:   ArrayBuffer,
  filename: string
): Promise<string> => {
  if (!accessToken) throw new Error('Not signed in to Google');

  // Upload to root of Drive (no folder) — kept for backward compat
  const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  const boundary  = 'villa_contract_boundary';
  const body      = buildMultipart({ name: filename, mimeType: DOCX_MIME }, new Uint8Array(buffer), DOCX_MIME, boundary);

  const res = await fetch(
    `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&key=${API_KEY}`,
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
    const errText = await res.text();
    throw new Error('Failed to upload to Drive (' + res.status + '): ' + errText);
  }

  const json = await res.json();
  return 'https://drive.google.com/file/d/' + json.id + '/view';
};

export const getTemplateFileId = (): string => TEMPLATE_FILE_ID;

declare const google: any;
