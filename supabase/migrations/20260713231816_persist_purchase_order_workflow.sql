-- Persist a supplier order in one transaction, then expose it to receptions/history.
alter table point_chaud.purchase_orders
  add column if not exists idempotency_key text;

create unique index if not exists purchase_orders_idempotency_key_uidx
  on point_chaud.purchase_orders (idempotency_key)
  where idempotency_key is not null;

create index if not exists purchase_orders_site_sent_at_idx
  on point_chaud.purchase_orders (site_id, sent_at desc);

create index if not exists purchase_order_lines_order_id_idx
  on point_chaud.purchase_order_lines (order_id);

create index if not exists order_status_history_order_at_idx
  on point_chaud.order_status_history (order_id, at desc);

create or replace function point_chaud.place_purchase_order(
  p_supplier_id uuid,
  p_cover_from date,
  p_cover_until date,
  p_lines jsonb,
  p_idempotency_key text,
  p_channel text default 'phone'
) returns uuid
language plpgsql
security definer
set search_path = point_chaud, public
as $$
declare
  v_site uuid;
  v_order uuid;
  v_line jsonb;
  v_product uuid;
  v_supplier_product uuid;
  v_pack_size int;
  v_proposed int;
  v_checked int;
  v_final int;
begin
  if not point_chaud.is_member() then
    raise exception 'Accès refusé' using errcode = '42501';
  end if;
  v_site := point_chaud.current_site_id();

  if nullif(btrim(p_idempotency_key), '') is null then
    raise exception 'Clé d''idempotence requise' using errcode = '22023';
  end if;

  select id into v_order
  from point_chaud.purchase_orders
  where site_id = v_site and idempotency_key = p_idempotency_key;
  if found then
    return v_order;
  end if;

  perform 1
  from point_chaud.suppliers
  where id = p_supplier_id and site_id = v_site and active;
  if not found then
    raise exception 'Fournisseur hors site ou inactif' using errcode = '42501';
  end if;

  if jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'La commande doit contenir au moins une ligne' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_lines) l
    group by l ->> 'product_id'
    having count(*) > 1
  ) then
    raise exception 'Un produit apparaît plusieurs fois dans la commande' using errcode = '22023';
  end if;

  insert into point_chaud.purchase_orders (
    site_id, supplier_id, status, cover_from, cover_until, channel,
    created_by, validated_by, sent_at, idempotency_key
  ) values (
    v_site, p_supplier_id, 'ordered', p_cover_from, p_cover_until,
    coalesce(nullif(btrim(p_channel), ''), 'phone'),
    auth.uid(), auth.uid(), now(), p_idempotency_key
  ) returning id into v_order;

  for v_line in select value from jsonb_array_elements(p_lines)
  loop
    v_product := (v_line ->> 'product_id')::uuid;
    v_proposed := coalesce((v_line ->> 'proposed_packs')::int, 0);
    v_checked := nullif(v_line ->> 'checked_packs', '')::int;
    v_final := coalesce((v_line ->> 'final_packs')::int, 0);

    if v_proposed < 0 or v_final <= 0 or (v_checked is not null and v_checked < 0) then
      raise exception 'Quantité de cartons invalide pour %', v_product using errcode = '22023';
    end if;

    select sp.id, sp.pack_size
      into v_supplier_product, v_pack_size
    from point_chaud.supplier_products sp
    join point_chaud.products p on p.id = sp.product_id
    where sp.site_id = v_site
      and sp.supplier_id = p_supplier_id
      and sp.product_id = v_product
      and p.site_id = v_site
      and p.active;

    if not found then
      raise exception 'Produit % non commandable chez ce fournisseur', v_product using errcode = '22023';
    end if;

    insert into point_chaud.purchase_order_lines (
      order_id, product_id, supplier_product_id, pack_size,
      proposed_packs, checked_packs, final_packs, visual_check, note
    ) values (
      v_order, v_product, v_supplier_product, v_pack_size,
      v_proposed, v_checked, v_final, v_line -> 'visual_check',
      nullif(btrim(v_line ->> 'note'), '')
    );
  end loop;

  insert into point_chaud.order_status_history (order_id, status, actor)
  values (v_order, 'ordered', auth.uid());

  perform point_chaud._audit(
    v_site, 'order_placed', 'purchase_orders', v_order,
    jsonb_build_object('supplier_id', p_supplier_id, 'lines', p_lines)
  );
  return v_order;
end;
$$;

revoke all on function point_chaud.place_purchase_order(uuid, date, date, jsonb, text, text) from public;
revoke all on function point_chaud.place_purchase_order(uuid, date, date, jsonb, text, text) from anon;
grant execute on function point_chaud.place_purchase_order(uuid, date, date, jsonb, text, text) to authenticated;

-- A linked reception must match the order. The order is closed and historized atomically.
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

  select id into v_delivery
  from point_chaud.deliveries
  where site_id = v_site and idempotency_key = p_idempotency_key;
  if found then
    return v_delivery;
  end if;

  perform 1 from point_chaud.suppliers
  where id = p_supplier_id and site_id = v_site;
  if not found then
    raise exception 'Fournisseur hors site' using errcode = '42501';
  end if;

  if jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'La réception doit contenir au moins une ligne' using errcode = '22023';
  end if;

  if p_order_id is not null then
    perform 1 from point_chaud.purchase_orders
    where id = p_order_id and site_id = v_site
      and supplier_id = p_supplier_id and status = 'ordered';
    if not found then
      raise exception 'Commande introuvable, déjà réceptionnée ou fournisseur incorrect' using errcode = '22023';
    end if;

    if exists (
      select product_id from point_chaud.purchase_order_lines where order_id = p_order_id
      except
      select (value ->> 'product_id')::uuid from jsonb_array_elements(p_lines)
    ) or exists (
      select (value ->> 'product_id')::uuid from jsonb_array_elements(p_lines)
      except
      select product_id from point_chaud.purchase_order_lines where order_id = p_order_id
    ) then
      raise exception 'Les lignes reçues ne correspondent pas à la commande' using errcode = '22023';
    end if;
  end if;

  insert into point_chaud.deliveries
    (site_id, order_id, supplier_id, status, received_by, received_at, idempotency_key)
  values
    (v_site, p_order_id, p_supplier_id, 'validated', auth.uid(), now(), p_idempotency_key)
  returning id into v_delivery;

  for v_line in select value from jsonb_array_elements(p_lines)
  loop
    v_pid := (v_line ->> 'product_id')::uuid;
    v_accepted := coalesce((v_line ->> 'accepted_units')::int, 0);

    if p_order_id is not null then
      select final_packs * pack_size into v_ordered
      from point_chaud.purchase_order_lines
      where order_id = p_order_id and product_id = v_pid;
    else
      v_ordered := coalesce((v_line ->> 'ordered_units')::int, 0);
      perform 1 from point_chaud.products where id = v_pid and site_id = v_site;
      if not found then
        raise exception 'Produit hors site: %', v_pid using errcode = '42501';
      end if;
    end if;

    if v_accepted < 0 then
      raise exception 'Quantité acceptée négative' using errcode = '22023';
    end if;

    insert into point_chaud.delivery_lines
      (delivery_id, product_id, ordered_units, accepted_units, note)
    values
      (v_delivery, v_pid, v_ordered, v_accepted, nullif(btrim(v_line ->> 'note'), ''));

    if v_accepted > 0 then
      insert into point_chaud.stock_movements
        (site_id, product_id, qty_units, type, delivery_id, order_id, created_by)
      values
        (v_site, v_pid, v_accepted, 'reception', v_delivery, p_order_id, auth.uid());
    end if;
  end loop;

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

revoke all on function point_chaud.receive_delivery(uuid, uuid, jsonb, text) from public;
revoke all on function point_chaud.receive_delivery(uuid, uuid, jsonb, text) from anon;
grant execute on function point_chaud.receive_delivery(uuid, uuid, jsonb, text) to authenticated;
