# Roadmap de lançamento

Prazo: sistema completo no ar **antes da temporada de fim de ano**, para operar com
ele durante a alta demanda. Planejado em 08/2026 com janela de ~1 mês de trabalho.

Regra que vale para tudo abaixo: **nada entra sem ser testado em mobile e desktop.**
O cliente chega por WhatsApp e Facebook Ads — mobile é o caminho principal, não o
secundário. Sem barreira de entrada, sem passo confuso para quem nunca usou um app
de mercado.

## Semana 1 — a jornada do cliente não pode falhar

- [ ] **Testar a jornada do cliente mobile ponta a ponta** — abrir a loja, achar
      produto, montar carrinho, fechar pedido, acompanhar até receber em casa.
- [ ] **Testar separação e finalização do pedido sem falhas** — o fluxo do
      separador e do entregador, incluindo troca de item e pedido parcial.

## Semana 2 — integração com o ERP

- [ ] **Validar um pedido real na Solidcom via PDV** — o pedido tem que chegar
      pronto para ser puxado no caixa. Temos acesso ao PDV para conferir.
- [ ] **Aumentar a frequência do sync do ERP + log de mudanças** — hoje é manual e
      leva ~3 min. Ver [solidcom-api.md](solidcom-api.md); `GetProdutosCadastro`
      ainda não está integrado e é o caminho para detectar produto novo.

## Semana 3 — infraestrutura

- [ ] **Escolher e provisionar hospedagem** — o mínimo necessário para suportar
      **20 pedidos/dia**. Sem superdimensionar.
- [ ] **Deploy de produção** — domínio, SSL e backup automático.

## Semana 4 — fechamento

- [ ] **QA final e checklist de lançamento.**

## Fila (não bloqueiam o lançamento)

- [ ] **Auditar rotas do admin sem `@Throttle` explícito.** O bug de rate limit
      documentado no [CLAUDE.md](../CLAUDE.md) foi corrigido só em `/uploads`. Toda
      rota sem decorator herda o bucket mais apertado (20 req/min) silenciosamente —
      provavelmente há outras afetadas.
- [ ] **Trava de divergência de preço no checkout.** O preço é recalculado três
      vezes e o total exibido nunca é carregado adiante (ver CLAUDE.md). Comparar
      contra o `priceSnapshot()` e bloquear a confirmação em vez de cobrar calado.
- [ ] **Tela de Desempenho da Equipe.** Auditoria e métricas por pessoa: quem trocou
      qual produto no pedido, qual entregador levou, onde estão os gargalos da
      separação. Depende do controle de acesso por módulo, que já está pronto.

## Concluído antes deste plano

Auditoria visual e de acessibilidade das 4 telas (storefront, admin, picking,
delivery); migração shadcn/ui; decomposição de Home e Checkout; busca com
MeiliSearch e ranking de relevância; auditoria seção a seção do admin (18 telas);
controle de acesso por módulo e permissão granular; importação em massa das fotos
de produto (cobertura de catálogo de 13% para 27%).
