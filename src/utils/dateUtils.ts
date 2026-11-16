import { PeriodoID, VentanaQuincena } from '../types/finance';

const MESES_LARGO = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

const MESES_CORTO = [
  'Ene',
  'Feb',
  'Mar',
  'Abr',
  'May',
  'Jun',
  'Jul',
  'Ago',
  'Sep',
  'Oct',
  'Nov',
  'Dic',
];

export function parsePeriodo(periodo: PeriodoID): { year: number; month: number } {
  const [yStr, mStr] = periodo.split('-');
  const year = Number(yStr);
  const month = Number(mStr);
  return {
    year: Number.isFinite(year) ? year : 2026,
    month: Number.isFinite(month) && month >= 1 && month <= 12 ? month : 12,
  };
}

export function formatPeriodoLabel(periodo: PeriodoID): string {
  const { year, month } = parsePeriodo(periodo);
  return `${MESES_LARGO[month - 1]} ${year}`;
}

export function formatPeriodoShort(periodo: PeriodoID): string {
  const { year, month } = parsePeriodo(periodo);
  return `${MESES_CORTO[month - 1]} ${year}`;
}

export function getNextPeriodoId(periodo: PeriodoID): PeriodoID {
  const { year, month } = parsePeriodo(periodo);
  if (month === 12) {
    return `${year + 1}-01`;
  }
  return `${year}-${String(month + 1).padStart(2, '0')}`;
}

export function getPrevPeriodoId(periodo: PeriodoID): PeriodoID {
  const { year, month } = parsePeriodo(periodo);
  if (month === 1) {
    return `${year - 1}-12`;
  }
  return `${year}-${String(month - 1).padStart(2, '0')}`;
}

export function daysInMonth(year: number, month1to12: number): number {
  return new Date(year, month1to12, 0).getDate();
}

export function buildDateString(periodo: PeriodoID, day: number): string {
  const { year, month } = parsePeriodo(periodo);
  const maxDay = daysInMonth(year, month);
  const clampedDay = Math.min(Math.max(1, Math.round(day)), maxDay);
  return `${year}-${String(month).padStart(2, '0')}-${String(clampedDay).padStart(2, '0')}`;
}

/**
 * Suma exactamente N días calendario a una fecha "YYYY-MM-DD" en UTC (sin corrimientos de zona horaria).
 */
export function addDaysISO(fechaISO: string, deltaDays: number): string {
  const parts = fechaISO.split('-').map(Number);
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) {
    return fechaISO;
  }
  const [year, month, day] = parts;
  const d = new Date(Date.UTC(year, month - 1, day + deltaDays));
  const yy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

/**
 * Devuelve el día de la semana UTC: 0 = Domingo, 6 = Sábado.
 */
export function getWeekdayUTC(fechaISO: string): number {
  const parts = fechaISO.split('-').map(Number);
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) {
    return 1;
  }
  const [year, month, day] = parts;
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

/**
 * Si una fecha de vencimiento cae en sábado o domingo, retrocede al viernes hábil previo
 * para respetar el clearing bancario argentino y evitar mora.
 */
export function getLastBusinessDayOnOrBefore(fechaISO: string): {
  recommendedISO: string;
  shiftedFromWeekend: boolean;
} {
  const wd = getWeekdayUTC(fechaISO);
  if (wd === 6) {
    return { recommendedISO: addDaysISO(fechaISO, -1), shiftedFromWeekend: true };
  }
  if (wd === 0) {
    return { recommendedISO: addDaysISO(fechaISO, -2), shiftedFromWeekend: true };
  }
  return { recommendedISO: fechaISO, shiftedFromWeekend: false };
}

/**
 * Suma exactamente 1 mes calendario a una fecha "YYYY-MM-DD" sin corrimientos por zona horaria,
 * ajustando al último día válido del mes siguiente (ej: 31/01 -> 28/02).
 */
export function addOneCalendarMonth(fechaISO: string, preferredDay?: number): string {
  const parts = fechaISO.split('-').map(Number);
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) {
    return fechaISO;
  }
  const [year, month, day] = parts;
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const maxDay = daysInMonth(nextYear, nextMonth);
  const targetDay = Math.min(preferredDay ?? day, maxDay);
  return `${nextYear}-${String(nextMonth).padStart(2, '0')}-${String(targetDay).padStart(2, '0')}`;
}

export function deriveVentanaFromDia(dia: number): VentanaQuincena {
  return dia <= 14 ? 'Q1_DIAS_1_AL_14' : 'Q2_DIAS_15_AL_31';
}

export function formatDateAR(fechaISO: string): string {
  const [y, m, d] = fechaISO.split('-');
  if (!y || !m || !d) return fechaISO;
  return `${d}/${m}/${y}`;
}

export function formatShortDateAR(fechaISO: string): string {
  const [, m, d] = fechaISO.split('-');
  if (!m || !d) return fechaISO;
  return `${d}/${m}`;
}

export function diffDaysISO(fromISO: string, toISO: string): number {
  const [y1, m1, d1] = fromISO.split('-').map(Number);
  const [y2, m2, d2] = toISO.split('-').map(Number);
  const t1 = Date.UTC(y1, (m1 || 1) - 1, d1 || 1);
  const t2 = Date.UTC(y2, (m2 || 1) - 1, d2 || 1);
  return Math.round((t2 - t1) / 86400000);
}

export function addMonthsToPeriodo(periodo: PeriodoID, offset: number): PeriodoID {
  let current = periodo;
  for (let i = 0; i < offset; i++) {
    current = getNextPeriodoId(current);
  }
  return current;
}

export interface CardCycleValidation {
  valid: boolean;
  windowDays: number | null;
  warning?: string;
}

export function validateCardCycleDates(
  fechaCierre?: string,
  fechaVencimiento?: string
): CardCycleValidation {
  if (!fechaCierre || !fechaVencimiento) {
    return { valid: true, windowDays: null };
  }
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(fechaCierre) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(fechaVencimiento)
  ) {
    return { valid: true, windowDays: null };
  }
  const windowDays = diffDaysISO(fechaCierre, fechaVencimiento);
  if (windowDays <= 0) {
    return {
      valid: false,
      windowDays,
      warning:
        'La fecha de cierre debe ser anterior al vencimiento para calcular la ventana válida de pago sin doble cobro.',
    };
  }
  return { valid: true, windowDays };
}

