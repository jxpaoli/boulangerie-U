import { describe, it, expect } from 'vitest'
import { packBreakdown, formatPacks } from '@/lib/format'

describe('packBreakdown', () => {
  it('décompose 138 pièces en 2 cartons de 60 et 18 pièces', () => {
    expect(packBreakdown(138, 60)).toEqual({ packs: 2, remainder: 18 })
  })

  it('gère un stock inférieur à un carton', () => {
    expect(packBreakdown(18, 24)).toEqual({ packs: 0, remainder: 18 })
  })

  it('gère un multiple exact', () => {
    expect(packBreakdown(48, 24)).toEqual({ packs: 2, remainder: 0 })
  })

  it('protège contre un packSize invalide', () => {
    expect(packBreakdown(50, 0)).toEqual({ packs: 0, remainder: 50 })
  })

  it('ne renvoie jamais de quantité négative', () => {
    expect(packBreakdown(-5, 24)).toEqual({ packs: 0, remainder: 0 })
  })
})

describe('formatPacks', () => {
  it('formate « 2 cartons et 18 pièces »', () => {
    expect(formatPacks(138, 60)).toBe('2 cartons et 18 pièces')
  })

  it('formate un singulier', () => {
    expect(formatPacks(25, 24)).toBe('1 carton et 1 pièce')
  })

  it('affiche 0 pièce quand le stock est vide', () => {
    expect(formatPacks(0, 24)).toBe('0 pièce')
  })
})
