// Google Drive Service (Browser-based)
// Uses Google Identity Services (GIS) for OAuth 2.0 in the browser
// and Google Drive API v3 via fetch to download/upload .docx files.
//
// Required: Load the GIS script in index.html:
//   <script src="https://accounts.google.com/gsi/client" async defer></script>

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '507384430794-f2699okdpdv912dbtsvhs702khbchcn5.apps.googleusercontent.com';
const API_KEY = import.meta.env.VITE_GOOGLE_API_KEY || 'AIzaSyALPN_RpFprlabHCHpP4VVF8IsyzzxiWaM';
const TEMPLATE_FILE_ID = '1FaI-tBUkg2a8HBB4mGNoJ87z7p9AOX8x';
const SCOPES = 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.readonly';

// State
let accessToken: string | null = null;
let tokenClient: any = null;

// Initialise - Call once on app mount. Waits for the GIS script to be ready.
export const initGoogleAuth = (): Promise<void> => {
  return new Promise((resolve) => {
    const check = () => {
      if (typeof google !== 'undefined' && (google as any).accounts?.oauth2) {
        tokenClient = (google as any).accounts.oauth2.initTokenClient({
          client_id: CLIENT_ID,
          scope: SCOPES,
          callback: () => { },
        });
        resolve();
      } else {
        setTimeout(check, 200);
      }
    };
    check();
  });
};

// Sign In - Opens the Google consent popup. Resolves with the access token.
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

// Sign Out
export const signOutFromGoogle = (): void => {
  if (accessToken && typeof google !== 'undefined') {
    (google as any).accounts.oauth2.revoke(accessToken, () => { });
  }
  accessToken = null;
};

// Check signed-in state
export const isSignedIn = (): boolean => accessToken !== null;
export const getAccessToken = (): string | null => accessToken;

// Fetch template from Drive
// Downloads the lease-agreement .docx template as an ArrayBuffer.
export const fetchTemplateFromDrive = async (): Promise<ArrayBuffer> => {
  if (!accessToken) throw new Error('Not signed in to Google');

  const url = 'https://www.googleapis.com/drive/v3/files/' + TEMPLATE_FILE_ID + '?alt=media&key=' + API_KEY;
  const res = await fetch(url, {
    headers: { Authorization: 'Bearer ' + accessToken },
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error('Failed to fetch template from Drive (' + res.status + '): ' + errText);
  }

  return res.arrayBuffer();
};

// Save filled contract to Drive
// Uploads the filled .docx buffer as a new file in the user's Drive.
// Returns the web-viewable link.
export const saveContractToDrive = async (
  buffer: ArrayBuffer,
  filename: string
): Promise<string> => {
  if (!accessToken) throw new Error('Not signed in to Google');

  const metadata = {
    name: filename,
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  };

  const boundary = '---villa_contract_boundary';
  const metaPart =
    '--' + boundary + '\r\n' +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) +
    '\r\n';

  const closePart = '\r\n--' + boundary + '--';

  const encoder = new TextEncoder();
  const metaBytes = encoder.encode(metaPart);
  const fileBytes = new Uint8Array(buffer);
  const midHeader = encoder.encode(
    '--' + boundary + '\r\nContent-Type: application/vnd.openxmlformats-officedocument.wordprocessingml.document\r\n\r\n'
  );
  const closeBytes = encoder.encode(closePart);

  const body = new Uint8Array(
    metaBytes.length + midHeader.length + fileBytes.length + closeBytes.length
  );
  let offset = 0;
  body.set(metaBytes, offset); offset += metaBytes.length;
  body.set(midHeader, offset); offset += midHeader.length;
  body.set(fileBytes, offset); offset += fileBytes.length;
  body.set(closeBytes, offset);

  const res = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&key=' + API_KEY,
    {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + accessToken,
        'Content-Type': 'multipart/related; boundary=' + boundary,
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

// Get template file ID (for external reference)
export const getTemplateFileId = (): string => TEMPLATE_FILE_ID;

// Declare google as global for TypeScript
declare const google: any;
