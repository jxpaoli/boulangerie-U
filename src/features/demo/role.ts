import { create } from 'zustand'

/**
 * Rôle de la personne connectée (démo — viendra de Supabase Auth / user_roles).
 * - vendeuse   : cycle quotidien ; propose les actions sensibles (recalage de stock)
 * - responsable: droits vendeuse + validation des propositions + config
 * Voir docs/BUSINESS_RULES.md §13.
 */
export type Role = 'vendeuse' | 'responsable'

interface RoleState {
  role: Role
  setRole: (r: Role) => void
}

export const useDemoRole = create<RoleState>((set) => ({
  role: 'responsable',
  setRole: (role) => set({ role }),
}))

/** Seuil d'écart au-delà duquel un recalage de stock est proposé (voir §8). */
export const RECALIBRATION_THRESHOLD = 0.2 // 20 %

export function isSignificantGap(seen: number, theoretical: number): boolean {
  const diff = Math.abs(seen - theoretical)
  if (theoretical <= 0) return diff > 0
  return diff >= RECALIBRATION_THRESHOLD * theoretical
}
