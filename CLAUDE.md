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

`Notificador/` (raiz do projeto, fora de `sistema/` de propósito) é um app
Electron cliente pra Windows — roda na máquina local do separador, sem
Dockerfile, sem build/deploy na VPS, só consome `https://api.antenorefilhos.com.br`
via HTTPS com uma conta `role=picker`. Ver `Notificador/README.md`.

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
`auth`), silenciosamente. Foi o que quebrou o upload em massa de fotos, e depois
se confirmou em 31 dos 36 controllers do backend (dashboard, equipe, picking,
delivery, a integração com o ERP inteira).

Corrigido para todos os controllers existentes: use
`@RelaxedThrottle()` (`common/decorators/relaxed-throttle.decorator.ts`) em
**todo controller novo** que não seja de auth/checkout/webhook — cai no bucket
`default` (600/min). Se uma rota específica precisa ficar sob `auth`,
`checkout` ou `webhook` de propósito, use `@Throttle({ nome: {...} })` nela
(não junto com `@RelaxedThrottle()` na mesma classe sem checar: skip de
classe vence sobre override de rota — ver `orders.controller.ts` para o
padrão de classe mista).

## Checkout: o preco e recalculado, e agora comparado antes de cobrar

`PricingService.quote()` roda **tres vezes** num unico checkout:

1. `CheckoutService.buildQuote()` — o total que o cliente ve na tela
2. `CheckoutService.confirmSession()` — de novo, ao confirmar
3. `OrdersService.create()` — de novo, ao gravar o pedido

O total exibido nao era passado adiante; o pedido usava o valor recalculado no
passo 3 sem comparar com o que o cliente viu. Corrigido: `confirmSession()` le
`session.priceSnapshot` **antes** de rodar `buildQuote()` de novo (que sobrescreve
esse snapshot), compara com o total recalculado e bloqueia com 400 se a diferenca
passar de 1 centavo — registra evento `PRICE_DIVERGED` (com os dois valores) em vez
de cobrar calado. Cobre promocao expirando ou sync do ERP sobrescrevendo
`promotionalPrice` no meio do checkout.

`buildQuote` tambem chama o pricing duas vezes de proposito quando o frete gratis
muda a taxa: o subtotal define o frete e o frete entra no total.

## Armadilha: senha do Postgres com caractere especial quebra a DATABASE_URL do compose

A senha oficial do Postgres (a mesma usada em `ADMIN_PASSWORD`, ver
`sistema/.env`) tem `@` e `*`. O `docker-compose.yml` monta a `DATABASE_URL` do
serviço `api` interpolando a env var crua (`postgres:${POSTGRES_PASSWORD}@db:5432/...`)
— o `@` da senha quebra o parsing da connection string (o parser lê o primeiro
`@` como separador usuário/host) e a API fica com `Authentication failed
against database server`.

Corrigido com duas variáveis em `sistema/.env` (valores reais só ali, nunca
aqui — `.env` é `.gitignore`d):
- `POSTGRES_PASSWORD=...` — crua, usada só pra inicializar o Postgres
  (`POSTGRES_PASSWORD` do serviço `db`, não é URL).
- `POSTGRES_PASSWORD_URLENC=...` — a mesma senha com o `@` escapado (`%40`),
  usada em `DATABASE_URL` do serviço `api` no `docker-compose.yml`.

Se trocar a senha do Postgres: atualiza as duas, url-encoda o `@` (e qualquer
outro caractere reservado de URL) na versão `_URLENC`, e roda
`ALTER USER postgres WITH PASSWORD '...'` dentro do container `antenor_db`
(mudar a env var não migra a senha de um volume já inicializado). O
`backend/.env` (usado pra rodar `prisma:seed`/scripts direto do host, fora do
Docker) já guarda a `DATABASE_URL` com a senha url-encoded — mantém os dois em
sincronia.

## Armadilha: quantidade fracionada no carrinho é "número de passos", não kg

`CartContext` guarda `quantity` de item pesável como **múltiplo do passo**
(ex.: `quantity=1` com `fractionStep=0.8` significa 0,8kg), usado só pra
exibição (`formatProductQuantity` faz `quantity * step`). O backend do
carrinho (`cart.service.ts` → `validateProductQuantity`) espera a
**quantidade real em kg**, não o número de passos — quem manda o valor errado
recebe "Quantidade do produto X deve respeitar o passo Y" mesmo com peso
correto. `Checkout.tsx` corrigido pra multiplicar por `getProductStep()`
antes de enviar ao criar o item no carrinho backend.

## Recuperação de senha do storefront (cliente)

Existia só no admin (Resend). Implementado o mesmo fluxo pro cliente:
`POST /auth/customer/forgot-password` (bucket `auth`, sempre resposta
genérica) + `POST /auth/customer/reset-password`, telas
`ForgotPassword.tsx`/`ResetPassword.tsx`, rotas `/esqueci-minha-senha` e
`/redefinir-senha`. Conta criada via checkout convidado **não tem senha**
(`password: null`) — login falha até o cliente definir uma por aqui.

## Acesso SSH à VPS

Chave adicional `claude-code@antenor` (`~/.ssh/antenor_vps`) cadastrada em
17/08/2026 no painel Hostinger (VPS → Configurações → Chaves SSH) porque a
chave original documentada em `docs/nova-maquina.md` nunca foi de fato
copiada pro backup pré-formatação desta máquina. Se for reformatar de novo:
**faça o backup de `~/.ssh` de verdade desta vez** — ver `docs/nova-maquina.md`.

## Realidade do estoque

~82% do catálogo Solidcom tem estoque zero. Vitrine vazia geralmente é dado real,
não bug. O sync roda sozinho (`ERP_SYNC_INCREMENTAL_CRON`, de hora em hora, mais
sync completo diário às 4h) — não é mais manual, mas o dado do ERP ainda costuma
vir errado, especialmente em item de produção própria (padaria/açougue da loja):
já vimos `stock` negativo (ex.: -2897) sincronizado direto do Solidcom.

`syncOption` (`SEMPRE` / `NUNCA` / `ESTOQUE`, controlado no cadastro do produto
no Solidcom) é o jeito de contornar isso: `SEMPRE` marca o produto como
sempre vendável, ignorando o número de estoque. Isso já valia pra vitrine e
busca (`isStorefrontVisible` em `analytics.service.ts`, filtros equivalentes em
`products.service.ts`), mas até 17/08/2026 **não valia pro checkout** —
`CheckoutService.buildStockSnapshot()` e `InventoryService.reserveForCheckout()`
só olhavam o número de estoque sincronizado, então um produto `SEMPRE` com
estoque negativo no ERP passava na vitrine mas travava no fechamento do
pedido com "alguns itens ficaram indisponíveis". Corrigido: os dois agora
tratam `syncOption='SEMPRE'` como sempre disponível, igual à vitrine.
