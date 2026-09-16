# Tréplica: a rota já existe — e é isso que muda a decisão

> **Em resposta a:** `replica-conferencia-antenorapi.md` (08/09/2026)
> **Decisão pedida:** qual opção de conectividade adotar
> **Resposta curta:** **Opção A (Cloudflare Tunnel)** — por motivos que não estavam na mesa.

---

## Antes de tudo: as correções foram verificadas

| Item | Verificação |
|---|---|
| Fórmula do DAV removida | ✅ a abordagem `MAX + 1` com `UPDLOCK, HOLDLOCK` é a correta |
| Troco calculado | ✅ `DORSAL.dbo.tbCupom.vlCupom` existe (`money`) — o cálculo se sustenta |
| EANs alternativos | ✅ `Solidcon.dbo.tbProdutoVenda` existe, 17.129 linhas, com `cdEAN` |
| Catálogo sem agrupar | ✅ manter as 15.918 linhas é o comportamento certo |

Sobre o item dos EANs: **`tbProdutoVenda` é a tabela certa, e é melhor do que a que eu usei.**
Eu tinha contado EANs por `tbProduto.cdProduto`; a resolução reversa por `cdEAN` cobre mais
casos. Boa correção.

---

## A correção que eu preciso fazer

No documento anterior eu escrevi:

> *"A VPS de produção não tem rota até `10.13.0.2`."*

Isso estava **impreciso**, e a imprecisão importa para a decisão.

O correto: a VPS não alcança o IP **privado** `10.13.0.2`. Mas ela alcança a loja todo dia,
pelo **IP público**:

```
SOLIDCOM_API_URL = http://45.239.193.56:5000
```

Testado agora, a partir da VPS de produção:

```
porta 5000 (Solidcom)   → ABERTA · HTTP 200 · 10.591.489 bytes em 15,3 s
porta 3000 (AntenorApi) → fechada
```

**A rota já existe.** O que falta não é conectividade — é uma rota *segura*. E isso muda o
peso das três opções.

---

## Por que Opção A, e não B

### 1. Hoje o ERP está aberto na internet, sem TLS e sem autenticação

`http://45.239.193.56:5000` responde a qualquer um. Baixei o catálogo completo — 10,5 MB,
15.918 produtos com preço, custo, estoque e classificação — sem apresentar nenhuma
credencial. O mesmo endereço expõe o `PostPedido`, que **grava** pedido na retaguarda.

O túnel não é só conveniência de arquitetura. Ele **fecha um buraco que já existe hoje**, e
que existirá enquanto a porta 5000 estiver publicada.

### 2. O IP é de provedor de fibra, não de datacenter

`45.239.193.56` resolve para `45-239-193-56.speedfiber.psi.br`. Se esse endereço for
dinâmico, a integração quebra sozinha no dia em que ele mudar — e o sintoma será *"os
produtos pararam de atualizar"*, sem ninguém ligar à causa por horas.

O túnel elimina a dependência de IP fixo por completo: o `cloudflared` inicia a conexão de
dentro para fora e o nome (`api-erp.antenorefilhos.com.br`) continua valendo.

**Vale confirmar com o provedor se o IP é fixo.** Se for dinâmico, isso deixa de ser
preferência e vira urgência — inclusive para a integração atual.

### 3. O checkout precisa do DAV de forma síncrona

Esse é o argumento funcional, e é o que descarta a Opção B.

Hoje o cliente confirma o pedido e o DAV volta na mesma requisição. Esse número é o que o
separador digita no PDV — sem ele, o app de separação mostra *"sem DAV"* e cai no id interno,
que tem letra e **o PDV não aceita**.

Com a Opção B o pedido nasceria sem DAV e ganharia o número depois, por push. Entre um
momento e outro, o pedido existe e não pode ser aberto no caixa. É uma regressão real de
operação, não um detalhe de latência.

### 4. A Opção B não elimina o agente — só o renomeia

Continua havendo um processo na loja fazendo polling e empurrando resultado para a nuvem. É
exatamente a arquitetura de hoje, com outro nome. Se o objetivo é simplificar, A entrega
isso e B não.

Isso não é demérito: **a Opção B funciona**, e é o modelo que roda em produção agora. Se o
Cloudflare Tunnel não for aprovado, B é um plano B legítimo — só não resolve o item 3.

---

## Recomendação, com duas condições

**Ir de Opção A**, e tratar duas coisas junto:

1. **Passar o Solidcom para trás do mesmo túnel.** Não faz sentido proteger a API nova com
   `x-api-key` e TLS enquanto a antiga continua aberta no mesmo servidor. Enquanto as duas
   coexistirem na migração, as duas precisam do mesmo tratamento.

2. **Fechar a porta 5000 do IP público** quando a migração terminar. Hoje ela é a única via;
   depois do túnel, vira só superfície exposta sem uso.

---

## O que muda no nosso lado

Pouca coisa, e isso é bom sinal:

- `SOLIDCOM_API_URL` passa a apontar para o nome do túnel.
- Entra uma variável nova com a `x-api-key`, obrigatória no boot (o projeto já trata
  identificador de integração assim — sem default, estoura na inicialização se faltar, para
  não sincronizar contra o lugar errado em silêncio).
- O agente de faturamento que roda na loja hoje **deixa de ser necessário** quando o
  `status-pdv` e o `faturados-recentes` estiverem no ar pelo túnel.

Sobre esse último ponto: o agente **já está pronto e validado** contra o `DORSAL` — lê
`hrRegistro`, concilia com a fila de pedidos e libera para entrega. Se por qualquer motivo o
túnel demorar, ele cobre o intervalo. Quando a AntenorApi estiver acessível, ele é
aposentado, ou reapontado para consumir a API em vez do SQL direto.

---

Verificado em 08/09/2026 a partir da VPS de produção e do banco, somente leitura.
