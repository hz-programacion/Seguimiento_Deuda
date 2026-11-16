import React from 'react';
import {
  Clock,
  Lock,
  LogOut,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
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
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 px-4 py-12 text-slate-100">
      <div className="w-full max-w-md rounded-2xl border border-slate-800/90 bg-slate-900/90 p-7 shadow-2xl">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
            {isRevoked || isUnverified ? (
              <ShieldAlert className="h-5 w-5" aria-hidden="true" />
            ) : isPending ? (
              <Clock className="h-5 w-5 text-amber-400" aria-hidden="true" />
            ) : (
              <Lock className="h-5 w-5" aria-hidden="true" />
            )}
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
              ArgenCaja · Tesorería Privada
            </p>
            <h1 className="text-xl font-bold tracking-tight text-slate-100">
              {isPending
                ? 'Esperando aprobación'
                : isRevoked
                  ? 'Acceso revocado'
                  : isUnverified
                    ? 'Correo sin verificar'
                    : 'Acceso protegido del hogar'}
            </h1>
          </div>
        </div>

        <div className="mt-5 space-y-3 text-sm text-slate-300 leading-relaxed">
          {resolution.status === 'UNAUTHENTICATED' && (
            <>
              <p>
                Los movimientos bancarios, vencimientos y resúmenes de este hogar están protegidos por autenticación verificada y control de roles.
              </p>
              <div className="space-y-2 rounded-xl border border-slate-800 bg-slate-950/70 p-4 text-xs text-slate-300">
                <div className="flex items-start gap-2.5">
                  <ShieldCheck
                    className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400"
                    aria-hidden="true"
                  />
                  <span>
                    <strong className="text-slate-100">Control anti-intrusos:</strong>{' '}
                    solo acceden cuentas aprobadas por el administrador del hogar.
                  </span>
                </div>
                <div className="flex items-start gap-2.5">
                  <ShieldCheck
                    className="mt-0.5 h-4 w-4 shrink-0 text-cyan-400"
                    aria-hidden="true"
                  />
                  <span>
                    <strong className="text-slate-100">Rol Colaboradora:</strong>{' '}
                    permite ver vencimientos y subir comprobantes sin modificar montos, fechas ni reglas.
                  </span>
                </div>
              </div>
            </>
          )}

          {isPending && (
            <div className="space-y-3">
              <p>
                Tu cuenta{' '}
                <span className="font-mono-tabular font-semibold text-slate-100">
                  {resolution.email}
                </span>{' '}
                {resolution.requestStatus === 'RECHAZADA'
                  ? 'no fue autorizada por el administrador.'
                  : 'envió una solicitud de acceso al administrador del hogar.'}
              </p>
              <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
                {resolution.requestStatus === 'RECHAZADA'
                  ? 'Si se trata de un error, pedile al administrador que te pre-invite desde Usuarios y Permisos.'
                  : 'Por seguridad, los saldos y cuentas permanecen ocultos hasta que el administrador apruebe tu ingreso.'}
              </p>
            </div>
          )}

          {isRevoked && (
            <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-200">
              El acceso para <span className="font-semibold">{resolution.email}</span> fue deshabilitado por el administrador del hogar.
            </p>
          )}

          {isUnverified && (
            <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-200">
              Tu cuenta ({resolution.email}) no posee un correo electrónico verificado por el proveedor de identidad.
            </p>
          )}
        </div>

        {errorMessage && (
          <p
            role="alert"
            className="mt-4 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs font-medium text-rose-300"
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
              className="flex w-full items-center justify-center gap-2.5 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 shadow-sm transition-colors hover:bg-slate-100 disabled:opacity-60"
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
              {loading ? 'Verificando cuenta...' : 'Ingresar con Google'}
            </button>
          ) : (
            <>
              {isPending && (
                <button
                  type="button"
                  disabled={loading}
                  onClick={onRetryCheck}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-60"
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
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-medium text-slate-200 hover:bg-slate-700"
              >
                <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
                Cerrar sesión y cambiar cuenta
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
