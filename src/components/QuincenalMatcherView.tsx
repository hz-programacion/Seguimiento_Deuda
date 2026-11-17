import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  AlertTriangle,
  ArrowLeftRight,
  ArrowRight,
  Check,
  CheckCircle2,
  Paperclip,
  Pencil,
  Plus,
  ShieldCheck,
  ShoppingBasket,
  Trash2,
  Undo2,
} from 'lucide-react';
import {
  BankingPaymentStatus,
  CashFlowMatchResult,
  FoodBudgetStatus,
  FoodExpense,
  ItemFinanciero,
  QuincenaCaja,
  VentanaQuincena,
} from '../types/finance';
import {
  formatDateAR,
  formatPeriodoLabel,
  formatShortDateAR,
} from '../utils/dateUtils';
import { MoneyUtils } from '../utils/moneyUtils';
import { InlineAmountEditor } from './InlineAmountEditor';
import { InlineDateEditor } from './InlineDateEditor';

interface QuincenalMatcherViewProps {
  matchResult: CashFlowMatchResult;
  foodExpenses: FoodExpense[];
  foodBudgetStatus: FoodBudgetStatus;
  currentUserUid: string;
  canEditFinances: boolean;
  minFoodReserveARS: number;
  onChangeMinFoodReserveARS: (val: number) => void;
  onMarkPaid: (item: ItemFinanciero) => void;
  onUndoPaid: (item: ItemFinanciero) => void;
  onEditItem: (item: ItemFinanciero) => void;
  onQuickUpdateAmount: (item: ItemFinanciero, newAmount: number) => void;
  onQuickUpdateDates: (
    item: ItemFinanciero,
    updates: { fechaExactaVencimiento?: string; fechaCierre?: string }
  ) => void;
  onOpenReceipts: (item: ItemFinanciero) => void;
  onMoveVentana: (item: ItemFinanciero, targetVentana: VentanaQuincena) => void;
  onAddFoodExpense: (input: {
    concepto: string;
    comercio?: string;
    monto: number;
    fechaISO: string;
  }) => Promise<void> | void;
  onDeleteFoodExpense: (expenseId: string) => Promise<void> | void;
}

function getStatusIndicator(status: BankingPaymentStatus): {
  label: string;
  dotClass: string;
  textClass: string;
} {
  if (status === 'PAGAR_AHORA') {
    return {
      label: 'Pagar ahora',
      dotClass: 'bg-[#1D4ED8]',
      textClass: 'text-[#1D4ED8]',
    };
  }
  if (status === 'ESPERAR_CIERRE') {
    return {
      label: 'Esperar cierre',
      dotClass: 'bg-[#D97706]',
      textClass: 'text-[#B45309]',
    };
  }
  if (status === 'EXCEDE_TOPE_COMIDA') {
    return {
      label: 'Excede tope comida',
      dotClass: 'bg-[#DC2626]',
      textClass: 'text-[#B91C1C]',
    };
  }
  return {
    label: 'Pagado',
    dotClass: 'bg-[#9CA3AF]',
    textClass: 'text-[#525866]',
  };
}

const QuincenaColumn: React.FC<{
  caja: QuincenaCaja;
  canEditFinances: boolean;
  onMarkPaid: (item: ItemFinanciero) => void;
  onUndoPaid: (item: ItemFinanciero) => void;
  onEditItem: (item: ItemFinanciero) => void;
  onQuickUpdateAmount: (item: ItemFinanciero, newAmount: number) => void;
  onQuickUpdateDates: (
    item: ItemFinanciero,
    updates: { fechaExactaVencimiento?: string; fechaCierre?: string }
  ) => void;
  onOpenReceipts: (item: ItemFinanciero) => void;
  onMoveVentana: (item: ItemFinanciero, targetVentana: VentanaQuincena) => void;
}> = ({
  caja,
  canEditFinances,
  onMarkPaid,
  onUndoPaid,
  onEditItem,
  onQuickUpdateAmount,
  onQuickUpdateDates,
  onOpenReceipts,
  onMoveVentana,
}) => {
  const isFirstHalf = caja.ventana === 'Q1_DIAS_1_AL_14';
  const oppositeVentana: VentanaQuincena = isFirstHalf
    ? 'Q2_DIAS_15_AL_31'
    : 'Q1_DIAS_1_AL_14';
  const moveLabel = isFirstHalf ? 'Pasar a 2°Q' : 'Pasar a 1°Q';

  const safeCap = Math.max(1, caja.presupuestoPagableSinComidaCents);
  const utilizationPct = Math.min(
    100,
    Math.round((caja.obligacionesCents / safeCap) * 100)
  );
  const exceedsSafeCap =
    caja.obligacionesCents > caja.presupuestoPagableSinComidaCents;

  return (
    <section
      aria-labelledby={`heading-${caja.ventana}`}
      className="flex flex-col overflow-hidden rounded-2xl border border-[#DFDDD4] bg-white shadow-[0_2px_10px_rgba(17,19,24,0.04)]"
    >
      {/* Cabecera distintiva de quincena */}
      <div
        className={`flex items-start justify-between gap-4 border-b px-5 py-4 sm:px-6 ${
          isFirstHalf
            ? 'border-[#DCE7FE] bg-[#F4F7FF]'
            : 'border-[#E7E5DC] bg-[#F7F7F3]'
        }`}
      >
        <div>
          <span className="font-mono-tabular text-[11px] font-bold uppercase tracking-wider text-[#1D4ED8]">
            {isFirstHalf ? 'Ventana 01' : 'Ventana 02'}
          </span>
          <h2
            id={`heading-${caja.ventana}`}
            className="mt-0.5 font-display text-lg font-bold text-[#111318]"
          >
            {isFirstHalf ? '1° Quincena' : '2° Quincena'}
          </h2>
          <p className="text-xs text-[#525866]">{caja.rangoDias}</p>
        </div>
        <div className="text-right">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[#686E7D]">
            Caja disponible
          </p>
          <p className="mt-0.5 font-mono-tabular text-xl font-bold text-[#1D4ED8]">
            {MoneyUtils.formatARSCents(caja.disponibleTotalCents)}
          </p>
        </div>
      </div>

      {/* Bloque 1: 4 métricas + medidor de carga */}
      <div className="space-y-3 border-b border-[#ECEAE2] px-5 py-4 sm:px-6">
        <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
          <div className="rounded-xl border border-[#ECEAE2] bg-[#FAF9F6] p-2.5">
            <p className="text-[11px] text-[#686E7D]">Ingresos</p>
            <p className="mt-0.5 font-mono-tabular font-bold text-[#111318]">
              {MoneyUtils.formatARSCents(caja.disponibleTotalCents)}
            </p>
          </div>
          <div className="rounded-xl border border-[#DCE7FE] bg-[#F4F7FF] p-2.5">
            <p className="text-[11px] text-[#1D4ED8]">Comida mín.</p>
            <p className="mt-0.5 font-mono-tabular font-bold text-[#1D4ED8]">
              {MoneyUtils.formatARSCents(caja.reservaComidaSugeridaCents)}
            </p>
          </div>
          <div className="rounded-xl border border-[#E0E7FF] bg-[#F5F3FF] p-2.5">
            <p className="text-[11px] text-[#4338CA]">Tope seguro</p>
            <p className="mt-0.5 font-mono-tabular font-bold text-[#4338CA]">
              {MoneyUtils.formatARSCents(caja.presupuestoPagableSinComidaCents)}
            </p>
          </div>
          <div className="rounded-xl border border-[#ECEAE2] bg-[#FAF9F6] p-2.5">
            <p className="text-[11px] text-[#686E7D]">Hoy pagable</p>
            <p className="mt-0.5 font-mono-tabular font-bold text-[#111318]">
              {MoneyUtils.formatARSCents(caja.totalRecomendadoAhoraCents)}
            </p>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between text-[11px] font-mono-tabular">
            <span className="font-sans text-[#525866]">
              Uso del tope pagable sin tocar comida
            </span>
            <span
              className={
                exceedsSafeCap ? 'font-bold text-[#B45309]' : 'font-bold text-[#1D4ED8]'
              }
            >
              {MoneyUtils.formatCompactCents(caja.obligacionesCents)} /{' '}
              {MoneyUtils.formatCompactCents(
                caja.presupuestoPagableSinComidaCents
              )}
            </span>
          </div>
          <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-[#ECEAE2]">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${utilizationPct}%` }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              className={`h-full ${
                exceedsSafeCap ? 'bg-[#D97706]' : 'bg-[#1D4ED8]'
              }`}
            />
          </div>
        </div>
      </div>

      {(caja.totalEsperandoCierreCents > 0 || caja.totalExcedeTopeCents > 0) && (
        <div className="flex flex-wrap gap-3 border-b border-[#ECEAE2] bg-[#FFFBEB]/60 px-5 py-2.5 font-mono-tabular text-[11px] sm:px-6">
          {caja.totalEsperandoCierreCents > 0 && (
            <span className="font-semibold text-[#B45309]">
              Esperando cierre:{' '}
              {MoneyUtils.formatARSCents(caja.totalEsperandoCierreCents)}
            </span>
          )}
          {caja.totalExcedeTopeCents > 0 && (
            <span className="font-semibold text-[#B91C1C]">
              Excede tope comida:{' '}
              {MoneyUtils.formatARSCents(caja.totalExcedeTopeCents)}
            </span>
          )}
        </div>
      )}

      {/* Bloque 2: Ingresos de esta quincena con edición completa */}
      <div className="border-b border-[#ECEAE2] bg-[#FAF9F6] px-5 py-4 sm:px-6">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#686E7D]">
            Ingresos que fondean esta quincena ({caja.itemsIngreso.length})
          </h3>
          <span className="font-mono-tabular text-xs font-bold text-[#1D4ED8]">
            {MoneyUtils.formatARSCents(caja.ingresosCents)}
          </span>
        </div>

        <div className="mt-3 divide-y divide-[#ECEAE2]">
          {caja.remanenteArrastreCents > 0 && (
            <div className="flex items-center justify-between py-2.5 text-xs font-medium text-[#4338CA]">
              <span>Sobrante que pasa de la 1° Quincena</span>
              <span className="font-mono-tabular font-bold">
                +{MoneyUtils.formatARSCents(caja.remanenteArrastreCents)}
              </span>
            </div>
          )}
          {caja.itemsIngreso.length === 0 && caja.remanenteArrastreCents === 0 && (
            <p className="py-2 text-xs text-[#747A88]">
              Sin cobros asignados en esta quincena.
            </p>
          )}
          {caja.itemsIngreso.map((inc) => {
            const attachCount = inc.adjuntos?.length ?? 0;
            const effectiveAmount =
              inc.estado === 'PAGADO' && inc.montoPagado !== undefined
                ? inc.montoPagado
                : inc.montoPactado;
            const hasIncomeVariance =
              inc.estado === 'PAGADO' &&
              inc.montoPagado !== undefined &&
              inc.montoPagado !== inc.montoPactado;
            return (
              <div
                key={inc.id}
                className="flex flex-col gap-2 py-3 text-xs sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-semibold text-[#111318]">
                      {inc.titulo}
                    </span>
                    <span
                      className={`font-semibold ${
                        inc.estado === 'PAGADO'
                          ? 'text-[#1D4ED8]'
                          : 'text-[#747A88]'
                      }`}
                    >
                      · {inc.estado === 'PAGADO' ? 'Cobrado' : 'Esperado'}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-[#525866]">
                    <InlineDateEditor
                      itemTitle={inc.titulo}
                      label="Cobro"
                      dateISO={inc.fechaExactaVencimiento}
                      readOnly={!canEditFinances}
                      onSaveDate={(val) =>
                        onQuickUpdateDates(inc, {
                          fechaExactaVencimiento: val,
                        })
                      }
                    />
                    <span>· {inc.bolsilloResponsable}</span>
                    {hasIncomeVariance && (
                      <span className="font-mono-tabular text-[11px] text-[#4338CA]">
                        · Pactado: {MoneyUtils.formatARS(inc.montoPactado)}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-1.5 sm:justify-end shrink-0">
                  <InlineAmountEditor
                    itemTitle={inc.titulo}
                    amount={effectiveAmount}
                    prefix="+"
                    readOnly={!canEditFinances}
                    textClassName="text-xs font-bold text-[#1D4ED8]"
                    onSaveAmount={(val) => onQuickUpdateAmount(inc, val)}
                  />
                  <button
                    type="button"
                    onClick={() => onOpenReceipts(inc)}
                    aria-label={`Comprobantes de ${inc.titulo}`}
                    className={`inline-flex min-h-[32px] items-center gap-1 rounded-lg border px-2 py-1 text-[11px] ${
                      attachCount > 0
                        ? 'border-[#BFDBFE] bg-[#EFF6FF] text-[#1D4ED8]'
                        : 'border-[#DFDDD4] bg-white text-[#525866]'
                    }`}
                  >
                    <Paperclip className="h-3 w-3" aria-hidden="true" />
                    {attachCount > 0 && (
                      <span className="font-mono-tabular font-semibold">
                        {attachCount}
                      </span>
                    )}
                  </button>
                  {canEditFinances && (
                    <>
                      <button
                        type="button"
                        onClick={() => onEditItem(inc)}
                        aria-label={`Editar todo de ${inc.titulo}`}
                        className="inline-flex min-h-[32px] min-w-[32px] items-center justify-center rounded-lg border border-[#DFDDD4] bg-white p-1 text-[#525866] hover:text-[#111318]"
                      >
                        <Pencil className="h-3 w-3" aria-hidden="true" />
                      </button>
                      {inc.estado === 'PENDIENTE' ? (
                        <button
                          type="button"
                          onClick={() => onMarkPaid(inc)}
                          aria-label={`Marcar cobrado ${inc.titulo}`}
                          className="inline-flex min-h-[32px] items-center gap-1 rounded-lg bg-[#1D4ED8] px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-[#1E40AF]"
                        >
                          <Check className="h-3 w-3" aria-hidden="true" />
                          Cobrado
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onUndoPaid(inc)}
                          aria-label={`Revertir cobro ${inc.titulo}`}
                          className="inline-flex min-h-[32px] items-center gap-1 rounded-lg border border-[#DFDDD4] bg-white px-2 py-1 text-[11px] font-medium text-[#525866]"
                        >
                          <Undo2 className="h-3 w-3" aria-hidden="true" />
                          Pendiente
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Bloque 3: Obligaciones calzadas */}
      <div className="flex-1 px-5 py-4 sm:px-6">
        <div className="flex items-center justify-between pb-2">
          <h3 className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#686E7D]">
            Pagos de esta quincena ({caja.asignaciones.length})
          </h3>
          <span className="font-mono-tabular text-xs font-bold text-[#111318]">
            Total: {MoneyUtils.formatARSCents(caja.obligacionesCents)}
          </span>
        </div>

        {caja.asignaciones.length === 0 ? (
          <p className="mt-4 text-xs text-[#747A88]">
            No hay vencimientos asignados en esta quincena.
          </p>
        ) : (
          <div className="divide-y divide-[#ECEAE2]">
            {caja.asignaciones.map((alloc) => {
              const statusMeta = getStatusIndicator(alloc.bankingStatus);
              const ob = alloc.obligacion;
              const effectiveAmount =
                ob.estado === 'PAGADO' && ob.montoPagado !== undefined
                  ? ob.montoPagado
                  : ob.montoPactado;
              const hasExpenseVariance =
                ob.estado === 'PAGADO' &&
                ob.montoPagado !== undefined &&
                ob.montoPagado !== ob.montoPactado;

              return (
                <div key={ob.id} className="space-y-2 py-3.5">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
                        <span
                          className={`inline-flex items-center gap-1.5 font-semibold ${statusMeta.textClass}`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${statusMeta.dotClass}`}
                            aria-hidden="true"
                          />
                          {statusMeta.label}
                        </span>
                        <span className="text-[#D4D2CA]">·</span>
                        <span
                          className={
                            alloc.prioridad === 'CRITICA'
                              ? 'font-semibold text-[#DC2626]'
                              : alloc.prioridad === 'ALTA'
                                ? 'font-semibold text-[#B45309]'
                                : 'text-[#747A88]'
                          }
                        >
                          {alloc.prioridad === 'CRITICA'
                            ? 'Urgente'
                            : alloc.prioridad === 'ALTA'
                              ? 'Pronto'
                              : 'Programado'}
                        </span>
                      </div>

                      <p className="text-sm font-bold text-[#111318]">
                        {ob.titulo}
                      </p>

                      <p className="font-mono-tabular text-xs text-[#525866]">
                        Vence {formatDateAR(ob.fechaExactaVencimiento)}
                        {alloc.ventanaPagoDesdeISO && (
                          <span className="font-semibold text-[#B45309]">
                            {' '}
                            · Ventana {formatShortDateAR(alloc.ventanaPagoDesdeISO)}→
                            {formatShortDateAR(alloc.fechaLimiteRecomendadaISO)}
                          </span>
                        )}
                        {hasExpenseVariance && (
                          <span className="font-semibold text-[#B45309]">
                            {' '}
                            · Pactado: {MoneyUtils.formatARS(ob.montoPactado)}
                          </span>
                        )}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 sm:justify-end shrink-0">
                      <InlineAmountEditor
                        itemTitle={ob.titulo}
                        amount={effectiveAmount}
                        readOnly={!canEditFinances}
                        textClassName="text-sm font-bold text-[#111318]"
                        onSaveAmount={(val) => onQuickUpdateAmount(ob, val)}
                      />
                      {canEditFinances && (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => onMoveVentana(ob, oppositeVentana)}
                            title={`Mover a la otra quincena (${moveLabel})`}
                            className="inline-flex min-h-[34px] items-center gap-1 rounded-lg border border-[#DFDDD4] bg-[#F7F7F3] px-2.5 py-1 text-[11px] font-medium text-[#111318] hover:bg-[#ECEAE2]"
                          >
                            <ArrowLeftRight
                              className="h-3 w-3"
                              aria-hidden="true"
                            />
                            {moveLabel}
                          </button>
                          {ob.estado === 'PENDIENTE' && (
                            <button
                              type="button"
                              onClick={() => onMarkPaid(ob)}
                              aria-label={`Pagar ${ob.titulo}`}
                              className="inline-flex min-h-[34px] items-center rounded-lg bg-[#1D4ED8] px-3 py-1 text-xs font-semibold text-white hover:bg-[#1E40AF]"
                            >
                              Pagar
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {alloc.avisoBancario && (
                    <p className="rounded-lg border border-[#ECEAE2] bg-[#FAF9F6] px-3 py-2 text-[11px] leading-relaxed text-[#525866]">
                      {alloc.avisoBancario}
                    </p>
                  )}

                  {alloc.bolsillosSugeridos.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 text-xs text-[#525866]">
                      <ArrowRight
                        className="h-3 w-3 text-[#1D4ED8] shrink-0"
                        aria-hidden="true"
                      />
                      <span>Se paga con:</span>
                      {alloc.bolsillosSugeridos.map((b, idx) => (
                        <span
                          key={`${b.bolsillo}-${idx}`}
                          className="font-mono-tabular font-semibold text-[#111318]"
                        >
                          {b.bolsillo} (
                          {MoneyUtils.formatARSCents(b.montoAsignadoCents)})
                          {idx < alloc.bolsillosSugeridos.length - 1 ? ' + ' : ''}
                        </span>
                      ))}
                      {alloc.faltanteCents > 0 && (
                        <span className="font-mono-tabular font-bold text-[#DC2626]">
                          · Faltante{' '}
                          {MoneyUtils.formatARSCents(alloc.faltanteCents)}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Saldo libre al cierre */}
      <div className="flex items-center justify-between border-t border-[#E7E5DC] bg-[#F7F7F3] px-5 py-4 text-sm sm:px-6">
        <span className="font-medium text-[#525866]">
          Plata libre tras pagar cuentas
        </span>
        <span
          className={`font-mono-tabular font-bold ${
            caja.saldoLibrePostPagosCents >= 0
              ? 'text-[#1D4ED8]'
              : 'text-[#DC2626]'
          }`}
        >
          {MoneyUtils.formatARSCents(caja.saldoLibrePostPagosCents)}
        </span>
      </div>
    </section>
  );
};

export const QuincenalMatcherView: React.FC<QuincenalMatcherViewProps> = ({
  matchResult,
  foodExpenses,
  foodBudgetStatus,
  currentUserUid,
  canEditFinances,
  minFoodReserveARS,
  onChangeMinFoodReserveARS,
  onMarkPaid,
  onUndoPaid,
  onEditItem,
  onQuickUpdateAmount,
  onQuickUpdateDates,
  onOpenReceipts,
  onMoveVentana,
  onAddFoodExpense,
  onDeleteFoodExpense,
}) => {
  const { q1, q2, alertaDescalce, summary, referenceDateISO } = matchResult;

  const [concepto, setConcepto] = useState('');
  const [comercio, setComercio] = useState('');
  const [montoStr, setMontoStr] = useState('');
  const [fechaISO, setFechaISO] = useState(referenceDateISO);
  const [foodError, setFoodError] = useState<string | null>(null);
  const [savingFood, setSavingFood] = useState(false);

  useEffect(() => {
    setFechaISO(referenceDateISO);
  }, [summary.periodo, referenceDateISO]);

  const periodFoodExpenses = useMemo(
    () =>
      foodExpenses
        .filter((e) => e.periodo === summary.periodo)
        .sort((a, b) => b.fechaISO.localeCompare(a.fechaISO)),
    [foodExpenses, summary.periodo]
  );

  const handleSubmitFood = async (e: React.FormEvent) => {
    e.preventDefault();
    setFoodError(null);
    const cleanConcept = concepto.trim();
    const parsedAmount = MoneyUtils.parseARSInput(montoStr);
    if (!cleanConcept) {
      setFoodError('Escribí qué compraste (ej: Súper semanal, Verdulería).');
      return;
    }
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setFoodError('Ingresá un monto válido mayor a $0.');
      return;
    }
    setSavingFood(true);
    try {
      await onAddFoodExpense({
        concepto: cleanConcept,
        comercio: comercio.trim() || undefined,
        monto: parsedAmount,
        fechaISO: /^\d{4}-\d{2}-\d{2}$/.test(fechaISO)
          ? fechaISO
          : referenceDateISO,
      });
      setConcepto('');
      setComercio('');
      setMontoStr('');
    } catch (err) {
      setFoodError(
        err instanceof Error
          ? err.message
          : 'No se pudo guardar el gasto de comida.'
      );
    } finally {
      setSavingFood(false);
    }
  };

  const hasVariance =
    summary.desvioObligacionesCents !== 0 || summary.desvioIngresosCents !== 0;

  const foodBarPct = Math.min(100, Math.round(foodBudgetStatus.porcentajeConsumidoMinimo));
  const foodBarColor = foodBudgetStatus.excedeMinimo
    ? 'bg-[#DC2626]'
    : foodBudgetStatus.porcentajeConsumidoMinimo >= 85
      ? 'bg-[#D97706]'
      : 'bg-[#1D4ED8]';

  return (
    <div className="space-y-7">
      <div className="flex flex-col gap-3 border-b border-[#D8D6CC] pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#1D4ED8]">
            Ingresos, Calce y Comida Real
          </p>
          <h1 className="mt-0.5 font-display text-2xl font-bold tracking-tight text-[#111318] sm:text-3xl">
            Ingresos y Quincenas · {formatPeriodoLabel(summary.periodo)}
          </h1>
          <p className="mt-1 text-xs text-[#525866] sm:text-sm">
            Editá tus cobros al {formatShortDateAR(referenceDateISO)}, calzá vencimientos entre 1° y 2° Quincena y registrá las compras reales del presupuesto de comida.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="rounded-xl border border-[#DFDDD4] bg-white px-3.5 py-2 font-mono-tabular text-xs shadow-[0_1px_2px_rgba(17,19,24,0.03)]">
            <span className="font-sans text-[#686E7D]">Ingresos totales: </span>
            <span className="font-bold text-[#1D4ED8]">
              {MoneyUtils.formatARSCents(summary.ingresosTotalesCents)}
            </span>
          </div>

          <div className="flex items-center gap-2 rounded-xl border border-[#BFDBFE] bg-white px-3.5 py-2 text-xs shadow-[0_1px_2px_rgba(17,19,24,0.03)]">
            <ShieldCheck
              className="h-4 w-4 text-[#1D4ED8] shrink-0"
              aria-hidden="true"
            />
            <span className="text-[#525866]">Mínimo comida/mes:</span>
            <InlineAmountEditor
              itemTitle="mínimo mensual de comida"
              amount={minFoodReserveARS}
              readOnly={!canEditFinances}
              textClassName="text-xs font-bold text-[#1D4ED8]"
              onSaveAmount={onChangeMinFoodReserveARS}
            />
          </div>
        </div>
      </div>

      <div
        role="status"
        className={`flex items-start gap-3 rounded-2xl border p-4 shadow-[0_1px_3px_rgba(17,19,24,0.03)] ${
          alertaDescalce.hayDescalce
            ? 'border-[#F59E0B]/40 bg-[#FFFBEB]'
            : 'border-[#BFDBFE] bg-white'
        }`}
      >
        {alertaDescalce.hayDescalce ? (
          <AlertTriangle
            className="mt-0.5 h-5 w-5 shrink-0 text-[#D97706]"
            aria-hidden="true"
          />
        ) : (
          <CheckCircle2
            className="mt-0.5 h-5 w-5 shrink-0 text-[#1D4ED8]"
            aria-hidden="true"
          />
        )}
        <div className="space-y-1">
          <p
            className={`text-sm font-bold ${
              alertaDescalce.hayDescalce ? 'text-[#92400E]' : 'text-[#1D4ED8]'
            }`}
          >
            {alertaDescalce.hayDescalce
              ? `Atención en 1° Quincena: reservá ${MoneyUtils.formatARSCents(alertaDescalce.montoAReservarCents)} del mes anterior o ajustá vencimientos`
              : 'Quincenas equilibradas respetando tu mínimo de comida'}
          </p>
          <p className="text-xs text-[#525866]">{alertaDescalce.mensaje}</p>
          {hasVariance && (
            <p className="font-mono-tabular text-[11px] font-semibold text-[#4338CA]">
              Desvío real vs pactado ya reflejado en el cálculo:{' '}
              {summary.desvioObligacionesCents !== 0 && (
                <span>
                  Obligaciones{' '}
                  {summary.desvioObligacionesCents > 0 ? '+' : ''}
                  {MoneyUtils.formatARSCents(summary.desvioObligacionesCents)}
                </span>
              )}
              {summary.desvioObligacionesCents !== 0 &&
                summary.desvioIngresosCents !== 0 &&
                ' · '}
              {summary.desvioIngresosCents !== 0 && (
                <span>
                  Ingresos {summary.desvioIngresosCents > 0 ? '+' : ''}
                  {MoneyUtils.formatARSCents(summary.desvioIngresosCents)}
                </span>
              )}
            </p>
          )}
        </div>
      </div>

      {/* Bloque Real: Control Diario de Comida y Supermercado */}
      <section
        aria-labelledby="food-budget-heading"
        className="overflow-hidden rounded-2xl border border-[#DFDDD4] bg-white shadow-[0_2px_10px_rgba(17,19,24,0.04)]"
      >
        <div className="flex flex-col gap-4 border-b border-[#E7E5DC] bg-[#F5F8FF] px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#BFDBFE] bg-white text-[#1D4ED8]">
              <ShoppingBasket className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <h2
                id="food-budget-heading"
                className="font-display text-base font-bold text-[#111318] sm:text-lg"
              >
                Control Real de Comida y Supermercado
              </h2>
              <p className="text-xs text-[#525866]">
                Cada compra cargada descuenta en tiempo real del tope protegido de{' '}
                <span className="font-mono-tabular font-semibold text-[#111318]">
                  {MoneyUtils.formatARSCents(foodBudgetStatus.minimoComidaCents)}
                </span>
                . Pueden cargar compras tanto el titular como su hermana.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 font-mono-tabular text-xs shrink-0">
            <div className="rounded-xl border border-[#DFDDD4] bg-white px-3 py-2">
              <span className="block font-sans text-[10px] uppercase tracking-wider text-[#686E7D]">
                Gastado
              </span>
              <span className="font-bold text-[#111318]">
                {MoneyUtils.formatARSCents(foodBudgetStatus.gastadoMesCents)}
              </span>
            </div>
            <div className="rounded-xl border border-[#BFDBFE] bg-white px-3 py-2">
              <span className="block font-sans text-[10px] uppercase tracking-wider text-[#1D4ED8]">
                Resta (mín.)
              </span>
              <span
                className={`font-bold ${
                  foodBudgetStatus.restanteSobreMinimoCents >= 0
                    ? 'text-[#1D4ED8]'
                    : 'text-[#DC2626]'
                }`}
              >
                {MoneyUtils.formatARSCents(foodBudgetStatus.restanteSobreMinimoCents)}
              </span>
            </div>
            <div className="rounded-xl border border-[#C7D2FE] bg-white px-3 py-2">
              <span className="block font-sans text-[10px] uppercase tracking-wider text-[#4338CA]">
                Tope diario
              </span>
              <span className="font-bold text-[#4338CA]">
                {MoneyUtils.formatCompactCents(
                  foodBudgetStatus.presupuestoDiarioSugeridoCents
                )}
                /día
              </span>
            </div>
          </div>
        </div>

        <div className="space-y-4 px-5 py-4 sm:px-6">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="text-[#525866]">
                Consumo sobre mínimo protegido ({foodBudgetStatus.cantidadCompras}{' '}
                compra{foodBudgetStatus.cantidadCompras === 1 ? '' : 's'} · quedan{' '}
                {foodBudgetStatus.diasRestantesMes} día
                {foodBudgetStatus.diasRestantesMes === 1 ? '' : 's'} en el mes)
              </span>
              <span
                className={`font-mono-tabular font-bold ${
                  foodBudgetStatus.excedeMinimo ? 'text-[#DC2626]' : 'text-[#1D4ED8]'
                }`}
              >
                {foodBudgetStatus.porcentajeConsumidoMinimo.toFixed(1)}% · Queda sobre
                caja real:{' '}
                {MoneyUtils.formatARSCents(
                  foodBudgetStatus.restanteSobreDisponibleRealCents
                )}
              </span>
            </div>
            <div className="mt-1.5 h-2.5 w-full overflow-hidden rounded-full bg-[#ECEAE2]">
              <div
                style={{ width: `${foodBarPct}%` }}
                className={`h-full transition-all duration-300 ${foodBarColor}`}
              />
            </div>
          </div>

          <form
            onSubmit={handleSubmitFood}
            className="grid grid-cols-1 gap-3 rounded-xl border border-[#E7E5DC] bg-[#FAF9F6] p-3.5 sm:grid-cols-12 sm:items-end"
          >
            <div className="sm:col-span-4">
              <label
                htmlFor="food-concepto"
                className="block text-[11px] font-semibold uppercase tracking-wider text-[#525866]"
              >
                Compra / Detalle
              </label>
              <input
                id="food-concepto"
                type="text"
                value={concepto}
                onChange={(e) => setConcepto(e.target.value)}
                placeholder="Ej: Compra semanal, Carnicería"
                className="mt-1 w-full rounded-lg border border-[#D8D6CC] bg-white px-3 py-2 text-xs text-[#111318] focus:border-[#1D4ED8] focus:outline-none"
              />
            </div>
            <div className="sm:col-span-3">
              <label
                htmlFor="food-comercio"
                className="block text-[11px] font-semibold uppercase tracking-wider text-[#525866]"
              >
                Comercio (opcional)
              </label>
              <input
                id="food-comercio"
                type="text"
                value={comercio}
                onChange={(e) => setComercio(e.target.value)}
                placeholder="Coto, Carrefour, Feria"
                className="mt-1 w-full rounded-lg border border-[#D8D6CC] bg-white px-3 py-2 text-xs text-[#111318] focus:border-[#1D4ED8] focus:outline-none"
              />
            </div>
            <div className="sm:col-span-2">
              <label
                htmlFor="food-monto"
                className="block text-[11px] font-semibold uppercase tracking-wider text-[#525866]"
              >
                Monto ($)
              </label>
              <input
                id="food-monto"
                type="text"
                inputMode="decimal"
                value={montoStr}
                onChange={(e) => setMontoStr(e.target.value)}
                placeholder="48500"
                className="mt-1 w-full rounded-lg border border-[#D8D6CC] bg-white px-3 py-2 font-mono-tabular text-xs font-semibold text-[#111318] focus:border-[#1D4ED8] focus:outline-none"
              />
            </div>
            <div className="sm:col-span-2">
              <label
                htmlFor="food-fecha"
                className="block text-[11px] font-semibold uppercase tracking-wider text-[#525866]"
              >
                Fecha
              </label>
              <input
                id="food-fecha"
                type="date"
                value={fechaISO}
                onChange={(e) => setFechaISO(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[#D8D6CC] bg-white px-2.5 py-2 font-mono-tabular text-xs text-[#111318] focus:border-[#1D4ED8] focus:outline-none"
              />
            </div>
            <div className="sm:col-span-1">
              <button
                type="submit"
                disabled={savingFood}
                className="inline-flex min-h-[36px] w-full items-center justify-center gap-1 rounded-lg bg-[#1D4ED8] px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#1E40AF] disabled:opacity-60"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{savingFood ? '...' : 'Sumar'}</span>
              </button>
            </div>
          </form>

          {foodError && (
            <p className="rounded-lg border border-[#FECACA] bg-[#FEF2F2] px-3 py-2 text-xs font-medium text-[#B91C1C]">
              {foodError}
            </p>
          )}

          {periodFoodExpenses.length === 0 ? (
            <p className="text-xs text-[#747A88]">
              Todavía no cargaste compras de supermercado en{' '}
              {formatPeriodoLabel(summary.periodo)}. Registrá la primera arriba para
              ver cuánto presupuesto diario real queda.
            </p>
          ) : (
            <div className="divide-y divide-[#ECEAE2] rounded-xl border border-[#ECEAE2]">
              {periodFoodExpenses.map((exp) => {
                const canDelete =
                  canEditFinances || exp.createdByUid === currentUserUid;
                return (
                  <div
                    key={exp.id}
                    className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-xs"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-[#111318]">
                        {exp.concepto}
                        {exp.comercio && (
                          <span className="font-normal text-[#525866]">
                            {' '}
                            · {exp.comercio}
                          </span>
                        )}
                      </p>
                      <p className="font-mono-tabular text-[11px] text-[#747A88]">
                        {formatDateAR(exp.fechaISO)} · Cargado por{' '}
                        {exp.createdByEmail}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-mono-tabular text-sm font-bold text-[#111318]">
                        -{MoneyUtils.formatARS(exp.monto)}
                      </span>
                      {canDelete && (
                        <button
                          type="button"
                          onClick={() => void onDeleteFoodExpense(exp.id)}
                          aria-label={`Eliminar gasto de comida ${exp.concepto}`}
                          className="inline-flex min-h-[30px] min-w-[30px] items-center justify-center rounded-lg border border-[#FECACA] bg-[#FEF2F2] p-1 text-[#DC2626] hover:bg-[#FEE2E2]"
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <QuincenaColumn
          caja={q1}
          canEditFinances={canEditFinances}
          onMarkPaid={onMarkPaid}
          onUndoPaid={onUndoPaid}
          onEditItem={onEditItem}
          onQuickUpdateAmount={onQuickUpdateAmount}
          onQuickUpdateDates={onQuickUpdateDates}
          onOpenReceipts={onOpenReceipts}
          onMoveVentana={onMoveVentana}
        />
        <QuincenaColumn
          caja={q2}
          canEditFinances={canEditFinances}
          onMarkPaid={onMarkPaid}
          onUndoPaid={onUndoPaid}
          onEditItem={onEditItem}
          onQuickUpdateAmount={onQuickUpdateAmount}
          onQuickUpdateDates={onQuickUpdateDates}
          onOpenReceipts={onOpenReceipts}
          onMoveVentana={onMoveVentana}
        />
      </div>
    </div>
  );
};

