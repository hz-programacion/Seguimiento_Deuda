export type PeriodoID = string; // Formato "YYYY-MM", ej: "2026-12", "2027-01"

export type VentanaQuincena = 'Q1_DIAS_1_AL_14' | 'Q2_DIAS_15_AL_31';

export type CategoriaMovimiento =
  | 'INGRESO_HABITUAL'
  | 'INGRESO_EXTRA_SAC'
  | 'SERVICIO_HOGAR'
  | 'CUOTA_FIJA'
  | 'TARJETA_ROTATIVA'
  | 'DEUDA_CON_QUITA';

export type EstadoItem = 'PENDIENTE' | 'PAGADO' | 'EXTINGUIDO';

export type PrioridadPago = 'CRITICA' | 'ALTA' | 'NORMAL';

export type BankingPaymentStatus =
  | 'PAGAR_AHORA'
  | 'ESPERAR_CIERRE'
  | 'EXCEDE_TOPE_COMIDA'
  | 'PAGADO';

export type HouseholdRole = 'ADMIN' | 'HERMANA_COMPROBANTES';

export type MemberStatus = 'ACTIVO' | 'REVOCADO';

export interface HouseholdDoc {
  id: string;
  nombre: string;
  ownerUid: string;
  ownerEmail: string;
  minFoodReserveARS: number;
  allowedUids: string[];
  allowedEmails: string[];
}

export interface HouseholdMember {
  uid: string;
  householdId: string;
  adminUid: string;
  emailLower: string;
  displayName: string;
  role: HouseholdRole;
  status: MemberStatus;
  inviteId?: string;
}

export interface HouseholdInvite {
  id: string;
  householdId: string;
  emailLower: string;
  displayName: string;
  role: HouseholdRole;
  status: 'PENDIENTE' | 'ACEPTADA' | 'REVOCADA';
  invitedByUid: string;
  claimedByUid?: string;
}

export interface AccessRequest {
  uid: string;
  householdId: string;
  emailLower: string;
  displayName: string;
  status: 'PENDIENTE' | 'APROBADA' | 'RECHAZADA';
}

export interface ComprobanteAdjunto {
  id: string;
  tipo: 'RESUMEN' | 'COMPROBANTE';
  nombre: string;
  mimeType: string;
  driveFileId: string;
  webViewLink: string;
  subidoEn: string;
}

export interface ItemFinanciero {
  id: string;
  periodo: PeriodoID;
  titulo: string;
  categoria: CategoriaMovimiento;
  subgrupo?: string;
  montoPactado: number;
  montoPagado?: number;
  estado: EstadoItem;

  // Fechas y Ventanas Operativas
  diaVencimientoOCobro: number;
  fechaExactaVencimiento: string;
  fechaCierre?: string;
  fechaPagoReal?: string;
  ventanaAsignada: VentanaQuincena;
  bolsilloResponsable: string;

  // Lógica de Cuotas Fijas
  esCuotaFija: boolean;
  cuotaActual?: number;
  cuotasTotales?: number;
  mesFinEstimado?: string;
  montoLiberadoAlExtinguirse?: number;

  // Lógica de Tarjetas Rotativas y Pasivos Especiales
  saldoCapitalTotal?: number;
  pagoMinimoExigido?: number;
  tnaEstimada?: number;
  montoOfertaQuitaContado?: number;
  porcentajeQuita?: number;
  notas?: string;

  // Resúmenes y comprobantes (Google Drive) y control de cambios
  adjuntos?: ComprobanteAdjunto[];
  editadoManualmente?: boolean;
}

export interface MonthSummary {
  periodo: PeriodoID;
  ingresosHabitualesCents: number;
  ingresosSacCents: number;
  ingresosTotalesCents: number;
  serviciosHogarCents: number;
  cuotasFijasCents: number;
  tarjetasTotalesCents: number;
  obligacionesFijasTotalesCents: number;
  colchonComidaCents: number;
  totalPagadoCents: number;
  totalPendienteCents: number;
  porcentajeAvance: number;
  alivioMensualGanadoCents: number;
  itemsExtinguidosCount: number;
}

export interface MatchedAllocation {
  obligacion: ItemFinanciero;
  prioridad: PrioridadPago;
  razonPrioridad: string;
  diasHastaVencimiento: number;
  bankingStatus: BankingPaymentStatus;
  bloqueadoPorCierre: boolean;
  ventanaPagoDesdeISO?: string;
  fechaLimiteRecomendadaISO: string;
  avisoBancario?: string;
  bolsillosSugeridos: Array<{
    titulo: string;
    bolsillo: string;
    montoAsignadoCents: number;
  }>;
  cubiertoCents: number;
  faltanteCents: number;
  excedeTopeComidaCents: number;
}

export interface QuincenaCaja {
  ventana: VentanaQuincena;
  titulo: string;
  rangoDias: string;
  ingresosCents: number;
  remanenteArrastreCents: number;
  disponibleTotalCents: number;
  obligacionesCents: number;
  obligacionesPagadasCents: number;
  obligacionesPendientesCents: number;
  reservaComidaSugeridaCents: number;
  presupuestoPagableSinComidaCents: number;
  totalRecomendadoAhoraCents: number;
  totalEsperandoCierreCents: number;
  totalExcedeTopeCents: number;
  saldoLibrePostPagosCents: number;
  descalceCents: number;
  itemsIngreso: ItemFinanciero[];
  asignaciones: MatchedAllocation[];
}

export interface SurplusRecommendation {
  tieneExcedente: boolean;
  excedenteBaseCents: number;
  mercadoPagoQuitaCents: number;
  mercadoPagoNominalCents: number;
  ahorroQuitaCents: number;
  cubreQuitaCompleta: boolean;
  patagoniaCapitalCents: number;
  patagoniaReduccionPct: number;
  recomendacionTexto: string;
}

export interface CashFlowMatchResult {
  referenceDateISO: string;
  summary: MonthSummary;
  q1: QuincenaCaja;
  q2: QuincenaCaja;
  alertaDescalce: {
    hayDescalce: boolean;
    montoAReservarCents: number;
    mensaje: string;
  };
  tarjetasBloqueadasPorCierre: MatchedAllocation[];
  pagosPostergadosPorComida: MatchedAllocation[];
  colaPrioridad: MatchedAllocation[];
  simuladorExcedente: SurplusRecommendation;
}

export interface FirebaseConfigData {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId: string;
  firestoreDatabaseId?: string;
}

export type CalendarEventKind =
  | 'COBRO'
  | 'VENCIMIENTO'
  | 'VENTANA_TARJETA'
  | 'EXTINCION_CUOTA';

export interface CalendarPlannedEvent {
  eventKey: string;
  itemId: string;
  dateISO: string;
  originalDueISO?: string;
  kind: CalendarEventKind;
  title: string;
  description: string;
  amountARS: number;
  bolsillo: string;
  isPaid: boolean;
  isUrgent: boolean;
  shiftedFromWeekend: boolean;
  blockedPreClose: boolean;
}

export interface GoogleCalendarEventItem {
  id: string;
  summary: string;
  description?: string;
  htmlLink?: string;
  startDateISO: string;
  startTimeLabel?: string;
  isAllDay: boolean;
  argenCajaKey?: string;
}

export type AppTab =
  | 'tablero'
  | 'checklist'
  | 'quincenas'
  | 'tarjetas'
  | 'extincion'
  | 'calendario';

