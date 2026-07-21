---
tipo: contexto
status: ativo
area: memoria
prioridade: alta
criado: 2026-05-24
atualizado: 2026-06-06
tags:
  - onde-parei
  - retomada
  - memoria
---

# Onde Parei

<!-- AUTO START -->
## Resumo Rápido

Auditoria Top-Tier P0-M20 encerrada e validada. UI kit shadcn/ui validado em stack real: controles nativos diretos restantes apenas nos wrappers `components/ui/*`; nenhum `alert()`, `prompt()` ou `confirm()` restante em `sistema/admin/src`; Cypress admin completo passou com 25 specs e 88/88 testes OK, incluindo `critical-flows.cy.ts` contra API real. M39 esta concluido e coberto por `catalog.cy.ts`. M33 Inteligencia foi reconciliado em runtime local: relatório executivo JSON/CSV respondeu 200, funil/insights responderam e regras de alerta listaram dados. Staging local tambem foi checado: API tem produtos, admin loga com `admin@antenor.com.br` / `admin2026`, `/mercado` renderiza produto real e o smoke produto/carrinho/checkout passou contra API real. Em 05/06, o storefront ganhou smoke visual de rotas secundarias (`/promocoes`, `/adega`, `/receitas` e detalhe de receita) em mobile/tablet/desktop, com fallback de SEO para imagem nula. M33 Web Push agora tem manifesto PWA, cache correto para service worker/manifesto, gerador VAPID, preparador de env `prepare:web-push-env` com `--database-url`, VAPID existente, `--vapid-from-env` e `--merge-existing`, gate `validate:web-push-tooling`, evidencias JSON por `--json-output`/`--evidence-dir`, `web-push-readiness.json` para preflight, `web-push-inspect.json` com origem operacional, validador `validate:web-push-evidence` com consistencia de origem, alvo e cronologia, override explícito `--origin`, confirmação visual rastreavel por `confirm:web-push-visual`/`--require-visual-confirmation`, `confirm:web-push-visual -- --finalize` para fechar o pacote depois de ver a notificação, relatório `report:web-push-homologation`, finalizador `finalize:web-push-homologation` com manifesto SHA-256 `web-push-evidence-manifest.json` e verificação automática de integridade, verificador avulso `verify:web-push-evidence-manifest`, orquestrador `homologate:web-push` com `--validate-evidence`, `--report`, `--require-empty-evidence-dir`, `--evidence-dir-auto`, `--evidence-run-id` e repasse de confirmação visual, ponte `.env.staging`/Compose para aplicar `STAGING_VAPID_*`, preflight externo/live para VAPID/HTTPS/origem publicada, comandos `inspect:web-push-subscriptions` e `prove:web-push-delivery` com `--env-file`, runbook externo `RUNBOOK_WEB_PUSH.md`, CTA de inscrição no sino de notificações do storefront e Cypress `web-push-subscribe.cy.ts` cobrindo a inscrição até `/notifications/push-subscribe`. Em 06/06, `.env.staging` persistente foi criado com VAPID alinhado entre API e storefront; depois o staging foi publicado via `https://jonathan.tailf56692.ts.net`, preflight externo/live passou, Chrome/Cypress e Chrome/CDP registraram subscriptions reais e `homologate:web-push` gerou o pacote final `20260606T085300Z-final` com `total=6 complete=6`, dry-run `targets=1 failed=0`, envio `sent=1 failed=0`, confirmação visual por histórico de notificações do Windows e manifesto verificado com 7 artefatos. `NotificationBell` foi corrigido para nao marcar permissao concedida como subscription ativa. A wiki operacional tambem tem gate `npm run validate:obsidian-links`, com 42 arquivos escaneados e 0 links quebrados; `06 - Sessões` permanece preservado como transcrição histórica bruta. Rotas secundarias foram validadas contra API real de staging: `/promocoes`, `/adega`, `/receitas` e detalhe real de receita passaram; staging tem 29 produtos, 5 itens de adega e acervo editorial com 5 receitas ativas em 4 categorias, 5 capas WebP próprias em `/recipes/*.webp`, copy/SEO revisados, 2 relacionadas por receita, ingredientes, passos e produtos reais vinculados via seed idempotente, protegido por `validate:staging-recipes` com checagem de `imageUrl` por slug. A API admin de receitas/categorias foi corrigida para aceitar payloads validos com `ValidationPipe` estrito. O UI kit do storefront foi aplicado em receitas e expandido para Mercado/Search/Produto/Carrinho/Checkout/Adega/Home/Login/Cadastro/Conta/Fallbacks/DeliveryVerificationModal/NotificationBell/Promocoes com `Button`, `Badge`, `Input`, `Select`, `Checkbox`, `Radio`, `surfaceClasses`, `buttonVariants` e `cn`; a varredura em `src/components` e `src/pages` agora mostra controles nativos diretos apenas nos wrappers `components/ui/*` e no compat layer `LoadingButton`. Staging passou em Cypress visual principal 20/20, visual secundario 16/16, auth UI kit 4/4, conta/fallbacks 4/4, smoke real 1/1 e rotas secundarias 4/4.

## Última Atividade

- **Data:** 2026-06-06
- **Atividade realizada:** Tooling de imagens removido por completo.
- **Resultado:** Removidos scripts de importacao/auditoria/sumarizacao de imagens e artefatos `product-image-audit*`. Imagens ja existentes foram preservadas; a frente de fotos fica pausada ate uma solucao melhor.

## Próxima Coisa a Fazer

- [x] **M19 núcleo validado:** preço próprio B2B, aprovação de compra, financeiro com limite/prazo e múltiplos usuários por conta.
- [x] **M19 admin validado:** tela `Contas B2B` com contas comerciais, aprovações, financeiro, criação de conta, vínculo de usuário e tabela de preço.
- [x] **M19 lista/minimo validado:** lista corporativa por conta empresarial e pedido mínimo B2B bloqueando pedido abaixo do valor.
- [x] **M19 recorrencia/faturamento validado:** pedido recorrente gera ordem B2B a partir da lista corporativa e faturamento/nota aciona contratos operacionais existentes.
- [x] **M20 pipeline base validado:** lint/typecheck/build/test/migration/seed/E2E/smoke local executados.
- [x] **M20 E2E crítico fechado:** picking, substituição, pagamento webhook, integração ERP, cancelamento parcial e reembolso validados por Cypress admin.
- [x] **M20 release operacionalizado:** staging local obrigatório, variáveis por ambiente, feature flags, changelog, rollback, smoke pós-deploy, backup e restore testado.
- [x] **M20 segurança backend aplicada:** NestJS 11, bcrypt 6, audit backend zerado e runtime local validado.
- [x] **M20 segurança frontend/admin aplicada:** Vite/esbuild atualizado, audit moderado zerado e runtime local validado.
- [x] **M20 encerrado formalmente:** checklist, staging, preflight, backup/restore e docs sincronizados.
- [x] **UI kit escolhido:** shadcn/ui definido para o projeto.
- [x] **UI kit base aplicado:** admin com `components.json`, aliases, tokens Tailwind, `cn` e componentes iniciais.
- [x] **Primeira superficie migrada:** Regras de Alerta em `Inteligencia (IA)`.
- [x] **Produtos iniciado:** toolbar, filtros, tabela, acoes, paginacao e historico Solidcom migrados para componentes `ui/*`.
- [x] **ProductSlideOver migrado:** formulario lateral de produto usando `Button`, `Input`, `Select` e `Badge`.
- [x] **Cypress admin estabilizado:** seed QA com dois produtos/estoque real e `cy.task('adminAuth')` para specs autenticadas.
- [x] **Pedidos iniciado:** toolbar, filtros, lista/kanban, tabela, badges, selects e modal de detalhes migrados para componentes `ui/*`.
- [x] **Cypress Pedidos criado:** filtros, lista, kanban e modal validados com dados mockados em `orders.cy.ts`.
- [x] **Clientes iniciado:** toolbar, filtros, lista/colunas, tabela, badges e modal de perfil migrados para componentes `ui/*`.
- [x] **Cypress Clientes criado:** filtros, lista, colunas e perfil validados com dados mockados em `customers.cy.ts`.
- [x] **Contas B2B iniciado:** carteira, busca, cards, formularios, recorrencia/faturamento, badges e tabela de aprovacoes migrados para componentes `ui/*`.
- [x] **Cypress Contas B2B criado:** filtros, financeiro, lista corporativa, busca de cliente, formularios e fila de aprovacao validados com dados mockados em `business-accounts.cy.ts`.
- [x] **Picking iniciado:** criacao de tarefa, filtro, botoes de fluxo, badges e formularios inline de separar/falta/substituicao migrados para componentes `ui/*`.
- [x] **Cypress Picking criado:** metricas, fila, criacao de tarefa, filtro, separacao e ruptura validados com dados mockados em `picking.cy.ts`.
- [x] **Categorias iniciado:** etapa `Estrutura da loja` com acoes, formulario de criacao, tabela, edicao inline, visibilidade, limite e modal de exclusao migrados para componentes `ui/*`.
- [x] **Cypress Categorias criado:** listagem, criacao, renomeacao, alternancia de visibilidade e confirmacao de exclusao validados com dados mockados em `categories.cy.ts`.
- [x] **Categorias fluxo guiado migrado:** sugestoes automaticas, revisao final, dry-run, aprovacao/rejeicao, badges e navegacao migrados para componentes `ui/*`.
- [x] **Cypress Categorias ampliado:** estrutura, dry-run, aprovacao e rejeicao validados com dados mockados em `categories.cy.ts`.
- [x] **Layout do Site iniciado:** primeira fatia do slider, badges, acoes de slide e busca/filtros de categorias migrada para `ui/*`.
- [x] **Cypress Layout criado:** dados CMS, busca/filtro, toggle de slide, modal de novo slide e toggle de categoria validados com dados mockados em `layout.cy.ts`.
- [x] **LayoutManager completado:** tabela de categorias, prioridade, limite, curadoria manual, modal de slide e confirmacao de exclusao migrados para componentes `ui/*`.
- [x] **Textarea UI criado:** `sistema/admin/src/components/ui/textarea.tsx` adicionado para formularios multiline.
- [x] **Cypress Layout ampliado:** prioridade, limite, curadoria e exclusao de slide validados com dados mockados em `layout.cy.ts`.
- [x] **PromoBannersManager migrado:** cards, acoes, modal, busca/selecao de produto exaltado, alinhamento, visibilidade e confirmacao de exclusao migrados para componentes `ui/*`.
- [x] **Cypress Layout com banners promocionais:** banners promocionais, produto exaltado, edicao, alinhamento, toggle e exclusao validados com dados mockados em `layout.cy.ts`.
- [x] **StoreBannersManager migrado:** cabecalho, cards/lista, modal de edicao, selects, toggle ativo, link target, upload visual, agendamento e exclusao migrados para componentes `ui/*`.
- [x] **Cypress Banners da Loja criado:** preview/lista, toggle, edicao com selects/link target/agendamento e exclusao validados com dados mockados em `store-banners.cy.ts`.
- [x] **BrandIdentity migrado:** nome da loja, campos hex de cor, area clicavel de upload, remocao de logo e acao de salvar migrados para componentes `ui/*`.
- [x] **Cypress Identidade Visual criado:** renderizacao de logos/cores/preview e salvamento de nome, cores e remocao de logo mobile validados com dados mockados em `brand-identity.cy.ts`.
- [x] **BusinessHours migrado:** toggle de dia aberto, inputs de horario, janela adicional/remocao, mensagens personalizadas, acao salvar e restauracao de padrao migrados para componentes `ui/*`.
- [x] **Cypress Horarios criado:** dias, janelas, mensagens e salvamento do payload `businessHours` validados com dados mockados em `business-hours.cy.ts`.
- [x] **Recipes migrado:** formulario, inputs, textarea, selects, checkbox ativo, tabela, badges, acoes, paginacao e confirmacao de exclusao migrados para componentes `ui/*`.
- [x] **Cypress Receitas criado:** listagem, criacao com slug automatico, selects, toggle, edicao e exclusao pelo modal validados com dados mockados em `recipes.cy.ts`.
- [x] **DeliveryZones migrado:** frete gratis global, formulario de zona, selects, checkbox ativo, badges, acoes, modal de janela de fulfillment e remocao migrados para componentes `ui/*`.
- [x] **Cypress Taxas de Entrega criado:** resumo de janelas, frete gratis global, criacao de janela, criacao de zona CEP, toggle, edicao e exclusao validados com dados mockados em `delivery-zones.cy.ts`.
- [x] **NotificationsBroadcast migrado:** select de tipo, campos de titulo/mensagem/customer ID, botao de envio e feedback de sucesso/erro migrados para componentes `ui/*`.
- [x] **Cypress Notificacoes criado:** formulario, envio para cliente especifico, broadcast geral e erro da API validados com dados mockados em `notifications-broadcast.cy.ts`.
- [x] **FraudAudit migrado:** atualizar, filtros por vetor, badges de vetor/reincidencia e tabela de logs migrados para componentes `ui/*`.
- [x] **Cypress Anti-fraude criado:** registros, reincidencia, filtro por dispositivo e empty state validados com dados mockados em `fraud-audit.cy.ts`.
- [x] **SystemHealthWidget migrado:** badge geral de saude e acao manual de atualizar migrados para componentes `ui/*`, preservando polling automatico.
- [x] **Cypress Status dos Servicos criado:** status degradado, latencias, refresh manual para OK e erro de API validados com dados mockados em `system-health.cy.ts`.
- [x] **ExecutiveReport migrado:** campo de semana, acoes de gerar relatorio/CSV, tabelas de categorias/termos e indicador de busca sem resultado migrados para componentes `ui/*`.
- [x] **Cypress Relatorio Executivo criado:** geracao semanal, headers/query, resumo, tabelas, gaps, recomendacoes e download CSV validados com dados mockados em `executive-report.cy.ts`.
- [x] **Integrations migrado:** mostrar/ocultar modulos, toggle de extensao, badges de status e refresh Solidcom migrados para componentes `ui/*`, com cards acessiveis via teclado.
- [x] **Cypress Integracoes criado:** resumo de modulos, selecao de conector CRM, toggle de HubSpot e refresh do status Solidcom validados com dados mockados em `integrations.cy.ts`.
- [x] **IntelligenceAutoInsightsPanel migrado:** modo Compacto/Detalhado e refresh manual migrados para `Button`, preservando `aria-pressed`, cache e endpoint `/analytics/admin/insights`.
- [x] **Cypress Insights Automaticos criado:** modo detalhado, modo compacto, ranking de produtos desejados, refresh e percentual de abandono sem duplicacao validados com dados mockados em `auto-insights.cy.ts`.
- [x] **IntelligenceSearchInsightsPanel migrado:** presets, restauracao, expandir/recolher tudo, toggles por secao, indicadores e tier de Ads migrados para `Button` e `Badge`.
- [x] **Cypress Saude da Busca criado:** metricas, gaps, correcoes, ranking de Ads, conversoes, presets e expandir/recolher secoes validados com dados mockados em `search-insights.cy.ts`.
- [x] **Cabecalho Intelligence migrado:** selects de periodo/top termos, indicadores e botao `Atualizar agora` migrados para `Select`, `Badge` e `Button`.
- [x] **Cypress Saude da Busca ampliado:** periodo, top termos e refresh manual do cabecalho validados com `days`/`limit` corretos em `search-insights.cy.ts`.
- [x] **AlertRulesManager finalizado:** exclusao de regra sem `window.confirm()`, usando confirmacao controlada com `Button`.
- [x] **Cypress Regras de Alerta criado:** cancelar nao chama DELETE e confirmar executa exclusao em `alert-rules.cy.ts`.
- [x] **DashboardSection migrado:** select de periodo em Performance de Vendas migrado para `Select`.
- [x] **Cypress Dashboard endurecido:** troca de periodo validada com `period=month`, analytics e health mockados sem depender da API local.
- [x] **CustomersSection chips migrados:** limpar filtros de email/endereco/pedidos/cadastro agora usa `Button` icon-only.
- [x] **Cypress Clientes ampliado:** quatro chips ativos e limpeza por `aria-label` validados em `customers.cy.ts`.
- [x] **OrdersSection chips migrados:** limpar filtros de status/data/pagamento/troco agora usa `Button` icon-only.
- [x] **Cypress Pedidos ampliado:** quatro chips ativos e limpeza por `aria-label` validados em `orders.cy.ts`.
- [x] **ProductsSection acoes finalizadas:** botoes nativos e `window.confirm()` removidos das acoes individuais/em lote; dialog controlado no UI kit.
- [x] **Cypress Catalogo ampliado:** confirmacao controlada de produto/lote, KPIs, selecao, inline edit e slide-over validados em `catalog.cy.ts`.
- [x] **Shell Dashboard migrado:** sidebar, ferramentas, logout e menu mobile agora usam `Button`.
- [x] **Cypress Dashboard ampliado:** navegacao por shell, sidebar mobile e logout validados em `dashboard.cy.ts`.
- [x] **ErrorBoundary migrado:** fallback de erro agora usa `Button` para recarregar pagina.
- [x] **Login migrado:** email/senha usando `Input` + `Label`, submit usando `Button`.
- [x] **Cypress Smoke estabilizado:** login validado com payload mockado em `smoke.cy.ts`.
- [x] **FormElements migrado:** wrappers acessiveis reutilizam componentes `ui/*` preservando a API publica.
- [x] **LayoutManager inputs especiais migrados:** uploads escondidos de categoria/slide usando `Input type="file"`.
- [x] **Cypress Layout estabilizado:** mocks sem dependencia de `/api` e espera de dados CMS antes da assercao visual.
- [x] **PromoBannersManager inputs especiais migrados:** uploads escondidos em cards e modal usando `Input type="file"`.
- [x] **BrandIdentity inputs especiais migrados:** upload escondido e color pickers usando `Input type="file"`/`Input type="color"`.
- [x] **StoreBannersManager inputs especiais migrados:** uploads escondidos desktop/mobile usando `Input type="file"`.
- [x] **PaymentEventsSection abas migradas:** controles `Transacoes`/`Webhooks` usando `Button` do ui-kit com `aria-pressed`.
- [x] **Cypress Pagamentos criado:** saude da integracao, transacoes, expansao de eventos/reembolsos, filtro por status e webhooks validados com dados mockados em `payment-events.cy.ts`.
- [x] **ProductSlideOver inputs especiais migrados:** uploads escondidos de Foto 1/Foto 2 usando `Input type="file"`.
- [x] **Cypress Catalogo ampliado para upload:** `catalog.cy.ts` valida os dois slots de imagem com endpoints `/uploads/product/:ean` e `/uploads/product/:ean/2`.
- [x] **CategoriesManager input especial migrado:** upload escondido de banner usando `Input type="file"`.
- [x] **Cypress Categorias ampliado para upload:** `categories.cy.ts` valida envio de banner e PATCH de `bannerUrl`.
- [x] **Varredura global de controles:** sem `button/input/select/textarea` nativos diretos fora dos componentes `ui/*`.
- [x] **CategoriesManager alertas residuais removidos:** erro de exclusao e erro de reordenacao usam feedback controlado com `role="alert"`.
- [x] **Cypress Categorias ampliado para erro controlado:** falha de exclusao validada sem chamada a `window.alert`.
- [x] **Catalogo alertas residuais de produtos removidos:** salvar/remover/lote/edicao inline/sync/taxonomia usam feedback controlado e erro inline no dialogo, sem `alert()` no fluxo de produtos.
- [x] **Cypress Catalogo ampliado para erro controlado:** validacao inline invalida e falha de exclusao validadas sem chamada a `window.alert`.
- [x] **Pedidos alertas residuais removidos:** atualizacao de status/dados usa feedback controlado com `role="alert"`, sem `alert()`.
- [x] **Pedidos cancelamento controlado:** motivo de cancelamento agora usa `Input` no modal, sem `window.prompt`.
- [x] **Cypress Pedidos ampliado para erro controlado:** falha de status, falha de pagamento e cancelamento com motivo validados sem `window.alert`/`window.prompt`.
- [x] **Picking pop-ups residuais removidos:** atribuir, enviar para conferencia, conferir e embalar usam dialog controlado com `Input`/`Button`.
- [x] **Cypress Picking ampliado para modal controlado:** quatro acoes de tarefa validadas sem chamada a `window.prompt`.
- [x] **Varredura global de pop-ups nativos:** sem `alert()`, `prompt()` ou `confirm()` em `sistema/admin/src`.
- [x] **Auditoria final UI kit:** controles nativos diretos restantes apenas nos wrappers `components/ui/*`.
- [x] **Suite admin mock completa estabilizada:** 24 specs, 85/85 testes OK sem `critical-flows.cy.ts`.
- [x] **Docker/API/Postgres reativados:** stack local e staging em execucao.
- [x] **Build/recreate real validado:** `api` e `admin` rebuildados e recriados.
- [x] **Seed QA real validado:** `npm run seed:qa` OK.
- [x] **Cypress critico real validado:** `critical-flows.cy.ts` 3/3.
- [x] **Cypress admin completo real validado:** 25 specs, 88/88.
- [x] **Staging checado:** produtos carregam no storefront e admin loga com `admin@antenor.com.br` / `admin2026`.
- [x] **M33/M39 reconciliados:** M39 concluido; M33 Inteligencia validado em runtime local.
- [x] **Storefront staging ampliado:** produto, Mercado, carrinho e checkout como convidado com PIX validados por `staging-smoke.cy.ts`.
- [x] **M33 Web Push implementado:** backend envia via `web-push` com VAPID configuravel, frontend registra subscription real do navegador e service worker abre payload recebido.
- [x] **Docker atualizado:** API/storefront local e staging rebuildados/recriados; `3001/3000/4001/4000` respondem 200.
- [x] **Storefront visual responsivo:** `mobile-visual-smoke.cy.ts` cobre 375x667, 414x896, 768x1024 e 1280x900; local 16/16 e staging 16/16 OK.
- [x] **Staging rerodado em 05/06:** visual responsivo 16/16 contra `4000` e `staging-smoke.cy.ts` real 1/1 contra `4000/4001`.
- [x] **Storefront rotas secundarias:** `secondary-routes-visual.cy.ts` local/staging 16/16 cobrindo `/promocoes`, `/adega`, `/receitas` e detalhe de receita.
- [x] **SEO robusto:** `image: null` usa `/og-image.png` como fallback e evita quebra em receita sem imagem editorial.
- [x] **Web Push/PWA readiness:** manifesto PWA publicado, service worker/manifesto com cache no-store e `npm run validate:web-push-readiness -- --external`/`--live` validado com VAPID temporario.
- [x] **Web Push inscrição coberta:** Cypress `web-push-subscribe.cy.ts` valida permissão, subscription, serialização e POST para `/notifications/push-subscribe`.
- [x] **Web Push prova endurecida:** `prove:web-push-delivery` valida `--limit`, aceita `--tenant` e pode limpar expiradas/incompletas com flags explícitas.
- [x] **Web Push dry-run validado:** `prove:web-push-delivery -- --dry-run` valida alvo/payload sem enviar push.
- [x] **Web Push VAPID gerável:** `generate:web-push-vapid` gera chaves em PowerShell, `.env` e JSON, validando `--subject`.
- [x] **Web Push tooling gate:** `validate:web-push-tooling` valida geração de env, readiness, reutilização VAPID por env e merge seguro.
- [x] **Web Push evidencias JSON:** `homologate:web-push -- --evidence-dir` grava inspeção, dry-run e envio real em JSON mascarado.
- [x] **Web Push evidencia validável:** `validate:web-push-evidence -- --require-send` valida o pacote final depois do envio real.
- [x] **Web Push relatório gerável:** `report:web-push-homologation -- --require-send` gera Markdown depois de validar o pacote.
- [x] **Web Push homologação integrada:** `homologate:web-push -- --validate-evidence --report` fecha evidencias e relatório no mesmo fluxo.
- [x] **Web Push evidencias protegidas:** `homologate:web-push -- --require-empty-evidence-dir` evita overwrite acidental.
- [x] **Web Push pasta automatica:** `homologate:web-push -- --evidence-dir-auto` cria subpasta unica por execução e aceita `--evidence-run-id`.
- [x] **Wiki links validada:** `npm run validate:obsidian-links` passou com 42 arquivos operacionais e 0 links quebrados.
- [x] **Rotas secundarias com API real:** `staging-secondary-routes-real.cy.ts` valida `/promocoes`, `/adega`, `/receitas` e `/receitas/:slug` contra `4000/4001`.
- [x] **Receita real no staging:** `picadinho-de-acem-da-casa` publicada com categoria, ingredientes, passos e produto real vinculado.
- [x] **Detalhe real de receita:** `staging-secondary-routes-real.cy.ts` ampliado para `/receitas/:slug`, carrinho e SEO/canonical; 4/4 OK.
- [x] **Admin API de receitas corrigida:** DTOs com validação e smoke real de criação/leitura/limpeza OK.
- [x] **Storefront UI kit iniciado:** receitas migradas para `Button`, `Badge`, `surfaceClasses` e `cn`; staging rebuildado e Cypress real 4/4.
- [x] **Storefront UI kit comércio:** `StoreProductCard`, `ProductDetail` e `Cart` migrados com `Button`, `Badge`, `Input`, `Checkbox` e `surfaceClasses`; staging visual/real OK.
- [x] **Storefront UI kit checkout/adega:** `Checkout` e `WinePage` migrados com `Button`, `Badge`, `Input`, `Radio` e `surfaceClasses`; staging visual/real OK.
- [x] **Storefront UI kit Home:** header, hero, dots, CTAs, banners e destaque comercial migrados para `Button`, `buttonVariants`, `Badge` e `surfaceClasses`; staging visual/real OK.
- [x] **Storefront UI kit Login/Cadastro:** auth migrado para `Input`, `Select`, `Button`, `buttonVariants`, `surfaceClasses`; `auth-ui-kit.cy.ts` 4/4 local/staging.
- [x] **Storefront UI kit Conta/Fallbacks:** `Account`, `NotFound`, `Forbidden` e `ErrorBoundary` migrados; `account-fallback-ui-kit.cy.ts` 4/4 local/staging.
- [x] **Storefront UI kit utilitarios:** `DeliveryVerificationModal` e `NotificationBell` migrados; `mobile-visual-smoke.cy.ts` 20/20 local/staging e `staging-smoke.cy.ts` 1/1.
- [x] **Storefront UI kit Search/Promoções:** busca, filtros, selects, chips, sugestões, CTAs e `btn-gold` legado migrados; varredura limpa fora de wrappers/`LoadingButton`; Cypress local 36/36 e staging 37/37.
- [x] **Storefront receitas finais:** capas WebP próprias, copy/SEO revisados, `imageUrl` por slug no gate; `staging-secondary-routes-real.cy.ts` 4/4 após seed.
- [x] **Web Push staging local preparado:** `.env.staging` persistente com VAPID, API/storefront reconstruidos e readiness live local aprovado.
- [x] **Web Push preflight limpo:** modo externo em HTTP/localhost reprova apenas pelos requisitos de HTTPS e origem nao-local, sem assertion do Node.
- [x] **Web Push subscription tentada:** navegador interno abriu o fluxo real, mas a permissao estava bloqueada; banco confirmado com `total=0 complete=0 incomplete=0`.
- [x] **CMS/Solidcom documentado:** fluxo ERP -> produto -> taxonomia CMS registrado em `CMS_MANUAL.md`, com precedencia EAN, pendencias e fallback mercadologico.
- [x] **M11 pesaveis endurecido:** fracionado sem `fractionStep > 0` nao recebe fallback 100g, fica indisponivel e é bloqueado por backend/constraint.
- [x] **Categorias staging/publicado:** carregamento e ordenacao da arvore validados por `validate:category-tree`, com evidencias em `sistema/artifacts/category-tree-validation/20260606T0905-staging-local` e `sistema/artifacts/category-tree-validation/20260606T0905-staging-https`.
- [x] **Categorias no go-live:** `go-live-ops.ps1 preflight -CategoryTreeApiUrl http://localhost:4001` passou e registrou relatório em `artifacts/release/go-live-preflight-20260606-061403.json`.
- [x] **Pagamento manual/troco local:** `CARD` tratado como offline/cartao na entrega, aliases manuais aceitos no admin, checkout Cypress 5/5, pedidos admin Cypress 5/5 e backend focado 28/28.
- [x] **Frente de imagens pausada:** scripts e artefatos de importacao/auditoria/sumarizacao foram removidos; uploads existentes preservados.
- [ ] **Próximo:** seguir para a proxima frente do projeto, sem trabalhar fotos agora.

## Contexto Necessário

Docker Desktop foi reativado e a validacao completa pendente foi fechada em 02/06; em 05/06 ficou indisponivel no inicio da rodada (`dockerDesktopLinuxEngine` ausente), mas voltou durante a validacao. `api`, `admin`, `storefront`, `api_staging` e `storefront_staging` foram rebuildados/recriados nas fatias anteriores; migrations local/staging estavam em dia; seed QA passou; Cypress admin completo passou 88/88. M33 relatório executivo foi revalidado por API real (`/analytics/report-executive`) e M39 nao tem pendencia funcional aberta nos itens antigos de filtros/lote/edicao. O smoke real do storefront revelou e corrigiu o uso de `slotId=ASAP`; agora o checkout consome `/delivery/slots`, envia um `FulfillmentSlot` real e ignora janelas prestes a expirar. M33 Web Push ja envia via `web-push` quando VAPID esta configurado, tem manifesto PWA, preflight externo/live com `web-push-readiness.json`, `inspect:web-push-subscriptions`, `prove:web-push-delivery`, gate `validate:web-push-tooling`, evidencias JSON por `--evidence-dir`, validador `validate:web-push-evidence` com `--require-readiness`, relatório `report:web-push-homologation`, `finalize:web-push-homologation` com manifesto SHA-256 e verificação automática, `verify:web-push-evidence-manifest`, `confirm:web-push-visual -- --finalize`, `homologate:web-push -- --validate-evidence --report`, guarda `--require-empty-evidence-dir`, pasta automatica `--evidence-dir-auto` e confirmação visual por `confirm:web-push-visual`. Em 06/06, o staging local recebeu VAPID persistente, foi reconstruido e passou no readiness live; a prova final agora depende de origem HTTPS nao-local, permissao nativa concedida, PWA instalado e subscription real nesse ambiente. Em 05/06, o smoke visual responsivo do storefront passou localmente com mocks em `127.0.0.1:5173` e contra staging `127.0.0.1:4000`, agora com modal de entrega, sino/Web Push, Search/Mercado, mobile/tablet/desktop e 20/20 testes; o smoke real `staging-smoke.cy.ts` tambem passou contra `4000/4001`. Na mesma rodada, `secondary-routes-visual.cy.ts` passou local/staging 16/16 e validou `/promocoes`, `/adega`, `/receitas` e detalhe de receita; `staging-secondary-routes-real.cy.ts` passou 4/4 contra API real após seed/copy final de receitas. A API admin de receitas/categorias foi rebuildada em staging e validada por smoke real. O UI kit do storefront já cobre receitas, cards do Mercado/vitrines, Search/Mercado, detalhe de produto, carrinho, checkout, Adega, Home, Login, Cadastro, Conta, fallbacks, modal de verificacao de entrega, sino de notificacoes e Promocoes; `storefront_staging` foi rebuildado e passou em `account-fallback-ui-kit`, `auth-ui-kit`, `mobile-visual-smoke`, `secondary-routes-visual`, `staging-smoke` e `staging-secondary-routes-real`. Observacao operacional: a senha correta e `admin2026` em minusculo, porque o login e case-sensitive.

## Arquivos Relacionados

- [[Contexto Atual]]
- [[Contexto Recuperado M18]]
- [[Pendências]]
- [[Roadmap]]
- [[Histórico de Alterações]]
- [[M20 Release e Seguranca]]
<!-- AUTO END -->

## Anotações Manuais

<!-- MANUAL START -->
O usuário pode escrever aqui sem risco de sobrescrita.
<!-- MANUAL END -->
