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
do $$
declare t text;
begin
  for t in
    select tablename from pg_tables where schemaname = 'point_chaud'
      and tablename not in ('sites')
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
