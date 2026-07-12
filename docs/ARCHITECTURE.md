# Architecture — Point Chaud

## Vue d'ensemble

Application **PWA mobile-first** de gestion du stock congelé d'un point chaud :
sortie rapide en temps réel, proposition de commande, réception, inventaire.

- **Frontend** : React 19 + TypeScript strict + Vite 8, Tailwind v4, PWA (vite-plugin-pwa).
- **Backend** (branché en fin de V1) : Supabase (PostgreSQL, Auth, RLS, fonctions SQL).
- **Hébergement** cible : Cloudflare Workers + Static Assets (Wrangler). Pas Cloudflare Pages.
- **État serveur** : TanStack Query. **État UI local** : useState / Zustand si besoin.
- **Validation** : Zod (schémas partagés client/serveur). **Formulaires** : react-hook-form.
- **Dates** : `Europe/Paris` via date-fns + @date-fns/tz.

## Principe local-first (décision produit)

La V1 est construite pour **tourner sans backend** puis brancher Supabase à la fin.
Une **couche services** abstrait l'accès aux données derrière des interfaces ; deux
implémentations :

- `mock` : données en mémoire (démo), pilotée par `VITE_DATA_SOURCE=mock` ;
- `supabase` : implémentation réelle (RLS + fonctions transactionnelles).

Aucun composant n'appelle Supabase directement : ils passent par les services. La
bascule mock/réel se fait par variable d'environnement, sans toucher l'UI.

> État actuel (Phase 1) : les écrans lisent un jeu de démo (`src/features/demo`).
> La couche services et l'implémentation Supabase arrivent avec les migrations (Phase 2+).

## Couches

```
src/
  app/          # providers, routing global
  components/   # UI transverse (AppShell, primitives, ComingSoon)
  features/     # un dossier par domaine métier (dashboard, stock, orders, …)
  hooks/        # hooks réutilisables
  lib/          # utilitaires purs (format, dates, cn, theme) — testables
  services/     # accès données (interfaces + adapters mock / supabase)
  types/        # types partagés (souvent dérivés des schémas Zod)
  tests/        # tests unitaires (Vitest)
supabase/
  migrations/   # schéma SQL versionné (source de vérité de la base)
  functions/    # fonctions PostgreSQL transactionnelles
  seed.sql      # données de démonstration
worker/         # entrée Cloudflare Worker (sert les assets statiques)
docs/           # CCTP, règles métier, modèle de données, sécurité, déploiement
```

## Règles d'or (voir docs/BUSINESS_RULES.md)

1. **Journal de mouvements non destructif** : le stock = somme de `stock_movements`.
   On n'écrase ni ne supprime jamais ; une correction = un nouveau mouvement.
2. **Unité de stock ≠ conditionnement** : stock en pièces, commande en cartons.
3. **Seul l'accepté à la réception entre en stock.** Une commande n'augmente jamais le stock.
4. **Opérations critiques transactionnelles et idempotentes** (clé d'idempotence
   contre les doubles-clics), côté serveur (fonctions PostgreSQL), pas seulement l'UI.

## Écarts assumés vs CCTP

Le périmètre V1 resserre volontairement le CCTP (voir BUSINESS_RULES §14). Notamment :
reliquats, jours fériés/fermetures automatiques, saisonnalité, lots/DLC, équivalences,
3 rôles dans l'UI, multi-site, temps réel, hors-ligne avancé et statistiques poussées
sont **repoussés** — le modèle de données garde toutefois la place pour les brancher
sans réécriture.
