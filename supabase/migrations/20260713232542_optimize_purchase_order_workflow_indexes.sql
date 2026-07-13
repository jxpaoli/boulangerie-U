-- The unique (order_id, product_id) constraint already covers order_id lookups.
drop index if exists point_chaud.purchase_order_lines_order_id_idx;

create index if not exists purchase_order_lines_product_id_idx
  on point_chaud.purchase_order_lines (product_id);

create index if not exists deliveries_order_id_idx
  on point_chaud.deliveries (order_id)
  where order_id is not null;

create index if not exists deliveries_site_status_idx
  on point_chaud.deliveries (site_id, status);

create index if not exists delivery_lines_product_id_idx
  on point_chaud.delivery_lines (product_id);
