import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  AlertTriangle,
  ArrowUpRight,
  Calendar,
  CheckCircle2,
  ChevronDown,
  Clock,
  CreditCard,
  Layers,
  Paperclip,
  Pencil,
  Plus,
  Receipt,
  ShieldCheck,
  ShoppingBasket,
  TrendingDown,
  Wallet,
} from 'lucide-react';
import {
  AppTab,
  BankingPaymentStatus,
  CashFlowMatchResult,
  FoodBudgetStatus,
  ItemFinanciero,
  PrioridadPago,
} from '../types/finance';
import {
  addMonthsToPeriodo,
  formatPeriodoLabel,
  formatShortDateAR,
} from '../utils/dateUtils';
import { NextMonthProjection } from '../utils/monthTransition';
import { MoneyUtils } from '../utils/moneyUtils';
import {
  computeCashflowWaterfall,
  isIncomeCategory,
} from '../utils/cashFlowMatcher';
import { InlineAmountEditor } from './InlineAmountEditor';
import { InlineDateEditor } from './InlineDateEditor';

interface DashboardBentoProps {
  matchResult: CashFlowMatchResult;
  periodItems: ItemFinanciero[];
  foodBudgetStatus: FoodBudgetStatus;
  nextMonthProjection: NextMonthProjection;
  canEditFinances: boolean;
  minFoodReserveARS?: number;
  onMarkPaid: (item: ItemFinanciero) => void;
  onEditItem: (item: ItemFinanciero) => void;
  onQuickUpdateAmount: (item: ItemFinanciero, newAmount: number) => void;
  onQuickUpdateDates: (
    item: ItemFinanciero,
    updates: { fechaExactaVencimiento?: string; fechaCierre?: string }
  ) => void;
  onOpenReceipts: (item: ItemFinanciero) => void;
  onAddFoodExpense: (input: {
    concepto: string;
    comercio?: string;
    monto: number;
    fechaISO: string;
  }) => Promise<void> | void;
  onNavigateTab: (tab: AppTab) => void;
}

function getPriorityText(p: PrioridadPago): {
  text: string;
  className: string;
} {
  if (p === 'CRITICA') {
    return { text: 'Urgente', className: 'text-[#DC2626]' };
  }
  if (p === 'ALTA') {
    return { text: 'Pronto', className: 'text-[#B45309]' };
  }
  return { text: 'Programado', className: 'text-[#747A88]' };
}

function getBankingIndicator(status: BankingPaymentStatus): {
  text: string;
  dotClass: string;
  textClass: string;
} {
  if (status === 'PAGAR_AHORA') {
    return {
      text: 'Pagar ahora',
      dotClass: 'bg-[#1D4ED8]',
      textClass: 'text-[#1D4ED8]',
    };
  }
  if (status === 'ESPERAR_CIERRE') {
    return {
      text: 'Esperar cierre',
      dotClass: 'bg-[#D97706]',
      textClass: 'text-[#B45309]',
    };
  }
  if (status === 'EXCEDE_TOPE_COMIDA') {
    return {
      text: 'Excede tope comida',
      dotClass: 'bg-[#DC2626]',
      textClass: 'text-[#B91C1C]',
    };
  }
  return {
    text: 'Pagado',
    dotClass: 'bg-[#9CA3AF]',
    textClass: 'text-[#525866]',
  };
}

const ChapterDivider: React.FC<{
  index: string;
  title: string;
  subtitle?: string;
}> = ({ index, title, subtitle }) => (
  <div className="flex items-center gap-3 pt-1">
    <span className="font-mono-tabular text-[11px] font-bold tracking-wider text-[#1D4ED8]">
      {index}
    </span>
    <h2 className="font-display text-sm font-bold uppercase tracking-[0.1em] text-[#111318] whitespace-nowrap">
      {title}
    </h2>
    <div className="h-px flex-1 bg-[#D8D6CC]" aria-hidden="true" />
    {subtitle && (
      <span className="hidden sm:inline text-xs text-[#686E7D] whitespace-nowrap">
        {subtitle}
      </span>
    )}
  </div>
);

export const DashboardBento: React.FC<DashboardBentoProps> = ({
  matchResult,
  periodItems,
  foodBudgetStatus,
  nextMonthProjection,
  canEditFinances,
  minFoodReserveARS = 900000,
  onMarkPaid,
  onEditItem,
  onQuickUpdateAmount,
  onQuickUpdateDates,
  onOpenReceipts,
  onAddFoodExpense,
  onNavigateTab,
}) => {
  const [showAllQueue, setShowAllQueue] = useState(false);
  const [quickFoodOpen, setQuickFoodOpen] = useState(false);
  const [quickConcepto, setQuickConcepto] = useState('');
  const [quickMontoStr, setQuickMontoStr] = useState('');
  const [quickComercio, setQuickComercio] = useState('');
  const [quickFoodError, setQuickFoodError] = useState<string | null>(null);
  const [savingQuickFood, setSavingQuickFood] = useState(false);

  const {
    referenceDateISO,
    summary,
    q1,
    q2,
    alertaDescalce,
    tarjetasBloqueadasPorCierre,
    pagosPostergadosPorComida,
    colaPrioridad,
  } = matchResult;

  const waterfall = computeCashflowWaterfall(
    matchResult,
    Math.round(minFoodReserveARS * 100)
  );
  const totalIngresos = Math.max(1, waterfall.ingresosTotalesCents);
  const pctPagado = (waterfall.pagadoCents / totalIngresos) * 100;
  const pctPendienteVentana =
    (waterfall.pendienteEnVentanaCents / totalIngresos) * 100;
  const pctEsperandoCierre =
    (waterfall.esperandoCierreCents / totalIngresos) * 100;
  const pctComidaProt =
    (waterfall.reservaComidaProtegidaCents / totalIngresos) * 100;
  const pctExcedente = (waterfall.excedenteRealCents / totalIngresos) * 100;

  const extinguishedItems = periodItems.filter(
    (i) => i.estado === 'EXTINGUIDO'
  );
  const incomesCount = periodItems.filter(
    (i) => isIncomeCategory(i.categoria) && i.estado !== 'EXTINGUIDO'
  ).length;
  const servicesList = periodItems.filter(
    (i) => i.categoria === 'SERVICIO_HOGAR' && i.estado !== 'EXTINGUIDO'
  );
  const pendingServicesCount = servicesList.filter(
    (i) => i.estado === 'PENDIENTE'
  ).length;

  const cardItemsCount = periodItems.filter(
    (i) =>
      (i.categoria === 'TARJETA_ROTATIVA' ||
        i.subgrupo?.toLowerCase().includes('carrefour')) &&
      i.estado !== 'EXTINGUIDO'
  ).length;

  const fixedQuotasList = periodItems.filter(
    (i) => i.esCuotaFija && i.estado !== 'EXTINGUIDO'
  );

  // Próximo hito de extinción para mostrar en la tarjeta resumen de Cuotas
  let nextPayoffLabel = 'Sin cuotas activas';
  if (fixedQuotasList.length > 0) {
    const minRemaining = Math.min(
      ...fixedQuotasList.map((i) =>
        Math.max(0, (i.cuotasTotales ?? 1) - (i.cuotaActual ?? 1))
      )
    );
    const nextPeriodo = addMonthsToPeriodo(summary.periodo, minRemaining);
    nextPayoffLabel =
      minRemaining === 0
        ? `Cierra este mes (${formatPeriodoLabel(nextPeriodo)})`
        : `Próx. liberación: ${formatPeriodoLabel(nextPeriodo)}`;
  }

  const visibleQueue = showAllQueue
    ? colaPrioridad
    : colaPrioridad.slice(0, 5);

  return (
    <div className="space-y-8">
      {/* Encabezado editorial del período */}
      <div className="flex flex-col gap-3 border-b border-[#D8D6CC] pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#1D4ED8]">
            Tablero Ejecutivo
          </p>
          <h1 className="mt-0.5 font-display text-2xl font-bold tracking-tight text-[#111318] sm:text-3xl">
            {formatPeriodoLabel(summary.periodo)}
          </h1>
          <p className="mt-1 text-xs text-[#525866] sm:text-sm">
            {canEditFinances
              ? 'Vista ejecutiva sin datos repetidos: pagá lo urgente aquí o entrá directo a cada área.'
              : 'Vista de consulta: verificá saldos, vencimientos urgentes y subí comprobantes en cada sección.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="rounded-xl border border-[#DFDDD4] bg-white px-3.5 py-2 font-mono-tabular text-xs text-[#525866] shadow-[0_1px_2px_rgba(17,19,24,0.03)]">
            {colaPrioridad.length} pendiente{colaPrioridad.length === 1 ? '' : 's'} ·{' '}
            <span className="font-bold text-[#111318]">
              {MoneyUtils.formatARSCents(summary.totalPendienteCents)}
            </span>{' '}
            por abonar
          </div>
          <button
            type="button"
            onClick={() => onNavigateTab('calendario')}
            className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl border border-[#BFDBFE] bg-white px-3.5 py-2 text-xs font-semibold text-[#1D4ED8] shadow-[0_1px_2px_rgba(17,19,24,0.03)] transition-colors hover:bg-[#EFF6FF]"
          >
            <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
            Abrir Calendario
          </button>
        </div>
      </div>

      {/* Alerta temprana de faltante quincenal */}
      {alertaDescalce.hayDescalce && (
        <div
          role="alert"
          className="flex flex-col gap-3 rounded-2xl border border-[#F59E0B]/40 bg-[#FFFBEB] p-4 shadow-[0_2px_8px_rgba(217,119,6,0.06)] sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle
              className="mt-0.5 h-5 w-5 shrink-0 text-[#D97706]"
              aria-hidden="true"
            />
            <div className="space-y-1">
              <p className="text-sm font-bold text-[#92400E]">
                Faltante en la 1° Quincena (Días 01 al 14)
              </p>
              <p className="text-xs leading-relaxed text-[#78350F]">
                {alertaDescalce.mensaje}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onNavigateTab('quincenas')}
            className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border border-[#F59E0B]/45 bg-white px-3.5 py-2 text-xs font-semibold text-[#92400E] transition-colors hover:bg-[#FEF3C7] whitespace-nowrap shrink-0"
          >
            <span>Ajustar en Ingresos</span>
            <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      )}

      {/* CAPÍTULO 01: PANORAMA DEL MES */}
      <div className="space-y-4">
        <ChapterDivider
          index="01"
          title="Panorama del Mes"
          subtitle="Saldo protegido, compromisos totales y cascada de caja"
        />

        <section
          aria-label="Resumen financiero principal"
          className="overflow-hidden rounded-2xl border border-[#DFDDD4] bg-white shadow-[0_2px_10px_rgba(17,19,24,0.04)]"
        >
          <div
            data-testid="kpi-grid"
            className="grid grid-cols-1 lg:grid-cols-12"
          >
            {/* Foco Principal (5 cols) */}
            <div className="relative flex flex-col justify-between overflow-hidden border-b border-[#E7E5DC] bg-[#F5F8FF] p-6 lg:col-span-5 lg:border-b-0 lg:border-r">
              <svg
                aria-hidden="true"
                className="pointer-events-none absolute -right-4 -bottom-4 h-28 w-40 text-[#1D4ED8]/[0.07]"
                viewBox="0 0 160 112"
                fill="none"
              >
                <circle cx="118" cy="72" r="44" stroke="currentColor" strokeWidth="1.5" />
                <circle cx="80" cy="88" r="28" stroke="currentColor" strokeOpacity="0.65" strokeWidth="1.5" />
              </svg>

              <div className="relative">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.1em] text-[#1D4ED8]">
                    <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
                    Plata Libre para Comida
                  </span>
                  <span className="rounded-md border border-[#BFDBFE] bg-white px-2 py-0.5 font-mono-tabular text-[11px] font-semibold text-[#1D4ED8]">
                    Mín. {MoneyUtils.formatARS(minFoodReserveARS)}
                  </span>
                </div>

                <p
                  data-testid="kpi-colchon-comida"
                  style={{ fontSize: 'clamp(1.95rem, 3vw, 2.65rem)' }}
                  className={`mt-4 font-display font-bold leading-none tracking-tight font-mono-tabular ${
                    summary.colchonComidaCents >= 0
                      ? 'text-[#111318]'
                      : 'text-[#DC2626]'
                  }`}
                >
                  {MoneyUtils.formatARSCents(summary.colchonComidaCents)}
                </p>

                <p className="mt-3 text-xs leading-relaxed text-[#525866]">
                  Disponible neto del mes tras cubrir todas las obligaciones fijas.
                  {waterfall.excedenteRealCents > 0 && (
                    <>
                      {' '}
                      Tenés{' '}
                      <span className="font-mono-tabular font-bold text-[#1D4ED8]">
                        +{MoneyUtils.formatARSCents(waterfall.excedenteRealCents)}
                      </span>{' '}
                      por encima del mínimo protegido.
                    </>
                  )}
                </p>

                {(summary.desvioObligacionesCents !== 0 ||
                  summary.desvioIngresosCents !== 0) && (
                  <p className="mt-2 rounded-lg border border-[#DCE7FE] bg-white/80 px-2.5 py-1.5 font-mono-tabular text-[11px] text-[#4338CA]">
                    Desvío real vs pactado:{' '}
                    {summary.desvioObligacionesCents !== 0 &&
                      `Gastos ${summary.desvioObligacionesCents > 0 ? '+' : ''}${MoneyUtils.formatCompactCents(summary.desvioObligacionesCents)}`}
                    {summary.desvioObligacionesCents !== 0 &&
                      summary.desvioIngresosCents !== 0 &&
                      ' · '}
                    {summary.desvioIngresosCents !== 0 &&
                      `Ingresos ${summary.desvioIngresosCents > 0 ? '+' : ''}${MoneyUtils.formatCompactCents(summary.desvioIngresosCents)}`}
                  </p>
                )}

                {/* Seguimiento real de compras de comida del mes */}
                <div className="mt-4 rounded-xl border border-[#DCE7FE] bg-white/90 p-3 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 font-semibold text-[#111318]">
                      <ShoppingBasket className="h-3.5 w-3.5 text-[#1D4ED8]" aria-hidden="true" />
                      Súper y comida real
                    </span>
                    <span
                      className={`font-mono-tabular text-[11px] font-bold ${
                        foodBudgetStatus.excedeMinimo ? 'text-[#DC2626]' : 'text-[#1D4ED8]'
                      }`}
                    >
                      Gastado {MoneyUtils.formatCompactCents(foodBudgetStatus.gastadoMesCents)} ·{' '}
                      {foodBudgetStatus.porcentajeConsumidoMinimo.toFixed(0)}%
                    </span>
                  </div>

                  <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-[#ECEAE2]">
                    <div
                      style={{
                        width: `${Math.min(100, Math.round(foodBudgetStatus.porcentajeConsumidoMinimo))}%`,
                      }}
                      className={`h-full ${
                        foodBudgetStatus.excedeMinimo
                          ? 'bg-[#DC2626]'
                          : foodBudgetStatus.porcentajeConsumidoMinimo >= 85
                            ? 'bg-[#D97706]'
                            : 'bg-[#1D4ED8]'
                      }`}
                    />
                  </div>

                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#525866]">
                    <span className="font-mono-tabular">
                      Quedan{' '}
                      <strong className="text-[#111318]">
                        {MoneyUtils.formatCompactCents(
                          foodBudgetStatus.restanteSobreMinimoCents
                        )}
                      </strong>{' '}
                      ({MoneyUtils.formatCompactCents(foodBudgetStatus.presupuestoDiarioSugeridoCents)}/día)
                    </span>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setQuickFoodOpen((v) => !v);
                          setQuickFoodError(null);
                        }}
                        className="inline-flex min-h-[28px] items-center gap-1 rounded-lg bg-[#1D4ED8] px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-[#1E40AF]"
                      >
                        <Plus className="h-3 w-3" aria-hidden="true" />
                        <span>{quickFoodOpen ? 'Cerrar' : 'Anotar compra'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onNavigateTab('quincenas')}
                        className="font-semibold text-[#1D4ED8] hover:underline"
                      >
                        Ver detalle
                      </button>
                    </div>
                  </div>

                  {quickFoodOpen && (
                    <form
                      onSubmit={async (e) => {
                        e.preventDefault();
                        setQuickFoodError(null);
                        const parsed = MoneyUtils.parseARSInput(quickMontoStr);
                        if (!quickConcepto.trim()) {
                          setQuickFoodError('Ingresá qué compraste.');
                          return;
                        }
                        if (!Number.isFinite(parsed) || parsed <= 0) {
                          setQuickFoodError('Ingresá un monto mayor a $0.');
                          return;
                        }
                        setSavingQuickFood(true);
                        try {
                          await onAddFoodExpense({
                            concepto: quickConcepto.trim(),
                            comercio: quickComercio.trim() || undefined,
                            monto: parsed,
                            fechaISO: referenceDateISO,
                          });
                          setQuickConcepto('');
                          setQuickMontoStr('');
                          setQuickComercio('');
                          setQuickFoodOpen(false);
                        } catch (err) {
                          setQuickFoodError(
                            err instanceof Error
                              ? err.message
                              : 'No se pudo guardar.'
                          );
                        } finally {
                          setSavingQuickFood(false);
                        }
                      }}
                      className="mt-2.5 space-y-2 border-t border-[#ECEAE2] pt-2.5"
                    >
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                        <input
                          type="text"
                          value={quickConcepto}
                          onChange={(e) => setQuickConcepto(e.target.value)}
                          placeholder="Ej: Súper semanal"
                          aria-label="Concepto de compra de comida"
                          className="rounded-lg border border-[#D8D6CC] bg-white px-2.5 py-1.5 text-xs text-[#111318] focus:border-[#1D4ED8] focus:outline-none sm:col-span-2"
                        />
                        <input
                          type="text"
                          inputMode="decimal"
                          value={quickMontoStr}
                          onChange={(e) => setQuickMontoStr(e.target.value)}
                          placeholder="Monto $"
                          aria-label="Monto de compra de comida"
                          className="rounded-lg border border-[#D8D6CC] bg-white px-2.5 py-1.5 font-mono-tabular text-xs font-semibold text-[#111318] focus:border-[#1D4ED8] focus:outline-none"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={quickComercio}
                          onChange={(e) => setQuickComercio(e.target.value)}
                          placeholder="Comercio (opcional)"
                          aria-label="Comercio de compra de comida"
                          className="min-w-0 flex-1 rounded-lg border border-[#D8D6CC] bg-white px-2.5 py-1.5 text-xs text-[#111318] focus:border-[#1D4ED8] focus:outline-none"
                        />
                        <button
                          type="submit"
                          disabled={savingQuickFood}
                          className="inline-flex min-h-[30px] items-center rounded-lg bg-[#111318] px-3 py-1 text-xs font-semibold text-white hover:bg-[#1D4ED8] disabled:opacity-60"
                        >
                          {savingQuickFood ? 'Guardando...' : 'Guardar'}
                        </button>
                      </div>
                      {quickFoodError && (
                        <p className="text-[11px] font-semibold text-[#DC2626]">
                          {quickFoodError}
                        </p>
                      )}
                    </form>
                  )}
                </div>
              </div>
            </div>

            {/* 3 KPIs (7 cols) */}
            <div className="grid grid-cols-1 divide-y divide-[#E7E5DC] sm:grid-cols-3 sm:divide-y-0 sm:divide-x lg:col-span-7">
              <div className="flex flex-col justify-between p-6">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-[#686E7D]">
                    Ingresos del Mes
                  </p>
                  <p
                    data-testid="kpi-ingresos"
                    className="mt-2.5 font-mono-tabular text-xl font-bold tracking-tight text-[#1D4ED8]"
                  >
                    {MoneyUtils.formatARSCents(summary.ingresosTotalesCents)}
                  </p>
                </div>
                <p className="mt-4 font-mono-tabular text-[11px] text-[#686E7D]">
                  Base {MoneyUtils.formatCompactCents(summary.ingresosHabitualesCents)}
                  {summary.ingresosSacCents > 0
                    ? ` · SAC +${MoneyUtils.formatCompactCents(summary.ingresosSacCents)}`
                    : ''}
                </p>
              </div>

              <div className="flex flex-col justify-between p-6">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-[#686E7D]">
                    Gastos y Deudas
                  </p>
                  <p
                    data-testid="kpi-obligaciones"
                    className="mt-2.5 font-mono-tabular text-xl font-bold tracking-tight text-[#111318]"
                  >
                    {MoneyUtils.formatARSCents(
                      summary.obligacionesFijasTotalesCents
                    )}
                  </p>
                </div>
                <div
                  data-testid="kpi-obligaciones-desglose"
                  className="mt-4 grid grid-cols-3 gap-2 font-mono-tabular text-[11px]"
                >
                  <div>
                    <span className="block font-sans text-[10px] text-[#747A88]">
                      Serv.
                    </span>
                    <span className="font-semibold text-[#111318]">
                      {MoneyUtils.formatCompactCents(summary.serviciosHogarCents)}
                    </span>
                  </div>
                  <div>
                    <span className="block font-sans text-[10px] text-[#747A88]">
                      Cuotas
                    </span>
                    <span className="font-semibold text-[#111318]">
                      {MoneyUtils.formatCompactCents(summary.cuotasFijasCents)}
                    </span>
                  </div>
                  <div>
                    <span className="block font-sans text-[10px] text-[#747A88]">
                      Tarj.
                    </span>
                    <span className="font-semibold text-[#DC2626]">
                      {MoneyUtils.formatCompactCents(summary.tarjetasTotalesCents)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col justify-between p-6">
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold uppercase tracking-wider text-[#686E7D]">
                      Ya Pagado
                    </p>
                    <span
                      data-testid="kpi-avance-pct"
                      className="font-mono-tabular text-xs font-bold text-[#1D4ED8]"
                    >
                      {summary.porcentajeAvance.toFixed(1)}%
                    </span>
                  </div>
                  <p
                    data-testid="kpi-pagado"
                    className="mt-2.5 font-mono-tabular text-xl font-bold tracking-tight text-[#111318]"
                  >
                    {MoneyUtils.formatARSCents(summary.totalPagadoCents)}
                  </p>
                  <div
                    className="mt-3 h-2 w-full overflow-hidden rounded-full bg-[#ECEAE2]"
                    role="progressbar"
                    aria-valuenow={summary.porcentajeAvance}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label="Porcentaje de obligaciones pagadas"
                  >
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${summary.porcentajeAvance}%` }}
                      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                      className="h-full bg-[#1D4ED8]"
                    />
                  </div>
                </div>
                <p className="mt-4 font-mono-tabular text-[11px] text-[#686E7D]">
                  Falta pagar {MoneyUtils.formatCompactCents(summary.totalPendienteCents)}
                </p>
              </div>
            </div>
          </div>

          {/* Cascada de caja */}
          {waterfall.ingresosTotalesCents > 0 && (
            <div className="border-t border-[#E7E5DC] bg-[#FAF9F6] px-6 py-4">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="font-semibold text-[#111318]">
                  Distribución real de tus ingresos del mes
                </span>
                <span className="font-mono-tabular text-[11px] text-[#686E7D]">
                  100% = {MoneyUtils.formatARSCents(waterfall.ingresosTotalesCents)}
                </span>
              </div>

              <div className="mt-2.5 flex h-2.5 w-full overflow-hidden rounded-full bg-[#E6E4DC]">
                {pctPagado > 0 && (
                  <div
                    style={{ width: `${pctPagado}%` }}
                    title={`Pagado: ${MoneyUtils.formatARSCents(waterfall.pagadoCents)}`}
                    className="h-full bg-[#1D4ED8]"
                  />
                )}
                {pctPendienteVentana > 0 && (
                  <div
                    style={{ width: `${pctPendienteVentana}%` }}
                    title={`Pendiente en ventana: ${MoneyUtils.formatARSCents(waterfall.pendienteEnVentanaCents)}`}
                    className="h-full bg-[#4B5563]"
                  />
                )}
                {pctEsperandoCierre > 0 && (
                  <div
                    style={{ width: `${pctEsperandoCierre}%` }}
                    title={`Esperando cierre: ${MoneyUtils.formatARSCents(waterfall.esperandoCierreCents)}`}
                    className="h-full bg-[#D97706]"
                  />
                )}
                {pctComidaProt > 0 && (
                  <div
                    style={{ width: `${pctComidaProt}%` }}
                    title={`Reserva comida protegida: ${MoneyUtils.formatARSCents(waterfall.reservaComidaProtegidaCents)}`}
                    className="h-full bg-[#93C5FD]"
                  />
                )}
                {pctExcedente > 0 && (
                  <div
                    style={{ width: `${pctExcedente}%` }}
                    title={`Excedente libre: ${MoneyUtils.formatARSCents(waterfall.excedenteRealCents)}`}
                    className="h-full bg-[#4338CA]"
                  />
                )}
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 font-mono-tabular text-[11px] text-[#525866]">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-[#1D4ED8]" />
                  Pagado {MoneyUtils.formatCompactCents(waterfall.pagadoCents)}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-[#4B5563]" />
                  Pendiente{' '}
                  {MoneyUtils.formatCompactCents(waterfall.pendienteEnVentanaCents)}
                </span>
                {waterfall.esperandoCierreCents > 0 && (
                  <span className="inline-flex items-center gap-1.5 text-[#B45309]">
                    <span className="h-2 w-2 rounded-full bg-[#D97706]" />
                    Espera cierre{' '}
                    {MoneyUtils.formatCompactCents(waterfall.esperandoCierreCents)}
                  </span>
                )}
                <span className="inline-flex items-center gap-1.5 text-[#1D4ED8]">
                  <span className="h-2 w-2 rounded-full bg-[#93C5FD]" />
                  Comida mín.{' '}
                  {MoneyUtils.formatCompactCents(
                    waterfall.reservaComidaProtegidaCents
                  )}
                </span>
                {waterfall.excedenteRealCents > 0 && (
                  <span className="inline-flex items-center gap-1.5 text-[#4338CA]">
                    <span className="h-2 w-2 rounded-full bg-[#4338CA]" />
                    Margen extra{' '}
                    {MoneyUtils.formatCompactCents(waterfall.excedenteRealCents)}
                  </span>
                )}
              </div>
            </div>
          )}
        </section>

        {/* Trayectoria al mes siguiente (proyección no destructiva) */}
        <div className="flex flex-col gap-2 rounded-2xl border border-[#DFDDD4] bg-white px-5 py-3.5 text-xs shadow-[0_1px_4px_rgba(17,19,24,0.03)] sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="font-mono-tabular text-[11px] font-bold uppercase tracking-wider text-[#4338CA]">
              Trayectoria {formatPeriodoLabel(nextMonthProjection.nextPeriodo)}
            </span>
            <span className="text-[#525866]">
              Obligaciones estimadas:{' '}
              <strong className="font-mono-tabular text-[#111318]">
                {MoneyUtils.formatARSCents(
                  nextMonthProjection.nextSummary.obligacionesFijasTotalesCents
                )}
              </strong>
              {nextMonthProjection.deltaObligacionesCents < 0 && (
                <span className="ml-1.5 font-mono-tabular font-bold text-[#1D4ED8]">
                  (-{MoneyUtils.formatCompactCents(-nextMonthProjection.deltaObligacionesCents)} menos que este mes)
                </span>
              )}
              {nextMonthProjection.extinguishingItems.length > 0 && (
                <span className="ml-1.5 text-[#4338CA]">
                  · Terminan:{' '}
                  {nextMonthProjection.extinguishingItems.map((c) => c.titulo).join(', ')}
                </span>
              )}
            </span>
          </div>
          <button
            type="button"
            onClick={() => onNavigateTab('extincion')}
            className="inline-flex items-center gap-1 self-start font-semibold text-[#4338CA] hover:underline sm:self-auto whitespace-nowrap"
          >
            <span>Ver trayectoria</span>
            <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>

        {/* Resumen compacto de Alivio Ganado cuando existen cuotas extinguidas */}
        {extinguishedItems.length > 0 && (
          <section
            aria-labelledby="alivio-ganado-heading"
            data-testid="alivio-ganado-section"
            className="flex flex-col gap-3 rounded-2xl border border-[#C7D2FE] bg-[#EEF2FF]/75 px-6 py-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <h3
                id="alivio-ganado-heading"
                className="flex items-center gap-2 font-display text-sm font-bold text-[#4338CA]"
              >
                <TrendingDown className="h-4 w-4" aria-hidden="true" />
                Alivio Ganado · {extinguishedItems.length} cuota
                {extinguishedItems.length === 1 ? '' : 's'} finalizada
                {extinguishedItems.length === 1 ? '' : 's'}
              </h3>
              <p className="mt-0.5 text-xs text-[#525866]">
                {extinguishedItems.map((e) => e.titulo).join(' · ')}
              </p>
            </div>
            <div className="flex items-center gap-4 shrink-0">
              <span className="font-mono-tabular text-base font-bold text-[#4338CA]">
                +{MoneyUtils.formatARSCents(summary.alivioMensualGanadoCents)}/mes
              </span>
              <button
                type="button"
                onClick={() => onNavigateTab('extincion')}
                className="inline-flex min-h-[34px] items-center gap-1 rounded-lg border border-[#C7D2FE] bg-white px-3 py-1.5 text-xs font-semibold text-[#4338CA] hover:bg-[#F5F3FF] whitespace-nowrap"
              >
                <span>Ver Cuotas</span>
                <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>
          </section>
        )}
      </div>

      {/* CAPÍTULO 02: QUÉ PAGAR PRIMERO + ALERTAS OPERATIVAS */}
      <div className="space-y-4">
        <ChapterDivider
          index="02"
          title="Qué Pagar Primero"
          subtitle="Cola priorizada de vencimientos y alertas de calendario"
        />

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Cola de Prioridad (8 cols) */}
          <section
            aria-labelledby="priority-queue-heading"
            className="overflow-hidden rounded-2xl border border-[#DFDDD4] bg-white shadow-[0_2px_10px_rgba(17,19,24,0.04)] lg:col-span-8"
          >
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#E7E5DC] bg-[#F7F7F3] px-6 py-4">
              <div>
                <h3
                  id="priority-queue-heading"
                  className="font-display text-base font-bold tracking-tight text-[#111318]"
                >
                  Próximos Pagos Sugeridos
                </h3>
                <p className="mt-0.5 text-xs text-[#525866]">
                  Al {formatShortDateAR(referenceDateISO)} · prioriza vencimientos sin tocar la reserva de comida.
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigateTab('checklist')}
                className="inline-flex min-h-[34px] items-center gap-1 rounded-lg border border-[#DFDDD4] bg-white px-3 py-1.5 text-xs font-semibold text-[#1D4ED8] transition-colors hover:bg-[#EFF6FF] whitespace-nowrap shrink-0"
              >
                <span>Todos los movimientos</span>
                <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>

            {colaPrioridad.length === 0 ? (
              <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
                <CheckCircle2
                  className="h-9 w-9 text-[#1D4ED8]"
                  aria-hidden="true"
                />
                <p className="mt-3 font-display text-base font-bold text-[#111318]">
                  Todas las cuentas de este mes están pagadas
                </p>
                <p className="mt-1 text-xs text-[#525866]">
                  Podés avanzar al mes siguiente desde la barra de período.
                </p>
              </div>
            ) : (
              <>
                <div className="divide-y divide-[#ECEAE2]">
                  {visibleQueue.map((alloc) => {
                    const priorityMeta = getPriorityText(alloc.prioridad);
                    const bankMeta = getBankingIndicator(alloc.bankingStatus);
                    const ob = alloc.obligacion;
                    const attachCount = ob.adjuntos?.length ?? 0;

                    return (
                      <div
                        key={ob.id}
                        className="flex flex-col gap-3 px-6 py-4 transition-colors hover:bg-[#FAF9F6] sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="min-w-0 space-y-1">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                            <span
                              className={`inline-flex items-center gap-1.5 font-semibold ${bankMeta.textClass}`}
                            >
                              <span
                                className={`h-1.5 w-1.5 rounded-full ${bankMeta.dotClass}`}
                                aria-hidden="true"
                              />
                              {bankMeta.text}
                            </span>
                            <span aria-hidden="true" className="text-[#D4D2CA]">
                              ·
                            </span>
                            <span className={`font-semibold ${priorityMeta.className}`}>
                              {priorityMeta.text}
                            </span>
                            <span aria-hidden="true" className="text-[#D4D2CA]">
                              ·
                            </span>
                            <InlineDateEditor
                              itemTitle={ob.titulo}
                              label="Vence"
                              dateISO={ob.fechaExactaVencimiento}
                              readOnly={!canEditFinances}
                              onSaveDate={(val) =>
                                onQuickUpdateDates(ob, {
                                  fechaExactaVencimiento: val,
                                })
                              }
                            />
                            <span aria-hidden="true" className="text-[#D4D2CA]">
                              ·
                            </span>
                            <span className="text-[#525866]">
                              {ob.bolsilloResponsable}
                            </span>
                          </div>

                          <p className="truncate font-display text-[15px] font-bold text-[#111318]">
                            {ob.titulo}
                            {ob.esCuotaFija &&
                            ob.cuotaActual &&
                            ob.cuotasTotales
                              ? ` (${ob.cuotaActual}/${ob.cuotasTotales})`
                              : ''}
                          </p>
                          <p className="text-xs text-[#525866]">
                            {alloc.razonPrioridad}
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-2 sm:justify-end shrink-0">
                          <InlineAmountEditor
                            itemTitle={ob.titulo}
                            amount={ob.montoPactado}
                            readOnly={!canEditFinances}
                            textClassName="text-sm font-bold text-[#111318]"
                            onSaveAmount={(val) => onQuickUpdateAmount(ob, val)}
                          />
                          <button
                            type="button"
                            onClick={() => onOpenReceipts(ob)}
                            aria-label={`Comprobantes de ${ob.titulo}`}
                            title="Resúmenes y comprobantes en Google Drive"
                            className={`inline-flex min-h-[34px] items-center gap-1 rounded-lg border px-2 py-1 text-[11px] transition-colors shrink-0 ${
                              attachCount > 0
                                ? 'border-[#BFDBFE] bg-[#EFF6FF] text-[#1D4ED8] hover:bg-[#DBEAFE]'
                                : 'border-[#DFDDD4] bg-[#F7F7F3] text-[#525866] hover:text-[#111318]'
                            }`}
                          >
                            <Paperclip className="h-3.5 w-3.5" aria-hidden="true" />
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
                                onClick={() => onEditItem(ob)}
                                aria-label={`Editar todo de ${ob.titulo}`}
                                title="Editar detalle completo"
                                className="inline-flex min-h-[34px] min-w-[34px] items-center justify-center rounded-lg border border-[#DFDDD4] bg-[#F7F7F3] p-1.5 text-[#525866] hover:text-[#111318]"
                              >
                                <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                              </button>
                              <button
                                type="button"
                                onClick={() => onMarkPaid(ob)}
                                aria-label={`Marcar pagado ${ob.titulo}`}
                                className="inline-flex min-h-[36px] items-center rounded-lg bg-[#1D4ED8] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#1E40AF] whitespace-nowrap"
                              >
                                Marcar Pagado
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {colaPrioridad.length > 5 && (
                  <div className="border-t border-[#ECEAE2] bg-[#FAF9F6] px-6 py-3 text-center">
                    <button
                      type="button"
                      onClick={() => setShowAllQueue((v) => !v)}
                      className="inline-flex min-h-[32px] items-center gap-1.5 text-xs font-semibold text-[#1D4ED8] hover:underline"
                    >
                      <ChevronDown
                        className={`h-3.5 w-3.5 transition-transform ${
                          showAllQueue ? 'rotate-180' : ''
                        }`}
                        aria-hidden="true"
                      />
                      {showAllQueue
                        ? 'Mostrar solo los primeros 5'
                        : `Ver los ${colaPrioridad.length - 5} restantes`}
                    </button>
                  </div>
                )}
              </>
            )}
          </section>

          {/* Columna Derecha (4 cols): Radar Operativo sin duplicar listas */}
          <aside className="space-y-4 lg:col-span-4">
            {/* Topes quincenales */}
            <section
              aria-label="Capacidad quincenal segura"
              className="overflow-hidden rounded-2xl border border-[#DFDDD4] bg-white shadow-[0_2px_10px_rgba(17,19,24,0.04)]"
            >
              <div className="border-b border-[#E7E5DC] bg-[#F7F7F3] px-5 py-3.5">
                <h3 className="font-display text-sm font-bold text-[#111318]">
                  Pulso de Quincenas
                </h3>
                <p className="text-xs text-[#525866]">
                  Tope pagable sin tocar tu mínimo de comida
                </p>
              </div>
              <div className="divide-y divide-[#ECEAE2] px-5 text-xs">
                <div className="flex items-center justify-between py-3.5">
                  <div>
                    <p className="font-bold text-[#111318]">1° Quincena (01–14)</p>
                    <p className="font-mono-tabular text-[11px] text-[#747A88]">
                      Recomendado hoy:{' '}
                      {MoneyUtils.formatARSCents(q1.totalRecomendadoAhoraCents)}
                    </p>
                  </div>
                  <span className="font-mono-tabular text-sm font-bold text-[#1D4ED8]">
                    {MoneyUtils.formatARSCents(q1.presupuestoPagableSinComidaCents)}
                  </span>
                </div>
                <div className="flex items-center justify-between py-3.5">
                  <div>
                    <p className="font-bold text-[#111318]">2° Quincena (15–31)</p>
                    <p className="font-mono-tabular text-[11px] text-[#747A88]">
                      Recomendado hoy:{' '}
                      {MoneyUtils.formatARSCents(q2.totalRecomendadoAhoraCents)}
                    </p>
                  </div>
                  <span className="font-mono-tabular text-sm font-bold text-[#1D4ED8]">
                    {MoneyUtils.formatARSCents(q2.presupuestoPagableSinComidaCents)}
                  </span>
                </div>
              </div>
            </section>

            {/* Aviso compacto de tarjetas esperando cierre */}
            {tarjetasBloqueadasPorCierre.length > 0 && (
              <section
                aria-label="Tarjetas esperando cierre"
                className="overflow-hidden rounded-2xl border border-[#F59E0B]/40 bg-[#FFFBEB] p-5 shadow-[0_2px_8px_rgba(217,119,6,0.06)]"
              >
                <div className="flex items-start gap-2.5">
                  <Clock
                    className="mt-0.5 h-4 w-4 shrink-0 text-[#D97706]"
                    aria-hidden="true"
                  />
                  <div className="space-y-1.5">
                    <p className="font-display text-sm font-bold text-[#92400E]">
                      {tarjetasBloqueadasPorCierre.length} tarjeta
                      {tarjetasBloqueadasPorCierre.length === 1 ? '' : 's'} esperando cierre
                    </p>
                    <p className="text-xs leading-relaxed text-[#78350F]">
                      {tarjetasBloqueadasPorCierre
                        .map(
                          (b) =>
                            `${b.obligacion.titulo} (cierra ${formatShortDateAR(b.obligacion.fechaCierre!)})`
                        )
                        .join(' · ')}
                    </p>
                    <button
                      type="button"
                      onClick={() => onNavigateTab('tarjetas')}
                      className="inline-flex items-center gap-1 pt-1 text-xs font-bold text-[#92400E] hover:underline"
                    >
                      <span>Revisar ventanas en Tarjetas</span>
                      <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              </section>
            )}

            {pagosPostergadosPorComida.length > 0 && (
              <section
                aria-label="Pagos que exceden el tope de comida"
                className="rounded-2xl border border-[#FECACA] bg-[#FEF2F2] p-5"
              >
                <p className="font-display text-sm font-bold text-[#B91C1C]">
                  {pagosPostergadosPorComida.length} pago
                  {pagosPostergadosPorComida.length === 1 ? '' : 's'} excede(n) tope de comida
                </p>
                <p className="mt-1 text-xs leading-relaxed text-[#7F1D1D]">
                  Revisá cómo repartir entre 1° y 2° Quincena para proteger el mínimo mensual.
                </p>
                <button
                  type="button"
                  onClick={() => onNavigateTab('quincenas')}
                  className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-[#B91C1C] hover:underline"
                >
                  <span>Ajustar en Ingresos y Quincenas</span>
                  <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </section>
            )}
          </aside>
        </div>
      </div>

      {/* CAPÍTULO 03: ACCESO DIRECTO A CADA ÁREA (CERO REDUNDANCIA) */}
      <div className="space-y-4">
        <ChapterDivider
          index="03"
          title="Áreas del Presupuesto"
          subtitle="Entrá directo al módulo que querés editar o consultar"
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {/* Card 1: Ingresos y Quincenas */}
          <button
            type="button"
            onClick={() => onNavigateTab('quincenas')}
            className="group flex flex-col justify-between overflow-hidden rounded-2xl border border-[#DFDDD4] bg-white text-left shadow-[0_2px_10px_rgba(17,19,24,0.04)] transition-all hover:-translate-y-0.5 hover:border-[#BFDBFE] hover:shadow-[0_6px_18px_rgba(29,78,216,0.08)]"
          >
            <div className="w-full border-b border-[#DCE7FE] bg-[#F4F7FF] px-5 py-3.5">
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 font-display text-sm font-bold text-[#111318]">
                  <Wallet className="h-4 w-4 text-[#1D4ED8]" aria-hidden="true" />
                  Ingresos
                </span>
                <span className="font-mono-tabular text-[11px] font-semibold text-[#1D4ED8]">
                  {incomesCount} cobros
                </span>
              </div>
            </div>
            <div className="w-full p-5">
              <p className="font-mono-tabular text-xl font-bold text-[#1D4ED8]">
                {MoneyUtils.formatARSCents(summary.ingresosTotalesCents)}
              </p>
              <p className="mt-1.5 text-xs text-[#525866]">
                {alertaDescalce.hayDescalce
                  ? '1° Quincena requiere reserva previa'
                  : '1°Q y 2°Q equilibradas con tope comida'}
              </p>
              <div className="mt-4 flex items-center gap-1 text-xs font-bold text-[#1D4ED8] group-hover:underline">
                <span>Gestionar cobros y quincenas</span>
                <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
              </div>
            </div>
          </button>

          {/* Card 2: Servicios del Hogar -> Movimientos */}
          <button
            type="button"
            onClick={() => onNavigateTab('checklist')}
            className="group flex flex-col justify-between overflow-hidden rounded-2xl border border-[#DFDDD4] bg-white text-left shadow-[0_2px_10px_rgba(17,19,24,0.04)] transition-all hover:-translate-y-0.5 hover:border-[#BFDBFE] hover:shadow-[0_6px_18px_rgba(17,19,24,0.08)]"
          >
            <div className="w-full border-b border-[#E7E5DC] bg-[#F7F7F3] px-5 py-3.5">
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 font-display text-sm font-bold text-[#111318]">
                  <Receipt className="h-4 w-4 text-[#525866]" aria-hidden="true" />
                  Servicios y Movim.
                </span>
                <span className="font-mono-tabular text-[11px] font-semibold text-[#525866]">
                  {servicesList.length} servicios
                </span>
              </div>
            </div>
            <div className="w-full p-5">
              <p className="font-mono-tabular text-xl font-bold text-[#111318]">
                {MoneyUtils.formatARSCents(summary.serviciosHogarCents)}
              </p>
              <p className="mt-1.5 text-xs text-[#525866]">
                {pendingServicesCount > 0
                  ? `${pendingServicesCount} servicio${pendingServicesCount === 1 ? '' : 's'} pendiente${pendingServicesCount === 1 ? '' : 's'} este mes`
                  : 'Todos los servicios del hogar al día'}
              </p>
              <div className="mt-4 flex items-center gap-1 text-xs font-bold text-[#111318] group-hover:text-[#1D4ED8] group-hover:underline">
                <span>Ver libro de movimientos</span>
                <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
              </div>
            </div>
          </button>

          {/* Card 3: Tarjetas de Crédito */}
          <button
            type="button"
            onClick={() => onNavigateTab('tarjetas')}
            className="group flex flex-col justify-between overflow-hidden rounded-2xl border border-[#DFDDD4] bg-white text-left shadow-[0_2px_10px_rgba(17,19,24,0.04)] transition-all hover:-translate-y-0.5 hover:border-[#FECACA] hover:shadow-[0_6px_18px_rgba(220,38,38,0.08)]"
          >
            <div className="w-full border-b border-[#F3DFDF] bg-[#FEF8F8] px-5 py-3.5">
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 font-display text-sm font-bold text-[#111318]">
                  <CreditCard className="h-4 w-4 text-[#DC2626]" aria-hidden="true" />
                  Tarjetas
                </span>
                <span className="font-mono-tabular text-[11px] font-semibold text-[#DC2626]">
                  {cardItemsCount} conceptos
                </span>
              </div>
            </div>
            <div className="w-full p-5">
              <p className="font-mono-tabular text-xl font-bold text-[#DC2626]">
                {MoneyUtils.formatARSCents(summary.tarjetasTotalesCents)}
              </p>
              <p className="mt-1.5 text-xs text-[#525866]">
                {tarjetasBloqueadasPorCierre.length > 0
                  ? `${tarjetasBloqueadasPorCierre.length} esperando cierre · anti-doble-pago`
                  : 'Cierres, Carrefour, capital y simulador'}
              </p>
              <div className="mt-4 flex items-center gap-1 text-xs font-bold text-[#DC2626] group-hover:underline">
                <span>Abrir gestión de tarjetas</span>
                <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
              </div>
            </div>
          </button>

          {/* Card 4: Cuotas Fijas y Extinción */}
          <button
            type="button"
            onClick={() => onNavigateTab('extincion')}
            className="group flex flex-col justify-between overflow-hidden rounded-2xl border border-[#DFDDD4] bg-white text-left shadow-[0_2px_10px_rgba(17,19,24,0.04)] transition-all hover:-translate-y-0.5 hover:border-[#C7D2FE] hover:shadow-[0_6px_18px_rgba(67,56,202,0.08)]"
          >
            <div className="w-full border-b border-[#E0E7FF] bg-[#F5F3FF] px-5 py-3.5">
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 font-display text-sm font-bold text-[#111318]">
                  <Layers className="h-4 w-4 text-[#4338CA]" aria-hidden="true" />
                  Cuotas y Extinción
                </span>
                <span className="font-mono-tabular text-[11px] font-semibold text-[#4338CA]">
                  {fixedQuotasList.length} planes
                </span>
              </div>
            </div>
            <div className="w-full p-5">
              <p className="font-mono-tabular text-xl font-bold text-[#4338CA]">
                {MoneyUtils.formatARSCents(summary.cuotasFijasCents)}
              </p>
              <p className="mt-1.5 text-xs text-[#525866]">{nextPayoffLabel}</p>
              <div className="mt-4 flex items-center gap-1 text-xs font-bold text-[#4338CA] group-hover:underline">
                <span>Ver cronograma y hitos</span>
                <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
              </div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};
