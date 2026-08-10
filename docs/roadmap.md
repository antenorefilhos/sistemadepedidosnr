# Roadmap de lançamento

Prazo: sistema completo no ar **antes da temporada de fim de ano**, para operar com
ele durante a alta demanda. Planejado em 08/2026 com janela de ~1 mês de trabalho.

Regra que vale para tudo abaixo: **nada entra sem ser testado em mobile e desktop.**
O cliente chega por WhatsApp e Facebook Ads — mobile é o caminho principal, não o
secundário. Sem barreira de entrada, sem passo confuso para quem nunca usou um app
de mercado.

## Semana 1 — a jornada do cliente não pode falhar ✅

- [x] **Testar a jornada do cliente mobile ponta a ponta** — pedido completo
      fechado de verdade (#1FBCEB16), mobile e desktop. Achou e corrigiu:
      zonas de entrega/janelas vazias bloqueando checkout silenciosamente.
- [x] **Testar separação e finalização do pedido sem falhas** — fluxo
      completo com item em falta + substituição + recálculo de preço,
      confirmado até `DELIVERED`. Trilha de auditoria por ator (`PICKER`,
      `DRIVER`) já existe em `order_events`.

## Semana 2 — integração com o ERP

- [x] **Aumentar a frequência do sync do ERP + log de mudanças.** Sync
      incremental de hora em hora + reconciliação de promoções no sync diário.
      Corrigiu um bug real: promoção nunca era removida (`undefined` fazia o
      Prisma ignorar a coluna) — 13 das 31 promoções no ar eram fantasmas.
      Ver [solidcom-api.md](solidcom-api.md).
- [ ] **Validar um pedido real na Solidcom via PDV** — o pedido tem que chegar
      pronto para ser puxado no caixa. Depende do Jonathan ter o PDV à mão.

## Semana 3 — infraestrutura de produção

HTTPS deixou de ser só polimento: a correção de GPS (posição exata do
aparelho decidindo a zona por polígono, não o centroide do endereço) só
funciona em conexão segura — navegador nenhum entrega geolocalização em HTTP.
Sem isto no ar, todo cliente cai no CEP.

- [x] **Domínio e DNS** — `antenorefilhos.com.br` já existe (compartilhado com
      o sistema da outra loja no domínio raiz). Este sistema usa 5 subdomínios
      próprios: `mercado.`, `admin.`, `api.`, `separacao.`, `entrega.`.
- [x] **Hospedagem escolhida** — Hostinger VPS KVM 2 (2 vCPU/8GB/100GB NVMe),
      contrato curto (preço de renovação sobe bastante depois da promoção).
      Avaliadas Locaweb, KingHost e Magalu Cloud; nenhuma levou vantagem clara
      pro volume de 20 pedidos/dia.
- [x] **Repositório pronto pro deploy** — `docker-compose.prod.yml` (stack
      isolada da de desenvolvimento, sem porta de banco/cache/busca exposta),
      Caddy como proxy com HTTPS automático (Let's Encrypt, sem certbot pra
      manter), backup diário (Postgres + fotos) com envio opcional pra
      armazenamento externo, runbook completo em
      [docs/deploy.md](deploy.md).
- [x] **Achado de segurança corrigido antes de ir pro ar**: o
      `docker-compose.yml` de desenvolvimento publica Postgres (5432) e
      MeiliSearch (7700) direto no host — correto pra testar local, seria uma
      porta de banco de dados aberta na internet em produção. O compose de
      produção não publica nenhuma delas; só o proxy fala com a rede externa.
  Achado relacionado: sem `trust proxy` configurado, todo cliente apareceria
  vindo do mesmo IP assim que o Caddy entrasse — quebraria rate limit e
  qualquer verificação por IP em checkout/pedidos/CRM/LGPD. Corrigido em
  `main.ts` junto com o proxy.
- [ ] **Deploy real** — depende do Jonathan: contratar o VPS, apontar os 5
      registros DNS, rodar (ou me dar acesso pra rodar) o runbook. Ver
      [docs/deploy.md](deploy.md).

## Semana 4 — fechamento

- [ ] **QA final e checklist de lançamento.**

## Fila (não bloqueiam o lançamento)

- [x] **Auditar rotas do admin sem `@Throttle` explícito.** Era pior do que a
      suspeita original: 31 dos 36 controllers tinham zero decorator, incluindo
      a integração com o ERP inteira (50 rotas). `RelaxedThrottle()` corrige
      todos; auditoria automatizada (reproduz a lógica real do guard) confirma
      zero rota esquecida sob o bucket de 20/min. Ver [CLAUDE.md](../CLAUDE.md).
- [x] **Trava de divergência de preço no checkout.** `confirmSession()` agora
      compara o `priceSnapshot()` mostrado ao cliente contra o total recalculado
      antes de confirmar; diferença acima de 1 centavo bloqueia com 400 e loga
      `PRICE_DIVERGED`. Testado ao vivo: subiu o preço de um produto no meio de
      uma sessão real — bloqueou, 0 pedidos criados; sem alteração, confirma
      normal. Ver [CLAUDE.md](../CLAUDE.md).
- [x] **Tela de Desempenho da Equipe.** Nova seção Operações > Desempenho:
      separadores (reusa endpoint existente), entregadores (novo endpoint
      agregando rotas/paradas por motorista) e substituições (novo endpoint
      lendo `order_events` e resolvendo o nome de quem trocou). Testado com
      dados reais e em mobile.
- [ ] **Configurar zonas de entrega e janelas de horário reais.** A
      `ZONA TESTE QA - REMOVER` (CEP 20000000-29999999) continua ativa pra não
      travar os testes — precisa sair antes do domínio de produção ir ao ar,
      substituída pelas zonas reais (CEP + polígono, ver a tela "Taxas de
      Entrega" no admin).

## Concluído antes deste plano

Auditoria visual e de acessibilidade das 4 telas (storefront, admin, picking,
delivery); migração shadcn/ui; decomposição de Home e Checkout; busca com
MeiliSearch e ranking de relevância; auditoria seção a seção do admin (18 telas);
controle de acesso por módulo e permissão granular; importação em massa das fotos
de produto (cobertura de catálogo de 13% para 27%); mapa de zonas de entrega com
raio/retângulo/polígono, busca de endereço e contexto das zonas já cadastradas.
