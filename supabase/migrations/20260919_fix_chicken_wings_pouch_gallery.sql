-- The old static Chicken Wings WebP was never present in the deployed assets.
-- Keep the plate first and use the already-uploaded pouch photo second.
begin;

with media as (
  select
    p.id,
    (
      select 'https://syuostlqzzinigqwjzap.supabase.co/storage/v1/object/public/product-images/' || o.name
      from storage.objects o
      where o.bucket_id = 'product-images'
        and o.name like p.id::text || '/image-1-%'
      order by o.name
      limit 1
    ) as plate_url,
    (
      select 'https://syuostlqzzinigqwjzap.supabase.co/storage/v1/object/public/product-images/' || o.name
      from storage.objects o
      where o.bucket_id = 'product-images'
        and o.name like p.id::text || '/image-0-%'
      order by o.name
      limit 1
    ) as pouch_url
  from public.products p
  where lower(btrim(p.name)) = 'chicken wings'
)
update public.products p
set
  images = array_cat(
    array[media.plate_url, media.pouch_url],
    coalesce((
      select array_agg(image_url order by ordinality)
      from unnest(p.images) with ordinality as gallery(image_url, ordinality)
      where image_url is not null
        and image_url <> media.plate_url
        and image_url <> media.pouch_url
        and image_url <> 'https://gameofbones.in/assets/catalogue-v3/chicken-wings.webp'
    ), array[]::text[])
  )
from media
where p.id = media.id
  and media.plate_url is not null
  and media.pouch_url is not null;

commit;
