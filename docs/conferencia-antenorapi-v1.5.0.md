# Conferência da AntenorApi v1.5.0

> **Em resposta a:** `retorno-integracao-antenorapi.md` (08/09/2026)
> **Método:** cada afirmação foi executada contra o banco de produção `10.13.0.2`, somente leitura.
> **Toda consulta usada está reproduzida aqui** — não confie na minha palavra, rode.

---

## Resumo

| | |
|---|---|
| ✅ | **O bloqueio do `tipoIntegracao` foi realmente resolvido.** Validado produto a produto: 14.885 casos, zero divergências. |
| ❌ | A fórmula do DAV está errada — bate em 1% dos pedidos. |
| ❌ | O exemplo do troco se contradiz, e o campo `vlTroco` nunca é preenchido. |
| ⚠️ | A API não responde em `10.13.0.2:3000` (connection refused). |
| ⚠️ | **A VPS de produção não tem rota até `10.13.0.2`** — decisão de arquitetura pendente. |
| ⚠️ | 1.370 produtos têm mais de um EAN; agrupar por produto quebra o scanner do separador. |

---

## 1. Confirmado — `tipoIntegracao` resolvido

A regra está correta. Rodei o `CASE` do relatório contra a API do Solidcom, produto a produto:

**14.885 produtos comparados · 14.885 iguais · 0 divergentes.**

As colunas existem e são `bit`, como descrito:

```sql
SELECT COLUMN_NAME, DATA_TYPE
FROM Solidcon.INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'tbProduto'
  AND COLUMN_NAME IN ('inNaoInternet', 'inInternet');
```

### Sobre a divergência de contagem

O relatório atribuiu a diferença (9.930 vs 9.935, 3.004 vs 3.350, 2.984 vs 2.773) a
"variação normal de novos cadastros". **Não é isso** — produto novo não faz `SEMPRE` cair 211.

A explicação real é a unidade de contagem: a API do Solidcom devolve **15.918 linhas** mas
**14.885 produtos distintos**, porque um produto pode ter vários EANs. Juntando por
`cdProduto` (e não `cdSuperProduto`), tudo bate:

```sql
-- distribuição pela regra, no banco inteiro
SELECT CASE
         WHEN ISNULL(inNaoInternet,0)=1 AND ISNULL(inInternet,0)=0 THEN 'NUNCA'
         ELSE CASE WHEN ISNULL(inNaoInternet,0)=0 AND ISNULL(inInternet,0)=0
                   THEN 'ESTOQUE' ELSE 'SEMPRE' END
       END AS tipo, COUNT(*) AS n
FROM Solidcon.dbo.tbProduto
GROUP BY CASE
         WHEN ISNULL(inNaoInternet,0)=1 AND ISNULL(inInternet,0)=0 THEN 'NUNCA'
         ELSE CASE WHEN ISNULL(inNaoInternet,0)=0 AND ISNULL(inInternet,0)=0
                   THEN 'ESTOQUE' ELSE 'SEMPRE' END END;
```

Isso vale registrar porque muda como se compara qualquer contagem daqui em diante:
**produto ≠ linha de catálogo.**

---

## 2. Corrigir — a fórmula do DAV

> No relatório: `nrSeqPAF = CAST(cdPedido AS INT) + 99998`

**Bate em 22 de 2.075 pedidos — 1%.** Existem **12 offsets diferentes**, um por faixa
histórica:

| offset | pedidos | faixa de `cdPedido` |
|---|---:|---|
| 29998 | 822 | 419 – 1240 |
| 69994 | 397 | 1348 – 1744 |
| 1 | 262 | 1 – 262 |
| 79992 | 188 | 1745 – 1932 |
| 19999 | 150 | 269 – 418 |
| 89991 | 88 | 1933 – 2020 |
| 39997 | 56 | 1241 – 1296 |
| 59995 | 50 | 1298 – 1347 |

Reproduza:

```sql
SELECT TOP 12
       TRY_CAST(nrSeqPAF AS BIGINT) - TRY_CAST(cdPedido AS BIGINT) AS offset,
       COUNT(*) AS pedidos,
       MIN(TRY_CAST(cdPedido AS BIGINT)) AS menor_cdPedido,
       MAX(TRY_CAST(cdPedido AS BIGINT)) AS maior_cdPedido
FROM DORSAL.dbo.tbPedido
WHERE TRY_CAST(nrSeqPAF AS BIGINT) IS NOT NULL
  AND TRY_CAST(cdPedido AS BIGINT) IS NOT NULL
GROUP BY TRY_CAST(nrSeqPAF AS BIGINT) - TRY_CAST(cdPedido AS BIGINT)
ORDER BY pedidos DESC;
```

**O que aconteceu:** olhando só os pedidos recentes, a relação parece linear — os 22 que
batem são o bloco atual. A generalização quebra quando o ERP troca de faixa.

**Este erro já ocorreu duas vezes antes neste projeto**, com `+99990` e com
`cdPedidoCarga`. Está documentado em `docs/solidcom-api.md`. Não é crítica ao seu trabalho
— é uma armadilha que o dado esconde de quem olha uma amostra recente.

**Correção:** manter apenas `MAX(CAST(nrSeqPAF AS INT)) + 1`, que o próprio relatório já
descreve. A fórmula linear é redundante e, no dia da virada de faixa, gera DAV duplicado —
e o operador não consegue puxar o pedido no PDV.

---

## 3. Corrigir — o exemplo do troco, e o campo `vlTroco`

O relatório afirma, em prosa:

> *"o cliente pagou R$ 26,63 em dinheiro para uma conta de R$ 21,63, gerando R$ 5,00 de troco"*

Mas o JSON do mesmo exemplo mostra `"troco": 0.00`. Fui ao banco — **o JSON está certo:**

```sql
SELECT m.cdModalidade, m.vlModalidade, m.vlTroco
FROM DORSAL.dbo.tbCupomModalidade m
JOIN DORSAL.dbo.tbCupom c ON c.gdCupom = m.gdCupom
WHERE c.nrCupom = 205424;
-- vlModalidade 26.63 · vlTroco 0
```

**O ERP não preenche `vlTroco`.** Quem precisar do troco tem que calcular
(`vlModalidade` − valor do cupom). Se a API expuser `vlTroco` cru, o campo será sempre zero
e ninguém vai notar — mesma família do `inCancelado`, que também é sempre nulo.

### Bônus: `nrCupom` não é único

Ao consultar por `nrCupom = 205424`, vieram **duas linhas de `gdCupom` diferentes**. O
relatório já usa `gdCupom` para juntar, o que está correto — só vale registrar por que
essa escolha importa: juntar por `nrCupom` misturaria cupons de caixas ou dias diferentes.

---

## 4. Bloqueio prático — a API não responde

```
10.13.0.2:3000  → connection refused
10.13.0.2:5000  → aberta (Solidcom)
10.13.0.2:1433  → aberta (SQL Server)
```

`Connection refused` significa que **nada está escutando** na porta — firewall daria timeout.
Provavelmente o serviço está bindado em `127.0.0.1:3000` em vez de `0.0.0.0:3000`, ou não
está rodando no momento.

---

## 5. Decisão de arquitetura pendente — a rota

Este é o ponto mais importante, e não aparece no relatório.

**O backend do e-commerce roda numa VPS (Hostinger), e a VPS não tem rota até
`10.13.0.2`.** Isso foi testado e é exatamente o motivo de existir hoje um agente rodando
num PC dentro da loja: ele consulta o banco localmente e empurra o resultado para a API na
nuvem.

Uma API que só responde na rede da loja não resolve isso — ela troca um agente por um
problema de rede. Três caminhos:

1. **Túnel/VPN** entre a VPS e a loja, com a API acessível só por dentro dele.
2. **Publicar a API** com IP fixo, TLS e autenticação — vira superfície exposta à internet,
   precisa de cuidado real.
3. **Manter um agente na loja** que fala com a AntenorApi localmente e empurra os eventos
   para fora. Menos elegante, mas é o modelo que já funciona hoje.

Sem escolher um desses, nenhum endpoint pode ser migrado.

---

## 6. Risco — EANs secundários

**1.370 produtos ativos têm mais de um EAN.** Um deles tem 33.

```sql
SELECT eans_por_produto, COUNT(*) AS produtos FROM (
  SELECT cdSuperProduto, COUNT(*) AS eans_por_produto
  FROM Solidcon.dbo.tbProduto WHERE inAtivo = 1
  GROUP BY cdSuperProduto
) t GROUP BY eans_por_produto ORDER BY eans_por_produto;
```

| EANs por produto | Produtos |
|---:|---:|
| 1 | 10.801 |
| 2 | 613 |
| 3 | 272 |
| 4 | 170 |
| 5 | 112 |
| 6 ou mais | 202 |

**Por que importa:** o app de separação permite bipar o código de barras do produto, e o
backend resolve embalagens alternativas por `secondaryEans`. Se o catálogo devolver um
produto agrupado com um único EAN, bipar a embalagem secundária deixa de funcionar — e o
separador não vai saber por quê.

O `"total": 14885` do exemplo de resposta sugere que o agrupamento já acontece. Vale
confirmar se a lista de EANs alternativos vem junto (por exemplo, num array `eans[]`).

---

## Sugestão de ordem

1. **Decidir a rota** (item 5) — nada pode ser migrado antes disso.
2. **Tirar a fórmula do DAV** (item 2) — é o que causa dano silencioso em produção.
3. **Expor a API** para fora do localhost (item 4).
4. **Conferir os EANs alternativos** no catálogo (item 6).
5. **Calcular o troco** em vez de expor `vlTroco` (item 3).

O item 1 do relatório — o `tipoIntegracao` — está fechado e não precisa de mais nada.
Era o único bloqueio real do plano, e resolvê-lo por engenharia reversa da DLL foi o
caminho certo.

---

Conferido em 08/09/2026 contra o banco de produção, somente leitura. Nenhuma escrita foi
feita em `Solidcon` ou `DORSAL`.
