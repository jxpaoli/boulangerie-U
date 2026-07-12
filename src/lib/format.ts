/**
 * Formatage — conventions françaises + conversions unité de stock ↔ conditionnement.
 * Voir docs/BUSINESS_RULES.md §3.
 */

/** Décompose une quantité d'unités en « N cartons et R pièces ». */
export function packBreakdown(
  units: number,
  packSize: number,
): { packs: number; remainder: number } {
  if (packSize <= 0) return { packs: 0, remainder: Math.max(0, Math.trunc(units)) }
  const u = Math.max(0, Math.trunc(units))
  return { packs: Math.floor(u / packSize), remainder: u % packSize }
}

/** Ex. 138 pièces, carton de 60 → « 2 cartons et 18 pièces ». */
export function formatPacks(
  units: number,
  packSize: number,
  packLabel = 'carton',
  unitLabel = 'pièce',
): string {
  const { packs, remainder } = packBreakdown(units, packSize)
  const parts: string[] = []
  if (packs > 0) parts.push(`${packs} ${plural(packLabel, packs)}`)
  if (remainder > 0 || packs === 0) parts.push(`${remainder} ${plural(unitLabel, remainder)}`)
  return parts.join(' et ')
}

export function plural(word: string, n: number): string {
  if (Math.abs(n) < 2) return word
  if (word.endsWith('s') || word.endsWith('x')) return word
  return `${word}s`
}

const nf = new Intl.NumberFormat('fr-FR')
export function formatNumber(n: number): string {
  return nf.format(n)
}

const dateFmt = new Intl.DateTimeFormat('fr-FR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  timeZone: 'Europe/Paris',
})
export function formatDate(d: Date): string {
  return dateFmt.format(d)
}

const dowFmt = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  timeZone: 'Europe/Paris',
})
/** « vendredi 12 juillet ». */
export function formatDayLong(d: Date): string {
  return dowFmt.format(d)
}

const timeFmt = new Intl.DateTimeFormat('fr-FR', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: 'Europe/Paris',
})
export function formatTime(d: Date): string {
  return timeFmt.format(d)
}

export const WEEKDAYS_SHORT = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'] as const
export const WEEKDAYS_LONG = [
  'lundi',
  'mardi',
  'mercredi',
  'jeudi',
  'vendredi',
  'samedi',
  'dimanche',
] as const
