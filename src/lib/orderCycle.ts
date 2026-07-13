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
