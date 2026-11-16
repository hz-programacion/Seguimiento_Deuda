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

export const WORKSPACE_SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/calendar.events',
];

const WORKSPACE_APP_NAME = 'argencaja-drive-workspace';

function getWorkspaceAuth() {
  const existing = getApps().find((a) => a.name === WORKSPACE_APP_NAME);
  const app = existing ?? initializeApp(firebaseAppletConfig, WORKSPACE_APP_NAME);
  return getAuth(app);
}

const workspaceAuth = getWorkspaceAuth();
const workspaceProvider = new GoogleAuthProvider();
for (const scope of WORKSPACE_SCOPES) {
  workspaceProvider.addScope(scope);
}
workspaceProvider.setCustomParameters({
  prompt: 'consent',
});

// Caché estrictamente en memoria (nunca en localStorage ni sessionStorage)
let cachedAccessToken: string | null = null;
let isSigningIn = false;

export function initWorkspaceAuth(
  onAuthSuccess?: (user: User, hasToken: boolean) => void,
  onSignedOut?: () => void
): () => void {
  return onAuthStateChanged(workspaceAuth, (user) => {
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

export async function signInGoogleWorkspace(): Promise<{
  user: User;
  accessToken: string;
}> {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(workspaceAuth, workspaceProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error(
        'No se obtuvo el permiso de Google Workspace (Drive y Calendario). Intentá nuevamente.'
      );
    }
    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } finally {
    isSigningIn = false;
  }
}

export async function signOutGoogleWorkspace(): Promise<void> {
  await signOut(workspaceAuth);
  cachedAccessToken = null;
}

export function getWorkspaceAccessToken(): string | null {
  return cachedAccessToken;
}

export function clearWorkspaceAccessToken(): void {
  cachedAccessToken = null;
}

export function getWorkspaceCurrentUser(): User | null {
  return workspaceAuth.currentUser;
}
