-- Put the real product/plate photo first for each applicable treat.
-- The four pack-first products and bundle images are intentionally untouched.
begin;

with eligible(product_name) as (
  values
    ('anchovies'), ('bombay duck'), ('chicken bites'), ('chicken bones'),
    ('chicken gizzards'), ('chicken heart & liver'), ('chicken wings'),
    ('goat ear'), ('goat heart & kidney mix'), ('goat liver'), ('goat lungs'),
    ('goat spleen'), ('goat trachea'), ('goat trotter'), ('mackerel fillet'),
    ('prawns'), ('sardines'), ('tuna'), ('whole mackerel'), ('whole quail')
), selected as (
  select
    p.id,
    p.image_url as pouch_url,
    p.images as existing_images,
    (
      select 'https://syuostlqzzinigqwjzap.supabase.co/storage/v1/object/public/product-images/' || o.name
      from storage.objects o
      where o.bucket_id = 'product-images'
        and o.name like p.id::text || '/image-1-%'
      order by o.name
      limit 1
    ) as plate_url
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
  where plate_url is not null
)
update public.products p
set
  image_url = reordered.plate_url,
  images = reordered.images
from reordered
where p.id = reordered.id;

commit;
