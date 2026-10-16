-- Live catalogue records for the October 2026 product launch.
insert into public.products
  (name, sku, description, price, mrp, compare_price, weight_grams, stock, category, filter, image_url, images, tags, is_active, reorder_level, best_before_days, sizes)
values
  (
    'Chicken Wing Tips', 'GOB-P-WTIP',
    'Crunchy, single-ingredient chicken wing tips, slowly dehydrated for short supervised chew sessions.',
    300, 300, 300, 100, 12, 'chew', 'chew',
    'https://gameofbones.in/assets/catalogue-plates/chicken-wings-fresh-batch-plate.png',
    array['https://gameofbones.in/assets/catalogue-plates/chicken-wings-fresh-batch-plate.png'],
    array['single ingredient','naturally dehydrated','supervised chew'], true, 10, 365,
    '[{"label":"1 pouch","weight_grams":100,"price":300,"compare_price":300,"stock":12},{"label":"2 pouches","weight_grams":200,"price":600,"compare_price":600,"stock":6},{"label":"3 pouches","weight_grams":300,"price":900,"compare_price":900,"stock":4},{"label":"4 pouches","weight_grams":400,"price":1200,"compare_price":1200,"stock":3}]'::jsonb
  ),
  (
    'White Sardines', 'GOB-G-WSRD',
    'Whole white sardines, slowly dehydrated into a crisp single-ingredient fish treat.',
    350, 350, 350, 60, 12, 'fish', 'fish',
    'https://gameofbones.in/assets/catalogue-plates/whole-fish-fresh-batch-plate.png',
    array['https://gameofbones.in/assets/catalogue-plates/whole-fish-fresh-batch-plate.png'],
    array['single ingredient','naturally dehydrated','fish treat'], true, 10, 365,
    '[{"label":"1 pouch","weight_grams":60,"price":350,"compare_price":350,"stock":12},{"label":"2 pouches","weight_grams":120,"price":700,"compare_price":700,"stock":6},{"label":"3 pouches","weight_grams":180,"price":1050,"compare_price":1050,"stock":4},{"label":"4 pouches","weight_grams":240,"price":1400,"compare_price":1400,"stock":3}]'::jsonb
  )
on conflict (sku) do update set
  name = excluded.name,
  description = excluded.description,
  price = excluded.price,
  mrp = excluded.mrp,
  compare_price = excluded.compare_price,
  weight_grams = excluded.weight_grams,
  stock = excluded.stock,
  category = excluded.category,
  filter = excluded.filter,
  image_url = excluded.image_url,
  images = excluded.images,
  tags = excluded.tags,
  is_active = excluded.is_active,
  reorder_level = excluded.reorder_level,
  best_before_days = excluded.best_before_days,
  sizes = excluded.sizes;
