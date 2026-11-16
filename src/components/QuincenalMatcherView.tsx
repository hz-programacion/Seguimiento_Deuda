import React from 'react';
import {
  AlertTriangle,
  ArrowLeftRight,
  ArrowRight,
  CheckCircle2,
  ShieldCheck,
} from 'lucide-react';
import {
  BankingPaymentStatus,
  CashFlowMatchResult,
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

interface QuincenalMatcherViewProps {
  matchResult: CashFlowMatchResult;
  canEditFinances: boolean;
  minFoodReserveARS: number;
  onChangeMinFoodReserveARS: (val: number) => void;
  onMarkPaid: (item: ItemFinanciero) => void;
  onQuickUpdateAmount: (item: ItemFinanciero, newAmount: number) => void;
  onMoveVentana: (item: ItemFinanciero, targetVentana: VentanaQuincena) => void;
}

function getStatusPill(status: BankingPaymentStatus): {
  label: string;
  className: string;
} {
  if (status === 'PAGAR_AHORA') {
    return {
      label: 'Pagar ahora',
      className: 'border border-emerald-500/35 bg-emerald-500/10 text-emerald-300',
    };
  }
  if (status === 'ESPERAR_CIERRE') {
    return {
      label: 'Esperar cierre',
      className: 'border border-cyan-500/35 bg-cyan-500/10 text-cyan-300',
    };
  }
  if (status === 'EXCEDE_TOPE_COMIDA') {
    return {
      label: 'Excede tope comida',
      className: 'border border-amber-500/35 bg-amber-500/10 text-amber-300',
    };
  }
  return {
    label: 'Pagado',
    className: 'border border-slate-700 bg-slate-800 text-slate-300',
  };
}

const QuincenaColumn: React.FC<{
  caja: QuincenaCaja;
  canEditFinances: boolean;
  onMarkPaid: (item: ItemFinanciero) => void;
  onQuickUpdateAmount: (item: ItemFinanciero, newAmount: number) => void;
  onMoveVentana: (item: ItemFinanciero, targetVentana: VentanaQuincena) => void;
}> = ({
  caja,
  canEditFinances,
  onMarkPaid,
  onQuickUpdateAmount,
  onMoveVentana,
}) => {
  const oppositeVentana: VentanaQuincena =
    caja.ventana === 'Q1_DIAS_1_AL_14'
      ? 'Q2_DIAS_15_AL_31'
      : 'Q1_DIAS_1_AL_14';
  const moveLabel =
    caja.ventana === 'Q1_DIAS_1_AL_14' ? 'Pasar a 2°Q' : 'Pasar a 1°Q';

  return (
    <section
      aria-labelledby={`heading-${caja.ventana}`}
      className="flex flex-col rounded-xl border border-slate-800 bg-slate-900/90 p-5"
    >
      <div className="flex items-start justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h2
            id={`heading-${caja.ventana}`}
            className="text-lg font-bold text-slate-100"
          >
            {caja.ventana === 'Q1_DIAS_1_AL_14'
              ? '1° Quincena'
              : '2° Quincena'}
          </h2>
          <p className="text-xs text-slate-400">{caja.rangoDias}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-400">Caja total disponible</p>
          <p className="text-lg font-bold text-emerald-400 font-mono-tabular">
            {MoneyUtils.formatARSCents(caja.disponibleTotalCents)}
          </p>
        </div>
      </div>

      {/* Resumen numérico + Tope seguro para deudas protegiendo comida */}
      <div className="grid grid-cols-2 gap-3 border-b border-slate-800 py-4 text-xs sm:grid-cols-4">
        <div>
          <p className="text-slate-400">Ingresos (+arrastre)</p>
          <p className="mt-0.5 font-semibold text-slate-100 font-mono-tabular">
            {MoneyUtils.formatARSCents(caja.disponibleTotalCents)}
          </p>
        </div>
        <div>
          <p className="text-slate-400">Comida protegida</p>
          <p className="mt-0.5 font-semibold text-emerald-400 font-mono-tabular">
            {MoneyUtils.formatARSCents(caja.reservaComidaSugeridaCents)}
          </p>
        </div>
        <div>
          <p className="text-slate-400">Tope seguro p/ deudas</p>
          <p className="mt-0.5 font-semibold text-cyan-300 font-mono-tabular">
            {MoneyUtils.formatARSCents(caja.presupuestoPagableSinComidaCents)}
          </p>
        </div>
        <div>
          <p className="text-slate-400">Recomendado hoy</p>
          <p className="mt-0.5 font-semibold text-slate-100 font-mono-tabular">
            {MoneyUtils.formatARSCents(caja.totalRecomendadoAhoraCents)}
          </p>
        </div>
      </div>

      {(caja.totalEsperandoCierreCents > 0 || caja.totalExcedeTopeCents > 0) && (
        <div className="mt-3 rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2 text-[11px] text-slate-300 font-mono-tabular">
          {caja.totalEsperandoCierreCents > 0 && (
            <span className="mr-3 text-cyan-300">
              Esperando cierre: {MoneyUtils.formatARSCents(caja.totalEsperandoCierreCents)}
            </span>
          )}
          {caja.totalExcedeTopeCents > 0 && (
            <span className="text-amber-300">
              Excede tope comida: {MoneyUtils.formatARSCents(caja.totalExcedeTopeCents)}
            </span>
          )}
        </div>
      )}

      {/* Ingresos / Bolsillos de la Quincena */}
      <div className="border-b border-slate-800 py-4">
        <h3 className="text-xs font-semibold text-slate-300">
          De dónde entra la plata
        </h3>
        <div className="mt-2 space-y-2">
          {caja.remanenteArrastreCents > 0 && (
            <div className="flex items-center justify-between text-xs text-cyan-300">
              <span>Sobrante que pasa de la 1° Quincena</span>
              <span className="font-mono-tabular font-semibold">
                +{MoneyUtils.formatARSCents(caja.remanenteArrastreCents)}
              </span>
            </div>
          )}
          {caja.itemsIngreso.map((inc) => (
            <div
              key={inc.id}
              className="flex items-center justify-between gap-2 text-xs text-slate-300"
            >
              <span className="truncate">
                {inc.titulo}{' '}
                <span className="text-slate-500 font-mono-tabular">
                  (Día {String(inc.diaVencimientoOCobro).padStart(2, '0')} ·{' '}
                  {inc.bolsilloResponsable})
                </span>
              </span>
              <InlineAmountEditor
                itemTitle={inc.titulo}
                amount={inc.montoPactado}
                prefix="+"
                readOnly={!canEditFinances}
                textClassName="text-xs font-semibold text-emerald-400"
                onSaveAmount={(val) => onQuickUpdateAmount(inc, val)}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Vencimientos calzados */}
      <div className="flex-1 pt-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold text-slate-300">
            Pagos de esta quincena ({caja.asignaciones.length})
          </h3>
          <span className="text-xs font-semibold text-slate-200 font-mono-tabular">
            Total: {MoneyUtils.formatARSCents(caja.obligacionesCents)}
          </span>
        </div>

        {caja.asignaciones.length === 0 ? (
          <p className="mt-4 text-xs text-slate-500">
            No hay vencimientos asignados en esta quincena.
          </p>
        ) : (
          <div className="mt-3 divide-y divide-slate-800/80">
            {caja.asignaciones.map((alloc) => {
              const statusPill = getStatusPill(alloc.bankingStatus);
              return (
                <div key={alloc.obligacion.id} className="py-3 space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${statusPill.className}`}
                        >
                          {statusPill.label}
                        </span>
                        <p className="text-sm font-medium text-slate-100">
                          {alloc.obligacion.titulo}
                        </p>
                      </div>
                      <p className="text-xs text-slate-400 font-mono-tabular">
                        Vence {formatDateAR(alloc.obligacion.fechaExactaVencimiento)} ·{' '}
                        <span
                          className={
                            alloc.prioridad === 'CRITICA'
                              ? 'text-rose-400 font-semibold'
                              : alloc.prioridad === 'ALTA'
                                ? 'text-amber-400 font-semibold'
                                : 'text-slate-400'
                          }
                        >
                          {alloc.prioridad === 'CRITICA'
                            ? 'Urgente'
                            : alloc.prioridad === 'ALTA'
                              ? 'Pronto'
                              : 'Programado'}
                        </span>
                        {alloc.ventanaPagoDesdeISO && (
                          <span className="text-cyan-300">
                            {' '}
                            · Ventana {formatShortDateAR(alloc.ventanaPagoDesdeISO)}→
                            {formatShortDateAR(alloc.fechaLimiteRecomendadaISO)}
                          </span>
                        )}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center justify-end gap-1.5 shrink-0">
                      <InlineAmountEditor
                        itemTitle={alloc.obligacion.titulo}
                        amount={alloc.obligacion.montoPactado}
                        readOnly={!canEditFinances}
                        textClassName="text-sm font-bold text-slate-100"
                        onSaveAmount={(val) =>
                          onQuickUpdateAmount(alloc.obligacion, val)
                        }
                      />
                      {canEditFinances && (
                        <>
                          <button
                            type="button"
                            onClick={() =>
                              onMoveVentana(alloc.obligacion, oppositeVentana)
                            }
                            title={`Mover a la otra quincena (${moveLabel})`}
                            className="inline-flex items-center gap-1 rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-[11px] font-medium text-slate-300 hover:bg-slate-700"
                          >
                            <ArrowLeftRight className="h-3 w-3" aria-hidden="true" />
                            {moveLabel}
                          </button>
                          {alloc.obligacion.estado === 'PENDIENTE' && (
                            <button
                              type="button"
                              onClick={() => onMarkPaid(alloc.obligacion)}
                              aria-label={`Pagar ${alloc.obligacion.titulo}`}
                              className="rounded-md border border-emerald-500/30 bg-emerald-500/15 px-2.5 py-1 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/25"
                            >
                              Pagar
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  {alloc.avisoBancario && (
                    <p className="rounded border border-slate-800 bg-slate-950/80 px-2.5 py-1.5 text-[11px] leading-relaxed text-slate-300">
                      {alloc.avisoBancario}
                    </p>
                  )}

                  {/* Qué bolsillo paga esta deuda */}
                  {alloc.bolsillosSugeridos.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-400">
                      <ArrowRight
                        className="h-3 w-3 text-emerald-400 shrink-0"
                        aria-hidden="true"
                      />
                      <span>Se paga con:</span>
                      {alloc.bolsillosSugeridos.map((b, idx) => (
                        <span
                          key={`${b.bolsillo}-${idx}`}
                          className="text-slate-300 font-mono-tabular"
                        >
                          {b.bolsillo} (
                          {MoneyUtils.formatARSCents(b.montoAsignadoCents)})
                          {idx < alloc.bolsillosSugeridos.length - 1 ? ' + ' : ''}
                        </span>
                      ))}
                      {alloc.faltanteCents > 0 && (
                        <span className="text-rose-400 font-semibold font-mono-tabular">
                          · Faltante {MoneyUtils.formatARSCents(alloc.faltanteCents)}
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

      {/* Saldo libre al cierre de quincena */}
      <div className="mt-4 flex items-center justify-between border-t border-slate-800 pt-4 text-sm">
        <span className="text-slate-400">Plata libre tras pagar cuentas</span>
        <span
          className={`font-bold font-mono-tabular ${
            caja.saldoLibrePostPagosCents >= 0
              ? 'text-emerald-400'
              : 'text-rose-500'
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
  canEditFinances,
  minFoodReserveARS,
  onChangeMinFoodReserveARS,
  onMarkPaid,
  onQuickUpdateAmount,
  onMoveVentana,
}) => {
  const { q1, q2, alertaDescalce, summary, referenceDateISO } = matchResult;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-100">
            Organizador por Quincena · {formatPeriodoLabel(summary.periodo)}
          </h1>
          <p className="text-sm text-slate-400">
            Análisis bancario al {formatShortDateAR(referenceDateISO)}: calza tus cobros sin tocar el mínimo de comida y respeta el cierre de tarjetas.
          </p>
        </div>

        <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-950/20 px-3 py-2 text-xs">
          <ShieldCheck
            className="h-4 w-4 text-emerald-400 shrink-0"
            aria-hidden="true"
          />
          <span className="text-slate-300">Mínimo comida/mes:</span>
          <InlineAmountEditor
            itemTitle="mínimo mensual de comida"
            amount={minFoodReserveARS}
            readOnly={!canEditFinances}
            textClassName="text-xs font-bold text-emerald-300"
            onSaveAmount={onChangeMinFoodReserveARS}
          />
        </div>
      </div>

      {/* Estado de Calce Quincenal */}
      <div
        role="status"
        className={`flex items-start gap-3 rounded-xl border p-4 ${
          alertaDescalce.hayDescalce
            ? 'border-amber-500/40 bg-amber-500/10'
            : 'border-emerald-500/30 bg-emerald-500/10'
        }`}
      >
        {alertaDescalce.hayDescalce ? (
          <AlertTriangle
            className="mt-0.5 h-5 w-5 shrink-0 text-amber-400"
            aria-hidden="true"
          />
        ) : (
          <CheckCircle2
            className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400"
            aria-hidden="true"
          />
        )}
        <div>
          <p
            className={`text-sm font-semibold ${
              alertaDescalce.hayDescalce ? 'text-amber-300' : 'text-emerald-300'
            }`}
          >
            {alertaDescalce.hayDescalce
              ? `Atención en 1° Quincena: reservá ${MoneyUtils.formatARSCents(alertaDescalce.montoAReservarCents)} del mes anterior o ajustá vencimientos`
              : 'Quincenas equilibradas respetando tu mínimo de comida'}
          </p>
          <p className="mt-0.5 text-xs text-slate-300">
            {alertaDescalce.mensaje}
          </p>
        </div>
      </div>

      {/* Vista lado a lado de Q1 y Q2 */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <QuincenaColumn
          caja={q1}
          canEditFinances={canEditFinances}
          onMarkPaid={onMarkPaid}
          onQuickUpdateAmount={onQuickUpdateAmount}
          onMoveVentana={onMoveVentana}
        />
        <QuincenaColumn
          caja={q2}
          canEditFinances={canEditFinances}
          onMarkPaid={onMarkPaid}
          onQuickUpdateAmount={onQuickUpdateAmount}
          onMoveVentana={onMoveVentana}
        />
      </div>
    </div>
  );
};
