-- =====================================================================
--  Point Chaud — l'inventaire est ouvert à TOUT le monde (pas que le responsable)
--  Comptage + clôture accessibles à tout membre du site.
-- =====================================================================

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
  -- ouvert à tout membre (avant : responsable uniquement)
  if not point_chaud.is_member() then
    raise exception 'Accès refusé' using errcode = '42501';
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

notify pgrst, 'reload schema';
