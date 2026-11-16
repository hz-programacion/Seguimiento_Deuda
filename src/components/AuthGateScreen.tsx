import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Clock,
  FolderLock,
  Lock,
  LogOut,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Utensils,
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

type DemoPhase = 'pre-cierre' | 'post-cierre';

export const AuthGateScreen: React.FC<AuthGateScreenProps> = ({
  resolution,
  loading,
  errorMessage,
  onSignIn,
  onRetryCheck,
  onSignOut,
}) => {
  const [demoPhase, setDemoPhase] = useState<DemoPhase>('pre-cierre');

  const isPending = resolution.status === 'PENDING_APPROVAL';
  const isRevoked = resolution.status === 'REVOKED';
  const isUnverified = resolution.status === 'UNVERIFIED';

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#F6F6F3] text-[#111318]">
      {/* Retícula arquitectónica sutil */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-architectural-grid opacity-80 [mask-image:radial-gradient(ellipse_80%_70%_at_30%_25%,black,transparent)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-48 -left-40 h-[480px] w-[480px] rounded-full bg-[#1D4ED8]/[0.06] blur-[120px]"
      />

      <div className="relative mx-auto flex min-h-screen max-w-[1320px] flex-col justify-between px-5 py-8 sm:px-8 lg:px-12 lg:py-10">
        {/* Cabecera limpia */}
        <header className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
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
            <span className="font-display text-lg font-bold tracking-tight text-[#111318]">
              ArgenCaja
            </span>
          </div>

          <span className="hidden sm:inline text-xs font-medium text-[#525866]">
            Tesorería Familiar Privada · Pesos Argentinos (ARS)
          </span>
        </header>

        {/* Cuerpo editorial asimétrico */}
        <main className="my-auto grid grid-cols-1 items-center gap-10 py-10 lg:grid-cols-12 lg:gap-14">
          {/* Propuesta + Vista interactiva ilustrativa (7 cols) */}
          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="space-y-8 lg:col-span-7"
          >
            <div className="space-y-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#1D4ED8]">
                Ingeniería de Caja Quincenal
              </p>
              <h1
                style={{ fontSize: 'clamp(2.2rem, 3.8vw, 3.35rem)' }}
                className="font-display font-bold leading-[1.06] tracking-[-0.03em] text-[#111318]"
              >
                Pagá primero lo urgente sin tocar la comida del mes.
              </h1>
              <p className="max-w-2xl text-sm leading-relaxed text-[#525866] sm:text-base">
                Organizá tus ingresos por quincena, evitá el doble pago en tarjetas de crédito antes del cierre y agendá cada vencimiento en tu Google Calendar con alertas anticipadas.
              </p>
            </div>

            {/* Simulador ilustrativo interactivo (sin datos reales expuestos) */}
            <div className="rounded-2xl border border-[#E4E3DD] bg-white p-5 shadow-[0_1px_3px_rgba(17,19,24,0.04)] sm:p-6">
              <div className="flex flex-col gap-3 border-b border-[#EEEDE8] pb-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-semibold text-[#111318]">
                    Ejemplo operativo del motor bancario
                  </p>
                  <p className="text-[11px] text-[#747A88]">
                    Simulación demostrativa · Tus datos reales solo se descifran al ingresar
                  </p>
                </div>

                <div
                  role="group"
                  aria-label="Cambiar escenario de ejemplo"
                  className="inline-flex rounded-lg border border-[#E4E3DD] bg-[#F6F6F3] p-1"
                >
                  <button
                    type="button"
                    onClick={() => setDemoPhase('pre-cierre')}
                    className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                      demoPhase === 'pre-cierre'
                        ? 'bg-white text-[#B45309] shadow-xs'
                        : 'text-[#525866] hover:text-[#111318]'
                    }`}
                  >
                    Día 05 · Pre-cierre
                  </button>
                  <button
                    type="button"
                    onClick={() => setDemoPhase('post-cierre')}
                    className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                      demoPhase === 'post-cierre'
                        ? 'bg-white text-[#1D4ED8] shadow-xs'
                        : 'text-[#525866] hover:text-[#111318]'
                    }`}
                  >
                    Día 12 · Ventana válida
                  </button>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="border-b border-[#EEEDE8] pb-3 sm:border-b-0 sm:border-r sm:pr-4 sm:pb-0">
                  <p className="text-[11px] text-[#747A88]">Cobro 1° Quincena</p>
                  <p className="mt-1 font-mono-tabular text-lg font-bold text-[#111318]">
                    $ 500.000,00
                  </p>
                  <p className="mt-1 text-[11px] text-[#525866]">
                    Tope cuentas:{' '}
                    <span className="font-mono-tabular font-semibold text-[#1D4ED8]">
                      $ 300.000
                    </span>
                  </p>
                </div>

                <div className="border-b border-[#EEEDE8] pb-3 sm:border-b-0 sm:border-r sm:pr-4 sm:pb-0">
                  <p className="flex items-center gap-1.5 text-[11px] font-medium text-[#1D4ED8]">
                    <Utensils className="h-3 w-3" aria-hidden="true" />
                    Comida Protegida Q1
                  </p>
                  <p className="mt-1 font-mono-tabular text-lg font-bold text-[#1D4ED8]">
                    $ 200.000,00
                  </p>
                  <p className="mt-1 text-[11px] text-[#525866]">
                    Reserva intocable del hogar
                  </p>
                </div>

                <div>
                  <p className="flex items-center gap-1.5 text-[11px] text-[#747A88]">
                    <CalendarClock className="h-3 w-3" aria-hidden="true" />
                    Tarjeta (Cierre día 10)
                  </p>
                  <p
                    className={`mt-1 text-sm font-bold ${
                      demoPhase === 'pre-cierre'
                        ? 'text-[#B45309]'
                        : 'text-[#1D4ED8]'
                    }`}
                  >
                    {demoPhase === 'pre-cierre'
                      ? 'Esperar cierre (10/12)'
                      : 'Habilitada · Del 11 al 21'}
                  </p>
                  <p className="mt-1 text-[11px] text-[#525866]">
                    {demoPhase === 'pre-cierre'
                      ? 'Evita pagar dos veces el mínimo'
                      : 'Computa como pago válido'}
                  </p>
                </div>
              </div>
            </div>

            {/* 3 Pilares editoriales */}
            <div className="grid grid-cols-1 gap-5 border-t border-[#E4E3DD] pt-6 sm:grid-cols-3">
              <div className="space-y-1.5">
                <span className="font-mono-tabular text-xs font-bold text-[#1D4ED8]">
                  01.
                </span>
                <h2 className="font-display text-sm font-bold text-[#111318]">
                  Calce quincenal exacto
                </h2>
                <p className="text-xs leading-relaxed text-[#525866]">
                  Prioriza vencimientos por urgencia sin superar lo que cobrás ni tocar la reserva de comida.
                </p>
              </div>
              <div className="space-y-1.5">
                <span className="font-mono-tabular text-xs font-bold text-[#4338CA]">
                  02.
                </span>
                <h2 className="font-display text-sm font-bold text-[#111318]">
                  Agenda y Google Calendar
                </h2>
                <p className="text-xs leading-relaxed text-[#525866]">
                  Visualizá vencimientos, aperturas post-cierre y viernes hábiles en un calendario profesional.
                </p>
              </div>
              <div className="space-y-1.5">
                <span className="font-mono-tabular text-xs font-bold text-[#111318]">
                  03.
                </span>
                <h2 className="font-display text-sm font-bold text-[#111318]">
                  Roles y Drive privado
                </h2>
                <p className="text-xs leading-relaxed text-[#525866]">
                  Administrador total y Colaboradora de solo lectura para subir comprobantes sin alterar montos.
                </p>
              </div>
            </div>
          </motion.section>

          {/* Portal de Autenticación (5 cols) */}
          <motion.section
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.06, ease: [0.22, 1, 0.36, 1] }}
            aria-labelledby="auth-portal-title"
            className="lg:col-span-5"
          >
            <div className="rounded-2xl border border-[#E4E3DD] bg-white p-7 shadow-[0_12px_36px_rgba(17,19,24,0.06)] sm:p-8">
              <div className="flex items-start gap-3.5">
                <div
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border ${
                    isRevoked || isUnverified
                      ? 'border-[#FECACA] bg-[#FEF2F2] text-[#DC2626]'
                      : isPending
                        ? 'border-[#FDE68A] bg-[#FFFBEB] text-[#D97706]'
                        : 'border-[#BFDBFE] bg-[#EFF6FF] text-[#1D4ED8]'
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
                    Portal Verificado
                  </p>
                  <h2
                    id="auth-portal-title"
                    className="mt-0.5 font-display text-xl font-bold tracking-tight text-[#111318]"
                  >
                    {isPending
                      ? 'Esperando aprobación'
                      : isRevoked
                        ? 'Acceso deshabilitado'
                        : isUnverified
                          ? 'Correo sin verificar'
                          : 'Ingresar al hogar'}
                  </h2>
                </div>
              </div>

              <div className="mt-5 space-y-4 text-sm leading-relaxed text-[#525866]">
                {resolution.status === 'UNAUTHENTICATED' && (
                  <>
                    <p className="text-xs leading-relaxed text-[#525866] sm:text-sm">
                      Solo las cuentas pre-autorizadas o aprobadas por el administrador del hogar pueden consultar saldos, calendario y comprobantes.
                    </p>

                    <div className="space-y-3 border-t border-b border-[#EEEDE8] py-4 text-xs">
                      <div className="flex items-start gap-2.5">
                        <ShieldCheck
                          className="mt-0.5 h-4 w-4 shrink-0 text-[#1D4ED8]"
                          aria-hidden="true"
                        />
                        <span>
                          <strong className="font-semibold text-[#111318]">
                            Reglas estrictas en Firestore:
                          </strong>{' '}
                          sin sesión autorizada, ningún dato financiero sale de la base.
                        </span>
                      </div>
                      <div className="flex items-start gap-2.5">
                        <FolderLock
                          className="mt-0.5 h-4 w-4 shrink-0 text-[#4338CA]"
                          aria-hidden="true"
                        />
                        <span>
                          <strong className="font-semibold text-[#111318]">
                            Permisos acotados de Google:
                          </strong>{' '}
                          <span className="font-mono-tabular text-[#111318]">
                            drive.file
                          </span>{' '}
                          solo accede a lo creado desde ArgenCaja y nunca ve tus archivos privados.
                        </span>
                      </div>
                      <div className="flex items-start gap-2.5">
                        <CheckCircle2
                          className="mt-0.5 h-4 w-4 shrink-0 text-[#525866]"
                          aria-hidden="true"
                        />
                        <span>
                          <strong className="font-semibold text-[#111318]">
                            Rol para tu hermana:
                          </strong>{' '}
                          consulta clara de fechas y carga de comprobantes sin editar lógica ni montos.
                        </span>
                      </div>
                    </div>
                  </>
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
                        : 'envió una solicitud de acceso al administrador del hogar.'}
                    </p>
                    <p className="rounded-xl border border-[#FDE68A] bg-[#FFFBEB] p-3.5 text-xs leading-relaxed text-[#92400E]">
                      {resolution.requestStatus === 'RECHAZADA'
                        ? 'Si corresponde autorizarte, pedile al administrador que te habilite desde Usuarios.'
                        : 'Por seguridad, los movimientos y tarjetas permanecen ocultos hasta que el administrador apruebe tu ingreso.'}
                    </p>
                  </div>
                )}

                {isRevoked && (
                  <p className="rounded-xl border border-[#FECACA] bg-[#FEF2F2] p-3.5 text-xs leading-relaxed text-[#B91C1C]">
                    El acceso para{' '}
                    <span className="font-mono-tabular font-semibold">
                      {resolution.email}
                    </span>{' '}
                    fue revocado por el administrador del hogar.
                  </p>
                )}

                {isUnverified && (
                  <p className="rounded-xl border border-[#FECACA] bg-[#FEF2F2] p-3.5 text-xs leading-relaxed text-[#B91C1C]">
                    Tu cuenta ({resolution.email}) no posee un correo electrónico verificado por Google.
                  </p>
                )}
              </div>

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
                    className="group flex w-full items-center justify-center gap-3 rounded-xl border border-[#D4D2CA] bg-white px-4 py-3 text-sm font-semibold text-[#111318] shadow-xs transition-all hover:bg-[#F6F6F3] active:scale-[0.99] disabled:opacity-60"
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
                      className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[#E4E3DD] bg-[#F6F6F3] px-4 py-2.5 text-xs font-medium text-[#111318] transition-colors hover:bg-[#EEEDE8]"
                    >
                      <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
                      Cerrar sesión y cambiar cuenta
                    </button>
                  </>
                )}
              </div>
            </div>
          </motion.section>
        </main>

        <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-[#E4E3DD] pt-5 text-[11px] text-[#747A88]">
          <span>ArgenCaja · Control financiero del hogar en pesos argentinos (ARS)</span>
          <span>Autenticación Firebase + Google Workspace OAuth acotado</span>
        </footer>
      </div>
    </div>
  );
};
