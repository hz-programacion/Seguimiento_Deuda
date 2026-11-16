import { ItemFinanciero, PeriodoID } from '../types/finance';
import {
  addOneCalendarMonth,
  deriveVentanaFromDia,
  formatPeriodoShort,
  getNextPeriodoId,
} from './dateUtils';
import { MoneyUtils } from './moneyUtils';

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
