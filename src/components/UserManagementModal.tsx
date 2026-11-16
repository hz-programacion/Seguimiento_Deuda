import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Shield,
  ShieldOff,
  UserCheck,
  UserPlus,
  Users,
  X,
  XCircle,
} from 'lucide-react';
import {
  AccessRequest,
  HouseholdInvite,
  HouseholdMember,
  HouseholdRole,
} from '../types/finance';

interface UserManagementModalProps {
  currentAdminUid: string;
  members: HouseholdMember[];
  invites: HouseholdInvite[];
  requests: AccessRequest[];
  onInvite: (params: {
    email: string;
    displayName: string;
    role: HouseholdRole;
  }) => Promise<void>;
  onApproveRequest: (req: AccessRequest, role: HouseholdRole) => Promise<void>;
  onRejectRequest: (req: AccessRequest) => Promise<void>;
  onToggleMemberStatus: (
    member: HouseholdMember,
    nextStatus: 'ACTIVO' | 'REVOCADO'
  ) => Promise<void>;
  onRevokeInvite: (invite: HouseholdInvite) => Promise<void>;
  onClose: () => void;
}

export const UserManagementModal: React.FC<UserManagementModalProps> = ({
  currentAdminUid,
  members,
  invites,
  requests,
  onInvite,
  onApproveRequest,
  onRejectRequest,
  onToggleMemberStatus,
  onRevokeInvite,
  onClose,
}) => {
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [role, setRole] = useState<HouseholdRole>('HERMANA_COMPROBANTES');
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [busy, onClose]);

  const pendingRequests = requests.filter((r) => r.status === 'PENDIENTE');
  const activeInvites = invites.filter((i) => i.status === 'PENDIENTE');

  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setErrorMsg('Ingresá un correo electrónico de Google válido.');
      return;
    }
    setBusy(true);
    setErrorMsg(null);
    setStatusMsg(null);
    try {
      await onInvite({
        email: cleanEmail,
        displayName: displayName.trim() || cleanEmail.split('@')[0],
        role,
      });
      setStatusMsg(
        `Invitación habilitada para ${cleanEmail} (${
          role === 'HERMANA_COMPROBANTES'
            ? 'Solo lectura y comprobantes'
            : 'Administrador'
        }).`
      );
      setEmail('');
      setDisplayName('');
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'No se pudo enviar la invitación.'
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="user-mgmt-title"
    >
      <div className="my-8 w-full max-w-2xl rounded-xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2
              id="user-mgmt-title"
              className="flex items-center gap-2 text-lg font-bold text-slate-100"
            >
              <Users className="h-5 w-5 text-emerald-400" aria-hidden="true" />
              Usuarios, Aprobaciones y Permisos
            </h2>
            <p className="mt-0.5 text-xs text-slate-400">
              Pre-autorizá el Gmail de tu hermana como Colaboradora (solo puede ver movimientos y subir resúmenes/comprobantes; nunca editar montos, fechas ni borrar).
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar gestión de usuarios"
            className="rounded-md p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-100"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {/* 1. Solicitudes pendientes */}
        <section className="mt-5 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-100">
            <UserCheck className="h-4 w-4 text-amber-400" aria-hidden="true" />
            Solicitudes de Ingreso Pendientes ({pendingRequests.length})
          </h3>
          {pendingRequests.length === 0 ? (
            <p className="mt-2 text-xs text-slate-500">
              No hay solicitudes esperando aprobación en este momento.
            </p>
          ) : (
            <div className="mt-3 divide-y divide-slate-800">
              {pendingRequests.map((req) => (
                <div
                  key={req.uid}
                  className="flex flex-col gap-2 py-2.5 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-slate-100">
                      {req.displayName}
                    </p>
                    <p className="truncate text-[11px] text-slate-400 font-mono-tabular">
                      {req.emailLower}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={async () => {
                        setBusy(true);
                        setErrorMsg(null);
                        try {
                          await onApproveRequest(req, 'HERMANA_COMPROBANTES');
                          setStatusMsg(
                            `${req.emailLower} aprobada como Colaboradora de Comprobantes.`
                          );
                        } catch (err) {
                          setErrorMsg(
                            err instanceof Error ? err.message : 'Error al aprobar.'
                          );
                        } finally {
                          setBusy(false);
                        }
                      }}
                      className="inline-flex items-center gap-1 rounded-md border border-emerald-500/40 bg-emerald-500/15 px-2.5 py-1 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/25"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                      Aprobar Colaboradora
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={async () => {
                        setBusy(true);
                        setErrorMsg(null);
                        try {
                          await onRejectRequest(req);
                          setStatusMsg(`Solicitud de ${req.emailLower} rechazada.`);
                        } catch (err) {
                          setErrorMsg(
                            err instanceof Error ? err.message : 'Error al rechazar.'
                          );
                        } finally {
                          setBusy(false);
                        }
                      }}
                      className="inline-flex items-center gap-1 rounded-md border border-rose-500/40 bg-rose-500/10 px-2.5 py-1 text-xs font-medium text-rose-300 hover:bg-rose-500/20"
                    >
                      <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
                      Rechazar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* 2. Pre-invitar por correo */}
        <section className="mt-4 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-100">
            <UserPlus className="h-4 w-4 text-cyan-400" aria-hidden="true" />
            Pre-autorizar cuenta Google por correo
          </h3>
          <form onSubmit={handleInviteSubmit} className="mt-3 space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label
                  htmlFor="invite-email"
                  className="block text-[11px] font-medium text-slate-300"
                >
                  Gmail del familiar
                </label>
                <input
                  id="invite-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="hermana@gmail.com"
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-100"
                  required
                />
              </div>
              <div>
                <label
                  htmlFor="invite-name"
                  className="block text-[11px] font-medium text-slate-300"
                >
                  Nombre (ej: Hermana)
                </label>
                <input
                  id="invite-name"
                  type="text"
                  maxLength={80}
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Hermana"
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-100"
                />
              </div>
              <div>
                <label
                  htmlFor="invite-role"
                  className="block text-[11px] font-medium text-slate-300"
                >
                  Permiso
                </label>
                <select
                  id="invite-role"
                  value={role}
                  onChange={(e) => setRole(e.target.value as HouseholdRole)}
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-100"
                >
                  <option value="HERMANA_COMPROBANTES">
                    Colaboradora (Ver y subir comprobantes)
                  </option>
                  <option value="ADMIN">Administrador Total</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={busy}
                className="rounded-lg bg-emerald-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-60"
              >
                Habilitar Acceso
              </button>
            </div>
          </form>

          {activeInvites.length > 0 && (
            <div className="mt-4 border-t border-slate-800 pt-3">
              <p className="text-[11px] font-semibold text-slate-400">
                Invitaciones pendientes de primer ingreso ({activeInvites.length})
              </p>
              <div className="mt-2 space-y-2">
                {activeInvites.map((inv) => (
                  <div
                    key={inv.id}
                    className="flex items-center justify-between gap-2 text-xs"
                  >
                    <span className="truncate text-slate-300 font-mono-tabular">
                      {inv.displayName} ({inv.emailLower}) ·{' '}
                      <span className="text-cyan-400">
                        {inv.role === 'HERMANA_COMPROBANTES'
                          ? 'Colaboradora'
                          : 'Admin'}
                      </span>
                    </span>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => onRevokeInvite(inv)}
                      className="text-rose-400 hover:text-rose-300 text-[11px] font-medium shrink-0"
                    >
                      Anular
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* 3. Miembros actuales */}
        <section className="mt-4 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-100">
            <Shield className="h-4 w-4 text-emerald-400" aria-hidden="true" />
            Miembros del Hogar ({members.length})
          </h3>
          <div className="mt-3 divide-y divide-slate-800">
            {members.map((m) => {
              const isSelf = m.uid === currentAdminUid;
              return (
                <div
                  key={m.uid}
                  className="flex flex-col gap-2 py-2.5 sm:flex-row sm:items-center sm:justify-between text-xs"
                >
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-slate-100">
                      {m.displayName} {isSelf ? '(Vos)' : ''}
                    </p>
                    <p className="truncate text-[11px] text-slate-400 font-mono-tabular">
                      {m.emailLower} ·{' '}
                      <span
                        className={
                          m.role === 'ADMIN' ? 'text-emerald-400' : 'text-cyan-400'
                        }
                      >
                        {m.role === 'ADMIN'
                          ? 'Administrador Total'
                          : 'Colaboradora (Solo lectura y comprobantes)'}
                      </span>{' '}
                      ·{' '}
                      <span
                        className={
                          m.status === 'ACTIVO' ? 'text-emerald-400' : 'text-rose-400'
                        }
                      >
                        {m.status}
                      </span>
                    </p>
                  </div>

                  {!isSelf && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={async () => {
                        setBusy(true);
                        try {
                          await onToggleMemberStatus(
                            m,
                            m.status === 'ACTIVO' ? 'REVOCADO' : 'ACTIVO'
                          );
                        } finally {
                          setBusy(false);
                        }
                      }}
                      className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-medium shrink-0 ${
                        m.status === 'ACTIVO'
                          ? 'border-rose-500/40 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20'
                          : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20'
                      }`}
                    >
                      <ShieldOff className="h-3.5 w-3.5" aria-hidden="true" />
                      {m.status === 'ACTIVO' ? 'Revocar acceso' : 'Reactivar'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {errorMsg && (
          <p role="alert" className="mt-3 text-xs font-medium text-rose-400">
            {errorMsg}
          </p>
        )}
        {statusMsg && (
          <p role="status" className="mt-3 text-xs font-medium text-emerald-400">
            {statusMsg}
          </p>
        )}

        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-medium text-slate-200 hover:bg-slate-700"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
