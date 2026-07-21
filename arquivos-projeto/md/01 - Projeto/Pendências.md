---
tipo: tarefas
status: ativo
area: projeto
prioridade: alta
criado: 2026-05-24
atualizado: 2026-06-06
tags:
  - pendencias
  - tarefas
  - roadmap
---

# Pendências

Acompanhe a lista de pendências consolidadas no planejamento do projeto:

👉 **[[ROADMAP.md|ROADMAP.md (Fases e Backlog)]]**

## Alta Prioridade
- [ ] Repetir validação de carregamento e ordenação da árvore de categorias no domínio final de produção, após DNS/deploy do cliente. Tentativa atual em `https://pedidos.antenorefilhos.com.br/api` falha com `getaddrinfo ENOTFOUND pedidos.antenorefilhos.com.br`; o domínio raiz `antenorefilhos.com.br` resolve, mas o subdomínio `pedidos` ainda não.
- [x] Validar carregamento e ordenação da árvore de categorias em staging local e HTTPS publicado: `validate:category-tree` passou contra `http://localhost:4001` e `https://jonathan.tailf56692.ts.net/api`, com evidências em `sistema/artifacts/category-tree-validation/20260606T0905-staging-local` e `sistema/artifacts/category-tree-validation/20260606T0905-staging-https`.
- [ ] Validar entrega externa do M33 Web Push com chaves VAPID reais, origem segura, preflight live, PWA instalado e subscription registrada em ambiente final.
- [x] Preparar homologação externa do M33 Web Push com manifesto PWA, cache correto e preflight `validate:web-push-readiness`.
- [x] Ampliar preflight do M33 Web Push com `--live`, `.env.staging` e `--env-file`.
- [x] Preparar comando de prova real do M33 Web Push com `prove:web-push-delivery`.
- [x] Expor CTA de inscrição Web Push para cliente logado no sino do storefront.
- [x] Preparar inspeção operacional de subscriptions Web Push com `inspect:web-push-subscriptions`.
- [x] Documentar homologação externa de Web Push em `RUNBOOK_WEB_PUSH.md`.
- [x] Revalidar staging real (`4000/4001`) quando Docker Desktop voltar.
- [x] Ampliar navegação smoke do storefront/staging além de `/mercado` (produto, carrinho e checkout).
- [x] Ampliar smoke visual/mobile local do storefront com assertions de viewport e overflow.
- [x] Ampliar smoke visual responsivo para tablet/desktop.
- [x] Ampliar smoke visual para rotas secundárias do storefront (`/promocoes`, `/adega`, `/receitas`).
- [x] Validar rotas secundárias do storefront com API real de staging (`/promocoes`, `/adega`, `/receitas`).
- [x] Validar detalhe real de receita no storefront staging com API real, ingredientes e produto vinculado.
- [x] Corrigir API admin de receitas/categorias para aceitar payloads válidos com `ValidationPipe` estrito.
- [x] Aplicar primeira fatia de UI kit no storefront em receitas e validar no staging.
- [x] Expandir UI kit do storefront para Mercado, detalhe de produto e carrinho.
- [x] Expandir UI kit do storefront para Checkout e Adega, com validação staging real/visual.
- [x] Expandir UI kit do storefront para Home, com validação staging real/visual.
- [x] Expandir UI kit do storefront para Login/Cadastro, com validação local/staging em `auth-ui-kit.cy.ts`.
- [x] Expandir UI kit do storefront para Conta/NotFound/Forbidden/ErrorBoundary, com validação local/staging em `account-fallback-ui-kit.cy.ts`.
- [x] Expandir UI kit do storefront para `DeliveryVerificationModal` e `NotificationBell`, com validação local/staging em `mobile-visual-smoke.cy.ts`.
- [x] Expandir UI kit do storefront para Busca/Search e Promoções, com varredura limpa de controles nativos diretos em `src/components` e `src/pages`.
- [x] Cadastrar acervo editorial real de receitas/categorias no staging via seed idempotente.
- [x] Adicionar capas locais e receitas relacionadas ao acervo editorial de staging.
- [x] Proteger o acervo editorial de staging com `validate:staging-recipes`.
- [x] Revisar copy, SEO e imagens definitivas do acervo editorial de receitas com capas WebP próprias.

## Média Prioridade
- [x] Atalhos operacionais do catálogo (Todos, Sem Estoque, Sem Categoria, Inativos) implementados e cobertos por Cypress em `catalog.cy.ts`.
- [x] Seleção de produtos em lote e ações massivas implementadas e cobertas por Cypress em `catalog.cy.ts`.
- [x] Edição rápida por linha e painel lateral de produto implementados e cobertos por Cypress em `catalog.cy.ts`.

## Baixa Prioridade
- [x] Documentar o fluxo de integração do ERP Solidcom com a taxonomia do CMS no [[CMS_MANUAL.md|CMS_MANUAL.md]].
