import React, { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { CalendarCheck2, Pencil, Sparkles, TrendingDown } from 'lucide-react';
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
  const [cuotasQuita, setCuotasQuita] = useState<1 | 3 | 6 | 9 | 12>(1);
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

  const radarQuita = periodItems.find(
    (i) => i.categoria === 'DEUDA_CON_QUITA'
  );
  const patagoniaCard = periodItems.find(
    (i) =>
      i.categoria === 'TARJETA_ROTATIVA' &&
      i.titulo.toLowerCase().includes('patagonia')
  );

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

  const patCapARS = patagoniaCard?.saldoCapitalTotal ?? 1258815.9;
  const patTna = patagoniaCard?.tnaEstimada ?? 110;
  const extraCents = MoneyUtils.toCents(extraCapitalSimARS);
  const patNewCapitalARS = Math.max(0, patCapARS - extraCapitalSimARS);
  const patMonthlyIntBefore = estimateMonthlyCardInterestCents(
    patCapARS,
    patTna
  );
  const patMonthlyIntAfter = estimateMonthlyCardInterestCents(
    patNewCapitalARS,
    patTna
  );
  const patMonthlyIntSaved = Math.max(
    0,
    patMonthlyIntBefore - patMonthlyIntAfter
  );

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#747A88]">
          Hoja de Ruta de Desendeudamiento
        </p>
        <h1 className="mt-0.5 font-display text-2xl font-bold tracking-tight text-[#111318] sm:text-3xl">
          Cuándo Terminan tus Cuotas ·{' '}
          {formatPeriodoLabel(matchResult.summary.periodo)}
        </h1>
        <p className="mt-1 text-xs text-[#525866] sm:text-sm">
          Hitos calculados en tiempo real según tus cuotas activas, liberación mensual de caja y simulador de cancelación.
        </p>
      </div>

      {/* Hitos dinámicos */}
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
              className="flex flex-col justify-between rounded-2xl border border-[#E4E3DD] bg-white p-5 shadow-[0_1px_2px_rgba(17,19,24,0.03)]"
            >
              <div>
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-bold text-[#4338CA]">
                    {m.fechaLabel}
                  </span>
                  <span className="text-[#747A88]">
                    {idx === 0 ? 'Próximo hito' : 'Mediano plazo'}
                  </span>
                </div>
                <h3 className="mt-2 font-display text-base font-bold text-[#111318]">
                  {m.items.map((it) => it.titulo).join(' + ')}
                </h3>
                <ul className="mt-2.5 space-y-1.5 text-xs text-[#525866]">
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
              <div className="mt-4 flex items-center justify-between border-t border-[#EEEDE8] pt-3">
                <span className="text-xs text-[#525866]">
                  Plata que se libera
                </span>
                <span className="font-mono-tabular text-base font-bold text-[#1D4ED8]">
                  +{MoneyUtils.formatARSCents(m.alivioMensualCents)}/mes
                </span>
              </div>
            </article>
          ))}
        </section>
      )}

      {/* Progreso individual de cuotas fijas */}
      <section
        aria-labelledby="cuotas-progreso-heading"
        className="rounded-2xl border border-[#E4E3DD] bg-white p-5 shadow-[0_1px_2px_rgba(17,19,24,0.03)] sm:p-6"
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2
            id="cuotas-progreso-heading"
            className="flex items-center gap-2 font-display text-lg font-bold text-[#111318]"
          >
            <CalendarCheck2
              className="h-4 w-4 text-[#1D4ED8]"
              aria-hidden="true"
            />
            Cuotas Activas ({fixedQuotas.length})
          </h2>
          <span className="text-xs text-[#525866]">
            Editá vencimiento o monto directo
          </span>
        </div>

        <div className="mt-4 divide-y divide-[#EEEDE8]">
          {fixedQuotas.map((item) => {
            const actual = item.cuotaActual ?? 1;
            const total = item.cuotasTotales ?? 1;
            const pct = Math.min(100, Math.round((actual / total) * 100));
            const restantes = Math.max(0, total - actual);

            return (
              <div key={item.id} className="py-4 space-y-2.5">
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

                <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#EEEDE8]">
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
      </section>

      {/* Simulador Dual */}
      <section
        aria-labelledby="simulador-mp-heading"
        className="rounded-2xl border border-[#E4E3DD] bg-white p-5 shadow-[0_1px_2px_rgba(17,19,24,0.03)] sm:p-6"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2
              id="simulador-mp-heading"
              className="flex items-center gap-2 font-display text-lg font-bold text-[#111318]"
            >
              <Sparkles className="h-4 w-4 text-[#4338CA]" aria-hidden="true" />
              Simulador de Cancelación y Amortización
            </h2>
            <p className="mt-0.5 text-xs text-[#525866]">
              Compará pagar la quita de Mercado Pago o inyectar capital extra en Banco Patagonia sin comprometer tu mínimo de comida.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 rounded-xl border border-[#E4E3DD] bg-[#F6F6F3] px-3 py-1.5 text-xs">
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

            <div className="flex items-center gap-1 rounded-xl border border-[#E4E3DD] bg-[#F6F6F3] p-1">
              {([1, 3, 6, 9, 12] as const).map((plan) => (
                <button
                  key={plan}
                  type="button"
                  onClick={() => setCuotasQuita(plan)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                    cuotasQuita === plan
                      ? 'bg-[#1D4ED8] text-white'
                      : 'text-[#525866] hover:text-[#111318]'
                  }`}
                >
                  {plan === 1 ? 'Contado' : `${plan}c`}
                </button>
              ))}
            </div>
          </div>
        </div>

        <p className="mt-4 rounded-xl bg-[#F6F6F3] px-3.5 py-2.5 text-xs leading-relaxed text-[#525866]">
          {matchResult.simuladorExcedente.recomendacionTexto}
        </p>

        <div className="mt-5 grid grid-cols-2 gap-4 border-y border-[#EEEDE8] py-4 lg:grid-cols-4">
          <div>
            <p className="text-xs text-[#747A88]">Deuda Original MP</p>
            <p className="mt-1 font-mono-tabular text-lg font-bold text-[#747A88] line-through">
              {MoneyUtils.formatARSCents(nominalCents)}
            </p>
          </div>

          <div>
            <p className="text-xs text-[#525866]">
              {cuotasQuita === 1
                ? 'Pago Único Contado'
                : `Total en ${cuotasQuita} cuotas (+${recargoPlanPct}%)`}
            </p>
            <p className="mt-1 font-mono-tabular text-lg font-bold text-[#4338CA]">
              {MoneyUtils.formatARSCents(totalFinanciadoCents)}
            </p>
          </div>

          <div>
            <p className="text-xs text-[#525866]">Valor por Cuota</p>
            <p className="mt-1 font-mono-tabular text-lg font-bold text-[#111318]">
              {MoneyUtils.formatARSCents(valorCuotaCents)}
            </p>
            <p className="mt-0.5 font-mono-tabular text-[11px] text-[#747A88]">
              {impactoEnColchonPct}% de tu plata libre para comida
            </p>
          </div>

          <div>
            <p className="text-xs font-medium text-[#1D4ED8]">
              Ahorro Neto Quita
            </p>
            <p className="mt-1 flex items-center gap-1.5 font-mono-tabular text-lg font-bold text-[#1D4ED8]">
              <TrendingDown className="h-4 w-4" aria-hidden="true" />
              {MoneyUtils.formatARSCents(ahorroVsNominalCents)}
            </p>
          </div>
        </div>

        {/* Simulador What-If */}
        <div className="mt-5 space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-bold text-[#111318]">
                Simular pago extra / aguinaldo:{' '}
                <span className="font-mono-tabular text-[#1D4ED8]">
                  {MoneyUtils.formatARS(extraCapitalSimARS)}
                </span>
              </p>
              <p className="text-[11px] text-[#525866]">
                Mové el control para comparar cancelar la quita vs bajar intereses en Banco Patagonia (sin modificar saldos reales).
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {[250000, 460000, 500000, 900000].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setExtraCapitalSimARS(preset)}
                  className={`rounded-lg border px-2.5 py-1 font-mono-tabular text-[11px] font-semibold transition-colors ${
                    extraCapitalSimARS === preset
                      ? 'border-[#1D4ED8] bg-[#EFF6FF] text-[#1D4ED8]'
                      : 'border-[#E4E3DD] bg-[#F6F6F3] text-[#525866] hover:text-[#111318]'
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

          <div className="grid grid-cols-1 gap-4 pt-1 text-xs sm:grid-cols-2">
            <div className="rounded-xl border border-[#EEEDE8] bg-[#FAF9F6] p-3.5">
              <p className="font-bold text-[#111318]">
                Opción A · Cancelar Quita Mercado Pago
              </p>
              <p className="mt-1 text-[#525866]">
                {extraCents >= contadoCents
                  ? `Cubre el 100% contado y te sobran ${MoneyUtils.formatARSCents(
                      extraCents - contadoCents
                    )} libres.`
                  : `Faltan ${MoneyUtils.formatARSCents(
                      contadoCents - extraCents
                    )} para cubrir el pago único contado.`}
              </p>
            </div>

            <div className="rounded-xl border border-[#EEEDE8] bg-[#FAF9F6] p-3.5">
              <p className="font-bold text-[#111318]">
                Opción B · Amortizar Capital Banco Patagonia
              </p>
              <p className="mt-1 text-[#525866]">
                Baja el capital adeudado a{' '}
                <span className="font-mono-tabular font-bold text-[#111318]">
                  {MoneyUtils.formatARS(patNewCapitalARS)}
                </span>{' '}
                y ahorra aprox.{' '}
                <span className="font-mono-tabular font-bold text-[#1D4ED8]">
                  {MoneyUtils.formatARSCents(patMonthlyIntSaved)}/mes
                </span>{' '}
                en intereses (TNA {patTna}%).
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
