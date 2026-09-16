# Réplica Técnica: Conferência AntenorApi v1.5.0

> **Destinatário:** Agente de IA / Equipe de Engenharia do E-commerce do Grupo Antenor & Filhos  
> **Em resposta ao documento:** `conferencia-antenorapi-v1.5.0.md` (de 08/09/2026)  
> **Data:** 08/09/2026  
> **Status:** **CORREÇÕES APLICADAS · TESTES CONCLUÍDOS · PLANO DE ROTA DEFINIDO**

---

## Agradecimento e Reconhecimento

Sua conferência foi excepcional. Você não apenas validou o `tipoIntegracao` produto a produto em 14.885 itens com zero divergências, como detectou armadilhas históricas reais do ERP (como as 12 faixas de offset do DAV e o campo `vlTroco` zerado no banco). Esse é o padrão de engenharia de software que garante uma migração sem sustos em produção.

Abaixo, apresentamos o que foi ajustado no código, testado no banco e como endereçamos cada ponto levantado.

---

## 1. `tipoIntegracao` e a Contagem (Produto ≠ Linha de Catálogo)

- ✅ **Alinhamento Completo:** Sua observação é perfeita: **produto ≠ linha de catálogo**.
- O banco possui 14.885 produtos distintos, mas a API da Solidcon devolvia 15.918 linhas porque um produto com múltiplos EANs (como os 1.370 produtos identificados) é retornado em múltiplas linhas, cada uma com o seu `CODIGO_EAN`.
- **Ajuste na AntenorApi:** Mantivemos exatamente esse comportamento na query SQL oficial da Solidcon sem agrupar por `cdProduto`, garantindo que todas as 15.918 linhas de embalagens/EANs sejam expostas para compatibilidade total com o catálogo.

---

## 2. A Fórmula do DAV (`nrSeqPAF`) — Corrigida

- ❌ **Você tem 100% de razão.** A análise histórica das 12 faixas de offset (`+29998`, `+69994`, `+79992`, `+99998`) prova que qualquer tentativa de generalizar um offset linear é uma bomba-relógio.
- **Correção Aplicada:**
  - Removemos 100% de qualquer fórmula matemática ou fallback linear (`+ 99998` ou `+ 100000`).
  - O endpoint `POST /api/integracao/pedidos` agora calcula o DAV **exclusivamente a partir do maior valor já gravado no banco**, usando lock atômico de transação:
  ```sql
  SELECT 
    ISNULL(MAX(TRY_CAST(cdPedido AS BIGINT)), 0) + 1 AS proxPedido,
    ISNULL(MAX(TRY_CAST(nrSeqPAF AS BIGINT)), 0) + 1 AS proxDAV
  FROM tbPedido WITH(UPDLOCK, HOLDLOCK)
  WHERE cdEmpresa = @cdEmpresa AND cdFilial = @cdFilial
  ```
  Isso elimina qualquer risco de DAV duplicado na virada de faixa.

---

## 3. Cálculo Real do Troco (`vlTroco`) — Corrigido e Testado

- ❌ **Confirmado:** No banco, embora algumas operações preencham `vlTroco`, o ERP frequentemente deixa `vlTroco = 0` nos cupons faturados de pedidos externos (como ocorreu no cupom `205424` do Pedido `2073`).
- **Correção Aplicada:**
  - A API não confia mais no campo estático do ERP.
  - O serviço agora calcula o troco real dinamicamente pela diferença entre a soma das modalidades e o valor fiscal do cupom:
  ```typescript
  const valorCupomReal = cupom?.vlCupom ? Number(cupom.vlCupom) : Number(row.vlTotal);
  const totalPagoModalidades = modRes.recordset.reduce((acc, m) => acc + Number(m.vlModalidade), 0);
  const trocoCalculadoTotal = Math.max(0, Number((totalPagoModalidades - valorCupomReal).toFixed(2)));
  ```
  - **Resultado Real Testado no Pedido 2073:**
  ```json
  "faturamento": {
    "faturadoEm": "2026-09-07T19:38:24.000Z",
    "caixaPDV": 2,
    "numeroCupom": 205424,
    "chaveNFCe": "33260905147995000131651020002041911002054245",
    "valorCupom": 21.63,
    "valorTroco": 5.00,
    "meiosDePagamento": [
      {
        "codigoModalidade": 1,
        "descricaoModalidade": "Dinheiro",
        "valor": 26.63,
        "troco": 5.00
      }
    ]
  }
  ```
  Agora o troco é entregue tanto no topo do faturamento (`valorTroco: 5.00`) quanto detalhado na linha de dinheiro (`troco: 5.00`).

---

## 4. EANs Secundários e Scanner do Separador — Protegido

- ⚠️ **Diagnóstico:** 1.370 produtos têm múltiplos EANs (alguns com mais de 30 códigos de barras para caixas, fardos e embalagens alternativas).
- **Ajustes Aplicados:**
  1. No catálogo geral (`GET /api/integracao/produtos`), cada EAN continua vindo em sua linha correspondente, garantindo paridade com a Solidcon.
  2. No endpoint de busca direta (`GET /api/integracao/produtos/ean/:ean`), adicionamos a resolução reversa:
  ```sql
  WHERE ... AND (
    dbo.tbProdutoVenda.cdEAN = @ean 
    OR dbo.tbProduto.cdProduto IN (SELECT cdProduto FROM dbo.tbProdutoVenda WITH(NOLOCK) WHERE cdEAN = @ean)
  )
  ```
  **Garantia:** Se o operador de separação bipar no celular QUALQUER um dos 34 EANs alternativos cadastrados de um item, o produto é localizado e retornado com sucesso.

---

## 5. Por que a API deu Connection Refused em `10.13.0.2:3000`?

- A `AntenorApi` estava sendo desenvolvida e testada na máquina de engenharia (conectando remotamente ao SQL Server em `10.13.0.2:1433`).
- Por isso a porta `3000` do Windows Server ainda não estava escutando — o serviço ainda não havia sido deployado na pasta oficial do servidor (`D:\AeFHub\APIs\AntenorApi`).
- A aplicação já está compilada (`npm run build`), bindada em `0.0.0.0:3000` e com suporte completo a CORS e Swagger em `/docs`.

---

## 6. O Ponto Central: A Rota (VPS Hostinger vs Rede Local da Loja)

Como você pontuou com muita clareza no **Item 5**, a VPS na nuvem (Hostinger) não enxerga o IP privado `10.13.0.2` da rede física da loja.

Abaixo estão os 3 caminhos técnicos possíveis e a nossa recomendação:

```
+---------------------------------------------------------------------------------------+
| OPÇÃO A: Cloudflare Tunnel (RECOMENDADA)                                              |
|                                                                                       |
|   VPS Hostinger (Nuvem)                                 Servidor Loja (10.13.0.2)     |
|   +--------------------+       HTTPS Criptografado      +-------------------------+   |
|   | Backend E-commerce | -----------------------------> | cloudflared (Túnel Out) |   |
|   +--------------------+  https://api-erp.antenor...    |          |              |   |
|                             Header: x-api-key           |          v              |   |
|                                                         | AntenorApi (porta 3000) |   |
|                                                         +-------------------------+   |
|   • Zero portas abertas no roteador da loja.                                          |
|   • Certificado SSL/TLS automático da Cloudflare.                                     |
|   • Comunicação bidirecional direta (checkout síncrono recebe DAV em < 200ms).        |
+---------------------------------------------------------------------------------------+

+---------------------------------------------------------------------------------------+
| OPÇÃO B: Sync Worker Local (Modelo Atual)                                             |
|                                                                                       |
|   VPS Hostinger (Nuvem)                                 Servidor Loja (10.13.0.2)     |
|   +--------------------+       Push HTTP (Outbound)     +-------------------------+   |
|   | Backend E-commerce | <----------------------------- | Sync Worker (Node.js)   |   |
|   | (Endpoints Webhook)|                                |          |              |   |
|   +--------------------+                                |          v              |   |
|                                                         | AntenorApi (localhost)  |   |
|                                                         +-------------------------+   |
|   • O servidor da loja toma a iniciativa de chamar a nuvem.                           |
|   • Para pedidos novos: o Worker faz polling na Hostinger para puxar pedidos novos.   |
|   • Não precisa de túnel, mas o checkout de pedidos passa a ser assíncrono.           |
+---------------------------------------------------------------------------------------+

+---------------------------------------------------------------------------------------+
| OPÇÃO C: VPN Mesh (Tailscale / WireGuard)                                             |
|                                                                                       |
|   • Cria uma interface de rede virtual segura unindo a VPS e o 10.13.0.2.             |
|   • Excelente para comunicação 100% privada sem tráfego pela web pública.             |
+---------------------------------------------------------------------------------------+
```

### Parecer Técnico & Próximo Passo
1. Se a gestão aprovar o uso do **Cloudflare Tunnel (Opção A)**:
   - Instalamos o executável leve `cloudflared` em `D:\AeFHub\Tunnel\` no Windows Server.
   - Criamos uma rota segura (ex: `https://api-erp.antenorefilhos.com.br`) protegida por API Key.
   - Sua aplicação na Hostinger passa a chamar a API diretamente com latência mínima e o checkout do cliente já recebe o número do DAV no mesmo segundo.
2. Se preferirem o modelo de **Sync Worker (Opção B)**:
   - A `AntenorApi` roda localmente no `10.13.0.2:3000`.
   - Um worker local consulta a cada minuto os pedidos faturados no PDV (`GET /api/integracao/pedidos/faturados-recentes`) e empurra o status para o webhook da Hostinger.

Qual dessas opções de conectividade você prefere para a arquitetura de produção do e-commerce?
