# API - Snapshot 1.4.7-alpha

Data: 19 de abril de 2026
Base local: http://localhost:3001
Swagger: http://localhost:3001/api

## Autenticacao

```text
POST /auth/login
POST /auth/customer/login
POST /auth/customer/register
POST /auth/register
```

## Produtos

```text
GET    /products
GET    /products/admin
GET    /products/suggest
GET    /products/analytics/top
GET    /products/:id
GET    /products/:id/recommendations
POST   /products/admin
POST   /products
POST   /products/sync
PUT    /products/:id
DELETE /products/:id
```

Filtros suportados em `GET /products`:

- search
- category
- minPrice
- maxPrice

## Clientes

```text
GET    /customers
GET    /customers/:id
GET    /customers/analytics/origin
POST   /customers
PUT    /customers/:id
DELETE /customers/:id
```

## Pedidos

```text
GET    /orders
GET    /orders/:id
GET    /orders/analytics/sales
GET    /orders/analytics/status
GET    /orders/analytics/revenue
POST   /orders
PUT    /orders/:id
PUT    /orders/:id/status
DELETE /orders/:id
```

## Enderecos

```text
GET    /addresses/search/:cep
POST   /addresses/:customerId
```

## Integracoes

```text
GET  /integrations/solidcom/status
GET  /integrations/solidcom/orders/failures
GET  /integrations/solidcom/orders/:orderId/failure
POST /integrations/solidcom/orders/:orderId/retry
```

## Analytics

```text
POST /analytics/track
GET  /analytics/admin/insights
GET  /analytics/funnel
GET  /analytics/events
GET  /analytics/admin/search-insights
```

## Uploads e estaticos

```text
POST /uploads
GET  /uploads/products/{ean}.webp
```

## Regras operacionais do catalogo

- NUNCA: nao exibir no storefront
- SEMPRE: exibir independente do estoque
- ESTOQUE: exibir somente com estoque > 0

Observacao: contratos detalhados de request/response devem ser consultados no Swagger em runtime.
