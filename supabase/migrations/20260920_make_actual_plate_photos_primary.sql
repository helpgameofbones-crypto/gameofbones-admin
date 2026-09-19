-- Product cards and product galleries show the real plate photo first.
-- Pack-first products (Chicken Jerky, Chicken Neck, Chicken Feet and Buff Jerky)
-- and all bundles are deliberately excluded.
begin;

with eligible(product_name, asset_slug) as (
  values
    ('anchovies', 'anchovies'),
    ('bombay duck', 'bombay-duck'),
    ('chicken bites', 'chicken-bites'),
    ('chicken bones', 'chicken-bones'),
    ('chicken gizzards', 'chicken-gizzards'),
    ('chicken heart & liver', 'chicken-heart-liver'),
    ('chicken wings', 'chicken-wings'),
    ('goat ear', 'goat-ear'),
    ('goat heart & kidney mix', 'goat-heart-kidney'),
    ('goat liver', 'goat-liver'),
    ('goat lungs', 'goat-lungs'),
    ('goat spleen', 'goat-spleen'),
    ('goat trachea', 'goat-trachea'),
    ('goat trotter', 'goat-trotter'),
    ('mackerel fillet', 'mackerel-fillet'),
    ('prawns', 'prawns'),
    ('sardines', 'sardines'),
    ('tuna', 'tuna'),
    ('whole mackerel', 'whole-mackerel'),
    ('whole quail', 'whole-quail')
), selected as (
  select
    p.id,
    p.image_url as pouch_url,
    p.images as existing_images,
    'https://gameofbones.in/assets/catalogue-plates/' || e.asset_slug || '.webp' as plate_url
  from public.products p
  join eligible e on lower(btrim(p.name)) = e.product_name
), reordered as (
  select
    id,
    plate_url,
    array_cat(
      array[plate_url, pouch_url],
      coalesce((
        select array_agg(image_url order by ordinality)
        from unnest(existing_images) with ordinality as media(image_url, ordinality)
        where image_url is not null
          and image_url <> plate_url
          and image_url <> pouch_url
      ), array[]::text[])
    ) as images
  from selected
)
update public.products p
set
  image_url = reordered.plate_url,
  images = reordered.images
from reordered
where p.id = reordered.id;

commit;
