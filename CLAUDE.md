# Antenor & Filhos — contexto do projeto

E-commerce de supermercado. Backend NestJS + Prisma/PostgreSQL, frontends React/Vite,
tudo orquestrado por Docker Compose sob `sistema/`.

## Apps

| App | Pasta | Container | Porta host |
|---|---|---|---|
| API | `sistema/backend` | `antenor_api` | 3001 |
| Storefront (cliente) | `sistema/frontend` | `antenor_storefront` | 3000 |
| Admin | `sistema/admin` | `antenor_admin` | 3002 |
| Separação | `sistema/picking-app` | `antenor_picking` | ver `docker ps` |
| Entrega | `sistema/delivery-app` | `antenor_delivery` | ver `docker ps` |

As portas de picking/delivery já variaram entre reinícios — confirme com `docker ps`.

Toda alteração de código exige rebuild: `docker compose up -d --build <serviço>`.

## Regras de trabalho

- **Correção de bug vale nas duas versões.** Mobile e desktop, sempre — mobile é
  prioridade, o cliente chega por WhatsApp e Facebook Ads.
- **Respostas curtas.** "Ta feito" / "não fiz". Sem relatório longo salvo se pedido.
- **Zero segredos no repo.** Nada de credencial, token, CPF ou CNPJ commitado.
- Migrations do Prisma: escreva o SQL à mão e rode `prisma migrate deploy`.
  `migrate dev` é interativo e trava neste ambiente.

## Roadmap

Plano de lançamento e pendências em [docs/roadmap.md](docs/roadmap.md).

## Integração Solidcom (ERP)

Ver [docs/solidcom-api.md](docs/solidcom-api.md) — tem duas armadilhas sérias
documentadas que custaram caro para descobrir. Leia antes de mexer no sync.

## Domínio e acessos

E-mail correto é `@antenorefilhos.com.br`. `@antenor.com.br` **não existe** —
se aparecer em algum lugar, é erro.

Contas de equipe: `role='admin'` é master e ignora toda checagem. `role='staff'` é
governado por `moduleAccess` (quais apps) + permissões granulares, geridos na tela
Equipe do admin. Ver `ModuleAccessGuard` e `syncStaffPermissions()`.

## Armadilha: rate limit silencioso

`ThrottlerModule` tem múltiplos buckets nomeados. Rota **sem** decorator explícito
herda TODOS eles — ou seja, fica limitada ao mais apertado (20 req/min do bucket
`auth`), silenciosamente. Foi o que quebrou o upload em massa de fotos.
Rotas de carga precisam de `@SkipThrottle({ auth: true, checkout: true, webhook: true })`.

## Checkout: o preco e recalculado, nunca carregado

`PricingService.quote()` roda **tres vezes** num unico checkout:

1. `CheckoutService.buildQuote()` — o total que o cliente ve na tela
2. `CheckoutService.confirmSession()` — de novo, ao confirmar
3. `OrdersService.create()` — de novo, ao gravar o pedido

O total exibido **nunca e passado adiante**; o pedido usa o valor recalculado no
passo 3. Se o preco mudar entre a tela e a confirmacao — promocao expirando, ou um
sync do ERP sobrescrevendo `promotionalPrice` no meio do checkout — o cliente e
cobrado diferente do que viu, sem aviso.

Nao e bug comprovado, e uma janela de risco. `priceSnapshot()` ja guarda o que
seria preciso para comparar e bloquear a confirmacao em vez de cobrar calado.

`buildQuote` tambem chama o pricing duas vezes de proposito quando o frete gratis
muda a taxa: o subtotal define o frete e o frete entra no total.

## Realidade do estoque

~82% do catálogo Solidcom tem estoque zero. Vitrine vazia geralmente é dado real,
não bug. O sync é manual e o dado do ERP costuma estar desatualizado.
