create or replace function point_chaud.save_prep_template(
  p_id uuid,
  p_name text,
  p_time_label text,
  p_lines jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid := coalesce(p_id, gen_random_uuid());
  v_site_id uuid := point_chaud.current_site_id();
begin
  if auth.uid() is null or v_site_id is null or not point_chaud.is_responsable() then
    raise exception 'Accès réservé au responsable.';
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
    id, site_id, name, time_label, active, created_by
  ) values (
    v_id, v_site_id, btrim(p_name), nullif(btrim(coalesce(p_time_label, '')), ''), true, auth.uid()
  )
  on conflict (id) do update
  set name = excluded.name,
      time_label = excluded.time_label,
      active = true;

  delete from point_chaud.prep_template_lines where template_id = v_id;

  insert into point_chaud.prep_template_lines (template_id, product_id, default_units)
  select v_id, line.product_id, line.default_units
  from jsonb_to_recordset(p_lines) as line(product_id uuid, default_units integer);

  return v_id;
end;
$$;

revoke all on function point_chaud.save_prep_template(uuid, text, text, jsonb) from public, anon;
grant execute on function point_chaud.save_prep_template(uuid, text, text, jsonb) to authenticated;

comment on function point_chaud.save_prep_template(uuid, text, text, jsonb) is
  'Enregistre atomiquement une sortie programmée et ses quantités pour le site du responsable.';
