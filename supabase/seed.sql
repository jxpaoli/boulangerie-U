-- =====================================================================
--  Point Chaud — données de démonstration
--  À exécuter APRÈS les migrations 0001-0003, sur une base non-prod (ou une
--  branche Supabase). Cohérent avec le jeu de démo du frontend.
--
--  Les PROFILS ne sont pas seedés (ils référencent auth.users). Après avoir
--  créé ton utilisateur via Supabase Auth, exécute (en remplaçant l'UUID) :
--
--    insert into point_chaud.profiles (id, site_id, display_name, role)
--    values ('<ton-auth-uid>', '00000000-0000-0000-0000-0000000000c1',
--            'Sabrina', 'responsable');
-- =====================================================================

-- Site
insert into point_chaud.sites (id, name, timezone) values
  ('00000000-0000-0000-0000-0000000000c1', 'Point Chaud', 'Europe/Paris')
on conflict (id) do nothing;

insert into point_chaud.app_settings (site_id, safety_deliveries, recalibration_threshold)
values ('00000000-0000-0000-0000-0000000000c1', 1, 0.20)
on conflict (site_id) do nothing;

-- Emplacement
insert into point_chaud.storage_locations (id, site_id, name) values
  ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000c1', 'Congélateur')
on conflict do nothing;

-- Familles
insert into point_chaud.product_categories (id, site_id, name, position) values
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000c1', 'Baguettes', 1),
  ('00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-0000000000c1', 'Pains', 2),
  ('00000000-0000-0000-0000-0000000000f3', '00000000-0000-0000-0000-0000000000c1', 'Viennoiseries', 3),
  ('00000000-0000-0000-0000-0000000000f4', '00000000-0000-0000-0000-0000000000c1', 'Produits salés', 4)
on conflict do nothing;

-- Fournisseurs (calendriers V1)
insert into point_chaud.suppliers
  (id, site_id, name, phone, order_channel, order_days, cutoff_time, delivery_mode, lead_days, lead_kind, no_weekend_delivery)
values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000c1', 'Metro', '04 95 10 40 00', 'phone',
   '{0,1,2,3,4}', '11:00', 'lead', 1, 'calendar', true),
  ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000c1', 'Davigel', '04 95 22 15 00', 'phone',
   '{0,2,4}', '10:00', 'lead', 1, 'calendar', true),
  ('00000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-0000000000c1', 'Bridor', '04 95 33 80 12', 'phone',
   '{1,3}', '12:00', 'lead', 2, 'business', false)
on conflict do nothing;

-- Produits (id, famille, nom, réf, min, max plafond congélo)
insert into point_chaud.products
  (id, site_id, category_id, location_id, name, internal_ref, min_units, max_units)
values
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000d1', 'Baguette précuite 55 cm', 'BAG-055', 24, 144),
  ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-0000000000d1', 'Pain céréales précuit', 'PAI-CER', 20, 80),
  ('00000000-0000-0000-0000-0000000000b3', '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000f4', '00000000-0000-0000-0000-0000000000d1', 'Pizza margherita indiv.', 'PIZ-MAR', 12, 30),
  ('00000000-0000-0000-0000-0000000000b4', '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000f3', '00000000-0000-0000-0000-0000000000d1', 'Croissant cru surgelé', 'CRO-SUR', 120, 480),
  ('00000000-0000-0000-0000-0000000000b5', '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000f4', '00000000-0000-0000-0000-0000000000d1', 'Quiche lorraine 12 cm', 'QUI-LOR', 15, 45)
on conflict do nothing;

-- Références fournisseurs + conditionnements (pack_size = unités par carton)
insert into point_chaud.supplier_products
  (site_id, supplier_id, product_id, supplier_ref, order_unit, pack_size, min_order_packs, order_multiple_packs)
values
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1', '784512', 'carton', 24, 1, 1),
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b2', '784530', 'carton', 20, 1, 1),
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000b3', '640021', 'carton', 6, 1, 1),
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-0000000000b4', 'CR120', 'carton', 120, 1, 1),
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000b5', '640088', 'carton', 15, 1, 1)
on conflict (supplier_id, product_id) do nothing;

-- Conso par jour de semaine (0=lundi … 6=dimanche)
insert into point_chaud.forecast_settings
  (product_id, site_id, conso_mon, conso_tue, conso_wed, conso_thu, conso_fri, conso_sat, conso_sun)
values
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000c1', 12, 12, 15, 18, 30, 40, 25),
  ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000c1', 8, 8, 9, 10, 14, 10, 6),
  ('00000000-0000-0000-0000-0000000000b3', '00000000-0000-0000-0000-0000000000c1', 4, 4, 5, 6, 10, 12, 8),
  ('00000000-0000-0000-0000-0000000000b4', '00000000-0000-0000-0000-0000000000c1', 40, 40, 45, 50, 70, 90, 60),
  ('00000000-0000-0000-0000-0000000000b5', '00000000-0000-0000-0000-0000000000c1', 3, 3, 4, 5, 8, 10, 7)
on conflict (product_id) do nothing;

-- Préparations standard
insert into point_chaud.prep_templates (id, site_id, name, time_label) values
  ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000c1', 'Prépa du matin', '06:30'),
  ('00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-0000000000c1', 'Prépa de midi', '11:00')
on conflict do nothing;

insert into point_chaud.prep_template_lines (template_id, product_id, default_units) values
  ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000b1', 48),
  ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000b4', 120),
  ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000b2', 20),
  ('00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-0000000000b3', 12),
  ('00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-0000000000b5', 15)
on conflict (template_id, product_id) do nothing;

-- Stock initial (mouvements de type 'initial')
insert into point_chaud.stock_movements (site_id, product_id, qty_units, type, reason) values
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000b1', 100, 'initial', 'inventaire initial démo'),
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000b2', 46,  'initial', 'inventaire initial démo'),
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000b3', 5,   'initial', 'inventaire initial démo'),
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000b4', 210, 'initial', 'inventaire initial démo'),
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000b5', 28,  'initial', 'inventaire initial démo');
