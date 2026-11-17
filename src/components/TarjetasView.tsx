import React, { useMemo, useState } from 'react';
import {
  Calendar,
  Check,
  Clock,
  CreditCard,
  Paperclip,
  Pencil,
  Sparkles,
  Undo2,
} from 'lucide-react';
import {
  AppTab,
  CashFlowMatchResult,
  ItemFinanciero,
} from '../types/finance';
import {
  formatPeriodoLabel,
  formatShortDateAR,
  validateCardCycleDates,
} from '../utils/dateUtils';
import { estimateMonthlyCardInterestCents } from '../utils/cashFlowMatcher';
import { MoneyUtils } from '../utils/moneyUtils';
import { ConfirmDialog } from './ConfirmDialog';
import { InlineAmountEditor } from './InlineAmountEditor';
import { InlineDateEditor } from './InlineDateEditor';

interface TarjetasViewProps {
  matchResult: CashFlowMatchResult;
  periodItems: ItemFinanciero[];
  canEditFinances: boolean;
  hasFuturePeriods?: boolean;
  minFoodReserveARS: number;
  onChangeMinFoodReserveARS: (val: number) => void;
  onMarkPaid: (item: ItemFinanciero) => void;
  onUndoPaid: (item: ItemFinanciero) => void;
  onEditItem: (item: ItemFinanciero) => void;
  onQuickUpdateAmount: (item: ItemFinanciero, newAmount: number) => void;
  onQuickUpdateCapital: (item: ItemFinanciero, newCapital: number) => void;
  onAmortizeCard: (
    card: ItemFinanciero,
    amountARS: number,
    applyToFuture: boolean
  ) => void;
  onQuickUpdateDates: (
    item: ItemFinanciero,
    updates: { fechaExactaVencimiento?: string; fechaCierre?: string }
  ) => void;
  onOpenReceipts: (item: ItemFinanciero) => void;
  onNavigateTab: (tab: AppTab) => void;
}

const ReceiptsPillButton: React.FC<{
  item: ItemFinanciero;
  onOpenReceipts: (item: ItemFinanciero) => void;
}> = ({ item, onOpenReceipts }) => {
  const count = item.adjuntos?.length ?? 0;
  return (
    <button
      type="button"
      onClick={() => onOpenReceipts(item)}
      aria-label={`Resúmenes y comprobantes de ${item.titulo}`}
      title="Resúmenes PDF y comprobantes en Google Drive"
      className={`inline-flex min-h-[34px] items-center gap-1 rounded-lg border px-2.5 py-1 text-xs transition-colors shrink-0 ${
        count > 0
          ? 'border-[#BFDBFE] bg-[#EFF6FF] text-[#1D4ED8] hover:bg-[#DBEAFE]'
          : 'border-[#DFDDD4] bg-[#F7F7F3] text-[#525866] hover:border-[#C9C6BA] hover:text-[#111318]'
      }`}
    >
      <Paperclip className="h-3.5 w-3.5" aria-hidden="true" />
      <span className="font-medium">Resumen</span>
      {count > 0 && (
        <span className="font-mono-tabular font-bold">({count})</span>
      )}
    </button>
  );
};

export const TarjetasView: React.FC<TarjetasViewProps> = ({
  matchResult,
  periodItems,
  canEditFinances,
  hasFuturePeriods = false,
  minFoodReserveARS,
  onChangeMinFoodReserveARS,
  onMarkPaid,
  onUndoPaid,
  onEditItem,
  onQuickUpdateAmount,
  onQuickUpdateCapital,
  onAmortizeCard,
  onQuickUpdateDates,
  onOpenReceipts,
  onNavigateTab,
}) => {
  const [extraCapitalSimARS, setExtraCapitalSimARS] = useState<number>(500000);
  const [pendingAmortization, setPendingAmortization] = useState<{
    card: ItemFinanciero;
    amountARS: number;
    previousCapitalARS: number;
    nextCapitalARS: number;
    monthlySavedCents: number;
  } | null>(null);
  const [applyAmortizationToFuture, setApplyAmortizationToFuture] =
    useState(true);

  const { summary, tarjetasBloqueadasPorCierre } = matchResult;

  const carrefourItems = useMemo(
    () =>
      periodItems
        .filter(
          (i) =>
            i.subgrupo?.toLowerCase().includes('carrefour') &&
            i.estado !== 'EXTINGUIDO'
        )
        .sort((a, b) => a.diaVencimientoOCobro - b.diaVencimientoOCobro),
    [periodItems]
  );

  const carrefourTotalCents = MoneyUtils.sumCents(
    carrefourItems.map((i) => MoneyUtils.toCents(i.montoPactado))
  );

  const rotatingCards = useMemo(
    () =>
      periodItems
        .filter(
          (i) => i.categoria === 'TARJETA_ROTATIVA' && i.estado !== 'EXTINGUIDO'
        )
        .sort((a, b) => a.diaVencimientoOCobro - b.diaVencimientoOCobro),
    [periodItems]
  );

  const totalRotatingDebtCents = MoneyUtils.sumCents(
    rotatingCards.map((c) => MoneyUtils.toCents(c.saldoCapitalTotal ?? 0))
  );

  const cardSimulations = useMemo(() => {
    return rotatingCards.map((card, idx) => {
      const capARS = Math.max(0, card.saldoCapitalTotal ?? 0);
      const tna = card.tnaEstimada ?? 0;
      const newCapARS = MoneyUtils.fromCents(
        Math.max(0, MoneyUtils.toCents(capARS) - MoneyUtils.toCents(extraCapitalSimARS))
      );
      const monthlyIntSavedCents = Math.max(
        0,
        estimateMonthlyCardInterestCents(capARS, tna) -
          estimateMonthlyCardInterestCents(newCapARS, tna)
      );
      return {
        card,
        optionLetter: String.fromCharCode(65 + idx),
        capARS,
        tna,
        newCapARS,
        monthlyIntSavedCents,
      };
    });
  }, [rotatingCards, extraCapitalSimARS]);

  return (
    <div className="space-y-8">
      {/* Encabezado */}
      <div className="flex flex-col gap-4 border-b border-[#D8D6CC] pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#DC2626]">
            Control de Tarjetas y Cierres
          </p>
          <h1 className="mt-0.5 font-display text-2xl font-bold tracking-tight text-[#111318] sm:text-3xl">
            Tarjetas de Crédito · {formatPeriodoLabel(summary.periodo)}
          </h1>
          <p className="mt-1 text-xs text-[#525866] sm:text-sm">
            Cierres reales, ventanas anti-doble-pago, deuda capital rotativa y simulador de amortización.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="rounded-xl border border-[#DFDDD4] bg-white px-3.5 py-2 font-mono-tabular text-xs shadow-[0_1px_2px_rgba(17,19,24,0.03)]">
            <span className="font-sans text-[#686E7D]">Mínimos del mes: </span>
            <span className="font-bold text-[#DC2626]">
              {MoneyUtils.formatARSCents(summary.tarjetasTotalesCents)}
            </span>
          </div>
          {totalRotatingDebtCents > 0 && (
            <div className="rounded-xl border border-[#DFDDD4] bg-white px-3.5 py-2 font-mono-tabular text-xs shadow-[0_1px_2px_rgba(17,19,24,0.03)]">
              <span className="font-sans text-[#686E7D]">Capital adeudado: </span>
              <span className="font-bold text-[#111318]">
                {MoneyUtils.formatARSCents(totalRotatingDebtCents)}
              </span>
            </div>
          )}
          <button
            type="button"
            onClick={() => onNavigateTab('calendario')}
            className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl border border-[#BFDBFE] bg-white px-3.5 py-2 text-xs font-semibold text-[#1D4ED8] transition-colors hover:bg-[#EFF6FF] whitespace-nowrap"
          >
            <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
            Ver Ventanas en Agenda
          </button>
        </div>
      </div>

      {/* Alerta Anti-Doble-Pago */}
      {tarjetasBloqueadasPorCierre.length > 0 && (
        <section
          aria-labelledby="tarjetas-bloqueadas-heading"
          className="overflow-hidden rounded-2xl border border-[#F59E0B]/40 bg-white shadow-[0_2px_8px_rgba(217,119,6,0.06)]"
        >
          <div className="border-b border-[#FDE68A] bg-[#FFFBEB] px-6 py-4">
            <h2
              id="tarjetas-bloqueadas-heading"
              className="flex items-center gap-2 font-display text-sm font-bold text-[#92400E]"
            >
              <Clock className="h-4 w-4 shrink-0 text-[#D97706]" aria-hidden="true" />
              Esperar Cierre · Regla Anti-Doble-Pago ({tarjetasBloqueadasPorCierre.length})
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-[#78350F]">
              Abonar antes de la fecha de cierre no cancela el Pago Mínimo del resumen que emite el banco. Esperá la ventana habilitada:
            </p>
          </div>

          <div className="divide-y divide-[#ECEAE2] px-6">
            {tarjetasBloqueadasPorCierre.map((b) => (
              <div
                key={b.obligacion.id}
                className="flex flex-col gap-1 py-3.5 text-xs sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="font-bold text-[#111318]">
                    {b.obligacion.titulo}
                  </p>
                  <p className="mt-0.5 font-mono-tabular text-[11px] font-medium text-[#92400E]">
                    Cierre {formatShortDateAR(b.obligacion.fechaCierre!)} · Pagar del{' '}
                    {formatShortDateAR(b.ventanaPagoDesdeISO!)} al{' '}
                    {formatShortDateAR(b.fechaLimiteRecomendadaISO)}
                  </p>
                </div>
                <span className="font-mono-tabular text-sm font-bold text-[#111318] shrink-0">
                  {MoneyUtils.formatARS(b.obligacion.montoPactado)}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Tarjetas Rotativas + Carrefour */}
      {carrefourItems.length === 0 && rotatingCards.length === 0 ? (
        <div className="rounded-2xl border border-[#DFDDD4] bg-white px-6 py-12 text-center shadow-[0_2px_10px_rgba(17,19,24,0.04)]">
          <CreditCard className="mx-auto h-8 w-8 text-[#9CA3AF]" aria-hidden="true" />
          <p className="mt-3 font-display text-base font-bold text-[#111318]">
            No hay tarjetas cargadas en {formatPeriodoLabel(summary.periodo)}
          </p>
          <p className="mt-1 text-xs text-[#525866]">
            Usá el botón Nuevo Registro en la barra superior para agregar un resumen o tarjeta rotativa.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Tarjetas Rotativas */}
          {rotatingCards.length > 0 && (
            <section aria-labelledby="rotativas-heading" className="space-y-4">
              <div className="flex items-center gap-3">
                <span className="font-mono-tabular text-[11px] font-bold text-[#1D4ED8]">
                  01
                </span>
                <h2
                  id="rotativas-heading"
                  className="font-display text-sm font-bold uppercase tracking-[0.1em] text-[#111318] whitespace-nowrap"
                >
                  Tarjetas Rotativas y Resúmenes
                </h2>
                <div className="h-px flex-1 bg-[#D8D6CC]" aria-hidden="true" />
              </div>

              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                {rotatingCards.map((card) => {
                  const cycleCheck = validateCardCycleDates(
                    card.fechaCierre,
                    card.fechaExactaVencimiento
                  );
                  const monthlyInterestCents = estimateMonthlyCardInterestCents(
                    card.saldoCapitalTotal,
                    card.tnaEstimada
                  );
                  return (
                    <article
                      key={card.id}
                      className="flex flex-col justify-between overflow-hidden rounded-2xl border border-[#DFDDD4] bg-white shadow-[0_2px_10px_rgba(17,19,24,0.04)]"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-3 border-b border-[#F3DFDF] bg-[#FEF8F8] px-6 py-4">
                          <div className="min-w-0">
                            <span
                              className={`text-[11px] font-bold uppercase tracking-wider ${
                                card.estado === 'PAGADO'
                                  ? 'text-[#1D4ED8]'
                                  : 'text-[#B45309]'
                              }`}
                            >
                              {card.estado} · {card.bolsilloResponsable}
                            </span>
                            <h3 className="mt-0.5 truncate font-display text-lg font-bold text-[#111318]">
                              {card.titulo}
                            </h3>
                          </div>

                          <div className="text-right shrink-0">
                            <span className="block text-[10px] font-semibold uppercase tracking-wider text-[#686E7D]">
                              Pago del mes
                            </span>
                            <InlineAmountEditor
                              itemTitle={card.titulo}
                              amount={card.montoPactado}
                              readOnly={!canEditFinances}
                              textClassName="text-base font-bold text-[#DC2626]"
                              onSaveAmount={(val) =>
                                onQuickUpdateAmount(card, val)
                              }
                            />
                          </div>
                        </div>

                        <div className="space-y-4 p-6">
                          <div className="flex flex-wrap items-center gap-3 text-xs">
                            <InlineDateEditor
                              itemTitle={card.titulo}
                              label="Cierre"
                              dateISO={card.fechaCierre}
                              placeholder="+ Cierre"
                              readOnly={!canEditFinances}
                              onSaveDate={(val) =>
                                onQuickUpdateDates(card, { fechaCierre: val })
                              }
                            />
                            <InlineDateEditor
                              itemTitle={card.titulo}
                              label="Vence"
                              dateISO={card.fechaExactaVencimiento}
                              readOnly={!canEditFinances}
                              onSaveDate={(val) =>
                                onQuickUpdateDates(card, {
                                  fechaExactaVencimiento: val,
                                })
                              }
                            />
                          </div>

                          {!cycleCheck.valid && (
                            <p className="rounded-lg border border-[#FDE68A] bg-[#FFFBEB] px-3 py-2 text-xs font-medium text-[#92400E]">
                              {cycleCheck.warning}
                            </p>
                          )}

                          <div className="grid grid-cols-1 gap-3 border-t border-[#ECEAE2] pt-4 text-xs sm:grid-cols-2">
                            <div>
                              <span className="block text-[11px] text-[#686E7D]">
                                Deuda total (capital)
                              </span>
                              <div className="mt-1">
                                <InlineAmountEditor
                                  itemTitle={`deuda total de ${card.titulo}`}
                                  amount={card.saldoCapitalTotal ?? 0}
                                  readOnly={!canEditFinances}
                                  textClassName="text-sm font-bold text-[#111318]"
                                  onSaveAmount={(val) =>
                                    onQuickUpdateCapital(card, val)
                                  }
                                />
                              </div>
                            </div>
                            {monthlyInterestCents > 0 && (
                              <div>
                                <span className="block text-[11px] text-[#686E7D]">
                                  Interés mensual aprox. (TNA {card.tnaEstimada}%)
                                </span>
                                <p className="mt-1 font-mono-tabular text-sm font-bold text-[#B45309]">
                                  ~{MoneyUtils.formatARSCents(monthlyInterestCents)}/mes
                                </p>
                              </div>
                            )}
                          </div>

                          {card.notas && (
                            <p className="text-xs leading-relaxed text-[#525866]">
                              {card.notas}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#ECEAE2] bg-[#FAF9F6] px-6 py-3.5">
                        <div className="flex items-center gap-2">
                          <ReceiptsPillButton
                            item={card}
                            onOpenReceipts={onOpenReceipts}
                          />
                          {canEditFinances && (
                            <button
                              type="button"
                              onClick={() => onEditItem(card)}
                              aria-label={`Editar todo de ${card.titulo}`}
                              className="inline-flex min-h-[34px] items-center gap-1 rounded-lg border border-[#DFDDD4] bg-white px-2.5 py-1 text-xs font-medium text-[#525866] hover:text-[#111318]"
                            >
                              <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                              Editar
                            </button>
                          )}
                        </div>

                        {canEditFinances &&
                          (card.estado === 'PENDIENTE' ? (
                            <button
                              type="button"
                              onClick={() => onMarkPaid(card)}
                              aria-label={`Marcar pagado ${card.titulo}`}
                              className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg bg-[#1D4ED8] px-3.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#1E40AF]"
                            >
                              <Check className="h-3.5 w-3.5" aria-hidden="true" />
                              Marcar Pagado
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => onUndoPaid(card)}
                              aria-label={`Revertir pago ${card.titulo}`}
                              className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-[#DFDDD4] bg-white px-3 py-1.5 text-xs font-medium text-[#111318] hover:bg-[#ECEAE2]"
                            >
                              <Undo2 className="h-3.5 w-3.5" aria-hidden="true" />
                              Volver a Pendiente
                            </button>
                          ))}
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          )}

          {/* Tarjeta Carrefour */}
          {carrefourItems.length > 0 && (
            <section aria-labelledby="carrefour-heading" className="space-y-4">
              <div className="flex items-center gap-3">
                <span className="font-mono-tabular text-[11px] font-bold text-[#1D4ED8]">
                  {rotatingCards.length > 0 ? '02' : '01'}
                </span>
                <h2
                  id="carrefour-heading"
                  className="font-display text-sm font-bold uppercase tracking-[0.1em] text-[#111318] whitespace-nowrap"
                >
                  Tarjeta Carrefour ({carrefourItems.length} cuotas)
                </h2>
                <div className="h-px flex-1 bg-[#D8D6CC]" aria-hidden="true" />
              </div>

              <div className="overflow-hidden rounded-2xl border border-[#DFDDD4] bg-white shadow-[0_2px_10px_rgba(17,19,24,0.04)]">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E7E5DC] bg-[#F7F7F3] px-6 py-4">
                  <div>
                    <h3 className="font-display text-base font-bold text-[#111318]">
                      Resumen Agrupado Carrefour
                    </h3>
                    <p className="text-xs text-[#525866]">
                      Cada cuota dentro del resumen se gestiona y extingue por separado.
                    </p>
                  </div>
                  <span className="font-mono-tabular text-base font-bold text-[#111318]">
                    {MoneyUtils.formatARSCents(carrefourTotalCents)}
                  </span>
                </div>

                <div className="divide-y divide-[#ECEAE2] px-6">
                  {carrefourItems.map((sub) => {
                    const cycleCheck = validateCardCycleDates(
                      sub.fechaCierre,
                      sub.fechaExactaVencimiento
                    );
                    return (
                      <div
                        key={sub.id}
                        className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="min-w-0 space-y-1.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-display text-sm font-bold text-[#111318]">
                              {sub.titulo}
                            </span>
                            {sub.cuotaActual && sub.cuotasTotales && (
                              <span className="font-mono-tabular text-xs font-bold text-[#4338CA]">
                                Cuota {sub.cuotaActual}/{sub.cuotasTotales}
                              </span>
                            )}
                            <span
                              className={`text-xs font-bold ${
                                sub.estado === 'PAGADO'
                                  ? 'text-[#1D4ED8]'
                                  : 'text-[#B45309]'
                              }`}
                            >
                              · {sub.estado}
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 text-xs text-[#525866]">
                            <InlineDateEditor
                              itemTitle={sub.titulo}
                              label="Cierre"
                              dateISO={sub.fechaCierre}
                              placeholder="+ Cierre"
                              readOnly={!canEditFinances}
                              onSaveDate={(val) =>
                                onQuickUpdateDates(sub, { fechaCierre: val })
                              }
                            />
                            <InlineDateEditor
                              itemTitle={sub.titulo}
                              label="Vence"
                              dateISO={sub.fechaExactaVencimiento}
                              readOnly={!canEditFinances}
                              onSaveDate={(val) =>
                                onQuickUpdateDates(sub, {
                                  fechaExactaVencimiento: val,
                                })
                              }
                            />
                          </div>
                          {!cycleCheck.valid && (
                            <p className="text-[11px] font-medium text-[#B45309]">
                              {cycleCheck.warning}
                            </p>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-2 sm:justify-end shrink-0">
                          <InlineAmountEditor
                            itemTitle={sub.titulo}
                            amount={sub.montoPactado}
                            readOnly={!canEditFinances}
                            textClassName="text-sm font-bold text-[#111318]"
                            onSaveAmount={(val) =>
                              onQuickUpdateAmount(sub, val)
                            }
                          />
                          <ReceiptsPillButton
                            item={sub}
                            onOpenReceipts={onOpenReceipts}
                          />
                          {canEditFinances && (
                            <>
                              <button
                                type="button"
                                onClick={() => onEditItem(sub)}
                                aria-label={`Editar todo de ${sub.titulo}`}
                                className="inline-flex min-h-[34px] min-w-[34px] items-center justify-center rounded-lg border border-[#DFDDD4] bg-[#F7F7F3] p-1.5 text-[#525866] hover:text-[#111318]"
                              >
                                <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                              </button>
                              {sub.estado === 'PENDIENTE' ? (
                                <button
                                  type="button"
                                  onClick={() => onMarkPaid(sub)}
                                  aria-label={`Marcar pagado ${sub.titulo}`}
                                  className="inline-flex min-h-[34px] items-center gap-1 rounded-lg bg-[#1D4ED8] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#1E40AF]"
                                >
                                  Marcar Pagado
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => onUndoPaid(sub)}
                                  aria-label={`Revertir pago ${sub.titulo}`}
                                  className="inline-flex min-h-[34px] items-center gap-1 rounded-lg border border-[#DFDDD4] bg-[#F7F7F3] px-2.5 py-1.5 text-xs font-medium text-[#111318]"
                                >
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
            </section>
          )}
        </div>
      )}

      {/* Simulador de Amortización */}
      <section aria-labelledby="simulador-tarjetas-heading" className="space-y-4">
        <div className="flex items-center gap-3">
          <span className="font-mono-tabular text-[11px] font-bold text-[#1D4ED8]">
            {rotatingCards.length > 0 && carrefourItems.length > 0
              ? '03'
              : '02'}
          </span>
          <h2
            id="simulador-tarjetas-heading"
            className="font-display text-sm font-bold uppercase tracking-[0.1em] text-[#111318] whitespace-nowrap"
          >
            Simulador de Amortización
          </h2>
          <div className="h-px flex-1 bg-[#D8D6CC]" aria-hidden="true" />
        </div>

        <div className="overflow-hidden rounded-2xl border border-[#DFDDD4] bg-white shadow-[0_2px_10px_rgba(17,19,24,0.04)]">
          <div className="flex flex-col gap-3 border-b border-[#DCE7FE] bg-[#F4F7FF] px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="flex items-center gap-2 font-display text-base font-bold text-[#111318]">
                <Sparkles className="h-4 w-4 text-[#4338CA]" aria-hidden="true" />
                Impacto de Pagos Extra en Tarjetas Rotativas
              </h3>
              <p className="mt-0.5 text-xs text-[#525866]">
                Simulá cuánto interés mensual ahorrás bajando capital puro sin alterar tus saldos reales ni tocar el mínimo de comida.
              </p>
            </div>

            <div className="flex items-center gap-2 rounded-xl border border-[#BFDBFE] bg-white px-3 py-1.5 text-xs shrink-0">
              <label
                htmlFor="min-food-reserve-input"
                className="text-[#525866] whitespace-nowrap"
              >
                Mínimo comida:
              </label>
              <input
                id="min-food-reserve-input"
                type="number"
                inputMode="numeric"
                step="10000"
                min="0"
                disabled={!canEditFinances}
                value={minFoodReserveARS}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  if (Number.isFinite(val) && val >= 0) {
                    onChangeMinFoodReserveARS(val);
                  }
                }}
                className="w-24 bg-transparent text-right font-mono-tabular font-bold text-[#1D4ED8] focus:outline-none disabled:opacity-70"
              />
            </div>
          </div>

          <div className="space-y-5 p-6">
            <p className="rounded-xl border border-[#ECEAE2] bg-[#FAF9F6] px-4 py-3 text-xs leading-relaxed text-[#525866]">
              {matchResult.simuladorExcedente.recomendacionTexto}
            </p>

            <div className="space-y-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-bold text-[#111318]">
                    Simular inyección de capital / aguinaldo:{' '}
                    <span className="font-mono-tabular text-[#1D4ED8]">
                      {MoneyUtils.formatARS(extraCapitalSimARS)}
                    </span>
                  </p>
                  <p className="text-[11px] text-[#525866]">
                    Deslizá o elegí un monto rápido para comparar el ahorro en Banco Patagonia vs Mutual Patronal.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {[250000, 500000, 750000, 1000000].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setExtraCapitalSimARS(preset)}
                      className={`min-h-[34px] rounded-lg border px-2.5 py-1 font-mono-tabular text-[11px] font-semibold transition-colors ${
                        extraCapitalSimARS === preset
                          ? 'border-[#1D4ED8] bg-[#EFF6FF] text-[#1D4ED8]'
                          : 'border-[#DFDDD4] bg-[#F7F7F3] text-[#525866] hover:text-[#111318]'
                      }`}
                    >
                      +{MoneyUtils.formatCompactCents(preset * 100)}
                    </button>
                  ))}
                </div>
              </div>

              <input
                type="range"
                aria-label="Monto extra a simular en pesos"
                min={0}
                max={1500000}
                step={25000}
                value={extraCapitalSimARS}
                onChange={(e) => setExtraCapitalSimARS(Number(e.target.value))}
                className="w-full cursor-pointer accent-[#1D4ED8]"
              />

              {cardSimulations.length === 0 ? (
                <p className="text-xs text-[#747A88]">
                  Agregá una tarjeta rotativa con saldo capital para simular y aplicar amortizaciones reales.
                </p>
              ) : (
                <div className="grid grid-cols-1 gap-4 pt-2 text-xs sm:grid-cols-2">
                  {cardSimulations.map((sim, idx) => {
                    const isPrimaryStyle = idx % 2 === 0;
                    const canApply =
                      canEditFinances &&
                      extraCapitalSimARS > 0 &&
                      sim.capARS > 0;
                    return (
                      <div
                        key={sim.card.id}
                        className={`flex flex-col justify-between gap-3 rounded-xl border p-4 ${
                          isPrimaryStyle
                            ? 'border-[#DCE7FE] bg-[#F4F7FF]'
                            : 'border-[#E0E7FF] bg-[#F5F3FF]'
                        }`}
                      >
                        <div>
                          <p className="font-bold text-[#111318]">
                            Opción {sim.optionLetter} · Amortizar {sim.card.titulo}
                          </p>
                          <p className="mt-1.5 leading-relaxed text-[#525866]">
                            Baja el capital adeudado de{' '}
                            <span className="font-mono-tabular font-semibold text-[#111318]">
                              {MoneyUtils.formatARS(sim.capARS)}
                            </span>{' '}
                            a{' '}
                            <span className="font-mono-tabular font-bold text-[#111318]">
                              {MoneyUtils.formatARS(sim.newCapARS)}
                            </span>
                            {sim.monthlyIntSavedCents > 0 ? (
                              <>
                                {' '}
                                y ahorrás aprox.{' '}
                                <span
                                  className={`font-mono-tabular font-bold ${
                                    isPrimaryStyle
                                      ? 'text-[#1D4ED8]'
                                      : 'text-[#4338CA]'
                                  }`}
                                >
                                  {MoneyUtils.formatARSCents(
                                    sim.monthlyIntSavedCents
                                  )}
                                  /mes
                                </span>{' '}
                                en intereses (TNA {sim.tna}%).
                              </>
                            ) : (
                              '.'
                            )}
                          </p>
                        </div>

                        {canEditFinances && (
                          <div className="flex items-center justify-between gap-2 border-t border-[#111318]/10 pt-2.5">
                            <span className="text-[11px] text-[#525866]">
                              {sim.capARS <= 0
                                ? 'Capital en $0'
                                : 'Impactar en deuda real:'}
                            </span>
                            <button
                              type="button"
                              disabled={!canApply}
                              onClick={() => {
                                setApplyAmortizationToFuture(hasFuturePeriods);
                                setPendingAmortization({
                                  card: sim.card,
                                  amountARS: extraCapitalSimARS,
                                  previousCapitalARS: sim.capARS,
                                  nextCapitalARS: sim.newCapARS,
                                  monthlySavedCents: sim.monthlyIntSavedCents,
                                });
                              }}
                              className="inline-flex min-h-[32px] items-center gap-1 rounded-lg bg-[#1D4ED8] px-3 py-1 text-[11px] font-semibold text-white transition-colors hover:bg-[#1E40AF] disabled:cursor-not-allowed disabled:opacity-45"
                            >
                              <Check className="h-3 w-3" aria-hidden="true" />
                              Aplicar amortización
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {pendingAmortization && (
        <ConfirmDialog
          title={`¿Amortizar capital de ${pendingAmortization.card.titulo}?`}
          description={`Se descontará ${MoneyUtils.formatARS(
            Math.min(
              pendingAmortization.amountARS,
              pendingAmortization.previousCapitalARS
            )
          )} del saldo adeudado: bajará de ${MoneyUtils.formatARS(
            pendingAmortization.previousCapitalARS
          )} a ${MoneyUtils.formatARS(pendingAmortization.nextCapitalARS)}${
            pendingAmortization.monthlySavedCents > 0
              ? ` (ahorro estimado ~${MoneyUtils.formatARSCents(
                  pendingAmortization.monthlySavedCents
                )}/mes en intereses)`
              : ''
          }.${
            hasFuturePeriods && applyAmortizationToFuture
              ? ' También se reducirá el capital en los meses futuros ya generados.'
              : ''
          }`}
          confirmLabel="Sí, registrar amortización"
          tone="warning"
          onCancel={() => setPendingAmortization(null)}
          onConfirm={() => {
            onAmortizeCard(
              pendingAmortization.card,
              pendingAmortization.amountARS,
              hasFuturePeriods && applyAmortizationToFuture
            );
            setPendingAmortization(null);
          }}
        />
      )}
    </div>
  );
};
