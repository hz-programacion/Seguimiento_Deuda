import React, { useMemo, useState } from 'react';
import { Check, Paperclip, Pencil, Search, Trash2, Undo2 } from 'lucide-react';
import {
  CashFlowMatchResult,
  ItemFinanciero,
} from '../types/finance';
import { formatDateAR, formatPeriodoLabel } from '../utils/dateUtils';
import { MoneyUtils } from '../utils/moneyUtils';
import {
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
  | 'PAGADOS'
  | 'Q1'
  | 'Q2'
  | 'INGRESOS';

const FILTER_TABS: Array<{ id: FilterMode; label: string }> = [
  { id: 'TODOS', label: 'Todos' },
  { id: 'PENDIENTES', label: 'Falta Pagar' },
  { id: 'PAGADOS', label: 'Pagados' },
  { id: 'Q1', label: '1° Quincena' },
  { id: 'Q2', label: '2° Quincena' },
  { id: 'INGRESOS', label: 'Ingresos' },
];

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

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#747A88]">
            Libro de Movimientos
          </p>
          <h1 className="mt-0.5 font-display text-2xl font-bold tracking-tight text-[#111318] sm:text-3xl">
            Movimientos · {formatPeriodoLabel(matchResult.summary.periodo)}
          </h1>
          <p className="mt-1 text-xs text-[#525866] sm:text-sm">
            Tocá cualquier fecha de cierre, vencimiento o monto para ajustarlo solo en este mes.
          </p>
        </div>
        <div className="font-mono-tabular text-xs font-medium text-[#525866]">
          {filteredItems.length} registro{filteredItems.length === 1 ? '' : 's'}
        </div>
      </div>

      {/* Filtros y búsqueda */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div
          role="tablist"
          aria-label="Filtros de movimientos"
          className="flex flex-wrap items-center gap-1 rounded-xl border border-[#E4E3DD] bg-white p-1"
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
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                  active
                    ? 'bg-[#1D4ED8] text-white'
                    : 'text-[#525866] hover:bg-[#F6F6F3] hover:text-[#111318]'
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
            className="w-full rounded-xl border border-[#E4E3DD] bg-white py-2 pl-9 pr-3 text-sm text-[#111318] placeholder:text-[#747A88] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1D4ED8]"
          />
        </div>
      </div>

      {/* Tabla limpia de movimientos */}
      <div className="overflow-hidden rounded-2xl border border-[#E4E3DD] bg-white shadow-[0_1px_2px_rgba(17,19,24,0.03)]">
        {filteredItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
            <p className="text-sm font-semibold text-[#111318]">
              No hay movimientos que coincidan con el filtro seleccionado
            </p>
            <button
              type="button"
              onClick={() => {
                setFilter('TODOS');
                setQuery('');
              }}
              className="mt-3 rounded-lg border border-[#E4E3DD] bg-[#F6F6F3] px-3.5 py-1.5 text-xs font-semibold text-[#111318] hover:bg-[#EEEDE8]"
            >
              Limpiar filtros
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-[#EEEDE8] bg-[#FAF9F6] text-[11px] font-semibold uppercase tracking-wider text-[#747A88]">
                  <th className="px-5 py-3.5">Concepto y Categoría</th>
                  <th className="px-4 py-3.5">Cierre y Vencimiento</th>
                  <th className="px-4 py-3.5">Bolsillo</th>
                  <th className="px-4 py-3.5 text-right">Monto Pactado</th>
                  <th className="px-4 py-3.5">Estado</th>
                  <th className="px-5 py-3.5 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EEEDE8]">
                {filteredItems.map((item) => {
                  const isIncome = isIncomeCategory(item.categoria);
                  const isQuita = item.categoria === 'DEUDA_CON_QUITA';
                  const isCard =
                    item.categoria === 'TARJETA_ROTATIVA' ||
                    item.subgrupo?.toLowerCase().includes('tarjeta');
                  const pInfo = priorityMap.get(item.id);
                  const displayAmount = isQuita
                    ? item.montoOfertaQuitaContado ?? 0
                    : item.estado === 'PAGADO' && item.montoPagado !== undefined
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
                          {isQuita ? ' · Oferta Contado (Contingente)' : null}
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
                                  onQuickUpdateDates(item, { fechaCierre: val })
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

                      <td className="px-4 py-3.5 text-xs text-[#525866]">
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
                            item.estado === 'PENDIENTE' &&
                            !isQuita && (
                              <button
                                type="button"
                                onClick={() => onMarkPaid(item)}
                                aria-label={`Marcar pagado ${item.titulo}`}
                                className="inline-flex items-center gap-1 rounded-lg bg-[#1D4ED8] px-2.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#1E40AF]"
                              >
                                <Check className="h-3.5 w-3.5" aria-hidden="true" />
                                {isIncome ? 'Cobrado' : 'Marcar Pagado'}
                              </button>
                            )}

                          {canEditFinances && item.estado === 'PAGADO' && (
                            <button
                              type="button"
                              onClick={() => onUndoPaid(item)}
                              aria-label={`Revertir pago ${item.titulo}`}
                              className="inline-flex items-center gap-1 rounded-lg border border-[#E4E3DD] bg-[#F6F6F3] px-2.5 py-1.5 text-xs font-medium text-[#111318] hover:bg-[#EEEDE8]"
                            >
                              <Undo2 className="h-3.5 w-3.5" aria-hidden="true" />
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
                                : 'border-[#E4E3DD] bg-[#F6F6F3] text-[#525866] hover:border-[#D4D2CA] hover:text-[#111318]'
                            }`}
                          >
                            <Paperclip className="h-3.5 w-3.5" aria-hidden="true" />
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
                                className="rounded-lg border border-[#E4E3DD] bg-[#F6F6F3] p-1.5 text-[#525866] hover:bg-[#EEEDE8] hover:text-[#111318]"
                              >
                                <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                              </button>

                              <button
                                type="button"
                                onClick={() => onDeleteItem(item)}
                                aria-label={`Eliminar ${item.titulo}`}
                                className="rounded-lg border border-[#E4E3DD] bg-[#F6F6F3] p-1.5 text-[#525866] hover:border-[#FECACA] hover:bg-[#FEF2F2] hover:text-[#DC2626]"
                              >
                                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
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
        )}
      </div>
    </div>
  );
};
