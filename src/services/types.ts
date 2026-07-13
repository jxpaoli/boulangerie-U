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
  categoryPosition: number
  supplierId: string
  ref: string
  location: string
  packSize: number
  packLabel: string
  stockUnits: number
  minUnits: number
  maxUnits: number
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

export interface CatalogService {
  listProducts(): Promise<Product[]>
  listSuppliers(): Promise<Supplier[]>
  listPrepas(): Promise<Prepa[]>
}

export interface StockService {
  /** solde théorique par produit (product_id -> unités) */
  balances(): Promise<Record<string, number>>
  /**
   * Enregistre une sortie groupée (unité / prépa / lot).
   * @param batchId  clé d'idempotence (générée côté client)
   * @param force    forcer un stock négatif (responsable uniquement)
   */
  recordExit(batchId: string, lines: ExitLine[], note?: string, force?: boolean): Promise<void>
  /** Réception : seul l'accepté entre en stock. Idempotent via idempotencyKey. */
  recordReception(
    idempotencyKey: string,
    supplierId: string,
    orderId: string | null,
    lines: ReceptionLine[],
  ): Promise<void>
}

export interface DataServices {
  source: 'mock' | 'supabase'
  catalog: CatalogService
  stock: StockService
}
