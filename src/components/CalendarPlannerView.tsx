import React, { useMemo, useState } from 'react';
import {
  CalendarCheck,
  CalendarClock,
  CheckCircle2,
  Download,
  ExternalLink,
  LogOut,
  RefreshCw,
  Sparkles,
  Trash2,
} from 'lucide-react';
import {
  CalendarEventKind,
  CalendarPlannedEvent,
  CashFlowMatchResult,
  GoogleCalendarEventItem,
  ItemFinanciero,
  PeriodoID,
} from '../types/finance';
import {
  buildCalendarMonthGrid,
  buildMonthlyFinancialEvents,
  generateICSContent,
} from '../utils/calendarPlanner';
import {
  CalendarReminderLead,
  batchCreateGoogleCalendarEvents,
  createGoogleCalendarEvent,
  deleteGoogleCalendarEvent,
  listMonthGoogleCalendarEvents,
} from '../services/calendarService';
import { formatDateAR, formatPeriodoLabel, formatShortDateAR } from '../utils/dateUtils';
import { MoneyUtils } from '../utils/moneyUtils';
import { ConfirmDialog } from './ConfirmDialog';

interface CalendarPlannerViewProps {
  activePeriodo: PeriodoID;
  referenceDateISO: string;
  matchResult: CashFlowMatchResult;
  periodItems: ItemFinanciero[];
  canEditFinances: boolean;
  hasWorkspaceToken: boolean;
  workspaceUserEmail: string | null;
  onSignInWorkspace: () => Promise<void>;
  onSignOutWorkspace: () => Promise<void>;
  onMarkPaid: (item: ItemFinanciero) => void;
  onNotify: (msg: string) => void;
}

type CalendarFilter = 'TODOS' | 'VENCIMIENTOS' | 'VENTANA_TARJETA' | 'COBROS' | 'PENDIENTES';

type PendingCalendarMutation =
  | { type: 'create-single'; event: CalendarPlannedEvent }
  | { type: 'batch-create'; events: CalendarPlannedEvent[] }
  | { type: 'delete-google'; googleEvent: GoogleCalendarEventItem }
  | null;

const WEEKDAY_HEADERS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

function getKindMeta(kind: CalendarEventKind, isUrgent: boolean, isPaid: boolean) {
  if (isPaid) {
    return {
      label: kind === 'COBRO' ? 'Cobrado' : 'Pagado',
      dotClass: 'bg-[#9CA3AF]',
      pillClass: 'border-[#E4E3DD] bg-[#F6F6F3] text-[#525866]',
    };
  }
  if (kind === 'COBRO') {
    return {
      label: 'Cobro',
      dotClass: 'bg-[#1D4ED8]',
      pillClass: 'border-[#BFDBFE] bg-[#EFF6FF] text-[#1D4ED8]',
    };
  }
  if (kind === 'VENTANA_TARJETA') {
    return {
      label: 'Ventana Tarjeta',
      dotClass: 'bg-[#D97706]',
      pillClass: 'border-[#FDE68A] bg-[#FFFBEB] text-[#B45309]',
    };
  }
  if (kind === 'EXTINCION_CUOTA') {
    return {
      label: 'Última Cuota',
      dotClass: 'bg-[#4338CA]',
      pillClass: 'border-[#C7D2FE] bg-[#EEF2FF] text-[#4338CA]',
    };
  }
  return isUrgent
    ? {
        label: 'Urgente',
        dotClass: 'bg-[#DC2626]',
        pillClass: 'border-[#FECACA] bg-[#FEF2F2] text-[#B91C1C]',
      }
    : {
        label: 'Vencimiento',
        dotClass: 'bg-[#111318]',
        pillClass: 'border-[#D4D2CA] bg-white text-[#111318]',
      };
}

export const CalendarPlannerView: React.FC<CalendarPlannerViewProps> = ({
  activePeriodo,
  referenceDateISO,
  matchResult,
  periodItems,
  canEditFinances,
  hasWorkspaceToken,
  workspaceUserEmail,
  onSignInWorkspace,
  onSignOutWorkspace,
  onMarkPaid,
  onNotify,
}) => {
  const [filter, setFilter] = useState<CalendarFilter>('TODOS');
  const [selectedDateISO, setSelectedDateISO] = useState<string>(referenceDateISO);
  const [reminderLead, setReminderLead] = useState<CalendarReminderLead>('1-day-before');
  const [googleEvents, setGoogleEvents] = useState<GoogleCalendarEventItem[]>([]);
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [hasLoadedMonth, setHasLoadedMonth] = useState(false);
  const [pendingMutation, setPendingMutation] =
    useState<PendingCalendarMutation>(null);

  const plannedEvents = useMemo(
    () => buildMonthlyFinancialEvents(activePeriodo, matchResult, periodItems),
    [activePeriodo, matchResult, periodItems]
  );

  const filteredEvents = useMemo(() => {
    return plannedEvents.filter((ev) => {
      if (filter === 'VENCIMIENTOS') {
        return ev.kind === 'VENCIMIENTO' || ev.kind === 'EXTINCION_CUOTA';
      }
      if (filter === 'VENTANA_TARJETA') return ev.kind === 'VENTANA_TARJETA';
      if (filter === 'COBROS') return ev.kind === 'COBRO';
      if (filter === 'PENDIENTES') return !ev.isPaid;
      return true;
    });
  }, [plannedEvents, filter]);

  const gridCells = useMemo(
    () => buildCalendarMonthGrid(activePeriodo),
    [activePeriodo]
  );

  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarPlannedEvent[]>();
    for (const ev of filteredEvents) {
      const list = map.get(ev.dateISO) ?? [];
      list.push(ev);
      map.set(ev.dateISO, list);
    }
    return map;
  }, [filteredEvents]);

  const googleByArgenKey = useMemo(() => {
    const map = new Map<string, GoogleCalendarEventItem>();
    for (const ge of googleEvents) {
      if (ge.argenCajaKey) {
        map.set(ge.argenCajaKey, ge);
      }
    }
    return map;
  }, [googleEvents]);

  const googleByDate = useMemo(() => {
    const map = new Map<string, GoogleCalendarEventItem[]>();
    for (const ge of googleEvents) {
      const list = map.get(ge.startDateISO) ?? [];
      list.push(ge);
      map.set(ge.startDateISO, list);
    }
    return map;
  }, [googleEvents]);

  // Asegurar que la fecha seleccionada pertenezca al período activo si cambió el mes
  const effectiveSelectedDateISO = selectedDateISO.startsWith(activePeriodo)
    ? selectedDateISO
    : referenceDateISO.startsWith(activePeriodo)
      ? referenceDateISO
      : `${activePeriodo}-01`;

  const selectedDayEvents = eventsByDate.get(effectiveSelectedDateISO) ?? [];
  const selectedDayGoogleEvents = (
    googleByDate.get(effectiveSelectedDateISO) ?? []
  ).filter((ge) => !ge.argenCajaKey);

  const unscheduledPendingEvents = useMemo(
    () =>
      plannedEvents.filter(
        (ev) => !ev.isPaid && !googleByArgenKey.has(ev.eventKey)
      ),
    [plannedEvents, googleByArgenKey]
  );

  const itemsMap = useMemo(() => {
    const m = new Map<string, ItemFinanciero>();
    for (const it of periodItems) m.set(it.id, it);
    return m;
  }, [periodItems]);

  const handleFetchGoogleMonth = async () => {
    setSyncError(null);
    setSyncLoading(true);
    try {
      const items = await listMonthGoogleCalendarEvents(activePeriodo);
      setGoogleEvents(items);
      setHasLoadedMonth(true);
      onNotify(
        `Calendario actualizado: ${items.length} evento${items.length === 1 ? '' : 's'} leído${items.length === 1 ? '' : 's'} de Google Calendar.`
      );
    } catch (err) {
      setSyncError(
        err instanceof Error
          ? err.message
          : 'No se pudo consultar Google Calendar.'
      );
    } finally {
      setSyncLoading(false);
    }
  };

  const handleConfirmGoogleMutation = async () => {
    if (!pendingMutation) return;
    setSyncError(null);
    setSyncLoading(true);

    try {
      if (pendingMutation.type === 'create-single') {
        const created = await createGoogleCalendarEvent(
          pendingMutation.event,
          reminderLead
        );
        setGoogleEvents((prev) => [...prev, created]);
        setHasLoadedMonth(true);
        onNotify(`Agendado en Google Calendar: ${pendingMutation.event.title}`);
      } else if (pendingMutation.type === 'batch-create') {
        const res = await batchCreateGoogleCalendarEvents(
          pendingMutation.events,
          reminderLead
        );
        setGoogleEvents((prev) => [...prev, ...res.created]);
        setHasLoadedMonth(true);
        if (res.failed.length > 0) {
          setSyncError(
            `Se agendaron ${res.created.length} eventos, pero ${res.failed.length} fallaron: ${res.failed[0].error}`
          );
        } else {
          onNotify(
            `${res.created.length} evento${res.created.length === 1 ? '' : 's'} agendado${res.created.length === 1 ? '' : 's'} en Google Calendar con recordatorios.`
          );
        }
      } else if (pendingMutation.type === 'delete-google') {
        await deleteGoogleCalendarEvent(pendingMutation.googleEvent.id);
        setGoogleEvents((prev) =>
          prev.filter((ge) => ge.id !== pendingMutation.googleEvent.id)
        );
        onNotify('Recordatorio eliminado de Google Calendar.');
      }
      setPendingMutation(null);
    } catch (err) {
      setSyncError(
        err instanceof Error
          ? err.message
          : 'No se pudo completar la operación en Google Calendar.'
      );
      setPendingMutation(null);
    } finally {
      setSyncLoading(false);
    }
  };

  const handleDownloadICS = (eventsToExport: CalendarPlannedEvent[], filename: string) => {
    const leadDays =
      reminderLead === '2-days-before' ? 2 : reminderLead === '1-day-before' ? 1 : 0;
    const ics = generateICSContent(
      eventsToExport,
      `ArgenCaja ${formatPeriodoLabel(activePeriodo)}`,
      leadDays
    );
    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    onNotify(`Archivo de calendario descargado: ${filename}`);
  };

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#747A88]">
            Agenda Bancaria y Recordatorios
          </p>
          <h1 className="mt-0.5 font-display text-2xl font-bold tracking-tight text-[#111318] sm:text-3xl">
            Calendario · {formatPeriodoLabel(activePeriodo)}
          </h1>
          <p className="mt-1 text-xs text-[#525866] sm:text-sm">
            Explorá vencimientos en días hábiles, aperturas post-cierre de tarjetas y cobros del mes. Agendá recordatorios directo en tu Google Calendar.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() =>
              handleDownloadICS(
                filteredEvents,
                `argencaja-agenda-${activePeriodo}.ics`
              )
            }
            className="inline-flex items-center gap-1.5 rounded-xl border border-[#E4E3DD] bg-white px-3.5 py-2 text-xs font-semibold text-[#111318] transition-colors hover:bg-[#EEEDE8] whitespace-nowrap"
          >
            <Download className="h-3.5 w-3.5 text-[#1D4ED8]" aria-hidden="true" />
            Exportar .ics del mes
          </button>
        </div>
      </div>

      {/* Barra de Integración con Google Calendar */}
      <section
        aria-label="Sincronización con Google Calendar"
        className="rounded-2xl border border-[#E4E3DD] bg-white p-5 shadow-[0_1px_2px_rgba(17,19,24,0.03)]"
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <CalendarCheck
                className="h-4 w-4 text-[#1D4ED8]"
                aria-hidden="true"
              />
              <h2 className="font-display text-base font-bold text-[#111318]">
                Google Calendar
              </h2>
              {hasWorkspaceToken && (
                <span className="font-mono-tabular text-xs font-medium text-[#1D4ED8]">
                  · Conectado ({workspaceUserEmail ?? 'cuenta activa'})
                </span>
              )}
            </div>
            <p className="text-xs text-[#525866]">
              {hasWorkspaceToken
                ? 'Consultá tus eventos reales del mes y agendá los vencimientos pendientes con alertas automáticas en tu calendario.'
                : 'Conectá tu cuenta con Google para agendar vencimientos, fechas de cobro y ventanas post-cierre en tu calendario personal.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <label className="inline-flex items-center gap-1.5 rounded-xl border border-[#E4E3DD] bg-[#F6F6F3] px-3 py-2 text-xs text-[#525866]">
              <span>Alerta:</span>
              <select
                aria-label="Anticipación de recordatorio"
                value={reminderLead}
                onChange={(e) =>
                  setReminderLead(e.target.value as CalendarReminderLead)
                }
                className="bg-transparent font-semibold text-[#111318] focus:outline-none"
              >
                <option value="same-day-9am">Mismo día 09:00</option>
                <option value="1-day-before">1 día antes</option>
                <option value="2-days-before">2 días antes</option>
              </select>
            </label>

            {!hasWorkspaceToken ? (
              <button
                type="button"
                disabled={syncLoading}
                onClick={async () => {
                  setSyncError(null);
                  setSyncLoading(true);
                  try {
                    await onSignInWorkspace();
                    await handleFetchGoogleMonth();
                  } catch (err) {
                    setSyncError(
                      err instanceof Error
                        ? err.message
                        : 'No se pudo conectar con Google Calendar.'
                    );
                    setSyncLoading(false);
                  }
                }}
                className="inline-flex items-center gap-2.5 rounded-xl border border-[#D4D2CA] bg-white px-4 py-2 text-xs font-semibold text-[#111318] shadow-xs transition-colors hover:bg-[#F6F6F3] disabled:opacity-60 whitespace-nowrap"
              >
                <svg className="h-4 w-4 shrink-0" viewBox="0 0 48 48" aria-hidden="true">
                  <path
                    fill="#EA4335"
                    d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                  />
                  <path
                    fill="#4285F4"
                    d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                  />
                  <path
                    fill="#34A853"
                    d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                  />
                </svg>
                Sign in with Google
              </button>
            ) : (
              <>
                <button
                  type="button"
                  disabled={syncLoading}
                  onClick={handleFetchGoogleMonth}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-[#E4E3DD] bg-[#F6F6F3] px-3 py-2 text-xs font-semibold text-[#111318] transition-colors hover:bg-[#EEEDE8] disabled:opacity-60 whitespace-nowrap"
                >
                  <RefreshCw
                    className={`h-3.5 w-3.5 ${syncLoading ? 'animate-spin' : ''}`}
                    aria-hidden="true"
                  />
                  {hasLoadedMonth ? 'Actualizar del mes' : 'Leer mi calendario'}
                </button>

                <button
                  type="button"
                  disabled={syncLoading || unscheduledPendingEvents.length === 0}
                  onClick={() =>
                    setPendingMutation({
                      type: 'batch-create',
                      events: unscheduledPendingEvents,
                    })
                  }
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#1D4ED8] px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#1E40AF] disabled:opacity-50 whitespace-nowrap"
                >
                  <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                  Agendar pendientes ({unscheduledPendingEvents.length})
                </button>

                <button
                  type="button"
                  disabled={syncLoading}
                  onClick={onSignOutWorkspace}
                  title="Desconectar sesión de Google Workspace"
                  className="inline-flex items-center gap-1 rounded-xl border border-[#E4E3DD] bg-white px-2.5 py-2 text-xs font-medium text-[#525866] hover:bg-[#F6F6F3] hover:text-[#111318]"
                >
                  <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </>
            )}
          </div>
        </div>

        {syncError && (
          <p
            role="alert"
            className="mt-3 rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-3.5 py-2 text-xs font-medium text-[#B91C1C]"
          >
            {syncError}
          </p>
        )}
      </section>

      {/* Filtros + Leyenda limpia */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div
          role="tablist"
          aria-label="Filtros del calendario"
          className="flex flex-wrap items-center gap-1 rounded-xl border border-[#E4E3DD] bg-white p-1"
        >
          {(
            [
              { id: 'TODOS', label: 'Todos' },
              { id: 'PENDIENTES', label: 'Solo Pendientes' },
              { id: 'VENCIMIENTOS', label: 'Vencimientos' },
              { id: 'VENTANA_TARJETA', label: 'Ventanas Tarjeta' },
              { id: 'COBROS', label: 'Cobros' },
            ] as const
          ).map((tab) => {
            const active = filter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setFilter(tab.id)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
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

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-[#525866]">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-[#1D4ED8]" />
            Cobros
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-[#DC2626]" />
            Urgente
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-[#111318]" />
            Vencimiento
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-[#D97706]" />
            Post-cierre Tarjeta
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-[#4338CA]" />
            Última Cuota
          </span>
        </div>
      </div>

      {/* Grilla Mensual (8 cols) + Agenda del Día Seleccionado (4 cols) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <section
          aria-label="Calendario mensual"
          className="rounded-2xl border border-[#E4E3DD] bg-white p-4 shadow-[0_1px_2px_rgba(17,19,24,0.03)] sm:p-5 lg:col-span-8"
        >
          <div className="grid grid-cols-7 gap-1 pb-2 text-center text-[11px] font-semibold uppercase tracking-wider text-[#747A88]">
            {WEEKDAY_HEADERS.map((day) => (
              <div key={day} className="py-1">
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {gridCells.map((cell) => {
              const dayEvents = eventsByDate.get(cell.dateISO) ?? [];
              const dayGoogleOnly = (googleByDate.get(cell.dateISO) ?? []).filter(
                (ge) => !ge.argenCajaKey
              );
              const isSelected = cell.dateISO === effectiveSelectedDateISO;
              const isTodayRef = cell.dateISO === referenceDateISO;

              return (
                <button
                  key={cell.dateISO}
                  type="button"
                  onClick={() => setSelectedDateISO(cell.dateISO)}
                  aria-label={`Ver agenda del ${formatDateAR(cell.dateISO)}`}
                  aria-pressed={isSelected}
                  className={`flex min-h-[76px] flex-col items-start justify-between rounded-xl border p-1.5 text-left transition-all sm:min-h-[92px] sm:p-2 ${
                    isSelected
                      ? 'border-[#1D4ED8] bg-[#EFF6FF]/60 ring-1 ring-[#1D4ED8]'
                      : cell.inCurrentMonth
                        ? 'border-[#EEEDE8] bg-white hover:border-[#D4D2CA] hover:bg-[#FAF9F6]'
                        : 'border-transparent bg-[#F6F6F3]/60 text-[#9CA3AF]'
                  }`}
                >
                  <div className="flex w-full items-center justify-between gap-1">
                    <span
                      className={`inline-flex h-5 w-5 items-center justify-center rounded-full font-mono-tabular text-[11px] font-semibold ${
                        isTodayRef
                          ? 'bg-[#1D4ED8] text-white'
                          : cell.inCurrentMonth
                            ? 'text-[#111318]'
                            : 'text-[#9CA3AF]'
                      }`}
                    >
                      {cell.dayNumber}
                    </span>
                    {dayEvents.some((e) => googleByArgenKey.has(e.eventKey)) && (
                      <CalendarCheck
                        className="h-3 w-3 text-[#1D4ED8]"
                        aria-label="Agendado en Google Calendar"
                      />
                    )}
                  </div>

                  {/* Marcadores visibles en escritorio + puntos compactos en móvil */}
                  <div className="mt-1 w-full space-y-0.5">
                    {dayEvents.slice(0, 2).map((ev) => {
                      const meta = getKindMeta(ev.kind, ev.isUrgent, ev.isPaid);
                      return (
                        <div
                          key={ev.eventKey}
                          className="hidden sm:flex items-center gap-1 truncate rounded px-1 py-0.5 text-[10px] font-medium bg-[#F6F6F3] text-[#111318]"
                        >
                          <span
                            className={`h-1.5 w-1.5 shrink-0 rounded-full ${meta.dotClass}`}
                          />
                          <span className="truncate">
                            {ev.title.replace(/^(Vence:|Límite hábil:|Cobro:|Habilitada para pagar:|Última cuota.*?:\s*)/, '')}
                          </span>
                        </div>
                      );
                    })}
                    {dayEvents.length > 2 && (
                      <span className="hidden sm:block pl-1 font-mono-tabular text-[10px] font-semibold text-[#525866]">
                        +{dayEvents.length - 2} más
                      </span>
                    )}
                    {dayEvents.length > 0 && (
                      <div className="flex sm:hidden flex-wrap gap-1 pt-1">
                        {dayEvents.slice(0, 4).map((ev) => {
                          const meta = getKindMeta(ev.kind, ev.isUrgent, ev.isPaid);
                          return (
                            <span
                              key={ev.eventKey}
                              className={`h-1.5 w-1.5 rounded-full ${meta.dotClass}`}
                            />
                          );
                        })}
                      </div>
                    )}
                    {dayGoogleOnly.length > 0 && dayEvents.length === 0 && (
                      <span className="hidden sm:block truncate pl-1 text-[10px] text-[#747A88]">
                        {dayGoogleOnly[0].summary}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Panel de Detalle del Día Seleccionado (4 cols) */}
        <aside
          aria-label="Detalle del día seleccionado"
          className="flex flex-col rounded-2xl border border-[#E4E3DD] bg-white p-5 shadow-[0_1px_2px_rgba(17,19,24,0.03)] lg:col-span-4"
        >
          <div className="flex items-start justify-between gap-2 border-b border-[#EEEDE8] pb-3.5">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[#747A88]">
                Agenda del día
              </p>
              <h2 className="mt-0.5 font-display text-lg font-bold text-[#111318]">
                {formatDateAR(effectiveSelectedDateISO)}
              </h2>
            </div>
            {effectiveSelectedDateISO === referenceDateISO && (
              <span className="rounded-md border border-[#BFDBFE] bg-[#EFF6FF] px-2 py-0.5 text-[11px] font-semibold text-[#1D4ED8]">
                Hoy análisis
              </span>
            )}
          </div>

          {selectedDayEvents.length === 0 && selectedDayGoogleEvents.length === 0 ? (
            <div className="my-auto flex flex-col items-center justify-center py-10 text-center">
              <CalendarClock
                className="h-7 w-7 text-[#9CA3AF]"
                aria-hidden="true"
              />
              <p className="mt-2.5 text-sm font-semibold text-[#111318]">
                Sin movimientos este día
              </p>
              <p className="mt-1 text-xs text-[#525866]">
                Elegí otro día marcado en el calendario para inspeccionar pagos, ventanas o cobros.
              </p>
            </div>
          ) : (
            <div className="mt-3 divide-y divide-[#EEEDE8]">
              {selectedDayEvents.map((ev) => {
                const meta = getKindMeta(ev.kind, ev.isUrgent, ev.isPaid);
                const linkedGoogle = googleByArgenKey.get(ev.eventKey);
                const itemObj = itemsMap.get(ev.itemId);

                return (
                  <div key={ev.eventKey} className="py-3.5 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1 min-w-0">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-semibold ${meta.pillClass}`}
                        >
                          <span className={`h-1.5 w-1.5 rounded-full ${meta.dotClass}`} />
                          {meta.label}
                        </span>
                        <h3 className="text-sm font-bold text-[#111318]">
                          {ev.title}
                        </h3>
                      </div>
                      <span className="font-mono-tabular text-sm font-bold text-[#111318] shrink-0">
                        {ev.kind === 'COBRO' ? '+' : ''}
                        {MoneyUtils.formatARS(ev.amountARS)}
                      </span>
                    </div>

                    <p className="text-xs leading-relaxed text-[#525866]">
                      {ev.description}
                    </p>

                    {ev.shiftedFromWeekend && ev.originalDueISO && (
                      <p className="text-[11px] font-medium text-[#B45309]">
                        Adelantado al viernes hábil (vencía el{' '}
                        {formatShortDateAR(ev.originalDueISO)}).
                      </p>
                    )}

                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      {hasWorkspaceToken &&
                        (linkedGoogle ? (
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#1D4ED8]">
                              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                              En Google Calendar
                            </span>
                            {linkedGoogle.htmlLink && (
                              <a
                                href={linkedGoogle.htmlLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-[11px] font-medium text-[#525866] hover:text-[#111318]"
                              >
                                Abrir
                                <ExternalLink className="h-3 w-3" aria-hidden="true" />
                              </a>
                            )}
                            <button
                              type="button"
                              disabled={syncLoading}
                              onClick={() =>
                                setPendingMutation({
                                  type: 'delete-google',
                                  googleEvent: linkedGoogle,
                                })
                              }
                              aria-label={`Quitar ${ev.title} de Google Calendar`}
                              className="inline-flex items-center gap-1 rounded-md border border-[#FECACA] bg-[#FEF2F2] px-2 py-0.5 text-[11px] font-medium text-[#B91C1C] hover:bg-[#FEE2E2]"
                            >
                              <Trash2 className="h-3 w-3" aria-hidden="true" />
                              Quitar
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            disabled={syncLoading}
                            onClick={() =>
                              setPendingMutation({
                                type: 'create-single',
                                event: ev,
                              })
                            }
                            className="inline-flex items-center gap-1 rounded-lg bg-[#1D4ED8] px-2.5 py-1 text-[11px] font-semibold text-white transition-colors hover:bg-[#1E40AF]"
                          >
                            <CalendarCheck className="h-3 w-3" aria-hidden="true" />
                            Agendar en Google Calendar
                          </button>
                        ))}

                      <button
                        type="button"
                        onClick={() =>
                          handleDownloadICS(
                            [ev],
                            `argencaja-${ev.dateISO}-${ev.kind.toLowerCase()}.ics`
                          )
                        }
                        className="inline-flex items-center gap-1 rounded-lg border border-[#E4E3DD] bg-[#F6F6F3] px-2.5 py-1 text-[11px] font-medium text-[#111318] hover:bg-[#EEEDE8]"
                      >
                        <Download className="h-3 w-3" aria-hidden="true" />
                        .ics
                      </button>

                      {canEditFinances &&
                        itemObj &&
                        itemObj.estado === 'PENDIENTE' &&
                        ev.kind === 'VENCIMIENTO' && (
                          <button
                            type="button"
                            onClick={() => onMarkPaid(itemObj)}
                            className="inline-flex items-center gap-1 rounded-lg border border-[#BFDBFE] bg-[#EFF6FF] px-2.5 py-1 text-[11px] font-semibold text-[#1D4ED8] hover:bg-[#DBEAFE]"
                          >
                            Marcar Pagado
                          </button>
                        )}
                    </div>
                  </div>
                );
              })}

              {selectedDayGoogleEvents.length > 0 && (
                <div className="pt-3.5 space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-[#747A88]">
                    Otros eventos de tu Google Calendar
                  </p>
                  {selectedDayGoogleEvents.map((ge) => (
                    <div
                      key={ge.id}
                      className="flex items-center justify-between gap-2 rounded-lg border border-[#EEEDE8] bg-[#F6F6F3] px-3 py-2 text-xs"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium text-[#111318]">
                          {ge.summary}
                        </p>
                        <p className="font-mono-tabular text-[11px] text-[#747A88]">
                          {ge.isAllDay ? 'Todo el día' : ge.startTimeLabel ?? 'Horario'}
                        </p>
                      </div>
                      {ge.htmlLink && (
                        <a
                          href={ge.htmlLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] font-semibold text-[#1D4ED8] hover:underline shrink-0"
                        >
                          Ver
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </aside>
      </div>

      {/* Confirmación explícita obligatoria antes de crear/borrar en Google Calendar */}
      {pendingMutation && (
        <ConfirmDialog
          title={
            pendingMutation.type === 'delete-google'
              ? '¿Quitar recordatorio de Google Calendar?'
              : pendingMutation.type === 'batch-create'
                ? `¿Agendar ${pendingMutation.events.length} evento(s) en Google Calendar?`
                : '¿Agendar recordatorio en Google Calendar?'
          }
          description={
            pendingMutation.type === 'delete-google'
              ? `Se eliminará "${pendingMutation.googleEvent.summary}" de tu calendario principal de Google.`
              : pendingMutation.type === 'batch-create'
                ? `Se crearán ${pendingMutation.events.length} eventos en tu Google Calendar principal para ${formatPeriodoLabel(
                    activePeriodo
                  )} (cobros, vencimientos en día hábil y ventanas de tarjeta) con alerta anticipada.`
                : `Se creará el evento "[ArgenCaja] ${pendingMutation.event.title}" el ${formatDateAR(
                    pendingMutation.event.dateISO
                  )} en tu Google Calendar principal.`
          }
          confirmLabel={
            pendingMutation.type === 'delete-google'
              ? 'Sí, quitar del calendario'
              : 'Sí, agendar ahora'
          }
          tone={pendingMutation.type === 'delete-google' ? 'danger' : 'warning'}
          busy={syncLoading}
          onCancel={() => setPendingMutation(null)}
          onConfirm={handleConfirmGoogleMutation}
        />
      )}
    </div>
  );
};
