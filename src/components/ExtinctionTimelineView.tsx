import React, { useMemo } from 'react';
import { motion } from 'motion/react';
import {
  ArrowUpRight,
  CalendarCheck2,
  Check,
  CreditCard,
  Paperclip,
  Pencil,
  TrendingDown,
} from 'lucide-react';
import { AppTab, CashFlowMatchResult, ItemFinanciero } from '../types/finance';
import { addMonthsToPeriodo, formatPeriodoLabel } from '../utils/dateUtils';
import { MoneyUtils } from '../utils/moneyUtils';
import { InlineAmountEditor } from './InlineAmountEditor';
import { InlineDateEditor } from './InlineDateEditor';

interface ExtinctionTimelineViewProps {
  matchResult: CashFlowMatchResult;
  periodItems: ItemFinanciero[];
  canEditFinances: boolean;
  onMarkPaid: (item: ItemFinanciero) => void;
  onEditItem: (item: ItemFinanciero) => void;
  onQuickUpdateAmount: (item: ItemFinanciero, newAmount: number) => void;
  onQuickUpdateDates: (
    item: ItemFinanciero,
    updates: { fechaExactaVencimiento?: string; fechaCierre?: string }
  ) => void;
  onOpenReceipts: (item: ItemFinanciero) => void;
  onNavigateTab: (tab: AppTab) => void;
}

interface DynamicMilestone {
  periodoFin: string;
  fechaLabel: string;
  items: Array<{ titulo: string; monto: number; detalle: string }>;
  alivioMensualCents: number;
}

export const ExtinctionTimelineView: React.FC<ExtinctionTimelineViewProps> = ({
  matchResult,
  periodItems,
  canEditFinances,
  onMarkPaid,
  onEditItem,
  onQuickUpdateAmount,
  onQuickUpdateDates,
  onOpenReceipts,
  onNavigateTab,
}) => {
  const extinguishedItems = useMemo(
    () => periodItems.filter((i) => i.estado === 'EXTINGUIDO'),
    [periodItems]
  );

  const fixedQuotas = useMemo(
    () =>
      periodItems
        .filter((i) => i.esCuotaFija && i.estado !== 'EXTINGUIDO')
        .sort((a, b) => {
          const remA = (a.cuotasTotales ?? 1) - (a.cuotaActual ?? 0);
          const remB = (b.cuotasTotales ?? 1) - (b.cuotaActual ?? 0);
          return remA - remB;
        }),
    [periodItems]
  );

  const dynamicMilestones = useMemo(() => {
    const groups = new Map<string, DynamicMilestone>();
    const activePeriodo = matchResult.summary.periodo;

    for (const item of fixedQuotas) {
      const actual = item.cuotaActual ?? 1;
      const total = item.cuotasTotales ?? 1;
      const restantes = Math.max(0, total - actual);
      const lastPeriodo = addMonthsToPeriodo(activePeriodo, restantes);
      const existing = groups.get(lastPeriodo) ?? {
        periodoFin: lastPeriodo,
        fechaLabel: formatPeriodoLabel(lastPeriodo),
        items: [],
        alivioMensualCents: 0,
      };
      existing.items.push({
        titulo: `${item.titulo} (${total}/${total})`,
        monto: item.montoPactado,
        detalle:
          restantes === 0
            ? 'Termina este mes'
            : `Faltan ${restantes} cuota${restantes === 1 ? '' : 's'}`,
      });
      existing.alivioMensualCents += MoneyUtils.toCents(item.montoPactado);
      groups.set(lastPeriodo, existing);
    }

    if (activePeriodo === '2026-12') {
      const patagonia = periodItems.find(
        (i) =>
          i.categoria === 'TARJETA_ROTATIVA' &&
          i.titulo.toLowerCase().includes('patagonia') &&
          MoneyUtils.toCents(i.montoPactado) > 25000000
      );
      if (patagonia) {
        const decGroup = groups.get('2026-12') ?? {
          periodoFin: '2026-12',
          fechaLabel: formatPeriodoLabel('2026-12'),
          items: [],
          alivioMensualCents: 0,
        };
        decGroup.items.push({
          titulo: 'Cuota fija Patagonia ($180k)',
          monto: 180000,
          detalle: 'Deja de cobrarse en Enero 2027',
        });
        decGroup.alivioMensualCents += 18000000;
        groups.set('2026-12', decGroup);
      }
    }

    return Array.from(groups.values())
      .sort((a, b) => a.periodoFin.localeCompare(b.periodoFin))
      .slice(0, 3);
  }, [fixedQuotas, matchResult.summary.periodo, periodItems]);

  const totalCuotasMensualesCents = MoneyUtils.sumCents(
    fixedQuotas.map((q) => MoneyUtils.toCents(q.montoPactado))
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 border-b border-[#D8D6CC] pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#4338CA]">
            Hoja de Ruta de Cuotas Fijas
          </p>
          <h1 className="mt-0.5 font-display text-2xl font-bold tracking-tight text-[#111318] sm:text-3xl">
            Cuotas y Extinción ·{' '}
            {formatPeriodoLabel(matchResult.summary.periodo)}
          </h1>
          <p className="mt-1 text-xs text-[#525866] sm:text-sm">
            Seguimiento exclusivo de planes en cuotas: fechas de liberación mensual y alivio ganado al terminar cada plan.
          </p>
        </div>

        <button
          type="button"
          onClick={() => onNavigateTab('tarjetas')}
          className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl border border-[#DFDDD4] bg-white px-3.5 py-2 text-xs font-semibold text-[#111318] transition-colors hover:bg-[#F7F7F3] whitespace-nowrap shrink-0"
        >
          <CreditCard className="h-3.5 w-3.5 text-[#DC2626]" aria-hidden="true" />
          <span>Ir a Simulador de Tarjetas</span>
          <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>

      {/* Alivio Ganado detalle cuando hay cuotas extinguidas */}
      {extinguishedItems.length > 0 && (
        <section
          aria-labelledby="cuotas-alivio-heading"
          className="overflow-hidden rounded-2xl border border-[#C7D2FE] bg-white shadow-[0_2px_8px_rgba(67,56,202,0.06)]"
        >
          <div className="flex flex-col gap-3 border-b border-[#E0E7FF] bg-[#EEF2FF] px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2
                id="cuotas-alivio-heading"
                className="flex items-center gap-2 font-display text-base font-bold text-[#4338CA]"
              >
                <TrendingDown className="h-4 w-4" aria-hidden="true" />
                Alivio Ganado · Cuotas Ya Finalizadas ({extinguishedItems.length})
              </h2>
              <p className="mt-0.5 text-xs text-[#525866]">
                Planes completamente saldados que ya liberaron presupuesto fijo este mes.
              </p>
            </div>
            <div className="text-left sm:text-right">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[#686E7D]">
                Ahorro mensual liberado
              </p>
              <p className="font-mono-tabular text-xl font-bold text-[#4338CA]">
                +{MoneyUtils.formatARSCents(matchResult.summary.alivioMensualGanadoCents)}/mes
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

      {/* Hitos dinámicos */}
      {dynamicMilestones.length > 0 && (
        <section aria-labelledby="milestones-heading" className="space-y-4">
          <div className="flex items-center gap-3">
            <span className="font-mono-tabular text-[11px] font-bold text-[#1D4ED8]">
              01
            </span>
            <h2
              id="milestones-heading"
              className="font-display text-sm font-bold uppercase tracking-[0.1em] text-[#111318] whitespace-nowrap"
            >
              Próximos Hitos de Liberación
            </h2>
            <div className="h-px flex-1 bg-[#D8D6CC]" aria-hidden="true" />
          </div>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
            {dynamicMilestones.map((m, idx) => (
              <article
                key={m.periodoFin}
                className="flex flex-col justify-between overflow-hidden rounded-2xl border border-[#DFDDD4] bg-white shadow-[0_2px_10px_rgba(17,19,24,0.04)]"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 border-b border-[#E0E7FF] bg-[#F5F3FF] px-5 py-3 text-xs">
                    <span className="font-bold text-[#4338CA]">
                      {m.fechaLabel}
                    </span>
                    <span className="font-medium text-[#686E7D]">
                      {idx === 0 ? 'Próximo hito' : 'Mediano plazo'}
                    </span>
                  </div>
                  <div className="p-5">
                    <h3 className="font-display text-base font-bold text-[#111318]">
                      {m.items.map((it) => it.titulo).join(' + ')}
                    </h3>
                    <ul className="mt-3 space-y-2 text-xs text-[#525866]">
                      {m.items.map((it) => (
                        <li key={it.titulo} className="flex justify-between gap-2">
                          <span className="truncate">{it.detalle}</span>
                          <span className="font-mono-tabular font-semibold text-[#111318] shrink-0">
                            {MoneyUtils.formatARS(it.monto)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
                <div className="flex items-center justify-between border-t border-[#ECEAE2] bg-[#FAF9F6] px-5 py-3.5">
                  <span className="text-xs font-medium text-[#525866]">
                    Plata que se libera
                  </span>
                  <span className="font-mono-tabular text-base font-bold text-[#1D4ED8]">
                    +{MoneyUtils.formatARSCents(m.alivioMensualCents)}/mes
                  </span>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {/* Progreso individual de cuotas fijas */}
      <section aria-labelledby="cuotas-progreso-heading" className="space-y-4">
        <div className="flex items-center gap-3">
          <span className="font-mono-tabular text-[11px] font-bold text-[#1D4ED8]">
            02
          </span>
          <h2
            id="cuotas-progreso-heading"
            className="font-display text-sm font-bold uppercase tracking-[0.1em] text-[#111318] whitespace-nowrap"
          >
            Avance de Cuotas Activas
          </h2>
          <div className="h-px flex-1 bg-[#D8D6CC]" aria-hidden="true" />
        </div>

        <div className="overflow-hidden rounded-2xl border border-[#DFDDD4] bg-white shadow-[0_2px_10px_rgba(17,19,24,0.04)]">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#E7E5DC] bg-[#F7F7F3] px-5 py-4 sm:px-6">
            <span className="flex items-center gap-2 font-display text-base font-bold text-[#111318]">
              <CalendarCheck2
                className="h-4 w-4 text-[#1D4ED8]"
                aria-hidden="true"
              />
              Planes en Cuotas ({fixedQuotas.length})
            </span>
            <span className="font-mono-tabular text-sm font-bold text-[#111318]">
              Total mensual: {MoneyUtils.formatARSCents(totalCuotasMensualesCents)}
            </span>
          </div>

          {fixedQuotas.length === 0 ? (
            <div className="px-6 py-12 text-center text-xs text-[#525866]">
              No quedan cuotas fijas activas pendientes en este período.
            </div>
          ) : (
            <div className="divide-y divide-[#ECEAE2] px-5 sm:px-6">
              {fixedQuotas.map((item) => {
                const actual = item.cuotaActual ?? 1;
                const total = item.cuotasTotales ?? 1;
                const pct = Math.min(100, Math.round((actual / total) * 100));
                const restantes = Math.max(0, total - actual);
                const attachCount = item.adjuntos?.length ?? 0;

                return (
                  <div key={item.id} className="space-y-2.5 py-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-bold text-[#111318]">
                            {item.titulo}
                          </span>
                          <span
                            className={`text-xs font-bold ${
                              item.estado === 'PAGADO'
                                ? 'text-[#1D4ED8]'
                                : 'text-[#B45309]'
                            }`}
                          >
                            · {item.estado}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 font-mono-tabular text-xs text-[#525866]">
                          <span>
                            Cuota {actual}/{total} (
                            {restantes === 0
                              ? 'última cuota'
                              : `faltan ${restantes}`}
                            )
                          </span>
                          <span>·</span>
                          <InlineDateEditor
                            itemTitle={item.titulo}
                            label="Vence"
                            dateISO={item.fechaExactaVencimiento}
                            readOnly={!canEditFinances}
                            onSaveDate={(val) =>
                              onQuickUpdateDates(item, {
                                fechaExactaVencimiento: val,
                              })
                            }
                          />
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 font-mono-tabular sm:justify-end">
                        <div className="flex items-center gap-2">
                          <InlineAmountEditor
                            itemTitle={item.titulo}
                            amount={item.montoPactado}
                            readOnly={!canEditFinances}
                            textClassName="text-sm font-bold text-[#111318]"
                            onSaveAmount={(val) => onQuickUpdateAmount(item, val)}
                          />
                          <span className="text-xs font-bold text-[#4338CA]">
                            {pct}%
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 font-sans">
                          <button
                            type="button"
                            onClick={() => onOpenReceipts(item)}
                            aria-label={`Comprobantes de ${item.titulo}`}
                            className={`inline-flex min-h-[32px] items-center gap-1 rounded-lg border px-2 py-1 text-[11px] ${
                              attachCount > 0
                                ? 'border-[#BFDBFE] bg-[#EFF6FF] text-[#1D4ED8]'
                                : 'border-[#DFDDD4] bg-[#F7F7F3] text-[#525866]'
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
                                onClick={() => onEditItem(item)}
                                aria-label={`Editar todo de ${item.titulo}`}
                                className="inline-flex min-h-[32px] min-w-[32px] items-center justify-center rounded-lg border border-[#DFDDD4] bg-[#F7F7F3] p-1 text-[#525866] hover:text-[#111318]"
                              >
                                <Pencil className="h-3 w-3" aria-hidden="true" />
                              </button>
                              {item.estado === 'PENDIENTE' && (
                                <button
                                  type="button"
                                  onClick={() => onMarkPaid(item)}
                                  aria-label={`Marcar pagado ${item.titulo}`}
                                  className="inline-flex min-h-[32px] items-center gap-1 rounded-lg bg-[#1D4ED8] px-2.5 py-1 text-xs font-semibold text-white hover:bg-[#1E40AF]"
                                >
                                  <Check className="h-3 w-3" aria-hidden="true" />
                                  Pagar
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="h-2 w-full overflow-hidden rounded-full bg-[#ECEAE2]">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                        className={`h-full ${
                          restantes === 0 ? 'bg-[#4338CA]' : 'bg-[#1D4ED8]'
                        }`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
};
