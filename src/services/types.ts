/**
 * Couche services : contrat d'accès aux données, indépendant de la source.
 * Deux implémentations — mock (démo) et supabase (réel) — voir services/index.ts.
 * Les écrans ne parlent QU'À ces interfaces (jamais à Supabase directement).
 */
import type { SupplierCalendar } from '@/lib/orderCalendar'

export interface Supplier {
  id: string
  name: string
  phone: string
  orderDays: number[]
  deliveryLabel: string
  dueToday: boolean
  calendar: SupplierCalendar
}

export interface Product {
  id: string
  name: string
  category: string
  categoryId: string | null
  categoryPosition: number
  supplierId: string
  ref: string
  location: string
  packSize: number
  packLabel: string
  minOrderPacks: number
  orderMultiplePacks: number
  stockUnits: number
  minUnits: number
  maxUnits: number
  isFavorite: boolean
  /** conso par jour de semaine (0=lundi) */
  conso: number[]
}

export interface PrepaLine {
  productId: string
  units: number
}
export interface Prepa {
  id: string
  name: string
  time: string
  lines: PrepaLine[]
  lastRunAt?: string | null
}

export interface AppSettings {
  safetyDeliveries: number
  recalibrationThreshold: number
}

export interface ExitHistoryLine {
  productId: string
  productName: string
  units: number
}

export interface ExitHistoryEntry {
  batchId: string
  createdAt: string
  createdBy: string | null
  createdByName: string
  note: string
  templateId: string | null
  lines: ExitHistoryLine[]
}

export interface PrepaInput {
  id?: string
  siteId: string
  name: string
  time: string
  lines: PrepaLine[]
}

export interface ExitLine {
  productId: string
  units: number
}

export interface ReceptionLine {
  productId: string
  orderedUnits: number
  acceptedUnits: number
  note?: string
}

export interface PurchaseOrderLine {
  productId: string
  packSize: number
  proposedPacks: number
  checkedPacks: number | null
  finalPacks: number
  visualCheck: { full: number; partIdx: number; seenUnits: number; theoreticalUnits: number } | null
  note: string
}

export interface PurchaseOrder {
  id: string
  supplierId: string
  supplierName: string
  status: 'ordered' | 'received' | 'closed' | 'cancelled' | string
  coverFrom: string | null
  coverUntil: string | null
  channel: string
  orderedAt: string
  orderedBy: string | null
  orderedByName: string
  lines: PurchaseOrderLine[]
}

export interface PlaceOrderInput {
  idempotencyKey: string
  supplierId: string
  coverFrom: string
  coverUntil: string
  channel: string
  lines: Omit<PurchaseOrderLine, 'packSize'>[]
}

export interface OrderService {
  place(input: PlaceOrderInput): Promise<string>
  listPendingReception(): Promise<PurchaseOrder[]>
  listHistory(limit?: number): Promise<PurchaseOrder[]>
}

export interface Category {
  id: string
  name: string
  position: number
}

export interface CatalogService {
  listProducts(): Promise<Product[]>
  listSuppliers(): Promise<Supplier[]>
  listPrepas(): Promise<Prepa[]>
  listCategories(): Promise<Category[]>
  getSettings(): Promise<AppSettings>
}

/* -------- Administration (config) : responsable uniquement (RLS) -------- */

export interface ProductInput {
  id?: string
  siteId: string
  name: string
  categoryId: string | null
  minUnits: number
  maxUnits: number
  supplierId: string | null
  supplierRef: string
  packSize: number
  minOrderPacks: number
  orderMultiplePacks: number
  conso: number[] // 7 jours (0=lundi)
}

export interface SupplierInput {
  id?: string
  siteId: string
  name: string
  phone: string
  orderDays: number[]
  cutoff: string // 'HH:MM'
  leadDays: number
  leadKind: 'calendar' | 'business'
  noWeekendDelivery: boolean
}

export interface CategoryInput {
  id?: string
  siteId: string
  name: string
  position: number
}

export interface AdminService {
  saveProduct(p: ProductInput): Promise<void>
  setProductFavorite(id: string, isFavorite: boolean): Promise<void>
  deleteProduct(id: string): Promise<void>
  saveSupplier(s: SupplierInput): Promise<void>
  deleteSupplier(id: string): Promise<void>
  saveCategory(c: CategoryInput): Promise<void>
  deleteCategory(id: string): Promise<void>
  savePrepa(prepa: PrepaInput): Promise<void>
  deletePrepa(id: string): Promise<void>
  saveSettings(settings: AppSettings): Promise<void>
}

export interface StockService {
  /** solde théorique par produit (product_id -> unités) */
  balances(): Promise<Record<string, number>>
  /**
   * Enregistre une sortie groupée (unité / prépa / lot).
   * @param batchId  clé d'idempotence (générée côté client)
   * @param force    forcer un stock négatif (responsable uniquement)
   */
  recordExit(
    batchId: string,
    lines: ExitLine[],
    note?: string,
    force?: boolean,
    templateId?: string | null,
  ): Promise<void>
  listExitHistory(limit?: number): Promise<ExitHistoryEntry[]>
  /** Réception : seul l'accepté entre en stock. Idempotent via idempotencyKey. */
  recordReception(
    idempotencyKey: string,
    supplierId: string,
    orderId: string | null,
    lines: ReceptionLine[],
  ): Promise<void>
  /** Inventaire : recale le stock au réel compté (corrections tracées). */
  recordInventory(
    kind: 'initial' | 'full' | 'partial',
    lines: { productId: string; countedUnits: number }[],
  ): Promise<void>
}

/* ---------------- Inventaire collaboratif (session + temps réel) --------------- */

export interface CountLine {
  productId: string
  countedUnits: number
  theoreticalUnits: number | null
  validatedBy: string | null
  validatedAt: string | null
}

/** Un inventaire passé (clôturé), pour l'historique. */
export interface InventoryRecord {
  id: string
  validatedAt: string | null
  validatedBy: string | null
}

export interface InventoryService {
  /** ouvre (ou récupère) la session d'inventaire en cours ; renvoie son id */
  open(): Promise<string>
  listLines(countId: string): Promise<CountLine[]>
  validateLine(countId: string, productId: string, countedUnits: number): Promise<void>
  /** clôture (responsable) : applique les corrections */
  finish(countId: string): Promise<void>
  /** id utilisateur -> nom (pour afficher « validé par ») */
  members(): Promise<Record<string, string>>
  /** synchro temps réel : rappelle onChange à chaque validation ; renvoie un désabonnement */
  subscribe(countId: string, onChange: () => void): () => void
  /** inventaires passés (clôturés), du plus récent au plus ancien */
  listPast(): Promise<InventoryRecord[]>
}

export interface DataServices {
  source: 'mock' | 'supabase'
  catalog: CatalogService
  stock: StockService
  admin: AdminService
  inventory: InventoryService
  orders: OrderService
}
