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
