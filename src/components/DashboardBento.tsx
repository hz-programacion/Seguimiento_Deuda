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
  Receipt,
  ShieldCheck,
  TrendingDown,
  Wallet,
} from 'lucide-react';
import {
  AppTab,
  BankingPaymentStatus,
  CashFlowMatchResult,
  ItemFinanciero,
  PrioridadPago,
} from '../types/finance';
import {
  formatPeriodoLabel,
  formatShortDateAR,
  validateCardCycleDates,
} from '../utils/dateUtils';
import { MoneyUtils } from '../utils/moneyUtils';
import {
  computeCashflowWaterfall,
  estimateMonthlyCardInterestCents,
  isIncomeCategory,
} from '../utils/cashFlowMatcher';
import { InlineAmountEditor } from './InlineAmountEditor';
import { InlineDateEditor } from './InlineDateEditor';

interface DashboardBentoProps {
  matchResult: CashFlowMatchResult;
  periodItems: ItemFinanciero[];
  canEditFinances: boolean;
  minFoodReserveARS?: number;
  onMarkPaid: (item: ItemFinanciero) => void;
  onEditItem: (item: ItemFinanciero) => void;
  onQuickUpdateAmount: (item: ItemFinanciero, newAmount: number) => void;
  onQuickUpdateCapital: (item: ItemFinanciero, newCapital: number) => void;
  onQuickUpdateDates: (
    item: ItemFinanciero,
    updates: { fechaExactaVencimiento?: string; fechaCierre?: string }
  ) => void;
  onOpenReceipts: (item: ItemFinanciero) => void;
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
  <div className="flex items-center gap-3 pt-2">
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

const ReceiptsIconButton: React.FC<{
  item: ItemFinanciero;
  onOpenReceipts: (item: ItemFinanciero) => void;
  compact?: boolean;
}> = ({ item, onOpenReceipts, compact = false }) => {
  const count = item.adjuntos?.length ?? 0;
  return (
    <button
      type="button"
      onClick={() => onOpenReceipts(item)}
      aria-label={`Comprobantes de ${item.titulo}`}
      title="Resúmenes y comprobantes en Google Drive"
      className={`inline-flex items-center gap-1 rounded-md border transition-colors shrink-0 ${
        compact ? 'px-1.5 py-0.5 text-[11px]' : 'px-2 py-1 text-[11px]'
      } ${
        count > 0
          ? 'border-[#BFDBFE] bg-[#EFF6FF] text-[#1D4ED8] hover:bg-[#DBEAFE]'
          : 'border-[#DFDDD4] bg-[#F7F7F3] text-[#525866] hover:border-[#C9C6BA] hover:text-[#111318]'
      }`}
    >
      <Paperclip className="h-3 w-3" aria-hidden="true" />
      {count > 0 && (
        <span className="font-mono-tabular font-semibold">{count}</span>
      )}
    </button>
  );
};

export const DashboardBento: React.FC<DashboardBentoProps> = ({
  matchResult,
  periodItems,
  canEditFinances,
  minFoodReserveARS = 900000,
  onMarkPaid,
  onEditItem,
  onQuickUpdateAmount,
  onQuickUpdateCapital,
  onQuickUpdateDates,
  onOpenReceipts,
  onNavigateTab,
}) => {
  const [showAllQueue, setShowAllQueue] = useState(false);

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
  const incomesList = periodItems
    .filter((i) => isIncomeCategory(i.categoria) && i.estado !== 'EXTINGUIDO')
    .sort((a, b) => a.diaVencimientoOCobro - b.diaVencimientoOCobro);
  const carrefourItems = periodItems.filter(
    (i) =>
      i.subgrupo?.toLowerCase().includes('carrefour') &&
      i.estado !== 'EXTINGUIDO'
  );
  const carrefourTotalCents = MoneyUtils.sumCents(
    carrefourItems.map((i) => MoneyUtils.toCents(i.montoPactado))
  );

  const rotatingCards = periodItems.filter(
    (i) => i.categoria === 'TARJETA_ROTATIVA' && i.estado !== 'EXTINGUIDO'
  );

  const servicesList = periodItems.filter(
    (i) => i.categoria === 'SERVICIO_HOGAR' && i.estado !== 'EXTINGUIDO'
  );
  const fixedQuotasList = periodItems.filter(
    (i) =>
      i.categoria === 'CUOTA_FIJA' &&
      !i.subgrupo?.toLowerCase().includes('tarjeta') &&
      i.estado !== 'EXTINGUIDO'
  );

  const visibleQueue = showAllQueue
    ? colaPrioridad
    : colaPrioridad.slice(0, 6);

  return (
    <div className="space-y-9">
      {/* Encabezado editorial del período */}
      <div className="flex flex-col gap-3 border-b border-[#D8D6CC] pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#1D4ED8]">
            Tablero de Tesorería
          </p>
          <h1 className="mt-0.5 font-display text-2xl font-bold tracking-tight text-[#111318] sm:text-3xl">
            {formatPeriodoLabel(summary.periodo)}
          </h1>
          <p className="mt-1 text-xs text-[#525866] sm:text-sm">
            {canEditFinances
              ? 'Tocá cualquier fecha o monto para editar directo, o revisá tu agenda mensual.'
              : 'Vista de consulta: verificá fechas de vencimiento y subí resúmenes o comprobantes en Google Drive.'}
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
            className="inline-flex items-center gap-1.5 rounded-xl border border-[#BFDBFE] bg-white px-3.5 py-2 text-xs font-semibold text-[#1D4ED8] shadow-[0_1px_2px_rgba(17,19,24,0.03)] transition-colors hover:bg-[#EFF6FF]"
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
            className="inline-flex items-center gap-1.5 rounded-xl border border-[#F59E0B]/45 bg-white px-3.5 py-2 text-xs font-semibold text-[#92400E] transition-colors hover:bg-[#FEF3C7] whitespace-nowrap shrink-0"
          >
            <span>Ajustar Quincenas</span>
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
            {/* Foco Principal (5 cols): Plata Libre para Comida sobre panel tintado arquitectónico */}
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
              </div>
            </div>

            {/* 3 Lecturas KPI limpias (7 cols) */}
            <div className="grid grid-cols-1 divide-y divide-[#E7E5DC] sm:grid-cols-3 sm:divide-y-0 sm:divide-x lg:col-span-7">
              {/* Ingresos */}
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

              {/* Obligaciones */}
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

              {/* Avance Pagado */}
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

          {/* Cascada Visual de Ingresos en banda inferior dedicada */}
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
                    className="h-full bg-[#1D4ED8] transition-all duration-300"
                  />
                )}
                {pctPendienteVentana > 0 && (
                  <div
                    style={{ width: `${pctPendienteVentana}%` }}
                    title={`Pendiente en ventana: ${MoneyUtils.formatARSCents(waterfall.pendienteEnVentanaCents)}`}
                    className="h-full bg-[#4B5563] transition-all duration-300"
                  />
                )}
                {pctEsperandoCierre > 0 && (
                  <div
                    style={{ width: `${pctEsperandoCierre}%` }}
                    title={`Esperando cierre: ${MoneyUtils.formatARSCents(waterfall.esperandoCierreCents)}`}
                    className="h-full bg-[#D97706] transition-all duration-300"
                  />
                )}
                {pctComidaProt > 0 && (
                  <div
                    style={{ width: `${pctComidaProt}%` }}
                    title={`Reserva comida protegida: ${MoneyUtils.formatARSCents(waterfall.reservaComidaProtegidaCents)}`}
                    className="h-full bg-[#93C5FD] transition-all duration-300"
                  />
                )}
                {pctExcedente > 0 && (
                  <div
                    style={{ width: `${pctExcedente}%` }}
                    title={`Excedente libre: ${MoneyUtils.formatARSCents(waterfall.excedenteRealCents)}`}
                    className="h-full bg-[#4338CA] transition-all duration-300"
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

        {/* Alivio Ganado / Cuotas Extinguidas */}
        {extinguishedItems.length > 0 && (
          <section
            aria-labelledby="alivio-ganado-heading"
            data-testid="alivio-ganado-section"
            className="overflow-hidden rounded-2xl border border-[#C7D2FE] bg-white shadow-[0_2px_8px_rgba(67,56,202,0.06)]"
          >
            <div className="flex flex-col gap-3 border-b border-[#E0E7FF] bg-[#EEF2FF] px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3
                  id="alivio-ganado-heading"
                  className="flex items-center gap-2 font-display text-base font-bold text-[#4338CA]"
                >
                  <TrendingDown className="h-4 w-4" aria-hidden="true" />
                  Alivio Ganado · Cuotas Finalizadas
                </h3>
                <p className="mt-0.5 text-xs text-[#525866]">
                  Cuotas ya terminadas que dejan mayor liquidez disponible cada mes.
                </p>
              </div>
              <div className="text-left sm:text-right">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[#686E7D]">
                  Ahorro mensual liberado
                </p>
                <p className="font-mono-tabular text-xl font-bold text-[#4338CA]">
                  +{MoneyUtils.formatARSCents(summary.alivioMensualGanadoCents)}/mes
                </p>
              </div>
            </div>

            <div className="divide-y divide-[#ECEAE2] px-6">
              {extinguishedItems.map((ext) => (
                <div
                  key={ext.id}
                  className="flex flex-col gap-1 py-3.5 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="text-sm font-semibold text-[#111318]">
                      {ext.titulo}
                    </p>
                    <p className="text-xs text-[#525866]">
                      {ext.notas ??
                        `Finalizada en cuota ${ext.cuotaActual}/${ext.cuotasTotales}`}
                    </p>
                  </div>
                  <div className="font-mono-tabular text-xs font-bold text-[#4338CA]">
                    FINALIZADA · Liberó{' '}
                    {MoneyUtils.formatARS(
                      ext.montoLiberadoAlExtinguirse ?? ext.montoPactado
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* CAPÍTULO 02: PRIORIDAD BANCARIA Y TARJETAS */}
      <div className="space-y-4">
        <ChapterDivider
          index="02"
          title="Prioridad y Tarjetas"
          subtitle="Orden sugerido de pago y control de cierres bancarios"
        />

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Cola de Prioridad (7 cols) */}
          <section
            aria-labelledby="priority-queue-heading"
            className="overflow-hidden rounded-2xl border border-[#DFDDD4] bg-white shadow-[0_2px_10px_rgba(17,19,24,0.04)] lg:col-span-7"
          >
            {/* Cabecera tintada clara */}
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#E7E5DC] bg-[#F7F7F3] px-6 py-4">
              <div>
                <h3
                  id="priority-queue-heading"
                  className="font-display text-base font-bold tracking-tight text-[#111318]"
                >
                  Qué Pagar Primero Este Mes
                </h3>
                <p className="mt-0.5 text-xs text-[#525866]">
                  Al {formatShortDateAR(referenceDateISO)} · prioriza urgencias sin tocar el mínimo de comida.
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigateTab('checklist')}
                className="inline-flex items-center gap-1 rounded-lg border border-[#DFDDD4] bg-white px-3 py-1.5 text-xs font-semibold text-[#1D4ED8] transition-colors hover:bg-[#EFF6FF] whitespace-nowrap shrink-0"
              >
                <span>Ver movimientos</span>
                <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>

            {/* Sub-barra de topes quincenales */}
            <div className="grid grid-cols-1 gap-4 border-b border-[#ECEAE2] bg-[#FAF9F6] px-6 py-3 text-xs sm:grid-cols-2">
              <div className="flex items-center justify-between sm:block">
                <span className="text-[#525866]">Tope pagable 1°Q: </span>
                <span className="font-mono-tabular font-bold text-[#1D4ED8]">
                  {MoneyUtils.formatARSCents(q1.presupuestoPagableSinComidaCents)}
                </span>
                <span className="mt-0.5 hidden sm:block font-mono-tabular text-[11px] text-[#747A88]">
                  Recomendado hoy:{' '}
                  {MoneyUtils.formatARSCents(q1.totalRecomendadoAhoraCents)}
                </span>
              </div>
              <div className="flex items-center justify-between sm:block">
                <span className="text-[#525866]">Tope pagable 2°Q: </span>
                <span className="font-mono-tabular font-bold text-[#1D4ED8]">
                  {MoneyUtils.formatARSCents(q2.presupuestoPagableSinComidaCents)}
                </span>
                <span className="mt-0.5 hidden sm:block font-mono-tabular text-[11px] text-[#747A88]">
                  Recomendado hoy:{' '}
                  {MoneyUtils.formatARSCents(q2.totalRecomendadoAhoraCents)}
                  {pagosPostergadosPorComida.length > 0
                    ? ` · ${pagosPostergadosPorComida.length} excede(n) tope`
                    : ''}
                </span>
              </div>
            </div>

            {colaPrioridad.length === 0 ? (
              <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
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
                    return (
                      <div
                        key={ob.id}
                        className="flex flex-col gap-3 px-6 py-4 transition-colors hover:bg-[#FAF9F6] sm:flex-row sm:items-start sm:justify-between"
                      >
                        <div className="min-w-0 space-y-1.5">
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
                            <span
                              className={`font-semibold ${priorityMeta.className}`}
                            >
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
                            {alloc.fechaLimiteRecomendadaISO !==
                              ob.fechaExactaVencimiento && (
                              <span className="font-mono-tabular text-[11px] font-semibold text-[#B45309]">
                                · Límite hábil{' '}
                                {formatShortDateAR(alloc.fechaLimiteRecomendadaISO)}
                              </span>
                            )}
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

                          {alloc.avisoBancario && (
                            <p className="rounded-lg border border-[#ECEAE2] bg-[#FAF9F6] px-3 py-2 text-[11px] leading-relaxed text-[#525866]">
                              {alloc.avisoBancario}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center justify-between gap-2 pt-0.5 sm:justify-end shrink-0">
                          <InlineAmountEditor
                            itemTitle={ob.titulo}
                            amount={ob.montoPactado}
                            readOnly={!canEditFinances}
                            textClassName="text-sm font-bold text-[#111318]"
                            onSaveAmount={(val) => onQuickUpdateAmount(ob, val)}
                          />
                          <ReceiptsIconButton
                            item={ob}
                            onOpenReceipts={onOpenReceipts}
                          />
                          {canEditFinances && (
                            <>
                              <button
                                type="button"
                                onClick={() => onEditItem(ob)}
                                aria-label={`Editar todo de ${ob.titulo}`}
                                title="Editar fechas, cuotas, bolsillo o notas"
                                className="rounded-lg border border-[#DFDDD4] bg-[#F7F7F3] p-1.5 text-[#525866] transition-colors hover:bg-[#ECEAE2] hover:text-[#111318]"
                              >
                                <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                              </button>
                              <button
                                type="button"
                                onClick={() => onMarkPaid(ob)}
                                aria-label={`Marcar pagado ${ob.titulo}`}
                                className="rounded-lg bg-[#1D4ED8] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#1E40AF] whitespace-nowrap"
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

                {colaPrioridad.length > 6 && (
                  <div className="border-t border-[#ECEAE2] bg-[#FAF9F6] px-6 py-3 text-center">
                    <button
                      type="button"
                      onClick={() => setShowAllQueue((v) => !v)}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1D4ED8] transition-colors hover:underline"
                    >
                      <ChevronDown
                        className={`h-3.5 w-3.5 transition-transform ${
                          showAllQueue ? 'rotate-180' : ''
                        }`}
                        aria-hidden="true"
                      />
                      {showAllQueue
                        ? 'Mostrar solo los primeros 6'
                        : `Ver los ${colaPrioridad.length - 6} restantes`}
                    </button>
                  </div>
                )}
              </>
            )}
          </section>

          {/* Columna derecha: Anti-doble-pago + Tarjetas de Crédito (5 cols) */}
          <div className="space-y-6 lg:col-span-5">
            {tarjetasBloqueadasPorCierre.length > 0 && (
              <section
                aria-labelledby="bloqueadas-cierre-heading"
                className="overflow-hidden rounded-2xl border border-[#F59E0B]/40 bg-white shadow-[0_2px_8px_rgba(217,119,6,0.06)]"
              >
                <div className="border-b border-[#FDE68A] bg-[#FFFBEB] px-5 py-3.5">
                  <h3
                    id="bloqueadas-cierre-heading"
                    className="flex items-center gap-2 font-display text-sm font-bold text-[#92400E]"
                  >
                    <Clock
                      className="h-4 w-4 shrink-0 text-[#D97706]"
                      aria-hidden="true"
                    />
                    Esperar Cierre (Anti-Doble-Pago)
                  </h3>
                  <p className="mt-1 text-xs leading-relaxed text-[#78350F]">
                    Pagar antes del cierre no cancela el Pago Mínimo del resumen. Esperá tu ventana:
                  </p>
                </div>

                <div className="divide-y divide-[#ECEAE2] px-5">
                  {tarjetasBloqueadasPorCierre.map((b) => (
                    <div
                      key={b.obligacion.id}
                      className="flex items-center justify-between gap-2 py-3 text-xs"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-bold text-[#111318]">
                          {b.obligacion.titulo}
                        </p>
                        <p className="font-mono-tabular text-[11px] font-medium text-[#92400E]">
                          Cierre {formatShortDateAR(b.obligacion.fechaCierre!)} ·
                          Pagar del {formatShortDateAR(b.ventanaPagoDesdeISO!)} al{' '}
                          {formatShortDateAR(b.fechaLimiteRecomendadaISO)}
                        </p>
                      </div>
                      <span className="font-mono-tabular font-bold text-[#111318] shrink-0">
                        {MoneyUtils.formatARS(b.obligacion.montoPactado)}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Tarjetas de Crédito */}
            <section
              aria-labelledby="tarjetas-resumen-heading"
              className="overflow-hidden rounded-2xl border border-[#DFDDD4] bg-white shadow-[0_2px_10px_rgba(17,19,24,0.04)]"
            >
              <div className="flex items-center justify-between gap-2 border-b border-[#F3DFDF] bg-[#FEF8F8] px-5 py-4">
                <div>
                  <h3
                    id="tarjetas-resumen-heading"
                    className="flex items-center gap-2 font-display text-base font-bold text-[#111318]"
                  >
                    <CreditCard
                      className="h-4 w-4 text-[#DC2626]"
                      aria-hidden="true"
                    />
                    Tarjetas de Crédito
                  </h3>
                  <p className="mt-0.5 text-xs text-[#525866]">
                    {canEditFinances
                      ? 'Editá cierre, vencimiento, mínimo o subí el PDF.'
                      : 'Cierres, vencimientos y resúmenes PDF en Drive.'}
                  </p>
                </div>
                <span className="font-mono-tabular text-base font-bold text-[#DC2626] shrink-0">
                  {MoneyUtils.formatARSCents(summary.tarjetasTotalesCents)}
                </span>
              </div>

              <div className="divide-y divide-[#ECEAE2] px-5">
                {carrefourItems.length > 0 && (
                  <div className="py-4">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-bold text-[#111318]">
                          Tarjeta Carrefour
                        </p>
                        <p className="text-xs text-[#525866]">
                          Suma de cuotas activas del resumen
                        </p>
                      </div>
                      <span className="font-mono-tabular text-sm font-bold text-[#111318]">
                        {MoneyUtils.formatARSCents(carrefourTotalCents)}
                      </span>
                    </div>

                    <div className="mt-3 space-y-3 rounded-xl border border-[#E7E5DC] bg-[#FAF9F6] p-3.5">
                      {carrefourItems.map((sub) => {
                        const cycleCheck = validateCardCycleDates(
                          sub.fechaCierre,
                          sub.fechaExactaVencimiento
                        );
                        return (
                          <div key={sub.id} className="space-y-1 text-xs">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span className="truncate font-semibold text-[#111318]">
                                  {sub.titulo}{' '}
                                  <span className="font-mono-tabular text-[#4338CA]">
                                    {sub.cuotaActual}/{sub.cuotasTotales}
                                  </span>
                                </span>
                                <ReceiptsIconButton
                                  item={sub}
                                  onOpenReceipts={onOpenReceipts}
                                  compact
                                />
                                {canEditFinances && (
                                  <button
                                    type="button"
                                    onClick={() => onEditItem(sub)}
                                    aria-label={`Editar todo de ${sub.titulo}`}
                                    title="Editar detalle completo"
                                    className="rounded p-0.5 text-[#747A88] hover:text-[#1D4ED8]"
                                  >
                                    <Pencil className="h-3 w-3" aria-hidden="true" />
                                  </button>
                                )}
                              </div>
                              <InlineAmountEditor
                                itemTitle={sub.titulo}
                                amount={sub.montoPactado}
                                readOnly={!canEditFinances}
                                textClassName="text-xs font-bold text-[#111318]"
                                onSaveAmount={(val) =>
                                  onQuickUpdateAmount(sub, val)
                                }
                              />
                            </div>
                            <div className="flex flex-wrap items-center gap-2 text-[11px] text-[#525866]">
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
                        );
                      })}
                    </div>
                  </div>
                )}

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
                    <div key={card.id} className="py-4 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="truncate text-sm font-bold text-[#111318]">
                            {card.titulo}
                          </span>
                          <ReceiptsIconButton
                            item={card}
                            onOpenReceipts={onOpenReceipts}
                            compact
                          />
                          {canEditFinances && (
                            <button
                              type="button"
                              onClick={() => onEditItem(card)}
                              aria-label={`Editar todo de ${card.titulo}`}
                              title="Editar saldo total, fechas y notas"
                              className="rounded p-1 text-[#747A88] hover:bg-[#F7F7F3] hover:text-[#1D4ED8] shrink-0"
                            >
                              <Pencil className="h-3 w-3" aria-hidden="true" />
                            </button>
                          )}
                        </div>
                        <InlineAmountEditor
                          itemTitle={card.titulo}
                          amount={card.montoPactado}
                          readOnly={!canEditFinances}
                          textClassName="text-sm font-bold text-[#DC2626]"
                          onSaveAmount={(val) => onQuickUpdateAmount(card, val)}
                        />
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-xs">
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
                        <p className="text-[11px] font-medium text-[#B45309]">
                          {cycleCheck.warning}
                        </p>
                      )}

                      <div className="flex flex-wrap items-center justify-between gap-2 font-mono-tabular text-xs text-[#525866]">
                        <div className="flex items-center gap-1">
                          <span className="font-sans">Deuda total:</span>
                          <InlineAmountEditor
                            itemTitle={`deuda total de ${card.titulo}`}
                            amount={card.saldoCapitalTotal ?? 0}
                            readOnly={!canEditFinances}
                            textClassName="text-xs font-bold text-[#111318]"
                            onSaveAmount={(val) => onQuickUpdateCapital(card, val)}
                          />
                        </div>
                        <span
                          className={
                            card.estado === 'PAGADO'
                              ? 'font-bold text-[#1D4ED8]'
                              : 'font-bold text-[#B45309]'
                          }
                        >
                          {card.estado}
                        </span>
                      </div>

                      {monthlyInterestCents > 0 && (
                        <p className="font-mono-tabular text-[11px] text-[#747A88]">
                          Costo financiero aprox. TNA {card.tnaEstimada}%:{' '}
                          <span className="font-semibold text-[#111318]">
                            ~{MoneyUtils.formatARSCents(monthlyInterestCents)}/mes
                          </span>
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
        </div>
      </div>

      {/* CAPÍTULO 03: ESTRUCTURA MENSUAL EDITABLE EN 3 TARJETAS INDEPENDIENTES */}
      <div className="space-y-4">
        <ChapterDivider
          index="03"
          title="Estructura del Mes"
          subtitle="Ingresos, servicios del hogar y cuotas fijas claramente separados"
        />

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* 1. Ingresos del Mes */}
          <section
            aria-labelledby="ingresos-mes-heading"
            className="overflow-hidden rounded-2xl border border-[#DFDDD4] bg-white shadow-[0_2px_10px_rgba(17,19,24,0.04)]"
          >
            <div className="flex items-center justify-between gap-2 border-b border-[#DCE7FE] bg-[#F4F7FF] px-5 py-4">
              <div>
                <h3
                  id="ingresos-mes-heading"
                  className="flex items-center gap-2 font-display text-base font-bold text-[#111318]"
                >
                  <Wallet className="h-4 w-4 text-[#1D4ED8]" aria-hidden="true" />
                  Ingresos ({incomesList.length})
                </h3>
                <p className="mt-0.5 text-xs text-[#525866]">
                  Tocá fecha o monto para ajustar cobros.
                </p>
              </div>
              <span className="font-mono-tabular text-base font-bold text-[#1D4ED8] shrink-0">
                {MoneyUtils.formatARSCents(summary.ingresosTotalesCents)}
              </span>
            </div>

            <div className="divide-y divide-[#ECEAE2] px-5">
              {incomesList.map((inc) => (
                <div
                  key={inc.id}
                  className="flex items-center justify-between gap-2 py-3.5 text-sm"
                >
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate font-semibold text-[#111318]">
                        {inc.titulo}
                      </span>
                      <ReceiptsIconButton
                        item={inc}
                        onOpenReceipts={onOpenReceipts}
                        compact
                      />
                      {canEditFinances && (
                        <button
                          type="button"
                          onClick={() => onEditItem(inc)}
                          aria-label={`Editar todo de ${inc.titulo}`}
                          title="Editar detalle"
                          className="rounded p-0.5 text-[#747A88] hover:text-[#1D4ED8] shrink-0"
                        >
                          <Pencil className="h-3 w-3" aria-hidden="true" />
                        </button>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 text-xs text-[#525866]">
                      <InlineDateEditor
                        itemTitle={inc.titulo}
                        label="Cobro"
                        dateISO={inc.fechaExactaVencimiento}
                        readOnly={!canEditFinances}
                        onSaveDate={(val) =>
                          onQuickUpdateDates(inc, { fechaExactaVencimiento: val })
                        }
                      />
                      <span>· {inc.bolsilloResponsable}</span>
                    </div>
                  </div>
                  <InlineAmountEditor
                    itemTitle={inc.titulo}
                    amount={inc.montoPactado}
                    prefix="+"
                    readOnly={!canEditFinances}
                    textClassName="text-sm font-bold text-[#1D4ED8]"
                    onSaveAmount={(val) => onQuickUpdateAmount(inc, val)}
                  />
                </div>
              ))}
            </div>
          </section>

          {/* 2. Servicios del Hogar */}
          <section
            aria-labelledby="servicios-heading"
            className="overflow-hidden rounded-2xl border border-[#DFDDD4] bg-white shadow-[0_2px_10px_rgba(17,19,24,0.04)]"
          >
            <div className="flex items-center justify-between gap-2 border-b border-[#E7E5DC] bg-[#F7F7F3] px-5 py-4">
              <div>
                <h3
                  id="servicios-heading"
                  className="flex items-center gap-2 font-display text-base font-bold text-[#111318]"
                >
                  <Receipt className="h-4 w-4 text-[#525866]" aria-hidden="true" />
                  Servicios ({servicesList.length})
                </h3>
                <p className="mt-0.5 text-xs text-[#525866]">
                  {canEditFinances
                    ? 'Ajustá vencimiento, monto o subí factura.'
                    : 'Consultá vencimientos y facturas.'}
                </p>
              </div>
              <span className="font-mono-tabular text-base font-bold text-[#111318] shrink-0">
                {MoneyUtils.formatARSCents(summary.serviciosHogarCents)}
              </span>
            </div>

            <div className="divide-y divide-[#ECEAE2] px-5">
              {servicesList.map((srv) => (
                <div
                  key={srv.id}
                  className="flex items-center justify-between gap-2 py-3.5 text-sm"
                >
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate font-semibold text-[#111318]">
                        {srv.titulo}
                      </span>
                      <ReceiptsIconButton
                        item={srv}
                        onOpenReceipts={onOpenReceipts}
                        compact
                      />
                      {canEditFinances && (
                        <button
                          type="button"
                          onClick={() => onEditItem(srv)}
                          aria-label={`Editar todo de ${srv.titulo}`}
                          title="Editar detalle"
                          className="rounded p-0.5 text-[#747A88] hover:text-[#1D4ED8] shrink-0"
                        >
                          <Pencil className="h-3 w-3" aria-hidden="true" />
                        </button>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 text-xs text-[#525866]">
                      <InlineDateEditor
                        itemTitle={srv.titulo}
                        label="Vence"
                        dateISO={srv.fechaExactaVencimiento}
                        readOnly={!canEditFinances}
                        onSaveDate={(val) =>
                          onQuickUpdateDates(srv, { fechaExactaVencimiento: val })
                        }
                      />
                      <span
                        className={
                          srv.estado === 'PAGADO'
                            ? 'font-semibold text-[#1D4ED8]'
                            : 'font-semibold text-[#B45309]'
                        }
                      >
                        · {srv.estado}
                      </span>
                    </div>
                  </div>
                  <InlineAmountEditor
                    itemTitle={srv.titulo}
                    amount={srv.montoPactado}
                    readOnly={!canEditFinances}
                    textClassName="text-sm font-bold text-[#111318]"
                    onSaveAmount={(val) => onQuickUpdateAmount(srv, val)}
                  />
                </div>
              ))}
            </div>
          </section>

          {/* 3. Cuotas Fijas Activas */}
          <section
            aria-labelledby="cuotas-fijas-heading"
            className="overflow-hidden rounded-2xl border border-[#DFDDD4] bg-white shadow-[0_2px_10px_rgba(17,19,24,0.04)]"
          >
            <div className="flex items-center justify-between gap-2 border-b border-[#E0E7FF] bg-[#F5F3FF] px-5 py-4">
              <div>
                <h3
                  id="cuotas-fijas-heading"
                  className="flex items-center gap-2 font-display text-base font-bold text-[#111318]"
                >
                  <Layers className="h-4 w-4 text-[#4338CA]" aria-hidden="true" />
                  Cuotas Fijas ({fixedQuotasList.length})
                </h3>
                <p className="mt-0.5 text-xs text-[#525866]">
                  Terminan solas al pagar la última cuota.
                </p>
              </div>
              <span className="font-mono-tabular text-base font-bold text-[#4338CA] shrink-0">
                {MoneyUtils.formatARSCents(summary.cuotasFijasCents)}
              </span>
            </div>

            <div className="divide-y divide-[#ECEAE2] px-5">
              {fixedQuotasList.map((cf) => (
                <div
                  key={cf.id}
                  className="flex items-center justify-between gap-2 py-3.5 text-sm"
                >
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate font-semibold text-[#111318]">
                        {cf.titulo}
                      </span>
                      <ReceiptsIconButton
                        item={cf}
                        onOpenReceipts={onOpenReceipts}
                        compact
                      />
                      {canEditFinances && (
                        <button
                          type="button"
                          onClick={() => onEditItem(cf)}
                          aria-label={`Editar todo de ${cf.titulo}`}
                          title="Editar cuotas, fechas o bolsillo"
                          className="rounded p-0.5 text-[#747A88] hover:text-[#1D4ED8] shrink-0"
                        >
                          <Pencil className="h-3 w-3" aria-hidden="true" />
                        </button>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 font-mono-tabular text-xs text-[#525866]">
                      <span className="font-semibold text-[#4338CA]">
                        {cf.cuotaActual}/{cf.cuotasTotales}
                      </span>
                      <span>·</span>
                      <InlineDateEditor
                        itemTitle={cf.titulo}
                        label="Vence"
                        dateISO={cf.fechaExactaVencimiento}
                        readOnly={!canEditFinances}
                        onSaveDate={(val) =>
                          onQuickUpdateDates(cf, { fechaExactaVencimiento: val })
                        }
                      />
                    </div>
                  </div>
                  <InlineAmountEditor
                    itemTitle={cf.titulo}
                    amount={cf.montoPactado}
                    readOnly={!canEditFinances}
                    textClassName="text-sm font-bold text-[#111318]"
                    onSaveAmount={(val) => onQuickUpdateAmount(cf, val)}
                  />
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
