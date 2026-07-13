/**
 * Calcul de la commande proposée pour un produit.
 * Voir docs/BUSINESS_RULES.md §6-7. Tout est transparent (chaque étape est renvoyée).
 *
 * Conso 7 jours : index 0 = lundi … 6 = dimanche.
 */
import { addDays, weekday, compareCivil, type Civil } from '@/lib/orderCalendar'

/** Somme de la conso sur [from, toExclusive) (jours civils). */
export function sumConsumption(conso7: number[], from: Civil, toExclusive: Civil): number {
  if (compareCivil(from, toExclusive) >= 0) return 0
  let total = 0
  let cur = from
  // borne de sécurité : 400 jours max
  for (let i = 0; i < 400 && compareCivil(cur, toExclusive) < 0; i++) {
    total += conso7[weekday(cur)] ?? 0
    cur = addDays(cur, 1)
  }
  return total
}

/** Arrondi d'un besoin en unités vers des conditionnements : ceil, mini, multiple. */
export function roundUpToPacks(
  brutUnits: number,
  packSize: number,
  minOrderPacks = 0,
  orderMultiplePacks = 1,
): number {
  if (brutUnits <= 0 || packSize <= 0) return 0
  let packs = Math.ceil(brutUnits / packSize)
  if (minOrderPacks > 0) packs = Math.max(packs, minOrderPacks)
  const mult = orderMultiplePacks > 0 ? orderMultiplePacks : 1
  packs = Math.ceil(packs / mult) * mult
  return packs
}

export interface ProductOrderConfig {
  stockUnits: number
  conso7: number[]
  packSize: number
  minOrderPacks?: number
  orderMultiplePacks?: number
  /** plafond congélo, en unités (0/undefined = pas de plafond) */
  maxStockUnits?: number
  /** stock de sécurité additionnel, en unités (en plus du filet +1 livraison) */
  safetyStockUnits?: number
  /** réceptions déjà attendues avant D1 (unités) */
  expectedBeforeD1?: number
}

export interface OrderProposal {
  /** conso estimée d'ici la prochaine livraison D1 */
  consoBeforeD1: number
  /** stock projeté juste avant réception à D1 */
  projectedBeforeD1: number
  /** besoin à couvrir entre D1 et la fin de couverture (conso + stock sécu) */
  besoinCible: number
  /** besoin brut à commander, en unités (avant arrondi) */
  brutUnits: number
  /** commande finale, en conditionnements et unités */
  packs: number
  units: number
  /** plafonné par la capacité congélo */
  capped: boolean
  /** conditionnements possibles vu la place (si plafond) */
  maxPacksByCapacity: number | null
  /** risque de rupture AVANT la prochaine livraison */
  ruptureBeforeDelivery: boolean
}

/**
 * @param now    date du calcul (civil)
 * @param d1     date de la prochaine livraison
 * @param coverageEnd fin de la période à couvrir (D2 + marge, cf. coverageEnd())
 */
export function computeOrderProposal(
  cfg: ProductOrderConfig,
  now: Civil,
  d1: Civil,
  coverageEnd: Civil,
): OrderProposal {
  const consoBeforeD1 = sumConsumption(cfg.conso7, now, d1)
  const expected = cfg.expectedBeforeD1 ?? 0
  const projectedBeforeD1 = cfg.stockUnits - consoBeforeD1 + expected

  const consoCoverage = sumConsumption(cfg.conso7, d1, coverageEnd)
  const besoinCible = consoCoverage + (cfg.safetyStockUnits ?? 0)

  const brutUnits = Math.max(0, besoinCible - projectedBeforeD1)

  let packs = roundUpToPacks(
    brutUnits,
    cfg.packSize,
    cfg.minOrderPacks ?? 0,
    cfg.orderMultiplePacks ?? 1,
  )

  // plafond congélo : ne pas dépasser la capacité après réception
  let capped = false
  let maxPacksByCapacity: number | null = null
  if (cfg.maxStockUnits && cfg.maxStockUnits > 0 && cfg.packSize > 0) {
    const room = cfg.maxStockUnits - Math.max(0, projectedBeforeD1)
    maxPacksByCapacity = Math.max(0, Math.floor(room / cfg.packSize))
    if (packs > maxPacksByCapacity) {
      packs = maxPacksByCapacity
      capped = true
    }
  }

  return {
    consoBeforeD1,
    projectedBeforeD1,
    besoinCible,
    brutUnits,
    packs,
    units: packs * cfg.packSize,
    capped,
    maxPacksByCapacity,
    ruptureBeforeDelivery: projectedBeforeD1 < 0,
  }
}
