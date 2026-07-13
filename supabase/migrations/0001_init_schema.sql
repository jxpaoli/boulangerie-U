-- =====================================================================
--  Point Chaud — schéma initial
--  Base Supabase PARTAGÉE (multi-appli) : tout est isolé dans le schéma
--  dédié `point_chaud` pour éviter toute collision avec les autres applis.
--
--  Après application : exposer le schéma `point_chaud` dans
--  Dashboard > Settings > API > Exposed schemas, et configurer le client
--  JS avec { db: { schema: 'point_chaud' } } (voir docs/DEPLOYMENT.md).
--
--  Conventions :
--   - jours de semaine : 0 = lundi … 6 = dimanche
--   - stock en UNITÉS ; commande en conditionnements (pack_size unités/conditionnement)
--   - journal de mouvements NON DESTRUCTIF (aucune quantité écrasée)
-- =====================================================================

create schema if not exists point_chaud;

-- gen_random_uuid()
create extension if not exists pgcrypto with schema public;

-- --------------------------------------------------------------------
-- Sites (une seule boulangerie en V1 ; site_id partout pour extension)
-- --------------------------------------------------------------------
create table point_chaud.sites (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  timezone     text not null default 'Europe/Paris',
  created_at   timestamptz not null default now()
);

-- --------------------------------------------------------------------
-- Profils : mappe un utilisateur Supabase Auth (global au projet) vers
-- CETTE appli + son rôle. Être présent ici = avoir accès à l'appli.
-- --------------------------------------------------------------------
create table point_chaud.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  site_id      uuid not null references point_chaud.sites (id),
  display_name text not null,
  role         text not null default 'vendeuse' check (role in ('vendeuse', 'responsable')),
  active       boolean not null default true,
  created_at   timestamptz not null default now()
);
create index on point_chaud.profiles (site_id);

-- --------------------------------------------------------------------
-- Paramètres appli (par site)
-- --------------------------------------------------------------------
create table point_chaud.app_settings (
  site_id              uuid primary key references point_chaud.sites (id) on delete cascade,
  safety_deliveries    smallint not null default 1 check (safety_deliveries >= 0), -- filet +1 livraison
  recalibration_threshold numeric not null default 0.20 check (recalibration_threshold >= 0), -- 20 %
  updated_at           timestamptz not null default now()
);

-- --------------------------------------------------------------------
-- Familles de produits
-- --------------------------------------------------------------------
create table point_chaud.product_categories (
  id          uuid primary key default gen_random_uuid(),
  site_id     uuid not null references point_chaud.sites (id) on delete cascade,
  name        text not null,
  position    int not null default 0,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  unique (site_id, name)
);
create index on point_chaud.product_categories (site_id);

-- --------------------------------------------------------------------
-- Emplacements de stockage (congélateur ; simple en V1)
-- --------------------------------------------------------------------
create table point_chaud.storage_locations (
  id          uuid primary key default gen_random_uuid(),
  site_id     uuid not null references point_chaud.sites (id) on delete cascade,
  name        text not null,
  created_at  timestamptz not null default now()
);

-- --------------------------------------------------------------------
-- Produits (référence interne)
-- --------------------------------------------------------------------
create table point_chaud.products (
  id             uuid primary key default gen_random_uuid(),
  site_id        uuid not null references point_chaud.sites (id) on delete cascade,
  category_id    uuid references point_chaud.product_categories (id) on delete set null,
  location_id    uuid references point_chaud.storage_locations (id) on delete set null,
  name           text not null,
  internal_ref   text,
  unit_label     text not null default 'pièce',   -- unité de comptage du stock
  min_units      int not null default 0 check (min_units >= 0),      -- seuil mini indicatif
  max_units      int check (max_units is null or max_units >= 0),    -- plafond congélo (place)
  safety_deliveries smallint check (safety_deliveries is null or safety_deliveries >= 0), -- override du filet
  active         boolean not null default true,
  created_by     uuid references auth.users (id),
  updated_by     uuid references auth.users (id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index on point_chaud.products (site_id);
create index on point_chaud.products (category_id);

-- --------------------------------------------------------------------
-- Fournisseurs (+ règle de calendrier V1 inline)
-- --------------------------------------------------------------------
create table point_chaud.suppliers (
  id             uuid primary key default gen_random_uuid(),
  site_id        uuid not null references point_chaud.sites (id) on delete cascade,
  name           text not null,
  usual_name     text,
  phone          text,
  contact_name   text,
  email          text,
  order_channel  text,                       -- 'phone' en V1
  active         boolean not null default true,
  notes          text,
  -- calendrier (V1 simple ; voir supplier_order_rules pour extensions futures)
  order_days     smallint[] not null default '{}',   -- jours de commande (0=lundi)
  cutoff_time    time not null default '11:00',
  delivery_mode  text not null default 'lead' check (delivery_mode in ('lead', 'mapping')),
  lead_days      smallint not null default 1 check (lead_days >= 0),
  lead_kind      text not null default 'calendar' check (lead_kind in ('calendar', 'business')),
  no_weekend_delivery boolean not null default true,
  delivery_map   jsonb not null default '[]',        -- [{orderDay,deliveryDay,weeksAhead}]
  created_by     uuid references auth.users (id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index on point_chaud.suppliers (site_id);

-- Règles fournisseurs détaillées (réservé aux extensions : saisonnalité, exceptions…)
create table point_chaud.supplier_order_rules (
  id           uuid primary key default gen_random_uuid(),
  supplier_id  uuid not null references point_chaud.suppliers (id) on delete cascade,
  rule         jsonb not null,
  valid_from   date,
  valid_to     date,
  priority     int not null default 0,
  created_at   timestamptz not null default now()
);

-- Fermetures / exceptions (gérées à la main en V1 ; place gardée)
create table point_chaud.supplier_closures (
  id           uuid primary key default gen_random_uuid(),
  supplier_id  uuid not null references point_chaud.suppliers (id) on delete cascade,
  closed_on    date not null,
  reason       text
);

-- --------------------------------------------------------------------
-- Référence fournisseur d'un produit + conditionnement
-- --------------------------------------------------------------------
create table point_chaud.supplier_products (
  id                  uuid primary key default gen_random_uuid(),
  site_id             uuid not null references point_chaud.sites (id) on delete cascade,
  supplier_id         uuid not null references point_chaud.suppliers (id) on delete cascade,
  product_id          uuid not null references point_chaud.products (id) on delete cascade,
  supplier_ref        text,
  supplier_label      text,
  order_unit          text not null default 'carton',
  pack_size           int not null check (pack_size > 0),   -- unités de stock par conditionnement
  min_order_packs     int not null default 0 check (min_order_packs >= 0),
  order_multiple_packs int not null default 1 check (order_multiple_packs >= 1),
  price               numeric(10, 2),
  is_primary          boolean not null default true,
  priority            int not null default 0,
  active              boolean not null default true,
  created_at          timestamptz not null default now(),
  unique (supplier_id, product_id)
);
create index on point_chaud.supplier_products (product_id);
create index on point_chaud.supplier_products (supplier_id);

-- --------------------------------------------------------------------
-- Prévisions de conso par jour de semaine
-- --------------------------------------------------------------------
create table point_chaud.forecast_settings (
  product_id   uuid primary key references point_chaud.products (id) on delete cascade,
  site_id      uuid not null references point_chaud.sites (id) on delete cascade,
  method       text not null default 'manual' check (method in ('manual', 'learned')),
  window_weeks smallint not null default 8 check (window_weeks > 0),
  conso_mon    int not null default 0 check (conso_mon >= 0),
  conso_tue    int not null default 0 check (conso_tue >= 0),
  conso_wed    int not null default 0 check (conso_wed >= 0),
  conso_thu    int not null default 0 check (conso_thu >= 0),
  conso_fri    int not null default 0 check (conso_fri >= 0),
  conso_sat    int not null default 0 check (conso_sat >= 0),
  conso_sun    int not null default 0 check (conso_sun >= 0),
  updated_at   timestamptz not null default now()
);

-- --------------------------------------------------------------------
-- Préparations (lots récurrents) — « prépa standard »
-- --------------------------------------------------------------------
create table point_chaud.prep_templates (
  id          uuid primary key default gen_random_uuid(),
  site_id     uuid not null references point_chaud.sites (id) on delete cascade,
  name        text not null,
  time_label  text,
  active      boolean not null default true,
  created_by  uuid references auth.users (id),
  created_at  timestamptz not null default now()
);
create table point_chaud.prep_template_lines (
  id            uuid primary key default gen_random_uuid(),
  template_id   uuid not null references point_chaud.prep_templates (id) on delete cascade,
  product_id    uuid not null references point_chaud.products (id) on delete cascade,
  default_units int not null check (default_units >= 0),
  unique (template_id, product_id)
);

-- --------------------------------------------------------------------
-- Journal de mouvements de stock (NON DESTRUCTIF)
--   qty_units signé : entrées > 0, sorties < 0
--   le stock d'un produit = somme des qty_units de ses mouvements
-- --------------------------------------------------------------------
create table point_chaud.stock_movements (
  id             uuid primary key default gen_random_uuid(),
  site_id        uuid not null references point_chaud.sites (id) on delete cascade,
  product_id     uuid not null references point_chaud.products (id) on delete restrict,
  qty_units      int not null check (qty_units <> 0),
  type           text not null check (type in ('initial', 'reception', 'exit', 'correction')),
  reason         text,
  note           text,
  prep_batch_id  uuid,      -- regroupe une sortie « préparation »
  delivery_id    uuid,      -- réception d'origine
  order_id       uuid,      -- commande d'origine
  count_id       uuid,      -- inventaire d'origine
  related_movement_id uuid references point_chaud.stock_movements (id), -- mouvement compensé
  created_by     uuid references auth.users (id),
  created_at     timestamptz not null default now()
);
create index on point_chaud.stock_movements (product_id, created_at);
create index on point_chaud.stock_movements (site_id, created_at);
create index on point_chaud.stock_movements (prep_batch_id);

-- Cohérence des signes selon le type
alter table point_chaud.stock_movements
  add constraint chk_movement_sign check (
    (type = 'exit' and qty_units < 0)
    or (type in ('initial', 'reception') and qty_units > 0)
    or (type = 'correction')  -- correction : +/-
  );

-- --------------------------------------------------------------------
-- Inventaires
-- --------------------------------------------------------------------
create table point_chaud.stock_counts (
  id          uuid primary key default gen_random_uuid(),
  site_id     uuid not null references point_chaud.sites (id) on delete cascade,
  kind        text not null check (kind in ('initial', 'full', 'partial')),
  status      text not null default 'open' check (status in ('open', 'validated', 'cancelled')),
  created_by  uuid references auth.users (id),
  validated_by uuid references auth.users (id),
  created_at  timestamptz not null default now(),
  validated_at timestamptz
);
create table point_chaud.stock_count_lines (
  id            uuid primary key default gen_random_uuid(),
  count_id      uuid not null references point_chaud.stock_counts (id) on delete cascade,
  product_id    uuid not null references point_chaud.products (id) on delete restrict,
  counted_units int not null check (counted_units >= 0),
  theoretical_units int,               -- photo du théorique au moment du comptage
  note          text,
  unique (count_id, product_id)
);

-- --------------------------------------------------------------------
-- Commandes
-- --------------------------------------------------------------------
create table point_chaud.purchase_orders (
  id             uuid primary key default gen_random_uuid(),
  site_id        uuid not null references point_chaud.sites (id) on delete cascade,
  supplier_id    uuid not null references point_chaud.suppliers (id) on delete restrict,
  status         text not null default 'draft' check (status in (
                   'draft', 'visual_check', 'ready', 'validated', 'ordered',
                   'received', 'closed', 'cancelled')),
  cover_from     date,   -- D1
  cover_until    date,   -- D(2 + filet)
  channel        text,
  external_ref   text,
  note           text,
  created_by     uuid references auth.users (id),
  validated_by   uuid references auth.users (id),
  sent_at        timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index on point_chaud.purchase_orders (site_id, status);

create table point_chaud.purchase_order_lines (
  id                 uuid primary key default gen_random_uuid(),
  order_id           uuid not null references point_chaud.purchase_orders (id) on delete cascade,
  product_id         uuid not null references point_chaud.products (id) on delete restrict,
  supplier_product_id uuid references point_chaud.supplier_products (id) on delete set null,
  pack_size          int not null check (pack_size > 0),
  proposed_packs     int not null default 0 check (proposed_packs >= 0),
  checked_packs      int check (checked_packs is null or checked_packs >= 0),  -- après contrôle visuel
  final_packs        int not null default 0 check (final_packs >= 0),
  visual_check       jsonb,   -- {full, partIdx, seenUnits, theoreticalUnits}
  note               text,
  unique (order_id, product_id)
);

-- Historique des statuts de commande
create table point_chaud.order_status_history (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null references point_chaud.purchase_orders (id) on delete cascade,
  status      text not null,
  actor       uuid references auth.users (id),
  at          timestamptz not null default now()
);

-- --------------------------------------------------------------------
-- Réceptions (accepté seulement ; pas de reliquat en V1)
-- --------------------------------------------------------------------
create table point_chaud.deliveries (
  id           uuid primary key default gen_random_uuid(),
  site_id      uuid not null references point_chaud.sites (id) on delete cascade,
  order_id     uuid references point_chaud.purchase_orders (id) on delete set null,
  supplier_id  uuid not null references point_chaud.suppliers (id) on delete restrict,
  status       text not null default 'draft' check (status in ('draft', 'validated', 'cancelled')),
  received_by  uuid references auth.users (id),
  received_at  timestamptz,
  idempotency_key text unique,   -- anti double-clic
  created_at   timestamptz not null default now()
);
create table point_chaud.delivery_lines (
  id             uuid primary key default gen_random_uuid(),
  delivery_id    uuid not null references point_chaud.deliveries (id) on delete cascade,
  product_id     uuid not null references point_chaud.products (id) on delete restrict,
  ordered_units  int not null default 0 check (ordered_units >= 0),
  accepted_units int not null default 0 check (accepted_units >= 0),
  note           text,
  unique (delivery_id, product_id)
);

-- Justificatifs de livraison (Supabase Storage)
create table point_chaud.delivery_documents (
  id           uuid primary key default gen_random_uuid(),
  delivery_id  uuid not null references point_chaud.deliveries (id) on delete cascade,
  storage_path text not null,
  kind         text,
  created_at   timestamptz not null default now()
);

-- --------------------------------------------------------------------
-- Propositions de correction de stock (vendeuse propose -> responsable valide)
-- --------------------------------------------------------------------
create table point_chaud.stock_correction_proposals (
  id                uuid primary key default gen_random_uuid(),
  site_id           uuid not null references point_chaud.sites (id) on delete cascade,
  product_id        uuid not null references point_chaud.products (id) on delete cascade,
  theoretical_units int not null,
  seen_units        int not null check (seen_units >= 0),
  delta_units       int not null,   -- seen - theoretical
  status            text not null default 'pending' check (status in ('pending', 'validated', 'rejected')),
  source            text,           -- 'order_visual_check', 'inventory'…
  proposed_by       uuid references auth.users (id),
  resolved_by       uuid references auth.users (id),
  movement_id       uuid references point_chaud.stock_movements (id), -- correction créée si validée
  created_at        timestamptz not null default now(),
  resolved_at       timestamptz
);
create index on point_chaud.stock_correction_proposals (site_id, status);

-- --------------------------------------------------------------------
-- Journal d'audit (non modifiable par un utilisateur standard)
-- --------------------------------------------------------------------
create table point_chaud.audit_logs (
  id          uuid primary key default gen_random_uuid(),
  site_id     uuid references point_chaud.sites (id) on delete set null,
  actor       uuid references auth.users (id),
  action      text not null,
  entity      text,
  entity_id   uuid,
  details     jsonb,
  created_at  timestamptz not null default now()
);
create index on point_chaud.audit_logs (site_id, created_at);

-- --------------------------------------------------------------------
-- Vue de solde de stock (théorique) = somme des mouvements
-- --------------------------------------------------------------------
create view point_chaud.stock_balances
  with (security_invoker = true) as
select
  p.id            as product_id,
  p.site_id       as site_id,
  coalesce(sum(m.qty_units), 0) as stock_units
from point_chaud.products p
left join point_chaud.stock_movements m on m.product_id = p.id
group by p.id, p.site_id;

comment on schema point_chaud is 'Application Point Chaud — stock congelé, commandes, réceptions (isolée du reste de la base partagée).';
