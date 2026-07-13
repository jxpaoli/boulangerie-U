# Modèle de données — Point Chaud

Source de vérité : `supabase/migrations/`. Ce document en donne la vue d'ensemble.

## Isolation

Toutes les tables vivent dans le schéma Postgres **`point_chaud`** (base Supabase
partagée entre plusieurs applis). Aucune table dans `public`. L'API expose ce schéma
et le client JS est configuré avec `{ db: { schema: 'point_chaud' } }`.

Convention : jours de semaine **0 = lundi … 6 = dimanche**. Stock en **unités** ;
commande en **conditionnements** (`pack_size` = unités par conditionnement).

## Tables

### Organisation & accès
| Table | Rôle |
|---|---|
| `sites` | La boulangerie (1 ligne en V1). `site_id` porté partout. |
| `profiles` | Mappe un utilisateur Supabase Auth → ce site + son **rôle** (`vendeuse`/`responsable`). Présence = accès. |
| `app_settings` | Réglages du site : `safety_deliveries` (filet +1 livraison), `recalibration_threshold` (20 %). |

### Catalogue
| Table | Rôle |
|---|---|
| `product_categories` | Familles (Baguettes, Pains…), avec `position` d'affichage. |
| `storage_locations` | Emplacements (congélateur ; simple en V1). |
| `products` | Produit interne : nom, réf, `min_units`, `max_units` (plafond congélo), `safety_deliveries` (override). |
| `suppliers` | Fournisseur + **calendrier V1 inline** : `order_days[]`, `cutoff_time`, `delivery_mode` (`lead`/`mapping`), `lead_days`, `lead_kind`, `no_weekend_delivery`, `delivery_map`. |
| `supplier_products` | Réf fournisseur d'un produit + **conditionnement** : `pack_size`, `min_order_packs`, `order_multiple_packs`, prix. |
| `supplier_order_rules`, `supplier_closures` | Extensions futures (saisonnalité, fermetures) — gérées à la main en V1. |
| `forecast_settings` | Conso par jour de semaine (`conso_mon`…`conso_sun`) + méthode. |
| `prep_templates` / `prep_template_lines` | **Préparations standard** (lots récurrents) + leurs lignes. |

### Stock (journal non destructif)
| Table | Rôle |
|---|---|
| `stock_movements` | **Le journal.** `qty_units` signé (entrées > 0, sorties < 0), `type` (`initial`/`reception`/`exit`/`correction`), `prep_batch_id` (sortie groupée), `related_movement_id` (compensation), auteur + horodatage. **Jamais modifié.** |
| `stock_balances` (vue) | Solde théorique = `sum(qty_units)` par produit. `security_invoker` → respecte la RLS. |
| `stock_counts` / `stock_count_lines` | Inventaires (initial / complet / tournant) + comptages. |
| `stock_correction_proposals` | **Propositions de recalage** (vendeuse propose → responsable valide). |

### Commandes
| Table | Rôle |
|---|---|
| `purchase_orders` | Statuts (`draft`→`ordered`→`received`→`closed`/`cancelled`), `cover_from`/`cover_until`, qui/quand. |
| `purchase_order_lines` | `proposed_packs`, `checked_packs` (contrôle visuel), `final_packs`, `visual_check` (jsonb), note. |
| `order_status_history` | Trace des changements de statut. |

### Réceptions
| Table | Rôle |
|---|---|
| `deliveries` | Réception d'une commande, `idempotency_key` (anti double-clic). |
| `delivery_lines` | `ordered_units`, **`accepted_units`** (seul l'accepté entre en stock). |
| `delivery_documents` | Justificatifs (Supabase Storage). |

### Audit
| Table | Rôle |
|---|---|
| `audit_logs` | Opérations sensibles ; non modifiable par un utilisateur standard. |

## Contraintes clés (garanties par la base)
- `pack_size > 0`, `order_multiple_packs >= 1`, quantités `>= 0`, `accepted_units >= 0`.
- `stock_movements.qty_units <> 0` + cohérence des signes selon le `type`.
- Unicité : `supplier_products (supplier_id, product_id)`, `product_categories (site_id, name)`, etc.
- `deliveries.idempotency_key` unique → pas de double réception.

## Hors V1 (place gardée, non implémenté)
Lots & DLC, produits de remplacement, multi-site actif, reliquats (voir BUSINESS_RULES §14).
