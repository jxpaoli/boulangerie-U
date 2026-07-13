interface OrderCycleRecord {
  supplierId: string
  coverFrom: string | null
  status: string
}

/** Indique si le fournisseur a déjà été commandé pour cette prochaine livraison. */
export function hasPlacedOrderForCycle(
  orders: OrderCycleRecord[],
  supplierId: string,
  coverFrom: string,
): boolean {
  return orders.some(
    (order) =>
      order.supplierId === supplierId &&
      order.coverFrom === coverFrom &&
      order.status !== 'cancelled',
  )
}

export function dailyOrderSummary(total: number, passed: number): string {
  if (total <= 0) return 'Aucune commande prévue'
  const safePassed = Math.min(total, Math.max(0, passed))
  const remaining = total - safePassed
  if (remaining === 0) return 'Toutes les commandes sont passées ✓'
  if (safePassed === 0)
    return `${remaining} commande${remaining > 1 ? 's' : ''} à passer`
  return `${remaining} à passer · ${safePassed} passée${safePassed > 1 ? 's' : ''}`
}
