import React, { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, X } from 'lucide-react';
import {
  CategoriaMovimiento,
  ItemFinanciero,
  PeriodoID,
  VentanaQuincena,
} from '../types/finance';
import {
  buildDateString,
  deriveVentanaFromDia,
  formatPeriodoLabel,
  validateCardCycleDates,
} from '../utils/dateUtils';
import { MoneyUtils } from '../utils/moneyUtils';

interface ItemEditorModalProps {
  activePeriodo: PeriodoID;
  editingItem: ItemFinanciero | null;
  hasFuturePeriods?: boolean;
  onClose: () => void;
  onSave: (item: ItemFinanciero, applyToFutureMonths?: boolean) => void;
}

const CATEGORIAS: Array<{ value: CategoriaMovimiento; label: string }> = [
  { value: 'SERVICIO_HOGAR', label: 'Servicio del Hogar (Luz, Gas, Agua...)' },
  { value: 'CUOTA_FIJA', label: 'Cuota Fija (plan en cuotas X/N)' },
  { value: 'TARJETA_ROTATIVA', label: 'Tarjeta de Crédito' },
  {
    value: 'INGRESO_HABITUAL',
    label: 'Ingreso Habitual (Sueldo, Jubilación...)',
  },
  { value: 'INGRESO_EXTRA_SAC', label: 'Ingreso Extra / Aguinaldo (SAC)' },
];

export const ItemEditorModal: React.FC<ItemEditorModalProps> = ({
  activePeriodo,
  editingItem,
  hasFuturePeriods = false,
  onClose,
  onSave,
}) => {
  const targetPeriodo = editingItem?.periodo ?? activePeriodo;

  const [titulo, setTitulo] = useState(editingItem?.titulo ?? '');
  const [categoria, setCategoria] = useState<CategoriaMovimiento>(
    editingItem?.categoria ?? 'SERVICIO_HOGAR'
  );
  const [subgrupo, setSubgrupo] = useState(editingItem?.subgrupo ?? 'Hogar');
  const [montoStr, setMontoStr] = useState(
    editingItem ? String(editingItem.montoPactado) : ''
  );
  const [fechaVencimiento, setFechaVencimiento] = useState(
    editingItem?.fechaExactaVencimiento ?? buildDateString(targetPeriodo, 10)
  );
  const [fechaCierre, setFechaCierre] = useState(
    editingItem?.fechaCierre ?? ''
  );
  const [ventana, setVentana] = useState<VentanaQuincena>(
    editingItem?.ventanaAsignada ?? 'Q1_DIAS_1_AL_14'
  );
  const [bolsillo, setBolsillo] = useState(
    editingItem?.bolsilloResponsable ?? 'Seguridad 1°Q'
  );
  const [esCuotaFija, setEsCuotaFija] = useState(
    editingItem?.esCuotaFija ?? false
  );
  const [cuotaActualStr, setCuotaActualStr] = useState(
    editingItem?.cuotaActual ? String(editingItem.cuotaActual) : '1'
  );
  const [cuotasTotalesStr, setCuotasTotalesStr] = useState(
    editingItem?.cuotasTotales ? String(editingItem.cuotasTotales) : '6'
  );
  const [mesFinEstimado, setMesFinEstimado] = useState(
    editingItem?.mesFinEstimado ?? ''
  );
  const [saldoCapitalStr, setSaldoCapitalStr] = useState(
    editingItem?.saldoCapitalTotal !== undefined
      ? String(editingItem.saldoCapitalTotal)
      : ''
  );
  const [ofertaQuitaStr, setOfertaQuitaStr] = useState(
    editingItem?.montoOfertaQuitaContado !== undefined
      ? String(editingItem.montoOfertaQuitaContado)
      : ''
  );
  const [notas, setNotas] = useState(editingItem?.notas ?? '');
  const [applyToFuture, setApplyToFuture] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const cycleCheck = validateCardCycleDates(
    fechaCierre.trim() || undefined,
    fechaVencimiento
  );

  const handleVencimientoChange = (newDate: string) => {
    setFechaVencimiento(newDate);
    if (/^\d{4}-\d{2}-\d{2}$/.test(newDate)) {
      const day = Number(newDate.split('-')[2]);
      if (Number.isFinite(day) && day >= 1 && day <= 31) {
        setVentana(deriveVentanaFromDia(day));
      }
    }
  };

  const handleCategoryChange = (newCat: CategoriaMovimiento) => {
    setCategoria(newCat);
    if (newCat === 'CUOTA_FIJA') {
      setEsCuotaFija(true);
    } else if (newCat !== 'TARJETA_ROTATIVA') {
      setEsCuotaFija(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTitle = titulo.trim();
    if (!cleanTitle) {
      setError('Ingresá un nombre para este gasto o ingreso.');
      return;
    }

    const parsedMonto = Number(montoStr.replace(',', '.'));
    if (!Number.isFinite(parsedMonto) || parsedMonto < 0) {
      setError('Ingresá un monto válido mayor o igual a 0.');
      return;
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaVencimiento)) {
      setError('Seleccioná una fecha de vencimiento o cobro válida.');
      return;
    }

    const parsedDia = Math.round(Number(fechaVencimiento.split('-')[2]));
    if (!Number.isFinite(parsedDia) || parsedDia < 1 || parsedDia > 31) {
      setError('La fecha de vencimiento no es válida.');
      return;
    }

    if (fechaCierre && !/^\d{4}-\d{2}-\d{2}$/.test(fechaCierre)) {
      setError('La fecha de cierre debe tener formato válido.');
      return;
    }

    if (fechaCierre && !cycleCheck.valid) {
      setError(
        cycleCheck.warning ??
          'La fecha de cierre debe ser anterior a la fecha de vencimiento.'
      );
      return;
    }

    if (!bolsillo.trim()) {
      setError('Indicá con qué ingreso o bolsillo se paga.');
      return;
    }

    const cuotaActual = esCuotaFija ? Math.round(Number(cuotaActualStr)) : undefined;
    const cuotasTotales = esCuotaFija
      ? Math.round(Number(cuotasTotalesStr))
      : undefined;

    if (
      esCuotaFija &&
      (!cuotaActual ||
        !cuotasTotales ||
        cuotaActual < 1 ||
        cuotasTotales < cuotaActual)
    ) {
      setError(
        'Verificá los valores de cuota actual y cuotas totales (actual ≤ total).'
      );
      return;
    }

    const parsedSaldo = saldoCapitalStr.trim()
      ? Number(saldoCapitalStr.replace(',', '.'))
      : undefined;
    const parsedQuita = ofertaQuitaStr.trim()
      ? Number(ofertaQuitaStr.replace(',', '.'))
      : undefined;

    const nextItem: ItemFinanciero = {
      id:
        editingItem?.id ??
        `${activePeriodo}-custom-${Date.now().toString(36)}`,
      periodo: targetPeriodo,
      titulo: cleanTitle,
      categoria,
      subgrupo: subgrupo.trim() || undefined,
      montoPactado: MoneyUtils.fromCents(MoneyUtils.toCents(parsedMonto)),
      montoPagado: editingItem?.montoPagado,
      estado: editingItem?.estado ?? 'PENDIENTE',
      diaVencimientoOCobro: parsedDia,
      fechaExactaVencimiento: fechaVencimiento,
      fechaCierre: fechaCierre.trim() || undefined,
      fechaPagoReal: editingItem?.fechaPagoReal,
      ventanaAsignada: ventana,
      bolsilloResponsable: bolsillo.trim(),
      esCuotaFija,
      cuotaActual,
      cuotasTotales,
      mesFinEstimado: mesFinEstimado.trim() || undefined,
      saldoCapitalTotal:
        parsedSaldo !== undefined && Number.isFinite(parsedSaldo)
          ? MoneyUtils.fromCents(MoneyUtils.toCents(parsedSaldo))
          : undefined,
      pagoMinimoExigido:
        categoria === 'TARJETA_ROTATIVA'
          ? MoneyUtils.fromCents(MoneyUtils.toCents(parsedMonto))
          : undefined,
      tnaEstimada: editingItem?.tnaEstimada,
      montoOfertaQuitaContado:
        parsedQuita !== undefined && Number.isFinite(parsedQuita)
          ? MoneyUtils.fromCents(MoneyUtils.toCents(parsedQuita))
          : undefined,
      porcentajeQuita: editingItem?.porcentajeQuita,
      notas: notas.trim() || undefined,
      adjuntos: editingItem?.adjuntos,
    };

    onSave(nextItem, Boolean(editingItem && applyToFuture));
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-[#111318]/45 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="item-editor-title"
    >
      <div className="my-8 w-full max-w-lg rounded-2xl border border-[#E4E3DD] bg-white p-6 shadow-[0_20px_50px_rgba(17,19,24,0.16)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2
              id="item-editor-title"
              className="font-display text-lg font-bold text-[#111318]"
            >
              {editingItem ? 'Editar Movimiento' : 'Nuevo Gasto o Ingreso'}
            </h2>
            <p className="mt-0.5 text-xs text-[#525866]">
              Mes: {formatPeriodoLabel(targetPeriodo)} · Cambios independientes por mes.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar formulario"
            className="rounded-lg p-1.5 text-[#747A88] transition-colors hover:bg-[#F6F6F3] hover:text-[#111318]"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label
              htmlFor="item-titulo"
              className="block text-xs font-semibold text-[#111318]"
            >
              Nombre (servicio, tarjeta, cuota o ingreso)
            </label>
            <input
              id="item-titulo"
              type="text"
              maxLength={140}
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ej: Luz Edenor o Tarjeta Patagonia"
              className="mt-1.5 w-full rounded-xl border border-[#E4E3DD] bg-[#F6F6F3] px-3 py-2 text-sm text-[#111318] focus:border-[#1D4ED8] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/20"
              required
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="item-categoria"
                className="block text-xs font-semibold text-[#111318]"
              >
                Tipo de movimiento
              </label>
              <select
                id="item-categoria"
                value={categoria}
                onChange={(e) =>
                  handleCategoryChange(e.target.value as CategoriaMovimiento)
                }
                className="mt-1.5 w-full rounded-xl border border-[#E4E3DD] bg-[#F6F6F3] px-3 py-2 text-sm text-[#111318] focus:border-[#1D4ED8] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/20"
              >
                {CATEGORIAS.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="item-monto"
                className="block text-xs font-semibold text-[#111318]"
              >
                Monto del mes (ARS)
              </label>
              <input
                id="item-monto"
                type="number"
                step="0.01"
                min="0"
                max="1000000000"
                value={montoStr}
                onChange={(e) => setMontoStr(e.target.value)}
                placeholder="0.00"
                className="mt-1.5 w-full rounded-xl border border-[#E4E3DD] bg-[#F6F6F3] px-3 py-2 font-mono-tabular text-sm text-[#111318] focus:border-[#1D4ED8] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/20"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="item-fecha-cierre"
                className="block text-xs font-semibold text-[#111318]"
              >
                Fecha de cierre (opcional)
              </label>
              <input
                id="item-fecha-cierre"
                type="date"
                value={fechaCierre}
                onChange={(e) => setFechaCierre(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-[#E4E3DD] bg-[#F6F6F3] px-3 py-2 font-mono-tabular text-sm text-[#111318] focus:border-[#1D4ED8] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/20"
              />
            </div>

            <div>
              <label
                htmlFor="item-fecha-vencimiento"
                className="block text-xs font-semibold text-[#111318]"
              >
                Fecha de vencimiento / cobro
              </label>
              <input
                id="item-fecha-vencimiento"
                type="date"
                value={fechaVencimiento}
                onChange={(e) => handleVencimientoChange(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-[#E4E3DD] bg-[#F6F6F3] px-3 py-2 font-mono-tabular text-sm text-[#111318] focus:border-[#1D4ED8] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/20"
                required
              />
            </div>
          </div>

          {fechaCierre && (
            <div
              className={`flex items-start gap-2 rounded-xl border px-3 py-2.5 text-xs ${
                cycleCheck.valid
                  ? 'border-[#BFDBFE] bg-[#EFF6FF] text-[#1D4ED8]'
                  : 'border-[#FDE68A] bg-[#FFFBEB] text-[#92400E]'
              }`}
            >
              {cycleCheck.valid ? (
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#1D4ED8]" />
              ) : (
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#D97706]" />
              )}
              <span>
                {cycleCheck.valid
                  ? `Ventana válida de pago: ${cycleCheck.windowDays} día${
                      cycleCheck.windowDays === 1 ? '' : 's'
                    } entre el cierre y el vencimiento.`
                  : cycleCheck.warning}
              </span>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="item-ventana"
                className="block text-xs font-semibold text-[#111318]"
              >
                Quincena asignada
              </label>
              <select
                id="item-ventana"
                value={ventana}
                onChange={(e) => setVentana(e.target.value as VentanaQuincena)}
                className="mt-1.5 w-full rounded-xl border border-[#E4E3DD] bg-[#F6F6F3] px-3 py-2 text-sm text-[#111318] focus:border-[#1D4ED8] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/20"
              >
                <option value="Q1_DIAS_1_AL_14">1° Quincena (01 al 14)</option>
                <option value="Q2_DIAS_15_AL_31">2° Quincena (15 al 31)</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="item-bolsillo"
                className="block text-xs font-semibold text-[#111318]"
              >
                ¿Con qué ingreso se paga? (Bolsillo)
              </label>
              <input
                id="item-bolsillo"
                type="text"
                maxLength={80}
                value={bolsillo}
                onChange={(e) => setBolsillo(e.target.value)}
                placeholder="Seguridad 1°Q"
                className="mt-1.5 w-full rounded-xl border border-[#E4E3DD] bg-[#F6F6F3] px-3 py-2 text-sm text-[#111318] focus:border-[#1D4ED8] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/20"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="item-subgrupo"
                className="block text-xs font-semibold text-[#111318]"
              >
                Grupo / Tarjeta (ej: Tarjeta Carrefour)
              </label>
              <input
                id="item-subgrupo"
                type="text"
                maxLength={80}
                value={subgrupo}
                onChange={(e) => setSubgrupo(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-[#E4E3DD] bg-[#F6F6F3] px-3 py-2 text-sm text-[#111318] focus:border-[#1D4ED8] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/20"
              />
            </div>

            <div className="flex items-end pb-2">
              <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-medium text-[#111318]">
                <input
                  type="checkbox"
                  checked={esCuotaFija}
                  onChange={(e) => setEsCuotaFija(e.target.checked)}
                  className="h-4 w-4 rounded border-[#D4D2CA] accent-[#1D4ED8]"
                />
                Es plan en cuotas fijas (termina solo)
              </label>
            </div>
          </div>

          {esCuotaFija && (
            <div className="grid grid-cols-1 gap-4 rounded-xl border border-[#E4E3DD] bg-[#F6F6F3] p-3.5 sm:grid-cols-3">
              <div>
                <label
                  htmlFor="item-cuota-actual"
                  className="block text-xs font-medium text-[#525866]"
                >
                  Cuota actual
                </label>
                <input
                  id="item-cuota-actual"
                  type="number"
                  min="1"
                  max="240"
                  value={cuotaActualStr}
                  onChange={(e) => setCuotaActualStr(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[#E4E3DD] bg-white px-3 py-1.5 font-mono-tabular text-sm text-[#111318]"
                />
              </div>
              <div>
                <label
                  htmlFor="item-cuotas-totales"
                  className="block text-xs font-medium text-[#525866]"
                >
                  Total cuotas
                </label>
                <input
                  id="item-cuotas-totales"
                  type="number"
                  min="1"
                  max="240"
                  value={cuotasTotalesStr}
                  onChange={(e) => setCuotasTotalesStr(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[#E4E3DD] bg-white px-3 py-1.5 font-mono-tabular text-sm text-[#111318]"
                />
              </div>
              <div>
                <label
                  htmlFor="item-mes-fin"
                  className="block text-xs font-medium text-[#525866]"
                >
                  Último mes
                </label>
                <input
                  id="item-mes-fin"
                  type="text"
                  maxLength={40}
                  value={mesFinEstimado}
                  onChange={(e) => setMesFinEstimado(e.target.value)}
                  placeholder="Jun 2027"
                  className="mt-1 w-full rounded-lg border border-[#E4E3DD] bg-white px-3 py-1.5 text-sm text-[#111318]"
                />
              </div>
            </div>
          )}

          {(categoria === 'TARJETA_ROTATIVA' ||
            categoria === 'DEUDA_CON_QUITA') && (
            <div className="grid grid-cols-1 gap-4 rounded-xl border border-[#E4E3DD] bg-[#F6F6F3] p-3.5 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="item-saldo-capital"
                  className="block text-xs font-medium text-[#525866]"
                >
                  Saldo total adeudado (ARS)
                </label>
                <input
                  id="item-saldo-capital"
                  type="number"
                  step="0.01"
                  min="0"
                  value={saldoCapitalStr}
                  onChange={(e) => setSaldoCapitalStr(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[#E4E3DD] bg-white px-3 py-1.5 font-mono-tabular text-sm text-[#111318]"
                />
              </div>
              {categoria === 'DEUDA_CON_QUITA' && (
                <div>
                  <label
                    htmlFor="item-quita-contado"
                    className="block text-xs font-medium text-[#525866]"
                  >
                    Oferta contado con quita (ARS)
                  </label>
                  <input
                    id="item-quita-contado"
                    type="number"
                    step="0.01"
                    min="0"
                    value={ofertaQuitaStr}
                    onChange={(e) => setOfertaQuitaStr(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-[#E4E3DD] bg-white px-3 py-1.5 font-mono-tabular text-sm text-[#111318]"
                  />
                </div>
              )}
            </div>
          )}

          <div>
            <label
              htmlFor="item-notas"
              className="block text-xs font-semibold text-[#111318]"
            >
              Notas opcionales
            </label>
            <textarea
              id="item-notas"
              rows={2}
              maxLength={1000}
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-[#E4E3DD] bg-[#F6F6F3] px-3 py-2 text-xs text-[#111318] focus:border-[#1D4ED8] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/20"
            />
          </div>

          {editingItem && hasFuturePeriods && (
            <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-[#BFDBFE] bg-[#EFF6FF] p-3 text-xs text-[#1D4ED8]">
              <input
                type="checkbox"
                checked={applyToFuture}
                onChange={(e) => setApplyToFuture(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-[#BFDBFE] accent-[#1D4ED8]"
              />
              <span>
                Aplicar también estos días de cierre/vencimiento y monto a los{' '}
                <strong>meses siguientes ya generados</strong> (sin tocar meses anteriores).
              </span>
            </label>
          )}

          {error && (
            <p
              role="alert"
              className="rounded-lg border border-[#FECACA] bg-[#FEF2F2] px-3 py-2 text-xs font-medium text-[#B91C1C]"
            >
              {error}
            </p>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-[#E4E3DD] bg-[#F6F6F3] px-4 py-2 text-xs font-semibold text-[#111318] transition-colors hover:bg-[#EEEDE8]"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="rounded-xl bg-[#1D4ED8] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#1E40AF]"
            >
              {editingItem ? 'Guardar Cambios' : 'Agregar Registro'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
