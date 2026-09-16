-- Serve the approved lightweight catalogue images from the storefront CDN.
-- This leaves the existing Supabase Storage files intact for rollback.
begin;

with image_map(product_name, image_url) as (
  values
    ('anchovies', 'https://gameofbones.in/assets/catalogue-v3/anchovies.webp'),
    ('bombay duck', 'https://gameofbones.in/assets/catalogue-v3/bombay-duck.webp'),
    ('chicken bites', 'https://gameofbones.in/assets/catalogue-v3/chicken-bites.webp'),
    ('chicken bones', 'https://gameofbones.in/assets/catalogue-v3/chicken-bones.webp'),
    ('chicken gizzards', 'https://gameofbones.in/assets/catalogue-v3/chicken-gizzards.webp'),
    ('chicken heart & liver', 'https://gameofbones.in/assets/catalogue-v3/chicken-heart-liver.webp'),
    ('chicken wings', 'https://gameofbones.in/assets/catalogue-v3/chicken-wings.webp'),
    ('goat ear', 'https://gameofbones.in/assets/catalogue-v3/goat-ear.webp'),
    ('goat heart & kidney mix', 'https://gameofbones.in/assets/catalogue-v3/goat-heart-kidney.webp'),
    ('goat liver', 'https://gameofbones.in/assets/catalogue-v3/goat-liver.webp'),
    ('goat lungs', 'https://gameofbones.in/assets/catalogue-v3/goat-lungs.webp'),
    ('goat spleen', 'https://gameofbones.in/assets/catalogue-v3/goat-spleen.webp'),
    ('goat trachea', 'https://gameofbones.in/assets/catalogue-v3/goat-trachea.webp'),
    ('mackerel fillet', 'https://gameofbones.in/assets/catalogue-v3/mackerel-fillet.webp'),
    ('prawns', 'https://gameofbones.in/assets/catalogue-v3/prawns.webp'),
    ('sardines', 'https://gameofbones.in/assets/catalogue-v3/sardines.webp'),
    ('tuna', 'https://gameofbones.in/assets/catalogue-v3/tuna.webp'),
    ('whole mackerel', 'https://gameofbones.in/assets/catalogue-v3/whole-mackerel.webp'),
    ('whole quail', 'https://gameofbones.in/assets/catalogue-v3/whole-quail.webp'),
    ('cat trial box', 'https://gameofbones.in/assets/catalogue-v3/cat-trial-box.webp'),
    ('surprise me box', 'https://gameofbones.in/assets/catalogue-v3/surprise-me-box.webp'),
    ('small treat box', 'https://gameofbones.in/assets/catalogue-v3/small-treat-box.webp'),
    ('medium treat box', 'https://gameofbones.in/assets/catalogue-v3/medium-treat-box.webp'),
    ('large treat box', 'https://gameofbones.in/assets/catalogue-v3/large-treat-box.webp')
)
update public.products as product
set image_url = image_map.image_url
from image_map
where lower(btrim(product.name)) = image_map.product_name
  and product.image_url is distinct from image_map.image_url;

commit;
