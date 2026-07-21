-- Criar pendências para os 23 produtos sem mapeamento no original
INSERT INTO category_mapping_pending (
  ean, 
  "productName", 
  "suggestedCategoryId", 
  "suggestedCategoryN1", 
  "suggestedCategoryN2",
  reason, 
  status, 
  notes
)
SELECT 
  p.ean,
  p.name,
  (SELECT id FROM categories_cms WHERE "parentId" IS NULL LIMIT 1),
  (SELECT name FROM categories_cms WHERE "parentId" IS NULL LIMIT 1),
  NULL,
  'auto_classify',
  'PENDING',
  'Gap técnico: produto sem mapeamento inicial'
FROM products p
WHERE p.active = true 
  AND NOT EXISTS (SELECT 1 FROM product_category_mappings m WHERE m.ean = p.ean)
  AND NOT EXISTS (SELECT 1 FROM category_mapping_pending cmp WHERE cmp.ean = p.ean)
ON CONFLICT (ean) DO NOTHING;

SELECT 'Pendências criadas:' as status, COUNT(*) as total FROM category_mapping_pending WHERE status = 'PENDING';
