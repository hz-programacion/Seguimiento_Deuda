import React, { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { CalendarCheck2, Pencil, Sparkles } from 'lucide-react';
import { CashFlowMatchResult, ItemFinanciero } from '../types/finance';
import { addMonthsToPeriodo, formatPeriodoLabel } from '../utils/dateUtils';
import { estimateMonthlyCardInterestCents } from '../utils/cashFlowMatcher';
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
  const [extraCapitalSimARS, setExtraCapitalSimARS] = useState<number>(500000);

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

  const patagoniaCard = periodItems.find(
    (i) =>
      i.categoria === 'TARJETA_ROTATIVA' &&
      i.titulo.toLowerCase().includes('patagonia')
  );
  const mutualCard = periodItems.find(
    (i) =>
      i.categoria === 'TARJETA_ROTATIVA' &&
      i.titulo.toLowerCase().includes('mutual')
  );

  const patCapARS = patagoniaCard?.saldoCapitalTotal ?? 1258815.9;
  const patTna = patagoniaCard?.tnaEstimada ?? 105;
  const patNewCapitalARS = Math.max(0, patCapARS - extraCapitalSimARS);
  const patMonthlyIntBefore = estimateMonthlyCardInterestCents(patCapARS, patTna);
  const patMonthlyIntAfter = estimateMonthlyCardInterestCents(
    patNewCapitalARS,
    patTna
  );
  const patMonthlyIntSaved = Math.max(
    0,
    patMonthlyIntBefore - patMonthlyIntAfter
  );

  const mutualCapARS = mutualCard?.saldoCapitalTotal ?? 771476.6;
  const mutualTna = mutualCard?.tnaEstimada ?? 98.5;
  const mutualNewCapitalARS = Math.max(0, mutualCapARS - extraCapitalSimARS);
  const mutualMonthlyIntBefore = estimateMonthlyCardInterestCents(
    mutualCapARS,
    mutualTna
  );
  const mutualMonthlyIntAfter = estimateMonthlyCardInterestCents(
    mutualNewCapitalARS,
    mutualTna
  );
  const mutualMonthlyIntSaved = Math.max(
    0,
    mutualMonthlyIntBefore - mutualMonthlyIntAfter
  );

  const totalCuotasMensualesCents = MoneyUtils.sumCents(
    fixedQuotas.map((q) => MoneyUtils.toCents(q.montoPactado))
  );

  return (
    <div className="space-y-8">
      <div className="border-b border-[#D8D6CC] pb-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#1D4ED8]">
          Hoja de Ruta de Desendeudamiento
        </p>
        <h1 className="mt-0.5 font-display text-2xl font-bold tracking-tight text-[#111318] sm:text-3xl">
          Cuándo Terminan tus Cuotas ·{' '}
          {formatPeriodoLabel(matchResult.summary.periodo)}
        </h1>
        <p className="mt-1 text-xs text-[#525866] sm:text-sm">
          Hitos calculados en tiempo real según tus cuotas activas, liberación mensual de caja y simulador de amortización de tarjetas.
        </p>
      </div>

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
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#E7E5DC] bg-[#F7F7F3] px-6 py-4">
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

          <div className="divide-y divide-[#ECEAE2] px-6">
            {fixedQuotas.map((item) => {
              const actual = item.cuotaActual ?? 1;
              const total = item.cuotasTotales ?? 1;
              const pct = Math.min(100, Math.round((actual / total) * 100));
              const restantes = Math.max(0, total - actual);

              return (
                <div key={item.id} className="space-y-2.5 py-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-bold text-[#111318]">
                          {item.titulo}
                        </span>
                        {canEditFinances && (
                          <button
                            type="button"
                            onClick={() => onEditItem(item)}
                            aria-label={`Editar todo de ${item.titulo}`}
                            className="rounded p-0.5 text-[#747A88] hover:text-[#1D4ED8]"
                          >
                            <Pencil className="h-3 w-3" aria-hidden="true" />
                          </button>
                        )}
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
                    <div className="flex items-center gap-3 font-mono-tabular">
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
        </div>
      </section>

      {/* Simulador de Amortización de Tarjetas */}
      <section aria-labelledby="simulador-tarjetas-heading" className="space-y-4">
        <div className="flex items-center gap-3">
          <span className="font-mono-tabular text-[11px] font-bold text-[#1D4ED8]">
            03
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
                      className={`rounded-lg border px-2.5 py-1 font-mono-tabular text-[11px] font-semibold transition-colors ${
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
                className="w-full accent-[#1D4ED8] cursor-pointer"
              />

              <div className="grid grid-cols-1 gap-4 pt-2 text-xs sm:grid-cols-2">
                <div className="rounded-xl border border-[#DCE7FE] bg-[#F4F7FF] p-4">
                  <p className="font-bold text-[#111318]">
                    Opción A · Amortizar Banco Patagonia
                  </p>
                  <p className="mt-1.5 leading-relaxed text-[#525866]">
                    Baja el capital adeudado de{' '}
                    <span className="font-mono-tabular font-semibold text-[#111318]">
                      {MoneyUtils.formatARS(patCapARS)}
                    </span>{' '}
                    a{' '}
                    <span className="font-mono-tabular font-bold text-[#111318]">
                      {MoneyUtils.formatARS(patNewCapitalARS)}
                    </span>{' '}
                    y ahorrás aprox.{' '}
                    <span className="font-mono-tabular font-bold text-[#1D4ED8]">
                      {MoneyUtils.formatARSCents(patMonthlyIntSaved)}/mes
                    </span>{' '}
                    en intereses (TNA {patTna}%).
                  </p>
                </div>

                <div className="rounded-xl border border-[#E0E7FF] bg-[#F5F3FF] p-4">
                  <p className="font-bold text-[#111318]">
                    Opción B · Amortizar Mutual Patronal
                  </p>
                  <p className="mt-1.5 leading-relaxed text-[#525866]">
                    Baja el capital adeudado de{' '}
                    <span className="font-mono-tabular font-semibold text-[#111318]">
                      {MoneyUtils.formatARS(mutualCapARS)}
                    </span>{' '}
                    a{' '}
                    <span className="font-mono-tabular font-bold text-[#111318]">
                      {MoneyUtils.formatARS(mutualNewCapitalARS)}
                    </span>{' '}
                    y ahorrás aprox.{' '}
                    <span className="font-mono-tabular font-bold text-[#4338CA]">
                      {MoneyUtils.formatARSCents(mutualMonthlyIntSaved)}/mes
                    </span>{' '}
                    en intereses (TNA {mutualTna}%).
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
