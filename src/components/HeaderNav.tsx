import React from 'react';
import { LogOut, Plus, ShieldCheck, Users } from 'lucide-react';
import { AppTab } from '../types/finance';

interface HeaderNavProps {
  activeTab: AppTab;
  canEditFinances: boolean;
  userEmail: string | null;
  pendingRequestsCount: number;
  onSelectTab: (tab: AppTab) => void;
  onCreateNew: () => void;
  onOpenUserManagement: () => void;
  onSignOut: () => void;
}

const NAV_ITEMS: Array<{ id: AppTab; label: string }> = [
  { id: 'tablero', label: 'Tablero' },
  { id: 'checklist', label: 'Check-list' },
  { id: 'quincenas', label: 'Quincenas' },
  { id: 'extincion', label: 'Extinción' },
];

export const HeaderNav: React.FC<HeaderNavProps> = ({
  activeTab,
  canEditFinances,
  userEmail,
  pendingRequestsCount,
  onSelectTab,
  onCreateNew,
  onOpenUserManagement,
  onSignOut,
}) => {
  return (
    <header className="border-b border-slate-800/90 bg-slate-950">
      <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-4 px-4 py-4 sm:gap-6 sm:px-6 lg:px-8">
        {/* Zona 1: Brand wordmark + Rol */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={() => onSelectTab('tablero')}
            className="text-left text-lg font-bold tracking-tight text-slate-100 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 rounded-md"
          >
            ArgenCaja
          </button>
          <span
            className={`hidden sm:inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap ${
              canEditFinances
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                : 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300'
            }`}
          >
            <ShieldCheck className="h-3 w-3" aria-hidden="true" />
            {canEditFinances
              ? 'Admin Total'
              : 'Colaboradora (Lectura y comprobantes)'}
          </span>
        </div>

        {/* Zona 2: Enlaces de navegación limpios en escritorio */}
        <nav
          aria-label="Navegación principal"
          className="hidden md:flex items-center gap-6"
        >
          {NAV_ITEMS.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectTab(item.id)}
                aria-current={isActive ? 'page' : undefined}
                className={`relative py-1.5 text-sm font-medium transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 rounded ${
                  isActive
                    ? 'text-emerald-400'
                    : 'text-slate-400 hover:text-slate-100'
                }`}
              >
                {item.label}
                {isActive && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-0 -bottom-[17px] h-0.5 bg-emerald-400"
                  />
                )}
              </button>
            );
          })}
        </nav>

        {/* Zona 3: Acción primaria + Gestión de usuarios / Cerrar sesión */}
        <div className="flex items-center gap-2 shrink-0">
          {canEditFinances && (
            <button
              type="button"
              onClick={onOpenUserManagement}
              title="Aprobar ingresos e invitar a tu hermana"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-medium text-slate-200 transition-colors hover:bg-slate-800 whitespace-nowrap shrink-0"
            >
              <Users className="h-3.5 w-3.5 text-cyan-400" aria-hidden="true" />
              <span className="hidden sm:inline">Usuarios</span>
              {pendingRequestsCount > 0 && (
                <span className="rounded bg-amber-500 px-1.5 py-0.2 text-[10px] font-bold text-slate-950 font-mono-tabular">
                  {pendingRequestsCount}
                </span>
              )}
            </button>
          )}

          {canEditFinances && (
            <button
              type="button"
              onClick={onCreateNew}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-3.5 py-2 text-xs font-semibold text-slate-950 transition-colors hover:bg-emerald-400 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Nuevo Registro
            </button>
          )}

          <button
            type="button"
            onClick={onSignOut}
            title={userEmail ? `Cerrar sesión (${userEmail})` : 'Cerrar sesión'}
            aria-label="Cerrar sesión"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-950 px-2.5 py-2 text-xs font-medium text-slate-400 transition-colors hover:border-slate-700 hover:text-slate-100 whitespace-nowrap shrink-0"
          >
            <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="hidden lg:inline">Salir</span>
          </button>
        </div>
      </div>

      {/* Navegación secundaria para móvil */}
      <nav
        aria-label="Navegación móvil"
        className="flex md:hidden items-center gap-2 overflow-x-auto border-t border-slate-800/70 px-4 py-2"
      >
        {NAV_ITEMS.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectTab(item.id)}
              aria-current={isActive ? 'page' : undefined}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                isActive
                  ? 'bg-slate-800 text-emerald-400'
                  : 'text-slate-400 hover:text-slate-100'
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </nav>
    </header>
  );
};
