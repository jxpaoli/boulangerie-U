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
