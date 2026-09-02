# API Solidcom / Dorsal — o que sabemos

Base: `http://45.239.193.56:5000` (env `SOLIDCOM_API_URL`)
Swagger: `http://45.239.193.56:5000/swagger/index.html` — título "Conexão Dorsal", 17 endpoints.
Sem autenticação. Só a porta 5000 é exposta; o banco não é acessível pela internet.

## Endpoints

| Método | Rota | Uso |
|---|---|---|
| GET | `/api/Produto/GetProdutos?ativo=true` | Catálogo completo (~15.800 itens, ~10,5 MB) |
| GET | `/api/Produto/GetProdutosAlterados?data=YYYY-MM-DD` | Produtos alterados — **ver ressalva abaixo** |
| GET | `/api/Produto/GetProdutosCadastro?data=YYYY-MM-DD` | Produtos cadastrados (ainda não usado) |
| GET | `/api/Produto/GetProdutosEAN?EAN=` | Um produto por EAN |
| GET | `/api/Produto/GetProdutosComMenorEAN` | — |
| POST | `/api/Pedido/PostPedido` | Envia pedido |
| PUT | `/api/Pedido/{cdPedido}/Ecom/{cdEcom}/PutCancelamentoPedido` | Cancela pedido |
| GET | `/api/Pedido/{cdPedido}/CNPJ/{CNPJ}/Ecom/{cdEcom}/GetPedido` | Consulta pedido |
| GET | `/api/Pedido/CNPJ/{CNPJ}/Ecom/{cdEcom}/GetPedidoPeriodo` | Pedidos por período |
| GET | `/api/Pedido/GetModeloPagamento` | Formas de pagamento |
| GET | `/api/Vendas/CNPJ/{cnpj}/INICIO/{inicio}/FIM/{fim}/GetVendasResumo` | Resumo de vendas |
| GET/POST | `/api/Cliente/...` | Clientes |

## Armadilha: GetProdutos serve preço desatualizado

**Promoções cadastradas no PDV não aparecem no `GetProdutos` em massa**, mesmo com
`dtalteracao` recente. O mesmo produto, no mesmo instante:

- `GetProdutos?ativo=true` → EAN 516, `vl_produto=69.90`, `vl_produto_normal=69.90` (sem promoção)
- `GetProdutosEAN?EAN=516` → `vl_produto=59.90`, `vl_produto_normal=69.90` (com promoção)
- `GetProdutosAlterados` → também traz o preço correto

Duas leituras do bulk com 1 dia de intervalo deram md5 idêntico — o dado dele é estático/cacheado
do lado da Dorsal. Por isso `solidcom-erp.service.ts` sobrepõe o bulk com a janela de alterações.

## A instalação está atrás da documentação

Doc oficial: <https://crm.solidcon.com.br/docs/conexaodorsal> (sempre atualizada pelo fornecedor).
Ela descreve a **v1.0.71.0**; a instalação em `45.239.193.56:5000` é anterior. Divergências medidas:

| | Doc (1.0.71.0) | Nosso servidor |
|---|---|---|
| `GetProdutosAlterados` | `/{data}` como **path param** | `?data=` como **query param** |
| `ApenasAlterados` | existe (default `false`) | não existe — passar é ignorado |
| `GetProdutosEAN` | não documentado | **existe** |
| `GetProdutosCadastro` | não documentado | **existe** |
| `GetProdutos` | params `ativo` e `estoque` | idem |

Chamar a forma documentada (`/api/Produto/GetProdutosAlterados/2026-07-09`) devolve **404** aqui.
A forma com query string é a correta para esta instalação — não "conserte" isso sem antes
confirmar que o fornecedor atualizou o servidor.

Vale pedir a atualização: `ApenasAlterados=true` faz a consulta filtrar só pela data de
alteração do produto, que é exatamente o que precisamos.

## Armadilha: dtalteracao não é o campo do filtro

`GetProdutosAlterados?data=X` **não** filtra por `dtalteracao`. Medido em 09/08/2026:

- janela "desde 09/07" → itens com `dtalteracao` de **março a agosto**
- janela "desde 08/08" → itens com `dtalteracao` de **fevereiro a julho**, nenhum de agosto

O filtro usa um log interno de alterações do ERP, não o campo que vem no produto. Por isso
`dtalteracao` não serve para decidir se um dado está fresco.

## Armadilha: GetProdutosAlterados NÃO é cumulativo

`data=X` **não** significa "alterados desde X". Uma janela larga não contém as janelas menores.
Medido em 2026-08-08:

| `data=` | registros | traz EAN 516 | traz Farofa Yoki |
|---|---|---|---|
| 2026-07-09 (30d) | 2354 | sim | **não** |
| 2026-08-01 | 380 | sim | não |
| 2026-08-05 | 384 | sim | sim |
| 2026-08-07 | 265 | **não** | sim |
| 2026-08-08 | 117 | sim | sim |

É determinístico (3 chamadas na mesma data → resposta byte-idêntica), só não é cumulativo.
Semântica real ainda não confirmada na documentação oficial.

**Consequência:** o sync varre dia a dia a janela e sobrepõe do mais antigo para o mais novo,
deixando a leitura mais recente vencer. Ver `overlayRecentChanges()`.
Janela em `SOLIDCOM_CHANGE_WINDOW_DAYS` (padrão 30). Sync completo leva ~3 min.

## Campos relevantes

- `vl_produto` — preço atual; `vl_produto_normal` — preço de tabela.
  Promoção ativa quando `vl_produto_normal > vl_produto`.
- `preco_fidelidade_promocao` — preço do clube; 0 quando não há.
- `qtd_produto` — estoque. `fracionado` / `fracionamento` — pesável e passo.
- `dtalteracao` — **não confiável** como sinal de frescor no bulk.

## Armadilha: promoção nunca era removida

Quando não há promoção, o ERP **omite** o campo — e `undefined` faz o **Prisma ignorar a
coluna no update**. Promoção gravada uma vez ficava eterna na vitrine.

Estrago medido em 09/08/2026: **13 das 31 promoções no ar eram fantasmas** — o PDV já não
tinha aquelas ofertas. Quase todas de itens pesáveis e de produção própria.

```ts
promotionalPrice: item.promotionalPrice          // ERRADO: undefined = coluna ignorada
promotionalPrice: item.promotionalPrice ?? null  // CERTO, mas só de fonte confiável
```

O `?? null` **só** vale a partir da janela recente ou do `GetProdutosEAN`. Aplicado ao
catálogo em massa, apagaria promoção boa — ele serve preço velho.

## Ordem de confiança para promoção

1. `GetProdutosEAN?EAN=` — bate com o PDV, é a verdade
2. `GetProdutosAlterados?data=` (janela curta) — confiável e barato
3. `GetProdutos?ativo=true` — **nunca** para promoção; serve catálogo, nome e estoque

## Como o sync funciona

```
de hora em hora  →  syncRecentFromERP(2h)   ~3s     janela recente, confiável
                       └─ encerra promoção que saiu do ar
                       └─ grava PriceAuditLog (produto novo / preço / promoção)

04:00 diário     →  syncFromERP()           ~190s   catálogo completo
                       └─ NÃO mexe em promoção
                       └─ reconcilePromotions() confere 1 a 1 via GetProdutosEAN
```

| variável | default | o que faz |
|---|---|---|
| `ERP_SYNC_CRON_ENABLED` | `false` | liga os dois crons |
| `ERP_SYNC_INCREMENTAL_CRON` | `0 * * * *` | de hora em hora |
| `ERP_SYNC_INCREMENTAL_HOURS` | `2` | janela (folga proposital sobre 1h) |
| `ERP_SYNC_CRON` | `0 4 * * *` | catálogo completo |

Endpoints manuais (admin): `POST /products/sync/incremental?hours=2`,
`POST /products/sync/promotions`, `POST /products/sync`.

O que mudou fica em `price_audit_logs` — ações `NEW_PRODUCT`, `PRICE_CHANGED`,
`PROMOTION_STARTED`, `PROMOTION_CHANGED`, `PROMOTION_ENDED`, com `createdBy`
distinguindo `erp-sync` de `erp-reconcile`.

## Janela curta é barata — use para detecção rápida

Medido em 09/08/2026:

| janela | resposta | tempo | produtos | promoções |
|---|---|---|---|---|
| 1 hora | 61 KB | 2,0 s | 97 | 18 |
| 6 horas | 74 KB | 2,0 s | 117 | 18 |
| 24 horas | 74 KB | 2,0 s | 117 | 18 |
| catálogo completo | 10,5 MB | ~190 s | 15.798 | — |

Uma consulta de 1 hora já traz **todas** as promoções ativas. É o caminho para detectar
produto novo e promoção nova rápido, sem pagar o sync completo.

## Em aberto

- Não há webhook nem push na doc — só polling.
- Rate limit não documentado; nenhum 429 observado até agora.
- `GetProdutosCadastro` existe no servidor mas não está na doc nem integrado ao sync.

## Investigação em andamento: pular a separação do módulo Dorsal

Hoje o `PostPedido` grava o pedido no banco `DORSAL` (retaguarda/e-commerce
da Solidcom), que expõe o pedido pro app de separação **deles**. Como já
temos `sistema/picking-app`, o objetivo é usar o nosso app de separação e
mesmo assim conseguir fechar a venda no PDV deles sem passar pela
separação da Solidcom.

Investigação feita direto no banco SQL Server deles (schema, campos de
`tbPedido`/`tbPedidoItem`, valores de `EcommerceSolidconStatus`, o que
`hrSeparacaoInicio/Fim` faz — ou não faz — nesse fluxo) está documentada
em detalhe no vault Obsidian:
`pipeline/solidcom-dorsal-banco-direto.md`. **Não duplicar aqui** — esse
arquivo do repo cobre só a API REST; o banco fica só no vault.

Achado crítico: o fechamento no PDV emite NFC-e real (comunicação com a
SEFAZ) — não dá, e não é seguro, simular isso via escrita direta em banco.
O bypass, se existir, é só na etapa de separação, nunca no fechamento
fiscal.

## RESOLVIDO (29/08/2026): o sinal de faturamento e `hrRegistro`, nao o status

Consulta direta ao banco `DORSAL` (SQL Server `10.13.0.2`, credencial em
`sistema/.env` como `DORSAL_DB_*` — valor real nunca em doc versionada).

### O bypass da separacao existe naturalmente — confirmado com dado

O `cdPedido = 2038` (DAV 102028, nosso, `cdEcom = 19`) **foi puxado e fechado
no PDV sem nunca passar pelo app coletor da Solidcom**: `COO = 202030`,
`nrCupom = 203255`, `hrRegistro = 2026-08-19 18:27:12`, nao cancelado.

Ou seja: **nao e preciso bypass nenhum.** Nosso `picking-app` separa por fora,
o PDV puxa pelo DAV normalmente, e o fechamento acontece. Nao ha necessidade
de escrever no banco deles — o que era o plano B documentado no vault.

### O `EcommerceSolidconStatus` NAO serve de sinal no nosso fluxo

O 2038 foi fechado e **continua em status `1`**. A transicao `5 → 6` pertence
a esteira do coletor: quem passa por ela chega a `5` e vira `6` no fechamento;
quem pula (nos) fica em `1` pra sempre, mesmo faturado.

O sinal confiavel e `hrRegistro` (e, junto, `COO` / `nrCupom`), preenchidos no
fechamento em qualquer caminho:

| status | pedidos | com `hrRegistro` | com `COO` |
|---|---|---|---|
| 6 | 386 | **386** | 386 |
| 5 | 14 | 0 | 0 |
| 4 | 3 | 0 | 0 |
| 99 | 11 | 0 | 0 |
| **1** | 22 | **1** (o nosso 2038) | 1 |

100% dos fechados tem `hrRegistro`; nenhum nao-fechado tem. **E o gatilho certo
pra "pedido faturado, liberar pro entregador".**

### Por que 21 pedidos nossos estao em `1` sem `hrRegistro`

Nao e travamento: sao testes que foram **cancelados** em vez de fechados. O
unico que alguem levou ate o fim (2038) fechou sem problema.

### Armadilha de conciliacao: a forma de pagamento do storefront nao vale

No `2038`, a `Obs` do pedido dizia `Pgto: PIX` e a venda **fechou em
DINHEIRO** (confirmado no cupom 203255, aba Modalidades). A forma de pagamento
escolhida no storefront vira so um recado na observacao do pedido — quem
decide de fato e o operador no PDV.

**`orders.paymentMethod` do nosso banco NAO e fonte de verdade do que foi
cobrado.** Qualquer relatorio financeiro nosso que trate esse campo como
realizado vai divergir do caixa.

### Correcoes de leituras anteriores minhas (29/08/2026)

Escrevi aqui, e estava errado nas duas vezes:
1. Que o pedido `2023` "foi criado por outro caminho". Nao — foi feito pelo app
   antigo, fluxo Solidcom 100%, inclusive coletor, com corte e substituicao de
   item de proposito.
2. Que `cdEcom = 19` travava o pedido. Nao trava: o 2038 tem `cdEcom = 19` e
   foi faturado. A correlacao "cdEcom=19 sempre em status 1" era real mas
   enganosa — a causa e a esteira do coletor, nao o campo.

Licao: `EcommerceSolidconStatus` descreve o fluxo DELES. Pra medir o NOSSO,
usar os campos que o fechamento fiscal preenche.
