--- original/gameofbones-website-main/index.html	2026-07-06 18:23:30.000000000 +0530
+++ website/gameofbones-website-main/index.html	2026-07-08 01:46:36.000000000 +0530
@@ -183,6 +183,7 @@
 .prod-card:hover .prod-fav{opacity:1}
 .prod-body{padding:16px}
 .prod-cat{font-size:10px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);margin-bottom:4px}
+.prod-weight{font-size:11px;font-weight:600;color:var(--brown,#8a6a3d);margin-bottom:4px;letter-spacing:.02em}
 .prod-name{font-size:17px;font-weight:700;color:var(--dark);margin-bottom:6px;font-family:'Cormorant Garamond',serif;line-height:1.2}
 .prod-desc{font-size:12px;color:var(--muted);line-height:1.5;font-weight:300;margin-bottom:8px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
 .prod-tags{display:flex;flex-wrap:wrap;gap:4px;margin-bottom:10px}
@@ -5313,9 +5314,27 @@
   return DEHYDRATION_INFO[name] || null;
 }
 
+// Scales a product's base per-pack weight/quantity (e.g. "60 Grams", "1 Piece")
+// by the pack multiplier implied by a size label like "Pack of 2".
+function getPackWeightLabel(product, sizeLabel) {
+  if (!product || !product.weight) return '';
+  var m = String(product.weight).match(/^(\d+)\s*(.+)$/);
+  if (!m) return product.weight;
+  var baseQty = parseInt(m[1], 10);
+  var unit = m[2].trim();
+  var packMatch = String(sizeLabel || '').match(/Pack of\s*(\d+)/i);
+  var multiplier = packMatch ? parseInt(packMatch[1], 10) : 1;
+  var totalQty = baseQty * multiplier;
+  if (/piece/i.test(unit)) {
+    unit = totalQty === 1 ? 'Piece' : 'Pieces';
+  }
+  return totalQty + ' ' + unit;
+}
+
+
 let products = [
   // ── JERKY ──────────────────────────────────────────────
-  {img:'https://syuostlqzzinigqwjzap.supabase.co/storage/v1/object/public/product-images/293b7ba0-37a7-4626-b97e-0f6aa8d86fa4/image-0-1782712553501.png', name:'Chicken Jerky', cat:'Boneless Jerky', badge:'Bestseller', badgeCls:'', desc:'Single-ingredient slow-dehydrated chicken breast. High-protein, low-fat. Perfect for training rewards.', tags:['Single Ingredient','Preservative Free'], sizes:[{label:'Pack of 1',price:329,mrp:329},{label:'Pack of 2',price:658,mrp:658},{label:'Pack of 3',price:987,mrp:987},{label:'Pack of 4',price:1316,mrp:1316}], filter:'jerky',
+  {img:'https://syuostlqzzinigqwjzap.supabase.co/storage/v1/object/public/product-images/293b7ba0-37a7-4626-b97e-0f6aa8d86fa4/image-0-1782712553501.png', name:'Chicken Jerky', cat:'Boneless Jerky', badge:'Bestseller', badgeCls:'', desc:'Single-ingredient slow-dehydrated chicken breast. High-protein, low-fat. Perfect for training rewards.', tags:['Single Ingredient','Preservative Free'], sizes:[{label:'Pack of 1',price:329,mrp:329},{label:'Pack of 2',price:658,mrp:658},{label:'Pack of 3',price:987,mrp:987},{label:'Pack of 4',price:1316,mrp:1316}], filter:'jerky', weight:'60 Grams',
     tagline:'Pure dehydrated chicken breast — nothing added, nothing removed. One ingredient, complete nutrition.',
     benefits:[
       {icon:'💪',title:'Lean Muscle Growth',text:'High biological value protein supports strong, healthy muscles in dogs of all ages.'},
@@ -5327,7 +5346,7 @@
     feeding:'Small dogs (under 10kg): 1–2 strips daily. Medium dogs (10–25kg): 2–3 strips. Large dogs (25kg+): 3–5 strips. Can be broken into smaller pieces for training. Always offer fresh water alongside treats.',
     storage:{tiles:[{icon:'🫙',val:'6 Months',label:'Unopened'},{icon:'❄️',val:'4 Weeks',label:'After Opening'},{icon:'🌡️',val:'Cool & Dry',label:'Store At'}],note:'Store in a cool, dry place away from direct sunlight. Once opened, seal the resealable pouch tightly or transfer to an airtight container. Do not refrigerate — moisture accelerates spoilage. Keep away from humid areas like kitchens.'},
   },
-  {img:'https://syuostlqzzinigqwjzap.supabase.co/storage/v1/object/public/product-images/5805f088-bda7-4070-9534-96fe4cfe77ef/image-0-1782140747762.png', name:'Buff Jerky', cat:'Boneless Jerky', badge:'Novel Protein', badgeCls:'brown', desc:'Premium buffalo jerky — rich in iron, zinc and amino acids. Ideal for dogs with chicken sensitivity.', tags:['Single Ingredient','Allergy Friendly'], sizes:[{label:'Pack of 1',price:449,mrp:449},{label:'Pack of 2',price:898,mrp:898},{label:'Pack of 3',price:1347,mrp:1347},{label:'Pack of 4',price:1796,mrp:1796}], filter:'jerky',
+  {img:'https://syuostlqzzinigqwjzap.supabase.co/storage/v1/object/public/product-images/5805f088-bda7-4070-9534-96fe4cfe77ef/image-0-1782140747762.png', name:'Buff Jerky', cat:'Boneless Jerky', badge:'Novel Protein', badgeCls:'brown', desc:'Premium buffalo jerky — rich in iron, zinc and amino acids. Ideal for dogs with chicken sensitivity.', tags:['Single Ingredient','Allergy Friendly'], sizes:[{label:'Pack of 1',price:449,mrp:449},{label:'Pack of 2',price:898,mrp:898},{label:'Pack of 3',price:1347,mrp:1347},{label:'Pack of 4',price:1796,mrp:1796}], filter:'jerky', weight:'60 Grams',
     tagline:'Buffalo is a novel protein most dogs haven\'t been exposed to — making it the ideal choice for allergy-prone dogs who need a break from chicken or beef.',
     benefits:[
       {icon:'🧬',title:'Novel Protein Source',text:'Most dogs haven\'t eaten buffalo before — meaning zero prior allergy exposure. Perfect elimination diet treat.'},
@@ -5340,7 +5359,7 @@
     storage:{tiles:[{icon:'🫙',val:'6 Months',label:'Unopened'},{icon:'❄️',val:'4 Weeks',label:'After Opening'},{icon:'🌡️',val:'Cool & Dry',label:'Store At'}],note:'Store in a cool, dry place away from direct sunlight. Once opened, seal the resealable pouch tightly or transfer to an airtight container. Do not refrigerate — moisture accelerates spoilage. Keep away from humid areas like kitchens.'},
   },
   // ── CHEWS & BONES ──────────────────────────────────────
-  {img:'https://syuostlqzzinigqwjzap.supabase.co/storage/v1/object/public/product-images/cac553a3-463f-4cf6-92dd-48c054f82bfe/image-0-1782712513139.png', name:'Chicken Feet', cat:'Chews & Bones', badge:'Dental Health', badgeCls:'teal', desc:'Natural glucosamine & chondroitin source. Soft dehydrated bone scrapes plaque while your dog chews.', tags:['Joint Support','Dental','Glucosamine'], sizes:[{label:'Pack of 1',price:300,mrp:300},{label:'Pack of 2',price:600,mrp:600},{label:'Pack of 3',price:900,mrp:900},{label:'Pack of 4',price:1200,mrp:1200}], filter:'chew',
+  {img:'https://syuostlqzzinigqwjzap.supabase.co/storage/v1/object/public/product-images/cac553a3-463f-4cf6-92dd-48c054f82bfe/image-0-1782712513139.png', name:'Chicken Feet', cat:'Chews & Bones', badge:'Dental Health', badgeCls:'teal', desc:'Natural glucosamine & chondroitin source. Soft dehydrated bone scrapes plaque while your dog chews.', tags:['Joint Support','Dental','Glucosamine'], sizes:[{label:'Pack of 1',price:300,mrp:300},{label:'Pack of 2',price:600,mrp:600},{label:'Pack of 3',price:900,mrp:900},{label:'Pack of 4',price:1200,mrp:1200}], filter:'chew', weight:'70 Grams',
     tagline:'Chicken feet are one of nature\'s most complete functional treats — they clean teeth, support joints and keep dogs entertained, all from a single natural ingredient.',
     benefits:[
       {icon:'🦴',title:'Natural Joint Supplement',text:'Loaded with glucosamine and chondroitin — the same compounds in expensive joint supplements, but in a form dogs actually want to eat.'},
@@ -5352,7 +5371,7 @@
     feeding:'1–2 feet per day depending on size. Small breeds: 1 foot. Medium/large breeds: 2 feet. Feed as a standalone treat or alongside meals. Completely digestible — safe unlike cooked bones.',
     storage:{tiles:[{icon:'🫙',val:'12 Months',label:'Unopened'},{icon:'🏠',val:'2–3 Months',label:'After Opening'},{icon:'🌡️',val:'Cool & Dry',label:'Store At'}],note:'Dehydrated chews and bones have a longer shelf life due to low moisture content. Store in a cool, dry location. Once opened, keep in the resealable pouch or an airtight container. No refrigeration needed. If you notice any soft spots or unusual smell, discard the affected piece.'},
   },
-  {img:'https://syuostlqzzinigqwjzap.supabase.co/storage/v1/object/public/product-images/373c6199-f75b-4294-8626-4f173fda9f5d/image-0-1782712577445.png', name:'Chicken Neck', cat:'Chews & Bones', badge:'Calcium Rich', badgeCls:'teal', desc:'Whole chicken neck — satisfying chew with natural calcium and phosphorus for strong bones.', tags:['Digestible Bone','Calcium','Natural'], sizes:[{label:'Pack of 1',price:300,mrp:300},{label:'Pack of 2',price:600,mrp:600},{label:'Pack of 3',price:900,mrp:900},{label:'Pack of 4',price:1200,mrp:1200}], filter:'chew',
+  {img:'https://syuostlqzzinigqwjzap.supabase.co/storage/v1/object/public/product-images/373c6199-f75b-4294-8626-4f173fda9f5d/image-0-1782712577445.png', name:'Chicken Neck', cat:'Chews & Bones', badge:'Calcium Rich', badgeCls:'teal', desc:'Whole chicken neck — satisfying chew with natural calcium and phosphorus for strong bones.', tags:['Digestible Bone','Calcium','Natural'], sizes:[{label:'Pack of 1',price:300,mrp:300},{label:'Pack of 2',price:600,mrp:600},{label:'Pack of 3',price:900,mrp:900},{label:'Pack of 4',price:1200,mrp:1200}], filter:'chew', weight:'70 Grams',
     tagline:'A natural, digestible bone treat that delivers the calcium-phosphorus balance dogs need for strong bones — without the risks of cooked bones.',
     benefits:[
       {icon:'🦴',title:'Natural Calcium Source',text:'Provides bioavailable calcium and phosphorus in the correct ratio for bone density and dental health.'},
@@ -5364,7 +5383,7 @@
     feeding:'Small dogs: ½ neck daily. Medium dogs: 1 neck daily. Large dogs: 1–2 necks daily. Best given as a meal-time supplement or evening chew. Always supervise first-time chewers.',
     storage:{tiles:[{icon:'🫙',val:'12 Months',label:'Unopened'},{icon:'🏠',val:'2–3 Months',label:'After Opening'},{icon:'🌡️',val:'Cool & Dry',label:'Store At'}],note:'Dehydrated chews and bones have a longer shelf life due to low moisture content. Store in a cool, dry location. Once opened, keep in the resealable pouch or an airtight container. No refrigeration needed. If you notice any soft spots or unusual smell, discard the affected piece.'},
   },
-  {img:'https://syuostlqzzinigqwjzap.supabase.co/storage/v1/object/public/product-images/2d733070-14d7-4d82-9ec4-4aa1548cbc35/image-0-1782712121099.png', name:'Chicken Bites', cat:'Boneless Jerky', badge:'Training Treat', badgeCls:'', desc:'Bite-sized dehydrated chicken pieces — perfect treat size for training. High protein, easy to carry.', tags:['Single Ingredient','Small Bites'], sizes:[{label:'Pack of 1',price:329,mrp:329},{label:'Pack of 2',price:658,mrp:658},{label:'Pack of 3',price:987,mrp:987},{label:'Pack of 4',price:1316,mrp:1316}], filter:'jerky',
+  {img:'https://syuostlqzzinigqwjzap.supabase.co/storage/v1/object/public/product-images/2d733070-14d7-4d82-9ec4-4aa1548cbc35/image-0-1782712121099.png', name:'Chicken Bites', cat:'Boneless Jerky', badge:'Training Treat', badgeCls:'', desc:'Bite-sized dehydrated chicken pieces — perfect treat size for training. High protein, easy to carry.', tags:['Single Ingredient','Small Bites'], sizes:[{label:'Pack of 1',price:329,mrp:329},{label:'Pack of 2',price:658,mrp:658},{label:'Pack of 3',price:987,mrp:987},{label:'Pack of 4',price:1316,mrp:1316}], filter:'jerky', weight:'60 Grams',
     tagline:'Small, consistent pieces of dehydrated chicken designed for training sessions where you need to reward quickly and often without overfeeding.',
     benefits:[
       {icon:'🎯',title:'Training Optimised',text:'Uniform bite-sized pieces allow precise portion control during reward-based training — no tearing required.'},
@@ -5377,7 +5396,7 @@
     storage:{tiles:[{icon:'🫙',val:'6 Months',label:'Unopened'},{icon:'❄️',val:'4 Weeks',label:'After Opening'},{icon:'🌡️',val:'Cool & Dry',label:'Store At'}],note:'Store in a cool, dry place away from direct sunlight. Once opened, seal the resealable pouch tightly or transfer to an airtight container. Do not refrigerate — moisture accelerates spoilage. Keep away from humid areas like kitchens.'},
   },
 
-  {img:'https://syuostlqzzinigqwjzap.supabase.co/storage/v1/object/public/product-images/ef9d3dbe-f6d7-4e59-b673-ffe451e0ab5a/image-0-1782712167008.png', name:'Chicken Wings', cat:'Chews & Bones', badge:'Fan Favourite', badgeCls:'', desc:'Crunchy dehydrated chicken wings — collagen-rich, great for coat health and a satisfying long chew.', tags:['Collagen Rich','Coat Health','Bone-In'], sizes:[{label:'Pack of 1',price:350,mrp:350},{label:'Pack of 2',price:700,mrp:700},{label:'Pack of 3',price:1050,mrp:1050}], filter:'chew',
+  {img:'https://syuostlqzzinigqwjzap.supabase.co/storage/v1/object/public/product-images/ef9d3dbe-f6d7-4e59-b673-ffe451e0ab5a/image-0-1782712167008.png', name:'Chicken Wings', cat:'Chews & Bones', badge:'Fan Favourite', badgeCls:'', desc:'Crunchy dehydrated chicken wings — collagen-rich, great for coat health and a satisfying long chew.', tags:['Collagen Rich','Coat Health','Bone-In'], sizes:[{label:'Pack of 1',price:350,mrp:350},{label:'Pack of 2',price:700,mrp:700},{label:'Pack of 3',price:1050,mrp:1050}], filter:'chew', weight:'5 Pieces',
     tagline:'More skin, more cartilage, more collagen. Chicken wings are the coat and joint treat disguised as a delicious crunchy chew.',
     benefits:[
       {icon:'✨',title:'Shiny Coat & Skin',text:'The high collagen content in skin and cartilage directly supports skin elasticity and a glossy, healthy coat.'},
@@ -5389,7 +5408,7 @@
     feeding:'Small dogs: 1 wing every 2 days. Medium dogs: 1 wing daily. Large dogs: 2 wings daily. Supervise all chewing sessions, especially for aggressive chewers.',
     storage:{tiles:[{icon:'🫙',val:'12 Months',label:'Unopened'},{icon:'🏠',val:'2–3 Months',label:'After Opening'},{icon:'🌡️',val:'Cool & Dry',label:'Store At'}],note:'Dehydrated chews and bones have a longer shelf life due to low moisture content. Store in a cool, dry location. Once opened, keep in the resealable pouch or an airtight container. No refrigeration needed. If you notice any soft spots or unusual smell, discard the affected piece.'},
   },
-{img:'https://syuostlqzzinigqwjzap.supabase.co/storage/v1/object/public/product-images/937c9539-b00d-4e93-9291-1af00893a061/image-0-1782712130859.png', name:'Chicken Bones', cat:'Chews & Bones', badge:'High Value', badgeCls:'teal', desc:'Assorted dehydrated chicken bones — natural calcium source, safe digestible chew for all breeds.', tags:['Digestible','Calcium','Natural'], sizes:[{label:'Pack of 1',price:200,mrp:200},{label:'Pack of 2',price:400,mrp:400},{label:'Pack of 3',price:600,mrp:600},{label:'Pack of 4',price:800,mrp:800}], filter:'chew',
+{img:'https://syuostlqzzinigqwjzap.supabase.co/storage/v1/object/public/product-images/937c9539-b00d-4e93-9291-1af00893a061/image-0-1782712130859.png', name:'Chicken Bones', cat:'Chews & Bones', badge:'High Value', badgeCls:'teal', desc:'Assorted dehydrated chicken bones — natural calcium source, safe digestible chew for all breeds.', tags:['Digestible','Calcium','Natural'], sizes:[{label:'Pack of 1',price:200,mrp:200},{label:'Pack of 2',price:400,mrp:400},{label:'Pack of 3',price:600,mrp:600},{label:'Pack of 4',price:800,mrp:800}], filter:'chew', weight:'100 Grams',
     tagline:'An assortment of dehydrated chicken bones — a natural, affordable calcium supplement that doubles as an enriching chew.',
     benefits:[
       {icon:'🦴',title:'Natural Calcium Supply',text:'Provides bioavailable calcium essential for strong bones, healthy teeth, nerve function and muscle contraction.'},
@@ -5401,7 +5420,7 @@
     feeding:'Feed 1–2 pieces daily depending on size. Ensure fresh water is always available. Do not feed if your dog is on calcium-restricted diet — consult your vet.',
     storage:{tiles:[{icon:'🫙',val:'12 Months',label:'Unopened'},{icon:'🏠',val:'2–3 Months',label:'After Opening'},{icon:'🌡️',val:'Cool & Dry',label:'Store At'}],note:'Dehydrated chews and bones have a longer shelf life due to low moisture content. Store in a cool, dry location. Once opened, keep in the resealable pouch or an airtight container. No refrigeration needed. If you notice any soft spots or unusual smell, discard the affected piece.'},
   },
-  {img:'https://syuostlqzzinigqwjzap.supabase.co/storage/v1/object/public/product-images/cb465b52-4add-49b6-82be-b6f016d10b7c/image-0-1782795689958.png', name:'Goat Trachea', cat:'Chews & Bones', badge:'Joint Superfood', badgeCls:'teal', desc:'Natural cartilage-rich chew packed with glucosamine & chondroitin. Excellent for senior or active dogs.', tags:['Glucosamine','Cartilage','Joint Support'], sizes:[{label:'Pack of 1',price:100,mrp:100},{label:'Pack of 2',price:200,mrp:200},{label:'Pack of 3',price:300,mrp:300}], filter:'chew',
+  {img:'https://syuostlqzzinigqwjzap.supabase.co/storage/v1/object/public/product-images/cb465b52-4add-49b6-82be-b6f016d10b7c/image-0-1782795689958.png', name:'Goat Trachea', cat:'Chews & Bones', badge:'Joint Superfood', badgeCls:'teal', desc:'Natural cartilage-rich chew packed with glucosamine & chondroitin. Excellent for senior or active dogs.', tags:['Glucosamine','Cartilage','Joint Support'], sizes:[{label:'Pack of 1',price:100,mrp:100},{label:'Pack of 2',price:200,mrp:200},{label:'Pack of 3',price:300,mrp:300}], filter:'chew', weight:'1 Piece',
     tagline:'Goat trachea is almost pure cartilage — which means it is almost pure glucosamine and chondroitin. Nature\'s own joint supplement in a form dogs find delicious.',
     benefits:[
       {icon:'🏃',title:'Superior Joint Support',text:'Cartilage is the richest natural source of glucosamine and chondroitin — compounds proven to reduce joint inflammation and improve mobility.'},
@@ -5413,7 +5432,7 @@
     feeding:'1 piece per day for medium/large dogs. Small dogs: ½ piece daily. Best given as an evening chew. Ideal as a daily joint supplement for senior dogs (7+ years).',
     storage:{tiles:[{icon:'🫙',val:'12 Months',label:'Unopened'},{icon:'🏠',val:'2–3 Months',label:'After Opening'},{icon:'🌡️',val:'Cool & Dry',label:'Store At'}],note:'Dehydrated chews and bones have a longer shelf life due to low moisture content. Store in a cool, dry location. Once opened, keep in the resealable pouch or an airtight container. No refrigeration needed. If you notice any soft spots or unusual smell, discard the affected piece.'},
   },
-  {img:'https://syuostlqzzinigqwjzap.supabase.co/storage/v1/object/public/product-images/abef0def-e2c9-4981-b6bc-80a079ed31eb/image-0-1782712288081.png', name:'Goat Trotter', cat:'Chews & Bones', badge:'Long Lasting', badgeCls:'', desc:'Hard-working chew for powerful chewers. Rich in collagen and marrow, keeps dogs engaged for hours.', tags:['Power Chewer','Collagen','Marrow'], sizes:[{label:'Pack of 1',price:225,mrp:225},{label:'Pack of 2',price:450,mrp:450},{label:'Pack of 3',price:675,mrp:675},{label:'Pack of 4',price:900,mrp:900}], filter:'chew',
+  {img:'https://syuostlqzzinigqwjzap.supabase.co/storage/v1/object/public/product-images/abef0def-e2c9-4981-b6bc-80a079ed31eb/image-0-1782712288081.png', name:'Goat Trotter', cat:'Chews & Bones', badge:'Long Lasting', badgeCls:'', desc:'Hard-working chew for powerful chewers. Rich in collagen and marrow, keeps dogs engaged for hours.', tags:['Power Chewer','Collagen','Marrow'], sizes:[{label:'Pack of 1',price:225,mrp:225},{label:'Pack of 2',price:450,mrp:450},{label:'Pack of 3',price:675,mrp:675},{label:'Pack of 4',price:900,mrp:900}], filter:'chew', weight:'1 Piece',
     tagline:'Built for dogs that destroy every chew in minutes. Goat trotters are dense, durable and loaded with marrow and collagen — a true power chew.',
     benefits:[
       {icon:'💪',title:'Built for Power Chewers',text:'Dense bone structure withstands aggressive chewing — ideal for dogs that finish every other chew too quickly.'},
@@ -5425,7 +5444,7 @@
     feeding:'1 trotter per week for large breeds; 1 every 10 days for medium breeds; not recommended for toy breeds under 5kg. Always supervise. Limit marrow-rich bones to prevent loose stools.',
     storage:{tiles:[{icon:'🫙',val:'12 Months',label:'Unopened'},{icon:'🏠',val:'2–3 Months',label:'After Opening'},{icon:'🌡️',val:'Cool & Dry',label:'Store At'}],note:'Dehydrated chews and bones have a longer shelf life due to low moisture content. Store in a cool, dry location. Once opened, keep in the resealable pouch or an airtight container. No refrigeration needed. If you notice any soft spots or unusual smell, discard the affected piece.'},
   },
-  {img:'https://syuostlqzzinigqwjzap.supabase.co/storage/v1/object/public/product-images/9e4a7262-ad95-4076-a0ee-949f9582616f/image-0-1782712197998.png', name:'Goat Ear', cat:'Chews & Bones', badge:'Light Chew', badgeCls:'', desc:'Thin, crunchy goat ears — a lighter chew that is great for smaller breeds and senior dogs.', tags:['Light Chew','Small Breeds','Crunchy'], sizes:[{label:'Pack of 1',price:350,mrp:350},{label:'Pack of 2',price:700,mrp:700},{label:'Pack of 3',price:1050,mrp:1050},{label:'Pack of 4',price:1400,mrp:1400}], filter:'chew',
+  {img:'https://syuostlqzzinigqwjzap.supabase.co/storage/v1/object/public/product-images/9e4a7262-ad95-4076-a0ee-949f9582616f/image-0-1782712197998.png', name:'Goat Ear', cat:'Chews & Bones', badge:'Light Chew', badgeCls:'', desc:'Thin, crunchy goat ears — a lighter chew that is great for smaller breeds and senior dogs.', tags:['Light Chew','Small Breeds','Crunchy'], sizes:[{label:'Pack of 1',price:350,mrp:350},{label:'Pack of 2',price:700,mrp:700},{label:'Pack of 3',price:1050,mrp:1050},{label:'Pack of 4',price:1400,mrp:1400}], filter:'chew', weight:'6 Pieces',
     tagline:'Not every dog wants a dense, hours-long chew. Goat ears are the perfect light, satisfying crunch — crunchy, digestible and low in fat.',
     benefits:[
       {icon:'🐩',title:'Perfect for Small Breeds',text:'Light, thin and not too hard — ideal for small or toy breeds whose jaws aren\'t built for heavy bones.'},
@@ -5439,7 +5458,7 @@
   },
 
   // ── ORGAN TREATS ───────────────────────────────────────
-  {img:'https://syuostlqzzinigqwjzap.supabase.co/storage/v1/object/public/product-images/5d4353a7-fd6c-4919-a32b-4d4c66fd44ab/image-0-1782712147567.png', name:'Chicken Gizzards', cat:'Organ Treats', badge:'B12 Powerhouse', badgeCls:'brown', desc:'Nutrient-dense gizzards packed with B12, iron, zinc and phosphorus. Nature\'s multivitamin for dogs.', tags:['B12','Iron Rich','Immune Support'], sizes:[{label:'Pack of 1',price:300,mrp:300},{label:'Pack of 2',price:600,mrp:600},{label:'Pack of 3',price:900,mrp:900},{label:'Pack of 4',price:1200,mrp:1200}], filter:'organ',
+  {img:'https://syuostlqzzinigqwjzap.supabase.co/storage/v1/object/public/product-images/5d4353a7-fd6c-4919-a32b-4d4c66fd44ab/image-0-1782712147567.png', name:'Chicken Gizzards', cat:'Organ Treats', badge:'B12 Powerhouse', badgeCls:'brown', desc:'Nutrient-dense gizzards packed with B12, iron, zinc and phosphorus. Nature\'s multivitamin for dogs.', tags:['B12','Iron Rich','Immune Support'], sizes:[{label:'Pack of 1',price:300,mrp:300},{label:'Pack of 2',price:600,mrp:600},{label:'Pack of 3',price:900,mrp:900},{label:'Pack of 4',price:1200,mrp:1200}], filter:'organ', weight:'60 Grams',
     tagline:'Gizzards are the hidden gem of organ meats — extremely nutrient-dense yet often overlooked. Think of them as a natural, whole-food multivitamin.',
     benefits:[
       {icon:'🧬',title:'B12 for Nerve Health',text:'Chicken gizzards are exceptionally high in Vitamin B12, essential for healthy nerve function and red blood cell formation.'},
@@ -5451,7 +5470,7 @@
     feeding:'Organ meats should make up no more than 10–15% of the diet. Feed 2–3 times per week. Small dogs: 30–40g per serving. Medium dogs: 60–80g. Large dogs: 100–120g.',
     storage:{tiles:[{icon:'🫙',val:'6 Months',label:'Unopened'},{icon:'❄️',val:'3 Weeks',label:'After Opening'},{icon:'🌡️',val:'Cool & Dry',label:'Store At'}],note:'Organ treats have higher moisture sensitivity than jerky. Store in a cool, dry location in the sealed pouch. After opening, reseal tightly and keep in a cool spot — or refrigerate for maximum freshness. Use within 3 weeks of opening. Discard if you detect any unusual smell.'},
   },
-  {img:'https://syuostlqzzinigqwjzap.supabase.co/storage/v1/object/public/product-images/b8ea22dc-d46f-4ee9-b779-8c1aacafd755/image-0-1782759470191.png', name:'Chicken Heart & Liver', cat:'Organ Treats', badge:'Superfood', badgeCls:'brown', desc:'Rich in Vitamin A, B12 and iron. One of the most nutrient-dense organ meats available.', tags:['Vitamin A','B12','Organ Meat'], sizes:[{label:'Pack of 1',price:300,mrp:300},{label:'Pack of 2',price:600,mrp:600},{label:'Pack of 3',price:900,mrp:900},{label:'Pack of 4',price:1200,mrp:1200}], filter:'organ',
+  {img:'https://syuostlqzzinigqwjzap.supabase.co/storage/v1/object/public/product-images/b8ea22dc-d46f-4ee9-b779-8c1aacafd755/image-0-1782759470191.png', name:'Chicken Heart & Liver', cat:'Organ Treats', badge:'Superfood', badgeCls:'brown', desc:'Rich in Vitamin A, B12 and iron. One of the most nutrient-dense organ meats available.', tags:['Vitamin A','B12','Organ Meat'], sizes:[{label:'Pack of 1',price:300,mrp:300},{label:'Pack of 2',price:600,mrp:600},{label:'Pack of 3',price:900,mrp:900},{label:'Pack of 4',price:1200,mrp:1200}], filter:'organ', weight:'60 Grams',
     tagline:'Liver is the most nutrient-dense food on the planet — for humans and dogs alike. A small amount delivers an extraordinary range of vitamins and minerals.',
     benefits:[
       {icon:'👁️',title:'Vitamin A for Vision',text:'Liver is the richest natural source of Vitamin A, essential for eye health, immune function and skin maintenance.'},
@@ -5463,7 +5482,7 @@
     feeding:'Liver is very rich — feed in moderation. 2–3 times per week maximum. Small dogs: 20–30g per serving. Medium: 50–60g. Large: 80–100g. Excessive liver can cause Vitamin A toxicity — do not overfeed.',
     storage:{tiles:[{icon:'🫙',val:'6 Months',label:'Unopened'},{icon:'❄️',val:'3 Weeks',label:'After Opening'},{icon:'🌡️',val:'Cool & Dry',label:'Store At'}],note:'Organ treats have higher moisture sensitivity than jerky. Store in a cool, dry location in the sealed pouch. After opening, reseal tightly and keep in a cool spot — or refrigerate for maximum freshness. Use within 3 weeks of opening. Discard if you detect any unusual smell.'},
   },
-  {img:'https://syuostlqzzinigqwjzap.supabase.co/storage/v1/object/public/product-images/f804c0d1-0be7-4281-bc8a-c9dc6e8cfd50/image-0-1782712241277.png', name:'Goat Liver', cat:'Organ Treats', badge:'Premium Organ', badgeCls:'brown', desc:'Goat liver — richer and more intense than chicken. Exceptional source of Vitamin A, copper and folate.', tags:['Vitamin A','Copper','Rich Flavour'], sizes:[{label:'Pack of 1',price:450,mrp:450},{label:'Pack of 2',price:900,mrp:900},{label:'Pack of 3',price:1350,mrp:1350},{label:'Pack of 4',price:1800,mrp:1800}], filter:'organ',
+  {img:'https://syuostlqzzinigqwjzap.supabase.co/storage/v1/object/public/product-images/f804c0d1-0be7-4281-bc8a-c9dc6e8cfd50/image-0-1782712241277.png', name:'Goat Liver', cat:'Organ Treats', badge:'Premium Organ', badgeCls:'brown', desc:'Goat liver — richer and more intense than chicken. Exceptional source of Vitamin A, copper and folate.', tags:['Vitamin A','Copper','Rich Flavour'], sizes:[{label:'Pack of 1',price:450,mrp:450},{label:'Pack of 2',price:900,mrp:900},{label:'Pack of 3',price:1350,mrp:1350},{label:'Pack of 4',price:1800,mrp:1800}], filter:'organ', weight:'60 Grams',
     tagline:'Goat liver carries a richer, more intense nutritional profile than chicken liver — particularly in copper, folate and Vitamin A. Excellent for dogs needing a nutritional boost.',
     benefits:[
       {icon:'🥇',title:'Superior Vitamin A Density',text:'Goat liver contains even higher concentrations of Vitamin A than chicken liver — powerful immune and vision support.'},
@@ -5475,7 +5494,7 @@
     feeding:'Same moderation as chicken liver applies. Feed 2–3 times per week. The higher nutrient density means you need slightly smaller servings than chicken liver.',
     storage:{tiles:[{icon:'🫙',val:'6 Months',label:'Unopened'},{icon:'❄️',val:'3 Weeks',label:'After Opening'},{icon:'🌡️',val:'Cool & Dry',label:'Store At'}],note:'Organ treats have higher moisture sensitivity than jerky. Store in a cool, dry location in the sealed pouch. After opening, reseal tightly and keep in a cool spot — or refrigerate for maximum freshness. Use within 3 weeks of opening. Discard if you detect any unusual smell.'},
   },
-  {img:'https://syuostlqzzinigqwjzap.supabase.co/storage/v1/object/public/product-images/39ac015f-9a37-49c4-b2df-34b29472eca7/image-0-1782712258742.png', name:'Goat Lungs', cat:'Organ Treats', badge:'Low Fat', badgeCls:'', desc:'Lightweight and crunchy dehydrated goat lungs. High protein, very low fat — great for weight-conscious dogs.', tags:['Low Fat','High Protein','Light'], sizes:[{label:'Pack of 1',price:450,mrp:450},{label:'Pack of 2',price:900,mrp:900},{label:'Pack of 3',price:1350,mrp:1350},{label:'Pack of 4',price:1800,mrp:1800}], filter:'organ',
+  {img:'https://syuostlqzzinigqwjzap.supabase.co/storage/v1/object/public/product-images/39ac015f-9a37-49c4-b2df-34b29472eca7/image-0-1782712258742.png', name:'Goat Lungs', cat:'Organ Treats', badge:'Low Fat', badgeCls:'', desc:'Lightweight and crunchy dehydrated goat lungs. High protein, very low fat — great for weight-conscious dogs.', tags:['Low Fat','High Protein','Light'], sizes:[{label:'Pack of 1',price:450,mrp:450},{label:'Pack of 2',price:900,mrp:900},{label:'Pack of 3',price:1350,mrp:1350},{label:'Pack of 4',price:1800,mrp:1800}], filter:'organ', weight:'60 Grams',
     tagline:'Goat lungs are the rare organ treat that is genuinely low in fat — making them perfect for overweight dogs or breeds prone to pancreatitis who still deserve a delicious reward.',
     benefits:[
       {icon:'⚖️',title:'Ideal for Weight Management',text:'Very low fat content makes lungs one of the few organ treats that can be given to dogs on calorie-restricted diets.'},
@@ -5487,7 +5506,7 @@
     feeding:'Can be given more freely than other organs due to low fat. Daily feeding is fine for most dogs. Great as a training treat for dogs on weight management programmes.',
     storage:{tiles:[{icon:'🫙',val:'6 Months',label:'Unopened'},{icon:'❄️',val:'3 Weeks',label:'After Opening'},{icon:'🌡️',val:'Cool & Dry',label:'Store At'}],note:'Organ treats have higher moisture sensitivity than jerky. Store in a cool, dry location in the sealed pouch. After opening, reseal tightly and keep in a cool spot — or refrigerate for maximum freshness. Use within 3 weeks of opening. Discard if you detect any unusual smell.'},
   },
-  {img:'https://syuostlqzzinigqwjzap.supabase.co/storage/v1/object/public/product-images/007d8e1a-3640-4b75-b467-d27782f82855/image-0-1782712225799.png', name:'Goat Heart & Kidney Mix', cat:'Organ Treats', badge:'Heart Health', badgeCls:'', desc:'Goat heart and kidney — rich in taurine, CoQ10 and B vitamins. Supports cardiovascular health.', tags:['Taurine','Heart Health','B Vitamins'], sizes:[{label:'Pack of 1',price:499,mrp:499},{label:'Pack of 2',price:998,mrp:998},{label:'Pack of 3',price:1497,mrp:1497},{label:'Pack of 4',price:1996,mrp:1996}], filter:'organ',
+  {img:'https://syuostlqzzinigqwjzap.supabase.co/storage/v1/object/public/product-images/007d8e1a-3640-4b75-b467-d27782f82855/image-0-1782712225799.png', name:'Goat Heart & Kidney Mix', cat:'Organ Treats', badge:'Heart Health', badgeCls:'', desc:'Goat heart and kidney — rich in taurine, CoQ10 and B vitamins. Supports cardiovascular health.', tags:['Taurine','Heart Health','B Vitamins'], sizes:[{label:'Pack of 1',price:499,mrp:499},{label:'Pack of 2',price:998,mrp:998},{label:'Pack of 3',price:1497,mrp:1497},{label:'Pack of 4',price:1996,mrp:1996}], filter:'organ', weight:'60 Grams',
     tagline:'Heart and kidney are muscle meat-adjacent organs packed with taurine and CoQ10 — two nutrients critical for cardiac health that are often deficient in grain-fed dogs.',
     benefits:[
       {icon:'❤️',title:'Taurine for Heart Health',text:'Taurine deficiency is linked to dilated cardiomyopathy in dogs. Heart organ meat is one of the best natural taurine sources.'},
@@ -5499,7 +5518,7 @@
     feeding:'Feed 2–3 times per week as part of a varied diet. Small dogs: 30–40g. Medium: 60–80g. Large: 100g. Combine with liver for a complete organ meat rotation.',
     storage:{tiles:[{icon:'🫙',val:'6 Months',label:'Unopened'},{icon:'❄️',val:'3 Weeks',label:'After Opening'},{icon:'🌡️',val:'Cool & Dry',label:'Store At'}],note:'Organ treats have higher moisture sensitivity than jerky. Store in a cool, dry location in the sealed pouch. After opening, reseal tightly and keep in a cool spot — or refrigerate for maximum freshness. Use within 3 weeks of opening. Discard if you detect any unusual smell.'},
   },
-  {img:'https://syuostlqzzinigqwjzap.supabase.co/storage/v1/object/public/product-images/92d62ad6-33db-45f3-af57-91b6a454a07a/image-0-1782712272366.png', name:'Goat Spleen', cat:'Organ Treats', badge:'Iron Rich', badgeCls:'brown', desc:'Goat spleen is one of the richest natural iron sources available. Excellent for anaemic or low-energy dogs.', tags:['Iron Rich','Haemoglobin','Rare Organ'], sizes:[{label:'Pack of 1',price:450,mrp:450},{label:'Pack of 2',price:900,mrp:900},{label:'Pack of 3',price:1350,mrp:1350},{label:'Pack of 4',price:1800,mrp:1800}], filter:'organ',
+  {img:'https://syuostlqzzinigqwjzap.supabase.co/storage/v1/object/public/product-images/92d62ad6-33db-45f3-af57-91b6a454a07a/image-0-1782712272366.png', name:'Goat Spleen', cat:'Organ Treats', badge:'Iron Rich', badgeCls:'brown', desc:'Goat spleen is one of the richest natural iron sources available. Excellent for anaemic or low-energy dogs.', tags:['Iron Rich','Haemoglobin','Rare Organ'], sizes:[{label:'Pack of 1',price:450,mrp:450},{label:'Pack of 2',price:900,mrp:900},{label:'Pack of 3',price:1350,mrp:1350},{label:'Pack of 4',price:1800,mrp:1800}], filter:'organ', weight:'60 Grams',
     tagline:'Spleen is arguably the single richest natural source of iron available in whole food form — far more concentrated than liver or muscle meat.',
     benefits:[
       {icon:'🩸',title:'Exceptional Iron Content',text:'Spleen contains iron concentrations several times higher than muscle meat — directly combating anaemia and fatigue.'},
@@ -5513,7 +5532,7 @@
   },
 
   // ── FISH ───────────────────────────────────────────────
-  {img:'https://syuostlqzzinigqwjzap.supabase.co/storage/v1/object/public/product-images/f0846a93-7d6b-42aa-90a7-a6ddd771c156/image-0-1782712072618.png', name:'Anchovies', cat:'Fish Treats', badge:'Omega-3', badgeCls:'teal', desc:'Wild-caught whole anchovies — one of the best natural sources of EPA & DHA omega-3. Shiny coat guaranteed.', tags:['Omega-3','DHA','Wild Caught'], sizes:[{label:'Pack of 1',price:320,mrp:349},{label:'Pack of 2',price:698,mrp:698},{label:'Pack of 3',price:1047,mrp:1047},{label:'Pack of 4',price:1396,mrp:1396}], filter:'fish',
+  {img:'https://syuostlqzzinigqwjzap.supabase.co/storage/v1/object/public/product-images/f0846a93-7d6b-42aa-90a7-a6ddd771c156/image-0-1782712072618.png', name:'Anchovies', cat:'Fish Treats', badge:'Omega-3', badgeCls:'teal', desc:'Wild-caught whole anchovies — one of the best natural sources of EPA & DHA omega-3. Shiny coat guaranteed.', tags:['Omega-3','DHA','Wild Caught'], sizes:[{label:'Pack of 1',price:320,mrp:349},{label:'Pack of 2',price:698,mrp:698},{label:'Pack of 3',price:1047,mrp:1047},{label:'Pack of 4',price:1396,mrp:1396}], filter:'fish', weight:'60 Grams',
     tagline:'Small fish, massive nutritional impact. Anchovies have one of the highest omega-3 concentrations of any food — and because they\'re small, they\'re free from heavy metal accumulation.',
     benefits:[
       {icon:'✨',title:'Guaranteed Shiny Coat',text:'EPA and DHA omega-3 fatty acids directly feed skin cells and hair follicles — visible coat improvement within 4–6 weeks.'},
@@ -5525,7 +5544,7 @@
     feeding:'2–4 anchovies daily for small dogs. 4–6 for medium. 6–10 for large dogs. Can be crumbled as a meal topper. Daily feeding is ideal for ongoing omega-3 supplementation.',
     storage:{tiles:[{icon:'🫙',val:'6 Months',label:'Unopened'},{icon:'🌬️',val:'3 Weeks',label:'After Opening'},{icon:'🚫',val:'Away from Heat',label:'Store Away'}],note:'Fish treats are moisture-sensitive. Store in a cool, dry location in the sealed pouch. After opening, press out air, reseal tightly and use within 3 weeks. Keep away from direct sunlight and heat sources. If you notice any off-smell or moisture, discard immediately.'},
   },
-  {img:'https://syuostlqzzinigqwjzap.supabase.co/storage/v1/object/public/product-images/46addf99-2f4a-44f2-ba64-7623cde174ff/image-0-1782712106125.png', name:'Bombay Duck', cat:'Fish Treats', badge:'Uniquely Indian', badgeCls:'brown', desc:'Traditional Bombil (Bombay Duck) — a low-calorie, high-protein coastal treat rich in iodine and selenium.', tags:['Iodine','Low Calorie','Made in India'], sizes:[{label:'Pack of 1',price:399,mrp:399},{label:'Pack of 2',price:798,mrp:798},{label:'Pack of 3',price:1197,mrp:1197},{label:'Pack of 4',price:1596,mrp:1596}], filter:'fish',
+  {img:'https://syuostlqzzinigqwjzap.supabase.co/storage/v1/object/public/product-images/46addf99-2f4a-44f2-ba64-7623cde174ff/image-0-1782712106125.png', name:'Bombay Duck', cat:'Fish Treats', badge:'Uniquely Indian', badgeCls:'brown', desc:'Traditional Bombil (Bombay Duck) — a low-calorie, high-protein coastal treat rich in iodine and selenium.', tags:['Iodine','Low Calorie','Made in India'], sizes:[{label:'Pack of 1',price:399,mrp:399},{label:'Pack of 2',price:798,mrp:798},{label:'Pack of 3',price:1197,mrp:1197},{label:'Pack of 4',price:1596,mrp:1596}], filter:'fish', weight:'60 Grams',
     tagline:'Bombil is a uniquely Indian coastal fish rarely found in any pet treat worldwide. Exceptionally lean, high in iodine and deeply familiar to any dog raised near the coast.',
     benefits:[
       {icon:'🇮🇳',title:'Proudly Indian Superfood',text:'Bombil is found only along the Maharashtra and Gujarat coasts — a native ingredient no international brand can replicate.'},
@@ -5537,7 +5556,7 @@
     feeding:'Can be fed daily due to very low fat. Small dogs: 2–3 pieces. Medium: 4–6 pieces. Large: 6–10 pieces. Excellent as a daily low-calorie training treat.',
     storage:{tiles:[{icon:'🫙',val:'6 Months',label:'Unopened'},{icon:'🌬️',val:'3 Weeks',label:'After Opening'},{icon:'🚫',val:'Away from Heat',label:'Store Away'}],note:'Fish treats are moisture-sensitive. Store in a cool, dry location in the sealed pouch. After opening, press out air, reseal tightly and use within 3 weeks. Keep away from direct sunlight and heat sources. If you notice any off-smell or moisture, discard immediately.'},
   },
-  {img:'https://syuostlqzzinigqwjzap.supabase.co/storage/v1/object/public/product-images/177aaeda-c886-437c-bc6f-aaa5fb27b2c2/image-0-1782712317685.png', name:'Whole Mackerel', cat:'Fish Treats', badge:'Omega Rich', badgeCls:'teal', desc:'Whole dehydrated mackerel — packed with omega-3 fatty acids, B12 and selenium for complete fish nutrition.', tags:['Omega-3','B12','Whole Fish'], sizes:[{label:'Pack of 1',price:500,mrp:500},{label:'Pack of 2',price:1000,mrp:1000},{label:'Pack of 3',price:1500,mrp:1500}], filter:'fish',
+  {img:'https://syuostlqzzinigqwjzap.supabase.co/storage/v1/object/public/product-images/177aaeda-c886-437c-bc6f-aaa5fb27b2c2/image-0-1782712317685.png', name:'Whole Mackerel', cat:'Fish Treats', badge:'Omega Rich', badgeCls:'teal', desc:'Whole dehydrated mackerel — packed with omega-3 fatty acids, B12 and selenium for complete fish nutrition.', tags:['Omega-3','B12','Whole Fish'], sizes:[{label:'Pack of 1',price:500,mrp:500},{label:'Pack of 2',price:1000,mrp:1000},{label:'Pack of 3',price:1500,mrp:1500}], filter:'fish', weight:'100 Grams',
     tagline:'Whole mackerel is a complete fish treat — bones, flesh and all — delivering the full nutritional spectrum of a wild ocean fish in a safe, dehydrated form.',
     benefits:[
       {icon:'🐠',title:'Complete Whole Fish Nutrition',text:'Every part of the mackerel — flesh, bone, organs — contributes different nutrients. You\'re feeding the whole ecosystem.'},
@@ -5549,7 +5568,7 @@
     feeding:'Small dogs: ¼ fish. Medium: ½ fish. Large: 1 whole fish. Feed 2–3 times per week. Break into pieces for smaller dogs.',
     storage:{tiles:[{icon:'🫙',val:'6 Months',label:'Unopened'},{icon:'🌬️',val:'3 Weeks',label:'After Opening'},{icon:'🚫',val:'Away from Heat',label:'Store Away'}],note:'Fish treats are moisture-sensitive. Store in a cool, dry location in the sealed pouch. After opening, press out air, reseal tightly and use within 3 weeks. Keep away from direct sunlight and heat sources. If you notice any off-smell or moisture, discard immediately.'},
   },
-  {img:'https://syuostlqzzinigqwjzap.supabase.co/storage/v1/object/public/product-images/771b372e-a767-4056-ae85-c6ad1251e84a/image-0-1782712307911.png', name:'Mackerel Fillet', cat:'Fish Treats', badge:'Boneless', badgeCls:'', desc:'Dehydrated boneless mackerel fillet — all the omega-3 nutrition with no bones. Great for small breeds.', tags:['Boneless','Omega-3','Small Breeds'], sizes:[{label:'Pack of 1',price:550,mrp:550},{label:'Pack of 2',price:1100,mrp:1100},{label:'Pack of 3',price:1650,mrp:1650},{label:'Pack of 4',price:2200,mrp:2200}], filter:'fish',
+  {img:'https://syuostlqzzinigqwjzap.supabase.co/storage/v1/object/public/product-images/771b372e-a767-4056-ae85-c6ad1251e84a/image-0-1782712307911.png', name:'Mackerel Fillet', cat:'Fish Treats', badge:'Boneless', badgeCls:'', desc:'Dehydrated boneless mackerel fillet — all the omega-3 nutrition with no bones. Great for small breeds.', tags:['Boneless','Omega-3','Small Breeds'], sizes:[{label:'Pack of 1',price:550,mrp:550},{label:'Pack of 2',price:1100,mrp:1100},{label:'Pack of 3',price:1650,mrp:1650},{label:'Pack of 4',price:2200,mrp:2200}], filter:'fish', weight:'60 Grams',
     tagline:'All the rich omega-3 goodness of mackerel, but boneless — making it completely safe and appropriate for small dogs, puppies and senior dogs who need a gentler fish treat.',
     benefits:[
       {icon:'✅',title:'Completely Bone-Free',text:'Ideal for dogs where whole fish bones may be a concern — same omega-3 nutrition, zero risk.'},
@@ -5561,7 +5580,7 @@
     feeding:'Small dogs: 1–2 strips daily. Medium: 2–3 strips. Large: 3–5 strips. Can be fed daily as an omega-3 supplement. Crumble over food for picky eaters.',
     storage:{tiles:[{icon:'🫙',val:'6 Months',label:'Unopened'},{icon:'🌬️',val:'3 Weeks',label:'After Opening'},{icon:'🚫',val:'Away from Heat',label:'Store Away'}],note:'Fish treats are moisture-sensitive. Store in a cool, dry location in the sealed pouch. After opening, press out air, reseal tightly and use within 3 weeks. Keep away from direct sunlight and heat sources. If you notice any off-smell or moisture, discard immediately.'},
   },
-  {img:'https://syuostlqzzinigqwjzap.supabase.co/storage/v1/object/public/product-images/f2462343-c4b8-4992-8fc9-d38db31e2e7c/image-0-1782712340470.png', name:'Sardines', cat:'Fish Treats', badge:'Brain Boost', badgeCls:'teal', desc:'Whole dehydrated sardines — exceptional omega-3 content for brain health, coat shine and joint support.', tags:['Omega-3','Brain Health','Whole Fish'], sizes:[{label:'Pack of 1',price:349,mrp:349},{label:'Pack of 2',price:698,mrp:698},{label:'Pack of 3',price:1047,mrp:1047},{label:'Pack of 4',price:1396,mrp:1396}], filter:'fish',
+  {img:'https://syuostlqzzinigqwjzap.supabase.co/storage/v1/object/public/product-images/f2462343-c4b8-4992-8fc9-d38db31e2e7c/image-0-1782712340470.png', name:'Sardines', cat:'Fish Treats', badge:'Brain Boost', badgeCls:'teal', desc:'Whole dehydrated sardines — exceptional omega-3 content for brain health, coat shine and joint support.', tags:['Omega-3','Brain Health','Whole Fish'], sizes:[{label:'Pack of 1',price:349,mrp:349},{label:'Pack of 2',price:698,mrp:698},{label:'Pack of 3',price:1047,mrp:1047},{label:'Pack of 4',price:1396,mrp:1396}], filter:'fish', weight:'60 Grams',
     tagline:'Sardines are one of the most omega-3 dense fish in the ocean — and they are small enough to be free from heavy metal contamination, making them a safe, daily supplement.',
     benefits:[
       {icon:'🧠',title:'Brain Health & Cognition',text:'DHA from sardines is the primary structural fat of brain tissue — essential for puppies and aging dogs alike.'},
@@ -5573,7 +5592,7 @@
     feeding:'Small dogs: 1–2 sardines daily. Medium: 2–3. Large: 3–5. Feed daily for maximum omega-3 benefit. An excellent fish oil supplement replacement.',
     storage:{tiles:[{icon:'🫙',val:'6 Months',label:'Unopened'},{icon:'🌬️',val:'3 Weeks',label:'After Opening'},{icon:'🚫',val:'Away from Heat',label:'Store Away'}],note:'Fish treats are moisture-sensitive. Store in a cool, dry location in the sealed pouch. After opening, press out air, reseal tightly and use within 3 weeks. Keep away from direct sunlight and heat sources. If you notice any off-smell or moisture, discard immediately.'},
   },
-  {img:'https://syuostlqzzinigqwjzap.supabase.co/storage/v1/object/public/product-images/da659861-df5e-4c9e-991c-811c56f50c7f/image-0-1782795710302.png', name:'Tuna', cat:'Fish Treats', badge:'High Protein', badgeCls:'', desc:'Dehydrated tuna — lean, high-protein ocean fish. Rich in selenium and B12. Dogs love the intense flavour.', tags:['High Protein','Selenium','Ocean Fish'], sizes:[{label:'Pack of 1',price:500,mrp:500},{label:'Pack of 2',price:1000,mrp:1000},{label:'Pack of 3',price:1500,mrp:1500},{label:'Pack of 4',price:2000,mrp:2000}], filter:'fish',
+  {img:'https://syuostlqzzinigqwjzap.supabase.co/storage/v1/object/public/product-images/da659861-df5e-4c9e-991c-811c56f50c7f/image-0-1782795710302.png', name:'Tuna', cat:'Fish Treats', badge:'High Protein', badgeCls:'', desc:'Dehydrated tuna — lean, high-protein ocean fish. Rich in selenium and B12. Dogs love the intense flavour.', tags:['High Protein','Selenium','Ocean Fish'], sizes:[{label:'Pack of 1',price:500,mrp:500},{label:'Pack of 2',price:1000,mrp:1000},{label:'Pack of 3',price:1500,mrp:1500},{label:'Pack of 4',price:2000,mrp:2000}], filter:'fish', weight:'60 Grams',
     tagline:'Tuna is an ocean powerhouse — lean, protein-dense, and rich in selenium and B vitamins. Its intense flavour makes it one of the most motivating treats available.',
     benefits:[
       {icon:'💪',title:'Exceptionally High Protein',text:'Tuna has one of the highest protein densities of any fish — great for muscle maintenance and repair.'},
@@ -5585,7 +5604,7 @@
     feeding:'Feed 2–3 times per week rather than daily due to higher mercury content in tuna vs small fish. Small dogs: 1–2 pieces. Medium: 2–3. Large: 3–5 pieces.',
     storage:{tiles:[{icon:'🫙',val:'6 Months',label:'Unopened'},{icon:'🌬️',val:'3 Weeks',label:'After Opening'},{icon:'🚫',val:'Away from Heat',label:'Store Away'}],note:'Fish treats are moisture-sensitive. Store in a cool, dry location in the sealed pouch. After opening, press out air, reseal tightly and use within 3 weeks. Keep away from direct sunlight and heat sources. If you notice any off-smell or moisture, discard immediately.'},
   },
-  {img:'https://syuostlqzzinigqwjzap.supabase.co/storage/v1/object/public/product-images/a76ab961-d32e-4720-8e2e-e4f989da8ee0/image-0-1782712329883.png', name:'Prawns', cat:'Fish Treats', badge:'Antioxidant', badgeCls:'', desc:'Dehydrated prawns — rich in antioxidants, iodine and astaxanthin. A premium coastal treat dogs adore.', tags:['Antioxidant','Iodine','Coastal'], sizes:[{label:'Pack of 1',price:599,mrp:599},{label:'Pack of 2',price:1198,mrp:1198},{label:'Pack of 3',price:1797,mrp:1797},{label:'Pack of 4',price:2396,mrp:2396}], filter:'fish',
+  {img:'https://syuostlqzzinigqwjzap.supabase.co/storage/v1/object/public/product-images/a76ab961-d32e-4720-8e2e-e4f989da8ee0/image-0-1782712329883.png', name:'Prawns', cat:'Fish Treats', badge:'Antioxidant', badgeCls:'', desc:'Dehydrated prawns — rich in antioxidants, iodine and astaxanthin. A premium coastal treat dogs adore.', tags:['Antioxidant','Iodine','Coastal'], sizes:[{label:'Pack of 1',price:599,mrp:599},{label:'Pack of 2',price:1198,mrp:1198},{label:'Pack of 3',price:1797,mrp:1797},{label:'Pack of 4',price:2396,mrp:2396}], filter:'fish', weight:'60 Grams',
     tagline:'Prawns are a luxury treat packed with astaxanthin — a powerful antioxidant that gives them their pink colour and provides exceptional anti-inflammatory and immune benefits.',
     benefits:[
       {icon:'🦐',title:'Astaxanthin Antioxidant',text:'Astaxanthin is 6,000x more powerful than Vitamin C as an antioxidant — it gives prawns their pink colour and dogs a huge health boost.'},
@@ -5599,7 +5618,7 @@
   },
 
 // ── WHOLE PREY ─────────────────────────────────────────
-  {img:'https://syuostlqzzinigqwjzap.supabase.co/storage/v1/object/public/product-images/edb3cdd6-b31f-4e5b-ba18-bf4a300d8090/image-0-1782712359525.png', name:'Whole Quail', cat:'Whole Prey', badge:'Complete Nutrition', badgeCls:'brown', desc:'Whole dehydrated quail — the ultimate whole prey treat. Complete bone, meat and organ in a single piece.', tags:['Whole Prey','Complete Nutrition','Novel Protein'], sizes:[{label:'Pack of 1',price:275,mrp:275},{label:'Pack of 2',price:550,mrp:550},{label:'Pack of 3',price:825,mrp:825},{label:'Pack of 4',price:1100,mrp:1100}], filter:'wholeprey',
+  {img:'https://syuostlqzzinigqwjzap.supabase.co/storage/v1/object/public/product-images/edb3cdd6-b31f-4e5b-ba18-bf4a300d8090/image-0-1782712359525.png', name:'Whole Quail', cat:'Whole Prey', badge:'Complete Nutrition', badgeCls:'brown', desc:'Whole dehydrated quail — the ultimate whole prey treat. Complete bone, meat and organ in a single piece.', tags:['Whole Prey','Complete Nutrition','Novel Protein'], sizes:[{label:'Pack of 1',price:275,mrp:275},{label:'Pack of 2',price:550,mrp:550},{label:'Pack of 3',price:825,mrp:825},{label:'Pack of 4',price:1100,mrp:1100}], filter:'wholeprey', weight:'1 Piece',
     tagline:'A whole quail is nature\'s most complete single-ingredient treat — bone, muscle meat, skin and organs all in one, replicating what dogs evolved to eat in the wild.',
     benefits:[
       {icon:'🌿',title:'Biologically Complete Meal',text:'Whole prey contains the exact ratio of bone, meat and organ that carnivores evolved to consume. Nothing is missing.'},
@@ -8468,7 +8487,7 @@
     if (bundleImgSection) bundleImgSection.style.display = 'none';
     if (pmodPlaceholder) pmodPlaceholder.style.display = 'none';
   }
-  var pcatEl = document.getElementById('pmodal-cat'); if (pcatEl) pcatEl.textContent = p.cat;
+  var pcatEl = document.getElementById('pmodal-cat'); if (pcatEl) pcatEl.textContent = p.cat + (p.weight ? '  •  ' + p.weight + ' per pack' : '');
   var pnameEl = document.getElementById('pmodal-name'); if (pnameEl) pnameEl.textContent = p.name;
   const badgeEl = document.getElementById('pmodal-badge');
   if (badgeEl) badgeEl.textContent = p.badge;
@@ -8493,8 +8512,11 @@
   ).join('');
   if (storageNote) storageNote.textContent = p.storage.note;
   document.getElementById('pmodal-sizes').innerHTML = p.sizes.map((s,i) => {
-    var qtyMatch = s.label.match(/(\d+\s*g\b|\d+\s*kg\b|\d+\s*pcs?\b|\d+\s*pc\b)/i);
-    var qty = qtyMatch ? qtyMatch[0] : '';
+    var qty = getPackWeightLabel(p, s.label);
+    if (!qty) {
+      var qtyMatch = s.label.match(/(\d+\s*g\b|\d+\s*kg\b|\d+\s*pcs?\b|\d+\s*pc\b)/i);
+      qty = qtyMatch ? qtyMatch[0] : '';
+    }
     var labelClean = s.label.replace(/\s*\([^)]*\)\s*$/, '').trim();
     return `<div class="pmodal-size-opt ${i===0?'selected':''}" onclick="selectModalSize(this, ${s.price}, ${s.mrp||0})">
       <span class="size-label">${labelClean}</span>
@@ -8912,7 +8934,7 @@
 
 function renderBundleCard(p, globalIdx) {
   const firstSize = p.sizes[0];
-  const sizeOpts = p.sizes.map((s,i) => { const shortLabel = s.label.replace(/^Pack of\s*/i, '') + 'x'; return `<option value="${i}" ${i===0?'selected':''}>${shortLabel} — ₹${s.price}</option>`; }).join('');
+  const sizeOpts = p.sizes.map((s,i) => { const shortLabel = s.label.replace(/^Pack of\s*/i, '') + 'x'; const wLabel = getPackWeightLabel(p, s.label); return `<option value="${i}" ${i===0?'selected':''}>${shortLabel}${wLabel ? ' ('+wLabel+')' : ''} — ₹${s.price}</option>`; }).join('');
   const isCat = p.name === 'Cat Trial Box';
   const isSurprise = p.isSurpriseBox;
   const isTrialBox = p.isTrialBox;
@@ -9114,7 +9136,7 @@
     // Special rendering for bundle cards
     if (p.isBundle) return renderBundleCard(p, globalIdx);
     const firstSize = p.sizes[0];
-    const sizeOpts = p.sizes.map((s,i) => { const shortLabel = s.label.replace(/^Pack of\s*/i, '') + 'x'; return `<option value="${i}" ${i===0?'selected':''}>${shortLabel} — ₹${s.price}</option>`; }).join('');
+    const sizeOpts = p.sizes.map((s,i) => { const shortLabel = s.label.replace(/^Pack of\s*/i, '') + 'x'; const wLabel = getPackWeightLabel(p, s.label); return `<option value="${i}" ${i===0?'selected':''}>${shortLabel}${wLabel ? ' ('+wLabel+')' : ''} — ₹${s.price}</option>`; }).join('');
     
     // Handle both full URLs (from database) and partial URLs (from storage)
     let imgUrl = p.img;
@@ -9132,6 +9154,7 @@
       <div class="prod-body">
         <div class="prod-cat">${p.cat}</div>
         <h3 class="prod-name">${p.name}</h3>
+        ${p.weight ? `<div class="prod-weight">⚖️ ${p.weight} per pack</div>` : ''}
         <p class="prod-desc">${p.desc}</p>
         <div class="prod-tags">${p.tags.map(t=>`<span class="p-tag">${t}</span>`).join('')}</div>
         ${(function(){ var d = getDehydrationInfo(p.name); return d ? `<div style="font-size:10px;color:var(--muted);margin:2px 0 6px;display:flex;align-items:center;gap:10px;flex-wrap:wrap"><span>🌡️ Dehydrated at ${d.tempC}°C</span><span>⏱️ ${d.hours}</span></div>` : ''; })()}
@@ -9299,9 +9322,11 @@
   const sizeOpts = p.sizes.map((s,i) => {
     var discPct = (s.mrp && s.mrp > s.price) ? Math.round((1 - s.price / s.mrp) * 100) : 0;
     const isActive = i === 0;
+    const packWeight = getPackWeightLabel(p, s.label);
     return `<div style="padding:10px 16px;border:2px solid ${isActive ? 'var(--gold)' : 'var(--cream-mid)'};background:${isActive ? 'var(--cream)' : 'var(--white)'};cursor:pointer;border-radius:2px;transition:all .2s;text-align:center;position:relative;min-width:78px" onclick="selectDetailSize(${i}, this)" class="${isActive ? 'active' : ''}" data-size="${i}">
       ${discPct > 0 ? `<div style="position:absolute;top:-8px;right:-6px;background:var(--teal);color:#fff;font-size:8px;font-weight:700;padding:2px 5px;border-radius:8px">${discPct}% OFF</div>` : ''}
       <div style="font-size:13px;font-weight:600;color:var(--dark)">${s.label}</div>
+      ${packWeight ? `<div style="font-size:10px;color:var(--muted);margin-top:2px">${packWeight}</div>` : ''}
       ${s.mrp && s.mrp > s.price ? `<div style="font-size:11px;color:var(--muted);text-decoration:line-through;margin-top:4px">₹${s.mrp}</div>` : ''}
       <div style="font-size:15px;font-weight:700;color:var(--gold);margin-top:${s.mrp && s.mrp > s.price ? '0' : '4px'}">₹${s.price}</div>
     </div>`;
@@ -9342,7 +9367,7 @@
   
   const buyboxHtml = `
     <div>
-      <div style="font-size:11px;font-weight:700;letter-spacing:.15em;text-transform:uppercase;color:var(--muted);margin-bottom:8px">${p.cat}</div>
+      <div style="font-size:11px;font-weight:700;letter-spacing:.15em;text-transform:uppercase;color:var(--muted);margin-bottom:8px">${p.cat}${p.weight ? ' &nbsp;•&nbsp; ' + p.weight + ' per pack' : ''}</div>
       <h1 style="font-family:'Cormorant Garamond',serif;font-size:42px;font-weight:700;color:var(--dark);margin-bottom:12px;line-height:1.1">${p.name}</h1>
       ${(p.badge && p.badge !== "Bestseller") ? `<div style="display:inline-block;background:var(--gold);color:var(--dark);font-size:9px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;padding:4px 10px;margin-bottom:16px;border-radius:2px">${p.badge}</div>` : ""}
