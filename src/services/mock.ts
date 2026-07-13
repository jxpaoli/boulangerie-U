/**
 * Implémentation MOCK des services — adossée au jeu de démo.
 * Solde de stock en mémoire (mutable) : cohérent entre écrans pendant la session.
 */
import {
  demoProducts,
  demoSuppliers,
  demoPrepas,
  FAMILY_ORDER,
} from '@/features/demo/data'
import type {
  DataServices,
  Product,
  Supplier,
  Prepa,
  ExitLine,
  ReceptionLine,
  Category,
} from '@/services/types'

function familyPosition(name: string): number {
  const i = (FAMILY_ORDER as readonly string[]).indexOf(name)
  return i < 0 ? 99 : i
}

// solde en mémoire, initialisé depuis la démo
const balances: Record<string, number> = Object.fromEntries(
  demoProducts.map((p) => [p.id, p.stockUnits]),
)
// idempotence : lots déjà enregistrés
const seenBatches = new Set<string>()

function toProduct(p: (typeof demoProducts)[number]): Product {
  return {
    id: p.id,
    name: p.name,
    category: p.category,
    categoryId: p.category, // en mock, l'id de famille = le nom
    categoryPosition: familyPosition(p.category),
    supplierId: p.supplierId,
    ref: p.ref,
    location: p.location,
    packSize: p.packSize,
    packLabel: p.packLabel,
    stockUnits: balances[p.id] ?? 0,
    minUnits: p.minUnits,
    maxUnits: p.maxUnits,
    conso: p.conso,
  }
}

export const mockServices: DataServices = {
  source: 'mock',
  catalog: {
    async listProducts(): Promise<Product[]> {
      return demoProducts.map(toProduct)
    },
    async listSuppliers(): Promise<Supplier[]> {
      return demoSuppliers.map((s) => ({ ...s }) as Supplier)
    },
    async listPrepas(): Promise<Prepa[]> {
      return demoPrepas.map((p) => ({ ...p, lines: p.lines.map((l) => ({ ...l })) }))
    },
    async listCategories(): Promise<Category[]> {
      const present = new Set(demoProducts.map((p) => p.category))
      return (FAMILY_ORDER as readonly string[])
        .filter((f) => present.has(f))
        .map((name) => ({ id: name, name, position: familyPosition(name) }))
    },
  },
  stock: {
    async balances(): Promise<Record<string, number>> {
      return { ...balances }
    },
    async recordExit(batchId: string, lines: ExitLine[], _note?: string, force = false): Promise<void> {
      if (seenBatches.has(batchId)) return // idempotent
      const short = lines.filter((l) => l.units > (balances[l.productId] ?? 0))
      if (short.length > 0 && !force) {
        throw new Error('Stock insuffisant')
      }
      for (const l of lines) balances[l.productId] = (balances[l.productId] ?? 0) - l.units
      seenBatches.add(batchId)
    },
    async recordReception(
      idempotencyKey: string,
      _supplierId: string,
      _orderId: string | null,
      lines: ReceptionLine[],
    ): Promise<void> {
      if (seenBatches.has(idempotencyKey)) return
      for (const l of lines) {
        if (l.acceptedUnits > 0) balances[l.productId] = (balances[l.productId] ?? 0) + l.acceptedUnits
      }
      seenBatches.add(idempotencyKey)
    },
    async recordInventory(_kind, lines): Promise<void> {
      for (const l of lines) balances[l.productId] = Math.max(0, l.countedUnits)
    },
  },

  // En démo, l'administration ne persiste pas (l'admin réel est sur Supabase).
  admin: {
    async saveProduct() {},
    async deleteProduct() {},
    async saveSupplier() {},
    async deleteSupplier() {},
    async saveCategory() {},
    async deleteCategory() {},
  },
}
