# O que o checksum revela

> **Em resposta a:** `resumo-pre-tunel-aprovado.md` (08/09/2026)
> **Status:** auditoria confirmada em 3 de 4 pontos. O quarto revelou algo que muda o
> entendimento — e não é problema, mas precisa ser sabido antes do deploy.

---

## 1 · A chave nova veio em texto puro de novo

O documento que anuncia a rotação das chaves antigas **contém a chave nova na íntegra**:

```
ANTENOR_API_KEY=ant_live_nr_ecom_5848…
```

Ele até mascara em um trecho (`ant_live_nr_ecom_****`) e mostra completa três linhas abaixo,
no bloco do `.env`.

O arquivo foi adicionado ao `.gitignore` do nosso lado, junto com o anterior — o conteúdo
técnico fica preservado, só não entra no repositório.

**Esta é a terceira chave a viver em disco sem proteção.** O problema não é a chave: é o
canal. Enquanto a credencial viajar dentro de documento, toda rotação nasce queimada.

**Sugestão prática:** a chave definitiva não precisa ser escrita em lugar nenhum deste fluxo.
Basta ser colocada diretamente no `.env` do servidor de vocês e no `.env` da VPS. Nós
confirmamos que funcionou pelo comportamento — se a chave estiver certa, a API responde; se
estiver errada, `401`. Não precisamos vê-la.

---

## 2 · A auditoria está confirmada — 3 de 4

Verifiquei cada afirmação no banco:

| Verificação | Resultado |
|---|---|
| `tbEtiquetaPedidoParaImprimir` vazia | ✅ 0 registros |
| `tbResumoPedidoParaImprimir` vazia | ✅ 0 registros |
| `tbPedidoJanelaEntrega` vazia | ✅ 0 registros |
| `tbEtiquetaPedidoSeparacaoParaImprimir` com 6 legados | ✅ 6 registros |
| As 5 triggers existem, ativas, com os eventos descritos | ✅ confirmado |

O levantamento das triggers foi bem feito — inclusive notar que `tgAlteraLinhaPedido` dispara
em `INSERT` e `UPDATE`, e as de `DELETE` gravam em `tbPafR99`.

---

## 3 · O checksum não é `-2` — e isso muda o entendimento

Aqui está a correção. O primeiro relatório dizia:

> *"`checksum` em `tbPedidoItem`: fixo `-2` (exigência de integridade do ERP Dorsal)."*

**Não é fixo, e não é exigência.** Dos 15.595 itens da tabela, apenas **70 têm `-2`**. Os
demais carregam valores variados entre `-1` e `4769`.

### O que a trigger realmente faz

```sql
CREATE TRIGGER [dbo].[tgAlteraLinhaPedidoItem] ON [dbo].[tbPedidoItem]
AFTER UPDATE, INSERT AS BEGIN
  DECLARE @PROGRAMA as char(4)
  DECLARE @CheckSum as int
  select @CheckSum = CASE WHEN Count(*) > 0 THEN -1 ELSE -2 END from deleted
  SELECT @PROGRAMA = upper(substring(PROGRAM_NAME,1,4))
    FROM SYS.SYSPROCESSES WHERE SPID = @@SPID
  if @PROGRAMA <> '.NET'
     update tbPedidoItem set checksum = @CheckSum ...
END
```

A linha que importa é esta:

```sql
if @PROGRAMA <> '.NET'
```

**A trigger só age quando a gravação NÃO vem de um programa .NET.** Ela lê o
`PROGRAM_NAME` da conexão SQL e, se não for a aplicação oficial, sobrescreve o checksum com
`-2` (insert) ou `-1` (update).

Ou seja: **`-2` não é um valor a ser gravado. É a marca que o ERP aplica quando detecta
gravação de fora do sistema homologado.** É um carimbo de origem, não um requisito de
formato.

### A prova nos dados

Os 70 itens com `-2` são **exatamente os pedidos do nosso e-commerce**:

| cdPedido | DAV | Itens marcados | Data |
|---|---|---|---|
| 2075 | 102073 | 4 | 07/09/2026 |
| 2074 | 102072 | 4 | 07/09/2026 |
| 2035 | 102025 | 1 | 18/08/2026 |
| 2030 | 102020 | 6 | 18/08/2026 |
| 2028 | 102018 | 19 | 18/08/2026 |
| … | | | |

Nenhum pedido de balcão aparece na lista. Os pedidos gravados pelo PDV têm checksum
calculado (1558, 1575, 1586…).

---

## 4 · O que isso significa para a migração

### A notícia boa: não há regressão

**Isso já acontece hoje**, com a API oficial do Solidcom. A conexão dela ao SQL Server
também não se identifica como `.NET`, então todo pedido do e-commerce já nasce marcado.
A AntenorApi produz exatamente o mesmo efeito — não piora nada.

### O ajuste no código

**Não gravem `-2` manualmente.** É redundante: a trigger sobrescreve de qualquer forma. Pior,
passa a impressão de que o valor é escolhido, quando na verdade é imposto pelo banco. Deixem
o campo de fora do `INSERT` e a trigger resolve.

### A pergunta que fica em aberto

O ERP marca deliberadamente as gravações externas, e o `-1`/`-2` alimenta a
`tbPafR99` no caminho de `DELETE` — nomenclatura de **PAF-ECF**, a norma fiscal de automação
comercial.

**Vale confirmar com a Solidcom o que essa marcação significa na prática.** Não é uma
acusação e provavelmente não é problema — o e-commerce já opera assim há meses, com a API
oficial deles. Mas é o tipo de detalhe que ninguém quer descobrir numa fiscalização, e a
pergunta custa um e-mail:

> *"Pedidos gravados por integração externa ficam com `checksum = -2` na `tbPedidoItem`.
> Isso tem alguma implicação fiscal ou de auditoria PAF-ECF? Existe forma homologada de
> integração que evite essa marcação?"*

**O que não recomendamos:** fazer a conexão da AntenorApi se identificar como `.NET` para
escapar da trigger. Tecnicamente é trivial — basta mudar o `Application Name` na string de
conexão. Mas seria contornar um controle de auditoria do sistema fiscal, e a economia não
compensa o risco.

---

## 5 · Checklist atualizado

| | |
|---|---|
| ✅ | Chaves antigas rotacionadas |
| ✅ | Chave master retida, e-commerce recebe só a Loja 1 |
| ✅ | Efeitos colaterais do `GravaPedido` auditados |
| ✅ | Convivência de 1 semana acordada |
| ⚠️ | **Rotacionar a chave nova** — vazou no documento de aprovação |
| ⚠️ | **Remover o `checksum` do INSERT** — a trigger sobrescreve |
| ⚠️ | **Perguntar à Solidcom** sobre a marcação de gravação externa |
| ⏳ | Subir o `cloudflared` com os dois hostnames |
| ⏳ | Fechar o port forwarding da porta 5000 |

Os três primeiros itens de atenção são pequenos. Nenhum bloqueia o deploy — mas os dois
primeiros deveriam ser resolvidos antes dele.

---

Verificado em 08/09/2026 contra o banco de produção, somente leitura.
