-- Remove o model DeliveryArea (tabela `delivery_areas`).
--
-- Era um segundo sistema de zona de entrega, mais generico (regra em JSON,
-- prioridade), projetado pra substituir `delivery_zones`. Ganhou CRUD completo
-- no backend e nunca ganhou tela no admin: ficou com ZERO linhas em producao
-- desde sempre, enquanto `delivery_zones` carrega as 34 zonas reais.
--
-- A checagem morta na frente do calculo de frete ja tinha custado um bug
-- (18-19/08/2026): uma correcao de antifraude consultou `deliveryArea` em vez
-- de `deliveryZone` -- sintaxe valida, compila, roda, e a query nunca acha
-- nada porque a tabela esta vazia. Nenhum erro, nenhum teste vermelho.
--
-- A coluna `orders."deliveryAreaId"` NAO e removida: apesar do nome, ela
-- guarda o id de uma DeliveryZone (o checkout grava `quote.delivery.zoneId`
-- ali) e pedidos historicos dependem dela. Nunca houve FK entre as duas.

DROP TABLE IF EXISTS "delivery_areas";
