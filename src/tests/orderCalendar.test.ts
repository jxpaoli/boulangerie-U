import { describe, it, expect } from 'vitest'
import {
  addDays,
  weekday,
  nextOrderDate,
  deliveryDateFor,
  supplierPlan,
  type SupplierCalendar,
  type Civil,
} from '@/lib/orderCalendar'

// Repères (juillet 2026, CEST = UTC+2) :
// 06 lundi · 07 mardi · 08 mercredi · 09 jeudi · 10 vendredi · 11 samedi · 12 dimanche · 13 lundi
const c = (y: number, m: number, d: number): Civil => ({ y, m, d })
const at = (iso: string) => new Date(iso) // ex. '2026-07-10T09:00:00+02:00'

describe('primitives dates', () => {
  it('weekday: 0=lundi … 6=dimanche', () => {
    expect(weekday(c(2026, 7, 6))).toBe(0) // lundi
    expect(weekday(c(2026, 7, 10))).toBe(4) // vendredi
    expect(weekday(c(2026, 7, 12))).toBe(6) // dimanche
  })
  it('addDays traverse les mois', () => {
    expect(addDays(c(2026, 7, 30), 3)).toEqual(c(2026, 8, 2))
  })
})

/* ----- Scénario 9 — Fournisseur A : quotidien lun-ven, livraison J+1, pas le week-end ----- */
const A: SupplierCalendar = {
  orderDays: [0, 1, 2, 3, 4],
  cutoff: '11:00',
  delivery: { mode: 'lead', leadDays: 1, leadKind: 'calendar', noWeekendDelivery: true },
}

describe('Fournisseur A (quotidien, J+1, report week-end)', () => {
  it('commande lundi -> livraison mardi', () => {
    expect(deliveryDateFor(A, c(2026, 7, 6))).toEqual(c(2026, 7, 7))
  })
  it('commande vendredi -> livraison lundi (report du week-end)', () => {
    expect(deliveryDateFor(A, c(2026, 7, 10))).toEqual(c(2026, 7, 13))
  })
  it('avant l’heure limite : commande possible aujourd’hui', () => {
    expect(nextOrderDate(A, at('2026-07-10T09:00:00+02:00'))).toEqual(c(2026, 7, 10))
  })
  it('après l’heure limite : reporté au prochain jour de commande', () => {
    // vendredi 12:00 > 11:00 -> pas de commande vendredi, ni sam/dim -> lundi
    expect(nextOrderDate(A, at('2026-07-10T12:00:00+02:00'))).toEqual(c(2026, 7, 13))
  })
  it('samedi : prochaine commande lundi', () => {
    expect(nextOrderDate(A, at('2026-07-11T09:00:00+02:00'))).toEqual(c(2026, 7, 13))
  })
  it('plan complet un vendredi : livraison lundi, couverture jusqu’à mardi', () => {
    const p = supplierPlan(A, at('2026-07-10T09:00:00+02:00'))
    expect(p.nextOrder).toEqual(c(2026, 7, 10))
    expect(p.d1).toEqual(c(2026, 7, 13)) // livraison lundi
    expect(p.c2).toEqual(c(2026, 7, 13)) // prochaine commande lundi
    expect(p.d2).toEqual(c(2026, 7, 14)) // livraison mardi
  })
})

/* ----- Scénario 10 — Fournisseur B : commande jeudi, livraison vendredi semaine suivante ----- */
const B: SupplierCalendar = {
  orderDays: [3],
  cutoff: '12:00',
  delivery: { mode: 'mapping', map: [{ orderDay: 3, deliveryDay: 4, weeksAhead: 1 }] },
}

describe('Fournisseur B (jeudi -> vendredi semaine suivante = 8 jours)', () => {
  it('commande jeudi -> livraison vendredi suivant', () => {
    expect(deliveryDateFor(B, c(2026, 7, 9))).toEqual(c(2026, 7, 17))
  })
  it('un lundi, prochaine commande = jeudi', () => {
    expect(nextOrderDate(B, at('2026-07-06T09:00:00+02:00'))).toEqual(c(2026, 7, 9))
  })
  it('couverture : de la livraison jusqu’à la livraison de la commande suivante', () => {
    const p = supplierPlan(B, at('2026-07-09T09:00:00+02:00'))
    expect(p.nextOrder).toEqual(c(2026, 7, 9))
    expect(p.d1).toEqual(c(2026, 7, 17)) // vendredi semaine +1
    expect(p.c2).toEqual(c(2026, 7, 16)) // jeudi suivant
    expect(p.d2).toEqual(c(2026, 7, 24)) // vendredi encore d'après
  })
})

/* ----- Scénario 11 — Fournisseur C : commande lundi & jeudi, +4 jours (calendaires vs ouvrés) ----- */
const Ccal: SupplierCalendar = {
  orderDays: [0, 3],
  cutoff: '10:00',
  delivery: { mode: 'lead', leadDays: 4, leadKind: 'calendar' },
}
const Cbiz: SupplierCalendar = {
  orderDays: [0, 3],
  cutoff: '10:00',
  delivery: { mode: 'lead', leadDays: 4, leadKind: 'business' },
}

describe('Fournisseur C (lundi/jeudi, +4 jours)', () => {
  it('jours calendaires : lundi -> vendredi', () => {
    expect(deliveryDateFor(Ccal, c(2026, 7, 6))).toEqual(c(2026, 7, 10))
  })
  it('jours calendaires : jeudi -> lundi', () => {
    expect(deliveryDateFor(Ccal, c(2026, 7, 9))).toEqual(c(2026, 7, 13))
  })
  it('jours ouvrés : jeudi -> mercredi suivant (saute le week-end)', () => {
    // jeudi +4 ouvrés : ven, lun, mar, mer
    expect(deliveryDateFor(Cbiz, c(2026, 7, 9))).toEqual(c(2026, 7, 15))
  })
  it('jours ouvrés : lundi -> vendredi', () => {
    expect(deliveryDateFor(Cbiz, c(2026, 7, 6))).toEqual(c(2026, 7, 10))
  })
})
