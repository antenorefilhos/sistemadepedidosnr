# REQUISITOS.md - Requisitos Atuais do Projeto

Data: 23 de abril de 2026
Versao de referencia: 1.6.0-alpha

## Requisitos tecnicos

- Node.js 20+
- npm 10+
- Docker 24+
- Docker Compose v2
- PostgreSQL 15
- Redis 7

## Requisitos de arquitetura

- backend principal em NestJS + Prisma + PostgreSQL
- storefront e admin em React 18 + Vite 4
- stack local recomendada via Docker Compose com 6 servicos (api, storefront, admin, db, redis, meili)
- contratos internos devem pertencer ao dominio Antenor & Filhos

## Requisitos de UX

- acessibilidade WCAG 2.1 AA no admin e no storefront
- touch targets adequados e navegacao teclado consistente
- identidade visual centrada em burgundy e gold
- consistencia de modais, sidebar e superficies administrativas
- rotas de autenticacao devem oferecer retorno explicito para a loja
- checkout deve deixar claro que o cliente apenas informa como quer pagar; o pagamento e fechado pela equipe apos a separacao
- checkout deve deixar claro que o valor final do pedido pode mudar por peso real, corte ou substituicao de item

## Requisitos estrategicos novos

- desenvolver uma API propria da Antenor & Filhos em primeiro plano
- usar a API da Solidcom em segundo plano, apenas como integracao ERP
- fazer a API propria tratar validacao, transformacao, regras de negocio e payloads de entrada/saida
- enviar ao ERP somente o necessario para registrar o pedido corretamente no sistema da Solidcom

## Requisitos de catalogo e exibicao

- busca voltada ao cliente deve privilegiar filtros visuais no storefront com pagina dedicada
- filtros minimos ativos: categoria, minPrice, maxPrice
- sugestoes devem usar texto legivel e amigavel
- admin deve suportar filtros mercadologicos em cascata (classificacao01..04)
- Home deve permitir estrategia comercial por secao via CMS de categorias:
	- ativacao da secao (`active`)
	- ordem de exibicao (`priority`)
	- quantidade de produtos por secao (`limit`)
- Home e Carrinho devem permanecer acessiveis sem login obrigatorio para reduzir friccao de entrada
- Checkout convidado deve ser suportado por feature flags em frontend e backend
- pagamento no produto deve permanecer **por fora**, sem cobranca automatica no app
- o metodo de pagamento coletado no checkout deve ser tratado como intencao de pagamento, nao liquidacao financeira

## Requisitos de integracao ERP (Solidcom)

### Regra ESTOQUE/SEMPRE/NUNCA

- `NUNCA`: produto nao pode aparecer no storefront
- `SEMPRE`: produto deve aparecer mesmo com estoque zerado
- `ESTOQUE`: produto so aparece com estoque maior que zero

### Requisito de consistencia

- a regra acima deve valer tanto para leitura via Prisma quanto para leitura via MeiliSearch
- sincronizacao de produtos deve persistir o modo de integracao para consultas futuras

## Requisitos de imagens

- imagens de produto servidas em `/uploads/products/{ean}.webp` no mesmo dominio do storefront
- processo de cobertura em lote permitido por script `sistema/backend/scripts/import-images.js`
- item sem foto deve manter fallback visual sem quebrar a navegacao