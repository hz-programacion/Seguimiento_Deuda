import {
  BankingPaymentStatus,
  CashFlowMatchResult,
  ItemFinanciero,
  MatchedAllocation,
  MonthSummary,
  PeriodoID,
  PrioridadPago,
  QuincenaCaja,
  SurplusRecommendation,
} from '../types/finance';
import {
  addDaysISO,
  diffDaysISO,
  formatShortDateAR,
  getLastBusinessDayOnOrBefore,
} from './dateUtils';
import { MoneyUtils } from './moneyUtils';

export function isIncomeCategory(cat: ItemFinanciero['categoria']): boolean {
  return cat === 'INGRESO_HABITUAL' || cat === 'INGRESO_EXTRA_SAC';
}

export function isObligationCategory(cat: ItemFinanciero['categoria']): boolean {
  return (
    cat === 'SERVICIO_HOGAR' ||
    cat === 'CUOTA_FIJA' ||
    cat === 'TARJETA_ROTATIVA'
  );
}

export function isTarjetaGrupo(item: ItemFinanciero): boolean {
  if (item.categoria === 'TARJETA_ROTATIVA') return true;
  if (
    item.categoria === 'CUOTA_FIJA' &&
    item.subgrupo?.toLowerCase().includes('tarjeta')
  ) {
    return true;
  }
  return false;
}

export function computeMonthSummary(
  periodo: PeriodoID,
  periodItems: ItemFinanciero[]
): MonthSummary {
  let ingresosHabitualesCents = 0;
  let ingresosSacCents = 0;
  let serviciosHogarCents = 0;
  let cuotasFijasCents = 0;
  let tarjetasTotalesCents = 0;
  let totalPagadoCents = 0;
  let totalPendienteCents = 0;
  let alivioMensualGanadoCents = 0;
  let itemsExtinguidosCount = 0;

  for (const item of periodItems) {
    if (item.estado === 'EXTINGUIDO') {
      itemsExtinguidosCount += 1;
      alivioMensualGanadoCents += MoneyUtils.toCents(
        item.montoLiberadoAlExtinguirse ?? item.montoPactado
      );
      continue;
    }

    const pactadoCents = MoneyUtils.toCents(item.montoPactado);

    if (item.categoria === 'INGRESO_HABITUAL') {
      ingresosHabitualesCents += pactadoCents;
      continue;
    }
    if (item.categoria === 'INGRESO_EXTRA_SAC') {
      ingresosSacCents += pactadoCents;
      continue;
    }

    if (!isObligationCategory(item.categoria)) {
      continue;
    }

    if (item.categoria === 'SERVICIO_HOGAR') {
      serviciosHogarCents += pactadoCents;
    } else if (isTarjetaGrupo(item)) {
      tarjetasTotalesCents += pactadoCents;
    } else if (item.categoria === 'CUOTA_FIJA') {
      cuotasFijasCents += pactadoCents;
    }

    if (item.estado === 'PAGADO') {
      const pagadoReal =
        item.montoPagado !== undefined ? item.montoPagado : item.montoPactado;
      totalPagadoCents += MoneyUtils.toCents(pagadoReal);
    } else {
      totalPendienteCents += pactadoCents;
    }
  }

  const ingresosTotalesCents = ingresosHabitualesCents + ingresosSacCents;
  const obligacionesFijasTotalesCents =
    serviciosHogarCents + cuotasFijasCents + tarjetasTotalesCents;
  const colchonComidaCents =
    ingresosTotalesCents - obligacionesFijasTotalesCents;

  const totalCompromisosParaAvance = totalPagadoCents + totalPendienteCents;
  const porcentajeAvance = MoneyUtils.percent(
    totalPagadoCents,
    totalCompromisosParaAvance
  );

  return {
    periodo,
    ingresosHabitualesCents,
    ingresosSacCents,
    ingresosTotalesCents,
    serviciosHogarCents,
    cuotasFijasCents,
    tarjetasTotalesCents,
    obligacionesFijasTotalesCents,
    colchonComidaCents,
    totalPagadoCents,
    totalPendienteCents,
    porcentajeAvance,
    alivioMensualGanadoCents,
    itemsExtinguidosCount,
  };
}

export interface BankingAdvisory {
  bloqueadoPorCierre: boolean;
  ventanaPagoDesdeISO?: string;
  fechaLimiteRecomendadaISO: string;
  avisoBancario?: string;
}

/**
 * Reglas del sistema bancario argentino:
 * 1) Regla anti-doble-pago por cierre de tarjeta: si la fecha de análisis es <= fechaCierre
 *    (y cierre < vencimiento), pagar hoy solo amortiza saldo del ciclo en curso y NO computa
 *    como Pago Mínimo del resumen que está por cerrar (forzaría a pagar dos veces).
 * 2) Clearing / Fin de semana: si el vencimiento cae sábado o domingo, recomienda transferir
 *    el viernes hábil anterior para evitar mora o punitorios por acreditación T+1.
 */
export function evaluateArgentineBankingRules(
  item: ItemFinanciero,
  referenceDateISO: string
): BankingAdvisory {
  const businessDue = getLastBusinessDayOnOrBefore(item.fechaExactaVencimiento);
  const fechaLimiteRecomendadaISO = businessDue.recommendedISO;
  const notes: string[] = [];

  let bloqueadoPorCierre = false;
  let ventanaPagoDesdeISO: string | undefined;

  if (
    item.estado === 'PENDIENTE' &&
    item.fechaCierre &&
    (isTarjetaGrupo(item) || Boolean(item.fechaCierre)) &&
    item.fechaCierre < item.fechaExactaVencimiento
  ) {
    const postCloseStart = addDaysISO(item.fechaCierre, 1);
    ventanaPagoDesdeISO = postCloseStart;

    if (referenceDateISO <= item.fechaCierre) {
      bloqueadoPorCierre = true;
      notes.push(
        `NO pagar antes del cierre (${formatShortDateAR(item.fechaCierre)}): el banco lo toma como adelanto y no cancela el Pago Mínimo (riesgo de doble pago). Ventana válida: ${formatShortDateAR(postCloseStart)} al ${formatShortDateAR(fechaLimiteRecomendadaISO)}.`
      );
    } else {
      notes.push(
        `Resumen cerrado (${formatShortDateAR(item.fechaCierre)}): ya computa como pago del ciclo. Abonar antes del ${formatShortDateAR(fechaLimiteRecomendadaISO)}.`
      );
    }
  }

  if (businessDue.shiftedFromWeekend && item.estado === 'PENDIENTE') {
    notes.push(
      `Vence en fin de semana (${formatShortDateAR(item.fechaExactaVencimiento)}): transferir el día hábil previo (${formatShortDateAR(fechaLimiteRecomendadaISO)}) para asegurar acreditación.`
    );
  }

  return {
    bloqueadoPorCierre,
    ventanaPagoDesdeISO,
    fechaLimiteRecomendadaISO,
    avisoBancario: notes.length > 0 ? notes.join(' ') : undefined,
  };
}

export function classifyPaymentPriority(
  item: ItemFinanciero,
  referenceDateISO: string
): { prioridad: PrioridadPago; razon: string; diasHastaVencimiento: number } {
  const dias = diffDaysISO(referenceDateISO, item.fechaExactaVencimiento);
  const banking = evaluateArgentineBankingRules(item, referenceDateISO);

  // Si la tarjeta todavía no cerró, no debe empujarse como urgente hoy (evitar doble pago)
  if (banking.bloqueadoPorCierre) {
    return {
      prioridad: 'NORMAL',
      razon: `Esperar al cierre (${formatShortDateAR(item.fechaCierre!)}) para no pagar dos veces en el mismo ciclo`,
      diasHastaVencimiento: dias,
    };
  }

  if (
    item.esCuotaFija &&
    item.cuotaActual !== undefined &&
    item.cuotasTotales !== undefined &&
    item.cuotasTotales - item.cuotaActual <= 1
  ) {
    const esUltima = item.cuotaActual === item.cuotasTotales;
    return {
      prioridad: 'CRITICA',
      razon: esUltima
        ? `Última cuota (${item.cuotaActual}/${item.cuotasTotales}): se extingue al cerrar el mes`
        : `Anteúltima cuota (${item.cuotaActual}/${item.cuotasTotales}): próxima a extinguirse`,
      diasHastaVencimiento: dias,
    };
  }

  if (item.categoria === 'SERVICIO_HOGAR') {
    const titleLower = item.titulo.toLowerCase();
    const esCorte =
      titleLower.includes('luz') ||
      titleLower.includes('gas') ||
      titleLower.includes('agua') ||
      titleLower.includes('internet');
    if (esCorte || dias <= 3) {
      return {
        prioridad: 'CRITICA',
        razon:
          dias < 0
            ? 'Servicio vencido: riesgo de corte e intereses por mora'
            : 'Servicio esencial con riesgo de corte ante atraso',
        diasHastaVencimiento: dias,
      };
    }
  }

  if (isTarjetaGrupo(item) && dias <= 5) {
    return {
      prioridad: dias <= 2 ? 'CRITICA' : 'ALTA',
      razon:
        dias < 0
          ? 'Resumen vencido: evitar intereses punitorios y recargo BCRA'
          : `Vence en ${dias} día${dias === 1 ? '' : 's'} (post-cierre): evitar punitorios de tarjeta`,
      diasHastaVencimiento: dias,
    };
  }

  if (item.categoria === 'TARJETA_ROTATIVA') {
    return {
      prioridad: 'ALTA',
      razon: 'Tarjeta rotativa con tasa de financiación sobre saldo',
      diasHastaVencimiento: dias,
    };
  }

  if (dias <= 3) {
    return {
      prioridad: 'ALTA',
      razon:
        dias < 0
          ? 'Vencimiento pasado: regularizar cuanto antes'
          : `Vence en ${dias} día${dias === 1 ? '' : 's'}`,
      diasHastaVencimiento: dias,
    };
  }

  return {
    prioridad: 'NORMAL',
    razon: 'Obligación programada dentro de su quincena',
    diasHastaVencimiento: dias,
  };
}

function priorityWeight(p: PrioridadPago): number {
  if (p === 'CRITICA') return 0;
  if (p === 'ALTA') return 1;
  return 2;
}

function matchWindowAllocations(
  incomes: ItemFinanciero[],
  obligations: ItemFinanciero[],
  carryoverCents: number,
  reservaComidaWindowCents: number,
  referenceDateISO: string
): {
  asignaciones: MatchedAllocation[];
  presupuestoPagableSinComidaCents: number;
  totalRecomendadoAhoraCents: number;
  totalEsperandoCierreCents: number;
  totalExcedeTopeCents: number;
  obligacionesPagadasCents: number;
  obligacionesPendientesCents: number;
} {
  // Ordenar: primero ítems pendientes pagables hoy por prioridad + fecha de vencimiento;
  // luego ítems esperando cierre; luego ítems ya pagados.
  const enriched = obligations
    .map((ob) => {
      const pInfo = classifyPaymentPriority(ob, referenceDateISO);
      const banking = evaluateArgentineBankingRules(ob, referenceDateISO);
      return { ob, pInfo, banking };
    })
    .sort((a, b) => {
      if (a.ob.estado !== b.ob.estado) {
        return a.ob.estado === 'PENDIENTE' ? -1 : 1;
      }
      if (a.banking.bloqueadoPorCierre !== b.banking.bloqueadoPorCierre) {
        return a.banking.bloqueadoPorCierre ? 1 : -1;
      }
      const pw =
        priorityWeight(a.pInfo.prioridad) - priorityWeight(b.pInfo.prioridad);
      if (pw !== 0) return pw;
      const dueCmp = a.ob.fechaExactaVencimiento.localeCompare(
        b.ob.fechaExactaVencimiento
      );
      if (dueCmp !== 0) return dueCmp;
      return a.ob.diaVencimientoOCobro - b.ob.diaVencimientoOCobro;
    });

  // Pool de bolsillos brutos disponibles en la quincena
  const pockets = incomes
    .slice()
    .sort((a, b) => a.diaVencimientoOCobro - b.diaVencimientoOCobro)
    .map((inc) => ({
      titulo: inc.titulo,
      bolsillo: inc.bolsilloResponsable,
      remainingCents: MoneyUtils.toCents(inc.montoPactado),
    }));

  if (carryoverCents > 0) {
    pockets.unshift({
      titulo: 'Remanente Quincena 1',
      bolsillo: 'Carryover Q1',
      remainingCents: carryoverCents,
    });
  }

  const totalDisponibleBrutoCents = pockets.reduce(
    (acc, p) => acc + p.remainingCents,
    0
  );

  let obligacionesPagadasCents = 0;
  let obligacionesPendientesCents = 0;

  for (const { ob } of enriched) {
    if (ob.estado === 'PAGADO') {
      obligacionesPagadasCents += MoneyUtils.toCents(
        ob.montoPagado !== undefined ? ob.montoPagado : ob.montoPactado
      );
    } else {
      obligacionesPendientesCents += MoneyUtils.toCents(ob.montoPactado);
    }
  }

  // Presupuesto máximo pagable sin invadir la reserva de comida de la quincena
  const presupuestoPagableSinComidaCents = Math.max(
    0,
    totalDisponibleBrutoCents - reservaComidaWindowCents
  );
  let presupuestoSeguroRestanteCents = Math.max(
    0,
    presupuestoPagableSinComidaCents - obligacionesPagadasCents
  );

  // Descontar de los bolsillos primero lo que ya se pagó este período
  let paidToDeduct = obligacionesPagadasCents;
  for (const p of pockets) {
    if (paidToDeduct <= 0) break;
    const take = Math.min(p.remainingCents, paidToDeduct);
    p.remainingCents -= take;
    paidToDeduct -= take;
  }

  let totalRecomendadoAhoraCents = 0;
  let totalEsperandoCierreCents = 0;
  let totalExcedeTopeCents = 0;

  const asignaciones: MatchedAllocation[] = [];

  for (const { ob, pInfo, banking } of enriched) {
    const neededCents = MoneyUtils.toCents(ob.montoPactado);

    if (ob.estado === 'PAGADO') {
      asignaciones.push({
        obligacion: ob,
        prioridad: pInfo.prioridad,
        razonPrioridad: pInfo.razon,
        diasHastaVencimiento: pInfo.diasHastaVencimiento,
        bankingStatus: 'PAGADO',
        bloqueadoPorCierre: false,
        ventanaPagoDesdeISO: banking.ventanaPagoDesdeISO,
        fechaLimiteRecomendadaISO: banking.fechaLimiteRecomendadaISO,
        avisoBancario: banking.avisoBancario,
        bolsillosSugeridos: [
          {
            titulo: 'Pagado',
            bolsillo: ob.bolsilloResponsable,
            montoAsignadoCents: MoneyUtils.toCents(
              ob.montoPagado ?? ob.montoPactado
            ),
          },
        ],
        cubiertoCents: neededCents,
        faltanteCents: 0,
        excedeTopeComidaCents: 0,
      });
      continue;
    }

    // Si la tarjeta todavía no cerró, NO consumir presupuesto ni sugerir pago inmediato
    if (banking.bloqueadoPorCierre) {
      totalEsperandoCierreCents += neededCents;
      asignaciones.push({
        obligacion: ob,
        prioridad: pInfo.prioridad,
        razonPrioridad: pInfo.razon,
        diasHastaVencimiento: pInfo.diasHastaVencimiento,
        bankingStatus: 'ESPERAR_CIERRE',
        bloqueadoPorCierre: true,
        ventanaPagoDesdeISO: banking.ventanaPagoDesdeISO,
        fechaLimiteRecomendadaISO: banking.fechaLimiteRecomendadaISO,
        avisoBancario: banking.avisoBancario,
        bolsillosSugeridos: [],
        cubiertoCents: 0,
        faltanteCents: 0,
        excedeTopeComidaCents: 0,
      });
      continue;
    }

    // Evaluar si entra dentro del tope seguro (ingresos - reserva comida)
    if (neededCents <= presupuestoSeguroRestanteCents) {
      presupuestoSeguroRestanteCents -= neededCents;
      totalRecomendadoAhoraCents += neededCents;

      let remainingToCover = neededCents;
      const bolsillosSugeridos: MatchedAllocation['bolsillosSugeridos'] = [];

      const preferred = pockets.find(
        (p) =>
          p.remainingCents > 0 &&
          p.bolsillo.toLowerCase() === ob.bolsilloResponsable.toLowerCase()
      );
      if (preferred && remainingToCover > 0) {
        const take = Math.min(preferred.remainingCents, remainingToCover);
        preferred.remainingCents -= take;
        remainingToCover -= take;
        bolsillosSugeridos.push({
          titulo: preferred.titulo,
          bolsillo: preferred.bolsillo,
          montoAsignadoCents: take,
        });
      }

      for (const p of pockets) {
        if (remainingToCover <= 0) break;
        if (p.remainingCents <= 0) continue;
        const take = Math.min(p.remainingCents, remainingToCover);
        p.remainingCents -= take;
        remainingToCover -= take;
        bolsillosSugeridos.push({
          titulo: p.titulo,
          bolsillo: p.bolsillo,
          montoAsignadoCents: take,
        });
      }

      asignaciones.push({
        obligacion: ob,
        prioridad: pInfo.prioridad,
        razonPrioridad: pInfo.razon,
        diasHastaVencimiento: pInfo.diasHastaVencimiento,
        bankingStatus: 'PAGAR_AHORA',
        bloqueadoPorCierre: false,
        ventanaPagoDesdeISO: banking.ventanaPagoDesdeISO,
        fechaLimiteRecomendadaISO: banking.fechaLimiteRecomendadaISO,
        avisoBancario: banking.avisoBancario,
        bolsillosSugeridos,
        cubiertoCents: neededCents - remainingToCover,
        faltanteCents: remainingToCover,
        excedeTopeComidaCents: 0,
      });
    } else {
      // Excede la caja disponible después de resguardar el mínimo de comida
      const excedeCents = Math.max(
        0,
        neededCents - presupuestoSeguroRestanteCents
      );
      totalExcedeTopeCents += neededCents;

      const cardMinimumWarning = isTarjetaGrupo(ob)
        ? 'No hagas pagos parciales menores al Pago Mínimo salvo que completes el resto antes del vencimiento, porque igualmente corren intereses punitorios. '
        : '';

      const extraNote = `${cardMinimumWarning}Supera en ${MoneyUtils.formatARSCents(
        excedeCents
      )} tu caja libre tras proteger la comida: conviene pasarlo a 2° Quincena (si el vencimiento da margen) o cubrirlo con reserva previa.`;

      const combinedNote = banking.avisoBancario
        ? `${banking.avisoBancario} ${extraNote}`
        : extraNote;

      asignaciones.push({
        obligacion: ob,
        prioridad: pInfo.prioridad,
        razonPrioridad: pInfo.razon,
        diasHastaVencimiento: pInfo.diasHastaVencimiento,
        bankingStatus: 'EXCEDE_TOPE_COMIDA' as BankingPaymentStatus,
        bloqueadoPorCierre: false,
        ventanaPagoDesdeISO: banking.ventanaPagoDesdeISO,
        fechaLimiteRecomendadaISO: banking.fechaLimiteRecomendadaISO,
        avisoBancario: combinedNote,
        bolsillosSugeridos: [],
        cubiertoCents: 0,
        faltanteCents: Math.max(0, neededCents - totalDisponibleBrutoCents),
        excedeTopeComidaCents: excedeCents,
      });
    }
  }

  return {
    asignaciones,
    presupuestoPagableSinComidaCents,
    totalRecomendadoAhoraCents,
    totalEsperandoCierreCents,
    totalExcedeTopeCents,
    obligacionesPagadasCents,
    obligacionesPendientesCents,
  };
}

export function runCashFlowMatcher(
  periodo: PeriodoID,
  allItems: ItemFinanciero[],
  referenceDateISO?: string,
  minFoodCushionCents = 90000000
): CashFlowMatchResult {
  const periodItems = allItems.filter((i) => i.periodo === periodo);
  const refDate = referenceDateISO ?? `${periodo}-01`;
  const summary = computeMonthSummary(periodo, periodItems);

  const activeItems = periodItems.filter((i) => i.estado !== 'EXTINGUIDO');

  const q1Incomes = activeItems.filter(
    (i) => isIncomeCategory(i.categoria) && i.ventanaAsignada === 'Q1_DIAS_1_AL_14'
  );
  const q2Incomes = activeItems.filter(
    (i) => isIncomeCategory(i.categoria) && i.ventanaAsignada === 'Q2_DIAS_15_AL_31'
  );

  const q1Obligations = activeItems.filter(
    (i) =>
      isObligationCategory(i.categoria) &&
      i.ventanaAsignada === 'Q1_DIAS_1_AL_14'
  );
  const q2Obligations = activeItems.filter(
    (i) =>
      isObligationCategory(i.categoria) &&
      i.ventanaAsignada === 'Q2_DIAS_15_AL_31'
  );

  const q1IngresosCents = MoneyUtils.sumCents(
    q1Incomes.map((i) => MoneyUtils.toCents(i.montoPactado))
  );
  const q1ObligacionesCents = MoneyUtils.sumCents(
    q1Obligations.map((i) => MoneyUtils.toCents(i.montoPactado))
  );

  // Reserva razonable para comida: mitad exacta del mínimo mensual configurado en Q1
  // (nunca inflada artificialmente si sobra más plata en el mes).
  const safeMinFoodCents = Math.max(0, minFoodCushionCents);
  const reservaComidaQ1Cents = Math.round(safeMinFoodCents / 2);

  const q1Match = matchWindowAllocations(
    q1Incomes,
    q1Obligations,
    0,
    reservaComidaQ1Cents,
    refDate
  );
  const q1SaldoLibrePostPagosCents = q1IngresosCents - q1ObligacionesCents;

  // Descalce Q1: si las obligaciones Q1 superan los ingresos Q1 o invaden la reserva mínima de comida Q1
  const q1DisponibleSinTocarComidaCents = Math.max(
    0,
    q1IngresosCents - reservaComidaQ1Cents
  );
  const q1DescalceCents = Math.max(
    0,
    q1ObligacionesCents - q1DisponibleSinTocarComidaCents
  );
  const q1FaltaPuraCents = Math.max(0, q1ObligacionesCents - q1IngresosCents);

  const q1Caja: QuincenaCaja = {
    ventana: 'Q1_DIAS_1_AL_14',
    titulo: 'Caja Quincena 1',
    rangoDias: 'Días 01 al 14',
    ingresosCents: q1IngresosCents,
    remanenteArrastreCents: 0,
    disponibleTotalCents: q1IngresosCents,
    obligacionesCents: q1ObligacionesCents,
    obligacionesPagadasCents: q1Match.obligacionesPagadasCents,
    obligacionesPendientesCents: q1Match.obligacionesPendientesCents,
    reservaComidaSugeridaCents: reservaComidaQ1Cents,
    presupuestoPagableSinComidaCents: q1Match.presupuestoPagableSinComidaCents,
    totalRecomendadoAhoraCents: q1Match.totalRecomendadoAhoraCents,
    totalEsperandoCierreCents: q1Match.totalEsperandoCierreCents,
    totalExcedeTopeCents: q1Match.totalExcedeTopeCents,
    saldoLibrePostPagosCents: q1SaldoLibrePostPagosCents,
    descalceCents: q1DescalceCents,
    itemsIngreso: q1Incomes
      .slice()
      .sort((a, b) => a.diaVencimientoOCobro - b.diaVencimientoOCobro),
    asignaciones: q1Match.asignaciones,
  };

  // Q2 recibe ingresos Q2 + remanente operativo de Q1 (incluye el resguardo Q1 no gastado en deudas,
  // por lo que la reserva total a proteger hasta fin de mes es el mínimo mensual completo).
  const q1RemanenteParaQ2Cents = Math.max(0, q1SaldoLibrePostPagosCents);
  const q2IngresosCents = MoneyUtils.sumCents(
    q2Incomes.map((i) => MoneyUtils.toCents(i.montoPactado))
  );
  const q2DisponibleTotalCents = q2IngresosCents + q1RemanenteParaQ2Cents;
  const q2ObligacionesCents = MoneyUtils.sumCents(
    q2Obligations.map((i) => MoneyUtils.toCents(i.montoPactado))
  );
  const reservaComidaQ2TotalCents = safeMinFoodCents;

  const q2Match = matchWindowAllocations(
    q2Incomes,
    q2Obligations,
    q1RemanenteParaQ2Cents,
    reservaComidaQ2TotalCents,
    refDate
  );

  const q2SaldoLibrePostPagosCents = q2DisponibleTotalCents - q2ObligacionesCents;
  const q2DisponibleSinTocarComidaCents = Math.max(
    0,
    q2DisponibleTotalCents - reservaComidaQ2TotalCents
  );
  const q2DescalceCents = Math.max(
    0,
    q2ObligacionesCents - q2DisponibleSinTocarComidaCents
  );

  const q2Caja: QuincenaCaja = {
    ventana: 'Q2_DIAS_15_AL_31',
    titulo: 'Caja Quincena 2',
    rangoDias: 'Días 15 al 31',
    ingresosCents: q2IngresosCents,
    remanenteArrastreCents: q1RemanenteParaQ2Cents,
    disponibleTotalCents: q2DisponibleTotalCents,
    obligacionesCents: q2ObligacionesCents,
    obligacionesPagadasCents: q2Match.obligacionesPagadasCents,
    obligacionesPendientesCents: q2Match.obligacionesPendientesCents,
    reservaComidaSugeridaCents: Math.max(
      0,
      safeMinFoodCents - reservaComidaQ1Cents
    ),
    presupuestoPagableSinComidaCents: q2Match.presupuestoPagableSinComidaCents,
    totalRecomendadoAhoraCents: q2Match.totalRecomendadoAhoraCents,
    totalEsperandoCierreCents: q2Match.totalEsperandoCierreCents,
    totalExcedeTopeCents: q2Match.totalExcedeTopeCents,
    saldoLibrePostPagosCents: q2SaldoLibrePostPagosCents,
    descalceCents: q2DescalceCents,
    itemsIngreso: q2Incomes
      .slice()
      .sort((a, b) => a.diaVencimientoOCobro - b.diaVencimientoOCobro),
    asignaciones: q2Match.asignaciones,
  };

  // Alerta temprana de descalce
  let mensajeDescalce =
    'Calce quincenal equilibrado: la 1° Quincena cubre sus vencimientos sin comprometer tu tope mínimo de comida.';
  if (q1FaltaPuraCents > 0) {
    mensajeDescalce = `Déficit de caja en 1° Quincena: los vencimientos del 01 al 14 superan los ingresos Q1 por ${MoneyUtils.formatARSCents(
      q1FaltaPuraCents
    )}. Reservá ${MoneyUtils.formatARSCents(
      q1DescalceCents
    )} del cierre anterior o pasá vencimientos posteriores al 15 a 2° Quincena para proteger ${MoneyUtils.formatARSCents(
      reservaComidaQ1Cents
    )} de comida.`;
  } else if (q1DescalceCents > 0) {
    mensajeDescalce = `Tope de comida Q1 ajustado: si pagás todas las cuentas del 01 al 14, quedarían ${MoneyUtils.formatARSCents(
      q1SaldoLibrePostPagosCents
    )}, es decir ${MoneyUtils.formatARSCents(
      q1DescalceCents
    )} por debajo de tu mínimo de comida Q1 (${MoneyUtils.formatARSCents(
      reservaComidaQ1Cents
    )}). Priorizá únicamente lo que entra dentro de ${MoneyUtils.formatARSCents(
      q1DisponibleSinTocarComidaCents
    )}.`;
  }

  const allPendingAllocations = [
    ...q1Match.asignaciones,
    ...q2Match.asignaciones,
  ].filter((a) => a.obligacion.estado === 'PENDIENTE');

  const tarjetasBloqueadasPorCierre = allPendingAllocations.filter(
    (a) => a.bankingStatus === 'ESPERAR_CIERRE'
  );

  const pagosPostergadosPorComida = allPendingAllocations.filter(
    (a) => a.bankingStatus === 'EXCEDE_TOPE_COMIDA'
  );

  // Cola de prioridad unificada: primero pagables hoy, luego postergados por comida, al final esperando cierre
  const statusOrder = (s: BankingPaymentStatus): number => {
    if (s === 'PAGAR_AHORA') return 0;
    if (s === 'EXCEDE_TOPE_COMIDA') return 1;
    if (s === 'ESPERAR_CIERRE') return 2;
    return 3;
  };

  const colaPrioridad = allPendingAllocations.slice().sort((a, b) => {
    const sw = statusOrder(a.bankingStatus) - statusOrder(b.bankingStatus);
    if (sw !== 0) return sw;
    const pw = priorityWeight(a.prioridad) - priorityWeight(b.prioridad);
    if (pw !== 0) return pw;
    return a.obligacion.fechaExactaVencimiento.localeCompare(
      b.obligacion.fechaExactaVencimiento
    );
  });

  // Simulador de Aguinaldo / Excedente
  const mpRadar = activeItems.find((i) => i.categoria === 'DEUDA_CON_QUITA');
  const patagonia = activeItems.find((i) =>
    i.titulo.toLowerCase().includes('patagonia')
  );

  const mpQuitaCents = MoneyUtils.toCents(
    mpRadar?.montoOfertaQuitaContado ?? 459867.07
  );
  const mpNominalCents = MoneyUtils.toCents(
    mpRadar?.saldoCapitalTotal ?? 2179464.81
  );
  const ahorroQuitaCents = Math.max(0, mpNominalCents - mpQuitaCents);

  const patagoniaCapitalCents = MoneyUtils.toCents(
    patagonia?.saldoCapitalTotal ?? 1258815.9
  );

  const excedenteExtraordinarioCents =
    summary.ingresosSacCents + summary.alivioMensualGanadoCents;
  const tieneExcedente = excedenteExtraordinarioCents > 0;
  const excedenteParaSimular = tieneExcedente
    ? excedenteExtraordinarioCents
    : Math.max(0, summary.colchonComidaCents - safeMinFoodCents);

  const cubreQuitaCompleta =
    excedenteParaSimular >= mpQuitaCents && mpQuitaCents > 0;
  const patagoniaReduccionPct =
    patagoniaCapitalCents > 0
      ? Math.min(
          100,
          Math.round((excedenteParaSimular / patagoniaCapitalCents) * 1000) / 10
        )
      : 0;

  let recomendacionTexto =
    'Activá el Aguinaldo (SAC) o avanzá hacia Enero 2027 para simular cómo cancelar la quita de Mercado Pago o amortizar Banco Patagonia.';
  if (cubreQuitaCompleta) {
    recomendacionTexto = `Con tu excedente extraordinario (${MoneyUtils.formatARSCents(
      excedenteParaSimular
    )}) podés cancelar al 100% la quita de Mercado Pago (${MoneyUtils.formatARSCents(
      mpQuitaCents
    )}), extinguiendo ${MoneyUtils.formatARSCents(
      mpNominalCents
    )} de deuda nominal (ahorro neto de ${MoneyUtils.formatARSCents(
      ahorroQuitaCents
    )}) y dejando ${MoneyUtils.formatARSCents(
      excedenteParaSimular - mpQuitaCents
    )} de resguardo extra.`;
  } else if (excedenteParaSimular > 0) {
    recomendacionTexto = `Tu excedente de ${MoneyUtils.formatARSCents(
      excedenteParaSimular
    )} reduce en un ${patagoniaReduccionPct}% el capital puro de Banco Patagonia (${MoneyUtils.formatARSCents(
      patagoniaCapitalCents
    )}), bajando intereses futuros.`;
  }

  const simuladorExcedente: SurplusRecommendation = {
    tieneExcedente,
    excedenteBaseCents: excedenteParaSimular,
    mercadoPagoQuitaCents: mpQuitaCents,
    mercadoPagoNominalCents: mpNominalCents,
    ahorroQuitaCents,
    cubreQuitaCompleta,
    patagoniaCapitalCents,
    patagoniaReduccionPct,
    recomendacionTexto,
  };

  return {
    referenceDateISO: refDate,
    summary,
    q1: q1Caja,
    q2: q2Caja,
    alertaDescalce: {
      hayDescalce: q1DescalceCents > 0,
      montoAReservarCents: q1DescalceCents,
      mensaje: mensajeDescalce,
    },
    tarjetasBloqueadasPorCierre,
    pagosPostergadosPorComida,
    colaPrioridad,
    simuladorExcedente,
  };
}
