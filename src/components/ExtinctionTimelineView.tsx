import React, { useMemo, useState } from 'react';
import { CalendarCheck2, Pencil, Sparkles, TrendingDown } from 'lucide-react';
import { CashFlowMatchResult, ItemFinanciero } from '../types/finance';
import { addMonthsToPeriodo, formatPeriodoLabel } from '../utils/dateUtils';
import { MoneyUtils } from '../utils/moneyUtils';
import { InlineAmountEditor } from './InlineAmountEditor';
import { InlineDateEditor } from './InlineDateEditor';

interface ExtinctionTimelineViewProps {
  matchResult: CashFlowMatchResult;
  periodItems: ItemFinanciero[];
  canEditFinances: boolean;
  minFoodReserveARS: number;
  onChangeMinFoodReserveARS: (val: number) => void;
  onEditItem: (item: ItemFinanciero) => void;
  onQuickUpdateAmount: (item: ItemFinanciero, newAmount: number) => void;
  onQuickUpdateDates: (
    item: ItemFinanciero,
    updates: { fechaExactaVencimiento?: string; fechaCierre?: string }
  ) => void;
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
  minFoodReserveARS,
  onChangeMinFoodReserveARS,
  onEditItem,
  onQuickUpdateAmount,
  onQuickUpdateDates,
}) => {
  const [cuotasQuita, setCuotasQuita] = useState<1 | 3 | 6 | 9 | 12>(1);

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

  // Hitos dinámicos calculados desde las cuotas activas reales del período
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

    // Incluir caída estimada de $180k de Patagonia en Dic 2026 si sigue activa
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

  const radarQuita = periodItems.find((i) => i.categoria === 'DEUDA_CON_QUITA');
  const contadoCents = MoneyUtils.toCents(
    radarQuita?.montoOfertaQuitaContado ?? 459867.07
  );
  const nominalCents = MoneyUtils.toCents(
    radarQuita?.saldoCapitalTotal ?? 2179464.81
  );

  const recargoPlanPct =
    cuotasQuita === 1
      ? 0
      : cuotasQuita === 3
        ? 8
        : cuotasQuita === 6
          ? 18
          : cuotasQuita === 9
            ? 28
            : 38;
  const totalFinanciadoCents = Math.round(
    contadoCents * (1 + recargoPlanPct / 100)
  );
  const valorCuotaCents = MoneyUtils.divideInstallmentCents(
    totalFinanciadoCents,
    cuotasQuita
  );
  const ahorroVsNominalCents = Math.max(0, nominalCents - totalFinanciadoCents);

  const impactoEnColchonPct =
    matchResult.summary.colchonComidaCents > 0
      ? Math.round(
          (valorCuotaCents / matchResult.summary.colchonComidaCents) * 1000
        ) / 10
      : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-100">
          Cuándo Terminan tus Cuotas · {formatPeriodoLabel(matchResult.summary.periodo)}
        </h1>
        <p className="text-sm text-slate-400">
          Hitos calculados en tiempo real según tus cuotas activas y simulador de cancelación de Mercado Pago.
        </p>
      </div>

      {/* Hitos Dinámicos calculados desde los datos reales */}
      {dynamicMilestones.length > 0 && (
        <section
          aria-labelledby="milestones-heading"
          className="grid grid-cols-1 gap-4 lg:grid-cols-3"
        >
          <h2 id="milestones-heading" className="sr-only">
            Próximos hitos de liberación de caja
          </h2>
          {dynamicMilestones.map((m, idx) => (
            <article
              key={m.periodoFin}
              className="flex flex-col justify-between rounded-xl border border-slate-800 bg-slate-900/90 p-5"
            >
              <div>
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-semibold text-cyan-400">
                    {m.fechaLabel}
                  </span>
                  <span className="text-slate-400">
                    {idx === 0 ? 'Próximo hito' : 'Mediano plazo'}
                  </span>
                </div>
                <h3 className="mt-2 text-base font-semibold text-slate-100">
                  {m.items.map((it) => it.titulo).join(' + ')}
                </h3>
                <ul className="mt-2 space-y-1 text-xs text-slate-400">
                  {m.items.map((it) => (
                    <li key={it.titulo} className="flex justify-between gap-2">
                      <span className="truncate">{it.detalle}</span>
                      <span className="font-mono-tabular text-slate-300 shrink-0">
                        {MoneyUtils.formatARS(it.monto)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="mt-4 flex items-center justify-between border-t border-slate-800 pt-3">
                <span className="text-xs text-slate-400">
                  Plata que se libera
                </span>
                <span className="text-base font-bold text-emerald-400 font-mono-tabular">
                  +{MoneyUtils.formatARSCents(m.alivioMensualCents)}/mes
                </span>
              </div>
            </article>
          ))}
        </section>
      )}

      {/* Progreso Individual de Cuotas Fijas */}
      <section
        aria-labelledby="cuotas-progreso-heading"
        className="rounded-xl border border-slate-800 bg-slate-900/90 p-5"
      >
        <div className="flex items-center justify-between gap-4">
          <h2
            id="cuotas-progreso-heading"
            className="flex items-center gap-2 text-base font-semibold text-slate-100"
          >
            <CalendarCheck2 className="h-4 w-4 text-cyan-400" aria-hidden="true" />
            Cuotas Activas ({fixedQuotas.length})
          </h2>
          <span className="text-xs text-slate-400">
            Editá vencimiento, cuota o monto directo
          </span>
        </div>

        <div className="mt-4 divide-y divide-slate-800/80">
          {fixedQuotas.map((item) => {
            const actual = item.cuotaActual ?? 1;
            const total = item.cuotasTotales ?? 1;
            const pct = Math.min(100, Math.round((actual / total) * 100));
            const restantes = Math.max(0, total - actual);

            return (
              <div key={item.id} className="py-4 space-y-2">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-semibold text-slate-100">
                        {item.titulo}
                      </span>
                      {canEditFinances && (
                        <button
                          type="button"
                          onClick={() => onEditItem(item)}
                          aria-label={`Editar todo de ${item.titulo}`}
                          className="rounded p-0.5 text-slate-500 hover:text-emerald-400"
                        >
                          <Pencil className="h-3 w-3" aria-hidden="true" />
                        </button>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 font-mono-tabular">
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
                  <div className="flex items-center gap-2 font-mono-tabular">
                    <InlineAmountEditor
                      itemTitle={item.titulo}
                      amount={item.montoPactado}
                      readOnly={!canEditFinances}
                      textClassName="text-sm font-bold text-slate-100"
                      onSaveAmount={(val) => onQuickUpdateAmount(item, val)}
                    />
                    <span className="text-xs text-cyan-400">{pct}%</span>
                  </div>
                </div>

                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
                  <div
                    className={`h-full transition-all duration-300 ${
                      restantes === 0 ? 'bg-cyan-400' : 'bg-emerald-400'
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Simulador de Quita Mercado Pago + Reserva de Comida Configurable */}
      <section
        aria-labelledby="simulador-mp-heading"
        className="rounded-xl border border-slate-800 bg-slate-900/90 p-5"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2
              id="simulador-mp-heading"
              className="flex items-center gap-2 text-base font-semibold text-slate-100"
            >
              <Sparkles className="h-4 w-4 text-cyan-400" aria-hidden="true" />
              Simulador Cancelación Mercado Pago
            </h2>
            <p className="text-xs text-slate-400">
              Compará pagar al contado con quita o en cuotas, protegiendo tu mínimo mensual de comida.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-950 px-3 py-1.5 text-xs">
              <label
                htmlFor="min-food-reserve-input"
                className="text-slate-400 whitespace-nowrap"
              >
                Mínimo comida:
              </label>
              <input
                id="min-food-reserve-input"
                type="number"
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
                className="w-24 bg-transparent text-right font-semibold text-emerald-400 font-mono-tabular focus:outline-none disabled:opacity-70"
              />
            </div>

            <div className="flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-950 p-1">
              {([1, 3, 6, 9, 12] as const).map((plan) => (
                <button
                  key={plan}
                  type="button"
                  onClick={() => setCuotasQuita(plan)}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                    cuotasQuita === plan
                      ? 'bg-cyan-500/20 text-cyan-300'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {plan === 1 ? 'Contado' : `${plan}c`}
                </button>
              ))}
            </div>
          </div>
        </div>

        <p className="mt-3 rounded-lg border border-slate-800 bg-slate-950/70 px-3.5 py-2.5 text-xs text-slate-300">
          {matchResult.simuladorExcedente.recomendacionTexto}
        </p>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-4">
            <p className="text-xs text-slate-400">Deuda Original</p>
            <p className="mt-1 text-lg font-bold text-slate-400 line-through font-mono-tabular">
              {MoneyUtils.formatARSCents(nominalCents)}
            </p>
          </div>

          <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-4">
            <p className="text-xs text-slate-400">
              {cuotasQuita === 1
                ? 'Pago Único Contado'
                : `Total en ${cuotasQuita} cuotas (+${recargoPlanPct}%)`}
            </p>
            <p className="mt-1 text-lg font-bold text-cyan-400 font-mono-tabular">
              {MoneyUtils.formatARSCents(totalFinanciadoCents)}
            </p>
          </div>

          <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-4">
            <p className="text-xs text-slate-400">Valor por Cuota</p>
            <p className="mt-1 text-lg font-bold text-slate-100 font-mono-tabular">
              {MoneyUtils.formatARSCents(valorCuotaCents)}
            </p>
            <p className="mt-0.5 text-[11px] text-slate-400 font-mono-tabular">
              {impactoEnColchonPct}% de tu plata libre para comida
            </p>
          </div>

          <div className="rounded-lg border border-emerald-500/30 bg-slate-950/60 p-4">
            <p className="text-xs text-emerald-300">Ahorro Neto</p>
            <p className="mt-1 flex items-center gap-1.5 text-lg font-bold text-emerald-400 font-mono-tabular">
              <TrendingDown className="h-4 w-4" aria-hidden="true" />
              {MoneyUtils.formatARSCents(ahorroVsNominalCents)}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};
