import React from 'react';
import { motion } from 'motion/react';
import {
  ArrowRight,
  Clock,
  Lock,
  LogOut,
  RefreshCw,
  ShieldAlert,
} from 'lucide-react';
import { AccessResolution } from '../services/householdAuthService';

interface AuthGateScreenProps {
  resolution: AccessResolution;
  loading: boolean;
  errorMessage: string | null;
  onSignIn: () => Promise<void>;
  onRetryCheck: () => Promise<void>;
  onSignOut: () => Promise<void>;
}

export const AuthGateScreen: React.FC<AuthGateScreenProps> = ({
  resolution,
  loading,
  errorMessage,
  onSignIn,
  onRetryCheck,
  onSignOut,
}) => {
  const isPending = resolution.status === 'PENDING_APPROVAL';
  const isRevoked = resolution.status === 'REVOKED';
  const isUnverified = resolution.status === 'UNVERIFIED';

  return (
    <div className="relative flex min-h-screen flex-col justify-between overflow-hidden bg-[#EFEFEA] px-5 py-6 text-[#111318] sm:px-8">
      {/* Fondo arquitectónico sutil sin ruido visual */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-architectural-grid opacity-55 [mask-image:radial-gradient(ellipse_65%_55%_at_50%_45%,black,transparent)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-1/3 h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#1D4ED8]/[0.06] blur-[110px]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute right-[12%] bottom-[15%] h-[280px] w-[280px] rounded-full bg-[#4338CA]/[0.05] blur-[100px]"
      />

      {/* Cabecera minimalista */}
      <header className="relative mx-auto flex w-full max-w-[1120px] items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <svg
            className="h-7 w-7 shrink-0 text-[#1D4ED8]"
            viewBox="0 0 32 32"
            fill="none"
            aria-hidden="true"
          >
            <rect
              x="2"
              y="2"
              width="28"
              height="28"
              rx="8"
              fill="#FFFFFF"
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
          <span className="font-display text-lg font-bold tracking-tight text-[#111318]">
            ArgenCaja
          </span>
        </div>

        <span className="text-xs font-medium text-[#525866]">
          Acceso Privado · ARS
        </span>
      </header>

      {/* Portal central compacto acorde a diseños actuales */}
      <main className="relative mx-auto my-auto flex w-full max-w-[430px] flex-col items-center py-8">
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
          aria-labelledby="auth-portal-title"
          className="w-full overflow-hidden rounded-3xl border border-[#DFDDD4] bg-white shadow-[0_24px_60px_-16px_rgba(17,19,24,0.1)]"
        >
          {/* Franja superior artística con acento geométrico */}
          <div className="relative border-b border-[#EEEDE8] bg-[#F7F7F3] px-7 py-6">
            <svg
              aria-hidden="true"
              className="pointer-events-none absolute right-4 top-3 h-16 w-28 text-[#1D4ED8]/[0.12]"
              viewBox="0 0 120 64"
              fill="none"
            >
              <circle cx="92" cy="24" r="22" stroke="currentColor" strokeWidth="1.5" />
              <circle cx="64" cy="40" r="14" stroke="currentColor" strokeOpacity="0.65" strokeWidth="1.5" />
              <path d="M12 52C32 22 68 22 108 46" stroke="currentColor" strokeWidth="1.25" />
            </svg>

            <div className="relative flex items-center gap-3.5">
              <div
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border ${
                  isRevoked || isUnverified
                    ? 'border-[#FECACA] bg-[#FEF2F2] text-[#DC2626]'
                    : isPending
                      ? 'border-[#FDE68A] bg-[#FFFBEB] text-[#D97706]'
                      : 'border-[#BFDBFE] bg-white text-[#1D4ED8] shadow-xs'
                }`}
              >
                {isRevoked || isUnverified ? (
                  <ShieldAlert className="h-5 w-5" aria-hidden="true" />
                ) : isPending ? (
                  <Clock className="h-5 w-5" aria-hidden="true" />
                ) : (
                  <Lock className="h-5 w-5" aria-hidden="true" />
                )}
              </div>

              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#1D4ED8]">
                  Tesorería del Hogar
                </p>
                <h1
                  id="auth-portal-title"
                  className="mt-0.5 font-display text-2xl font-bold tracking-tight text-[#111318]"
                >
                  {isPending
                    ? 'Esperando aprobación'
                    : isRevoked
                      ? 'Acceso deshabilitado'
                      : isUnverified
                        ? 'Correo sin verificar'
                        : 'Iniciar sesión'}
                </h1>
              </div>
            </div>
          </div>

          {/* Cuerpo limpio y directo */}
          <div className="px-7 py-6">
            {resolution.status === 'UNAUTHENTICATED' && (
              <p className="text-sm leading-relaxed text-[#525866]">
                Ingresá con tu cuenta autorizada de Google para gestionar tus quincenas, vencimientos, tarjetas y agenda.
              </p>
            )}

            {isPending && (
              <div className="space-y-3">
                <p className="text-sm text-[#111318]">
                  Tu cuenta{' '}
                  <span className="font-mono-tabular font-semibold">
                    {resolution.email}
                  </span>{' '}
                  {resolution.requestStatus === 'RECHAZADA'
                    ? 'no fue autorizada por el administrador.'
                    : 'está esperando aprobación del administrador.'}
                </p>
                <p className="rounded-xl border border-[#FDE68A] bg-[#FFFBEB] p-3.5 text-xs leading-relaxed text-[#92400E]">
                  {resolution.requestStatus === 'RECHAZADA'
                    ? 'Pedile al administrador que te habilite desde el panel de Usuarios.'
                    : 'Los saldos y vencimientos permanecen ocultos hasta confirmar tu ingreso.'}
                </p>
              </div>
            )}

            {isRevoked && (
              <p className="rounded-xl border border-[#FECACA] bg-[#FEF2F2] p-3.5 text-xs leading-relaxed text-[#B91C1C]">
                El acceso para{' '}
                <span className="font-mono-tabular font-semibold">
                  {resolution.email}
                </span>{' '}
                fue revocado por el administrador.
              </p>
            )}

            {isUnverified && (
              <p className="rounded-xl border border-[#FECACA] bg-[#FEF2F2] p-3.5 text-xs leading-relaxed text-[#B91C1C]">
                Tu cuenta ({resolution.email}) no posee correo verificado por Google.
              </p>
            )}

            {errorMessage && (
              <p
                role="alert"
                className="mt-4 rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-3.5 py-2.5 text-xs font-medium text-[#B91C1C]"
              >
                {errorMessage}
              </p>
            )}

            <div className="mt-6 flex flex-col gap-2.5">
              {resolution.status === 'UNAUTHENTICATED' ? (
                <button
                  type="button"
                  disabled={loading}
                  onClick={onSignIn}
                  className="group flex w-full items-center justify-center gap-3 rounded-xl border border-[#D4D2CA] bg-white px-4 py-3 text-sm font-semibold text-[#111318] shadow-xs transition-all hover:border-[#1D4ED8]/50 hover:bg-[#F7F7F3] active:scale-[0.99] disabled:opacity-60"
                >
                  <svg
                    className="h-4 w-4 shrink-0"
                    viewBox="0 0 48 48"
                    aria-hidden="true"
                  >
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
                  <span>
                    {loading ? 'Verificando identidad...' : 'Sign in with Google'}
                  </span>
                  <ArrowRight
                    className="h-4 w-4 text-[#525866] transition-transform group-hover:translate-x-0.5"
                    aria-hidden="true"
                  />
                </button>
              ) : (
                <>
                  {isPending && (
                    <button
                      type="button"
                      disabled={loading}
                      onClick={onRetryCheck}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#1D4ED8] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#1E40AF] disabled:opacity-60"
                    >
                      <RefreshCw
                        className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`}
                        aria-hidden="true"
                      />
                      Verificar aprobación
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={loading}
                    onClick={onSignOut}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[#DFDDD4] bg-[#F7F7F3] px-4 py-2.5 text-xs font-medium text-[#111318] transition-colors hover:bg-[#EEEDE8]"
                  >
                    <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
                    Cerrar sesión y cambiar cuenta
                  </button>
                </>
              )}
            </div>

            <p className="mt-5 border-t border-[#EEEDE8] pt-4 text-center text-[11px] text-[#747A88]">
              Acceso exclusivo por invitación · Datos protegidos en Firestore
            </p>
          </div>
        </motion.section>
      </main>

      {/* Pie sobrio */}
      <footer className="relative mx-auto flex w-full max-w-[1120px] items-center justify-between text-[11px] text-[#747A88]">
        <span>ArgenCaja</span>
        <span>Control quincenal del hogar</span>
      </footer>
    </div>
  );
};
