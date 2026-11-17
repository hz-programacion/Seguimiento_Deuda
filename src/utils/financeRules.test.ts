import test from 'node:test';
import assert from 'node:assert/strict';
import { MoneyUtils } from './moneyUtils';
import {
  createSeedDecember2026,
  SEED_SAC_ITEM_DIC_2026,
} from './seedData';
import {
  computeCashflowWaterfall,
  computeFoodBudgetStatus,
  computeMonthSummary,
  estimateMonthlyCardInterestCents,
  getEffectiveItemAmountCents,
  runCashFlowMatcher,
} from './cashFlowMatcher';
import {
  amortizeRotatingCardCapital,
  closeAndCloneMonth,
  computeNextMonthProjection,
  projectMultipleMonths,
} from './monthTransition';
import { addOneCalendarMonth, validateCardCycleDates } from './dateUtils';
import {
  buildCalendarMonthGrid,
  buildMonthlyFinancialEvents,
  generateICSContent,
} from './calendarPlanner';
import { buildCalendarEventSig } from '../services/calendarService';

test('MoneyUtils avoids IEEE 754 floating-point errors', () => {
  assert.equal(MoneyUtils.addAmounts(0.1, 0.2), 0.3);
  // Mutual Patronal ($128.382,60) + Patagonia ($354.646,07) + Carrefour ($234.710,49) = $717.739,16
  const totalTarjetas = MoneyUtils.addAmounts(128382.6, 354646.07, 234710.49);
  assert.equal(totalTarjetas, 717739.16);
  assert.equal(MoneyUtils.toCents(totalTarjetas), 71773916);
});

test('December 2026 seed data totals match exact financial specification', () => {
  const seed = createSeedDecember2026();
  const summary = computeMonthSummary('2026-12', seed);

  assert.equal(summary.ingresosHabitualesCents, 252170843); // $2.521.708,43
  assert.equal(summary.serviciosHogarCents, 34890806); // $348.908,06
  assert.equal(summary.cuotasFijasCents, 39129077); // $391.290,77
  assert.equal(summary.tarjetasTotalesCents, 71773916); // $717.739,16
  assert.equal(summary.obligacionesFijasTotalesCents, 145793799); // $1.457.937,99
  assert.equal(summary.colchonComidaCents, 106377044); // $1.063.770,44

  // Con Aguinaldo (+$500.000,00)
  const withSac = [...seed, SEED_SAC_ITEM_DIC_2026];
  const summarySac = computeMonthSummary('2026-12', withSac);
  assert.equal(summarySac.ingresosTotalesCents, 302170843); // $3.021.708,43
  assert.equal(summarySac.colchonComidaCents, 156377044); // $1.563.770,44
  assert.equal(
    summarySac.obligacionesFijasTotalesCents,
    summary.obligacionesFijasTotalesCents
  );
});

test('CashFlowMatcher correctly splits Q1 vs Q2 and prioritizes Carrefour 9/9', () => {
  const seed = createSeedDecember2026();
  const res = runCashFlowMatcher('2026-12', seed, '2026-12-01');

  // Q1 ingresos: 780k + 100k + 385.420,18 = 1.265.420,18
  assert.equal(res.q1.ingresosCents, 126542018);
  // Q1 obligaciones: Carrefour Máquina (98.046,49) + Auto (136.664,00) + Mutual (128.382,60) + Gas (48.310,16) + Luz (94.520,40) = 505.923,65
  assert.equal(res.q1.obligacionesCents, 50592365);
  assert.equal(res.q1.descalceCents, 0);

  // Carrefour Máquina (9/9) debe ser prioridad CRITICA
  const maquina = res.colaPrioridad.find(
    (a) => a.obligacion.id === 'dic26-carrefour-maquina'
  );
  assert.ok(maquina);
  assert.equal(maquina.prioridad, 'CRITICA');

  // Activar SAC en Q2 no debe disparar falso descalce en Q1
  const resWithSac = runCashFlowMatcher('2026-12', [...seed, SEED_SAC_ITEM_DIC_2026], '2026-12-01');
  assert.equal(resWithSac.q1.descalceCents, 0);
  assert.equal(resWithSac.alertaDescalce.hayDescalce, false);
});

test('closeAndCloneMonth extinguishes Carrefour Máquina 9/9 and preserves December immutability', () => {
  const seed = createSeedDecember2026();
  // Marcamos un pago en diciembre con monto real distinto para probar inmutabilidad
  const updatedDic = seed.map((i) =>
    i.id === 'dic26-srv-luz'
      ? { ...i, estado: 'PAGADO' as const, montoPagado: 96000, fechaPagoReal: '2026-12-12' }
      : i
  );

  const cloned = closeAndCloneMonth('2026-12', updatedDic);
  assert.equal(cloned.nextPeriodo, '2027-01');
  assert.equal(cloned.extinguishedItems.length, 1);
  assert.equal(cloned.extinguishedItems[0].titulo, 'Carrefour - Máquina');
  assert.equal(cloned.extinguishedItems[0].estado, 'EXTINGUIDO');
  assert.equal(cloned.extinguishedItems[0].montoPactado, 0);
  assert.equal(cloned.extinguishedItems[0].montoLiberadoAlExtinguirse, 98046.49);

  // Arreglo Auto avanza de 2/6 a 3/6
  const autoEne = cloned.newItems.find((i) =>
    i.titulo.includes('Arreglo Auto')
  );
  assert.ok(autoEne);
  assert.equal(autoEne.cuotaActual, 3);
  assert.equal(autoEne.cuotasTotales, 6);
  assert.equal(autoEne.estado, 'PENDIENTE');
  assert.equal(autoEne.fechaExactaVencimiento, '2027-01-04');

  // Patagonia baja $180.000
  const patagoniaEne = cloned.newItems.find((i) =>
    i.titulo.includes('Patagonia')
  );
  assert.ok(patagoniaEne);
  assert.equal(MoneyUtils.toCents(patagoniaEne.montoPactado), 17464607);

  // Diciembre sigue intacto
  const dicLuz = updatedDic.find((i) => i.id === 'dic26-srv-luz');
  assert.equal(dicLuz?.estado, 'PAGADO');
  assert.equal(dicLuz?.montoPagado, 96000);
});

test('projectMultipleMonths extinguishes Arreglo Auto in May 2027 and Aire/Colchón in July 2027', () => {
  const seed = createSeedDecember2026();
  const projected = projectMultipleMonths('2026-12', 7, seed); // Hasta 2027-07

  // En 2027-05 Arreglo Auto (era 2/6 en Dic, 6/6 en Abr 2027) pasa a EXTINGUIDO
  const mayAuto = projected.find(
    (i) => i.periodo === '2027-05' && i.titulo.includes('Arreglo Auto')
  );
  assert.equal(mayAuto?.estado, 'EXTINGUIDO');

  // En 2027-07 Aire Acondicionado y Colchón (terminan en Jun 2027) pasan a EXTINGUIDO
  const julAire = projected.find(
    (i) => i.periodo === '2027-07' && i.titulo === 'Aire Acondicionado'
  );
  const julColchon = projected.find(
    (i) => i.periodo === '2027-07' && i.titulo === 'Colchón'
  );
  assert.equal(julAire?.estado, 'EXTINGUIDO');
  assert.equal(julColchon?.estado, 'EXTINGUIDO');
});

test('addOneCalendarMonth clamps end-of-month dates safely', () => {
  assert.equal(addOneCalendarMonth('2027-01-31'), '2027-02-28');
  assert.equal(addOneCalendarMonth('2026-12-04'), '2027-01-04');
});

test('closeAndCloneMonth advances fechaCierre by one calendar month when present', () => {
  const seed = createSeedDecember2026();
  const cloned = closeAndCloneMonth('2026-12', seed);
  const patagoniaEne = cloned.newItems.find((i) =>
    i.titulo.includes('Patagonia')
  );
  assert.equal(patagoniaEne?.fechaCierre, '2027-01-10');
  assert.equal(patagoniaEne?.fechaExactaVencimiento, '2027-01-22');
});

test('closeAndCloneMonth clears adjuntos and editadoManualmente on cloned month while preserving original month', () => {
  const seed = createSeedDecember2026().map((i) =>
    i.id === 'dic26-srv-luz'
      ? {
          ...i,
          editadoManualmente: true,
          adjuntos: [
            {
              id: 'adj-1',
              tipo: 'RESUMEN' as const,
              nombre: '[Resumen] Luz Dic.pdf',
              mimeType: 'application/pdf',
              driveFileId: 'drive-123',
              webViewLink: 'https://drive.google.com/file/d/drive-123/view',
              subidoEn: '2026-12-05T12:00:00.000Z',
            },
          ],
        }
      : i
  );
  const cloned = closeAndCloneMonth('2026-12', seed);
  const luzEne = cloned.newItems.find((i) => i.id === '2027-01-srv-luz');
  assert.ok(luzEne);
  assert.equal(luzEne.adjuntos, undefined);
  assert.equal(luzEne.editadoManualmente, false);

  const luzDic = seed.find((i) => i.id === 'dic26-srv-luz');
  assert.equal(luzDic?.adjuntos?.length, 1);
  assert.equal(luzDic?.editadoManualmente, true);
});

test('runCashFlowMatcher respects configurable minFoodCushionCents', () => {
  const seed = createSeedDecember2026();
  // Colchón Dic = 106.377.044 cents ($1.063.770,44)
  const resDefault = runCashFlowMatcher('2026-12', seed, '2026-12-01', 90000000);
  assert.equal(resDefault.simuladorExcedente.excedenteBaseCents, 16377044);

  const resHigherMin = runCashFlowMatcher('2026-12', seed, '2026-12-01', 100000000);
  assert.equal(resHigherMin.simuladorExcedente.excedenteBaseCents, 6377044);
});

test('Strict quincenal cap: $500k Q1 income with $200k Q1 food reserve caps immediate recommendations at $300k', () => {
  const tightMonth = [
    {
      id: 'tight-ing-q1',
      periodo: '2027-02',
      titulo: 'Sueldo 1° Quincena',
      categoria: 'INGRESO_HABITUAL' as const,
      montoPactado: 500000,
      estado: 'PENDIENTE' as const,
      diaVencimientoOCobro: 5,
      fechaExactaVencimiento: '2027-02-05',
      ventanaAsignada: 'Q1_DIAS_1_AL_14' as const,
      bolsilloResponsable: 'Sueldo 1Q',
      esCuotaFija: false,
    },
    {
      id: 'tight-luz',
      periodo: '2027-02',
      titulo: 'Energía Eléctrica (Luz)',
      categoria: 'SERVICIO_HOGAR' as const,
      montoPactado: 120000,
      estado: 'PENDIENTE' as const,
      diaVencimientoOCobro: 8,
      fechaExactaVencimiento: '2027-02-08',
      ventanaAsignada: 'Q1_DIAS_1_AL_14' as const,
      bolsilloResponsable: 'Sueldo 1Q',
      esCuotaFija: false,
    },
    {
      id: 'tight-cuota-1',
      periodo: '2027-02',
      titulo: 'Plan Cuotas A',
      categoria: 'CUOTA_FIJA' as const,
      montoPactado: 150000,
      estado: 'PENDIENTE' as const,
      diaVencimientoOCobro: 10,
      fechaExactaVencimiento: '2027-02-10',
      ventanaAsignada: 'Q1_DIAS_1_AL_14' as const,
      bolsilloResponsable: 'Sueldo 1Q',
      esCuotaFija: true,
      cuotaActual: 2,
      cuotasTotales: 6,
    },
    {
      id: 'tight-seguro',
      periodo: '2027-02',
      titulo: 'Seguro Auto',
      categoria: 'SERVICIO_HOGAR' as const,
      montoPactado: 130000,
      estado: 'PENDIENTE' as const,
      diaVencimientoOCobro: 12,
      fechaExactaVencimiento: '2027-02-12',
      ventanaAsignada: 'Q1_DIAS_1_AL_14' as const,
      bolsilloResponsable: 'Sueldo 1Q',
      esCuotaFija: false,
    },
  ];

  // Mínimo comida mensual = $400.000 ($200.000 Q1 + $200.000 Q2) -> Tope seguro Q1 = $300.000
  const res = runCashFlowMatcher('2027-02', tightMonth, '2027-02-05', 40000000);
  assert.equal(res.q1.presupuestoPagableSinComidaCents, 30000000);
  // Luz ($120k) + Plan Cuotas A ($150k) = $270k <= $300k; Seguro ($130k) excedería los $30k libres
  assert.equal(res.q1.totalRecomendadoAhoraCents, 27000000);
  assert.ok(res.q1.totalRecomendadoAhoraCents <= res.q1.presupuestoPagableSinComidaCents);
  assert.equal(res.pagosPostergadosPorComida.length, 1);
  assert.equal(res.pagosPostergadosPorComida[0].obligacion.id, 'tight-seguro');
  assert.equal(res.pagosPostergadosPorComida[0].excedeTopeComidaCents, 10000000);
});

test('Argentine banking rule blocks credit card payment before fechaCierre to avoid double payment', () => {
  const seed = createSeedDecember2026();
  // Patagonia cierra 2026-12-10 y vence 2026-12-22
  const beforeClose = runCashFlowMatcher('2026-12', seed, '2026-12-05');
  const patBefore = beforeClose.q2.asignaciones.find(
    (a) => a.obligacion.id === 'dic26-tarj-patagonia'
  );
  assert.ok(patBefore);
  assert.equal(patBefore.bloqueadoPorCierre, true);
  assert.equal(patBefore.bankingStatus, 'ESPERAR_CIERRE');
  assert.equal(patBefore.ventanaPagoDesdeISO, '2026-12-11');
  assert.equal(beforeClose.tarjetasBloqueadasPorCierre.length, 1);

  // Después del cierre (2026-12-11), ya habilita el pago dentro del ciclo
  const afterClose = runCashFlowMatcher('2026-12', seed, '2026-12-11');
  const patAfter = afterClose.q2.asignaciones.find(
    (a) => a.obligacion.id === 'dic26-tarj-patagonia'
  );
  assert.ok(patAfter);
  assert.equal(patAfter.bloqueadoPorCierre, false);
  assert.equal(patAfter.bankingStatus, 'PAGAR_AHORA');
  assert.equal(afterClose.tarjetasBloqueadasPorCierre.length, 0);
});

test('Weekend due date shifts recommended banking payment deadline to prior business Friday', () => {
  const seed = createSeedDecember2026();
  // dic26-srv-luz vence el sábado 2026-12-12 -> debe recomendar pagar hasta el viernes 2026-12-11
  const res = runCashFlowMatcher('2026-12', seed, '2026-12-05');
  const luz = res.q1.asignaciones.find((a) => a.obligacion.id === 'dic26-srv-luz');
  assert.ok(luz);
  assert.equal(luz.fechaLimiteRecomendadaISO, '2026-12-11');
  assert.ok(luz.avisoBancario?.includes('11/12'));
});

test('validateCardCycleDates flags closing date on or after due date and computes valid window days', () => {
  const valid = validateCardCycleDates('2026-12-10', '2026-12-22');
  assert.equal(valid.valid, true);
  assert.equal(valid.windowDays, 12);

  const invalidSameDay = validateCardCycleDates('2026-12-22', '2026-12-22');
  assert.equal(invalidSameDay.valid, false);
  assert.ok(invalidSameDay.warning);

  const invalidAfter = validateCardCycleDates('2026-12-25', '2026-12-22');
  assert.equal(invalidAfter.valid, false);
});

test('computeCashflowWaterfall and estimateMonthlyCardInterestCents compute exact cent breakdowns', () => {
  const seed = createSeedDecember2026();
  const res = runCashFlowMatcher('2026-12', seed, '2026-12-05', 90000000);
  const wf = computeCashflowWaterfall(res, 90000000);

  assert.equal(wf.ingresosTotalesCents, 252170843);
  assert.equal(wf.reservaComidaProtegidaCents, 90000000);
  assert.equal(wf.excedenteRealCents, 16377044);
  assert.equal(wf.deficitCents, 0);
  assert.equal(
    wf.pagadoCents +
      wf.pendienteEnVentanaCents +
      wf.esperandoCierreCents +
      wf.excedeTopeCents +
      wf.reservaComidaProtegidaCents +
      wf.excedenteRealCents,
    wf.ingresosTotalesCents
  );

  // Patagonia capital $1.258.815,90 a TNA 110% -> ~115.391,46/mes
  const monthlyInterest = estimateMonthlyCardInterestCents(1258815.9, 110);
  assert.equal(monthlyInterest, 11539146);
});

test('buildCalendarMonthGrid builds Monday-first 7-column grid for 2026-12', () => {
  const grid = buildCalendarMonthGrid('2026-12');
  assert.equal(grid.length % 7, 0);
  // 2026-12-01 es Martes -> la grilla arranca Lunes 2026-11-30
  assert.equal(grid[0].dateISO, '2026-11-30');
  assert.equal(grid[0].inCurrentMonth, false);
  assert.equal(grid[0].weekdayIndex, 0);
  assert.equal(grid[1].dateISO, '2026-12-01');
  assert.equal(grid[1].inCurrentMonth, true);
  assert.equal(grid[1].weekdayIndex, 1);

  const inMonthCount = grid.filter((c) => c.inCurrentMonth).length;
  assert.equal(inMonthCount, 31);
});

test('buildMonthlyFinancialEvents generates card post-close window, weekend shift, and extinction milestone', () => {
  const seed = createSeedDecember2026();
  const periodItems = seed.filter((i) => i.periodo === '2026-12');
  const match = runCashFlowMatcher('2026-12', seed, '2026-12-05');
  const events = buildMonthlyFinancialEvents('2026-12', match, periodItems);

  // Ventana post-cierre para Patagonia (cierra 10/12 -> abre 11/12)
  const patWindow = events.find(
    (e) =>
      e.kind === 'VENTANA_TARJETA' && e.itemId === 'dic26-tarj-patagonia'
  );
  assert.ok(patWindow);
  assert.equal(patWindow.dateISO, '2026-12-11');

  // Luz vence sábado 12/12 -> evento calendario adelantado al viernes 11/12
  const luzDue = events.find(
    (e) => e.kind === 'VENCIMIENTO' && e.itemId === 'dic26-srv-luz'
  );
  assert.ok(luzDue);
  assert.equal(luzDue.dateISO, '2026-12-11');
  assert.equal(luzDue.shiftedFromWeekend, true);
  assert.equal(luzDue.originalDueISO, '2026-12-12');

  // Carrefour Máquina 9/9 genera hito EXTINCION_CUOTA
  const extEvent = events.find(
    (e) =>
      e.kind === 'EXTINCION_CUOTA' && e.itemId === 'dic26-carrefour-maquina'
  );
  assert.ok(extEvent);
  assert.equal(extEvent.dateISO, '2026-12-04');
});

test('generateICSContent produces valid RFC 5545 VCALENDAR output', () => {
  const seed = createSeedDecember2026();
  const periodItems = seed.filter((i) => i.periodo === '2026-12');
  const match = runCashFlowMatcher('2026-12', seed, '2026-12-05');
  const events = buildMonthlyFinancialEvents('2026-12', match, periodItems).slice(0, 2);

  const ics = generateICSContent(events, 'ArgenCaja Dic 2026', 1);
  assert.ok(ics.includes('BEGIN:VCALENDAR'));
  assert.ok(ics.includes('END:VCALENDAR'));
  assert.ok(ics.includes('BEGIN:VEVENT'));
  assert.ok(ics.includes('BEGIN:VALARM'));
  assert.ok(ics.includes('TRIGGER:-P1D'));
});

test('effective paid-amount accounting updates colchonComida, carryover, and variances', () => {
  const seed = createSeedDecember2026();
  const baseMatch = runCashFlowMatcher('2026-12', seed, '2026-12-05');

  // Simulamos que Luz (1° Quincena) vino +$15.000 más cara y Sueldo Seguridad 1°Q cobró +$50.000 extra
  const modified = seed.map((it) => {
    if (it.id === 'dic26-srv-luz') {
      return {
        ...it,
        estado: 'PAGADO' as const,
        montoPagado: MoneyUtils.addAmounts(it.montoPactado, 15000),
      };
    }
    if (it.id === 'dic26-ing-seg1') {
      return {
        ...it,
        estado: 'PAGADO' as const,
        montoPagado: MoneyUtils.addAmounts(it.montoPactado, 50000),
      };
    }
    return it;
  });

  const paidLuz = modified.find((i) => i.id === 'dic26-srv-luz')!;
  assert.equal(getEffectiveItemAmountCents(paidLuz), MoneyUtils.toCents(paidLuz.montoPagado!));

  const realMatch = runCashFlowMatcher('2026-12', modified, '2026-12-05');
  assert.equal(realMatch.summary.desvioObligacionesCents, 1500000);
  assert.equal(realMatch.summary.desvioIngresosCents, 5000000);
  // El colchón neto sube en +$35.000 ($50k ingreso extra - $15k gasto extra)
  assert.equal(
    realMatch.summary.colchonComidaCents - baseMatch.summary.colchonComidaCents,
    3500000
  );
  // En 1° Quincena, el remanente de arrastre a Q2 refleja el neto +$35.000
  assert.equal(
    realMatch.q2.remanenteArrastreCents - baseMatch.q2.remanenteArrastreCents,
    3500000
  );
});

test('computeFoodBudgetStatus calculates monthly spend, remaining cushion, and daily allowance', () => {
  const status = computeFoodBudgetStatus(
    '2026-12',
    [
      {
        id: 'f1',
        periodo: '2026-12',
        concepto: 'Coto semanal',
        monto: 180000,
        fechaISO: '2026-12-05',
        createdByUid: 'u1',
        createdByEmail: 'a@b.com',
      },
      {
        id: 'f2',
        periodo: '2026-12',
        concepto: 'Carnicería',
        monto: 120000,
        fechaISO: '2026-12-10',
        createdByUid: 'u1',
        createdByEmail: 'a@b.com',
      },
      {
        id: 'f-other-month',
        periodo: '2027-01',
        concepto: 'Otro mes',
        monto: 999999,
        fechaISO: '2027-01-02',
        createdByUid: 'u1',
        createdByEmail: 'a@b.com',
      },
    ],
    106377044,
    90000000,
    '2026-12-12'
  );

  assert.equal(status.gastadoMesCents, 30000000); // $300.000
  assert.equal(status.cantidadCompras, 2);
  assert.equal(status.restanteSobreMinimoCents, 60000000); // $600.000
  assert.equal(status.restanteSobreDisponibleRealCents, 76377044);
  assert.equal(status.diasRestantesMes, 20); // 12..31 inclusive = 20 días
  assert.equal(status.presupuestoDiarioSugeridoCents, 3000000); // $30.000/día
  assert.equal(status.excedeMinimo, false);
});

test('amortizeRotatingCardCapital lowers capital, clamps at 0, truncates notes, and propagates future months', () => {
  const projected = projectMultipleMonths('2026-12', 2, createSeedDecember2026());
  const patDec = projected.find((i) => i.id === 'dic26-tarj-patagonia')!;
  const originalCap = patDec.saldoCapitalTotal ?? 0;

  const res = amortizeRotatingCardCapital(
    projected,
    'dic26-tarj-patagonia',
    258815.9,
    '2026-12-15',
    true
  );
  assert.ok(res);
  assert.equal(res.nextCapitalARS, MoneyUtils.subtractAmounts(originalCap, 258815.9));
  assert.ok(res.monthlyInterestSavedCents > 0);
  // Actualiza dic 2026 + ene 2027 + feb 2027 = 3 ítems
  assert.equal(res.changedItems.length, 3);
  for (const ch of res.changedItems) {
    assert.equal(ch.saldoCapitalTotal, res.nextCapitalARS);
    assert.ok((ch.notas?.length ?? 0) <= 1000);
  }

  // Amortización mayor al capital restante debe hacer clamp exacto en $0
  const fullPayoff = amortizeRotatingCardCapital(
    res.updatedItems,
    'dic26-tarj-patagonia',
    99999999,
    '2026-12-20',
    false
  );
  assert.ok(fullPayoff);
  assert.equal(fullPayoff.nextCapitalARS, 0);
});

test('computeNextMonthProjection forecasts next period without mutating items and respects existing next period', () => {
  const seed = createSeedDecember2026();
  const simulated = computeNextMonthProjection('2026-12', seed);
  assert.equal(simulated.nextPeriodo, '2027-01');
  assert.equal(simulated.isAlreadyGenerated, false);
  // Carrefour Máquina ($98.046,49) + cuota $180k Patagonia caen en Enero 2027
  assert.ok(simulated.deltaObligacionesCents <= -MoneyUtils.toCents(98046.49));
  assert.ok(
    simulated.extinguishingItems.some((c) => c.titulo.includes('Carrefour'))
  );

  // Si ya existe Enero 2027 generado, isAlreadyGenerated debe ser true
  const withJan = [...seed, ...closeAndCloneMonth('2026-12', seed).newItems];
  const existing = computeNextMonthProjection('2026-12', withJan);
  assert.equal(existing.isAlreadyGenerated, true);
  assert.equal(
    existing.nextSummary.obligacionesFijasTotalesCents,
    simulated.nextSummary.obligacionesFijasTotalesCents
  );
});

test('buildCalendarEventSig changes when event date, amount, or paid state changes', () => {
  const seed = createSeedDecember2026();
  const periodItems = seed.filter((i) => i.periodo === '2026-12');
  const match = runCashFlowMatcher('2026-12', seed, '2026-12-05');
  const ev = buildMonthlyFinancialEvents('2026-12', match, periodItems)[0];

  const sig1 = buildCalendarEventSig(ev);
  const sigMoved = buildCalendarEventSig({ ...ev, dateISO: '2026-12-20' });
  const sigPaid = buildCalendarEventSig({ ...ev, isPaid: true });
  const sigAmount = buildCalendarEventSig({ ...ev, amountARS: ev.amountARS + 500 });

  assert.notEqual(sig1, sigMoved);
  assert.notEqual(sig1, sigPaid);
  assert.notEqual(sig1, sigAmount);
});




