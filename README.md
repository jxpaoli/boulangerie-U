# Point Chaud — Stock & Commandes

Application PWA mobile-first pour la responsable d'un point chaud : suivi du **stock
congelé** en temps réel, **proposition de commande** automatique (couverture jusqu'à
la prochaine livraison + plafond congélo), **réception** des livraisons et **inventaire**.

> Périmètre et décisions produit : voir [`docs/BUSINESS_RULES.md`](docs/BUSINESS_RULES.md).
> Architecture : [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Stack

React 19 · TypeScript strict · Vite 8 · Tailwind v4 · PWA · TanStack Query · Zod ·
react-hook-form · date-fns (Europe/Paris) · Supabase (branché en fin de V1) ·
Cloudflare Workers (déploiement cible).

## Démarrer

```bash
npm install
npm run dev        # http://localhost:5173
```

En Phase 1, l'app tourne sur un **jeu de données de démonstration** (aucun backend requis).
Le branchement Supabase se fait plus tard via `.env.local` (voir `.env.example`).

## Scripts

| Script | Rôle |
|---|---|
| `npm run dev` | Serveur de développement |
| `npm run build` | Build de production (typecheck + Vite + PWA) |
| `npm run typecheck` | Vérification TypeScript stricte |
| `npm run test` | Tests unitaires (Vitest) |
| `npm run lint` | Lint (oxlint) |

## État d'avancement

- [x] **Phase 1 — Socle** : projet, design system « point chaud », PWA, tableau de bord,
      sortie rapide fonctionnelle, liste des stocks, tests, build vert.
- [ ] Phase 2 — Référentiel (fournisseurs, produits, conditionnements) + moteur de dates
- [ ] Phase 3 — Stock (journal, sortie temps réel serveur, inventaire)
- [ ] Phase 4 — Prévisions & commandes (proposition, contrôle visuel, export)
- [ ] Phase 5 — Réceptions
- [ ] Phase 6 — Dashboard, alertes, exports, RLS, CI/CD, seed, déploiement Cloudflare
