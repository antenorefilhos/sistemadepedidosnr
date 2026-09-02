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

Ver [docs/solidcom-api.md](docs/solidcom-api.md) — tem armadilhas sérias
documentadas que custaram caro para descobrir. Leia antes de mexer no sync.

## Armadilha: `PostPedido` estoura com campo string nulo (obs e endereço)

`GravaPedido` do Solidcom (`Dorsal/Pedido.cs`) chama `.Length` em campos de
texto **sem checar nulo** — linha 111 no `obs` do pedido, linha 148 nos campos
de `cliente.endereco`. Mandar `obs: null` ou omitir `cliente.endereco` derruba
o endpoint com `400 "Object reference not set to an instance of an object"`,
que é `NullReferenceException` vazando, não erro de validação.

Isso travou **todo pedido** de 17/08 a 18/08/2026. Os pedidos atingidos eram
todos de teste da equipe (a loja testa o sistema todo dia conforme o
desenvolvimento avança), mas qualquer pedido real na janela teria falhado
igual.
Não é erro de payload inválido: o payload passa na validação deles e quebra
dentro da lógica de negócio. Por isso nenhum campo do nosso lado "faltava" no
sentido do schema — o swagger deles marca os dois como opcionais.

Regra: `mapToSolidcomPedido` **sempre** manda `obs` e `cliente.endereco`
preenchidos. String vazia é aceita; `null` não. Não confie no schema/swagger
deles pra decidir o que é opcional.

Como diagnosticar erro de integração com eles de novo: o log da aplicação
deles (log4net, `\\10.13.0.2\c\CONEXAODORSALNovaReal\Log\`) registra o JSON
recebido **e o stack trace com número de linha**. É a fonte de verdade — nossa
camada de integração só guarda `error.message` e perde o corpo da resposta.
Atenção: metadado de tamanho de arquivo via SMB vem desatualizado (mostra 0
byte em log de 1,8 GB) — leia o conteúdo, não confie no `Length`.

### Em aberto: o código do PDV depende do retorno da Solidcom

O separador precisa de um número pra puxar o pedido no PDV (o id interno é
UUID, tem letra, o PDV recusa). Hoje mostramos o **DAV**, que vem na resposta
do `PostPedido` e é gravado em `orders.erpDav`.

Isso cria uma dependência do retorno deles: pedido que não sincronizou fica
"sem DAV" no app de separação. Na prática o pedido também não existe no PDV
nesse caso, então o aviso reflete a realidade — mas o fallback atual é ruim:
cai no id interno, que não serve pra digitar em lugar nenhum.

**Alternativa não testada**, se o DAV se mostrar insuficiente: usar o nosso
`numero` (`toExternalOrderNumber`, o hash int32) como código exibido. Ele é
o `cdEcomPedido` do lado deles, aparece no CRM como "Código eCommerce", é
numérico e existe desde a criação do pedido — sem depender de resposta.
Falta confirmar no PDV se a tecla "venda automática" aceita esse código; o
suporte disse que dá pra puxar por "venda automática" ou por DAV, mas não
testamos qual número a primeira espera. Se aceitar, o DAV vira conveniência
(6 dígitos, mais curto), não requisito.

Decisão de 19/08/2026: seguir com o DAV até testar no PDV real.

### Pendência conhecida: cancelamento não funciona

`PutCancelamentoPedido` recebe `cdPedido` como **int32**, mas
`toExternalOrderNumber()` gera número de 12 dígitos (fatia do UUID do pedido),
que estoura o limite. Ou seja, `syncCancelledOrder` nunca consegue cancelar
pedido nenhum lá — dá `400 "The value 'X' is not valid"`. Precisa passar a
gerar `numero` que caiba em int32 (< 2.147.483.647), sem colidir com número já
usado (eles rejeitam duplicado).

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

## Configuracao: identificador de integracao vai pro ambiente, sem default

Ate 28/08/2026 o CNPJ da loja, o CPF de balcao e o endereco do ERP tinham valor
hardcoded como fallback no fonte (`solidcom-erp.service.ts`,
`order-orchestration.service.ts`, `health.controller.ts`,
`integrations.service.ts`). Alem de violar a regra de zero segredos no repo — o
CPF e dado pessoal, nao identificador publico —, o efeito pratico era pior: como
o `docker-compose.yml` nao repassava nenhuma dessas variaveis, **o fallback era
a configuracao real de producao**, e mexer no `.env` nao tinha efeito nenhum.

Agora vem de `requireEnv()` (`common/require-env.ts`), **sem default**: faltando
a variavel, a API estoura no boot em vez de sincronizar contra o ERP errado
calada. E deliberado — a familia de bug mais cara desta base e configuracao que
parece existir e nao existe.

**Regra de bolso:** identificador que autentica ou enderecca uma integracao vai
pro ambiente e e obrigatorio. Dado que o site ja publica (CNPJ e razao social do
rodape, em `brand.service.ts`) fica no codigo — publicar o que a loja ja mostra
nao vaza nada, e exigir env ali derrubaria o storefront por constante de vitrine.

Antes de dar por configurada qualquer variavel nova, rode
`node sistema/scripts/check-env.js`: ele compara `.env.example`, `.env` e
`docker-compose.yml`, e sai com codigo 1 na divergencia. Sem `env_file` no
servico `api`, **so o que esta listado em `environment:` chega no container** —
documentar no `.env.example` e preencher o `.env` nao basta.

## Armadilha: `migrate deploy` nao detecta schema fora de sincronia

`prisma migrate deploy` compara **quais migrations ja foram aplicadas**, nunca o
`schema.prisma` com o banco. Model editado sem migration correspondente passa
batido em todo deploy, e o log diz "All migrations have been successfully
applied" — verdadeiro e irrelevante.

Foi assim que `drivers.adminId` ficou meses ausente em producao (achado em
28/08/2026). O campo esta no schema desde sempre e o banco nunca teve a coluna.
Efeito: o **app do entregador estava 100% quebrado** — todo endpoint `/driver`
passa por `findDriverByAdmin`, que consulta `where: { adminId }`, e o Prisma
estourava em runtime logo apos o login com "The column `drivers.adminId` does
not exist in the current database". Nao era 404 tratavel, era erro cru.

Havia um segundo efeito, pior por ser mudo: `ensureDriverProfile`
(`auth.service.ts`) faz `upsert` na mesma coluna pra vincular perfil de
motorista a quem recebe o modulo `delivery`. Ele tambem quebrava — por isso
existia conta de motorista com o modulo certo e **zero** linhas em `drivers`.

Antes de investigar "bug" em app que fala com o banco, rode:

```bash
node sistema/scripts/check-schema-drift.js --container antenor_api
```

Ele roda o `prisma migrate diff` e **filtra o ruido**: o diff cru sempre lista
~20 divergencias benignas (nomes de indice truncados pelo Prisma, `DEFAULT` que
o banco tem a mais), e e no meio delas que o problema real se esconde. Sai com
codigo 1 so quando ha divergencia funcional.

Quando achar divergencia, decida a direcao: se o **schema** esta certo, escreva
migration a mao; se o **banco** esta certo (ex.: indice criado a mao pra
desempenho), declare no schema. Em 28/08/2026 tinha das duas.

## Armadilha: e-mail nunca saiu em producao (Resend sem chave, e log mudo)

Descoberto em 28/08/2026 ao testar o alerta do monitor de produto sumido.
`RESEND_API_KEY` **nao existia no `.env` da VPS** — o `docker-compose.yml`
repassa a variavel certo (`RESEND_API_KEY: ${RESEND_API_KEY:-}`), mas o valor
nunca foi definido lá, entao o container sempre subiu com string vazia.
Causa raiz: o `.env.example`, que e a checklist de quem configura ambiente,
**nao tinha bloco RESEND nenhum**. Corrigido — o bloco esta la agora.

Efeito: `EmailService` era no-op em producao desde sempre. Atingia a
recuperacao de senha do **admin** (`auth.service.ts:39`) e a do **cliente**
(`auth.service.ts:76`) — as duas implementadas, testadas, e sem entregar nada.

Por que ninguem percebeu, tres camadas de silencio empilhadas:
1. Sem chave, `send()` retorna `false` e emite `logger.warn`.
2. Esse warn nao sai: `main.ts` cria a app com `logger: false`, entao **todo
   `Logger` do Nest e descartado em producao** (vale pro backend inteiro, nao
   so aqui — varios schedulers logam por ele e sao mudos na VPS). O unico que
   sai e o `winstonLogger` de `common/logger.ts`.
3. Quem chama ignora o `false`, e a tela de "esqueci minha senha" responde
   sucesso generico de proposito (anti-enumeracao de conta) — entao o usuario
   final tambem nao ve diferenca entre enviado e engolido.

Segunda parte da mesma armadilha: `RESEND_FROM_EMAIL` tambem estava vazia, e
o fallback e o `onboarding@resend.dev`, remetente de teste do Resend que **so
entrega para o e-mail dono da conta** — qualquer outro destinatario leva 403.
O dominio `antenorefilhos.com.br` ja estava verificado no Resend desde
12/08/2026; faltava so apontar o remetente pra ele. Resolvido em 28/08/2026:
`RESEND_FROM_EMAIL="Antenor & Filhos <nao-responda@antenorefilhos.com.br>"`.

Nao confunda os dois: dominio verificado nao basta, o `from` precisa usar esse
dominio. Com o `from` no remetente de teste, um dominio verificado nao serve
pra nada — foi o que fez a recuperacao de senha de cliente (destinatario
arbitrario) levar 403 mesmo com tudo "configurado".

Regra: antes de dar por pronta qualquer feature que dependa de servico externo,
confirme que a credencial existe **no ambiente que roda**, nao so no `.env`
local — e nao confie em log do Nest pra descobrir que nao existe.

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
não bug. O sync roda sozinho (`ERP_SYNC_INCREMENTAL_CRON`, de hora em hora — só
grava quando o ERP acusa mudança, silêncio no log não quer dizer que parou —
mais sync completo em `ERP_SYNC_CRON`, 4x ao dia desde 18/08/2026) — não é mais
manual, mas o dado do ERP ainda costuma vir errado, especialmente em item de
produção própria (padaria/açougue da loja): já vimos `stock` negativo
(ex.: -2897) sincronizado direto do Solidcom.

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

## Zona de entrega: `DeliveryZone` e o unico model (o segundo foi removido)

`DeliveryZone` (tabela `delivery_zones`, 34 linhas) e onde a zona real
("Chafariz", fee/freeAbove) vive — criada pela tela "Taxas de Entrega" do
admin, e o que `DeliveryService.calculate()` usa.

Existia um segundo model, `DeliveryArea` (`delivery_areas`), mais generico
(regra em JSON, prioridade) e projetado pra substituir o primeiro. Ganhou CRUD
completo no backend e **nunca ganhou tela no admin**: ficou com zero linhas em
producao a vida toda, enquanto `calculate()` consultava ele **antes** das zonas
de verdade em toda requisicao de frete.

Isso custou um bug real (18-19/08/2026): a correcao do antifraude de frete
gratis consultou `this.prisma.deliveryArea` em vez de `deliveryZone` — sintaxe
valida, compila, roda, e a query nunca acha nada porque a tabela esta vazia.
Nenhum erro, nenhum teste vermelho (o mock do spec usava o model errado
tambem) — so o comportamento fica sempre "zona nao encontrada".

Removido em 28/08/2026 (migration `20260828000000_drop_delivery_areas`): model,
rotas `admin/fulfillment/areas`, `findMatchingArea` e o aviso somente-leitura na
tela de zonas. `calculateLegacyZone` virou o proprio `calculate()`.

**O que sobrou de armadilha:** a coluna `orders."deliveryAreaId"` continua no
banco e, apesar do nome, guarda o id de uma **DeliveryZone** — o checkout grava
`quote.delivery.zoneId` ali (`checkout.service.ts`). Nunca houve FK. Nao da pra
renomear sem migrar dado e mexer no contrato do ERP (`order-contract.dto.ts`).

Licao geral: tela completa no backend sem nenhum consumidor no frontend nao e
codigo inofensivo esperando uso — e uma checagem morta na frente do caminho que
funciona, e o proximo dev vai escrever a query contra o model errado.

## Armadilha: nem todo endpoint do Solidcom traz `tipoIntegracao`

`tipoIntegracao` (a coluna **"Internet"** no cadastro do produto no Solidcom,
com SEMPRE/NUNCA/ESTOQUE) é o que vira `syncOption` e decide se o produto
aparece na vitrine. **Só o `GetProdutos` manda esse campo.** O
`GetProdutosAlterados` (sync incremental, de hora em hora) e o
`GetProdutosEAN` (reconciliação por EAN) devolvem exatamente a mesma lista de
campos, *menos* esse.

Enquanto `resolveSyncOption` tratava ausente como `ESTOQUE` (o `return` final,
sem distinguir "não veio" de "veio inválido"), cada sync incremental
rebaixava o valor que o sync completo tinha gravado certo. Efeito: produto
marcado SEMPRE com estoque negativo — item de peso e produção própria, que
sempre carrega estoque negativo no ERP — **sumia da vitrine e da busca até o
próximo sync completo**, e voltava a sumir na hora seguinte. Achado em
28/08/2026 com o "LIMAO kg"; a auditoria mostrou 67 produtos divergentes, 22
ocultos indevidamente (banana, tomate, melancia, laranja, couve, músculo,
patinho, alcatra moída).

Corrigido em `87c2e44`: campo ausente vira `undefined` e o upsert só escreve
`syncOption` quando o ERP realmente opinou — produto novo nasce `ESTOQUE`,
produto existente preserva o valor. Regra geral: **antes de mapear um campo
do Solidcom, confirme em QUAL endpoint ele existe** — os três retornam
formatos parecidos e a diferença só aparece em produção.

Pra conferir se voltou a divergir:
`node scripts/audit-sync-option.js` (com `--aplicar` para corrigir).

Depois de corrigir, **reindexe a busca**: ela lê do MeiliSearch, não do banco
(`POST /products/admin/reindex-search`). Sem isso o produto reaparece na
navegação por categoria e continua sumido na busca — foi o que aconteceu no
diagnóstico.

## Armadilha: tela completa no admin sem nenhum consumidor no storefront

`DeliveryArea` (acima) não é caso isolado. O mesmo padrão já apareceu no slot
`category` dos banners: o admin tinha aba própria, CRUD, pré-visualização,
ordenação e validação — e **nenhum componente do storefront consumia**.
`useStoreBanners()` era chamado num único lugar (`Home.tsx`), que filtrava
`hero`/`intercalado`/`tarja`/`popup`. Cadastrar banner de categoria não fazia
absolutamente nada, sem erro nem aviso. Corrigido em 27/08/2026
(`Search.tsx` e `WinePage.tsx` passaram a consumir).

O que torna esse bug caro: os dois lados parecem prontos isoladamente. O admin
salva, a API responde 200, o dado entra no banco, o teste passa. Só falta o
elo, e nada no sistema reclama da falta dele.

**Antes de dar por pronta qualquer tela nova do admin**, confirme que existe
consumidor do outro lado — grep pelo campo/slot/model no storefront, não pelo
nome da feature:

```bash
grep -rn "slot === 'category'" sistema/frontend/src   # quem filtra o slot?
grep -rn "useStoreBanners\|deliveryArea" sistema/frontend/src sistema/backend/src
```

Se o grep só achar a definição do tipo e nenhum uso, a feature está morta —
independentemente de quantas telas do admin a alimentam.


### A mesma armadilha na direcao inversa: dado sem quem veja

A regra acima cobre "tela sem dado". O inverso aconteceu mais vezes: **campo
novo que ninguem mostra**. E mais dificil de perceber, porque nada esta
quebrado — o dado e gravado, a logica ate o respeita, e so uma PESSOA fica
sem a informacao.

Caso mais caro: `OrderItem.substitutionPolicy`. O cliente escolhe item a item
no carrinho, `picking.service` decide `requestSubstitution` a partir dele, e o
separador **nao via nada** — decidia no escuro sobre trocar ou nao produto que
faltou, sendo ele quem fala com o cliente. O dado ja chegava no app (o backend
usa `include`, o Prisma devolve todo escalar); faltava so a tela mostrar.
Achado por comparacao manual entre um pedido nosso e um feito pelo app da
Solidcom, nao por teste.

**Regra:** campo novo em modelo que humano usa exige responder *quem vai ver
isso* — ou justificar por que ninguem precisa. As duas respostas sao validas;
nao decidir e o problema.

Pra pegar o que ja passou:

```bash
node sistema/scripts/check-orphan-fields.js
```

Lista campo gravado no banco e nao lido por nenhum dos quatro apps. E lista de
**suspeitos, nao veredito**: campo interno legitimo (antifraude, snapshot,
token) aparece ali e deve ir pra `EXCECOES` **com o motivo escrito** — isencao
sem motivo vira lixo que ninguem revisa depois.

## Frete grátis: zona sobrepõe o global, sempre — dois lugares aplicam a regra

Regra de negócio (confirmada com o Jonathan em 19/08/2026): frete grátis
acontece (1) no primeiro pedido de um cadastro novo (liga/desliga no admin) ou
(2) quando o subtotal bate um valor mínimo — configurável globalmente
(`brand.freeShippingThreshold`, tela Marca) ou por zona
(`DeliveryZone.freeAbove`, tela Taxas de Entrega), **e a zona sempre vence o
global quando configurada**.

Essa precedência precisa ser respeitada em dois lugares independentes, e até
19/08/2026 só o backend (que decide o que cobrar) sabia disso:

- **Backend** (`OrdersService.isFreeShippingEarnedByZone`): valida o frete
  zero contra `DeliveryZone` antes do global, ao criar o pedido — é o que
  decide se cobra ou não.
- **Frontend** (`useFreeShipping`, `FreeShippingBar`, badge "Frete grátis
  incluído!" no `Checkout.tsx`): até 19/08/2026 usava só
  `brand.freeShippingThreshold`, cego a zona. Como o global está `null` em
  produção, a badge "Frete grátis incluído!" nunca aparecia mesmo quando o
  cliente batia o mínimo da zona (frete cobrado certo, R$0, só sem a
  confirmação visual) — e a barra de progresso ficava visível durante
  **retirada na loja**, prometendo frete grátis por valor num fluxo que já
  não cobra frete nenhum. Corrigido: `useFreeShipping(subtotal, zoneFreeAbove)`
  aceita o valor da zona (via `checkoutQuote?.delivery.freeAbove ??
  deliveryCalc?.freeAbove`) e sobrepõe o global; a barra some em `isPickup`.

## Armadilha: preview de frete na etapa de endereço nunca sabia se era grátis

`deliveryAPI.calculate()` (usado no preview da etapa de endereço, antes da
sessão de checkout existir) não mandava o subtotal do carrinho — o backend só
aplica `freeAbove` quando recebe subtotal, então o preview sempre mostrava a
taxa cheia mesmo pra quem já tinha batido o mínimo. O valor real cobrado
sempre esteve certo (recalculado depois com o subtotal de verdade via
`pricingService.quote()`), era só o preview que mentia por alguns segundos.
Corrigido: `verifyDeliveryForAddress(address, subtotal)` repassa o subtotal.

## `POST /orders` era alcançável por qualquer cliente com `delivery` cru

Achado em revisão de segurança (19/08/2026), não explorado em produção até
onde se sabe. `POST /orders` aceitava `delivery` e `deliveryAreaId` direto do
corpo da requisição, sem recalcular contra o endereço/zona reais — só
`customerId` tinha checagem de posse (`assertCustomerOwnership`). Um cliente
autenticado na própria conta podia declarar qualquer zona com fee baixo e
zerar o frete sem estar nela de verdade.

Nenhum frontend nosso (storefront ou admin) chama essa rota — o cliente real
sempre fecha pedido via `/checkout/sessions/:id/confirm`, que recalcula
frete/zona/desconto no servidor e chama `ordersService.create()` por dentro
(chamada direta ao service, não passa por este controller/guard). Corrigido
restringindo a rota a `@Roles('admin')`, sem efeito no fluxo real de
checkout. Se um dia precisar de criação de pedido self-service fora da sessão
de checkout (ex.: app mobile), a correção certa lá é recalcular `delivery` a
partir do endereço/zona no próprio `OrdersService.create()`, não reabrir a
rota confiando no valor recebido.
