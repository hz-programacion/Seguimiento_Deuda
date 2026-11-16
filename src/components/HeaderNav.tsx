import React from 'react';
import { motion } from 'motion/react';
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
  { id: 'checklist', label: 'Movimientos' },
  { id: 'quincenas', label: 'Quincenas' },
  { id: 'extincion', label: 'Extinción' },
  { id: 'calendario', label: 'Calendario' },
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
    <header className="sticky top-0 z-30 border-b border-[#DFDDD4] bg-[#FFFFFF]/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-6 px-4 py-3 sm:px-6 lg:px-8">
        {/* Zona 1: Wordmark limpio */}
        <button
          type="button"
          onClick={() => onSelectTab('tablero')}
          className="inline-flex items-center gap-2.5 text-left font-display text-lg font-bold tracking-tight text-[#111318] whitespace-nowrap shrink-0 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1D4ED8]"
        >
          <svg
            className="h-6 w-6 shrink-0 text-[#1D4ED8]"
            viewBox="0 0 32 32"
            fill="none"
            aria-hidden="true"
          >
            <rect
              x="2"
              y="2"
              width="28"
              height="28"
              rx="7"
              fill="#EFF6FF"
              stroke="currentColor"
              strokeWidth="1.75"
            />
            <path
              d="M10 21V11.5L16 8.5L22 11.5V21"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M12.5 17.5H19.5"
              stroke="#4338CA"
              strokeWidth="1.75"
              strokeLinecap="round"
            />
          </svg>
          <span>ArgenCaja</span>
        </button>

        {/* Zona 2: Enlaces de navegación en escritorio */}
        <nav
          aria-label="Navegación principal"
          className="hidden md:flex items-center gap-7"
        >
          {NAV_ITEMS.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectTab(item.id)}
                aria-current={isActive ? 'page' : undefined}
                className={`relative py-2 text-sm font-medium transition-colors whitespace-nowrap shrink-0 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1D4ED8] ${
                  isActive
                    ? 'font-semibold text-[#111318]'
                    : 'text-[#525866] hover:text-[#111318]'
                }`}
              >
                {item.label}
                {isActive && (
                  <motion.span
                    layoutId="header-active-indicator"
                    transition={{ type: 'spring', stiffness: 480, damping: 36 }}
                    aria-hidden="true"
                    className="absolute inset-x-0 -bottom-[13px] h-[2px] bg-[#1D4ED8]"
                  />
                )}
              </button>
            );
          })}
        </nav>

        {/* Zona 3: Rol + Usuarios + Nuevo Registro + Salir */}
        <div className="flex items-center gap-2 shrink-0">
          <span
            className={`hidden xl:inline-flex items-center gap-1.5 text-xs font-medium whitespace-nowrap mr-1 ${
              canEditFinances ? 'text-[#1D4ED8]' : 'text-[#4338CA]'
            }`}
          >
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
            {canEditFinances ? 'Admin Total' : 'Colaboradora'}
          </span>

          {canEditFinances && (
            <button
              type="button"
              onClick={onOpenUserManagement}
              title="Aprobar ingresos e invitar a tu hermana"
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#E4E3DD] bg-[#F6F6F3] px-3 py-1.5 text-xs font-medium text-[#111318] transition-colors hover:bg-[#EEEDE8] whitespace-nowrap shrink-0"
            >
              <Users className="h-3.5 w-3.5 text-[#1D4ED8]" aria-hidden="true" />
              <span className="hidden sm:inline">Usuarios</span>
              {pendingRequestsCount > 0 && (
                <span className="rounded bg-[#D97706] px-1.5 py-0.5 font-mono-tabular text-[10px] font-bold text-white">
                  {pendingRequestsCount}
                </span>
              )}
            </button>
          )}

          {canEditFinances && (
            <button
              type="button"
              onClick={onCreateNew}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#1D4ED8] px-3.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#1E40AF] whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1D4ED8]"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              <span>Nuevo Registro</span>
            </button>
          )}

          <button
            type="button"
            onClick={onSignOut}
            title={userEmail ? `Cerrar sesión (${userEmail})` : 'Cerrar sesión'}
            aria-label="Cerrar sesión"
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#E4E3DD] bg-white px-2.5 py-1.5 text-xs font-medium text-[#525866] transition-colors hover:bg-[#F6F6F3] hover:text-[#111318] whitespace-nowrap shrink-0"
          >
            <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="hidden lg:inline">Salir</span>
          </button>
        </div>
      </div>

      {/* Navegación móvil */}
      <nav
        aria-label="Navegación móvil"
        className="flex md:hidden items-center gap-1 overflow-x-auto border-t border-[#EEEDE8] px-4 py-2"
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
                  ? 'bg-[#EFF6FF] font-semibold text-[#1D4ED8]'
                  : 'text-[#525866] hover:text-[#111318]'
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
