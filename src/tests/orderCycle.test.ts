import { describe, expect, it } from 'vitest'
import { hasPlacedOrderForCycle } from '@/lib/orderCycle'

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
