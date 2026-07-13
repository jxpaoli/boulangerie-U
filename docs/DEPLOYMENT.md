# Déploiement — Point Chaud

## Vue d'ensemble
- **Frontend** : React/Vite → build statique → **Cloudflare Workers (Static Assets)**.
- **Backend** : **Supabase** (base partagée, schéma isolé `point_chaud`).
- **CI** : GitHub Actions (`.github/workflows/ci.yml`) — lint, typecheck, tests, build à chaque push/PR.

---

## 1. Base de données Supabase

> ⚠️ Base **partagée** entre plusieurs applis. Tout est isolé dans le schéma
> `point_chaud`, mais on **valide d'abord sur une base non-prod**.

### a. Valider les migrations (recommandé avant la prod)
Sur une **branche Supabase** (Dashboard > Branches) ou en local (`supabase start`,
nécessite Docker) :
```bash
supabase link --project-ref <ref-de-la-branche>
supabase db push          # applique supabase/migrations/*
# puis, pour tester avec des données :
psql "$DATABASE_URL" -f supabase/seed.sql
```
Tester les parcours (dont la RLS : vendeuse vs responsable vs non-membre) — voir TEST_PLAN.md.

### b. Appliquer à la base réelle
Deux options, au choix :
- **Éditeur SQL du dashboard** : coller le contenu de `0001`, `0002`, `0003` (dans l'ordre).
- **CLI** : `supabase link --project-ref lrittnexagnqcnnxbzrx` puis `supabase db push`.

### c. Exposer le schéma à l'API
Dashboard > **Settings > API > Exposed schemas** → ajouter **`point_chaud`**.
(Le client JS est déjà configuré avec `{ db: { schema: 'point_chaud' } }`.)

### d. Créer le premier responsable
1. Créer l'utilisateur via **Authentication** (ou signup dans l'appli).
2. Récupérer son `user uid`, puis (SQL editor) :
```sql
insert into point_chaud.profiles (id, site_id, display_name, role)
values ('<auth-uid>', '00000000-0000-0000-0000-0000000000c1', 'Sabrina', 'responsable');
```

---

## 2. Variables d'environnement (frontend)
Créer `.env.local` (git-ignoré) à partir de `.env.example` :
```
VITE_SUPABASE_URL=https://lrittnexagnqcnnxbzrx.supabase.co
VITE_SUPABASE_ANON_KEY=<clé anon, Dashboard > Settings > API>
VITE_DATA_SOURCE=supabase
```
> Jamais la clé `service_role` dans le frontend.

---

## 3. Déploiement Cloudflare Workers
```bash
npm run build
npx wrangler deploy        # utilise wrangler.jsonc (assets ./dist, fallback SPA)
```
Domaine personnalisé : à brancher plus tard (Dashboard Cloudflare > Workers > Custom Domains).

### Secrets de build (CI/CD)
Les variables `VITE_SUPABASE_*` sont injectées **au build**. En CI, les stocker dans
**GitHub > Settings > Secrets and variables** (par environnement staging / production),
et le token Cloudflare `CLOUDFLARE_API_TOKEN` de même. **Jamais commités.**

---

## 4. Sauvegarde & réversibilité
- Supabase : sauvegardes automatiques du projet (Dashboard > Database > Backups).
- Migrations **versionnées** et ordonnées (`supabase/migrations`) → rejouables.
- Exports CSV (stock, mouvements, commandes, livraisons) prévus côté appli (Phase 6).
- Retour arrière appli : redéployer un commit précédent (`wrangler deploy` sur un build antérieur).
