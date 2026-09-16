# Mapa da Integração Solidcom

> Tudo que o e-commerce da Antenor & Filhos consome do ERP hoje, o que disso o banco
> `DORSAL` cobre, e os três furos que uma API própria teria a chance de fechar.

**Levantado em 07/09/2026** · Banco: SQL Server `10.13.0.2` · `DORSAL` · 239 tabelas
· Verificado contra dados de produção.

Cada afirmação aqui foi conferida contra o banco e a API reais, não contra documentação.
Onde algo é suposição, está dito. Onde algo foi provado ausente, também.

| | |
|---|---|
| **12** | pontos de integração no total |
| **8** | expostos como endpoint hoje |
| **1** | só acessível por SQL direto |
| **3** | não existem de forma alguma |

---

## Os 12 pontos de integração

Os oito primeiros são chamadas HTTP que o backend já faz. Os quatro últimos são a parte
que hoje falta ou é contornada por fora.

| # | Ponto | Para quê | Frequência | Hoje |
|---|---|---|---|---|
| 1 | `GetProdutos` | Catálogo completo | 4× ao dia | endpoint |
| 2 | `GetProdutosAlterados` | Só o que mudou desde a última leitura | De hora em hora | endpoint |
| 3 | `GetProdutosEAN` | Reconciliação de um EAN específico | Sob demanda | endpoint |
| 4 | `GetCampanhasAtivas` | Promoções vigentes | Periódico | endpoint |
| 5 | `PostPedido` | Envia o pedido e recebe o DAV de volta | A cada pedido | endpoint |
| 6 | `GetPedido` | Consulta um pedido pelo número | Sob demanda | endpoint |
| 7 | `GetPedidoPeriodo` | Pedidos de um intervalo | Relatório | endpoint |
| 8 | `PutCancelamentoPedido` | Cancela um pedido no ERP | A cada cancelamento | **quebrado** |
| 9 | `hrRegistro` | **Venda fechada no PDV** — libera a entrega | A cada 60 s | **só por SQL** |
| 10 | `tbCupomModalidade` | **O que foi realmente cobrado** | — | **não existe** |
| 11 | `tbCupomCancelado` | **Venda cancelada depois de fechada** | — | **não existe** |
| 12 | `tipoIntegracao` | Decide o que aparece na loja | Junto do catálogo | **fora do banco** |

---

## O bloqueio do plano

### O campo que decide a vitrine não está no banco

`tipoIntegracao` vale `SEMPRE`, `ESTOQUE` ou `NUNCA`, e é ele que determina se um produto
aparece na loja. A API do Solidcom devolve esse campo; **o banco DORSAL não o tem.**

Duas verificações independentes:

- Varredura das **316 colunas de texto** de todas as tabelas base — nenhuma carrega esses valores.
- Comparação de **nove produtos** (três de cada tipo) contra as **74 colunas** de
  `tbSuperProduto` — nenhuma separa os três grupos.

A única candidata pelo nome, `EcommerceVendaExterna`, é `bit` e está nula nos 15.135 produtos.

**Por que isso é bloqueante:** cerca de 82% do catálogo tem estoque zero. Sem esse campo,
uma API que leia só o DORSAL publica uma loja praticamente vazia — os 2.984 produtos
marcados como `SEMPRE` são justamente os que vendem com estoque negativo (padaria, açougue,
hortifrúti de produção própria).

**Investigar antes de começar:** se o campo vem de outro banco da Solidcom, de uma tabela de
configuração fora do padrão de nomes, ou é calculado na aplicação deles. Enquanto não se
souber, o item 12 é premissa não resolvida.

| tipoIntegracao | Produtos | Significado |
|---|---|---|
| `SEMPRE` | 2.984 | Sempre vendável, ignora o estoque |
| `ESTOQUE` | 9.930 | Vendável enquanto o saldo for positivo |
| `NUNCA` | 3.004 | Nunca aparece na loja |

---

## Contrato de produto

O que o sistema espera receber por produto, e de onde cada campo sairia no banco. As linhas
**confirmadas** foram conferidas item a item contra o produto `CHUCHU kg`
(`cdSuperProduto 6053`).

| Campo esperado | Origem no DORSAL | Situação |
|---|---|---|
| `ean` | `tbProduto.cdProduto` | mapeado |
| `erpProductId` | `tbSuperProduto.cdSuperProduto` | mapeado |
| `name` | `tbSuperProduto.nmProduto` | **confirmado** |
| `price` | `tbSuperProduto.vlVenda` | **confirmado** |
| `promotionalPrice` | `vlVenda` × `vlVendaOriginal` | a validar |
| `stock` | `tbEstoque.qtItem` | mapeado |
| `unit` | `tbSuperProduto.cdUnidade` | **confirmado** |
| `fractionStep` | `EcommerceFatorFracionado` | **confirmado** |
| `isFractional` | `EcommerceFatorFracionado > 0` | derivado |
| `active` | `tbSuperProduto.inAtivo` | **confirmado** |
| `classification01..04` | `tbSuperProduto.cdSecao` + hierarquia | a validar |
| `syncOption` | — | **não existe** |

### O que a API atual devolve, para referência

```json
{
  "id_produto": 6643,          "codigo_ean": 134,
  "produto": "ABACATE kg",     "ativo": true,
  "vl_produto": 6.99,          "vl_produto_normal": 6.99,
  "qtd_produto": 111.219,      "emb": "KG",
  "fracionado": true,          "fracionamento": 0.1,
  "classificacao01": "08-FLV", "classificacao02": "01-FRUTAS",
  "classificacao03": "01-FRESCAS",
  "tipoIntegracao": "SEMPRE"   // <- o campo ausente no banco
}
```

---

## Contrato de pedido

O que o sistema envia ao criar um pedido. A resposta precisa devolver o **DAV** — é o número
que o separador digita no PDV para puxar o pedido; sem ele o pedido existe no ERP mas ninguém
consegue abri-lo no caixa.

```
{
  cnpj, numero, data, codEcom, dav,
  valorFrete, valorDesconto,
  retiraNaLoja, ecommerceSolidcon, ecommerceSolidconStatus,
  obs,           // nunca null — ver armadilhas
  cep,           // só dígitos, máx. 8
  hrCombinada,   // sem isso o pedido fica sem previsão na tela deles
  referencia,
  itens: [{ numero, ean, cdProduto, inCodigoInterno, nmProduto,
            quantidade, quantidadeAtendida, valorUnitario, valorDesconto }],
  cliente: { cpf, nome, telefone,
             endereco: { logradouro, numero, complemento,
                         bairro, cidade, cep, estado } }  // nunca null
}
```

---

## Os três furos que hoje ninguém cobre

Não são melhorias de escopo — são lacunas que já existem em produção. O banco tem os dados;
falta quem os exponha.

### 10 · O que foi realmente cobrado

A forma de pagamento escolhida na loja **não é fonte de verdade**. No pedido DAV 102028 o
cliente escolheu PIX e a venda fechou em dinheiro — quem decide é o operador do caixa.
Qualquer relatório financeiro do e-commerce diverge do caixa real.

Dados disponíveis e não consumidos: `tbCupom`, `tbCupomModalidade`, `tbCupomItem`,
`tbCupomDesconto`.

### 11 · Venda cancelada depois de fechada

Se o operador cancelar o cupom depois que o pedido já foi liberado para entrega, o sistema não
fica sabendo. O entregador sai com mercadoria de uma venda que não existe mais.
**É risco operacional, não contábil.**

Dados disponíveis e não consumidos: `tbCupomCancelado`, `tbCupomItemCancelado`.

### 9 · Venda fechada

O sinal é `tbPedido.hrRegistro`, preenchido no fechamento em qualquer caminho. Como a API não
expõe, hoje existe um agente rodando num PC dentro da loja fazendo consulta a cada 60 segundos
— a VPS de produção não tem rota até `10.13.0.2`.

> **O padrão por trás dos três**
>
> Todos são **eventos que acontecem no PDV e que ninguém nos conta**. A API atual é inteiramente
> de consulta: nós perguntamos, eles respondem. É por isso que existe um agente fazendo polling
> dentro da loja. Uma API com webhooks de saída (*venda fechada*, *venda cancelada*) resolve os
> três de uma vez e elimina o agente.

---

## Armadilhas conhecidas

Cada uma custou tempo de investigação. Todas verificadas em produção.

### `inCancelado` nunca vale zero

A coluna é `bit` e significa "pedido cancelado", mas o ERP nunca grava `0`: são **1.929 linhas
nulas e 144 com `1`**. Como `NULL = 0` é desconhecido em SQL e não falso, um filtro escrito
como `inCancelado = 0` nunca casa nada — e falha em silêncio, sem erro nenhum.

Use `ISNULL(inCancelado, 0) = 0`.

### `PostPedido` estoura com campo de texto nulo

`GravaPedido` chama `.Length` em `obs` e nos campos de `cliente.endereco` sem checar nulo.
Mandar `null` derruba o endpoint com `400 "Object reference not set to an instance of an
object"` — que é `NullReferenceException` vazando, não erro de validação. String vazia passa.

O swagger deles marca os dois como opcionais; **não confie nisso.**

### O cancelamento não funciona

`PutCancelamentoPedido` recebe `cdPedido` como `int32`, mas o número gerado tem 12 dígitos e
estoura o limite. Resultado: `400 "The value 'X' is not valid"`. Nenhum pedido foi cancelado
no ERP por esse caminho até hoje.

### Nem todo endpoint traz os mesmos campos

Só `GetProdutos` devolve `tipoIntegracao`. `GetProdutosAlterados` e `GetProdutosEAN` retornam
a mesma lista de campos *menos* esse. Enquanto o código tratou "ausente" como `ESTOQUE`, cada
sincronização horária rebaixava o valor que a diária tinha gravado certo — 22 produtos sumiam
da vitrine e voltavam sozinhos.

### `hrRegistro` não é absoluto

Sobre as 2.073 linhas de `tbPedido`, 1.861 têm `hrRegistro`, e há **5 com COO e sem
`hrRegistro`** — todos de 2023/2024, sem `nrCupom`, cancelados ou legados. O sinal vale para o
fluxo atual, mas a afirmação "100% dos fechados" veio de uma amostra pequena e não se sustenta
no histórico.

---

## Antes de começar

- **Resolver o item 12.** Sem saber de onde vem `tipoIntegracao`, não há como publicar
  catálogo. É a única premissa não resolvida do plano.
- **Decidir o que fazer com a API pública que já existe.** O backend já expõe `/v1/orders`,
  `/v1/products`, `/v1/stock` e um sistema de webhooks com replay. A API nova substitui essa
  camada ou convive com ela? Se ninguém decidir, nascem duas APIs falando de pedido.
- **Preferir webhooks a polling** para os itens 9, 10 e 11 — é o que dispensa o agente dentro
  da loja.
- **Apagar dois stubs mortos** em `solidcom-erp.service.ts`: `getProductStock` retorna `0` fixo
  e `updateProductPrice` não faz nada. Ninguém chama hoje, mas quem chamar `getProductStock`
  acreditando no nome recebe zero sem aviso.

---

Levantado a partir do código em `sistema/backend/src/modules/integrations/` e de consultas
somente-leitura ao banco DORSAL em 07/09/2026. Números de produção conferidos na data; o
catálogo muda, as armadilhas não.
