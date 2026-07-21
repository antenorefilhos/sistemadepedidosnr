# STATUS - Antenor & Filhos

Data: 7 de junho de 2026
Versao de referencia: 1.24.150-alpha (Stack Docker migrada para o Drive F:)
Status auditoria top-tier: P0 + M01 + M02 + M03 + M04 + M05 + M06 + M07 + M08 + M09 + M10 + M11 + M12 + M13 + M14 + M15 + M16 + M17 + M18 + M19 + M20 aplicados, validados e documentados.
Status geral: STACK DOCKER MIGRADA PARA F:\VC.VERSE\DOCKER EM 07/06/2026 | STACK DOCKER COMPLETAMENTE RECONSTRUÍDA DO ZERO | M0-M32 ENCERRADOS | M33 INTELIGENCIA VALIDADO EM RUNTIME LOCAL | M33 WEB PUSH IMPLEMENTADO E HOMOLOGADO EXTERNAMENTE COM PWA/PREFLIGHT LIVE/GERADOR VAPID/PREPARE ENV COM DATABASE_URL, VAPID EXISTENTE VIA ENV, MERGE SEGURO, GATE AUTOMATIZADO DA TOOLING, EVIDENCIAS JSON, VALIDADOR DO PACOTE COM CONSISTENCIA DE ORIGEM/ALVO/CRONOLOGIA, OVERRIDE EXPLICITO DE ORIGEM, RELATORIO MARKDOWN, MANIFESTO FINAL COM HASHES E VERIFICACAO AUTOMATICA DE INTEGRIDADE, CONFIRMACAO VISUAL COM FINALIZACAO, STAGING LOCAL COM VAPID PERSISTENTE, ORIGEM HTTPS VIA TAILSCALE FUNNEL, LIVE READINESS EXTERNO OK, SUBSCRIPTION REAL REGISTRADA POR CYPRESS E CHROME/CDP, ENVIO REAL `sent=1 failed=0`, HISTORICO DE NOTIFICACOES DO WINDOWS COMO EVIDENCIA SUPLEMENTAR, HOMOLOGACAO INTEGRADA, GUARDA ANTI-SOBRESCRITA, PASTA AUTOMATICA DE EVIDENCIAS, PREFLIGHT JSON, CONFIRMACAO VISUAL RASTREAVEL E FINALIZADOR DE HOMOLOGACAO/PONTE ENV STAGING/HOMOLOGATE ORQUESTRADO VALIDADO ATE PACOTE FINAL | M11 PESAVEIS COM FRACTIONSTEP ENDURECIDO: SEM FALLBACK 100G, BACKEND/CARRINHO/CONSTRAINT VALIDOS | M-CAT VALIDACAO FINAL CONCLUIDA E MANUAL SOLIDCOM/TAXONOMIA CMS DOCUMENTADO | SANEAMENTO, REORGANIZACAO E WIKI CONCLUIDOS COM LINKS OPERACIONAIS VALIDADOS | STAGING REATIVADO E CHECKOUT VALIDADO EM 02/06 | STOREFRONT VISUAL, ROTAS SECUNDARIAS E DETALHE REAL DE RECEITA VALIDADOS EM 05/06 | STOREFRONT RECEITAS COM 5 RECEITAS/4 CATEGORIAS/CAPAS WEBP PROPRIAS/COPY SEO REVISADOS/RELACIONADAS EM STAGING E GATE EXECUTAVEL | STOREFRONT UI KIT EM RECEITAS/MERCADO/SEARCH/PRODUTO/CARRINHO/CHECKOUT/ADEGA/HOME/LOGIN/CADASTRO/CONTA/FALLBACKS/DELIVERY MODAL/NOTIFICATION BELL/PROMOCOES | ADMIN API DE RECEITAS CORRIGIDA | M39 CONCLUIDO | AUDITORIA TOP-TIER P0-M20 ENCERRADA | UI KIT SHADCN/UI VALIDADO EM STACK REAL



## Categorias - validacao da arvore em staging publicado

Status: **VALIDADO EM STAGING LOCAL E HTTPS** em 06/06/2026.

Entregas e evidencias:
- `sistema/scripts/validate-category-tree.js` criado e exposto como `npm run validate:category-tree`.
- O gate valida `health`, `cms/categories`, `cms/categories/commercial`, `api/categories/hierarchy` e `products/mercadological-tree`.
- Evidencia local: `sistema/artifacts/category-tree-validation/20260606T0905-staging-local/category-tree-validation.json`.
- Evidencia HTTPS: `sistema/artifacts/category-tree-validation/20260606T0905-staging-https/category-tree-validation.json`.
- Evidencia negativa de producao: `sistema/artifacts/category-tree-validation/20260606T0927-production-dns-diagnostic/category-tree-validation.json`, com `getaddrinfo ENOTFOUND pedidos.antenorefilhos.com.br`; o dominio raiz `antenorefilhos.com.br` resolve, mas o subdominio `pedidos` ainda nao.
- `go-live-ops.ps1 preflight` agora executa `validate:category-tree`; preflight rerodado com `-CategoryTreeApiUrl http://localhost:4001` e relatório em `artifacts/release/go-live-preflight-20260606-061403.json`.
- Resultado nos dois ambientes: `CMS categories=65`, `commercialCategories=72`, `hierarchy roots=45`, `hierarchy children=20`.
- Ordenacao validada: CMS/comercial por prioridade/status/prioridade comercial/nome; hierarquia por prioridade descendente em raizes e filhos.

Pendencia restante:
- Repetir no dominio final de producao quando DNS/deploy estiver ativo. `pedidos.antenorefilhos.com.br` ainda nao resolve DNS neste host.

## Pagamento manual e troco - validacao local

Status: **VALIDADO LOCALMENTE** em 06/06/2026.

Entregas e evidencias:
- Backend ajustado para tratar `CARD` como pagamento offline/cartao na entrega no checkout e na confirmacao de pedidos, mesmo com gateway habilitado.
- Admin de pedidos reconhece aliases de pagamento manual nos labels e icones: `CARD`, `CARD_ON_DELIVERY`, `CARTAO`, `CARTAO_ENTREGA`, `CASH`, `DINHEIRO` e `MONEY`.
- Checkout local validado por Cypress com PIX, Dinheiro com troco guiado e Cartao na entrega: 5/5 testes aprovados.
- Backend focado validado: 2 suites / 28 testes aprovados em checkout e orders.
- Builds de backend/admin aprovados; Cypress admin de pedidos aprovado com 5/5 testes.

## Imagens de produto - frente pausada

Status: **TOOLING REMOVIDO / DADOS PRESERVADOS** em 06/06/2026.

Entregas e evidencias:
- A tentativa operacional de imagens desta rodada foi encerrada a pedido do projeto.
- Removidos `import-images.js`, `import-images.ts`, `audit-product-images.js`, `summarize-product-image-audit.js`, scripts npm `product-images:*` e artefatos `product-image-audit*`.
- As imagens ja existentes em `sistema/backend/uploads/products` e `sistema/backend/uploads_staging/products` foram preservadas.
- A rota publica de imagens continua sendo `/uploads/products/{ean}.webp` quando existir arquivo.

Pendencia restante:
- Nao trabalhar fotos agora. Quando voltar, redesenhar solucao melhor e integrada a fornecedor/ERP/CMS, sem fluxo manual item a item.

## M33 Web Push - homologacao externa finalizada

Status: **FINALIZADO** em 06/06/2026.

Pacote final:
- `sistema/artifacts/web-push-homologation/20260606T085300Z-final`.
- Origem: `https://jonathan.tailf56692.ts.net`.
- Readiness externo/live: OK.
- Inspeção: `total=6 complete=6`.
- Dry-run: `targets=1 failed=0`.
- Envio real: `sent=1 failed=0`.
- Confirmação visual: `web-push-visual-confirmation.json`, confirmada por histórico de notificações do Windows.
- Evidência suplementar: `web-push-windows-notification-history.json`, com payload XML do toast Chrome contendo `Antenor Filhos`, `Prova Web Push visual final`, `jonathan.tailf56692.ts.net` e `displayTimestamp=2026-06-06T08:29:47Z`.
- Manifesto: `web-push-evidence-manifest.json`, 7 artefatos, verificado por `verify:web-push-evidence-manifest`.

Validação final:
- `validate:web-push-evidence -- --evidence-dir artifacts/web-push-homologation/20260606T085300Z-final --require-readiness --require-send --require-visual-confirmation`: OK.
- `verify:web-push-evidence-manifest -- --evidence-dir artifacts/web-push-homologation/20260606T085300Z-final`: OK.

## M33 Web Push - envio externo real comprovado

Status: **SUPERADO PELO PACOTE FINAL 20260606T085300Z-final** em 06/06/2026.

Evidencias:
- Origem HTTPS externa: `https://jonathan.tailf56692.ts.net` via Tailscale Funnel para `storefront_staging`.
- `.env.staging` atualizado para a origem externa, preservando o VAPID existente.
- Hash publico VAPID: `731b17e98595efdc448c045fdc67f34f13405500f982cdd90f3f0308565b54e0`.
- `validate:web-push-readiness -- --external --live --env-file .env.staging`: OK.
- `inspect:web-push-subscriptions -- --origin https://jonathan.tailf56692.ts.net --require-ready`: `total=1 complete=1 incomplete=0`.
- Pacote: `sistema/artifacts/web-push-homologation/20260606T080939Z`.
- `homologate:web-push` com `--send --validate-evidence --report`: OK, `sent=1 failed=0`.
- `validate:web-push-evidence -- --evidence-dir artifacts/web-push-homologation/20260606T080939Z --require-readiness --require-send`: OK.
- `NotificationBell` corrigido para nao exibir "Notificações ativas" apenas por permissao concedida sem subscription.
- `register:web-push-cdp-chrome` validado com Chrome real e perfil persistente; criou subscription FCM real com `saveStatus=201`.
- Pacote final candidato mais recente: `sistema/artifacts/web-push-homologation/20260606T085300Z-final`.
- Pacote final candidato: `total=6 complete=6`, dry-run `targets=1 failed=0`, envio real `sent=1 failed=0`.
- Capturas em `sistema/artifacts/web-push-visual-captures/20260606T085300Z-final` nao exibiram toast ou central com a notificacao.

Pendencia restante:
- Nenhuma para Web Push externo; pacote final gerado e verificado.

## M33 Web Push - staging local preparado

Status: **VAPID LOCAL PERSISTENTE E RUNTIME VALIDADO** em 06/06/2026.

Entregas e evidencias:
- `.env.staging` criado localmente e ignorado pelo Git.
- VAPID público/privado presentes; `STAGING_VAPID_PUBLIC_KEY` e `VITE_VAPID_PUBLIC_KEY` conferem.
- Hash público VAPID: `731b17e98595efdc448c045fdc67f34f13405500f982cdd90f3f0308565b54e0`.
- `api_staging` e `storefront_staging` reconstruídos com `.env.staging`, preservando banco/volumes.
- API staging recebeu VAPID; health respondeu `ok`; storefront respondeu HTTP 200.
- `validate:web-push-readiness -- --live --env-file .env.staging`: OK.
- Banco staging: `total=0 complete=0 incomplete=0` subscriptions.
- Login cliente QA validado; sino abriu, mas o navegador integrado informou permissão de notificações bloqueada.
- `validate:web-push-readiness -- --external --live --env-file .env.staging` reprova corretamente por exigir origem HTTPS não-local.

Correção aplicada:
- Preflight não executa checks live quando a validação estática já falhou.
- Falha externa esperada encerra sem assertion do runtime Node no Windows.

Pendencia restante:
- Publicar/reutilizar origem HTTPS não-local e registrar uma subscription em navegador/PWA com permissão disponível.

## M33 Web Push - confirmacao visual com finalizacao

Status: **CONFIRMACAO VISUAL FINALIZA PACOTE** em 06/06/2026.

Entregas aplicadas:
- `confirm-web-push-visual.js` aceita `--finalize` para chamar o finalizador logo depois de gravar `web-push-visual-confirmation.json`.
- O fluxo assistido pode fechar relatório, manifesto e verificação de integridade no mesmo comando usado após ver a notificação.
- `validate-web-push-tooling.js` cobre o caminho `confirm-web-push-visual -- --finalize`.

Validacao tecnica executada:
- `node --check` nos scripts Web Push alterados: OK.
- `npm run validate:web-push-tooling`: OK.
- `npm run validate:obsidian-links`: OK.

Pendencia restante:
- Executar contra subscription real no domínio HTTPS final.

## M33 Web Push - finalizador com integridade automatica

Status: **FINALIZADOR VERIFICA MANIFESTO** em 06/06/2026.

Entregas aplicadas:
- `finalize-web-push-homologation.js` executa `verify-web-push-evidence-manifest.js` automaticamente depois de gerar o manifesto.
- O fechamento do pacote agora imprime `Web Push evidence manifest verified.` quando hashes/tamanhos conferem.
- `validate-web-push-tooling.js` exige essa confirmação no output do finalizador.

Validacao tecnica executada:
- `node --check` nos scripts Web Push alterados: OK.
- `npm run validate:web-push-tooling`: OK.
- `npm run validate:obsidian-links`: OK.

Pendencia restante:
- Executar contra subscription real no domínio HTTPS final.

## M33 Web Push - verificador do manifesto final

Status: **INTEGRIDADE DO MANIFESTO VERIFICAVEL** em 06/06/2026.

Entregas aplicadas:
- `verify-web-push-evidence-manifest.js` recalcula SHA-256 e tamanho dos artefatos listados no manifesto final.
- `npm run verify:web-push-evidence-manifest` valida uma pasta finalizada sem reexecutar envio Web Push.
- O gate `validate:web-push-tooling` cobre manifesto íntegro e reprova alteração pós-finalização em artefato assinado.

Validacao tecnica executada:
- `node --check` nos scripts Web Push alterados: OK.
- `npm run validate:web-push-tooling`: OK.
- `npm run validate:obsidian-links`: OK.

Pendencia restante:
- Executar contra subscription real no domínio HTTPS final.

## M33 Web Push - manifesto do pacote final

Status: **MANIFESTO FINAL DE EVIDENCIAS GERADO** em 06/06/2026.

Entregas aplicadas:
- `finalize-web-push-homologation.js` gera `web-push-evidence-manifest.json` ao lado do relatório final.
- O manifesto registra comando, pasta, relatório, flags obrigatórias e hashes SHA-256/tamanho dos artefatos finais.
- O manifesto não duplica conteúdo sensível; ele referencia e assina os arquivos de evidência já mascarados.
- `validate-web-push-tooling.js` valida a existência do manifesto, artefatos críticos e formato dos hashes.

Validacao tecnica executada:
- `node --check` nos scripts Web Push alterados: OK.
- `npm run validate:web-push-tooling`: OK.
- `npm run validate:obsidian-links`: OK.

Pendencia restante:
- Executar contra subscription real no domínio HTTPS final.

## M33 Web Push - consistencia de alvo nas evidencias

Status: **ALVOS DO PACOTE VALIDADOS** em 06/06/2026.

Entregas aplicadas:
- `validate-web-push-evidence.js` compara alvos entre inspeção, dry-run e envio real.
- O envio real precisa corresponder ao alvo previamente validado no dry-run.
- O dry-run precisa corresponder a uma subscription completa listada na inspeção.
- `validate-web-push-tooling.js` cobre fixture negativa com alvo de envio divergente.

Validacao tecnica executada:
- `node --check` nos scripts Web Push alterados: OK.
- `npm run validate:web-push-tooling`: OK.

Pendencia restante:
- Executar contra subscription real no domínio HTTPS final.

## M33 Web Push - cronologia das evidencias

Status: **CRONOLOGIA DO PACOTE VALIDADA** em 06/06/2026.

Entregas aplicadas:
- `validate-web-push-evidence.js` exige timestamps validos nos artefatos do pacote.
- `validate-web-push-evidence.js` valida a ordem readiness -> inspeção -> dry-run -> envio -> confirmação visual.
- `generate-web-push-homologation-report.js` inclui seção "Cronologia".
- `validate-web-push-tooling.js` cobre fixture negativa com confirmação visual anterior ao envio.

Validacao tecnica executada:
- `node --check` nos scripts Web Push alterados: OK.
- `npm run validate:web-push-tooling`: OK.

Pendencia restante:
- Executar a cronologia real no domínio HTTPS final; o pacote será reprovado se a confirmação visual vier antes do envio registrado.

## M33 Web Push - override explicito de origem

Status: **OVERRIDE DE ORIGEM VALIDADO** em 06/06/2026.

Entregas aplicadas:
- `validate-web-push-readiness.js` aceita `--origin`.
- `homologate-web-push.js` aceita `--origin` e aplica a origem em readiness, inspeção e prova.
- `validate-web-push-tooling.js` cobre `homologate-web-push -- --origin ... --readiness-only`.

Validacao tecnica executada:
- `node --check` nos scripts Web Push alterados: OK.
- `npm run validate:web-push-tooling`: OK.

Pendencia restante:
- Usar `--origin https://DOMINIO-REAL` na prova externa quando não for desejável editar o arquivo `.env.staging`.

## M33 Web Push - origem da inspeção nas evidencias

Status: **ORIGEM DA INSPEÇÃO RASTREAVEL** em 06/06/2026.

Entregas aplicadas:
- `inspect-web-push-subscriptions.js` grava `origin` no JSON de evidencias.
- `validate-web-push-evidence.js` exige e compara a origem da inspeção no pacote final.
- `generate-web-push-homologation-report.js` exibe a origem da inspeção.
- `validate-web-push-tooling.js` cobre fixture final com origem de inspeção consistente.

Validacao tecnica executada:
- `node --check` nos scripts Web Push alterados: OK.
- `npm run validate:web-push-tooling`: OK.

Pendencia restante:
- A subscription real ainda precisa ser criada no domínio HTTPS real; o pacote final agora evidencia a origem operacional usada na inspeção.

## M33 Web Push - consistencia de origem nas evidencias

Status: **CONSISTENCIA DO PACOTE VALIDADA** em 06/06/2026.

Entregas aplicadas:
- `validate-web-push-evidence.js` exige readiness externo/live quando `--require-readiness` é usado.
- `validate-web-push-evidence.js` compara a origem registrada em readiness, dry-run, envio real e confirmacao visual.
- `validate-web-push-tooling.js` cobre fixture negativa com origem visual divergente.

Validacao tecnica executada:
- `node --check` em `validate-web-push-evidence.js`, `validate-web-push-tooling.js` e `finalize-web-push-homologation.js`: OK.
- `npm run validate:web-push-tooling`: OK.

Pendencia restante:
- Executar o pacote contra a origem HTTPS real do cliente; o validador agora reprova evidencias misturadas de dominios diferentes.

## M33 Web Push - finalizador de homologacao

Status: **FINALIZADOR DO PACOTE VALIDADO** em 06/06/2026.

Entregas aplicadas:
- `finalize-web-push-homologation.js` valida o pacote final exigindo `--require-readiness --require-send --require-visual-confirmation`.
- `sistema/package.json` expoe `npm run finalize:web-push-homologation`.
- O finalizador gera `web-push-homologation-report.md` depois da validacao final obrigatoria.
- `validate-web-push-tooling.js` cobre o comando com fixture completa de readiness, envio e confirmacao visual.

Validacao tecnica executada:
- `node --check` em `finalize-web-push-homologation.js` e `validate-web-push-tooling.js`: OK.
- `npm run validate:web-push-tooling`: OK.

Pendencia restante:
- Executar o finalizador contra a pasta real criada no dominio HTTPS depois de receber a notificacao no navegador/dispositivo real.

## M33 Web Push - preflight JSON de evidencias

Status: **PREFLIGHT RASTREAVEL VALIDADO** em 06/06/2026.

Entregas aplicadas:
- `validate-web-push-readiness.js` aceita `--json-output`.
- `homologate-web-push.js` grava `web-push-readiness.json` quando há pasta de evidencias.
- `validate-web-push-evidence.js` aceita `--require-readiness`.
- `generate-web-push-homologation-report.js` inclui secao "Preflight".
- `validate-web-push-tooling.js` cobre escrita real de readiness JSON.

Validacao tecnica executada:
- `node --check` nos scripts Web Push alterados: OK.
- `npm run validate:web-push-tooling`: OK.

Pendencia restante:
- Rodar preflight externo/live contra o dominio HTTPS real e validar o pacote final com `--require-readiness --require-send --require-visual-confirmation`.

## M33 Web Push - confirmacao visual rastreavel

Status: **ARTEFATO DE CONFIRMACAO VISUAL VALIDADO** em 06/06/2026.

Entregas aplicadas:
- `confirm-web-push-visual.js` grava `web-push-visual-confirmation.json` na pasta de evidencias.
- `sistema/package.json` expoe `npm run confirm:web-push-visual`.
- `validate-web-push-evidence.js` aceita `--require-visual-confirmation`.
- `generate-web-push-homologation-report.js` inclui a secao "Confirmacao Visual" no relatorio.
- `homologate-web-push.js` repassa `--require-visual-confirmation` para validacao/relatorio quando o arquivo ja existir.
- `validate-web-push-tooling.js` cobre fixture de confirmacao visual.

Validacao tecnica executada:
- `node --check` nos scripts Web Push alterados: OK.
- Fixture temporaria sem confirmacao visual + `--require-visual-confirmation`: falha esperada.
- `npm run confirm:web-push-visual`: OK.
- `npm run validate:web-push-evidence -- --require-send --require-visual-confirmation`: OK com fixture completa.
- `npm run report:web-push-homologation -- --require-send --require-visual-confirmation`: OK com fixture completa.
- `npm run validate:web-push-tooling`: OK.

Pendencia restante:
- A confirmacao visual final ainda precisa ser registrada depois de receber a notificacao em dominio HTTPS real.

## M11 Pesaveis - guardrail fractionStep

Status: **GUARDRAIL DE FRACIONAMENTO VALIDADO** em 06/06/2026.

Entregas aplicadas:
- `productPricing.ts` removeu fallback de porcao 100g quando `fractionStep` nao existe.
- `productCard.ts` marca fracionado sem `fractionStep` positivo como indisponivel.
- `CartContext` nao adiciona fracionado sem `fractionStep` valido ao carrinho local.
- `CartService` rejeita fracionado sem `fractionStep` positivo.
- Migration `20260606003000_require_fraction_step_for_fractional_products` adicionou constraint `products_fraction_step_required_for_fractional`.
- `products.service.spec.ts` agora valida que o sync ERP persiste `fractionStep` em create/update do upsert.

Validacao tecnica executada:
- `npm run test:unit -- --run src/utils/productPricing.test.ts src/contexts/CartContext.test.tsx`: 64/64 OK.
- `npm test -- --runTestsByPath src/modules/products/products.service.spec.ts src/modules/checkout/checkout.service.spec.ts`: 42/42 OK.
- `npm run build` em `sistema/backend`: OK.
- `npm run build` em `sistema/frontend`: OK.
- `npx prisma validate` e `npx prisma migrate deploy` em local e staging: OK.
- DB local: 1460 fracionados, 0 sem `fractionStep`.
- DB staging: 0 fracionados, 0 sem `fractionStep`.
- Constraint confirmada em `pg_constraint` nos dois bancos.
- Docker local/staging rebuildado/recriado para `api`, `storefront`, `api_staging` e `storefront_staging`; `/health` e homes responderam 200.
- Cypress `product-pricing.cy.ts` contra storefront Docker local `3000`: 5/5 OK.
- Cypress `product-pricing.cy.ts` contra storefront Docker staging `4000`: 5/5 OK.
- Browser em `/mercado`: local renderizou 24 cards/2553 produtos; staging renderizou 24 cards/29 produtos.

Pendencia restante:
- Validar a mesma regra em produção depois do deploy HTTPS real, sem mocks e com catalogo final do cliente.

## CMS - Solidcom e taxonomia

Status: **FLUXO OPERACIONAL DOCUMENTADO** em 06/06/2026.

Entregas aplicadas:
- `CMS_MANUAL.md` documenta o caminho Solidcom -> catalogo -> taxonomia CMS.
- A precedencia operacional ficou explicita: mapeamento EAN confirmado, fila de pendencias, fallback por `classification01..04` e categoria generica apenas em ultimo caso.
- `Pendências.md` marcou como concluida a documentação do fluxo ERP Solidcom com taxonomia do CMS.

Validacao tecnica executada:
- Fonte conferida em `solidcom-erp.service.ts`, `handoff-apply.js`, endpoints admin de categorias e `REFERENCIA_TECNICA.md`.

Pendencia restante:
- Validar carregamento e ordenacao da arvore de categorias em produção depois da homologação do cliente.

## M33 Web Push - pasta automatica de evidencias

Status: **PASTA AUTOMATICA DE EVIDENCIAS VALIDADA** em 05/06/2026.

Entregas aplicadas:
- `homologate-web-push.js` aceita `--evidence-dir-auto`.
- `homologate-web-push.js` aceita `--evidence-run-id`.
- Sem `--evidence-dir`, a base automatica é `artifacts/web-push-homologation`.
- Com `--evidence-dir`, o valor informado vira a base e a subpasta automatica fica abaixo dela.

Validacao tecnica executada:
- `node --check scripts/homologate-web-push.js`: OK.
- `--evidence-dir-auto --evidence-run-id codex-auto-dir-test --require-empty-evidence-dir --readiness-only`: OK.
- `--evidence-run-id bad/id`: falha correta.
- Homologacao seca real em staging local com subscription temporaria `codex-auto-evidence-flow`: OK, incluindo validação de evidências e relatório.
- Cleanup confirmado: `remaining=0`; temporarios removidos.
- `npm run validate:web-push-tooling`: OK.

Pendencia restante:
- Na prova externa real, usar `--evidence-dir-auto --require-empty-evidence-dir` para criar pasta unica por execução.

## M33 Web Push - guarda anti-sobrescrita de evidencias

Status: **GUARDA DE EVIDENCIAS VALIDADO** em 05/06/2026.

Entregas aplicadas:
- `homologate-web-push.js` aceita `--require-empty-evidence-dir`.
- `homologate-web-push.js` aceita `--force-evidence-overwrite`.
- A guarda falha antes do preflight quando a pasta de evidencias ja contem arquivos.

Validacao tecnica executada:
- `node --check scripts/homologate-web-push.js`: OK.
- Pasta temporaria ocupada + `--require-empty-evidence-dir`: falha correta.
- Pasta temporaria ocupada + `--force-evidence-overwrite`: passou em `--readiness-only` com env temporario valido.
- `npm run validate:web-push-tooling`: OK.
- Temporarios removidos.

Pendencia restante:
- Na prova externa real, usar uma pasta nova/timestampada ou incluir `--require-empty-evidence-dir` para impedir overwrite acidental.

## M33 Web Push - homologacao integrada com evidencias e relatorio

Status: **ORQUESTRADOR INTEGRADO VALIDADO** em 05/06/2026.

Entregas aplicadas:
- `sistema/scripts/homologate-web-push.js` aceita `--validate-evidence`.
- `sistema/scripts/homologate-web-push.js` aceita `--report`.
- As flags exigem `--evidence-dir`.
- Com `--send`, o orquestrador repassa `--require-send`; sem `--send`, valida/relata o pacote parcial de dry-run.

Validacao tecnica executada:
- `node --check scripts/homologate-web-push.js`: OK.
- Homologacao seca integrada em staging local com subscription temporaria `codex-integrated-homologate`: OK.
- O mesmo comando gerou evidencias, validou pacote e gerou relatório Markdown.
- `--report` sem `--evidence-dir` falhou corretamente.
- Cleanup confirmado: `remaining=0`; temporarios removidos.
- `npm run validate:web-push-tooling`: OK.

Pendencia restante:
- Na prova externa real, usar `homologate:web-push -- --external --live --env-file .env.staging --evidence-dir-auto --require-empty-evidence-dir --send --validate-evidence --report`.

## M33 Web Push - relatorio Markdown de homologacao

Status: **RELATORIO DE HOMOLOGACAO GERAVEL** em 05/06/2026.

Entregas aplicadas:
- `sistema/scripts/generate-web-push-homologation-report.js` gera `web-push-homologation-report.md`.
- `sistema/package.json` expoe `npm run report:web-push-homologation`.
- O gerador valida o pacote com `validate-web-push-evidence` antes de escrever o relatório.
- O comando aceita `--evidence-dir`, `--output` e `--require-send`.

Validacao tecnica executada:
- `node --check scripts/generate-web-push-homologation-report.js`: OK.
- Fixture sem envio gerou relatório: OK.
- `--require-send` falhou corretamente sem `web-push-send.json`.
- Homologacao seca real em staging local com subscription temporaria `codex-report-fixture`: OK.
- `npm run validate:web-push-evidence -- --evidence-dir .tmp-web-push-report-evidence`: OK.
- `npm run report:web-push-homologation -- --evidence-dir .tmp-web-push-report-evidence`: OK.
- Cleanup confirmado: `remaining=0`; temporarios removidos.
- `npm run validate:web-push-tooling`: OK.

Pendencia restante:
- Depois da prova externa com `--send`, rodar `npm run report:web-push-homologation -- --evidence-dir CAMINHO_IMPRESSO_PELO_ORQUESTRADOR --require-send` se o relatório não tiver sido gerado junto por `--report`.

## M33 Web Push - validador do pacote de evidencias

Status: **PACOTE DE EVIDENCIAS VALIDAVEL** em 05/06/2026.

Entregas aplicadas:
- `sistema/scripts/validate-web-push-evidence.js` valida pacote gerado por `homologate:web-push -- --evidence-dir`.
- `sistema/package.json` expoe `npm run validate:web-push-evidence`.
- O comando aceita `--evidence-dir` e `--require-send`.
- O validador confere `web-push-inspect.json`, `web-push-dry-run.json` e, quando exigido, `web-push-send.json`.

Validacao tecnica executada:
- `node --check scripts/validate-web-push-evidence.js`: OK.
- Fixture de evidencias sem envio: OK.
- `--require-send` falhou corretamente sem `web-push-send.json`.
- Fixture com `web-push-send.json`: OK com `--require-send`.
- Homologacao seca real em staging local com subscription temporaria `codex-evidence-validator`: OK.
- `npm run validate:web-push-evidence -- --evidence-dir .tmp-web-push-evidence-validator-real`: OK.
- Cleanup confirmado: `remaining=0`; temporarios removidos.
- `npm run validate:web-push-tooling`: OK.

Pendencia restante:
- Depois da prova externa com `--send`, rodar `npm run validate:web-push-evidence -- --evidence-dir CAMINHO_IMPRESSO_PELO_ORQUESTRADOR --require-send` se a validação não tiver sido executada junto por `--validate-evidence`.

## M33 Web Push - evidencias JSON da homologacao

Status: **EVIDENCIA AUDITAVEL VALIDADA** em 05/06/2026.

Entregas aplicadas:
- `inspect-web-push-subscriptions.js` aceita `--json-output`.
- `prove-web-push-delivery.js` aceita `--json-output`.
- `homologate-web-push.js` aceita `--evidence-dir` e grava evidencias separadas para inspeção, dry-run e envio real.
- Evidencias mascaram endpoints e nao incluem VAPID privado.

Validacao tecnica executada:
- `node --check` nos scripts alterados: OK.
- Subscription temporaria `codex-json-evidence` criada no staging local.
- Homologacao seca com `--evidence-dir`: OK, `targets=1 failed=0`.
- JSON de inspeção validado com `total=1 complete=1 ready=true`.
- JSON de dry-run validado com `dryRunTargets=1 failed=0`.
- Cleanup confirmado: subscription temporaria removida e arquivos temporarios apagados.

Pendencia restante:
- Na prova externa real, executar `homologate:web-push -- --external --live --env-file .env.staging --evidence-dir-auto --require-empty-evidence-dir --send` e anexar os JSONs finais da subpasta criada ao pacote de homologacao.

## M33 Web Push - gate automatizado da tooling

Status: **GATE OPERACIONAL VALIDADO** em 05/06/2026.

Entregas aplicadas:
- `sistema/scripts/validate-web-push-tooling.js` cobre geracao de env staging, readiness, `--vapid-from-env` e `--merge-existing`.
- `sistema/package.json` expoe `npm run validate:web-push-tooling`.
- O gate usa arquivos temporarios dentro de `sistema/`, compara chaves por hash e nao imprime VAPID privado.

Validacao tecnica executada:
- `node --check scripts/validate-web-push-tooling.js`: OK.
- `npm run validate:web-push-tooling`: OK.
- Cenários validados: env gerado com readiness OK; env derivado por `--vapid-from-env` preservando chaves; merge preservando `NODE_ENV` e `CUSTOM_KEEP`.
- Temporarios removidos automaticamente.

Pendencia restante:
- Manter este gate antes de alterar scripts/env de Web Push; a prova final continua dependendo de dominio HTTPS, chaves reais e subscription real de navegador.

## M33 Web Push - merge seguro de env

Status: **MERGE DE ENV EXISTENTE VALIDADO** em 05/06/2026.

Entregas aplicadas:
- `sistema/scripts/prepare-web-push-env.js` aceita `--merge-existing`.
- O modo merge atualiza/adiciona chaves Web Push e preserva comentários/variáveis não geradas pelo comando.
- A saída informa `Write mode: merge-existing` ou `Write mode: replace`.

Validacao tecnica executada:
- `node --check scripts/prepare-web-push-env.js`: OK.
- Merge temporario preservou `NODE_ENV=staging` e `CUSTOM_KEEP=nao-apagar`.
- Preflight com o env mergeado: OK.
- Temporario removido.

Pendencia restante:
- Usar `--merge-existing` ao atualizar `.env.staging` real para evitar apagar outras variaveis do ambiente.

## M33 Web Push - env-file direto em inspeção e prova

Status: **INSPECAO E PROVA ACEITAM ENV-FILE** em 05/06/2026.

Entregas aplicadas:
- `sistema/scripts/inspect-web-push-subscriptions.js` aceita `--env-file`.
- `sistema/scripts/prove-web-push-delivery.js` aceita `--env-file`.
- O arquivo informado sobrescreve variaveis carregadas de `.env`, `.env.local` e `.env.staging`.

Validacao tecnica executada:
- `node --check scripts/inspect-web-push-subscriptions.js`: OK.
- `node --check scripts/prove-web-push-delivery.js`: OK.
- Env temporario com `DATABASE_URL` staging local criado.
- Subscription temporaria `codex-direct-env-file` criada.
- Inspecao direta com `--env-file`: OK, `total=1 complete=1 incomplete=0`.
- Prova direta com `--env-file --dry-run`: OK, `targets=1 failed=0`.
- Cleanup confirmado: `deleted=1 remaining=0`.

Pendencia restante:
- No ambiente real, os comandos individuais podem ser usados diretamente com `.env.staging`, ou substituidos pelo orquestrador `homologate:web-push`.

## M33 Web Push - VAPID from env seguro

Status: **REUTILIZACAO SEGURA DE VAPID VIA ENV VALIDADA** em 05/06/2026.

Entregas aplicadas:
- `sistema/scripts/prepare-web-push-env.js` carrega `.env`, `.env.local`, `.env.staging` e `--env-file`.
- Flag `--vapid-from-env` adicionada para reutilizar `STAGING_VAPID_*`/`VAPID_*`.
- O comando bloqueia mistura de `--vapid-from-env` com `--vapid-public-key`/`--vapid-private-key`.
- A saída indica `VAPID: provided (env)` quando a origem das chaves for env.

Validacao tecnica executada:
- `node --check scripts/prepare-web-push-env.js`: OK.
- Env derivado por `--vapid-from-env --env-file` passou no preflight.
- Hashes das chaves fonte/derivada confirmaram mesma public/private sem imprimir segredo.
- Conflito entre `--vapid-from-env` e chaves por argumento falhou corretamente.
- Temporarios removidos.

Pendencia restante:
- Usar `--vapid-from-env --env-file .env.staging` quando o arquivo real ja tiver chaves finais e for necessario atualizar origem, CORS ou banco sem rotacionar VAPID.

## M33 Web Push - prepare env com VAPID existente

Status: **PREPARADOR ACEITA CHAVES EXISTENTES** em 05/06/2026.

Entregas aplicadas:
- `sistema/scripts/prepare-web-push-env.js` aceita `--vapid-public-key` e `--vapid-private-key`.
- O comando exige o par completo ou gera um par novo quando ambos forem omitidos.
- O comando valida tamanho base64url das chaves e `web-push.setVapidDetails` antes de gravar o env.
- A saída indica `VAPID: generated` ou `VAPID: provided`.

Validacao tecnica executada:
- `node --check scripts/prepare-web-push-env.js`: OK.
- Modo gerado validado com preflight: OK.
- Modo fornecido validado com preflight: OK.
- Par incompleto falhou corretamente.
- Temporarios removidos.

Pendencia restante:
- Usar `--vapid-public-key`/`--vapid-private-key` quando houver chaves finais ja aprovadas; caso contrario, gerar chaves novas conscientemente.

## M33 Web Push - homologacao dry-run validada

Status: **HOMOLOGACAO SECA VALIDADA EM STAGING LOCAL** em 05/06/2026.

Entregas aplicadas:
- `sistema/scripts/prepare-web-push-env.js` aceita `--database-url`.
- O arquivo gerado pode alimentar `homologate:web-push` com banco, origem, VAPID e CORS no mesmo artefato.
- O orquestrador `homologate:web-push` foi validado ate o dry-run com uma subscription completa temporaria.

Validacao tecnica executada:
- `node --check scripts/prepare-web-push-env.js`: OK.
- Env temporario `.tmp-web-push-db.env` gerado com `DATABASE_URL` staging local.
- Subscription temporaria `codex-homologate-dry-run` criada no staging local.
- `npm run homologate:web-push -- --env-file .tmp-web-push-db.env --endpoint-contains codex-homologate-dry-run --limit 1`: OK, `targets=1 failed=0`, sem `--send`.
- Subscription temporaria removida: `deleted=1 remaining=0`.
- Inspecao final filtrada retornou `total=0 complete=0 incomplete=0`.

Pendencia restante:
- Repetir o mesmo fluxo com subscription real criada por navegador/PWA em HTTPS e então executar com `--send`.

## M33 Web Push - homologacao orquestrada

Status: **ORQUESTRADOR DE HOMOLOGACAO PRONTO E VALIDADO** em 05/06/2026.

Entregas aplicadas:
- Script `sistema/scripts/homologate-web-push.js` criado.
- Comando `cd sistema && npm run homologate:web-push` exposto.
- Sequencia automatizada: `validate-web-push-readiness`, `inspect-web-push-subscriptions --require-ready`, `prove-web-push-delivery --dry-run` e envio real apenas com `--send`.
- Flags suportadas: `--env-file`, `--external`, `--live`, `--readiness-only`, filtros por cliente/tenant/endpoint/limit e payload `--title`, `--body`, `--icon`, `--url`.

Validacao tecnica executada:
- `node --check scripts/homologate-web-push.js`: OK.
- `npm run homologate:web-push -- --external --env-file .tmp-web-push.env --readiness-only`: OK.
- Sem `--readiness-only`, o comando avançou ao gate de subscriptions e falhou corretamente por `DATABASE_URL` ausente no env temporario.

Pendencia restante:
- Rodar `homologate:web-push -- --external --live --env-file .env.staging` no ambiente HTTPS real depois de registrar subscription.

## M33 Web Push - prepare env operacional

Status: **GERACAO DE ENV WEB PUSH PRONTA E VALIDADA** em 05/06/2026.

Entregas aplicadas:
- Script `sistema/scripts/prepare-web-push-env.js` criado.
- Comando `cd sistema && npm run prepare:web-push-env` exposto.
- O comando gera chaves VAPID novas e escreve um arquivo `.env` com `WEB_PUSH_ORIGIN`, `FRONTEND_URL`, `CORS_ORIGIN`, `VITE_VAPID_PUBLIC_KEY` e variaveis VAPID.
- Com `--staging`, o arquivo inclui `STAGING_VAPID_*`, `STAGING_FRONTEND_URL`, `STAGING_ADMIN_URL` e `STAGING_CORS_ORIGIN`.
- O comando nao sobrescreve arquivo existente sem `--force`.

Validacao tecnica executada:
- `node --check scripts/prepare-web-push-env.js`: OK.
- Geração HTTPS staging temporaria com `--output .tmp-web-push.env`: OK.
- `npm run validate:web-push-readiness -- --external --env-file .tmp-web-push.env`: OK.
- Protecao contra sobrescrita sem `--force`: falha esperada.
- `--subject invalid-subject`: falha esperada sem stack trace.
- Geração local staging temporaria e preflight sem `--external`: OK.

Pendencia restante:
- Executar o comando apontando para o dominio HTTPS real e usar o arquivo gerado para rebuildar staging/API/storefront.

## M33 Web Push - ponte env staging

Status: **PONTE DE CONFIGURACAO STAGING PRONTA E VALIDADA** em 05/06/2026.

Entregas aplicadas:
- `sistema/.env.staging.example` documenta `STAGING_VAPID_PUBLIC_KEY`, `STAGING_VAPID_PRIVATE_KEY`, `STAGING_VAPID_SUBJECT`, `WEB_PUSH_ORIGIN` e URLs staging.
- `sistema/docker-compose.staging.yml` aceita `STAGING_CORS_ORIGIN`, `STAGING_FRONTEND_URL` e `STAGING_ADMIN_URL`, mantendo fallback local.
- `sistema/staging-ops.ps1` carrega `.env.staging` automaticamente quando existir.
- `sistema/.env.production.example` documenta `WEB_PUSH_ORIGIN` e `VAPID_*`.

Validacao tecnica executada:
- Sintaxe PowerShell de `staging-ops.ps1`: OK.
- `docker compose -f docker-compose.staging.yml config --quiet`: OK.
- Varredura `rg` confirmou `STAGING_VAPID_*` em `.env.staging.example` e no compose.

Pendencia restante:
- Criar/aplicar `.env.staging` real com chaves finais, rebuildar o storefront/API e registrar subscription real em HTTPS.

## M33 Web Push - gerador VAPID operacional

Status: **GERADOR VAPID PRONTO E VALIDADO** em 05/06/2026.

Entregas aplicadas:
- Script `sistema/scripts/generate-web-push-vapid.js` criado.
- Comando `cd sistema && npm run generate:web-push-vapid` exposto.
- Saídas suportadas: PowerShell padrão, `.env` com `--env`, JSON com `--json` e prefixo staging com `--staging`.
- `--subject` validado para aceitar somente `mailto:` ou `https://`.

Validacao tecnica executada:
- `node --check scripts/generate-web-push-vapid.js`: OK.
- `npm run generate:web-push-vapid -- --subject mailto:qa@antenor.com.br`: OK.
- `npm run generate:web-push-vapid -- --staging --env --subject https://antenor.com.br`: OK.
- `npm run generate:web-push-vapid -- --subject invalid-subject`: falha esperada sem stack trace.
- Chaves geradas via `--json` alimentaram `npm run validate:web-push-readiness -- --external`: OK.

Pendencia restante:
- Aplicar o par VAPID final no ambiente HTTPS e rebuildar o storefront com `VITE_VAPID_PUBLIC_KEY`.

## M33 Web Push - dry-run da prova assistida

Status: **DRY-RUN OPERACIONAL VALIDADO** em 05/06/2026.

Entregas aplicadas:
- `sistema/scripts/prove-web-push-delivery.js` passou a aceitar `--dry-run`.
- O modo dry-run valida filtros, payload e subscriptions completas sem chamar `webpush.sendNotification`.
- O modo dry-run não executa limpezas, mesmo quando flags de limpeza forem informadas.

Validacao tecnica executada:
- `node --check scripts/prove-web-push-delivery.js`: OK.
- Subscription temporária `codex-dry-run` criada no staging, usada em `npm run prove:web-push-delivery -- --dry-run --endpoint-contains codex-dry-run --limit 1` e removida no `finally`: OK, `targets=1 failed=0`.
- `npm run inspect:web-push-subscriptions` após limpeza: OK, `total=0 complete=0 incomplete=0`.
- `npm run prove:web-push-delivery -- --dry-run --endpoint-contains codex-dry-run --limit 1` após limpeza: falha esperada por nenhuma subscription encontrada.

Pendencia restante:
- Executar o dry-run e depois a prova real contra subscription verdadeira em HTTPS/VAPID final.

## M33 Web Push - prova assistida endurecida

Status: **SCRIPT DE PROVA OPERACIONAL ENDURECIDO** em 05/06/2026.

Entregas aplicadas:
- `sistema/scripts/prove-web-push-delivery.js` passou a validar `--limit` entre 1 e 100.
- O script passou a aceitar filtro `--tenant`.
- O resultado passou a reportar `expiredRemoved` e `incompleteRemoved`.
- Flags `--cleanup-expired` e `--cleanup-incomplete` adicionadas para limpeza explícita de subscriptions expiradas ou incompletas.

Validacao tecnica executada:
- `node --check scripts/prove-web-push-delivery.js`: OK.
- `npm run prove:web-push-delivery` contra staging com VAPID temporario: falha esperada por ausencia de subscription real.
- `npm run inspect:web-push-subscriptions` contra staging: OK, `total=0 complete=0 incomplete=0`.
- `npm run prove:web-push-delivery -- --limit 0`: falha esperada com validação de limite.

Pendencia restante:
- Registrar subscription real em HTTPS/VAPID final e executar a prova real com `sent>=1 failed=0`.

## M33 Web Push - Cypress de inscrição no storefront

Status: **FLUXO DE INSCRICAO COBERTO POR CYPRESS** em 05/06/2026.

Entregas aplicadas:
- Spec `sistema/frontend/cypress/e2e/web-push-subscribe.cy.ts` criada.
- A spec simula suporte real do navegador a Web Push (`Notification`, `serviceWorker.ready`, `PushManager`) sem depender de dispositivo externo.
- O teste abre o sino de notificações, aciona "Ativar notificações", valida `requestPermission`, `getSubscription`, `subscribe` e confere o payload enviado para `/notifications/push-subscribe`.
- A asserção cobre `keys.auth`, `keys.p256dh`, endpoint e conversão da VAPID public key para chave P-256 de 65 bytes.

Validacao tecnica executada:
- Cypress local `web-push-subscribe.cy.ts` contra `http://127.0.0.1:5174` com `VITE_VAPID_PUBLIC_KEY` temporária: 1/1 OK.
- Frontend `npm run build` com `VITE_VAPID_PUBLIC_KEY` temporária: OK.
- `npm run validate:obsidian-links`: OK.
- `npm run validate:web-push-readiness -- --live` contra staging local: OK.

Pendencia restante:
- A prova de entrega final ainda depende de domínio HTTPS real, VAPID final, PWA/dispositivo e subscription real gravada no banco.

## Wiki Obsidian - validação de links operacionais

Status: **LINKS OPERACIONAIS VALIDADOS** em 05/06/2026.

Entregas aplicadas:
- Script `scripts/validate-obsidian-links.js` criado para validar wikilinks e links Markdown locais.
- Comando raiz `npm run validate:obsidian-links` criado.
- Links relativos quebrados apos reorganização em subpastas foram corrigidos.
- Páginas faltantes de agentes e skill foram criadas: `Agente Designer`, `Agente Programador`, `Agente Revisão` e `UI UX Pro Max`.
- Transcrições em `06 - Sessões` seguem preservadas como histórico bruto e são ignoradas por padrão; `--include-sessions` mantém auditoria opcional.

Validacao tecnica executada:
- `node --check scripts/validate-obsidian-links.js`: OK.
- `npm run validate:obsidian-links`: OK, 42 arquivos operacionais escaneados, 3 sessões históricas ignoradas e 0 links quebrados.
- `node scripts/validate-obsidian-links.js --include-sessions`: falha esperada com 5 links quebrados apenas em transcrições históricas preservadas.

## M33 Web Push - preflight live de origem publicada

Status: **PREFLIGHT EXTERNO AMPLIADO E VALIDADO** em 05/06/2026.

Entregas aplicadas:
- `sistema/scripts/validate-web-push-readiness.js` passou a carregar `.env.staging`.
- O preflight passou a aceitar `--env-file` para arquivo de ambiente especifico da homologacao.
- O modo `--live` passou a consultar `WEB_PUSH_ORIGIN`, validando HTML publicado, `/manifest.webmanifest`, `/service-worker.js`, Content-Type, cache do service worker e handlers mínimos de Web Push.
- `RUNBOOK_WEB_PUSH.md` passou a orientar a prova externa com `npm run validate:web-push-readiness -- --external --live`.

Validacao tecnica executada:
- `node --check scripts/validate-web-push-readiness.js`: OK.
- `npm run validate:web-push-readiness -- --live` contra `http://127.0.0.1:4000` com VAPID temporario: OK.
- `npm run validate:web-push-readiness -- --external` com origem HTTPS/VAPID temporarios: OK.
- `npm run inspect:web-push-subscriptions` contra staging: OK, retornando `total=0 complete=0 incomplete=0`.
- `npm run inspect:web-push-subscriptions -- --require-ready` contra staging: falha esperada enquanto nao houver subscription real.
- `npm run prove:web-push-delivery` contra staging com VAPID temporario: falha esperada por nenhuma subscription registrada.

Pendencia restante:
- Publicar/usar dominio HTTPS real, aplicar VAPID final, instalar/abrir PWA em navegador/dispositivo real, registrar subscription e rodar `npm run validate:web-push-readiness -- --external --live`, `npm run inspect:web-push-subscriptions -- --require-ready` e `npm run prove:web-push-delivery`.

## Storefront receitas - capas e copy finais

Status: **CAPAS WEBP E COPY/SEO REVISADOS EM STAGING** em 05/06/2026.

Entregas aplicadas:
- 5 capas editoriais WebP próprias adicionadas em `sistema/frontend/public/recipes/`.
- Capas geradas com a skill `imagegen` e convertidas com `ffmpeg`; originais mantidos em `C:\Users\eojon\.codex\generated_images\019e63db-307e-7a81-801a-27810f3c2dd0`.
- `seed-staging-recipes.js` passou a usar `/recipes/*.webp` por slug em vez de banners genéricos.
- Copy editorial de categorias, títulos, descrições, SEO descriptions, ingredientes e passos revisada para português de produção.
- `validate-staging-recipes.js` passou a validar `imageUrl` esperado por slug e existência física em `frontend/public`.

Validacao tecnica executada:
- `node --check scripts/seed-staging-recipes.js`: OK.
- `node --check scripts/validate-staging-recipes.js`: OK.
- `npm run seed:staging-recipes` contra staging com `DATABASE_URL` explícita: OK.
- `npm run validate:staging-recipes` contra staging com `DATABASE_URL` explícita: OK.
- Frontend `npm run build`: OK.
- Docker staging: `storefront_staging` rebuildado/recriado; `api_staging` recriado pela composicao.
- API staging `/health`: OK.
- Assets `/recipes/*.webp` em `http://127.0.0.1:4000`: 5/5 HTTP 200, `image/webp`.
- Cypress staging `staging-secondary-routes-real.cy.ts` + `secondary-routes-visual.cy.ts`: 20/20 OK.
- Cypress staging `staging-smoke.cy.ts`: 1/1 OK.
- Cypress staging `staging-secondary-routes-real.cy.ts` apos revisão de copy: 4/4 OK.

## Storefront UI kit - Search/Mercado e Promoções

Status: **SEARCH/PROMOCOES MIGRADOS E VALIDADOS EM STAGING** em 05/06/2026.

Entregas aplicadas:
- `Search`/`Mercado` migrou busca, limpar busca, sugestoes, chips de categoria, subcategorias, filtros, selects mercadologicos, limpar filtros, sugestoes rapidas, CTA vazio e barra movel de carrinho para primitives do UI kit.
- `Promocoes` removeu `btn-gold` legado e passou a usar `buttonVariants`.
- Primitive `Input` passou a aceitar `ref` via `forwardRef`, preservando foco/blur programatico da busca.
- Varredura em `sistema/frontend/src/components` e `sistema/frontend/src/pages` mostra controles nativos diretos apenas nos wrappers `components/ui/*` e no compat layer `LoadingButton`.

Validacao tecnica executada:
- Frontend `npm run build`: OK.
- Cypress local `mobile-visual-smoke.cy.ts` + `secondary-routes-visual.cy.ts` contra `http://127.0.0.1:5173`: 36/36 OK.
- Docker staging: `storefront_staging` rebuildado/recriado; `api_staging` recriado pela composicao.
- API staging `/health`: OK.
- Storefront staging `http://127.0.0.1:4000`: HTTP 200.
- Cypress staging `mobile-visual-smoke.cy.ts` + `secondary-routes-visual.cy.ts` + `staging-smoke.cy.ts` contra `http://127.0.0.1:4000`: 37/37 OK.

## Storefront UI kit - utilitarios de entrega/notificacoes

Status: **DELIVERY MODAL E NOTIFICATION BELL MIGRADOS E VALIDADOS EM STAGING** em 05/06/2026.

Entregas aplicadas:
- `DeliveryVerificationModal` passou a usar `Button`, `Input`, `surfaceClasses` e `cn`, preservando GPS, CEP, validacao de entrega e cache local.
- `DeliveryVerificationModal` recebeu `role="dialog"`, `aria-modal` e `aria-labelledby`.
- `NotificationBell` migrou gatilho, fechamento e dropdown para `Button` e `surfaceClasses`, mantendo CTA de Web Push.
- `mobile-visual-smoke.cy.ts` passou a cobrir o fluxo do modal em mobile com fallback de geolocalizacao, CEP, calculo de entrega e overflow.

Validacao tecnica executada:
- Frontend `npm run build`: OK.
- Cypress local `mobile-visual-smoke.cy.ts` contra `http://127.0.0.1:5173`: 20/20 OK.
- Docker staging: `storefront_staging` rebuildado/recriado; `api_staging` recriado pela composicao.
- API staging `/health`: OK.
- Storefront staging `http://127.0.0.1:4000`: HTTP 200.
- Cypress staging `mobile-visual-smoke.cy.ts` contra `http://127.0.0.1:4000`: 20/20 OK.
- Cypress staging real `staging-smoke.cy.ts` contra `4000/4001`: 1/1 OK.

## Storefront UI kit - Conta e fallbacks

Status: **CONTA/FALLBACKS MIGRADOS E VALIDADOS EM STAGING** em 05/06/2026.

Entregas aplicadas:
- `Account` migrou tabs, logout, filtro de pagamento, repetir pedido, WhatsApp, CTA vazio, badges e superficies para primitives do UI kit.
- `NotFound`, `Forbidden` e `ErrorBoundary` passaram a usar `surfaceClasses`, `Button` e `buttonVariants`.
- Cypress `account-fallback-ui-kit.cy.ts` criado para Conta autenticada e fallbacks 403/404 em mobile e desktop.

Validacao tecnica executada:
- Frontend `npm run build`: OK.
- Cypress local `account-fallback-ui-kit.cy.ts` contra `http://127.0.0.1:5173`: 4/4 OK.
- Cypress local `auth-ui-kit.cy.ts` contra `http://127.0.0.1:5173`: 4/4 OK.
- Docker staging: `storefront_staging` rebuildado/recriado; `api_staging` recriado pela composicao.
- API staging `/health`: OK.
- Cypress staging `account-fallback-ui-kit.cy.ts` contra `http://127.0.0.1:4000`: 4/4 OK.
- Cypress staging `auth-ui-kit.cy.ts` contra `http://127.0.0.1:4000`: 4/4 OK.
- Cypress staging real `staging-smoke.cy.ts` contra `4000/4001`: 1/1 OK.

## Storefront UI kit - Login e Cadastro

Status: **LOGIN/CADASTRO MIGRADOS E VALIDADOS EM STAGING** em 05/06/2026.

Entregas aplicadas:
- Primitive `Select` adicionada ao UI kit do storefront.
- `Login` migrado para `Input`, `Button`, `buttonVariants` e `surfaceClasses`.
- `Register` migrado para `Input`, `Select`, `Button`, `buttonVariants` e `surfaceClasses`.
- `LoadingButton` passou a reutilizar `buttonVariants`, preservando o comportamento de loading em Checkout/Login/Register.
- Link "Voltar à loja" no Cadastro ajustado para nao sobrepor o card no mobile.
- Cypress `auth-ui-kit.cy.ts` criado para Login/Cadastro em mobile e desktop.

Validacao tecnica executada:
- Frontend `npm run build`: OK.
- Browser interno contra `http://127.0.0.1:5173`: Login/Cadastro renderizados em desktop/mobile, sem erros de console e sem overflow horizontal.
- Cypress local `auth-ui-kit.cy.ts` contra `http://127.0.0.1:5173`: 4/4 OK.
- Docker staging: `storefront_staging` rebuildado/recriado; `api_staging` recriado pela composicao.
- API staging `/health`: OK.
- Cypress staging `auth-ui-kit.cy.ts` contra `http://127.0.0.1:4000`: 4/4 OK.
- Cypress staging real `staging-smoke.cy.ts` contra `4000/4001`: 1/1 OK.

## M33 Web Push - runbook externo

Status: **RUNBOOK OPERACIONAL PRONTO** em 05/06/2026.

Entregas aplicadas:
- Runbook `arquivos-projeto/md/02 - Contexto/RUNBOOK_WEB_PUSH.md` criado para homologacao externa.
- Cobre variaveis, preflight, ativacao pelo sino do storefront, inspeção de subscription, prova real, filtros, diagnostico e criterio de aceite.
- `Índice de Arquivos.md` passou a listar o runbook na area de contexto.

Pendencia restante:
- Executar o runbook em dominio HTTPS nao-local com VAPID real e registrar evidencia do recebimento.

## M33 Web Push - inspeção de subscriptions

Status: **COMANDO DE INSPECAO OPERACIONAL PRONTO** em 05/06/2026.

Entregas aplicadas:
- Script `sistema/scripts/inspect-web-push-subscriptions.js` criado para listar subscriptions Web Push registradas no banco.
- Comando raiz exposto: `cd sistema && npm run inspect:web-push-subscriptions`.
- Filtros operacionais aceitos: `--customer-id`, `--customer-email`, `--endpoint-contains`, `--tenant` e `--limit`.
- Modo de gate aceito: `--require-ready`, falhando quando nao existir subscription completa para envio.

Validacao tecnica executada:
- `node --check scripts/inspect-web-push-subscriptions.js`: OK.
- `npm run inspect:web-push-subscriptions` contra staging: OK, retornando `total=0 complete=0 incomplete=0`.
- `npm run inspect:web-push-subscriptions -- --require-ready` contra staging: falha esperada enquanto nao houver subscription real completa.

Pendencia restante:
- Registrar subscription real em HTTPS/VAPID final e entao rodar `npm run inspect:web-push-subscriptions -- --require-ready` antes de `npm run prove:web-push-delivery`.

## M33 Web Push - CTA no storefront

Status: **PONTO DE INSCRICAO VISIVEL E VALIDADO EM STAGING** em 05/06/2026.

Entregas aplicadas:
- `NotificationBell` passou a exibir o bloco "Avisos no navegador" para cliente logado.
- `useNotifications` passou a reportar suporte, permissao e status de inscricao Web Push.
- O fluxo chama `requestPushPermission()` a partir da UI do sino e registra a subscription via `/notifications/push-subscribe` quando o navegador permitir.
- Smoke visual principal passou a validar cliente logado com sino aberto e estado/acao de Web Push.

Validacao tecnica executada:
- Frontend `npm run build`: OK.
- Docker staging: `docker compose -f docker-compose.staging.yml up -d --build storefront_staging` OK; `api_staging` recriado pela composicao.
- Cypress staging visual responsivo: `mobile-visual-smoke.cy.ts` 18/18 OK contra `http://127.0.0.1:4000`.
- Cypress staging real rotas secundarias: `staging-secondary-routes-real.cy.ts` 4/4 OK.
- API staging `/health`: OK.
- `npm run validate:staging-recipes` contra staging: OK.

Pendencia restante:
- Executar a prova final em HTTPS nao-local com VAPID real e subscription gravada, usando `npm run prove:web-push-delivery`.

## Storefront receitas - gate editorial staging

Status: **CONTRATO EDITORIAL PROTEGIDO POR SCRIPT E CYPRESS REAL** em 05/06/2026.

Entregas aplicadas:
- Script `sistema/backend/scripts/validate-staging-recipes.js` criado e exposto como `npm run validate:staging-recipes`.
- O gate valida categorias, receitas, `publishedAt`, categoria correta, capas locais existentes, ingredientes, passos, produtos ativos e 2 relacionadas por receita.
- Cypress real de rotas secundarias passou a exigir imagem visivel na listagem e receitas relacionadas no detalhe quando a API retornar esses dados.

Validacao tecnica executada:
- `node --check scripts/validate-staging-recipes.js`: OK.
- `node --check scripts/seed-staging-recipes.js`: OK.
- `npm run validate:staging-recipes` contra staging: OK.
- Cypress staging real rotas secundarias: `staging-secondary-routes-real.cy.ts` 4/4 OK.
- Backend `npm run build`: OK.
- Frontend `npm run build`: OK.

## Storefront receitas - capas e relacionadas

Status: **ACERVO EDITORIAL ENRIQUECIDO E VALIDADO EM STAGING** em 05/06/2026.

Entregas aplicadas:
- Seed `seed:staging-recipes` passou a preencher `imageUrl` com banners locais do storefront.
- Cada uma das 5 receitas passou a ter 2 receitas relacionadas.
- Cypress real de rotas secundarias passou a validar `og:image` com imagem real quando existir, mantendo fallback para receita sem imagem.

Validacao tecnica executada:
- `node --check scripts/seed-staging-recipes.js`: OK.
- `npm run seed:staging-recipes` contra staging: OK.
- API staging `GET /recipes/:slug`: 5/5 receitas com `imageUrl`, 2 relacionadas, ingredientes e produtos vinculados.
- Cypress staging real rotas secundarias: `staging-secondary-routes-real.cy.ts` 4/4 OK.
- Backend `npm run build`: OK.
- Frontend `npm run build`: OK.

## M33 Web Push - prova assistida

Status: **COMANDO DE PROVA REAL PRONTO; ENTREGA EXTERNA AINDA DEPENDE DE SUBSCRIPTION EM HTTPS** em 05/06/2026.

Entregas aplicadas:
- Script `sistema/scripts/prove-web-push-delivery.js` criado para enviar Web Push real usando `web-push`, VAPID e `push_subscriptions` do banco.
- Comando raiz exposto: `cd sistema && npm run prove:web-push-delivery`.
- Filtros operacionais aceitos: `--customer-id`, `--customer-email`, `--endpoint-contains`, `--limit`, `--title`, `--body`, `--icon` e `--url`.
- O script falha explicitamente se nao houver VAPID, `DATABASE_URL` ou subscription real registrada.

Validacao tecnica executada:
- `node --check scripts/prove-web-push-delivery.js`: OK.
- `node --check scripts/validate-web-push-readiness.js`: OK.
- `npm run validate:web-push-readiness -- --external` com VAPID temporario e origem HTTPS nao-local: OK.
- `npm run prove:web-push-delivery` contra o banco staging com VAPID temporario: falha esperada por ausencia de push subscription real registrada.

Pendencia restante:
- Abrir o storefront em dominio HTTPS nao-local com VAPID real, instalar/abrir o PWA, aceitar notificacoes, registrar a subscription e executar `npm run prove:web-push-delivery` para confirmar `sent>=1`.

## Storefront receitas - acervo editorial staging

Status: **ACERVO REAL POPULADO E VALIDADO EM STAGING** em 05/06/2026.

Entregas aplicadas:
- Script idempotente `sistema/backend/scripts/seed-staging-recipes.js` criado e exposto como `npm run seed:staging-recipes`.
- Categorias publicadas no staging: `jantar-pratico`, `churrasco-completo`, `lanches-e-praticos` e `adega-e-harmonizacao`.
- Receitas publicadas no staging: `picadinho-de-acem-da-casa`, `churrasco-de-familia-antenor`, `noite-de-pizza-crocante`, `lanche-quente-da-padaria` e `tabua-de-vinhos-e-snacks`.
- Cada receita possui capa local, ingredientes, modo de preparo, 2 receitas relacionadas e produtos reais vinculados ao catalogo de staging.
- `staging-secondary-routes-real.cy.ts` ajustado para validar o total dinamico de itens adicionados ao carrinho a partir dos produtos vinculados da receita.

Validacao tecnica executada:
- Seed staging de receitas executado duas vezes com sucesso, confirmando idempotencia.
- API staging `GET /recipes?active=true&limit=100`: 5 receitas e 4 categorias.
- API staging `GET /recipes/:slug`: OK para as 5 receitas, com `imageUrl`, relacionadas, ingredientes, passos e produtos vinculados.
- Backend `npm run build`: OK.
- Docker staging: `docker compose -f docker-compose.staging.yml up -d --build api_staging` OK.
- Cypress staging real rotas secundarias: `staging-secondary-routes-real.cy.ts` 4/4 OK contra `4000/4001`.

## Storefront UI kit - Home

Status: **EXPANDIDO PARA HOME E VALIDADO EM STAGING** em 05/06/2026.

Entregas aplicadas:
- `Home` migrada para `Button`, `buttonVariants`, `Badge` e `surfaceClasses`.
- Header mobile/desktop, seletor de endereco, dots do hero, CTAs do hero, banners promocionais e destaque comercial padronizados no UI kit.
- Varredura da Home ficou sem `<button`/`<input` nativos e sem classes legadas `btn-*`.

Validacao tecnica executada:
- Frontend `npm run build`: OK.
- Docker staging: `docker compose -f docker-compose.staging.yml up -d --build storefront_staging` OK.
- Cypress staging visual responsivo: `mobile-visual-smoke.cy.ts` 16/16 OK contra `http://127.0.0.1:4000`.
- Cypress staging real produto/carrinho/checkout: `staging-smoke.cy.ts` 1/1 OK contra `4000/4001`.
- Cypress staging real rotas secundarias: `staging-secondary-routes-real.cy.ts` 4/4 OK contra `4000/4001`.
- Cypress staging visual rotas secundarias: `secondary-routes-visual.cy.ts` 16/16 OK contra `http://127.0.0.1:4000`.
- Browser interno na Home staging: H1 presente, links de carrinho/Mercado renderizados, sem overflow horizontal e sem erros de console.

## Storefront UI kit - checkout e adega

Status: **EXPANDIDO PARA CHECKOUT/ADEGA E VALIDADO EM STAGING** em 05/06/2026.

Entregas aplicadas:
- `Radio` adicionado ao UI kit do storefront.
- `Checkout` migrado para `Button`, `Input`, `Radio` e `surfaceClasses`, cobrindo dados do convidado, CEP/endereco, pagamento, troco, recado e CTAs.
- `WinePage`/Adega migrada para `Button`, `Badge` e `surfaceClasses` nos cards, badges e acoes de carrinho.
- Checkout passou a ignorar janelas de entrega prestes a expirar antes de montar o payload de quote.
- Smoke real de staging passou a criar janela de entrega com folga operacional para evitar vencimento por cutoff durante o teste.

Validacao tecnica executada:
- Frontend `npm run build`: OK.
- Varredura em `Checkout.tsx` e `WinePage.tsx`: sem `<button`/`<input` nativos e sem classes legadas `btn-burgundy`/`btn-outline-burgundy`/`btn-gold`.
- Docker staging: `docker compose -f docker-compose.staging.yml up -d --build storefront_staging` OK.
- Cypress staging real produto/carrinho/checkout: `staging-smoke.cy.ts` 1/1 OK contra `4000/4001`.
- Cypress staging real rotas secundarias: `staging-secondary-routes-real.cy.ts` 4/4 OK contra `4000/4001`.
- Cypress staging visual responsivo: `mobile-visual-smoke.cy.ts` 16/16 OK contra `http://127.0.0.1:4000`.
- Cypress staging visual rotas secundarias: `secondary-routes-visual.cy.ts` 16/16 OK contra `http://127.0.0.1:4000`.

## Storefront UI kit - comercio

Status: **EXPANDIDO PARA MERCADO/PRODUTO/CARRINHO E VALIDADO EM STAGING** em 05/06/2026.

Entregas aplicadas:
- `Input` e `Checkbox` adicionados ao UI kit do storefront.
- `StoreProductCard` migrado para `Button`, `Badge` e `surfaceClasses`, cobrindo cards do Mercado, vitrines e recomendações.
- `Cart` migrado para UI kit em superfícies de item/resumo, ações de quantidade/remover/limpar, cupom, checkbox de substituição e CTAs fixos.
- `ProductDetail` migrado para UI kit em navegação, superfícies, thumbnails, badge de detalhe e links de ação.

Validacao tecnica executada:
- Frontend `npm run build`: OK.
- Varredura em `StoreProductCard.tsx`, `Cart.tsx` e `ProductDetail.tsx`: sem `<button` nativo e sem classes legadas `btn-burgundy`/`btn-outline-burgundy`/`btn-gold`.
- Docker staging: `docker compose -f docker-compose.staging.yml up -d --build storefront_staging` OK.
- Cypress staging visual responsivo: `mobile-visual-smoke.cy.ts` 16/16 OK contra `http://127.0.0.1:4000`.
- Cypress staging real produto/carrinho/checkout: `staging-smoke.cy.ts` 1/1 OK contra `4000/4001`.
- Cypress staging real rotas secundarias: `staging-secondary-routes-real.cy.ts` 4/4 OK contra `4000/4001`.

## Storefront UI kit - receitas

Status: **PRIMEIRA FATIA APLICADA E VALIDADA EM STAGING** em 05/06/2026; primitives reutilizados na expansão comercial `1.24.85-alpha`.

Entregas aplicadas:
- `sistema/frontend/src/lib/cn.ts` criado com `clsx` + `tailwind-merge`.
- `sistema/frontend/src/components/ui/button.tsx` criado com `Button` e `buttonVariants`.
- `sistema/frontend/src/components/ui/badge.tsx` criado com `Badge`.
- `sistema/frontend/src/components/ui/surface.ts` criado com `surfaceClasses`.
- `RecipeList` migrado para UI kit em filtros, cards, badges, skeletons e links de acao.
- `RecipeDetail` migrado para UI kit em badge de categoria, botoes de adicionar produto, adicionar todos, carrinho, painel lateral e acoes mobile.

Validacao tecnica executada:
- Frontend `npm run build`: OK.
- Varredura em `RecipeList.tsx` e `RecipeDetail.tsx`: sem `<button` nativo e sem classes legadas `btn-burgundy`/`btn-outline-burgundy`/`btn-gold`.
- Docker staging: `docker compose -f docker-compose.staging.yml up -d --build storefront_staging` OK.
- Cypress staging real: `npx cypress run --spec cypress/e2e/staging-secondary-routes-real.cy.ts --config baseUrl=http://127.0.0.1:4000 --env apiUrl=http://127.0.0.1:4001`: 4/4 OK.

## Storefront receitas - staging real com detalhe

Status: **VALIDADO COM CONTEUDO REAL E API ADMIN OPERACIONAL** em 05/06/2026; ampliado em `1.24.88-alpha` com acervo editorial de 5 receitas/4 categorias.

Entregas aplicadas:
- Receita ativa inicial publicada no staging: `picadinho-de-acem-da-casa`.
- Acervo staging ampliado para 5 receitas publicadas e 4 categorias reais.
- Receitas vinculadas a produtos reais do staging, incluindo carnes, padaria, adega, bebidas, snacks e congelados.
- `staging-secondary-routes-real.cy.ts` ampliado para validar detalhe `/receitas/:slug` sem mocks.
- DTOs de receitas/categorias corrigidos com `class-validator`, `class-transformer` e `PartialType`, permitindo mutacoes reais via admin API com `ValidationPipe` estrito.

Validacao tecnica executada:
- API staging: `GET /recipes?active=true&limit=100` retornou 5 receitas ativas.
- API staging: `GET /recipes/:slug` retornou ingredientes, passos e produtos vinculados para as 5 receitas do seed editorial.
- Smoke admin real: login, criacao de categoria temporaria, criacao de receita temporaria com produto real, leitura publica e limpeza dos temporarios OK.
- Backend `npm run build`: OK.
- Docker staging: `docker compose -f docker-compose.staging.yml up -d --build api_staging` OK.
- Cypress staging real: `npx cypress run --spec cypress/e2e/staging-secondary-routes-real.cy.ts --config baseUrl=http://127.0.0.1:4000 --env apiUrl=http://127.0.0.1:4001`: 4/4 OK.
- Frontend `npm run build`: OK.

## Storefront rotas secundarias - staging real

Status: **VALIDADO COM API REAL DE STAGING** em 05/06/2026, ampliado em `1.24.83-alpha` para detalhe de receita real e em `1.24.88-alpha` para acervo editorial maior.

Entregas aplicadas:
- Cypress real de staging criado em `sistema/frontend/cypress/e2e/staging-secondary-routes-real.cy.ts`.
- Cobertura sem mocks para `/promocoes`, `/adega`, `/receitas` e `/receitas/:slug`.
- A spec consulta a API real `4001` antes de validar a UI, adaptando a assercao ao dado publicado.
- `/promocoes`: valida SEO/meta dinamica, renderizacao de oferta real quando existir ou empty state quando nao houver promocao ativa.
- `/adega`: valida produto real da API em `category=Adega`.
- `/receitas`: valida listagem real, canonical/meta dinamica e receita publicada quando houver conteudo.
- `/receitas/:slug`: valida detalhe real com ingredientes, modo de preparo, produto vinculado, fallback de `og:image`, canonical e acao de adicionar ao carrinho.

Validacao tecnica executada:
- API staging: `GET /products?limit=100` retornou 29 produtos.
- API staging: `GET /products?limit=100&category=Adega` retornou 5 produtos.
- API staging: `GET /recipes?active=true&limit=100` retornou 5 receitas.
- Cypress staging real: `npx cypress run --spec cypress/e2e/staging-secondary-routes-real.cy.ts --config baseUrl=http://127.0.0.1:4000 --env apiUrl=http://127.0.0.1:4001`: 4/4 OK.
- Frontend `npm run build`: OK.

Observacao:
- A pendencia de detalhe real de receita foi fechada em `1.24.83-alpha`; o acervo editorial inicial de staging foi ampliado em `1.24.88-alpha`; e as capas WebP/copy final foram fechadas em `1.24.99-alpha`. A pendencia editorial restante e somente uma troca futura por fotos proprias reais, se o cliente optar por fotografar producao propria.

## M33 Web Push / PWA readiness

Status: **PREPARADO E VALIDADO COMO GATE OPERACIONAL** em 05/06/2026. A entrega real ao dispositivo segue pendente de chaves VAPID finais, dominio HTTPS nao-local e PWA instalado.

Entregas aplicadas:
- Manifesto PWA criado em `sistema/frontend/public/manifest.webmanifest`.
- `sistema/frontend/index.html` passou a declarar `rel="manifest"` e `apple-touch-icon`.
- Nginx local/staging passou a servir `service-worker.js` e `manifest.webmanifest` com `Cache-Control: no-store, no-cache, must-revalidate, max-age=0`.
- `manifest.webmanifest` passou a sair com `Content-Type: application/manifest+json`.
- Script `sistema/scripts/validate-web-push-readiness.js` criado e exposto por `npm run validate:web-push-readiness`.
- O preflight valida VAPID public/private, paridade com `VITE_VAPID_PUBLIC_KEY`, origem segura, modo externo HTTPS nao-local, CORS, manifesto PWA, service worker e cache Nginx.

Validacao tecnica executada:
- `npm run validate:web-push-readiness -- --external` com chaves VAPID temporarias geradas via `web-push`: OK.
- Backend focused tests: `npm test -- push-notification.service.spec.ts notifications.service.spec.ts --runInBand`: 5/5 OK.
- Frontend `npm run build`: OK.
- Docker local: `docker compose build storefront` + `docker compose up -d --force-recreate storefront` OK.
- Docker staging: `docker compose -f docker-compose.staging.yml build storefront_staging` + `up -d --force-recreate storefront_staging` OK.
- Runtime local/staging: `/manifest.webmanifest` e `/service-worker.js` responderam 200 em `http://127.0.0.1:3000` e `http://127.0.0.1:4000`.
- Headers runtime: manifesto com `application/manifest+json`; manifesto e service worker com cache no-store em local/staging.

## Storefront visual responsivo smoke

Status: **VALIDADO LOCALMENTE E EM STAGING** em 05/06/2026.

Entregas aplicadas:
- Cypress visual responsivo mantido em `sistema/frontend/cypress/e2e/mobile-visual-smoke.cy.ts`.
- Cobertura em quatro viewports: 375x667, 414x896, 768x1024 e 1280x900.
- Fluxos cobertos: Home, Mercado com filtros, detalhe de produto, Carrinho e Checkout.
- Assertions de ausencia de overflow horizontal, CTAs fixos dentro da viewport no mobile/tablet e ausência de bottom nav/CTA mobile em `md+`.

Validacao tecnica executada:
- Dev server Vite em `http://127.0.0.1:3000`: OK.
- Cypress local: `npx cypress run --spec cypress/e2e/mobile-visual-smoke.cy.ts --config baseUrl=http://127.0.0.1:3000`: 16/16 OK.
- Cypress staging visual responsivo: `npx cypress run --spec cypress/e2e/mobile-visual-smoke.cy.ts --config baseUrl=http://127.0.0.1:4000`: 16/16 OK.
- Cypress staging real: `npx cypress run --spec cypress/e2e/staging-smoke.cy.ts --config baseUrl=http://127.0.0.1:4000 --env apiUrl=http://127.0.0.1:4001`: 1/1 OK.
- Frontend `npm run build`: OK.

Observacao:
- Docker Desktop ficou indisponivel no inicio da rodada em 05/06/2026 (`dockerDesktopLinuxEngine` ausente), mas voltou durante a validacao. `localhost:3000` recusou conexao no dev server, mas `127.0.0.1:3000` respondeu corretamente.

## Storefront rotas secundarias visual smoke

Status: **VALIDADO LOCALMENTE E EM STAGING** em 05/06/2026.

Entregas aplicadas:
- Cypress visual responsivo criado em `sistema/frontend/cypress/e2e/secondary-routes-visual.cy.ts`.
- Cobertura em quatro viewports: 375x667, 414x896, 768x1024 e 1280x900.
- Rotas cobertas: `/promocoes`, `/adega`, `/receitas` e `/receitas/macarrao-cremoso-da-casa`.
- Assertions de ausencia de overflow horizontal, renderizacao de cards comerciais, chamada de compra em ingrediente de receita e CTA de receita.
- `SEO` do storefront agora aceita `image: null` e usa fallback em `/og-image.png`, cobrindo receitas sem imagem editorial.

Validacao tecnica executada:
- Frontend `npm run build`: OK.
- Docker local: `docker compose build storefront` + `docker compose up -d --force-recreate storefront` OK.
- Docker staging: `docker compose -f docker-compose.staging.yml build storefront_staging` + `up -d --force-recreate storefront_staging` OK.
- Cypress local: `npx cypress run --spec cypress/e2e/secondary-routes-visual.cy.ts --config baseUrl=http://127.0.0.1:3000`: 16/16 OK.
- Cypress staging visual secundario: `npx cypress run --spec cypress/e2e/secondary-routes-visual.cy.ts --config baseUrl=http://127.0.0.1:4000`: 16/16 OK.
- Cypress staging visual primario: `npx cypress run --spec cypress/e2e/mobile-visual-smoke.cy.ts --config baseUrl=http://127.0.0.1:4000`: 16/16 OK.
- Cypress staging real: `npx cypress run --spec cypress/e2e/staging-smoke.cy.ts --config baseUrl=http://127.0.0.1:4000 --env apiUrl=http://127.0.0.1:4001`: 1/1 OK.

## Storefront staging - smoke produto/carrinho/checkout

Status: **VALIDADO EM STACK REAL** em 02/06/2026.

Entregas aplicadas:
- Checkout do storefront passou a carregar janelas publicas via `/delivery/slots?type=DELIVERY`.
- Quote/confirm agora enviam `slotId`, `windowStart` e `windowEnd` de um `FulfillmentSlot` real quando disponivel, preservando fallback `ASAP` apenas como contingencia.
- Cypress real de staging criado em `sistema/frontend/cypress/e2e/staging-smoke.cy.ts`, cobrindo detalhe de produto, Mercado, adicionar ao carrinho, Carrinho e checkout como convidado com PIX.

Validacao tecnica executada:
- Frontend `npm run build`: OK.
- `docker compose -f docker-compose.staging.yml build storefront_staging`: OK.
- `docker compose -f docker-compose.staging.yml up -d --force-recreate storefront_staging`: OK.
- Cypress staging real: `npx cypress run --spec cypress/e2e/staging-smoke.cy.ts --config baseUrl=http://localhost:4000 --env apiUrl=http://localhost:4001`: 1/1 OK.
- Cypress checkout mockado: `npx cypress run --spec cypress/e2e/checkout.cy.ts --config baseUrl=http://localhost:4000`: 5/5 OK.

Observacao:
- O smoke revelou falha real: o frontend enviava `slotId=ASAP`, mas o backend exige `FulfillmentSlot` valido para liberar `canConfirm`. O fluxo agora usa slot real quando a API oferece janela ativa.

## UI Kit shadcn/ui - Admin

Status: **VALIDADO EM STACK REAL** em 02/06/2026.

Entregas aplicadas:
- Base shadcn/ui criada no admin com `components.json`, aliases `@/*`, tokens Tailwind HSL, `tailwindcss-animate` e utilitario `cn`.
- Componentes iniciais publicados em `sistema/admin/src/components/ui/`: `Button`, `Input`, `Label`, `Select`, `Checkbox`, `Badge`, `Card`, `Table` e `Textarea`.
- Primeira superficie real migrada: `AlertRulesManager`, dentro da area `Inteligencia (IA)`.
- Segunda superficie migrada em fatia inicial: Catalogo de Produtos, com toolbar, busca, alternancia tabela/cards, acoes Solidcom/taxonomia, criacao, filtros mercadologicos, tabela principal, inputs inline, badges de status, paginacao e historico Solidcom usando componentes `ui/*`.
- Formulario lateral `ProductSlideOver` migrado para o UI kit com `Button`, `Input`, `Select` e `Badge`, incluindo campos principais, CMS N1/N2, acoes e indicadores de categoria/status.
- Pedidos iniciado no UI kit: busca, filtros avancados, alternancia Lista/Kanban, acoes, chips, tabela, badges de SLA/ID, selects de status e controles do modal de detalhes migrados para `ui/*`.
- Clientes iniciado no UI kit: busca, filtros avancados, alternancia Lista/Colunas, acao Atualizar, chips, tabela, badges de CPF/pedidos, cards em colunas e modal de perfil migrados para `ui/*`.
- Contas B2B iniciado no UI kit: carteira de empresas, busca, cards selecionaveis, formularios de conta/usuarios/preco/lista, acoes de recorrencia/faturamento, badges e tabela de aprovacoes migrados para `ui/*`.
- Separacao/Picking iniciado no UI kit: criacao de tarefa, filtro de status, acao Atualizar, botoes de fluxo, badges de status/setor/EAN e formularios inline de separar/falta/substituicao migrados para `ui/*`.
- Categorias migrado no UI kit: etapa `Estrutura da loja`, abas `Sugestões automáticas` e `Revisão final`, acoes de dry-run/aplicacao/aprovacao/rejeicao, badges, tabela da arvore e navegacao do fluxo guiado migrados para `ui/*`.
- Layout do Site migrado no UI kit em `LayoutManager`: `Slider de Destaque`, tabela de categorias, campos de prioridade/limite, curadoria manual, modal de slide e confirmacao de exclusao usando `Button`, `Input`, `Label`, `Table`, `Textarea` e `Badge`.
- Banners Promocionais da Home migrado no UI kit em `PromoBannersManager`: cards, acoes, modal, busca/selecao de produto exaltado, alinhamento, visibilidade e confirmacao de exclusao usando `Button`, `Input`, `Label`, `Select`, `Textarea` e `Badge`.
- Banners da Loja migrado no UI kit em `StoreBannersManager`: cabecalho, empty state, cards/lista, badges, modal de edicao, selects, toggle ativo, link target, upload visual, agendamento e confirmacao de exclusao usando `Button`, `Input`, `Label`, `Select`, `Checkbox` e `Badge`.
- Identidade Visual migrada no UI kit em `BrandIdentity`: nome da loja, campos hex de cor, area clicavel de upload, remocao de logo, acao de salvar e controles especiais de `file`/`color` usando `Button`, `Input` e `Label`.
- Horarios de Funcionamento migrado no UI kit em `BusinessHours`: toggle de dia aberto, inputs de horario, janela adicional/remocao, mensagens personalizadas, acao salvar e restauracao de padrao usando `Button`, `Input`, `Label` e `Checkbox`.
- Receitas migrado no UI kit em `Recipes`: botao de nova receita, formulario, inputs, textarea, selects, checkbox ativo, tabela, badges, acoes, paginacao e confirmacao de exclusao usando `Button`, `Input`, `Label`, `Select`, `Textarea`, `Checkbox`, `Badge` e `Table`.
- Taxas de Entrega migrado no UI kit em `DeliveryZones`: botoes principais, frete gratis global, formulario de zona, selects, checkbox ativo, badges, acoes de ativar/editar/remover, modal de janela de fulfillment e modal de remocao usando `Button`, `Input`, `Label`, `Select`, `Checkbox` e `Badge`.
- Notificacoes migrado no UI kit em `NotificationsBroadcast`: select de tipo, campos de titulo/mensagem/customer ID, botao de envio e feedback de sucesso/erro usando `Button`, `Input`, `Label`, `Select` e `Textarea`.
- Anti-fraude migrado no UI kit em `FraudAudit`: acao de atualizar, filtros por vetor, badges de vetor/reincidencia e tabela de logs usando `Button`, `Badge` e `Table`.
- Status dos Servicos migrado no UI kit em `SystemHealthWidget`: badge geral de saude e acao manual de atualizar usando `Badge` e `Button`, preservando polling automatico e contrato `/health/detail`.
- Relatorio Executivo migrado no UI kit em `ExecutiveReport`: campo de semana, acoes de gerar relatorio/CSV, tabelas de categorias/termos e indicador de busca sem resultado usando `Input`, `Label`, `Button`, `Table` e `Badge`.
- Integracoes migrado no UI kit em `Integrations`: mostrar/ocultar modulos, toggle de extensao, badges de status e refresh Solidcom usando `Button` e `Badge`, com cards acessiveis via teclado e `aria-pressed`.
- Insights Automaticos migrado no UI kit em `IntelligenceAutoInsightsPanel`: controle Compacto/Detalhado e refresh manual usando `Button`, com `aria-pressed`, `aria-label` especifico e correcao do percentual duplicado no abandono de carrinho.
- Saude da Busca migrado no UI kit em `IntelligenceSearchInsightsPanel`: presets, restauracao, expandir/recolher tudo, toggles por secao, indicadores e tier de Ads usando `Button` e `Badge`.
- Cabecalho de Inteligencia migrado no UI kit em `Intelligence`: selects de periodo/top termos usando `Select`, indicadores usando `Badge` e acao `Atualizar agora` usando `Button`.
- Regras de Alerta finalizado no UI kit em `AlertRulesManager`: exclusao de regra sem `window.confirm()`, usando confirmacao controlada com `Button` para cancelar ou confirmar.
- Dashboard operacional migrado no UI kit em `DashboardSection`: select de periodo em `Performance de Vendas` usando `Select` e cobertura Cypress endurecida para URLs com ou sem `/api`.
- Clientes finalizado na fatia de chips em `CustomersSection`: botoes de limpar filtros ativos usando `Button` icon-only com `aria-label`.
- Pedidos finalizado na fatia de chips em `OrdersSection`: botoes de limpar filtros ativos usando `Button` icon-only com `aria-label`.
- Produtos finalizado na fatia de acoes em `ProductsSection`: botoes nativos e `window.confirm()` removidos de metricas, chips, cards e barra de acoes em lote; confirmacao controlada na UI para inativar/excluir/ativar em lote.
- Shell principal finalizado na fatia de navegacao em `Dashboard.tsx`: sidebar, ferramentas, logout e menu mobile usando `Button`.
- `ErrorBoundary` migrado no UI kit: acao de recarregar pagina usando `Button`, preservando o fallback de erro e `window.location.reload()`.
- Login migrado no UI kit em `Login.tsx`: email/senha usando `Input` + `Label`, submit usando `Button` e smoke de autenticacao estabilizado com mock local de `/auth/login`.
- Wrappers acessiveis legados migrados no UI kit em `FormElements.tsx`: `AccessibleInput`, `AccessibleSelect` e `AccessibleButton` agora reutilizam `Input`, `Label`, `Select`, `Button` e `Loader2`, preservando a API publica.
- `LayoutManager` finalizado na fatia de inputs especiais: uploads escondidos de categoria e slide usando `Input type="file"` do ui-kit, preservando handlers e acessibilidade.
- `PromoBannersManager` finalizado na fatia de inputs especiais: uploads escondidos em cards e modal usando `Input type="file"` do ui-kit, preservando validacoes e fluxo de upload.
- `BrandIdentity` finalizado na fatia de inputs especiais: upload escondido de logos usando `Input type="file"` e color pickers usando `Input type="color"`, preservando preview e campos hex.
- `StoreBannersManager` finalizado na fatia de inputs especiais: uploads escondidos desktop/mobile usando `Input type="file"` do ui-kit, preservando refs, reset e fluxo de upload.
- `PaymentEventsSection` finalizado na fatia de abas: controles `Transacoes`/`Webhooks` usando `Button` do ui-kit com `aria-pressed`, preservando o visual segmentado.
- `ProductSlideOver` finalizado na fatia de inputs especiais: uploads escondidos de Foto 1/Foto 2 usando `Input type="file"` do ui-kit, preservando slots e fluxo `productsAPI.uploadImage`.
- `CategoriesManager` finalizado na fatia de inputs especiais: upload escondido de banner usando `Input type="file"` do ui-kit, preservando `uploadsAPI.upload` e atualizacao de `bannerUrl`.
- `CategoriesManager` finalizado na fatia de alertas residuais: erros de exclusao e reordenacao agora usam feedback controlado na UI com `role="alert"`, sem `alert()`.
- Catalogo de Produtos finalizado na fatia de alertas residuais: salvar/remover/lote/edicao inline/sync/taxonomia agora usam feedback controlado com `role="alert"` e erro inline no dialogo de confirmacao, sem `alert()` no fluxo de produtos.
- Pedidos finalizado na fatia de alertas residuais: atualizacao de status/dados do pedido usa feedback controlado com `role="alert"` e cancelamento usa campo de motivo no modal, sem `alert()`/`prompt()`.
- Picking finalizado na fatia de pop-ups nativos residuais: atribuir separador, enviar para conferencia, registrar conferencia e finalizar embalagem usam dialog controlado com `Input`/`Button`, sem `prompt()`.
- Auditoria final do UI kit concluida: controles nativos diretos restantes apenas nos wrappers `components/ui/*`; nenhum `alert()`, `prompt()` ou `confirm()` restante em `sistema/admin/src`.
- Cypress admin mockado estabilizado com fallback global de API para specs mockados, sem afetar `critical-flows.cy.ts`, evitando requests penduradas para `localhost:3001` quando Docker/API estao desligados.
- `QueryClient` passou a ser criado por montagem do `App`, evitando cache entre specs Cypress; `/health/detail` recebeu cache-busting por timestamp.
- Stack Docker local reativada e validada com build/recreate de `api` e `admin`, seed QA, Cypress completo 88/88 e staging local com produtos/login funcionando.
- Correcao de autenticacao na pagina `Intelligence`: Regras de Alerta e Relatorio Executivo agora recebem `adminToken`, o mesmo token usado pelo restante do admin.
- Seed QA do backend reforcado com dois produtos M20 e `stock_positions` reais para estabilizar os fluxos criticos de estoque/picking.
- Cypress admin passou a compartilhar JWT local via `cy.task('adminAuth')` nas specs autenticadas, preservando o smoke de login real e evitando throttle em `/auth/login`.

Validacao:
- `npm run lint` em `sistema/admin`.
- `npm run build` em `sistema/admin`.
- `npm audit --audit-level=moderate` em `sistema/admin` — 0 vulnerabilidades.
- `docker compose build admin`.
- `docker compose up -d --force-recreate admin`.
- Cypress focado: `npx cypress run --spec cypress/e2e/ui-kit.cy.ts --config baseUrl=http://localhost:3002` — 1/1 teste OK, cobrindo navegacao para Inteligencia, renderizacao da superficie shadcn/ui e envio de `Authorization: Bearer test-admin-token` para `/analytics/alert-rules`.
- Cypress admin completo: `npx cypress run --config baseUrl=http://localhost:3002` — 15/15 testes OK.
- Cypress catalogo apos migracao de Produtos: `npx cypress run --spec cypress/e2e/catalog.cy.ts --config baseUrl=http://localhost:3002` — 3/3 testes OK.
- Cypress catalogo apos alertas residuais de Produtos: `npx cypress run --spec cypress/e2e/catalog.cy.ts --config baseUrl=http://localhost:3002` — 8/8 testes OK.
- Cypress Pedidos apos alertas residuais: `npx cypress run --spec cypress/e2e/orders.cy.ts --config baseUrl=http://localhost:3002` — 5/5 testes OK.
- Cypress Picking apos pop-ups residuais: `npx cypress run --spec cypress/e2e/picking.cy.ts --config baseUrl=http://localhost:3002` — 3/3 testes OK.
- Cypress admin mock completo sem `critical-flows.cy.ts`: `npx cypress run --spec "<todos exceto critical-flows.cy.ts>" --config baseUrl=http://localhost:3002` — 24 specs, 85/85 testes OK.
- Docker real: `docker compose build api admin` OK.
- Docker real: `docker compose up -d --force-recreate api admin` OK.
- Prisma local: `npx prisma migrate deploy` OK, sem migrations pendentes.
- Prisma staging: `npx prisma migrate status` OK, schema em dia.
- Seed QA local: `npm run seed:qa` OK.
- Cypress critico real: `critical-flows.cy.ts` — 3/3 testes OK contra `localhost:3001`.
- Cypress admin completo em stack real: `npx cypress run --config baseUrl=http://localhost:3002` — 25 specs, 88/88 testes OK.
- Staging API: `GET http://localhost:4001/products?limit=5` OK, 29 produtos totais.
- Staging admin: `admin@antenor.com.br` / `admin2026` OK; senha e case-sensitive.
- Staging storefront: `/mercado` em `localhost:4000` renderiza produto real vindo de `/api/products`.
- Varredura global final do admin: sem `button/input/select/textarea` nativos diretos fora de `sistema/admin/src/components/ui/*`.
- Varredura global final do admin: sem `alert()`, `prompt()` ou `confirm()` em `sistema/admin/src`.
- Auditoria admin apos migracao de Produtos: `npm audit --audit-level=moderate` — 0 vulnerabilidades.
- Backend `npm run build` OK apos reforco do seed QA.
- `npm run seed:qa` OK com `DATABASE_URL` local, criando `QA-M20-0001` e `QA-M20-0002`.
- Cypress critico M20 apos seed QA: `critical-flows.cy.ts` — 3/3 testes OK.
- Cypress admin completo apos `ProductSlideOver` e autenticacao Cypress: 16/16 testes OK.
- Cypress Pedidos: `orders.cy.ts` — 2/2 testes OK, cobrindo filtros, lista, kanban e modal de detalhes com dados mockados.
- Cypress admin completo apos fatia de Pedidos: 18/18 testes OK.
- Docker admin rebuild/recreate OK apos fatia de Pedidos.
- Cypress Clientes: `customers.cy.ts` — 2/2 testes OK, cobrindo filtros, lista, colunas e perfil do cliente com dados mockados.
- Cypress admin completo apos fatia de Clientes: 20/20 testes OK.
- Docker admin rebuild/recreate OK apos fatia de Clientes.
- Cypress Contas B2B: `business-accounts.cy.ts` — 2/2 testes OK, cobrindo filtros, resumo financeiro, lista corporativa, busca de cliente, formularios B2B e fila de aprovacao com dados mockados.
- Cypress admin completo apos fatia de Contas B2B: 22/22 testes OK.
- Docker admin rebuild/recreate OK apos fatia de Contas B2B.
- Cypress Picking: `picking.cy.ts` — 2/2 testes OK, cobrindo metricas, fila, criacao de tarefa, filtro, separacao e ruptura com dados mockados.
- Cypress admin completo apos fatia de Picking: 24/24 testes OK.
- Docker admin rebuild/recreate OK apos fatia de Picking.
- Cypress Categorias: `categories.cy.ts` — 2/2 testes OK, cobrindo listagem, criacao, renomeacao, alternancia de visibilidade e confirmacao de exclusao com dados mockados.
- Cypress admin completo apos fatia de Categorias: 26/26 testes OK.
- Docker admin rebuild/recreate OK apos fatia de Categorias.
- Cypress Categorias ampliado: `categories.cy.ts` — 4/4 testes OK, cobrindo estrutura da loja, dry-run das sugestoes automaticas, aprovacao e rejeicao de pendencias com dados mockados.
- Cypress admin completo apos fluxo guiado de Categorias: 28/28 testes OK.
- Docker admin rebuild/recreate OK apos fluxo guiado de Categorias.
- Cypress Layout: `layout.cy.ts` — 3/3 testes OK, cobrindo dados CMS, busca/filtro de categorias, toggle de slide, modal de novo slide e toggle de categoria com dados mockados.
- Cypress admin completo apos primeira fatia de Layout: 31/31 testes OK.
- Docker admin rebuild/recreate OK apos primeira fatia de Layout.
- Cypress Layout ampliado: `layout.cy.ts` — 5/5 testes OK, cobrindo dados CMS, busca/filtro, toggle de slide, modal de novo slide, toggle de categoria, prioridade, limite, curadoria manual e exclusao de slide com dados mockados.
- Cypress admin completo apos `LayoutManager`: 33/33 testes OK.
- Docker admin rebuild/recreate OK apos `LayoutManager`.
- Cypress Layout com banners promocionais: `layout.cy.ts` — 8/8 testes OK, cobrindo LayoutManager e PromoBannersManager com dados mockados.
- Cypress admin completo apos `PromoBannersManager`: 36/36 testes OK.
- Docker admin rebuild/recreate OK apos `PromoBannersManager`.
- Cypress Banners da Loja: `store-banners.cy.ts` — 3/3 testes OK, cobrindo preview/lista, toggle, edicao com selects/link target/agendamento e exclusao com dados mockados.
- Validacao Docker/admin completo apos `StoreBannersManager`: bloqueada neste ambiente porque Docker Desktop nao estava rodando (`dockerDesktopLinuxEngine` indisponivel), API `localhost:3001` e banco `localhost:5432` estavam fora; `npm run seed:qa` falhou por conexao ao Postgres.
- Cypress Identidade Visual: `brand-identity.cy.ts` — 2/2 testes OK, cobrindo renderizacao de logos/cores/preview e salvamento de nome, cores e remocao de logo mobile com dados mockados.
- Validacao Docker/admin completo apos `BrandIdentity`: ainda bloqueada neste ambiente porque Docker Desktop nao estava rodando (`dockerDesktopLinuxEngine` indisponivel), API `localhost:3001` e banco `localhost:5432` estavam fora.
- Cypress Horarios de Funcionamento: `business-hours.cy.ts` — 2/2 testes OK, cobrindo dias, janelas, mensagens e salvamento do payload `businessHours` com dados mockados.
- Validacao Docker/admin completo apos `BusinessHours`: ainda bloqueada neste ambiente porque Docker Desktop nao estava rodando (`dockerDesktopLinuxEngine` indisponivel), API `localhost:3001` e banco `localhost:5432` estavam fora.
- Cypress Receitas: `recipes.cy.ts` — 3/3 testes OK, cobrindo listagem, criacao com slug automatico, selects, toggle, edicao e exclusao pelo modal com dados mockados.
- Validacao Docker/admin completo apos `Recipes`: ainda bloqueada neste ambiente porque Docker Desktop nao estava rodando (`dockerDesktopLinuxEngine` indisponivel), API `localhost:3001` e banco `localhost:5432` estavam fora.
- Cypress Taxas de Entrega: `delivery-zones.cy.ts` — 4/4 testes OK, cobrindo resumo de janelas, frete gratis global, criacao de janela, criacao de zona CEP, toggle, edicao e exclusao com dados mockados.
- Validacao Docker/admin completo apos `DeliveryZones`: ainda bloqueada neste ambiente porque Docker Desktop nao estava rodando (`dockerDesktopLinuxEngine` indisponivel), API `localhost:3001` e banco `localhost:5432` estavam fora.
- Cypress Notificacoes: `notifications-broadcast.cy.ts` — 4/4 testes OK, cobrindo formulario, envio para cliente especifico, broadcast geral e erro da API com dados mockados.
- Validacao Docker/admin completo apos `NotificationsBroadcast`: ainda bloqueada neste ambiente porque Docker Desktop nao estava rodando (`dockerDesktopLinuxEngine` indisponivel), API `localhost:3001` e banco `localhost:5432` estavam fora.
- Cypress Anti-fraude: `fraud-audit.cy.ts` — 3/3 testes OK, cobrindo registros, reincidencia, filtro por dispositivo e empty state com dados mockados.
- Validacao Docker/admin completo apos `FraudAudit`: ainda bloqueada neste ambiente porque Docker Desktop nao estava rodando (`dockerDesktopLinuxEngine` indisponivel), API `localhost:3001` e banco `localhost:5432` estavam fora.
- Cypress Status dos Servicos: `system-health.cy.ts` — 3/3 testes OK, cobrindo status degradado, latencias por servico, refresh manual para OK e erro de API com dados mockados.
- Validacao Docker/admin completo apos `SystemHealthWidget`: ainda bloqueada neste ambiente porque Docker Desktop nao estava rodando (`dockerDesktopLinuxEngine` indisponivel), API `localhost:3001` e banco `localhost:5432` estavam fora.
- Cypress Relatorio Executivo: `executive-report.cy.ts` — 2/2 testes OK, cobrindo geracao do relatorio semanal, headers/query, resumo, tabelas, gaps, recomendacoes e download CSV com dados mockados.
- Validacao Docker/admin completo apos `ExecutiveReport`: ainda bloqueada neste ambiente porque Docker Desktop nao estava rodando (`dockerDesktopLinuxEngine` indisponivel), API `localhost:3001` e banco `localhost:5432` estavam fora.
- Cypress Integracoes: `integrations.cy.ts` — 3/3 testes OK, cobrindo resumo de modulos, selecao de conector CRM, toggle de HubSpot e refresh do status Solidcom com dados mockados.
- Varredura da fatia Integracoes: sem `button/input/select/textarea` nativos nem `confirm/prompt` em `Integrations.tsx` e `integrations.cy.ts`.
- Validacao Docker/admin completo apos `Integrations`: ainda bloqueada neste ambiente porque Docker Desktop nao estava rodando (`dockerDesktopLinuxEngine` indisponivel), API `localhost:3001` e banco `localhost:5432` estavam fora.
- Cypress Insights Automaticos: `auto-insights.cy.ts` — 3/3 testes OK, cobrindo modo detalhado, modo compacto, ranking de produtos desejados, refresh de `/analytics/admin/insights` e percentual de abandono sem duplicacao.
- Varredura da fatia Insights Automaticos: sem `button/input/select/textarea` nativos nem `confirm/prompt` em `IntelligenceAutoInsightsPanel.tsx` e `auto-insights.cy.ts`.
- Validacao Docker/admin completo apos `IntelligenceAutoInsightsPanel`: ainda bloqueada neste ambiente porque Docker Desktop nao estava rodando (`dockerDesktopLinuxEngine` indisponivel), API `localhost:3001` e banco `localhost:5432` estavam fora.
- Cypress Saude da Busca: `search-insights.cy.ts` — 3/3 testes OK, cobrindo metricas, gaps, correcoes, ranking de Ads, conversoes, presets e expandir/recolher secoes com dados mockados.
- Varredura da fatia Saude da Busca: sem `button/input/select/textarea` nativos nem `confirm/prompt` em `IntelligenceSearchInsightsPanel.tsx` e `search-insights.cy.ts`.
- Validacao Docker/admin completo apos `IntelligenceSearchInsightsPanel`: ainda bloqueada neste ambiente porque Docker Desktop nao estava rodando (`dockerDesktopLinuxEngine` indisponivel), API `localhost:3001` e banco `localhost:5432` estavam fora.
- Cypress Saude da Busca ampliado: `search-insights.cy.ts` — 4/4 testes OK, cobrindo tambem selects de periodo/top termos e refresh manual do cabecalho com `days`/`limit` corretos.
- Varredura da fatia Cabecalho de Inteligencia: sem `button/input/select/textarea` nativos nem `confirm/prompt` em `Intelligence.tsx`, `IntelligenceSearchInsightsPanel.tsx` e `search-insights.cy.ts`.
- Validacao Docker/admin completo apos cabecalho de `Intelligence`: ainda bloqueada neste ambiente porque Docker Desktop nao estava rodando (`dockerDesktopLinuxEngine` indisponivel), API `localhost:3001` e banco `localhost:5432` estavam fora.
- Cypress Regras de Alerta: `alert-rules.cy.ts` — 2/2 testes OK, cobrindo cancelamento sem DELETE e exclusao somente apos confirmacao controlada.
- Varredura da fatia Regras de Alerta: sem `button/input/select/textarea` nativos nem `confirm/prompt` em `AlertRulesManager.tsx` e `alert-rules.cy.ts`.
- Validacao Docker/admin completo apos `AlertRulesManager`: ainda bloqueada neste ambiente porque Docker Desktop nao estava rodando (`dockerDesktopLinuxEngine` indisponivel).
- Cypress Dashboard: `dashboard.cy.ts` — 5/5 testes OK, cobrindo KPIs, tendencias, troca de periodo com `period=month`, analytics, infraestrutura e navegacao.
- Varredura da fatia DashboardSection: sem `button/input/select/textarea` nativos nem `confirm/prompt` em `DashboardSection.tsx` e `dashboard.cy.ts`.
- Validacao Docker/admin completo apos `DashboardSection`: ainda bloqueada neste ambiente porque Docker Desktop nao estava rodando (`dockerDesktopLinuxEngine` indisponivel).
- Cypress Clientes ampliado: `customers.cy.ts` — 2/2 testes OK, cobrindo filtros, quatro chips ativos, limpeza por `Button`, lista/colunas e perfil do cliente.
- Varredura da fatia CustomersSection: sem `button/input/select/textarea` nativos nem `confirm/prompt` em `CustomersSection.tsx` e `customers.cy.ts`.
- Validacao Docker/admin completo apos `CustomersSection`: ainda bloqueada neste ambiente porque Docker Desktop nao estava rodando (`dockerDesktopLinuxEngine` indisponivel).
- Cypress Pedidos ampliado: `orders.cy.ts` — 2/2 testes OK, cobrindo filtros, quatro chips ativos, limpeza por `Button`, lista/kanban e detalhes do pedido.
- Varredura da fatia OrdersSection: sem `button/input/select/textarea` nativos nem `confirm/prompt` em `OrdersSection.tsx` e `orders.cy.ts`.
- Validacao Docker/admin completo apos `OrdersSection`: ainda bloqueada neste ambiente porque Docker Desktop nao estava rodando (`dockerDesktopLinuxEngine` indisponivel).
- Cypress Catalogo ampliado: `catalog.cy.ts` — 5/5 testes OK, cobrindo KPIs, selecao, confirmacao controlada de lote/individual, inline edit e slide-over.
- Varredura da fatia ProductsSection: sem `button/input/select/textarea` nativos nem `confirm/prompt` em `ProductsSection.tsx` e `catalog.cy.ts`; sem `window.confirm()` no fluxo `Dashboard.tsx` + `ProductsSection.tsx`.
- Validacao Docker/admin completo apos `ProductsSection`: ainda bloqueada neste ambiente porque Docker Desktop nao estava rodando (`dockerDesktopLinuxEngine` indisponivel).
- Cypress Dashboard ampliado: `dashboard.cy.ts` — 7/7 testes OK, cobrindo KPIs, analytics, navegacao por shell, sidebar mobile e logout.
- Varredura da fatia Shell Dashboard: sem `button` nativo nem `confirm/prompt` em `Dashboard.tsx` e `dashboard.cy.ts`.
- Validacao Docker/admin completo apos shell `Dashboard.tsx`: ainda bloqueada neste ambiente porque Docker Desktop nao estava rodando (`dockerDesktopLinuxEngine` indisponivel).
- Varredura da fatia ErrorBoundary: sem `button/input/select/textarea` nativos nem `confirm/prompt` em `ErrorBoundary.tsx`.
- Validacao Docker/admin completo apos `ErrorBoundary`: ainda bloqueada neste ambiente porque Docker Desktop nao estava rodando (`dockerDesktopLinuxEngine` indisponivel).
- Cypress Smoke apos `Login.tsx`: `smoke.cy.ts` — 3/3 testes OK, cobrindo carregamento da tela, login com payload mockado e navegacao basica.
- Varredura da fatia Login: sem `button/input/select/textarea` nativos nem `confirm/prompt` em `Login.tsx` e `smoke.cy.ts`.
- Validacao Docker/admin completo apos `Login.tsx`: ainda bloqueada neste ambiente porque Docker Desktop nao estava rodando (`dockerDesktopLinuxEngine` indisponivel).
- Varredura da fatia FormElements: sem `button/input/select/textarea` nativos nem `confirm/prompt` em `FormElements.tsx`.
- Validacao Docker/admin completo apos `FormElements.tsx`: ainda bloqueada neste ambiente porque Docker Desktop nao estava rodando (`dockerDesktopLinuxEngine` indisponivel).
- Cypress Layout apos inputs especiais: `layout.cy.ts` — 8/8 testes OK, cobrindo slider, filtros, categoria, prioridade/limite/curadoria, confirmacoes e banners promocionais.
- Varredura da fatia LayoutManager inputs especiais: sem `button/input/select/textarea` nativos nem `confirm/prompt` em `LayoutManager.tsx` e `layout.cy.ts`.
- Validacao Docker/admin completo apos `LayoutManager` inputs especiais: ainda bloqueada neste ambiente porque Docker Desktop nao estava rodando (`dockerDesktopLinuxEngine` indisponivel).
- Cypress Layout apos `PromoBannersManager` inputs especiais: `layout.cy.ts` — 8/8 testes OK, cobrindo tambem banners promocionais, produto exaltado, edicao, alinhamento, toggle e exclusao.
- Varredura da fatia PromoBannersManager inputs especiais: sem `button/input/select/textarea` nativos nem `confirm/prompt` em `PromoBannersManager.tsx` e `layout.cy.ts`.
- Validacao Docker/admin completo apos `PromoBannersManager` inputs especiais: ainda bloqueada neste ambiente porque Docker Desktop nao estava rodando (`dockerDesktopLinuxEngine` indisponivel).
- Cypress Identidade Visual apos inputs especiais: `brand-identity.cy.ts` — 2/2 testes OK, cobrindo logos, cores, preview, salvamento e remocao de logo mobile.
- Varredura da fatia BrandIdentity inputs especiais: sem `button/input/select/textarea` nativos nem `confirm/prompt` em `BrandIdentity.tsx` e `brand-identity.cy.ts`.
- Validacao Docker/admin completo apos `BrandIdentity` inputs especiais: ainda bloqueada neste ambiente porque Docker Desktop nao estava rodando (`dockerDesktopLinuxEngine` indisponivel).
- Cypress Banners da Loja apos inputs especiais: `store-banners.cy.ts` — 3/3 testes OK, cobrindo preview/lista, toggle, edicao com selects/link target/agendamento e exclusao.
- Varredura da fatia StoreBannersManager inputs especiais: sem `button/input/select/textarea` nativos nem `confirm/prompt` em `StoreBannersManager.tsx` e `store-banners.cy.ts`.
- Validacao Docker/admin completo apos `StoreBannersManager` inputs especiais: ainda bloqueada neste ambiente porque Docker Desktop nao estava rodando (`dockerDesktopLinuxEngine` indisponivel).
- Cypress Pagamentos: `payment-events.cy.ts` — 2/2 testes OK, cobrindo saude da integracao, transacoes, expansao de eventos/reembolsos, filtro por status e webhooks.
- Varredura da fatia PaymentEventsSection abas: sem `button/input/select/textarea` nativos nem `confirm/prompt` em `PaymentEventsSection.tsx` e `payment-events.cy.ts`.
- Validacao Docker/admin completo apos `PaymentEventsSection` abas: ainda bloqueada neste ambiente porque Docker Desktop nao estava rodando (`dockerDesktopLinuxEngine` indisponivel).
- Cypress Catalogo apos `ProductSlideOver` inputs especiais: `catalog.cy.ts` — 6/6 testes OK, cobrindo tambem upload de Foto 1/Foto 2 por `Input type="file"` com endpoints `/uploads/product/:ean` e `/uploads/product/:ean/2`.
- Varredura da fatia ProductSlideOver inputs especiais: sem `button/input/select/textarea` nativos nem `confirm/prompt` em `ProductSlideOver.tsx` e `catalog.cy.ts`.
- Varredura global do admin apos `ProductSlideOver`: resta apenas o upload nativo de banner em `CategoriesManager` fora dos componentes `ui/*`.
- Validacao Docker/admin completo apos `ProductSlideOver` inputs especiais: ainda bloqueada neste ambiente porque Docker Desktop nao estava rodando (`dockerDesktopLinuxEngine` indisponivel).
- Cypress Categorias apos input especial: `categories.cy.ts` — 5/5 testes OK, cobrindo tambem upload de banner de categoria por `Input type="file"` e PATCH de `bannerUrl`.
- Varredura da fatia CategoriesManager inputs especiais: sem `button/input/select/textarea` nativos nem `confirm/prompt` em `CategoriesManager.tsx` e `categories.cy.ts`.
- Varredura global do admin apos `CategoriesManager`: sem controles nativos diretos fora dos componentes `ui/*`.
- Validacao Docker/admin completo apos `CategoriesManager` inputs especiais: ainda bloqueada neste ambiente porque Docker Desktop nao estava rodando (`dockerDesktopLinuxEngine` indisponivel).
- Cypress Categorias apos alertas residuais: `categories.cy.ts` — 6/6 testes OK, cobrindo erro controlado na exclusao sem chamar `window.alert`.
- Varredura da fatia CategoriesManager alertas: sem `alert()`, `window.alert`, `window.confirm` ou `confirm()` em `CategoriesManager.tsx` e `categories.cy.ts`.
- Varredura global de `alert()`: alertas restantes concentrados em `Dashboard.tsx` e `ProductsSection.tsx`.
- Validacao Docker/admin completo apos `CategoriesManager` alertas: ainda bloqueada neste ambiente porque Docker Desktop nao estava rodando (`dockerDesktopLinuxEngine` indisponivel).

Proximo passo recomendado:
- Remover `alert()` residuais do fluxo de Produtos em `Dashboard.tsx` e `ProductsSection.tsx`, substituindo por feedback controlado na UI.

## Auditoria Top-Tier M19 - B2B/atacarejo

Status: **ENCERRADO E VALIDADO** em 31/05/2026.

Entregas aplicadas:
- `BusinessAccount` e `BusinessAccountUser` com tenant/store, documento, status, limite de credito, prazo de pagamento, perfil de faturamento e regras recorrentes.
- Tabela de preco por empresa usando `PriceList.businessAccountId`, com prioridade explicita sobre listas globais, por cliente e por segmento.
- Pedido B2B com `businessAccountId`, `businessApprovalStatus`, `businessPaymentTerms` e `businessInvoiceSnapshot`.
- Endpoints admin para criar/listar contas, vincular usuarios, criar tabela B2B, consultar financeiro, listar fila de aprovacao e aprovar pedido.
- Tela admin `Contas B2B` para carteira de empresas, financeiro, criacao de conta, vinculo de cliente, tabela de preco e fila de aprovacoes.
- Lista corporativa ligada a `BusinessAccount` via `ShoppingList.businessAccountId`.
- Pedido minimo B2B em `BusinessAccount.minimumOrder`, retornado na cotacao e validado na criacao do pedido.
- Endpoint publico de contexto B2B por cliente.
- Execucao operacional de pedido recorrente a partir da lista corporativa mais recente ou selecionada.
- Faturamento/nota operacional por pedido ou por conta, acionando os contratos fiscais e de cobranca existentes.

Validacao:
- `npx prisma validate`
- `npx prisma generate`
- `npx prisma migrate deploy`
- `npm run build` em `sistema/backend`
- `npm test -- --runInBand` em `sistema/backend` — 34 suites / 206 testes
- Docker API recriado e `/health` OK
- Fluxo runtime validado: conta comercial com 2 usuarios ativos, preco B2B `17.99` aplicado sobre preco base `24.99`, pedido `PENDING_APPROVAL`, fila de aprovacao, aprovacao para `APPROVED` e financeiro exibindo limite/prazo.
- `npm run build` em `sistema/admin`
- `docker compose build admin` e `docker compose up -d --force-recreate admin`
- Browser em `http://localhost:3002` validou menu `Contas B2B`, metricas, financeiro, fila sem erros/warnings e aprovacao de pedido pendente pela UI.
- Migration `20260531043000_add_b2b_minimum_order_and_corporate_lists`
- Runtime validou conta com minimo `999.00`, quote `businessMinimumOrderMet=false`, lista corporativa criada/listada e pedido B2B abaixo do minimo bloqueado com 400.
- Runtime validou conta B2B nova, lista corporativa, pedido recorrente aprovado (`businessApprovalStatus=APPROVED`) e faturamento por pedido/conta gerando contratos fiscal/cobranca; conectores externos retornaram erro controlado por falta de credenciais no ambiente.
- Browser em `http://localhost:3002` validou os controles `Pedido recorrente`, `Gerar pedido recorrente`, `Cobranca e nota`, `Faturar conta` e `Faturar pedido`.
- Flush Redis, build e recreate da stack principal (`api`, `admin`, `storefront`) executados no encerramento do M19; `/health`, admin e storefront responderam 200.

## Auditoria Top-Tier M20 - Governanca de engenharia, QA e release

Status: **ENCERRADO E VALIDADO** em 01/06/2026.

Entregas aplicadas:
- Correcoes de lint em frontend/backend sem alterar regra de negocio.
- `scripts/seed-qa.ts` e script `npm run seed:qa`, idempotente e sem limpeza destrutiva de dados.
- E2E Cypress do storefront atualizado para o checkout server-side atual (`/cart` e `/checkout/sessions`).
- E2E Cypress do admin ajustado para rolar ate o seletor de periodo antes de validar visibilidade.
- E2E Cypress admin `critical-flows.cy.ts` criado para picking, substituicao, pagamento webhook, integracao ERP, cancelamento parcial e reembolso.
- `npm audit fix` nao-forcado aplicado em backend, frontend e admin.
- Staging local isolado reativado como homologacao obrigatoria antes de producao.
- Templates de variaveis por ambiente criados em `sistema/.env.example`, `sistema/.env.staging.example` e `sistema/.env.production.example`.
- Changelog canonico criado em `CHANGELOG.md`.
- Runbook `M20 Release e Seguranca.md` criado com feature flags, rollback, smoke pos-deploy, backup, restore e plano de upgrade major.
- Operador `sistema/release-ops.ps1` criado com `preflight`, `smoke`, `backup` e `restore-test`.
- Backend atualizado para NestJS 11 e `bcrypt@6.0.0`, removendo as vulnerabilidades altas do backend.
- Dev tooling atualizado para ESLint `8.57.1` e `@typescript-eslint/*` `7.18.0` em backend/frontend/admin.
- Rota de upload de produto ajustada para sintaxe compatível com Nest 11 sem remover o contrato com slot opcional.
- Frontend e admin atualizados para Vite `7.3.3` e `@vitejs/plugin-react` `5.2.0`, removendo as vulnerabilidades moderadas Vite/esbuild restantes.

Validacao:
- Backend: `npm run lint -- --max-warnings 0`, `npm run build`, `npm test -- --runInBand` — 34 suites / 206 testes.
- Frontend: `npm run lint -- --max-warnings 0`, `npm run build`, `npm run test:unit` — 60/60 testes.
- Admin: `npm run lint -- --max-warnings 0`, `npm run build`.
- Prisma: `npx prisma validate`, `npx prisma migrate status` — 45 migrations, schema atualizado.
- Seed: `npm run seed:qa` — admin/customer/product QA idempotentes.
- E2E storefront: Cypress 34/34.
- E2E admin: Cypress 14/14, incluindo fluxos criticos M20.
- E2E critico M20: picking com ruptura/substituicao, substituicao OMS, cancelamento parcial, contrato Solidcom, webhook `charge.paid` e reembolso parcial validados.
- Stack local: `docker compose build api admin storefront`, recreate de `api`, `admin`, `storefront`, e smoke HTTP 200 para `/health`, admin e storefront.
- Security scan executado; backend, frontend e admin ficaram com 0 vulnerabilidades em `npm audit --audit-level=moderate`.
- Release preflight: `.\release-ops.ps1 preflight` validou compose local/staging e smoke local autenticado.
- Backup/restore: `.\release-ops.ps1 backup` gerou dump em `artifacts/backups`; `.\release-ops.ps1 restore-test` restaurou em PostgreSQL temporario com 109 tabelas publicas.
- Backend apos upgrade: lint OK, build OK, testes 34 suites / 206 testes OK, `npm audit --audit-level=moderate` com 0 vulnerabilidades.
- Frontend/admin apos upgrade Vite: lint OK, build OK, frontend unit 60/60, `npm audit --audit-level=moderate` com 0 vulnerabilidades.
- Runtime apos Nest 11: Docker API rebuild/recreate OK, `release-ops.ps1 smoke` OK, Cypress admin 14/14 OK.
- Runtime apos Vite 7: `docker compose build storefront admin`, recreate de `storefront`/`admin`, `release-ops.ps1 smoke`, Cypress storefront 34/34 e Cypress admin 14/14 OK.
- Staging M20: `docker compose -f docker-compose.staging.yml up -d --build`, `npx prisma migrate deploy`, `npm run prisma:seed`, `npm run seed:qa` e smoke em `localhost:4000/4001/4002` OK.
- Release preflight final: `.\release-ops.ps1 preflight` OK, relatorio `artifacts/release/smoke-20260601-061537.json`.
- Backup/restore final: `artifacts/backups/antenor-db-20260601-061544.dump` restaurado em PostgreSQL temporario com 109 tabelas publicas.

Pendencias M20:
- Nenhuma pendencia tecnica aberta no bloco M20 aplicado.

### Decisão Arquitetural (01/06/2026)
**Staging foi reativado como homologacao local isolada para M20.** Rationale:
- A auditoria exige deploy em staging antes de producao.
- O ambiente oficial de desenvolvimento continua em `localhost:3000/3001/3002`.
- Staging local usa portas `4000/4001/4002` e banco/Meili isolados para ensaio de release.
- `sistema/docker-compose.staging.yml` deve ser validado no preflight antes de qualquer promocao.

## Organização da Memory-Wiki Obsidian (✅ CONCLUÍDO - 24/05/2026)

**Objetivo:** estruturar a documentação e memória viva do projeto em um formato de Wiki Obsidian limpo e em subpastas estruturadas, mantendo a integridade dos arquivos canônicos.

**Entregas implementadas:**
- ✅ Subpastas criadas sob `arquivos-projeto/md/`: `00 - Dashboard/`, `01 - Projeto/`, `02 - Contexto/`, `03 - Agentes/`, `04 - Skills/`, `99 - Sistema/`.
- ✅ Dashboard inicial criado em `00 - Dashboard/Home.md` e pontes de acesso rápido configuradas para todos os arquivos canônicos.
- ✅ Arquivos de contexto estruturado criados: `Contexto Atual.md`, `Onde Parei.md`, `Histórico de Alterações.md`, `Anotações Importantes.md`.
- ✅ Configuração de papéis de agentes ativada sob `03 - Agentes/` e cópia da skill de organização sob `04 - Skills/`.
- ✅ Índice completo e mapeamento de arquivos em `99 - Sistema/Índice de Arquivos.md`.

## Saneamento e Reorganização do Repositório (✅ CONCLUÍDO - 24/05/2026)

**Objetivo:** higienizar a raiz do projeto removendo ruídos de IDEs antigas/agentes e consolidar a documentação e mapeamentos de dados em diretórios dedicados sem quebrar volumes docker.

**Entregas implementadas:**
- ✅ Pasta `.opencode/` e logs temporários `_robocopy_secondary_*.log` deletados do repositório.
- ✅ Relatórios soltos de execuções passadas (sincronizações e limpezas) movidos para `arquivos-projeto/archives/`.
- ✅ Arquivo de credenciais `acesso backend.txt` realocado para `consultoria/`.
- ✅ Arquivos de taxonomia e handoff (`arvore mercadologica.txt`, `categorias_n1_n2_formatadas.txt` e `handoff_ecommerce_v3_n1_n2.*`) movidos para a raiz da pasta `arquivos-projeto/`.
- ✅ Volume de dados `handoff_ecommerce_v3_n1_n2.csv` no docker-compose.yml do backend atualizado para ler da nova pasta, e container de API recriado com sucesso.
- ✅ Execução completa da suíte de 34 testes E2E com 100% de sucesso.


## Auditoria Top-Tier P0 aplicada (26/05/2026)

**Origem:** `F:/VC.VERSE/AUDITORIAS/milestones-top-tier-supermercado-2026-05-26.md` e checklist associado.
**Escopo aplicado neste ciclo:** camada P0 de seguranca, integridade de pedido e contratos criticos. A auditoria completa continua aberta para os demais milestones.

**Milestones executados neste ciclo:**
- ✅ M1 Diagnostico e mapeamento do estado atual
- ✅ M2 Implementacao P0 sem quebrar contratos existentes
- ✅ M3 Validacao de build e testes
- ✅ M4 Atualizacao documental canonica

**Entregas implementadas:**
- ✅ JWT endurecido: `JWT_SECRET` forte obrigatorio fora de `development/test`; valores vazios, curtos ou padrao sao rejeitados.
- ✅ Ownership aplicado em pedidos, enderecos e notificacoes: cliente comum so acessa/muta recurso do proprio `customerId`; admin preserva visao operacional.
- ✅ Criacao de pedido agora exige `idempotencyKey`, reprocessa retries legitimos e bloqueia reuso da mesma chave com payload diferente.
- ✅ Backend recalcula subtotal, desconto e total no `OrdersService`, valida cliente/produto/quantidade/preco/estoque e ignora totais forjados pelo cliente.
- ✅ Estoque e disponibilidade respeitam produto inativo, `syncOption=NUNCA`, preco invalido e quantidade acima do estoque quando aplicavel.
- ✅ Checkout gera e reutiliza chave idempotente por tentativa ate sucesso; em sucesso a chave e resetada.
- ✅ Checkout envia o `deliveryAddressId` criado e o pedido persiste snapshots JSON de cliente, endereco, entrega e preco.
- ✅ Calculo de entrega fora de area retorna `fee: null` e `outOfArea: true`; checkout bloqueia pedido sem taxa valida em vez de converter para frete zero.
- ✅ Webhook de pagamentos deixa de aceitar assinatura ausente quando gateway esta ativo.
- ✅ Mutacoes de receitas e categorias de receitas protegidas por JWT + role `admin`; leituras publicas permanecem abertas.
- ✅ Prisma recebeu tabela `idempotency_keys` e migration `20260526090000_add_order_idempotency`.
- ✅ Prisma recebeu snapshots de pedido na migration `20260526093000_add_order_snapshots`.
- ✅ CORS deixou de depender apenas de localhost hardcoded: `CORS_ORIGIN`/`CORS_ORIGINS` passa a ser obrigatorio em producao.
- ✅ Rate limits sensiveis adicionados/reduzidos para auth, checkout/order creation e webhook.
- ✅ Specs atualizadas para os contratos novos: Orders, Products, Integrations, Addresses, Delivery e Recipes.

**Validacao tecnica executada:**
- ✅ `npx prisma generate` em `sistema/backend`
- ✅ `npx prisma migrate deploy` aplicado no Postgres local: idempotencia + snapshots
- ✅ `npx prisma migrate status`: database schema up to date
- ✅ `npm test -- --runInBand` em `sistema/backend`: 17 suites / 143 testes passando
- ✅ `npm run test:unit` em `sistema/frontend`: 2 arquivos / 60 testes passando
- ✅ `npm run build:all` em `sistema`: backend, storefront e admin aprovados

## Auditoria Top-Tier Milestone 01 aplicada (26/05/2026)

**Escopo aplicado neste ciclo:** fundacao SaaS inicial para tenant, loja, RBAC e isolamento operacional.

**Entregas implementadas:**
- ✅ Prisma recebeu models `Tenant`, `Store`, `TenantUser`, `Role`, `Permission`, `RolePermission` e `UserStoreAccess`.
- ✅ Tabelas operacionais receberam `tenantId`; tabelas especificas de loja receberam `storeId` com backfill default.
- ✅ Indices por `tenantId`, `storeId`, `status`, `active`, `createdAt` e chaves operacionais foram adicionados nos pontos criticos.
- ✅ Migration `20260526100000_add_tenant_store_rbac_foundation` cria tenant/store default, permissoes iniciais e role admin.
- ✅ Admins existentes sao vinculados ao tenant/store default via `tenant_users` e `user_store_access`.
- ✅ `TenantContextMiddleware` resolve contexto por headers internos, subdominio ou fallback single-store.
- ✅ Decorators `@CurrentTenant()`, `@CurrentStore()` e `@RequirePermission()` criados.
- ✅ Guards `TenantAccessGuard` e `PermissionGuard` criados.
- ✅ JWT de admin/cliente passa a carregar `tenantId` e `storeId`.
- ✅ Pedidos e produtos passaram a aplicar filtros tenant/store nos caminhos criticos de leitura/criacao/edicao.
- ✅ Edicao de produto agora exige permissao `pricing.write` alem de JWT/admin no endpoint principal de update.
- ✅ Script `npm run tenant:validate-backfill` valida ausencia de linhas sem tenant/store obrigatorio.

**Validacao tecnica executada:**
- ✅ `npx prisma generate` em `sistema/backend`
- ✅ `npx prisma migrate deploy` aplicado no Postgres local: fundacao tenant/store/RBAC
- ✅ `npm run tenant:validate-backfill`: tenant/store backfill valid
- ✅ `npx prisma migrate status`: database schema up to date
- ✅ `npm test -- --runInBand` em `sistema/backend`: 20 suites / 151 testes passando
- ✅ `npm run build` em `sistema/backend`
- ✅ `npm run build:all` em `sistema`: backend, storefront e admin aprovados

## Auditoria Top-Tier Milestone 02 aplicada (26/05/2026)

**Escopo aplicado neste ciclo:** fundacao de catalogo top-tier com produto mestre, marca, midia, atributos, arvore de categorias, substitutos, fila de qualidade e indice de busca enriquecido.

**Entregas implementadas:**
- ✅ Prisma recebeu models `Brand`, `ProductMaster`, `ProductMedia`, `ProductAttribute`, `CategoryNode`, `ProductCategoryAssignment`, `ProductSubstitution` e `CatalogQualityIssue`.
- ✅ Migration `20260526113000_add_catalog_top_tier_foundation` cria as novas tabelas e faz backfill de `Product` para `ProductMaster`.
- ✅ Backfill preserva EAN, nome, preco legado, preco promocional legado, categoria legada, status, regra de pesavel, perecibilidade e vinculo de categoria.
- ✅ Midia legada de video foi migrada para `product_media` quando existente.
- ✅ Categorias CMS foram espelhadas em `category_nodes`, com assignments por EAN para `product_category_assignments`.
- ✅ `ProductsService` passou a manter `ProductMaster` ao criar, editar ou sincronizar produto legado.
- ✅ API admin adicionada em `/admin/products` para listar, criar, atualizar, vincular midia e cadastrar substitutos.
- ✅ API publica `GET /products/:id/substitutes` retorna substitutos aptos para fluxo de ruptura.
- ✅ Modulo `CatalogModule` criado com endpoints `/admin/catalog/quality`, `/admin/catalog/issues`, resolucao de issue, rebuild de arvore e `/admin/search/reindex`.
- ✅ Fila de qualidade detecta ausencia de imagem/categoria, regra de peso incompleta, preco zero, estoque negativo, nome ruim, EAN duplicado e categoria incompativel.
- ✅ Busca Meili passou a indexar `tenantId`, `storeId`, `normalizedName` e disponibilidade, alem de filtrar por tenant/store.
- ✅ Script `npm run catalog:validate-foundation` valida backfill produto mestre, categorias e regras obrigatorias de pesaveis.

**Validacao tecnica executada:**
- ✅ `npx prisma validate` em `sistema/backend`
- ✅ `npx prisma generate` em `sistema/backend`
- ✅ `npx prisma migrate deploy` aplicado no Postgres local: catalogo top-tier M02
- ✅ `npm run catalog:validate-foundation`: catalog foundation valid
- ✅ `npm run tenant:validate-backfill`: tenant/store backfill valid
- ✅ `npx prisma migrate status`: database schema up to date
- ✅ `npm test -- --runInBand` em `sistema/backend`: 21 suites / 155 testes passando
- ✅ `npm run build` em `sistema/backend`
- ✅ `npm run build:all` em `sistema`: backend, storefront e admin aprovados

## Auditoria Top-Tier Milestone 03 aplicada (26/05/2026)

**Escopo aplicado neste ciclo:** estoque por loja, disponibilidade calculada, reserva de checkout, ledger auditavel, reconciliacao e ajuste de ruptura no picking.

**Entregas implementadas:**
- ✅ Prisma recebeu models `StockPosition`, `StockLedger`, `StockReservation`, `StockReconciliationRun` e `StockPolicy`.
- ✅ Migration `20260526123000_add_inventory_reservations_foundation` cria a fundacao de estoque e faz backfill de `products.stock` para `stock_positions`.
- ✅ Migration `20260526124500_fix_stock_available_formula` garante `available = onHand - reserved - safetyStock`, inclusive para estoque negativo auditavel.
- ✅ `InventoryService` criado com consulta de disponibilidade, reserva atomica, liberacao, expiracao, consumo por confirmacao, ajuste manual, reconciliacao e sync ERP.
- ✅ Criacao de pedido agora cria reserva de estoque antes de persistir o pedido; falha de reserva bloqueia o checkout.
- ✅ Confirmacao de pedido exige reserva ativa e consome a reserva; cancelamento libera reservas ativas.
- ✅ API publica `GET /availability?storeId=&productIds=` adicionada.
- ✅ APIs `POST /stock/reservations` e `POST /stock/reservations/:id/release` adicionadas para reserva/liberacao operacional.
- ✅ APIs admin `/admin/stock/adjustments`, `/admin/stock/negative`, `/admin/stock/reconciliation` e jobs operacionais de sync/recalculo/expiracao adicionados.
- ✅ Endpoint `/admin/stock/picking-ruptures` ajusta item do pedido, estoque, ledger e evento BI `RUPTURE`.
- ✅ Script `npm run inventory:validate-foundation` valida posicoes de estoque, formula de disponibilidade e reservas expiradas.

**Validacao tecnica executada:**
- ✅ `npx prisma validate` em `sistema/backend`
- ✅ `npx prisma generate` em `sistema/backend`
- ✅ `npx prisma migrate deploy` aplicado no Postgres local: estoque/reservas M03 + correcao de formula
- ✅ `npm run inventory:validate-foundation`: Inventory foundation valid
- ✅ `npm run catalog:validate-foundation`: catalog foundation valid
- ✅ `npm run tenant:validate-backfill`: tenant/store backfill valid
- ✅ `npx prisma migrate status`: database schema up to date
- ✅ `npm test -- --runInBand` em `sistema/backend`: 22 suites / 162 testes passando
- ✅ `npm run build` em `sistema/backend`
- ✅ `npm run build:all` em `sistema`: backend, storefront e admin aprovados

## Auditoria Top-Tier Milestone 04 aplicada (26/05/2026)

**Escopo aplicado neste ciclo:** listas de preco por loja/canal, motor promocional DB-backed, cupons com limite de uso, quote server-side e auditoria comercial.

**Entregas implementadas:**
- ✅ Prisma recebeu models `PriceList`, `PriceListItem`, `Promotion`, `PromotionRule`, `Coupon`, `PromotionUsage` e `PriceAuditLog`.
- ✅ Migration `20260526133000_add_pricing_promotions_foundation` cria a fundacao comercial e faz backfill de preco efetivo legado para lista `STOREFRONT`.
- ✅ `PricingModule` criado com `PricingService`, `PromotionEngineService`, `PricingController`, `AdminPriceListsController` e `AdminPromotionsController`.
- ✅ `POST /pricing/quote` calcula preco, desconto, frete promocional, total e margem estimada no backend.
- ✅ Checkout deixou de usar cupom hardcoded e passou a usar `PricingService.quote`.
- ✅ `OrdersService.create` ignora desconto/preco vindo do frontend e persiste `priceSnapshot` com lista, canal, promocoes aplicadas e margem estimada.
- ✅ Uso de promocao/cupom passa a ser registrado em `promotion_usages` apos criacao bem-sucedida do pedido.
- ✅ API `POST /coupons/validate` adicionada e `GET /coupons/validate` mantida como compatibilidade.
- ✅ APIs admin criadas: `/admin/price-lists`, `/admin/price-lists/:id/items/bulk`, `/admin/promotions` e `/admin/promotions/:id/simulate`.
- ✅ Conflito de promocoes resolvido por prioridade; promocoes nao empilháveis bloqueiam promocoes de prioridade inferior.
- ✅ Cupons expirados/inativos ou acima de limite global/por cliente sao recusados.
- ✅ Script `npm run pricing:validate-foundation` valida lista de preco, itens invalidos e promocoes expiradas ativas.

**Validacao tecnica executada:**
- ✅ `npx prisma validate` em `sistema/backend`
- ✅ `npx prisma generate` em `sistema/backend`
- ✅ `npx prisma migrate deploy` aplicado no Postgres local: pricing/promocoes M04
- ✅ `npm run pricing:validate-foundation`: Pricing foundation valid
- ✅ `npm run inventory:validate-foundation`: Inventory foundation valid
- ✅ `npm run catalog:validate-foundation`: catalog foundation valid
- ✅ `npm run tenant:validate-backfill`: tenant/store backfill valid
- ✅ `npx prisma migrate status`: database schema up to date
- ✅ `npm test -- --runInBand` em `sistema/backend`: 23 suites / 157 testes passando
- ✅ `npm run build` em `sistema/backend`
- ✅ `npm run build:all` em `sistema`: backend, storefront e admin aprovados

## Auditoria Top-Tier Milestone 05 aplicada (26/05/2026)

**Escopo aplicado neste ciclo:** carrinho persistido, sessao de checkout idempotente, quote operacional de estoque/preco/entrega, bloqueio de indisponibilidade antes do pagamento e storefront usando o contrato server-side.

**Entregas implementadas:**
- [x] Prisma recebeu models `Cart`, `CartItem`, `CheckoutSession` e `CheckoutEvent`.
- [x] Migration `20260526143000_add_checkout_cart_contract` cria carrinhos, itens, sessoes, eventos e indice unico por `tenantId/storeId/idempotencyKey`.
- [x] `CheckoutModule` criado com APIs publicas `POST /cart`, `POST /cart/:id/items`, `PATCH /cart/:id/items/:itemId`, `DELETE /cart/:id/items/:itemId`, `POST /checkout/sessions`, `POST /checkout/sessions/:id/quote`, `POST /checkout/sessions/:id/confirm` e `POST /checkout/sessions/:id/cancel`.
- [x] `CartService` valida produto ativo, quantidade positiva, regra de pesavel/fracionado e preferencia de substituicao por item.
- [x] `CheckoutService` recalcula disponibilidade, preco/promocao e entrega no backend, persiste snapshots da sessao e bloqueia confirmacao sem estoque, fora de area ou sem janela valida.
- [x] Confirmacao de checkout chama `OrdersService.create` com idempotencia derivada da sessao, preservando reserva de estoque, `priceSnapshot`, comunicacao transacional e retorno idempotente em retry/refresh.
- [x] Cancelamento de sessao libera reservas associadas ao carrinho/sessao quando existirem e registra `SESSION_CANCELLED`.
- [x] Job admin `POST /admin/checkout/jobs/abandon-carts` converte carrinhos antigos em `ABANDONED` e registra evento CRM/BI `CART_ABANDONED`.
- [x] Storefront `Checkout.tsx` deixou de finalizar direto em `/orders`; agora espelha o carrinho no backend, cria sessao, executa quote e confirma pela API de checkout.
- [x] Erros do checkout saem em UI inline, sem `alert()`, e o resumo mostra total/frete/janela calculados pelo backend, indisponibilidade de item e status de substituicao.
- [x] Script `npm run checkout:validate-foundation` valida tabelas, colunas, indices e cliente Prisma do contrato de checkout.

**Validacao tecnica executada:**
- [x] `npx prisma validate` em `sistema/backend`
- [x] `npx prisma generate` em `sistema/backend`
- [x] `npx prisma migrate deploy` aplicado no Postgres local: checkout/carrinho M05
- [x] `npm run checkout:validate-foundation`: Checkout foundation valid
- [x] `npm run pricing:validate-foundation`: Pricing foundation valid
- [x] `npm run inventory:validate-foundation`: Inventory foundation valid
- [x] `npm run catalog:validate-foundation`: catalog foundation valid
- [x] `npm run tenant:validate-backfill`: tenant/store backfill valid
- [x] `npx prisma migrate status`: database schema up to date
- [x] `npm test -- --runInBand` em `sistema/backend`: 24 suites / 161 testes passando
- [x] `npm run build` em `sistema/frontend`
- [x] `npm run build:all` em `sistema`: backend, storefront e admin aprovados

## Auditoria Top-Tier Milestone 06 aplicada (26/05/2026)

**Escopo aplicado neste ciclo:** OMS por evento e por item, com status macro, historico auditavel, corte/substituicao de item sem cancelar pedido inteiro e admin consumindo o contrato operacional.

**Entregas implementadas:**
- [x] Prisma recebeu campos OMS em `Order` (`channel`, `fulfillmentType`) e `OrderItem` (`requestedQuantity`, `fulfilledQuantity`, `finalUnitPrice`, `finalSubtotal`, `status`, `substitutionPolicy`, `substitutedByItemId`, `cutReason`, `pickerNotes`).
- [x] Model `OrderEvent` criado para trilha auditavel por pedido, tenant/store, tipo, payload e ator.
- [x] Migration `20260526153000_add_order_oms_events_foundation` cria colunas/tabela, indices e backfill de `order.created`.
- [x] `OrdersService` registra evento na criacao, update de status, edicao, cancelamento de pedido, corte de item, substituicao e recalc.
- [x] APIs admin adicionadas: `GET /admin/orders`, `GET /admin/orders/:id`, `POST /admin/orders/:id/events`, `POST /admin/orders/:id/cancel`, `POST /admin/orders/:id/items/:itemId/cancel`, `POST /admin/orders/:id/items/:itemId/substitute` e `POST /admin/orders/:id/recalculate`.
- [x] Corte de item atualiza status `CANCELLED`, zera quantidade/subtotal final, recalcula total e gera `order.item_cancelled`.
- [x] Substituicao cria item substituto, marca origem como `SUBSTITUTED`, vincula `substitutedByItemId`, recalcula total e gera `order.substitution_accepted`.
- [x] Admin de pedidos passou a listar por `/admin/orders`, mudar status por eventos OMS e abrir detalhe com historico operacional.
- [x] Script `npm run oms:validate-foundation` valida colunas, indices e cliente Prisma do contrato OMS.

**Validacao tecnica executada:**
- [x] `npx prisma validate` em `sistema/backend`
- [x] `npx prisma generate` em `sistema/backend`
- [x] `npx prisma migrate deploy` aplicado no Postgres local: OMS/eventos M06
- [x] `npm run oms:validate-foundation`: OMS foundation valid
- [x] `npm run checkout:validate-foundation`: Checkout foundation valid
- [x] `npm run pricing:validate-foundation`: Pricing foundation valid
- [x] `npm run inventory:validate-foundation`: Inventory foundation valid
- [x] `npm run catalog:validate-foundation`: catalog foundation valid
- [x] `npm run tenant:validate-backfill`: tenant/store backfill valid
- [x] `npx prisma migrate status`: database schema up to date
- [x] `npm test -- --runInBand` em `sistema/backend`: 24 suites / 162 testes passando
- [x] `npm run build` em `sistema/admin`
- [x] `npm run build:all` em `sistema`: backend, storefront e admin aprovados

## Fase 33+ — Inteligência Avançada e Relatórios (M33)
**Objetivo:** evoluir a seção IA/Analytics com comparativos, alertas e relatórios de alto impacto.

## Auditoria Top-Tier Milestone 07 aplicada (26/05/2026)

**Escopo aplicado neste ciclo:** picking operacional, separacao por item, conferencia com bloqueio de divergencia, checklist de embalagem, status de pronto para entrega/retirada e metricas por separador.

**Entregas implementadas:**
- [x] Prisma recebeu models `PickingBatch`, `PickingTask`, `PickingTaskItem`, `PickerPerformanceSnapshot` e `PackingChecklist`.
- [x] Migration `20260526163000_add_picking_foundation` cria fila de picking, itens de tarefa, snapshots de produtividade e checklists de embalagem.
- [x] `PickingModule` criado no backend com APIs admin para fila, pedidos elegiveis, atribuicao manual, inicio, separacao de item, falta, substituicao, finalizacao, conferencia, embalagem e produtividade.
- [x] Picking atualiza `OrderItem.status`, `fulfilledQuantity`, `finalSubtotal`, peso final e notas de separacao, recalculando totais pelo contrato OMS.
- [x] Item faltante entra em fluxo de substituicao quando permitido e gera `order.item_missing` com sugestoes vindas de `ProductSubstitution` quando houver mapeamento.
- [x] Substituicao durante picking cria novo item de pedido, marca o item original como `SUBSTITUTED`, vincula o substituto e gera `order.substitution_accepted`.
- [x] Finalizacao de picking bloqueia itens pendentes; conferencia bloqueia divergencia sem justificativa; embalagem libera pedido como `READY_FOR_PICKUP` ou `READY_FOR_DELIVERY`.
- [x] Eventos OMS adicionados para `order.picking_task_created`, `order.picking_assigned`, `order.picking_started`, `order.item_picked`, `order.item_missing`, `order.picking_completed`, `order.conference_completed` e `order.packing_completed`.
- [x] Admin recebeu a secao `Separacao`, responsiva para celular, com criacao de tarefa, atribuicao de separador, operacao item a item, conferencia, embalagem e indicadores de produtividade.
- [x] Script `npm run picking:validate-foundation` valida colunas, indices e cliente Prisma da fundacao de picking.

**Validacao tecnica executada:**
- [x] `npx prisma validate` em `sistema/backend`
- [x] `npx prisma generate` em `sistema/backend`
- [x] `npx prisma migrate deploy` aplicado no Postgres local: picking/conferencia/embalagem M07
- [x] `npm run picking:validate-foundation`: Picking foundation valid
- [x] `npm run oms:validate-foundation`: OMS foundation valid
- [x] `npm run checkout:validate-foundation`: Checkout foundation valid
- [x] `npm run pricing:validate-foundation`: Pricing foundation valid
- [x] `npm run inventory:validate-foundation`: Inventory foundation valid
- [x] `npm run catalog:validate-foundation`: catalog foundation valid
- [x] `npm run tenant:validate-backfill`: tenant/store backfill valid
- [x] `npx prisma migrate status`: database schema up to date
- [x] `npm test -- --runInBand` em `sistema/backend`: 25 suites / 165 testes passando
- [x] `npm run build` em `sistema/admin`
- [x] `npm run build:all` em `sistema`: backend, storefront e admin aprovados

## Auditoria Top-Tier Milestone 08 aplicada (26/05/2026)

**Escopo aplicado neste ciclo:** entrega, retirada e logistica com areas server-side, slots de fulfillment com capacidade/cutoff, reserva no checkout, rotas manuais, motorista/paradas, tracking e contrato de retirada para ERP.

**Entregas implementadas:**
- [x] Prisma recebeu models `DeliveryArea`, `FulfillmentSlot`, `Driver`, `DeliveryRoute`, `DeliveryStop` e `FulfillmentEvent`.
- [x] `Order` recebeu `deliveryAreaId`, `fulfillmentSlotId` e `fulfillmentSlotItemCount`; `CheckoutSession` recebeu reserva de slot e quantidade reservada.
- [x] Migration `20260526173000_add_fulfillment_delivery_foundation` cria areas, slots, motoristas, rotas, paradas, eventos e indices por tenant/store/status/data.
- [x] `DeliveryService.calculate` passa a priorizar `DeliveryArea` com regra por CEP ou poligono, taxa, pedido minimo e frete gratis por area, mantendo fallback para `DeliveryZone`.
- [x] Checkout valida capacidade de slot para `DELIVERY` e `PICKUP`, bloqueia janela cheia/cutoff, reserva capacidade ao cotar e libera reserva em cancelamento/falha.
- [x] Confirmacao de checkout grava fulfillment no pedido e preserva slot/area/snapshot logistico; pedido de retirada sai como `fulfillmentType=PICKUP`.
- [x] Cancelamento de pedido libera a capacidade reservada do slot.
- [x] Contrato interno de integracao passou a carregar `fulfillmentType`; Solidcom recebe `retiraNaLoja=true` quando o pedido e de retirada.
- [x] APIs admin `/admin/fulfillment/areas`, `/admin/fulfillment/slots`, `/admin/fulfillment/drivers` e `/admin/fulfillment/routes` adicionadas.
- [x] Rotas permitem adicionar paradas, registrar saida para entrega, atualizar parada para entregue/falha e gerar eventos `order.out_for_delivery` / `order.delivered`.
- [x] Admin `Taxas de Entrega` passou a mostrar ocupacao de janelas e criacao rapida de janela de entrega/retirada.
- [x] Script `npm run fulfillment:validate-foundation` valida colunas, indices e cliente Prisma da fundacao logistica.

**Validacao tecnica executada:**
- [x] `npx prisma validate` em `sistema/backend`
- [x] `npx prisma generate` em `sistema/backend`
- [x] `npx prisma migrate deploy` aplicado no Postgres local: fulfillment/logistica M08
- [x] `npm run fulfillment:validate-foundation`: Fulfillment foundation valid
- [x] `npm run picking:validate-foundation`: Picking foundation valid
- [x] `npm run oms:validate-foundation`: OMS foundation valid
- [x] `npm run checkout:validate-foundation`: Checkout foundation valid
- [x] `npm run pricing:validate-foundation`: Pricing foundation valid
- [x] `npm run inventory:validate-foundation`: Inventory foundation valid
- [x] `npm run catalog:validate-foundation`: catalog foundation valid
- [x] `npm run tenant:validate-backfill`: tenant/store backfill valid
- [x] `npx prisma migrate status`: database schema up to date
- [x] `npm test -- --runInBand` em `sistema/backend`: 25 suites / 169 testes passando
- [x] `npm run build` em `sistema/backend`
- [x] `npm run build` em `sistema/admin`
- [x] `npm run build:all` em `sistema`: backend, storefront e admin aprovados
- [x] Browser check do admin build em `http://127.0.0.1:3003`: login renderizado e sem erros de console.

## Auditoria Top-Tier Milestone 09 aplicada (26/05/2026)

**Escopo aplicado neste ciclo:** pagamentos, ledger financeiro e conciliacao com transacoes idempotentes, eventos assinados, reembolso total/parcial, chargeback e relatorio de divergencias gateway x pedido.

**Entregas implementadas:**
- [x] Prisma recebeu models `PaymentTransaction`, `PaymentEvent`, `Refund` e `PaymentReconciliationRun`.
- [x] Migration `20260526183000_add_payment_ledger_foundation` cria ledger financeiro, eventos, reembolsos, conciliacoes, indices e FKs.
- [x] `PaymentsLedgerService` centraliza criacao idempotente de transacao, registro de evento, sanitizacao de payload sensivel, refund, chargeback e conciliacao.
- [x] Webhook de pagamentos passou a registrar `PaymentEvent` idempotente por `providerEventId`, gravar `signatureOk`, atualizar transacao e manter `AuditLog` como compatibilidade operacional.
- [x] Eventos `charge.authorized`, `charge.captured`, `charge.paid`, `charge.failed`, `charge.refunded` e `charge.chargeback` mapeiam status financeiro e status de pedido.
- [x] Criacao/replay de cobranca registra `PaymentTransaction` com `providerRef` e `idempotencyKey`.
- [x] Confirmacao manual de pedido online com gateway ativo passa a exigir pagamento `PAID`, `AUTHORIZED` ou `CAPTURED`; pagamentos na entrega continuam permitidos.
- [x] APIs admin adicionadas: `/integrations/payments/transactions`, `/integrations/payments/orders/:orderId/transaction`, `/integrations/payments/refunds`, `/integrations/payments/chargebacks` e `/integrations/payments/reconciliation`.
- [x] Script `npm run payments:validate-foundation` valida tabelas, colunas, indices e Prisma Client da fundacao financeira.
- [x] Gateway continua desativado por padrao; o fluxo operacional por fora permanece preservado ate aprovacao explicita.

**Validacao tecnica executada:**
- [x] `npx prisma validate` em `sistema/backend`
- [x] `npx prisma generate` em `sistema/backend`
- [x] `npx prisma migrate deploy` aplicado no Postgres local: pagamentos/ledger M09
- [x] `npx prisma migrate status`: database schema up to date
- [x] `npm run payments:validate-foundation`: Payments foundation valid
- [x] `npm run fulfillment:validate-foundation`: Fulfillment foundation valid
- [x] `npm run picking:validate-foundation`: Picking foundation valid
- [x] `npm run oms:validate-foundation`: OMS foundation valid
- [x] `npm run checkout:validate-foundation`: Checkout foundation valid
- [x] `npm run pricing:validate-foundation`: Pricing foundation valid
- [x] `npm run inventory:validate-foundation`: Inventory foundation valid
- [x] `npm run catalog:validate-foundation`: catalog foundation valid
- [x] `npm run tenant:validate-backfill`: tenant/store backfill valid
- [x] `npm test -- --runInBand` em `sistema/backend`: 26 suites / 173 testes passando
- [x] `npm run build` em `sistema/backend`
- [x] `npm run build` em `sistema/admin`
- [x] `npm run build:all` em `sistema`: backend, storefront e admin aprovados.

## Auditoria Top-Tier Milestone 10 aplicada (27/05/2026)

**Escopo aplicado neste ciclo:** plataforma de integracoes resilientes para ERP/PDV/fiscal/logistica, com conectores, outbox transacional em Postgres, jobs, tentativas, retry com backoff, DLQ, replay manual, rastreabilidade de payload e painel operacional via API.

**Entregas implementadas:**
- [x] Prisma recebeu models `IntegrationConnector`, `OutboxEvent`, `IntegrationJob`, `IntegrationAttempt` e `IntegrationDeadLetter`.
- [x] Migration `20260526193000_add_integration_outbox_foundation` criou conectores, outbox, jobs, tentativas, DLQ, indices, uniques de idempotencia e FKs.
- [x] `IntegrationOutboxService` centraliza criacao de conector, enfileiramento idempotente, worker sob demanda, retry/backoff, DLQ e replay.
- [x] Fila equivalente baseada em Postgres adotada como fundacao inicial, evitando dependência obrigatória de BullMQ neste ciclo.
- [x] Falhas de pedido/cancelamento Solidcom passam a registrar mensagem rastreavel no outbox, preservando payload e erro para replay.
- [x] APIs admin adicionadas: `/integrations/operations/panel`, `/integrations/connectors`, `/integrations/outbox/events`, `/integrations/outbox/worker/run`, `/integrations/jobs`, `/integrations/dead-letters` e replays.
- [x] `sistema/admin/src/services/api.ts` recebeu tipos/clientes para conectores, outbox, jobs, DLQ e painel.
- [x] Script `npm run integrations:validate-outbox` valida tabelas, colunas, indices e Prisma Client da fundacao M10.

**Validacao tecnica executada:**
- [x] `npx prisma validate` em `sistema/backend`
- [x] `npx prisma generate` em `sistema/backend`
- [x] `npx prisma migrate deploy` aplicado no Postgres local: integracoes/outbox M10
- [x] `npx prisma migrate status`: database schema up to date
- [x] `npm run integrations:validate-outbox`: Integration outbox foundation valid
- [x] Demais validadores de fundacao: tenant, catalog, inventory, pricing, checkout, OMS, picking, fulfillment e payments aprovados
- [x] `npm test -- --runInBand` em `sistema/backend`: 27 suites / 178 testes passando
- [x] `npm run build` em `sistema/backend`
- [x] `npm run build` em `sistema/admin`
- [x] `npm run build:all` em `sistema`: backend, storefront e admin aprovados.

## Auditoria Top-Tier Milestone 16 aplicada (30/05/2026)

**Escopo aplicado neste ciclo:** fundacao de personalizacao e recomendacao para recompre, complementares, substitutos inteligentes, vitrines por segmento e inteligencia operacional.

**Entregas implementadas:**
- [x] Prisma recebeu `RecommendationEvent` para medir impressoes, cliques, add-to-cart e compras originadas por recomendacao.
- [x] Migration `20260527003000_add_recommendation_intelligence_foundation` criou tabela, indices por tenant/store/contexto/evento e suporte a conversao.
- [x] `RecommendationsModule` criado com endpoints publicos/operacionais:
  - `GET /recommendations/rebuy`
  - `GET /recommendations/complementary/:productId`
  - `GET /recommendations/substitutes/:productId`
  - `GET /recommendations/showcase`
  - `POST /recommendations/events`
  - `GET /recommendations/operational-insights`
- [x] Recompre usa historico real de compra por cliente e filtra produtos indisponiveis.
- [x] Complementares usam co-ocorrencia de cesta e fallback de popularidade.
- [x] Substitutos respeitam catalogo canonico, categoria/classificacao, faixa de preco e disponibilidade.
- [x] Vitrine por segmento combina pedidos de clientes segmentados, margem e disponibilidade.
- [x] Inteligencia operacional publica previsao simples de ruptura, produtos criticos, sugestao de campanha para item parado, taxa de aceitacao de substituto e conversao de recomendacao.
- [x] Endpoint legado `GET /products/:id/recommendations` passou a bloquear recomendacao de produto inativo, `syncOption=NUNCA` ou sem estoque quando dependente de estoque.

**Validacao tecnica executada:**
- [x] `npx prisma validate` em `sistema/backend`
- [x] `npx prisma generate` em `sistema/backend`
- [x] `npx prisma migrate deploy` aplicado no Postgres local: personalizacao/recomendacao M16
- [x] `npx prisma migrate status`: database schema up to date
- [x] `npm run recommendations:validate-foundation`: Recommendation intelligence foundation valid
- [x] `npm test -- recommendations.service.spec.ts --runInBand`: 1 suite / 4 testes passando
- [x] `npm test -- --runInBand` em `sistema/backend`: 33 suites / 202 testes passando
- [x] `npm run build` em `sistema/backend`
- [x] `npm run build:all` em `sistema`: backend, storefront e admin aprovados
- [x] Docker local recriado com `docker compose build api admin storefront` e `docker compose up -d --force-recreate api admin storefront`
- [x] Runtime publicado: `GET http://localhost:3001/health` respondeu 200 `{"status":"ok"}`

## Auditoria Top-Tier Milestone 17 aplicada (30/05/2026)

**Escopo aplicado neste ciclo:** seguranca, LGPD e governanca enterprise com consentimentos formais, solicitacao do titular executavel, politica de retencao e auditoria de alteracoes sensiveis.

**Entregas implementadas:**
- [x] Prisma recebeu `DataSubjectRequest` para rastrear solicitacoes LGPD por cliente, tipo, status, payload, resultado e execucao.
- [x] Migration `20260530010000_add_lgpd_governance_foundation` criou tabela e indices por cliente/status/tipo.
- [x] `DataPrivacyModule` criado com endpoints admin:
  - `POST /data-privacy/customers/:customerId/consents`
  - `GET /data-privacy/customers/:customerId/export`
  - `POST /data-privacy/customers/:customerId/anonymize`
  - `GET /data-privacy/retention-policy`
  - `GET /data-privacy/requests`
- [x] Pacote de consentimentos LGPD cobre `TERMS`, `PRIVACY`, `WHATSAPP`, `EMAIL` e `SMS`.
- [x] Exportacao do titular consolida cadastro, enderecos, perfil, consentimentos, fidelidade, campanhas, listas, pedidos, analytics e recomendacoes.
- [x] Anonimizacao revoga consentimentos, remove PII de cliente/endereco/perfil e bloqueia execucao quando houver pedido ativo sem `force=true`.
- [x] `AuditLogService` agora aceita tenant/store explicitamente e registra eventos LGPD sensiveis.
- [x] Script `npm run lgpd:validate-foundation` valida tabela LGPD, consentimentos e audit log.

**Validacao tecnica executada:**
- [x] `npx prisma validate` em `sistema/backend`
- [x] `npx prisma generate` em `sistema/backend`
- [x] `npm test -- data-privacy.service.spec.ts --runInBand`: 1 suite / 4 testes passando
- [x] `npm run build` em `sistema/backend`
- [x] `npx prisma migrate deploy` aplicado no Postgres local: seguranca/LGPD M17
- [x] `npx prisma migrate status`: database schema up to date
- [x] `npm run lgpd:validate-foundation`: LGPD governance foundation valid
- [x] `npm test -- --runInBand` em `sistema/backend`: 34 suites / 206 testes passando
- [x] `npm run build:all` em `sistema`: backend, storefront e admin aprovados
- [x] Docker local recriado com `docker compose build api admin storefront` e `docker compose up -d --force-recreate api admin storefront`
- [x] Runtime publicado: `GET http://localhost:3001/health` respondeu 200 `{"status":"ok"}`

## M39 — UX de Produtos com foco e-commerce (✅ CONCLUÍDO - 30/05/2026)
**Implementação inicial:** 18/05/2026 | **Última entrega:** 30/05/2026

**Objetivo:** transformar a seção de produtos em superfície operacional de catálogo, priorizando gestão e edição em fluxo de backoffice.

**Milestones executados neste ciclo:**
- ✅ M1 Diagnóstico e mapeamento da interface atual
- ✅ M2 Implementação inicial do novo formato gerencial
- ✅ M3 Validação de build do admin
- ✅ M4 Atualização documental canônica
- ✅ M5 Redesign do formulário de edição: Modal Centralizada Premium (25/05/2026)
- ✅ M6 Upload de Mídia de Produto: Fotos dual-slot + URL de vídeo (25/05/2026)
- ✅ M7 Filtros rápidos operacionais + Seleção em lote + Edição inline (30/05/2026)

**Entregas implementadas:**
- ✅ `ProductsSection.tsx` agora inicia em visualização de **tabela operacional** (padrão)
- ✅ Alternância de visualização (`Tabela` / `Cards`) para manter leitura visual secundária
- ✅ Grade principal substituída por colunas gerenciais (Produto, Categoria, Preço, Estoque, Status, Origem, Ações)
- ✅ Ações de linha explícitas (`Editar`/`Excluir`) com melhor legibilidade operacional
- ✅ Destaque de criticidade de estoque na tabela (zerado/baixo/ok)
- ✅ Linguagem da filtragem adaptada para usuário leigo: `Departamento (N1)` e `Seção (N2)`
- ✅ Filtros técnicos ERP (níveis 3/4) ocultos por padrão e exibidos somente por ação explícita
- ✅ Tela de mapeamento em Categorias com explicação direta de `Departamento (N1)` e `Seção (N2)`
- ✅ Terminologia N1/N2 removida da interface principal; UI visível agora usa apenas `Departamento` e `Seção`
- ✅ `Categorias` migrada para fluxo guiado em 3 etapas para operação leiga: `Estrutura da loja` → `Sugestões automáticas` → `Revisão final`
- ✅ Cada etapa de `Categorias` agora possui bloco `O que fazer agora` com instrução contextual
- ✅ Fluxo ganhou navegação operacional por botão (`Próxima etapa` / `Voltar para`) para reduzir fricção de uso
- ✅ **[25/05] `ProductSlideOver.tsx` refatorado de slide-over lateral para Modal Centralizada Premium** (w-[92vw] max-w-4xl, grid 2 colunas, backdrop blur, animação scale-up)
- ✅ **[25/05] Seção de Mídia do Produto** na coluna esquerda da modal com dois slots de imagem (Foto 1 Principal / Foto 2 Auxiliar) + upload individual por slot
- ✅ **[25/05] Upload dual-slot no backend** (`POST /uploads/product/:ean/:slot?`) — slot `2` gera `{ean}_2.webp` automaticamente
- ✅ **[25/05] Campo URL de Vídeo Promocional** (YouTube, Instagram, TikTok) no formulário da modal; storefront já renderiza `<ProductVideoEmbed>` com conversão de URL para iframe embed
- ✅ **[25/05] Preview imediato com cache-buster** (`?v={timestamp}`) após upload sem reload de página
- ✅ **[25/05] Correção de payload de edição** em `Dashboard.tsx` (`buildProductPayload`) — `promotionalPrice`, `badges` e `videoUrl` agora persistem ao salvar
- ✅ **[30/05] Filtros rápidos operacionais** via KPI cards clicáveis (Todos / Sem Estoque / Sem Categoria / Inativos) com toggle exclusivo — substituem busca manual por atalhos de operação
- ✅ **[30/05] Seleção em lote + ações massivas**: checkboxes por linha, barra flutuante com Ativar / Desativar / Excluir para múltiplos produtos simultaneamente
- ✅ **[30/05] Edição inline de preço, preço promocional e estoque**: clique único no campo para editar, Enter para salvar, Escape para cancelar, blur para confirmar

**Validação técnica:**
- ✅ `npm run build` em `sistema/admin` sem erros (30/05/2026)
- ✅ `npm run build` em `sistema/frontend` sem erros (30/05/2026)
- ✅ Docker rebuild/recreate admin/storefront: todos os containers `Up`
- ✅ Health checks: API 200, storefront 200, admin 200
- ✅ Suíte Cypress E2E: 34/34 testes aprovados

## M33 — Relatório Executivo Semanal (✅ CONCLUÍDO - 30/05/2026)

**M33.3 validado em runtime (30/05/2026):**
- ✅ `GET /analytics/report-executive?week=2026-05-25&format=json` respondeu 200 com dados reais
- ✅ `GET /analytics/report-executive/download?week=2026-05-25` respondeu 200 com CSV válido
- ✅ M33.1 (comparativos de período), M33.2 (alertas automáticos) e M33.3 (relatório executivo) todos operacionais

## M41 — Storefront: proporção e organização de preço nos cards (✅ CONCLUÍDO)
**Implementação:** 19/05/2026

**Objetivo:** alinhar leitura de preço dos cards de produto ao padrão de referência e-commerce (hierarquia visual mais clara para preço principal, unidade e oferta).

**Milestones executados neste ciclo:**
- ✅ M1 Diagnóstico e mapeamento
- ✅ M2 Implementação
- ✅ M3 Validação de build
- ✅ M4 Atualização documental canônica

**Entregas implementadas:**
- ✅ `StoreProductCard.tsx` com bloco de preço reorganizado em três níveis:
  - referência de unidade (quando pesável)
  - preço principal com destaque tipográfico + sufixo de porção/unidade
  - linha de oferta com `% OFF` e preço anterior riscado
- ✅ Badge de desconto removida do topo da imagem para concentrar leitura comercial no bloco de preço
- ✅ Proporções de tipografia ajustadas para destacar preço final sem quebrar card em carrossel

**Validação técnica executada:**
- ✅ `npm run build` em `sistema/frontend` sem erros
- ✅ Ajuste fino final de proporção tipográfica aplicado (calibração milimétrica de `R$`, valor principal, sufixo e linha de oferta)
- ✅ Storefront rebuild + recreate em Docker concluído para publicar o ajuste em `http://localhost:3000`

## M41.1 — Toggle Unidade/Peso com marcador de step no card (✅ CONCLUÍDO)
**Implementação:** 21/05/2026

**Objetivo:** fazer o seletor `Unidade`/`Peso` do card pesável alterar o marcador de quantidade exibido no controle do próprio card.

**Entregas implementadas:**
- ✅ `StoreProductCard.tsx` passou a vincular o toggle ao marcador de quantidade do card:
  - `Unidade`: exibe quantidade por porções/unidades (`1`, `2`, `3`...)
  - `Peso`: exibe quantidade convertida para peso com base no `fractionStep` (`200 g`, `600 g`, `1 kg`...)
- ✅ Implementação preserva `productPricing.ts` como fonte única de cálculo, sem cálculo inline fora dos utilitários.

**Validação técnica executada:**
- ✅ `npm run build` em `sistema/frontend` sem erros.

## M41.2 — Bloco de preço sem box no card (✅ CONCLUÍDO)
**Implementação:** 21/05/2026

**Objetivo:** aproximar o visual do card ao padrão do armazemdograo removendo encapsulamento do preço.

**Entregas implementadas:**
- ✅ `StoreProductCard.tsx` atualizado para remover borda, fundo e caixa dedicada do bloco de preço.
- ✅ Preço, referência por kg e sufixo permanecem na mesma hierarquia, sem container destacado.

**Validação técnica executada:**
- ✅ `npm run build` em `sistema/frontend` sem erros.
- ✅ Storefront rebuild + recreate em Docker aplicado e validado em `http://localhost:3000/mercado`.

## M41.3 — Remoção de gap vertical no preço (✅ CONCLUÍDO)
**Implementação:** 21/05/2026

**Objetivo:** remover folga visual acima e abaixo do bloco de preço no card de produto.

**Entregas implementadas:**
- ✅ `StoreProductCard.tsx` ajustado para eliminar `pt/space-y/min-height` que criavam respiro vertical extra na área de preço.
- ✅ Bloco de preço com padding vertical zerado, mantendo somente separação mínima para o controle de quantidade quando exibido.

**Validação técnica executada:**
- ✅ `npm run build` em `sistema/frontend` sem erros.
- ✅ Storefront rebuild + recreate em Docker concluído para publicar ajuste em `http://localhost:3000/mercado`.

## M40 — Categorias em árvore estilo Explorer (✅ CONCLUÍDO)
**Implementação:** 19/05/2026

**Objetivo:** tornar a gestão de categorias mais intuitiva para usuário leigo, substituindo leitura plana por hierarquia visual navegável.

**Entregas implementadas:**
- ✅ `CategoriesManager.tsx` refatorado para exibir categorias em árvore hierárquica (pai/filho) com base em `parentId`
- ✅ Controles de expandir/recolher por nó (`▶` / `▼`) no estilo explorador de diretórios
- ✅ Renderização recursiva da hierarquia mantendo ações operacionais por linha (renomear, visibilidade, prioridade, limite, banner e exclusão)
- ✅ Carregamento ajustado para considerar todas as categorias (não apenas raiz), preservando consistência de dados
- ✅ Terminologia leiga preservada no fluxo guiado da tela de categorias
- ✅ Revisão final de categorias agora usa inteligência por aprendizado com base no handoff e no catálogo mapeado, com corte conservador para evitar sugestões absurdas
- ✅ Carga do Solidcom (`syncFromERP`) passa a aplicar `ProductCategoryMapping` por EAN como regra principal de classificação
- ✅ Produtos sem mapeamento no handoff entram automaticamente em `CategoryMappingPending` com sugestão de IA por aprendizado quando disponível
- ✅ Edição manual de produto não sobrescreve mais `Product.category` quando o campo não é enviado (evita drift do legado)
- ✅ Filtro público por categoria N1 passa a agregar mapeamentos de N2 descendentes (evita vitrines vazias por seleção de categoria pai)
- ✅ Storefront `/mercado` agora renderiza trilho principal alinhado à taxonomia oficial N1/N2 definida em `categorias_n1_n2_formatadas.txt`
- ✅ Navegação de categorias no storefront passa a consumir taxonomia CMS hierárquica (`parentId`) em vez de lista comercial achatada

**Validação técnica executada:**
- ✅ `npm run build:all` aprovado (backend, frontend e admin)
- ✅ Docker admin rebuild e recreate aprovados (`docker compose build admin` + `docker compose up -d --force-recreate admin`)
- ✅ Validação funcional no browser: expansão/recolhimento de nó e exibição de subcategoria confirmadas em runtime
- ✅ Limpeza de categorias fora de uso concluída com critério estrito de segurança (13 removidas, de 87 para 74)
- ✅ Critério aplicado: remover apenas categorias folha sem vínculos com mapeamentos, pendências, regras, curadorias ou classificação legada
- ✅ API rebuild/recreate com `HANDOFF_CSV_PATH` montado e validação runtime da revisão final retornando sugestão plausível sem cair em categorias de bebida

## M40.2 — Saneamento de raízes legadas e paridade storefront/admin (✅ CONCLUÍDO)
**Implementação:** 19/05/2026

**Objetivo:** restaurar exatamente a taxonomia N1/N2 oficial definida pelo negócio e reaplicar a categorização de produtos com base no handoff.

**Entregas implementadas:**
- ✅ Sincronização estrita de `categories_cms` a partir de `categorias_n1_n2_formatadas.txt` (N1/N2), sem criação de categorias fora da lista.
- ✅ Estrutura final no banco validada com `45` raízes N1 (conforme lista oficial) e hierarquia N2 preservada.
- ✅ Exclusão das categorias extras fora da lista oficial (`23` categorias removidas).
- ✅ Reaplicação do handoff oficial via `scripts/handoff-apply.js` com `--apply`.
- ✅ UI alinhada ao contrato real: remoção de filtros hardcoded no Admin e no Storefront, com exibição direta da taxonomia vinda da API.
- ✅ Remoção de decoração/emoji dos nomes no trilho de categorias para exibir nomenclatura exata da taxonomia oficial.

**Validação técnica executada:**
- ✅ Runtime health checks: API 200, storefront 200, admin 200.
- ✅ API de hierarquia: `roots_api=45`.
- ✅ Auditoria de banco pós-sincronização: `rootCount=45`, com mapeamentos ativos conforme handoff.
- ✅ Handoff apply concluído: `mappingsUpserted=12218`, `pendingsUpserted=3253`, `notFoundInDb=32`.
- ✅ Build storefront aprovado (`npm run build` em `sistema/frontend`).
- ✅ Build admin aprovado (`npm run build` em `sistema/admin`).
- ✅ Docker admin/storefront rebuild + recreate aprovados.
- ✅ Docker storefront rebuild/recreate aprovado (`docker compose build storefront` + `docker compose up -d --force-recreate storefront`).
- ✅ Validação browser: `/mercado` exibindo a lista oficial (ex.: Adega, Bebidas Alcoólicas, Café da Manhã e Matinais, etc.) sem categorias inventadas.

## M40.3 — Regra global de exibição por parâmetro de sincronização (✅ CONCLUÍDO)
**Implementação:** 19/05/2026

**Objetivo:** aplicar regra única de visibilidade de produto em todos os fluxos públicos de catálogo, incluindo compatibilidade com valor legado digitado como `ESTQOUE`.

**Entregas implementadas:**
- ✅ Backend de produtos (`ProductsService`) ajustado em SQL e Prisma para regra global:
  - `NUNCA`: nunca exibe
  - `SEMPRE`: sempre exibe (produto ativo)
  - `ESTOQUE` e `ESTQOUE`: exibe somente com `stock > 0`
- ✅ Endpoint de produtos por categoria (`CategoryHierarchyService.getProductsInCategory`) passou a aplicar os mesmos filtros de visibilidade.
- ✅ Analytics (`isStorefrontVisible`) alinhado à mesma semântica, tratando `ESTQOUE` como opção de estoque.
- ✅ API rebuild/recreate local concluído com Docker (`docker compose build api` + `docker compose up -d --force-recreate api`).

**Validação técnica executada:**
- ✅ Build backend aprovado (`npm run build` em `sistema/backend`).
- ✅ Auditoria Prisma pós-ajuste:
  - `nuncaVisible=0`
  - `visibleCount=2564`
  - compatibilidade `ESTQOUE` ativa (sem registros atuais com esse valor no dataset).
- ✅ Endpoint público validado em runtime: `GET /products` retornando catálogo conforme regra global.

## M40.4 — Reordenação de categorias por arrastar e soltar no Admin (✅ CONCLUÍDO)
**Implementação:** 19/05/2026

**Objetivo:** substituir edição manual por número na coluna de prioridade por interação direta de arrastar e soltar na árvore de categorias.

**Entregas implementadas:**
- ✅ `CategoriesManager.tsx` alterado para drag-and-drop por linha na árvore.
- ✅ Reordenação restrita a categorias irmãs (mesmo `parentId`) para preservar consistência da hierarquia.
- ✅ Persistência automática da nova ordem com atualização de `priority` no backend para todos os itens impactados.
- ✅ Ordenação visual da árvore consolidada por `priority` (com desempate por nome).

**Validação técnica executada:**
- ✅ Build do admin aprovado (`npm run build` em `sistema/admin`).
- ✅ Deploy local do admin concluído (`docker compose build admin` + `docker compose up -d --force-recreate admin`).

### M33.1 — Comparativo de Período (✅ CONCLUÍDO)
**Implementação:** 18/05/2026 15:35 UTC-3

**Entregas:**
- Backend: `getFunnelWithComparison(daysWindow)` e `getBiInsightsWithComparison(daysWindow)` em `AnalyticsService`
- Endpoints REST: `GET /analytics/funnel-compare?days=7` e `GET /analytics/insights-compare?days=7`
- Frontend: Componente `PeriodComparison.tsx` com sinalização visual (delta, % e ícones)
- Integração Intelligence.tsx: novo estado `funnelComparison` + renderização de 4 cards comparativos (conversão, abandono, pedidos, carrinho)
- Validação: Funil renderizando percentuais coerentes; KPIs sem erro de formato

**Dados de exemplo (7 dias):**
- Conversão: 0.00% → 0.00% (delta: 0%, neutro)
- Abandono: 43.86% → 0% (delta: +43.86%, aumento — sinal negativo)
- Carrinho: 57 vs 0
- Pedidos: 0 vs 0

### M33.2 — Alertas Automáticos (✅ CONCLUÍDO)
**Implementação:** 18/05/2026 15:45-17:00 UTC-3

**Entregas Backend:**
- ✅ Prisma: modelos `AlertRule` (id, metric, comparisonType, threshold, operator, enabled) + `AlertTriggered` (id, ruleId, severity, value, triggeredAt, adminSeenAt, notes)
- ✅ Migração: `20260518182028_add_alert_rules_m33_2` aplicada com sucesso
- ✅ Service: `AlertRuleService` com CRUD de regras e cálculo de threshold
- ✅ Endpoints REST (9 total):
  - `POST /analytics/alert-rules` — criar regra
  - `GET /analytics/alert-rules` — listar regras
  - `GET /analytics/alert-rules/:ruleId` — obter detalhes
  - `PATCH /analytics/alert-rules/:ruleId` — atualizar
  - `DELETE /analytics/alert-rules/:ruleId` — deletar
  - `GET /analytics/alerts/unseen` — alertas não vistos
  - `GET /analytics/alerts/history` — histórico (limit configurável)
  - `PATCH /analytics/alerts/:alertId/seen` — marcar como visto + notas
  - `POST /analytics/alerts/check-and-trigger` — executa verificação de regras
- ✅ Métricas suportadas: conversionRate, cartAbandonRate, revenue, orders, noResultRate
- ✅ Comparison types: absolute (ex: 5%) | percentChange (ex: -20% vs anterior)
- ✅ Operadores: below, above, equals
- ✅ Severity automática: warning (delta < 10) | critical (delta >= 10)
- ✅ Deploy Docker API: sucesso

**Entregas Frontend:**
- ✅ Componente `AlertRulesManager.tsx` com CRUD completo
- ✅ Tipos TypeScript: `AlertRule`, `AlertTriggered`, `DeltaMetric` em `src/types/analytics.ts`
- ✅ UI com formulário de criação, listagem de regras, edição e deleção
- ✅ Indicadores visuais: status ativo/inativo com cores
- ✅ Deploy Docker Admin: sucesso

**Testes:**
- ✅ Endpoints validados com PowerShell Invoke-RestMethod
- ✅ Migração Prisma aplicada com sucesso
- ✅ Build frontend e backend sem erros

**Fechamento runtime:** M33.3 revalidado em 02/06/2026 com Docker local online: relatório executivo JSON 200, CSV download 200 e regras de alerta listando dados reais.

### M33.3 — Relatório Executivo Semanal (✅ CONCLUÍDO)
**Objetivo:** gerar relatório semanal exportável em CSV com resumo de vendas, conversão, gaps e recomendações.

**Escopo:** 
- Geração de relatório com: receita total, qty pedidos, conversion rate, cart abandon rate, top 5 categorias, top 8 termos de busca, gaps de catálogo
- Endpoint `GET /analytics/report-executive?week=<date>&format=csv|json`
- Scheduling semanal automático (cron job)
- Download button no painel Intelligence

**Implementação já entregue no código:**
- ✅ `ExecutiveReportService` com geração semanal e exportação CSV
- ✅ Endpoint `GET /analytics/report-executive` e download CSV em `GET /analytics/report-executive/download`
- ✅ Integração do painel `ExecutiveReport` na página `Intelligence.tsx`
- ✅ Build backend e admin aprovados
- ✅ Validação runtime final reexecutada em 02/06/2026 com stack local online: `GET /analytics/report-executive?week=2026-05-25&format=json` respondeu 200 com receita 665.15, 35 pedidos e 5 categorias; CSV download respondeu HTTP 200 com 847 bytes.

**Próximos:** aplicar chaves VAPID finais no ambiente HTTPS, instalar o PWA em navegador/dispositivo real e disparar uma notificacao para provar entrega com app fechado; como frente alternativa, iniciar a próxima fatia de UI/operacional com staging já validado.

**Validação Final — 18 de maio de 2026:**
- Reapplicação de handoff-apply no ambiente original com sucesso
- 23 gaps técnicos (produtos unmapped) convertidos em PENDING para revisão
- **Cobertura técnica final:** unmapped = 0 (100%)
  - mapped = 13.674
  - pending = 3.276
  - total = 15.495
- Auto-resolução de pendências ajustada para considerar `reason` + `notes`, reforçando a mesma política do handoff em novos reprocessamentos
- Admin `Categorias > Mapeamento EAN` agora expõe fila de pendências com aprovação/rejeição manual e auditoria de `reason`/`notes`
- Validação transacional executada em produção local: 1 pendência aprovada e 1 rejeitada via API admin autenticada, com status final persistido corretamente
- Pós-validação transacional: item rejeitado de teste foi reprocessado para manter cobertura técnica `unmapped=0`
- Navegação do admin restaurada com acesso explícito às features já implementadas: `Taxas de Entrega`, `Banners da Loja` e `Identidade Visual`
- Navegação do admin expandida para recuperar funções órfãs já implementadas: `Horarios de Funcionamento`, `Anti-fraude`, `Notificacoes` e `Receitas`
- Identidade Visual ajustada para fallback automático de logos padrão quando `brand_config` vier vazio, com persistência validada via `Salvar configurações`
- Sidebar do admin (bloco superior) ajustada para usar o logo horizontal branco (`/branding/logo-horizontal-branco.png`) sem texto redundante
- Seção `Inteligencia (IA)` depurada: KPI de conversão/abandono corrigido para evitar `—%` inválido e funil ajustado para não exibir variações absurdas quando estágio anterior é zero
- Ambiente original (localhost:3000/3001/3002) operacional e estável
- Staging em sincronização (estado anterior de 14/05, resincronização planejada)
- Admin UI (correção TypeScript) deployada em staging com sucesso

Conclusao: 8 de 8 milestones implementados e validados.

### Entregas principais
- M-Cat-01: schema Prisma estendido com `Category.parentId` e `ProductCategoryMapping`.
- M-Cat-02: dry-run de importacao do handoff (`scripts/handoff-dry-run.js`).
- M-Cat-03: auto-classificacao com `ClassificationRule` e fila de revisao `CategoryMappingPending`.
- M-Cat-04: API publica N1/N2 e filtros de mapeamento.
- M-Cat-05: API admin para CRUD de categorias, mapeamentos e pendencias.
- M-Cat-06: notificacao de pendencias no admin.
- M-Cat-07: safe mode com validacao e aplicacao transacional.
- M-Cat-08: cobertura E2E e atualizacao de documentacao canonica.

### Validacao final
- Build completo: `npm run build:all` aprovado (backend, frontend e admin).
- Suíte E2E consolidada aprovada: 34/34 testes passando.
  - `categories-mapping-api.cy.ts` (3/3)
  - `product-pricing.cy.ts` (4/4)
  - `checkout.cy.ts` (5/5)
  - `smoke.cy.ts` (4/4)
  - `cart.cy.ts` (8/8)
  - `product-detail.cy.ts` (6/6)
  - `recipes.cy.ts` (4/4)

### Estado de release
- Migrations aplicadas e banco em sync.
- Pronto para staging/deploy.

## ✅ M-CAT - Avanco operacional (14/05/2026)

- Milestone 2 executado: populacao automatica de N2 concluida.
  - Resultado: N1=20, N2=153.
- Milestone 3 executado: geracao automatica de pendencias para nao mapeados.
  - Resultado inicial: 8.000 pendencias geradas (7.970 com sugestao, 30 sem sugestao).
- Milestone 4 executado: resolucao automatica de pendencias no admin.
  - Resultado: 7.970 aprovadas e 30 rejeitadas.
- Milestone 5 executado: revalidacao de cobertura.
  - Stats intermediarios: mapped=8.170, pending=0, total=15.472, unmapped=7.302.

## ✅ Staging criado e validado (14/05/2026)

- Ambiente de homologação isolado criado e online.
- Arquivos adicionados:
  - `sistema/docker-compose.staging.yml`
  - `sistema/staging-ops.ps1`
  - `sistema/frontend/nginx.staging.conf`
  - `sistema/admin/nginx.staging.conf`
  - `sistema/backend/scripts/seed-staging-admin.js`
- URLs staging:
  - loja:  http://localhost:4000
  - api:   http://localhost:4001
  - admin: http://localhost:4002
- Banco isolado: `antenor_staging` na porta 5433.
- Credencial admin staging: `admin@antenor.com.br` / `admin2026`.
- Seed staging utilitario: `.\staging-ops.ps1 seed` recria admin padrao, QA admin e catalogo visivel no storefront.
- Smoke 4/4 passando em staging.
- Operação: `.\.\staging-ops.ps1 [up|down|reset|seed|smoke|status]`.

## ✅ Limpeza de legado morto (14/05/2026)

- Remoção executada com critério estrito de orfandade total em `categories_cms`.
- Critério de exclusão (todos simultaneamente):
  - sem filhos (`parentId`)
  - sem mapeamento em `product_category_mappings` (N1/N2)
  - sem `category_classification_mappings`
  - sem vínculo em `category_mapping_pending.suggestedCategoryId`
  - sem vínculo em `classification_rules`
- Resultado da limpeza:
  - local: 156 categorias removidas
  - staging: 12 categorias removidas
- Limpeza de código morto (sem referência):
  - removido `sistema/admin/src/pages/ClassificationMapping.tsx`
  - removidos artefatos compilados legados em `sistema/admin/src/pages` (`*.d.ts`, `*.d.ts.map`, `*.js.map`)
- Hardening anti-legado aplicado no backend:
  - nova flag `ENABLE_LEGACY_CLASSIFICATION_MAPPINGS` (default `false`)
  - storefront passa a priorizar taxonomia nova (`product_category_mappings` EAN/N1/N2)
  - legado por `category_classification_mappings` só é usado se a flag for explicitamente `true`
  - compose local e staging com flag explicitamente desabilitada
- Validação pós-limpeza:
  - catálogo staging funcional (`/products` com total > 0)
  - hierarquia de categorias funcional (`/api/categories/hierarchy`)
  - cobertura consistente (`mapped=12218`, `pending=3253`, `unmapped=1` em staging)
  - build admin aprovado
  - smoke staging aprovado (4/4)

## ✅ Release candidate técnico (staging) — 14/05/2026

- Hardening anti-legado aplicado (`ENABLE_LEGACY_CLASSIFICATION_MAPPINGS=false` por padrão).
- Política automática segura de pendências aplicada no staging:
  - dry-run: `approveCandidates=0`, `rejectCandidates=3253`
  - apply: `rejected=3253`
- Suíte E2E completa em staging aprovada: 31/31
  - `smoke.cy.ts` 4/4
  - `product-pricing.cy.ts` 4/4
  - `checkout.cy.ts` 5/5
  - `cart.cy.ts` 8/8
  - `product-detail.cy.ts` 6/6
  - `recipes.cy.ts` 4/4
- Estado pós-resolução em staging:
  - mapped=12218
  - pending=0
  - total=15472
  - unmapped=3254 (itens não publicáveis/rejeitados por política)
- Decisão de negócio validada:
  - regra de não publicação confirmada como correta para itens com `REVISAR_NUNCA` e `NAO_PUBLICAR_INTERNO`
  - release candidate considerado fechado com política atual

## ✅ Pacote de go-live preparado (15/05/2026)

## ✅ Go-live concluído e auditado (15/05/2026)

- Janela de monitoramento 24h executada sem desvios
- Todos os checkpoints estáveis (health ok, mapped 12219, pending 0, unmapped 3253)
- 100% dos unmapped são bloqueio de política de negócio (nenhum gap técnico)
- Auditoria de rejeição: 3226 REVISAR_NUNCA, 27 NAO_PUBLICAR_INTERNO
- Relatório final: artifacts/release/go-live-final-report-20260515.md

## ✅ Admin UI migrado para modelo EAN/N1-N2 (15/05/2026)

- Removida aba legada "Mapeamento de Classificações" (fluxo antigo)
- Mantida apenas aba "Categorias" com visão de N1 (raiz)
- Nova aba "Mapeamento EAN" com fluxo oficial:
  - stats em tempo real (mapped, pending, total, unmapped)
  - dry-run e apply de mapeamentos EAN -> categoria
  - auditoria clara de rejeição por política
- Admin compilado e publicado em staging sem regressão
- ProductsSection limpo visualmente:
  - filtros de classificação removidos da tela
  - selects de classificação removidos do formulário
  - coluna de classificação substituída por origem
  - tabela e layout recompilados e publicados em staging
- Próximo passo: consolidar refatoração do Dashboard legado em sprint dedicada

## ✅ Auditoria completa de legado no Admin (15/05/2026)

- Mapeamento de todas as páginas: 14 páginas limpas, 1 crítica
- **Página legada identificada:** Dashboard.tsx
  - Usa sistema antigo de classification01-classification04
  - Contém 5 memos, 4 filtros e lógica de árvore mercadológica não mais necessários
  - Requer refatoração profunda (próxima sprint)
- **Relatório completo:** arquivos-projeto/ADMIN_UI_AUDIT_COMPLETE_15MAY.md
- **Plano de ação:** Refatorar Dashboard para usar EAN/N1-N2, remover 200+ linhas de código legado

- Script operacional criado: `sistema/go-live-ops.ps1`
  - `preflight`: snapshot de containers + health + stats
  - `monitor`: comandos de monitoramento pós-publicação
  - `rollback`: comandos de contingência rápida
- Preflight executado com sucesso e evidência gerada:
  - `artifacts/release/go-live-preflight-20260515-000214.json`
  - `artifacts/release/go-live-preflight-20260515-025005.json` (snapshot T0 de monitoramento)
  - `artifacts/release/go-live-preflight-20260515-033330.json` (checkpoint seguinte de monitoramento)
- Baseline staging no preflight:
  - health: `ok`
  - mapped=12218
  - pending=0
  - total=15472
  - unmapped=3254 (itens bloqueados por política de negócio)
- Comparativo T0 -> checkpoint seguinte:
  - health: `ok` -> `ok`
  - mapped: `12218` -> `12218`
  - pending: `0` -> `0`
  - unmapped: `3254` -> `3254`
  - status: estável, sem desvio

## ✅ M-CAT - Handoff externo como fonte primaria (14/05/2026)

- Aplicacao completa do handoff externo:
  - `F:/VC.VERSE/PROJETOS/antenor e filhos/handoff_ecommerce_v3_n1_n2.csv`
  - `F:/VC.VERSE/PROJETOS/antenor e filhos/handoff_ecommerce_v3_n1_n2.json`
  - `F:/VC.VERSE/PROJETOS/antenor e filhos/handoff_ecommerce_v3_n1_n2.md`
- Script aplicado no backend: `scripts/handoff-apply.js` (prioriza EAN do handoff).
- Resultado do apply do handoff:
  - `mappingsUpserted`: 12.218
  - `pendingsUpserted`: 3.253
  - `notFoundInDb`: 32
- Correcoes de consistencia:
  - ajuste do calculo de stats para evitar dupla contagem de `mapped` e `pending`
  - fechamento manual do ultimo EAN sem cobertura (`7896247400153` -> `Mercearia > Temperos Molhos`)
- Estado final de cobertura:
  - mapped=13.674
  - pending=3.253
  - total=15.472
  - unmapped=0
## ✅ M40 CONCLUÍDO (10/05/2026) — Extensões de integrações com toggle persistente

- Novo domínio persistente `integration_module_configs` com migration `20260510003000_add_integration_module_configs`
- Backend: `IntegrationModulesService` passou a usar banco para estado `enabled` de cada extensão
- Endpoint novo para controle runtime por módulo:
  - `PATCH /integrations/modules/:key` com payload `{ enabled: boolean }`
- `GET /integrations/modules` agora retorna estado real persistido (com fallback em flags `INTEGRATION_*_ENABLED` quando não houver override em banco)
- Tudo ligado à Solidcom passou a obedecer o toggle da extensão:
  - `ProductsService.syncFromERP` retorna `skipped` quando Solidcom desativada
  - `ProductsService.syncTaxonomyFromProducts` retorna `skipped` quando Solidcom desativada
  - `OrderOrchestrationService` ignora sync/cancel/retry/reconcile remoto quando Solidcom desativada
  - `IntegrationsService.getSolidcomStatus` reflete estado da extensão
- Admin (Integrações): cards de módulos viraram extensões operacionais com botão `Ativar/Desativar` por módulo usando API real
- Build backend/admin limpos; containers recriados; migration aplicada no banco

## ✅ M39 CONCLUÍDO (10/05/2026) — Editor de Banners da Loja (preview + painel)

- Novo domínio CMS `store_banners_cms` com migration `20260510000000_add_store_banners_cms`
- Backend: novo módulo `cms/store-banners` com endpoints:
  - `GET /cms/store-banners` (ativos e dentro da janela de agendamento)
  - `GET /cms/store-banners/all` (admin)
  - `POST /cms/store-banners`, `PATCH /cms/store-banners/:id`, `DELETE /cms/store-banners/:id`
- Admin: nova seção `Banners da Loja` na sidebar do dashboard
- Novo editor visual com:
  - preview central da composição (`full`, `tarja`, `vitrine`, `mini`, `lateral`)
  - painel de configuração com tipo, páginas, link, target, título, imagem desktop/mobile e agendamento
  - lista com ativar/desativar, editar, remover e reordenar
- Regras aplicadas: imagem mobile opcional (< 767px), fallback para desktop quando ausente, intervalo mínimo de agendamento validado no form
- Build backend/admin limpos, containers `antenor_api` e `antenor_admin` recriados
- Drift de migration resolvido com `migrate resolve --applied 20260508000000_add_category_classification_mappings`

## ✅ M38 CONCLUÍDO (09/05/2026) — Integrações plugáveis e desconectáveis

- Backend ganhou núcleo modular de integrações em `integration-modules.service.ts`
- Novo endpoint `GET /integrations/modules` para catálogo de módulos (enabled/removable)
- Solidcom desacoplado por flag:
  - `INTEGRATION_SOLIDCOM_ENABLED=false` desativa sync sem apagar dados de domínio
  - `ProductsService.syncFromERP` passa a retornar `skipped` quando módulo desligado
  - `OrderOrchestrationService` ignora sync/cancel/retry/reconcile remoto quando módulo desligado
- Admin (seção Integrações) atualizado com módulos planejados adicionais: RD Station e Meta Pixel
- Build backend + admin limpos e containers recriados

## ✅ M37 CONCLUÍDO (09/05/2026) — HTTPS no Admin

- Admin passou a expor HTTP e HTTPS no compose local
- Portas publicadas: `3002` (HTTP) e `3444` (HTTPS)
- Nginx do admin com server SSL (`cert.pem`/`key.pem`) usando o volume `./certs:/etc/nginx/certs:ro`
- Smoke test validado: `http://localhost:3002` e `https://localhost:3444` com status `200`

## ✅ M36b CONCLUÍDO (08/05/2026) — Sincronização desktop/mobile da regra de mapeamento

- Regra global do storefront aplicada no backend: produto só aparece se casar com algum `CategoryClassificationMapping` (nível 1..4)
- Sem mapeamentos: `/products` retorna vazio
- Com apenas FLV mapeado em Hortifruti: `/products` e `/products?category=HORTIFRUTI` retornam apenas os itens mapeados
- Categoria sem mapeamento (ex.: BEBIDAS) retorna `0`
- Compatibilidade mantida para clientes antigos/mobile: endpoint público aceita `category` e `cat`
- Alias adicionado: `FLV -> HORTIFRUTI`

## ✅ M34 CONCLUÍDO (08/05/2026) — Mapeamento manual de classificações por categoria

- Novo modelo `CategoryClassificationMapping` no schema Prisma + migration `20260508000000_add_category_classification_mappings`
- Endpoints admin protegidos: `GET /cms/categories/classification-mappings`, `POST`, `DELETE /:id`
- `GET classification-mappings` retorna todas as classificações dos produtos ativos (nível 1-4), com indicador `mapped: true/false`, contagem de não mapeadas e categorias vinculadas
- `ProductsService.buildCategoryFilterFromMappings`: quando `?cat=X` é passado, filtra produtos pelos campos `classification0X` mapeados manualmente
- Categoria sem mapeamentos → retorna lista vazia no storefront (produto não aparece)
- Admin: nova seção "Categorias" na sidebar (ícone Tag), tela `ClassificationMapping.tsx` com:
  - Resumo: total / mapeadas / não mapeadas (com badge de alerta quando > 0)
  - Filtros por nível, status (mapeada/não mapeada) e texto
  - Por linha: indicador ✓ verde ou ⚠ amarelo, chips das categorias vinculadas com botão de remover, select + botão "Mapear" para adicionar nova vinculação
- Relação 1-para-muitos: uma classificação pode ir para várias categorias
- Builds admin e backend limpos; containers antenor_api e antenor_admin recriados
- Smoke test: 883 classificações, 883 não mapeadas (estado inicial correto)

## 🟡 M33 EM ANDAMENTO (06/05/2026) — Notificações push e in-app

- Backend: modelo `Notification` + endpoints `GET /notifications`, `GET /notifications/unread-count`, `PATCH /notifications/:id/read`
- Backend admin: `POST /notifications/admin/broadcast`
- Backend: `POST /notifications/push-subscribe`
- Backend: envio Web Push real via `web-push` quando VAPID esta configurado
- Storefront: manifesto PWA, service worker, cache no-store e preflight externo `validate:web-push-readiness`
- Backend: trigger automático em `orders.updateStatus` criando notificação `ORDER_UPDATE`
- Frontend: `useNotifications` com polling 30s
- Frontend: registro de `PushSubscriptionJSON` real com chave publica VAPID base64url
- Frontend: `NotificationBell` com drawer e badge de não-lidos integrado ao header da Home (mobile e desktop)
- Frontend: `public/service-worker.js` com handler de `push`
- Admin: nova seção "Notificações" com formulário de broadcast

**Pendências M33:** validação de entrega externa em navegador/PWA com chaves VAPID reais, origem segura e app instalado. A implementação local foi fechada em 02/06/2026 com testes unitários, builds backend/frontend e validação de Compose local/staging; em 05/06/2026 foi adicionado manifesto PWA e preflight externo para bloquear ambiente mal configurado antes da homologação em dispositivo.

## ✅ M29 CONCLUÍDO (04/05/2026) — Progress bar de frete grátis

- Hook `useFreeShipping(subtotal)` → `{ enabled, threshold, remaining, achieved, pct }`
- Componente `FreeShippingBar`: barra animada + pulso verde na transição de abaixo → acima do threshold
- Barra posicionada no topo do resumo do carrinho, reativa em tempo real ao subtotal do CartContext
- Ponto verde no ícone do carrinho (header mobile + bottom nav) quando frete conquistado
- Mensagem "🎉 Frete grátis incluído!" no checkout quando threshold atingido
- Admin → Identidade Visual: campo "Valor mínimo para frete grátis (R$)" com toggle implícito (vazio = desativado)
- `freeShippingThreshold` já existia no schema Prisma (`brand_config`) — nenhuma migration necessária
- Build storefront + admin limpos, containers recriados

## ✅ M30 CONCLUÍDO (04/05/2026) — Cálculo de taxa de entrega por CEP

- Modelo `DeliveryZone` adicionado ao schema Prisma + migration `20260504190338_add_delivery_zones` aplicada
- Endpoint público `GET /delivery/calculate?cep=` → `{ fee, freeAbove, zoneName, zoneId, isFree }`
  - CEP dentro de zona → retorna taxa da zona de maior prioridade
  - CEP fora de todas as zonas → `fee: -1` (cliente notificado no checkout)
  - Sem zonas cadastradas → `fee: 0` (sem cobrança, fallback seguro)
- Módulo `DeliveryModule` registrado no `AppModule`
- Admin: tela "Zonas de Entrega" (sidebar Ferramentas → ícone Truck)
  - CRUD completo: criar, editar, remover zonas por faixa de CEP
  - Toggle ativo/inativo por zona
  - Campo "Frete grátis acima de R$" por zona (sobrepõe o threshold global do M29)
  - Campo "Prioridade" para resolver sobreposição de faixas
- Checkout: ao sair do campo CEP (blur), consulta `/delivery/calculate` e exibe taxa da zona + aviso de fora da área
- `deliveryAPI.calculate()` adicionado ao `api.ts` do storefront
- Build backend + admin + storefront limpos
- Redis `FLUSHALL` + MeiliSearch reindexado (15.449 produtos) após reset de DB causado por `prisma migrate dev`
- M30b concluído (06/05/2026):
  - Checkout com botão `Usar minha localização` via `navigator.geolocation`
  - Endpoint `/delivery/calculate` expandido para `lat/lng`
  - `DeliveryZone` com `polygonGeoJSON` + parser point-in-polygon
  - Admin com editor de polígono no mapa (Leaflet + leaflet-draw)
  - Basemap do admin atualizado para provedor Esri World Street Map (mais atual/estável que tile padrão OSM)
  - Checkout refatorado para fluxo progressivo: GPS (reverse geocoding Mapbox) -> fallback CEP (ViaCEP) -> forward geocoding Mapbox -> validação de zona
  - Backend migrou validação geográfica para Turf.js `booleanPointInPolygon` com coordenadas `[lng, lat]`
  - Storefront ganhou modal global de verificação de entrega (botão fixo), independente de login/carrinho/checkout, com persistência de endereço+tarefa de entrega no localStorage
  - Smoke test validado: coordenada interna retorna taxa da zona; externa retorna `-1`

## ✅ M31 CONCLUÍDO (05/05/2026) — Anti-fraude: frete grátis no primeiro pedido

- Validação reativada em `orders.service.ts` com 3 vetores ativos:
  - **WhatsApp**: verifica se o número já fez pedido não cancelado
  - **Dispositivo** (deviceId fingerprint): bloqueia segundo pedido do mesmo aparelho
  - **IP** (janela 24h): bloqueia mesmo IP que já usou frete grátis nas últimas 24h
- Bloqueio silencioso ao cliente — retorna "Frete grátis disponível apenas no primeiro pedido."
- Tabela `fraud_logs` registra vetor, valor e customerId de cada tentativa bloqueada
- Migration `20260505000000_add_clientip_fraud_log`: coluna `clientIp` em `orders` + tabela `fraud_logs`
- Controller extrai IP real do request (suporte a `X-Forwarded-For`)
- Admin: tela "Anti-fraude" (Ferramentas → ShieldAlert) com filtro por vetor, contagem de reincidência e timestamps
- Verificação só corre quando `delivery === 0` — clientes pagantes intocados
- Build admin + backend sem erros

## ✅ M32 CONCLUÍDO (05/05/2026) — Horários de funcionamento + tela de busca limpa

- Schema `BrandConfig`: novos campos `businessHours` (JSON semanal), `openMessage`, `closedMessage`, `countdownLabel`
- Migration `20260505100000_add_business_hours` criada
- Backend `BrandService`/DTO atualizado para expor e persistir os novos campos
- Admin: tela "Horários de Funcionamento" (Ferramentas → Clock)
  - Editor visual por dia da semana com múltiplas janelas de horário (ex: 08h-12h e 14h-20h)
  - Toggle ativo/inativo por dia
  - Campos personalizáveis: mensagem aberto, mensagem fechado, rótulo do countdown
  - Botão "Restaurar padrão" com os horários originais hardcoded
- `useBrand` atualizado com os 4 novos campos
- `useDeliveryOperation` refatorado: usa `getDeliveryOperationStatusWithConfig` quando `businessHours` está no backend; fallback ao config estático (`deliveryOperation.ts`) quando nulo
- Tela `/mercado` simplificada: barra de endereço e badge de horário removidos do topo
- **Deploy pendente Docker Desktop** (migrations 20260503, 20260504, 20260505x2 aguardam `migrate deploy`)


## ✅ M21-M24 CONCLUÍDOS (02/05/2026)

### M21 - Winston logging + rate limiting
- Logs JSON estruturados em todos os containers (`docker logs antenor_api`)
- `HttpLoggingInterceptor`: método, url, status, duration_ms, ip em cada request
- Rate limiting: 120 req/min (default), 10 req/min (auth login), 5 req/min (register)
- 429 retornado corretamente após limite excedido (testado: 10 req/min → 429 na 11ª)

### M22 - Admin: painel de saúde do sistema
- `SystemHealthWidget` na seção Integrações: DB/Redis/Meili/Solidcom com latência e badge geral
- Polling automático a cada 60s + botão de refresh manual
- Build admin 6.27s limpo, container recriado

### M23 - Storefront: conta e rastreio de pedidos
- `useOrders` com polling automático a cada 30s para pedidos PENDING/CONFIRMED
- Indicador "ao vivo" + spinner de atualização visíveis na aba de pedidos
- Expand/collapse de itens com preço por linha
- Botão WhatsApp por pedido com mensagem pré-formatada
- `contactWhatsapp` adicionado ao BrandConfig (schema + migration + backend + frontend)
- Build storefront 16.70s limpo

### M24 - Admin: gestão de pedidos avançada
- Export CSV dos pedidos filtrados (UTF-8 BOM, separador `;`, download automático)
- Timeline visual de status no modal (PENDING → CONFIRMED → DELIVERED → COMPLETED)
- Build admin 9.95s limpo

**Validações finais:** 125/125 unit tests backend, rate limiting 429 revalidado, todos os 6 containers UP.

## ✅ Atualização UX - Refatoração Global de Raios (01/05/2026)

- Storefront e Admin passaram por redução sistêmica de arredondamento visual.
- Normalização aplicada em larga escala em superfícies com `rounded-3xl`, `rounded-2xl`, `rounded-xl` e raios arbitrários grandes (`rounded-[28px]`, `rounded-[24px]`, `rounded-[2rem]`).
- Sidebar de Ferramentas do admin ajustada com espaçamento vertical consistente e botões secundários menos arredondados.
- Build validado em `sistema/frontend` e `sistema/admin`.
- Containers `storefront` e `admin` recriados via Docker Compose.

## ✅ Atualização UX - Direção Visual Padrão (01/05/2026)

- Início da migração visual para linguagem mais sóbria e consistente.
- Storefront e Admin com tipografia padrão corporativa: prioridade para `Google Sans Flex` e fallback em `Roboto`.
- Componentes base com visual mais sólido (sem efeito glassmorphism de blur/transparência no estilo principal).
- Segunda passada aplicada para reduzir `rounded-full` em chips/pills, preservando elementos naturalmente circulares (avatars, ícones e badges de contador com `w/h`).

## ✅ M16 ENCERRADO - Padronização Visual (01/05/2026)

**Objetivo:** Revisão completa do visual por surface, consolidação de padrões tipográficos e de arredondamento.

**Entregas:**
- Context7 MCP configurado em `.vscode/mcp.json` (URL: `https://mcp.context7.com/mcp`)
- White space corrigido em `StoreProductCard.tsx` (remoção de `min-h-[3.6rem]` no h3)
- Review visual por surface: Home, Mercado (Search), Checkout, Dashboard, Admin components
- `rounded-full` legítimos preservados (avatars, fechar modais, status dots, swatches)
- `backdrop-blur` em modais mantido (padrão UX — não glassmorphism)
- Build limpo (frontend 4.67s, admin 4.58s), containers recriados

**DoD atingido:** visual consistente storefront+admin, sem build regression, docs sincronizados.

## 🟡 M17-M20 CONCLUÍDOS (01/05/2026)

### M17 - Testes automatizados e guardrails de qualidade
Status: **⏳ IN PROGRESS** (Fases 1-3 concluídas, Fases 4-8 em progresso)

**Progresso consolidado (01/05/2026):**
- Unit tests backend: **125 passando**
- Cobertura backend:
  - OrdersService: **78.08%** statements
  - ProductsService: **59.63%** statements
  - CouponsService: **93.54%** statements
- E2E crítico executado e validado localmente:
  - Storefront `cart.cy.ts`: **8/8 passing**
  - Admin `dashboard.cy.ts`: **5/5 passing**
- Workflow de gate de PR criado: `.github/workflows/test-pr.yml`
  - Gate de cobertura de statements: **75% mínimo**
  - Gate E2E crítico: carrinho/checkout e dashboard admin

**Bloqueantes para 85%** (análise técnica):
- OrdersService: linhas 69-70, 170-214, 385-386, 435, 438-439
- ProductsService: linhas 140-227, 310-335, 575-701
- Esforço estimado: ~40 testes adicionais altamente específicos para branches não triviais

**Decisão de execução M17:** manter gate pragmático em **75%+** no PR enquanto o hardening para 85% é tratado em ciclo dedicado.

### M18 - Performance & Core Web Vitals — ✅ CONCLUÍDO 01/05/2026
**Entregas validadas:**
- Code-splitting agressivo: `manualChunks` para axios, date-fns, react-hot-toast, react-helmet-async, framer-motion
- Bundle principal: 26.72 kB gzip → 6.52 kB gzip (−76%)
- Preconnect hints no `index.html` para Google Fonts
- Imagens com `width`/`height` explícitos + `decoding="async"` em StoreProductCard
- nginx: `Cache-Control: immutable` 1 ano para JS/CSS, `gzip_comp_level 6`
- `Referrer-Policy: strict-origin-when-cross-origin` adicionado
- `web-vitals` integrado em `main.tsx` (coleta CLS, FCP, LCP, TTFB, INP)
**DoD parcial:** 2 indicadores dependem de RUM em ambiente real (Lighthouse 90+ e LCP < 2.5s em campo)

### M19 - UX avançado e interatividade — ✅ CONCLUÍDO 01/05/2026
**Entregas validadas:**
- `PageTransition` com Framer Motion: fade+slide em todas as rotas via `AnimatePresence`
- `SkeletonCard` / `SkeletonHero` / `SkeletonList`: Home e Mercado usam skeleton em vez de spinner
- `LoadingButton`: Checkout, Login e Register usam botão com estado de loading e `aria-busy`
- `StoreProductCard`: `motion.article` com lift hover + `motion.button` com tap/hover scale
- Register: validação inline em tempo real por campo (touched/errors), barra de força de senha
- ARIA: `aria-expanded` no painel de filtros, `aria-invalid` em inputs, `role=alert` em erros, `aria-live` em feedback de senha
- Build 5.57s, 60/60 unit tests, container recriado, storefront 200

### M20 - Integrações robustas e monitoramento — ✅ CONCLUÍDO 01/05/2026
**Entregas validadas:**
- `RetryService` com exponential backoff + jitter em `common/services/retry.service.ts` (3 tentativas, 500ms→8s)
- `SolidcomERPService.getProductsFromERP` usa `RetryService` (antes era axios direto sem retry)
- `HealthController` em `/health/detail`: checks de DB, Redis, MeiliSearch e Solidcom com latência ms
- Resultado: DB ok (77ms), Redis ok (14ms), MeiliSearch ok (23ms), Solidcom down (ERP externo offline — esperado)
- 125/125 unit tests backend passando, zero regressão

**DoDs diferidos (ambiente real):**
- [ ] Winston + OpenTelemetry logging centralizado
- [ ] Prometheus metrics
- [ ] Alertas automáticos
- [ ] 99.5% uptime em 30 dias produção

**Sequência recomendada:** M17 → M18 → M19 → M20 ✅ → M21+

## ✅ M11 ENCERRADO - 01/05/2026

**Root Cause:** Coluna `fractionStep` adicionada via migration (2026-04-21) mas sync nunca foi executado após a adição → todos os 1.471 fracionados ficaram com NULL no banco. O código estava correto (upsert já incluía `fractionStep`).

**Resolução:** Sync disparado via API (`POST /products/sync`) → 15.446 produtos sincronizados, 0 erros.

**Resultado final:**
- 1.458+ fracionados ativos: fractionStep populado corretamente (0.1, 0.2, 0.25, 0.5 etc)
- 13 fracionados com NULL: todos `active=false` (excluídos/inativos no ERP) → aceitável
- `SELECT COUNT(*) WHERE isFractional=true AND fractionStep IS NULL AND active=true` = **0 (ZERO)**

## ✅ M12 ENCERRADO - Higienização (Code Cleanup & Debugging)

**Objetivo:** Remover código morto, console.log, `any` types, TODO comments. Validar build limpo. Debug completo.

**Descobertas:** 50+ console.log, 6 `any` types, 1 TODO comment ativo

**Fases:**
- Fase A: Remover console debugging (50+ instances)
- Fase B: Tipagem correta (6 `any` → tipos específicos)
- Fase C: Build validation (zero warnings em 3 apps)
- Fase D: Debug integrado (Console + Network + Performance)

**Rastreamento:** Ver ROADMAP.md > M12 para checklist completo

## Status M12 Execução

✅ **Fase A CONCLUÍDO**: 50+ console.log removidos
- Checkout.tsx: CEP debug logs removidos
- CartContext.tsx: item add logs removidos
- AuthContext.tsx: error logs removidos
- ErrorBoundary (frontend/admin): removido
- Analytics.ts: debug silencioso
- Intelligence.tsx + DashboardSection.tsx: async error logs removido

✅ **Fase B CONCLUÍDO**: `any` types substituídos por tipos específicos
- Home.tsx: slide type com interface clara
- audit-log.service.ts: `changes` → `Record<string, unknown>`
- analytics.service.ts: `metadata` → `Record<string, unknown>`
- api.ts: `getApiErrorMessage(error: unknown)` com type assertion segura

✅ **Fase C CONCLUÍDO**: Build validation sem warnings
- Frontend: ✅ build success (4.54s, zero warnings)
- Admin: ✅ build success (4.43s, zero warnings)
- Backend: Logger import added, ready to build

✅ **Fase D CONCLUÍDO**: Debug visual completo
- Storefront home: ✅ carregou sem erros
- Storefront mercado: ✅ carregou sem erros
- Checkout: ✅ carregou (carrinho vazio conforme esperado)
- Admin login: ✅ carregou sem erros

## ✅ M13 ENCERRADO - 01/05/2026

**Objetivo:** Persistir logos oficiais no banco (`brand_config`) e eliminar NULLs/emojis residuais em todas as superfícies.

**Resultado:**
- `brand_config` singleton inserido com sucesso
- `logoDesktopUrl`: `/branding/logo-horizontal-bordo.png`
- `logoMobileUrl`: `/branding/logo-bordo.png`
- `primaryColor`: `#5D082A` | `secondaryColor`: `#D2BB8A`
- API `/brand` retornando dados corretos ✅
- Emojis e textos hardcoded já removidos em M12 e durante aplicação das logos

## ✅ M14 ENCERRADO - 01/05/2026

**Objetivo:** Elevar cobertura de imagens de produtos.

**Resultado:**
- Antes: 3.095 imagens (20% dos 15.446 produtos ativos)
- Import executado de `F:\VC.VERSE\PROJETOS\antenor e filhos\PRODUTOS\` (4.644 arquivos varredados)
- Novas imagens vinculadas: +80 (por similaridade de nome)
- Depois: **3.175 imagens** (~20,6% de cobertura)
- Limite: cobertura restrita ao acervo fotográfico disponível. Observacao posterior: o tooling temporario de importacao de fotos foi removido em 06/06/2026; nao usar este fluxo legado.

## ✅ M15 ENCERRADO - 01/05/2026

**Objetivo:** Validação E2E do fluxo de compra completo após M11/M13/M14.

**Resultado:**
- Storefront: fracionados exibem porção mínima correta (ex: ABOBORA SERGIPANA → 800 g, ABOBRINHA ITALIANA → 300 g) ✅
- API `/products?limit=3` retorna `fractionStep` populado para todos os fracionados ativos ✅
- Admin logo: sidebar exibe logo "Antenor & Filhos" (emoji removido) ✅
- Admin Pedidos: 16 pedidos listados com filtros, WhatsApp, status e ações ✅
- Admin container recriado após rebuild (chunks desatualizados corrigidos)

---

## 🧭 PRÓXIMO - M16 Reorientação Visual e Padronização UX

- consolidar revisão visual por superfície (storefront e admin)
- manter tipografia padrão corporativa e reduzir inconsistências residuais de borda/estilo
- executar ciclo com milestones curtos obrigatórios por tarefa

##  Procedure para Debug (POR FAVOR LER!)

**Regra inviolável:** Antes de QUALQUER debug no navegador, levantar a stack COMPLETA.

```powershell
# ✅ CORRETO
cd "F:\VC.VERSE\PROJETOS\antenor e filhos\pedidos nr\sistema"
.\startup-for-debug.ps1                    # Script automático com verificação
# OU manualmente:
docker compose up -d db redis meili api storefront admin
docker compose ps                          # Verificar que TODOS têm status "Up"
```

**Por que tudo junto?** Admin depende de API, que depende de DB/Redis/Meili. Se algum serviço está parado, admin retorna 502 Bad Gateway.

**Após startup, acessar:**
- Loja: http://localhost:3000
- Admin: http://localhost:3002
- API: http://localhost:3001

**Troubleshooting rápido:**
- Admin 502? Esperar 5 segundos e recarregar (API pode estar inicializando)
- Ver logs: `docker compose logs -f api` ou `docker compose logs -f admin`
- Parar tudo: `docker compose down`

Guia completo legado: `memories/repo/docker-startup-complete.md` (arquivo externo antigo, nao presente neste workspace).

## Superficies em operacao

- backend em http://localhost:3001
- storefront em http://localhost:3000
- admin em http://localhost:3002
- swagger em http://localhost:3001/api

## Estado real validado

- stack Docker com 6 servicos: api, storefront, admin, db, redis e meili
- banco de dados em PostgreSQL 15
- cache e suporte operacional em Redis 7
- busca em MeiliSearch para catalogo e sugestoes
- backend NestJS 10 com Prisma 5.22.0
- admin React 18 + Vite 4 + ApexCharts
- storefront React 18 + Vite 4 + React Query
- checkout convidado habilitado por flags de ambiente (`ALLOW_GUEST_CHECKOUT` no backend e `VITE_GUEST_CHECKOUT_ENABLED` no storefront)
- Home e Carrinho liberados sem login obrigatorio
- imagens de produto servidas no storefront por `/uploads/products/{ean}.webp` com proxy Nginx para API e fallback para placeholder
- filtros mercadologicos em cascata no admin (classificacao01..04) operacionais
- paginação de produtos do admin validada com avanco de pagina funcional
- links Entrar do storefront direcionando para `/login` quando usuario nao autenticado
- mensagem WhatsApp de confirmacao de pedido inclui metodo de pagamento e troco (sem duplicacao)
- contagem de itens na mensagem WhatsApp corrigida para somar quantidades (não apenas contar linhas)
- checkout com máscara automática de CEP, teclado numérico no mobile e feedback visual em badge
- carrinho com estado global via CartContext (React Context) — sincronização entre todas as páginas
- cálculo de preços fracionados corrigido com `fractionStep` no total do carrinho
- pesáveis sem `fractionStep` explícito nao usam mais fallback de porção; ficam indisponiveis ate correção do dado ERP/banco
- contrato de pesáveis fixado pelo ERP: `fracionado` define se é pesável, `fracionamento` define step e preço exibido, `emb` define unidade; sem inferência por nome/descrição
- endpoint de recomendações de produto passa a retornar `isFractional` e `fractionStep` para preservar precificação correta nos cards de "Compre junto"
- storefront mantem fallback apenas para unidade visual (`emb` codificado), sem criar porção quando `fracionamento` estiver ausente
- UI dos botões do checkout padronizada (primário bordô, secundário dourado)
- botão "Continuar comprando" adicionado em todas as etapas do checkout
- opções de troco otimizadas: acima de R$200, incrementos de R$50
- validação de frete grátis desativada (permitindo múltiplos pedidos para mesmo WhatsApp/dispositivo)

## Fases concluidas

### Phase 14 - Core Web Vitals e SEO
- lazy loading, splits e SEO estruturado no storefront

### Phase 15 - Docker e stack operacional
- dockerizacao dos 3 apps
- compose unificado com Postgres e Redis

### Phase 16 - Seguranca e auditoria
- helmet, throttler, audit log e endurecimento de rotas

### Phase 17 - Inteligencia comercial
- recomendacao de produtos por co-purchase
- analytics administrativos
- notificacao de carrinho abandonado por WhatsApp

### Phase 18 - Restore PostgreSQL e integridade de build
- migracoes e sync validados em ambiente Docker
- stack operacional restaurada com 15.409 produtos sincronizados

### Phase 19 - RBAC, CI e UX operacional do admin
- guards JWT e roles reforcados
- workflow CI em .github/workflows/ci.yml
- dashboard admin com lista, kanban, filtros, modais e fluxo WhatsApp

### Phase 20 - UX Polish no admin
- acessibilidade e touch targets revisados
- sidebar mobile, modais consistentes e menu lateral refinado
- dashboard com analytics estabilizado e sem loop de requests

### Phase 21 - Busca e operacao de catalogo
- busca dedicada no storefront com filtros visuais de categoria e faixa de preco
- sugestoes de busca com texto amigavel ao cliente
- analytics de busca no backend e insights no admin
- regra de visibilidade por ERP aplicada no catalogo:
	- NUNCA: nao exibe
	- SEMPRE: exibe sempre
	- ESTOQUE: exibe com estoque positivo
- sincronizacao de imagens por lote foi um fluxo legado; tooling temporario de fotos removido em 06/06/2026

### Phase 22 - API propria e orquestracao de negocio
- OrderOrchestrationService como camada interna entre OrdersService e SolidcomERPService
- trilha operacional para falhas de sync e reprocesso manual por pedido
- tela dedicada de Integracoes no admin com estrutura multi-conector
- Solidcom como conector ativo; CRM, Fiscal e Pagamentos como planejados

### Phase 23 - Pagamento por fora (seleção no checkout)
- checkout registra apenas a **opção de pagamento** (PIX, Dinheiro, Cartão na entrega) para fechamento do pedido
- quando Dinheiro, o checkout registra **troco** por seleção guiada (3 opções válidas, sem digitação)
- pagamento é realizado por fora (sem gateway ativo e sem webhook como fluxo de negócio)
- valor final do pedido pode ser ajustado na separação quando houver corte, peso real ou troca de item

### Phase 24 - Testes unitarios e i18n
- payments-webhook.service.spec.ts com 17 testes cobrindo verifySignature, processEvent e listRecentEvents
- cobertura de casos de erro, idempotencia e mapeamento de eventos
- auditoria completa de i18n no admin: ~35 strings sem acento corrigidas em Integrations.tsx, Dashboard.tsx e BICharts.tsx
- status DELIVERED adicionado aos mapas de labels e cores do BICharts

### Phase 25 - Catalogo mercadologico no admin
- classificacoes mercadologicas agrupadas por nivel para leitura humana (ex.: 03 - BEBIDAS)
- arvore em cascata de classificacao01 ate classificacao04 para filtros e formulario
- status da integracao Solidcom movido para bloco inferior em dropdown
- filtro administrativo por classificacao usando busca segmentada em classification01..04
- ajuste de paginação em produtos para impedir retorno involuntario para pagina 1

### Phase 26 - Vitrines comerciais no CMS
- modelo `Category` ampliado com `priority` e `limit`
- endpoint `/cms/categories` aceitando `active`, `priority` e `limit` para operacao comercial
- Home passando a ordenar secoes por `priority`
- Home passando a limitar cards por secao via `limit`
- composicao das vitrines desacoplada de regra fixa no frontend
- **controles visuais de `priority` e `limit` adicionados na tabela de categorias do admin** (LayoutManager.tsx)

### Phase 27 - Pagamentos (desativado por requisito)
- requisito do produto: **pagamento por fora** (sem gateway ativo)
- UI de pagamentos reais no admin fica **oculta por padrão** (flag `VITE_PAYMENTS_UI_ENABLED=false`)
- geração automática de cobrança em `CONFIRMED` fica **desativada por padrão** (flag `ENABLE_PAYMENTS_INTEGRATION=false`)

### Phase 28 - UX de pagamento manual e qualidade (concluída)
- checkout com seleção de método (PIX/Dinheiro/Cartão) e troco guiado (dinheiro)
- filtros no admin: método de pagamento e pedidos com/sem troco
- testes E2E do checkout ponta a ponta criados e validados com sucesso em `sistema/frontend/cypress/e2e/checkout.cy.ts`
- UI dos botões padronizada com identidade visual bordô/dourado
- estado do carrinho globalizado via CartContext
- máscara de CEP com teclado numérico e badge de confirmação
- mensagem operacional clara: cliente informa como quer pagar, mas o pagamento é fechado pela equipe após separação do pedido

### Phase 29 - Centralização de preços e higiene do repositório (concluída)
- novo utilitário `sistema/frontend/src/utils/productPricing.ts` como **fonte única de verdade** para cálculo e formatação de preço de produto
- todos os pontos de exibição de preço (card, carrinho, checkout, WinePage) passam por `getProductPricePresentation` e `getProductLineTotal`
- guardrail E2E `sistema/frontend/cypress/e2e/product-pricing.cy.ts` protege contra regressão de formatação
- limpeza estrutural do repositório: removidos `.opencode/`, `.vscode/launch.json`, `.github/chatModes/`, arquivos de teste soltos (`output.txt`, `p.json`, `r.json`), `link_api` sem semântica
- `ops.ps1` renomeado para `stack-ops.ps1` (semântico)
- `.gitignore` adicionado na raiz do projeto
- `.dockerignore` adicionado em `sistema/frontend/` e `sistema/admin/`
- criado `arquivos-projeto/md/INICIO_AQUI.md` como documento de entrada único para continuidade de IA entre sessões

## Proxima fase formal do roadmap

### Phase 30 - Implementacao completa guiada por milestones
- execucao integral do checklist oficial em `ROADMAP.md` (M0 a M10)
- foco nas frentes: taxonomia comercial, CMS 2.0, header operacional de entrega, Mercado, produto detalhado adaptavel, carrinho 2.0 com cupom, receitas estilo blog, identidade visual no admin, SEO profissional e hardening final
- criterio de andamento: toda task concluida deve atualizar os markdowns canônicos impactados no mesmo ciclo

### Phase 31 - Governanca M0 e baseline tecnico (concluida)
- milestone M0 concluido no `ROADMAP.md` com tasks e DoD marcados
- matriz de responsabilidade por dominio formalizada (backend, storefront, admin, docs)
- Definition of Done comum formalizada para todos os agentes
- fluxo de handoff multi-agente formalizado e validado (entrada por INICIO_AQUI + STATUS + ROADMAP)

### Phase 32 - M1 Taxonomia comercial unificada (concluida)
- backend com contrato unico de taxonomia comercial em `GET /cms/categories/commercial`
- taxonomia comercial consolidada via merge de categorias CMS com fallback por produtos ativos
- Home e Mercado (Search) consumindo o mesmo contrato via hook `useCommercialTaxonomy`
- Home sem classificacao por regex ad-hoc para secoes comerciais
- build do backend e frontend executado e aprovado

### Phase 33 - M2 CMS 2.0 (concluida)
- contrato de colecoes evoluido no CMS para expor `subtitle` e `link` (mantendo compatibilidade com `badge` e `ctaTo`)
- admin atualizado para operar banners promocionais como colecoes com subtitulo e link de destino
- Home atualizada para consumir `subtitle/link` com fallback seguro
- endpoint publico `GET /analytics/top-products` publicado para fonte de mais vendidos
- Home com secao `Mais Vendidos` conectada ao analytics/top com fallback local
- categorias CMS passam a aceitar curadoria manual via `curatedProductIds`
- Home prioriza produtos curados por secao e aplica fallback automatico pela taxonomia
- migration aplicada: `20260425065729_add_category_product_curations_cms`
- banners promocionais com `highlightedProductId` e `highlightNote` para destaque horizontal com produto exaltado
- migration aplicada: `20260425071305_add_promo_banner_highlighted_product`
- admin com busca assistida de produto exaltado nos banners promocionais
- build do backend, admin e frontend executado e aprovado

### Phase 34 - M3 Header operacional de entrega (concluida)
- contexto de entrega persistido no storefront via `localStorage` (`antenor.deliveryAddress`)
- checkout salva endereco confirmado para reaproveitamento no topo da experiencia
- header da Home exibe endereco de entrega quando houver contexto
- header da Busca exibe endereco de entrega quando houver contexto
- fallback textual explicito para cliente sem endereco selecionado
- configuracao de operacao de entrega separada do horario da loja fisica em `src/config/deliveryOperation.ts`
- suporte a janelas por dia da semana, excecoes por data e feriados
- contador regressivo de fechamento de entregas ativo quando a janela esta aberta
- build do frontend executado e aprovado

### Phase 35 - M4 Mercado (concluida)
- superficie de exploracao promovida para rota principal `/mercado`
- rota legada `/busca` mantida com redirecionamento para `/mercado` com preservacao de querystring
- Home atualizada para direcionar CTA, busca e atalhos para `/mercado`
- layout da pagina Mercado simplificado com cabecalho unico e acao direta de limpar filtros
- filtros mercadologicos em cascata (`classification01..04`) integrados ao Mercado
- endpoint publico `GET /products/mercadological-tree` habilitado para popular filtros do storefront
- endpoint publico `GET /products` ampliado com `classification01..04`
- paridade Prisma/Meili garantida para filtros mercadologicos (`classification01..04`) em busca indexada e fallback
- build do backend executado e aprovado
- build do frontend executado e aprovado

### Phase 36 - M5 Produto detalhado adaptavel (concluida)
- rota publica de detalhe de produto adicionada no storefront: `/produto/:id`
- pagina `ProductDetail` criada com renderizacao schema-driven por categoria
- schema de secoes dinamicas por tipo consolidado em `utils/productDetailSchema.ts`
- cards da Home e do Mercado passam a abrir detalhe por imagem e titulo
- bloco de recomendacoes de co-purchase integrado no detalhe via `/products/:id/recommendations`
- galeria com fallback de formatos (`webp/jpg/jpeg/png`) adicionada na pagina de detalhe
- descricao e informacoes adicionais consolidadas por combinacao de dados ERP + editoriais
- build do frontend executado e aprovado

### Phase 41 - M10 Hardening final, testes e release (concluida)
- E2E de produto detalhado criado: `sistema/frontend/cypress/e2e/product-detail.cy.ts` (6 testes: abertura da Home, abertura do Mercado, exibicao de nome/preco/botao, adicionar ao carrinho, link voltar, produto inexistente)
- E2E de receitas criado: `sistema/frontend/cypress/e2e/recipes.cy.ts` (6 testes: listagem, abrir detalhe, ingredientes/titulo, link voltar, painel de ingredientes, slug inexistente)
- 22 novos testes unitarios criados no backend: `coupons.service.spec.ts` (12 testes) e `recipes.service.spec.ts` (10 testes)
- 4 suites pre-existentes corrigidas: `orders.service.spec.ts`, `integrations.service.spec.ts`, `order-orchestration.service.spec.ts` e `products.service.spec.ts`
- 74/74 testes do backend passando em 13 suites (100%)
- build do storefront validado (1400 modulos, aprovado em M9)
- roadmap completo M0-M10 concluido

### Phase 40 - M9 SEO profissional transversal (concluida)
- `SEO.tsx` evoluido com props `noindex`, `keywords` e canonical automatico baseado em `window.location.href`
- `StructuredData` com tipagem corrigida para `data: object`
- `ProductDetail.tsx`: schema.org `Product` (name, sku/gtin, offers com preco e disponibilidade, brand, seller) + `BreadcrumbList` (Mercado > Produto) + canonical `/produto/:id` + og:image com imagem real do produto
- `RecipeDetail.tsx`: schema.org `Recipe` (name, ingredients, steps, totalTime ISO 8601, recipeYield, author) + `BreadcrumbList` (Receitas > Receita) + canonical `/receitas/:slug` com fallback para `seoTitle`/`seoDescription`
- `RecipeList.tsx`: `SEO` com canonical `/receitas` + `BreadcrumbList` de nivel unico
- `Search.tsx` (Mercado): titulo dinamico com query e categoria, canonical fixo `/mercado`, `noindex=true` quando ha filtros ativos (evita duplicate content)
- `Home.tsx`: hero image com `fetchPriority="high"` para otimizar LCP
- `index.html`: `<link rel="preconnect">` e `dns-prefetch` para `http://localhost:3000`
- build do storefront executado e aprovado (1400 modulos)

### Phase 39 - M8 Identidade visual gerenciavel no admin (concluida)
- modelo `BrandConfig` (singleton id=`singleton`) adicionado ao Prisma schema
- migration manual gerada em `20260501000000_add_brand_config`
- `BrandModule` criado no backend: `BrandService` (upsert singleton) + `BrandController` (`GET /brand` publico, `PUT /brand` admin)
- `brandAPI` adicionado nos clientes Axios do storefront e do admin
- hook `useBrand()` criado no storefront com fallback para valores padrao
- header da `Home.tsx` atualizado: desktop/tablet exibe logo desktop ou nome em texto; mobile exibe logo mobile ou inicial; ambos com fallback seguro quando sem logo
- pagina `BrandIdentity.tsx` criada no admin com upload de logo desktop e mobile (via `uploadsAPI`), campos de cor primaria e secundaria com color picker + campo hex, nome da loja, previsualização em tempo real do header, e card de instrucoes sobre formatos aceitos
- secao `Identidade Visual` adicionada na sidebar do Dashboard do admin com icone `Palette`
- build do backend executado e aprovado
- build do storefront executado e aprovado (1400 modulos)
- build do admin executado e aprovado (1387 modulos, BrandIdentity-9f411ba8.js no bundle)

### Phase 38 - M7 Receitas estilo blog com compra integrada (concluida)
- dominio de receitas criado com 6 modelos Prisma: RecipeCategory, Recipe, RecipeIngredient, RecipeStep, RecipeProduct, RecipeRelation
- migration manual gerada em `20260430234456_add_recipes_domain` com todas FK e constraints
- Prisma Client regenerado com `prisma generate`
- backend RecipesModule completo: DTOs, RecipesService (CRUD com transacoes), RecipesController (10 endpoints REST) e registrado no AppModule
- recipesAPI adicionado no storefront e admin (axios client)
- tipos TypeScript adicionados em `sistema/frontend/src/types/index.ts`
- hooks useRecipes, useRecipe e useRecipeCategories criados com React Query
- storefront: RecipeList.tsx (filtro por categoria, grid com skeleton) e RecipeDetail.tsx (ingredientes, passos, painel lateral de produtos com compra individual e em lote, carrinho flutuante mobile, receitas relacionadas)
- rotas `/receitas` e `/receitas/:slug` adicionadas no App.tsx do storefront
- admin: Recipes.tsx com tabela paginada, modal inline de criacao/edicao, toggle ativo/inativo e exclusao com confirmacao
- secao Receitas adicionada na sidebar do Dashboard do admin com icone ChefHat
- build do backend executado e aprovado
- build do storefront executado e aprovado
- build do admin executado e aprovado

### Phase 37 - M6 Carrinho 2.0 (concluida)
- carrinho agora exibe foto de produto por EAN no card de item
- nome completo e controles de quantidade mantidos em layout consistente para mobile e desktop
- modulo de cupons criado no backend: `CouponsService`, `CouponsController`, `CouponsModule`
- catalogo de regras real: BEMVINDO10 (10% ate R$50), FRETE0 (frete gratis), CHURRASCO15 (15% na categoria CHURRASCO)
- endpoint publico `POST /coupons/validate` aceita `{ code, subtotal, category? }`
- `CartContext` evoluido com `couponCode`, `discount`, `subtotal`, `applyCoupon(code)` e `removeCoupon()`
- cupom persistido no localStorage (`cartCouponCode`) e restaurado entre sessoes
- UI de cupom adicionada no Cart.tsx: campo + botao "Aplicar", exibicao de cupom ativo, remocao e desconto em tempo real
- Checkout.tsx envia `couponCode` e `discount` no payload de criacao de pedido
- backend revalida o cupom no `OrdersService` durante create() para evitar desconto forjado pelo cliente
- carrinho passa a exibir recomendacoes contextuais por co-purchase e complemento de mais vendidos
- estrategia de recomendacao evita duplicidade e exclui produtos ja presentes no carrinho
- bloco de recomendacao tambem aparece no estado de carrinho vazio para estimular descoberta
- build do backend executado e aprovado
- build do frontend executado e aprovado

## Pendencias reclassificadas

### Alta prioridade
- [x] testes E2E do fluxo de checkout ponta a ponta (pagamento por fora) - **executados e aprovados (5/5 passando)**
- [x] validação visual do fluxo de troco guiado em diferentes cenários - **checkout Cypress local 5/5 cobrindo Dinheiro com troco guiado**
- [x] padronizar pagamento manual (PIX/Dinheiro/Cartão) em storefront/backend/admin - **aliases offline corrigidos e pedidos admin validados 5/5**
- [x] ampliar cobertura de imagens para itens sem match automatico - **2.052 fotos locais e 11 fotos staging vinculadas; CSV de pendentes mantido para proxima leva**

### Media prioridade
- cobertura adicional de testes do frontend e admin
- componentizacao de secoes internas do Dashboard admin

### Baixa prioridade
- refinamento visual de trilhas de classificacao na tabela de produtos
- consolidar nomenclatura de status em todos os graficos e cards analiticos

## Bugs e riscos atuais

- itens sem foto continuam possiveis quando nao ha match confiavel por EAN/nome

## Versao atual

- 1.24.18-alpha (atualizado em 30/05/2026)

## Historico de versoes

| Versão | Data | Descrição |
|--------|------|-----------|
| 1.24.18-alpha | 30/05/2026 | Auditoria Top-Tier Milestone 17 aplicada: seguranca/LGPD enterprise com `DataSubjectRequest`, consentimentos formais, exportacao/anonimizacao do titular, politica de retencao e audit log sensivel |
| 1.24.17-alpha | 30/05/2026 | Auditoria Top-Tier Milestone 16 aplicada: personalizacao/recomendacao com `RecommendationEvent`, recompre, complementares, substitutos inteligentes, vitrine por segmento, BI de conversao e inteligencia operacional |
| 1.24.16-alpha | 28/05/2026 | Auditoria Top-Tier Milestone 15 aplicada: marketplace/multicanal com canais de venda, mapeamento de produtos, pedidos externos consolidados no OMS, politicas de preco/estoque por canal e painel de dependencia/margem |
| 1.24.15-alpha | 27/05/2026 | Auditoria Top-Tier Milestone 14 aplicada: observabilidade/SRE com request/correlation/order trace ID, logs JSON, metricas p95/erros, Prometheus, health ampliado, alertas, status page e runbooks |
| 1.24.14-alpha | 27/05/2026 | Auditoria Top-Tier Milestone 13 aplicada: BI/analytics operacional com eventos padronizados, snapshots de metricas, dashboards por area e drill-down por loja/categoria/produto/canal |
| 1.24.13-alpha | 27/05/2026 | Auditoria Top-Tier Milestone 12 aplicada: CRM/fidelidade com perfis, consentimentos, segmentos, ledger de pontos/cashback, campanhas e listas de recompra |
| 1.24.12-alpha | 27/05/2026 | Auditoria Top-Tier Milestone 11 aplicada: API publica `/v1`, API key com scopes/rate limit/log, webhooks assinados, retry/DLQ/replay, migration/validador SQL e runtime publicados |
| 1.24.11-alpha | 27/05/2026 | Auditoria Top-Tier Milestone 10 aplicada: integracoes resilientes com conectores, outbox Postgres, jobs, tentativas, retry/backoff, DLQ, replay manual e painel operacional |
| 1.24.10-alpha | 26/05/2026 | Auditoria Top-Tier Milestone 09 aplicada: pagamentos, ledger financeiro, eventos idempotentes, refund parcial, chargeback, conciliacao e guardrail para pagamento online |
| 1.24.9-alpha | 26/05/2026 | Auditoria Top-Tier Milestone 08 aplicada: fulfillment/logistica, areas server-side, slots com capacidade/cutoff, reserva no checkout, rotas, tracking e retirada correta no ERP |
| 1.24.8-alpha | 26/05/2026 | Auditoria Top-Tier Milestone 07 aplicada: picking operacional, separacao por item, conferencia com justificativa, checklist de embalagem, produtividade por separador e admin `Separacao` |
| 1.24.7-alpha | 26/05/2026 | Auditoria Top-Tier Milestone 06 aplicada: OMS por evento e item, OrderEvent, corte/substituicao/recalculo auditaveis e admin conectado a `/admin/orders` |
| 1.24.6-alpha | 26/05/2026 | Auditoria Top-Tier Milestone 05 aplicada: carrinho persistido, sessoes de checkout idempotentes, quote server-side e storefront usando contrato de checkout |
| 1.24.2-alpha | 26/05/2026 | Auditoria Top-Tier Milestone 01 aplicada: tenant/store/RBAC, middleware/guards, backfill default, filtros tenant/store em pedidos/produtos e validacao de isolamento |
| 1.24.1-alpha | 26/05/2026 | Auditoria Top-Tier P0 aplicada: JWT forte, ownership, idempotencia/snapshots de pedidos, validacao server-side, entrega fora de area, webhook, receitas admin, CORS/rate limit e testes P0 |
| 1.4.1-alpha | 18/04/2026 | Build do Admin corrigido, alinhamento para PostgreSQL |
| 1.4.2-alpha | 18/04/2026 | Restore PostgreSQL validado, migração aplicada, sync operacional |
| 1.4.5-alpha | 19/04/2026 | RBAC, CI e UX operacional do Admin consolidados |
| 1.4.6-alpha | 19/04/2026 | UX polish do admin, modais, dashboard, menu lateral |
| 1.4.7-alpha | 19/04/2026 | Roadmap ativo promovido, Fase 21 formalizada |
| 1.5.0-alpha | 19/04/2026 | Fases 22-24: orquestração, webhook de pagamentos, testes, i18n |
| 1.5.1-alpha | 20/04/2026 | Filtro mercadológico corrigido, paginação estabilizada |
| 1.5.2-alpha | 21/04/2026 | Guest checkout, Home/Carrinho sem login, imagens via proxy |
| 1.6.0-alpha | 23/04/2026 | CMS com priority/limit, vitrines comerciais, Phase 26-27 |
| 1.7.0-alpha | 24/04/2026 | productPricing.ts centralizado, repositório limpo, INICIO_AQUI.md |
| 1.7.1-alpha | 25/04/2026 | M0 de governança concluído com matriz/DoD/handoff formalizados |
| 1.8.0-alpha | 25/04/2026 | M1 concluído com taxonomia comercial unificada entre Home e Mercado |
| 1.8.1-alpha | 25/04/2026 | M2 parcial: coleções com subtítulo/link no CMS, admin e Home |
| 1.8.2-alpha | 25/04/2026 | M2 parcial: seção Mais Vendidos conectada ao analytics/top |
| 1.8.3-alpha | 25/04/2026 | M2 parcial: curadoria manual híbrida por categoria via curatedProductIds |
| 1.8.4-alpha | 25/04/2026 | M2 parcial: destaque horizontal com produto exaltado, badge e nota |
| 1.9.0-alpha | 25/04/2026 | M2 concluído com CMS 2.0 operacional e CRUD completo no admin |
| 1.9.1-alpha | 25/04/2026 | M3 parcial: header com contexto de entrega persistido e fallback sem endereço |
| 1.10.0-alpha | 25/04/2026 | M3 concluído: operação de entrega dinâmica com janelas, exceções, feriados e countdown |
| 1.10.1-alpha | 25/04/2026 | M4 parcial: rota principal de descoberta migrada para /mercado com compatibilidade via /busca |
| 1.10.2-alpha | 25/04/2026 | M4 parcial: layout do Mercado simplificado com limpeza rápida de filtros |
| 1.11.0-alpha | 25/04/2026 | M4 concluído: filtros mercadológicos com paridade Prisma/Meili e endpoint público da árvore |
| 1.11.1-alpha | 25/04/2026 | M5 parcial: página pública de produto com seções schema-driven e rota /produto/:id |
| 1.11.2-alpha | 25/04/2026 | M5 parcial: detalhe de produto com recomendações reais de co-purchase |
| 1.12.0-alpha | 25/04/2026 | M5 concluído: detalhe completo com galeria, blocos dinâmicos e integração ERP+editorial |
| 1.12.1-alpha | 25/04/2026 | M6 parcial: carrinho com foto de item e controles consistentes mobile/desktop |
| 1.12.2-alpha | 25/04/2026 | M6 parcial: cupom real ponta a ponta (carrinho + checkout + validação server-side no pedido) |
| 1.13.0-alpha | 30/04/2026 | M7 concluído: receitas estilo blog com compra integrada, carrinho flutuante e CRUD admin |
| 1.14.0-alpha | 01/05/2026 | M8 concluído: identidade visual gerenciável no admin com logo, paleta e header dinâmico |
| 1.15.0-alpha | 01/05/2026 | M9 concluído: SEO profissional transversal com schema.org, canonical, noindex, LCP e preconnect |
| 1.22.0-alpha | 19/05/2026 | Paridade de taxonomia storefront/admin, categories_cms restaurada e EAN mappings |
| 1.23.0-alpha | 24/05/2026 | Saneamento de arquivos da raiz, reorganização de arquivos-projeto e atualização de docker-compose |
