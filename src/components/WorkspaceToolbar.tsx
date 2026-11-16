import React, { useEffect, useRef, useState } from 'react';
import {
  Calendar,
  CalendarPlus,
  Cloud,
  Database,
  FastForward,
  MoreHorizontal,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { PeriodoID } from '../types/finance';
import {
  formatPeriodoLabel,
  formatPeriodoShort,
  getNextPeriodoId,
} from '../utils/dateUtils';
import { PWAInstallButton } from './PWAInstallButton';

interface WorkspaceToolbarProps {
  activePeriodo: PeriodoID;
  availablePeriodos: PeriodoID[];
  referenceDateISO: string;
  canEditFinances: boolean;
  onChangeReferenceDateISO: (dateISO: string) => void;
  onSelectPeriodo: (p: PeriodoID) => void;
  onAdvanceNextMonth: () => void;
  onProjectSixMonths: () => void;
  includeSac: boolean;
  onToggleSac: () => void;
  canToggleSac: boolean;
  cloudStatus: 'local' | 'connected' | 'syncing';
  cloudUserEmail?: string | null;
  hasDriveToken?: boolean;
  driveUserEmail?: string | null;
  onOpenFirebaseConfig: () => void;
  onResetSeed: () => void;
}

export const WorkspaceToolbar: React.FC<WorkspaceToolbarProps> = ({
  activePeriodo,
  availablePeriodos,
  referenceDateISO,
  canEditFinances,
  onChangeReferenceDateISO,
  onSelectPeriodo,
  onAdvanceNextMonth,
  onProjectSixMonths,
  includeSac,
  onToggleSac,
  canToggleSac,
  cloudStatus,
  cloudUserEmail,
  hasDriveToken = false,
  driveUserEmail,
  onOpenFirebaseConfig,
  onResetSeed,
}) => {
  const [moreOpen, setMoreOpen] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  const nextPeriodo = getNextPeriodoId(activePeriodo);
  const nextPeriodoExists = availablePeriodos.includes(nextPeriodo);
  const anyCloudConnected = cloudStatus === 'connected' || hasDriveToken;
  const activeMonthLabel = formatPeriodoLabel(activePeriodo);

  useEffect(() => {
    if (!moreOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        moreMenuRef.current &&
        !moreMenuRef.current.contains(e.target as Node)
      ) {
        setMoreOpen(false);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMoreOpen(false);
    };
    window.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleEsc);
    return () => {
      window.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleEsc);
    };
  }, [moreOpen]);

  return (
    <section
      aria-label="Controles del período"
      className="border-b border-[#DFDDD4] bg-[#F7F7F3]"
    >
      <div className="mx-auto flex max-w-[1400px] flex-col gap-2.5 px-4 py-2.5 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
        {/* Selector compacto de meses + siguiente mes */}
        <div className="flex flex-wrap items-center gap-2">
          <div
            role="group"
            aria-label="Meses disponibles"
            className="flex flex-wrap items-center gap-1 rounded-lg border border-[#E4E3DD] bg-white p-1"
          >
            {availablePeriodos.map((p) => {
              const active = p === activePeriodo;
              return (
                <button
                  key={p}
                  type="button"
                  aria-pressed={active}
                  onClick={() => onSelectPeriodo(p)}
                  className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1D4ED8] ${
                    active
                      ? 'bg-[#1D4ED8] text-white'
                      : 'text-[#525866] hover:bg-[#F6F6F3] hover:text-[#111318]'
                  }`}
                >
                  {formatPeriodoShort(p)}
                </button>
              );
            })}
          </div>

          {canEditFinances && (
            <button
              type="button"
              onClick={onAdvanceNextMonth}
              aria-label="Avanzar al Mes Siguiente"
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#BFDBFE] bg-[#EFF6FF] px-3 py-1.5 text-xs font-semibold text-[#1D4ED8] transition-colors hover:bg-[#DBEAFE] whitespace-nowrap shrink-0"
            >
              <CalendarPlus className="h-3.5 w-3.5" aria-hidden="true" />
              <span>
                {nextPeriodoExists
                  ? `Ir a ${formatPeriodoShort(nextPeriodo)}`
                  : `Crear ${formatPeriodoShort(nextPeriodo)}`}
              </span>
            </button>
          )}
        </div>

        {/* Controles derechos sin ruido: Fecha análisis + Workspace + Más */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-1.5 rounded-lg border border-[#E4E3DD] bg-white px-2.5 py-1.5 text-xs">
            <Calendar
              className="h-3.5 w-3.5 text-[#1D4ED8] shrink-0"
              aria-hidden="true"
            />
            <label
              htmlFor="ref-date-input"
              className="text-[#525866] whitespace-nowrap"
            >
              Fecha hoy:
            </label>
            <input
              id="ref-date-input"
              type="date"
              value={referenceDateISO}
              onChange={(e) => {
                if (e.target.value) onChangeReferenceDateISO(e.target.value);
              }}
              className="bg-transparent font-mono-tabular text-xs font-semibold text-[#111318] focus:outline-none"
            />
          </div>

          {canToggleSac && canEditFinances && (
            <button
              type="button"
              role="switch"
              aria-checked={includeSac}
              aria-label="Incluir Aguinaldo (SAC) Estimado (+$500.000,00)"
              onClick={onToggleSac}
              title={`Aguinaldo (SAC) en ${activeMonthLabel} (+$500.000,00)`}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                includeSac
                  ? 'border-[#1D4ED8] bg-[#EFF6FF] text-[#1D4ED8]'
                  : 'border-[#E4E3DD] bg-white text-[#525866] hover:text-[#111318]'
              }`}
            >
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              <span>SAC {includeSac ? 'Activo' : '+$500k'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={onOpenFirebaseConfig}
            title={
              anyCloudConnected
                ? `Conectado (${driveUserEmail ?? cloudUserEmail ?? 'sesión activa'})`
                : 'Respaldo JSON, Google Drive y Google Calendar'
            }
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#E4E3DD] bg-white px-2.5 py-1.5 text-xs font-medium text-[#111318] transition-colors hover:bg-[#EEEDE8] whitespace-nowrap shrink-0"
          >
            {anyCloudConnected ? (
              <Cloud
                className="h-3.5 w-3.5 text-[#1D4ED8]"
                aria-hidden="true"
              />
            ) : (
              <Database
                className="h-3.5 w-3.5 text-[#525866]"
                aria-hidden="true"
              />
            )}
            <span>
              {hasDriveToken ? 'Google Conectado' : 'Nube y Respaldo'}
            </span>
          </button>

          <PWAInstallButton />

          {canEditFinances && (
            <div ref={moreMenuRef} className="relative">
              <button
                type="button"
                aria-expanded={moreOpen}
                aria-haspopup="menu"
                aria-label="Más herramientas del período"
                onClick={() => setMoreOpen((v) => !v)}
                className="inline-flex items-center gap-1 rounded-lg border border-[#E4E3DD] bg-white px-2.5 py-1.5 text-xs font-medium text-[#525866] transition-colors hover:bg-[#EEEDE8] hover:text-[#111318] whitespace-nowrap shrink-0"
              >
                <MoreHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Más</span>
              </button>

              {moreOpen && (
                <div
                  role="menu"
                  className="absolute right-0 z-40 mt-1.5 w-60 rounded-xl border border-[#E4E3DD] bg-white p-1.5 shadow-lg"
                >
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setMoreOpen(false);
                      onProjectSixMonths();
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-medium text-[#111318] hover:bg-[#F6F6F3]"
                  >
                    <FastForward
                      className="h-3.5 w-3.5 text-[#1D4ED8]"
                      aria-hidden="true"
                    />
                    <div>
                      <span className="block font-semibold">
                        Generar 6 meses
                      </span>
                      <span className="block text-[11px] text-[#747A88]">
                        Proyecta cuotas y cierres
                      </span>
                    </div>
                  </button>

                  <button
                    type="button"
                    role="menuitem"
                    aria-label="Restaurar datos semilla Diciembre 2026"
                    onClick={() => {
                      setMoreOpen(false);
                      onResetSeed();
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-medium text-[#B91C1C] hover:bg-[#FEF2F2]"
                  >
                    <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                    <div>
                      <span className="block font-semibold">
                        Restaurar base inicial
                      </span>
                      <span className="block text-[11px] text-[#747A88]">
                        Volver a Diciembre 2026
                      </span>
                    </div>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
