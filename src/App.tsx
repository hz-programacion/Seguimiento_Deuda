import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion, MotionConfig } from 'motion/react';
import {
  AccessRequest,
  AppTab,
  ComprobanteAdjunto,
  HouseholdDoc,
  HouseholdInvite,
  HouseholdMember,
  HouseholdRole,
  ItemFinanciero,
  PeriodoID,
  VentanaQuincena,
} from './types/finance';
import { runCashFlowMatcher } from './utils/cashFlowMatcher';
import {
  buildDateString,
  deriveVentanaFromDia,
  formatPeriodoLabel,
  getNextPeriodoId,
} from './utils/dateUtils';
import { closeAndCloneMonth, projectMultipleMonths } from './utils/monthTransition';
import {
  createSeedDecember2026,
  SEED_PERIODO_INICIAL,
  SEED_SAC_ITEM_DIC_2026,
} from './utils/seedData';
import {
  loadActivePeriod,
  loadLocalItems,
  loadMinFoodReserveARS,
  saveActivePeriod,
  saveLocalItems,
  saveMinFoodReserveARS,
} from './services/storageService';
import {
  AccessResolution,
  approveAccessRequest,
  deleteHouseholdItem,
  inviteMemberByEmail,
  pushHouseholdItems,
  rejectAccessRequest,
  resolveHouseholdAccess,
  revokeInvite,
  revokeOrRestoreMember,
  signInHouseholdGoogle,
  signOutHousehold,
  subscribeAdminDirectory,
  subscribeHouseholdAuth,
  subscribeHouseholdDoc,
  subscribeHouseholdItems,
  testFirestoreConnection,
  updateCollaboratorAttachments,
  updateHouseholdMinFoodReserve,
  upsertHouseholdItem,
} from './services/householdAuthService';
import {
  deleteDriveFile,
  initDriveAuth,
  signInGoogleDrive,
  signOutGoogleDrive,
  uploadReceiptToDrive,
} from './services/driveService';
import { AuthGateScreen } from './components/AuthGateScreen';
import { HeaderNav } from './components/HeaderNav';
import { WorkspaceToolbar } from './components/WorkspaceToolbar';
import { DashboardBento } from './components/DashboardBento';
import { CalendarPlannerView } from './components/CalendarPlannerView';
import { PaymentChecklist } from './components/PaymentChecklist';
import { QuincenalMatcherView } from './components/QuincenalMatcherView';
import { ExtinctionTimelineView } from './components/ExtinctionTimelineView';
import { MarkPaidModal } from './components/MarkPaidModal';
import { ItemEditorModal } from './components/ItemEditorModal';
import { FirebaseConfigModal } from './components/FirebaseConfigModal';
import { ReceiptsModal } from './components/ReceiptsModal';
import { UserManagementModal } from './components/UserManagementModal';
import { ConfirmDialog } from './components/ConfirmDialog';
import { OfflineIndicator } from './components/OfflineIndicator';

type PendingConfirmAction =
  | { type: 'reset' }
  | { type: 'delete-item'; item: ItemFinanciero }
  | null;

function getDefaultReferenceDate(periodo: PeriodoID): string {
  const todayISO = new Date().toISOString().slice(0, 10);
  return todayISO.startsWith(periodo) ? todayISO : `${periodo}-01`;
}

export default function App() {
  // Estado de Autenticación y Autorización RBAC
  const [authChecking, setAuthChecking] = useState(true);
  const [accessResolution, setAccessResolution] =
    useState<AccessResolution | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [householdDoc, setHouseholdDoc] = useState<HouseholdDoc | null>(null);
  const [cloudStatus, setCloudStatus] = useState<
    'local' | 'connected' | 'syncing'
  >('local');

  // Directorio de usuarios (solo Admin)
  const [members, setMembers] = useState<HouseholdMember[]>([]);
  const [invites, setInvites] = useState<HouseholdInvite[]>([]);
  const [accessRequests, setAccessRequests] = useState<AccessRequest[]>([]);
  const [isUserMgmtOpen, setIsUserMgmtOpen] = useState(false);

  // Estado financiero del hogar (solo montado tras AUTHORIZED)
  const [items, setItems] = useState<ItemFinanciero[]>(() => loadLocalItems());
  const [activePeriodo, setActivePeriodo] = useState<PeriodoID>(() =>
    loadActivePeriod()
  );
  const [referenceDateISO, setReferenceDateISO] = useState<string>(() =>
    getDefaultReferenceDate(loadActivePeriod())
  );
  const [minFoodReserveARS, setMinFoodReserveARS] = useState<number>(() =>
    loadMinFoodReserveARS()
  );
  const [activeTab, setActiveTab] = useState<AppTab>('tablero');

  // Modales y notificaciones
  const [payingItem, setPayingItem] = useState<ItemFinanciero | null>(null);
  const [editingItem, setEditingItem] = useState<ItemFinanciero | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [receiptsItemId, setReceiptsItemId] = useState<string | null>(null);
  const [isFirebaseModalOpen, setIsFirebaseModalOpen] = useState(false);
  const [confirmAction, setConfirmAction] =
    useState<PendingConfirmAction>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Estado Google Workspace (Drive + Calendar, OAuth en memoria)
  const [driveUserEmail, setDriveUserEmail] = useState<string | null>(null);
  const [hasDriveToken, setHasDriveToken] = useState(false);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    window.setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 4500);
  }, []);

  // Test inicial de conexión a Firestore
  useEffect(() => {
    void testFirestoreConnection();
  }, []);

  // Persistencia local de respaldo (solo cuando está autorizado)
  useEffect(() => {
    if (accessResolution?.status === 'AUTHORIZED') {
      saveLocalItems(items);
    }
  }, [accessResolution?.status, items]);

  useEffect(() => {
    saveActivePeriod(activePeriodo);
  }, [activePeriodo]);

  useEffect(() => {
    saveMinFoodReserveARS(minFoodReserveARS);
  }, [minFoodReserveARS]);

  // Suscripción a sesión de Google Workspace (Drive + Calendar)
  useEffect(() => {
    return initDriveAuth(
      (user, hasToken) => {
        setDriveUserEmail(user.email ?? user.displayName ?? null);
        setHasDriveToken(hasToken);
      },
      () => {
        setDriveUserEmail(null);
        setHasDriveToken(false);
      }
    );
  }, []);

  // Suscripción a Firebase Auth + resolución estricta de membresía
  useEffect(() => {
    let cancelled = false;
    const unsubAuth = subscribeHouseholdAuth(async (user) => {
      if (cancelled) return;
      setAuthError(null);
      if (!user) {
        setAccessResolution({ status: 'UNAUTHENTICATED' });
        setHouseholdDoc(null);
        setMembers([]);
        setInvites([]);
        setAccessRequests([]);
        setCloudStatus('local');
        setAuthChecking(false);
        return;
      }

      setAuthChecking(true);
      setCloudStatus('syncing');
      try {
        const res = await resolveHouseholdAccess(
          user,
          loadLocalItems(),
          loadMinFoodReserveARS()
        );
        if (cancelled) return;
        setAccessResolution(res);
        if (res.status === 'AUTHORIZED') {
          setHouseholdDoc(res.household);
          setMinFoodReserveARS(res.household.minFoodReserveARS);
          setCloudStatus('connected');
        } else {
          setHouseholdDoc(null);
          setCloudStatus('local');
        }
      } catch (err) {
        if (cancelled) return;
        console.error('Error resolviendo acceso del hogar:', err);
        setAuthError(
          'No se pudo validar tu permiso de ingreso con Firestore. Verificá tu conexión e intentá nuevamente.'
        );
        setAccessResolution({ status: 'UNAUTHENTICATED' });
        setCloudStatus('local');
      } finally {
        if (!cancelled) {
          setAuthChecking(false);
        }
      }
    });

    return () => {
      cancelled = true;
      unsubAuth();
    };
  }, []);

  // Listeners en tiempo real cuando el usuario está AUTHORIZED
  useEffect(() => {
    if (!accessResolution || accessResolution.status !== 'AUTHORIZED') {
      return;
    }

    const { user, role } = accessResolution;
    setCloudStatus('syncing');

    const unsubHH = subscribeHouseholdDoc(
      (hh) => {
        setHouseholdDoc(hh);
        setMinFoodReserveARS(hh.minFoodReserveARS);
      },
      (err) => {
        console.warn('Listener household doc:', err.message);
      }
    );

    const unsubItems = subscribeHouseholdItems(
      user,
      role,
      (cloudItems) => {
        setItems(cloudItems);
        setCloudStatus('connected');
      },
      (err) => {
        console.warn('Listener items:', err.message);
        setCloudStatus('local');
      }
    );

    let unsubDirectory = () => {};
    if (role === 'ADMIN') {
      unsubDirectory = subscribeAdminDirectory(
        ({ members: mList, invites: iList, requests: rList }) => {
          setMembers(mList);
          setInvites(iList);
          setAccessRequests(rList);
        },
        (err) => {
          console.warn('Listener directorio admin:', err.message);
        }
      );
    }

    return () => {
      unsubHH();
      unsubItems();
      unsubDirectory();
    };
  }, [accessResolution]);

  const authorizedContext =
    accessResolution?.status === 'AUTHORIZED' ? accessResolution : null;
  const activeHousehold = householdDoc ?? authorizedContext?.household ?? null;
  const currentUser = authorizedContext?.user ?? null;
  const userRole: HouseholdRole = authorizedContext?.role ?? 'HERMANA_COMPROBANTES';
  const canEditFinances = authorizedContext?.role === 'ADMIN';

  const pendingRequestsCount = useMemo(
    () => accessRequests.filter((r) => r.status === 'PENDIENTE').length,
    [accessRequests]
  );

  const availablePeriodos = useMemo(() => {
    const set = new Set<PeriodoID>(items.map((i) => i.periodo));
    set.add(activePeriodo);
    return Array.from(set).sort();
  }, [items, activePeriodo]);

  const periodItems = useMemo(
    () => items.filter((i) => i.periodo === activePeriodo),
    [items, activePeriodo]
  );

  const canToggleSac =
    activePeriodo.endsWith('-12') || activePeriodo.endsWith('-06');

  const includeSacActive = useMemo(
    () => periodItems.some((i) => i.categoria === 'INGRESO_EXTRA_SAC'),
    [periodItems]
  );

  const matchResult = useMemo(() => {
    return runCashFlowMatcher(
      activePeriodo,
      items,
      referenceDateISO,
      Math.round(minFoodReserveARS * 100)
    );
  }, [activePeriodo, items, referenceDateISO, minFoodReserveARS]);

  const receiptsItem = useMemo(
    () =>
      receiptsItemId
        ? items.find((i) => i.id === receiptsItemId) ?? null
        : null,
    [items, receiptsItemId]
  );

  const handleSelectPeriodo = useCallback((p: PeriodoID) => {
    setActivePeriodo(p);
    setReferenceDateISO(getDefaultReferenceDate(p));
  }, []);

  const syncItemCloud = useCallback(
    async (item: ItemFinanciero) => {
      if (!activeHousehold || !currentUser || !canEditFinances) return;
      try {
        await upsertHouseholdItem(activeHousehold, currentUser.uid, item);
      } catch (err) {
        console.warn('No se pudo sincronizar ítem a Firestore:', err);
      }
    },
    [activeHousehold, currentUser, canEditFinances]
  );

  const handleAuthSignIn = useCallback(async () => {
    setAuthError(null);
    setAuthChecking(true);
    try {
      await signInHouseholdGoogle();
    } catch (err) {
      setAuthChecking(false);
      setAuthError(
        err instanceof Error
          ? err.message
          : 'No se pudo completar el inicio de sesión con Google.'
      );
    }
  }, []);

  const handleRetryApprovalCheck = useCallback(async () => {
    if (!accessResolution || accessResolution.status === 'UNAUTHENTICATED') {
      return;
    }
    if (!('user' in accessResolution)) return;
    setAuthError(null);
    setAuthChecking(true);
    try {
      const res = await resolveHouseholdAccess(
        accessResolution.user,
        loadLocalItems(),
        loadMinFoodReserveARS()
      );
      setAccessResolution(res);
      if (res.status === 'AUTHORIZED') {
        setHouseholdDoc(res.household);
        setMinFoodReserveARS(res.household.minFoodReserveARS);
        setCloudStatus('connected');
      }
    } catch (err) {
      setAuthError(
        err instanceof Error ? err.message : 'Error consultando aprobación.'
      );
    } finally {
      setAuthChecking(false);
    }
  }, [accessResolution]);

  const handleAuthSignOut = useCallback(async () => {
    await signOutHousehold();
    setAccessResolution({ status: 'UNAUTHENTICATED' });
    setHouseholdDoc(null);
    setIsUserMgmtOpen(false);
  }, []);

  const handleSignInDrive = useCallback(async () => {
    const { user } = await signInGoogleDrive();
    setDriveUserEmail(user.email ?? user.displayName ?? null);
    setHasDriveToken(true);
    showToast(
      `Google Workspace (Drive y Calendario) conectado (${user.email ?? 'cuenta activa'}).`
    );
  }, [showToast]);

  const handleSignOutDrive = useCallback(async () => {
    await signOutGoogleDrive();
    setDriveUserEmail(null);
    setHasDriveToken(false);
    showToast('Sesión de Google Workspace desconectada.');
  }, [showToast]);

  const handleUploadReceipt = useCallback(
    async (
      item: ItemFinanciero,
      file: File,
      tipo: 'RESUMEN' | 'COMPROBANTE'
    ) => {
      if (!currentUser) return;
      const adjunto = await uploadReceiptToDrive({
        file,
        periodo: item.periodo,
        itemTitle: item.titulo,
        tipo,
      });
      const updated: ItemFinanciero = {
        ...item,
        adjuntos: [...(item.adjuntos ?? []), adjunto],
      };
      setItems((prev) => prev.map((it) => (it.id === item.id ? updated : it)));

      if (canEditFinances && activeHousehold) {
        await upsertHouseholdItem(activeHousehold, currentUser.uid, updated);
      } else {
        await updateCollaboratorAttachments(currentUser.uid, updated);
      }

      showToast(
        `${tipo === 'RESUMEN' ? 'Resumen' : 'Comprobante'} guardado en Drive: ${adjunto.nombre}`
      );
    },
    [currentUser, canEditFinances, activeHousehold, showToast]
  );

  const handleAddManualLink = useCallback(
    async (
      item: ItemFinanciero,
      params: {
        nombre: string;
        webViewLink: string;
        tipo: 'RESUMEN' | 'COMPROBANTE';
      }
    ) => {
      if (!currentUser) return;
      const adjunto: ComprobanteAdjunto = {
        id: `adj-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
        tipo: params.tipo,
        nombre: params.nombre,
        mimeType: 'text/uri-list',
        driveFileId: `manual-${Date.now().toString(36)}`,
        webViewLink: params.webViewLink,
        subidoEn: new Date().toISOString(),
      };
      const updated: ItemFinanciero = {
        ...item,
        adjuntos: [...(item.adjuntos ?? []), adjunto],
      };
      setItems((prev) => prev.map((it) => (it.id === item.id ? updated : it)));

      if (canEditFinances && activeHousehold) {
        await upsertHouseholdItem(activeHousehold, currentUser.uid, updated);
      } else {
        await updateCollaboratorAttachments(currentUser.uid, updated);
      }

      showToast(`Enlace guardado en ${item.titulo}.`);
    },
    [currentUser, canEditFinances, activeHousehold, showToast]
  );

  const handleDeleteAttachment = useCallback(
    async (item: ItemFinanciero, adjunto: ComprobanteAdjunto) => {
      if (!currentUser) return;
      if (!adjunto.driveFileId.startsWith('manual-')) {
        await deleteDriveFile(adjunto.driveFileId);
      }
      const nextAdjuntos = (item.adjuntos ?? []).filter(
        (a) => a.id !== adjunto.id
      );
      const updated: ItemFinanciero = {
        ...item,
        adjuntos: nextAdjuntos,
      };
      setItems((prev) => prev.map((it) => (it.id === item.id ? updated : it)));

      if (canEditFinances && activeHousehold) {
        await upsertHouseholdItem(activeHousehold, currentUser.uid, updated);
      } else {
        await updateCollaboratorAttachments(currentUser.uid, updated);
      }

      showToast(`Archivo quitado: ${adjunto.nombre}`);
    },
    [currentUser, canEditFinances, activeHousehold, showToast]
  );

  const handleChangeMinFoodReserveARS = useCallback(
    (nextAmount: number) => {
      if (!canEditFinances) return;
      const clamped = Math.max(0, Math.min(100000000, nextAmount));
      setMinFoodReserveARS(clamped);
      updateHouseholdMinFoodReserve(clamped).catch((err) => {
        console.warn('No se pudo actualizar mínimo de comida:', err);
      });
    },
    [canEditFinances]
  );

  const handleToggleSac = useCallback(async () => {
    if (!canEditFinances || !canToggleSac) return;
    if (includeSacActive) {
      const removed = items.filter(
        (i) =>
          i.periodo === activePeriodo && i.categoria === 'INGRESO_EXTRA_SAC'
      );
      setItems((prev) =>
        prev.filter(
          (i) =>
            !(
              i.periodo === activePeriodo &&
              i.categoria === 'INGRESO_EXTRA_SAC'
            )
        )
      );
      for (const r of removed) {
        deleteHouseholdItem(r.id).catch(() => {});
      }
      showToast(
        `Aguinaldo (SAC) desactivado en ${formatPeriodoLabel(activePeriodo)}.`
      );
    } else {
      const sacItem: ItemFinanciero =
        activePeriodo === '2026-12'
          ? SEED_SAC_ITEM_DIC_2026
          : {
              id: `${activePeriodo}-ingreso-sac`,
              periodo: activePeriodo,
              titulo: activePeriodo.endsWith('-06')
                ? 'Aguinaldo (SAC) Junio'
                : 'Aguinaldo (SAC) Diciembre',
              categoria: 'INGRESO_EXTRA_SAC',
              subgrupo: 'Ingresos',
              montoPactado: 500000,
              estado: 'PENDIENTE',
              diaVencimientoOCobro: 18,
              fechaExactaVencimiento: buildDateString(activePeriodo, 18),
              ventanaAsignada: 'Q2_DIAS_15_AL_31',
              bolsilloResponsable: 'Aguinaldo',
              esCuotaFija: false,
            };
      setItems((prev) => [...prev, sacItem]);
      await syncItemCloud(sacItem);
      showToast(
        `Aguinaldo (SAC) sumado a ${formatPeriodoLabel(activePeriodo)}.`
      );
    }
  }, [
    canEditFinances,
    canToggleSac,
    includeSacActive,
    items,
    activePeriodo,
    syncItemCloud,
    showToast,
  ]);

  const handleAdvanceNextMonth = useCallback(async () => {
    if (!canEditFinances) return;
    const nextPeriodo = getNextPeriodoId(activePeriodo);
    const alreadyExists = items.some((i) => i.periodo === nextPeriodo);

    if (alreadyExists) {
      handleSelectPeriodo(nextPeriodo);
      showToast(`Cambiado a ${formatPeriodoLabel(nextPeriodo)}.`);
      return;
    }

    const result = closeAndCloneMonth(activePeriodo, items);
    setItems((prev) => [...prev, ...result.newItems]);
    handleSelectPeriodo(result.nextPeriodo);

    if (activeHousehold && currentUser) {
      pushHouseholdItems(activeHousehold, currentUser.uid, result.newItems).catch(
        () => {}
      );
    }

    const extinguishedCount = result.extinguishedItems.length;
    if (extinguishedCount > 0) {
      showToast(
        `${formatPeriodoLabel(result.nextPeriodo)} generado: ${extinguishedCount} cuota(s) extinguida(s) pasaron a Alivio Ganado.`
      );
    } else {
      showToast(`${formatPeriodoLabel(result.nextPeriodo)} generado con éxito.`);
    }
  }, [
    canEditFinances,
    activePeriodo,
    items,
    handleSelectPeriodo,
    activeHousehold,
    currentUser,
    showToast,
  ]);

  const handleProjectSixMonths = useCallback(() => {
    if (!canEditFinances) return;
    const projected = projectMultipleMonths(activePeriodo, 6, items);
    setItems(projected);
    if (activeHousehold && currentUser) {
      pushHouseholdItems(activeHousehold, currentUser.uid, projected).catch(
        () => {}
      );
    }
    showToast(
      'Meses futuros generados. Elegí cualquier mes en la barra superior para cambiar cierres, vencimientos o montos.'
    );
  }, [canEditFinances, activePeriodo, items, activeHousehold, currentUser, showToast]);

  const handleConfirmMarkPaid = useCallback(
    async ({
      item,
      montoPagado,
      fechaPagoReal,
      bolsilloResponsable,
      proximoVencimiento,
      receiptFile,
    }: {
      item: ItemFinanciero;
      montoPagado: number;
      fechaPagoReal: string;
      bolsilloResponsable: string;
      proximoVencimiento: string;
      receiptFile?: File;
    }) => {
      if (!canEditFinances) return;
      let nextAdjuntos = item.adjuntos;
      if (receiptFile && hasDriveToken) {
        const uploaded = await uploadReceiptToDrive({
          file: receiptFile,
          periodo: item.periodo,
          itemTitle: item.titulo,
          tipo: 'COMPROBANTE',
        });
        nextAdjuntos = [...(item.adjuntos ?? []), uploaded];
      }

      const updated: ItemFinanciero = {
        ...item,
        estado: 'PAGADO',
        montoPagado,
        fechaPagoReal,
        bolsilloResponsable,
        adjuntos: nextAdjuntos,
        notas: item.notas
          ? `${item.notas} · Próximo venc. ref: ${proximoVencimiento}`
          : `Próximo venc. sugerido: ${proximoVencimiento}`,
      };
      setItems((prev) => prev.map((it) => (it.id === item.id ? updated : it)));
      await syncItemCloud(updated);
      setPayingItem(null);
      showToast(
        receiptFile && hasDriveToken
          ? `Pago registrado y comprobante subido a Drive: ${item.titulo}`
          : `Pago registrado: ${item.titulo}`
      );
    },
    [canEditFinances, hasDriveToken, syncItemCloud, showToast]
  );

  const handleUndoPaid = useCallback(
    (item: ItemFinanciero) => {
      if (!canEditFinances) return;
      const reverted: ItemFinanciero = {
        ...item,
        estado: 'PENDIENTE',
        montoPagado: undefined,
        fechaPagoReal: undefined,
      };
      setItems((prev) => prev.map((it) => (it.id === item.id ? reverted : it)));
      void syncItemCloud(reverted);
    },
    [canEditFinances, syncItemCloud]
  );

  const handleSaveItem = useCallback(
    (savedItem: ItemFinanciero, applyToFutureMonths = false) => {
      if (!canEditFinances) return;
      const normalizedItemKey = savedItem.id
        .replace(/^[0-9]{4}-[0-9]{2}-/, '')
        .replace(/^dic26-/, '');

      const exists = items.some((it) => it.id === savedItem.id);
      const stampedItem: ItemFinanciero = exists
        ? { ...savedItem, editadoManualmente: true }
        : savedItem;
      let nextList = exists
        ? items.map((it) => (it.id === savedItem.id ? stampedItem : it))
        : [...items, stampedItem];
      const changedCloudItems: ItemFinanciero[] = [stampedItem];

      if (applyToFutureMonths) {
        const closingDay = savedItem.fechaCierre
          ? Number(savedItem.fechaCierre.split('-')[2])
          : undefined;
        const closingInPrevMonth =
          savedItem.fechaCierre &&
          savedItem.fechaCierre.slice(0, 7) < savedItem.periodo;

        nextList = nextList.map((it) => {
          if (it.periodo <= savedItem.periodo || it.estado === 'EXTINGUIDO') {
            return it;
          }
          const itKey = it.id
            .replace(/^[0-9]{4}-[0-9]{2}-/, '')
            .replace(/^dic26-/, '');
          const matches =
            itKey === normalizedItemKey ||
            it.titulo.toLowerCase() === savedItem.titulo.toLowerCase();
          if (!matches) return it;

          const updatedDueDate = buildDateString(
            it.periodo,
            savedItem.diaVencimientoOCobro
          );
          let updatedCloseDate = it.fechaCierre;
          if (closingDay && Number.isFinite(closingDay)) {
            let targetClosePeriodo = it.periodo;
            if (closingInPrevMonth) {
              const [yStr, mStr] = it.periodo.split('-');
              const y = Number(yStr);
              const m = Number(mStr);
              targetClosePeriodo =
                m === 1
                  ? `${y - 1}-12`
                  : `${y}-${String(m - 1).padStart(2, '0')}`;
            }
            updatedCloseDate = buildDateString(targetClosePeriodo, closingDay);
          } else if (savedItem.fechaCierre === undefined) {
            updatedCloseDate = undefined;
          }

          const updatedFuture: ItemFinanciero = {
            ...it,
            montoPactado: savedItem.montoPactado,
            pagoMinimoExigido:
              it.categoria === 'TARJETA_ROTATIVA'
                ? savedItem.montoPactado
                : it.pagoMinimoExigido,
            diaVencimientoOCobro: savedItem.diaVencimientoOCobro,
            fechaExactaVencimiento: updatedDueDate,
            fechaCierre: updatedCloseDate,
            ventanaAsignada: savedItem.ventanaAsignada,
            bolsilloResponsable: savedItem.bolsilloResponsable,
            editadoManualmente: true,
          };
          changedCloudItems.push(updatedFuture);
          return updatedFuture;
        });
      }

      setItems(nextList);
      if (activeHousehold && currentUser) {
        if (changedCloudItems.length > 1) {
          pushHouseholdItems(
            activeHousehold,
            currentUser.uid,
            changedCloudItems
          ).catch(() => {});
        } else {
          void syncItemCloud(stampedItem);
        }
      }

      setIsEditorOpen(false);
      setEditingItem(null);
      showToast(
        applyToFutureMonths
          ? `Guardado en ${formatPeriodoLabel(savedItem.periodo)} y aplicado a meses siguientes: ${savedItem.titulo}`
          : `Registro guardado: ${savedItem.titulo}`
      );
    },
    [canEditFinances, items, activeHousehold, currentUser, syncItemCloud, showToast]
  );

  const handleQuickUpdateAmount = useCallback(
    (item: ItemFinanciero, newAmount: number) => {
      if (!canEditFinances) return;
      const updated: ItemFinanciero =
        item.categoria === 'DEUDA_CON_QUITA'
          ? {
              ...item,
              montoOfertaQuitaContado: newAmount,
              editadoManualmente: true,
            }
          : item.estado === 'PAGADO'
            ? { ...item, montoPagado: newAmount, editadoManualmente: true }
            : {
                ...item,
                montoPactado: newAmount,
                pagoMinimoExigido:
                  item.categoria === 'TARJETA_ROTATIVA'
                    ? newAmount
                    : item.pagoMinimoExigido,
                editadoManualmente: true,
              };
      setItems((prev) => prev.map((it) => (it.id === item.id ? updated : it)));
      void syncItemCloud(updated);
      showToast(
        `Monto actualizado en ${formatPeriodoLabel(item.periodo)}: ${item.titulo}`
      );
    },
    [canEditFinances, syncItemCloud, showToast]
  );

  const handleQuickUpdateCapital = useCallback(
    (item: ItemFinanciero, newCapital: number) => {
      if (!canEditFinances) return;
      const updated: ItemFinanciero = {
        ...item,
        saldoCapitalTotal: newCapital,
        editadoManualmente: true,
      };
      setItems((prev) => prev.map((it) => (it.id === item.id ? updated : it)));
      void syncItemCloud(updated);
      showToast(`Deuda total actualizada en ${item.titulo}.`);
    },
    [canEditFinances, syncItemCloud, showToast]
  );

  const handleQuickUpdateDates = useCallback(
    (
      item: ItemFinanciero,
      updates: { fechaExactaVencimiento?: string; fechaCierre?: string }
    ) => {
      if (!canEditFinances) return;
      const nextVencimiento =
        updates.fechaExactaVencimiento ?? item.fechaExactaVencimiento;
      const parsedDia =
        Number(nextVencimiento.split('-')[2]) || item.diaVencimientoOCobro;
      const nextVentana = deriveVentanaFromDia(parsedDia);
      const updated: ItemFinanciero = {
        ...item,
        fechaExactaVencimiento: nextVencimiento,
        diaVencimientoOCobro: parsedDia,
        ventanaAsignada: nextVentana,
        fechaCierre:
          updates.fechaCierre !== undefined
            ? updates.fechaCierre || undefined
            : item.fechaCierre,
        editadoManualmente: true,
      };
      setItems((prev) => prev.map((it) => (it.id === item.id ? updated : it)));
      void syncItemCloud(updated);
      showToast(
        `Fechas actualizadas en ${formatPeriodoLabel(item.periodo)}: ${item.titulo}`
      );
    },
    [canEditFinances, syncItemCloud, showToast]
  );

  const handleMoveVentana = useCallback(
    (item: ItemFinanciero, targetVentana: VentanaQuincena) => {
      if (!canEditFinances) return;
      const updated: ItemFinanciero = {
        ...item,
        ventanaAsignada: targetVentana,
        editadoManualmente: true,
      };
      setItems((prev) => prev.map((it) => (it.id === item.id ? updated : it)));
      void syncItemCloud(updated);
      showToast(
        `${item.titulo} movido a la ${
          targetVentana === 'Q1_DIAS_1_AL_14' ? '1° Quincena' : '2° Quincena'
        }.`
      );
    },
    [canEditFinances, syncItemCloud, showToast]
  );

  const handleConfirmPendingAction = useCallback(() => {
    if (!canEditFinances || !confirmAction) return;

    if (confirmAction.type === 'delete-item') {
      const target = confirmAction.item;
      setItems((prev) => prev.filter((it) => it.id !== target.id));
      deleteHouseholdItem(target.id).catch(() => {});
      setConfirmAction(null);
      showToast(`Registro eliminado: ${target.titulo}`);
      return;
    }

    if (confirmAction.type === 'reset') {
      const freshSeed = createSeedDecember2026();
      setItems(freshSeed);
      handleSelectPeriodo(SEED_PERIODO_INICIAL);
      if (activeHousehold && currentUser) {
        pushHouseholdItems(activeHousehold, currentUser.uid, freshSeed).catch(
          () => {}
        );
      }
      setConfirmAction(null);
      showToast('Datos restaurados a la semilla real de Diciembre 2026.');
    }
  }, [
    canEditFinances,
    confirmAction,
    handleSelectPeriodo,
    activeHousehold,
    currentUser,
    showToast,
  ]);

  const handleImportBackup = useCallback(
    (importedItems: ItemFinanciero[]) => {
      if (!canEditFinances) return;
      setItems(importedItems);
      const hasCurrent = importedItems.some((i) => i.periodo === activePeriodo);
      if (!hasCurrent && importedItems.length > 0) {
        const sortedPeriods = Array.from(
          new Set(importedItems.map((i) => i.periodo))
        ).sort();
        handleSelectPeriodo(sortedPeriods[0]);
      }
      if (activeHousehold && currentUser) {
        pushHouseholdItems(activeHousehold, currentUser.uid, importedItems).catch(
          () => {}
        );
      }
      showToast(
        `Copia de seguridad restaurada (${importedItems.length} movimientos).`
      );
    },
    [
      canEditFinances,
      activePeriodo,
      handleSelectPeriodo,
      activeHousehold,
      currentUser,
      showToast,
    ]
  );

  // Puerta de seguridad estricta: no montar datos financieros hasta estar AUTHORIZED
  if (!accessResolution || accessResolution.status !== 'AUTHORIZED') {
    return (
      <MotionConfig reducedMotion="user">
        <AuthGateScreen
          resolution={accessResolution ?? { status: 'UNAUTHENTICATED' }}
          loading={authChecking}
          errorMessage={authError}
          onSignIn={handleAuthSignIn}
          onRetryCheck={handleRetryApprovalCheck}
          onSignOut={handleAuthSignOut}
        />
      </MotionConfig>
    );
  }

  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-screen bg-[#F6F6F3] text-[#111318]">
        <HeaderNav
        activeTab={activeTab}
        canEditFinances={canEditFinances}
        userEmail={currentUser?.email ?? null}
        pendingRequestsCount={pendingRequestsCount}
        onSelectTab={setActiveTab}
        onCreateNew={() => {
          if (!canEditFinances) return;
          setEditingItem(null);
          setIsEditorOpen(true);
        }}
        onOpenUserManagement={() => setIsUserMgmtOpen(true)}
        onSignOut={handleAuthSignOut}
      />

      <WorkspaceToolbar
        activePeriodo={activePeriodo}
        availablePeriodos={availablePeriodos}
        referenceDateISO={referenceDateISO}
        canEditFinances={canEditFinances}
        onChangeReferenceDateISO={setReferenceDateISO}
        onSelectPeriodo={handleSelectPeriodo}
        onAdvanceNextMonth={handleAdvanceNextMonth}
        onProjectSixMonths={handleProjectSixMonths}
        includeSac={includeSacActive}
        onToggleSac={handleToggleSac}
        canToggleSac={canToggleSac}
        cloudStatus={cloudStatus}
        cloudUserEmail={currentUser?.email ?? null}
        hasDriveToken={hasDriveToken}
        driveUserEmail={driveUserEmail}
        onOpenFirebaseConfig={() => setIsFirebaseModalOpen(true)}
        onResetSeed={() => {
          if (!canEditFinances) return;
          setConfirmAction({ type: 'reset' });
        }}
      />

      <main className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        {toastMessage && (
          <div
            role="status"
            aria-live="polite"
            className="mb-5 flex items-center justify-between gap-3 rounded-xl border border-[#BFDBFE] bg-[#EFF6FF] px-4 py-2.5 text-xs font-semibold text-[#1D4ED8]"
          >
            <span>{toastMessage}</span>
            <button
              type="button"
              onClick={() => setToastMessage(null)}
              aria-label="Cerrar notificación"
              className="font-semibold text-[#1D4ED8] hover:text-[#111318]"
            >
              Cerrar
            </button>
          </div>
        )}

        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
          >
            {activeTab === 'tablero' && (
              <DashboardBento
                matchResult={matchResult}
                periodItems={periodItems}
                canEditFinances={canEditFinances}
                minFoodReserveARS={minFoodReserveARS}
                onMarkPaid={(item) => {
                  if (!canEditFinances) return;
                  setPayingItem(item);
                }}
                onEditItem={(item) => {
                  if (!canEditFinances) return;
                  setEditingItem(item);
                  setIsEditorOpen(true);
                }}
                onQuickUpdateAmount={handleQuickUpdateAmount}
                onQuickUpdateCapital={handleQuickUpdateCapital}
                onQuickUpdateDates={handleQuickUpdateDates}
                onOpenReceipts={(item) => setReceiptsItemId(item.id)}
                onNavigateTab={setActiveTab}
              />
            )}

            {activeTab === 'calendario' && (
              <CalendarPlannerView
                activePeriodo={activePeriodo}
                referenceDateISO={referenceDateISO}
                matchResult={matchResult}
                periodItems={periodItems}
                canEditFinances={canEditFinances}
                hasWorkspaceToken={hasDriveToken}
                workspaceUserEmail={driveUserEmail}
                onSignInWorkspace={handleSignInDrive}
                onSignOutWorkspace={handleSignOutDrive}
                onMarkPaid={(item) => {
                  if (!canEditFinances) return;
                  setPayingItem(item);
                }}
                onNotify={showToast}
              />
            )}

            {activeTab === 'checklist' && (
              <PaymentChecklist
                matchResult={matchResult}
                periodItems={periodItems}
                canEditFinances={canEditFinances}
                onMarkPaid={(item) => {
                  if (!canEditFinances) return;
                  setPayingItem(item);
                }}
                onUndoPaid={handleUndoPaid}
                onEditItem={(item) => {
                  if (!canEditFinances) return;
                  setEditingItem(item);
                  setIsEditorOpen(true);
                }}
                onQuickUpdateAmount={handleQuickUpdateAmount}
                onQuickUpdateDates={handleQuickUpdateDates}
                onOpenReceipts={(item) => setReceiptsItemId(item.id)}
                onDeleteItem={(item) => {
                  if (!canEditFinances) return;
                  setConfirmAction({ type: 'delete-item', item });
                }}
              />
            )}

            {activeTab === 'quincenas' && (
              <QuincenalMatcherView
                matchResult={matchResult}
                canEditFinances={canEditFinances}
                minFoodReserveARS={minFoodReserveARS}
                onChangeMinFoodReserveARS={handleChangeMinFoodReserveARS}
                onMarkPaid={(item) => {
                  if (!canEditFinances) return;
                  setPayingItem(item);
                }}
                onQuickUpdateAmount={handleQuickUpdateAmount}
                onMoveVentana={handleMoveVentana}
              />
            )}

            {activeTab === 'extincion' && (
              <ExtinctionTimelineView
                matchResult={matchResult}
                periodItems={periodItems}
                canEditFinances={canEditFinances}
                minFoodReserveARS={minFoodReserveARS}
                onChangeMinFoodReserveARS={handleChangeMinFoodReserveARS}
                onEditItem={(item) => {
                  if (!canEditFinances) return;
                  setEditingItem(item);
                  setIsEditorOpen(true);
                }}
                onQuickUpdateAmount={handleQuickUpdateAmount}
                onQuickUpdateDates={handleQuickUpdateDates}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      <OfflineIndicator />

      {payingItem && canEditFinances && (
        <MarkPaidModal
          item={payingItem}
          hasDriveToken={hasDriveToken}
          onClose={() => setPayingItem(null)}
          onConfirm={handleConfirmMarkPaid}
        />
      )}

      {isEditorOpen && canEditFinances && (
        <ItemEditorModal
          activePeriodo={activePeriodo}
          editingItem={editingItem}
          hasFuturePeriods={availablePeriodos.some(
            (p) => p > (editingItem?.periodo ?? activePeriodo)
          )}
          onClose={() => {
            setIsEditorOpen(false);
            setEditingItem(null);
          }}
          onSave={handleSaveItem}
        />
      )}

      {receiptsItem && (
        <ReceiptsModal
          item={receiptsItem}
          isCollaborator={!canEditFinances}
          driveUserEmail={driveUserEmail}
          hasDriveToken={hasDriveToken}
          onSignInDrive={handleSignInDrive}
          onSignOutDrive={handleSignOutDrive}
          onUploadFile={handleUploadReceipt}
          onAddManualLink={handleAddManualLink}
          onDeleteAttachment={handleDeleteAttachment}
          onClose={() => setReceiptsItemId(null)}
        />
      )}

      {isUserMgmtOpen && canEditFinances && activeHousehold && currentUser && (
        <UserManagementModal
          currentAdminUid={currentUser.uid}
          members={members}
          invites={invites}
          requests={accessRequests}
          onInvite={async ({ email, displayName, role }) => {
            await inviteMemberByEmail({
              household: activeHousehold,
              adminUid: currentUser.uid,
              email,
              displayName,
              role,
            });
          }}
          onApproveRequest={async (req, role) => {
            await approveAccessRequest({
              household: activeHousehold,
              adminUid: currentUser.uid,
              request: req,
              role,
            });
          }}
          onRejectRequest={async (req) => {
            await rejectAccessRequest(req.uid);
          }}
          onToggleMemberStatus={async (member, nextStatus) => {
            await revokeOrRestoreMember({
              household: activeHousehold,
              adminUid: currentUser.uid,
              member,
              nextStatus,
            });
          }}
          onRevokeInvite={async (invite) => {
            await revokeInvite({
              household: activeHousehold,
              adminUid: currentUser.uid,
              invite,
            });
          }}
          onClose={() => setIsUserMgmtOpen(false)}
        />
      )}

      {isFirebaseModalOpen && (
        <FirebaseConfigModal
          items={items}
          canEditFinances={canEditFinances}
          userRole={userRole}
          cloudStatus={cloudStatus}
          cloudUserEmail={currentUser?.email ?? null}
          driveUserEmail={driveUserEmail}
          hasDriveToken={hasDriveToken}
          onImportBackup={handleImportBackup}
          onSignInDrive={handleSignInDrive}
          onSignOutDrive={handleSignOutDrive}
          onClose={() => setIsFirebaseModalOpen(false)}
        />
      )}

      {confirmAction && canEditFinances && (
        <ConfirmDialog
          title={
            confirmAction.type === 'reset'
              ? '¿Restaurar los datos iniciales?'
              : `¿Eliminar "${confirmAction.item.titulo}"?`
          }
          description={
            confirmAction.type === 'reset'
              ? 'Se borrarán todos los meses futuros, montos ajustados y cambios que hiciste para volver a la semilla original de Diciembre 2026.'
              : `Se eliminará "${confirmAction.item.titulo}" de ${formatPeriodoLabel(
                  confirmAction.item.periodo
                )}. Esta acción no se puede deshacer.`
          }
          confirmLabel={
            confirmAction.type === 'reset' ? 'Sí, restaurar' : 'Sí, eliminar'
          }
          tone={confirmAction.type === 'reset' ? 'warning' : 'danger'}
          onCancel={() => setConfirmAction(null)}
          onConfirm={handleConfirmPendingAction}
        />
      )}
      </div>
    </MotionConfig>
  );
}
