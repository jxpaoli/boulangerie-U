alter table point_chaud.products
  add column is_favorite boolean not null default false;

comment on column point_chaud.products.is_favorite is
  'Produit mis en avant dans les saisies rapides du point chaud.';

-- Point de départ utile : les 8 produits à plus forte consommation de chaque site.
with ranked as (
  select
    p.id,
    row_number() over (
      partition by p.site_id
      order by (
        coalesce(f.conso_mon, 0) + coalesce(f.conso_tue, 0) +
        coalesce(f.conso_wed, 0) + coalesce(f.conso_thu, 0) +
        coalesce(f.conso_fri, 0) + coalesce(f.conso_sat, 0) +
        coalesce(f.conso_sun, 0)
      ) desc, p.name
    ) as position
  from point_chaud.products p
  left join point_chaud.forecast_settings f on f.product_id = p.id
  where p.active
)
update point_chaud.products p
set is_favorite = true
from ranked r
where r.id = p.id and r.position <= 8;
