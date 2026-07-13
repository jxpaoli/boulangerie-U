/**
 * Jeu de données de démonstration TEMPORAIRE (mémoire), pour afficher l'UI avant
 * le branchement Supabase. Sera remplacé par le service de données réel + seed.sql.
 * Voir docs/ARCHITECTURE.md (couche services, bascule mock/réel).
 */

import type { SupplierCalendar } from '@/lib/orderCalendar'

export interface DemoSupplier {
  id: string
  name: string
  phone: string
  orderDays: number[] // 0=lundi
  deliveryLabel: string
  dueToday: boolean
  calendar: SupplierCalendar
}

export interface DemoProduct {
  id: string
  name: string
  category: string
  supplierId: string
  ref: string
  location: string
  packSize: number
  packLabel: string
  stockUnits: number
  minUnits: number
  maxUnits: number
  /** conso par jour de semaine (0=lundi) */
  conso: [number, number, number, number, number, number, number]
}

export const demoSuppliers: DemoSupplier[] = [
  {
    id: 's-metro',
    name: 'Metro',
    phone: '04 95 10 40 00',
    orderDays: [0, 1, 2, 3, 4],
    deliveryLabel: 'Lun · Mar · Mer · Jeu · Ven',
    dueToday: true,
    calendar: {
      orderDays: [0, 1, 2, 3, 4],
      cutoff: '11:00',
      delivery: { mode: 'lead', leadDays: 1, leadKind: 'calendar', noWeekendDelivery: true },
    },
  },
  {
    id: 's-davigel',
    name: 'Davigel',
    phone: '04 95 22 15 00',
    orderDays: [0, 2, 4],
    deliveryLabel: 'Lun · Mer · Ven',
    dueToday: true,
    calendar: {
      orderDays: [0, 2, 4],
      cutoff: '10:00',
      delivery: { mode: 'lead', leadDays: 1, leadKind: 'calendar', noWeekendDelivery: true },
    },
  },
  {
    id: 's-bridor',
    name: 'Bridor',
    phone: '04 95 33 80 12',
    orderDays: [1, 3],
    deliveryLabel: 'Mar · Jeu',
    dueToday: false,
    calendar: {
      orderDays: [1, 3],
      cutoff: '12:00',
      delivery: { mode: 'lead', leadDays: 2, leadKind: 'business' },
    },
  },
]

export const demoProducts: DemoProduct[] = [
  {
    id: 'p-baguette',
    name: 'Baguette précuite 55 cm',
    category: 'Baguettes',
    supplierId: 's-metro',
    ref: '784512',
    location: 'Congélateur',
    packSize: 24,
    packLabel: 'carton',
    stockUnits: 100,
    minUnits: 24,
    maxUnits: 144,
    conso: [12, 12, 15, 18, 30, 40, 25],
  },
  {
    id: 'p-cereales',
    name: 'Pain céréales précuit',
    category: 'Pains',
    supplierId: 's-metro',
    ref: '784530',
    location: 'Congélateur',
    packSize: 20,
    packLabel: 'carton',
    stockUnits: 46,
    minUnits: 20,
    maxUnits: 80,
    conso: [8, 8, 9, 10, 14, 10, 6],
  },
  {
    id: 'p-pizza',
    name: 'Pizza margherita indiv.',
    category: 'Produits salés',
    supplierId: 's-davigel',
    ref: '640021',
    location: 'Congélateur',
    packSize: 6,
    packLabel: 'carton',
    stockUnits: 5,
    minUnits: 12,
    maxUnits: 30,
    conso: [4, 4, 5, 6, 10, 12, 8],
  },
  {
    id: 'p-croissant',
    name: 'Croissant cru surgelé',
    category: 'Viennoiseries',
    supplierId: 's-bridor',
    ref: 'CR120',
    location: 'Congélateur',
    packSize: 120,
    packLabel: 'carton',
    stockUnits: 210,
    minUnits: 120,
    maxUnits: 480,
    conso: [40, 40, 45, 50, 70, 90, 60],
  },
  {
    id: 'p-quiche',
    name: 'Quiche lorraine 12 cm',
    category: 'Produits salés',
    supplierId: 's-davigel',
    ref: '640088',
    location: 'Congélateur',
    packSize: 15,
    packLabel: 'carton',
    stockUnits: 28,
    minUnits: 15,
    maxUnits: 45,
    conso: [3, 3, 4, 5, 8, 10, 7],
  },
]

export function supplierOf(p: DemoProduct): DemoSupplier {
  return demoSuppliers.find((s) => s.id === p.supplierId) ?? demoSuppliers[0]!
}

export function productsOfSupplier(supplierId: string): DemoProduct[] {
  return demoProducts.filter((p) => p.supplierId === supplierId)
}

/** « Maintenant » figé pour la démo : vendredi 10 juillet 2026, 08:00 (Europe/Paris). */
export const DEMO_NOW = new Date('2026-07-10T08:00:00+02:00')

/** Livraisons attendues (commandes déjà passées, à réceptionner). */
export interface DemoDeliveryLine {
  productId: string
  orderedUnits: number
}
export interface DemoDelivery {
  id: string
  supplierId: string
  orderedAtLabel: string
  expectedLabel: string
  lines: DemoDeliveryLine[]
}

export const demoDeliveries: DemoDelivery[] = [
  {
    id: 'del-metro',
    supplierId: 's-metro',
    orderedAtLabel: 'commandé hier',
    expectedLabel: "attendue aujourd'hui",
    lines: [
      { productId: 'p-baguette', orderedUnits: 48 },
      { productId: 'p-cereales', orderedUnits: 40 },
    ],
  },
  {
    id: 'del-bridor',
    supplierId: 's-bridor',
    orderedAtLabel: 'commandé mardi',
    expectedLabel: "attendue aujourd'hui",
    lines: [{ productId: 'p-croissant', orderedUnits: 360 }],
  },
]

/**
 * Préparation = sortie groupée de produits (four OU décongélation, peu importe).
 * Souvent récurrente (« prépa du matin »). Le modèle propose des quantités, ajustables.
 * Voir docs/BUSINESS_RULES.md §12bis.
 */
export interface DemoPrepaLine {
  productId: string
  units: number
}
export interface DemoPrepa {
  id: string
  name: string
  time: string
  lines: DemoPrepaLine[]
}

export const demoPrepas: DemoPrepa[] = [
  {
    id: 'prep-matin',
    name: 'Prépa du matin',
    time: '06:30',
    lines: [
      { productId: 'p-baguette', units: 48 },
      { productId: 'p-croissant', units: 120 },
      { productId: 'p-cereales', units: 20 },
    ],
  },
  {
    id: 'prep-midi',
    name: 'Prépa de midi',
    time: '11:00',
    lines: [
      { productId: 'p-pizza', units: 12 },
      { productId: 'p-quiche', units: 15 },
    ],
  },
]

export function productById(id: string): DemoProduct | undefined {
  return demoProducts.find((p) => p.id === id)
}

/** Ordre d'affichage des familles (les inconnues passent après, dans l'ordre rencontré). */
export const FAMILY_ORDER = [
  'Baguettes',
  'Pains',
  'Viennoiseries',
  'Pâtisseries',
  'Tartes',
  'Produits salés',
  'Autres',
] as const

/** Regroupe des produits par famille, en respectant FAMILY_ORDER. */
export function groupByFamily(
  products: DemoProduct[],
): { family: string; items: DemoProduct[] }[] {
  const map = new Map<string, DemoProduct[]>()
  for (const p of products) {
    const arr = map.get(p.category) ?? []
    arr.push(p)
    map.set(p.category, arr)
  }
  const ordered: { family: string; items: DemoProduct[] }[] = []
  for (const fam of FAMILY_ORDER) {
    const items = map.get(fam)
    if (items) {
      ordered.push({ family: fam, items })
      map.delete(fam)
    }
  }
  for (const [family, items] of map) ordered.push({ family, items })
  return ordered
}
