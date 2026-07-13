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
