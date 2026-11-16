import React, { useEffect, useState } from 'react';
import {
  Cloud,
  Download,
  FolderOpen,
  LogOut,
  ShieldCheck,
  Upload,
  X,
} from 'lucide-react';
import { HouseholdRole, ItemFinanciero } from '../types/finance';
import { parseBackupItemsJson } from '../services/storageService';
import firebaseAppletConfig from '../../firebase-applet-config.json';

interface FirebaseConfigModalProps {
  items: ItemFinanciero[];
  canEditFinances: boolean;
  userRole: HouseholdRole;
  cloudStatus: 'local' | 'connected' | 'syncing';
  cloudUserEmail: string | null;
  driveUserEmail: string | null;
  hasDriveToken: boolean;
  onImportBackup: (items: ItemFinanciero[]) => void;
  onSignInDrive: () => Promise<void>;
  onSignOutDrive: () => Promise<void>;
  onClose: () => void;
}

export const FirebaseConfigModal: React.FC<FirebaseConfigModalProps> = ({
  items,
  canEditFinances,
  userRole,
  cloudStatus,
  cloudUserEmail,
  driveUserEmail,
  hasDriveToken,
  onImportBackup,
  onSignInDrive,
  onSignOutDrive,
  onClose,
}) => {
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [busy, onClose]);

  const handleExportJson = () => {
    const payload = {
      app: 'ArgenCaja',
      exportedAt: new Date().toISOString(),
      items,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `argencaja-respaldo-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setErrorMsg(null);
    setStatusMsg('Copia de seguridad descargada en formato .json.');
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !canEditFinances) return;
    try {
      const text = await file.text();
      const parsed = parseBackupItemsJson(text);
      if (!parsed) {
        setErrorMsg(
          'El archivo seleccionado no es una copia válida de ArgenCaja (.json).'
        );
        return;
      }
      onImportBackup(parsed);
      setErrorMsg(null);
      setStatusMsg(
        `Copia restaurada con éxito (${parsed.length} movimientos importados).`
      );
    } catch {
      setErrorMsg('No se pudo leer el archivo seleccionado.');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="firebase-modal-title"
    >
      <div className="my-8 w-full max-w-xl rounded-xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2
              id="firebase-modal-title"
              className="flex items-center gap-2 text-lg font-bold text-slate-100"
            >
              <Cloud className="h-5 w-5 text-emerald-400" aria-hidden="true" />
              Respaldo, Google Drive y Nube
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              Exportá tu respaldo en .json, conectá Google Drive para subir comprobantes o verificá tu sincronización en la nube.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar respaldo y nube"
            className="rounded-md p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-100"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {/* 1. Estado Firebase Provisionado */}
        <section className="mt-5 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <h3 className="flex items-center gap-1.5 text-sm font-semibold text-slate-100">
                <ShieldCheck
                  className="h-4 w-4 text-emerald-400"
                  aria-hidden="true"
                />
                Sincronización Segura en Firestore
              </h3>
              <p className="text-xs text-slate-400">
                Sesión:{' '}
                <span className="text-slate-200 font-mono-tabular">
                  {cloudUserEmail ?? 'Activa'}
                </span>{' '}
                · Rol:{' '}
                <span className="font-semibold text-emerald-400">
                  {userRole === 'ADMIN'
                    ? 'Administrador Total'
                    : 'Colaboradora (Lectura y comprobantes)'}
                </span>
              </p>
              <p className="text-[11px] text-slate-500 font-mono-tabular">
                Proyecto: {firebaseAppletConfig.projectId} ·{' '}
                {cloudStatus === 'connected'
                  ? 'Sincronizado en tiempo real'
                  : 'Sincronizando...'}
              </p>
            </div>
          </div>
        </section>

        {/* 2. Google Drive para Resúmenes y Comprobantes */}
        <section className="mt-4 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="flex items-center gap-1.5 text-sm font-semibold text-slate-100">
                <FolderOpen
                  className="h-4 w-4 text-cyan-400"
                  aria-hidden="true"
                />
                Google Drive (Permiso acotado drive.file)
              </h3>
              <p className="mt-0.5 text-xs text-slate-400">
                {hasDriveToken
                  ? `Conectado como ${driveUserEmail ?? 'cuenta Google'}. ArgenCaja solo accede a los archivos que subís desde acá.`
                  : 'Conectá Google Drive para subir resúmenes PDF o tickets de pago sin consumir espacio de la base.'}
              </p>
            </div>
            <div className="shrink-0">
              {hasDriveToken ? (
                <button
                  type="button"
                  onClick={onSignOutDrive}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-slate-700"
                >
                  <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
                  Desconectar Drive
                </button>
              ) : (
                <button
                  type="button"
                  disabled={busy}
                  onClick={async () => {
                    setErrorMsg(null);
                    setBusy(true);
                    try {
                      await onSignInDrive();
                      setStatusMsg(
                        'Google Drive conectado. Ya podés subir resúmenes y comprobantes.'
                      );
                    } catch (err) {
                      setErrorMsg(
                        err instanceof Error
                          ? err.message
                          : 'No se pudo conectar con Google Drive.'
                      );
                    } finally {
                      setBusy(false);
                    }
                  }}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-900 hover:bg-slate-100"
                >
                  <svg
                    className="h-4 w-4 shrink-0"
                    viewBox="0 0 48 48"
                    aria-hidden="true"
                  >
                    <path
                      fill="#EA4335"
                      d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                    />
                    <path
                      fill="#4285F4"
                      d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                    />
                    <path
                      fill="#34A853"
                      d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                    />
                  </svg>
                  Sign in with Google
                </button>
              )}
            </div>
          </div>
        </section>

        {/* 3. Respaldo en archivo (.json) */}
        <section className="mt-4 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-100">
                Copia de Seguridad (.json)
              </h3>
              <p className="mt-0.5 text-xs text-slate-400">
                Descargá todos tus meses y movimientos en tu dispositivo.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleExportJson}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3.5 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-400 whitespace-nowrap"
              >
                <Download className="h-3.5 w-3.5" aria-hidden="true" />
                Descargar copia
              </button>
              {canEditFinances && (
                <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3.5 py-2 text-xs font-medium text-slate-200 hover:bg-slate-700 whitespace-nowrap">
                  <Upload className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Importar archivo</span>
                  <input
                    type="file"
                    accept=".json,application/json"
                    onChange={handleImportFile}
                    className="sr-only"
                  />
                </label>
              )}
            </div>
          </div>
        </section>

        {errorMsg && (
          <p role="alert" className="mt-3 text-xs font-medium text-rose-400">
            {errorMsg}
          </p>
        )}
        {statusMsg && (
          <p role="status" className="mt-3 text-xs font-medium text-emerald-400">
            {statusMsg}
          </p>
        )}

        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-medium text-slate-200 hover:bg-slate-700"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
