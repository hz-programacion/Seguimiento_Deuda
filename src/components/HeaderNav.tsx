import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Calendar,
  CreditCard,
  Layers,
  LayoutDashboard,
  ListChecks,
  LogOut,
  MoreHorizontal,
  Plus,
  ShieldCheck,
  Users,
  Wallet,
  X,
} from 'lucide-react';
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

const DESKTOP_NAV_ITEMS: Array<{ id: AppTab; label: string }> = [
  { id: 'tablero', label: 'Tablero' },
  { id: 'checklist', label: 'Movimientos' },
  { id: 'quincenas', label: 'Ingresos' },
  { id: 'tarjetas', label: 'Tarjetas' },
  { id: 'extincion', label: 'Cuotas' },
  { id: 'calendario', label: 'Calendario' },
];

const MOBILE_PRIMARY_TABS: Array<{
  id: Exclude<AppTab, 'quincenas' | 'calendario'>;
  label: string;
  Icon: React.FC<{ className?: string }>;
}> = [
  { id: 'tablero', label: 'Tablero', Icon: LayoutDashboard },
  { id: 'checklist', label: 'Movim.', Icon: ListChecks },
  { id: 'tarjetas', label: 'Tarjetas', Icon: CreditCard },
  { id: 'extincion', label: 'Cuotas', Icon: Layers },
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
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);

  const isSecondaryActive =
    activeTab === 'quincenas' || activeTab === 'calendario';

  useEffect(() => {
    if (!mobileMoreOpen) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileMoreOpen(false);
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [mobileMoreOpen]);

  const handleMobileSelect = (tab: AppTab) => {
    onSelectTab(tab);
    setMobileMoreOpen(false);
  };

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-[#DFDDD4] bg-[#FFFFFF]/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-4 px-4 py-2.5 sm:px-6 md:gap-6 md:py-3 lg:px-8">
          {/* Zona 1: Wordmark limpio */}
          <button
            type="button"
            onClick={() => handleMobileSelect('tablero')}
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
            className="hidden md:flex items-center gap-5 lg:gap-7"
          >
            {DESKTOP_NAV_ITEMS.map((item) => {
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
                      transition={{
                        type: 'spring',
                        stiffness: 480,
                        damping: 36,
                      }}
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
                aria-label="Gestionar usuarios del hogar"
                className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-[#E4E3DD] bg-[#F6F6F3] px-2.5 py-1.5 text-xs font-medium text-[#111318] transition-colors hover:bg-[#EEEDE8] whitespace-nowrap shrink-0 sm:px-3"
              >
                <Users
                  className="h-3.5 w-3.5 text-[#1D4ED8]"
                  aria-hidden="true"
                />
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
                className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg bg-[#1D4ED8] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#1E40AF] whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1D4ED8] sm:px-3.5"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                <span className="hidden sm:inline">Nuevo Registro</span>
                <span className="sm:hidden">Nuevo</span>
              </button>
            )}

            <button
              type="button"
              onClick={onSignOut}
              title={userEmail ? `Cerrar sesión (${userEmail})` : 'Cerrar sesión'}
              aria-label="Cerrar sesión"
              className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-[#E4E3DD] bg-white px-2.5 py-1.5 text-xs font-medium text-[#525866] transition-colors hover:bg-[#F6F6F3] hover:text-[#111318] whitespace-nowrap shrink-0"
            >
              <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="hidden lg:inline">Salir</span>
            </button>
          </div>
        </div>
      </header>

      {/* Sheet inferior móvil para secciones secundarias (Ingresos y Calendario) */}
      <AnimatePresence>
        {mobileMoreOpen && (
          <div className="fixed inset-0 z-50 md:hidden">
            <motion.button
              type="button"
              aria-label="Cerrar menú adicional"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileMoreOpen(false)}
              className="fixed inset-0 bg-[#111318]/40 backdrop-blur-[2px]"
            />
            <motion.div
              role="dialog"
              aria-label="Más secciones"
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
              className="fixed inset-x-0 bottom-[62px] z-50 rounded-t-3xl border-t border-[#DFDDD4] bg-white p-4 shadow-xl"
            >
              <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-[#DFDDD4]" />
              <div className="mb-3 flex items-center justify-between px-1">
                <p className="font-display text-sm font-bold text-[#111318]">
                  Más secciones
                </p>
                <button
                  type="button"
                  onClick={() => setMobileMoreOpen(false)}
                  aria-label="Cerrar"
                  className="inline-flex min-h-[36px] min-w-[36px] items-center justify-center rounded-lg text-[#525866] hover:bg-[#F7F7F3]"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
              <div className="grid grid-cols-1 gap-2">
                <button
                  type="button"
                  onClick={() => handleMobileSelect('quincenas')}
                  className={`flex min-h-[52px] items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors ${
                    activeTab === 'quincenas'
                      ? 'border-[#BFDBFE] bg-[#EFF6FF] text-[#1D4ED8]'
                      : 'border-[#E7E5DC] bg-[#FAF9F6] text-[#111318] hover:bg-[#F7F7F3]'
                  }`}
                >
                  <Wallet className="h-5 w-5 shrink-0 text-[#1D4ED8]" aria-hidden="true" />
                  <div>
                    <span className="block text-sm font-bold">
                      Ingresos y Quincenas
                    </span>
                    <span className="block text-xs text-[#525866]">
                      Cobros del mes, tope comida y calce 1°Q / 2°Q
                    </span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => handleMobileSelect('calendario')}
                  className={`flex min-h-[52px] items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors ${
                    activeTab === 'calendario'
                      ? 'border-[#BFDBFE] bg-[#EFF6FF] text-[#1D4ED8]'
                      : 'border-[#E7E5DC] bg-[#FAF9F6] text-[#111318] hover:bg-[#F7F7F3]'
                  }`}
                >
                  <Calendar className="h-5 w-5 shrink-0 text-[#1D4ED8]" aria-hidden="true" />
                  <div>
                    <span className="block text-sm font-bold">
                      Calendario y Agenda
                    </span>
                    <span className="block text-xs text-[#525866]">
                      Días hábiles, Google Calendar y exportación .ics
                    </span>
                  </div>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Barra inferior fija para pulgar en móvil (<= 62px altura) */}
      <nav
        aria-label="Navegación móvil"
        className="fixed bottom-0 inset-x-0 z-40 border-t border-[#DFDDD4] bg-white/95 backdrop-blur-md md:hidden"
      >
        <div className="grid h-[62px] grid-cols-5 items-center px-1">
          {MOBILE_PRIMARY_TABS.map(({ id, label, Icon }) => {
            const isActive = activeTab === id && !mobileMoreOpen;
            return (
              <button
                key={id}
                type="button"
                onClick={() => handleMobileSelect(id)}
                aria-current={isActive ? 'page' : undefined}
                className={`flex min-h-[44px] flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-1 text-[10px] font-medium transition-colors ${
                  isActive
                    ? 'font-bold text-[#1D4ED8]'
                    : 'text-[#525866] hover:text-[#111318]'
                }`}
              >
                <Icon
                  className={`h-5 w-5 ${isActive ? 'text-[#1D4ED8]' : 'text-[#686E7D]'}`}
                  aria-hidden="true"
                />
                <span className="truncate">{label}</span>
              </button>
            );
          })}

          <button
            type="button"
            onClick={() => setMobileMoreOpen((v) => !v)}
            aria-expanded={mobileMoreOpen}
            aria-label="Más secciones: Ingresos y Calendario"
            className={`flex min-h-[44px] flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-1 text-[10px] font-medium transition-colors ${
              isSecondaryActive || mobileMoreOpen
                ? 'font-bold text-[#1D4ED8]'
                : 'text-[#525866] hover:text-[#111318]'
            }`}
          >
            <MoreHorizontal
              className={`h-5 w-5 ${
                isSecondaryActive || mobileMoreOpen
                  ? 'text-[#1D4ED8]'
                  : 'text-[#686E7D]'
              }`}
              aria-hidden="true"
            />
            <span className="truncate">
              {activeTab === 'quincenas'
                ? 'Ingresos'
                : activeTab === 'calendario'
                  ? 'Agenda'
                  : 'Más'}
            </span>
          </button>
        </div>
      </nav>
    </>
  );
};
