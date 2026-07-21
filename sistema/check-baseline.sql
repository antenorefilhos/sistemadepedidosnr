-- Baseline de categorias e mapeamentos
SELECT COUNT(*) as n1_cats FROM categories_cms WHERE "parentId" IS NULL;
SELECT COUNT(*) as n2_cats FROM categories_cms WHERE "parentId" IS NOT NULL;
SELECT COUNT(*) as mapped_total FROM product_category_mappings;
SELECT status, COUNT(*) as cnt FROM category_mapping_pending GROUP BY status ORDER BY status;
