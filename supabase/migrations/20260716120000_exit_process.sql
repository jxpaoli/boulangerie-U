-- =====================================================================
--  Point Chaud — process de fabrication (pousse / cuisson directe / déco)
--
--  But :
--   - chaque PRODUIT porte un process (coche sur la fiche) ;
--   - chaque LISTE préformatée porte un process (n'apparaît que dans son onglet) ;
--   - chaque SORTIE est marquée avec son process (stocké dans reason) ;
--   - « à cuire aujourd'hui » = les sorties « pousse » de la VEILLE (info pure,
--     aucun 2e mouvement de stock : le congélo est déjà décrémenté à la pousse).
--
--  Valeurs : 'pousse' | 'cuisson' | 'deco'. Défaut 'cuisson' (cuisson directe).
-- =====================================================================

-- --------------------------------------------------------------------
-- Colonnes process
-- --------------------------------------------------------------------
alter table point_chaud.products
  add column if not exists process text not null default 'cuisson'
  check (process in ('pousse', 'cuisson', 'deco'));

alter table point_chaud.prep_templates
  add column if not exists process text not null default 'cuisson'
  check (process in ('pousse', 'cuisson', 'deco'));

-- --------------------------------------------------------------------
-- record_exit : + p_process (stocké dans reason pour retrouver les pousses)
-- --------------------------------------------------------------------
drop function if exists point_chaud.record_exit(uuid, jsonb, text, boolean, uuid);

create function point_chaud.record_exit(
  p_batch_id uuid,
  p_lines jsonb,
  p_note text default null,
  p_force boolean default false,
  p_template_id uuid default null,
  p_process text default 'cuisson'
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
  v_process text := coalesce(nullif(btrim(p_process), ''), 'cuisson');
begin
  if not point_chaud.is_member() then
    raise exception 'Accès refusé' using errcode = '42501';
  end if;
  if v_process not in ('pousse', 'cuisson', 'deco') then
    raise exception 'Process inconnu: %', v_process using errcode = '22023';
  end if;
  v_site := point_chaud.current_site_id();

  if exists (select 1 from point_chaud.stock_movements where prep_batch_id = p_batch_id) then
    return p_batch_id;
  end if;

  if jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'La sortie doit contenir au moins un produit' using errcode = '22023';
  end if;

  if p_template_id is not null then
    perform 1 from point_chaud.prep_templates
    where id = p_template_id and site_id = v_site and active;
    if not found then
      raise exception 'Préparation programmée introuvable' using errcode = '42501';
    end if;
  end if;

  for v_line in select value from jsonb_array_elements(p_lines)
  loop
    v_pid := (v_line ->> 'product_id')::uuid;
    v_units := (v_line ->> 'units')::int;
    if v_units is null or v_units <= 0 then
      continue;
    end if;

    perform 1 from point_chaud.products where id = v_pid and site_id = v_site and active;
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
      (site_id, product_id, qty_units, type, reason, prep_batch_id, prep_template_id, note, created_by)
    values
      (v_site, v_pid, -v_units, 'exit', v_process, p_batch_id, p_template_id,
       nullif(btrim(coalesce(p_note, '')), ''), auth.uid());
  end loop;

  if p_template_id is not null then
    insert into point_chaud.prep_runs(site_id, template_id, batch_id, run_by)
    values (v_site, p_template_id, p_batch_id, auth.uid())
    on conflict (batch_id) do nothing;
  end if;

  perform point_chaud._audit(
    v_site, 'exit', 'stock_movements', p_batch_id,
    jsonb_build_object('template_id', p_template_id, 'process', v_process, 'lines', p_lines)
  );
  return p_batch_id;
end;
$$;

revoke all on function point_chaud.record_exit(uuid, jsonb, text, boolean, uuid, text)
  from public, anon;
grant execute on function point_chaud.record_exit(uuid, jsonb, text, boolean, uuid, text)
  to authenticated;

-- --------------------------------------------------------------------
-- save_prep_template : + p_process
-- --------------------------------------------------------------------
drop function if exists point_chaud.save_prep_template(uuid, text, text, jsonb);

create function point_chaud.save_prep_template(
  p_id uuid,
  p_name text,
  p_time_label text,
  p_lines jsonb,
  p_process text default 'cuisson'
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid := coalesce(p_id, gen_random_uuid());
  v_site_id uuid := point_chaud.current_site_id();
  v_process text := coalesce(nullif(btrim(p_process), ''), 'cuisson');
begin
  if auth.uid() is null or v_site_id is null or not point_chaud.is_responsable() then
    raise exception 'Accès réservé au responsable.';
  end if;
  if v_process not in ('pousse', 'cuisson', 'deco') then
    raise exception 'Process inconnu: %', v_process;
  end if;
  if nullif(btrim(p_name), '') is null then
    raise exception 'Le nom de la sortie programmée est obligatoire.';
  end if;
  if nullif(btrim(coalesce(p_time_label, '')), '') is not null
     and btrim(p_time_label) !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then
    raise exception 'L''heure doit être au format HH:MM.';
  end if;
  if jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'Ajoutez au moins un produit.';
  end if;
  if exists (
    select 1
    from jsonb_to_recordset(p_lines) as line(product_id uuid, default_units integer)
    where line.product_id is null or line.default_units is null or line.default_units <= 0
  ) then
    raise exception 'Chaque quantité doit être supérieure à zéro.';
  end if;
  if exists (
    select line.product_id
    from jsonb_to_recordset(p_lines) as line(product_id uuid, default_units integer)
    group by line.product_id
    having count(*) > 1
  ) then
    raise exception 'Un produit ne peut apparaître qu''une fois.';
  end if;
  if exists (
    select 1
    from jsonb_to_recordset(p_lines) as line(product_id uuid, default_units integer)
    left join point_chaud.products product
      on product.id = line.product_id
     and product.site_id = v_site_id
     and product.active
    where product.id is null
  ) then
    raise exception 'Un produit est introuvable ou n''appartient pas à ce site.';
  end if;

  insert into point_chaud.prep_templates (
    id, site_id, name, time_label, process, active, created_by
  ) values (
    v_id, v_site_id, btrim(p_name), nullif(btrim(coalesce(p_time_label, '')), ''),
    v_process, true, auth.uid()
  )
  on conflict (id) do update
  set name = excluded.name,
      time_label = excluded.time_label,
      process = excluded.process,
      active = true;

  delete from point_chaud.prep_template_lines where template_id = v_id;

  insert into point_chaud.prep_template_lines (template_id, product_id, default_units)
  select v_id, line.product_id, line.default_units
  from jsonb_to_recordset(p_lines) as line(product_id uuid, default_units integer);

  return v_id;
end;
$$;

revoke all on function point_chaud.save_prep_template(uuid, text, text, jsonb, text) from public, anon;
grant execute on function point_chaud.save_prep_template(uuid, text, text, jsonb, text) to authenticated;

-- --------------------------------------------------------------------
-- list_cuisson_du_jour : ce qui a été mis en POUSSE hier = à cuire aujourd'hui.
--   Agrège les sorties reason='pousse' dont la date civile (Europe/Paris) = hier.
--   Info pure : ne touche jamais le stock.
-- --------------------------------------------------------------------
create or replace function point_chaud.list_cuisson_du_jour()
returns table (product_id uuid, product_name text, units int)
language sql
stable
security definer
set search_path = point_chaud, public
as $$
  select m.product_id, p.name, sum(-m.qty_units)::int as units
  from point_chaud.stock_movements m
  join point_chaud.products p on p.id = m.product_id
  where m.site_id = point_chaud.current_site_id()
    and m.type = 'exit'
    and m.reason = 'pousse'
    and (m.created_at at time zone 'Europe/Paris')::date
        = ((now() at time zone 'Europe/Paris')::date - 1)
  group by m.product_id, p.name
  having sum(-m.qty_units) > 0
$$;

revoke all on function point_chaud.list_cuisson_du_jour() from public, anon;
grant execute on function point_chaud.list_cuisson_du_jour() to authenticated;

comment on function point_chaud.list_cuisson_du_jour() is
  'À cuire aujourd''hui = sorties « pousse » de la veille. Info pure, hors stock.';
