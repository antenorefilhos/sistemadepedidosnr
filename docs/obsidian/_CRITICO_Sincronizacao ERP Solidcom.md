---
type: "documentacao-critica"
area: "Integração Solidcom"
atualizado: "2026-08-09"
fonte_de_verdade: "docs/solidcom-api.md (no git)"
tags:
  - critico
  - erp/solidcom
  - sincronizacao
  - promocoes
---

# ⚠️ CRÍTICO — Sincronização com o ERP Solidcom

> [!warning] Leia antes de mexer no sync
> Três armadilhas aqui custaram caro para descobrir. Cada uma já causou dado errado
> aparecendo para o cliente. Nenhuma é óbvia lendo o código.

> [!note] Este vault é regenerado
> `graphify --update` reescreve as notas geradas. A cópia versionada e definitiva
> está em `docs/solidcom-api.md` e `CLAUDE.md`, no git. Esta nota é um espelho para
> consulta — se divergir, o git manda.

---

## As três armadilhas

### 1. O catálogo em massa serve preço velho

`GET /api/Produto/GetProdutos?ativo=true` (~15.800 itens, 10,5 MB, ~190 s) **não reflete
promoção cadastrada no PDV**, mesmo com `dtalteracao` recente.

Mesmo produto, mesmo instante, EAN 516 (Contra Filé Grill):

| endpoint | vl_produto | vl_produto_normal | promoção? |
|---|---|---|---|
| `GetProdutos` (massa) | 59,90 | 59,90 | ❌ não |
| `GetProdutosEAN?EAN=516` | 59,90 | 69,90 | ✅ sim |

Duas leituras do endpoint em massa com 1 dia de intervalo deram **md5 idêntico** — o dado
dele é estático do lado da Dorsal.

**Consequência prática:** nunca confie no endpoint em massa para preço promocional.

### 2. `dtalteracao` não é o campo do filtro

`GetProdutosAlterados?data=X` **não** filtra por `dtalteracao`. Medido em 09/08/2026:

- janela "desde 09/07" → itens com `dtalteracao` de **março a agosto**
- janela "desde 08/08" → itens com `dtalteracao` de **fevereiro a julho**, nenhum de agosto

O ERP filtra por um log interno de alterações. O `dtalteracao` que vem no produto não serve
para decidir se o dado está fresco — **foi exatamente isso que levou à conclusão errada de
que "a promoção ainda não tinha chegado na API"**.

### 3. Promoção nunca era removida (bug corrigido em `ba67454`)

Quando não há promoção, o ERP **omite** o campo. O objeto normalizado saía sem
`promotionalPrice`, e `undefined` faz o **Prisma ignorar a coluna no update**. Resultado:
promoção gravada uma vez ficava **eterna** na vitrine.

Estrago real medido: **13 das 31 promoções no ar eram fantasmas** — produtos que o PDV já
não tinha em oferta, mas que o cliente via com desconto. Quase todos itens pesáveis e de
produção própria (kg, A&F).

```ts
// ERRADO — undefined faz o Prisma ignorar a coluna
promotionalPrice: item.promotionalPrice

// CERTO — mas só a partir de fonte confiável para promoção
promotionalPrice: item.promotionalPrice ?? null
```

O `?? null` **só** pode ser aplicado a partir da janela recente ou do `GetProdutosEAN`.
Aplicar no catálogo em massa apagaria promoção boa, porque ele serve preço velho (armadilha 1).

---

## Como o sync funciona hoje

```
de hora em hora   →  syncRecentFromERP(2h)      ~3 s    janela recente, confiável
                        └─ limpa promoção que saiu do ar
                        └─ grava PriceAuditLog: produto novo / preço / promoção

04:00 diário      →  syncFromERP()              ~190 s  catálogo completo
                        └─ NÃO mexe em promoção (preço velho)
                        └─ reconcilePromotions() confere 1 a 1 via GetProdutosEAN
```

| janela | resposta | tempo | produtos | promoções |
|---|---|---|---|---|
| 1 hora | 61 KB | 2,0 s | 97 | 18 |
| 24 horas | 74 KB | 2,0 s | 117 | 18 |
| catálogo completo | 10,5 MB | ~190 s | 15.798 | — |

Uma consulta de 1 hora já traz **todas** as promoções ativas.

### Variáveis de ambiente

| variável | default | o que faz |
|---|---|---|
| `ERP_SYNC_CRON_ENABLED` | `false` | liga os dois crons |
| `ERP_SYNC_INCREMENTAL_CRON` | `0 * * * *` | de hora em hora |
| `ERP_SYNC_INCREMENTAL_HOURS` | `2` | janela (folga sobre 1 h de propósito) |
| `ERP_SYNC_CRON` | `0 4 * * *` | catálogo completo |

### Endpoints manuais (admin)

```
POST /products/sync/incremental?hours=2   → janela recente + log de mudanças
POST /products/sync/promotions            → reconcilia promoções contra o ERP
POST /products/sync                       → catálogo completo
```

### Onde ver o que mudou

Tabela `price_audit_logs`. Ações: `NEW_PRODUCT`, `PRICE_CHANGED`, `PROMOTION_STARTED`,
`PROMOTION_CHANGED`, `PROMOTION_ENDED`. Campo `createdBy` distingue a origem
(`erp-sync` vs `erp-reconcile`).

---

## A instalação está atrás da documentação

Doc oficial: <https://crm.solidcon.com.br/docs/conexaodorsal> — o fornecedor mantém atualizada.
Ela descreve a **v1.0.71.0**; `45.239.193.56:5000` roda versão anterior.

| | doc (1.0.71.0) | nosso servidor |
|---|---|---|
| `GetProdutosAlterados` | `/{data}` path param | `?data=` query param |
| `ApenasAlterados` | existe | não existe (ignora) |
| `GetProdutosEAN` | não documentado | **existe** |
| `GetProdutosCadastro` | não documentado | **existe** |

Chamar a forma documentada dá **404** aqui. **Não "conserte" isso** sem confirmar que o
fornecedor atualizou o servidor.

> [!tip] Vale pedir a atualização
> `ApenasAlterados=true` faz a consulta filtrar só pela data de alteração do produto —
> resolveria a armadilha 2 na origem.

Não existe webhook nem push: só polling. Rate limit não documentado, nenhum 429 observado.

---

## Regra de ouro

**Para promoção, a ordem de confiança é:**

1. `GetProdutosEAN?EAN=` — bate com o PDV, é a verdade
2. `GetProdutosAlterados?data=` (janela curta) — confiável, barato
3. `GetProdutos?ativo=true` — **nunca** para promoção; serve catálogo, nome e estoque

Relacionado: [[_COMMUNITY_Backend Integrations]] · [[solidcom-erp.service.ts]] · [[products.service.ts]]
