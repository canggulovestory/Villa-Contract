// Google Drive Picker Service
// Requires VITE_GOOGLE_CLIENT_ID and VITE_GOOGLE_API_KEY env vars

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string;
const GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_API_KEY as string;

// ─── Fixed contract template on Google Drive ─────────────────────────────────
// This is the "Lease Agreement 3rd party Template.docx" owned by PT The Villa Managers.
// The system always fetches this automatically — no manual upload needed.
export const FIXED_TEMPLATE_FILE_ID = '1FaI-tBUkg2a8HBB4mGNoJ87z7p9AOX8x';
export const FIXED_TEMPLATE_NAME = 'Lease Agreement 3rd party Template.docx';

/**
 * Download a publicly-shared Google Drive file using only an API key (no OAuth needed).
 * Works for files shared as "Anyone with the link can view".
 */
export async function fetchPublicDriveFile(
  fileId: string,
  fileName: string = 'contract_template.docx'
): Promise<File> {
  if (!GOOGLE_API_KEY) throw new Error('VITE_GOOGLE_API_KEY not set');

  const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&key=${encodeURIComponent(GOOGLE_API_KEY)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Google Drive fetch failed (${res.status}): ${res.statusText}`);

  const blob = await res.blob();
  return new File([blob], fileName, { type: DOCX_MIME });
}

/**
 * Auto-load the fixed template from Google Drive (no popup, no OAuth).
 * Falls back to fetching from /template.docx (bundled in public folder).
 */
export async function autoLoadTemplate(): Promise<File> {
  // 1. Try Google Drive (requires VITE_GOOGLE_API_KEY to be set)
  if (GOOGLE_API_KEY) {
    try {
      const file = await fetchPublicDriveFile(FIXED_TEMPLATE_FILE_ID, FIXED_TEMPLATE_NAME);
      return file;
    } catch (e) {
      console.warn('Google Drive auto-fetch failed, trying bundled template:', e);
    }
  }

  // 2. Fall back to bundled template served from /public
  const res = await fetch('/template.docx');
  if (!res.ok) throw new Error(`Bundled template not found (${res.status})`);
  const blob = await res.blob();
  return new File([blob], 'contract_template.docx', { type: DOCX_MIME });
}
const SCOPE = 'https://www.googleapis.com/auth/drive.readonly';
const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const GDOC_MIME = 'application/vnd.google-apps.document';

const DEFAULT_TEMPLATE_KEY = 'villa_default_template';

export interface SavedTemplate {
    fileId: string;
    fileName: string;
    isGoogleDoc: boolean;
}

// --- Persist default template to localStorage ---
export function saveDefaultTemplate(t: SavedTemplate) {
    localStorage.setItem(DEFAULT_TEMPLATE_KEY, JSON.stringify(t));
}

export function loadDefaultTemplateMeta(): SavedTemplate | null {
    try {
        const raw = localStorage.getItem(DEFAULT_TEMPLATE_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

export function clearDefaultTemplate() {
    localStorage.removeItem(DEFAULT_TEMPLATE_KEY);
}

// --- Load a script tag dynamically ---
function loadScript(src: string): Promise<void> {
    return new Promise((resolve, reject) => {
        if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
        const s = document.createElement('script');
        s.src = src;
        s.onload = () => resolve();
        s.onerror = () => reject(new Error(`Failed to load ${src}`));
        document.head.appendChild(s);
    });
}

// --- Get an OAuth access token ---
async function getAccessToken(): Promise<string> {
    await loadScript('https://apis.google.com/js/api.js');
    await loadScript('https://accounts.google.com/gsi/client');

    return new Promise<string>((resolve, reject) => {
        const client = (window as any).google.accounts.oauth2.initTokenClient({
            client_id: GOOGLE_CLIENT_ID,
            scope: SCOPE,
            callback: (response: any) => {
                if (response.error) reject(new Error(response.error));
                else resolve(response.access_token);
            },
        });
        client.requestAccessToken({ prompt: 'select_account' });
    });
}

// --- Download a file from Drive as a File object ---
export async function fetchDriveFile(saved: SavedTemplate): Promise<File> {
    const token = await getAccessToken();

    const url = saved.isGoogleDoc
        ? `https://www.googleapis.com/drive/v3/files/${saved.fileId}/export?mimeType=${encodeURIComponent(DOCX_MIME)}`
        : `https://www.googleapis.com/drive/v3/files/${saved.fileId}?alt=media`;

    const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) throw new Error(`Failed to download file from Drive: ${res.statusText}`);

    const blob = await res.blob();
    const fileName = saved.fileName.endsWith('.docx') ? saved.fileName : saved.fileName + '.docx';
    return new File([blob], fileName, { type: DOCX_MIME });
}

// Helper: promise that rejects after ms milliseconds
function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(message)), ms);
        promise.then(
            (val) => { clearTimeout(timer); resolve(val); },
            (err) => { clearTimeout(timer); reject(err); }
        );
    });
}

// --- Open the Drive Picker ---
export async function openDrivePicker(onFilePicked: (file: File, meta: SavedTemplate) => void): Promise<void> {
    if (!GOOGLE_CLIENT_ID || !GOOGLE_API_KEY) {
        alert('Google Drive is not configured.\nPlease set VITE_GOOGLE_CLIENT_ID and VITE_GOOGLE_API_KEY in your .env file.');
        return;
    }

    // Load Google scripts (10s timeout each)
    await withTimeout(loadScript('https://apis.google.com/js/api.js'), 10000, 'Timed out loading Google API script.');
    await withTimeout(loadScript('https://accounts.google.com/gsi/client'), 10000, 'Timed out loading Google Identity script.');

    // Load picker module (10s timeout)
    await withTimeout(
        new Promise<void>((resolve, reject) => {
            (window as any).gapi.load('picker', { callback: resolve, onerror: reject });
        }),
        10000,
        'Timed out loading Google Picker. Please check your API Key or enable the Picker API in Google Cloud Console.'
    );

    // Get OAuth token — popup may be blocked by browser
    let token: string;
    try {
        token = await withTimeout(getAccessToken(), 60000, 'Google sign-in timed out. Please try again.');
    } catch (err: any) {
        if (err?.message?.includes('popup') || err?.message?.includes('blocked') || err?.message?.includes('timed out')) {
            throw new Error('Sign-in popup was blocked or timed out. Please allow popups for this site and try again.');
        }
        throw err;
    }

    await new Promise<void>((resolve, reject) => {
        const docxView = new (window as any).google.picker.DocsView()
            .setMimeTypes(DOCX_MIME)
            .setSelectFolderEnabled(false);

        const gDocView = new (window as any).google.picker.DocsView()
            .setMimeTypes(GDOC_MIME)
            .setSelectFolderEnabled(false);

        const picker = new (window as any).google.picker.PickerBuilder()
            .addView(docxView)
            .addView(gDocView)
            .setOAuthToken(token)
            .setDeveloperKey(GOOGLE_API_KEY)
            .setTitle('Select a .docx template or Google Doc')
            .setCallback(async (data: any) => {
                if (data.action === 'picked') {
                    const doc = data.docs[0];
                    const meta: SavedTemplate = {
                        fileId: doc.id,
                        fileName: doc.name,
                        isGoogleDoc: doc.mimeType === GDOC_MIME,
                    };
                    try {
                        const file = await fetchDriveFile(meta);
                        onFilePicked(file, meta);
                        resolve();
                    } catch (err) {
                        reject(err);
                    }
                } else if (data.action === 'cancel') {
                    resolve();
                }
            })
            .build();

        picker.setVisible(true);
    });
}
