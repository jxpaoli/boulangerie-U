import { describe, it, expect } from 'vitest'
import { roundUpToPacks, sumConsumption, computeOrderProposal } from '@/lib/orderProposal'
import { coverageEnd, type SupplierCalendar, type Civil } from '@/lib/orderCalendar'

const c = (y: number, m: number, d: number): Civil => ({ y, m, d })
const at = (iso: string) => new Date(iso)
const flat = (n: number) => [n, n, n, n, n, n, n]

describe('roundUpToPacks (arrondi conditionnement)', () => {
  it('scénario 7 CCTP : besoin 74, carton de 60 -> 2 cartons', () => {
    expect(roundUpToPacks(74, 60)).toBe(2)
  })
  it('besoin nul -> 0 carton', () => {
    expect(roundUpToPacks(0, 60)).toBe(0)
  })
  it('respecte la quantité minimale', () => {
    expect(roundUpToPacks(10, 24, 2)).toBe(2) // 1 carton suffit mais mini = 2
  })
  it('respecte le multiple obligatoire', () => {
    expect(roundUpToPacks(50, 24, 0, 2)).toBe(4) // ceil(50/24)=3 -> arrondi au multiple de 2 = 4
  })
})

describe('sumConsumption', () => {
  it('somme les jours de [from, to)', () => {
    // 10/11/12 juillet = 3 jours
    expect(sumConsumption(flat(10), c(2026, 7, 10), c(2026, 7, 13))).toBe(30)
  })
  it('renvoie 0 si l’intervalle est vide ou inversé', () => {
    expect(sumConsumption(flat(10), c(2026, 7, 13), c(2026, 7, 13))).toBe(0)
    expect(sumConsumption(flat(10), c(2026, 7, 14), c(2026, 7, 13))).toBe(0)
  })
  it('tient compte du jour de semaine', () => {
    // conso plus forte le week-end (sam=5, dim=6)
    const conso = [12, 12, 15, 18, 30, 40, 25]
    // sam 11 + dim 12 juillet
    expect(sumConsumption(conso, c(2026, 7, 11), c(2026, 7, 13))).toBe(40 + 25)
  })
})

describe('computeOrderProposal', () => {
  const now = c(2026, 7, 10)
  const d1 = c(2026, 7, 13)
  const cov = c(2026, 7, 16) // 13,14,15 = 3 jours de couverture

  it('stock suffisant -> rien à commander', () => {
    const p = computeOrderProposal(
      { stockUnits: 100, conso7: flat(10), packSize: 24 },
      now,
      d1,
      cov,
    )
    expect(p.consoBeforeD1).toBe(30) // 10,11,12
    expect(p.projectedBeforeD1).toBe(70)
    expect(p.besoinCible).toBe(30)
    expect(p.packs).toBe(0)
    expect(p.ruptureBeforeDelivery).toBe(false)
  })

  it('stock faible -> commande + alerte rupture avant livraison', () => {
    const p = computeOrderProposal({ stockUnits: 20, conso7: flat(10), packSize: 24 }, now, d1, cov)
    expect(p.projectedBeforeD1).toBe(-10) // 20 - 30
    expect(p.ruptureBeforeDelivery).toBe(true)
    expect(p.brutUnits).toBe(40) // besoin 30 - projeté(-10)
    expect(p.packs).toBe(2) // ceil(40/24)
    expect(p.units).toBe(48)
    expect(p.capped).toBe(false)
  })

  it('plafond congélo -> commande plafonnée', () => {
    const p = computeOrderProposal(
      { stockUnits: 20, conso7: flat(10), packSize: 24, maxStockUnits: 40 },
      now,
      d1,
      cov,
    )
    // projeté -10 -> room = 40, maxPacks = floor(40/24) = 1 ; besoin = 2 -> plafonné à 1
    expect(p.maxPacksByCapacity).toBe(1)
    expect(p.packs).toBe(1)
    expect(p.capped).toBe(true)
  })
})

describe('coverageEnd (marge +1 livraison)', () => {
  // Fournisseur quotidien lun-ven, J+1, report week-end
  const A: SupplierCalendar = {
    orderDays: [0, 1, 2, 3, 4],
    cutoff: '11:00',
    delivery: { mode: 'lead', leadDays: 1, leadKind: 'calendar', noWeekendDelivery: true },
  }
  const friday = at('2026-07-10T09:00:00+02:00')

  it('sans marge : couvre jusqu’à la prochaine livraison (D2)', () => {
    expect(coverageEnd(A, friday, 0)).toEqual(c(2026, 7, 14)) // mardi
  })
  it('+1 livraison : couvre jusqu’à la livraison d’après (D3)', () => {
    expect(coverageEnd(A, friday, 1)).toEqual(c(2026, 7, 15)) // mercredi
  })
})
