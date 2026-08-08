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

## Em aberto

- Semântica real do `data=` (aguardando documentação oficial).
- Existe webhook/push? Eliminaria o polling.
- Existe rate limit? Hoje são ~31 chamadas por sync.
- `GetProdutosCadastro` ainda não integrado — é o caminho para detectar produto novo.
