import { FoodExpense, ItemFinanciero, PeriodoID } from '../types/finance';
import { createSeedDecember2026, SEED_PERIODO_INICIAL } from '../utils/seedData';

const LS_ITEMS_KEY = 'argencaja_items_v1';
const LS_ACTIVE_PERIOD_KEY = 'argencaja_active_period_v1';
const LS_MIN_FOOD_KEY = 'argencaja_min_food_ars_v1';
const LS_FOOD_EXPENSES_KEY = 'argencaja_food_expenses_v1';

export function loadLocalFoodExpenses(): FoodExpense[] {
  try {
    const raw = localStorage.getItem(LS_FOOD_EXPENSES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter(
        (e): e is FoodExpense =>
          Boolean(e) &&
          typeof e.id === 'string' &&
          typeof e.periodo === 'string' &&
          typeof e.concepto === 'string' &&
          typeof e.monto === 'number' &&
          typeof e.fechaISO === 'string'
      );
    }
  } catch {
    // ignore
  }
  return [];
}

export function saveLocalFoodExpenses(expenses: FoodExpense[]): void {
  try {
    localStorage.setItem(LS_FOOD_EXPENSES_KEY, JSON.stringify(expenses));
  } catch {
    // ignore
  }
}

export function loadMinFoodReserveARS(): number {
  try {
    const raw = localStorage.getItem(LS_MIN_FOOD_KEY);
    if (raw) {
      const parsed = Number(raw);
      if (Number.isFinite(parsed) && parsed >= 0) {
        return parsed;
      }
    }
  } catch {
    // ignore
  }
  return 900000;
}

export function saveMinFoodReserveARS(amount: number): void {
  try {
    localStorage.setItem(LS_MIN_FOOD_KEY, String(amount));
  } catch {
    // ignore
  }
}

export function parseBackupItemsJson(rawText: string): ItemFinanciero[] | null {
  try {
    const parsed = JSON.parse(rawText) as unknown;
    const candidate = Array.isArray(parsed)
      ? parsed
      : parsed &&
          typeof parsed === 'object' &&
          'items' in parsed &&
          Array.isArray((parsed as { items: unknown }).items)
        ? (parsed as { items: unknown[] }).items
        : null;
    if (!candidate || candidate.length === 0) return null;
    const valid = candidate.every(
      (it) =>
        it &&
        typeof it === 'object' &&
        typeof (it as ItemFinanciero).id === 'string' &&
        /^[a-zA-Z0-9_-]+$/.test((it as ItemFinanciero).id) &&
        typeof (it as ItemFinanciero).periodo === 'string' &&
        typeof (it as ItemFinanciero).titulo === 'string' &&
        typeof (it as ItemFinanciero).montoPactado === 'number'
    );
    return valid ? (candidate as ItemFinanciero[]) : null;
  } catch {
    return null;
  }
}

export function loadLocalItems(): ItemFinanciero[] {
  try {
    const raw = localStorage.getItem(LS_ITEMS_KEY);
    if (!raw) {
      const seed = createSeedDecember2026();
      saveLocalItems(seed);
      return seed;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      const cleaned = (parsed as ItemFinanciero[]).filter(
        (it) =>
          it.id !== 'dic26-radar-mp-quita' && it.categoria !== 'DEUDA_CON_QUITA'
      );
      if (cleaned.length > 0) {
        if (cleaned.length !== parsed.length) {
          saveLocalItems(cleaned);
        }
        return cleaned;
      }
    }
  } catch (err) {
    console.warn('Error leyendo localStorage, restaurando semilla:', err);
  }
  const seed = createSeedDecember2026();
  saveLocalItems(seed);
  return seed;
}

export function saveLocalItems(items: ItemFinanciero[]): void {
  try {
    localStorage.setItem(LS_ITEMS_KEY, JSON.stringify(items));
  } catch (err) {
    console.warn('No se pudo guardar en localStorage:', err);
  }
}

export function loadActivePeriod(): PeriodoID {
  try {
    const raw = localStorage.getItem(LS_ACTIVE_PERIOD_KEY);
    if (raw && /^[0-9]{4}-(0[1-9]|1[0-2])$/.test(raw)) {
      return raw;
    }
  } catch {
    // ignore
  }
  return SEED_PERIODO_INICIAL;
}

export function saveActivePeriod(periodo: PeriodoID): void {
  try {
    localStorage.setItem(LS_ACTIVE_PERIOD_KEY, periodo);
  } catch {
    // ignore
  }
}
