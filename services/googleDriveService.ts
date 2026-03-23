// Google Drive Service - Uses Environment Variables (SECURE)
// ⚠️ IMPORTANT: Never hardcode API credentials in source code!

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const API_KEY = import.meta.env.VITE_GOOGLE_API_KEY;
const TEMPLATE_FILE_ID = import.meta.env.VITE_TEMPLATE_FILE_ID;
const VILLA_SHEET_ID = import.meta.env.VITE_VILLA_SHEET_ID;

// Validate that all required environment variables are set
function validateEnvironmentVariables() {
  const required = ['VITE_GOOGLE_CLIENT_ID', 'VITE_GOOGLE_API_KEY', 'VITE_TEMPLATE_FILE_ID', 'VITE_VILLA_SHEET_ID'];
  const missing = required.filter(key => !import.meta.env[key]);

  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:', missing);
    throw new Error(`Missing environment variables: ${missing.join(', ')}. Please check your .env.local file.`);
  }
}

let tokenClient: any = null;
let accessToken = '';

interface UploadOptions {
  parentFolderId?: string;
  mimeType?: string;
}

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  webViewLink?: string;
  parents?: string[];
}

interface AuthInitOptions {
  onSuccess?: () => void;
  onError?: (error: string) => void;
}

export async function initGoogleAuth(options?: AuthInitOptions): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      validateEnvironmentVariables();
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Environment validation failed';
      console.error('Environment validation error:', errorMsg);
      options?.onError?.(errorMsg);
      reject(new Error(errorMsg));
      return;
    }

    if (!window.google) {
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = () => initializeTokenClient(resolve, reject, options);
      script.onerror = () => {
        const error = 'Failed to load Google Identity Services';
        console.error(error);
        options?.onError?.(error);
        reject(new Error(error));
      };
      document.head.appendChild(script);
    } else {
      initializeTokenClient(resolve, reject, options);
    }
  });
}

function initializeTokenClient(resolve: () => void, reject: (error: Error) => void, options?: AuthInitOptions) {
  try {
    if (!CLIENT_ID) {
      throw new Error('VITE_GOOGLE_CLIENT_ID not configured');
    }

    tokenClient = (window as any).google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: 'https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/spreadsheets.readonly',
      callback: (response: any) => {
        if (response.access_token) {
          accessToken = response.access_token;
          console.log('✅ Google authentication successful');
          options?.onSuccess?.();
          resolve();
        }
      },
      error_callback: (error: any) => {
        const errorMsg = error?.error_description || 'Authentication failed';
        console.error('Google auth error:', errorMsg);
        options?.onError?.(errorMsg);
        reject(new Error(errorMsg));
      }
    });
    console.log('✅ Google Identity Services initialized');
    resolve();
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Failed to initialize Google auth';
    console.error('Token client initialization error:', errorMsg);
    options?.onError?.(errorMsg);
    reject(new Error(errorMsg));
  }
}

export function requestAccessToken(): void {
  if (tokenClient) {
    tokenClient.requestAccessToken({ prompt: 'consent' });
  } else {
    console.error('Token client not initialized');
  }
}

export async function downloadTemplate(): Promise<ArrayBuffer> {
  try {
    if (!accessToken) {
      throw new Error('Not authenticated. Please sign in first.');
    }

    if (!TEMPLATE_FILE_ID) {
      throw new Error('Template file ID not configured');
    }

    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files/${TEMPLATE_FILE_ID}?alt=media`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to download template: ${response.status} ${response.statusText}`);
    }

    return await response.arrayBuffer();
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Failed to download template';
    console.error('Download template error:', errorMsg);
    throw error;
  }
}

export async function uploadContractToDrive(
  fileContent: ArrayBuffer,
  fileName: string,
  options: UploadOptions = {}
): Promise<DriveFile> {
  try {
    if (!accessToken) {
      throw new Error('Not authenticated. Please sign in first.');
    }

    const metadata = {
      name: fileName,
      mimeType: options.mimeType || 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      parents: options.parentFolderId ? [options.parentFolderId] : []
    };

    const formData = new FormData();
    formData.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    formData.append('file', new Blob([fileContent], { type: metadata.mimeType }));

    const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`
      },
      body: formData
    });

    if (!response.ok) {
      throw new Error(`Failed to upload file: ${response.status} ${response.statusText}`);
    }

    const fileData = await response.json();
    console.log('✅ Contract uploaded to Google Drive:', fileData.id);
    return fileData;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Failed to upload contract';
    console.error('Upload contract error:', errorMsg);
    throw error;
  }
}

export async function fetchVillaList(): Promise<any[]> {
  try {
    if (!accessToken) {
      throw new Error('Not authenticated. Please sign in first.');
    }

    if (!VILLA_SHEET_ID) {
      throw new Error('Villa sheet ID not configured');
    }

    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${VILLA_SHEET_ID}/values/Sheet1?key=${API_KEY}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch villa list: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const rows = data.values || [];

    if (rows.length === 0) {
      console.warn('⚠️ No villa data found in spreadsheet');
      return [];
    }

    const headers = rows[0];
    const villas = rows.slice(1).map((row: any[]) => {
      const villa: any = {};
      headers.forEach((header: string, index: number) => {
        villa[header.toLowerCase().replace(/\s+/g, '_')] = row[index] || '';
      });
      return villa;
    });

    console.log(`✅ Loaded ${villas.length} villas from spreadsheet`);
    return villas;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Failed to fetch villa list';
    console.error('Fetch villa list error:', errorMsg);
    throw error;
  }
}

export async function searchVillaByCode(code: string): Promise<any | null> {
  try {
    const villas = await fetchVillaList();
    return villas.find(v => v.property_code?.toLowerCase() === code.toLowerCase()) || null;
  } catch (error) {
    console.error('Search villa error:', error);
    return null;
  }
}

export function isAuthenticated(): boolean {
  return !!accessToken;
}

export function logout(): void {
  accessToken = '';
  console.log('✅ Logged out');
}
