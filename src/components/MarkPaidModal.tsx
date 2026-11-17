import React, { useEffect, useState } from 'react';
import { Paperclip, X } from 'lucide-react';
import { ItemFinanciero } from '../types/finance';
import { addOneCalendarMonth } from '../utils/dateUtils';
import { MoneyUtils } from '../utils/moneyUtils';

interface MarkPaidModalProps {
  item: ItemFinanciero;
  hasDriveToken: boolean;
  onSignInDrive?: () => Promise<void>;
  onClose: () => void;
  onConfirm: (payload: {
    item: ItemFinanciero;
    montoPagado: number;
    fechaPagoReal: string;
    bolsilloResponsable: string;
    proximoVencimiento: string;
    receiptFile?: File;
  }) => Promise<void> | void;
}

const BOLSILLOS_COMUNES = [
  'Seguridad 1°Q',
  'Seguridad 2°Q',
  'Césped',
  'Jubilaciones',
  'Aporte Camila',
  'Aguinaldo',
  'Otro Bolsillo',
];

export const MarkPaidModal: React.FC<MarkPaidModalProps> = ({
  item,
  hasDriveToken,
  onSignInDrive,
  onClose,
  onConfirm,
}) => {
  const [montoStr, setMontoStr] = useState(
    String(item.montoPagado ?? item.montoPactado)
  );
  const [fechaPago, setFechaPago] = useState(
    item.fechaPagoReal ?? item.fechaExactaVencimiento
  );
  const [bolsillo, setBolsillo] = useState(item.bolsilloResponsable);
  const [proximoVencimiento, setProximoVencimiento] = useState(
    addOneCalendarMonth(item.fechaExactaVencimiento, item.diaVencimientoOCobro)
  );
  const [receiptFile, setReceiptFile] = useState<File | undefined>(undefined);
  const [connectingDrive, setConnectingDrive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [busy, onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = Number(montoStr.replace(',', '.'));
    if (!Number.isFinite(parsed) || parsed < 0) {
      setError('Ingresá un monto real abonado válido (mayor o igual a 0).');
      return;
    }
    if (!fechaPago || !/^\d{4}-\d{2}-\d{2}$/.test(fechaPago)) {
      setError('Seleccioná una fecha de pago válida.');
      return;
    }
    if (!bolsillo.trim()) {
      setError('Indicá el bolsillo de origen del pago.');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await onConfirm({
        item,
        montoPagado: MoneyUtils.fromCents(MoneyUtils.toCents(parsed)),
        fechaPagoReal: fechaPago,
        bolsilloResponsable: bolsillo.trim(),
        proximoVencimiento,
        receiptFile,
      });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'No se pudo completar el registro del pago.'
      );
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#111318]/45 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="mark-paid-title"
    >
      <div className="w-full max-w-md rounded-2xl border border-[#E4E3DD] bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2
              id="mark-paid-title"
              className="font-display text-lg font-bold text-[#111318]"
            >
              Confirmar Pago Real
            </h2>
            <p className="mt-0.5 text-xs text-[#525866]">
              {item.titulo} · Pactado {MoneyUtils.formatARS(item.montoPactado)}
            </p>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            aria-label="Cerrar confirmación de pago"
            className="rounded-lg p-1 text-[#747A88] hover:bg-[#F6F6F3] hover:text-[#111318]"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label
              htmlFor="paid-amount"
              className="block text-xs font-semibold text-[#111318]"
            >
              Monto real abonado (ARS)
            </label>
            <input
              id="paid-amount"
              type="number"
              step="0.01"
              min="0"
              value={montoStr}
              onChange={(e) => setMontoStr(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-[#E4E3DD] bg-[#F6F6F3] px-3 py-2 font-mono-tabular text-sm text-[#111318] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1D4ED8]"
              required
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="paid-date"
                className="block text-xs font-semibold text-[#111318]"
              >
                Fecha real de pago
              </label>
              <input
                id="paid-date"
                type="date"
                value={fechaPago}
                onChange={(e) => setFechaPago(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-[#E4E3DD] bg-[#F6F6F3] px-3 py-2 font-mono-tabular text-sm text-[#111318] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1D4ED8]"
                required
              />
            </div>

            <div>
              <label
                htmlFor="paid-pocket"
                className="block text-xs font-semibold text-[#111318]"
              >
                Bolsillo utilizado
              </label>
              <select
                id="paid-pocket"
                value={
                  BOLSILLOS_COMUNES.includes(bolsillo)
                    ? bolsillo
                    : 'Otro Bolsillo'
                }
                onChange={(e) => setBolsillo(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-[#E4E3DD] bg-[#F6F6F3] px-3 py-2 text-sm text-[#111318] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1D4ED8]"
              >
                {BOLSILLOS_COMUNES.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label
              htmlFor="next-due-date"
              className="block text-xs font-semibold text-[#111318]"
            >
              Próximo vencimiento sugerido (editable)
            </label>
            <input
              id="next-due-date"
              type="date"
              value={proximoVencimiento}
              onChange={(e) => setProximoVencimiento(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-[#E4E3DD] bg-[#F6F6F3] px-3 py-2 font-mono-tabular text-sm text-[#111318] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1D4ED8]"
            />
          </div>

          <div className="rounded-xl border border-[#E4E3DD] bg-[#F6F6F3] p-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-xs font-semibold text-[#111318]">
                <Paperclip
                  className="h-3.5 w-3.5 text-[#1D4ED8]"
                  aria-hidden="true"
                />
                Comprobante de pago (opcional)
              </span>
              {!hasDriveToken && (
                <span className="text-[11px] text-[#747A88]">
                  Google Drive desconectado
                </span>
              )}
            </div>
            {hasDriveToken ? (
              <label className="mt-2 flex cursor-pointer items-center justify-between gap-2 rounded-lg border border-dashed border-[#D4D2CA] bg-white px-3 py-2 text-xs text-[#525866] hover:border-[#1D4ED8]">
                <span className="truncate">
                  {receiptFile
                    ? receiptFile.name
                    : 'Seleccionar PDF o foto para guardar en Drive...'}
                </span>
                <input
                  type="file"
                  accept=".pdf,image/*,.heic"
                  onChange={(e) => setReceiptFile(e.target.files?.[0])}
                  className="sr-only"
                />
              </label>
            ) : (
              <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-[11px] text-[#525866]">
                  Conectá Google Drive para subir el ticket ahora mismo sin perder lo cargado.
                </p>
                {onSignInDrive && (
                  <button
                    type="button"
                    disabled={connectingDrive || busy}
                    onClick={async () => {
                      setConnectingDrive(true);
                      setError(null);
                      try {
                        await onSignInDrive();
                      } catch (err) {
                        setError(
                          err instanceof Error
                            ? err.message
                            : 'No se pudo conectar Google Drive.'
                        );
                      } finally {
                        setConnectingDrive(false);
                      }
                    }}
                    className="inline-flex min-h-[32px] shrink-0 items-center justify-center rounded-lg border border-[#BFDBFE] bg-white px-3 py-1 text-[11px] font-semibold text-[#1D4ED8] hover:bg-[#EFF6FF] disabled:opacity-60"
                  >
                    {connectingDrive ? 'Conectando...' : 'Conectar Google Drive'}
                  </button>
                )}
              </div>
            )}
          </div>

          {error && (
            <p role="alert" className="text-xs font-medium text-[#DC2626]">
              {error}
            </p>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              disabled={busy}
              onClick={onClose}
              className="rounded-xl border border-[#E4E3DD] bg-[#F6F6F3] px-4 py-2 text-xs font-semibold text-[#111318] hover:bg-[#EEEDE8]"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={busy}
              className="rounded-xl bg-[#1D4ED8] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1E40AF] disabled:opacity-60"
            >
              {busy ? 'Guardando...' : 'Confirmar Pago'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
