import React from 'react';
import { motion } from 'motion/react';
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

function getStatusIndicator(status: BankingPaymentStatus): {
  label: string;
  dotClass: string;
  textClass: string;
} {
  if (status === 'PAGAR_AHORA') {
    return {
      label: 'Pagar ahora',
      dotClass: 'bg-[#1D4ED8]',
      textClass: 'text-[#1D4ED8]',
    };
  }
  if (status === 'ESPERAR_CIERRE') {
    return {
      label: 'Esperar cierre',
      dotClass: 'bg-[#D97706]',
      textClass: 'text-[#B45309]',
    };
  }
  if (status === 'EXCEDE_TOPE_COMIDA') {
    return {
      label: 'Excede tope comida',
      dotClass: 'bg-[#DC2626]',
      textClass: 'text-[#B91C1C]',
    };
  }
  return {
    label: 'Pagado',
    dotClass: 'bg-[#9CA3AF]',
    textClass: 'text-[#525866]',
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

  const safeCap = Math.max(1, caja.presupuestoPagableSinComidaCents);
  const utilizationPct = Math.min(
    100,
    Math.round((caja.obligacionesCents / safeCap) * 100)
  );
  const exceedsSafeCap =
    caja.obligacionesCents > caja.presupuestoPagableSinComidaCents;

  return (
    <section
      aria-labelledby={`heading-${caja.ventana}`}
      className="flex flex-col rounded-2xl border border-[#E4E3DD] bg-white p-5 shadow-[0_1px_2px_rgba(17,19,24,0.03)] sm:p-6"
    >
      <div className="flex items-start justify-between gap-4 border-b border-[#EEEDE8] pb-4">
        <div>
          <h2
            id={`heading-${caja.ventana}`}
            className="font-display text-lg font-bold text-[#111318]"
          >
            {caja.ventana === 'Q1_DIAS_1_AL_14'
              ? '1° Quincena'
              : '2° Quincena'}
          </h2>
          <p className="text-xs text-[#525866]">{caja.rangoDias}</p>
        </div>
        <div className="text-right">
          <p className="text-[11px] uppercase tracking-wider text-[#747A88]">
            Caja disponible
          </p>
          <p className="font-mono-tabular text-lg font-bold text-[#1D4ED8]">
            {MoneyUtils.formatARSCents(caja.disponibleTotalCents)}
          </p>
        </div>
      </div>

      {/* 4 métricas + medidor de carga */}
      <div className="space-y-3 border-b border-[#EEEDE8] py-4">
        <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
          <div>
            <p className="text-[#747A88]">Ingresos (+arrastre)</p>
            <p className="mt-0.5 font-mono-tabular font-bold text-[#111318]">
              {MoneyUtils.formatARSCents(caja.disponibleTotalCents)}
            </p>
          </div>
          <div>
            <p className="text-[#747A88]">Comida protegida</p>
            <p className="mt-0.5 font-mono-tabular font-bold text-[#1D4ED8]">
              {MoneyUtils.formatARSCents(caja.reservaComidaSugeridaCents)}
            </p>
          </div>
          <div>
            <p className="text-[#747A88]">Tope seguro</p>
            <p className="mt-0.5 font-mono-tabular font-bold text-[#4338CA]">
              {MoneyUtils.formatARSCents(caja.presupuestoPagableSinComidaCents)}
            </p>
          </div>
          <div>
            <p className="text-[#747A88]">Recomendado hoy</p>
            <p className="mt-0.5 font-mono-tabular font-bold text-[#111318]">
              {MoneyUtils.formatARSCents(caja.totalRecomendadoAhoraCents)}
            </p>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between text-[11px] font-mono-tabular">
            <span className="font-sans text-[#525866]">
              Uso del tope pagable sin tocar comida
            </span>
            <span
              className={
                exceedsSafeCap ? 'font-bold text-[#B45309]' : 'font-bold text-[#1D4ED8]'
              }
            >
              {MoneyUtils.formatCompactCents(caja.obligacionesCents)} /{' '}
              {MoneyUtils.formatCompactCents(
                caja.presupuestoPagableSinComidaCents
              )}
            </span>
          </div>
          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-[#EEEDE8]">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${utilizationPct}%` }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              className={`h-full ${
                exceedsSafeCap ? 'bg-[#D97706]' : 'bg-[#1D4ED8]'
              }`}
            />
          </div>
        </div>
      </div>

      {(caja.totalEsperandoCierreCents > 0 || caja.totalExcedeTopeCents > 0) && (
        <div className="mt-3 flex flex-wrap gap-3 border-b border-[#EEEDE8] pb-3 font-mono-tabular text-[11px]">
          {caja.totalEsperandoCierreCents > 0 && (
            <span className="font-semibold text-[#B45309]">
              Esperando cierre:{' '}
              {MoneyUtils.formatARSCents(caja.totalEsperandoCierreCents)}
            </span>
          )}
          {caja.totalExcedeTopeCents > 0 && (
            <span className="font-semibold text-[#B91C1C]">
              Excede tope comida:{' '}
              {MoneyUtils.formatARSCents(caja.totalExcedeTopeCents)}
            </span>
          )}
        </div>
      )}

      {/* Ingresos */}
      <div className="border-b border-[#EEEDE8] py-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-[#747A88]">
          De dónde entra la plata
        </h3>
        <div className="mt-2.5 space-y-2">
          {caja.remanenteArrastreCents > 0 && (
            <div className="flex items-center justify-between text-xs font-medium text-[#4338CA]">
              <span>Sobrante que pasa de la 1° Quincena</span>
              <span className="font-mono-tabular font-bold">
                +{MoneyUtils.formatARSCents(caja.remanenteArrastreCents)}
              </span>
            </div>
          )}
          {caja.itemsIngreso.map((inc) => (
            <div
              key={inc.id}
              className="flex items-center justify-between gap-2 text-xs text-[#111318]"
            >
              <span className="truncate font-medium">
                {inc.titulo}{' '}
                <span className="font-mono-tabular text-[#747A88]">
                  (Día {String(inc.diaVencimientoOCobro).padStart(2, '0')} ·{' '}
                  {inc.bolsilloResponsable})
                </span>
              </span>
              <InlineAmountEditor
                itemTitle={inc.titulo}
                amount={inc.montoPactado}
                prefix="+"
                readOnly={!canEditFinances}
                textClassName="text-xs font-bold text-[#1D4ED8]"
                onSaveAmount={(val) => onQuickUpdateAmount(inc, val)}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Obligaciones calzadas */}
      <div className="flex-1 pt-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-[#747A88]">
            Pagos de esta quincena ({caja.asignaciones.length})
          </h3>
          <span className="font-mono-tabular text-xs font-bold text-[#111318]">
            Total: {MoneyUtils.formatARSCents(caja.obligacionesCents)}
          </span>
        </div>

        {caja.asignaciones.length === 0 ? (
          <p className="mt-4 text-xs text-[#747A88]">
            No hay vencimientos asignados en esta quincena.
          </p>
        ) : (
          <div className="mt-3 divide-y divide-[#EEEDE8]">
            {caja.asignaciones.map((alloc) => {
              const statusMeta = getStatusIndicator(alloc.bankingStatus);
              return (
                <div key={alloc.obligacion.id} className="py-3.5 space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
                        <span
                          className={`inline-flex items-center gap-1.5 font-semibold ${statusMeta.textClass}`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${statusMeta.dotClass}`}
                            aria-hidden="true"
                          />
                          {statusMeta.label}
                        </span>
                        <span className="text-[#D4D2CA]">·</span>
                        <span
                          className={
                            alloc.prioridad === 'CRITICA'
                              ? 'font-semibold text-[#DC2626]'
                              : alloc.prioridad === 'ALTA'
                                ? 'font-semibold text-[#B45309]'
                                : 'text-[#747A88]'
                          }
                        >
                          {alloc.prioridad === 'CRITICA'
                            ? 'Urgente'
                            : alloc.prioridad === 'ALTA'
                              ? 'Pronto'
                              : 'Programado'}
                        </span>
                      </div>

                      <p className="text-sm font-bold text-[#111318]">
                        {alloc.obligacion.titulo}
                      </p>

                      <p className="font-mono-tabular text-xs text-[#525866]">
                        Vence {formatDateAR(alloc.obligacion.fechaExactaVencimiento)}
                        {alloc.ventanaPagoDesdeISO && (
                          <span className="font-semibold text-[#B45309]">
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
                        textClassName="text-sm font-bold text-[#111318]"
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
                            className="inline-flex items-center gap-1 rounded-lg border border-[#E4E3DD] bg-[#F6F6F3] px-2.5 py-1 text-[11px] font-medium text-[#111318] hover:bg-[#EEEDE8]"
                          >
                            <ArrowLeftRight
                              className="h-3 w-3"
                              aria-hidden="true"
                            />
                            {moveLabel}
                          </button>
                          {alloc.obligacion.estado === 'PENDIENTE' && (
                            <button
                              type="button"
                              onClick={() => onMarkPaid(alloc.obligacion)}
                              aria-label={`Pagar ${alloc.obligacion.titulo}`}
                              className="rounded-lg bg-[#1D4ED8] px-2.5 py-1 text-xs font-semibold text-white hover:bg-[#1E40AF]"
                            >
                              Pagar
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  {alloc.avisoBancario && (
                    <p className="rounded-lg bg-[#F6F6F3] px-3 py-2 text-[11px] leading-relaxed text-[#525866]">
                      {alloc.avisoBancario}
                    </p>
                  )}

                  {alloc.bolsillosSugeridos.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 text-xs text-[#525866]">
                      <ArrowRight
                        className="h-3 w-3 text-[#1D4ED8] shrink-0"
                        aria-hidden="true"
                      />
                      <span>Se paga con:</span>
                      {alloc.bolsillosSugeridos.map((b, idx) => (
                        <span
                          key={`${b.bolsillo}-${idx}`}
                          className="font-mono-tabular font-semibold text-[#111318]"
                        >
                          {b.bolsillo} (
                          {MoneyUtils.formatARSCents(b.montoAsignadoCents)})
                          {idx < alloc.bolsillosSugeridos.length - 1 ? ' + ' : ''}
                        </span>
                      ))}
                      {alloc.faltanteCents > 0 && (
                        <span className="font-mono-tabular font-bold text-[#DC2626]">
                          · Faltante{' '}
                          {MoneyUtils.formatARSCents(alloc.faltanteCents)}
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

      {/* Saldo libre al cierre */}
      <div className="mt-4 flex items-center justify-between border-t border-[#EEEDE8] pt-4 text-sm">
        <span className="text-[#525866]">Plata libre tras pagar cuentas</span>
        <span
          className={`font-mono-tabular font-bold ${
            caja.saldoLibrePostPagosCents >= 0
              ? 'text-[#1D4ED8]'
              : 'text-[#DC2626]'
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
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#747A88]">
            Calce de Liquidez
          </p>
          <h1 className="mt-0.5 font-display text-2xl font-bold tracking-tight text-[#111318] sm:text-3xl">
            Quincenas · {formatPeriodoLabel(summary.periodo)}
          </h1>
          <p className="mt-1 text-xs text-[#525866] sm:text-sm">
            Análisis bancario al {formatShortDateAR(referenceDateISO)}: calza tus cobros sin tocar el mínimo de comida y respeta el cierre de tarjetas.
          </p>
        </div>

        <div className="flex items-center gap-2 rounded-xl border border-[#BFDBFE] bg-white px-3.5 py-2 text-xs">
          <ShieldCheck
            className="h-4 w-4 text-[#1D4ED8] shrink-0"
            aria-hidden="true"
          />
          <span className="text-[#525866]">Mínimo comida/mes:</span>
          <InlineAmountEditor
            itemTitle="mínimo mensual de comida"
            amount={minFoodReserveARS}
            readOnly={!canEditFinances}
            textClassName="text-xs font-bold text-[#1D4ED8]"
            onSaveAmount={onChangeMinFoodReserveARS}
          />
        </div>
      </div>

      <div
        role="status"
        className={`flex items-start gap-3 rounded-2xl border p-4 ${
          alertaDescalce.hayDescalce
            ? 'border-[#FDE68A] bg-[#FFFBEB]'
            : 'border-[#BFDBFE] bg-[#EFF6FF]/60'
        }`}
      >
        {alertaDescalce.hayDescalce ? (
          <AlertTriangle
            className="mt-0.5 h-5 w-5 shrink-0 text-[#D97706]"
            aria-hidden="true"
          />
        ) : (
          <CheckCircle2
            className="mt-0.5 h-5 w-5 shrink-0 text-[#1D4ED8]"
            aria-hidden="true"
          />
        )}
        <div>
          <p
            className={`text-sm font-bold ${
              alertaDescalce.hayDescalce ? 'text-[#92400E]' : 'text-[#1D4ED8]'
            }`}
          >
            {alertaDescalce.hayDescalce
              ? `Atención en 1° Quincena: reservá ${MoneyUtils.formatARSCents(alertaDescalce.montoAReservarCents)} del mes anterior o ajustá vencimientos`
              : 'Quincenas equilibradas respetando tu mínimo de comida'}
          </p>
          <p className="mt-0.5 text-xs text-[#525866]">{alertaDescalce.mensaje}</p>
        </div>
      </div>

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
