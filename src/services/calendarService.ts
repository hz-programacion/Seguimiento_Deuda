import {
  CalendarEventKind,
  CalendarPlannedEvent,
  GoogleCalendarEventItem,
  PeriodoID,
} from '../types/finance';
import { daysInMonth, parsePeriodo } from '../utils/dateUtils';
import {
  clearWorkspaceAccessToken,
  getWorkspaceAccessToken,
} from './googleWorkspaceAuth';

export type CalendarReminderLead = 'same-day-9am' | '1-day-before' | '2-days-before';

const CALENDAR_API_BASE = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';
const ARGENTINA_TZ = 'America/Argentina/Buenos_Aires';

async function calendarFetch(
  url: string,
  token: string,
  init?: RequestInit
): Promise<Response> {
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
  });
  if (res.status === 401) {
    clearWorkspaceAccessToken();
    throw new Error(
      'Tu sesión de Google Calendar venció. Volvé a conectar Google Workspace.'
    );
  }
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(
      `Error de Google Calendar (${res.status}): ${errText || res.statusText}`
    );
  }
  return res;
}

interface RawGoogleCalendarEvent {
  id: string;
  summary?: string;
  description?: string;
  htmlLink?: string;
  status?: string;
  start?: { date?: string; dateTime?: string };
  extendedProperties?: {
    private?: Record<string, string>;
  };
}

function mapRawEvent(raw: RawGoogleCalendarEvent): GoogleCalendarEventItem | null {
  if (!raw.id || raw.status === 'cancelled') return null;
  const startDate = raw.start?.date;
  const startDateTime = raw.start?.dateTime;
  let startDateISO = '';
  let startTimeLabel: string | undefined;
  let isAllDay = false;

  if (startDate) {
    startDateISO = startDate;
    isAllDay = true;
  } else if (startDateTime) {
    startDateISO = startDateTime.slice(0, 10);
    const timeMatch = startDateTime.match(/T(\d{2}:\d{2})/);
    startTimeLabel = timeMatch ? timeMatch[1] : undefined;
  }
  if (!startDateISO) return null;

  return {
    id: raw.id,
    summary: raw.summary ?? '(Sin título)',
    description: raw.description,
    htmlLink: raw.htmlLink,
    startDateISO,
    startTimeLabel,
    isAllDay,
    argenCajaKey: raw.extendedProperties?.private?.argenCajaKey,
    argenCajaSig: raw.extendedProperties?.private?.argenCajaSig,
  };
}

export function buildCalendarEventSig(event: CalendarPlannedEvent): string {
  return `${event.dateISO}|${Math.round(event.amountARS * 100)}|${
    event.isPaid ? 1 : 0
  }`;
}

function getGoogleColorIdForKind(kind: CalendarEventKind, isUrgent: boolean): string {
  // Evita tonos verdes (2/10): usa Azul Cobalto (9), Lavanda (1), Mandarina (6) o Carmesí (11)
  if (kind === 'VENCIMIENTO') return isUrgent ? '11' : '9';
  if (kind === 'VENTANA_TARJETA') return '6';
  if (kind === 'EXTINCION_CUOTA') return '1';
  return '9';
}

function getReminderMinutes(lead: CalendarReminderLead): number[] {
  if (lead === '2-days-before') return [2880, 15];
  if (lead === '1-day-before') return [1440, 15];
  return [15];
}

export async function listMonthGoogleCalendarEvents(
  periodo: PeriodoID
): Promise<GoogleCalendarEventItem[]> {
  const token = getWorkspaceAccessToken();
  if (!token) {
    throw new Error('Conectá tu cuenta de Google para consultar tu calendario.');
  }

  const { year, month } = parsePeriodo(periodo);
  const lastDay = daysInMonth(year, month);
  const timeMin = `${year}-${String(month).padStart(2, '0')}-01T00:00:00-03:00`;
  const timeMax = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}T23:59:59-03:00`;

  const params = new URLSearchParams({
    timeMin,
    timeMax,
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '250',
  });

  const res = await calendarFetch(`${CALENDAR_API_BASE}?${params.toString()}`, token);
  const json = (await res.json()) as { items?: RawGoogleCalendarEvent[] };
  return (json.items ?? [])
    .map(mapRawEvent)
    .filter((ev): ev is GoogleCalendarEventItem => ev !== null);
}

function buildGoogleEventPayload(
  event: CalendarPlannedEvent,
  leadMode: CalendarReminderLead
) {
  const startDateTime = `${event.dateISO}T09:00:00-03:00`;
  const endDateTime = `${event.dateISO}T09:30:00-03:00`;
  const minutesList = getReminderMinutes(leadMode);

  return {
    summary: `[ArgenCaja] ${event.title}`,
    description: event.description,
    start: {
      dateTime: startDateTime,
      timeZone: ARGENTINA_TZ,
    },
    end: {
      dateTime: endDateTime,
      timeZone: ARGENTINA_TZ,
    },
    colorId: getGoogleColorIdForKind(event.kind, event.isUrgent),
    reminders: {
      useDefault: false,
      overrides: minutesList.map((m) => ({ method: 'popup', minutes: m })),
    },
    extendedProperties: {
      private: {
        argenCajaApp: 'argencaja',
        argenCajaKey: event.eventKey,
        argenCajaSig: buildCalendarEventSig(event),
      },
    },
  };
}

export async function createGoogleCalendarEvent(
  event: CalendarPlannedEvent,
  leadMode: CalendarReminderLead = '1-day-before'
): Promise<GoogleCalendarEventItem> {
  const token = getWorkspaceAccessToken();
  if (!token) {
    throw new Error('Conectá tu cuenta de Google para agendar en Google Calendar.');
  }

  const payload = buildGoogleEventPayload(event, leadMode);

  const res = await calendarFetch(CALENDAR_API_BASE, token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const created = (await res.json()) as RawGoogleCalendarEvent;
  const mapped = mapRawEvent(created);
  if (!mapped) {
    throw new Error('Google Calendar devolvió un evento incompleto.');
  }
  return mapped;
}

export async function patchGoogleCalendarEvent(
  googleEventId: string,
  event: CalendarPlannedEvent,
  leadMode: CalendarReminderLead = '1-day-before'
): Promise<GoogleCalendarEventItem> {
  const token = getWorkspaceAccessToken();
  if (!token) {
    throw new Error('Conectá tu cuenta de Google para actualizar el evento.');
  }

  const payload = buildGoogleEventPayload(event, leadMode);
  const res = await calendarFetch(
    `${CALENDAR_API_BASE}/${encodeURIComponent(googleEventId)}`,
    token,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }
  );
  const updated = (await res.json()) as RawGoogleCalendarEvent;
  const mapped = mapRawEvent(updated);
  if (!mapped) {
    throw new Error('Google Calendar devolvió un evento incompleto al actualizar.');
  }
  return mapped;
}

export async function batchCreateGoogleCalendarEvents(
  events: CalendarPlannedEvent[],
  leadMode: CalendarReminderLead = '1-day-before'
): Promise<{
  created: GoogleCalendarEventItem[];
  failed: Array<{ title: string; error: string }>;
}> {
  const created: GoogleCalendarEventItem[] = [];
  const failed: Array<{ title: string; error: string }> = [];

  for (const ev of events) {
    try {
      const item = await createGoogleCalendarEvent(ev, leadMode);
      created.push(item);
    } catch (err) {
      failed.push({
        title: ev.title,
        error: err instanceof Error ? err.message : 'Error desconocido',
      });
    }
  }

  return { created, failed };
}

export async function deleteGoogleCalendarEvent(
  googleEventId: string
): Promise<void> {
  const token = getWorkspaceAccessToken();
  if (!token) {
    throw new Error('Conectá tu cuenta de Google para quitar el evento del calendario.');
  }
  await calendarFetch(
    `${CALENDAR_API_BASE}/${encodeURIComponent(googleEventId)}`,
    token,
    { method: 'DELETE' }
  );
}
