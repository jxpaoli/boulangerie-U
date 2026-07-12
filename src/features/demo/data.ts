/**
 * Jeu de données de démonstration TEMPORAIRE (mémoire), pour afficher l'UI avant
 * le branchement Supabase. Sera remplacé par le service de données réel + seed.sql.
 * Voir docs/ARCHITECTURE.md (couche services, bascule mock/réel).
 */

export interface DemoSupplier {
  id: string
  name: string
  phone: string
  orderDays: number[] // 0=lundi
  deliveryLabel: string
  dueToday: boolean
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
  },
  {
    id: 's-davigel',
    name: 'Davigel',
    phone: '04 95 22 15 00',
    orderDays: [0, 2, 4],
    deliveryLabel: 'Lun · Mer · Ven',
    dueToday: true,
  },
  {
    id: 's-bridor',
    name: 'Bridor',
    phone: '04 95 33 80 12',
    orderDays: [1, 3],
    deliveryLabel: 'Mar · Jeu',
    dueToday: false,
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
    stockUnits: 14,
    minUnits: 24,
    maxUnits: 48,
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
    stockUnits: 9,
    minUnits: 15,
    maxUnits: 45,
    conso: [3, 3, 4, 5, 8, 10, 7],
  },
]

export function supplierOf(p: DemoProduct): DemoSupplier {
  return demoSuppliers.find((s) => s.id === p.supplierId) ?? demoSuppliers[0]!
}
