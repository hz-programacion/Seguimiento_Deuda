import { FirebaseApp, getApps, initializeApp } from 'firebase/app';
import {
  Auth,
  GoogleAuthProvider,
  User,
  getAuth,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import {
  Firestore,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocFromServer,
  getDocs,
  getFirestore,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import firebaseAppletConfig from '../../firebase-applet-config.json';
import {
  AccessRequest,
  HouseholdDoc,
  HouseholdInvite,
  HouseholdMember,
  HouseholdRole,
  ItemFinanciero,
} from '../types/finance';

export const PRIMARY_ADMIN_EMAIL = 'hz.mdiego@gmail.com';
export const HOUSEHOLD_ID = 'hogar-principal';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

// Inicialización única del proyecto Firebase provisionado
const defaultApp: FirebaseApp =
  getApps().find((a) => a.name === '[DEFAULT]') ??
  initializeApp(firebaseAppletConfig);

export const db: Firestore = getFirestore(
  defaultApp,
  firebaseAppletConfig.firestoreDatabaseId
);
export const auth: Auth = getAuth(defaultApp);

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export async function testFirestoreConnection(): Promise<void> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes('the client is offline')
    ) {
      console.error('Please check your Firebase configuration.');
    }
  }
}

export function emailToInviteId(email: string): string {
  const normalized = email.trim().toLowerCase();
  let hex = '';
  for (let i = 0; i < normalized.length; i++) {
    hex += normalized.charCodeAt(i).toString(16).padStart(2, '0');
  }
  return `inv_${hex.slice(0, 118)}`;
}

export function subscribeHouseholdAuth(
  callback: (user: User | null) => void
): () => void {
  return onAuthStateChanged(auth, callback);
}

export async function signInHouseholdGoogle(): Promise<User> {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  const result = await signInWithPopup(auth, provider);
  return result.user;
}

export async function signOutHousehold(): Promise<void> {
  await signOut(auth);
}

export type AccessResolution =
  | { status: 'UNAUTHENTICATED' }
  | { status: 'UNVERIFIED'; email: string }
  | {
      status: 'AUTHORIZED';
      role: HouseholdRole;
      household: HouseholdDoc;
      user: User;
    }
  | {
      status: 'PENDING_APPROVAL';
      requestStatus: 'PENDIENTE' | 'RECHAZADA';
      email: string;
      user: User;
    }
  | {
      status: 'REVOKED';
      email: string;
      user: User;
    };

function buildFirestoreItemPayload(
  item: ItemFinanciero,
  household: HouseholdDoc,
  actorUid: string,
  includeCreatedAt: boolean
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    id: item.id,
    householdId: household.id,
    ownerUid: household.ownerUid,
    allowedUids: household.allowedUids.slice(0, 10),
    allowedEmails: household.allowedEmails.slice(0, 10),
    periodo: item.periodo,
    titulo: item.titulo.slice(0, 140),
    categoria: item.categoria,
    montoPactado: item.montoPactado,
    estado: item.estado,
    diaVencimientoOCobro: Math.min(31, Math.max(1, Math.round(item.diaVencimientoOCobro))),
    fechaExactaVencimiento: item.fechaExactaVencimiento,
    ventanaAsignada: item.ventanaAsignada,
    bolsilloResponsable: item.bolsilloResponsable.slice(0, 80),
    esCuotaFija: Boolean(item.esCuotaFija),
    updatedAt: serverTimestamp(),
    updatedByUid: actorUid,
  };

  if (includeCreatedAt) {
    payload.createdAt = serverTimestamp();
  }
  if (item.subgrupo !== undefined) payload.subgrupo = item.subgrupo.slice(0, 80);
  if (item.montoPagado !== undefined) payload.montoPagado = item.montoPagado;
  if (item.fechaCierre !== undefined) payload.fechaCierre = item.fechaCierre;
  if (item.fechaPagoReal !== undefined) payload.fechaPagoReal = item.fechaPagoReal;
  if (item.cuotaActual !== undefined) payload.cuotaActual = Math.round(item.cuotaActual);
  if (item.cuotasTotales !== undefined) payload.cuotasTotales = Math.round(item.cuotasTotales);
  if (item.mesFinEstimado !== undefined) payload.mesFinEstimado = item.mesFinEstimado.slice(0, 40);
  if (item.montoLiberadoAlExtinguirse !== undefined) {
    payload.montoLiberadoAlExtinguirse = item.montoLiberadoAlExtinguirse;
  }
  if (item.saldoCapitalTotal !== undefined) payload.saldoCapitalTotal = item.saldoCapitalTotal;
  if (item.pagoMinimoExigido !== undefined) payload.pagoMinimoExigido = item.pagoMinimoExigido;
  if (item.tnaEstimada !== undefined) payload.tnaEstimada = item.tnaEstimada;
  if (item.montoOfertaQuitaContado !== undefined) {
    payload.montoOfertaQuitaContado = item.montoOfertaQuitaContado;
  }
  if (item.porcentajeQuita !== undefined) payload.porcentajeQuita = item.porcentajeQuita;
  if (item.notas !== undefined) payload.notas = item.notas.slice(0, 1000);
  if (item.adjuntos !== undefined) {
    payload.adjuntos = item.adjuntos.slice(0, 20).map((a) => ({
      id: a.id.slice(0, 128),
      tipo: a.tipo,
      nombre: a.nombre.slice(0, 200),
      mimeType: a.mimeType.slice(0, 120),
      driveFileId: a.driveFileId.slice(0, 200),
      webViewLink: a.webViewLink.slice(0, 600),
      subidoEn: a.subidoEn.slice(0, 40),
    }));
  }
  if (item.editadoManualmente !== undefined) {
    payload.editadoManualmente = Boolean(item.editadoManualmente);
  }

  return payload;
}

export async function resolveHouseholdAccess(
  user: User,
  fallbackLocalItems: ItemFinanciero[],
  fallbackMinFoodARS: number
): Promise<AccessResolution> {
  const emailLower = (user.email ?? '').trim().toLowerCase();
  if (!emailLower || !user.emailVerified) {
    return { status: 'UNVERIFIED', email: emailLower || 'sin-correo' };
  }

  const hhRef = doc(db, 'households', HOUSEHOLD_ID);
  const hhPath = `households/${HOUSEHOLD_ID}`;

  // 1. Administrador Maestro (hz.mdiego@gmail.com)
  if (emailLower === PRIMARY_ADMIN_EMAIL) {
    let household: HouseholdDoc;
    try {
      const hhSnap = await getDoc(hhRef);
      if (!hhSnap.exists()) {
        household = {
          id: HOUSEHOLD_ID,
          nombre: 'Hogar Principal · ArgenCaja',
          ownerUid: user.uid,
          ownerEmail: emailLower,
          minFoodReserveARS: fallbackMinFoodARS,
          allowedUids: [user.uid],
          allowedEmails: [emailLower],
        };
        await setDoc(hhRef, {
          ...household,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } else {
        const data = hhSnap.data() as HouseholdDoc;
        const nextUids = Array.from(new Set([...(data.allowedUids ?? []), user.uid])).slice(0, 10);
        const nextEmails = Array.from(
          new Set([...(data.allowedEmails ?? []), emailLower])
        ).slice(0, 10);
        household = {
          ...data,
          allowedUids: nextUids,
          allowedEmails: nextEmails,
        };
        if (
          nextUids.length !== (data.allowedUids?.length ?? 0) ||
          nextEmails.length !== (data.allowedEmails?.length ?? 0)
        ) {
          await updateDoc(hhRef, {
            allowedUids: nextUids,
            allowedEmails: nextEmails,
            updatedAt: serverTimestamp(),
          });
        }
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, hhPath);
    }

    // Asegurar registro de miembro ADMIN
    const memberRef = doc(db, 'households', HOUSEHOLD_ID, 'members', user.uid);
    const memberPathStr = `households/${HOUSEHOLD_ID}/members/${user.uid}`;
    try {
      const mSnap = await getDoc(memberRef);
      if (!mSnap.exists()) {
        await setDoc(memberRef, {
          uid: user.uid,
          householdId: HOUSEHOLD_ID,
          adminUid: user.uid,
          emailLower,
          displayName: (user.displayName || 'Administrador').slice(0, 80),
          role: 'ADMIN',
          status: 'ACTIVO',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, memberPathStr);
    }

    // Si la nube todavía no tiene ítems, subir la semilla local inicial
    try {
      const itemsSnap = await getDocs(
        collection(db, 'households', HOUSEHOLD_ID, 'items')
      );
      if (itemsSnap.empty && fallbackLocalItems.length > 0) {
        await pushHouseholdItems(household, user.uid, fallbackLocalItems, true);
      }
    } catch (error) {
      handleFirestoreError(
        error,
        OperationType.LIST,
        `households/${HOUSEHOLD_ID}/items`
      );
    }

    return { status: 'AUTHORIZED', role: 'ADMIN', household, user };
  }

  // 2. Otros usuarios verificados: consultar si ya tienen membresía (usando query segura por uid)
  const membersCol = collection(db, 'households', HOUSEHOLD_ID, 'members');
  const membersPath = `households/${HOUSEHOLD_ID}/members`;
  try {
    const mQuery = query(membersCol, where('uid', '==', user.uid));
    const mSnap = await getDocs(mQuery);
    if (!mSnap.empty) {
      const member = mSnap.docs[0].data() as HouseholdMember;
      if (member.status === 'REVOCADO') {
        return { status: 'REVOKED', email: emailLower, user };
      }
      const hhSnap = await getDoc(hhRef);
      if (!hhSnap.exists()) {
        return {
          status: 'PENDING_APPROVAL',
          requestStatus: 'PENDIENTE',
          email: emailLower,
          user,
        };
      }
      return {
        status: 'AUTHORIZED',
        role: member.role,
        household: hhSnap.data() as HouseholdDoc,
        user,
      };
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, membersPath);
  }

  // 3. Si no tiene membresía aún, verificar si tiene una pre-invitación PENDIENTE por su correo
  const invitesCol = collection(db, 'households', HOUSEHOLD_ID, 'invites');
  const invitesPath = `households/${HOUSEHOLD_ID}/invites`;
  try {
    const invQuery = query(invitesCol, where('emailLower', '==', emailLower));
    const invSnap = await getDocs(invQuery);
    const pendingInviteDoc = invSnap.docs.find(
      (d) => (d.data() as HouseholdInvite).status === 'PENDIENTE'
    );

    if (pendingInviteDoc) {
      const invite = pendingInviteDoc.data() as HouseholdInvite;
      const batch = writeBatch(db);
      const memberRef = doc(db, 'households', HOUSEHOLD_ID, 'members', user.uid);
      const inviteRef = doc(db, 'households', HOUSEHOLD_ID, 'invites', invite.id);

      batch.set(memberRef, {
        uid: user.uid,
        householdId: HOUSEHOLD_ID,
        adminUid: invite.invitedByUid,
        emailLower,
        displayName: (user.displayName || invite.displayName || emailLower).slice(0, 80),
        role: invite.role,
        status: 'ACTIVO',
        inviteId: invite.id,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      batch.update(inviteRef, {
        status: 'ACEPTADA',
        claimedByUid: user.uid,
        updatedAt: serverTimestamp(),
      });

      await batch.commit();

      const hhSnap = await getDoc(hhRef);
      if (hhSnap.exists()) {
        return {
          status: 'AUTHORIZED',
          role: invite.role,
          household: hhSnap.data() as HouseholdDoc,
          user,
        };
      }
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, invitesPath);
  }

  // 4. Usuario sin invitación previa: registrar solicitud pendiente y bloquear acceso financiero
  const reqCol = collection(db, 'households', HOUSEHOLD_ID, 'accessRequests');
  const reqPath = `households/${HOUSEHOLD_ID}/accessRequests/${user.uid}`;
  try {
    const reqQuery = query(reqCol, where('uid', '==', user.uid));
    const reqSnap = await getDocs(reqQuery);
    if (!reqSnap.empty) {
      const existingReq = reqSnap.docs[0].data() as AccessRequest;
      return {
        status: 'PENDING_APPROVAL',
        requestStatus:
          existingReq.status === 'RECHAZADA' ? 'RECHAZADA' : 'PENDIENTE',
        email: emailLower,
        user,
      };
    }

    await setDoc(doc(db, 'households', HOUSEHOLD_ID, 'accessRequests', user.uid), {
      uid: user.uid,
      householdId: HOUSEHOLD_ID,
      emailLower,
      displayName: (user.displayName || emailLower).slice(0, 80),
      status: 'PENDIENTE',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return {
      status: 'PENDING_APPROVAL',
      requestStatus: 'PENDIENTE',
      email: emailLower,
      user,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, reqPath);
  }
}

export function subscribeHouseholdDoc(
  onData: (hh: HouseholdDoc) => void,
  onError: (err: Error) => void
): () => void {
  const path = `households/${HOUSEHOLD_ID}`;
  return onSnapshot(
    doc(db, 'households', HOUSEHOLD_ID),
    (snap) => {
      if (snap.exists()) {
        onData(snap.data() as HouseholdDoc);
      }
    },
    (err) => {
      try {
        handleFirestoreError(err, OperationType.GET, path);
      } catch (wrapped) {
        onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    }
  );
}

export function subscribeHouseholdItems(
  user: User,
  role: HouseholdRole,
  onItems: (items: ItemFinanciero[]) => void,
  onError: (err: Error) => void
): () => void {
  const path = `households/${HOUSEHOLD_ID}/items`;
  const colRef = collection(db, 'households', HOUSEHOLD_ID, 'items');
  const emailLower = (user.email ?? '').trim().toLowerCase();

  // Admin lista todo el hogar; colaboradora consulta por su email o UID autorizado en la regla
  const q =
    role === 'ADMIN'
      ? colRef
      : query(colRef, where('allowedEmails', 'array-contains', emailLower));

  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs.map((d) => d.data() as ItemFinanciero);
      onItems(list);
    },
    (err) => {
      try {
        handleFirestoreError(err, OperationType.LIST, path);
      } catch (wrapped) {
        onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    }
  );
}

export async function pushHouseholdItems(
  household: HouseholdDoc,
  actorUid: string,
  items: ItemFinanciero[],
  onlyCreateNew = false
): Promise<void> {
  const path = `households/${HOUSEHOLD_ID}/items`;
  try {
    const existingIds = new Set<string>();
    if (!onlyCreateNew) {
      const snap = await getDocs(
        collection(db, 'households', HOUSEHOLD_ID, 'items')
      );
      snap.docs.forEach((d) => existingIds.add(d.id));
    }

    const CHUNK = 400;
    for (let i = 0; i < items.length; i += CHUNK) {
      const batch = writeBatch(db);
      const slice = items.slice(i, i + CHUNK);
      for (const item of slice) {
        const ref = doc(db, 'households', HOUSEHOLD_ID, 'items', item.id);
        const exists = existingIds.has(item.id);
        if (exists) {
          batch.update(
            ref,
            buildFirestoreItemPayload(item, household, actorUid, false)
          );
        } else {
          batch.set(
            ref,
            buildFirestoreItemPayload(item, household, actorUid, true)
          );
        }
      }
      await batch.commit();
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function upsertHouseholdItem(
  household: HouseholdDoc,
  actorUid: string,
  item: ItemFinanciero
): Promise<void> {
  const path = `households/${HOUSEHOLD_ID}/items/${item.id}`;
  const ref = doc(db, 'households', HOUSEHOLD_ID, 'items', item.id);
  try {
    const snap = await getDoc(ref);
    if (snap.exists()) {
      await updateDoc(
        ref,
        buildFirestoreItemPayload(item, household, actorUid, false)
      );
    } else {
      await setDoc(
        ref,
        buildFirestoreItemPayload(item, household, actorUid, true)
      );
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function updateCollaboratorAttachments(
  actorUid: string,
  item: ItemFinanciero
): Promise<void> {
  const path = `households/${HOUSEHOLD_ID}/items/${item.id}`;
  const ref = doc(db, 'households', HOUSEHOLD_ID, 'items', item.id);
  const safeAdjuntos = (item.adjuntos ?? []).slice(0, 20).map((a) => ({
    id: a.id.slice(0, 128),
    tipo: a.tipo,
    nombre: a.nombre.slice(0, 200),
    mimeType: a.mimeType.slice(0, 120),
    driveFileId: a.driveFileId.slice(0, 200),
    webViewLink: a.webViewLink.slice(0, 600),
    subidoEn: a.subidoEn.slice(0, 40),
  }));
  try {
    await updateDoc(ref, {
      adjuntos: safeAdjuntos,
      updatedAt: serverTimestamp(),
      updatedByUid: actorUid,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteHouseholdItem(itemId: string): Promise<void> {
  const path = `households/${HOUSEHOLD_ID}/items/${itemId}`;
  try {
    await deleteDoc(doc(db, 'households', HOUSEHOLD_ID, 'items', itemId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function updateHouseholdMinFoodReserve(
  minFoodReserveARS: number
): Promise<void> {
  const path = `households/${HOUSEHOLD_ID}`;
  try {
    await updateDoc(doc(db, 'households', HOUSEHOLD_ID), {
      minFoodReserveARS,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

// =========================================================================
// Administración de Miembros, Pre-Invitaciones y Aprobaciones
// =========================================================================

export function subscribeAdminDirectory(
  onData: (data: {
    members: HouseholdMember[];
    invites: HouseholdInvite[];
    requests: AccessRequest[];
  }) => void,
  onError: (err: Error) => void
): () => void {
  let members: HouseholdMember[] = [];
  let invites: HouseholdInvite[] = [];
  let requests: AccessRequest[] = [];

  const emit = () => onData({ members, invites, requests });

  const unsubMembers = onSnapshot(
    collection(db, 'households', HOUSEHOLD_ID, 'members'),
    (snap) => {
      members = snap.docs.map((d) => d.data() as HouseholdMember);
      emit();
    },
    (err) => {
      try {
        handleFirestoreError(
          err,
          OperationType.LIST,
          `households/${HOUSEHOLD_ID}/members`
        );
      } catch (wrapped) {
        onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    }
  );

  const unsubInvites = onSnapshot(
    collection(db, 'households', HOUSEHOLD_ID, 'invites'),
    (snap) => {
      invites = snap.docs.map((d) => d.data() as HouseholdInvite);
      emit();
    },
    (err) => {
      try {
        handleFirestoreError(
          err,
          OperationType.LIST,
          `households/${HOUSEHOLD_ID}/invites`
        );
      } catch (wrapped) {
        onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    }
  );

  const unsubReqs = onSnapshot(
    collection(db, 'households', HOUSEHOLD_ID, 'accessRequests'),
    (snap) => {
      requests = snap.docs.map((d) => d.data() as AccessRequest);
      emit();
    },
    (err) => {
      try {
        handleFirestoreError(
          err,
          OperationType.LIST,
          `households/${HOUSEHOLD_ID}/accessRequests`
        );
      } catch (wrapped) {
        onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    }
  );

  return () => {
    unsubMembers();
    unsubInvites();
    unsubReqs();
  };
}

async function syncHouseholdAccessLists(
  household: HouseholdDoc,
  nextAllowedUids: string[],
  nextAllowedEmails: string[],
  actorUid: string
): Promise<void> {
  const cleanUids = Array.from(new Set(nextAllowedUids)).slice(0, 10);
  const cleanEmails = Array.from(
    new Set(nextAllowedEmails.map((e) => e.trim().toLowerCase()))
  ).slice(0, 10);

  await updateDoc(doc(db, 'households', HOUSEHOLD_ID), {
    allowedUids: cleanUids,
    allowedEmails: cleanEmails,
    updatedAt: serverTimestamp(),
  });

  const itemsSnap = await getDocs(
    collection(db, 'households', HOUSEHOLD_ID, 'items')
  );
  const docs = itemsSnap.docs;
  const CHUNK = 400;
  for (let i = 0; i < docs.length; i += CHUNK) {
    const batch = writeBatch(db);
    for (const d of docs.slice(i, i + CHUNK)) {
      batch.update(d.ref, {
        allowedUids: cleanUids,
        allowedEmails: cleanEmails,
        updatedAt: serverTimestamp(),
        updatedByUid: actorUid,
      });
    }
    await batch.commit();
  }
}

export async function inviteMemberByEmail(params: {
  household: HouseholdDoc;
  adminUid: string;
  email: string;
  displayName: string;
  role: HouseholdRole;
}): Promise<void> {
  const emailLower = params.email.trim().toLowerCase();
  const inviteId = emailToInviteId(emailLower);
  const inviteRef = doc(db, 'households', HOUSEHOLD_ID, 'invites', inviteId);
  const path = `households/${HOUSEHOLD_ID}/invites/${inviteId}`;

  try {
    const existingSnap = await getDoc(inviteRef);
    if (existingSnap.exists()) {
      await updateDoc(inviteRef, {
        displayName: (params.displayName.trim() || emailLower).slice(0, 80),
        role: params.role,
        status: 'PENDIENTE',
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(inviteRef, {
        id: inviteId,
        householdId: HOUSEHOLD_ID,
        emailLower: emailLower.slice(0, 120),
        displayName: (params.displayName.trim() || emailLower).slice(0, 80),
        role: params.role,
        status: 'PENDIENTE',
        invitedByUid: params.adminUid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    await syncHouseholdAccessLists(
      params.household,
      params.household.allowedUids,
      [...params.household.allowedEmails, emailLower],
      params.adminUid
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function approveAccessRequest(params: {
  household: HouseholdDoc;
  adminUid: string;
  request: AccessRequest;
  role: HouseholdRole;
}): Promise<void> {
  const { household, adminUid, request, role } = params;
  const memberRef = doc(db, 'households', HOUSEHOLD_ID, 'members', request.uid);
  const reqRef = doc(
    db,
    'households',
    HOUSEHOLD_ID,
    'accessRequests',
    request.uid
  );
  const path = `households/${HOUSEHOLD_ID}/members/${request.uid}`;

  try {
    const existingMember = await getDoc(memberRef);
    const batch = writeBatch(db);
    if (existingMember.exists()) {
      batch.update(memberRef, {
        displayName: request.displayName.slice(0, 80),
        role,
        status: 'ACTIVO',
        updatedAt: serverTimestamp(),
      });
    } else {
      batch.set(memberRef, {
        uid: request.uid,
        householdId: HOUSEHOLD_ID,
        adminUid,
        emailLower: request.emailLower.slice(0, 120),
        displayName: request.displayName.slice(0, 80),
        role,
        status: 'ACTIVO',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    batch.update(reqRef, {
      status: 'APROBADA',
      updatedAt: serverTimestamp(),
    });

    await batch.commit();

    await syncHouseholdAccessLists(
      household,
      [...household.allowedUids, request.uid],
      [...household.allowedEmails, request.emailLower],
      adminUid
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function rejectAccessRequest(requestUid: string): Promise<void> {
  const path = `households/${HOUSEHOLD_ID}/accessRequests/${requestUid}`;
  try {
    await updateDoc(
      doc(db, 'households', HOUSEHOLD_ID, 'accessRequests', requestUid),
      {
        status: 'RECHAZADA',
        updatedAt: serverTimestamp(),
      }
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function revokeOrRestoreMember(params: {
  household: HouseholdDoc;
  adminUid: string;
  member: HouseholdMember;
  nextStatus: 'ACTIVO' | 'REVOCADO';
}): Promise<void> {
  const { household, adminUid, member, nextStatus } = params;
  const path = `households/${HOUSEHOLD_ID}/members/${member.uid}`;
  try {
    await updateDoc(doc(db, 'households', HOUSEHOLD_ID, 'members', member.uid), {
      status: nextStatus,
      updatedAt: serverTimestamp(),
    });

    if (nextStatus === 'REVOCADO') {
      await syncHouseholdAccessLists(
        household,
        household.allowedUids.filter((u) => u !== member.uid),
        household.allowedEmails.filter((e) => e !== member.emailLower),
        adminUid
      );
    } else {
      await syncHouseholdAccessLists(
        household,
        [...household.allowedUids, member.uid],
        [...household.allowedEmails, member.emailLower],
        adminUid
      );
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function revokeInvite(params: {
  household: HouseholdDoc;
  adminUid: string;
  invite: HouseholdInvite;
}): Promise<void> {
  const path = `households/${HOUSEHOLD_ID}/invites/${params.invite.id}`;
  try {
    await updateDoc(
      doc(db, 'households', HOUSEHOLD_ID, 'invites', params.invite.id),
      {
        status: 'REVOCADA',
        updatedAt: serverTimestamp(),
      }
    );
    await syncHouseholdAccessLists(
      params.household,
      params.household.allowedUids,
      params.household.allowedEmails.filter(
        (e) => e !== params.invite.emailLower
      ),
      params.adminUid
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}
