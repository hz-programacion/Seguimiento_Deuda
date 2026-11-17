import { ItemFinanciero, MonthSummary, PeriodoID } from '../types/finance';
import {
  addOneCalendarMonth,
  deriveVentanaFromDia,
  formatPeriodoShort,
  formatShortDateAR,
  getNextPeriodoId,
} from './dateUtils';
import { MoneyUtils } from './moneyUtils';
import {
  computeMonthSummary,
  estimateMonthlyCardInterestCents,
} from './cashFlowMatcher';

export interface CloneMonthResult {
  nextPeriodo: PeriodoID;
  newItems: ItemFinanciero[];
  extinguishedItems: ItemFinanciero[];
  patagoniaAdjusted: boolean;
}

/**
 * Función pura y transaccional para cerrar un mes y generar el siguiente.
 * NUNCA muta los ítems del período anterior (preserva inmutabilidad del historial).
 */
export function closeAndCloneMonth(
  currentPeriodo: PeriodoID,
  allItems: ItemFinanciero[]
): CloneMonthResult {
  const nextPeriodo = getNextPeriodoId(currentPeriodo);
  const currentItems = allItems.filter((i) => i.periodo === currentPeriodo);

  const newItems: ItemFinanciero[] = [];
  const extinguishedItems: ItemFinanciero[] = [];
  let patagoniaAdjusted = false;

  for (const item of currentItems) {
    // Los ítems ya extinguidos en meses anteriores no se propagan ni duplican
    if (item.estado === 'EXTINGUIDO') {
      continue;
    }

    // El Aguinaldo (SAC) es extraordinario y no se clona automáticamente como habitual
    if (item.categoria === 'INGRESO_EXTRA_SAC') {
      continue;
    }

    const nextFecha = addOneCalendarMonth(
      item.fechaExactaVencimiento,
      item.diaVencimientoOCobro
    );
    const nextFechaCierre = item.fechaCierre
      ? addOneCalendarMonth(item.fechaCierre)
      : undefined;
    const nextDia = Number(nextFecha.split('-')[2]) || item.diaVencimientoOCobro;
    const nextVentana = deriveVentanaFromDia(nextDia);

    // Regla de Extinción Automática para CUOTA_FIJA
    if (
      item.esCuotaFija &&
      item.cuotaActual !== undefined &&
      item.cuotasTotales !== undefined
    ) {
      if (item.cuotaActual >= item.cuotasTotales) {
        const extinguished: ItemFinanciero = {
          ...item,
          id: `${nextPeriodo}-${item.id.replace(/^[0-9]{4}-[0-9]{2}-/, '').replace(/^dic26-/, '')}-ext`,
          periodo: nextPeriodo,
          montoPactado: 0,
          montoPagado: undefined,
          fechaPagoReal: undefined,
          estado: 'EXTINGUIDO',
          fechaExactaVencimiento: nextFecha,
          fechaCierre: nextFechaCierre,
          diaVencimientoOCobro: nextDia,
          ventanaAsignada: nextVentana,
          montoLiberadoAlExtinguirse: item.montoPactado,
          notas: `Extinguida al completar cuota ${item.cuotaActual}/${item.cuotasTotales} en ${formatPeriodoShort(currentPeriodo)}. Alivio mensual ganado: ${MoneyUtils.formatARS(item.montoPactado)}.`,
        };
        newItems.push(extinguished);
        extinguishedItems.push(extinguished);
        continue;
      }

      const nextCuota = item.cuotaActual + 1;
      newItems.push({
        ...item,
        id: `${nextPeriodo}-${item.id.replace(/^[0-9]{4}-[0-9]{2}-/, '').replace(/^dic26-/, '')}`,
        periodo: nextPeriodo,
        cuotaActual: nextCuota,
        estado: 'PENDIENTE',
        montoPagado: undefined,
        fechaPagoReal: undefined,
        fechaExactaVencimiento: nextFecha,
        fechaCierre: nextFechaCierre,
        diaVencimientoOCobro: nextDia,
        ventanaAsignada: nextVentana,
        adjuntos: undefined,
        editadoManualmente: false,
      });
      continue;
    }

    // Regla especial de transición Diciembre -> Enero para Banco Patagonia (cae cuota de $180k)
    let nextMonto = item.montoPactado;
    let nextPagoMinimo = item.pagoMinimoExigido;
    let nextNotas = item.notas;

    if (
      item.categoria === 'TARJETA_ROTATIVA' &&
      item.titulo.toLowerCase().includes('patagonia') &&
      currentPeriodo === '2026-12' &&
      MoneyUtils.toCents(item.montoPactado) > 25000000
    ) {
      const reduced = MoneyUtils.subtractAmounts(item.montoPactado, 180000.0);
      nextMonto = reduced;
      nextPagoMinimo = reduced;
      patagoniaAdjusted = true;
      nextNotas =
        'Cuota de $180.000 extinguida en Diciembre. Exigencia estimada Enero (~$174.646,07), editable al llegar el resumen.';
    }

    const nextTitulo =
      patagoniaAdjusted && item.titulo.toLowerCase().includes('patagonia')
        ? 'Banco Patagonia (Pago Mínimo sin Cuota $180k)'
        : item.titulo;

    newItems.push({
      ...item,
      id: `${nextPeriodo}-${item.id.replace(/^[0-9]{4}-[0-9]{2}-/, '').replace(/^dic26-/, '')}`,
      periodo: nextPeriodo,
      titulo: nextTitulo,
      montoPactado: nextMonto,
      pagoMinimoExigido: nextPagoMinimo,
      estado: 'PENDIENTE',
      montoPagado: undefined,
      fechaPagoReal: undefined,
      fechaExactaVencimiento: nextFecha,
      fechaCierre: nextFechaCierre,
      diaVencimientoOCobro: nextDia,
      ventanaAsignada: nextVentana,
      notas: nextNotas,
      adjuntos: undefined,
      editadoManualmente: false,
    });
  }

  return {
    nextPeriodo,
    newItems,
    extinguishedItems,
    patagoniaAdjusted,
  };
}

/**
 * Proyecta secuencialmente N meses futuros a partir de un período base
 * sin sobrescribir períodos ya existentes.
 */
export function projectMultipleMonths(
  startPeriodo: PeriodoID,
  count: number,
  existingItems: ItemFinanciero[]
): ItemFinanciero[] {
  let working = [...existingItems];
  let cursor = startPeriodo;

  for (let i = 0; i < count; i++) {
    const nextPeriodo = getNextPeriodoId(cursor);
    const alreadyExists = working.some((it) => it.periodo === nextPeriodo);
    if (!alreadyExists) {
      const cloned = closeAndCloneMonth(cursor, working);
      working = [...working, ...cloned.newItems];
    }
    cursor = nextPeriodo;
  }

  return working;
}

export interface CardAmortizationResult {
  updatedItems: ItemFinanciero[];
  changedItems: ItemFinanciero[];
  previousCapitalARS: number;
  nextCapitalARS: number;
  appliedAmountARS: number;
  monthlyInterestSavedCents: number;
}

/**
 * Aplica una amortización extraordinaria de capital puro sobre una tarjeta rotativa,
 * registrando la traza en notas y propagando la reducción a meses futuros ya generados.
 */
export function amortizeRotatingCardCapital(
  allItems: ItemFinanciero[],
  targetCardId: string,
  amortizeAmountARS: number,
  dateISO: string,
  applyToFutureMonths = true
): CardAmortizationResult | null {
  const target = allItems.find((i) => i.id === targetCardId);
  if (!target || target.categoria !== 'TARJETA_ROTATIVA') {
    return null;
  }

  const previousCapitalARS = Math.max(0, target.saldoCapitalTotal ?? 0);
  const previousCents = MoneyUtils.toCents(previousCapitalARS);
  const amortizeCents = Math.max(0, MoneyUtils.toCents(amortizeAmountARS));
  if (previousCents <= 0 || amortizeCents <= 0) {
    return null;
  }

  const appliedCents = Math.min(previousCents, amortizeCents);
  const nextCapitalCents = previousCents - appliedCents;
  const appliedAmountARS = MoneyUtils.fromCents(appliedCents);
  const nextCapitalARS = MoneyUtils.fromCents(nextCapitalCents);

  const monthlyInterestSavedCents = Math.max(
    0,
    estimateMonthlyCardInterestCents(previousCapitalARS, target.tnaEstimada) -
      estimateMonthlyCardInterestCents(nextCapitalARS, target.tnaEstimada)
  );

  const normalizedKey = target.id
    .replace(/^[0-9]{4}-[0-9]{2}-/, '')
    .replace(/^dic26-/, '');

  const auditEntry = `Amortización ${formatShortDateAR(dateISO)}: -${MoneyUtils.formatARS(
    appliedAmountARS
  )} (capital restante ${MoneyUtils.formatARS(nextCapitalARS)})`;

  const changedItems: ItemFinanciero[] = [];

  const updatedItems = allItems.map((it) => {
    if (it.id === target.id) {
      const nextNotes = it.notas
        ? `${auditEntry} · ${it.notas}`.slice(0, 1000)
        : auditEntry.slice(0, 1000);
      const updatedCard: ItemFinanciero = {
        ...it,
        saldoCapitalTotal: nextCapitalARS,
        notas: nextNotes,
        editadoManualmente: true,
      };
      changedItems.push(updatedCard);
      return updatedCard;
    }

    if (
      applyToFutureMonths &&
      it.periodo > target.periodo &&
      it.categoria === 'TARJETA_ROTATIVA' &&
      it.estado !== 'EXTINGUIDO'
    ) {
      const itKey = it.id
        .replace(/^[0-9]{4}-[0-9]{2}-/, '')
        .replace(/^dic26-/, '');
      const matches =
        itKey === normalizedKey ||
        it.titulo.toLowerCase().includes(target.titulo.toLowerCase().split('(')[0].trim());
      if (!matches) return it;

      const futureCapCents = MoneyUtils.toCents(it.saldoCapitalTotal ?? previousCapitalARS);
      const reducedFutureCents = Math.max(0, futureCapCents - appliedCents);
      const updatedFuture: ItemFinanciero = {
        ...it,
        saldoCapitalTotal: MoneyUtils.fromCents(reducedFutureCents),
        editadoManualmente: true,
      };
      changedItems.push(updatedFuture);
      return updatedFuture;
    }

    return it;
  });

  return {
    updatedItems,
    changedItems,
    previousCapitalARS,
    nextCapitalARS,
    appliedAmountARS,
    monthlyInterestSavedCents,
  };
}

export interface NextMonthProjection {
  currentPeriodo: PeriodoID;
  nextPeriodo: PeriodoID;
  isAlreadyGenerated: boolean;
  currentSummary: MonthSummary;
  nextSummary: MonthSummary;
  deltaObligacionesCents: number;
  deltaColchonComidaCents: number;
  deltaTarjetasCents: number;
  deltaCuotasFijasCents: number;
  extinguishingItems: ItemFinanciero[];
  patagoniaCuotaDrops: boolean;
}

/**
 * Compara el período actual contra el mes siguiente (usando los datos reales
 * si ya fue generado o simulando closeAndCloneMonth sin mutar el estado).
 */
export function computeNextMonthProjection(
  activePeriodo: PeriodoID,
  allItems: ItemFinanciero[]
): NextMonthProjection {
  const nextPeriodo = getNextPeriodoId(activePeriodo);
  const currentItems = allItems.filter((i) => i.periodo === activePeriodo);
  const existingNextItems = allItems.filter((i) => i.periodo === nextPeriodo);
  const isAlreadyGenerated = existingNextItems.length > 0;

  const clonePreview = closeAndCloneMonth(activePeriodo, allItems);
  const nextItems = isAlreadyGenerated
    ? existingNextItems
    : clonePreview.newItems;

  const currentSummary = computeMonthSummary(activePeriodo, currentItems);
  const nextSummary = computeMonthSummary(nextPeriodo, nextItems);

  return {
    currentPeriodo: activePeriodo,
    nextPeriodo,
    isAlreadyGenerated,
    currentSummary,
    nextSummary,
    deltaObligacionesCents:
      nextSummary.obligacionesFijasTotalesCents -
      currentSummary.obligacionesFijasTotalesCents,
    deltaColchonComidaCents:
      nextSummary.colchonComidaCents - currentSummary.colchonComidaCents,
    deltaTarjetasCents:
      nextSummary.tarjetasTotalesCents - currentSummary.tarjetasTotalesCents,
    deltaCuotasFijasCents:
      nextSummary.cuotasFijasCents - currentSummary.cuotasFijasCents,
    extinguishingItems: clonePreview.extinguishedItems,
    patagoniaCuotaDrops: clonePreview.patagoniaAdjusted,
  };
}
