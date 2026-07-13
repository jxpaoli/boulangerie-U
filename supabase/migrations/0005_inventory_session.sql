-- =====================================================================
--  Point Chaud — inventaire collaboratif (session + temps réel)
--  Une feuille d'inventaire ouverte ; chaque produit validé (qui + quantité) ;
--  synchro live entre écrans via Realtime ; clôture = corrections tracées.
-- =====================================================================

-- Qui a validé chaque ligne + quand
alter table point_chaud.stock_count_lines
  add column if not exists validated_by uuid references auth.users (id),
  add column if not exists validated_at timestamptz;

-- Temps réel sur les lignes d'inventaire (respecte la RLS)
do $$
begin
  begin
    alter publication supabase_realtime add table point_chaud.stock_count_lines;
  exception when duplicate_object then null;
  end;
end $$;

-- Ouvrir (ou récupérer) la session d'inventaire en cours du site
create or replace function point_chaud.open_inventory()
returns uuid
language plpgsql
security definer
set search_path = point_chaud, public
as $$
declare
  v_site uuid;
  v_id uuid;
begin
  if not point_chaud.is_member() then
    raise exception 'Accès refusé' using errcode = '42501';
  end if;
  v_site := point_chaud.current_site_id();

  select id into v_id
  from point_chaud.stock_counts
  where site_id = v_site and status = 'open'
  order by created_at desc
  limit 1;

  if v_id is null then
    insert into point_chaud.stock_counts (site_id, kind, status, created_by)
    values (v_site, 'full', 'open', auth.uid())
    returning id into v_id;
  end if;
  return v_id;
end;
$$;

-- Valider un produit dans la session (membre) — upsert avec auteur + quantité
create or replace function point_chaud.validate_count_line(
  p_count uuid,
  p_product uuid,
  p_counted int
) returns void
language plpgsql
security definer
set search_path = point_chaud, public
as $$
declare
  v_site uuid;
begin
  if not point_chaud.is_member() then
    raise exception 'Accès refusé' using errcode = '42501';
  end if;
  v_site := point_chaud.current_site_id();

  perform 1 from point_chaud.stock_counts
    where id = p_count and site_id = v_site and status = 'open';
  if not found then
    raise exception 'Inventaire introuvable ou déjà clôturé' using errcode = 'P0001';
  end if;
  perform 1 from point_chaud.products where id = p_product and site_id = v_site;
  if not found then
    raise exception 'Produit hors site' using errcode = '42501';
  end if;
  if p_counted < 0 then
    raise exception 'Quantité négative' using errcode = 'P0001';
  end if;

  insert into point_chaud.stock_count_lines
    (count_id, product_id, counted_units, theoretical_units, validated_by, validated_at)
  values
    (p_count, p_product, p_counted, point_chaud.stock_of(p_product), auth.uid(), now())
  on conflict (count_id, product_id) do update
    set counted_units = excluded.counted_units,
        theoretical_units = excluded.theoretical_units,
        validated_by = excluded.validated_by,
        validated_at = excluded.validated_at;
end;
$$;

-- Clôturer l'inventaire (responsable) : applique les corrections + ferme
create or replace function point_chaud.finish_inventory(p_count uuid)
returns void
language plpgsql
security definer
set search_path = point_chaud, public
as $$
declare
  v_site uuid;
  v_line record;
  v_delta int;
begin
  if not point_chaud.is_responsable() then
    raise exception 'Clôture réservée au responsable' using errcode = '42501';
  end if;
  v_site := point_chaud.current_site_id();

  perform 1 from point_chaud.stock_counts
    where id = p_count and site_id = v_site and status = 'open';
  if not found then
    raise exception 'Inventaire introuvable ou déjà clôturé' using errcode = 'P0001';
  end if;

  for v_line in
    select product_id, counted_units from point_chaud.stock_count_lines where count_id = p_count
  loop
    v_delta := v_line.counted_units - point_chaud.stock_of(v_line.product_id);
    if v_delta <> 0 then
      insert into point_chaud.stock_movements
        (site_id, product_id, qty_units, type, reason, count_id, created_by)
      values
        (v_site, v_line.product_id, v_delta, 'correction', 'inventaire', p_count, auth.uid());
    end if;
  end loop;

  update point_chaud.stock_counts
    set status = 'validated', validated_by = auth.uid(), validated_at = now()
    where id = p_count;

  perform point_chaud._audit(v_site, 'inventory_finish', 'stock_counts', p_count, null);
end;
$$;

revoke all on function point_chaud.open_inventory() from public;
revoke all on function point_chaud.validate_count_line(uuid, uuid, int) from public;
revoke all on function point_chaud.finish_inventory(uuid) from public;
grant execute on function point_chaud.open_inventory() to authenticated;
grant execute on function point_chaud.validate_count_line(uuid, uuid, int) to authenticated;
grant execute on function point_chaud.finish_inventory(uuid) to authenticated;

-- expose les nouvelles fonctions à l'API (évite PGRST202/205)
notify pgrst, 'reload schema';
