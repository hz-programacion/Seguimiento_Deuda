import React, { useEffect, useState } from 'react';
import {
  ExternalLink,
  FileText,
  FolderOpen,
  Link2,
  LogOut,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { ComprobanteAdjunto, ItemFinanciero } from '../types/finance';
import { formatDateAR, formatPeriodoLabel } from '../utils/dateUtils';
import { ConfirmDialog } from './ConfirmDialog';

interface ReceiptsModalProps {
  item: ItemFinanciero;
  isCollaborator?: boolean;
  driveUserEmail: string | null;
  hasDriveToken: boolean;
  onSignInDrive: () => Promise<void>;
  onSignOutDrive: () => Promise<void>;
  onUploadFile: (
    item: ItemFinanciero,
    file: File,
    tipo: 'RESUMEN' | 'COMPROBANTE'
  ) => Promise<void>;
  onAddManualLink: (
    item: ItemFinanciero,
    params: { nombre: string; webViewLink: string; tipo: 'RESUMEN' | 'COMPROBANTE' }
  ) => void;
  onDeleteAttachment: (
    item: ItemFinanciero,
    adjunto: ComprobanteAdjunto
  ) => Promise<void>;
  onClose: () => void;
}

export const ReceiptsModal: React.FC<ReceiptsModalProps> = ({
  item,
  isCollaborator = false,
  driveUserEmail,
  hasDriveToken,
  onSignInDrive,
  onSignOutDrive,
  onUploadFile,
  onAddManualLink,
  onDeleteAttachment,
  onClose,
}) => {
  const [tipoDoc, setTipoDoc] = useState<'RESUMEN' | 'COMPROBANTE'>(
    item.estado === 'PAGADO' ? 'COMPROBANTE' : 'RESUMEN'
  );
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showManualLink, setShowManualLink] = useState(false);
  const [manualName, setManualName] = useState('');
  const [manualUrl, setManualUrl] = useState('');
  const [pendingDelete, setPendingDelete] = useState<ComprobanteAdjunto | null>(
    null
  );

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !pendingDelete && !busy) {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [busy, pendingDelete, onClose]);

  const adjuntos = item.adjuntos ?? [];

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setErrorMsg(null);
    setBusy(true);
    try {
      await onUploadFile(item, file, tipoDoc);
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'No se pudo subir el archivo a Google Drive.'
      );
    } finally {
      setBusy(false);
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedUrl = manualUrl.trim();
    if (
      !trimmedUrl.startsWith('http://') &&
      !trimmedUrl.startsWith('https://')
    ) {
      setErrorMsg('Pegá un enlace válido que empiece con https://');
      return;
    }
    onAddManualLink(item, {
      nombre:
        manualName.trim() ||
        `${tipoDoc === 'RESUMEN' ? 'Resumen' : 'Comprobante'} ${item.titulo}`,
      webViewLink: trimmedUrl,
      tipo: tipoDoc,
    });
    setManualName('');
    setManualUrl('');
    setShowManualLink(false);
    setErrorMsg(null);
  };

  const handleConfirmDelete = async () => {
    if (!pendingDelete) return;
    setBusy(true);
    setErrorMsg(null);
    try {
      await onDeleteAttachment(item, pendingDelete);
      setPendingDelete(null);
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'No se pudo eliminar el archivo de Google Drive.'
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-[#111318]/45 p-4 backdrop-blur-sm"
        role="dialog"
        aria-modal="true"
        aria-labelledby="receipts-modal-title"
      >
        <div className="my-8 w-full max-w-xl rounded-2xl border border-[#E4E3DD] bg-white p-6 shadow-[0_20px_50px_rgba(17,19,24,0.16)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2
                id="receipts-modal-title"
                className="flex items-center gap-2 font-display text-lg font-bold text-[#111318]"
              >
                <FolderOpen
                  className="h-5 w-5 text-[#1D4ED8]"
                  aria-hidden="true"
                />
                Resúmenes y Comprobantes
              </h2>
              <p className="mt-0.5 text-xs text-[#525866]">
                {item.titulo} · {formatPeriodoLabel(item.periodo)} · Carpeta Drive{' '}
                <span className="font-mono-tabular font-semibold text-[#111318]">
                  ArgenCaja Comprobantes/{item.periodo}
                </span>
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar ventana de comprobantes"
              className="rounded-lg p-1.5 text-[#747A88] transition-colors hover:bg-[#F6F6F3] hover:text-[#111318]"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          <div className="mt-4 flex flex-col gap-3 rounded-xl border border-[#E4E3DD] bg-[#F6F6F3] p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-0.5">
              <p className="text-xs font-semibold text-[#111318]">
                {hasDriveToken
                  ? `Google Drive conectado${driveUserEmail ? ` (${driveUserEmail})` : ''}`
                  : 'Conectá Google Drive para subir PDFs o fotos'}
              </p>
              <p className="text-[11px] text-[#525866]">
                Los archivos se guardan directo en tu Drive (permiso acotado solo a ArgenCaja).
                {isCollaborator
                  ? ' Si querés que el administrador también abra el PDF, compartí el archivo desde Drive.'
                  : ''}
              </p>
            </div>

            {hasDriveToken ? (
              <button
                type="button"
                onClick={onSignOutDrive}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[#E4E3DD] bg-white px-3 py-1.5 text-xs font-semibold text-[#111318] transition-colors hover:bg-[#EEEDE8] whitespace-nowrap shrink-0"
              >
                <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
                Desconectar
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
                  } catch (err) {
                    setErrorMsg(
                      err instanceof Error
                        ? err.message
                        : 'No se pudo iniciar sesión con Google Drive.'
                    );
                  } finally {
                    setBusy(false);
                  }
                }}
                className="inline-flex items-center gap-2.5 rounded-xl border border-[#D4D2CA] bg-white px-3.5 py-2 text-xs font-semibold text-[#111318] shadow-xs transition-colors hover:bg-[#F6F6F3] disabled:opacity-60 whitespace-nowrap shrink-0"
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

          <div className="mt-4 space-y-3 rounded-xl border border-[#E4E3DD] bg-[#F6F6F3] p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div
                role="group"
                aria-label="Tipo de documento"
                className="flex items-center gap-1 rounded-lg border border-[#E4E3DD] bg-white p-1"
              >
                <button
                  type="button"
                  onClick={() => setTipoDoc('RESUMEN')}
                  className={`rounded-md px-3 py-1 text-xs font-semibold transition-colors ${
                    tipoDoc === 'RESUMEN'
                      ? 'bg-[#EEF2FF] text-[#4338CA]'
                      : 'text-[#525866] hover:text-[#111318]'
                  }`}
                >
                  Resumen / Factura
                </button>
                <button
                  type="button"
                  onClick={() => setTipoDoc('COMPROBANTE')}
                  className={`rounded-md px-3 py-1 text-xs font-semibold transition-colors ${
                    tipoDoc === 'COMPROBANTE'
                      ? 'bg-[#EFF6FF] text-[#1D4ED8]'
                      : 'text-[#525866] hover:text-[#111318]'
                  }`}
                >
                  Comprobante de Pago
                </button>
              </div>

              <button
                type="button"
                onClick={() => setShowManualLink((v) => !v)}
                className="inline-flex items-center gap-1 text-xs font-medium text-[#525866] hover:text-[#111318]"
              >
                <Link2 className="h-3.5 w-3.5" aria-hidden="true" />
                {showManualLink ? 'Ocultar enlace manual' : 'Pegar link de Drive'}
              </button>
            </div>

            {hasDriveToken ? (
              <label
                className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed px-4 py-5 text-center transition-colors ${
                  busy
                    ? 'cursor-wait border-[#E4E3DD] bg-white opacity-60'
                    : 'border-[#BFDBFE] bg-[#EFF6FF]/60 hover:border-[#1D4ED8] hover:bg-[#EFF6FF]'
                }`}
              >
                <Upload
                  className="h-5 w-5 text-[#1D4ED8]"
                  aria-hidden="true"
                />
                <span className="mt-2 text-xs font-semibold text-[#111318]">
                  {busy
                    ? 'Subiendo a Google Drive...'
                    : `Subir ${
                        tipoDoc === 'RESUMEN'
                          ? 'Resumen / Factura'
                          : 'Comprobante de Pago'
                      } (PDF o Foto)`}
                </span>
                <span className="mt-0.5 text-[11px] text-[#525866]">
                  Se guardará en Drive → ArgenCaja Comprobantes/{item.periodo}
                </span>
                <input
                  type="file"
                  accept=".pdf,image/*,.heic"
                  disabled={busy}
                  onChange={handleFileSelected}
                  className="sr-only"
                />
              </label>
            ) : (
              <p className="text-xs text-[#525866]">
                Conectá tu cuenta con <strong className="text-[#111318]">Sign in with Google</strong> arriba para subir archivos directo desde acá, o pegá un link existente de Drive.
              </p>
            )}

            {showManualLink && (
              <form
                onSubmit={handleManualSubmit}
                className="space-y-2.5 border-t border-[#E4E3DD] pt-3"
              >
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  <input
                    type="text"
                    value={manualName}
                    onChange={(e) => setManualName(e.target.value)}
                    placeholder="Nombre (ej: Resumen Dic)"
                    className="rounded-lg border border-[#E4E3DD] bg-white px-3 py-1.5 text-xs text-[#111318]"
                  />
                  <input
                    type="url"
                    value={manualUrl}
                    onChange={(e) => setManualUrl(e.target.value)}
                    placeholder="https://drive.google.com/..."
                    className="rounded-lg border border-[#E4E3DD] bg-white px-3 py-1.5 text-xs text-[#111318]"
                    required
                  />
                </div>
                <div className="flex justify-end">
                  <button
                    type="submit"
                    className="rounded-lg bg-[#1D4ED8] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#1E40AF]"
                  >
                    Guardar enlace
                  </button>
                </div>
              </form>
            )}
          </div>

          {errorMsg && (
            <p
              role="alert"
              className="mt-3 rounded-lg border border-[#FECACA] bg-[#FEF2F2] px-3 py-2 text-xs font-medium text-[#B91C1C]"
            >
              {errorMsg}
            </p>
          )}

          <div className="mt-5">
            <h3 className="text-xs font-semibold text-[#111318]">
              Archivos adjuntos en {formatPeriodoLabel(item.periodo)} (
              {adjuntos.length})
            </h3>

            {adjuntos.length === 0 ? (
              <p className="mt-2 rounded-xl border border-[#E4E3DD] bg-[#F6F6F3] px-4 py-4 text-center text-xs text-[#747A88]">
                Todavía no hay resúmenes ni comprobantes cargados para este movimiento.
              </p>
            ) : (
              <div className="mt-2 divide-y divide-[#EEEDE8] rounded-xl border border-[#E4E3DD] bg-white">
                {adjuntos.map((adj) => (
                  <div
                    key={adj.id}
                    className="flex items-center justify-between gap-3 px-3.5 py-2.5 text-xs"
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <FileText
                        className={`h-4 w-4 shrink-0 ${
                          adj.tipo === 'COMPROBANTE'
                            ? 'text-[#1D4ED8]'
                            : 'text-[#4338CA]'
                        }`}
                        aria-hidden="true"
                      />
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-[#111318]">
                          {adj.nombre}
                        </p>
                        <p className="font-mono-tabular text-[11px] text-[#525866]">
                          {adj.tipo === 'RESUMEN' ? 'Resumen' : 'Comprobante'} ·{' '}
                          {formatDateAR(adj.subidoEn.slice(0, 10))}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <a
                        href={adj.webViewLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-lg border border-[#E4E3DD] bg-[#F6F6F3] px-2.5 py-1 text-xs font-semibold text-[#111318] transition-colors hover:bg-[#EEEDE8]"
                      >
                        Abrir
                        <ExternalLink className="h-3 w-3" aria-hidden="true" />
                      </a>
                      <button
                        type="button"
                        onClick={() => setPendingDelete(adj)}
                        aria-label={`Eliminar archivo ${adj.nombre}`}
                        className="rounded-lg border border-[#E4E3DD] bg-white p-1.5 text-[#747A88] transition-colors hover:border-[#FECACA] hover:bg-[#FEF2F2] hover:text-[#DC2626]"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-5 flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-[#E4E3DD] bg-[#F6F6F3] px-4 py-2 text-xs font-semibold text-[#111318] transition-colors hover:bg-[#EEEDE8]"
            >
              Listo
            </button>
          </div>
        </div>
      </div>

      {pendingDelete && (
        <ConfirmDialog
          title="¿Eliminar archivo adjunto?"
          description={
            pendingDelete.driveFileId.startsWith('manual-')
              ? `Se quitará el enlace "${pendingDelete.nombre}" de este movimiento.`
              : `Se eliminará "${pendingDelete.nombre}" de tu Google Drive y se desvinculará de este mes. Esta acción no se puede deshacer.`
          }
          confirmLabel="Eliminar archivo"
          tone="danger"
          busy={busy}
          onCancel={() => setPendingDelete(null)}
          onConfirm={handleConfirmDelete}
        />
      )}
    </>
  );
};
