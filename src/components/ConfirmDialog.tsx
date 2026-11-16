import React, { useEffect } from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmDialogProps {
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'danger' | 'warning';
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  title,
  description,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  tone = 'danger',
  busy = false,
  onConfirm,
  onCancel,
}) => {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) {
        onCancel();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [busy, onCancel]);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-[#111318]/45 p-4 backdrop-blur-sm"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      aria-describedby="confirm-dialog-desc"
    >
      <div className="w-full max-w-md rounded-2xl border border-[#E4E3DD] bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div
              className={`mt-0.5 rounded-xl p-2 ${
                tone === 'danger'
                  ? 'bg-[#FEF2F2] text-[#DC2626]'
                  : 'bg-[#EFF6FF] text-[#1D4ED8]'
              }`}
            >
              <AlertTriangle className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <h2
                id="confirm-dialog-title"
                className="font-display text-base font-bold text-[#111318]"
              >
                {title}
              </h2>
              <p
                id="confirm-dialog-desc"
                className="mt-1.5 text-xs leading-relaxed text-[#525866]"
              >
                {description}
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            aria-label="Cerrar confirmación"
            className="rounded-lg p-1 text-[#747A88] hover:bg-[#F6F6F3] hover:text-[#111318]"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="rounded-xl border border-[#E4E3DD] bg-[#F6F6F3] px-4 py-2 text-xs font-semibold text-[#111318] hover:bg-[#EEEDE8] disabled:opacity-60"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className={`rounded-xl px-4 py-2 text-xs font-semibold text-white transition-colors disabled:opacity-60 ${
              tone === 'danger'
                ? 'bg-[#DC2626] hover:bg-[#B91C1C]'
                : 'bg-[#1D4ED8] hover:bg-[#1E40AF]'
            }`}
          >
            {busy ? 'Procesando...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
