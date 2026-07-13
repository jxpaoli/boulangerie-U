/**
 * Implémentation MOCK des services — adossée au jeu de démo.
 * Solde de stock en mémoire (mutable) : cohérent entre écrans pendant la session.
 */
import {
  demoProducts,
  demoSuppliers,
  demoPrepas,
  FAMILY_ORDER,
  demoDeliveries,
} from '@/features/demo/data'
import type {
  DataServices,
  Product,
  Supplier,
  Prepa,
  ExitLine,
  ReceptionLine,
  Category,
  CountLine,
  PurchaseOrder,
  PlaceOrderInput,
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
const mockFavorites = new Set(
  [...demoProducts]
    .sort((a, b) => b.conso.reduce((sum, n) => sum + n, 0) - a.conso.reduce((sum, n) => sum + n, 0))
    .slice(0, 8)
    .map((product) => product.id),
)
const mockOrders: PurchaseOrder[] = demoDeliveries.map((d, index) => ({
  id: d.id,
  supplierId: d.supplierId,
  supplierName: demoSuppliers.find((s) => s.id === d.supplierId)?.name ?? 'Fournisseur',
  status: 'ordered',
  coverFrom: null,
  coverUntil: null,
  channel: 'phone',
  orderedAt: new Date(Date.now() - (index + 1) * 86_400_000).toISOString(),
  orderedBy: 'u-sabrina',
  orderedByName: 'Sabrina',
  lines: d.lines.map((l) => ({
    productId: l.productId,
    packSize: demoProducts.find((p) => p.id === l.productId)?.packSize ?? 1,
    proposedPacks: 0,
    checkedPacks: null,
    finalPacks: Math.round(
      l.orderedUnits / (demoProducts.find((p) => p.id === l.productId)?.packSize ?? 1),
    ),
    visualCheck: null,
    note: '',
  })),
}))

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
    isFavorite: mockFavorites.has(p.id),
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
  orders: {
    async place(input: PlaceOrderInput): Promise<string> {
      const existing = mockOrders.find((o) => o.id === input.idempotencyKey)
      if (existing) return existing.id
      const id = input.idempotencyKey
      mockOrders.unshift({
        id,
        supplierId: input.supplierId,
        supplierName: demoSuppliers.find((s) => s.id === input.supplierId)?.name ?? 'Fournisseur',
        status: 'ordered',
        coverFrom: input.coverFrom,
        coverUntil: input.coverUntil,
        channel: input.channel,
        orderedAt: new Date().toISOString(),
        orderedBy: 'u-sabrina',
        orderedByName: 'Sabrina',
        lines: input.lines.map((line) => ({
          ...line,
          packSize: demoProducts.find((p) => p.id === line.productId)?.packSize ?? 1,
        })),
      })
      return id
    },
    async listPendingReception() {
      return mockOrders.filter((o) => o.status === 'ordered').map((o) => structuredClone(o))
    },
    async listHistory(limit = 100) {
      return mockOrders.slice(0, limit).map((o) => structuredClone(o))
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
      if (_orderId) {
        const order = mockOrders.find((o) => o.id === _orderId)
        if (order) order.status = 'received'
      }
    },
    async recordInventory(_kind, lines): Promise<void> {
      for (const l of lines) balances[l.productId] = Math.max(0, l.countedUnits)
    },
  },

  // En démo, l'administration ne persiste pas (l'admin réel est sur Supabase).
  admin: {
    async saveProduct() {},
    async setProductFavorite(id, isFavorite) {
      if (isFavorite) mockFavorites.add(id)
      else mockFavorites.delete(id)
    },
    async deleteProduct() {},
    async saveSupplier() {},
    async deleteSupplier() {},
    async saveCategory() {},
    async deleteCategory() {},
  },

  inventory: {
    async open() {
      return 'mock-count'
    },
    async listLines(): Promise<CountLine[]> {
      return Object.entries(invLines).map(([productId, l]) => ({ productId, ...l }))
    },
    async validateLine(_countId, productId, countedUnits) {
      invLines[productId] = {
        countedUnits,
        theoreticalUnits: balances[productId] ?? 0,
        validatedBy: 'u-sabrina',
        validatedAt: new Date().toISOString(),
      }
    },
    async finish() {
      for (const [productId, l] of Object.entries(invLines)) {
        balances[productId] = Math.max(0, l.countedUnits)
      }
      for (const k of Object.keys(invLines)) delete invLines[k]
    },
    async members() {
      return { 'u-sabrina': 'Sabrina', 'u-léa': 'Léa' }
    },
    subscribe() {
      return () => {}
    },
    async listPast() {
      return []
    },
  },
}

const invLines: Record<
  string,
  { countedUnits: number; theoreticalUnits: number; validatedBy: string; validatedAt: string }
> = {}
