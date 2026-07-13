import { describe, expect, it } from 'vitest'
import { dailyOrderSummary, hasPlacedOrderForCycle } from '@/lib/orderCycle'

const orders = [
  { supplierId: 'supplier-a', coverFrom: '2026-07-15', status: 'ordered' },
  { supplierId: 'supplier-b', coverFrom: '2026-07-15', status: 'received' },
  { supplierId: 'supplier-c', coverFrom: '2026-07-15', status: 'cancelled' },
]

describe('hasPlacedOrderForCycle', () => {
  it('masque une commande déjà passée pour la même livraison', () => {
    expect(hasPlacedOrderForCycle(orders, 'supplier-a', '2026-07-15')).toBe(true)
  })

  it('reste masquée après sa réception', () => {
    expect(hasPlacedOrderForCycle(orders, 'supplier-b', '2026-07-15')).toBe(true)
  })

  it('réaffiche une commande annulée', () => {
    expect(hasPlacedOrderForCycle(orders, 'supplier-c', '2026-07-15')).toBe(false)
  })

  it('ne masque pas le prochain cycle de livraison', () => {
    expect(hasPlacedOrderForCycle(orders, 'supplier-a', '2026-07-22')).toBe(false)
  })
})

describe('dailyOrderSummary', () => {
  it('reste très court à chaque étape de la journée', () => {
    expect(dailyOrderSummary(2, 0)).toBe('2 commandes à passer')
    expect(dailyOrderSummary(2, 1)).toBe('1 à passer · 1 passée')
    expect(dailyOrderSummary(2, 2)).toBe('Toutes les commandes sont passées ✓')
  })

  it('distingue une journée sans commande prévue', () => {
    expect(dailyOrderSummary(0, 0)).toBe('Aucune commande prévue')
  })
})
