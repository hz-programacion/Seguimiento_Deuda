import React from 'react';
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
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
import { formatPeriodoLabel, formatShortDateAR } from '../utils/dateUtils';
import { MoneyUtils } from '../utils/moneyUtils';
import { isIncomeCategory } from '../utils/cashFlowMatcher';
import { InlineAmountEditor } from './InlineAmountEditor';
import { InlineDateEditor } from './InlineDateEditor';

interface DashboardBentoProps {
  matchResult: CashFlowMatchResult;
  periodItems: ItemFinanciero[];
  canEditFinances: boolean;
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

function getPriorityLabel(p: PrioridadPago): {
  text: string;
  className: string;
} {
  if (p === 'CRITICA') {
    return { text: 'Urgente', className: 'text-rose-400' };
  }
  if (p === 'ALTA') {
    return { text: 'Pronto', className: 'text-amber-400' };
  }
  return { text: 'Programado', className: 'text-slate-400' };
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
        compact ? 'px-1.5 py-0.5 text-[11px]' : 'px-1.5 py-1 text-[11px]'
      } ${
        count > 0
          ? 'border-cyan-500/40 bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/20'
          : 'border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700 hover:text-slate-100'
      }`}
    >
      <Paperclip className="h-3 w-3" aria-hidden="true" />
      {count > 0 && (
        <span className="font-mono-tabular font-semibold">{count}</span>
      )}
    </button>
  );
};

function getBankingBadge(status: BankingPaymentStatus): {
  text: string;
  className: string;
} {
  if (status === 'PAGAR_AHORA') {
    return {
      text: 'Pagar ahora',
      className:
        'border border-emerald-500/35 bg-emerald-500/10 text-emerald-300',
    };
  }
  if (status === 'ESPERAR_CIERRE') {
    return {
      text: 'Esperar cierre',
      className: 'border border-cyan-500/35 bg-cyan-500/10 text-cyan-300',
    };
  }
  if (status === 'EXCEDE_TOPE_COMIDA') {
    return {
      text: 'Excede tope comida',
      className: 'border border-amber-500/35 bg-amber-500/10 text-amber-300',
    };
  }
  return {
    text: 'Pagado',
    className: 'border border-slate-700 bg-slate-800 text-slate-300',
  };
}

export const DashboardBento: React.FC<DashboardBentoProps> = ({
  matchResult,
  periodItems,
  canEditFinances,
  onMarkPaid,
  onEditItem,
  onQuickUpdateAmount,
  onQuickUpdateCapital,
  onQuickUpdateDates,
  onOpenReceipts,
  onNavigateTab,
}) => {
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

  return (
    <div className="space-y-6">
      {/* Encabezado contextual */}
      <div className="flex flex-col gap-1.5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-100">
            Resumen · {formatPeriodoLabel(summary.periodo)}
          </h1>
          <p className="text-sm text-slate-400">
            {canEditFinances
              ? 'Tocá cualquier fecha, monto o el clip para adjuntar resúmenes y comprobantes en Drive.'
              : 'Vista protegida de solo lectura: podés consultar vencimientos y subir resúmenes o comprobantes en Google Drive.'}
          </p>
        </div>
        <div className="text-xs text-slate-400 font-mono-tabular">
          {colaPrioridad.length} pagos pendientes ·{' '}
          <span className="text-slate-200 font-semibold">
            {MoneyUtils.formatARSCents(summary.totalPendienteCents)}
          </span>{' '}
          por abonar
        </div>
      </div>

      {/* Alerta Temprana de Descalce Quincenal */}
      {alertaDescalce.hayDescalce && (
        <div
          role="alert"
          className="flex flex-col gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle
              className="mt-0.5 h-5 w-5 shrink-0 text-amber-400"
              aria-hidden="true"
            />
            <div className="space-y-1">
              <p className="text-sm font-semibold text-amber-300">
                Falta plata en la 1° Quincena (Días 01 al 14)
              </p>
              <p className="text-xs text-amber-200/90 leading-relaxed">
                {alertaDescalce.mensaje}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onNavigateTab('quincenas')}
            className="inline-flex items-center gap-1.5 rounded-lg border border-amber-400/40 bg-slate-950/60 px-3 py-2 text-xs font-semibold text-amber-300 hover:bg-slate-900 whitespace-nowrap shrink-0"
          >
            Ver Quincenas
            <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      )}

      {/* 4 KPIs Principales */}
      <div
        data-testid="kpi-grid"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        {/* KPI 1: Ingresos Totales */}
        <article className="flex flex-col justify-between rounded-xl border border-slate-800/90 bg-slate-900/75 p-5 transition-colors hover:border-slate-700/90">
          <div>
            <p className="text-xs font-medium text-slate-400">
              Ingresos del Mes
            </p>
            <p
              data-testid="kpi-ingresos"
              className="mt-2 text-2xl font-bold tracking-tight text-emerald-400 font-mono-tabular"
            >
              {MoneyUtils.formatARSCents(summary.ingresosTotalesCents)}
            </p>
          </div>
          <div className="mt-3.5 border-t border-slate-800/80 pt-2.5 text-[11px] text-slate-400 font-mono-tabular">
            Base {MoneyUtils.formatCompactCents(summary.ingresosHabitualesCents)}
            {summary.ingresosSacCents > 0
              ? ` · SAC +${MoneyUtils.formatCompactCents(summary.ingresosSacCents)}`
              : ''}
          </div>
        </article>

        {/* KPI 2: Obligaciones Fijas Totales (Micro-grid sin truncamiento) */}
        <article className="flex flex-col justify-between rounded-xl border border-slate-800/90 bg-slate-900/75 p-5 transition-colors hover:border-slate-700/90">
          <div>
            <p className="text-xs font-medium text-slate-400">
              Gastos y Deudas Fijas
            </p>
            <p
              data-testid="kpi-obligaciones"
              className="mt-2 text-2xl font-bold tracking-tight text-slate-100 font-mono-tabular"
            >
              {MoneyUtils.formatARSCents(summary.obligacionesFijasTotalesCents)}
            </p>
          </div>
          <div
            data-testid="kpi-obligaciones-desglose"
            className="mt-3.5 grid grid-cols-3 gap-2 border-t border-slate-800/80 pt-2.5 text-[11px] font-mono-tabular"
          >
            <div>
              <span className="block text-[10px] font-sans text-slate-500">
                Serv.
              </span>
              <span className="font-medium text-slate-300">
                {MoneyUtils.formatCompactCents(summary.serviciosHogarCents)}
              </span>
            </div>
            <div>
              <span className="block text-[10px] font-sans text-slate-500">
                Cuotas
              </span>
              <span className="font-medium text-slate-300">
                {MoneyUtils.formatCompactCents(summary.cuotasFijasCents)}
              </span>
            </div>
            <div>
              <span className="block text-[10px] font-sans text-slate-500">
                Tarj.
              </span>
              <span className="font-medium text-rose-300">
                {MoneyUtils.formatCompactCents(summary.tarjetasTotalesCents)}
              </span>
            </div>
          </div>
        </article>

        {/* KPI 3: Avance de Pagos */}
        <article className="flex flex-col justify-between rounded-xl border border-slate-800/90 bg-slate-900/75 p-5 transition-colors hover:border-slate-700/90">
          <div>
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-medium text-slate-400">
                Ya Pagado Este Mes
              </p>
              <span
                data-testid="kpi-avance-pct"
                className="text-xs font-semibold text-amber-400 font-mono-tabular"
              >
                {summary.porcentajeAvance.toFixed(1)}%
              </span>
            </div>
            <p
              data-testid="kpi-pagado"
              className="mt-2 text-2xl font-bold tracking-tight text-slate-100 font-mono-tabular"
            >
              {MoneyUtils.formatARSCents(summary.totalPagadoCents)}
            </p>
            <div
              className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-800"
              role="progressbar"
              aria-valuenow={summary.porcentajeAvance}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Porcentaje de obligaciones pagadas"
            >
              <div
                className="h-full bg-emerald-400 transition-all duration-300"
                style={{ width: `${summary.porcentajeAvance}%` }}
              />
            </div>
          </div>
          <div className="mt-2.5 border-t border-slate-800/80 pt-2.5 text-[11px] text-slate-400 font-mono-tabular">
            Falta pagar {MoneyUtils.formatARSCents(summary.totalPendienteCents)}
          </div>
        </article>

        {/* KPI 4: Caja Libre Protegida para Comida */}
        <article className="flex flex-col justify-between rounded-xl border border-emerald-500/40 bg-emerald-950/15 p-5 transition-colors hover:border-emerald-500/60">
          <div>
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold text-emerald-300">
                Plata Libre para Comida
              </p>
              <ShieldCheck
                className="h-4 w-4 text-emerald-400 shrink-0"
                aria-hidden="true"
              />
            </div>
            <p
              data-testid="kpi-colchon-comida"
              className={`mt-2 text-2xl font-bold tracking-tight font-mono-tabular ${
                summary.colchonComidaCents >= 0
                  ? 'text-emerald-400'
                  : 'text-rose-500'
              }`}
            >
              {MoneyUtils.formatARSCents(summary.colchonComidaCents)}
            </p>
          </div>
          <div className="mt-3.5 border-t border-emerald-500/20 pt-2.5 text-[11px] text-slate-300">
            Disponible real después de pagar todas las cuentas.
          </div>
        </article>
      </div>

      {/* Sección Alivio Ganado / Cuotas Extinguidas */}
      {extinguishedItems.length > 0 && (
        <section
          aria-labelledby="alivio-ganado-heading"
          data-testid="alivio-ganado-section"
          className="rounded-xl border border-cyan-500/40 bg-slate-900/80 p-5"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2
                id="alivio-ganado-heading"
                className="flex items-center gap-2 text-base font-semibold text-cyan-300"
              >
                <TrendingDown className="h-4 w-4" aria-hidden="true" />
                Alivio Ganado · Cuotas Finalizadas
              </h2>
              <p className="mt-1 text-xs text-slate-400">
                Cuotas que ya terminaron y dejan más plata libre todos los meses.
              </p>
            </div>
            <div className="text-left sm:text-right">
              <p className="text-xs text-slate-400">Ahorro mensual liberado</p>
              <p className="text-xl font-bold text-cyan-400 font-mono-tabular">
                +{MoneyUtils.formatARSCents(summary.alivioMensualGanadoCents)}/mes
              </p>
            </div>
          </div>

          <div className="mt-4 divide-y divide-slate-800 border-t border-slate-800">
            {extinguishedItems.map((ext) => (
              <div
                key={ext.id}
                className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="text-sm font-medium text-slate-100">
                    {ext.titulo}
                  </p>
                  <p className="text-xs text-slate-400">
                    {ext.notas ??
                      `Finalizada en cuota ${ext.cuotaActual}/${ext.cuotasTotales}`}
                  </p>
                </div>
                <div className="text-xs font-semibold text-cyan-400 font-mono-tabular">
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

      {/* Bento Grid Principal */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Qué pagar primero este mes (7 cols) */}
        <section
          aria-labelledby="priority-queue-heading"
          className="rounded-xl border border-slate-800/90 bg-slate-900/75 p-5 lg:col-span-7"
        >
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2
                id="priority-queue-heading"
                className="text-base font-semibold text-slate-100"
              >
                Qué Pagar Primero Este Mes
              </h2>
              <p className="text-xs text-slate-400">
                Motor bancario al {formatShortDateAR(referenceDateISO)}: protege tu mínimo de comida y bloquea pagos antes del cierre.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab('checklist')}
              className="text-xs font-medium text-emerald-400 hover:text-emerald-300 whitespace-nowrap shrink-0"
            >
              Ver lista completa
            </button>
          </div>

          {/* Tope seguro de pagos por quincena resguardando comida */}
          <div className="mt-4 grid grid-cols-1 gap-2.5 rounded-lg border border-slate-800/80 bg-slate-950/60 p-3 text-xs sm:grid-cols-2">
            <div>
              <span className="text-slate-400">Tope pagable 1°Q (sin comida):</span>{' '}
              <span className="font-mono-tabular font-semibold text-emerald-400">
                {MoneyUtils.formatARSCents(q1.presupuestoPagableSinComidaCents)}
              </span>
              <span className="block text-[11px] text-slate-500 font-mono-tabular">
                Recomendado hoy: {MoneyUtils.formatARSCents(q1.totalRecomendadoAhoraCents)}
              </span>
            </div>
            <div>
              <span className="text-slate-400">Tope pagable 2°Q (sin comida):</span>{' '}
              <span className="font-mono-tabular font-semibold text-emerald-400">
                {MoneyUtils.formatARSCents(q2.presupuestoPagableSinComidaCents)}
              </span>
              <span className="block text-[11px] text-slate-500 font-mono-tabular">
                Recomendado hoy: {MoneyUtils.formatARSCents(q2.totalRecomendadoAhoraCents)}
                {pagosPostergadosPorComida.length > 0
                  ? ` · ${pagosPostergadosPorComida.length} excede(n) tope`
                  : ''}
              </span>
            </div>
          </div>

          {colaPrioridad.length === 0 ? (
            <div className="mt-6 flex flex-col items-center justify-center rounded-lg border border-slate-800/80 py-10 text-center">
              <CheckCircle2
                className="h-8 w-8 text-emerald-400"
                aria-hidden="true"
              />
              <p className="mt-2 text-sm font-medium text-slate-200">
                Todas las cuentas de este mes están pagadas
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Podés pasar al mes siguiente desde la barra superior.
              </p>
            </div>
          ) : (
            <div className="mt-4 divide-y divide-slate-800/80">
              {colaPrioridad.slice(0, 8).map((alloc) => {
                const badge = getPriorityLabel(alloc.prioridad);
                const bankBadge = getBankingBadge(alloc.bankingStatus);
                const ob = alloc.obligacion;
                return (
                  <div
                    key={ob.id}
                    className="flex flex-col gap-3 py-3.5 sm:flex-row sm:items-start sm:justify-between"
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-1.5 text-xs">
                        <span
                          className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${bankBadge.className}`}
                        >
                          {bankBadge.text}
                        </span>
                        <span className={`font-semibold ${badge.className}`}>
                          {badge.text}
                        </span>
                        <span aria-hidden="true" className="text-slate-600">
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
                        {alloc.fechaLimiteRecomendadaISO !== ob.fechaExactaVencimiento && (
                          <span className="text-[11px] font-semibold text-amber-300 font-mono-tabular">
                            · Límite hábil {formatShortDateAR(alloc.fechaLimiteRecomendadaISO)}
                          </span>
                        )}
                        <span aria-hidden="true" className="text-slate-600">
                          ·
                        </span>
                        <span className="text-slate-400">
                          {ob.bolsilloResponsable}
                        </span>
                        {ob.editadoManualmente && (
                          <span className="text-cyan-400">· Ajustado</span>
                        )}
                      </div>
                      <p className="truncate text-sm font-semibold text-slate-100">
                        {ob.titulo}
                        {ob.esCuotaFija && ob.cuotaActual && ob.cuotasTotales
                          ? ` (${ob.cuotaActual}/${ob.cuotasTotales})`
                          : ''}
                      </p>
                      <p className="text-xs text-slate-400">
                        {alloc.razonPrioridad}
                      </p>
                      {alloc.avisoBancario && (
                        <p className="rounded border border-slate-800 bg-slate-950/70 px-2.5 py-1.5 text-[11px] leading-relaxed text-slate-300">
                          {alloc.avisoBancario}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-2 sm:justify-end shrink-0 pt-0.5">
                      <InlineAmountEditor
                        itemTitle={ob.titulo}
                        amount={ob.montoPactado}
                        readOnly={!canEditFinances}
                        textClassName="text-sm font-bold text-slate-100"
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
                            className="rounded-md border border-slate-800 bg-slate-950 p-1.5 text-slate-400 hover:border-slate-700 hover:text-slate-100"
                          >
                            <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onMarkPaid(ob)}
                            aria-label={`Marcar pagado ${ob.titulo}`}
                            className="rounded-lg bg-emerald-500/15 px-3 py-1.5 text-xs font-semibold text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/25 transition-colors whitespace-nowrap"
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
          )}
        </section>

        {/* Columna derecha: Tarjetas bloqueadas + Tarjetas de Crédito + Radar Quita (5 cols) */}
        <div className="space-y-6 lg:col-span-5">
          {tarjetasBloqueadasPorCierre.length > 0 && (
            <section
              aria-labelledby="bloqueadas-cierre-heading"
              className="rounded-xl border border-cyan-500/35 bg-cyan-950/15 p-4"
            >
              <h2
                id="bloqueadas-cierre-heading"
                className="flex items-center gap-2 text-sm font-semibold text-cyan-300"
              >
                <Clock className="h-4 w-4 shrink-0" aria-hidden="true" />
                No Pagar Antes del Cierre (Anti-Doble-Pago)
              </h2>
              <p className="mt-1 text-xs text-slate-300 leading-relaxed">
                Abonar antes del cierre solo amortiza deuda y no cancela el Pago Mínimo del resumen que cierra. Esperá la ventana válida:
              </p>
              <div className="mt-3 space-y-2">
                {tarjetasBloqueadasPorCierre.map((b) => (
                  <div
                    key={b.obligacion.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-cyan-500/25 bg-slate-950/70 px-3 py-2 text-xs"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-slate-100">
                        {b.obligacion.titulo}
                      </p>
                      <p className="text-[11px] text-cyan-300 font-mono-tabular">
                        Cierre {formatShortDateAR(b.obligacion.fechaCierre!)} · Pagar del{' '}
                        {formatShortDateAR(b.ventanaPagoDesdeISO!)} al{' '}
                        {formatShortDateAR(b.fechaLimiteRecomendadaISO)}
                      </p>
                    </div>
                    <span className="font-mono-tabular font-semibold text-slate-200 shrink-0">
                      {MoneyUtils.formatARS(b.obligacion.montoPactado)}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Tarjetas con Cierre, Vencimiento, Pago Mínimo y Deuda Total editables */}
          <section
            aria-labelledby="tarjetas-resumen-heading"
            className="rounded-xl border border-slate-800/90 bg-slate-900/75 p-5"
          >
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2
                  id="tarjetas-resumen-heading"
                  className="flex items-center gap-2 text-base font-semibold text-slate-100"
                >
                  <CreditCard className="h-4 w-4 text-rose-400" aria-hidden="true" />
                  Tarjetas de Crédito
                </h2>
                <p className="text-xs text-slate-400">
                  {canEditFinances
                    ? 'Editá Cierre, Vence, Pago Mínimo, Deuda total o subí el resumen PDF.'
                    : 'Consultá cierres, vencimientos y subí los resúmenes PDF en Drive.'}
                </p>
              </div>
              <span className="text-sm font-bold text-rose-400 font-mono-tabular shrink-0">
                {MoneyUtils.formatARSCents(summary.tarjetasTotalesCents)}
              </span>
            </div>

            <div className="mt-4 divide-y divide-slate-800/80">
              {/* Tarjeta Carrefour Agrupada */}
              {carrefourItems.length > 0 && (
                <div className="py-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-slate-100">
                        Tarjeta Carrefour
                      </p>
                      <p className="text-xs text-slate-400">
                        Suma de cuotas activas del resumen
                      </p>
                    </div>
                    <span className="text-sm font-bold text-slate-100 font-mono-tabular">
                      {MoneyUtils.formatARSCents(carrefourTotalCents)}
                    </span>
                  </div>
                  <div className="mt-2.5 space-y-2.5 border-t border-slate-800/70 pt-2.5 pl-2">
                    {carrefourItems.map((sub) => (
                      <div key={sub.id} className="space-y-1 text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="truncate font-medium text-slate-200">
                              {sub.titulo}{' '}
                              <span className="text-cyan-400 font-mono-tabular">
                                {sub.cuotaActual}/{sub.cuotasTotales}
                              </span>
                            </span>
                            {sub.editadoManualmente && (
                              <span className="text-[11px] text-cyan-400 shrink-0">
                                · Ajustado
                              </span>
                            )}
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
                                className="rounded p-0.5 text-slate-500 hover:text-emerald-400"
                              >
                                <Pencil className="h-3 w-3" aria-hidden="true" />
                              </button>
                            )}
                          </div>
                          <InlineAmountEditor
                            itemTitle={sub.titulo}
                            amount={sub.montoPactado}
                            readOnly={!canEditFinances}
                            textClassName="text-xs font-medium text-slate-200"
                            onSaveAmount={(val) => onQuickUpdateAmount(sub, val)}
                          />
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
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
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tarjetas Rotativas */}
              {rotatingCards.map((card) => (
                <div key={card.id} className="py-3 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="truncate text-sm font-semibold text-slate-100">
                        {card.titulo}
                      </span>
                      {card.editadoManualmente && (
                        <span className="text-[11px] text-cyan-400 shrink-0">
                          · Ajustado
                        </span>
                      )}
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
                          className="rounded p-1 text-slate-500 hover:bg-slate-800 hover:text-emerald-400 shrink-0"
                        >
                          <Pencil className="h-3 w-3" aria-hidden="true" />
                        </button>
                      )}
                    </div>
                    <InlineAmountEditor
                      itemTitle={card.titulo}
                      amount={card.montoPactado}
                      readOnly={!canEditFinances}
                      textClassName="text-sm font-bold text-rose-400"
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
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400 font-mono-tabular">
                    <div className="flex items-center gap-1">
                      <span className="font-sans">Deuda total:</span>
                      <InlineAmountEditor
                        itemTitle={`deuda total de ${card.titulo}`}
                        amount={card.saldoCapitalTotal ?? 0}
                        readOnly={!canEditFinances}
                        textClassName="text-xs font-semibold text-slate-200"
                        onSaveAmount={(val) => onQuickUpdateCapital(card, val)}
                      />
                    </div>
                    <span
                      className={
                        card.estado === 'PAGADO'
                          ? 'text-emerald-400 font-semibold'
                          : 'text-amber-400 font-semibold'
                      }
                    >
                      {card.estado}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Radar de Oportunidad & Simulador de Excedente */}
          <section
            aria-labelledby="radar-oportunidad-heading"
            className="rounded-xl border border-slate-800/90 bg-slate-900/75 p-5"
          >
            <div className="flex items-center justify-between gap-2">
              <h2
                id="radar-oportunidad-heading"
                className="flex items-center gap-2 text-base font-semibold text-slate-100"
              >
                <Sparkles className="h-4 w-4 text-cyan-400" aria-hidden="true" />
                Oferta Quita Mercado Pago
              </h2>
              <button
                type="button"
                onClick={() => onNavigateTab('extincion')}
                className="text-xs font-medium text-cyan-400 hover:text-cyan-300"
              >
                Ver cuotas
              </button>
            </div>

            {radarQuita && (
              <div className="mt-3 space-y-3">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-xs text-slate-400">
                    Deuda original sin descuento
                  </span>
                  <span className="text-xs text-slate-400 line-through font-mono-tabular">
                    {MoneyUtils.formatARS(radarQuita.saldoCapitalTotal ?? 0)}
                  </span>
                </div>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-medium text-slate-200">
                    Pago contado ({radarQuita.porcentajeQuita ?? 78.9}% OFF)
                  </span>
                  <span className="text-lg font-bold text-cyan-400 font-mono-tabular">
                    {MoneyUtils.formatARS(
                      radarQuita.montoOfertaQuitaContado ?? 0
                    )}
                  </span>
                </div>
                <p className="rounded-lg border border-slate-800 bg-slate-950/70 p-3 text-xs leading-relaxed text-slate-300">
                  {simuladorExcedente.recomendacionTexto}
                </p>
              </div>
            )}
          </section>
        </div>
      </div>

      {/* Desglose Inferior Editable: Ingresos, Servicios del Hogar y Cuotas Fijas */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Ingresos Editables del Mes */}
        <section
          aria-labelledby="ingresos-mes-heading"
          className="rounded-xl border border-slate-800/90 bg-slate-900/75 p-5"
        >
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2
                id="ingresos-mes-heading"
                className="text-base font-semibold text-slate-100"
              >
                Ingresos del Mes
              </h2>
              <p className="text-xs text-slate-400">
                Tocá fecha o monto para actualizar cobros.
              </p>
            </div>
            <span className="text-base font-bold text-emerald-400 font-mono-tabular shrink-0">
              {MoneyUtils.formatARSCents(summary.ingresosTotalesCents)}
            </span>
          </div>
          <div className="mt-4 divide-y divide-slate-800/80">
            {incomesList.map((inc) => (
              <div
                key={inc.id}
                className="flex items-center justify-between gap-2 py-2.5 text-sm"
              >
                <div className="min-w-0 space-y-0.5">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate font-medium text-slate-200">
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
                        className="rounded p-0.5 text-slate-500 hover:text-emerald-400 shrink-0"
                      >
                        <Pencil className="h-3 w-3" aria-hidden="true" />
                      </button>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-400">
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
                    {inc.editadoManualmente && (
                      <span className="text-cyan-400">· Ajustado</span>
                    )}
                  </div>
                </div>
                <InlineAmountEditor
                  itemTitle={inc.titulo}
                  amount={inc.montoPactado}
                  prefix="+"
                  readOnly={!canEditFinances}
                  textClassName="text-sm font-semibold text-emerald-400"
                  onSaveAmount={(val) => onQuickUpdateAmount(inc, val)}
                />
              </div>
            ))}
          </div>
        </section>

        {/* Servicios Básicos del Hogar */}
        <section
          aria-labelledby="servicios-heading"
          className="rounded-xl border border-slate-800/90 bg-slate-900/75 p-5"
        >
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2
                id="servicios-heading"
                className="text-base font-semibold text-slate-100"
              >
                Servicios del Hogar
              </h2>
              <p className="text-xs text-slate-400">
                {canEditFinances
                  ? 'Ajustá vencimiento, monto o subí la factura.'
                  : 'Consultá vencimientos y facturas en Drive.'}
              </p>
            </div>
            <span className="text-base font-bold text-slate-100 font-mono-tabular shrink-0">
              {MoneyUtils.formatARSCents(summary.serviciosHogarCents)}
            </span>
          </div>
          <div className="mt-4 divide-y divide-slate-800/80">
            {servicesList.map((srv) => (
              <div
                key={srv.id}
                className="flex items-center justify-between gap-2 py-2.5 text-sm"
              >
                <div className="min-w-0 space-y-0.5">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate font-medium text-slate-200">
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
                        className="rounded p-0.5 text-slate-500 hover:text-emerald-400 shrink-0"
                      >
                        <Pencil className="h-3 w-3" aria-hidden="true" />
                      </button>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-400">
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
                          ? 'text-emerald-400'
                          : 'text-amber-400'
                      }
                    >
                      · {srv.estado}
                    </span>
                    {srv.editadoManualmente && (
                      <span className="text-cyan-400">· Ajustado</span>
                    )}
                  </div>
                </div>
                <InlineAmountEditor
                  itemTitle={srv.titulo}
                  amount={srv.montoPactado}
                  readOnly={!canEditFinances}
                  textClassName="text-sm font-semibold text-slate-100"
                  onSaveAmount={(val) => onQuickUpdateAmount(srv, val)}
                />
              </div>
            ))}
          </div>
        </section>

        {/* Cuotas Fijas */}
        <section
          aria-labelledby="cuotas-fijas-heading"
          className="rounded-xl border border-slate-800/90 bg-slate-900/75 p-5"
        >
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2
                id="cuotas-fijas-heading"
                className="text-base font-semibold text-slate-100"
              >
                Cuotas Fijas Activas
              </h2>
              <p className="text-xs text-slate-400">
                Terminan automáticamente al pagar la última.
              </p>
            </div>
            <span className="text-base font-bold text-slate-100 font-mono-tabular shrink-0">
              {MoneyUtils.formatARSCents(summary.cuotasFijasCents)}
            </span>
          </div>
          <div className="mt-4 divide-y divide-slate-800/80">
            {fixedQuotasList.map((cf) => (
              <div
                key={cf.id}
                className="flex items-center justify-between gap-2 py-2.5 text-sm"
              >
                <div className="min-w-0 space-y-0.5">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate font-medium text-slate-200">
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
                        className="rounded p-0.5 text-slate-500 hover:text-emerald-400 shrink-0"
                      >
                        <Pencil className="h-3 w-3" aria-hidden="true" />
                      </button>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-400 font-mono-tabular">
                    <span>
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
                    {cf.editadoManualmente && (
                      <span className="font-sans text-cyan-400">· Ajustado</span>
                    )}
                  </div>
                </div>
                <InlineAmountEditor
                  itemTitle={cf.titulo}
                  amount={cf.montoPactado}
                  readOnly={!canEditFinances}
                  textClassName="text-sm font-semibold text-slate-100"
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
