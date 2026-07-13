# Règles métier — Point Chaud (V1)

> Ce document fait foi sur le comportement attendu de l'application.
> Il est la traduction du CCTP, resserré sur le périmètre **V1** décidé avec la responsable.

## 0. Principe fondateur : on ne jette jamais rien

Le stock ne repose **jamais** sur une valeur qu'on écrase. Il repose sur un
**journal de mouvements non destructif** (`stock_movements`). Chaque événement
(entrée, sortie, correction, inventaire) crée **une ligne** ; on ne modifie ni ne
supprime jamais une ligne existante.

- Corriger une erreur = écrire un **mouvement compensatoire**, pas effacer.
- Le stock d'un produit = **somme des quantités signées** de ses mouvements.
- Tout reste consultable pour toujours (traçabilité + apprentissage de la conso).

## 1. Périmètre : uniquement le congélateur

L'application gère **uniquement les produits présents dans le congélateur**.

Dès qu'un produit **sort du congélateur**, il est considéré comme **consommé**,
quelle que soit sa destination (cuisson, décongélation, vente, perte, casse…).

L'application **ne suit pas** : ventes clients, caisse, produits cuits/décongelés,
invendus, chiffre d'affaires, tables, recettes. **Aucun module de caisse.**

## 2. Les quatre stocks (jamais mélangés dans l'UI)

| Stock | Définition | Source |
|---|---|---|
| **Physique / théorique** | Ce qui est réellement au congélo | Somme des `stock_movements` |
| **Attendu** | Commandé mais pas encore réceptionné | `purchase_order_lines` non reçues |
| **Projeté à une date** | Estimation future | physique − conso prévue + réceptions attendues |

> En V1 « physique » et « théorique » sont confondus : le théorique **est** notre
> meilleure estimation du physique, recalé par les inventaires.

### Formule du stock théorique

```
théorique = inventaire_initial
          + réceptions acceptées
          + corrections positives
          − sorties du congélateur
          − corrections négatives
```

Règles absolues :
- Une **commande passée mais non réceptionnée** n'augmente **jamais** le stock.
- Une **livraison arrivée mais non contrôlée** n'augmente **jamais** le stock.
- **Seule** une quantité **explicitement acceptée** à la réception crée une entrée.

## 3. Unité de stock ≠ conditionnement

Le stock se compte en **unités de stock** (pièces). La commande se passe en
**conditionnements fournisseur** (cartons, sachets, plaques).

- `supplier_products.pack_size` = nombre d'unités de stock par conditionnement.
- Le stock est **stocké** en unités ; il est **affiché** aussi en conditionnements.
  - Ex. 138 pièces, carton de 60 → « 2 cartons et 18 pièces ».
- La commande est **calculée** en unités puis **convertie** en conditionnements.

## 4. Conso prévisionnelle : par produit et par jour de la semaine

La consommation est estimée **par jour de la semaine** (lundi ≠ samedi).

- V1 : saisie **manuelle** d'un profil 7 jours par produit (`forecast_settings`).
- L'historique des sorties est conservé dès le départ → l'apprentissage automatique
  (moyenne par jour de semaine sur une fenêtre glissante) pourra être activé plus tard
  **sans migration** (les données sont là).
- Un ajustement ponctuel (`forecast_adjustments`) peut multiplier un jour donné
  (ex. événement +30 %). Non prioritaire en V1 mais prévu dans le modèle.

## 5. Moteur de dates commande → livraison

Chaque fournisseur a des **jours de commande** et une règle de livraison.

Règle V1 (simple, sans jours fériés automatiques) :
- `order_days` : jours de la semaine où l'on peut commander (0=lundi … 6=dimanche).
- `cutoff_time` : heure limite de commande (fuseau **Europe/Paris**).
- Livraison, selon `delivery_mode` :
  - `lead_days` : livraison à J+N (N jours **calendaires** ou **ouvrés**, configurable) ;
  - `mapping` : correspondance explicite jour de commande → jour de livraison
    (ex. jeudi → vendredi de la semaine suivante).
- `no_weekend_delivery` : pas de livraison sam/dim → report au prochain jour ouvré.

**Hors V1 (géré à la main)** : fermetures fournisseur, jours fériés, saisonnalité,
exceptions ponctuelles. Le modèle de données garde la place (`supplier_closures`,
`supplier_delivery_exceptions`) mais le moteur V1 ne les applique pas.

### Informations calculées par fournisseur
- prochaine date de commande possible + heure limite ;
- date de livraison de cette commande (**D1**) ;
- commande possible suivante (**C2**) et sa livraison (**D2**) ;
- **période à couvrir** = de D1 à D2.

Toutes les dates sont calculées en `Europe/Paris`.

## 6. Proposition de commande

Pour chaque produit commandable chez le fournisseur du jour :

```
stock_projeté_avant_D1 = stock_actuel − conso(maintenant → D1) + réceptions_avant_D1
besoin_cible_à_D1      = conso(D1 → D2) + stock_de_sécurité
quantité_brute         = max(0, besoin_cible_à_D1 − stock_projeté_avant_D1)
```

Puis conversion en commande :
1. convertir en unité de commande du fournisseur ;
2. **arrondir au conditionnement supérieur** ;
3. respecter la **quantité minimale** commandable ;
4. respecter le **multiple obligatoire** ;
5. **plafonner à la capacité congélo** du produit (voir §7) ;
6. ajustable **manuellement** par la responsable.

**Tout arrondi est expliqué à l'utilisateur** (brut → arrondi → final).

### Marge de sécurité : +1 livraison (filet « commande de secours »)

Décision : une commande ne couvre pas seulement jusqu'à la **prochaine** livraison,
mais jusqu'à la **livraison d'après** — **un cycle de livraison entier de marge**.

- La responsable porte ainsi en permanence ~1 livraison de stock d'avance : une commande
  ratée, oubliée, ou une livraison incomplète ne la met **pas en rupture**.
- Paramètre `safetyDeliveries` = **1 par défaut** (global), **surchargeable par produit**
  (0 = au plus juste, 2 = produit critique).
- La **période à couvrir** devient donc `D1 → D(2 + safetyDeliveries)` (au lieu de `D1 → D2`).
- ⚠️ **Interaction avec le plafond congélo (§7)** : le filet demande *plus* de stock, le
  plafond *limite*. Si le filet ne rentre pas, on commande le maximum possible et on
  avertit (« filet de sécurité réduit, place insuffisante »).

### Alerte rupture avant livraison (§12.3 CCTP)
Si `stock_actuel < conso(maintenant → D1)` : afficher **« Risque de rupture avant
la prochaine livraison »**. Cette alerte n'est **pas** masquée par la commande
proposée (la commande n'arrivera pas assez tôt).

## 7. Plafond congélo (besoin explicite de la responsable)

Chaque produit a une **capacité max de stockage** (`products.max_stock`, en unités
ou en conditionnements). La commande proposée ne doit **jamais** faire dépasser :

```
commande_max = max(0, capacité_max − stock_projeté_avant_D1)
commande     = min(commande_calculée, commande_max)
```

Si la couverture souhaitée dépasse la capacité → **commande plafonnée** + alerte
« Il faudrait N cartons pour couvrir, mais le congélo n'en accepte que M ».

## 8. Contrôle visuel avant validation

Avant de valider une commande, un **contrôle visuel rapide** (pas un inventaire)
recale l'estimation. La responsable indique, par produit, ce qu'il reste **à la
louche** : **cartons pleins** + **carton entamé** (affiché en pièces : ¼ d'un carton
de 24 = 6, pas en %).

- Une appréciation approximative **ne modifie pas** automatiquement le stock.
- Elle est conservée avec la commande, alerte si écart, et permet d'ajuster la quantité.
- Un **comptage exact** peut donner une **correction de stock**, mais uniquement
  après confirmation explicite (= mini-inventaire).

**Réconciliation théorique vs vérifié (deux chiffres possibles).** Le contrôle visuel
peut différer du stock théorique. Règle :
- **Pour la commande, le vérifié prime** (la responsable vient de regarder).
- **Le stock stocké n'est pas réécrit automatiquement** — un contrôle « à la louche » ne
  doit pas écraser silencieusement le théorique.
- Le recalage n'est proposé **que si l'écart dépasse 20 %** du stock théorique. En dessous,
  on ajuste seulement la commande, sans rien proposer.
- Au-delà de 20 %, l'écart est **affiché** (« Théorique 28 · vu 19 · écart −9 ») et :
  - une **responsable** voit **« Recaler le stock »** → écrit une **correction tracée**
    (`stock_movements`, §0) alignant le théorique sur ce qui a été vu ;
  - une **vendeuse** voit **« Proposer un recalage »** → crée une **proposition** en attente
    de validation par la responsable (§13). Elle ne corrige pas le stock elle-même.
- Sans recalage validé, le contrôle ne sert qu'à ajuster cette commande.
- Une commande n'est validable que si les lignes requises ont un statut de contrôle
  (ou qu'un responsable a explicitement ignoré le contrôle avec un motif).

## 9. Cycle de vie d'une commande (V1)

```
brouillon_calculé → contrôle_visuel → prête → validée → commandée → reçue → clôturée
                                                                   ↘ annulée
```

- **brouillon / contrôle / validée** : aucun effet sur le stock.
- **commandée** : quantité visible en **stock attendu** uniquement. On enregistre
  date/heure d'envoi, utilisateur, canal (**téléphone** en V1), réf éventuelle.
- On conserve toujours : quantité **proposée** par le système, quantité **après
  contrôle**, quantité **finale** commandée, motif de modification, qui/quand.
- **Note libre par ligne** de commande (suit la ligne jusqu'à la réception).
- **Export** : bon de commande PDF + récap texte copiable (pour l'appel téléphonique).

## 10. Réception (simplifiée V1 — pas de reliquat)

> Décision : « ce qui compte, c'est ce qui est vraiment rentré. Reliquat ou annulé,
> on s'en fout. »

- On ouvre la commande ; les lignes sont **pré-remplies** avec la quantité commandée.
- Cas normal : **« Livraison conforme »** en un geste → tout entre en stock.
- Ligne différente : on **baisse la quantité acceptée** à ce qui est réellement rentré.
- **Seule la quantité acceptée** génère un mouvement `reception` (entrée en stock).
- **Note libre par ligne** (« abîmé », « pas livré », « rupture fournisseur »…).
- **Pas de reliquat** : le manquant n'entre pas en stock. Comme le stock reste bas,
  **la prochaine proposition de commande le re-propose automatiquement** (auto-réparation).
- **Une commande = une réception, puis clôturée.** Pas de 2ᵉ réception rattachée.
  Un carton qui arrive plus tard → correction de stock manuelle (cas rare).

La réception est une **transaction unique** : création de la réception + lignes +
mouvements de stock + statut de commande + audit. **Idempotente** (protégée contre
le double-clic via une clé d'idempotence).

## 11. Inventaire re-faisable à volonté

L'inventaire n'est **pas** qu'un démarrage. Il est **refaisable à tout moment**
(complet ou sur quelques produits) et **recale le stock au réel** :

```
Pour chaque produit compté :
  écart = compté − théorique
  si écart ≠ 0 → mouvement de correction (± écart)  ← jamais d'écrasement
  théorique devient = compté
```

L'écart est **tracé et conservé** (historique des dérives → apprentissage, détection
des sorties oubliées). L'inventaire initial est un cas particulier (mouvements de type
`initial`).

## 12. Sortie du congélateur (le cœur, temps réel)

- Extrêmement rapide : chercher/scanner un produit → quantité → confirmer.
- Chaque sortie **diminue immédiatement** le stock théorique.
- Favoris, dernières références, pavé numérique mobile, quantités fréquentes,
  correction de la **dernière** saisie (selon droits).
- **Atomique et idempotente** : deux utilisateurs peuvent sortir en même temps sans
  qu'une sortie en écrase une autre (clé d'idempotence + transaction serveur).
- **Stock négatif interdit par défaut.** Un responsable peut forcer avec motif
  obligatoire + journalisation + alerte d'inventaire.

## 12bis. Préparations (sorties groupées récurrentes)

Dans la réalité, la responsable ne sort pas les produits un par un : elle sort une
**préparation** — un groupe de produits d'un coup. Certaines sont **récurrentes**
(« prépa du matin » : toujours à peu près le même pain + viennoiseries).

Le terme retenu est **« préparation »** (pas « fournée ») car tout ne passe pas au
four : certains produits sont juste **mis à décongeler**. Pour le stock, **cuisson ou
décongélation, c'est identique** : sorti du congélateur = décompté (§1). L'application
**ne distingue pas** four / décongélation (décision : inutile en V1).

La sortie se fait le plus souvent **par lot**. L'écran Sortie propose **3 modes** :

1. **Prépa standard** — le lot pré-formaté fait quasi tout le temps (modèle enregistré :
   nom + produits + quantités par défaut, `prep-…`). Sélection → quantités pré-remplies,
   ajustables → une seule validation sort tout. Ex. « Prépa du matin ».
2. **Prépa new** — un lot **composé sur le moment** (parce qu'on voit qu'on va manquer) :
   on ajoute des produits + quantités, on sort le lot. Optionnellement **enregistrable
   comme prépa standard** s'il revient souvent.
3. **Unités** — sortie d'**un seul produit** (ex. une baguette encore congelée pour un client).
- Côté journal : une préparation crée **un mouvement `sortie` par produit**, mais tous
  **rattachés à la même préparation** (id + libellé + horodatage). Bénéfices : traçabilité,
  **annulation groupée** de toute la préparation, et prévision de conso plus juste
  (les sorties suivent des préparations récurrentes).

Modèle de données prévu : `prep_templates` / `prep_template_lines` (les modèles) et un
`prep_batch_id` sur les `stock_movements` d'une même sortie groupée.

**Gestion des préparations (administrable par la responsable)** : écran de création /
modification d'une préparation — nom, horaire indicatif, et **choix des produits + quantités
par défaut** de chaque ligne. Les préparations types sont donc **créées par l'utilisatrice**,
pas figées. (Les prépas de démo ne sont que des exemples.)

**Traçabilité obligatoire de chaque sortie** : tout mouvement (sortie simple ou préparation)
enregistre **l'horodatage du clic** (`created_at`, Europe/Paris) et **l'auteur** (`user_id` =
utilisateur connecté). Pour une préparation, chaque ligne partage le même horodatage, le même
auteur et le même `prep_batch_id`. Rien n'est modifiable après coup (journal non destructif §0) ;
l'historique montre « qui a sorti quoi, quand ».

## 13. Rôles et connexion (multi-personnes, une seule en service à la fois)

**Réalité terrain** : une seule personne à la boulangerie à un instant donné, mais elle
**change selon le service** (une le matin, une l'après-midi). Chaque personne a son compte.

**Connexion par service** :
- Sur le **téléphone perso** de la personne : session persistante (reste connectée).
- Sur le **pad partagé** de la boulangerie : on se connecte en début de service, et un
  bouton **« changer d'utilisateur »** permet la bascule à la relève.
- **Toutes les actions du service sont attribuées à la personne connectée** — la
  traçabilité « qui a fait quoi » est automatique, sans rien saisir (§12bis).

**Deux rôles en V1** (le schéma sait en exprimer plus). Le rôle est **attaché à la
personne** et modifiable : on peut nommer une vendeuse « responsable ».

| Rôle | Peut faire |
|---|---|
| **vendeuse** | **Tout le cycle quotidien** : sorties, exécuter les préparations, préparer / passer les commandes, réceptionner les livraisons. Pour les **actions sensibles** (recalage de stock, grosses corrections), elle **propose** — elle ne valide pas. |
| **responsable** | **Tous les droits de la vendeuse** + **valider les propositions**, recaler/corriger le stock, et la **configuration** (produits, familles, prépas, fournisseurs, réglages, comptes). |

**Actions sensibles = proposition → validation.** Une vendeuse qui constate un gros écart
propose un recalage ; il passe en **proposition** et le **responsable le valide** (ou le
refuse). La commande, elle, n'est pas bloquée : elle utilise ce qui a été vu (§8).

Les contrôles de droits ne sont **jamais uniquement graphiques** : ils sont appliqués aussi
en **RLS** et dans les **fonctions PostgreSQL**. Un `site_id` est porté partout pour permettre
le multi-boutique plus tard (une seule boutique en V1).

## 14. Hors périmètre V1 (repoussé, place gardée en base)

Reliquats · jours fériés/fermetures automatiques · saisonnalité/événements ·
lots & DLC · produits de remplacement · inventaire tournant intelligent ·
3 rôles dans l'UI · multi-site dans l'UI · temps réel multi-terminal ·
mode hors-ligne PWA avec file de synchro · statistiques poussées.

Chacun se **branche** sur le socle V1 sans le réécrire.
