-- A scheduled preparation is never deducted automatically: execution stays an explicit,
-- idempotent user action. This table only records that the planned preparation was done.
create table if not exists point_chaud.prep_runs (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references point_chaud.sites(id),
  template_id uuid not null references point_chaud.prep_templates(id),
  batch_id uuid not null unique,
  run_at timestamptz not null default now(),
  run_by uuid not null references auth.users(id)
);

create index if not exists prep_runs_site_run_at_idx
  on point_chaud.prep_runs(site_id, run_at desc);
create index if not exists prep_runs_template_run_at_idx
  on point_chaud.prep_runs(template_id, run_at desc);

alter table point_chaud.prep_runs enable row level security;
alter table point_chaud.prep_runs force row level security;

drop policy if exists pc_prep_runs_select on point_chaud.prep_runs;
create policy pc_prep_runs_select on point_chaud.prep_runs
  for select to authenticated
  using (site_id = point_chaud.current_site_id());

revoke all on table point_chaud.prep_runs from public, anon;
grant select on table point_chaud.prep_runs to authenticated;

alter table point_chaud.stock_movements
  add column if not exists prep_template_id uuid references point_chaud.prep_templates(id);

create index if not exists stock_movements_prep_template_created_idx
  on point_chaud.stock_movements(prep_template_id, created_at desc)
  where prep_template_id is not null;

drop function if exists point_chaud.record_exit(uuid, jsonb, text, boolean);

create function point_chaud.record_exit(
  p_batch_id uuid,
  p_lines jsonb,
  p_note text default null,
  p_force boolean default false,
  p_template_id uuid default null
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
      (site_id, product_id, qty_units, type, prep_batch_id, prep_template_id, note, created_by)
    values
      (v_site, v_pid, -v_units, 'exit', p_batch_id, p_template_id,
       nullif(btrim(coalesce(p_note, '')), ''), auth.uid());
  end loop;

  if p_template_id is not null then
    insert into point_chaud.prep_runs(site_id, template_id, batch_id, run_by)
    values (v_site, p_template_id, p_batch_id, auth.uid())
    on conflict (batch_id) do nothing;
  end if;

  perform point_chaud._audit(
    v_site, 'exit', 'stock_movements', p_batch_id,
    jsonb_build_object('template_id', p_template_id, 'lines', p_lines)
  );
  return p_batch_id;
end;
$$;

revoke all on function point_chaud.record_exit(uuid, jsonb, text, boolean, uuid)
  from public, anon;
grant execute on function point_chaud.record_exit(uuid, jsonb, text, boolean, uuid)
  to authenticated;
