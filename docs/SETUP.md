# Mise en ligne / branchement — Runbook

Procédure **testée** pour brancher l'appli sur Supabase. Suivre dans l'ordre.
Les pièges rencontrés sont notés en ⚠️.

## Pré-requis
- Le repo cloné, `npm install` fait.
- Accès au dashboard Supabase du projet **`lrittnexagnqcnnxbzrx`** (compte jxpaoli dev).
- Base **partagée** : tout est isolé dans le schéma `point_chaud` (restau n'est pas touché).

---

## 1. Appliquer le schéma (SQL Editor)
Dashboard → **SQL Editor** → New query → coller **tout** `supabase/APPLY_ALL.sql` → **Run**.
→ crée le schéma `point_chaud` + RLS + fonctions. (Le `drop schema … cascade` en tête permet
de relancer proprement.)

## 2. Charger le catalogue (SQL Editor)
Coller **tout** `supabase/seed.sql` → **Run**. → site, familles, produits, fournisseurs,
conso, stock initial, préparations.

## 3. Exposer le schéma à l'API + rafraîchir le cache (SQL Editor)
⚠️ **Étape critique, souvent oubliée.** Le réglage « Exposed schemas » est caché dans la
nouvelle UI — on le fait en SQL :
```sql
alter role authenticator
  set pgrst.db_schemas = 'public, graphql_public, point_chaud';
notify pgrst, 'reload config';
notify pgrst, 'reload schema';   -- ⚠️ indispensable : recharge la liste des tables
```
- Sans la 1ʳᵉ ligne → erreur **PGRST106 « Invalid schema: point_chaud »**.
- Sans `reload schema` → erreur **PGRST205 « Could not find the table … in the schema cache »**.

## 4. Créer le compte responsable (Authentication)
Dashboard → **Authentication → Users → Add user** → e-mail + mot de passe.
Cliquer sur l'utilisateur créé et **copier son UID** (`xxxxxxxx-xxxx-…`).
⚠️ **Bien prendre l'UID du compte avec lequel on se connecte** (sinon « Ce compte n'a pas accès »).

## 5. Déclarer le profil (SQL Editor)
```sql
insert into point_chaud.profiles (id, site_id, display_name, role)
values ('UID-DU-COMPTE',
        '00000000-0000-0000-0000-0000000000c1',
        'Prénom', 'responsable')
on conflict (id) do update
  set display_name = excluded.display_name, role = excluded.role;
```
`site_id` = celui du seed (`…c1`). Rôle `responsable` (ou `vendeuse`).

## 6. Clé publique + `.env.local`
Dashboard → **Settings → API Keys** → copier la **Publishable key** (`sb_publishable_…`).
⚠️ **Jamais** la `sb_secret_…`.
Dans `.env.local` (à la racine, git-ignoré) :
```
VITE_SUPABASE_URL=https://lrittnexagnqcnnxbzrx.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_…
VITE_DATA_SOURCE=supabase
```
> `VITE_SUPABASE_ANON_KEY` accepte la nouvelle clé `sb_publishable_…` (supabase-js ≥ 2.108).

## 7. Lancer
```bash
npm run dev        # http://localhost:5173
```
Écran de connexion réel → se connecter (e-mail + mot de passe de l'étape 4) → l'appli
charge les données de la base.

---

## Dépannage express
| Symptôme | Cause | Fix |
|---|---|---|
| `PGRST106 Invalid schema: point_chaud` | schéma non exposé | étape 3, 1ʳᵉ ligne |
| `PGRST205 table … not in schema cache` | cache PostgREST pas rechargé | `notify pgrst, 'reload schema';` |
| « Ce compte n'a pas accès au Point Chaud » | pas de profil, ou **mauvais UID** | étape 5 avec le **bon** UID |
| Écran de connexion mais accès rapide démo affiché | `VITE_DATA_SOURCE` ≠ supabase / clé vide | vérifier `.env.local` |
| Page blanche | erreur JS | ouvrir la console navigateur (F12) |

Vérifier l'accès au schéma sans se connecter (console navigateur) :
```js
fetch('https://lrittnexagnqcnnxbzrx.supabase.co/rest/v1/products?select=name&limit=1',
  { headers: { apikey: 'sb_publishable_…', 'Accept-Profile': 'point_chaud' } })
  .then(r => r.text()).then(console.log)
```
Réponse `[]` = OK (schéma joignable, RLS filtre). Une erreur PGRST10x/20x = voir tableau.

---

## Déploiement en ligne (Cloudflare) — plus tard
```bash
npm run build
npx wrangler deploy      # utilise wrangler.jsonc
```
Les `VITE_SUPABASE_*` sont injectées **au build** (secrets GitHub par environnement pour la CI).
Domaine personnalisé : Dashboard Cloudflare → Workers → Custom Domains.
Détails : `docs/DEPLOYMENT.md`.
