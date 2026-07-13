# Sécurité — Point Chaud

Source de vérité : `supabase/migrations/0002_rls.sql` (+ fonctions `0003`).

## Modèle

- **Base partagée** : toutes les tables dans le schéma isolé `point_chaud`. Le rôle
  API `anon` n'a **aucun** accès ; seul `authenticated` (utilisateur connecté) entre,
  et la **RLS** le restreint à **son site**.
- **Appartenance = `profiles`.** Un utilisateur Supabase Auth n'a accès à l'appli que
  s'il possède une ligne `profiles` active. Les utilisateurs des autres applis de la base
  partagée n'ont pas de profil `point_chaud` → tout leur est refusé.
- **Rôles** : `vendeuse` (cycle quotidien, **propose** les actions sensibles) et
  `responsable` (droits vendeuse + **validation** + **configuration**).

## RLS (Row Level Security)

- **Activée et forcée** (`force row level security`) sur **toutes** les tables.
- **Lecture** : membres du même site (`site_id = current_site_id()`), y compris via la
  table parente pour les tables de lignes (order_lines, delivery_lines…).
- **Écriture de configuration** (produits, familles, fournisseurs, références, prépas,
  prévisions, réglages, comptes) : **responsable du site uniquement**.
- **Écritures opérationnelles** (mouvements de stock, commandes, réceptions, inventaires,
  propositions, audit) : **aucune écriture directe**. Elles passent **exclusivement** par
  des **fonctions PostgreSQL `SECURITY DEFINER`** (migration `0003`) qui vérifient
  utilisateur + rôle + site + cohérence des quantités, gèrent l'idempotence et écrivent
  l'audit. La RLS sans policy d'écriture refuse tout accès direct.

## Fonctions d'aide
`current_site_id()`, `current_role()`, `is_member()`, `is_responsable()` — `SECURITY
DEFINER`, `search_path` figé, lisent `profiles` sans récursion RLS.

## Défense en profondeur
Les contrôles ne sont **jamais** uniquement dans l'UI : ils sont dans la **RLS** et dans
les **fonctions**. L'UI masque ce qui n'est pas permis, mais même un appel API direct
est refusé (ex. une vendeuse qui tenterait de recaler le stock, ou de modifier un
fournisseur, via l'API).

## Secrets
- Jamais de clé `service_role` dans le frontend ni le repo.
- Frontend : uniquement l'URL du projet + la clé **anon** (publique), via `.env.local`
  (git-ignoré). Voir `.env.example`.
- Secrets de déploiement : Cloudflare secrets + environnements GitHub (voir DEPLOYMENT.md).

## Journalisation
Connexion, changement de rôle, modif fournisseur/calendrier, correction de stock,
validation de commande/réception, annulations, changements de réglages → `audit_logs`
(non modifiable par un utilisateur standard).

## À valider avant prod
La RLS **doit être testée** (parcours vendeuse vs responsable vs non-membre) sur une base
**non-prod** (branche Supabase ou local) avant application sur la base partagée. Voir
`docs/TEST_PLAN.md` (scénario sécurité 13).
