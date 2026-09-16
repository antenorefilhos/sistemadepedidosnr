# Ambiente de desenvolvimento: onde estamos e o que falta organizar

> **Para:** equipe da AntenorApi
> **Data:** 08/09/2026
> **Assunto:** alinhamento de arquitetura, e o que precisa mudar para começarmos a testar

---

## 1 · A arquitetura, esclarecida

Houve uma confusão da nossa parte que vale corrigir logo: nós tratamos a conectividade
VPS ↔ loja como bloqueio imediato. **Não é.** A arquitetura combinada é esta:

```
┌─────────────────────────┐         ┌──────────────────────────────────┐
│  VPS Hostinger          │         │  Servidor da loja  10.13.0.2     │
│                         │         │                                  │
│  E-commerce             │         │  SQL Server (Solidcon + DORSAL)  │
│  Admin                  │         │  AntenorApi (em desenvolvimento) │
│  App de separação       │         │  API Solidcon (legado)           │
│  App de entrega         │         │                                  │
└─────────────────────────┘         └──────────────────────────────────┘
            ▲                                        ▲
            │                                        │
            │            ┌──────────────┐            │
            └────────────│  PC do       │────────────┘
                         │  Jonathan    │   WireGuard
                         │  (ponte)     │   (VPN da empresa)
                         └──────────────┘
```

**Enquanto a API está em desenvolvimento**, ela não precisa ser alcançável pela VPS. Nós
testamos pelo túnel WireGuard, através do PC do Jonathan — que é como já acessamos o banco.

**Quando a API for para produção**, aí sim a VPS precisa alcançá-la. Essa decisão fica para
depois e não bloqueia nada agora.

| | Agora (desenvolvimento) | Depois (produção) |
|---|---|---|
| Quem chama a API | nós, pelo túnel | a VPS |
| O que é preciso | API escutando na rede local | conectividade VPS ↔ loja |
| Bloqueio | **um só, abaixo** | a decidir, sem pressa |

### Sobre o Cloudflare Tunnel

O plano de usar `api-erp.antenorefilhos.com.br` via Cloudflare **não é viável como está**: o
Cloudflare Tunnel exige que o domínio tenha o DNS na Cloudflare, e
`antenorefilhos.com.br` está na Hostinger (`ns1/ns2.dns-parking.com`). O domínio também
atende outro site da empresa, então migrar o DNS não é uma opção.

**Alternativa mais simples, para quando chegar a hora:** estender o WireGuard que já existe
e já é operado por vocês. A VPS vira mais um peer, como o PC do Jonathan
(`192.168.3.2/32`). Não toca em DNS, não precisa de domínio, e ninguém aprende ferramenta
nova. Fica registrado para a conversa de produção.

---

## 2 · O único bloqueio de hoje

**A AntenorApi está escutando em `localhost:3000`.**

Foi o que encontramos ao testar pelo túnel:

```
10.13.0.2:3000  → connection refused
10.13.0.2:5000  → aberta (API Solidcon legada)
10.13.0.2:1433  → aberta (SQL Server)
```

`Connection refused` significa que o processo não aceita conexão daquela origem — firewall
daria timeout. Uma API em `localhost` só responde de dentro do próprio servidor.

### O que pedimos

**a) Subir escutando em `0.0.0.0:3000`.** Normalmente é uma linha:

```js
app.listen(3000, '0.0.0.0')   // em vez de app.listen(3000)
```

**b) Liberar a porta 3000 no firewall do Windows Server**, apenas para a rede interna:

```powershell
New-NetFirewallRule -DisplayName "AntenorApi (rede interna)" `
  -Direction Inbound -LocalPort 3000 -Protocol TCP `
  -RemoteAddress LocalSubnet,192.168.3.0/24 -Action Allow
```

A faixa `192.168.3.0/24` é a da VPN — é por ela que entramos.

**c) Confirmar que sobe como serviço**, para não cair quando a sessão do usuário encerrar.

Com isso feito, começamos a testar imediatamente.

---

## 3 · O que faremos assim que a API estiver acessível

1. **Testar cada endpoint** — catálogo, busca por EAN, criação de pedido, status no PDV.
2. **Comparar com o Solidcon produto a produto.** Já fizemos isso com a regra do
   `tipoIntegracao` (14.885 comparações, zero divergências). Repetiremos com preço, estoque,
   fracionamento e classificação — é o que pega diferença de campo antes de virar bug na
   vitrine.
3. **Preparar o backend com chave de troca**, para o corte ser mudar uma linha no `.env` e
   poder voltar atrás na hora, em vez de deploy de código no dia da migração.

---

## 4 · Sugestões de organização do ambiente

Não são bloqueios — são coisas que evitam retrabalho mais para a frente.

### a) Separar desenvolvimento de produção no banco

Hoje a API em desenvolvimento aponta para o **banco de produção**. Os pedidos de teste que
criamos (`cdPedido` 2074 e 2075) estão na mesma `tbPedido` dos pedidos reais, e vão para o
mesmo PDV.

Enquanto a API grava pedido, isso merece cuidado: um teste automatizado que rode em loop
gera DAV real e polui a fila do caixa. Vale pelo menos **uma flag que impeça gravação** fora
de uma janela ou de um usuário específico.

### b) Fixar a versão nos artefatos

O relatório diz `AntenorApi v1.5.0`, mas não há como conferir isso de fora. Sugerimos um
`GET /health` ou `GET /version` devolvendo versão, ambiente e a data do build. Quando algo
divergir, a primeira pergunta é sempre *"qual versão está no ar?"* — e hoje ela não tem
resposta.

### c) Logar as consultas lentas

O `GetProdutos` do Solidcon leva **15,3 segundos** e devolve 10,5 MB. Se a AntenorApi
mantiver o mesmo formato, vale medir e registrar — nosso sincronismo roda de hora em hora, e
uma consulta que degrada aparece primeiro como "o site está lento", não como "a query
piorou".

### d) Documentar o que é ambiente e o que é código

Coisas como `cdEmpresa = 10`, `cdFilial = 1`, `cdEcom = 19` estão hoje no código como
constantes. Se algum dia rodar para a filial 2 (ALF) ou 3 (Distribuidora), isso vira
descoberta dolorosa. Sugerimos tratá-las como configuração desde já.

> Do nosso lado seguimos a regra de que identificador de integração vai para variável de
> ambiente **sem valor padrão**: se faltar, a aplicação não sobe. Aprendemos isso do jeito
> difícil — tínhamos CNPJ e códigos com fallback no código, e como o `docker-compose` não
> repassava as variáveis, **o fallback era a configuração real de produção**. Mexer no
> `.env` não tinha efeito nenhum, e ninguém percebia.

### e) Um ambiente de teste, quando fizer sentido

Não é para agora, mas vale ter no horizonte: uma cópia do banco (ou ao menos das tabelas de
pedido) onde dê para testar gravação sem gerar DAV real. Enquanto isso não existe, todo
teste de `POST /pedidos` consome numeração de verdade.

---

## 5 · O que já está resolvido entre nós

Para não repetir discussão:

| | |
|---|---|
| ✅ | `tipoIntegracao` — regra validada, 14.885 produtos, zero divergências |
| ✅ | Fórmula do DAV removida; `MAX + 1` com lock é o caminho |
| ✅ | Troco calculado, não lido do campo `vlTroco` (que é sempre zero) |
| ✅ | `checksum` fora do `INSERT` — a trigger carimba |
| ✅ | EANs alternativos resolvidos por `tbProdutoVenda.cdEAN` |
| ✅ | Chaves fora de documento — validação cega por comportamento |
| ✅ | Agente local fica uma semana em convivência após o corte |

---

## Resumo do que precisamos

**Uma coisa só, hoje:** a API escutando em `0.0.0.0:3000`, com a porta liberada para a faixa
da VPN.

O resto da lista são sugestões para o ambiente não virar dívida — nenhuma bloqueia o
trabalho de vocês.

---

Levantado em 08/09/2026 a partir de testes pelo túnel WireGuard e consultas somente-leitura
aos bancos `Solidcon` e `DORSAL`.
