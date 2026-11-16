import React, { useEffect, useState } from 'react';
import {
  CalendarCheck,
  Cloud,
  Download,
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
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-[#111318]/45 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="firebase-modal-title"
    >
      <div className="my-8 w-full max-w-xl rounded-2xl border border-[#E4E3DD] bg-white p-6 shadow-[0_20px_50px_rgba(17,19,24,0.16)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2
              id="firebase-modal-title"
              className="flex items-center gap-2 font-display text-lg font-bold text-[#111318]"
            >
              <Cloud className="h-5 w-5 text-[#1D4ED8]" aria-hidden="true" />
              Respaldo, Google Workspace y Nube
            </h2>
            <p className="mt-1 text-xs text-[#525866]">
              Exportá tu respaldo en .json, conectá Google Drive y Calendar o verificá tu sincronización en la nube.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar respaldo y nube"
            className="rounded-lg p-1.5 text-[#747A88] transition-colors hover:bg-[#F6F6F3] hover:text-[#111318]"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <section className="mt-5 rounded-xl border border-[#E4E3DD] bg-[#F6F6F3] p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <h3 className="flex items-center gap-1.5 text-sm font-bold text-[#111318]">
                <ShieldCheck
                  className="h-4 w-4 text-[#1D4ED8]"
                  aria-hidden="true"
                />
                Sincronización Segura en Firestore
              </h3>
              <p className="text-xs text-[#525866]">
                Sesión:{' '}
                <span className="font-mono-tabular font-semibold text-[#111318]">
                  {cloudUserEmail ?? 'Activa'}
                </span>{' '}
                · Rol:{' '}
                <span className="font-semibold text-[#1D4ED8]">
                  {userRole === 'ADMIN'
                    ? 'Administrador Total'
                    : 'Colaboradora (Lectura y comprobantes)'}
                </span>
              </p>
              <p className="font-mono-tabular text-[11px] text-[#747A88]">
                Proyecto: {firebaseAppletConfig.projectId} ·{' '}
                {cloudStatus === 'connected'
                  ? 'Sincronizado en tiempo real'
                  : 'Sincronizando...'}
              </p>
            </div>
          </div>
        </section>

        <section className="mt-4 rounded-xl border border-[#E4E3DD] bg-[#F6F6F3] p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="flex items-center gap-1.5 text-sm font-bold text-[#111318]">
                <CalendarCheck
                  className="h-4 w-4 text-[#4338CA]"
                  aria-hidden="true"
                />
                Google Workspace (Drive acotado y Calendar)
              </h3>
              <p className="mt-0.5 text-xs text-[#525866]">
                {hasDriveToken
                  ? `Conectado como ${driveUserEmail ?? 'cuenta Google'}. ArgenCaja solo accede a archivos subidos acá (drive.file) y eventos de agenda (calendar.events).`
                  : 'Conectá Google para subir resúmenes PDF, comprobantes y agendar vencimientos directo en Google Calendar.'}
              </p>
            </div>
            <div className="shrink-0">
              {hasDriveToken ? (
                <button
                  type="button"
                  onClick={onSignOutDrive}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-[#E4E3DD] bg-white px-3 py-2 text-xs font-semibold text-[#111318] transition-colors hover:bg-[#EEEDE8]"
                >
                  <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
                  Desconectar Google
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
                        'Google Workspace conectado. Ya podés usar Drive y Google Calendar.'
                      );
                    } catch (err) {
                      setErrorMsg(
                        err instanceof Error
                          ? err.message
                          : 'No se pudo conectar con Google Workspace.'
                      );
                    } finally {
                      setBusy(false);
                    }
                  }}
                  className="inline-flex items-center gap-2 rounded-xl border border-[#D4D2CA] bg-white px-3.5 py-2 text-xs font-semibold text-[#111318] shadow-xs transition-colors hover:bg-[#EEEDE8]"
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

        <section className="mt-4 rounded-xl border border-[#E4E3DD] bg-[#F6F6F3] p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-sm font-bold text-[#111318]">
                Copia de Seguridad (.json)
              </h3>
              <p className="mt-0.5 text-xs text-[#525866]">
                Descargá todos tus meses y movimientos en tu dispositivo.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleExportJson}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#1D4ED8] px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#1E40AF] whitespace-nowrap"
              >
                <Download className="h-3.5 w-3.5" aria-hidden="true" />
                Descargar copia
              </button>
              {canEditFinances && (
                <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-[#E4E3DD] bg-white px-3.5 py-2 text-xs font-semibold text-[#111318] transition-colors hover:bg-[#EEEDE8] whitespace-nowrap">
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
          <p
            role="alert"
            className="mt-3 rounded-lg border border-[#FECACA] bg-[#FEF2F2] px-3 py-2 text-xs font-medium text-[#B91C1C]"
          >
            {errorMsg}
          </p>
        )}
        {statusMsg && (
          <p
            role="status"
            className="mt-3 rounded-lg border border-[#BFDBFE] bg-[#EFF6FF] px-3 py-2 text-xs font-medium text-[#1D4ED8]"
          >
            {statusMsg}
          </p>
        )}

        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-[#E4E3DD] bg-[#F6F6F3] px-4 py-2 text-xs font-semibold text-[#111318] transition-colors hover:bg-[#EEEDE8]"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
