/**
 * Moteur de dates commande -> livraison (Europe/Paris).
 * Voir docs/BUSINESS_RULES.md §5-6. Version V1 : sans jours fériés/fermetures automatiques.
 *
 * Convention jours de semaine : 0 = lundi … 6 = dimanche (comme la conso 7 jours).
 */
import { TZDate } from '@date-fns/tz'

export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6

/** Date civile (année, mois 1-12, jour) — indépendante de l'heure et du fuseau. */
export interface Civil {
  y: number
  m: number
  d: number
}

export type DeliveryRule =
  | {
      mode: 'lead'
      /** délai en jours */
      leadDays: number
      /** calendaires (défaut) ou ouvrés (lun-ven) */
      leadKind?: 'calendar' | 'business'
      /** pas de livraison le week-end -> report au lundi */
      noWeekendDelivery?: boolean
    }
  | {
      mode: 'mapping'
      /** correspondance explicite jour de commande -> jour de livraison */
      map: { orderDay: Weekday; deliveryDay: Weekday; weeksAhead: number }[]
    }

export interface SupplierCalendar {
  /** jours où l'on peut passer commande (0=lundi) */
  orderDays: Weekday[]
  /** heure limite de commande, 'HH:MM' en Europe/Paris */
  cutoff: string
  delivery: DeliveryRule
}

export interface SupplierPlan {
  /** prochaine date de commande possible */
  nextOrder: Civil
  /** heure limite ce jour-là */
  cutoff: string
  /** livraison de la commande d'aujourd'hui (D1) */
  d1: Civil
  /** prochaine commande possible après nextOrder (C2) */
  c2: Civil
  /** livraison liée à C2 (D2) — borne de la période à couvrir */
  d2: Civil
}

const PARIS = 'Europe/Paris'

/* ------------------------------ dates civiles ------------------------------ */

/** Midi UTC de la date civile : évite les bascules d'heure d'été. */
function civilToUtcNoon(c: Civil): Date {
  return new Date(Date.UTC(c.y, c.m - 1, c.d, 12, 0, 0))
}

function fromUtc(dt: Date): Civil {
  return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate() }
}

/** Jour de la semaine, 0=lundi … 6=dimanche. */
export function weekday(c: Civil): Weekday {
  const jsDay = civilToUtcNoon(c).getUTCDay() // 0=dimanche
  return (((jsDay + 6) % 7) as Weekday)
}

export function addDays(c: Civil, n: number): Civil {
  const dt = civilToUtcNoon(c)
  dt.setUTCDate(dt.getUTCDate() + n)
  return fromUtc(dt)
}

function isWeekend(c: Civil): boolean {
  const w = weekday(c)
  return w === 5 || w === 6 // samedi, dimanche
}

/** Ajoute n jours ouvrés (lun-ven). */
function addBusinessDays(c: Civil, n: number): Civil {
  let cur = c
  let left = n
  while (left > 0) {
    cur = addDays(cur, 1)
    if (!isWeekend(cur)) left--
  }
  return cur
}

/** Reporte au prochain jour ouvré si on tombe un week-end. */
function nextBusinessDay(c: Civil): Civil {
  let cur = c
  while (isWeekend(cur)) cur = addDays(cur, 1)
  return cur
}

export function civilEquals(a: Civil, b: Civil): boolean {
  return a.y === b.y && a.m === b.m && a.d === b.d
}

export function compareCivil(a: Civil, b: Civil): number {
  return civilToUtcNoon(a).getTime() - civilToUtcNoon(b).getTime()
}

/** Date JS (midi UTC) pour formatage via Intl Europe/Paris. */
export function civilToDate(c: Civil): Date {
  return civilToUtcNoon(c)
}

/* --------------------------------- moteur ---------------------------------- */

/** Date + heure « maintenant » exprimées en Europe/Paris. */
function parisNow(now: Date): { civil: Civil; minutes: number } {
  const p = new TZDate(now.getTime(), PARIS)
  return {
    civil: { y: p.getFullYear(), m: p.getMonth() + 1, d: p.getDate() },
    minutes: p.getHours() * 60 + p.getMinutes(),
  }
}

function parseHM(hm: string): number {
  const [h, m] = hm.split(':').map((x) => parseInt(x, 10))
  return (h ?? 0) * 60 + (m ?? 0)
}

/**
 * Prochaine date de commande possible à partir de `now`.
 * Aujourd'hui ne compte que si l'heure limite n'est pas dépassée.
 */
export function nextOrderDate(cal: SupplierCalendar, now: Date): Civil {
  const { civil: today, minutes } = parisNow(now)
  const cutoffMin = parseHM(cal.cutoff)
  for (let offset = 0; offset < 14; offset++) {
    const cand = addDays(today, offset)
    if (!cal.orderDays.includes(weekday(cand))) continue
    if (offset === 0 && minutes > cutoffMin) continue // heure limite passée
    return cand
  }
  // aucun jour de commande trouvé (paramétrage vide) : renvoie today par défaut
  return today
}

/** Date de livraison pour une commande passée le `orderDate`. */
export function deliveryDateFor(cal: SupplierCalendar, orderDate: Civil): Civil {
  const rule = cal.delivery
  if (rule.mode === 'lead') {
    let deliv =
      rule.leadKind === 'business'
        ? addBusinessDays(orderDate, rule.leadDays)
        : addDays(orderDate, rule.leadDays)
    if (rule.noWeekendDelivery) deliv = nextBusinessDay(deliv)
    return deliv
  }
  // mapping explicite jour de commande -> jour de livraison
  const od = weekday(orderDate)
  const entry = rule.map.find((r) => r.orderDay === od)
  if (!entry) {
    // pas de correspondance : repli prudent = lendemain ouvré
    return nextBusinessDay(addDays(orderDate, 1))
  }
  const mondayThisWeek = addDays(orderDate, -od) // lundi de la semaine de la commande
  const targetMonday = addDays(mondayThisWeek, entry.weeksAhead * 7)
  return addDays(targetMonday, entry.deliveryDay)
}

/** Plan complet d'un fournisseur : prochaine commande, livraison, commande suivante, période à couvrir. */
export function supplierPlan(cal: SupplierCalendar, now: Date): SupplierPlan {
  const nextOrder = nextOrderDate(cal, now)
  const d1 = deliveryDateFor(cal, nextOrder)
  // C2 = prochaine commande possible APRÈS nextOrder : on repart du lendemain à minuit
  const dayAfter = addDays(nextOrder, 1)
  const dayAfterMidnight = new TZDate(dayAfter.y, dayAfter.m - 1, dayAfter.d, 0, 0, 0, PARIS)
  const c2 = nextOrderDate(cal, new Date(dayAfterMidnight.getTime()))
  const d2 = deliveryDateFor(cal, c2)
  return { nextOrder, cutoff: cal.cutoff, d1, c2, d2 }
}
