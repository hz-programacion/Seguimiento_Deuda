import {
  CalendarEventKind,
  CalendarPlannedEvent,
  CashFlowMatchResult,
  ItemFinanciero,
  PeriodoID,
} from '../types/finance';
import {
  addDaysISO,
  daysInMonth,
  formatShortDateAR,
  getNextPeriodoId,
  getPrevPeriodoId,
  getWeekdayUTC,
  parsePeriodo,
} from './dateUtils';
import { isIncomeCategory } from './cashFlowMatcher';
import { MoneyUtils } from './moneyUtils';

export interface CalendarGridCell {
  dateISO: string;
  dayNumber: number;
  inCurrentMonth: boolean;
  weekdayIndex: number; // 0 = Lunes, 6 = Domingo
}

/**
 * Construye una grilla mensual Lunes-primero (7 columnas) sin corrimientos por zona horaria.
 */
export function buildCalendarMonthGrid(periodo: PeriodoID): CalendarGridCell[] {
  const { year, month } = parsePeriodo(periodo);
  const totalDays = daysInMonth(year, month);
  const firstDayISO = `${year}-${String(month).padStart(2, '0')}-01`;
  // getWeekdayUTC: 0 = Dom, 1 = Lun ... 6 = Sáb -> convertimos a 0 = Lun ... 6 = Dom
  const firstWeekdayMondayZero = (getWeekdayUTC(firstDayISO) + 6) % 7;

  const prevPeriodo = getPrevPeriodoId(periodo);
  const prevParsed = parsePeriodo(prevPeriodo);
  const prevTotalDays = daysInMonth(prevParsed.year, prevParsed.month);

  const cells: CalendarGridCell[] = [];

  for (let i = firstWeekdayMondayZero - 1; i >= 0; i--) {
    const day = prevTotalDays - i;
    const dateISO = `${prevParsed.year}-${String(prevParsed.month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    cells.push({
      dateISO,
      dayNumber: day,
      inCurrentMonth: false,
      weekdayIndex: (getWeekdayUTC(dateISO) + 6) % 7,
    });
  }

  for (let day = 1; day <= totalDays; day++) {
    const dateISO = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    cells.push({
      dateISO,
      dayNumber: day,
      inCurrentMonth: true,
      weekdayIndex: (getWeekdayUTC(dateISO) + 6) % 7,
    });
  }

  const nextPeriodo = getNextPeriodoId(periodo);
  const nextParsed = parsePeriodo(nextPeriodo);
  let nextDay = 1;
  while (cells.length % 7 !== 0) {
    const dateISO = `${nextParsed.year}-${String(nextParsed.month).padStart(2, '0')}-${String(nextDay).padStart(2, '0')}`;
    cells.push({
      dateISO,
      dayNumber: nextDay,
      inCurrentMonth: false,
      weekdayIndex: (getWeekdayUTC(dateISO) + 6) % 7,
    });
    nextDay += 1;
  }

  return cells;
}

function kindSortWeight(kind: CalendarEventKind): number {
  if (kind === 'COBRO') return 0;
  if (kind === 'VENTANA_TARJETA') return 1;
  if (kind === 'VENCIMIENTO') return 2;
  return 3;
}

/**
 * Genera los eventos financieros inteligentes del mes a partir del calce quincenal y las reglas bancarias argentinas:
 * - Cobros confirmados o previstos
 * - Apertura de ventana post-cierre para tarjetas (cierre + 1 día)
 * - Vencimientos ajustados al último día hábil previo si caen en fin de semana
 * - Hito de última cuota cuando una obligación se extingue en el período
 */
export function buildMonthlyFinancialEvents(
  periodo: PeriodoID,
  matchResult: CashFlowMatchResult,
  periodItems: ItemFinanciero[]
): CalendarPlannedEvent[] {
  const events: CalendarPlannedEvent[] = [];

  // 1) Cobros e ingresos del mes
  const incomes = periodItems.filter(
    (item) => isIncomeCategory(item.categoria) && item.estado !== 'EXTINGUIDO'
  );
  for (const inc of incomes) {
    events.push({
      eventKey: `${periodo}:COBRO:${inc.id}:${inc.fechaExactaVencimiento}`,
      itemId: inc.id,
      dateISO: inc.fechaExactaVencimiento,
      kind: 'COBRO',
      title: `Cobro: ${inc.titulo}`,
      description: `Ingreso previsto en ${inc.bolsilloResponsable} por ${MoneyUtils.formatARS(inc.montoPactado)}.`,
      amountARS: inc.montoPactado,
      bolsillo: inc.bolsilloResponsable,
      isPaid: inc.estado === 'PAGADO',
      isUrgent: false,
      shiftedFromWeekend: false,
      blockedPreClose: false,
    });
  }

  // 2) Obligaciones calzadas (Q1 + Q2)
  const allocations = [
    ...matchResult.q1.asignaciones,
    ...matchResult.q2.asignaciones,
  ];

  for (const alloc of allocations) {
    const ob = alloc.obligacion;
    const dueRecommended = alloc.fechaLimiteRecomendadaISO;
    const shiftedFromWeekend = dueRecommended !== ob.fechaExactaVencimiento;
    const isPaid = ob.estado === 'PAGADO';
    const isUrgent =
      !isPaid && !alloc.bloqueadoPorCierre && alloc.prioridad === 'CRITICA';

    // Ventana post-cierre de tarjeta (primer día válido para pagar sin doble cobro)
    if (
      ob.fechaCierre &&
      ob.fechaCierre < ob.fechaExactaVencimiento &&
      !isPaid
    ) {
      const openDate = alloc.ventanaPagoDesdeISO ?? addDaysISO(ob.fechaCierre, 1);
      events.push({
        eventKey: `${periodo}:VENTANA_TARJETA:${ob.id}:${openDate}`,
        itemId: ob.id,
        dateISO: openDate,
        originalDueISO: ob.fechaExactaVencimiento,
        kind: 'VENTANA_TARJETA',
        title: `Habilitada para pagar: ${ob.titulo}`,
        description: `Cerró el ${formatShortDateAR(ob.fechaCierre)}. Ya podés pagar dentro de la ventana válida hasta el ${formatShortDateAR(dueRecommended)} sin riesgo de doble cobro. Monto: ${MoneyUtils.formatARS(ob.montoPactado)}.`,
        amountARS: ob.montoPactado,
        bolsillo: ob.bolsilloResponsable,
        isPaid: false,
        isUrgent: false,
        shiftedFromWeekend: false,
        blockedPreClose: alloc.bloqueadoPorCierre,
      });
    }

    const weekendNote = shiftedFromWeekend
      ? ` Vencimiento original ${formatShortDateAR(ob.fechaExactaVencimiento)} (fin de semana); adelantado al día hábil previo.`
      : '';
    const pocketNote =
      alloc.bolsillosSugeridos.length > 0
        ? ` Bolsillo sugerido: ${alloc.bolsillosSugeridos.map((b) => b.bolsillo).join(' + ')}.`
        : ` Bolsillo: ${ob.bolsilloResponsable}.`;

    events.push({
      eventKey: `${periodo}:VENCIMIENTO:${ob.id}:${dueRecommended}`,
      itemId: ob.id,
      dateISO: dueRecommended,
      originalDueISO: shiftedFromWeekend ? ob.fechaExactaVencimiento : undefined,
      kind: 'VENCIMIENTO',
      title: shiftedFromWeekend
        ? `Límite hábil: ${ob.titulo}`
        : `Vence: ${ob.titulo}`,
      description: `Pago de ${MoneyUtils.formatARS(ob.montoPactado)}.${pocketNote}${weekendNote}${alloc.avisoBancario ? ` ${alloc.avisoBancario}` : ''}`,
      amountARS: ob.montoPactado,
      bolsillo: ob.bolsilloResponsable,
      isPaid,
      isUrgent,
      shiftedFromWeekend,
      blockedPreClose: alloc.bloqueadoPorCierre,
    });

    // Hito de extinción en última cuota
    if (
      ob.esCuotaFija &&
      ob.cuotaActual !== undefined &&
      ob.cuotasTotales !== undefined &&
      ob.cuotaActual === ob.cuotasTotales
    ) {
      events.push({
        eventKey: `${periodo}:EXTINCION_CUOTA:${ob.id}:${dueRecommended}`,
        itemId: ob.id,
        dateISO: dueRecommended,
        kind: 'EXTINCION_CUOTA',
        title: `Última cuota (${ob.cuotaActual}/${ob.cuotasTotales}): ${ob.titulo}`,
        description: `Al abonar esta última cuota liberás ${MoneyUtils.formatARS(ob.montoPactado)} mensuales de forma permanente a partir del próximo mes.`,
        amountARS: ob.montoPactado,
        bolsillo: ob.bolsilloResponsable,
        isPaid,
        isUrgent: false,
        shiftedFromWeekend: false,
        blockedPreClose: false,
      });
    }
  }

  return events.sort((a, b) => {
    const dc = a.dateISO.localeCompare(b.dateISO);
    if (dc !== 0) return dc;
    const kw = kindSortWeight(a.kind) - kindSortWeight(b.kind);
    if (kw !== 0) return kw;
    return a.title.localeCompare(b.title);
  });
}

function escapeICSValue(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/\r?\n/g, '\\n')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,');
}

function toICSDateCompact(dateISO: string): string {
  return dateISO.replace(/-/g, '');
}

/**
 * Genera un archivo .ics estándar (RFC 5545) compatible con Apple Calendar, Outlook y Google Calendar.
 */
export function generateICSContent(
  events: CalendarPlannedEvent[],
  calendarName = 'ArgenCaja — Agenda Financiera',
  reminderDaysBefore = 1
): string {
  const nowStamp =
    new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z';
  const trigger =
    reminderDaysBefore <= 0 ? '-PT0M' : `-P${Math.round(reminderDaysBefore)}D`;

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//ArgenCaja//Agenda Financiera del Hogar//ES',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeICSValue(calendarName)}`,
    'X-WR-TIMEZONE:America/Argentina/Buenos_Aires',
  ];

  for (const ev of events) {
    const startCompact = toICSDateCompact(ev.dateISO);
    const endCompact = toICSDateCompact(addDaysISO(ev.dateISO, 1));
    const safeUid = ev.eventKey.replace(/[^a-zA-Z0-9_-]/g, '-');

    lines.push(
      'BEGIN:VEVENT',
      `UID:${safeUid}@argencaja.app`,
      `DTSTAMP:${nowStamp}`,
      `DTSTART;VALUE=DATE:${startCompact}`,
      `DTEND;VALUE=DATE:${endCompact}`,
      `SUMMARY:${escapeICSValue(ev.title)}`,
      `DESCRIPTION:${escapeICSValue(ev.description)}`,
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `DESCRIPTION:${escapeICSValue(ev.title)}`,
      `TRIGGER:${trigger}`,
      'END:VALARM',
      'END:VEVENT'
    );
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}
