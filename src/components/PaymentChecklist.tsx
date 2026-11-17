import React, { useMemo, useState } from 'react';
import {
  Check,
  CheckCircle2,
  Clock,
  Paperclip,
  Pencil,
  Search,
  Trash2,
  TrendingDown,
  Undo2,
  Wallet,
} from 'lucide-react';
import {
  CashFlowMatchResult,
  ItemFinanciero,
} from '../types/finance';
import { formatDateAR, formatPeriodoLabel } from '../utils/dateUtils';
import { MoneyUtils } from '../utils/moneyUtils';
import {
  getEffectiveItemAmountCents,
  isIncomeCategory,
  isObligationCategory,
} from '../utils/cashFlowMatcher';
import { InlineAmountEditor } from './InlineAmountEditor';
import { InlineDateEditor } from './InlineDateEditor';

interface PaymentChecklistProps {
  matchResult: CashFlowMatchResult;
  periodItems: ItemFinanciero[];
  canEditFinances: boolean;
  onMarkPaid: (item: ItemFinanciero) => void;
  onUndoPaid: (item: ItemFinanciero) => void;
  onEditItem: (item: ItemFinanciero) => void;
  onQuickUpdateAmount: (item: ItemFinanciero, newAmount: number) => void;
  onQuickUpdateDates: (
    item: ItemFinanciero,
    updates: { fechaExactaVencimiento?: string; fechaCierre?: string }
  ) => void;
  onOpenReceipts: (item: ItemFinanciero) => void;
  onDeleteItem: (item: ItemFinanciero) => void;
}

type FilterMode =
  | 'TODOS'
  | 'PENDIENTES'
  | 'SERVICIOS'
  | 'PAGADOS'
  | 'Q1'
  | 'Q2'
  | 'INGRESOS';

const FILTER_TABS: Array<{ id: FilterMode; label: string }> = [
  { id: 'TODOS', label: 'Todos' },
  { id: 'PENDIENTES', label: 'Falta Pagar' },
  { id: 'SERVICIOS', label: 'Servicios' },
  { id: 'PAGADOS', label: 'Pagados' },
  { id: 'Q1', label: '1° Quincena' },
  { id: 'Q2', label: '2° Quincena' },
  { id: 'INGRESOS', label: 'Ingresos' },
];

interface ChecklistSectionGroup {
  id: string;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  headerBgClass: string;
  headerBorderClass: string;
  totalLabel: string;
  totalAmountCents: number;
  totalColorClass: string;
  items: ItemFinanciero[];
}

export const PaymentChecklist: React.FC<PaymentChecklistProps> = ({
  matchResult,
  periodItems,
  canEditFinances,
  onMarkPaid,
  onUndoPaid,
  onEditItem,
  onQuickUpdateAmount,
  onQuickUpdateDates,
  onOpenReceipts,
  onDeleteItem,
}) => {
  const [filter, setFilter] = useState<FilterMode>('TODOS');
  const [query, setQuery] = useState('');

  const priorityMap = useMemo(() => {
    const map = new Map<string, { label: string; color: string }>();
    for (const a of matchResult.colaPrioridad) {
      map.set(a.obligacion.id, {
        label:
          a.prioridad === 'CRITICA'
            ? 'Urgente'
            : a.prioridad === 'ALTA'
              ? 'Pronto'
              : 'Normal',
        color:
          a.prioridad === 'CRITICA'
            ? 'text-[#DC2626]'
            : a.prioridad === 'ALTA'
              ? 'text-[#B45309]'
              : 'text-[#747A88]',
      });
    }
    return map;
  }, [matchResult.colaPrioridad]);

  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    return periodItems
      .filter((item) => {
        if (filter === 'PENDIENTES') {
          return (
            isObligationCategory(item.categoria) && item.estado === 'PENDIENTE'
          );
        }
        if (filter === 'SERVICIOS') {
          return (
            item.categoria === 'SERVICIO_HOGAR' && item.estado !== 'EXTINGUIDO'
          );
        }
        if (filter === 'PAGADOS') {
          return (
            isObligationCategory(item.categoria) && item.estado === 'PAGADO'
          );
        }
        if (filter === 'Q1') {
          return (
            item.ventanaAsignada === 'Q1_DIAS_1_AL_14' &&
            item.estado !== 'EXTINGUIDO'
          );
        }
        if (filter === 'Q2') {
          return (
            item.ventanaAsignada === 'Q2_DIAS_15_AL_31' &&
            item.estado !== 'EXTINGUIDO'
          );
        }
        if (filter === 'INGRESOS') {
          return isIncomeCategory(item.categoria);
        }
        return true;
      })
      .filter((item) => {
        if (!q) return true;
        return (
          item.titulo.toLowerCase().includes(q) ||
          item.bolsilloResponsable.toLowerCase().includes(q) ||
          (item.subgrupo?.toLowerCase().includes(q) ?? false)
        );
      })
      .sort((a, b) => a.diaVencimientoOCobro - b.diaVencimientoOCobro);
  }, [periodItems, filter, query]);

  const groupedSections = useMemo<ChecklistSectionGroup[]>(() => {
    const pendingObligations = filteredItems.filter(
      (i) => isObligationCategory(i.categoria) && i.estado === 'PENDIENTE'
    );
    const incomes = filteredItems.filter(
      (i) => isIncomeCategory(i.categoria) && i.estado !== 'EXTINGUIDO'
    );
    const paidObligations = filteredItems.filter(
      (i) => isObligationCategory(i.categoria) && i.estado === 'PAGADO'
    );
    const extinguished = filteredItems.filter(
      (i) => i.estado === 'EXTINGUIDO'
    );

    const groups: ChecklistSectionGroup[] = [];

    if (pendingObligations.length > 0) {
      const sumCents = MoneyUtils.sumCents(
        pendingObligations.map((i) => MoneyUtils.toCents(i.montoPactado))
      );
      groups.push({
        id: 'por-pagar',
        title: `Cuentas por Pagar (${pendingObligations.length})`,
        subtitle: 'Servicios, tarjetas y cuotas pendientes de cancelar este mes',
        icon: <Clock className="h-4 w-4 text-[#D97706]" aria-hidden="true" />,
        headerBgClass: 'bg-[#FFFBEB]/75',
        headerBorderClass: 'border-[#FDE68A]',
        totalLabel: 'Subtotal pendiente',
        totalAmountCents: sumCents,
        totalColorClass: 'text-[#B45309]',
        items: pendingObligations,
      });
    }

    if (incomes.length > 0) {
      const sumCents = MoneyUtils.sumCents(
        incomes.map((i) => getEffectiveItemAmountCents(i))
      );
      groups.push({
        id: 'ingresos',
        title: `Ingresos del Mes (${incomes.length})`,
        subtitle: 'Sueldos, jubilaciones y aportes que fondean tus quincenas',
        icon: <Wallet className="h-4 w-4 text-[#1D4ED8]" aria-hidden="true" />,
        headerBgClass: 'bg-[#F4F7FF]',
        headerBorderClass: 'border-[#DCE7FE]',
        totalLabel: 'Total ingresos',
        totalAmountCents: sumCents,
        totalColorClass: 'text-[#1D4ED8]',
        items: incomes,
      });
    }

    if (paidObligations.length > 0) {
      const sumCents = MoneyUtils.sumCents(
        paidObligations.map((i) =>
          MoneyUtils.toCents(i.montoPagado ?? i.montoPactado)
        )
      );
      groups.push({
        id: 'pagados',
        title: `Cuentas Ya Pagadas (${paidObligations.length})`,
        subtitle: 'Pagos registrados este mes con su fecha real de abono',
        icon: (
          <CheckCircle2 className="h-4 w-4 text-[#1D4ED8]" aria-hidden="true" />
        ),
        headerBgClass: 'bg-[#F7F7F3]',
        headerBorderClass: 'border-[#E7E5DC]',
        totalLabel: 'Total pagado',
        totalAmountCents: sumCents,
        totalColorClass: 'text-[#111318]',
        items: paidObligations,
      });
    }

    if (extinguished.length > 0) {
      const sumCents = MoneyUtils.sumCents(
        extinguished.map((i) =>
          MoneyUtils.toCents(i.montoLiberadoAlExtinguirse ?? i.montoPactado)
        )
      );
      groups.push({
        id: 'extinguidos',
        title: `Cuotas Finalizadas (${extinguished.length})`,
        subtitle: 'Planes terminados que ya liberaron presupuesto mensual',
        icon: (
          <TrendingDown className="h-4 w-4 text-[#4338CA]" aria-hidden="true" />
        ),
        headerBgClass: 'bg-[#F5F3FF]',
        headerBorderClass: 'border-[#E0E7FF]',
        totalLabel: 'Alivio mensual',
        totalAmountCents: sumCents,
        totalColorClass: 'text-[#4338CA]',
        items: extinguished,
      });
    }

    return groups;
  }, [filteredItems]);

  const summaryTotals = useMemo(() => {
    let pendingCents = 0;
    let paidCents = 0;
    let incomeCents = 0;
    for (const item of filteredItems) {
      if (item.estado === 'EXTINGUIDO') continue;
      if (isIncomeCategory(item.categoria)) {
        incomeCents += getEffectiveItemAmountCents(item);
      } else if (isObligationCategory(item.categoria)) {
        if (item.estado === 'PAGADO') {
          paidCents += getEffectiveItemAmountCents(item);
        } else {
          pendingCents += MoneyUtils.toCents(item.montoPactado);
        }
      }
    }
    return { pendingCents, paidCents, incomeCents };
  }, [filteredItems]);

  return (
    <div className="space-y-7">
      {/* Encabezado */}
      <div className="flex flex-col gap-3 border-b border-[#D8D6CC] pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#1D4ED8]">
            Libro de Movimientos y Servicios
          </p>
          <h1 className="mt-0.5 font-display text-2xl font-bold tracking-tight text-[#111318] sm:text-3xl">
            Movimientos · {formatPeriodoLabel(matchResult.summary.periodo)}
          </h1>
          <p className="mt-1 text-xs text-[#525866] sm:text-sm">
            Registro completo del mes separado en bloques operativos: pendientes, ingresos, pagados y cuotas finalizadas.
          </p>
        </div>

        {/* Mini resumen numérico */}
        <div className="flex flex-wrap items-center gap-2 font-mono-tabular text-xs sm:gap-3">
          <div className="rounded-xl border border-[#DFDDD4] bg-white px-3 py-2 shadow-[0_1px_2px_rgba(17,19,24,0.03)]">
            <span className="font-sans text-[#686E7D]">Por pagar: </span>
            <span className="font-bold text-[#B45309]">
              {MoneyUtils.formatARSCents(summaryTotals.pendingCents)}
            </span>
          </div>
          <div className="rounded-xl border border-[#DFDDD4] bg-white px-3 py-2 shadow-[0_1px_2px_rgba(17,19,24,0.03)]">
            <span className="font-sans text-[#686E7D]">Ingresos: </span>
            <span className="font-bold text-[#1D4ED8]">
              {MoneyUtils.formatARSCents(summaryTotals.incomeCents)}
            </span>
          </div>
          <div className="rounded-xl border border-[#DFDDD4] bg-white px-3 py-2 shadow-[0_1px_2px_rgba(17,19,24,0.03)]">
            <span className="font-sans text-[#686E7D]">Pagado: </span>
            <span className="font-bold text-[#111318]">
              {MoneyUtils.formatARSCents(summaryTotals.paidCents)}
            </span>
          </div>
        </div>
      </div>

      {/* Filtros y búsqueda */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div
          role="tablist"
          aria-label="Filtros de movimientos"
          className="flex flex-wrap items-center gap-1 rounded-xl border border-[#DFDDD4] bg-white p-1 shadow-[0_1px_2px_rgba(17,19,24,0.03)]"
        >
          {FILTER_TABS.map((tab) => {
            const active = filter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setFilter(tab.id)}
                className={`min-h-[34px] rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                  active
                    ? 'bg-[#1D4ED8] text-white'
                    : 'text-[#525866] hover:bg-[#F7F7F3] hover:text-[#111318]'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="relative w-full lg:w-72">
          <label htmlFor="checklist-search" className="sr-only">
            Buscar pago, ingreso o bolsillo
          </label>
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#747A88]"
            aria-hidden="true"
          />
          <input
            id="checklist-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar concepto o bolsillo..."
            className="min-h-[40px] w-full rounded-xl border border-[#DFDDD4] bg-white py-2 pl-9 pr-3 text-sm text-[#111318] placeholder:text-[#747A88] shadow-[0_1px_2px_rgba(17,19,24,0.03)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1D4ED8]"
          />
        </div>
      </div>

      {/* Bloques separados por categoría operativa */}
      {groupedSections.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-[#DFDDD4] bg-white px-4 py-14 text-center shadow-[0_2px_8px_rgba(17,19,24,0.04)]">
          <p className="text-sm font-semibold text-[#111318]">
            No hay movimientos que coincidan con el filtro seleccionado
          </p>
          <button
            type="button"
            onClick={() => {
              setFilter('TODOS');
              setQuery('');
            }}
            className="mt-3 min-h-[36px] rounded-lg border border-[#DFDDD4] bg-[#F7F7F3] px-3.5 py-1.5 text-xs font-semibold text-[#111318] hover:bg-[#ECEAE2]"
          >
            Limpiar filtros
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {groupedSections.map((group) => (
            <section
              key={group.id}
              aria-labelledby={`group-heading-${group.id}`}
              className="overflow-hidden rounded-2xl border border-[#DFDDD4] bg-white shadow-[0_2px_10px_rgba(17,19,24,0.04)]"
            >
              {/* Cabecera distintiva del bloque */}
              <div
                className={`flex flex-col gap-2 border-b px-5 py-4 sm:flex-row sm:items-center sm:justify-between ${group.headerBgClass} ${group.headerBorderClass}`}
              >
                <div>
                  <h2
                    id={`group-heading-${group.id}`}
                    className="flex items-center gap-2 font-display text-base font-bold text-[#111318]"
                  >
                    {group.icon}
                    {group.title}
                  </h2>
                  <p className="mt-0.5 text-xs text-[#525866]">
                    {group.subtitle}
                  </p>
                </div>

                <div className="text-left sm:text-right">
                  <span className="block text-[10px] font-semibold uppercase tracking-wider text-[#686E7D]">
                    {group.totalLabel}
                  </span>
                  <span
                    className={`font-mono-tabular text-base font-bold ${group.totalColorClass}`}
                  >
                    {MoneyUtils.formatARSCents(group.totalAmountCents)}
                  </span>
                </div>
              </div>

              {/* Vista Móvil (<md): Tarjetas apiladas sin desplazamiento horizontal */}
              <div className="divide-y divide-[#ECEAE2] md:hidden">
                {group.items.map((item) => {
                  const isIncome = isIncomeCategory(item.categoria);
                  const isCard =
                    item.categoria === 'TARJETA_ROTATIVA' ||
                    item.subgrupo?.toLowerCase().includes('tarjeta');
                  const pInfo = priorityMap.get(item.id);
                  const displayAmount =
                    item.estado === 'EXTINGUIDO'
                      ? item.montoLiberadoAlExtinguirse ?? item.montoPactado
                      : item.estado === 'PAGADO' &&
                          item.montoPagado !== undefined
                        ? item.montoPagado
                        : item.montoPactado;

                  return (
                    <div key={item.id} className="space-y-3 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-display text-sm font-bold text-[#111318]">
                            {item.titulo}
                            {item.esCuotaFija &&
                            item.cuotaActual &&
                            item.cuotasTotales ? (
                              <span className="ml-1.5 font-mono-tabular text-xs font-semibold text-[#4338CA]">
                                {item.cuotaActual}/{item.cuotasTotales}
                              </span>
                            ) : null}
                          </p>
                          <p className="mt-0.5 text-xs text-[#525866]">
                            {item.subgrupo ?? item.categoria}
                            {pInfo ? (
                              <>
                                {' · '}
                                <span className={`font-semibold ${pInfo.color}`}>
                                  {pInfo.label}
                                </span>
                              </>
                            ) : null}
                          </p>
                        </div>

                        <div className="text-right shrink-0">
                          {item.estado === 'EXTINGUIDO' ? (
                            <span className="font-mono-tabular text-sm font-bold text-[#4338CA]">
                              {MoneyUtils.formatARS(displayAmount)}
                            </span>
                          ) : (
                            <InlineAmountEditor
                              itemTitle={item.titulo}
                              amount={displayAmount}
                              prefix={isIncome ? '+' : ''}
                              readOnly={!canEditFinances}
                              textClassName={`text-sm font-bold ${
                                isIncome ? 'text-[#1D4ED8]' : 'text-[#111318]'
                              }`}
                              onSaveAmount={(val) =>
                                onQuickUpdateAmount(item, val)
                              }
                            />
                          )}
                          {item.estado === 'PAGADO' &&
                          item.montoPagado !== undefined &&
                          MoneyUtils.toCents(item.montoPagado) !==
                            MoneyUtils.toCents(item.montoPactado) ? (
                            <div className="font-mono-tabular text-[11px] text-[#747A88]">
                              Pactado: {MoneyUtils.formatARS(item.montoPactado)}
                            </div>
                          ) : null}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#525866]">
                        <div className="flex flex-wrap items-center gap-2">
                          {item.estado === 'EXTINGUIDO' ? (
                            <span className="font-mono-tabular">
                              {formatDateAR(item.fechaExactaVencimiento)}
                            </span>
                          ) : (
                            <>
                              <InlineDateEditor
                                itemTitle={item.titulo}
                                label={isIncome ? 'Cobro' : 'Vence'}
                                dateISO={item.fechaExactaVencimiento}
                                readOnly={!canEditFinances}
                                onSaveDate={(val) =>
                                  onQuickUpdateDates(item, {
                                    fechaExactaVencimiento: val,
                                  })
                                }
                              />
                              {(item.fechaCierre || isCard) && (
                                <InlineDateEditor
                                  itemTitle={item.titulo}
                                  label="Cierre"
                                  dateISO={item.fechaCierre}
                                  placeholder="+ Cierre"
                                  readOnly={!canEditFinances}
                                  onSaveDate={(val) =>
                                    onQuickUpdateDates(item, {
                                      fechaCierre: val,
                                    })
                                  }
                                />
                              )}
                            </>
                          )}
                        </div>

                        <span className="text-[11px] font-medium text-[#747A88]">
                          {item.ventanaAsignada === 'Q1_DIAS_1_AL_14'
                            ? '1°Q'
                            : '2°Q'}{' '}
                          · {item.bolsilloResponsable}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#F2F1EB] pt-2.5">
                        <span className="text-[11px] font-bold">
                          {item.estado === 'PAGADO' ? (
                            <span className="text-[#1D4ED8]">
                              PAGADO
                              {item.fechaPagoReal
                                ? ` (${formatDateAR(item.fechaPagoReal)})`
                                : ''}
                            </span>
                          ) : item.estado === 'EXTINGUIDO' ? (
                            <span className="text-[#4338CA]">EXTINGUIDO</span>
                          ) : (
                            <span className="text-[#B45309]">PENDIENTE</span>
                          )}
                        </span>

                        <div className="flex flex-wrap items-center gap-1.5">
                          {canEditFinances && item.estado === 'PENDIENTE' && (
                            <button
                              type="button"
                              onClick={() => onMarkPaid(item)}
                              aria-label={`Marcar pagado ${item.titulo}`}
                              className="inline-flex min-h-[36px] items-center gap-1 rounded-lg bg-[#1D4ED8] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#1E40AF]"
                            >
                              <Check className="h-3.5 w-3.5" aria-hidden="true" />
                              {isIncome ? 'Cobrado' : 'Pagar'}
                            </button>
                          )}

                          {canEditFinances && item.estado === 'PAGADO' && (
                            <button
                              type="button"
                              onClick={() => onUndoPaid(item)}
                              aria-label={`Revertir pago ${item.titulo}`}
                              className="inline-flex min-h-[36px] items-center gap-1 rounded-lg border border-[#DFDDD4] bg-[#F7F7F3] px-2.5 py-1.5 text-xs font-medium text-[#111318]"
                            >
                              <Undo2 className="h-3.5 w-3.5" aria-hidden="true" />
                              Pendiente
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => onOpenReceipts(item)}
                            aria-label={`Comprobantes de ${item.titulo}`}
                            className={`inline-flex min-h-[36px] min-w-[36px] items-center justify-center gap-1 rounded-lg border px-2 text-xs ${
                              (item.adjuntos?.length ?? 0) > 0
                                ? 'border-[#BFDBFE] bg-[#EFF6FF] text-[#1D4ED8]'
                                : 'border-[#DFDDD4] bg-[#F7F7F3] text-[#525866]'
                            }`}
                          >
                            <Paperclip
                              className="h-3.5 w-3.5"
                              aria-hidden="true"
                            />
                            {(item.adjuntos?.length ?? 0) > 0 && (
                              <span className="font-mono-tabular font-semibold">
                                {item.adjuntos!.length}
                              </span>
                            )}
                          </button>

                          {canEditFinances && (
                            <>
                              <button
                                type="button"
                                onClick={() => onEditItem(item)}
                                aria-label={`Editar ${item.titulo}`}
                                className="inline-flex min-h-[36px] min-w-[36px] items-center justify-center rounded-lg border border-[#DFDDD4] bg-[#F7F7F3] text-[#525866]"
                              >
                                <Pencil
                                  className="h-3.5 w-3.5"
                                  aria-hidden="true"
                                />
                              </button>
                              <button
                                type="button"
                                onClick={() => onDeleteItem(item)}
                                aria-label={`Eliminar ${item.titulo}`}
                                className="inline-flex min-h-[36px] min-w-[36px] items-center justify-center rounded-lg border border-[#DFDDD4] bg-[#F7F7F3] text-[#525866] hover:border-[#FECACA] hover:bg-[#FEF2F2] hover:text-[#DC2626]"
                              >
                                <Trash2
                                  className="h-3.5 w-3.5"
                                  aria-hidden="true"
                                />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Vista Escritorio (md+): Tabla limpia y tabular */}
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-[#ECEAE2] bg-[#FAF9F6] text-[11px] font-semibold uppercase tracking-wider text-[#686E7D]">
                      <th className="px-5 py-3">Concepto y Tipo</th>
                      <th className="px-4 py-3">Cierre y Vencimiento</th>
                      <th className="px-4 py-3">Bolsillo</th>
                      <th className="px-4 py-3 text-right">Monto</th>
                      <th className="px-4 py-3">Estado</th>
                      <th className="px-5 py-3 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#ECEAE2]">
                    {group.items.map((item) => {
                      const isIncome = isIncomeCategory(item.categoria);
                      const isCard =
                        item.categoria === 'TARJETA_ROTATIVA' ||
                        item.subgrupo?.toLowerCase().includes('tarjeta');
                      const pInfo = priorityMap.get(item.id);
                      const displayAmount =
                        item.estado === 'EXTINGUIDO'
                          ? item.montoLiberadoAlExtinguirse ?? item.montoPactado
                          : item.estado === 'PAGADO' &&
                              item.montoPagado !== undefined
                            ? item.montoPagado
                            : item.montoPactado;

                      return (
                        <tr
                          key={item.id}
                          className="transition-colors hover:bg-[#FAF9F6]"
                        >
                          <td className="px-5 py-3.5">
                            <div className="font-semibold text-[#111318]">
                              {item.titulo}
                              {item.esCuotaFija &&
                              item.cuotaActual &&
                              item.cuotasTotales ? (
                                <span className="ml-2 font-mono-tabular text-xs font-semibold text-[#4338CA]">
                                  {item.cuotaActual}/{item.cuotasTotales}
                                </span>
                              ) : null}
                            </div>
                            <div className="mt-0.5 text-xs text-[#525866]">
                              {item.subgrupo ?? item.categoria}
                              {pInfo ? (
                                <>
                                  {' · '}
                                  <span className={`font-semibold ${pInfo.color}`}>
                                    {pInfo.label}
                                  </span>
                                </>
                              ) : null}
                            </div>
                          </td>

                          <td className="px-4 py-3.5 font-mono-tabular text-xs text-[#525866] whitespace-nowrap">
                            {item.estado === 'EXTINGUIDO' ? (
                              <div>{formatDateAR(item.fechaExactaVencimiento)}</div>
                            ) : (
                              <div className="flex flex-col items-start gap-1">
                                <InlineDateEditor
                                  itemTitle={item.titulo}
                                  label={isIncome ? 'Cobro' : 'Vence'}
                                  dateISO={item.fechaExactaVencimiento}
                                  readOnly={!canEditFinances}
                                  onSaveDate={(val) =>
                                    onQuickUpdateDates(item, {
                                      fechaExactaVencimiento: val,
                                    })
                                  }
                                />
                                {(item.fechaCierre || isCard) && (
                                  <InlineDateEditor
                                    itemTitle={item.titulo}
                                    label="Cierre"
                                    dateISO={item.fechaCierre}
                                    placeholder="+ Cierre"
                                    readOnly={!canEditFinances}
                                    onSaveDate={(val) =>
                                      onQuickUpdateDates(item, {
                                        fechaCierre: val,
                                      })
                                    }
                                  />
                                )}
                              </div>
                            )}
                            <div className="mt-0.5 pl-1.5 text-[11px] text-[#747A88]">
                              {item.ventanaAsignada === 'Q1_DIAS_1_AL_14'
                                ? '1° Quincena'
                                : '2° Quincena'}
                            </div>
                          </td>

                          <td className="px-4 py-3.5 text-xs font-medium text-[#525866]">
                            {item.bolsilloResponsable}
                          </td>

                          <td className="px-4 py-3.5 text-right whitespace-nowrap">
                            {item.estado === 'EXTINGUIDO' ? (
                              <span className="font-mono-tabular font-semibold text-[#4338CA]">
                                {MoneyUtils.formatARS(displayAmount)}
                              </span>
                            ) : (
                              <InlineAmountEditor
                                itemTitle={item.titulo}
                                amount={displayAmount}
                                prefix={isIncome ? '+' : ''}
                                readOnly={!canEditFinances}
                                textClassName={`font-bold ${
                                  isIncome ? 'text-[#1D4ED8]' : 'text-[#111318]'
                                }`}
                                onSaveAmount={(val) =>
                                  onQuickUpdateAmount(item, val)
                                }
                              />
                            )}
                            {item.estado === 'PAGADO' &&
                            item.montoPagado !== undefined &&
                            MoneyUtils.toCents(item.montoPagado) !==
                              MoneyUtils.toCents(item.montoPactado) ? (
                              <div className="font-mono-tabular text-[11px] font-normal text-[#747A88]">
                                Pactado: {MoneyUtils.formatARS(item.montoPactado)}
                              </div>
                            ) : null}
                          </td>

                          <td className="px-4 py-3.5 text-xs whitespace-nowrap">
                            {item.estado === 'PAGADO' ? (
                              <span className="font-bold text-[#1D4ED8]">
                                PAGADO
                                {item.fechaPagoReal
                                  ? ` (${formatDateAR(item.fechaPagoReal)})`
                                  : ''}
                              </span>
                            ) : item.estado === 'EXTINGUIDO' ? (
                              <span className="font-bold text-[#4338CA]">
                                EXTINGUIDO
                              </span>
                            ) : (
                              <span className="font-bold text-[#B45309]">
                                PENDIENTE
                              </span>
                            )}
                          </td>

                          <td className="px-5 py-3.5 text-right whitespace-nowrap">
                            <div className="inline-flex items-center justify-end gap-2">
                              {canEditFinances &&
                                item.estado === 'PENDIENTE' && (
                                  <button
                                    type="button"
                                    onClick={() => onMarkPaid(item)}
                                    aria-label={`Marcar pagado ${item.titulo}`}
                                    className="inline-flex items-center gap-1 rounded-lg bg-[#1D4ED8] px-2.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#1E40AF]"
                                  >
                                    <Check
                                      className="h-3.5 w-3.5"
                                      aria-hidden="true"
                                    />
                                    {isIncome ? 'Cobrado' : 'Marcar Pagado'}
                                  </button>
                                )}

                              {canEditFinances && item.estado === 'PAGADO' && (
                                <button
                                  type="button"
                                  onClick={() => onUndoPaid(item)}
                                  aria-label={`Revertir pago ${item.titulo}`}
                                  className="inline-flex items-center gap-1 rounded-lg border border-[#DFDDD4] bg-[#F7F7F3] px-2.5 py-1.5 text-xs font-medium text-[#111318] hover:bg-[#ECEAE2]"
                                >
                                  <Undo2
                                    className="h-3.5 w-3.5"
                                    aria-hidden="true"
                                  />
                                  Pendiente
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() => onOpenReceipts(item)}
                                aria-label={`Comprobantes de ${item.titulo}`}
                                title="Resúmenes y comprobantes en Google Drive"
                                className={`inline-flex items-center gap-1 rounded-lg border p-1.5 text-xs transition-colors ${
                                  (item.adjuntos?.length ?? 0) > 0
                                    ? 'border-[#BFDBFE] bg-[#EFF6FF] text-[#1D4ED8] hover:bg-[#DBEAFE]'
                                    : 'border-[#DFDDD4] bg-[#F7F7F3] text-[#525866] hover:border-[#C9C6BA] hover:text-[#111318]'
                                }`}
                              >
                                <Paperclip
                                  className="h-3.5 w-3.5"
                                  aria-hidden="true"
                                />
                                {(item.adjuntos?.length ?? 0) > 0 && (
                                  <span className="font-mono-tabular font-semibold">
                                    {item.adjuntos!.length}
                                  </span>
                                )}
                              </button>

                              {canEditFinances && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => onEditItem(item)}
                                    aria-label={`Editar ${item.titulo}`}
                                    className="rounded-lg border border-[#DFDDD4] bg-[#F7F7F3] p-1.5 text-[#525866] hover:bg-[#ECEAE2] hover:text-[#111318]"
                                  >
                                    <Pencil
                                      className="h-3.5 w-3.5"
                                      aria-hidden="true"
                                    />
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => onDeleteItem(item)}
                                    aria-label={`Eliminar ${item.titulo}`}
                                    className="rounded-lg border border-[#DFDDD4] bg-[#F7F7F3] p-1.5 text-[#525866] hover:border-[#FECACA] hover:bg-[#FEF2F2] hover:text-[#DC2626]"
                                  >
                                    <Trash2
                                      className="h-3.5 w-3.5"
                                      aria-hidden="true"
                                    />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
};
