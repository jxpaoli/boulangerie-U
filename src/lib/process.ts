/**
 * Process de fabrication (pousse / cuisson directe / décongélation) — libellés et
 * helpers partagés par la fiche produit, la fabrication des listes et la page Sortie.
 */
import type { ExitProcess } from '@/services/types'

/** Ordre d'affichage des onglets / sélecteurs. */
export const PROCESS_ORDER: readonly ExitProcess[] = ['pousse', 'cuisson', 'deco']

/** Process par défaut d'un produit / d'une liste (cuisson directe). */
export const DEFAULT_PROCESS: ExitProcess = 'cuisson'

/** Libellé complet (fiche produit, fabrication des listes, badges). */
export const PROCESS_LABEL: Record<ExitProcess, string> = {
  pousse: 'Mise en pousse',
  cuisson: 'Cuisson directe',
  deco: 'Décongélation',
}

/** Libellé court des onglets de la page Sortie. */
export const PROCESS_TAB_LABEL: Record<ExitProcess, string> = {
  pousse: 'Mise en pousse',
  cuisson: 'Cuisson',
  deco: 'Décongélation',
}

/** Normalise une valeur venue de la base en process connu. */
export function toProcess(value: unknown): ExitProcess {
  return value === 'pousse' || value === 'cuisson' || value === 'deco' ? value : DEFAULT_PROCESS
}
