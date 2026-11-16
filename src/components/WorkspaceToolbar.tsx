import React from 'react';
import {
  Calendar,
  CalendarPlus,
  Cloud,
  Database,
  FastForward,
  RotateCcw,
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
  const nextPeriodo = getNextPeriodoId(activePeriodo);
  const nextPeriodoExists = availablePeriodos.includes(nextPeriodo);
  const anyCloudConnected = cloudStatus === 'connected' || hasDriveToken;
  const activeMonthLabel = formatPeriodoLabel(activePeriodo);

  return (
    <section
      aria-label="Controles del período"
      className="border-b border-slate-800/80 bg-slate-900/40"
    >
      <div className="mx-auto flex max-w-[1400px] flex-col gap-3 px-4 py-3.5 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          {/* Selector visual de meses + botón directo para crear/ir al siguiente mes */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-1 text-xs font-medium text-slate-400">
              Meses:
            </span>
            <div
              role="group"
              aria-label="Meses disponibles"
              className="flex flex-wrap items-center gap-1 rounded-lg border border-slate-800 bg-slate-950/70 p-1"
            >
              {availablePeriodos.map((p) => {
                const active = p === activePeriodo;
                return (
                  <button
                    key={p}
                    type="button"
                    aria-pressed={active}
                    onClick={() => onSelectPeriodo(p)}
                    className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${
                      active
                        ? 'bg-emerald-500 text-slate-950'
                        : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    {formatPeriodoShort(p)}
                  </button>
                );
              })}
            </div>

            {canEditFinances && (
              <>
                <button
                  type="button"
                  onClick={onAdvanceNextMonth}
                  aria-label="Avanzar al Mes Siguiente"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-300 transition-colors hover:bg-emerald-500/20 whitespace-nowrap shrink-0"
                >
                  <CalendarPlus className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>
                    {nextPeriodoExists
                      ? `Ir a ${formatPeriodoShort(nextPeriodo)}`
                      : `Crear ${formatPeriodoShort(nextPeriodo)}`}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={onProjectSixMonths}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-medium text-slate-200 transition-colors hover:bg-slate-800 whitespace-nowrap shrink-0"
                >
                  <FastForward className="h-3.5 w-3.5 text-cyan-400" aria-hidden="true" />
                  Generar 6 meses
                </button>
              </>
            )}
          </div>

          {/* Fecha de análisis bancario + Utilidades (Respaldo/Drive/Nube, Instalar, Reiniciar) */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-950 px-2.5 py-1.5 text-xs">
              <Calendar className="h-3.5 w-3.5 text-cyan-400" aria-hidden="true" />
              <label htmlFor="ref-date-input" className="text-slate-400 whitespace-nowrap">
                Fecha hoy:
              </label>
              <input
                id="ref-date-input"
                type="date"
                value={referenceDateISO}
                onChange={(e) => {
                  if (e.target.value) onChangeReferenceDateISO(e.target.value);
                }}
                className="bg-transparent text-xs font-semibold text-slate-100 font-mono-tabular focus:outline-none"
              />
            </div>

            <button
              type="button"
              onClick={onOpenFirebaseConfig}
              title={
                anyCloudConnected
                  ? `Conectado (${driveUserEmail ?? cloudUserEmail ?? 'sesión activa'})`
                  : 'Descargar copia JSON, conectar Google Drive o ver estado Firestore'
              }
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-xs font-medium text-slate-300 transition-colors hover:border-slate-700 hover:text-slate-100 whitespace-nowrap shrink-0"
            >
              {anyCloudConnected ? (
                <Cloud className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
              ) : (
                <Database className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
              )}
              <span>
                {hasDriveToken && cloudStatus === 'connected'
                  ? 'Drive y Nube activos'
                  : hasDriveToken
                    ? 'Drive conectado'
                    : cloudStatus === 'connected'
                      ? 'Nube conectada'
                      : 'Respaldo y Drive'}
              </span>
            </button>

            <PWAInstallButton />

            {canEditFinances && (
              <button
                type="button"
                onClick={onResetSeed}
                title="Volver a los datos iniciales de Diciembre 2026"
                aria-label="Restaurar datos semilla Diciembre 2026"
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs font-medium text-slate-400 transition-colors hover:border-slate-700 hover:text-slate-200 whitespace-nowrap shrink-0"
              >
                <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Restaurar</span>
              </button>
            )}
          </div>
        </div>

        {/* Toggle Especial de Aguinaldo (SAC) en Junio y Diciembre (solo Admin) */}
        {canToggleSac && canEditFinances && (
          <div className="flex flex-col gap-2 rounded-lg border border-slate-800 bg-slate-900/70 px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-0.5">
              <p className="text-xs font-semibold text-slate-100">
                Incluir Aguinaldo (SAC) Estimado (+$500.000,00)
              </p>
              <p className="text-xs text-slate-400">
                Suma $500.000,00 a {activeMonthLabel} para simular si pagás la quita o bajás tarjeta (podés editar el monto abajo).
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={includeSac}
              aria-label="Incluir Aguinaldo (SAC) Estimado (+$500.000,00)"
              onClick={onToggleSac}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${
                includeSac
                  ? 'border-emerald-400 bg-emerald-500'
                  : 'border-slate-700 bg-slate-800'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                  includeSac ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        )}
      </div>
    </section>
  );
};
