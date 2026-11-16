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
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      aria-describedby="confirm-dialog-desc"
    >
      <div className="w-full max-w-md rounded-xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div
              className={`mt-0.5 rounded-lg p-2 ${
                tone === 'danger'
                  ? 'bg-rose-500/15 text-rose-400'
                  : 'bg-amber-500/15 text-amber-400'
              }`}
            >
              <AlertTriangle className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <h2
                id="confirm-dialog-title"
                className="text-base font-bold text-slate-100"
              >
                {title}
              </h2>
              <p
                id="confirm-dialog-desc"
                className="mt-1.5 text-xs leading-relaxed text-slate-300"
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
            className="rounded-md p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-100"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-medium text-slate-200 hover:bg-slate-700 disabled:opacity-60"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className={`rounded-lg px-4 py-2 text-xs font-semibold transition-colors disabled:opacity-60 ${
              tone === 'danger'
                ? 'bg-rose-500 text-white hover:bg-rose-400'
                : 'bg-amber-500 text-slate-950 hover:bg-amber-400'
            }`}
          >
            {busy ? 'Procesando...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
