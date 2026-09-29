-- Avisos de carrinho abandonado ja enviados ganham origem propria.
UPDATE "notifications" SET "source" = 'CART' WHERE "title" = 'Esqueceu algo no carrinho?';
