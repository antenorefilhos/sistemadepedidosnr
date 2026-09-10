-- JON-31 (auditoria admin, 10/09/2026): os rotulos de permissao granular
-- (tela Equipe) foram semeados sem acento na migration de RBAC de 26/05,
-- enquanto os headers de secao da mesma tela estao acentuados -- fica
-- inconsistente e parece enum cru vazando. Corrige o texto no banco.
UPDATE "permissions" SET "description" = 'Ler catálogo' WHERE "key" = 'catalog.read';
UPDATE "permissions" SET "description" = 'Editar catálogo' WHERE "key" = 'catalog.write';
UPDATE "permissions" SET "description" = 'Ler separação' WHERE "key" = 'picking.read';
UPDATE "permissions" SET "description" = 'Executar separação' WHERE "key" = 'picking.write';
UPDATE "permissions" SET "description" = 'Ler preços' WHERE "key" = 'pricing.read';
UPDATE "permissions" SET "description" = 'Editar preços' WHERE "key" = 'pricing.write';
UPDATE "permissions" SET "description" = 'Ler promoções' WHERE "key" = 'promotions.read';
UPDATE "permissions" SET "description" = 'Editar promoções' WHERE "key" = 'promotions.write';
UPDATE "permissions" SET "description" = 'Ler integrações' WHERE "key" = 'integrations.read';
UPDATE "permissions" SET "description" = 'Editar integrações' WHERE "key" = 'integrations.write';
UPDATE "permissions" SET "description" = 'Editar configurações' WHERE "key" = 'settings.write';
UPDATE "permissions" SET "description" = 'Ler relatórios' WHERE "key" = 'reports.read';
UPDATE "permissions" SET "description" = 'Gerenciar usuários' WHERE "key" = 'users.manage';
UPDATE "permissions" SET "description" = 'Ler auditoria' WHERE "key" = 'audit.read';
