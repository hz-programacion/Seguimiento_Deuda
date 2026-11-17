const arsFormatter = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const arsCompactFormatter = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  maximumFractionDigits: 0,
});

export const MoneyUtils = {
  /**
   * Convierte cualquier monto decimal ARS a centavos enteros para evitar
   * errores de punto flotante IEEE 754 (ej. 0.1 + 0.2 = 0.30000000000000004).
   */
  toCents(monto: number): number {
    if (!Number.isFinite(monto)) return 0;
    return Math.round(monto * 100);
  },

  /**
   * Convierte centavos enteros nuevamente a decimal con 2 decimales exactos.
   */
  fromCents(cents: number): number {
    if (!Number.isFinite(cents)) return 0;
    return Math.round(cents) / 100;
  },

  sumCents(centsList: number[]): number {
    return centsList.reduce((acc, val) => acc + Math.round(val), 0);
  },

  addCents(aCents: number, bCents: number): number {
    return Math.round(aCents) + Math.round(bCents);
  },

  subtractCents(aCents: number, bCents: number): number {
    return Math.round(aCents) - Math.round(bCents);
  },

  addAmounts(...amounts: number[]): number {
    const totalCents = amounts.reduce((acc, m) => acc + MoneyUtils.toCents(m), 0);
    return MoneyUtils.fromCents(totalCents);
  },

  subtractAmounts(a: number, b: number): number {
    return MoneyUtils.fromCents(MoneyUtils.toCents(a) - MoneyUtils.toCents(b));
  },

  sumAmounts(amounts: number[]): number {
    const totalCents = amounts.reduce((acc, m) => acc + MoneyUtils.toCents(m), 0);
    return MoneyUtils.fromCents(totalCents);
  },

  divideInstallmentCents(totalCents: number, cuotas: number): number {
    if (cuotas <= 0) return Math.round(totalCents);
    return Math.round(totalCents / cuotas);
  },

  percent(partCents: number, totalCents: number): number {
    if (totalCents <= 0) return 0;
    return Math.min(100, Math.max(0, Math.round((partCents / totalCents) * 1000) / 10));
  },

  formatARS(monto: number): string {
    return arsFormatter.format(MoneyUtils.fromCents(MoneyUtils.toCents(monto)));
  },

  formatARSCents(cents: number): string {
    return arsFormatter.format(MoneyUtils.fromCents(cents));
  },

  formatCompactCents(cents: number): string {
    return arsCompactFormatter.format(Math.round(cents / 100));
  },

  /**
   * Parsea entradas en formato argentino ("48.500,50") o decimal estándar ("48500.50").
   */
  parseARSInput(raw: string): number {
    const cleaned = raw.replace(/[^0-9,.-]/g, '').trim();
    if (!cleaned) return NaN;
    const hasComma = cleaned.includes(',');
    const hasDot = cleaned.includes('.');
    let normalized = cleaned;
    if (hasComma && hasDot) {
      normalized = cleaned.replace(/\./g, '').replace(',', '.');
    } else if (hasComma) {
      normalized = cleaned.replace(',', '.');
    } else if (/^\d{1,3}(\.\d{3})+$/.test(cleaned)) {
      normalized = cleaned.replace(/\./g, '');
    }
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : NaN;
  },
};
