-- Tabela de frete por localidade (30/09/2026). Ate aqui o frete de quem
-- digita o CEP vinha de um JSON fixo no codigo (planilha de balcao, 52
-- pontos), e a tela "Taxas de Entrega" editava zonas que nunca valiam: todo
-- CEP delas tambem estava na planilha, que tinha prioridade. Em 24/09 foram
-- digitadas 31 taxas novas na tela e nenhuma chegou ao cliente.
--
-- Aqui: a planilha vira tabela editavel (uma linha por localidade e CEP, com
-- a taxa que o site cobra hoje), o valor digitado em 24/09 fica guardado em
-- "suggestedFee" pro lojista aplicar ou descartar, e as zonas de CEP unico
-- que so duplicavam a planilha saem (o valor delas fica na sugestao).

CREATE TABLE "delivery_points" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL DEFAULT 'tenant_default',
  "storeId" TEXT NOT NULL DEFAULT 'store_default',
  "code" TEXT NOT NULL,
  "locality" TEXT NOT NULL,
  "cep" TEXT,
  "fee" DECIMAL(10,2) NOT NULL,
  "freeAbove" DECIMAL(10,2),
  "suggestedFee" DECIMAL(10,2),
  "direction" TEXT,
  "minutes" INTEGER,
  "km" DECIMAL(6,2),
  "reference" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "delivery_points_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "delivery_points_tenantId_code_key" ON "delivery_points"("tenantId", "code");
CREATE INDEX "delivery_points_tenantId_storeId_cep_active_idx" ON "delivery_points"("tenantId", "storeId", "cep", "active");

INSERT INTO "delivery_points" ("id", "code", "locality", "cep", "fee", "direction", "minutes", "km", "reference") VALUES
('dp_4205-3', '4205-3', 'Ribeirão', '25720170', 36.0, 'Itaipava', 11, 9, 'Estr. do Ribeirão Grande, 1100 - Itaipava'),
('dp_1305', '1305', 'Condomínio Quinta do Lago', '25725905', 48.0, 'Itaipava', 21, 19.8, 'Rodovia BR-040, s/n Quilômetro 66 BR 040 (sent. Brazão)'),
('dp_4207-3', '4207-3', '3 Pinheiros / Macco', '25730740', 6.0, 'Posse', 2, 6, 'R. Teófilo José de Almeida'),
('dp_4205-2', '4205-2', 'Itaipava (Centro)', '25730770', 36.0, 'Itaipava', 30, 10, 'Estr. União e Indústria, 11881 (Bramil)'),
('dp_4209-3', '4209-3', 'Sumidouro', '25745020', 18.0, 'Itaipava', 11, 6, NULL),
('dp_4205', '4205', 'Condomínio Santa Júlia', '25750020', 36.0, 'Itaipava', 15, 9, 'R. Jenny Gomes, 2000 (Entrada: Est. União e Industria, 15162)'),
('dp_1305-2', '1305-2', 'Quinta do Jade', '25750050', 45.0, 'Itaipava', 21, 8, 'Estr. dos Tabões, 3005 - Pedro do Rio'),
('dp_4200-2', '4200-2', 'Rua Manoel Pereira Barbosa', '25750173', 16.0, 'Posse', 3, 1.7, 'Rua Manoel Pereira Barbosa (Ponte de Barra Mansa)'),
('dp_4200', '4200', 'Loteamento Serra Morena', '25750175', 16.0, 'Posse', 3, 1.7, 'Rua A - Barra Mansa (Depois da Ponte de Barra Mansa)'),
('dp_4200-7', '4200-7', 'Rua Arcelino Corrêa Machado', '25750180', 16.0, 'Posse', 7, 3.9, 'Rua Arcelino Correa Machado'),
('dp_4200-3', '4200-3', 'Barra Mansa', '25750183', 16.0, 'Posse', 3, 2, 'Rua Isaura Correas Machado'),
('dp_4201-3', '4201-3', 'Rua Oswaldo Guimarães', '25750200', 15.0, 'Itaipava', 7, 4, 'R. Oswaldo Guimarães, 266-111'),
('dp_4208', '4208', '7 Casas', '25750222', 10.0, 'Itaipava', 2, 1.2, 'Estr. União e Indústria, 20870'),
('dp_4200-4', '4200-4', 'Bomba de Areia', '25750222', 16.0, 'Posse', 3, 2, 'Estr. União e Indústria, 24335'),
('dp_4207', '4207', 'Chafariz', '25750222', 6.0, 'Itaipava', 1, 0.5, 'Estr. União e Indústria, 22585'),
('dp_4202-2', '4202-2', 'Condomínio Bosque das Mangueiras', '25750222', 22.0, 'Posse', 10, 6, 'Estr. União e Indústria, 21900'),
('dp_4200-6', '4200-6', 'Condomínio Campos do Conde', '25750222', 16.0, 'Posse', 5, 3.5, 'Estr. União e Indústria, 25236'),
('dp_4200-5', '4200-5', 'Pousada Borgo San Felice', '25750222', 16.0, 'Posse', 3, 2, 'Estr. União e Indústria, 24360'),
('dp_4201-5', '4201-5', 'Rei do Feno', '25750222', 15.0, 'Posse', 2, 1.5, 'Estr. União e Indústria, 23689'),
('dp_4201-4', '4201-4', 'Pedro do Rio (Centro)', '25750225', 15.0, 'Itaipava', 5, 2.5, 'Estr. União e Indústria, 19300'),
('dp_4207-2', '4207-2', 'Sítio do Leo', '25750225', 6.0, 'Posse', 2, 0.2, 'Estr. União e Indústria, 21900'),
('dp_4201', '4201', 'Cova da Onça', '25750230', 15.0, 'Itaipava', 4, 2.2, 'R. Antonio Muniz Constancio'),
('dp_4202-4', '4202-4', 'Rua Barbosa Lima Sobrinho', '25750232', 22.0, 'Posse', 8, 5, 'R. Barbosa Lima Sobrinho'),
('dp_4202-6', '4202-6', 'Sítio Asa Branca', '25750232', 22.0, 'Posse', 8, 5, 'R. Barbosa Lima Sobrinho'),
('dp_4202-5', '4202-5', 'Sítio Caldas', '25750232', 22.0, 'Posse', 8, 5, 'R. Barbosa Lima Sobrinho'),
('dp_4202-9', '4202-9', 'Condomínio Highland Places', '25750233', 22.0, 'Posse', 10, 6, 'R. Alfredo Vargas Rosa'),
('dp_4203-2', '4203-2', 'Condomínio Terras Altas', '25750233', 25.0, 'Posse', 12, 7.5, 'R. Alfredo Vargas Rosa'),
('dp_147', '147', 'Condomínio Montes Alpha', '25750240', 40.0, 'Itaipava', 17, 6.6, 'R. José de Mello Ferreira'),
('dp_4202', '4202', 'Paiolinho', '25750240', 22.0, 'Itaipava', 12, 6, 'R. José Joaquim Rodrigues'),
('dp_4201-2', '4201-2', 'Caminho do Centro', '25750256', 15.0, 'Itaipava', 8, 3, 'Rua Laurinda Lopes de Medeiros, 217'),
('dp_4203-4', '4203-4', 'Fazenda da Matta', '25750270', 25.0, 'Posse', NULL, 15, 'R. Teófilo José de Almeida, 23990'),
('dp_4206-2', '4206-2', 'Loteamento Santa Rita', '25750460', 12.0, 'Posse', 3, 1.6, 'R. Manoel Canedo'),
('dp_4202-8', '4202-8', 'Condomínio Paddock', '25750601', 22.0, 'Posse', 10, 5, '(BR-040) R. Um, 14-1142 - Pedro do Rio'),
('dp_4205-5', '4205-5', 'Condomínio Fazenda das Roseiras', '25755250', 36.0, 'Posse', 25, 13.5, 'BR-040, no Km 47,5 sentido Rio (Estr. José Xavier, 2500)'),
('dp_4209', '4209', 'Retiro das Pedras', '25755320', 18.0, 'Itaipava', 14, 7, 'Estr. Retiro das Pedras'),
('dp_4209-2', '4209-2', 'Alto Pegado', '25755352', 18.0, 'Itaipava', 15, 9, 'Estr. do Secretário'),
('dp_4204', '4204', 'Secretário (Centro)', '25755352', 30.0, 'Itaipava', 20, 10, 'Estr. do Secretário, 112 - Praça Principal'),
('dp_4202-3', '4202-3', 'Villa Bambuzal (BR-040)', '25755435', 22.0, 'Posse', 3, 2, 'Rodovia BR-040 - do km 46,501 ao km 51,499 - lado ímpar'),
('dp_4202-7', '4202-7', 'Cantinho do Galvão', '25755437', 22.0, 'Posse', 10, 8, 'Servidão Antônio Galvão Novo'),
('dp_4204-2', '4204-2', 'Condomínio Vale do Barão', '25755900', 30.0, 'Posse', 15, 15, 'Rodovia BR-040, s/n Quilômetro 49 , Pedro do Rio - Petrópolis/RJ'),
('dp_1447', '1447', 'Quintas do Barão', '25755900', 50.0, 'Posse', 20, 18, 'Rodovia BR-040, s/n Quilômetro 49 , Pedro do Rio - Petrópolis/RJ'),
('dp_4202-10', '4202-10', 'Condado da Serra', '25770000', 22.0, 'Posse', 6, 4.5, 'Estr. União e Indústria, 26260'),
('dp_4203-3', '4203-3', 'Jacuba', '25770000', 25.0, 'Posse', 10, 7, 'Estrada união e industria, 28705'),
('dp_147-3', '147-3', 'Posse', '25770056', 40.0, 'Posse', 18, 12, 'Praça 29 de Junho - Posse'),
('dp_4202-11', '4202-11', 'Maanaim', '25770470', 22.0, 'Posse', 12, 5.7, 'Estr. União e Indústria, 26223'),
('dp_147-2', '147-2', 'Fazenda do Cedro', '25845000', 42.0, 'Posse', 25, 18.5, 'Depois do Pedágio, BR-040, km 45 - Pedro do Rio'),
('dp_4205-4', '4205-4', 'Mondesir Golf Club', '25845000', 36.0, 'Posse', 25, 12.5, 'Rua Mazzine Bueno, 3000 - Areal'),
('dp_4202-12', '4202-12', 'Bar do Múcio', NULL, 22.0, 'Posse', 8, 5.5, 'Rua Professor Mazini Bueno'),
('dp_4206', '4206', 'Condomínio Bosque das Mangueiras (até a Igreja)', NULL, 12.0, 'Posse', NULL, NULL, NULL),
('dp_4203', '4203', 'Vila Rica', NULL, 25.0, 'Itaipava', 15, 6, 'BR-040');

-- Valor digitado na tela antiga (zona de CEP unico com o mesmo nome) vira sugestao.
UPDATE "delivery_points" p
SET "suggestedFee" = z."fee"
FROM "delivery_zones" z
WHERE z."type" = 'CEP_RANGE'
  AND z."cepStart" IS NOT NULL AND regexp_replace(z."cepStart", '\D', '', 'g') = regexp_replace(z."cepEnd", '\D', '', 'g')
  AND regexp_replace(z."cepStart", '\D', '', 'g') = p."cep"
  AND lower(trim(z."name")) = lower(trim(p."locality"))
  AND z."fee" <> p."fee";

-- Zonas de CEP unico cobertas pela tabela: nunca valeram, saem.
DELETE FROM "delivery_zones" z
WHERE z."type" = 'CEP_RANGE'
  AND z."cepStart" IS NOT NULL AND regexp_replace(z."cepStart", '\D', '', 'g') = regexp_replace(z."cepEnd", '\D', '', 'g')
  AND EXISTS (SELECT 1 FROM "delivery_points" p WHERE p."cep" = regexp_replace(z."cepStart", '\D', '', 'g'));
