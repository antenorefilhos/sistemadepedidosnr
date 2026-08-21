# Tela de Pagamentos e Gateway (Task 17)

Documentação do que já existe implementado na integração de pagamentos, para
o usuário entender o que o sistema já cobre sem precisar ler o código.

## Onde mexer no admin

Tela **Sistema → Eventos de Pagamento** (`PaymentEventsSection.tsx`).

## Endpoints reais (backend)

Todos sob `/integrations`, admin-only salvo indicação contrária:

| Rota | O que faz |
|---|---|
| `GET /payments/health` | Status da integração com o gateway |
| `GET /payments/transactions` | Lista transações |
| `GET /payments/charge-preview/:orderId` | Simula cobrança antes de disparar |
| `GET /payments/charge-preview/:orderId/history` | Histórico de simulações |
| `POST /payments/orders/:orderId/transaction` | Cria transação pro pedido |
| `POST /payments/charge/:orderId` | Cobra de fato |
| `POST /payments/charge-replay/:snapshotId` | Reprocessa cobrança a partir de um snapshot |
| `POST /payments/refunds` | Estorno |
| `POST /payments/chargebacks` | Registro de chargeback |
| `POST /payments/reconciliation` | Concilia com o gateway |
| `POST /payments/webhook` | Webhook público do gateway (sem guard de admin, autenticado por assinatura do provedor) |
| `GET /payments/webhook/events` | Log de eventos recebidos do webhook |

Ver também `sistema/backend/src/modules/integrations/payments-webhook.service.ts`
e `payments-ledger.service.ts` — o ledger é a fonte de verdade de quanto foi
cobrado/estornado por pedido, separado do status do pedido em si.

## Ponto de atenção já documentado

O checkout recalcula o preço três vezes e compara o total antes de cobrar
(`PRICE_DIVERGED`, ver `CLAUDE.md` na raiz do projeto, seção "Checkout: o
preço é recalculado"). Qualquer investigação de cobrança divergente deve
olhar esse evento antes de mexer no gateway.

## Estado

Feature já implementada. Este documento é só o inventário pedido como Task
17 — não houve mudança de código nesta sprint.
