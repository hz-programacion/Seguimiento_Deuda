import { getApps, initializeApp } from 'firebase/app';
import {
  GoogleAuthProvider,
  User,
  getAuth,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import firebaseAppletConfig from '../../firebase-applet-config.json';
import { ComprobanteAdjunto, PeriodoID } from '../types/finance';

export const DRIVE_SCOPES = ['https://www.googleapis.com/auth/drive.file'];

const DRIVE_APP_NAME = 'argencaja-drive-workspace';
const ROOT_FOLDER_NAME = 'ArgenCaja Comprobantes';

function getDriveAuth() {
  const existing = getApps().find((a) => a.name === DRIVE_APP_NAME);
  const app = existing ?? initializeApp(firebaseAppletConfig, DRIVE_APP_NAME);
  return getAuth(app);
}

const driveAuth = getDriveAuth();
const driveProvider = new GoogleAuthProvider();
for (const scope of DRIVE_SCOPES) {
  driveProvider.addScope(scope);
}

// Caché estrictamente en memoria (nunca en localStorage ni sessionStorage)
let cachedAccessToken: string | null = null;
let isSigningIn = false;

export function initDriveAuth(
  onAuthSuccess?: (user: User, hasToken: boolean) => void,
  onSignedOut?: () => void
): () => void {
  return onAuthStateChanged(driveAuth, (user) => {
    if (user) {
      if (cachedAccessToken) {
        onAuthSuccess?.(user, true);
      } else if (!isSigningIn) {
        cachedAccessToken = null;
        onAuthSuccess?.(user, false);
      }
    } else {
      cachedAccessToken = null;
      onSignedOut?.();
    }
  });
}

export async function signInGoogleDrive(): Promise<{
  user: User;
  accessToken: string;
}> {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(driveAuth, driveProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error(
        'No se obtuvo el permiso de acceso a Google Drive. Intentá nuevamente.'
      );
    }
    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } finally {
    isSigningIn = false;
  }
}

export async function signOutGoogleDrive(): Promise<void> {
  await signOut(driveAuth);
  cachedAccessToken = null;
}

export function getDriveAccessToken(): string | null {
  return cachedAccessToken;
}

export function getDriveCurrentUser(): User | null {
  return driveAuth.currentUser;
}

async function driveFetch(
  url: string,
  token: string,
  init?: RequestInit
): Promise<Response> {
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
  });
  if (res.status === 401) {
    cachedAccessToken = null;
    throw new Error(
      'Tu sesión de Google Drive venció. Volvé a conectar tu cuenta.'
    );
  }
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(
      `Error de Google Drive (${res.status}): ${errText || res.statusText}`
    );
  }
  return res;
}

async function findOrCreateFolder(
  token: string,
  folderName: string,
  parentId?: string
): Promise<string> {
  const escaped = folderName.replace(/'/g, "\\'");
  const parentFilter = parentId
    ? ` and '${parentId}' in parents`
    : ` and 'root' in parents`;
  const q = encodeURIComponent(
    `name='${escaped}' and mimeType='application/vnd.google-apps.folder' and trashed=false${parentFilter}`
  );

  const searchRes = await driveFetch(
    `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)&spaces=drive`,
    token
  );
  const searchJson = (await searchRes.json()) as {
    files?: Array<{ id: string; name: string }>;
  };
  if (searchJson.files && searchJson.files.length > 0) {
    return searchJson.files[0].id;
  }

  const createRes = await driveFetch(
    'https://www.googleapis.com/drive/v3/files?fields=id,name',
    token,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
        ...(parentId ? { parents: [parentId] } : {}),
      }),
    }
  );
  const created = (await createRes.json()) as { id: string };
  return created.id;
}

export async function uploadReceiptToDrive(params: {
  file: File;
  periodo: PeriodoID;
  itemTitle: string;
  tipo: 'RESUMEN' | 'COMPROBANTE';
}): Promise<ComprobanteAdjunto> {
  const token = cachedAccessToken;
  if (!token) {
    throw new Error('Conectá tu cuenta de Google Drive antes de subir archivos.');
  }

  const rootFolderId = await findOrCreateFolder(token, ROOT_FOLDER_NAME);
  const monthFolderId = await findOrCreateFolder(
    token,
    params.periodo,
    rootFolderId
  );

  const prefix = params.tipo === 'RESUMEN' ? '[Resumen]' : '[Comprobante]';
  const cleanTitle = params.itemTitle.replace(/[\\/:*?"<>|]/g, '-').trim();
  const extMatch = params.file.name.match(/\.[a-zA-Z0-9]+$/);
  const ext = extMatch ? extMatch[0] : '';
  const targetName = `${prefix} ${cleanTitle} (${params.periodo})${ext}`;

  const metadata = {
    name: targetName,
    parents: [monthFolderId],
    description: `ArgenCaja · ${params.tipo} · Período ${params.periodo}`,
  };

  const boundary = `argencaja_${Date.now().toString(36)}`;
  const metaPart = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(
    metadata
  )}\r\n`;
  const fileHeader = `--${boundary}\r\nContent-Type: ${
    params.file.type || 'application/octet-stream'
  }\r\n\r\n`;
  const closing = `\r\n--${boundary}--`;

  const bodyBlob = new Blob([metaPart, fileHeader, params.file, closing]);

  const uploadRes = await driveFetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,webViewLink,createdTime',
    token,
    {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: bodyBlob,
    }
  );

  const uploaded = (await uploadRes.json()) as {
    id: string;
    name: string;
    mimeType: string;
    webViewLink?: string;
    createdTime?: string;
  };

  return {
    id: `adj-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    tipo: params.tipo,
    nombre: (uploaded.name || params.file.name).slice(0, 200),
    mimeType: (
      uploaded.mimeType ||
      params.file.type ||
      'application/octet-stream'
    ).slice(0, 120),
    driveFileId: uploaded.id.slice(0, 200),
    webViewLink: (
      uploaded.webViewLink || `https://drive.google.com/file/d/${uploaded.id}/view`
    ).slice(0, 600),
    subidoEn: (uploaded.createdTime || new Date().toISOString()).slice(0, 40),
  };
}

export async function deleteDriveFile(driveFileId: string): Promise<void> {
  const token = cachedAccessToken;
  if (!token) {
    throw new Error('Conectá tu cuenta de Google Drive para eliminar el archivo.');
  }
  await driveFetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(driveFileId)}`,
    token,
    { method: 'DELETE' }
  );
}
