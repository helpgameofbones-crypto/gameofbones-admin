-- Keep the approved green-background image first while retaining the original
-- product-detail/plate media already stored in the product-images bucket.
-- The original files are not changed or deleted.
begin;

with map(product_name, folder) as (
  values
    ('chicken bites','2d733070-14d7-4d82-9ec4-4aa1548cbc35'),
    ('chicken wings','ef9d3dbe-f6d7-4e59-b673-ffe451e0ab5a'),
    ('chicken bones','937c9539-b00d-4e93-9291-1af00893a061'),
    ('goat trachea','cb465b52-4add-49b6-82be-b6f016d10b7c'),
    ('goat ear','9e4a7262-ad95-4076-a0ee-949f9582616f'),
    ('chicken gizzards','5d4353a7-fd6c-4919-a32b-4d4c66fd44ab'),
    ('chicken heart & liver','b8ea22dc-d46f-4ee9-b779-8c1aacafd755'),
    ('goat liver','f804c0d1-0be7-4281-bc8a-c9dc6e8cfd50'),
    ('goat lungs','39ac015f-9a37-49c4-b2df-34b29472eca7'),
    ('goat heart & kidney mix','007d8e1a-3640-4b75-b467-d27782f82855'),
    ('goat spleen','92d62ad6-33db-45f3-af57-91b6a454a07a'),
    ('anchovies','f0846a93-7d6b-42aa-90a7-a6ddd771c156'),
    ('bombay duck','46addf99-2f4a-44f2-ba64-7623cde174ff'),
    ('whole mackerel','177aaeda-c886-437c-bc6f-aaa5fb27b2c2'),
    ('mackerel fillet','771b372e-a767-4056-ae85-c6ad1251e84a'),
    ('sardines','f2462343-c4b8-4992-8fc9-d38db31e2e7c'),
    ('tuna','da659861-df5e-4c9e-991c-811c56f50c7f'),
    ('prawns','a76ab961-d32e-4720-8e2e-e4f989da8ee0'),
    ('whole quail','edb3cdd6-b31f-4e5b-ba18-bf4a300d8090')
), restored as (
  select p.id, array_prepend(
    p.image_url,
    coalesce((
      select array_agg('https://syuostlqzzinigqwjzap.supabase.co/storage/v1/object/public/product-images/' || o.name order by o.name)
      from storage.objects o
      where o.bucket_id = 'product-images'
        and o.name like m.folder || '/%'
        and o.name not like '%/image-0-%'
        -- This legacy trachea photo was incorrectly attached to Chicken Bones.
        and o.name <> '937c9539-b00d-4e93-9291-1af00893a061/image-1-1782745615470.png'
    ), array[]::text[])
  ) as gallery
  from public.products p
  join map m on lower(trim(p.name)) = m.product_name
)
update public.products p
set images = restored.gallery
from restored
where p.id = restored.id;

commit;
