-- ==================================================================
-- Point Chaud — APPLIQUER TOUT (migrations 0001 -> 0004)
-- À coller dans l'éditeur SQL Supabase (projet lrittnexagnqcnnxbzrx).
-- Le DROP en tête permet de relancer proprement pendant l'installation.
-- ==================================================================

-- Reset propre (phase installation — aucune vraie donnée encore) :
drop schema if exists point_chaud cascade;


-- ############ supabase/migrations/0001_init_schema.sql ############

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

-- ############ supabase/migrations/0002_rls.sql ############

-- =====================================================================
--  Point Chaud — sécurité (grants + Row Level Security)
--  Isolation par site + rôles (vendeuse / responsable). Voir docs/SECURITY.md.
--  Principe : lecture = membres du site ; écriture config = responsable ;
--  écritures opérationnelles = via fonctions SECURITY DEFINER (0003).
-- =====================================================================

-- --------------------------------------------------------------------
-- Accès du schéma isolé à l'API (PostgREST : rôle `authenticated`)
-- --------------------------------------------------------------------
grant usage on schema point_chaud to authenticated;
-- lecture par défaut sur les tables (RLS filtrera les lignes)
grant select on all tables in schema point_chaud to authenticated;
grant select on point_chaud.stock_balances to authenticated;
-- pas d'accès anonyme
revoke all on schema point_chaud from anon;

-- --------------------------------------------------------------------
-- Fonctions d'aide (SECURITY DEFINER : lisent profiles sans récursion RLS)
-- --------------------------------------------------------------------
create or replace function point_chaud.current_site_id()
returns uuid
language sql
stable
security definer
set search_path = point_chaud, public
as $$
  select site_id from point_chaud.profiles
  where id = auth.uid() and active = true
  limit 1
$$;

create or replace function point_chaud.current_role()
returns text
language sql
stable
security definer
set search_path = point_chaud, public
as $$
  select role from point_chaud.profiles
  where id = auth.uid() and active = true
  limit 1
$$;

create or replace function point_chaud.is_member()
returns boolean
language sql
stable
security definer
set search_path = point_chaud, public
as $$
  select exists (
    select 1 from point_chaud.profiles
    where id = auth.uid() and active = true
  )
$$;

create or replace function point_chaud.is_responsable()
returns boolean
language sql
stable
security definer
set search_path = point_chaud, public
as $$
  select exists (
    select 1 from point_chaud.profiles
    where id = auth.uid() and active = true and role = 'responsable'
  )
$$;

revoke all on function point_chaud.current_site_id() from public;
revoke all on function point_chaud.current_role() from public;
revoke all on function point_chaud.is_member() from public;
revoke all on function point_chaud.is_responsable() from public;
grant execute on function point_chaud.current_site_id() to authenticated;
grant execute on function point_chaud.current_role() to authenticated;
grant execute on function point_chaud.is_member() to authenticated;
grant execute on function point_chaud.is_responsable() to authenticated;

-- --------------------------------------------------------------------
-- Activation de la RLS sur toutes les tables exposées
-- --------------------------------------------------------------------
do $$
declare t text;
begin
  for t in
    select tablename from pg_tables where schemaname = 'point_chaud'
  loop
    execute format('alter table point_chaud.%I enable row level security;', t);
    execute format('alter table point_chaud.%I force row level security;', t);
  end loop;
end $$;

-- --------------------------------------------------------------------
-- Politique de LECTURE générique : membres du même site
--   (profiles : on peut lire les profils de son site)
-- --------------------------------------------------------------------
-- Tables « filles » sans colonne site_id (elles héritent via leur parent) :
-- policies dédiées plus bas. On les EXCLUT de la boucle générique.
do $$
declare t text;
begin
  for t in
    select tablename from pg_tables where schemaname = 'point_chaud'
      and tablename not in (
        'sites',
        'supplier_order_rules', 'supplier_closures', 'prep_template_lines',
        'stock_count_lines', 'purchase_order_lines', 'order_status_history',
        'delivery_lines', 'delivery_documents'
      )
  loop
    execute format($f$
      create policy pc_select_same_site on point_chaud.%I
        for select to authenticated
        using (site_id = point_chaud.current_site_id());
    $f$, t);
  end loop;
end $$;

-- sites : un membre voit son site
create policy pc_sites_select on point_chaud.sites
  for select to authenticated
  using (id = point_chaud.current_site_id());

-- Tables sans colonne site_id : politiques dédiées (via la table parente)
-- (supplier_order_rules, supplier_closures, prep_template_lines,
--  stock_count_lines, purchase_order_lines, order_status_history,
--  delivery_lines, delivery_documents) — remplacer la policy générique.
drop policy if exists pc_select_same_site on point_chaud.supplier_order_rules;
create policy pc_sor_select on point_chaud.supplier_order_rules
  for select to authenticated using (exists (
    select 1 from point_chaud.suppliers s
    where s.id = supplier_id and s.site_id = point_chaud.current_site_id()));

drop policy if exists pc_select_same_site on point_chaud.supplier_closures;
create policy pc_sc_select on point_chaud.supplier_closures
  for select to authenticated using (exists (
    select 1 from point_chaud.suppliers s
    where s.id = supplier_id and s.site_id = point_chaud.current_site_id()));

drop policy if exists pc_select_same_site on point_chaud.prep_template_lines;
create policy pc_ptl_select on point_chaud.prep_template_lines
  for select to authenticated using (exists (
    select 1 from point_chaud.prep_templates t
    where t.id = template_id and t.site_id = point_chaud.current_site_id()));

drop policy if exists pc_select_same_site on point_chaud.stock_count_lines;
create policy pc_scl_select on point_chaud.stock_count_lines
  for select to authenticated using (exists (
    select 1 from point_chaud.stock_counts c
    where c.id = count_id and c.site_id = point_chaud.current_site_id()));

drop policy if exists pc_select_same_site on point_chaud.purchase_order_lines;
create policy pc_pol_select on point_chaud.purchase_order_lines
  for select to authenticated using (exists (
    select 1 from point_chaud.purchase_orders o
    where o.id = order_id and o.site_id = point_chaud.current_site_id()));

drop policy if exists pc_select_same_site on point_chaud.order_status_history;
create policy pc_osh_select on point_chaud.order_status_history
  for select to authenticated using (exists (
    select 1 from point_chaud.purchase_orders o
    where o.id = order_id and o.site_id = point_chaud.current_site_id()));

drop policy if exists pc_select_same_site on point_chaud.delivery_lines;
create policy pc_dl_select on point_chaud.delivery_lines
  for select to authenticated using (exists (
    select 1 from point_chaud.deliveries d
    where d.id = delivery_id and d.site_id = point_chaud.current_site_id()));

drop policy if exists pc_select_same_site on point_chaud.delivery_documents;
create policy pc_dd_select on point_chaud.delivery_documents
  for select to authenticated using (exists (
    select 1 from point_chaud.deliveries d
    where d.id = delivery_id and d.site_id = point_chaud.current_site_id()));

-- --------------------------------------------------------------------
-- Écritures de CONFIGURATION : responsable du site uniquement
--   (produits, familles, emplacements, fournisseurs, références,
--    prépas, prévisions, réglages)
-- --------------------------------------------------------------------
grant insert, update, delete on
  point_chaud.product_categories,
  point_chaud.storage_locations,
  point_chaud.products,
  point_chaud.suppliers,
  point_chaud.supplier_order_rules,
  point_chaud.supplier_closures,
  point_chaud.supplier_products,
  point_chaud.forecast_settings,
  point_chaud.prep_templates,
  point_chaud.prep_template_lines,
  point_chaud.app_settings
to authenticated;

-- helper de policy config (table avec site_id)
do $$
declare t text;
begin
  for t in
    select unnest(array[
      'product_categories','storage_locations','products','suppliers',
      'supplier_products','forecast_settings','prep_templates','app_settings'])
  loop
    execute format($f$
      create policy pc_cfg_write on point_chaud.%I
        for all to authenticated
        using (site_id = point_chaud.current_site_id() and point_chaud.is_responsable())
        with check (site_id = point_chaud.current_site_id() and point_chaud.is_responsable());
    $f$, t);
  end loop;
end $$;

-- config via table parente
create policy pc_ptl_write on point_chaud.prep_template_lines
  for all to authenticated
  using (point_chaud.is_responsable() and exists (
    select 1 from point_chaud.prep_templates t
    where t.id = template_id and t.site_id = point_chaud.current_site_id()))
  with check (point_chaud.is_responsable() and exists (
    select 1 from point_chaud.prep_templates t
    where t.id = template_id and t.site_id = point_chaud.current_site_id()));

create policy pc_sor_write on point_chaud.supplier_order_rules
  for all to authenticated
  using (point_chaud.is_responsable() and exists (
    select 1 from point_chaud.suppliers s
    where s.id = supplier_id and s.site_id = point_chaud.current_site_id()))
  with check (point_chaud.is_responsable() and exists (
    select 1 from point_chaud.suppliers s
    where s.id = supplier_id and s.site_id = point_chaud.current_site_id()));

create policy pc_scl_write on point_chaud.supplier_closures
  for all to authenticated
  using (point_chaud.is_responsable() and exists (
    select 1 from point_chaud.suppliers s
    where s.id = supplier_id and s.site_id = point_chaud.current_site_id()))
  with check (point_chaud.is_responsable() and exists (
    select 1 from point_chaud.suppliers s
    where s.id = supplier_id and s.site_id = point_chaud.current_site_id()));

-- --------------------------------------------------------------------
-- Profils : un membre lit les profils de son site ; seul un responsable
-- les gère. (Le bootstrap du 1er responsable se fait côté serveur / SQL.)
-- --------------------------------------------------------------------
grant insert, update, delete on point_chaud.profiles to authenticated;
create policy pc_profiles_write on point_chaud.profiles
  for all to authenticated
  using (site_id = point_chaud.current_site_id() and point_chaud.is_responsable())
  with check (site_id = point_chaud.current_site_id() and point_chaud.is_responsable());

-- --------------------------------------------------------------------
-- Tables opérationnelles : AUCUNE écriture directe.
--   stock_movements, stock_counts(+lines), purchase_orders(+lines),
--   order_status_history, deliveries(+lines/documents),
--   stock_correction_proposals, audit_logs
--   -> tout passe par les fonctions SECURITY DEFINER (0003), qui vérifient
--      rôle + site + cohérence et écrivent l'audit. Pas de grant insert/
--      update/delete ici : la RLS (sans policy d'écriture) refuse le direct.
-- --------------------------------------------------------------------
-- (lecture déjà couverte par les policies select ci-dessus)

-- ############ supabase/migrations/0003_functions.sql ############

-- =====================================================================
--  Point Chaud — fonctions transactionnelles (chemin d'écriture sécurisé)
--  SECURITY DEFINER : vérifient utilisateur + rôle + site + cohérence,
--  écrivent le journal non destructif et l'audit. Idempotentes.
--  Les tables opérationnelles n'ont PAS de policy d'écriture directe (0002) :
--  ces fonctions sont le seul moyen d'écrire.
-- =====================================================================

-- Stock théorique d'un produit = somme des mouvements
create or replace function point_chaud.stock_of(p_product_id uuid)
returns int
language sql
stable
security definer
set search_path = point_chaud, public
as $$
  select coalesce(sum(qty_units), 0)::int
  from point_chaud.stock_movements
  where product_id = p_product_id
$$;

-- Audit interne
create or replace function point_chaud._audit(
  p_site uuid, p_action text, p_entity text, p_entity_id uuid, p_details jsonb
) returns void
language sql
security definer
set search_path = point_chaud, public
as $$
  insert into point_chaud.audit_logs (site_id, actor, action, entity, entity_id, details)
  values (p_site, auth.uid(), p_action, p_entity, p_entity_id, p_details)
$$;

-- --------------------------------------------------------------------
-- SORTIE (unité, prépa standard, prépa new/lot) — groupée par p_batch_id
--   p_lines : [{ "product_id": uuid, "units": int }]
--   idempotent : re-appel avec le même p_batch_id ne recrée rien.
--   Stock négatif interdit sauf p_force (réservé au responsable).
-- --------------------------------------------------------------------
create or replace function point_chaud.record_exit(
  p_batch_id uuid,
  p_lines jsonb,
  p_note text default null,
  p_force boolean default false
) returns uuid
language plpgsql
security definer
set search_path = point_chaud, public
as $$
declare
  v_site uuid;
  v_line jsonb;
  v_pid uuid;
  v_units int;
  v_stock int;
begin
  if not point_chaud.is_member() then
    raise exception 'Accès refusé' using errcode = '42501';
  end if;
  v_site := point_chaud.current_site_id();

  -- idempotence : ce lot a déjà été enregistré
  if exists (select 1 from point_chaud.stock_movements where prep_batch_id = p_batch_id) then
    return p_batch_id;
  end if;

  for v_line in select * from jsonb_array_elements(p_lines)
  loop
    v_pid := (v_line ->> 'product_id')::uuid;
    v_units := (v_line ->> 'units')::int;
    if v_units is null or v_units <= 0 then
      continue;
    end if;

    perform 1 from point_chaud.products where id = v_pid and site_id = v_site;
    if not found then
      raise exception 'Produit hors site: %', v_pid using errcode = '42501';
    end if;

    v_stock := point_chaud.stock_of(v_pid);
    if v_units > v_stock then
      if not p_force then
        raise exception 'Stock insuffisant (%: reste %, demandé %)', v_pid, v_stock, v_units
          using errcode = 'P0001';
      end if;
      if not point_chaud.is_responsable() then
        raise exception 'Forçage du stock négatif réservé au responsable' using errcode = '42501';
      end if;
    end if;

    insert into point_chaud.stock_movements
      (site_id, product_id, qty_units, type, prep_batch_id, note, created_by)
    values
      (v_site, v_pid, -v_units, 'exit', p_batch_id, p_note, auth.uid());
  end loop;

  perform point_chaud._audit(v_site, 'exit', 'stock_movements', p_batch_id, p_lines);
  return p_batch_id;
end;
$$;

-- --------------------------------------------------------------------
-- RÉCEPTION — seule la quantité ACCEPTÉE entre en stock (pas de reliquat)
--   p_lines : [{ "product_id": uuid, "ordered_units": int, "accepted_units": int, "note": text }]
--   transaction unique : delivery + lignes + mouvements + statut commande + audit.
--   idempotent via p_idempotency_key.
-- --------------------------------------------------------------------
create or replace function point_chaud.receive_delivery(
  p_supplier_id uuid,
  p_order_id uuid,
  p_lines jsonb,
  p_idempotency_key text
) returns uuid
language plpgsql
security definer
set search_path = point_chaud, public
as $$
declare
  v_site uuid;
  v_delivery uuid;
  v_line jsonb;
  v_pid uuid;
  v_accepted int;
  v_ordered int;
begin
  if not point_chaud.is_member() then
    raise exception 'Accès refusé' using errcode = '42501';
  end if;
  v_site := point_chaud.current_site_id();

  -- idempotence
  select id into v_delivery from point_chaud.deliveries where idempotency_key = p_idempotency_key;
  if found then
    return v_delivery;
  end if;

  perform 1 from point_chaud.suppliers where id = p_supplier_id and site_id = v_site;
  if not found then
    raise exception 'Fournisseur hors site' using errcode = '42501';
  end if;

  insert into point_chaud.deliveries
    (site_id, order_id, supplier_id, status, received_by, received_at, idempotency_key)
  values
    (v_site, p_order_id, p_supplier_id, 'validated', auth.uid(), now(), p_idempotency_key)
  returning id into v_delivery;

  for v_line in select * from jsonb_array_elements(p_lines)
  loop
    v_pid := (v_line ->> 'product_id')::uuid;
    v_ordered := coalesce((v_line ->> 'ordered_units')::int, 0);
    v_accepted := coalesce((v_line ->> 'accepted_units')::int, 0);

    perform 1 from point_chaud.products where id = v_pid and site_id = v_site;
    if not found then
      raise exception 'Produit hors site: %', v_pid using errcode = '42501';
    end if;
    if v_accepted < 0 then
      raise exception 'Quantité acceptée négative' using errcode = 'P0001';
    end if;

    insert into point_chaud.delivery_lines
      (delivery_id, product_id, ordered_units, accepted_units, note)
    values
      (v_delivery, v_pid, v_ordered, v_accepted, v_line ->> 'note');

    -- seul l'accepté crée une entrée de stock
    if v_accepted > 0 then
      insert into point_chaud.stock_movements
        (site_id, product_id, qty_units, type, delivery_id, order_id, created_by)
      values
        (v_site, v_pid, v_accepted, 'reception', v_delivery, p_order_id, auth.uid());
    end if;
  end loop;

  -- clôture de la commande liée (V1 : une réception clôt la commande)
  if p_order_id is not null then
    update point_chaud.purchase_orders
      set status = 'received', updated_at = now()
      where id = p_order_id and site_id = v_site;
    insert into point_chaud.order_status_history (order_id, status, actor)
      values (p_order_id, 'received', auth.uid());
  end if;

  perform point_chaud._audit(v_site, 'reception', 'deliveries', v_delivery, p_lines);
  return v_delivery;
end;
$$;

-- --------------------------------------------------------------------
-- CORRECTION DE STOCK
--   apply_stock_correction  : responsable — corrige directement (mouvement tracé)
--   propose_stock_correction: vendeuse — crée une proposition en attente
--   resolve_stock_correction: responsable — valide/refuse une proposition
-- --------------------------------------------------------------------
create or replace function point_chaud.apply_stock_correction(
  p_product_id uuid,
  p_seen_units int,
  p_reason text default 'recalage'
) returns uuid
language plpgsql
security definer
set search_path = point_chaud, public
as $$
declare
  v_site uuid;
  v_theo int;
  v_delta int;
  v_mid uuid;
begin
  if not point_chaud.is_responsable() then
    raise exception 'Correction réservée au responsable' using errcode = '42501';
  end if;
  v_site := point_chaud.current_site_id();

  perform 1 from point_chaud.products where id = p_product_id and site_id = v_site;
  if not found then
    raise exception 'Produit hors site' using errcode = '42501';
  end if;

  v_theo := point_chaud.stock_of(p_product_id);
  v_delta := p_seen_units - v_theo;
  if v_delta = 0 then
    return null;
  end if;

  insert into point_chaud.stock_movements
    (site_id, product_id, qty_units, type, reason, created_by)
  values
    (v_site, p_product_id, v_delta, 'correction', p_reason, auth.uid())
  returning id into v_mid;

  perform point_chaud._audit(v_site, 'correction', 'stock_movements', v_mid,
    jsonb_build_object('product_id', p_product_id, 'theoretical', v_theo, 'seen', p_seen_units, 'delta', v_delta));
  return v_mid;
end;
$$;

create or replace function point_chaud.propose_stock_correction(
  p_product_id uuid,
  p_seen_units int,
  p_source text default 'order_visual_check'
) returns uuid
language plpgsql
security definer
set search_path = point_chaud, public
as $$
declare
  v_site uuid;
  v_theo int;
  v_id uuid;
begin
  if not point_chaud.is_member() then
    raise exception 'Accès refusé' using errcode = '42501';
  end if;
  v_site := point_chaud.current_site_id();

  perform 1 from point_chaud.products where id = p_product_id and site_id = v_site;
  if not found then
    raise exception 'Produit hors site' using errcode = '42501';
  end if;

  v_theo := point_chaud.stock_of(p_product_id);
  insert into point_chaud.stock_correction_proposals
    (site_id, product_id, theoretical_units, seen_units, delta_units, source, proposed_by)
  values
    (v_site, p_product_id, v_theo, p_seen_units, p_seen_units - v_theo, p_source, auth.uid())
  returning id into v_id;

  perform point_chaud._audit(v_site, 'propose_correction', 'stock_correction_proposals', v_id, null);
  return v_id;
end;
$$;

create or replace function point_chaud.resolve_stock_correction(
  p_proposal_id uuid,
  p_accept boolean
) returns void
language plpgsql
security definer
set search_path = point_chaud, public
as $$
declare
  v_site uuid;
  v_prop point_chaud.stock_correction_proposals;
  v_mid uuid;
begin
  if not point_chaud.is_responsable() then
    raise exception 'Validation réservée au responsable' using errcode = '42501';
  end if;
  v_site := point_chaud.current_site_id();

  select * into v_prop from point_chaud.stock_correction_proposals
    where id = p_proposal_id and site_id = v_site and status = 'pending';
  if not found then
    raise exception 'Proposition introuvable ou déjà traitée' using errcode = 'P0001';
  end if;

  if p_accept then
    v_mid := point_chaud.apply_stock_correction(v_prop.product_id, v_prop.seen_units, 'recalage validé');
    update point_chaud.stock_correction_proposals
      set status = 'validated', resolved_by = auth.uid(), resolved_at = now(), movement_id = v_mid
      where id = p_proposal_id;
  else
    update point_chaud.stock_correction_proposals
      set status = 'rejected', resolved_by = auth.uid(), resolved_at = now()
      where id = p_proposal_id;
  end if;

  perform point_chaud._audit(v_site, 'resolve_correction', 'stock_correction_proposals', p_proposal_id,
    jsonb_build_object('accepted', p_accept));
end;
$$;

-- --------------------------------------------------------------------
-- Grants : seules ces fonctions permettent d'écrire les tables opérationnelles
-- --------------------------------------------------------------------
revoke all on function point_chaud.stock_of(uuid) from public;
revoke all on function point_chaud.record_exit(uuid, jsonb, text, boolean) from public;
revoke all on function point_chaud.receive_delivery(uuid, uuid, jsonb, text) from public;
revoke all on function point_chaud.apply_stock_correction(uuid, int, text) from public;
revoke all on function point_chaud.propose_stock_correction(uuid, int, text) from public;
revoke all on function point_chaud.resolve_stock_correction(uuid, boolean) from public;

grant execute on function point_chaud.stock_of(uuid) to authenticated;
grant execute on function point_chaud.record_exit(uuid, jsonb, text, boolean) to authenticated;
grant execute on function point_chaud.receive_delivery(uuid, uuid, jsonb, text) to authenticated;
grant execute on function point_chaud.apply_stock_correction(uuid, int, text) to authenticated;
grant execute on function point_chaud.propose_stock_correction(uuid, int, text) to authenticated;
grant execute on function point_chaud.resolve_stock_correction(uuid, boolean) to authenticated;

-- _audit reste interne (pas de grant à authenticated)
revoke all on function point_chaud._audit(uuid, text, text, uuid, jsonb) from public;

-- ############ supabase/migrations/0004_inventory.sql ############

-- =====================================================================
--  Point Chaud — inventaire (recalage du stock au réel, tracé)
--  Crée un stock_count + ses lignes, et une correction par produit dont
--  l'écart est non nul. Non destructif (§0) : on n'écrase jamais, on corrige.
--  Réservé au responsable (action sensible).
-- =====================================================================

create or replace function point_chaud.apply_inventory(
  p_kind text,            -- 'initial' | 'full' | 'partial'
  p_lines jsonb           -- [{ "product_id": uuid, "counted_units": int }]
) returns uuid
language plpgsql
security definer
set search_path = point_chaud, public
as $$
declare
  v_site uuid;
  v_count uuid;
  v_line jsonb;
  v_pid uuid;
  v_counted int;
  v_theo int;
  v_delta int;
begin
  if not point_chaud.is_responsable() then
    raise exception 'Inventaire réservé au responsable' using errcode = '42501';
  end if;
  v_site := point_chaud.current_site_id();

  insert into point_chaud.stock_counts (site_id, kind, status, created_by, validated_by, validated_at)
  values (v_site, coalesce(p_kind, 'full'), 'validated', auth.uid(), auth.uid(), now())
  returning id into v_count;

  for v_line in select * from jsonb_array_elements(p_lines)
  loop
    v_pid := (v_line ->> 'product_id')::uuid;
    v_counted := (v_line ->> 'counted_units')::int;
    if v_counted is null or v_counted < 0 then
      continue;
    end if;

    perform 1 from point_chaud.products where id = v_pid and site_id = v_site;
    if not found then
      raise exception 'Produit hors site: %', v_pid using errcode = '42501';
    end if;

    v_theo := point_chaud.stock_of(v_pid);
    v_delta := v_counted - v_theo;

    insert into point_chaud.stock_count_lines (count_id, product_id, counted_units, theoretical_units)
    values (v_count, v_pid, v_counted, v_theo);

    if v_delta <> 0 then
      insert into point_chaud.stock_movements
        (site_id, product_id, qty_units, type, reason, count_id, created_by)
      values
        (v_site, v_pid, v_delta, 'correction', 'inventaire', v_count, auth.uid());
    end if;
  end loop;

  perform point_chaud._audit(v_site, 'inventory', 'stock_counts', v_count, jsonb_build_object('kind', p_kind));
  return v_count;
end;
$$;

revoke all on function point_chaud.apply_inventory(text, jsonb) from public;
grant execute on function point_chaud.apply_inventory(text, jsonb) to authenticated;
