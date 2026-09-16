# Antes de ligar o túnel

> **Em resposta a:** `retorno-treplica-cloudflare-tunnel.md` (08/09/2026)
> **Status:** plano aprovado, arquitetura sem objeção — **com uma pendência de segurança que
> precisa ser resolvida antes do deploy.**

---

## 1 · As chaves de produção estão em texto puro

O documento traz as duas chaves na íntegra:

- `ant_live_nr_ecom_...` — produção da Nova Real
- `ant_live_master_adm_...` — **master, com acesso às três lojas**

Elas estão em `docs/retorno-treplica-cloudflare-tunnel.md` e no `.html` equivalente. **Essa
pasta não é ignorada pelo git.** Os arquivos ainda não foram commitados, então dá tempo — mas
um `git add docs/` distraído publica as duas no repositório.

A regra número um deste projeto é exatamente essa:

> *"Zero segredos no repo. Nada de credencial, token, CPF ou CNPJ commitado."*
> — `CLAUDE.md`

### O que pedimos

**a) Rotacionar as duas chaves antes do túnel entrar no ar.** Elas já trafegaram por chat e
estão em disco em texto puro, em pelo menos duas máquinas. Rotacionar agora custa um comando;
depois de vazar, custa outra coisa. As chaves atuais devem ser tratadas como queimadas.

**b) Não enviar a chave master para o e-commerce.** Nosso backend opera **apenas a Nova Real
(loja 1)**. Uma credencial que abre as três lojas na VPS multiplica o estrago de um eventual
comprometimento sem entregar nenhuma capacidade que a aplicação use. Queremos só a chave
escopada da loja 1.

**c) Entregar a chave definitiva por canal fora deste fluxo de documentos** — ela vai para o
`.env` do servidor, que é gitignored, e para o `environment:` do compose. Não precisa passar
por arquivo nenhum.

### Como ela será tratada do nosso lado

A chave entra como variável obrigatória, sem valor padrão. O projeto já trata identificador de
integração assim (`requireEnv()`): **se faltar, a API não sobe.** É deliberado — a família de
bug mais cara desta base é configuração que parece existir e não existe, e um fallback
silencioso já fez o sistema sincronizar contra o lugar errado sem ninguém notar.

---

## 2 · O plano técnico está aprovado

Sem objeções. Três observações menores, nenhuma bloqueante.

### O `config.yml` está correto

Inclusive a regra final `- service: http_status:404`. Sem ela o `cloudflared` recusa a
configuração — vale registrar porque é o erro mais comum de quem monta o primeiro túnel.

### Sobre desligar o agente local

Concordamos que ele sai — mas sugerimos **uma semana de convivência**, não apenas os dias de
homologação.

O agente lê o banco diretamente. Se o túnel oscilar nos primeiros dias, ele continua liberando
os pedidos e a operação não para. O custo de mantê-lo ligado é praticamente zero: ele só abre
conexão com o SQL quando há pedido aguardando o caixa.

Desligamos quando houver histórico de estabilidade, não quando o primeiro teste passar.

### Uma pergunta sobre o `PostPedido`

Quando a gravação de pedido migrar para a AntenorApi, quem escreve em `tbPedido` e
`tbPedidoItem` passa a ser a API nova.

**Vale confirmar se o `GravaPedido` original faz mais alguma coisa além de inserir nas duas
tabelas** — trigger, fila de impressão de etiqueta, notificação para a tela do PDV, gravação
em tabela de apoio.

Existem tabelas no `DORSAL` que sugerem etapas paralelas:
`tbEtiquetaPedidoParaImprimir`, `tbEtiquetaPedidoSeparacaoParaImprimir`,
`tbResumoPedidoParaImprimir`, `tbPedidoJanelaEntrega`.

Se alguma delas for populada pelo fluxo original, escrever direto pula a etapa — e o pedido
aparece diferente na retaguarda, provavelmente sem ninguém entender por quê. A verificação é
barata: inserir um pedido pelos dois caminhos e comparar o que mudou no banco.

---

## 3 · Checklist antes do deploy

| | |
|---|---|
| ☐ | Rotacionar as duas chaves expostas |
| ☐ | Gerar chave escopada só para a loja 1 (sem master) |
| ☐ | Entregar a chave por canal fora de documento |
| ☐ | Subir o túnel com os dois hostnames (AntenorApi + Solidcon legado) |
| ☐ | Confirmar `x-api-key` obrigatória, com `401` sem ela |
| ☐ | Fechar o port forwarding da porta 5000 no roteador |
| ☐ | Verificar se o `GravaPedido` original tem efeitos colaterais |
| ☐ | Manter o agente local por uma semana após o corte |

---

## 4 · O que muda no nosso lado depois disso

- `SOLIDCOM_API_URL` aponta para o hostname do túnel.
- Entra a variável da `x-api-key`, obrigatória no boot.
- O agente de faturamento é aposentado — ou reapontado para consumir
  `GET /api/integracao/pedidos/faturados-recentes` em vez de ler o SQL direto, o que
  mantém a redundância sem duplicar lógica.

O restante do backend não muda: os contratos de produto e pedido continuam os mesmos, e a
AntenorApi já foi construída retrocompatível.

---

Verificado em 08/09/2026. Nenhuma chave foi commitada até esta data — a janela para rotacionar
sem incidente ainda está aberta.
