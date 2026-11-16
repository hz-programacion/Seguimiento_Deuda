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
  Paperclip,
  Pencil,
  ShieldCheck,
  Sparkles,
  TrendingDown,
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
          : 'border-[#E4E3DD] bg-[#F6F6F3] text-[#525866] hover:border-[#D4D2CA] hover:text-[#111318]'
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
    simuladorExcedente,
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

  const radarQuita = periodItems.find(
    (i) => i.categoria === 'DEUDA_CON_QUITA'
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
    : colaPrioridad.slice(0, 8);

  return (
    <div className="space-y-6">
      {/* Encabezado limpio del período */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#747A88]">
            Tablero de Tesorería
          </p>
          <h1 className="mt-0.5 font-display text-2xl font-bold tracking-tight text-[#111318] sm:text-3xl">
            {formatPeriodoLabel(summary.periodo)}
          </h1>
          <p className="mt-1 text-xs text-[#525866] sm:text-sm">
            {canEditFinances
              ? 'Tocá cualquier fecha o monto para ajustarlo directo, o abrí el Calendario para agendar recordatorios.'
              : 'Vista protegida de solo lectura: consultá vencimientos y subí resúmenes o comprobantes en Google Drive.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => onNavigateTab('calendario')}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[#BFDBFE] bg-[#EFF6FF] px-3 py-1.5 text-xs font-semibold text-[#1D4ED8] transition-colors hover:bg-[#DBEAFE]"
          >
            <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
            Explorar Calendario
          </button>
          <div className="font-mono-tabular text-xs text-[#525866]">
            {colaPrioridad.length} pendiente{colaPrioridad.length === 1 ? '' : 's'} ·{' '}
            <span className="font-bold text-[#111318]">
              {MoneyUtils.formatARSCents(summary.totalPendienteCents)}
            </span>{' '}
            por abonar
          </div>
        </div>
      </div>

      {/* Alerta temprana de faltante quincenal */}
      {alertaDescalce.hayDescalce && (
        <div
          role="alert"
          className="flex flex-col gap-3 rounded-2xl border border-[#FDE68A] bg-[#FFFBEB] p-4 sm:flex-row sm:items-center sm:justify-between"
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
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#F59E0B]/40 bg-white px-3.5 py-2 text-xs font-semibold text-[#92400E] transition-colors hover:bg-[#FEF3C7] whitespace-nowrap shrink-0"
          >
            <span>Ajustar Quincenas</span>
            <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      )}

      {/* Banda Hero Unificada */}
      <section
        aria-label="Resumen financiero principal"
        className="rounded-2xl border border-[#E4E3DD] bg-white p-5 shadow-[0_1px_2px_rgba(17,19,24,0.03)] sm:p-6"
      >
        <div
          data-testid="kpi-grid"
          className="grid grid-cols-1 gap-6 lg:grid-cols-12"
        >
          {/* Foco Principal (5 cols): Plata Libre para Comida */}
          <div className="flex flex-col justify-between border-b border-[#EEEDE8] pb-6 lg:col-span-5 lg:border-b-0 lg:border-r lg:pb-0 lg:pr-6">
            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.1em] text-[#1D4ED8]">
                  <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
                  Plata Libre para Comida
                </span>
                <span className="font-mono-tabular text-[11px] text-[#747A88]">
                  Mín. {MoneyUtils.formatARS(minFoodReserveARS)}
                </span>
              </div>

              <p
                data-testid="kpi-colchon-comida"
                style={{ fontSize: 'clamp(1.85rem, 3vw, 2.55rem)' }}
                className={`mt-3 font-display font-bold leading-none tracking-tight font-mono-tabular ${
                  summary.colchonComidaCents >= 0
                    ? 'text-[#111318]'
                    : 'text-[#DC2626]'
                }`}
              >
                {MoneyUtils.formatARSCents(summary.colchonComidaCents)}
              </p>

              <p className="mt-2.5 text-xs leading-relaxed text-[#525866]">
                Disponible real del mes después de cubrir todas las obligaciones fijas.
                {waterfall.excedenteRealCents > 0 && (
                  <>
                    {' '}
                    Incluye{' '}
                    <span className="font-mono-tabular font-semibold text-[#1D4ED8]">
                      +{MoneyUtils.formatARSCents(waterfall.excedenteRealCents)}
                    </span>{' '}
                    de margen por encima de tu mínimo de comida.
                  </>
                )}
              </p>
            </div>
          </div>

          {/* 3 Lecturas KPI limpias (7 cols) */}
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3 lg:col-span-7">
            {/* Ingresos */}
            <div className="flex flex-col justify-between border-b border-[#EEEDE8] pb-4 sm:border-b-0 sm:border-r sm:pb-0 sm:pr-4">
              <div>
                <p className="text-xs font-medium text-[#525866]">
                  Ingresos del Mes
                </p>
                <p
                  data-testid="kpi-ingresos"
                  className="mt-2 font-mono-tabular text-xl font-bold tracking-tight text-[#1D4ED8]"
                >
                  {MoneyUtils.formatARSCents(summary.ingresosTotalesCents)}
                </p>
              </div>
              <p className="mt-3 font-mono-tabular text-[11px] text-[#747A88]">
                Base {MoneyUtils.formatCompactCents(summary.ingresosHabitualesCents)}
                {summary.ingresosSacCents > 0
                  ? ` · SAC +${MoneyUtils.formatCompactCents(summary.ingresosSacCents)}`
                  : ''}
              </p>
            </div>

            {/* Obligaciones */}
            <div className="flex flex-col justify-between border-b border-[#EEEDE8] pb-4 sm:border-b-0 sm:border-r sm:pb-0 sm:pr-4">
              <div>
                <p className="text-xs font-medium text-[#525866]">
                  Gastos y Deudas Fijas
                </p>
                <p
                  data-testid="kpi-obligaciones"
                  className="mt-2 font-mono-tabular text-xl font-bold tracking-tight text-[#111318]"
                >
                  {MoneyUtils.formatARSCents(
                    summary.obligacionesFijasTotalesCents
                  )}
                </p>
              </div>
              <div
                data-testid="kpi-obligaciones-desglose"
                className="mt-3 grid grid-cols-3 gap-2 font-mono-tabular text-[11px]"
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
            <div className="flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-medium text-[#525866]">
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
                  className="mt-2 font-mono-tabular text-xl font-bold tracking-tight text-[#111318]"
                >
                  {MoneyUtils.formatARSCents(summary.totalPagadoCents)}
                </p>
                <div
                  className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-[#EEEDE8]"
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
              <p className="mt-3 font-mono-tabular text-[11px] text-[#747A88]">
                Falta pagar {MoneyUtils.formatCompactCents(summary.totalPendienteCents)}
              </p>
            </div>
          </div>
        </div>

        {/* Cascada Visual de Ingresos */}
        {waterfall.ingresosTotalesCents > 0 && (
          <div className="mt-6 border-t border-[#EEEDE8] pt-5">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="font-semibold text-[#111318]">
                Distribución real de tus ingresos del mes
              </span>
              <span className="font-mono-tabular text-[11px] text-[#747A88]">
                100% = {MoneyUtils.formatARSCents(waterfall.ingresosTotalesCents)}
              </span>
            </div>

            <div className="mt-2.5 flex h-2.5 w-full overflow-hidden rounded-full bg-[#EEEDE8]">
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

            <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[11px] text-[#525866] font-mono-tabular">
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
          className="rounded-2xl border border-[#C7D2FE] bg-[#EEF2FF]/60 p-5 sm:p-6"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2
                id="alivio-ganado-heading"
                className="flex items-center gap-2 font-display text-base font-bold text-[#4338CA]"
              >
                <TrendingDown className="h-4 w-4" aria-hidden="true" />
                Alivio Ganado · Cuotas Finalizadas
              </h2>
              <p className="mt-0.5 text-xs text-[#525866]">
                Cuotas que ya terminaron y dejan más dinero disponible todos los meses.
              </p>
            </div>
            <div className="text-left sm:text-right">
              <p className="text-[11px] uppercase tracking-wider text-[#747A88]">
                Ahorro mensual liberado
              </p>
              <p className="font-mono-tabular text-xl font-bold text-[#4338CA]">
                +{MoneyUtils.formatARSCents(summary.alivioMensualGanadoCents)}/mes
              </p>
            </div>
          </div>

          <div className="mt-4 divide-y divide-[#C7D2FE]/60 border-t border-[#C7D2FE]">
            {extinguishedItems.map((ext) => (
              <div
                key={ext.id}
                className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between"
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

      {/* Grid Principal: Qué pagar primero (7 cols) + Tarjetas & Oportunidades (5 cols) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <section
          aria-labelledby="priority-queue-heading"
          className="rounded-2xl border border-[#E4E3DD] bg-white p-5 shadow-[0_1px_2px_rgba(17,19,24,0.03)] sm:p-6 lg:col-span-7"
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2
                id="priority-queue-heading"
                className="font-display text-lg font-bold tracking-tight text-[#111318]"
              >
                Qué Pagar Primero Este Mes
              </h2>
              <p className="mt-0.5 text-xs text-[#525866]">
                Análisis bancario al {formatShortDateAR(referenceDateISO)}: prioriza urgencias dentro de tu quincena sin tocar la comida y bloquea tarjetas pre-cierre.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab('checklist')}
              className="text-xs font-semibold text-[#1D4ED8] transition-colors hover:underline whitespace-nowrap shrink-0"
            >
              Ver lista completa
            </button>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 border-y border-[#EEEDE8] py-3 text-xs sm:grid-cols-2">
            <div>
              <span className="text-[#525866]">Tope pagable 1°Q (sin comida):</span>{' '}
              <span className="font-mono-tabular font-bold text-[#1D4ED8]">
                {MoneyUtils.formatARSCents(q1.presupuestoPagableSinComidaCents)}
              </span>
              <span className="mt-0.5 block font-mono-tabular text-[11px] text-[#747A88]">
                Recomendado hoy:{' '}
                {MoneyUtils.formatARSCents(q1.totalRecomendadoAhoraCents)}
              </span>
            </div>
            <div>
              <span className="text-[#525866]">Tope pagable 2°Q (sin comida):</span>{' '}
              <span className="font-mono-tabular font-bold text-[#1D4ED8]">
                {MoneyUtils.formatARSCents(q2.presupuestoPagableSinComidaCents)}
              </span>
              <span className="mt-0.5 block font-mono-tabular text-[11px] text-[#747A88]">
                Recomendado hoy:{' '}
                {MoneyUtils.formatARSCents(q2.totalRecomendadoAhoraCents)}
                {pagosPostergadosPorComida.length > 0
                  ? ` · ${pagosPostergadosPorComida.length} excede(n) tope`
                  : ''}
              </span>
            </div>
          </div>

          {colaPrioridad.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <CheckCircle2
                className="h-8 w-8 text-[#1D4ED8]"
                aria-hidden="true"
              />
              <p className="mt-3 font-display text-base font-bold text-[#111318]">
                Todas las cuentas de este mes están pagadas
              </p>
              <p className="mt-1 text-xs text-[#525866]">
                Podés pasar al mes siguiente desde la barra superior.
              </p>
            </div>
          ) : (
            <>
              <div className="mt-2 divide-y divide-[#EEEDE8]">
                {visibleQueue.map((alloc) => {
                  const priorityMeta = getPriorityText(alloc.prioridad);
                  const bankMeta = getBankingIndicator(alloc.bankingStatus);
                  const ob = alloc.obligacion;
                  return (
                    <div
                      key={ob.id}
                      className="flex flex-col gap-3 py-4 transition-colors hover:bg-[#FAF9F6] sm:flex-row sm:items-start sm:justify-between"
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
                          <p className="rounded-lg bg-[#F6F6F3] px-3 py-2 text-[11px] leading-relaxed text-[#525866]">
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
                              className="rounded-lg border border-[#E4E3DD] bg-[#F6F6F3] p-1.5 text-[#525866] transition-colors hover:bg-[#EEEDE8] hover:text-[#111318]"
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

              {colaPrioridad.length > 8 && (
                <div className="mt-3 border-t border-[#EEEDE8] pt-3 text-center">
                  <button
                    type="button"
                    onClick={() => setShowAllQueue((v) => !v)}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#525866] transition-colors hover:text-[#111318]"
                  >
                    <ChevronDown
                      className={`h-3.5 w-3.5 transition-transform ${
                        showAllQueue ? 'rotate-180' : ''
                      }`}
                      aria-hidden="true"
                    />
                    {showAllQueue
                      ? 'Mostrar solo las primeras 8'
                      : `Ver las ${colaPrioridad.length - 8} restantes`}
                  </button>
                </div>
              )}
            </>
          )}
        </section>

        {/* Columna derecha: Anti-doble-pago + Tarjetas + Radar Quita (5 cols) */}
        <div className="space-y-6 lg:col-span-5">
          {tarjetasBloqueadasPorCierre.length > 0 && (
            <section
              aria-labelledby="bloqueadas-cierre-heading"
              className="rounded-2xl border border-[#FDE68A] bg-[#FFFBEB] p-5"
            >
              <h2
                id="bloqueadas-cierre-heading"
                className="flex items-center gap-2 font-display text-sm font-bold text-[#92400E]"
              >
                <Clock className="h-4 w-4 shrink-0 text-[#D97706]" aria-hidden="true" />
                No Pagar Antes del Cierre (Anti-Doble-Pago)
              </h2>
              <p className="mt-1.5 text-xs leading-relaxed text-[#78350F]">
                Abonar antes del cierre solo amortiza deuda y no cancela el Pago Mínimo del resumen. Esperá tu ventana válida:
              </p>
              <div className="mt-3 divide-y divide-[#FDE68A] border-t border-[#FDE68A]">
                {tarjetasBloqueadasPorCierre.map((b) => (
                  <div
                    key={b.obligacion.id}
                    className="flex items-center justify-between gap-2 py-2.5 text-xs"
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
            className="rounded-2xl border border-[#E4E3DD] bg-white p-5 shadow-[0_1px_2px_rgba(17,19,24,0.03)] sm:p-6"
          >
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2
                  id="tarjetas-resumen-heading"
                  className="flex items-center gap-2 font-display text-base font-bold text-[#111318]"
                >
                  <CreditCard
                    className="h-4 w-4 text-[#DC2626]"
                    aria-hidden="true"
                  />
                  Tarjetas de Crédito
                </h2>
                <p className="mt-0.5 text-xs text-[#525866]">
                  {canEditFinances
                    ? 'Editá cierre, vencimiento, mínimo, deuda total o subí el PDF.'
                    : 'Consultá cierres, vencimientos y subí los resúmenes PDF en Drive.'}
                </p>
              </div>
              <span className="font-mono-tabular text-sm font-bold text-[#DC2626] shrink-0">
                {MoneyUtils.formatARSCents(summary.tarjetasTotalesCents)}
              </span>
            </div>

            <div className="mt-4 divide-y divide-[#EEEDE8]">
              {carrefourItems.length > 0 && (
                <div className="py-3.5">
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

                  <div className="mt-3 space-y-3 border-t border-[#EEEDE8] pt-3 pl-2.5">
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
                              onSaveAmount={(val) => onQuickUpdateAmount(sub, val)}
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
                  <div key={card.id} className="py-3.5 space-y-2">
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
                            className="rounded p-1 text-[#747A88] hover:bg-[#F6F6F3] hover:text-[#1D4ED8] shrink-0"
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
                      <p className="text-[11px] text-[#747A88] font-mono-tabular">
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

          {/* Radar Quita Mercado Pago */}
          <section
            aria-labelledby="radar-oportunidad-heading"
            className="rounded-2xl border border-[#E4E3DD] bg-white p-5 shadow-[0_1px_2px_rgba(17,19,24,0.03)] sm:p-6"
          >
            <div className="flex items-center justify-between gap-2">
              <h2
                id="radar-oportunidad-heading"
                className="flex items-center gap-2 font-display text-base font-bold text-[#111318]"
              >
                <Sparkles
                  className="h-4 w-4 text-[#4338CA]"
                  aria-hidden="true"
                />
                Oferta Quita Mercado Pago
              </h2>
              <button
                type="button"
                onClick={() => onNavigateTab('extincion')}
                className="text-xs font-semibold text-[#1D4ED8] hover:underline"
              >
                Simular plan
              </button>
            </div>

            {radarQuita && (
              <div className="mt-4 space-y-3">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-xs text-[#525866]">
                    Deuda original sin descuento
                  </span>
                  <span className="font-mono-tabular text-xs text-[#747A88] line-through">
                    {MoneyUtils.formatARS(radarQuita.saldoCapitalTotal ?? 0)}
                  </span>
                </div>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-semibold text-[#111318]">
                    Pago contado ({radarQuita.porcentajeQuita ?? 78.9}% OFF)
                  </span>
                  <span className="font-mono-tabular text-lg font-bold text-[#4338CA]">
                    {MoneyUtils.formatARS(
                      radarQuita.montoOfertaQuitaContado ?? 0
                    )}
                  </span>
                </div>
                <p className="border-t border-[#EEEDE8] pt-3 text-xs leading-relaxed text-[#525866]">
                  {simuladorExcedente.recomendacionTexto}
                </p>
              </div>
            )}
          </section>
        </div>
      </div>

      {/* Desglose Inferior Editable: Ingresos, Servicios y Cuotas Fijas */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Ingresos */}
        <section
          aria-labelledby="ingresos-mes-heading"
          className="rounded-2xl border border-[#E4E3DD] bg-white p-5 shadow-[0_1px_2px_rgba(17,19,24,0.03)] sm:p-6"
        >
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2
                id="ingresos-mes-heading"
                className="font-display text-base font-bold text-[#111318]"
              >
                Ingresos del Mes
              </h2>
              <p className="text-xs text-[#525866]">
                Tocá fecha o monto para actualizar cobros.
              </p>
            </div>
            <span className="font-mono-tabular text-base font-bold text-[#1D4ED8] shrink-0">
              {MoneyUtils.formatARSCents(summary.ingresosTotalesCents)}
            </span>
          </div>
          <div className="mt-4 divide-y divide-[#EEEDE8]">
            {incomesList.map((inc) => (
              <div
                key={inc.id}
                className="flex items-center justify-between gap-2 py-3 text-sm"
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

        {/* Servicios */}
        <section
          aria-labelledby="servicios-heading"
          className="rounded-2xl border border-[#E4E3DD] bg-white p-5 shadow-[0_1px_2px_rgba(17,19,24,0.03)] sm:p-6"
        >
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2
                id="servicios-heading"
                className="font-display text-base font-bold text-[#111318]"
              >
                Servicios del Hogar
              </h2>
              <p className="text-xs text-[#525866]">
                {canEditFinances
                  ? 'Ajustá vencimiento, monto o subí la factura.'
                  : 'Consultá vencimientos y facturas en Drive.'}
              </p>
            </div>
            <span className="font-mono-tabular text-base font-bold text-[#111318] shrink-0">
              {MoneyUtils.formatARSCents(summary.serviciosHogarCents)}
            </span>
          </div>
          <div className="mt-4 divide-y divide-[#EEEDE8]">
            {servicesList.map((srv) => (
              <div
                key={srv.id}
                className="flex items-center justify-between gap-2 py-3 text-sm"
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

        {/* Cuotas Fijas Activas */}
        <section
          aria-labelledby="cuotas-fijas-heading"
          className="rounded-2xl border border-[#E4E3DD] bg-white p-5 shadow-[0_1px_2px_rgba(17,19,24,0.03)] sm:p-6"
        >
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2
                id="cuotas-fijas-heading"
                className="font-display text-base font-bold text-[#111318]"
              >
                Cuotas Fijas Activas
              </h2>
              <p className="text-xs text-[#525866]">
                Terminan automáticamente al pagar la última.
              </p>
            </div>
            <span className="font-mono-tabular text-base font-bold text-[#111318] shrink-0">
              {MoneyUtils.formatARSCents(summary.cuotasFijasCents)}
            </span>
          </div>
          <div className="mt-4 divide-y divide-[#EEEDE8]">
            {fixedQuotasList.map((cf) => (
              <div
                key={cf.id}
                className="flex items-center justify-between gap-2 py-3 text-sm"
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
  );
};
