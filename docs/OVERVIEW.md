# Point Chaud — Topo complet de l'appli

> Vue d'ensemble : à quoi ça sert, comment ça marche, le front, le back, les choix.
> Pour le détail des règles métier : `docs/BUSINESS_RULES.md`. Pour brancher/déployer :
> `docs/SETUP.md` et `docs/DEPLOYMENT.md`.

---

## 1. À quoi ça sert

**Le problème.** Dans un point chaud, la responsable fait le tour du stock congelé avec un
cahier, note ce qui baisse, puis passe ses commandes fournisseurs au téléphone. C'est long,
source d'oublis et de ruptures.

**La solution.** Une appli mobile qui :
- suit le **stock congelé en temps réel** (chaque sortie du congélo est enregistrée) ;
- **calcule toute seule quoi commander**, à qui, et en quelle quantité, selon les calendriers
  de chaque fournisseur ;
- gère la **réception** des livraisons (seul ce qui arrive vraiment entre en stock) ;
- permet un **inventaire** collaboratif pour recaler le stock au réel ;
- le tout **sur le téléphone et le pad de la boulangerie**, chacun se connectant à son service.

**Périmètre volontairement resserré.** L'appli gère **uniquement le congélateur**. Dès qu'un
produit en sort, il est « consommé » (peu importe la suite : cuisson, décongélation, vente,
casse). Pas de caisse, pas de suivi des produits cuits, pas de chiffre d'affaires.

---

## 2. Les grands principes (le « pourquoi » du métier)

| Principe | En clair |
|---|---|
| **On ne jette jamais rien** | Le stock repose sur un **journal de mouvements** non destructif. On n'écrase jamais une valeur ; corriger = ajouter un mouvement. Tout reste consultable. |
| **Unité de stock ≠ conditionnement** | On compte en pièces, on commande en cartons. L'appli convertit et l'affiche dans les deux. |
| **Seul l'accepté entre en stock** | Une commande passée n'augmente pas le stock. Une livraison non contrôlée non plus. Seule la quantité **acceptée** à la réception crée une entrée. |
| **Conso par jour de semaine** | Le lundi ≠ le samedi. Chaque produit a un profil de consommation sur 7 jours. |
| **Filet « +1 livraison »** | Une commande couvre jusqu'à la livraison **d'après** la prochaine — un cycle de sécurité, pour ne jamais tomber à sec. |
| **Plafond congélo** | On ne commande jamais plus que la place disponible ; si le filet ne rentre pas, l'appli plafonne et prévient. |

---

## 3. Comment on s'en sert (le quotidien)

1. **Connexion par service.** La personne en service se connecte (sur son tél = reste connectée ;
   sur le pad partagé = « changer d'utilisateur » à la relève). Tout ce qu'elle fait est tracé à
   son nom.
2. **Sortie** (le cœur). Trois façons :
   - **Prépa standard** : un lot habituel enregistré (« prépa du matin ») → tout sort d'un coup ;
   - **Prépa new** : un lot composé sur le moment (enregistrable comme standard) ;
   - **Unités** : un seul produit (ex. une baguette pour un client).
   Chaque sortie fait baisser le stock immédiatement.
3. **Commandes.** L'appli affiche les fournisseurs à commander aujourd'hui et **propose les
   quantités** (couverture + filet + plafond congélo, arrondi au carton, tout expliqué). Un
   **contrôle visuel** rapide (cartons pleins + carton entamé) permet de recaler avant de valider,
   puis on génère le **bon de commande** à lire au téléphone.
4. **Réception.** On ouvre la commande, « livraison conforme » en un geste ou on ajuste ligne par
   ligne ; **seul l'accepté entre en stock**, le manquant revient tout seul dans la prochaine
   proposition.
5. **Inventaire** (collaboratif). On compte les produits (+/− + validation, dans l'ordre qu'on
   veut), **à plusieurs en temps réel** (une validation apparaît sur tous les écrans). À la
   clôture, le stock est recalé (écarts tracés). Les inventaires clôturés sont **archivés** et
   **exportables** (Excel / PDF) depuis Paramètres.
6. **Paramètres** (responsable) : produits, fournisseurs (calendriers), familles, sorties
   programmées, réglage du filet et historique des inventaires.

**Rôles.** `responsable` (tous droits + config) et `vendeuse` (tout le cycle quotidien).
Les actions sensibles (recalage de stock hors inventaire) passent en **proposition → validation**.

---

## 4. Le front (interface)

**Stack.** React 19 + **TypeScript strict** + **Vite**. **Tailwind v4** pour le style.
**PWA installable** (écran d'accueil, plein écran, hors-ligne de base). **TanStack Query** pour
les données, **Zod** + **react-hook-form** pour les formulaires, **date-fns** (fuseau Europe/Paris).

**Design.** Identité « point chaud » : chaud/ambré, mobile-first, gros boutons (utilisée debout,
une main), thèmes clair **et** sombre. Jamais de scroll horizontal ; listes de produits en
**familles repliables**.

**Architecture clé — la couche « services ».**
Les écrans ne parlent **jamais** à la base directement : ils passent par une couche
`src/services` avec **deux implémentations interchangeables** :
- **mock** : données de démo en mémoire (pour tester sans backend) ;
- **supabase** : la vraie base.

On bascule de l'une à l'autre avec une simple variable d'environnement (`VITE_DATA_SOURCE`).
→ On a pu construire et valider toute l'appli **avant** de brancher le backend, puis basculer
sans changer une ligne d'écran.

**Organisation.**
```
src/
  components/   UI transverse (AppShell, FamilySection, primitives)
  features/     un dossier par domaine (dashboard, stock, orders, deliveries, admin, auth)
  lib/          logique pure et testée (dates commande→livraison, calcul de commande, format)
  services/     accès données : interfaces + adaptateurs mock / supabase
```

**Le « cerveau » est en pur TypeScript, testé** (43 tests) : le calcul des dates
commande→livraison (jours de commande, heure limite, jours ouvrés/calendaires, report week-end)
et le calcul de la commande proposée (couverture, arrondi, plafond, alerte rupture). Indépendant
de l'affichage et de la base.

---

## 5. Le back (données & sécurité)

**Supabase** (PostgreSQL + Auth + Realtime).

**Base partagée, isolation stricte.** La base Supabase est **partagée avec d'autres applis**
(dont restau). Point Chaud vit **entièrement dans son propre schéma `point_chaud`** — jamais dans
`public`. Zéro risque de collision avec les autres applis.

**Modèle de données** (tables principales, schéma `point_chaud`) :
- `sites`, `profiles` (utilisateur → site + rôle), `app_settings`
- `product_categories`, `products`, `suppliers`, `supplier_products` (conditionnements),
  `forecast_settings` (conso 7 jours), `prep_templates` (préparations)
- `stock_movements` = **le journal** (entrées/sorties/corrections signées ; le stock = leur somme)
- `purchase_orders` / `deliveries` (commandes / réceptions)
- `stock_counts` / `stock_count_lines` (inventaires)
- `audit_logs`

**Sécurité (RLS — Row Level Security).**
- Activée et **forcée** sur toutes les tables.
- Un utilisateur ne voit que **son site**. L'appartenance = avoir une ligne `profiles` (les
  utilisateurs des autres applis n'ont pas de profil `point_chaud` → tout leur est refusé).
- Écritures de **config** = responsable uniquement.
- Écritures **opérationnelles** (sorties, réceptions, corrections, inventaire) = **jamais en
  direct** : elles passent par des **fonctions PostgreSQL** (`SECURITY DEFINER`) qui vérifient
  rôle + site + cohérence, gèrent l'idempotence (anti double-clic) et écrivent l'audit.
- Les contrôles ne sont **jamais** que dans l'interface : même un appel API direct est refusé.

**Temps réel.** L'inventaire collaboratif utilise **Supabase Realtime** : quand quelqu'un valide
un produit, tous les écrans abonnés se rafraîchissent en direct (dans le respect de la RLS).

**Clés.** Le front n'utilise que la clé **publique** (`sb_publishable_…`), faite pour le
navigateur. La clé secrète (`sb_secret_…`) n'apparaît **jamais** dans le code.

---

## 6. Hébergement & mise en ligne

- **Frontend** : build statique → **Cloudflare Workers (Static Assets)**, en ligne sur
  `https://boulangerie-u.gmao-port2bastia.workers.dev` (PWA installable).
- **Backend** : Supabase (projet `lrittnexagnqcnnxbzrx`).
- **Code** : GitHub `jxpaoli/boulangerie-U`, avec **intégration continue** (GitHub Actions :
  lint + typecheck + tests + build à chaque push).
- **Migrations** SQL versionnées (`supabase/migrations/`), appliquées via l'éditeur SQL Supabase.
- Redéployer : `npm run build && npx wrangler deploy`.

---

## 7. Les choix techniques (et pourquoi)

| Choix | Pourquoi |
|---|---|
| **Journal de mouvements** plutôt qu'un champ « stock » | Traçabilité totale, réversibilité, base pour l'apprentissage de la conso. On ne perd jamais d'info. |
| **Couche services mock/réel** | Construire et démontrer l'appli sans backend, puis brancher sans réécrire les écrans. |
| **Cerveau (dates + commande) en TS pur, testé** | Le calcul le plus critique est isolé, vérifiable et rejouable, indépendant de l'UI et de la base. |
| **Schéma Postgres dédié** | Isolation forte sur une base partagée : impossible d'impacter les autres applis. |
| **Écritures via fonctions SECURITY DEFINER** | Sécurité et cohérence garanties côté serveur (pas seulement dans l'UI) ; idempotence anti double-clic. |
| **PWA + mobile-first** | Utilisée debout, sur tél et pad ; installable, plein écran, gros boutons. |
| **Cloudflare Workers (pas Pages)** | Choix d'hébergement statique performant, prévu pour un domaine perso ensuite. |
| **Réception sans reliquat (V1)** | Simple : seul l'accepté entre ; le manquant revient tout seul dans la commande suivante. |

---

## 8. État & suite

**Fait** : tout le cycle (sortie → commande → réception → inventaire), la config (produits /
fournisseurs / familles), la connexion par service + rôles, l'inventaire collaboratif temps réel
+ export, branché sur la vraie base Supabase et **en ligne** sur Cloudflare.

**Pistes suivantes (hors V1)** : jours fériés et fermetures automatiques, domaine personnalisé,
apprentissage automatique de la consommation à partir de l'historique des sorties, lots/DLC et
produits de remplacement.
