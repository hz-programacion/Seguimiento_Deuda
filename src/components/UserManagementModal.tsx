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
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-[#111318]/45 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="user-mgmt-title"
    >
      <div className="my-8 w-full max-w-2xl rounded-2xl border border-[#E4E3DD] bg-white p-6 shadow-[0_20px_50px_rgba(17,19,24,0.16)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2
              id="user-mgmt-title"
              className="flex items-center gap-2 font-display text-lg font-bold text-[#111318]"
            >
              <Users className="h-5 w-5 text-[#1D4ED8]" aria-hidden="true" />
              Usuarios, Aprobaciones y Permisos
            </h2>
            <p className="mt-0.5 text-xs text-[#525866]">
              Pre-autorizá el Gmail de tu hermana como Colaboradora (solo puede ver movimientos y subir resúmenes/comprobantes; nunca editar montos, fechas ni borrar).
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar gestión de usuarios"
            className="rounded-lg p-1.5 text-[#747A88] transition-colors hover:bg-[#F6F6F3] hover:text-[#111318]"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <section className="mt-5 rounded-xl border border-[#E4E3DD] bg-[#F6F6F3] p-4">
          <h3 className="flex items-center gap-2 text-sm font-bold text-[#111318]">
            <UserCheck className="h-4 w-4 text-[#D97706]" aria-hidden="true" />
            Solicitudes de Ingreso Pendientes ({pendingRequests.length})
          </h3>
          {pendingRequests.length === 0 ? (
            <p className="mt-2 text-xs text-[#747A88]">
              No hay solicitudes esperando aprobación en este momento.
            </p>
          ) : (
            <div className="mt-3 divide-y divide-[#E4E3DD]">
              {pendingRequests.map((req) => (
                <div
                  key={req.uid}
                  className="flex flex-col gap-2 py-2.5 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-[#111318]">
                      {req.displayName}
                    </p>
                    <p className="truncate font-mono-tabular text-[11px] text-[#525866]">
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
                      className="inline-flex items-center gap-1 rounded-lg border border-[#BFDBFE] bg-[#EFF6FF] px-2.5 py-1 text-xs font-semibold text-[#1D4ED8] transition-colors hover:bg-[#DBEAFE]"
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
                      className="inline-flex items-center gap-1 rounded-lg border border-[#FECACA] bg-[#FEF2F2] px-2.5 py-1 text-xs font-semibold text-[#B91C1C] transition-colors hover:bg-[#FEE2E2]"
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

        <section className="mt-4 rounded-xl border border-[#E4E3DD] bg-[#F6F6F3] p-4">
          <h3 className="flex items-center gap-2 text-sm font-bold text-[#111318]">
            <UserPlus className="h-4 w-4 text-[#4338CA]" aria-hidden="true" />
            Pre-autorizar cuenta Google por correo
          </h3>
          <form onSubmit={handleInviteSubmit} className="mt-3 space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label
                  htmlFor="invite-email"
                  className="block text-[11px] font-semibold text-[#525866]"
                >
                  Gmail del familiar
                </label>
                <input
                  id="invite-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="hermana@gmail.com"
                  className="mt-1 w-full rounded-lg border border-[#E4E3DD] bg-white px-3 py-1.5 text-xs text-[#111318]"
                  required
                />
              </div>
              <div>
                <label
                  htmlFor="invite-name"
                  className="block text-[11px] font-semibold text-[#525866]"
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
                  className="mt-1 w-full rounded-lg border border-[#E4E3DD] bg-white px-3 py-1.5 text-xs text-[#111318]"
                />
              </div>
              <div>
                <label
                  htmlFor="invite-role"
                  className="block text-[11px] font-semibold text-[#525866]"
                >
                  Permiso
                </label>
                <select
                  id="invite-role"
                  value={role}
                  onChange={(e) => setRole(e.target.value as HouseholdRole)}
                  className="mt-1 w-full rounded-lg border border-[#E4E3DD] bg-white px-3 py-1.5 text-xs text-[#111318]"
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
                className="rounded-xl bg-[#1D4ED8] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#1E40AF] disabled:opacity-60"
              >
                Habilitar Acceso
              </button>
            </div>
          </form>

          {activeInvites.length > 0 && (
            <div className="mt-4 border-t border-[#E4E3DD] pt-3">
              <p className="text-[11px] font-semibold text-[#525866]">
                Invitaciones pendientes de primer ingreso ({activeInvites.length})
              </p>
              <div className="mt-2 space-y-2">
                {activeInvites.map((inv) => (
                  <div
                    key={inv.id}
                    className="flex items-center justify-between gap-2 text-xs"
                  >
                    <span className="truncate font-mono-tabular text-[#111318]">
                      {inv.displayName} ({inv.emailLower}) ·{' '}
                      <span className="font-semibold text-[#4338CA]">
                        {inv.role === 'HERMANA_COMPROBANTES'
                          ? 'Colaboradora'
                          : 'Admin'}
                      </span>
                    </span>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => onRevokeInvite(inv)}
                      className="text-[11px] font-semibold text-[#DC2626] hover:text-[#B91C1C] shrink-0"
                    >
                      Anular
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        <section className="mt-4 rounded-xl border border-[#E4E3DD] bg-[#F6F6F3] p-4">
          <h3 className="flex items-center gap-2 text-sm font-bold text-[#111318]">
            <Shield className="h-4 w-4 text-[#1D4ED8]" aria-hidden="true" />
            Miembros del Hogar ({members.length})
          </h3>
          <div className="mt-3 divide-y divide-[#E4E3DD]">
            {members.map((m) => {
              const isSelf = m.uid === currentAdminUid;
              return (
                <div
                  key={m.uid}
                  className="flex flex-col gap-2 py-2.5 text-xs sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-[#111318]">
                      {m.displayName} {isSelf ? '(Vos)' : ''}
                    </p>
                    <p className="truncate font-mono-tabular text-[11px] text-[#525866]">
                      {m.emailLower} ·{' '}
                      <span
                        className={
                          m.role === 'ADMIN'
                            ? 'font-semibold text-[#1D4ED8]'
                            : 'font-semibold text-[#4338CA]'
                        }
                      >
                        {m.role === 'ADMIN'
                          ? 'Administrador Total'
                          : 'Colaboradora (Solo lectura y comprobantes)'}
                      </span>{' '}
                      ·{' '}
                      <span
                        className={
                          m.status === 'ACTIVO'
                            ? 'font-semibold text-[#1D4ED8]'
                            : 'font-semibold text-[#DC2626]'
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
                      className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-semibold shrink-0 transition-colors ${
                        m.status === 'ACTIVO'
                          ? 'border-[#FECACA] bg-[#FEF2F2] text-[#B91C1C] hover:bg-[#FEE2E2]'
                          : 'border-[#BFDBFE] bg-[#EFF6FF] text-[#1D4ED8] hover:bg-[#DBEAFE]'
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
          <p
            role="alert"
            className="mt-3 rounded-lg border border-[#FECACA] bg-[#FEF2F2] px-3 py-2 text-xs font-medium text-[#B91C1C]"
          >
            {errorMsg}
          </p>
        )}
        {statusMsg && (
          <p
            role="status"
            className="mt-3 rounded-lg border border-[#BFDBFE] bg-[#EFF6FF] px-3 py-2 text-xs font-medium text-[#1D4ED8]"
          >
            {statusMsg}
          </p>
        )}

        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-[#E4E3DD] bg-[#F6F6F3] px-4 py-2 text-xs font-semibold text-[#111318] transition-colors hover:bg-[#EEEDE8]"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
