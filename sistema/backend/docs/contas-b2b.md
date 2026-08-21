# Contas B2B (Task 16)

Documentação do que já existe implementado para contas corporativas (B2B),
para o usuário entender o que o sistema já cobre sem precisar ler o código.

## O que é

Um cliente pode ser vinculado a uma `BusinessAccount` (conta corporativa) que
tem regras próprias: pedido mínimo (`minimumOrder`), condições de pagamento
(`paymentTerms`), aprovação de pedidos, lista de usuários autorizados a
comprar em nome da conta, listas de compra recorrentes e faturamento
consolidado.

## Onde mexer no admin

Tela **Clientes → Contas Empresariais** (`BusinessAccountsSection.tsx`).

## Endpoints reais (backend)

Todos exigem admin, prefixo `/admin/business-accounts`:

| Rota | O que faz |
|---|---|
| `GET /` | Lista contas B2B |
| `POST /` | Cria conta B2B |
| `GET /approvals/pending` | Pedidos aguardando aprovação |
| `POST /orders/:orderId/approve` | Aprova/rejeita pedido pendente |
| `POST /orders/:orderId/billing` | Lança pedido no faturamento |
| `POST /:id/users` | Vincula usuário autorizado à conta |
| `GET/POST /:id/shopping-lists` | Listas de compra recorrentes |
| `POST /:id/recurring-orders` | Agenda pedido recorrente |
| `POST /:id/billing/run` | Roda o ciclo de faturamento |
| `GET /:id/financial` | Extrato financeiro da conta |
| `POST /:id/price-list` | Tabela de preço especial da conta |

Rota pública (para o storefront saber o contexto B2B do cliente logado):
`GET /business/customers/:customerId/context`.

## Campos no schema

`minimumOrder` (Decimal) e `paymentTerms` (String) em `BusinessAccount`
(`prisma/schema.prisma`).

## Estado

Feature já implementada e coberta por testes de backend
(`business.service.spec.ts` se existir, ver suíte Jest). Não foi objeto de
mudança nesta sprint — este documento é só o inventário do que já existe,
pedido como Task 16.
