---
title: Auditoria 360 — analise estatica e arquitetura
tags: [auditoria, arquitetura, qualidade]
created: 2026-09-11
updated: 2026-09-13
status: consolidado-com-lacunas
type: relatorio
---

# Fase 1 — Análise estática e arquitetura

Relatório de auditoria somente de leitura, consolidado em 12/09/2026 e ampliado em 13/09/2026. Inventário amplo concluído e análises automatizadas executadas; leitura semântica dirigida aos fluxos e achados documentados. **Não foi concluída uma revisão semântica integral de cada linha de todos os arquivos.** Essa exigência original permanece uma lacuna explícita; as tabelas não devem ser usadas como certificado de ausência de defeitos. Nenhuma correção foi aplicada.

## Síntese dos resultados

Foram documentados **86 itens de evidência**, vinculados a **84 issues únicas no Linear** (83 novas e uma reutilizada). A continuação de 12–13/09 acrescentou 16 achados e a leitura semântica integral de 11 arquivos de privacidade, B2B e marketplace; a JON-71 recebeu ocorrências equivalentes adicionais. Os testes finais do backend passaram em 63 suítes/451 casos; frontend passou em 118 casos; os cinco apps passaram no typecheck inicial, com backend/frontend/admin novamente aprovados após mudanças concorrentes. Permanecem dois erros de lint e uma configuração PM2 inválida.

Os riscos principais incluem ingestão pública de marketplace sem segredo obrigatório, isolamento incompleto de seus canais, sessões válidas após anonimização e exposição de hashes em relações de clientes, autorização incompleta de motoristas/separadores, perda de regra de substituição no checkout, recotação sem comparação final, worker outbox sem entrega efetiva e possibilidade de falso sucesso de backup. As propostas e testes de aceitação estão detalhados por achado; nenhuma correção foi aplicada.

| Prioridade | Itens de evidência | IDs |
|---|---:|---|
| High | 14 | F01, F02, F03, F04, F07, F08, D10, D12, F27, F28, F31, F44, F45, F48 |
| Medium | 61 | F05, F06, F09, F10, F11, F12, F13, F14, F15, F16, F17, F20, F22, F23, F25, F26, D02, D04, D05, D06, D07, D08, D09, D11, D13, D14, D15, D16, D18, D19, D20, D22, D23, D24, D25, D26, D27, F29, F30, F32, F33, F36, F38, F39, F40, F41, F42, F43, F46, F47, F49, F50, F51, F52, F53, F54, F55, F56, F57, F58, F59 |
| Low | 11 | F18, F19, F21, F24, D01, D03, D17, D21, F34, F35, F37 |

Nas 84 issues únicas há 14 High, 59 Medium e 11 Low; dois pares de evidências de dependências compartilham issue. Não há Urgent. As labels exatas solicitadas estão pendentes: foi usada Melhoria conforme autorização do coordenador, com a categoria desejada no título/corpo. **A revisão semântica integral linha a linha permanece uma lacuna explícita.**

Navegação: [metodologia e comandos](#metodologia-e-comandos-executados), [arquitetura](#visão-arquitetural), [dependências](#dependências-e-estado-de-atualização), [Linear](#linear--rastreabilidade-e-confirmação), [deltas do worktree](#revalidação-após-alterações-concorrentes) e [limitações](#limitações-e-lacunas-de-cobertura).

## Inventário e cobertura

`rg --files`: **8426 arquivos**. `rg --files --hidden --no-ignore`: **176607 arquivos** antes da criação deste relatório.

| Classe | Arquivos | Tratamento |
|---|---:|---|
| Fonte/configuracao/documentacao | 1049 | Inventariada individualmente; cobertura semântica discriminada abaixo |
| Ferramental de agentes/IDE | 351 | Ferramentas externas e instruções de agentes; não fazem parte da aplicação |
| Artefatos gerados/cache | 8264 | Não-fonte; builds, perfis de browser, relatórios Graphify, mapas e caches |
| Binarios/assets/certificados | 88 | Não-auditáveis linha a linha; metadados de presença apenas |
| Ambiente privado | 5 | Valores não inspecionados nem exportados; Prisma CLI carregou automaticamente .env durante validate, com DATABASE_URL substituída por fixture |
| Backups | 1678 | Não-auditável como versão ativa; cópias históricas preservadas |
| Metadados Git | 291 | Não-fonte; somente status e revisão consultados |
| Dependencias instaladas | 147102 | Não-fonte própria; versões/lockfiles e advisories auditados |
| Runtime Python embarcado | 1218 | Terceiro/binário distribuído, fora do código autoral |
| Documentacao historica arquivada | 101 | Memória histórica; não tratada como estado atual |
| Uploads | 16460 | Não-fonte; conteúdo do usuário não inspecionado |

| Área de fonte | Arquivos | Linhas físicas |
|---|---:|---:|
| `.github` | 6 | 401 |
| `.gitignore` | 1 | 108 |
| `.recent_commits.txt` | 1 | 148 |
| `.vscode` | 2 | 34 |
| `AGENTS.md` | 1 | 132 |
| `ANALISE_PROJETO.md` | 1 | 399 |
| `CHANGELOG.md` | 1 | 1849 |
| `CLAUDE.md` | 1 | 768 |
| `CLAUDE_CODE_BRIEFING.md` | 1 | 369 |
| `DESIGN.md` | 1 | 232 |
| `EXECUTAR_CHECKLIST.md` | 1 | 1095 |
| `GRAPHIFY_ALTERNATIVA_NATIVA.md` | 1 | 261 |
| `GRAPHIFY_CLAUDE_CODE_GUIDE.md` | 1 | 216 |
| `GRAPHIFY_CLI_INSTALADO.md` | 1 | 213 |
| `GRAPHIFY_IMPLEMENTADO_RESUMO.md` | 1 | 330 |
| `GRAPHIFY_TROUBLESHOOTING.md` | 1 | 213 |
| `IMPLEMENTACAO_GRAPHIFY_VAULT.md` | 1 | 661 |
| `MELHORIAS_UIUX_TOPBENCHMARK.md` | 1 | 967 |
| `Notificador` | 21 | 2775 |
| `PLANO_EXECUCAO_FINAL.md` | 1 | 690 |
| `PLANO_IMPLEMENTACAO_UIUX.md` | 1 | 667 |
| `PRODUCT.md` | 1 | 40 |
| `README.md` | 1 | 51 |
| `SAUDE_PROJETO_E_RECOMENDACOES.md` | 1 | 360 |
| `UIUX_QUICK_START.md` | 1 | 358 |
| `VIABILIDADE_VERCEL_SUPABASE.md` | 1 | 400 |
| `agent.md` | 1 | 45 |
| `auditoria_report.html` | 1 | 53 |
| `config.json` | 1 | 8 |
| `design` | 2 | 360 |
| `design-system` | 1 | 208 |
| `docs` | 204 | 205993 |
| `logos` | 1 | 1 |
| `package.json` | 1 | 9 |
| `scripts` | 12 | 1112 |
| `sistema/.env.example` | 1 | 151 |
| `sistema/.env.production.example` | 1 | 85 |
| `sistema/.env.staging.example` | 1 | 70 |
| `sistema/.graphifyignore` | 1 | 15 |
| `sistema/Caddyfile` | 1 | 27 |
| `sistema/README.md` | 1 | 61 |
| `sistema/STATUS.json` | 1 | 90 |
| `sistema/admin` | 110 | 35430 |
| `sistema/api` | 1 | 1916 |
| `sistema/backend` | 432 | 73266 |
| `sistema/backup` | 3 | 78 |
| `sistema/certs` | 3 | 83 |
| `sistema/check-baseline.sql` | 1 | 5 |
| `sistema/create-gaps.sql` | 1 | 27 |
| `sistema/delivery-app` | 23 | 4456 |
| `sistema/docker-compose.prod.yml` | 1 | 249 |
| `sistema/docker-compose.staging.yml` | 1 | 132 |
| `sistema/docker-compose.yml` | 1 | 206 |
| `sistema/ecosystem.config.js` | 1 | 25 |
| `sistema/frontend` | 135 | 33630 |
| `sistema/go-live-ops.ps1` | 1 | 134 |
| `sistema/package-lock.json` | 1 | 510 |
| `sistema/package.json` | 1 | 37 |
| `sistema/picking-app` | 24 | 5485 |
| `sistema/produtos-listagem.md` | 1 | 71 |
| `sistema/release-ops.ps1` | 1 | 158 |
| `sistema/scripts` | 17 | 4135 |
| `sistema/seed-admin.sql` | 1 | 17 |
| `sistema/setup.sh` | 1 | 47 |
| `sistema/stack-ops.ps1` | 1 | 64 |
| `sistema/staging-ops.ps1` | 1 | 81 |
| `sistema/start-all.sh` | 1 | 38 |
| `sistema/startup-for-debug.ps1` | 1 | 109 |
| `sistema/update_slides.sql` | 1 | 3 |

## Registro individual do inventário de fonte

A tabela comprova enumeração, contagem de linhas e impressão digital do conteúdo; **não equivale a revisão semântica integral**. Arquivos grandes de dados/lockfiles mantêm contagem física, sem confundir dados com lógica. A cobertura das leituras, análise AST e verificações aparece nas seções seguintes.

| Arquivo | Linhas | SHA-256 (prefixo) | Cobertura efetiva |
|---|---:|---|---|
| `.github/copilot-instructions.md.disable` | 65 | `5b26adf63987f61f` | Inventário; revisão semântica integral pendente |
| `.github/hooks/impeccable.json` | 13 | `39b15843c104c785` | Parser de formato; semântica integral não verificada |
| `.github/modernize/code-migration/.gitignore` | 2 | `91bfcbebfc29d8da` | Inventário; revisão semântica integral pendente |
| `.github/modernize/code-migration/20260514095743/progress.md` | 17 | `b35ab460daeb8eae` | Inventário; revisão semântica integral pendente |
| `.github/workflows/ci.yml` | 160 | `03126f5e7f088e02` | Leitura dirigida; semântica integral não verificada |
| `.github/workflows/test-pr.yml` | 144 | `015cb688090c514e` | Leitura dirigida; semântica integral não verificada |
| `.gitignore` | 108 | `8fe85efacb1fad73` | Inventário; revisão semântica integral pendente |
| `.recent_commits.txt` | 148 | `151c926c0311a109` | Inventário; revisão semântica integral pendente |
| `.vscode/mcp.json` | 11 | `0f51c9eceddbe1e5` | Parser de formato; semântica integral não verificada |
| `.vscode/settings.json` | 23 | `e4315b415dbad244` | Parser de formato; semântica integral não verificada |
| `AGENTS.md` | 132 | `70477faf2b29d39a` | Leitura integral das instruções |
| `ANALISE_PROJETO.md` | 399 | `58843a1bbb80dd72` | Inventário; revisão semântica integral pendente |
| `CHANGELOG.md` | 1849 | `4cd98fb5215be6fc` | Inventário; revisão semântica integral pendente |
| `CLAUDE.md` | 768 | `c6bad2a8e82eea99` | Leitura integral das instruções |
| `CLAUDE_CODE_BRIEFING.md` | 369 | `c6fbb3e486f014d8` | Inventário; revisão semântica integral pendente |
| `DESIGN.md` | 232 | `7e285f0a9cbbcb68` | Inventário; revisão semântica integral pendente |
| `EXECUTAR_CHECKLIST.md` | 1095 | `ce0528e76a1ef2cb` | Inventário; revisão semântica integral pendente |
| `GRAPHIFY_ALTERNATIVA_NATIVA.md` | 261 | `2485133b27ec73b2` | Inventário; revisão semântica integral pendente |
| `GRAPHIFY_CLAUDE_CODE_GUIDE.md` | 216 | `5cddb87b3f9e897a` | Inventário; revisão semântica integral pendente |
| `GRAPHIFY_CLI_INSTALADO.md` | 213 | `9db4358896a30416` | Inventário; revisão semântica integral pendente |
| `GRAPHIFY_IMPLEMENTADO_RESUMO.md` | 330 | `76b791c094d85583` | Inventário; revisão semântica integral pendente |
| `GRAPHIFY_TROUBLESHOOTING.md` | 213 | `7c5d3b5e33edfd0f` | Inventário; revisão semântica integral pendente |
| `IMPLEMENTACAO_GRAPHIFY_VAULT.md` | 661 | `7b3aa18a1688c068` | Inventário; revisão semântica integral pendente |
| `MELHORIAS_UIUX_TOPBENCHMARK.md` | 967 | `76d3b40e93b1cb40` | Inventário; revisão semântica integral pendente |
| `Notificador/.env.example` | 29 | `e0092b3728a75e25` | Inventário; revisão semântica integral pendente |
| `Notificador/.gitignore` | 3 | `94de5574d03f34cf` | Inventário; revisão semântica integral pendente |
| `Notificador/README.md` | 196 | `ce858ebbb1aa2926` | Inventário; revisão semântica integral pendente |
| `Notificador/dorsal.js` | 137 | `c2e6540476762e11` | AST integral; semântica dirigida |
| `Notificador/escalation.js` | 111 | `a529c9e96a28e69f` | AST integral; semântica dirigida |
| `Notificador/escalation.test.js` | 127 | `7effe0771d77b41c` | AST integral; semântica integral não verificada |
| `Notificador/faturamento.js` | 93 | `887ff8c02a02dabc` | AST integral; semântica integral não verificada |
| `Notificador/faturamento.test.js` | 102 | `039488e07f608a91` | AST integral; semântica integral não verificada |
| `Notificador/install.bat` | 45 | `b5a970be5fdb615e` | Inventário; revisão semântica integral pendente |
| `Notificador/launcher.vbs` | 3 | `c7b9784c33083865` | Inventário; revisão semântica integral pendente |
| `Notificador/main.js` | 439 | `8b3d82a8d7d098b3` | AST integral; semântica dirigida |
| `Notificador/package-lock.json` | 1011 | `482bb21663b86988` | Parser de formato; semântica integral não verificada |
| `Notificador/package.json` | 15 | `a083cccdb9a59938` | Parser de formato; semântica integral não verificada |
| `Notificador/preload.js` | 13 | `af8242f46901d837` | AST integral; semântica integral não verificada |
| `Notificador/renderer/index.html` | 19 | `3f79384437e349bf` | Inventário; revisão semântica integral pendente |
| `Notificador/renderer/renderer.js` | 93 | `55206da2a8eabbf0` | AST integral; semântica integral não verificada |
| `Notificador/renderer/style.css` | 145 | `8ac5afa0c264d464` | Parser de formato; semântica integral não verificada |
| `Notificador/renderer/toast.css` | 129 | `16fb4ad8835edcd8` | Parser de formato; semântica integral não verificada |
| `Notificador/renderer/toast.html` | 26 | `5ae0037c6ee01023` | Inventário; revisão semântica integral pendente |
| `Notificador/renderer/toast.js` | 26 | `161a41c823648604` | AST integral; semântica integral não verificada |
| `Notificador/uninstall.bat` | 13 | `64e36359eff81c2e` | Inventário; revisão semântica integral pendente |
| `PLANO_EXECUCAO_FINAL.md` | 690 | `b287d1437aaba83c` | Inventário; revisão semântica integral pendente |
| `PLANO_IMPLEMENTACAO_UIUX.md` | 667 | `6e61e7c86c15b075` | Inventário; revisão semântica integral pendente |
| `PRODUCT.md` | 40 | `8978da629cc11fe6` | Inventário; revisão semântica integral pendente |
| `README.md` | 51 | `764553fb9ffb5c18` | Inventário; revisão semântica integral pendente |
| `SAUDE_PROJETO_E_RECOMENDACOES.md` | 360 | `ca9b966d26a5a4ab` | Inventário; revisão semântica integral pendente |
| `UIUX_QUICK_START.md` | 358 | `d3b23b51f6005647` | Inventário; revisão semântica integral pendente |
| `VIABILIDADE_VERCEL_SUPABASE.md` | 400 | `973f24c99f0e7b19` | Inventário; revisão semântica integral pendente |
| `agent.md` | 45 | `e02d173a9839b94c` | Inventário; revisão semântica integral pendente |
| `auditoria_report.html` | 53 | `1a9bece9af2d7c85` | Inventário; revisão semântica integral pendente |
| `config.json` | 8 | `51ada4c968fe788a` | Parser de formato; semântica integral não verificada |
| `design-system/mercado-antenor-&-filhos/MASTER.md` | 208 | `a7e13cfe8a0ee91c` | Inventário; revisão semântica integral pendente |
| `design/COMPONENT-INVENTORY.md` | 204 | `aa61b275b64ee0d9` | Inventário; revisão semântica integral pendente |
| `design/DESIGN-SPEC.md` | 156 | `8013769570acbb83` | Inventário; revisão semântica integral pendente |
| `docs/alinhamento-checksum-e-deploy-final.html` | 322 | `8aac9b3fec7f1789` | Inventário; revisão semântica integral pendente |
| `docs/alinhamento-checksum-e-deploy-final.md` | 60 | `23824cb7c5e3ca9e` | Inventário; revisão semântica integral pendente |
| `docs/ambiente-de-desenvolvimento.html` | 299 | `2f62e52da194d942` | Inventário; revisão semântica integral pendente |
| `docs/ambiente-de-desenvolvimento.md` | 184 | `f8f725ffe9c5db4b` | Inventário; revisão semântica integral pendente |
| `docs/analises/catalogo-nova-real/LEIA-ME-CONFERENCIA.md` | 27 | `7188f269ce99fd09` | Inventário; revisão semântica integral pendente |
| `docs/analises/catalogo-nova-real/README.md` | 404 | `8c24481da8aeb8b1` | Inventário; revisão semântica integral pendente |
| `docs/analises/catalogo-nova-real/alerta-codigo-pizza-5127.md` | 12 | `c41d52e72d3b3045` | Inventário; revisão semântica integral pendente |
| `docs/analises/catalogo-nova-real/amostra-validacao-lote.csv` | 125 | `8bcc368716bd499f` | Dados tabulares; inventário, sem valores no relatório |
| `docs/analises/catalogo-nova-real/amostra-validacao-lote.md` | 12 | `e8fed2eceafeb6ed` | Inventário; revisão semântica integral pendente |
| `docs/analises/catalogo-nova-real/aplicar-excecoes-parametros.ps1` | 403 | `cad52fe2900bda14` | Parser PowerShell; não executado |
| `docs/analises/catalogo-nova-real/arquitetura-disponibilidade-por-filial.md` | 112 | `9058ae4129e27cd4` | Inventário; revisão semântica integral pendente |
| `docs/analises/catalogo-nova-real/ativos-alf-fora-nova-real.csv` | 2283 | `737a479059ebacb8` | Dados tabulares; inventário, sem valores no relatório |
| `docs/analises/catalogo-nova-real/auditoria-candidatos-sempre.md` | 80 | `5b029702b61ea3c3` | Inventário; revisão semântica integral pendente |
| `docs/analises/catalogo-nova-real/auditoria-cenario-alf-nova-real.md` | 48 | `25769dfe62552fb5` | Inventário; revisão semântica integral pendente |
| `docs/analises/catalogo-nova-real/auditoria-duplicidades-app.md` | 42 | `240e90c65a2c0d33` | Inventário; revisão semântica integral pendente |
| `docs/analises/catalogo-nova-real/auditoria-entradas-nfe.md` | 122 | `5b0b32b7ebeed4f3` | Inventário; revisão semântica integral pendente |
| `docs/analises/catalogo-nova-real/auditoria-estoque-para-nunca.md` | 31 | `c4308ad364032ec0` | Inventário; revisão semântica integral pendente |
| `docs/analises/catalogo-nova-real/auditoria-live-evidencias.csv` | 15876 | `fe0d251eca40019c` | Dados tabulares; inventário, sem valores no relatório |
| `docs/analises/catalogo-nova-real/auditoria-live-evidencias.md` | 32 | `766db14051b34167` | Inventário; revisão semântica integral pendente |
| `docs/analises/catalogo-nova-real/auditoria-ovos.md` | 63 | `27c08cfc19a22d71` | Inventário; revisão semântica integral pendente |
| `docs/analises/catalogo-nova-real/auditoria-produtos-fora-base-live.md` | 25 | `2d3471bee256ed79` | Inventário; revisão semântica integral pendente |
| `docs/analises/catalogo-nova-real/auditoria-reativacao-imediata.md` | 69 | `3dd0f028de5d0214` | Inventário; revisão semântica integral pendente |
| `docs/analises/catalogo-nova-real/auditoria-saldo-nao-positivo.md` | 93 | `64589a81a865a4bb` | Inventário; revisão semântica integral pendente |
| `docs/analises/catalogo-nova-real/auditoria-sempre-para-nunca.md` | 34 | `7aff016e5546197d` | Inventário; revisão semântica integral pendente |
| `docs/analises/catalogo-nova-real/auditoria-sempre-sem-giro-live.csv` | 288 | `cf40efb0f5aa23b8` | Dados tabulares; inventário, sem valores no relatório |
| `docs/analises/catalogo-nova-real/auditoria-sempre-sem-giro-live.md` | 14 | `cc0dcaf6eb0fdddd` | Inventário; revisão semântica integral pendente |
| `docs/analises/catalogo-nova-real/auditoria-snapshot-live.md` | 19 | `fa362ad87da71bdd` | Inventário; revisão semântica integral pendente |
| `docs/analises/catalogo-nova-real/backup-lote-execucao-20260901-024248.csv` | 2247 | `640e275887d31505` | Dados tabulares; inventário, sem valores no relatório |
| `docs/analises/catalogo-nova-real/base-mestra.csv` | 14844 | `4626e9bb35094fe9` | Dados tabulares; inventário, sem valores no relatório |
| `docs/analises/catalogo-nova-real/bloqueio-sem-descricao.csv` | 27 | `8d178f040d98a0fd` | Dados tabulares; inventário, sem valores no relatório |
| `docs/analises/catalogo-nova-real/bloqueio-sem-ean-lote.csv` | 3 | `c4e8c12df1071baf` | Dados tabulares; inventário, sem valores no relatório |
| `docs/analises/catalogo-nova-real/bloqueio-sem-ean-lote.md` | 6 | `9dba0606f4c793c5` | Inventário; revisão semântica integral pendente |
| `docs/analises/catalogo-nova-real/buscas-app.csv` | 26 | `bcbeae3131ecf6cb` | Dados tabulares; inventário, sem valores no relatório |
| `docs/analises/catalogo-nova-real/calcular-resultado-amostra.ps1` | 2 | `1be3f1005954f48d` | Parser PowerShell; não executado |
| `docs/analises/catalogo-nova-real/campanha-baixo-giro.csv` | 42 | `0ca4e3d67c51c88f` | Dados tabulares; inventário, sem valores no relatório |
| `docs/analises/catalogo-nova-real/campanha-sem-venda-validada.csv` | 30 | `5135a34b96aa72ec` | Dados tabulares; inventário, sem valores no relatório |
| `docs/analises/catalogo-nova-real/campanha-sem-venda.csv` | 36 | `dcb65699b4c7d4eb` | Dados tabulares; inventário, sem valores no relatório |
| `docs/analises/catalogo-nova-real/campanha-suspensa-cadastro.csv` | 7 | `a1341ca8b7ad79f2` | Dados tabulares; inventário, sem valores no relatório |
| `docs/analises/catalogo-nova-real/campanha-viabilidade-economica.csv` | 71 | `27d09c3e425bacb9` | Dados tabulares; inventário, sem valores no relatório |
| `docs/analises/catalogo-nova-real/cenario-giro-comprovado.csv` | 15876 | `74e13f9b32d7e68c` | Dados tabulares; inventário, sem valores no relatório |
| `docs/analises/catalogo-nova-real/cenario-giro-comprovado.md` | 20 | `866a41d4a942db4d` | Inventário; revisão semântica integral pendente |
| `docs/analises/catalogo-nova-real/checklist-conferencia-amostra.html` | 124 | `8532667b7da41a98` | Inventário; revisão semântica integral pendente |
| `docs/analises/catalogo-nova-real/checklist-provisorio-ean-cadastrado.csv` | 125 | `0876f9fb5816a554` | Dados tabulares; inventário, sem valores no relatório |
| `docs/analises/catalogo-nova-real/comparativo-embalagem-venda-sem-nfe.csv` | 304 | `182a04b8e8a548bb` | Dados tabulares; inventário, sem valores no relatório |
| `docs/analises/catalogo-nova-real/comparativo-embalagem-venda-sem-nfe.md` | 13 | `9b50d807e728a7aa` | Inventário; revisão semântica integral pendente |
| `docs/analises/catalogo-nova-real/contagem-prioritaria.csv` | 88 | `36df8bbd70807a9a` | Dados tabulares; inventário, sem valores no relatório |
| `docs/analises/catalogo-nova-real/corrigir-ean-formulario.ps1` | 2 | `c5ac265ff1421830` | Parser PowerShell; não executado |
| `docs/analises/catalogo-nova-real/corrigir-formulario-todos-eans.ps1` | 2 | `4d52b5763e114d5f` | Parser PowerShell; não executado |
| `docs/analises/catalogo-nova-real/cruzar-duplicidades-solidcon.ps1` | 151 | `06d2497676cd73aa` | Parser PowerShell; não executado |
| `docs/analises/catalogo-nova-real/cruzar-nfe-snapshot-live.ps1` | 21 | `7006751b347a126d` | Parser PowerShell; não executado |
| `docs/analises/catalogo-nova-real/curva-a-acao-imediata.csv` | 39 | `fedb88d35a136088` | Dados tabulares; inventário, sem valores no relatório |
| `docs/analises/catalogo-nova-real/curva-a-ocultos-priorizada.csv` | 65 | `5320c384dd6bceb6` | Dados tabulares; inventário, sem valores no relatório |
| `docs/analises/catalogo-nova-real/curva-a-ocultos.csv` | 65 | `711418c805ce25ce` | Dados tabulares; inventário, sem valores no relatório |
| `docs/analises/catalogo-nova-real/curva-abc-mercadorias.csv` | 3277 | `05ae7108d54da8cd` | Dados tabulares; inventário, sem valores no relatório |
| `docs/analises/catalogo-nova-real/curva-abc-vendas.csv` | 3291 | `fd295dbd07708233` | Dados tabulares; inventário, sem valores no relatório |
| `docs/analises/catalogo-nova-real/dados-demo-producao.csv` | 30 | `d94d2a688c44d08c` | Dados tabulares; inventário, sem valores no relatório |
| `docs/analises/catalogo-nova-real/decisao-fabricacao-propria.md` | 139 | `8569bb7e128327dd` | Inventário; revisão semântica integral pendente |
| `docs/analises/catalogo-nova-real/decisoes-humanas.csv` | 1450 | `33890adca1a79186` | Dados tabulares; inventário, sem valores no relatório |
| `docs/analises/catalogo-nova-real/duplicidades-app-solidcon.csv` | 525 | `4634f13d42988fe5` | Dados tabulares; inventário, sem valores no relatório |
| `docs/analises/catalogo-nova-real/duplicidades-app.csv` | 1311 | `00aacdc3afdbdf90` | Dados tabulares; inventário, sem valores no relatório |
| `docs/analises/catalogo-nova-real/eans-familias-solidcon.csv` | 16943 | `d927b0ad5a8a917e` | Dados tabulares; inventário, sem valores no relatório |
| `docs/analises/catalogo-nova-real/eans-fisicos-pizza.md` | 16 | `b47ce808711452b4` | Inventário; revisão semântica integral pendente |
| `docs/analises/catalogo-nova-real/entradas-nfe-auditadas.csv` | 2535 | `80fd22887d93f1a3` | Dados tabulares; inventário, sem valores no relatório |
| `docs/analises/catalogo-nova-real/estado-atual-bits-solidcon.csv` | 7 | `3bcad1c09f146438` | Dados tabulares; inventário, sem valores no relatório |
| `docs/analises/catalogo-nova-real/estrategia-campanhas-piloto.md` | 112 | `ea4f9074ee6f0259` | Inventário; revisão semântica integral pendente |
| `docs/analises/catalogo-nova-real/evidencia-ecommerce-filiais.csv` | 4 | `1c7f3e5cc1c3d8f7` | Dados tabulares; inventário, sem valores no relatório |
| `docs/analises/catalogo-nova-real/exclusoes-nao-mercadoria-live.csv` | 28 | `3f8939bd5ee646e4` | Dados tabulares; inventário, sem valores no relatório |
| `docs/analises/catalogo-nova-real/exclusoes-nao-mercadoria-live.md` | 11 | `500dd97346c4271d` | Inventário; revisão semântica integral pendente |
| `docs/analises/catalogo-nova-real/executar-lote-aprovado.ps1` | 29 | `59b8c69916802a66` | Parser PowerShell; não executado |
| `docs/analises/catalogo-nova-real/extrair-eans-familias-solidcon.ps1` | 3 | `c3a6fbc53a6722e3` | Parser PowerShell; não executado |
| `docs/analises/catalogo-nova-real/extrair-parametros-embalagem-solidcon.ps1` | 2 | `6e43c99f9c661db5` | Parser PowerShell; não executado |
| `docs/analises/catalogo-nova-real/extrair-snapshot-live-solidcon.ps1` | 162 | `be065aa3b028a6a1` | Parser PowerShell; não executado |
| `docs/analises/catalogo-nova-real/fabricacao-propria-revisao.csv` | 235 | `f7bf3c9cc23284ed` | Dados tabulares; inventário, sem valores no relatório |
| `docs/analises/catalogo-nova-real/fila-conferencia-nfe.csv` | 14 | `fd1e1a6a82e38d47` | Dados tabulares; inventário, sem valores no relatório |
| `docs/analises/catalogo-nova-real/fila-operacional-acao-imediata.csv` | 39 | `b258b53012ceac40` | Dados tabulares; inventário, sem valores no relatório |
| `docs/analises/catalogo-nova-real/fila-visibilidade-giro-nova-real.csv` | 1401 | `6baf039ff2dd47e8` | Dados tabulares; inventário, sem valores no relatório |
| `docs/analises/catalogo-nova-real/fila-visibilidade-giro-nova-real.md` | 15 | `4214c354087c8bb3` | Inventário; revisão semântica integral pendente |
| `docs/analises/catalogo-nova-real/formulario-conferencia-amostra-ean-texto.csv` | 125 | `1ec477695cdaa5f3` | Dados tabulares; inventário, sem valores no relatório |
| `docs/analises/catalogo-nova-real/formulario-conferencia-amostra-eans-completos.csv` | 125 | `007dc0db9c7ea607` | Dados tabulares; inventário, sem valores no relatório |
| `docs/analises/catalogo-nova-real/formulario-conferencia-amostra-final.csv` | 125 | `a92ae7c4f6db1248` | Dados tabulares; inventário, sem valores no relatório |
| `docs/analises/catalogo-nova-real/formulario-conferencia-amostra-html-importado.csv` | 125 | `a92ae7c4f6db1248` | Dados tabulares; inventário, sem valores no relatório |
| `docs/analises/catalogo-nova-real/formulario-conferencia-amostra-organizado.html` | 124 | `7d013abe48bad24c` | Inventário; revisão semântica integral pendente |
| `docs/analises/catalogo-nova-real/formulario-conferencia-amostra.csv` | 125 | `2998c63c70fa2722` | Dados tabulares; inventário, sem valores no relatório |
| `docs/analises/catalogo-nova-real/formulario-conferencia-amostra.md` | 10 | `05b99e6e594dbae3` | Inventário; revisão semântica integral pendente |
| `docs/analises/catalogo-nova-real/frescor-vendas-filiais.csv` | 17 | `d5e88a8680ec18d2` | Dados tabulares; inventário, sem valores no relatório |
| `docs/analises/catalogo-nova-real/gates-decisao-antes-gravacao.md` | 21 | `448d5cce1d7eb04f` | Inventário; revisão semântica integral pendente |
| `docs/analises/catalogo-nova-real/gerar-amostra-validacao-lote.ps1` | 2 | `b0d4fe34e4e84439` | Parser PowerShell; não executado |
| `docs/analises/catalogo-nova-real/gerar-auditoria-duplicidades-app.ps1` | 121 | `288ea28068739d99` | Parser PowerShell; não executado |
| `docs/analises/catalogo-nova-real/gerar-auditoria-live-evidencias.ps1` | 21 | `9f69ef15440ba625` | Parser PowerShell; não executado |
| `docs/analises/catalogo-nova-real/gerar-auditoria-sempre-sem-giro-live.ps1` | 2 | `43fc8ce49be82523` | Parser PowerShell; não executado |
| `docs/analises/catalogo-nova-real/gerar-bloqueio-sem-descricao.ps1` | 2 | `1c79b21e85032841` | Parser PowerShell; não executado |
| `docs/analises/catalogo-nova-real/gerar-bloqueio-sem-ean-lote.ps1` | 2 | `89ce02e5a5cf2d99` | Parser PowerShell; não executado |
| `docs/analises/catalogo-nova-real/gerar-cenario-alf-fora-do-mix.ps1` | 53 | `e1643d679848dbd8` | Parser PowerShell; não executado |
| `docs/analises/catalogo-nova-real/gerar-cenario-giro-comprovado.ps1` | 3 | `4b59f3e72bdacc8d` | Parser PowerShell; não executado |
| `docs/analises/catalogo-nova-real/gerar-checklist-conferencia.ps1` | 9 | `ed614f69ca8d480f` | Parser PowerShell; não executado |
| `docs/analises/catalogo-nova-real/gerar-comparativo-embalagem-venda-sem-nfe.ps1` | 4 | `5ea89e2ceb312785` | Parser PowerShell; não executado |
| `docs/analises/catalogo-nova-real/gerar-exclusoes-nao-mercadoria-live.ps1` | 2 | `23a2cf769402384b` | Parser PowerShell; não executado |
| `docs/analises/catalogo-nova-real/gerar-fila-estoque-para-nunca.ps1` | 115 | `096ab03a3acb97ad` | Parser PowerShell; não executado |
| `docs/analises/catalogo-nova-real/gerar-fila-fora-base-live.ps1` | 101 | `66dd16f29d329294` | Parser PowerShell; não executado |
| `docs/analises/catalogo-nova-real/gerar-fila-saldo-nao-positivo.ps1` | 315 | `9c69bb9ab7eb7378` | Parser PowerShell; não executado |
| `docs/analises/catalogo-nova-real/gerar-fila-sempre-para-nunca.ps1` | 113 | `daefe0340b6d2f2d` | Parser PowerShell; não executado |
| `docs/analises/catalogo-nova-real/gerar-fila-sempre.ps1` | 128 | `8a1a1ba97968bd49` | Parser PowerShell; não executado |
| `docs/analises/catalogo-nova-real/gerar-fila-visibilidade-giro-nova-real.ps1` | 4 | `deee2da03b63662c` | Parser PowerShell; não executado |
| `docs/analises/catalogo-nova-real/gerar-formulario-conferencia-amostra.ps1` | 6 | `d73ffb35bcdcafcf` | Parser PowerShell; não executado |
| `docs/analises/catalogo-nova-real/gerar-formulario-html-organizado.ps1` | 8 | `3ef96b25cd75b01a` | Parser PowerShell; não executado |
| `docs/analises/catalogo-nova-real/gerar-investigacao-venda-sem-nfe-live.ps1` | 9 | `6655d7d63417e83a` | Parser PowerShell; não executado |
| `docs/analises/catalogo-nova-real/gerar-lote-alta-confianca-giro-nfe.ps1` | 2 | `ef3cd0f8436c8d28` | Parser PowerShell; não executado |
| `docs/analises/catalogo-nova-real/gerar-lote-execucao-aprovado.ps1` | 8 | `47c321d971da7706` | Parser PowerShell; não executado |
| `docs/analises/catalogo-nova-real/gerar-lotes-por-parametro-atual.ps1` | 2 | `ed17b9f08a8c0c9c` | Parser PowerShell; não executado |
| `docs/analises/catalogo-nova-real/gerar-matriz-decisao-live.ps1` | 16 | `ea373639155c1d69` | Parser PowerShell; não executado |
| `docs/analises/catalogo-nova-real/gerar-prioridade-65-embalagem.ps1` | 2 | `20ba74f19efe37d5` | Parser PowerShell; não executado |
| `docs/analises/catalogo-nova-real/gerar-resumo-campanhas-giro.ps1` | 2 | `03f098547c560946` | Parser PowerShell; não executado |
| `docs/analises/catalogo-nova-real/gerar-revisao-nunca-com-giro-live.ps1` | 7 | `af57a1b2ea61f051` | Parser PowerShell; não executado |
| `docs/analises/catalogo-nova-real/gerar-sql-lote-alta-confianca.ps1` | 34 | `7ab968c9b4da0bd8` | Parser PowerShell; não executado |
| `docs/analises/catalogo-nova-real/gerar-sql-lote-nunca-giro.ps1` | 13 | `f039060cba2d8fa6` | Parser PowerShell; não executado |
| `docs/analises/catalogo-nova-real/historico-pedidos-app.csv` | 36 | `c7aa1a6ee797f339` | Dados tabulares; inventário, sem valores no relatório |
| `docs/analises/catalogo-nova-real/impacto-parametro-global-alf.md` | 127 | `88b1ab3244e3f38c` | Inventário; revisão semântica integral pendente |
| `docs/analises/catalogo-nova-real/impacto-visibilidade-cenario-live.md` | 13 | `78b3123c24af5926` | Inventário; revisão semântica integral pendente |
| `docs/analises/catalogo-nova-real/importar-respostas-html.ps1` | 2 | `bc4bf2e11d96e885` | Parser PowerShell; não executado |
| `docs/analises/catalogo-nova-real/ingredientes-producao.csv` | 414 | `bddd6ff8dfc37766` | Dados tabulares; inventário, sem valores no relatório |
| `docs/analises/catalogo-nova-real/interesse-app-produtos.csv` | 65 | `4c64ec38b5f1557c` | Dados tabulares; inventário, sem valores no relatório |
| `docs/analises/catalogo-nova-real/investigacao-venda-sem-nfe-live.csv` | 834 | `8614196f2d218fe3` | Dados tabulares; inventário, sem valores no relatório |
| `docs/analises/catalogo-nova-real/investigacao-venda-sem-nfe-live.md` | 17 | `19f53afda031eaf8` | Inventário; revisão semântica integral pendente |
| `docs/analises/catalogo-nova-real/lote-alta-confianca-atual-estoque.csv` | 2167 | `13a2027c22c11c18` | Dados tabulares; inventário, sem valores no relatório |
| `docs/analises/catalogo-nova-real/lote-alta-confianca-atual-nunca.csv` | 110 | `1a4f8a8d86b0fef1` | Dados tabulares; inventário, sem valores no relatório |
| `docs/analises/catalogo-nova-real/lote-alta-confianca-giro-nfe.csv` | 2276 | `33c68460b65af845` | Dados tabulares; inventário, sem valores no relatório |
| `docs/analises/catalogo-nova-real/lote-alta-confianca-giro-nfe.md` | 15 | `348599ff355e7acc` | Inventário; revisão semântica integral pendente |
| `docs/analises/catalogo-nova-real/lote-alta-confianca-sql.md` | 11 | `b5a08d0250934ae8` | Inventário; revisão semântica integral pendente |
| `docs/analises/catalogo-nova-real/lote-alta-confianca.sql` | 4579 | `dbf367dcb34fbe65` | Inventário; revisão semântica integral pendente |
| `docs/analises/catalogo-nova-real/lote-execucao-aprovado.csv` | 2247 | `10e2bb8980e6b1e3` | Dados tabulares; inventário, sem valores no relatório |
| `docs/analises/catalogo-nova-real/lote-nunca-giro-sql.md` | 9 | `341da80325e3960d` | Inventário; revisão semântica integral pendente |
| `docs/analises/catalogo-nova-real/lote-nunca-giro.sql` | 118 | `8745aa7a2545fc19` | Inventário; revisão semântica integral pendente |
| `docs/analises/catalogo-nova-real/lotes-por-parametro-atual.md` | 13 | `461d40ec7953f4d9` | Inventário; revisão semântica integral pendente |
| `docs/analises/catalogo-nova-real/matriz-decisao-live.csv` | 15876 | `6bb16665ad818194` | Dados tabulares; inventário, sem valores no relatório |
| `docs/analises/catalogo-nova-real/matriz-decisao-live.md` | 21 | `8c5c962f539ac4fa` | Inventário; revisão semântica integral pendente |
| `docs/analises/catalogo-nova-real/nfe-snapshot-live.csv` | 15876 | `7f569db8234cc35e` | Dados tabulares; inventário, sem valores no relatório |
| `docs/analises/catalogo-nova-real/parametros-alta-confianca-cenario-alf-nova-real.csv` | 7252 | `e8aea79acdd144af` | Dados tabulares; inventário, sem valores no relatório |
| `docs/analises/catalogo-nova-real/parametros-alta-confianca.csv` | 5929 | `301b8464788e5086` | Dados tabulares; inventário, sem valores no relatório |
| `docs/analises/catalogo-nova-real/parametros-embalagem-solidcon.csv` | 15876 | `f1fcf0dce97c05e1` | Dados tabulares; inventário, sem valores no relatório |
| `docs/analises/catalogo-nova-real/parametros-media-confianca.csv` | 62 | `336cb832bd79a70d` | Dados tabulares; inventário, sem valores no relatório |
| `docs/analises/catalogo-nova-real/parametros-media-prioridade.csv` | 34 | `bd145e842d69bde2` | Dados tabulares; inventário, sem valores no relatório |
| `docs/analises/catalogo-nova-real/plano-gravacao-segura.md` | 96 | `b18c38a5d006e389` | Inventário; revisão semântica integral pendente |
| `docs/analises/catalogo-nova-real/prioridade-65-embalagem.csv` | 66 | `5612af1569384710` | Dados tabulares; inventário, sem valores no relatório |
| `docs/analises/catalogo-nova-real/quadro-executivo-acoes-live.md` | 14 | `d04deb3760379202` | Inventário; revisão semântica integral pendente |
| `docs/analises/catalogo-nova-real/qualidade-descricao-lote-alta-confianca.md` | 9 | `bee163cdb38e1dee` | Inventário; revisão semântica integral pendente |
| `docs/analises/catalogo-nova-real/recalcular-campanhas-nfe.ps1` | 447 | `7ef2d03e78082d27` | Parser PowerShell; não executado |
| `docs/analises/catalogo-nova-real/registrar-eans-fisicos-pizza.ps1` | 2 | `d21dd3053745868e` | Parser PowerShell; não executado |
| `docs/analises/catalogo-nova-real/registrar-validacao-operacional-informada.ps1` | 2 | `7537f4f07d5f8675` | Parser PowerShell; não executado |
| `docs/analises/catalogo-nova-real/relatorio-consolidado.md` | 398 | `00350c5291a47093` | Inventário; revisão semântica integral pendente |
| `docs/analises/catalogo-nova-real/relatorio-tecnico-decisao-e-execucao-2026-09-01.md` | 115 | `08ff89da62e1be00` | Inventário; revisão semântica integral pendente |
| `docs/analises/catalogo-nova-real/resultado-amostra-validacao.csv` | 2 | `3fb81e544ca35dc6` | Dados tabulares; inventário, sem valores no relatório |
| `docs/analises/catalogo-nova-real/resultado-amostra-validacao.md` | 7 | `3fe90bdeb2ed0f55` | Inventário; revisão semântica integral pendente |
| `docs/analises/catalogo-nova-real/resultado-execucao-lote-2026-09-01.md` | 36 | `6bfbfdefc0e5b868` | Inventário; revisão semântica integral pendente |
| `docs/analises/catalogo-nova-real/resultado-validacao-checklist.csv` | 0 | `e3b0c44298fc1c14` | Dados tabulares; inventário, sem valores no relatório |
| `docs/analises/catalogo-nova-real/resumo-campanhas-giro.csv` | 1498 | `433c04a8e371b648` | Dados tabulares; inventário, sem valores no relatório |
| `docs/analises/catalogo-nova-real/resumo-campanhas-giro.md` | 15 | `4ac10e7d8f2164bb` | Inventário; revisão semântica integral pendente |
| `docs/analises/catalogo-nova-real/resumo-departamentos.csv` | 37 | `182455c874d27a5e` | Dados tabulares; inventário, sem valores no relatório |
| `docs/analises/catalogo-nova-real/resumo-executivo-live.md` | 41 | `1e626f0e04308e13` | Inventário; revisão semântica integral pendente |
| `docs/analises/catalogo-nova-real/resumo-transicoes.csv` | 6 | `1b50cbea750aaba9` | Dados tabulares; inventário, sem valores no relatório |
| `docs/analises/catalogo-nova-real/revisao-manual-sem-mudanca.csv` | 74 | `1d7f125922de32b9` | Dados tabulares; inventário, sem valores no relatório |
| `docs/analises/catalogo-nova-real/revisao-nunca-com-giro-live.csv` | 279 | `c064310d93b51bed` | Dados tabulares; inventário, sem valores no relatório |
| `docs/analises/catalogo-nova-real/revisao-nunca-com-giro-live.md` | 15 | `040327634f932da0` | Inventário; revisão semântica integral pendente |
| `docs/analises/catalogo-nova-real/revisao-parametros.csv` | 7439 | `3a63dc1a53c0b2a3` | Dados tabulares; inventário, sem valores no relatório |
| `docs/analises/catalogo-nova-real/runbook-piloto-109.md` | 21 | `501d3e37ed958be8` | Inventário; revisão semântica integral pendente |
| `docs/analises/catalogo-nova-real/sem-erp-id-mapeamento.csv` | 30 | `ac4f0d67d2ec2e1a` | Dados tabulares; inventário, sem valores no relatório |
| `docs/analises/catalogo-nova-real/sem-erp-id.csv` | 30 | `178e79efc37a8813` | Dados tabulares; inventário, sem valores no relatório |
| `docs/analises/catalogo-nova-real/snapshot-live-solidcon.csv` | 15876 | `c834cff6a2ec6264` | Dados tabulares; inventário, sem valores no relatório |
| `docs/analises/catalogo-nova-real/suspeitas-associacao-nfe.csv` | 14 | `047517b22ce12833` | Dados tabulares; inventário, sem valores no relatório |
| `docs/analises/catalogo-nova-real/validacao-candidatos-sempre.csv` | 34 | `7bda49492089eaae` | Dados tabulares; inventário, sem valores no relatório |
| `docs/analises/catalogo-nova-real/validacao-estoque-para-nunca.csv` | 7192 | `8ae63e5bbce59f09` | Dados tabulares; inventário, sem valores no relatório |
| `docs/analises/catalogo-nova-real/validacao-lote-alta-confianca-atual.csv` | 2276 | `59add327269607d0` | Dados tabulares; inventário, sem valores no relatório |
| `docs/analises/catalogo-nova-real/validacao-lote-alta-confianca-atual.md` | 13 | `0575fcd1484956fd` | Inventário; revisão semântica integral pendente |
| `docs/analises/catalogo-nova-real/validacao-produtos-fora-base-live.csv` | 1033 | `a49a3781e289f372` | Dados tabulares; inventário, sem valores no relatório |
| `docs/analises/catalogo-nova-real/validacao-reativacao-imediata.csv` | 31 | `27f1d4f6527d9d95` | Dados tabulares; inventário, sem valores no relatório |
| `docs/analises/catalogo-nova-real/validacao-saldo-nao-positivo.csv` | 19 | `32a447ebf5dd274c` | Dados tabulares; inventário, sem valores no relatório |
| `docs/analises/catalogo-nova-real/validacao-sempre-para-nunca.csv` | 77 | `76d4f5bf9462e0cb` | Dados tabulares; inventário, sem valores no relatório |
| `docs/analises/catalogo-nova-real/validar-checklist-preenchido.ps1` | 21 | `4f12d3213116d21e` | Parser PowerShell; não executado |
| `docs/analises/catalogo-nova-real/validar-lote-alta-confianca-atual.ps1` | 11 | `e26220c6fe3db190` | Parser PowerShell; não executado |
| `docs/analises/catalogo-nova-real/vendidos-ocultos-7d.csv` | 170 | `36fbc78b53a72af7` | Dados tabulares; inventário, sem valores no relatório |
| `docs/antes-de-ligar-o-tunel.html` | 235 | `65c9a14660484fd3` | Inventário; revisão semântica integral pendente |
| `docs/antes-de-ligar-o-tunel.md` | 117 | `3093c2a3aeb8ed5c` | Inventário; revisão semântica integral pendente |
| `docs/conferencia-antenorapi-v1.5.0.html` | 364 | `81ac2b9a7371db53` | Inventário; revisão semântica integral pendente |
| `docs/conferencia-antenorapi-v1.5.0.md` | 221 | `27c2f711794d1b0b` | Inventário; revisão semântica integral pendente |
| `docs/deploy.md` | 170 | `d46e85e7caee1697` | Leitura dirigida; semântica integral não verificada |
| `docs/infraestrutura.md` | 257 | `98c0a86f2620a270` | Inventário; revisão semântica integral pendente |
| `docs/mapa-integracao-solidcom.html` | 461 | `44f723ac81aa2521` | Inventário; revisão semântica integral pendente |
| `docs/mapa-integracao-solidcom.md` | 234 | `aa8c2b60c2c424b2` | Inventário; revisão semântica integral pendente |
| `docs/nova-maquina.md` | 79 | `8708b8e17dda4238` | Inventário; revisão semântica integral pendente |
| `docs/o-que-o-checksum-revela.html` | 281 | `46aac3a9c55670d3` | Inventário; revisão semântica integral pendente |
| `docs/o-que-o-checksum-revela.md` | 161 | `4891b0ce81829496` | Inventário; revisão semântica integral pendente |
| `docs/obsidian/_CRITICO_Sincronizacao ERP Solidcom.md` | 155 | `d1f657fc130fb7d9` | Inventário; revisão semântica integral pendente |
| `docs/replica-conferencia-antenorapi.html` | 320 | `aea6ee999a1e2041` | Inventário; revisão semântica integral pendente |
| `docs/replica-conferencia-antenorapi.md` | 155 | `c291d1d2c2a8822a` | Inventário; revisão semântica integral pendente |
| `docs/resposta-ambiente-desenvolvimento.html` | 299 | `e806263efb727522` | Inventário; revisão semântica integral pendente |
| `docs/resposta-ambiente-desenvolvimento.md` | 97 | `fcd68286c83c105a` | Inventário; revisão semântica integral pendente |
| `docs/resumo-pre-tunel-aprovado.html` | 342 | `5c52331b50849b11` | Inventário; revisão semântica integral pendente |
| `docs/resumo-pre-tunel-aprovado.md` | 88 | `0bad0f2235e6e15b` | Inventário; revisão semântica integral pendente |
| `docs/retorno-integracao-antenorapi.md` | 341 | `7d650a031db0c3ab` | Inventário; revisão semântica integral pendente |
| `docs/retorno-treplica-cloudflare-tunnel.html` | 266 | `3f7ebd30099acc74` | Inventário; revisão semântica integral pendente |
| `docs/retorno-treplica-cloudflare-tunnel.md` | 104 | `0fa699cb6ffd1cb6` | Inventário; revisão semântica integral pendente |
| `docs/roadmap.md` | 385 | `89f4768cf3a1f2fc` | Inventário; revisão semântica integral pendente |
| `docs/solidcom-api.md` | 250 | `8791124ee14fbc7b` | Inventário; revisão semântica integral pendente |
| `docs/treplica-rota-antenorapi.html` | 261 | `e817bf6c83828c25` | Inventário; revisão semântica integral pendente |
| `docs/treplica-rota-antenorapi.md` | 128 | `f41ee94db801725d` | Inventário; revisão semântica integral pendente |
| `logos/LOGO-SVG.svg` | 1 | `41ffac9251fef640` | Inventário; revisão semântica integral pendente |
| `package.json` | 9 | `3d6a675e4686137e` | Parser de formato; semântica integral não verificada |
| `scripts/ai-session-watcher/build-day-zero.js` | 142 | `6bb2a15592e0daf5` | AST integral; semântica integral não verificada |
| `scripts/ai-session-watcher/index.js` | 254 | `6ed06e237dea7e73` | AST integral; semântica dirigida |
| `scripts/ai-session-watcher/iniciar-watcher-sessoes.bat` | 11 | `83112df4932db48d` | Inventário; revisão semântica integral pendente |
| `scripts/ai-session-watcher/package-lock.json` | 44 | `67a92e84079c6b59` | Parser de formato; semântica integral não verificada |
| `scripts/ai-session-watcher/package.json` | 16 | `9b25759fdd256431` | Parser de formato; semântica integral não verificada |
| `scripts/ai-session-watcher/parar-watcher-sessoes.bat` | 8 | `d6e2a96479d6e444` | Inventário; revisão semântica integral pendente |
| `scripts/continuar-worker-fotos.ps1` | 54 | `6fc5a4c9ee3b3255` | Parser PowerShell; não executado |
| `scripts/encadear-worker-fotos.ps1` | 22 | `94e60cbc6fb51a22` | Parser PowerShell; não executado |
| `scripts/processar-lote-marcas-famosas.ps1` | 45 | `2d072956baa39479` | Parser PowerShell; não executado |
| `scripts/sincronizar-fotos-publicadas-watch.ps1` | 126 | `14c907ffd902fad8` | Parser PowerShell; não executado |
| `scripts/sincronizar-fotos-vps.ps1` | 176 | `3b7ca6f98c1b0ca0` | Parser PowerShell; não executado |
| `scripts/validate-obsidian-links.js` | 214 | `433a4df41315ee92` | AST integral; semântica integral não verificada |
| `sistema/.env.example` | 151 | `2439345663953703` | Inventário; revisão semântica integral pendente |
| `sistema/.env.production.example` | 85 | `3a6f2b709f1b493a` | Inventário; revisão semântica integral pendente |
| `sistema/.env.staging.example` | 70 | `020e4770e60cdcf3` | Inventário; revisão semântica integral pendente |
| `sistema/.graphifyignore` | 15 | `36330b7cd76dc77f` | Inventário; revisão semântica integral pendente |
| `sistema/Caddyfile` | 27 | `214d62036d8678d4` | Inventário; revisão semântica integral pendente |
| `sistema/README.md` | 61 | `2d19c1eb15f5de3f` | Inventário; revisão semântica integral pendente |
| `sistema/STATUS.json` | 90 | `d68e2edd2fcec3fd` | Parser de formato; semântica integral não verificada |
| `sistema/admin/.dockerignore` | 10 | `f9b6bfa2ba7cf98b` | Inventário; revisão semântica integral pendente |
| `sistema/admin/.eslintrc.cjs` | 27 | `b68755531affc373` | AST integral; semântica integral não verificada |
| `sistema/admin/Dockerfile` | 30 | `288a6aab8353e821` | Inventário; revisão semântica integral pendente |
| `sistema/admin/README.md` | 36 | `213b1a9e968187f5` | Inventário; revisão semântica integral pendente |
| `sistema/admin/components.json` | 21 | `d2e3fe008b911e17` | Parser de formato; semântica integral não verificada |
| `sistema/admin/cypress.config.ts` | 68 | `ca5855282eae8242` | AST integral; semântica integral não verificada |
| `sistema/admin/cypress/e2e/alert-rules.cy.ts` | 182 | `bbf1760ec6e76ff9` | AST integral; semântica integral não verificada |
| `sistema/admin/cypress/e2e/auto-insights.cy.ts` | 184 | `cdd1139aea704e5e` | AST integral; semântica integral não verificada |
| `sistema/admin/cypress/e2e/brand-identity.cy.ts` | 112 | `8d0a1b8ed89465e1` | AST integral; semântica integral não verificada |
| `sistema/admin/cypress/e2e/business-accounts.cy.ts` | 220 | `09535a515b2f5e2f` | AST integral; semântica integral não verificada |
| `sistema/admin/cypress/e2e/business-hours.cy.ts` | 132 | `5ae19ad8822af0da` | AST integral; semântica integral não verificada |
| `sistema/admin/cypress/e2e/catalog.cy.ts` | 316 | `bfa84bdea62a20a1` | AST integral; semântica integral não verificada |
| `sistema/admin/cypress/e2e/categories.cy.ts` | 295 | `0380e260dd03e32c` | AST integral; semântica integral não verificada |
| `sistema/admin/cypress/e2e/critical-flows.cy.ts` | 305 | `8e2028663ba2f9a7` | AST integral; semântica integral não verificada |
| `sistema/admin/cypress/e2e/customers.cy.ts` | 173 | `5efad9e5abfd7a7c` | AST integral; semântica integral não verificada |
| `sistema/admin/cypress/e2e/dashboard.cy.ts` | 154 | `c16f153abf95c433` | AST integral; semântica integral não verificada |
| `sistema/admin/cypress/e2e/delivery-zones.cy.ts` | 250 | `f83765bd9831fd45` | AST integral; semântica integral não verificada |
| `sistema/admin/cypress/e2e/executive-report.cy.ts` | 181 | `ed953b37ac6aff0c` | AST integral; semântica integral não verificada |
| `sistema/admin/cypress/e2e/fraud-audit.cy.ts` | 129 | `5b826fa16fa39891` | AST integral; semântica integral não verificada |
| `sistema/admin/cypress/e2e/integrations.cy.ts` | 156 | `869e2bb3d2c51fa0` | AST integral; semântica integral não verificada |
| `sistema/admin/cypress/e2e/layout.cy.ts` | 282 | `5d5ed4a16f325d49` | AST integral; semântica integral não verificada |
| `sistema/admin/cypress/e2e/notifications-broadcast.cy.ts` | 135 | `25f7ce09e43ab527` | AST integral; semântica integral não verificada |
| `sistema/admin/cypress/e2e/orders.cy.ts` | 248 | `fa3a7bb4e497879d` | AST integral; semântica integral não verificada |
| `sistema/admin/cypress/e2e/payment-events.cy.ts` | 177 | `874ae661ff27c21f` | AST integral; semântica integral não verificada |
| `sistema/admin/cypress/e2e/picking.cy.ts` | 299 | `e2e622035629454b` | AST integral; semântica integral não verificada |
| `sistema/admin/cypress/e2e/recipes.cy.ts` | 181 | `2273616e4e8bbd06` | AST integral; semântica integral não verificada |
| `sistema/admin/cypress/e2e/search-insights.cy.ts` | 254 | `18c60ede9a1f2a33` | AST integral; semântica integral não verificada |
| `sistema/admin/cypress/e2e/smoke.cy.ts` | 93 | `2b1c07b5cc298805` | AST integral; semântica integral não verificada |
| `sistema/admin/cypress/e2e/store-banners.cy.ts` | 161 | `b8e5ea9852032c48` | AST integral; semântica integral não verificada |
| `sistema/admin/cypress/e2e/system-health.cy.ts` | 144 | `f8088e00bbe336da` | AST integral; semântica integral não verificada |
| `sistema/admin/cypress/e2e/ui-kit.cy.ts` | 124 | `44f7289247443be5` | AST integral; semântica integral não verificada |
| `sistema/admin/cypress/support/e2e.ts` | 86 | `c2e032378bb65258` | AST integral; semântica integral não verificada |
| `sistema/admin/cypress/tsconfig.json` | 9 | `013cf8f20389fa63` | Parser de formato; semântica integral não verificada |
| `sistema/admin/index.html` | 17 | `d70e1582b302f5d6` | Inventário; revisão semântica integral pendente |
| `sistema/admin/nginx.conf` | 119 | `d9a1d20e7f01d99c` | Leitura dirigida; semântica integral não verificada |
| `sistema/admin/nginx.staging.conf` | 52 | `c0468b4a64a02550` | Inventário; revisão semântica integral pendente |
| `sistema/admin/package-lock.json` | 7187 | `26f88856d863fb57` | Leitura dirigida; semântica integral não verificada |
| `sistema/admin/package.json` | 55 | `39da25d64c311a4a` | Parser de formato; semântica integral não verificada |
| `sistema/admin/postcss.config.js` | 6 | `b554e0e63770163e` | AST integral; semântica integral não verificada |
| `sistema/admin/public/manifest.json` | 14 | `59625f48158a1893` | Parser de formato; semântica integral não verificada |
| `sistema/admin/src/App.css` | 1 | `4e95486ab5b97b29` | Parser de formato; semântica integral não verificada |
| `sistema/admin/src/App.tsx` | 45 | `ff3217f5807bb0ac` | AST integral; semântica integral não verificada |
| `sistema/admin/src/components/AlertRulesManager.tsx` | 365 | `b0aae6ec1ee8a5e7` | AST integral; semântica integral não verificada |
| `sistema/admin/src/components/BICharts.tsx` | 379 | `b42b107cd9cf0679` | AST integral; semântica integral não verificada |
| `sistema/admin/src/components/ChangelogModal.tsx` | 269 | `80dd0f6d9b2c6c6e` | AST integral; semântica integral não verificada |
| `sistema/admin/src/components/ErrorBoundary.tsx` | 50 | `cb0280d8ba2c972e` | AST integral; semântica integral não verificada |
| `sistema/admin/src/components/ExecutiveReport.tsx` | 254 | `69c93242de847226` | AST integral; semântica integral não verificada |
| `sistema/admin/src/components/FormElements.tsx` | 199 | `a05d2a0cdb413eeb` | AST integral; semântica integral não verificada |
| `sistema/admin/src/components/LayoutManager.tsx` | 415 | `d84520e3d0cc3a94` | AST integral; semântica integral não verificada |
| `sistema/admin/src/components/NetworkToast.tsx` | 56 | `1fb54b208042770f` | AST integral; semântica integral não verificada |
| `sistema/admin/src/components/PeriodComparison.tsx` | 70 | `b58f05114ed48167` | AST integral; semântica integral não verificada |
| `sistema/admin/src/components/ProtectedRoute.tsx` | 25 | `d4726c91d8a5cf23` | AST integral; semântica integral não verificada |
| `sistema/admin/src/components/TopMenuBar.tsx` | 363 | `08428f071a7c7132` | AST integral; semântica integral não verificada |
| `sistema/admin/src/components/ui/badge.tsx` | 30 | `4a00889f2608ff69` | AST integral; semântica integral não verificada |
| `sistema/admin/src/components/ui/button.tsx` | 47 | `2bed14c0fe22ccde` | AST integral; semântica integral não verificada |
| `sistema/admin/src/components/ui/card.tsx` | 30 | `34793cc6c5969d5f` | AST integral; semântica integral não verificada |
| `sistema/admin/src/components/ui/checkbox.tsx` | 20 | `a45c0f9c7818a395` | AST integral; semântica integral não verificada |
| `sistema/admin/src/components/ui/field-hint.tsx` | 54 | `aef59398b16ac6d3` | AST integral; semântica integral não verificada |
| `sistema/admin/src/components/ui/input.tsx` | 20 | `9ae60081d096007c` | AST integral; semântica integral não verificada |
| `sistema/admin/src/components/ui/label.tsx` | 16 | `4d72e74af1de9cff` | AST integral; semântica integral não verificada |
| `sistema/admin/src/components/ui/select.tsx` | 21 | `90e7365ab6942115` | AST integral; semântica integral não verificada |
| `sistema/admin/src/components/ui/switch.tsx` | 33 | `0b01345bf1439c13` | AST integral; semântica integral não verificada |
| `sistema/admin/src/components/ui/table.tsx` | 37 | `af6ea79f1b9db0bc` | AST integral; semântica integral não verificada |
| `sistema/admin/src/components/ui/textarea.tsx` | 19 | `6de8788fc199f548` | AST integral; semântica integral não verificada |
| `sistema/admin/src/hooks/useAuth.ts` | 46 | `c4a0fa3f05465be0` | AST integral; semântica dirigida |
| `sistema/admin/src/index.css` | 127 | `7faaaebc2e447b1e` | Parser de formato; semântica integral não verificada |
| `sistema/admin/src/lib/utils.ts` | 6 | `746e4d9beb1a5b6f` | AST integral; semântica integral não verificada |
| `sistema/admin/src/main.tsx` | 10 | `d9602068df27ce74` | AST integral; semântica integral não verificada |
| `sistema/admin/src/pages/BrandIdentity.tsx` | 279 | `7badf6374366b62e` | AST integral; semântica integral não verificada |
| `sistema/admin/src/pages/BusinessHours.tsx` | 232 | `5c7ef22f10b7725e` | AST integral; semântica integral não verificada |
| `sistema/admin/src/pages/CategoriesManager.tsx` | 1131 | `bef2464d251cfa62` | AST integral; semântica integral não verificada |
| `sistema/admin/src/pages/Dashboard.tsx` | 1420 | `120bac5d59a2559e` | AST integral; semântica dirigida |
| `sistema/admin/src/pages/DeliveryZones.tsx` | 1597 | `181dbfbc22940cf1` | AST integral; semântica dirigida |
| `sistema/admin/src/pages/Forbidden.tsx` | 15 | `d3efe1a57236882a` | AST integral; semântica integral não verificada |
| `sistema/admin/src/pages/FraudAudit.tsx` | 152 | `77abef01e41b059e` | AST integral; semântica integral não verificada |
| `sistema/admin/src/pages/Integrations.tsx` | 390 | `0249f10cb888a304` | AST integral; semântica integral não verificada |
| `sistema/admin/src/pages/Intelligence.tsx` | 678 | `4389834a7f2dc879` | AST integral; semântica integral não verificada |
| `sistema/admin/src/pages/Login.tsx` | 97 | `b808ad24c31eba6e` | AST integral; semântica integral não verificada |
| `sistema/admin/src/pages/NotFound.tsx` | 15 | `97155e868fcae328` | AST integral; semântica integral não verificada |
| `sistema/admin/src/pages/NotificationsBroadcast.tsx` | 365 | `c803140418e41440` | AST integral; semântica integral não verificada |
| `sistema/admin/src/pages/Recipes.tsx` | 482 | `b80de8ed0af1d942` | AST integral; semântica integral não verificada |
| `sistema/admin/src/pages/RedefinirSenha.tsx` | 162 | `b970d7014bcb9d52` | AST integral; semântica integral não verificada |
| `sistema/admin/src/pages/StoreBannersManager.tsx` | 2247 | `47cb8c8ddfd1dae4` | AST integral; semântica dirigida |
| `sistema/admin/src/pages/SystemHealthWidget.tsx` | 132 | `bd776ba53e032ddf` | AST integral; semântica integral não verificada |
| `sistema/admin/src/pages/delivery-zones-map.css` | 43 | `d298fc616f24047b` | Parser de formato; semântica integral não verificada |
| `sistema/admin/src/pages/sections/BusinessAccountsSection.tsx` | 720 | `53a9acd0df7587ca` | AST integral; semântica integral não verificada |
| `sistema/admin/src/pages/sections/CustomersSection.tsx` | 752 | `b93a55f7420ab64f` | AST integral; semântica integral não verificada |
| `sistema/admin/src/pages/sections/DashboardSection.tsx` | 478 | `f9102c7a36a68261` | AST integral; semântica integral não verificada |
| `sistema/admin/src/pages/sections/DeliveryRoutesSection.tsx` | 266 | `b5e76b1803540bb4` | AST integral; semântica integral não verificada |
| `sistema/admin/src/pages/sections/IntelligenceAutoInsightsPanel.tsx` | 155 | `95b23180e2dd6ff5` | AST integral; semântica integral não verificada |
| `sistema/admin/src/pages/sections/IntelligenceSearchInsightsPanel.tsx` | 451 | `5cb529f290686a26` | AST integral; semântica integral não verificada |
| `sistema/admin/src/pages/sections/OrdersSection.tsx` | 1269 | `f1b4514130918ef4` | AST integral; semântica integral não verificada |
| `sistema/admin/src/pages/sections/PaymentEventsSection.tsx` | 555 | `fc4ea2ee099a6742` | AST integral; semântica integral não verificada |
| `sistema/admin/src/pages/sections/PickingSection.tsx` | 817 | `67ae61278baaf24f` | AST integral; semântica integral não verificada |
| `sistema/admin/src/pages/sections/ProductSlideOver.tsx` | 761 | `b87e37a2a9eae121` | AST integral; semântica integral não verificada |
| `sistema/admin/src/pages/sections/ProductsSection.tsx` | 1206 | `187cb0819a4d096c` | AST integral; semântica integral não verificada |
| `sistema/admin/src/pages/sections/SectionChrome.tsx` | 64 | `3f7d63adce16740e` | AST integral; semântica integral não verificada |
| `sistema/admin/src/pages/sections/StaffSection.tsx` | 470 | `20a7dc4ed68dd547` | AST integral; semântica dirigida |
| `sistema/admin/src/pages/sections/TeamPerformanceSection.tsx` | 210 | `1012ef9dfaa318e3` | AST integral; semântica integral não verificada |
| `sistema/admin/src/pages/types.ts` | 112 | `24bffe0435ef4207` | AST integral; semântica integral não verificada |
| `sistema/admin/src/services/api.ts` | 1710 | `e8dae91db864e449` | AST integral; semântica integral não verificada |
| `sistema/admin/src/types/analytics.ts` | 32 | `11916e0ae7d2333c` | AST integral; semântica integral não verificada |
| `sistema/admin/src/utils/bannerOverlay.ts` | 58 | `cbf4fe07036f932f` | AST integral; semântica integral não verificada |
| `sistema/admin/src/utils/bannerRules.test.ts` | 47 | `d45ec9ef04aff1dc` | AST integral; semântica integral não verificada |
| `sistema/admin/src/utils/bannerRules.ts` | 41 | `6a179926aa29ba39` | AST integral; semântica integral não verificada |
| `sistema/admin/src/vite-env.d.ts` | 4 | `038e6985b64032fd` | AST integral; semântica integral não verificada |
| `sistema/admin/tailwind.config.js` | 93 | `04a8ef9904fbe991` | AST integral; semântica integral não verificada |
| `sistema/admin/tsconfig.json` | 41 | `a48e5abd3f0be148` | Parser de formato; semântica integral não verificada |
| `sistema/admin/tsconfig.node.json` | 10 | `78e7396f84d5591e` | Parser de formato; semântica integral não verificada |
| `sistema/admin/vite.config.ts` | 40 | `e0186981976138fb` | AST integral; semântica integral não verificada |
| `sistema/api/ConexaoDorsal.json` | 1916 | `e1a6847659ee6bf3` | Parser de formato; semântica integral não verificada |
| `sistema/backend/.dockerignore` | 12 | `79dc1231b2eba7ed` | Inventário; revisão semântica integral pendente |
| `sistema/backend/.env.example` | 64 | `2965b09e0ea4c059` | Inventário; revisão semântica integral pendente |
| `sistema/backend/.eslintignore` | 3 | `03e47a36dfdc427c` | Inventário; revisão semântica integral pendente |
| `sistema/backend/.eslintrc.cjs` | 21 | `569c59b810aae950` | AST integral; semântica dirigida |
| `sistema/backend/.gitignore` | 5 | `37a74166bcb3a837` | Inventário; revisão semântica integral pendente |
| `sistema/backend/Dockerfile` | 64 | `ee14f7315e184c1a` | Inventário; revisão semântica integral pendente |
| `sistema/backend/README.md` | 42 | `89765d73f426d9c6` | Inventário; revisão semântica integral pendente |
| `sistema/backend/TASK_DEV_FIX_WINE_CARDS_VISUAL.md` | 25 | `8ab26134277885c5` | Inventário; revisão semântica integral pendente |
| `sistema/backend/TASK_DEV_SPRINT_ADMIN_CHANGELOG_ADEGA_CATS_FOOTER_FIX.md` | 171 | `b12d07bf7837d27f` | Inventário; revisão semântica integral pendente |
| `sistema/backend/TASK_DEV_SPRINT_ADMIN_SEARCH_BANNERS_SOLIDCOM_ENCARTES.md` | 180 | `c281ca9164456741` | Inventário; revisão semântica integral pendente |
| `sistema/backend/TASK_DEV_SPRINT_FIX_VACUO_SYNC_BANNERS_INACTIVE_PRODUCTS.md` | 66 | `9606eebea8c6042f` | Inventário; revisão semântica integral pendente |
| `sistema/backend/build_err.txt` | 0 | `e3b0c44298fc1c14` | Inventário; revisão semântica integral pendente |
| `sistema/backend/build_out.txt` | 0 | `e3b0c44298fc1c14` | Inventário; revisão semântica integral pendente |
| `sistema/backend/build_output.txt` | 9 | `0a4c31557d1444e6` | Inventário; revisão semântica integral pendente |
| `sistema/backend/count_categories.js` | 12 | `2afc2d9e918ecd68` | AST integral; semântica integral não verificada |
| `sistema/backend/docs/contas-b2b.md` | 49 | `587fef793006d757` | Inventário; revisão semântica integral pendente |
| `sistema/backend/docs/pagamentos-gateway.md` | 43 | `72f22ae1da793bf5` | Inventário; revisão semântica integral pendente |
| `sistema/backend/nest-cli.json` | 8 | `073fd78761b1a63e` | Parser de formato; semântica integral não verificada |
| `sistema/backend/package-lock.json` | 11911 | `879ae73f2c01330e` | Leitura dirigida; semântica integral não verificada |
| `sistema/backend/package.json` | 157 | `323de18e342aa402` | Parser de formato; semântica integral não verificada |
| `sistema/backend/prisma/migrations/20260418180000_init_postgresql/migration.sql` | 199 | `65499ceb986b43f0` | Varredura SQL estrutural; não aplicada |
| `sistema/backend/prisma/migrations/20260419120000_add_payment_status/migration.sql` | 2 | `c5afd2bdf221b984` | Varredura SQL estrutural; não aplicada |
| `sistema/backend/prisma/migrations/20260420113000_add_solidcom_classifications/migration.sql` | 6 | `2ef78e0ac4c75bde` | Varredura SQL estrutural; não aplicada |
| `sistema/backend/prisma/migrations/20260420153000_add_promo_banners_cms/migration.sql` | 16 | `208c30474e2367c8` | Varredura SQL estrutural; não aplicada |
| `sistema/backend/prisma/migrations/20260420200000_add_hero_slide_content_fields/migration.sql` | 3 | `7b110a11d77e9001` | Varredura SQL estrutural; não aplicada |
| `sistema/backend/prisma/migrations/20260421132853_add_priority_limit_to_categories/migration.sql` | 6 | `49b1a3dac0973fd5` | Varredura SQL estrutural; não aplicada |
| `sistema/backend/prisma/migrations/20260421164000_add_product_title_masks/migration.sql` | 4 | `d00c0432489ac142` | Varredura SQL estrutural; não aplicada |
| `sistema/backend/prisma/migrations/20260425065729_add_category_product_curations_cms/migration.sql` | 23 | `689fefb26f6f5d5a` | Varredura SQL estrutural; não aplicada |
| `sistema/backend/prisma/migrations/20260425071305_add_promo_banner_highlighted_product/migration.sql` | 6 | `d676ba5c6c886074` | Varredura SQL estrutural; não aplicada |
| `sistema/backend/prisma/migrations/20260430234456_add_recipes_domain/migration.sql` | 103 | `c7f3f4da7df40686` | Varredura SQL estrutural; não aplicada |
| `sistema/backend/prisma/migrations/20260501000000_add_brand_config/migration.sql` | 13 | `47c561df1b9badea` | Varredura SQL estrutural; não aplicada |
| `sistema/backend/prisma/migrations/20260502000000_add_brand_contact_whatsapp/migration.sql` | 2 | `6c7d47ed2bd345f7` | Varredura SQL estrutural; não aplicada |
| `sistema/backend/prisma/migrations/20260503000000_add_free_shipping_threshold/migration.sql` | 2 | `1cecc0d415168c11` | Varredura SQL estrutural; não aplicada |
| `sistema/backend/prisma/migrations/20260504000000_add_delivery_zones/migration.sql` | 16 | `2e2e9987451b8b9f` | Varredura SQL estrutural; não aplicada |
| `sistema/backend/prisma/migrations/20260505000000_add_clientip_fraud_log/migration.sql` | 18 | `25d7443810c594ac` | Varredura SQL estrutural; não aplicada |
| `sistema/backend/prisma/migrations/20260505100000_add_business_hours/migration.sql` | 6 | `5bfa667edfdfdbe3` | Varredura SQL estrutural; não aplicada |
| `sistema/backend/prisma/migrations/20260506000000_add_notifications_push/migration.sql` | 32 | `5a649c348e13af79` | Varredura SQL estrutural; não aplicada |
| `sistema/backend/prisma/migrations/20260506120000_add_delivery_polygon_geojson/migration.sql` | 2 | `96fe873f2eda8251` | Varredura SQL estrutural; não aplicada |
| `sistema/backend/prisma/migrations/20260508000000_add_category_classification_mappings/migration.sql` | 19 | `3d837de0ae88fed1` | Varredura SQL estrutural; não aplicada |
| `sistema/backend/prisma/migrations/20260510000000_add_store_banners_cms/migration.sql` | 20 | `2d3ca82abd7abb56` | Varredura SQL estrutural; não aplicada |
| `sistema/backend/prisma/migrations/20260510003000_add_integration_module_configs/migration.sql` | 13 | `c20ce9eebec679e5` | Varredura SQL estrutural; não aplicada |
| `sistema/backend/prisma/migrations/20260513081322_add_category_hierarchy_and_product_category_mapping/migration.sql` | 52 | `eee67d379f0cd97d` | Varredura SQL estrutural; não aplicada |
| `sistema/backend/prisma/migrations/20260513084324_add_classification_rules_and_category_mapping_pending/migration.sql` | 57 | `1345d77b4be8c3ea` | Varredura SQL estrutural; não aplicada |
| `sistema/backend/prisma/migrations/20260518182028_add_alert_rules_m33_2/migration.sql` | 41 | `96a18bcb53b20d91` | Varredura SQL estrutural; não aplicada |
| `sistema/backend/prisma/migrations/20260526090000_add_order_idempotency/migration.sql` | 15 | `c8e17023f8e3286b` | Varredura SQL estrutural; não aplicada |
| `sistema/backend/prisma/migrations/20260526093000_add_order_snapshots/migration.sql` | 4 | `e188bc93c7967195` | Varredura SQL estrutural; não aplicada |
| `sistema/backend/prisma/migrations/20260526100000_add_tenant_store_rbac_foundation/migration.sql` | 210 | `e7cd313bcea51d6d` | Varredura SQL estrutural; não aplicada |
| `sistema/backend/prisma/migrations/20260526113000_add_catalog_top_tier_foundation/migration.sql` | 236 | `eba8438b4e832c38` | Varredura SQL estrutural; não aplicada |
| `sistema/backend/prisma/migrations/20260526123000_add_inventory_reservations_foundation/migration.sql` | 193 | `153b5dab31e73ec8` | Varredura SQL estrutural; não aplicada |
| `sistema/backend/prisma/migrations/20260526124500_fix_stock_available_formula/migration.sql` | 6 | `c9789c46505d79b8` | Varredura SQL estrutural; não aplicada |
| `sistema/backend/prisma/migrations/20260526133000_add_pricing_promotions_foundation/migration.sql` | 214 | `86f8bf47603e6826` | Varredura SQL estrutural; não aplicada |
| `sistema/backend/prisma/migrations/20260526143000_add_checkout_cart_contract/migration.sql` | 92 | `e4390c617d992131` | Varredura SQL estrutural; não aplicada |
| `sistema/backend/prisma/migrations/20260526153000_add_order_oms_events_foundation/migration.sql` | 74 | `a45df1eaca439938` | Varredura SQL estrutural; não aplicada |
| `sistema/backend/prisma/migrations/20260526163000_add_picking_foundation/migration.sql` | 104 | `f3c4101a7708eaf7` | Varredura SQL estrutural; não aplicada |
| `sistema/backend/prisma/migrations/20260526173000_add_fulfillment_delivery_foundation/migration.sql` | 131 | `e5c1b939ceaec185` | Varredura SQL estrutural; não aplicada |
| `sistema/backend/prisma/migrations/20260526183000_add_payment_ledger_foundation/migration.sql` | 90 | `2456c49a3d3a41c3` | Varredura SQL estrutural; não aplicada |
| `sistema/backend/prisma/migrations/20260526193000_add_integration_outbox_foundation/migration.sql` | 125 | `15157fadbbe96239` | Varredura SQL estrutural; não aplicada |
| `sistema/backend/prisma/migrations/20260526203000_add_public_api_webhooks_foundation/migration.sql` | 87 | `3a6c3146443a0142` | Varredura SQL estrutural; não aplicada |
| `sistema/backend/prisma/migrations/20260526213000_add_crm_loyalty_foundation/migration.sql` | 193 | `e1a5053613c8ec7a` | Varredura SQL estrutural; não aplicada |
| `sistema/backend/prisma/migrations/20260526223000_add_bi_operational_analytics_foundation/migration.sql` | 52 | `da78a3d2ff741d2f` | Varredura SQL estrutural; não aplicada |
| `sistema/backend/prisma/migrations/20260526233000_add_marketplace_multichannel_foundation/migration.sql` | 135 | `247422b6cc5ebf85` | Varredura SQL estrutural; não aplicada |
| `sistema/backend/prisma/migrations/20260527003000_add_recommendation_intelligence_foundation/migration.sql` | 28 | `052ca35c228da3fc` | Varredura SQL estrutural; não aplicada |
| `sistema/backend/prisma/migrations/20260530010000_add_lgpd_governance_foundation/migration.sql` | 20 | `69730b62bcca97ab` | Varredura SQL estrutural; não aplicada |
| `sistema/backend/prisma/migrations/20260531033000_add_b2b_business_accounts_foundation/migration.sql` | 57 | `3d91c6071a31e4de` | Varredura SQL estrutural; não aplicada |
| `sistema/backend/prisma/migrations/20260531043000_add_b2b_minimum_order_and_corporate_lists/migration.sql` | 16 | `96c2aa8abf01f228` | Varredura SQL estrutural; não aplicada |
| `sistema/backend/prisma/migrations/20260606003000_require_fraction_step_for_fractional_products/migration.sql` | 9 | `2c5ae96436f930ff` | Varredura SQL estrutural; não aplicada |
| `sistema/backend/prisma/migrations/20260731190000_add_manual_fractional_override/migration.sql` | 17 | `30d361f96030315c` | Varredura SQL estrutural; não aplicada |
| `sistema/backend/prisma/migrations/20260807000000_add_admin_module_access/migration.sql` | 14 | `d8d10564c097985a` | Varredura SQL estrutural; não aplicada |
| `sistema/backend/prisma/migrations/20260812070000_add_admin_reset_token/migration.sql` | 4 | `3458d443cf349087` | Varredura SQL estrutural; não aplicada |
| `sistema/backend/prisma/migrations/20260812150000_add_ai_notifications/migration.sql` | 3 | `836c64adddcf5d8b` | Varredura SQL estrutural; não aplicada |
| `sistema/backend/prisma/migrations/20260817100000_add_customer_reset_token/migration.sql` | 4 | `0f61fc654a6f7cbc` | Varredura SQL estrutural; não aplicada |
| `sistema/backend/prisma/migrations/20260817190000_add_order_delivery_instructions/migration.sql` | 6 | `156a383c79896dbd` | Varredura SQL estrutural; não aplicada |
| `sistema/backend/prisma/migrations/20260818130000_add_order_scheduled_for/migration.sql` | 3 | `e7453dfbb4713002` | Varredura SQL estrutural; não aplicada |
| `sistema/backend/prisma/migrations/20260818160000_add_order_erp_dav/migration.sql` | 3 | `6ef9ebdb0d48d052` | Varredura SQL estrutural; não aplicada |
| `sistema/backend/prisma/migrations/20260820160000_add_address_locality/migration.sql` | 6 | `c16e2b7d7479fb50` | Varredura SQL estrutural; não aplicada |
| `sistema/backend/prisma/migrations/20260821000000_add_ibge_addresses/migration.sql` | 27 | `e882fd662b67f14c` | Varredura SQL estrutural; não aplicada |
| `sistema/backend/prisma/migrations/20260821010000_add_category_short_name/migration.sql` | 3 | `0469ef16d63241d5` | Varredura SQL estrutural; não aplicada |
| `sistema/backend/prisma/migrations/20260821020000_add_customer_blocked/migration.sql` | 3 | `572b69d9996d7fcd` | Varredura SQL estrutural; não aplicada |
| `sistema/backend/prisma/migrations/20260821200000_add_promo_banner_overlay_color/migration.sql` | 2 | `ca9a5fff8a5f4dba` | Varredura SQL estrutural; não aplicada |
| `sistema/backend/prisma/migrations/20260822000000_add_product_erp_id_secondary_eans/migration.sql` | 8 | `83747acacfa7ecdf` | Varredura SQL estrutural; não aplicada |
| `sistema/backend/prisma/migrations/20260824000000_unify_store_banners/migration.sql` | 29 | `70114452071d5b73` | Varredura SQL estrutural; não aplicada |
| `sistema/backend/prisma/migrations/20260824000100_add_promotion_campaigns/migration.sql` | 41 | `62477bad62f5c547` | Varredura SQL estrutural; não aplicada |
| `sistema/backend/prisma/migrations/20260824010000_store_banner_highlight_align/migration.sql` | 3 | `8cc1922be58b3111` | Varredura SQL estrutural; não aplicada |
| `sistema/backend/prisma/migrations/20260824020000_store_banner_campaign_link/migration.sql` | 3 | `2fc9e6c2ae30cffd` | Varredura SQL estrutural; não aplicada |
| `sistema/backend/prisma/migrations/20260827000000_store_banner_display_duration/migration.sql` | 5 | `a78f88dafb8f2a49` | Varredura SQL estrutural; não aplicada |
| `sistema/backend/prisma/migrations/20260828000000_drop_delivery_areas/migration.sql` | 17 | `beb2f932b21290a5` | Varredura SQL estrutural; não aplicada |
| `sistema/backend/prisma/migrations/20260828230000_add_driver_admin_id/migration.sql` | 24 | `99fe737c7f0e86b4` | Varredura SQL estrutural; não aplicada |
| `sistema/backend/prisma/migrations/20260828234500_fix_schema_drift/migration.sql` | 55 | `4ecf3bdffd8bfff8` | Varredura SQL estrutural; não aplicada |
| `sistema/backend/prisma/migrations/20260903000000_push_subscription_staff/migration.sql` | 16 | `c6b48a318c8994ef` | Varredura SQL estrutural; não aplicada |
| `sistema/backend/prisma/migrations/20260909040000_fix_segment_member_unique/migration.sql` | 6 | `abbca5d66e5ed792` | Varredura SQL estrutural; não aplicada |
| `sistema/backend/prisma/migrations/20260910120000_fix_permission_descriptions_accents/migration.sql` | 18 | `202a15b0cd930d13` | Varredura SQL estrutural; não aplicada |
| `sistema/backend/prisma/migrations/migration_lock.toml` | 3 | `693566b52c49db47` | Inventário; revisão semântica integral pendente |
| `sistema/backend/prisma/schema.prisma` | 2350 | `542c680a1460b581` | Leitura dirigida; semântica integral não verificada |
| `sistema/backend/prisma/seed.ts` | 197 | `b71710fd5ef95c34` | AST integral; semântica integral não verificada |
| `sistema/backend/reindex-search.js` | 63 | `fda560782aff9786` | AST integral; semântica integral não verificada |
| `sistema/backend/scripts/apply-category-mappings.ts` | 170 | `30a8cfdc0e7413bb` | AST integral; semântica integral não verificada |
| `sistema/backend/scripts/apply-reframed-preview.ts` | 77 | `e41ad8f966292194` | AST integral; semântica integral não verificada |
| `sistema/backend/scripts/audit-auto-bank-publications.ts` | 32 | `b15318bea56c4d89` | AST integral; semântica integral não verificada |
| `sistema/backend/scripts/audit-beverage-multipack-clip.py` | 92 | `9a88d3859e56b435` | Parser Python; não executado |
| `sistema/backend/scripts/audit-candidate-images-clip.py` | 85 | `2e1f16876f42e4de` | Parser Python; não executado |
| `sistema/backend/scripts/audit-catalog-clip.py` | 53 | `d885b0a9f6613533` | Parser Python; não executado |
| `sistema/backend/scripts/audit-published-framing.ts` | 129 | `3010dfbe506e91ba` | AST integral; semântica integral não verificada |
| `sistema/backend/scripts/audit-sync-option.js` | 51 | `5f97159eaf37c02f` | AST integral; semântica integral não verificada |
| `sistema/backend/scripts/auto-publish-bank-suggestions.ts` | 192 | `f9d8efb80e978863` | AST integral; semântica integral não verificada |
| `sistema/backend/scripts/build-photo-queue.ts` | 79 | `55fd1bb5a21aa97e` | AST integral; semântica integral não verificada |
| `sistema/backend/scripts/build-photo-recollect-queues.ts` | 92 | `1378da058e3d622b` | AST integral; semântica integral não verificada |
| `sistema/backend/scripts/carrefour-cdp-proof.ts` | 77 | `8d879c71a6a8d55d` | AST integral; semântica integral não verificada |
| `sistema/backend/scripts/collect-carrefour-candidates.ts` | 295 | `215059b2b6096bf8` | AST integral; semântica integral não verificada |
| `sistema/backend/scripts/collect-cosmos-candidates.ts` | 131 | `7aa3bd3e582bb61c` | AST integral; semântica integral não verificada |
| `sistema/backend/scripts/collect-google-candidates.ts` | 220 | `b6400e3a2bb9ec82` | AST integral; semântica integral não verificada |
| `sistema/backend/scripts/collect-photo-source-bank.ts` | 281 | `0fd982fd83600e7d` | AST integral; semântica integral não verificada |
| `sistema/backend/scripts/deduplicate-products.ts` | 172 | `e6b7491f8591c77e` | AST integral; semântica integral não verificada |
| `sistema/backend/scripts/do-sync.js` | 56 | `06fb9da5b9f5fba4` | AST integral; semântica integral não verificada |
| `sistema/backend/scripts/do-sync.ts` | 75 | `25a33544d0549e97` | AST integral; semântica integral não verificada |
| `sistema/backend/scripts/google-cdp-inspect.ts` | 46 | `7dd5c5ae3993a9ce` | AST integral; semântica integral não verificada |
| `sistema/backend/scripts/handoff-apply.js` | 341 | `fbcfce1d743abbc0` | AST integral; semântica integral não verificada |
| `sistema/backend/scripts/handoff-dry-run.js` | 264 | `870912a652deb55b` | AST integral; semântica integral não verificada |
| `sistema/backend/scripts/import-ibge-cnefe.ts` | 144 | `c657a01b0b4ab995` | AST integral; semântica integral não verificada |
| `sistema/backend/scripts/import-luna-local-candidates.ts` | 55 | `01811f58d21110cd` | AST integral; semântica integral não verificada |
| `sistema/backend/scripts/index-photo-source-bank.ts` | 59 | `f5522500d207af9a` | AST integral; semântica integral não verificada |
| `sistema/backend/scripts/make-audit-sheets.ts` | 44 | `0bc7455609aaa9ab` | AST integral; semântica integral não verificada |
| `sistema/backend/scripts/make-candidate-sheets.ts` | 40 | `145f5c14715748d7` | AST integral; semântica integral não verificada |
| `sistema/backend/scripts/make-folder-sheets.ts` | 38 | `847aa24011633713` | AST integral; semântica integral não verificada |
| `sistema/backend/scripts/match-photo-source-bank.ts` | 180 | `a3d2da4b23784e41` | AST integral; semântica integral não verificada |
| `sistema/backend/scripts/match-photos.ts` | 250 | `2485006fed5e97d1` | AST integral; semântica integral não verificada |
| `sistema/backend/scripts/merge-google-worker-results.ts` | 56 | `7a57d3a2054b5eb9` | AST integral; semântica integral não verificada |
| `sistema/backend/scripts/migrate-legacy-banners-to-storebanner.ts` | 84 | `bbf9f91f39b79bad` | AST integral; semântica integral não verificada |
| `sistema/backend/scripts/optimize-banner-templates.js` | 100 | `17e307864378b98d` | AST integral; semântica integral não verificada |
| `sistema/backend/scripts/photo-bank-compatibility.ts` | 120 | `ed3e68c994f08f73` | AST integral; semântica integral não verificada |
| `sistema/backend/scripts/photo-frame.ts` | 326 | `12b69e4b60fb8361` | AST integral; semântica integral não verificada |
| `sistema/backend/scripts/photo-safety.ts` | 52 | `a5252f5d2d30b916` | AST integral; semântica integral não verificada |
| `sistema/backend/scripts/photo-source-priority.ts` | 34 | `ed600a6cb4556b50` | AST integral; semântica integral não verificada |
| `sistema/backend/scripts/prepare-google-worker-queues.ts` | 37 | `a8a830e35b73f5e3` | AST integral; semântica integral não verificada |
| `sistema/backend/scripts/process-photo-queue.ts` | 67 | `5a96cedb0ded2752` | AST integral; semântica integral não verificada |
| `sistema/backend/scripts/prune-low-resolution-source-bank.ts` | 35 | `9c81ad71a6c80bda` | AST integral; semântica integral não verificada |
| `sistema/backend/scripts/publish-approved-bank-suggestions.ts` | 64 | `6f66f05b38a030af` | AST integral; semântica integral não verificada |
| `sistema/backend/scripts/publish-approved-carrefour-candidates.ts` | 142 | `2b5e6e0963698240` | AST integral; semântica integral não verificada |
| `sistema/backend/scripts/publish-external-photo-candidates.ts` | 77 | `e442008d4912182a` | AST integral; semântica integral não verificada |
| `sistema/backend/scripts/recover-missing-bank-sources.ts` | 83 | `3e396d91da5006f4` | AST integral; semântica integral não verificada |
| `sistema/backend/scripts/reframe-audit-flagged.ts` | 108 | `0ab49f0cdb23e761` | AST integral; semântica integral não verificada |
| `sistema/backend/scripts/reframe-published-photos.ts` | 55 | `8c60379c4bd20d9d` | AST integral; semântica integral não verificada |
| `sistema/backend/scripts/register-external-photo-candidate.ts` | 34 | `a5cc9422c47ab658` | AST integral; semântica integral não verificada |
| `sistema/backend/scripts/run-photo-source-bank-until-complete.ps1` | 28 | `02fa50b7bb10390e` | Parser PowerShell; não executado |
| `sistema/backend/scripts/search-browser-photo-queue.ts` | 985 | `4fd830fcd82d746c` | AST integral; semântica integral não verificada |
| `sistema/backend/scripts/search-web-photo-queue.ts` | 335 | `8380fd45377b7855` | AST integral; semântica integral não verificada |
| `sistema/backend/scripts/seed-banner-templates.js` | 291 | `f99bbe5309d5d0e7` | AST integral; semântica integral não verificada |
| `sistema/backend/scripts/seed-cms-categories.ts` | 59 | `3786cb11823d6613` | AST integral; semântica integral não verificada |
| `sistema/backend/scripts/seed-delivery-zones.ts` | 131 | `51bff501da17d960` | AST integral; semântica integral não verificada |
| `sistema/backend/scripts/seed-qa.ts` | 143 | `d3124638b20b21ae` | AST integral; semântica integral não verificada |
| `sistema/backend/scripts/seed-staging-admin.js` | 36 | `eb5515109df19071` | AST integral; semântica integral não verificada |
| `sistema/backend/scripts/seed-staging-recipes.js` | 402 | `45f36a99693822ad` | AST integral; semântica integral não verificada |
| `sistema/backend/scripts/seed-test-orders.js` | 100 | `85f4c6622a74ec07` | AST integral; semântica integral não verificada |
| `sistema/backend/scripts/validate-bi-analytics-foundation.js` | 62 | `b00386452ee814f4` | AST integral; semântica integral não verificada |
| `sistema/backend/scripts/validate-catalog-foundation.js` | 40 | `e96b4e6d36bcaf3e` | AST integral; semântica integral não verificada |
| `sistema/backend/scripts/validate-checkout-foundation.js` | 75 | `520611d57cff33e9` | AST integral; semântica integral não verificada |
| `sistema/backend/scripts/validate-crm-loyalty-foundation.js` | 75 | `a84a4b3736ec6850` | AST integral; semântica integral não verificada |
| `sistema/backend/scripts/validate-fulfillment-foundation.js` | 73 | `7c6607b44423c037` | AST integral; semântica integral não verificada |
| `sistema/backend/scripts/validate-image-clip-batch.py` | 185 | `cb68a2e3b6599116` | Parser Python; não executado |
| `sistema/backend/scripts/validate-image-clip.py` | 160 | `c7d0703cc16dc526` | Parser Python; não executado |
| `sistema/backend/scripts/validate-integration-outbox-foundation.js` | 148 | `9c7070f933ad81e0` | AST integral; semântica integral não verificada |
| `sistema/backend/scripts/validate-inventory-foundation.js` | 66 | `4755cd2bc317ad88` | AST integral; semântica integral não verificada |
| `sistema/backend/scripts/validate-lgpd-governance-foundation.js` | 72 | `051a0e76cfd31d4d` | AST integral; semântica integral não verificada |
| `sistema/backend/scripts/validate-marketplace-foundation.js` | 68 | `84d24e01925d716b` | AST integral; semântica integral não verificada |
| `sistema/backend/scripts/validate-observability-sre-foundation.js` | 39 | `917b8c5014a2c27e` | AST integral; semântica integral não verificada |
| `sistema/backend/scripts/validate-oms-foundation.js` | 73 | `08dbb9810d4f0d3a` | AST integral; semântica integral não verificada |
| `sistema/backend/scripts/validate-payments-foundation.js` | 130 | `05c3372646beb269` | AST integral; semântica integral não verificada |
| `sistema/backend/scripts/validate-pending-contract.js` | 67 | `4c2125e5f62c9587` | AST integral; semântica integral não verificada |
| `sistema/backend/scripts/validate-picking-foundation.js` | 67 | `fa16e7a24d09e1b8` | AST integral; semântica integral não verificada |
| `sistema/backend/scripts/validate-pricing-foundation.js` | 53 | `cf0b58bbe2549df6` | AST integral; semântica integral não verificada |
| `sistema/backend/scripts/validate-public-api-foundation.js` | 113 | `b631d68cd6e98631` | AST integral; semântica integral não verificada |
| `sistema/backend/scripts/validate-recommendation-foundation.js` | 76 | `a4c04b20a1475eea` | AST integral; semântica integral não verificada |
| `sistema/backend/scripts/validate-staging-recipes.js` | 176 | `ffb0aa7994297b14` | AST integral; semântica integral não verificada |
| `sistema/backend/scripts/validate-tenant-store-backfill.js` | 84 | `51d25a56fe92c457` | AST integral; semântica integral não verificada |
| `sistema/backend/src/app.module.ts` | 140 | `003152313f3be8f3` | AST integral; semântica dirigida |
| `sistema/backend/src/common/date-range.util.ts` | 11 | `984eff56f3efe362` | AST integral; semântica integral não verificada |
| `sistema/backend/src/common/decorators/current-store.decorator.ts` | 7 | `1f7c40896f41e319` | AST integral; semântica integral não verificada |
| `sistema/backend/src/common/decorators/current-tenant.decorator.ts` | 7 | `30663013f71a4c7e` | AST integral; semântica integral não verificada |
| `sistema/backend/src/common/decorators/relaxed-throttle.decorator.ts` | 19 | `8702306b4d5f2d84` | AST integral; semântica dirigida |
| `sistema/backend/src/common/decorators/require-api-scope.decorator.ts` | 4 | `e522fdefef18eb6c` | AST integral; semântica integral não verificada |
| `sistema/backend/src/common/decorators/require-module.decorator.ts` | 6 | `e70e0c3bbda35fd0` | AST integral; semântica integral não verificada |
| `sistema/backend/src/common/decorators/require-permission.decorator.ts` | 4 | `289c9fef25d30bc4` | AST integral; semântica integral não verificada |
| `sistema/backend/src/common/decorators/roles.decorator.ts` | 4 | `c864eb0f48a63d1a` | AST integral; semântica integral não verificada |
| `sistema/backend/src/common/fractional.util.ts` | 28 | `ff3f1088c0c00d90` | AST integral; semântica integral não verificada |
| `sistema/backend/src/common/guards/jwt-auth.guard.ts` | 5 | `d24534be0c12c496` | AST integral; semântica integral não verificada |
| `sistema/backend/src/common/guards/module-access.guard.ts` | 27 | `3985dfe39c24fb50` | AST integral; semântica integral não verificada |
| `sistema/backend/src/common/guards/permission.guard.spec.ts` | 55 | `7b6352d665db09ad` | AST integral; semântica integral não verificada |
| `sistema/backend/src/common/guards/permission.guard.ts` | 85 | `5e54556f2821cda9` | AST integral; semântica integral não verificada |
| `sistema/backend/src/common/guards/public-api-key.guard.ts` | 33 | `6e4f4dfbdca826ff` | AST integral; semântica integral não verificada |
| `sistema/backend/src/common/guards/roles.guard.ts` | 31 | `33fae621cf194d77` | AST integral; semântica integral não verificada |
| `sistema/backend/src/common/guards/tenant-access.guard.spec.ts` | 49 | `0195a544e19f65d9` | AST integral; semântica integral não verificada |
| `sistema/backend/src/common/guards/tenant-access.guard.ts` | 25 | `e78aeb7d3192a0be` | AST integral; semântica integral não verificada |
| `sistema/backend/src/common/interceptors/http-logging.interceptor.ts` | 63 | `6865e316d6f754d2` | AST integral; semântica integral não verificada |
| `sistema/backend/src/common/logger.ts` | 26 | `92d5323730b1ec6d` | AST integral; semântica integral não verificada |
| `sistema/backend/src/common/nest-winston-logger.spec.ts` | 53 | `d28d584d194a3932` | AST integral; semântica integral não verificada |
| `sistema/backend/src/common/nest-winston-logger.ts` | 88 | `6b9e0c1f3f0114a8` | AST integral; semântica integral não verificada |
| `sistema/backend/src/common/observability/metrics-registry.ts` | 80 | `1c787bb4615d6905` | AST integral; semântica dirigida |
| `sistema/backend/src/common/observability/request-context.middleware.ts` | 47 | `caee849b3486e41d` | AST integral; semântica integral não verificada |
| `sistema/backend/src/common/order-reconciliation.spec.ts` | 159 | `5a2b1d3f246189ee` | AST integral; semântica integral não verificada |
| `sistema/backend/src/common/order-reconciliation.ts` | 203 | `74451d4a7d23e557` | AST integral; semântica integral não verificada |
| `sistema/backend/src/common/prisma.service.ts` | 9 | `8d6a16ddd9c96a81` | AST integral; semântica dirigida |
| `sistema/backend/src/common/product-availability.spec.ts` | 42 | `7440bbe3c5b1c8d8` | AST integral; semântica integral não verificada |
| `sistema/backend/src/common/product-availability.ts` | 35 | `c3372e984566f3c5` | AST integral; semântica integral não verificada |
| `sistema/backend/src/common/require-env.spec.ts` | 43 | `9fc2c6bd371902e7` | AST integral; semântica integral não verificada |
| `sistema/backend/src/common/require-env.ts` | 26 | `729b8239fd0ddf32` | AST integral; semântica integral não verificada |
| `sistema/backend/src/common/security/customer-ownership.ts` | 19 | `49c5c066c32c9315` | AST integral; semântica integral não verificada |
| `sistema/backend/src/common/security/jwt-secret.ts` | 17 | `7ec267ca7343419c` | AST integral; semântica integral não verificada |
| `sistema/backend/src/common/services/retry.service.ts` | 56 | `d3855b93d8b8f9e2` | AST integral; semântica integral não verificada |
| `sistema/backend/src/common/services/uploads.service.ts` | 70 | `14e02f19cbc81cee` | AST integral; semântica integral não verificada |
| `sistema/backend/src/common/services/via-cep.service.ts` | 30 | `2b13cdc7f861abae` | AST integral; semântica integral não verificada |
| `sistema/backend/src/common/strategies/jwt.strategy.spec.ts` | 64 | `512b01c116c4b7d1` | AST integral; semântica integral não verificada |
| `sistema/backend/src/common/strategies/jwt.strategy.ts` | 90 | `e9654cfb94c878c4` | AST integral; semântica integral não verificada |
| `sistema/backend/src/common/tenant/tenant-context.middleware.spec.ts` | 43 | `57a11ffddb472ed6` | AST integral; semântica integral não verificada |
| `sistema/backend/src/common/tenant/tenant-context.middleware.ts` | 88 | `aa53da043d679d23` | AST integral; semântica integral não verificada |
| `sistema/backend/src/common/tenant/tenant-context.ts` | 57 | `3c36e1b431c048ff` | AST integral; semântica integral não verificada |
| `sistema/backend/src/common/tenant/tenant.constants.ts` | 31 | `6a19c7288f625893` | AST integral; semântica integral não verificada |
| `sistema/backend/src/main.ts` | 117 | `004a5edfc02a9283` | AST integral; semântica dirigida |
| `sistema/backend/src/modules/addresses/addresses.controller.spec.ts` | 119 | `46a2718c83a73b35` | AST integral; semântica integral não verificada |
| `sistema/backend/src/modules/addresses/addresses.controller.ts` | 144 | `2c9141a0299f6fdd` | AST integral; semântica integral não verificada |
| `sistema/backend/src/modules/addresses/addresses.module.ts` | 11 | `03d6814f16095757` | AST integral; semântica integral não verificada |
| `sistema/backend/src/modules/addresses/addresses.service.spec.ts` | 309 | `dfa1070bb9b00f71` | AST integral; semântica integral não verificada |
| `sistema/backend/src/modules/addresses/addresses.service.ts` | 162 | `0ed9c7c9cda91366` | AST integral; semântica integral não verificada |
| `sistema/backend/src/modules/analytics/alert-rule.service.ts` | 186 | `7956bda27b52e8b1` | AST integral; semântica integral não verificada |
| `sistema/backend/src/modules/analytics/analytics.controller.ts` | 265 | `acb13e2bb7ac016a` | AST integral; semântica integral não verificada |
| `sistema/backend/src/modules/analytics/analytics.module.ts` | 13 | `8113575274be43b2` | AST integral; semântica integral não verificada |
| `sistema/backend/src/modules/analytics/analytics.service.spec.ts` | 189 | `6e33b6757af7c60b` | AST integral; semântica integral não verificada |
| `sistema/backend/src/modules/analytics/analytics.service.ts` | 1000 | `07ff840ebea6a739` | AST integral; semântica integral não verificada |
| `sistema/backend/src/modules/analytics/executive-report.service.ts` | 285 | `3034e5c926e16c36` | AST integral; semântica integral não verificada |
| `sistema/backend/src/modules/audit-log/audit-log.module.ts` | 10 | `faead83846b786ef` | AST integral; semântica integral não verificada |
| `sistema/backend/src/modules/audit-log/audit-log.service.ts` | 36 | `db51373bb4b14909` | AST integral; semântica integral não verificada |
| `sistema/backend/src/modules/auth/auth.controller.ts` | 264 | `42aaa5512d9d4d28` | AST integral; semântica integral não verificada |
| `sistema/backend/src/modules/auth/auth.module.ts` | 24 | `68e03dba2d139ea9` | AST integral; semântica integral não verificada |
| `sistema/backend/src/modules/auth/auth.service.ts` | 638 | `40c82e11dad5f74b` | AST integral; semântica dirigida |
| `sistema/backend/src/modules/auth/customer-set-password.spec.ts` | 64 | `1ffdfb46fb6ee452` | AST integral; semântica integral não verificada |
| `sistema/backend/src/modules/auth/customer-token-ttl.spec.ts` | 65 | `7f864fe876ed3e8e` | AST integral; semântica integral não verificada |
| `sistema/backend/src/modules/auth/dto/create-admin.dto.ts` | 62 | `77eae8bbb6b61675` | AST integral; semântica integral não verificada |
| `sistema/backend/src/modules/auth/dto/create-customer-register.dto.ts` | 24 | `d77e643f70e0561d` | AST integral; semântica integral não verificada |
| `sistema/backend/src/modules/auth/dto/create-guest-checkout.dto.ts` | 16 | `8422007ffd587ab3` | AST integral; semântica integral não verificada |
| `sistema/backend/src/modules/auth/dto/forgot-password.dto.ts` | 26 | `c52432378f724687` | AST integral; semântica integral não verificada |
| `sistema/backend/src/modules/auth/dto/login.dto.ts` | 28 | `a202eb4eeaf162fe` | AST integral; semântica integral não verificada |
| `sistema/backend/src/modules/brand/brand.controller.ts` | 30 | `1f671024eda9c308` | AST integral; semântica integral não verificada |
| `sistema/backend/src/modules/brand/brand.module.ts` | 11 | `2b844ef2cc388a8f` | AST integral; semântica integral não verificada |
| `sistema/backend/src/modules/brand/brand.service.ts` | 89 | `d841e1f19d311f1d` | AST integral; semântica integral não verificada |
| `sistema/backend/src/modules/business/business.controller.ts` | 90 | `9e347dbf464c6de8` | AST integral; leitura semântica integral em 12–13/09/2026; ver complemento |
| `sistema/backend/src/modules/business/business.module.ts` | 15 | `d21af6ad64c10bd9` | AST integral; leitura semântica integral em 12–13/09/2026; ver complemento |
| `sistema/backend/src/modules/business/business.service.ts` | 449 | `0b4b22b05885dc55` | AST integral; leitura semântica integral em 12–13/09/2026; ver complemento |
| `sistema/backend/src/modules/catalog/catalog.controller.ts` | 82 | `c3d0cd6f2144080e` | AST integral; semântica integral não verificada |
| `sistema/backend/src/modules/catalog/catalog.module.ts` | 15 | `1ad8f5795ea454c3` | AST integral; semântica integral não verificada |
| `sistema/backend/src/modules/catalog/catalog.service.spec.ts` | 108 | `34aefce64f85f892` | AST integral; semântica integral não verificada |
| `sistema/backend/src/modules/catalog/catalog.service.ts` | 329 | `abed7eeb63ab05ee` | AST integral; semântica integral não verificada |
| `sistema/backend/src/modules/categories/admin-categories.controller.ts` | 279 | `22e2705939bad40f` | AST integral; semântica integral não verificada |
| `sistema/backend/src/modules/categories/categories.controller.ts` | 163 | `0ff1e2342516e80c` | AST integral; semântica integral não verificada |
| `sistema/backend/src/modules/categories/categories.module.ts` | 14 | `85ef2ceee3a46937` | AST integral; semântica integral não verificada |
| `sistema/backend/src/modules/categories/category-hierarchy.service.ts` | 1420 | `74cf5a51078f6500` | AST integral; semântica integral não verificada |
| `sistema/backend/src/modules/checkout/cart.controller.ts` | 41 | `8b9b8e9ed5cafd6f` | AST integral; semântica integral não verificada |
| `sistema/backend/src/modules/checkout/cart.service.ts` | 303 | `9ff4a960b4fbef1e` | AST integral; semântica integral não verificada |
| `sistema/backend/src/modules/checkout/checkout.controller.ts` | 57 | `0268f8d84dcf5d53` | AST integral; semântica integral não verificada |
| `sistema/backend/src/modules/checkout/checkout.module.ts` | 19 | `964f643a71df4336` | AST integral; semântica integral não verificada |
| `sistema/backend/src/modules/checkout/checkout.service.spec.ts` | 398 | `0b063f1b3989c6e2` | AST integral; semântica integral não verificada |
| `sistema/backend/src/modules/checkout/checkout.service.ts` | 792 | `f43a95dd56b4ff5f` | AST integral; semântica dirigida |
| `sistema/backend/src/modules/checkout/dto/cart.dto.ts` | 51 | `5673eaa6b10a3401` | AST integral; semântica integral não verificada |
| `sistema/backend/src/modules/checkout/dto/checkout.dto.ts` | 117 | `b03757da7b8ff596` | AST integral; semântica integral não verificada |
| `sistema/backend/src/modules/cms/categories/categories.controller.spec.ts` | 30 | `30b32fdb7d1da284` | AST integral; semântica integral não verificada |
| `sistema/backend/src/modules/cms/categories/categories.controller.ts` | 66 | `befe374ae25d6bd3` | AST integral; semântica integral não verificada |
| `sistema/backend/src/modules/cms/categories/categories.module.ts` | 10 | `067eb25970905ae3` | AST integral; semântica integral não verificada |
| `sistema/backend/src/modules/cms/categories/categories.service.spec.ts` | 32 | `d2456c768e3d1eb4` | AST integral; semântica integral não verificada |
| `sistema/backend/src/modules/cms/categories/categories.service.ts` | 559 | `1372f5e7b51cd24f` | AST integral; semântica integral não verificada |
| `sistema/backend/src/modules/cms/cms.module.ts` | 10 | `e77e3226ec9a333f` | AST integral; semântica integral não verificada |
| `sistema/backend/src/modules/cms/hero-slides/hero-slides.controller.spec.ts` | 30 | `5b798788256a25d9` | AST integral; semântica integral não verificada |
| `sistema/backend/src/modules/cms/hero-slides/hero-slides.controller.ts` | 43 | `ad49f60a1257ab3e` | AST integral; semântica integral não verificada |
| `sistema/backend/src/modules/cms/hero-slides/hero-slides.module.ts` | 10 | `b4b7f3c9b324b54a` | AST integral; semântica integral não verificada |
| `sistema/backend/src/modules/cms/hero-slides/hero-slides.service.spec.ts` | 32 | `f59493340ba2355a` | AST integral; semântica integral não verificada |
| `sistema/backend/src/modules/cms/hero-slides/hero-slides.service.ts` | 73 | `2b55977e184fcf7f` | AST integral; semântica integral não verificada |
| `sistema/backend/src/modules/cms/promo-banners/promo-banners.controller.ts` | 81 | `431f1b7b999853b3` | AST integral; semântica integral não verificada |
| `sistema/backend/src/modules/cms/promo-banners/promo-banners.module.ts` | 10 | `4a5934da3ffef08f` | AST integral; semântica integral não verificada |
| `sistema/backend/src/modules/cms/promo-banners/promo-banners.service.ts` | 213 | `27a5f5c65533aa7b` | AST integral; semântica integral não verificada |
| `sistema/backend/src/modules/cms/store-banners/banner-link.ts` | 65 | `b47f93131d13c0b2` | AST integral; semântica integral não verificada |
| `sistema/backend/src/modules/cms/store-banners/store-banners.controller.ts` | 78 | `f4d24038207e1e90` | AST integral; semântica integral não verificada |
| `sistema/backend/src/modules/cms/store-banners/store-banners.module.ts` | 11 | `e20e7c65190c7998` | AST integral; semântica integral não verificada |
| `sistema/backend/src/modules/cms/store-banners/store-banners.service.spec.ts` | 190 | `a274870ce0df67ec` | AST integral; semântica integral não verificada |
| `sistema/backend/src/modules/cms/store-banners/store-banners.service.ts` | 297 | `ed4b8c6351fdd082` | AST integral; semântica integral não verificada |
| `sistema/backend/src/modules/coupons/coupons.controller.ts` | 33 | `932c437e774bcfa9` | AST integral; semântica integral não verificada |
| `sistema/backend/src/modules/coupons/coupons.module.ts` | 12 | `e4f494c620c59307` | AST integral; semântica integral não verificada |
| `sistema/backend/src/modules/coupons/coupons.service.spec.ts` | 31 | `0d26939f8d24237f` | AST integral; semântica integral não verificada |
| `sistema/backend/src/modules/coupons/coupons.service.ts` | 18 | `6525e58389258223` | AST integral; semântica integral não verificada |
| `sistema/backend/src/modules/crm/crm.controller.ts` | 109 | `fc42cb1e00e20739` | AST integral; semântica integral não verificada |
| `sistema/backend/src/modules/crm/crm.module.ts` | 11 | `73f017b11d255e12` | AST integral; semântica integral não verificada |
| `sistema/backend/src/modules/crm/crm.service.spec.ts` | 188 | `01df9c00083dfc68` | AST integral; semântica integral não verificada |
| `sistema/backend/src/modules/crm/crm.service.ts` | 414 | `3f256ad38d21da9e` | AST integral; semântica integral não verificada |
| `sistema/backend/src/modules/crm/dto/crm.dto.ts` | 116 | `0494c9a196ab6194` | AST integral; semântica integral não verificada |
| `sistema/backend/src/modules/customers/customers-push-info.spec.ts` | 72 | `5e66a1c3f124878c` | AST integral; semântica integral não verificada |
| `sistema/backend/src/modules/customers/customers.controller.ts` | 158 | `dc29f3416c7dd24c` | AST integral; semântica integral não verificada |
| `sistema/backend/src/modules/customers/customers.module.ts` | 13 | `0b168c92ad57af80` | AST integral; semântica integral não verificada |
| `sistema/backend/src/modules/customers/customers.service.ts` | 190 | `88a2baca46fd8938` | AST integral; semântica dirigida |
| `sistema/backend/src/modules/customers/dto/create-customer.dto.ts` | 16 | `b2c6275bc45f5f9d` | AST integral; semântica integral não verificada |
| `sistema/backend/src/modules/data-privacy/data-privacy.controller.ts` | 65 | `d056b56ded14cebc` | AST integral; leitura semântica integral em 12–13/09/2026; ver complemento |
| `sistema/backend/src/modules/data-privacy/data-privacy.module.ts` | 13 | `dcad7771f3e06899` | AST integral; leitura semântica integral em 12–13/09/2026; ver complemento |
| `sistema/backend/src/modules/data-privacy/data-privacy.service.spec.ts` | 121 | `f8138e8a047f469a` | AST integral; leitura semântica integral em 12–13/09/2026; ver complemento |
| `sistema/backend/src/modules/data-privacy/data-privacy.service.ts` | 279 | `e92ea8e066a4ffee` | AST integral; leitura semântica integral em 12–13/09/2026; ver complemento |
| `sistema/backend/src/modules/delivery/data/delivery-rates-balcao.json` | 574 | `592d17ebdfcc6081` | Parser de formato; semântica integral não verificada |
| `sistema/backend/src/modules/delivery/delivery.controller.ts` | 262 | `5642e6d2598ae8b1` | AST integral; semântica integral não verificada |
| `sistema/backend/src/modules/delivery/delivery.module.ts` | 16 | `ae5258ab108aeeac` | AST integral; semântica integral não verificada |
| `sistema/backend/src/modules/delivery/delivery.service.spec.ts` | 440 | `0b83cab5f7ebed40` | AST integral; semântica integral não verificada |
| `sistema/backend/src/modules/delivery/delivery.service.ts` | 1356 | `1d04d6f2d1daecb9` | AST integral; semântica dirigida |
| `sistema/backend/src/modules/delivery/driver.controller.ts` | 142 | `1f5a9d4fb85386e6` | AST integral; semântica dirigida |
| `sistema/backend/src/modules/delivery/dto/delivery-zone.dto.ts` | 98 | `0c72f11a0709d69d` | AST integral; semântica integral não verificada |
| `sistema/backend/src/modules/delivery/dto/fulfillment.dto.ts` | 134 | `54c1e86dedee109e` | AST integral; semântica integral não verificada |
| `sistema/backend/src/modules/delivery/dto/ibge-address.dto.ts` | 17 | `a7bc4208ac61e2a0` | AST integral; semântica integral não verificada |
| `sistema/backend/src/modules/delivery/ibge-address.service.ts` | 82 | `87f53e0f8bbe2f40` | AST integral; semântica integral não verificada |
| `sistema/backend/src/modules/delivery/route-status-sync.spec.ts` | 89 | `543ef200180dbcbe` | AST integral; semântica integral não verificada |
| `sistema/backend/src/modules/delivery/slot-asap.spec.ts` | 81 | `fd62cfeccd6c4635` | AST integral; semântica integral não verificada |
| `sistema/backend/src/modules/delivery/take-delivery.spec.ts` | 103 | `c50d98507ae12b15` | AST integral; semântica integral não verificada |
| `sistema/backend/src/modules/integrations/antenor-api-catalog-and-orders.spec.ts` | 165 | `576ec50b97f7290e` | AST integral; semântica integral não verificada |
| `sistema/backend/src/modules/integrations/antenor-api-fidelidade-nfe.spec.ts` | 58 | `c9593339118ab229` | AST integral; semântica integral não verificada |
| `sistema/backend/src/modules/integrations/antenor-api-webhook.guard.ts` | 43 | `c1104674ecbe14f4` | AST integral; semântica integral não verificada |
| `sistema/backend/src/modules/integrations/antenor-api-webhook.spec.ts` | 120 | `b8a79d1824735b58` | AST integral; semântica integral não verificada |
| `sistema/backend/src/modules/integrations/antenor-api.service.spec.ts` | 83 | `d85bc9391df13f96` | AST integral; semântica integral não verificada |
| `sistema/backend/src/modules/integrations/antenor-api.service.ts` | 547 | `b4664791393dec81` | AST integral; semântica integral não verificada |
| `sistema/backend/src/modules/integrations/dto/charge-contract.dto.ts` | 25 | `24d2fcb64af31184` | AST integral; semântica integral não verificada |
| `sistema/backend/src/modules/integrations/dto/crm-contact.dto.ts` | 28 | `ac4b4643bbba9841` | AST integral; semântica integral não verificada |
| `sistema/backend/src/modules/integrations/dto/fiscal-document.dto.ts` | 34 | `0cec11b7dff55ec1` | AST integral; semântica integral não verificada |
| `sistema/backend/src/modules/integrations/dto/integration-outbox.dto.ts` | 66 | `243d81cbfac6465e` | AST integral; semântica integral não verificada |
| `sistema/backend/src/modules/integrations/dto/order-contract.dto.ts` | 66 | `48e7df6a9b8f2210` | AST integral; semântica integral não verificada |
| `sistema/backend/src/modules/integrations/dto/payment-ledger.dto.ts` | 110 | `bc13a6a6dcbe3d51` | AST integral; semântica integral não verificada |
| `sistema/backend/src/modules/integrations/dto/solidcom-order.dto.ts` | 56 | `ceec1bd7e17c183f` | AST integral; semântica integral não verificada |
| `sistema/backend/src/modules/integrations/health.controller.ts` | 182 | `ecaf2aa805b29722` | AST integral; semântica dirigida |
| `sistema/backend/src/modules/integrations/hubspot.service.ts` | 106 | `563e4a88b41b9b54` | AST integral; semântica integral não verificada |
| `sistema/backend/src/modules/integrations/integration-modules.service.ts` | 173 | `61f8ceab45b65543` | AST integral; semântica integral não verificada |
| `sistema/backend/src/modules/integrations/integration-outbox.service.spec.ts` | 208 | `116c4039cf027d2f` | AST integral; semântica dirigida |
| `sistema/backend/src/modules/integrations/integration-outbox.service.ts` | 549 | `7f466e72b4402808` | AST integral; semântica dirigida |
| `sistema/backend/src/modules/integrations/integrations.controller.ts` | 783 | `4c2b419e849bfcd5` | AST integral; semântica integral não verificada |
| `sistema/backend/src/modules/integrations/integrations.module.ts` | 58 | `af3cb2c73a4395a3` | AST integral; semântica dirigida |
| `sistema/backend/src/modules/integrations/integrations.service.spec.ts` | 412 | `8380d12a815ea79a` | AST integral; semântica integral não verificada |
| `sistema/backend/src/modules/integrations/integrations.service.ts` | 810 | `a0268cebf8cf3de8` | AST integral; semântica integral não verificada |
| `sistema/backend/src/modules/integrations/mark-invoiced.spec.ts` | 130 | `b73b1e7869596ae0` | AST integral; semântica integral não verificada |
| `sistema/backend/src/modules/integrations/nfe.service.ts` | 93 | `e70d110e80538fe4` | AST integral; semântica integral não verificada |
| `sistema/backend/src/modules/integrations/order-orchestration.service.spec.ts` | 839 | `52b08a8e304f6ca7` | AST integral; semântica integral não verificada |
| `sistema/backend/src/modules/integrations/order-orchestration.service.ts` | 1177 | `f963e261ba9cb051` | AST integral; semântica dirigida |
| `sistema/backend/src/modules/integrations/payments-ledger.service.spec.ts` | 166 | `341b8e3e7afc1878` | AST integral; semântica integral não verificada |
| `sistema/backend/src/modules/integrations/payments-ledger.service.ts` | 536 | `6e66d663c428d349` | AST integral; semântica integral não verificada |
| `sistema/backend/src/modules/integrations/payments-webhook.service.spec.ts` | 277 | `d1ae7dd55fa3319e` | AST integral; semântica integral não verificada |
| `sistema/backend/src/modules/integrations/payments-webhook.service.ts` | 310 | `9a5c05f4757615f0` | AST integral; semântica integral não verificada |
| `sistema/backend/src/modules/integrations/payments.service.ts` | 78 | `6ed1bb828535d7a3` | AST integral; semântica integral não verificada |
| `sistema/backend/src/modules/integrations/pdv-cancellation.scheduler.spec.ts` | 137 | `652766231861269b` | AST integral; semântica integral não verificada |
| `sistema/backend/src/modules/integrations/pdv-cancellation.scheduler.ts` | 104 | `4ccaf411ba97616e` | AST integral; semântica dirigida |
| `sistema/backend/src/modules/integrations/pedido-obs.spec.ts` | 67 | `af0d2637bab53ae2` | AST integral; semântica integral não verificada |
| `sistema/backend/src/modules/integrations/solidcom-erp.service.spec.ts` | 58 | `367d6f8db0e92be6` | AST integral; semântica integral não verificada |
| `sistema/backend/src/modules/integrations/solidcom-erp.service.ts` | 522 | `02c87703fea8f3ab` | AST integral; semântica dirigida |
| `sistema/backend/src/modules/integrations/webhook.guard.ts` | 27 | `969239f9f1fb4ecc` | AST integral; semântica integral não verificada |
| `sistema/backend/src/modules/inventory/inventory.controller.ts` | 126 | `141aacff65797217` | AST integral; semântica integral não verificada |
| `sistema/backend/src/modules/inventory/inventory.module.ts` | 15 | `97a029f75e76fd29` | AST integral; semântica integral não verificada |
| `sistema/backend/src/modules/inventory/inventory.service.spec.ts` | 244 | `23c7e0843f961ab8` | AST integral; semântica integral não verificada |
| `sistema/backend/src/modules/inventory/inventory.service.ts` | 717 | `c8b730d4070a15a4` | AST integral; semântica integral não verificada |
| `sistema/backend/src/modules/marketplace/marketplace.controller.ts` | 74 | `9172d271be171e23` | AST integral; leitura semântica integral em 12–13/09/2026; ver complemento |
| `sistema/backend/src/modules/marketplace/marketplace.module.ts` | 13 | `98400851af48ab2a` | AST integral; leitura semântica integral em 12–13/09/2026; ver complemento |
| `sistema/backend/src/modules/marketplace/marketplace.service.spec.ts` | 140 | `622f1b2cb07a185b` | AST integral; leitura semântica integral em 12–13/09/2026; ver complemento |
| `sistema/backend/src/modules/marketplace/marketplace.service.ts` | 385 | `56e62c500e1fba1d` | AST integral; leitura semântica integral em 12–13/09/2026; ver complemento |
| `sistema/backend/src/modules/notifications/ai-notification.scheduler.ts` | 46 | `375ec5bdae35ef1c` | AST integral; semântica integral não verificada |
| `sistema/backend/src/modules/notifications/ai-notification.service.ts` | 193 | `f72e1f4f817a6171` | AST integral; semântica integral não verificada |
| `sistema/backend/src/modules/notifications/email.service.ts` | 45 | `74142403b67e9c33` | AST integral; semântica integral não verificada |
| `sistema/backend/src/modules/notifications/notification.service.ts` | 113 | `0e31c55c1ba8b7cd` | AST integral; semântica integral não verificada |
| `sistema/backend/src/modules/notifications/notifications.controller.ts` | 224 | `10a708f13a3a5742` | AST integral; semântica integral não verificada |
| `sistema/backend/src/modules/notifications/notifications.module.ts` | 35 | `e6b5b63953935f56` | AST integral; semântica dirigida |
| `sistema/backend/src/modules/notifications/notifications.service.spec.ts` | 95 | `375bae694f08a807` | AST integral; semântica integral não verificada |
| `sistema/backend/src/modules/notifications/notifications.service.ts` | 326 | `69c713e30c3560b6` | AST integral; semântica integral não verificada |
| `sistema/backend/src/modules/notifications/push-equipe.spec.ts` | 78 | `0a761da9cd54201b` | AST integral; semântica integral não verificada |
| `sistema/backend/src/modules/notifications/push-notification.service.spec.ts` | 126 | `eef03370d899dedd` | AST integral; semântica dirigida |
| `sistema/backend/src/modules/notifications/push-notification.service.ts` | 303 | `c6dc6a2f538a2e52` | AST integral; semântica dirigida |
| `sistema/backend/src/modules/notifications/whatsapp.service.ts` | 163 | `5b880c414b452687` | AST integral; semântica integral não verificada |
| `sistema/backend/src/modules/observability/observability.controller.ts` | 57 | `6b4099fd41aae369` | AST integral; semântica integral não verificada |
| `sistema/backend/src/modules/observability/observability.module.ts` | 11 | `e60b390394982d1f` | AST integral; semântica integral não verificada |
| `sistema/backend/src/modules/observability/observability.service.spec.ts` | 71 | `4677925abff141d0` | AST integral; semântica integral não verificada |
| `sistema/backend/src/modules/observability/observability.service.ts` | 144 | `2ac0cc51bf7d646b` | AST integral; semântica integral não verificada |
| `sistema/backend/src/modules/orders/dto/create-order.dto.ts` | 106 | `f414f2e91bfe690b` | AST integral; semântica integral não verificada |
| `sistema/backend/src/modules/orders/dto/oms-order.dto.ts` | 52 | `1dbbc55d0fd5f123` | AST integral; semântica integral não verificada |
| `sistema/backend/src/modules/orders/dto/update-order.dto.ts` | 27 | `5727b6bb5257c7c8` | AST integral; semântica integral não verificada |
| `sistema/backend/src/modules/orders/orders.controller.ts` | 459 | `e1cafebe9b3cd4bd` | AST integral; semântica integral não verificada |
| `sistema/backend/src/modules/orders/orders.integration.spec.ts` | 331 | `33dd7e233ceebe94` | AST integral; semântica integral não verificada |
| `sistema/backend/src/modules/orders/orders.module.ts` | 19 | `11b89f8820497f13` | AST integral; semântica dirigida |
| `sistema/backend/src/modules/orders/orders.service.spec.ts` | 1015 | `113d0b3d22119705` | AST integral; semântica integral não verificada |
| `sistema/backend/src/modules/orders/orders.service.ts` | 1569 | `2ee7a84880c02813` | AST integral; semântica dirigida |
| `sistema/backend/src/modules/picking/dto/picking.dto.ts` | 122 | `219adeb9e59eb172` | AST integral; semântica integral não verificada |
| `sistema/backend/src/modules/picking/picker.controller.ts` | 246 | `968c702aef2ec913` | AST integral; semântica dirigida |
| `sistema/backend/src/modules/picking/picking.controller.ts` | 154 | `674422258d839c9a` | AST integral; semântica integral não verificada |
| `sistema/backend/src/modules/picking/picking.module.ts` | 16 | `f189dc117edb1c62` | AST integral; semântica integral não verificada |
| `sistema/backend/src/modules/picking/picking.service.spec.ts` | 260 | `ef1f06f1a8547b7a` | AST integral; semântica integral não verificada |
| `sistema/backend/src/modules/picking/picking.service.ts` | 1300 | `05ff045ac1559846` | AST integral; semântica dirigida |
| `sistema/backend/src/modules/pricing/pricing.controller.spec.ts` | 14 | `e46dd4c9c369f6a0` | AST integral; semântica integral não verificada |
| `sistema/backend/src/modules/pricing/pricing.controller.ts` | 92 | `84a5b8e1cd0f70d4` | AST integral; semântica integral não verificada |
| `sistema/backend/src/modules/pricing/pricing.module.ts` | 13 | `fdcbbc70ed1e64b0` | AST integral; semântica integral não verificada |
| `sistema/backend/src/modules/pricing/pricing.service.spec.ts` | 203 | `3bb5fc232b711d78` | AST integral; semântica integral não verificada |
| `sistema/backend/src/modules/pricing/pricing.service.ts` | 756 | `3a955cf3d13de802` | AST integral; semântica integral não verificada |
| `sistema/backend/src/modules/products/admin-products.controller.ts` | 95 | `8247e1b7acf7408b` | AST integral; semântica integral não verificada |
| `sistema/backend/src/modules/products/dto/create-product.dto.ts` | 87 | `b575f0aaf87a7d75` | AST integral; semântica integral não verificada |
| `sistema/backend/src/modules/products/dto/update-product.dto.ts` | 4 | `174d18179778eb1f` | AST integral; semântica integral não verificada |
| `sistema/backend/src/modules/products/missing-products.monitor.spec.ts` | 45 | `3ddb8f02d65d1da6` | AST integral; semântica integral não verificada |
| `sistema/backend/src/modules/products/missing-products.monitor.ts` | 134 | `3420618d556b4fda` | AST integral; semântica integral não verificada |
| `sistema/backend/src/modules/products/product-search.service.ts` | 458 | `6a131a7c8e6f258f` | AST integral; semântica integral não verificada |
| `sistema/backend/src/modules/products/products-sync.scheduler.ts` | 104 | `a10e212cf7795d78` | AST integral; semântica dirigida |
| `sistema/backend/src/modules/products/products.controller.ts` | 506 | `26eeac9511fc1617` | AST integral; semântica integral não verificada |
| `sistema/backend/src/modules/products/products.module.ts` | 21 | `20e8f296f2d2840d` | AST integral; semântica integral não verificada |
| `sistema/backend/src/modules/products/products.service.spec.ts` | 595 | `8893e2a21ca0f920` | AST integral; semântica integral não verificada |
| `sistema/backend/src/modules/products/products.service.ts` | 2233 | `211fdb8140444061` | AST integral; semântica dirigida |
| `sistema/backend/src/modules/promotions/promotions.controller.ts` | 54 | `dd7157838c555ee1` | AST integral; semântica integral não verificada |
| `sistema/backend/src/modules/promotions/promotions.module.ts` | 14 | `052981bc4b709dbb` | AST integral; semântica integral não verificada |
| `sistema/backend/src/modules/promotions/promotions.scheduler.ts` | 49 | `999703a136775da1` | AST integral; semântica integral não verificada |
| `sistema/backend/src/modules/promotions/promotions.service.spec.ts` | 133 | `73b767b4cdc8756b` | AST integral; semântica integral não verificada |
| `sistema/backend/src/modules/promotions/promotions.service.ts` | 209 | `19aeccb612c164e8` | AST integral; semântica integral não verificada |
| `sistema/backend/src/modules/public-api/dto/public-api.dto.ts` | 55 | `ade3b10216384587` | AST integral; semântica integral não verificada |
| `sistema/backend/src/modules/public-api/public-api.controller.ts` | 117 | `4988bd26dd8c96b2` | AST integral; semântica integral não verificada |
| `sistema/backend/src/modules/public-api/public-api.module.ts` | 12 | `cfbf2a9462ee82b8` | AST integral; semântica integral não verificada |
| `sistema/backend/src/modules/public-api/public-api.service.spec.ts` | 216 | `c29eab068aead9dc` | AST integral; semântica integral não verificada |
| `sistema/backend/src/modules/public-api/public-api.service.ts` | 377 | `55c0ecbfdef81e3a` | AST integral; semântica integral não verificada |
| `sistema/backend/src/modules/recipes/dto/create-recipe.dto.ts` | 127 | `22b7d4d22f8dbcf1` | AST integral; semântica integral não verificada |
| `sistema/backend/src/modules/recipes/dto/recipe-category.dto.ts` | 28 | `baffe9030c5c3d54` | AST integral; semântica integral não verificada |
| `sistema/backend/src/modules/recipes/dto/update-recipe.dto.ts` | 4 | `ce430810322a6822` | AST integral; semântica integral não verificada |
| `sistema/backend/src/modules/recipes/recipes.controller.spec.ts` | 31 | `f5b185843f010f91` | AST integral; semântica integral não verificada |
| `sistema/backend/src/modules/recipes/recipes.controller.ts` | 94 | `83a49b2ae038bb9d` | AST integral; semântica integral não verificada |
| `sistema/backend/src/modules/recipes/recipes.module.ts` | 11 | `15db17f6437ef7b9` | AST integral; semântica integral não verificada |
| `sistema/backend/src/modules/recipes/recipes.service.spec.ts` | 130 | `f2f9a1ca648dc524` | AST integral; semântica integral não verificada |
| `sistema/backend/src/modules/recipes/recipes.service.ts` | 162 | `1be22928f923c00f` | AST integral; semântica integral não verificada |
| `sistema/backend/src/modules/recommendations/recommendations.controller.ts` | 69 | `763f53b8e8226e9e` | AST integral; semântica integral não verificada |
| `sistema/backend/src/modules/recommendations/recommendations.module.ts` | 11 | `c59796b9906f11f1` | AST integral; semântica integral não verificada |
| `sistema/backend/src/modules/recommendations/recommendations.service.spec.ts` | 153 | `5971cdfa219964c3` | AST integral; semântica integral não verificada |
| `sistema/backend/src/modules/recommendations/recommendations.service.ts` | 462 | `322ab94a45b057e2` | AST integral; semântica integral não verificada |
| `sistema/backend/sync-products.js` | 137 | `ff80e3257e8e414e` | AST integral; semântica integral não verificada |
| `sistema/backend/tsconfig.json` | 29 | `067f4fbd167395bc` | Leitura dirigida; semântica integral não verificada |
| `sistema/backup/Dockerfile` | 8 | `88405db34749c754` | Inventário; revisão semântica integral pendente |
| `sistema/backup/backup.sh` | 58 | `1895fc0b2cc39a67` | Leitura dirigida; semântica integral não verificada |
| `sistema/backup/rclone.conf.example` | 12 | `46476523321c39bb` | Inventário; revisão semântica integral pendente |
| `sistema/certs/cert.pem` | 26 | `f741bd232fb38f9b` | Não-fonte criptográfico; somente presença/digest |
| `sistema/certs/key.pem` | 28 | `f9f3a94bce597ddd` | Não-fonte criptográfico; somente presença/digest |
| `sistema/certs/rootCA.pem` | 29 | `d8042c24bdb003b3` | Não-fonte criptográfico; somente presença/digest |
| `sistema/check-baseline.sql` | 5 | `fd0dafa2469e2f26` | Inventário; revisão semântica integral pendente |
| `sistema/create-gaps.sql` | 27 | `15a9cb965a493ec3` | Inventário; revisão semântica integral pendente |
| `sistema/delivery-app/Dockerfile` | 19 | `145cdd8436e9fae7` | Inventário; revisão semântica integral pendente |
| `sistema/delivery-app/index.html` | 18 | `1a037016bfbe760d` | Inventário; revisão semântica integral pendente |
| `sistema/delivery-app/nginx.conf` | 34 | `b288f0ce35b78298` | Leitura dirigida; semântica integral não verificada |
| `sistema/delivery-app/package-lock.json` | 3129 | `4fd312834ea21eaf` | Leitura dirigida; semântica integral não verificada |
| `sistema/delivery-app/package.json` | 28 | `ef3323dad8ff43c7` | Parser de formato; semântica integral não verificada |
| `sistema/delivery-app/postcss.config.js` | 6 | `374f669f08b18e67` | AST integral; semântica integral não verificada |
| `sistema/delivery-app/public/manifest.json` | 15 | `c9f6d7a467da0063` | Parser de formato; semântica integral não verificada |
| `sistema/delivery-app/public/service-worker.js` | 78 | `e60a0ad346be705f` | AST integral; semântica integral não verificada |
| `sistema/delivery-app/src/App.tsx` | 59 | `761469c17a7e5ce7` | AST integral; semântica integral não verificada |
| `sistema/delivery-app/src/components/AvisoPush.tsx` | 60 | `6b879942adfdf7fa` | AST integral; semântica integral não verificada |
| `sistema/delivery-app/src/hooks/usePushEquipe.ts` | 137 | `9d7bca80b8abe31e` | AST integral; semântica dirigida |
| `sistema/delivery-app/src/index.css` | 15 | `972676de023c0879` | Parser de formato; semântica integral não verificada |
| `sistema/delivery-app/src/main.tsx` | 25 | `80a5f42ae5ee68ce` | AST integral; semântica integral não verificada |
| `sistema/delivery-app/src/pages/Login.tsx` | 73 | `542e63ee2b9d93d3` | AST integral; semântica integral não verificada |
| `sistema/delivery-app/src/pages/RouteDetail.tsx` | 357 | `f0ef910d6f540e4b` | AST integral; semântica integral não verificada |
| `sistema/delivery-app/src/pages/RouteList.tsx` | 213 | `91aa1a2ace860516` | AST integral; semântica integral não verificada |
| `sistema/delivery-app/src/services/api.ts` | 110 | `5d8b05e0921eeb40` | AST integral; semântica integral não verificada |
| `sistema/delivery-app/src/utils/orderCode.ts` | 13 | `798a22948916cb7e` | AST integral; semântica integral não verificada |
| `sistema/delivery-app/src/vite-env.d.ts` | 1 | `424faf9241dd699d` | AST integral; semântica integral não verificada |
| `sistema/delivery-app/tailwind.config.js` | 21 | `27dda44dfbacd704` | AST integral; semântica integral não verificada |
| `sistema/delivery-app/tsconfig.json` | 21 | `5b64ad9aaceb81fd` | Parser de formato; semântica integral não verificada |
| `sistema/delivery-app/tsconfig.node.json` | 10 | `6ec602b8aa146888` | Parser de formato; semântica integral não verificada |
| `sistema/delivery-app/vite.config.ts` | 14 | `109dcc64610544b6` | AST integral; semântica integral não verificada |
| `sistema/docker-compose.prod.yml` | 249 | `21acd9a515cad103` | Leitura dirigida; semântica integral não verificada |
| `sistema/docker-compose.staging.yml` | 132 | `6221cafe9cfe190f` | Leitura dirigida; semântica integral não verificada |
| `sistema/docker-compose.yml` | 206 | `e860a531a4d41ac8` | Leitura dirigida; semântica integral não verificada |
| `sistema/ecosystem.config.js` | 25 | `89107e5619eda916` | AST integral; semântica dirigida |
| `sistema/frontend/.dockerignore` | 12 | `71f5e6b0e6e52f29` | Inventário; revisão semântica integral pendente |
| `sistema/frontend/.eslintrc.cjs` | 25 | `50656fb9745d9620` | AST integral; semântica integral não verificada |
| `sistema/frontend/Dockerfile` | 38 | `98f17ae5a217b870` | Inventário; revisão semântica integral pendente |
| `sistema/frontend/README.md` | 37 | `fb8f320b25f6f446` | Inventário; revisão semântica integral pendente |
| `sistema/frontend/cypress.config.ts` | 11 | `50624be09ec44d73` | AST integral; semântica integral não verificada |
| `sistema/frontend/cypress/e2e/account-fallback-ui-kit.cy.ts` | 141 | `74454669ae2457fc` | AST integral; semântica integral não verificada |
| `sistema/frontend/cypress/e2e/auth-ui-kit.cy.ts` | 56 | `487d05649cfa18a0` | AST integral; semântica integral não verificada |
| `sistema/frontend/cypress/e2e/cart.cy.ts` | 271 | `9925ced0b743c615` | AST integral; semântica integral não verificada |
| `sistema/frontend/cypress/e2e/categories-mapping-api.cy.ts` | 38 | `7bac77b10616c084` | AST integral; semântica integral não verificada |
| `sistema/frontend/cypress/e2e/checkout.cy.ts` | 265 | `916d4d858828632f` | AST integral; semântica integral não verificada |
| `sistema/frontend/cypress/e2e/mobile-visual-smoke.cy.ts` | 462 | `095f10572ad48d14` | AST integral; semântica integral não verificada |
| `sistema/frontend/cypress/e2e/product-detail.cy.ts` | 91 | `fc2355939582c4cb` | AST integral; semântica integral não verificada |
| `sistema/frontend/cypress/e2e/product-pricing.cy.ts` | 179 | `3ddc9e8705c61014` | AST integral; semântica integral não verificada |
| `sistema/frontend/cypress/e2e/recipes.cy.ts` | 25 | `94653c42abf7b1b5` | AST integral; semântica integral não verificada |
| `sistema/frontend/cypress/e2e/secondary-routes-visual.cy.ts` | 255 | `9eb4ac1b64cefd3c` | AST integral; semântica integral não verificada |
| `sistema/frontend/cypress/e2e/smoke.cy.ts` | 32 | `c427a8b5e25db2d1` | AST integral; semântica integral não verificada |
| `sistema/frontend/cypress/e2e/staging-secondary-routes-real.cy.ts` | 207 | `cb11733f8124d2c7` | AST integral; semântica integral não verificada |
| `sistema/frontend/cypress/e2e/staging-smoke.cy.ts` | 219 | `4ed5aa4aa3504ef1` | AST integral; semântica integral não verificada |
| `sistema/frontend/cypress/e2e/web-push-subscribe.cy.ts` | 161 | `3ccd1570f611ef00` | AST integral; semântica integral não verificada |
| `sistema/frontend/index.html` | 24 | `3e9e9bf4bd81996b` | Inventário; revisão semântica integral pendente |
| `sistema/frontend/nginx.conf` | 198 | `6c9016553681b1f8` | Leitura dirigida; semântica integral não verificada |
| `sistema/frontend/nginx.staging.conf` | 101 | `e3df753fc8bb5265` | Inventário; revisão semântica integral pendente |
| `sistema/frontend/package-lock.json` | 8364 | `bfbb2dffdc3cdcf6` | Leitura dirigida; semântica integral não verificada |
| `sistema/frontend/package.json` | 56 | `92a74707ef90780b` | Parser de formato; semântica integral não verificada |
| `sistema/frontend/postcss.config.js` | 6 | `b554e0e63770163e` | AST integral; semântica integral não verificada |
| `sistema/frontend/public/manifest.webmanifest` | 20 | `2cc9cf3385eba176` | Inventário; revisão semântica integral pendente |
| `sistema/frontend/public/placeholder-product-v2.svg` | 8 | `983f9b92f0f19601` | Inventário; revisão semântica integral pendente |
| `sistema/frontend/public/placeholder-product.svg` | 13 | `473b4d3cffbf20c1` | Inventário; revisão semântica integral pendente |
| `sistema/frontend/public/robots.txt` | 4 | `c97537997fa6637a` | Inventário; revisão semântica integral pendente |
| `sistema/frontend/public/service-worker.js` | 89 | `8ce770fd89832a42` | AST integral; semântica integral não verificada |
| `sistema/frontend/public/sitemap.xml` | 33 | `2af113a9f2e01272` | Inventário; revisão semântica integral pendente |
| `sistema/frontend/smoke_test.ps1` | 52 | `8e40bf64e95cfda0` | Parser PowerShell; não executado |
| `sistema/frontend/src/App.css` | 1 | `4e95486ab5b97b29` | Parser de formato; semântica integral não verificada |
| `sistema/frontend/src/App.tsx` | 187 | `07b70810719c43cb` | AST integral; semântica integral não verificada |
| `sistema/frontend/src/components/BannerImage.tsx` | 79 | `c70cd2e9b1669cfa` | AST integral; semântica integral não verificada |
| `sistema/frontend/src/components/CriarSenhaCard.tsx` | 102 | `bb36129fbaa002c9` | AST integral; semântica integral não verificada |
| `sistema/frontend/src/components/DeliveryVerificationModal.tsx` | 570 | `36a2168dcf2f2b87` | AST integral; semântica integral não verificada |
| `sistema/frontend/src/components/ErrorBoundary.tsx` | 50 | `f4f1c1631ed0e738` | AST integral; semântica integral não verificada |
| `sistema/frontend/src/components/Footer.tsx` | 188 | `8d58ee5b23c48d97` | AST integral; semântica integral não verificada |
| `sistema/frontend/src/components/FreeShippingBar.tsx` | 132 | `d3da2e27274d0eda` | AST integral; semântica integral não verificada |
| `sistema/frontend/src/components/HeroSlider.tsx` | 417 | `f7ccf2f07801c431` | AST integral; semântica integral não verificada |
| `sistema/frontend/src/components/LoadingButton.tsx` | 45 | `af0477b3a1550670` | AST integral; semântica integral não verificada |
| `sistema/frontend/src/components/LocalityPickerModal.tsx` | 91 | `2a3cb5bc3f8da5bc` | AST integral; semântica integral não verificada |
| `sistema/frontend/src/components/MobileBottomNav.tsx` | 109 | `3310d933ebf27edd` | AST integral; semântica integral não verificada |
| `sistema/frontend/src/components/NetworkToast.tsx` | 56 | `201bbb09070215fb` | AST integral; semântica integral não verificada |
| `sistema/frontend/src/components/NotificationBell.tsx` | 166 | `168cbf7ee1fd4b19` | AST integral; semântica integral não verificada |
| `sistema/frontend/src/components/PageTransition.tsx` | 25 | `19fb67138fdde38d` | AST integral; semântica integral não verificada |
| `sistema/frontend/src/components/ProductImagePlaceholder.tsx` | 27 | `fe45205d4f54a69a` | AST integral; semântica integral não verificada |
| `sistema/frontend/src/components/ProductShelf.tsx` | 130 | `221892296c81ef7e` | AST integral; semântica integral não verificada |
| `sistema/frontend/src/components/PromoBanner.tsx` | 179 | `383bd23bfdc0cdb7` | AST integral; semântica integral não verificada |
| `sistema/frontend/src/components/SEO.tsx` | 69 | `3563b6111aceb096` | AST integral; semântica integral não verificada |
| `sistema/frontend/src/components/Skeleton.tsx` | 43 | `2b469b67e23009ff` | AST integral; semântica integral não verificada |
| `sistema/frontend/src/components/StoreProductCard.tsx` | 321 | `cc26b5631027ef35` | AST integral; semântica integral não verificada |
| `sistema/frontend/src/components/ui/badge.tsx` | 28 | `d9ca55bdc8dd5fec` | AST integral; semântica integral não verificada |
| `sistema/frontend/src/components/ui/button.tsx` | 60 | `bfbff54970bfa43a` | AST integral; semântica integral não verificada |
| `sistema/frontend/src/components/ui/checkbox.tsx` | 17 | `0517db16e38d6318` | AST integral; semântica integral não verificada |
| `sistema/frontend/src/components/ui/input.tsx` | 22 | `b4ff3ffad6fc2114` | AST integral; semântica integral não verificada |
| `sistema/frontend/src/components/ui/password-input.tsx` | 34 | `13a10d5cdb4eba12` | AST integral; semântica integral não verificada |
| `sistema/frontend/src/components/ui/radio.tsx` | 17 | `1c12d3276a0ae06d` | AST integral; semântica integral não verificada |
| `sistema/frontend/src/components/ui/select.tsx` | 17 | `56128e95edc2d13c` | AST integral; semântica integral não verificada |
| `sistema/frontend/src/components/ui/surface.ts` | 26 | `d9641b6890bd314a` | AST integral; semântica integral não verificada |
| `sistema/frontend/src/config/deliveryOperation.ts` | 48 | `bee29e13cc76cc1f` | AST integral; semântica integral não verificada |
| `sistema/frontend/src/contexts/AuthContext.tsx` | 113 | `85847cd65fbee345` | AST integral; semântica integral não verificada |
| `sistema/frontend/src/contexts/CartContext.test.tsx` | 264 | `daeccda1a5e2f4c8` | AST integral; semântica integral não verificada |
| `sistema/frontend/src/contexts/CartContext.tsx` | 193 | `4aa3510253e98611` | AST integral; semântica integral não verificada |
| `sistema/frontend/src/contexts/DeliveryVerificationModalContext.tsx` | 35 | `fb612f92e2aea8a4` | AST integral; semântica integral não verificada |
| `sistema/frontend/src/contexts/destinoSeguro.test.ts` | 21 | `b718d97babd4a620` | AST integral; semântica integral não verificada |
| `sistema/frontend/src/hooks/useAddressAutofill.ts` | 174 | `fe501f606d5feaf0` | AST integral; semântica integral não verificada |
| `sistema/frontend/src/hooks/useAuth.ts` | 6 | `9fe8629de0803b7b` | AST integral; semântica integral não verificada |
| `sistema/frontend/src/hooks/useAutoDeliveryVerification.ts` | 51 | `10027b7849667b40` | AST integral; semântica integral não verificada |
| `sistema/frontend/src/hooks/useAutoScroll.ts` | 43 | `72f7a87896b825d0` | AST integral; semântica dirigida |
| `sistema/frontend/src/hooks/useBannerImpression.ts` | 49 | `4f40f491ed1a6998` | AST integral; semântica integral não verificada |
| `sistema/frontend/src/hooks/useBrand.ts` | 91 | `30bc95e63009d7b1` | AST integral; semântica integral não verificada |
| `sistema/frontend/src/hooks/useCMS.ts` | 113 | `ccfb0c60e0cae2a7` | AST integral; semântica integral não verificada |
| `sistema/frontend/src/hooks/useCart.ts` | 143 | `f2633e181cb08c71` | AST integral; semântica integral não verificada |
| `sistema/frontend/src/hooks/useCheckout.ts` | 90 | `362496dd7ae1725d` | AST integral; semântica integral não verificada |
| `sistema/frontend/src/hooks/useDeliveryAddress.ts` | 28 | `d35651903f5ed8c8` | AST integral; semântica integral não verificada |
| `sistema/frontend/src/hooks/useDeliveryOperation.ts` | 34 | `4e5b81bf3b48426d` | AST integral; semântica integral não verificada |
| `sistema/frontend/src/hooks/useDragScroll.ts` | 68 | `ee45251fdcc809f3` | AST integral; semântica integral não verificada |
| `sistema/frontend/src/hooks/useFreeShipping.ts` | 35 | `0b7d8e30ffdc8ba2` | AST integral; semântica integral não verificada |
| `sistema/frontend/src/hooks/useHomeShelves.ts` | 338 | `d30051f6af8da9ea` | AST integral; semântica integral não verificada |
| `sistema/frontend/src/hooks/useKnownZoneFreeAbove.ts` | 19 | `c647a7258d698e4a` | AST integral; semântica integral não verificada |
| `sistema/frontend/src/hooks/useMediaQuery.ts` | 36 | `f05914620faa135e` | AST integral; semântica integral não verificada |
| `sistema/frontend/src/hooks/useNotifications.ts` | 169 | `5d6f0cbed1add466` | AST integral; semântica integral não verificada |
| `sistema/frontend/src/hooks/useOrders.ts` | 65 | `71ea4d21dbb4c756` | AST integral; semântica integral não verificada |
| `sistema/frontend/src/hooks/usePrefersReducedMotion.ts` | 26 | `f97f161bb1653a28` | AST integral; semântica dirigida |
| `sistema/frontend/src/hooks/useRecipes.ts` | 45 | `c9b78810c9da1a2e` | AST integral; semântica integral não verificada |
| `sistema/frontend/src/index.css` | 134 | `6bc864386adc67b7` | Parser de formato; semântica integral não verificada |
| `sistema/frontend/src/lib/cn.ts` | 6 | `e46429536f43f591` | AST integral; semântica integral não verificada |
| `sistema/frontend/src/main.tsx` | 47 | `70b4a2f1adf57824` | AST integral; semântica integral não verificada |
| `sistema/frontend/src/pages/Account.tsx` | 825 | `211a69da1a32fe69` | AST integral; semântica integral não verificada |
| `sistema/frontend/src/pages/Cart.tsx` | 471 | `4de08a3dded0c3b8` | AST integral; semântica integral não verificada |
| `sistema/frontend/src/pages/Checkout.tsx` | 1486 | `b6ff1cc551c9687c` | AST integral; semântica dirigida |
| `sistema/frontend/src/pages/Forbidden.tsx` | 17 | `920ad109ece84630` | AST integral; semântica integral não verificada |
| `sistema/frontend/src/pages/ForgotPassword.tsx` | 103 | `4d100e5d2876249b` | AST integral; semântica integral não verificada |
| `sistema/frontend/src/pages/Home.tsx` | 1201 | `e5ac013cd039ac85` | AST integral; semântica integral não verificada |
| `sistema/frontend/src/pages/Login.tsx` | 145 | `e4a4125cd4fe10f5` | AST integral; semântica integral não verificada |
| `sistema/frontend/src/pages/NotFound.tsx` | 17 | `bd21ac388daa957c` | AST integral; semântica integral não verificada |
| `sistema/frontend/src/pages/PrivacyPolicy.tsx` | 214 | `d78eb284d259220c` | AST integral; semântica integral não verificada |
| `sistema/frontend/src/pages/ProductDetail.tsx` | 546 | `c58672cb063156bb` | AST integral; semântica integral não verificada |
| `sistema/frontend/src/pages/Promocoes.tsx` | 77 | `49f0514238ef58aa` | AST integral; semântica integral não verificada |
| `sistema/frontend/src/pages/RecipeDetail.tsx` | 388 | `1a92efb627441d96` | AST integral; semântica integral não verificada |
| `sistema/frontend/src/pages/RecipeList.tsx` | 187 | `91116684a0eba714` | AST integral; semântica integral não verificada |
| `sistema/frontend/src/pages/Register.tsx` | 333 | `2ca6cc65de451cbf` | AST integral; semântica integral não verificada |
| `sistema/frontend/src/pages/ResetPassword.tsx` | 128 | `9a92472d6a32d3f9` | AST integral; semântica integral não verificada |
| `sistema/frontend/src/pages/Search.tsx` | 959 | `371c27d0fe557ad3` | AST integral; semântica integral não verificada |
| `sistema/frontend/src/pages/TermsOfUse.tsx` | 231 | `75af2858b8a89115` | AST integral; semântica integral não verificada |
| `sistema/frontend/src/pages/WinePage.tsx` | 482 | `13d769f68338f3a5` | AST integral; semântica integral não verificada |
| `sistema/frontend/src/services/api.ts` | 499 | `5c561a813e937a6c` | AST integral; semântica integral não verificada |
| `sistema/frontend/src/services/deliveryVerification.ts` | 379 | `ae96af034f266fc3` | AST integral; semântica integral não verificada |
| `sistema/frontend/src/types/index.ts` | 148 | `2b3e6460991f6d82` | AST integral; semântica integral não verificada |
| `sistema/frontend/src/utils/analytics.ts` | 33 | `acbcf8e0674f900c` | AST integral; semântica integral não verificada |
| `sistema/frontend/src/utils/apiError.ts` | 34 | `95e9ee21c6f1c482` | AST integral; semântica integral não verificada |
| `sistema/frontend/src/utils/changeOptions.ts` | 67 | `491cffee04571c6f` | AST integral; semântica integral não verificada |
| `sistema/frontend/src/utils/checkout.test.ts` | 71 | `1b7d6b92db921b08` | AST integral; semântica integral não verificada |
| `sistema/frontend/src/utils/checkout.ts` | 69 | `014f425e23615efd` | AST integral; semântica integral não verificada |
| `sistema/frontend/src/utils/checkoutDraft.test.ts` | 45 | `5d44a1a2f2eb708d` | AST integral; semântica integral não verificada |
| `sistema/frontend/src/utils/checkoutDraft.ts` | 81 | `a28eef9e7acdf7a2` | AST integral; semântica integral não verificada |
| `sistema/frontend/src/utils/deliveryAddress.ts` | 129 | `0b317898a7129458` | AST integral; semântica integral não verificada |
| `sistema/frontend/src/utils/deliveryOperation.ts` | 289 | `44acefe0c204e039` | AST integral; semântica integral não verificada |
| `sistema/frontend/src/utils/device.ts` | 35 | `375d52824c6745a7` | AST integral; semântica integral não verificada |
| `sistema/frontend/src/utils/format.ts` | 75 | `f5e4522ed1aa166a` | AST integral; semântica integral não verificada |
| `sistema/frontend/src/utils/homeCategories.test.ts` | 311 | `d56746030c0a65fd` | AST integral; semântica integral não verificada |
| `sistema/frontend/src/utils/homeCategories.ts` | 391 | `8256747a4e32a3ed` | AST integral; semântica integral não verificada |
| `sistema/frontend/src/utils/productCard.ts` | 157 | `2d3c700a074815c4` | AST integral; semântica integral não verificada |
| `sistema/frontend/src/utils/productDetailSchema.ts` | 165 | `7220b205821a34db` | AST integral; semântica integral não verificada |
| `sistema/frontend/src/utils/productPricing.test.ts` | 308 | `768cee2f0ecf8227` | AST integral; semântica integral não verificada |
| `sistema/frontend/src/utils/productPricing.ts` | 149 | `c423546a5239cf1a` | AST integral; semântica integral não verificada |
| `sistema/frontend/src/utils/validators.ts` | 118 | `479502a75711e53c` | AST integral; semântica integral não verificada |
| `sistema/frontend/stats.html` | 4950 | `de92cb050974d138` | Inventário; revisão semântica integral pendente |
| `sistema/frontend/tailwind.config.js` | 31 | `8282d53e65c352c7` | AST integral; semântica integral não verificada |
| `sistema/frontend/tsconfig.build.json` | 12 | `8cd914aa7a4c2d09` | Parser de formato; semântica integral não verificada |
| `sistema/frontend/tsconfig.json` | 37 | `ba91ea3671e37424` | Parser de formato; semântica integral não verificada |
| `sistema/frontend/tsconfig.node.json` | 10 | `78e7396f84d5591e` | Parser de formato; semântica integral não verificada |
| `sistema/frontend/vite.config.ts` | 42 | `dcdae28e7403f00d` | AST integral; semântica integral não verificada |
| `sistema/go-live-ops.ps1` | 134 | `f141921282b4e3a4` | Parser PowerShell; não executado |
| `sistema/package-lock.json` | 510 | `79d95ba7baad16cc` | Leitura dirigida; semântica integral não verificada |
| `sistema/package.json` | 37 | `180bf31eccf7291d` | Leitura dirigida; semântica integral não verificada |
| `sistema/picking-app/Dockerfile` | 19 | `145cdd8436e9fae7` | Inventário; revisão semântica integral pendente |
| `sistema/picking-app/index.html` | 18 | `e58068cfdd3645f8` | Inventário; revisão semântica integral pendente |
| `sistema/picking-app/nginx.conf` | 34 | `b288f0ce35b78298` | Leitura dirigida; semântica integral não verificada |
| `sistema/picking-app/package-lock.json` | 3174 | `10b16ba185f5d40c` | Leitura dirigida; semântica integral não verificada |
| `sistema/picking-app/package.json` | 30 | `679cd360375bca15` | Parser de formato; semântica integral não verificada |
| `sistema/picking-app/postcss.config.js` | 6 | `374f669f08b18e67` | AST integral; semântica integral não verificada |
| `sistema/picking-app/public/manifest.json` | 15 | `76f26866ec9c7fa0` | Parser de formato; semântica integral não verificada |
| `sistema/picking-app/public/service-worker.js` | 78 | `0a499b8577013035` | AST integral; semântica integral não verificada |
| `sistema/picking-app/src/App.tsx` | 59 | `5860bbfdd263a8c0` | AST integral; semântica integral não verificada |
| `sistema/picking-app/src/components/AvisoPush.tsx` | 60 | `71f7b3ae1fe9a080` | AST integral; semântica integral não verificada |
| `sistema/picking-app/src/components/BarcodeScanner.tsx` | 153 | `7f66d01351a37ac8` | AST integral; semântica integral não verificada |
| `sistema/picking-app/src/hooks/usePushEquipe.ts` | 137 | `9d7bca80b8abe31e` | AST integral; semântica dirigida |
| `sistema/picking-app/src/index.css` | 15 | `972676de023c0879` | Parser de formato; semântica integral não verificada |
| `sistema/picking-app/src/main.tsx` | 25 | `80a5f42ae5ee68ce` | AST integral; semântica integral não verificada |
| `sistema/picking-app/src/pages/Login.tsx` | 73 | `a67a704112f990f8` | AST integral; semântica integral não verificada |
| `sistema/picking-app/src/pages/OrderList.tsx` | 249 | `253af3fcbf02a300` | AST integral; semântica dirigida |
| `sistema/picking-app/src/pages/OrderPicking.tsx` | 1117 | `9a5c53110b309d59` | AST integral; semântica dirigida |
| `sistema/picking-app/src/services/api.ts` | 136 | `5ec355469f20d6c3` | AST integral; semântica integral não verificada |
| `sistema/picking-app/src/utils/orderCode.ts` | 20 | `6643b840ccee1fb6` | AST integral; semântica integral não verificada |
| `sistema/picking-app/src/vite-env.d.ts` | 1 | `424faf9241dd699d` | AST integral; semântica integral não verificada |
| `sistema/picking-app/tailwind.config.js` | 21 | `27dda44dfbacd704` | AST integral; semântica integral não verificada |
| `sistema/picking-app/tsconfig.json` | 21 | `5b64ad9aaceb81fd` | Parser de formato; semântica integral não verificada |
| `sistema/picking-app/tsconfig.node.json` | 10 | `6ec602b8aa146888` | Parser de formato; semântica integral não verificada |
| `sistema/picking-app/vite.config.ts` | 14 | `45cadf9d13912d26` | AST integral; semântica integral não verificada |
| `sistema/produtos-listagem.md` | 71 | `62f13c90a03d03e3` | Inventário; revisão semântica integral pendente |
| `sistema/release-ops.ps1` | 158 | `86b57f6299a24f88` | Leitura dirigida; semântica integral não verificada |
| `sistema/scripts/check-env.js` | 132 | `5e53d4f9d94b5ca0` | AST integral; semântica integral não verificada |
| `sistema/scripts/check-orphan-fields.js` | 153 | `b16366c0cccc33ce` | AST integral; semântica integral não verificada |
| `sistema/scripts/check-schema-drift.js` | 98 | `53affe764546677a` | AST integral; semântica integral não verificada |
| `sistema/scripts/confirm-web-push-visual.js` | 118 | `eea783778679d53e` | AST integral; semântica integral não verificada |
| `sistema/scripts/finalize-web-push-homologation.js` | 145 | `60e956dd934a5ae7` | AST integral; semântica integral não verificada |
| `sistema/scripts/generate-web-push-homologation-report.js` | 240 | `d1a69d77a7e38f94` | AST integral; semântica integral não verificada |
| `sistema/scripts/generate-web-push-vapid.js` | 85 | `9a4db31c4ad6b10b` | AST integral; semântica integral não verificada |
| `sistema/scripts/homologate-web-push.js` | 270 | `4854aa327797c765` | AST integral; semântica integral não verificada |
| `sistema/scripts/inspect-web-push-subscriptions.js` | 257 | `beb8cfc558abccce` | AST integral; semântica integral não verificada |
| `sistema/scripts/prepare-web-push-env.js` | 285 | `af8248fb9312124a` | AST integral; semântica integral não verificada |
| `sistema/scripts/prove-web-push-delivery.js` | 302 | `edf8dcd459e01fc8` | AST integral; semântica integral não verificada |
| `sistema/scripts/register-web-push-cdp-chrome.js` | 273 | `5d92b65135e1f454` | AST integral; semântica integral não verificada |
| `sistema/scripts/validate-category-tree.js` | 392 | `427269033b096321` | AST integral; semântica integral não verificada |
| `sistema/scripts/validate-web-push-evidence.js` | 352 | `e0b81773bfc345c8` | AST integral; semântica integral não verificada |
| `sistema/scripts/validate-web-push-readiness.js` | 424 | `7749eb3ea3450ee5` | AST integral; semântica integral não verificada |
| `sistema/scripts/validate-web-push-tooling.js` | 470 | `94e98229179d1af8` | AST integral; semântica integral não verificada |
| `sistema/scripts/verify-web-push-evidence-manifest.js` | 139 | `fed98fec5f801cf2` | AST integral; semântica integral não verificada |
| `sistema/seed-admin.sql` | 17 | `f75e8497abe22724` | Inventário; revisão semântica integral pendente |
| `sistema/setup.sh` | 47 | `15b045030f5b0174` | bash -n; não executado |
| `sistema/stack-ops.ps1` | 64 | `944d834aaeebdecb` | Leitura dirigida; semântica integral não verificada |
| `sistema/staging-ops.ps1` | 81 | `fbc75d2c7879d0ff` | Leitura dirigida; semântica integral não verificada |
| `sistema/start-all.sh` | 38 | `8159d3fb3c80fb61` | Leitura dirigida; semântica integral não verificada |
| `sistema/startup-for-debug.ps1` | 109 | `9bec4ce19b31d853` | Parser PowerShell; não executado |
| `sistema/update_slides.sql` | 3 | `12de804dc017f463` | Inventário; revisão semântica integral pendente |


### Complemento e correção da classificação do inventário

O filtro inicial pelo nome de pasta uploads classificou indevidamente seis arquivos do módulo backend como conteúdo enviado. Eles são fonte, foram lidos e incluídos na AST e nas verificações; a matriz principal foi corrigida para 1049 itens inventariados e 16460 uploads não-fonte. Dois arquivos novos de carrinho abandonado apareceram depois do inventário e constam neste complemento, sem alterar retroativamente a contagem inicial. O conjunto documental total passa a 1051 itens; os hashes abaixo são da conferência final.

| Arquivo | Linhas físicas | SHA-256 (prefixo) | Tratamento |
|---|---:|---|---|
| `sistema/backend/src/modules/uploads/uploads.service.ts` | 26 | `70f32574f3ab0c6f` | Fonte reclassificada; leitura dirigida e AST |
| `sistema/backend/src/modules/uploads/uploads.service.spec.ts` | 18 | `9516bca789ca1e1c` | Fonte reclassificada; leitura dirigida e AST |
| `sistema/backend/src/modules/uploads/uploads.module.ts` | 9 | `e452489229783518` | Fonte reclassificada; leitura dirigida e AST |
| `sistema/backend/src/modules/uploads/uploads.controller.ts` | 241 | `ba717afef24baf91` | Fonte reclassificada; leitura dirigida e AST |
| `sistema/backend/src/modules/uploads/uploads.controller.spec.ts` | 23 | `eeadb07d9ac105d6` | Fonte reclassificada; leitura dirigida e AST |
| `sistema/backend/src/modules/uploads/upload-bounds.spec.ts` | 48 | `9ba8139c6bb67d39` | Fonte reclassificada; leitura dirigida e AST |
| `sistema/backend/src/modules/checkout/abandoned-cart.scheduler.ts` | 76 | `3ac626b032ec9fd5` | Arquivo novo de outra sessão; leitura, AST e Jest |
| `sistema/backend/src/modules/checkout/abandoned-cart.scheduler.spec.ts` | 64 | `c73e81a3ca1f622f` | Arquivo novo de outra sessão; leitura, AST e Jest |

## Varredura sintática de fonte (AST TypeScript)

Conferência final ampliada: **603 arquivos, 111255 linhas (split por newline), 337 nós any e 3 diagnósticos de sintaxe**. Os três erros pertencem a ecosystem.config.js (F35). O recorte inicial de 533 arquivos/102243 linhas tinha zero erros; o posterior de 595 arquivos acrescentou configurações e scripts. O conjunto final corrige a exclusão de seis fontes de uploads e inclui dois arquivos novos.

Percurso de todos os nós, sem executar os programas. Ramificações contam if/case/ternário/catch, não complexidade ciclomática formal. Funções externas incluem nós de callbacks aninhados. Contagens de timers/listeners não implicam vazamento: cleanup foi revisado em fluxos selecionados, não demonstrado para todo o conjunto.

| Arquivo | Linhas | Funções | any | Ramificações | Timers | Listeners/subscrições | Erros de parse |
|---|---:|---:|---:|---:|---:|---:|---:|
| `Notificador/dorsal.js` | 138 | 8 | 0 | 6 | 0 | 0 | 0 |
| `Notificador/escalation.js` | 112 | 14 | 0 | 13 | 0 | 0 | 0 |
| `Notificador/escalation.test.js` | 128 | 10 | 0 | 0 | 0 | 0 | 0 |
| `Notificador/faturamento.js` | 94 | 1 | 0 | 6 | 0 | 0 | 0 |
| `Notificador/faturamento.test.js` | 103 | 23 | 0 | 1 | 0 | 0 | 0 |
| `Notificador/main.js` | 440 | 40 | 0 | 48 | 3 | 9 | 0 |
| `Notificador/preload.js` | 14 | 9 | 0 | 0 | 0 | 3 | 0 |
| `Notificador/renderer/renderer.js` | 94 | 7 | 0 | 11 | 0 | 1 | 0 |
| `Notificador/renderer/toast.js` | 27 | 3 | 0 | 0 | 0 | 1 | 0 |
| `scripts/ai-session-watcher/build-day-zero.js` | 143 | 9 | 0 | 21 | 0 | 0 | 0 |
| `scripts/ai-session-watcher/index.js` | 255 | 13 | 0 | 42 | 0 | 3 | 0 |
| `scripts/validate-obsidian-links.js` | 215 | 16 | 0 | 25 | 0 | 0 | 0 |
| `sistema/admin/.eslintrc.cjs` | 28 | 0 | 0 | 0 | 0 | 0 | 0 |
| `sistema/admin/cypress.config.ts` | 69 | 4 | 0 | 2 | 0 | 0 | 0 |
| `sistema/admin/cypress/e2e/alert-rules.cy.ts` | 183 | 13 | 0 | 1 | 0 | 0 | 0 |
| `sistema/admin/cypress/e2e/auto-insights.cy.ts` | 185 | 14 | 0 | 0 | 0 | 0 | 0 |
| `sistema/admin/cypress/e2e/brand-identity.cy.ts` | 113 | 9 | 0 | 0 | 0 | 0 | 0 |
| `sistema/admin/cypress/e2e/business-accounts.cy.ts` | 221 | 9 | 0 | 0 | 0 | 0 | 0 |
| `sistema/admin/cypress/e2e/business-hours.cy.ts` | 133 | 11 | 0 | 0 | 0 | 0 | 0 |
| `sistema/admin/cypress/e2e/catalog.cy.ts` | 317 | 20 | 0 | 0 | 0 | 0 | 0 |
| `sistema/admin/cypress/e2e/categories.cy.ts` | 296 | 18 | 0 | 1 | 0 | 0 | 0 |
| `sistema/admin/cypress/e2e/critical-flows.cy.ts` | 306 | 44 | 17 | 0 | 0 | 0 | 0 |
| `sistema/admin/cypress/e2e/customers.cy.ts` | 174 | 9 | 0 | 0 | 0 | 0 | 0 |
| `sistema/admin/cypress/e2e/dashboard.cy.ts` | 155 | 14 | 0 | 1 | 0 | 0 | 0 |
| `sistema/admin/cypress/e2e/delivery-zones.cy.ts` | 251 | 19 | 0 | 1 | 0 | 0 | 0 |
| `sistema/admin/cypress/e2e/executive-report.cy.ts` | 182 | 11 | 0 | 1 | 0 | 0 | 0 |
| `sistema/admin/cypress/e2e/fraud-audit.cy.ts` | 130 | 13 | 0 | 2 | 0 | 0 | 0 |
| `sistema/admin/cypress/e2e/integrations.cy.ts` | 157 | 11 | 0 | 0 | 0 | 0 | 0 |
| `sistema/admin/cypress/e2e/layout.cy.ts` | 283 | 21 | 0 | 0 | 0 | 0 | 0 |
| `sistema/admin/cypress/e2e/notifications-broadcast.cy.ts` | 136 | 12 | 0 | 0 | 0 | 0 | 0 |
| `sistema/admin/cypress/e2e/orders.cy.ts` | 249 | 18 | 0 | 0 | 0 | 0 | 0 |
| `sistema/admin/cypress/e2e/payment-events.cy.ts` | 178 | 10 | 0 | 1 | 0 | 0 | 0 |
| `sistema/admin/cypress/e2e/picking.cy.ts` | 300 | 14 | 0 | 0 | 0 | 0 | 0 |
| `sistema/admin/cypress/e2e/recipes.cy.ts` | 182 | 14 | 0 | 0 | 0 | 0 | 0 |
| `sistema/admin/cypress/e2e/search-insights.cy.ts` | 255 | 18 | 0 | 2 | 0 | 0 | 0 |
| `sistema/admin/cypress/e2e/smoke.cy.ts` | 94 | 8 | 0 | 0 | 0 | 0 | 0 |
| `sistema/admin/cypress/e2e/store-banners.cy.ts` | 162 | 12 | 0 | 0 | 0 | 0 | 0 |
| `sistema/admin/cypress/e2e/system-health.cy.ts` | 145 | 11 | 0 | 1 | 0 | 0 | 0 |
| `sistema/admin/cypress/e2e/ui-kit.cy.ts` | 125 | 6 | 0 | 0 | 0 | 0 | 0 |
| `sistema/admin/cypress/support/e2e.ts` | 87 | 3 | 0 | 28 | 0 | 0 | 0 |
| `sistema/admin/postcss.config.js` | 6 | 0 | 0 | 0 | 0 | 0 | 0 |
| `sistema/admin/src/App.tsx` | 46 | 7 | 0 | 0 | 0 | 0 | 0 |
| `sistema/admin/src/components/AlertRulesManager.tsx` | 366 | 22 | 0 | 14 | 0 | 0 | 0 |
| `sistema/admin/src/components/BICharts.tsx` | 380 | 32 | 0 | 13 | 0 | 0 | 0 |
| `sistema/admin/src/components/ChangelogModal.tsx` | 276 | 3 | 0 | 1 | 0 | 0 | 0 |
| `sistema/admin/src/components/ErrorBoundary.tsx` | 51 | 4 | 0 | 1 | 0 | 0 | 0 |
| `sistema/admin/src/components/ExecutiveReport.tsx` | 255 | 9 | 0 | 6 | 0 | 0 | 0 |
| `sistema/admin/src/components/FormElements.tsx` | 200 | 4 | 0 | 6 | 0 | 0 | 0 |
| `sistema/admin/src/components/LayoutManager.tsx` | 416 | 41 | 0 | 26 | 1 | 0 | 0 |
| `sistema/admin/src/components/NetworkToast.tsx` | 57 | 8 | 0 | 4 | 1 | 2 | 0 |
| `sistema/admin/src/components/PeriodComparison.tsx` | 71 | 2 | 0 | 5 | 0 | 0 | 0 |
| `sistema/admin/src/components/ProtectedRoute.tsx` | 26 | 1 | 0 | 3 | 0 | 0 | 0 |
| `sistema/admin/src/components/TopMenuBar.tsx` | 364 | 30 | 0 | 14 | 1 | 2 | 0 |
| `sistema/admin/src/components/ui/badge.tsx` | 31 | 1 | 0 | 0 | 0 | 0 | 0 |
| `sistema/admin/src/components/ui/button.tsx` | 48 | 1 | 0 | 1 | 0 | 0 | 0 |
| `sistema/admin/src/components/ui/card.tsx` | 31 | 5 | 0 | 0 | 0 | 0 | 0 |
| `sistema/admin/src/components/ui/checkbox.tsx` | 21 | 1 | 0 | 0 | 0 | 0 | 0 |
| `sistema/admin/src/components/ui/field-hint.tsx` | 55 | 7 | 0 | 1 | 0 | 0 | 0 |
| `sistema/admin/src/components/ui/input.tsx` | 21 | 1 | 0 | 0 | 0 | 0 | 0 |
| `sistema/admin/src/components/ui/label.tsx` | 17 | 1 | 0 | 0 | 0 | 0 | 0 |
| `sistema/admin/src/components/ui/select.tsx` | 22 | 1 | 0 | 0 | 0 | 0 | 0 |
| `sistema/admin/src/components/ui/switch.tsx` | 34 | 2 | 0 | 2 | 0 | 0 | 0 |
| `sistema/admin/src/components/ui/table.tsx` | 38 | 6 | 0 | 0 | 0 | 0 | 0 |
| `sistema/admin/src/components/ui/textarea.tsx` | 20 | 1 | 0 | 0 | 0 | 0 | 0 |
| `sistema/admin/src/hooks/useAuth.ts` | 47 | 4 | 0 | 3 | 0 | 0 | 0 |
| `sistema/admin/src/lib/utils.ts` | 7 | 1 | 0 | 0 | 0 | 0 | 0 |
| `sistema/admin/src/main.tsx` | 10 | 0 | 0 | 0 | 0 | 0 | 0 |
| `sistema/admin/src/pages/BrandIdentity.tsx` | 280 | 18 | 0 | 10 | 1 | 0 | 0 |
| `sistema/admin/src/pages/BusinessHours.tsx` | 233 | 27 | 0 | 9 | 1 | 0 | 0 |
| `sistema/admin/src/pages/CategoriesManager.tsx` | 1132 | 100 | 2 | 68 | 0 | 0 | 0 |
| `sistema/admin/src/pages/Dashboard.tsx` | 1423 | 128 | 12 | 115 | 4 | 0 | 0 |
| `sistema/admin/src/pages/DeliveryZones.tsx` | 1598 | 148 | 10 | 129 | 2 | 4 | 0 |
| `sistema/admin/src/pages/Forbidden.tsx` | 16 | 1 | 0 | 0 | 0 | 0 | 0 |
| `sistema/admin/src/pages/FraudAudit.tsx` | 153 | 9 | 0 | 9 | 0 | 0 | 0 |
| `sistema/admin/src/pages/Integrations.tsx` | 391 | 18 | 0 | 24 | 0 | 0 | 0 |
| `sistema/admin/src/pages/Intelligence.tsx` | 679 | 46 | 0 | 44 | 0 | 0 | 0 |
| `sistema/admin/src/pages/Login.tsx` | 98 | 4 | 1 | 1 | 0 | 0 | 0 |
| `sistema/admin/src/pages/NotFound.tsx` | 16 | 1 | 0 | 0 | 0 | 0 | 0 |
| `sistema/admin/src/pages/NotificationsBroadcast.tsx` | 423 | 34 | 0 | 18 | 0 | 0 | 0 |
| `sistema/admin/src/pages/Recipes.tsx` | 483 | 43 | 2 | 20 | 0 | 0 | 0 |
| `sistema/admin/src/pages/RedefinirSenha.tsx` | 163 | 10 | 0 | 7 | 1 | 0 | 0 |
| `sistema/admin/src/pages/StoreBannersManager.tsx` | 2248 | 151 | 3 | 120 | 2 | 1 | 0 |
| `sistema/admin/src/pages/SystemHealthWidget.tsx` | 133 | 11 | 0 | 11 | 1 | 0 | 0 |
| `sistema/admin/src/pages/sections/BusinessAccountsSection.tsx` | 721 | 71 | 0 | 49 | 0 | 0 | 0 |
| `sistema/admin/src/pages/sections/CustomersSection.tsx` | 753 | 65 | 0 | 49 | 0 | 1 | 0 |
| `sistema/admin/src/pages/sections/DashboardSection.tsx` | 479 | 24 | 0 | 24 | 0 | 0 | 0 |
| `sistema/admin/src/pages/sections/DeliveryRoutesSection.tsx` | 267 | 31 | 0 | 7 | 0 | 0 | 0 |
| `sistema/admin/src/pages/sections/IntelligenceAutoInsightsPanel.tsx` | 156 | 5 | 0 | 6 | 0 | 0 | 0 |
| `sistema/admin/src/pages/sections/IntelligenceSearchInsightsPanel.tsx` | 452 | 13 | 0 | 14 | 0 | 0 | 0 |
| `sistema/admin/src/pages/sections/OrdersSection.tsx` | 1271 | 89 | 0 | 86 | 1 | 3 | 0 |
| `sistema/admin/src/pages/sections/PaymentEventsSection.tsx` | 556 | 27 | 0 | 30 | 0 | 0 | 0 |
| `sistema/admin/src/pages/sections/PickingSection.tsx` | 818 | 86 | 0 | 70 | 1 | 0 | 0 |
| `sistema/admin/src/pages/sections/ProductSlideOver.tsx` | 762 | 61 | 4 | 38 | 1 | 1 | 0 |
| `sistema/admin/src/pages/sections/ProductsSection.tsx` | 1207 | 67 | 0 | 104 | 0 | 0 | 0 |
| `sistema/admin/src/pages/sections/SectionChrome.tsx` | 64 | 4 | 0 | 0 | 0 | 0 | 0 |
| `sistema/admin/src/pages/sections/StaffSection.tsx` | 471 | 54 | 2 | 44 | 1 | 0 | 0 |
| `sistema/admin/src/pages/sections/TeamPerformanceSection.tsx` | 211 | 15 | 0 | 7 | 0 | 0 | 0 |
| `sistema/admin/src/pages/types.ts` | 113 | 0 | 0 | 0 | 0 | 0 | 0 |
| `sistema/admin/src/services/api.ts` | 1711 | 192 | 12 | 26 | 1 | 0 | 0 |
| `sistema/admin/src/types/analytics.ts` | 33 | 0 | 0 | 0 | 0 | 0 | 0 |
| `sistema/admin/src/utils/bannerOverlay.ts` | 59 | 5 | 0 | 6 | 0 | 0 | 0 |
| `sistema/admin/src/utils/bannerRules.test.ts` | 48 | 8 | 0 | 0 | 0 | 0 | 0 |
| `sistema/admin/src/utils/bannerRules.ts` | 42 | 1 | 0 | 1 | 0 | 0 | 0 |
| `sistema/admin/src/vite-env.d.ts` | 5 | 0 | 0 | 0 | 0 | 0 | 0 |
| `sistema/admin/tailwind.config.js` | 94 | 0 | 0 | 0 | 0 | 0 | 0 |
| `sistema/admin/vite.config.ts` | 41 | 0 | 0 | 0 | 0 | 0 | 0 |
| `sistema/backend/.eslintrc.cjs` | 22 | 0 | 0 | 0 | 0 | 0 | 0 |
| `sistema/backend/count_categories.js` | 13 | 2 | 0 | 0 | 0 | 0 | 0 |
| `sistema/backend/prisma/seed.ts` | 198 | 8 | 0 | 6 | 0 | 0 | 0 |
| `sistema/backend/reindex-search.js` | 64 | 2 | 0 | 1 | 0 | 0 | 0 |
| `sistema/backend/scripts/apply-category-mappings.ts` | 171 | 13 | 0 | 4 | 0 | 0 | 0 |
| `sistema/backend/scripts/apply-reframed-preview.ts` | 78 | 11 | 0 | 7 | 0 | 0 | 0 |
| `sistema/backend/scripts/audit-auto-bank-publications.ts` | 33 | 3 | 0 | 2 | 0 | 0 | 0 |
| `sistema/backend/scripts/audit-published-framing.ts` | 130 | 9 | 0 | 19 | 0 | 0 | 0 |
| `sistema/backend/scripts/audit-sync-option.js` | 52 | 3 | 0 | 4 | 0 | 0 | 0 |
| `sistema/backend/scripts/auto-publish-bank-suggestions.ts` | 193 | 10 | 0 | 38 | 0 | 0 | 0 |
| `sistema/backend/scripts/build-photo-queue.ts` | 80 | 9 | 0 | 6 | 0 | 0 | 0 |
| `sistema/backend/scripts/build-photo-recollect-queues.ts` | 93 | 12 | 4 | 11 | 0 | 0 | 0 |
| `sistema/backend/scripts/carrefour-cdp-proof.ts` | 78 | 10 | 0 | 4 | 1 | 3 | 0 |
| `sistema/backend/scripts/collect-carrefour-candidates.ts` | 296 | 35 | 0 | 30 | 2 | 3 | 0 |
| `sistema/backend/scripts/collect-cosmos-candidates.ts` | 132 | 17 | 0 | 13 | 1 | 0 | 0 |
| `sistema/backend/scripts/collect-google-candidates.ts` | 221 | 49 | 0 | 32 | 2 | 3 | 0 |
| `sistema/backend/scripts/collect-photo-source-bank.ts` | 282 | 41 | 2 | 38 | 3 | 0 | 0 |
| `sistema/backend/scripts/deduplicate-products.ts` | 173 | 26 | 9 | 9 | 0 | 0 | 0 |
| `sistema/backend/scripts/do-sync.js` | 57 | 6 | 0 | 7 | 0 | 0 | 0 |
| `sistema/backend/scripts/do-sync.ts` | 76 | 4 | 0 | 5 | 0 | 0 | 0 |
| `sistema/backend/scripts/google-cdp-inspect.ts` | 47 | 13 | 0 | 6 | 3 | 3 | 0 |
| `sistema/backend/scripts/handoff-apply.js` | 342 | 12 | 0 | 30 | 0 | 0 | 0 |
| `sistema/backend/scripts/handoff-dry-run.js` | 265 | 9 | 0 | 17 | 0 | 0 | 0 |
| `sistema/backend/scripts/import-ibge-cnefe.ts` | 145 | 6 | 0 | 12 | 0 | 0 | 0 |
| `sistema/backend/scripts/import-luna-local-candidates.ts` | 56 | 12 | 4 | 7 | 0 | 0 | 0 |
| `sistema/backend/scripts/index-photo-source-bank.ts` | 60 | 9 | 0 | 6 | 0 | 0 | 0 |
| `sistema/backend/scripts/make-audit-sheets.ts` | 45 | 10 | 0 | 3 | 0 | 0 | 0 |
| `sistema/backend/scripts/make-candidate-sheets.ts` | 41 | 5 | 0 | 1 | 0 | 0 | 0 |
| `sistema/backend/scripts/make-folder-sheets.ts` | 39 | 9 | 0 | 2 | 0 | 0 | 0 |
| `sistema/backend/scripts/match-photo-source-bank.ts` | 181 | 36 | 0 | 17 | 0 | 0 | 0 |
| `sistema/backend/scripts/match-photos.ts` | 251 | 31 | 0 | 16 | 0 | 0 | 0 |
| `sistema/backend/scripts/merge-google-worker-results.ts` | 57 | 8 | 0 | 9 | 0 | 0 | 0 |
| `sistema/backend/scripts/migrate-legacy-banners-to-storebanner.ts` | 85 | 4 | 0 | 3 | 0 | 0 | 0 |
| `sistema/backend/scripts/optimize-banner-templates.js` | 101 | 3 | 0 | 4 | 0 | 0 | 0 |
| `sistema/backend/scripts/photo-bank-compatibility.ts` | 121 | 10 | 0 | 6 | 0 | 0 | 0 |
| `sistema/backend/scripts/photo-frame.ts` | 327 | 20 | 0 | 22 | 0 | 0 | 0 |
| `sistema/backend/scripts/photo-safety.ts` | 53 | 5 | 0 | 2 | 0 | 0 | 0 |
| `sistema/backend/scripts/photo-source-priority.ts` | 35 | 2 | 0 | 0 | 0 | 0 | 0 |
| `sistema/backend/scripts/prepare-google-worker-queues.ts` | 38 | 9 | 0 | 3 | 0 | 0 | 0 |
| `sistema/backend/scripts/process-photo-queue.ts` | 68 | 9 | 0 | 8 | 0 | 0 | 0 |
| `sistema/backend/scripts/prune-low-resolution-source-bank.ts` | 36 | 2 | 0 | 4 | 0 | 0 | 0 |
| `sistema/backend/scripts/publish-approved-bank-suggestions.ts` | 65 | 9 | 0 | 13 | 0 | 0 | 0 |
| `sistema/backend/scripts/publish-approved-carrefour-candidates.ts` | 143 | 30 | 0 | 31 | 0 | 0 | 0 |
| `sistema/backend/scripts/publish-external-photo-candidates.ts` | 78 | 15 | 0 | 16 | 0 | 0 | 0 |
| `sistema/backend/scripts/recover-missing-bank-sources.ts` | 84 | 13 | 0 | 11 | 0 | 0 | 0 |
| `sistema/backend/scripts/reframe-audit-flagged.ts` | 109 | 10 | 0 | 25 | 0 | 0 | 0 |
| `sistema/backend/scripts/reframe-published-photos.ts` | 56 | 6 | 0 | 5 | 0 | 0 | 0 |
| `sistema/backend/scripts/register-external-photo-candidate.ts` | 35 | 6 | 0 | 7 | 0 | 0 | 0 |
| `sistema/backend/scripts/search-browser-photo-queue.ts` | 986 | 107 | 4 | 156 | 3 | 8 | 0 |
| `sistema/backend/scripts/search-web-photo-queue.ts` | 336 | 35 | 2 | 48 | 1 | 1 | 0 |
| `sistema/backend/scripts/seed-banner-templates.js` | 292 | 11 | 0 | 7 | 0 | 0 | 0 |
| `sistema/backend/scripts/seed-cms-categories.ts` | 60 | 4 | 0 | 1 | 0 | 0 | 0 |
| `sistema/backend/scripts/seed-delivery-zones.ts` | 132 | 10 | 0 | 3 | 0 | 0 | 0 |
| `sistema/backend/scripts/seed-qa.ts` | 144 | 3 | 0 | 1 | 0 | 0 | 0 |
| `sistema/backend/scripts/seed-staging-admin.js` | 37 | 1 | 0 | 2 | 0 | 0 | 0 |
| `sistema/backend/scripts/seed-staging-recipes.js` | 403 | 19 | 0 | 7 | 0 | 0 | 0 |
| `sistema/backend/scripts/seed-test-orders.js` | 101 | 6 | 0 | 4 | 0 | 0 | 0 |
| `sistema/backend/scripts/validate-bi-analytics-foundation.js` | 63 | 8 | 0 | 2 | 0 | 0 | 0 |
| `sistema/backend/scripts/validate-catalog-foundation.js` | 41 | 3 | 0 | 5 | 0 | 0 | 0 |
| `sistema/backend/scripts/validate-checkout-foundation.js` | 76 | 7 | 0 | 2 | 0 | 0 | 0 |
| `sistema/backend/scripts/validate-crm-loyalty-foundation.js` | 76 | 7 | 0 | 2 | 0 | 0 | 0 |
| `sistema/backend/scripts/validate-fulfillment-foundation.js` | 74 | 7 | 0 | 2 | 0 | 0 | 0 |
| `sistema/backend/scripts/validate-integration-outbox-foundation.js` | 149 | 10 | 0 | 3 | 0 | 0 | 0 |
| `sistema/backend/scripts/validate-inventory-foundation.js` | 67 | 4 | 0 | 5 | 0 | 0 | 0 |
| `sistema/backend/scripts/validate-lgpd-governance-foundation.js` | 73 | 8 | 0 | 2 | 0 | 0 | 0 |
| `sistema/backend/scripts/validate-marketplace-foundation.js` | 69 | 8 | 0 | 2 | 0 | 0 | 0 |
| `sistema/backend/scripts/validate-observability-sre-foundation.js` | 40 | 1 | 0 | 2 | 0 | 0 | 0 |
| `sistema/backend/scripts/validate-oms-foundation.js` | 74 | 7 | 0 | 2 | 0 | 0 | 0 |
| `sistema/backend/scripts/validate-payments-foundation.js` | 131 | 10 | 0 | 3 | 0 | 0 | 0 |
| `sistema/backend/scripts/validate-pending-contract.js` | 68 | 4 | 0 | 2 | 0 | 0 | 0 |
| `sistema/backend/scripts/validate-picking-foundation.js` | 68 | 7 | 0 | 2 | 0 | 0 | 0 |
| `sistema/backend/scripts/validate-pricing-foundation.js` | 54 | 4 | 0 | 4 | 0 | 0 | 0 |
| `sistema/backend/scripts/validate-public-api-foundation.js` | 114 | 7 | 0 | 2 | 0 | 0 | 0 |
| `sistema/backend/scripts/validate-recommendation-foundation.js` | 77 | 8 | 0 | 2 | 0 | 0 | 0 |
| `sistema/backend/scripts/validate-staging-recipes.js` | 177 | 10 | 0 | 17 | 0 | 0 | 0 |
| `sistema/backend/scripts/validate-tenant-store-backfill.js` | 85 | 3 | 0 | 4 | 0 | 0 | 0 |
| `sistema/backend/src/app.module.ts` | 141 | 3 | 0 | 0 | 0 | 0 | 0 |
| `sistema/backend/src/common/date-range.util.ts` | 12 | 1 | 0 | 3 | 0 | 0 | 0 |
| `sistema/backend/src/common/decorators/current-store.decorator.ts` | 8 | 1 | 0 | 0 | 0 | 0 | 0 |
| `sistema/backend/src/common/decorators/current-tenant.decorator.ts` | 8 | 1 | 0 | 0 | 0 | 0 | 0 |
| `sistema/backend/src/common/decorators/relaxed-throttle.decorator.ts` | 20 | 1 | 0 | 0 | 0 | 0 | 0 |
| `sistema/backend/src/common/decorators/require-api-scope.decorator.ts` | 5 | 1 | 0 | 0 | 0 | 0 | 0 |
| `sistema/backend/src/common/decorators/require-module.decorator.ts` | 7 | 1 | 0 | 0 | 0 | 0 | 0 |
| `sistema/backend/src/common/decorators/require-permission.decorator.ts` | 5 | 1 | 0 | 0 | 0 | 0 | 0 |
| `sistema/backend/src/common/decorators/roles.decorator.ts` | 5 | 1 | 0 | 0 | 0 | 0 | 0 |
| `sistema/backend/src/common/fractional.util.ts` | 29 | 1 | 0 | 2 | 0 | 0 | 0 |
| `sistema/backend/src/common/guards/jwt-auth.guard.ts` | 6 | 0 | 0 | 0 | 0 | 0 | 0 |
| `sistema/backend/src/common/guards/module-access.guard.ts` | 28 | 2 | 0 | 4 | 0 | 0 | 0 |
| `sistema/backend/src/common/guards/permission.guard.spec.ts` | 56 | 9 | 6 | 0 | 0 | 0 | 0 |
| `sistema/backend/src/common/guards/permission.guard.ts` | 86 | 5 | 0 | 5 | 0 | 0 | 0 |
| `sistema/backend/src/common/guards/public-api-key.guard.ts` | 34 | 2 | 0 | 1 | 0 | 0 | 0 |
| `sistema/backend/src/common/guards/roles.guard.ts` | 32 | 3 | 0 | 2 | 0 | 0 | 0 |
| `sistema/backend/src/common/guards/tenant-access.guard.spec.ts` | 50 | 8 | 4 | 1 | 0 | 0 | 0 |
| `sistema/backend/src/common/guards/tenant-access.guard.ts` | 26 | 1 | 0 | 2 | 0 | 0 | 0 |
| `sistema/backend/src/common/interceptors/http-logging.interceptor.ts` | 64 | 4 | 4 | 0 | 0 | 0 | 0 |
| `sistema/backend/src/common/logger.ts` | 27 | 0 | 0 | 1 | 0 | 0 | 0 |
| `sistema/backend/src/common/nest-winston-logger.spec.ts` | 54 | 9 | 0 | 0 | 0 | 0 | 0 |
| `sistema/backend/src/common/nest-winston-logger.ts` | 89 | 9 | 0 | 7 | 0 | 0 | 0 |
| `sistema/backend/src/common/observability/metrics-registry.ts` | 81 | 11 | 0 | 3 | 0 | 0 | 0 |
| `sistema/backend/src/common/observability/request-context.middleware.ts` | 48 | 3 | 0 | 5 | 0 | 0 | 0 |
| `sistema/backend/src/common/order-reconciliation.spec.ts` | 160 | 18 | 0 | 0 | 0 | 0 | 0 |
| `sistema/backend/src/common/order-reconciliation.ts` | 204 | 11 | 0 | 10 | 0 | 0 | 0 |
| `sistema/backend/src/common/prisma.service.ts` | 9 | 1 | 0 | 0 | 0 | 0 | 0 |
| `sistema/backend/src/common/product-availability.spec.ts` | 43 | 8 | 0 | 0 | 0 | 0 | 0 |
| `sistema/backend/src/common/product-availability.ts` | 36 | 1 | 0 | 3 | 0 | 0 | 0 |
| `sistema/backend/src/common/require-env.spec.ts` | 44 | 11 | 0 | 0 | 0 | 0 | 0 |
| `sistema/backend/src/common/require-env.ts` | 27 | 1 | 0 | 1 | 0 | 0 | 0 |
| `sistema/backend/src/common/security/customer-ownership.ts` | 20 | 2 | 0 | 2 | 0 | 0 | 0 |
| `sistema/backend/src/common/security/jwt-secret.ts` | 18 | 1 | 0 | 2 | 0 | 0 | 0 |
| `sistema/backend/src/common/services/retry.service.ts` | 57 | 4 | 0 | 2 | 1 | 0 | 0 |
| `sistema/backend/src/common/services/uploads.service.ts` | 71 | 7 | 0 | 7 | 0 | 0 | 0 |
| `sistema/backend/src/common/services/via-cep.service.ts` | 31 | 1 | 0 | 3 | 0 | 0 | 0 |
| `sistema/backend/src/common/strategies/jwt.strategy.spec.ts` | 65 | 10 | 0 | 0 | 0 | 0 | 0 |
| `sistema/backend/src/common/strategies/jwt.strategy.ts` | 91 | 3 | 0 | 8 | 0 | 0 | 0 |
| `sistema/backend/src/common/tenant/tenant-context.middleware.spec.ts` | 44 | 4 | 5 | 0 | 0 | 0 | 0 |
| `sistema/backend/src/common/tenant/tenant-context.middleware.ts` | 89 | 7 | 0 | 12 | 0 | 0 | 0 |
| `sistema/backend/src/common/tenant/tenant-context.ts` | 58 | 4 | 0 | 3 | 0 | 0 | 0 |
| `sistema/backend/src/common/tenant/tenant.constants.ts` | 32 | 0 | 0 | 0 | 0 | 0 | 0 |
| `sistema/backend/src/main.ts` | 118 | 6 | 0 | 2 | 0 | 0 | 0 |
| `sistema/backend/src/modules/addresses/addresses.controller.spec.ts` | 119 | 11 | 0 | 0 | 0 | 0 | 0 |
| `sistema/backend/src/modules/addresses/addresses.controller.ts` | 144 | 7 | 0 | 0 | 0 | 0 | 0 |
| `sistema/backend/src/modules/addresses/addresses.module.ts` | 12 | 0 | 0 | 0 | 0 | 0 | 0 |
| `sistema/backend/src/modules/addresses/addresses.service.spec.ts` | 309 | 25 | 3 | 0 | 0 | 0 | 0 |
| `sistema/backend/src/modules/addresses/addresses.service.ts` | 163 | 14 | 2 | 17 | 0 | 0 | 0 |
| `sistema/backend/src/modules/analytics/alert-rule.service.ts` | 187 | 11 | 0 | 6 | 0 | 0 | 0 |
| `sistema/backend/src/modules/analytics/analytics.controller.ts` | 266 | 23 | 1 | 5 | 0 | 0 | 0 |
| `sistema/backend/src/modules/analytics/analytics.module.ts` | 14 | 0 | 0 | 0 | 0 | 0 | 0 |
| `sistema/backend/src/modules/analytics/analytics.service.spec.ts` | 190 | 5 | 1 | 0 | 0 | 0 | 0 |
| `sistema/backend/src/modules/analytics/analytics.service.ts` | 1001 | 93 | 11 | 85 | 0 | 0 | 0 |
| `sistema/backend/src/modules/analytics/executive-report.service.ts` | 286 | 15 | 0 | 16 | 0 | 0 | 0 |
| `sistema/backend/src/modules/audit-log/audit-log.module.ts` | 11 | 0 | 0 | 0 | 0 | 0 | 0 |
| `sistema/backend/src/modules/audit-log/audit-log.service.ts` | 37 | 3 | 0 | 1 | 0 | 0 | 0 |
| `sistema/backend/src/modules/auth/auth.controller.ts` | 265 | 15 | 2 | 1 | 0 | 0 | 0 |
| `sistema/backend/src/modules/auth/auth.module.ts` | 25 | 0 | 0 | 0 | 0 | 0 | 0 |
| `sistema/backend/src/modules/auth/auth.service.ts` | 639 | 24 | 0 | 45 | 0 | 0 | 0 |
| `sistema/backend/src/modules/auth/customer-set-password.spec.ts` | 65 | 7 | 0 | 0 | 0 | 0 | 0 |
| `sistema/backend/src/modules/auth/customer-token-ttl.spec.ts` | 66 | 5 | 0 | 0 | 0 | 0 | 0 |
| `sistema/backend/src/modules/auth/dto/create-admin.dto.ts` | 63 | 0 | 0 | 0 | 0 | 0 | 0 |
| `sistema/backend/src/modules/auth/dto/create-customer-register.dto.ts` | 25 | 0 | 0 | 0 | 0 | 0 | 0 |
| `sistema/backend/src/modules/auth/dto/create-guest-checkout.dto.ts` | 17 | 0 | 0 | 0 | 0 | 0 | 0 |
| `sistema/backend/src/modules/auth/dto/forgot-password.dto.ts` | 27 | 0 | 0 | 0 | 0 | 0 | 0 |
| `sistema/backend/src/modules/auth/dto/login.dto.ts` | 28 | 0 | 0 | 0 | 0 | 0 | 0 |
| `sistema/backend/src/modules/brand/brand.controller.ts` | 31 | 3 | 0 | 0 | 0 | 0 | 0 |
| `sistema/backend/src/modules/brand/brand.module.ts` | 12 | 0 | 0 | 0 | 0 | 0 | 0 |
| `sistema/backend/src/modules/brand/brand.service.ts` | 90 | 3 | 0 | 0 | 0 | 0 | 0 |
| `sistema/backend/src/modules/business/business.controller.ts` | 91 | 15 | 6 | 12 | 0 | 0 | 0 |
| `sistema/backend/src/modules/business/business.module.ts` | 16 | 0 | 0 | 0 | 0 | 0 | 0 |
| `sistema/backend/src/modules/business/business.service.ts` | 450 | 32 | 11 | 35 | 0 | 0 | 0 |
| `sistema/backend/src/modules/catalog/catalog.controller.ts` | 83 | 8 | 0 | 4 | 0 | 0 | 0 |
| `sistema/backend/src/modules/catalog/catalog.module.ts` | 16 | 0 | 0 | 0 | 0 | 0 | 0 |
| `sistema/backend/src/modules/catalog/catalog.service.spec.ts` | 109 | 5 | 2 | 0 | 0 | 0 | 0 |
| `sistema/backend/src/modules/catalog/catalog.service.ts` | 330 | 29 | 2 | 25 | 0 | 0 | 0 |
| `sistema/backend/src/modules/categories/admin-categories.controller.ts` | 280 | 17 | 0 | 4 | 0 | 0 | 0 |
| `sistema/backend/src/modules/categories/categories.controller.ts` | 164 | 9 | 0 | 1 | 0 | 0 | 0 |
| `sistema/backend/src/modules/categories/categories.module.ts` | 15 | 0 | 0 | 0 | 0 | 0 | 0 |
| `sistema/backend/src/modules/categories/category-hierarchy.service.ts` | 1421 | 81 | 4 | 82 | 0 | 0 | 0 |
| `sistema/backend/src/modules/checkout/cart.controller.ts` | 42 | 6 | 0 | 5 | 0 | 0 | 0 |
| `sistema/backend/src/modules/checkout/cart.service.ts` | 304 | 17 | 0 | 15 | 0 | 0 | 0 |
| `sistema/backend/src/modules/checkout/checkout.controller.ts` | 58 | 7 | 0 | 5 | 0 | 0 | 0 |
| `sistema/backend/src/modules/checkout/checkout.module.ts` | 22 | 0 | 0 | 0 | 0 | 0 | 0 |
| `sistema/backend/src/modules/checkout/checkout.service.spec.ts` | 399 | 17 | 8 | 3 | 0 | 0 | 0 |
| `sistema/backend/src/modules/checkout/checkout.service.ts` | 793 | 47 | 0 | 60 | 0 | 0 | 0 |
| `sistema/backend/src/modules/checkout/dto/cart.dto.ts` | 52 | 4 | 0 | 0 | 0 | 0 | 0 |
| `sistema/backend/src/modules/checkout/dto/checkout.dto.ts` | 118 | 4 | 0 | 0 | 0 | 0 | 0 |
| `sistema/backend/src/modules/cms/categories/categories.controller.spec.ts` | 31 | 3 | 0 | 0 | 0 | 0 | 0 |
| `sistema/backend/src/modules/cms/categories/categories.controller.ts` | 67 | 9 | 0 | 0 | 0 | 0 | 0 |
| `sistema/backend/src/modules/cms/categories/categories.module.ts` | 11 | 0 | 0 | 0 | 0 | 0 | 0 |
| `sistema/backend/src/modules/cms/categories/categories.service.spec.ts` | 33 | 3 | 0 | 0 | 0 | 0 | 0 |
| `sistema/backend/src/modules/cms/categories/categories.service.ts` | 560 | 42 | 1 | 29 | 0 | 0 | 0 |
| `sistema/backend/src/modules/cms/cms.module.ts` | 11 | 0 | 0 | 0 | 0 | 0 | 0 |
| `sistema/backend/src/modules/cms/hero-slides/hero-slides.controller.spec.ts` | 31 | 3 | 0 | 0 | 0 | 0 | 0 |
| `sistema/backend/src/modules/cms/hero-slides/hero-slides.controller.ts` | 44 | 5 | 0 | 1 | 0 | 0 | 0 |
| `sistema/backend/src/modules/cms/hero-slides/hero-slides.module.ts` | 11 | 0 | 0 | 0 | 0 | 0 | 0 |
| `sistema/backend/src/modules/cms/hero-slides/hero-slides.service.spec.ts` | 33 | 3 | 0 | 0 | 0 | 0 | 0 |
| `sistema/backend/src/modules/cms/hero-slides/hero-slides.service.ts` | 74 | 10 | 0 | 2 | 0 | 0 | 0 |
| `sistema/backend/src/modules/cms/promo-banners/promo-banners.controller.ts` | 82 | 6 | 0 | 0 | 0 | 0 | 0 |
| `sistema/backend/src/modules/cms/promo-banners/promo-banners.module.ts` | 11 | 0 | 0 | 0 | 0 | 0 | 0 |
| `sistema/backend/src/modules/cms/promo-banners/promo-banners.service.ts` | 214 | 15 | 0 | 6 | 0 | 0 | 0 |
| `sistema/backend/src/modules/cms/store-banners/banner-link.ts` | 66 | 4 | 0 | 10 | 0 | 0 | 0 |
| `sistema/backend/src/modules/cms/store-banners/store-banners.controller.ts` | 79 | 9 | 0 | 0 | 0 | 0 | 0 |
| `sistema/backend/src/modules/cms/store-banners/store-banners.module.ts` | 12 | 0 | 0 | 0 | 0 | 0 | 0 |
| `sistema/backend/src/modules/cms/store-banners/store-banners.service.spec.ts` | 191 | 32 | 0 | 0 | 0 | 0 | 0 |
| `sistema/backend/src/modules/cms/store-banners/store-banners.service.ts` | 298 | 25 | 0 | 40 | 0 | 0 | 0 |
| `sistema/backend/src/modules/coupons/coupons.controller.ts` | 34 | 3 | 0 | 0 | 0 | 0 | 0 |
| `sistema/backend/src/modules/coupons/coupons.module.ts` | 13 | 0 | 0 | 0 | 0 | 0 | 0 |
| `sistema/backend/src/modules/coupons/coupons.service.spec.ts` | 32 | 4 | 0 | 0 | 0 | 0 | 0 |
| `sistema/backend/src/modules/coupons/coupons.service.ts` | 19 | 2 | 0 | 0 | 0 | 0 | 0 |
| `sistema/backend/src/modules/crm/crm.controller.ts` | 110 | 13 | 5 | 2 | 0 | 0 | 0 |
| `sistema/backend/src/modules/crm/crm.module.ts` | 12 | 0 | 0 | 0 | 0 | 0 | 0 |
| `sistema/backend/src/modules/crm/crm.service.spec.ts` | 189 | 9 | 2 | 0 | 0 | 0 | 0 |
| `sistema/backend/src/modules/crm/crm.service.ts` | 415 | 40 | 0 | 30 | 0 | 0 | 0 |
| `sistema/backend/src/modules/crm/dto/crm.dto.ts` | 117 | 0 | 0 | 0 | 0 | 0 | 0 |
| `sistema/backend/src/modules/customers/customers-push-info.spec.ts` | 73 | 7 | 0 | 0 | 0 | 0 | 0 |
| `sistema/backend/src/modules/customers/customers.controller.ts` | 159 | 9 | 0 | 1 | 0 | 0 | 0 |
| `sistema/backend/src/modules/customers/customers.module.ts` | 14 | 0 | 0 | 0 | 0 | 0 | 0 |
| `sistema/backend/src/modules/customers/customers.service.ts` | 191 | 18 | 0 | 9 | 0 | 0 | 0 |
| `sistema/backend/src/modules/customers/dto/create-customer.dto.ts` | 17 | 0 | 0 | 0 | 0 | 0 | 0 |
| `sistema/backend/src/modules/data-privacy/data-privacy.controller.ts` | 66 | 7 | 7 | 0 | 0 | 0 | 0 |
| `sistema/backend/src/modules/data-privacy/data-privacy.module.ts` | 14 | 0 | 0 | 0 | 0 | 0 | 0 |
| `sistema/backend/src/modules/data-privacy/data-privacy.service.spec.ts` | 122 | 7 | 3 | 0 | 0 | 0 | 0 |
| `sistema/backend/src/modules/data-privacy/data-privacy.service.ts` | 280 | 15 | 3 | 10 | 0 | 0 | 0 |
| `sistema/backend/src/modules/delivery/delivery.controller.ts` | 263 | 28 | 0 | 3 | 0 | 0 | 0 |
| `sistema/backend/src/modules/delivery/delivery.module.ts` | 17 | 0 | 0 | 0 | 0 | 0 | 0 |
| `sistema/backend/src/modules/delivery/delivery.service.spec.ts` | 441 | 25 | 3 | 0 | 0 | 0 | 0 |
| `sistema/backend/src/modules/delivery/delivery.service.ts` | 1357 | 76 | 0 | 135 | 0 | 0 | 0 |
| `sistema/backend/src/modules/delivery/driver.controller.ts` | 143 | 11 | 2 | 2 | 0 | 0 | 0 |
| `sistema/backend/src/modules/delivery/dto/delivery-zone.dto.ts` | 99 | 0 | 0 | 0 | 0 | 0 | 0 |
| `sistema/backend/src/modules/delivery/dto/fulfillment.dto.ts` | 135 | 9 | 0 | 0 | 0 | 0 | 0 |
| `sistema/backend/src/modules/delivery/dto/ibge-address.dto.ts` | 18 | 3 | 0 | 0 | 0 | 0 | 0 |
| `sistema/backend/src/modules/delivery/ibge-address.service.ts` | 83 | 6 | 0 | 6 | 0 | 0 | 0 |
| `sistema/backend/src/modules/delivery/route-status-sync.spec.ts` | 90 | 12 | 0 | 0 | 0 | 0 | 0 |
| `sistema/backend/src/modules/delivery/slot-asap.spec.ts` | 82 | 8 | 0 | 0 | 0 | 0 | 0 |
| `sistema/backend/src/modules/delivery/take-delivery.spec.ts` | 104 | 12 | 0 | 1 | 0 | 0 | 0 |
| `sistema/backend/src/modules/integrations/antenor-api-catalog-and-orders.spec.ts` | 166 | 14 | 0 | 0 | 0 | 0 | 0 |
| `sistema/backend/src/modules/integrations/antenor-api-fidelidade-nfe.spec.ts` | 59 | 9 | 0 | 0 | 0 | 0 | 0 |
| `sistema/backend/src/modules/integrations/antenor-api-webhook.guard.ts` | 44 | 1 | 0 | 4 | 0 | 0 | 0 |
| `sistema/backend/src/modules/integrations/antenor-api-webhook.spec.ts` | 121 | 21 | 0 | 0 | 0 | 0 | 0 |
| `sistema/backend/src/modules/integrations/antenor-api.service.spec.ts` | 84 | 12 | 0 | 0 | 0 | 0 | 0 |
| `sistema/backend/src/modules/integrations/antenor-api.service.ts` | 555 | 22 | 0 | 59 | 0 | 0 | 0 |
| `sistema/backend/src/modules/integrations/dto/charge-contract.dto.ts` | 26 | 0 | 0 | 0 | 0 | 0 | 0 |
| `sistema/backend/src/modules/integrations/dto/crm-contact.dto.ts` | 29 | 0 | 0 | 0 | 0 | 0 | 0 |
| `sistema/backend/src/modules/integrations/dto/fiscal-document.dto.ts` | 35 | 0 | 0 | 0 | 0 | 0 | 0 |
| `sistema/backend/src/modules/integrations/dto/integration-outbox.dto.ts` | 67 | 0 | 0 | 0 | 0 | 0 | 0 |
| `sistema/backend/src/modules/integrations/dto/order-contract.dto.ts` | 67 | 0 | 0 | 0 | 0 | 0 | 0 |
| `sistema/backend/src/modules/integrations/dto/payment-ledger.dto.ts` | 111 | 1 | 0 | 0 | 0 | 0 | 0 |
| `sistema/backend/src/modules/integrations/dto/solidcom-order.dto.ts` | 56 | 0 | 0 | 0 | 0 | 0 | 0 |
| `sistema/backend/src/modules/integrations/health.controller.ts` | 183 | 14 | 0 | 15 | 1 | 3 | 0 |
| `sistema/backend/src/modules/integrations/hubspot.service.ts` | 107 | 6 | 0 | 6 | 0 | 0 | 0 |
| `sistema/backend/src/modules/integrations/integration-modules.service.ts` | 174 | 8 | 0 | 7 | 0 | 0 | 0 |
| `sistema/backend/src/modules/integrations/integration-outbox.service.spec.ts` | 209 | 9 | 0 | 0 | 0 | 0 | 0 |
| `sistema/backend/src/modules/integrations/integration-outbox.service.ts` | 550 | 24 | 0 | 31 | 0 | 0 | 0 |
| `sistema/backend/src/modules/integrations/integrations.controller.ts` | 784 | 49 | 0 | 12 | 0 | 0 | 0 |
| `sistema/backend/src/modules/integrations/integrations.module.ts` | 59 | 0 | 0 | 0 | 0 | 0 | 0 |
| `sistema/backend/src/modules/integrations/integrations.service.spec.ts` | 413 | 17 | 0 | 1 | 0 | 0 | 0 |
| `sistema/backend/src/modules/integrations/integrations.service.ts` | 811 | 46 | 0 | 42 | 0 | 0 | 0 |
| `sistema/backend/src/modules/integrations/mark-invoiced.spec.ts` | 131 | 12 | 0 | 0 | 0 | 0 | 0 |
| `sistema/backend/src/modules/integrations/nfe.service.ts` | 94 | 7 | 0 | 4 | 0 | 0 | 0 |
| `sistema/backend/src/modules/integrations/order-orchestration.service.spec.ts` | 854 | 47 | 3 | 0 | 0 | 0 | 0 |
| `sistema/backend/src/modules/integrations/order-orchestration.service.ts` | 1184 | 46 | 0 | 71 | 0 | 0 | 0 |
| `sistema/backend/src/modules/integrations/payments-ledger.service.spec.ts` | 167 | 9 | 0 | 0 | 0 | 0 | 0 |
| `sistema/backend/src/modules/integrations/payments-ledger.service.ts` | 537 | 28 | 0 | 47 | 0 | 0 | 0 |
| `sistema/backend/src/modules/integrations/payments-webhook.service.spec.ts` | 278 | 25 | 0 | 1 | 0 | 0 | 0 |
| `sistema/backend/src/modules/integrations/payments-webhook.service.ts` | 311 | 12 | 0 | 15 | 0 | 0 | 0 |
| `sistema/backend/src/modules/integrations/payments.service.ts` | 79 | 5 | 0 | 3 | 0 | 0 | 0 |
| `sistema/backend/src/modules/integrations/pdv-cancellation.scheduler.spec.ts` | 138 | 14 | 0 | 0 | 1 | 0 | 0 |
| `sistema/backend/src/modules/integrations/pdv-cancellation.scheduler.ts` | 105 | 2 | 0 | 9 | 0 | 0 | 0 |
| `sistema/backend/src/modules/integrations/pedido-obs.spec.ts` | 68 | 12 | 0 | 0 | 0 | 0 | 0 |
| `sistema/backend/src/modules/integrations/solidcom-erp.service.spec.ts` | 59 | 6 | 0 | 0 | 0 | 0 | 0 |
| `sistema/backend/src/modules/integrations/solidcom-erp.service.ts` | 523 | 28 | 0 | 65 | 0 | 0 | 0 |
| `sistema/backend/src/modules/integrations/webhook.guard.ts` | 28 | 2 | 0 | 2 | 0 | 0 | 0 |
| `sistema/backend/src/modules/inventory/inventory.controller.ts` | 127 | 14 | 0 | 10 | 0 | 0 | 0 |
| `sistema/backend/src/modules/inventory/inventory.module.ts` | 16 | 0 | 0 | 0 | 0 | 0 | 0 |
| `sistema/backend/src/modules/inventory/inventory.service.spec.ts` | 245 | 9 | 2 | 0 | 0 | 0 | 0 |
| `sistema/backend/src/modules/inventory/inventory.service.ts` | 718 | 40 | 0 | 28 | 0 | 0 | 0 |
| `sistema/backend/src/modules/marketplace/marketplace.controller.ts` | 75 | 8 | 5 | 0 | 0 | 0 | 0 |
| `sistema/backend/src/modules/marketplace/marketplace.module.ts` | 14 | 0 | 0 | 0 | 0 | 0 | 0 |
| `sistema/backend/src/modules/marketplace/marketplace.service.spec.ts` | 141 | 6 | 2 | 0 | 0 | 0 | 0 |
| `sistema/backend/src/modules/marketplace/marketplace.service.ts` | 386 | 24 | 9 | 25 | 0 | 0 | 0 |
| `sistema/backend/src/modules/notifications/ai-notification.scheduler.ts` | 47 | 2 | 0 | 4 | 0 | 0 | 0 |
| `sistema/backend/src/modules/notifications/ai-notification.service.ts` | 194 | 6 | 0 | 8 | 0 | 0 | 0 |
| `sistema/backend/src/modules/notifications/email.service.ts` | 46 | 2 | 0 | 3 | 0 | 0 | 0 |
| `sistema/backend/src/modules/notifications/notification.service.ts` | 113 | 6 | 0 | 2 | 0 | 0 | 0 |
| `sistema/backend/src/modules/notifications/notifications.controller.ts` | 218 | 14 | 0 | 10 | 0 | 0 | 0 |
| `sistema/backend/src/modules/notifications/notifications.module.ts` | 36 | 0 | 0 | 0 | 0 | 0 | 0 |
| `sistema/backend/src/modules/notifications/notifications.service.spec.ts` | 162 | 8 | 3 | 0 | 0 | 0 | 0 |
| `sistema/backend/src/modules/notifications/notifications.service.ts` | 434 | 40 | 0 | 24 | 0 | 0 | 0 |
| `sistema/backend/src/modules/notifications/push-equipe.spec.ts` | 79 | 8 | 0 | 0 | 0 | 0 | 0 |
| `sistema/backend/src/modules/notifications/push-notification.service.spec.ts` | 127 | 8 | 2 | 0 | 0 | 0 | 0 |
| `sistema/backend/src/modules/notifications/push-notification.service.ts` | 261 | 10 | 0 | 16 | 0 | 0 | 0 |
| `sistema/backend/src/modules/notifications/whatsapp.service.ts` | 164 | 7 | 0 | 9 | 0 | 0 | 0 |
| `sistema/backend/src/modules/observability/observability.controller.ts` | 58 | 6 | 0 | 0 | 0 | 0 | 0 |
| `sistema/backend/src/modules/observability/observability.module.ts` | 12 | 0 | 0 | 0 | 0 | 0 | 0 |
| `sistema/backend/src/modules/observability/observability.service.spec.ts` | 72 | 6 | 1 | 0 | 0 | 0 | 0 |
| `sistema/backend/src/modules/observability/observability.service.ts` | 145 | 10 | 3 | 9 | 0 | 0 | 0 |
| `sistema/backend/src/modules/orders/dto/create-order.dto.ts` | 107 | 0 | 0 | 0 | 0 | 0 | 0 |
| `sistema/backend/src/modules/orders/dto/oms-order.dto.ts` | 53 | 0 | 0 | 0 | 0 | 0 | 0 |
| `sistema/backend/src/modules/orders/dto/update-order.dto.ts` | 28 | 0 | 0 | 0 | 0 | 0 | 0 |
| `sistema/backend/src/modules/orders/orders.controller.ts` | 460 | 23 | 0 | 7 | 0 | 0 | 0 |
| `sistema/backend/src/modules/orders/orders.integration.spec.ts` | 332 | 23 | 7 | 0 | 0 | 0 | 0 |
| `sistema/backend/src/modules/orders/orders.module.ts` | 20 | 0 | 0 | 0 | 0 | 0 | 0 |
| `sistema/backend/src/modules/orders/orders.service.spec.ts` | 1016 | 54 | 23 | 5 | 0 | 0 | 0 |
| `sistema/backend/src/modules/orders/orders.service.ts` | 1570 | 84 | 0 | 105 | 0 | 0 | 0 |
| `sistema/backend/src/modules/picking/dto/picking.dto.ts` | 123 | 0 | 0 | 0 | 0 | 0 | 0 |
| `sistema/backend/src/modules/picking/picker.controller.ts` | 247 | 21 | 1 | 3 | 0 | 0 | 0 |
| `sistema/backend/src/modules/picking/picking.controller.ts` | 155 | 17 | 0 | 2 | 0 | 0 | 0 |
| `sistema/backend/src/modules/picking/picking.module.ts` | 17 | 0 | 0 | 0 | 0 | 0 | 0 |
| `sistema/backend/src/modules/picking/picking.service.spec.ts` | 261 | 5 | 0 | 0 | 0 | 0 | 0 |
| `sistema/backend/src/modules/picking/picking.service.ts` | 1301 | 81 | 3 | 69 | 0 | 0 | 0 |
| `sistema/backend/src/modules/pricing/pricing.controller.spec.ts` | 15 | 2 | 0 | 0 | 0 | 0 | 0 |
| `sistema/backend/src/modules/pricing/pricing.controller.ts` | 93 | 10 | 5 | 5 | 0 | 0 | 0 |
| `sistema/backend/src/modules/pricing/pricing.module.ts` | 14 | 0 | 0 | 0 | 0 | 0 | 0 |
| `sistema/backend/src/modules/pricing/pricing.service.spec.ts` | 204 | 10 | 2 | 0 | 0 | 0 | 0 |
| `sistema/backend/src/modules/pricing/pricing.service.ts` | 757 | 54 | 6 | 91 | 0 | 0 | 0 |
| `sistema/backend/src/modules/products/admin-products.controller.ts` | 96 | 6 | 0 | 5 | 0 | 0 | 0 |
| `sistema/backend/src/modules/products/dto/create-product.dto.ts` | 88 | 0 | 0 | 0 | 0 | 0 | 0 |
| `sistema/backend/src/modules/products/dto/update-product.dto.ts` | 5 | 0 | 0 | 0 | 0 | 0 | 0 |
| `sistema/backend/src/modules/products/missing-products.monitor.spec.ts` | 46 | 6 | 5 | 0 | 0 | 0 | 0 |
| `sistema/backend/src/modules/products/missing-products.monitor.ts` | 135 | 11 | 0 | 9 | 0 | 0 | 0 |
| `sistema/backend/src/modules/products/product-search.service.ts` | 459 | 22 | 1 | 32 | 0 | 0 | 0 |
| `sistema/backend/src/modules/products/products-sync.scheduler.ts` | 105 | 3 | 0 | 12 | 0 | 0 | 0 |
| `sistema/backend/src/modules/products/products.controller.ts` | 507 | 26 | 0 | 12 | 0 | 0 | 0 |
| `sistema/backend/src/modules/products/products.module.ts` | 22 | 0 | 0 | 0 | 0 | 0 | 0 |
| `sistema/backend/src/modules/products/products.service.spec.ts` | 596 | 58 | 9 | 2 | 0 | 0 | 0 |
| `sistema/backend/src/modules/products/products.service.ts` | 2234 | 139 | 9 | 161 | 0 | 0 | 0 |
| `sistema/backend/src/modules/promotions/promotions.controller.ts` | 55 | 7 | 0 | 2 | 0 | 0 | 0 |
| `sistema/backend/src/modules/promotions/promotions.module.ts` | 15 | 0 | 0 | 0 | 0 | 0 | 0 |
| `sistema/backend/src/modules/promotions/promotions.scheduler.ts` | 50 | 3 | 0 | 7 | 0 | 0 | 0 |
| `sistema/backend/src/modules/promotions/promotions.service.spec.ts` | 134 | 10 | 0 | 0 | 0 | 0 | 0 |
| `sistema/backend/src/modules/promotions/promotions.service.ts` | 210 | 13 | 0 | 6 | 0 | 0 | 0 |
| `sistema/backend/src/modules/public-api/dto/public-api.dto.ts` | 56 | 0 | 0 | 0 | 0 | 0 | 0 |
| `sistema/backend/src/modules/public-api/public-api.controller.ts` | 118 | 15 | 4 | 4 | 0 | 0 | 0 |
| `sistema/backend/src/modules/public-api/public-api.module.ts` | 13 | 0 | 0 | 0 | 0 | 0 | 0 |
| `sistema/backend/src/modules/public-api/public-api.service.spec.ts` | 217 | 10 | 3 | 0 | 0 | 0 | 0 |
| `sistema/backend/src/modules/public-api/public-api.service.ts` | 378 | 26 | 0 | 20 | 0 | 0 | 0 |
| `sistema/backend/src/modules/recipes/dto/create-recipe.dto.ts` | 128 | 9 | 0 | 0 | 0 | 0 | 0 |
| `sistema/backend/src/modules/recipes/dto/recipe-category.dto.ts` | 29 | 2 | 0 | 0 | 0 | 0 | 0 |
| `sistema/backend/src/modules/recipes/dto/update-recipe.dto.ts` | 5 | 0 | 0 | 0 | 0 | 0 | 0 |
| `sistema/backend/src/modules/recipes/recipes.controller.spec.ts` | 32 | 5 | 0 | 0 | 0 | 0 | 0 |
| `sistema/backend/src/modules/recipes/recipes.controller.ts` | 95 | 10 | 0 | 2 | 0 | 0 | 0 |
| `sistema/backend/src/modules/recipes/recipes.module.ts` | 12 | 0 | 0 | 0 | 0 | 0 | 0 |
| `sistema/backend/src/modules/recipes/recipes.service.spec.ts` | 131 | 18 | 1 | 0 | 0 | 0 | 0 |
| `sistema/backend/src/modules/recipes/recipes.service.ts` | 163 | 20 | 0 | 19 | 0 | 0 | 0 |
| `sistema/backend/src/modules/recommendations/recommendations.controller.ts` | 70 | 7 | 1 | 6 | 0 | 0 | 0 |
| `sistema/backend/src/modules/recommendations/recommendations.module.ts` | 12 | 0 | 0 | 0 | 0 | 0 | 0 |
| `sistema/backend/src/modules/recommendations/recommendations.service.spec.ts` | 154 | 7 | 1 | 0 | 0 | 0 | 0 |
| `sistema/backend/src/modules/recommendations/recommendations.service.ts` | 463 | 41 | 3 | 23 | 0 | 0 | 0 |
| `sistema/backend/sync-products.js` | 138 | 3 | 0 | 13 | 0 | 0 | 0 |
| `sistema/delivery-app/postcss.config.js` | 7 | 0 | 0 | 0 | 0 | 0 | 0 |
| `sistema/delivery-app/public/service-worker.js` | 79 | 6 | 0 | 4 | 0 | 4 | 0 |
| `sistema/delivery-app/src/App.tsx` | 60 | 6 | 0 | 2 | 0 | 0 | 0 |
| `sistema/delivery-app/src/components/AvisoPush.tsx` | 61 | 1 | 0 | 3 | 0 | 0 | 0 |
| `sistema/delivery-app/src/hooks/usePushEquipe.ts` | 138 | 9 | 0 | 17 | 0 | 1 | 0 |
| `sistema/delivery-app/src/main.tsx` | 26 | 3 | 0 | 1 | 0 | 1 | 0 |
| `sistema/delivery-app/src/pages/Login.tsx` | 74 | 4 | 0 | 4 | 0 | 0 | 0 |
| `sistema/delivery-app/src/pages/RouteDetail.tsx` | 358 | 24 | 2 | 21 | 0 | 0 | 0 |
| `sistema/delivery-app/src/pages/RouteList.tsx` | 214 | 15 | 2 | 8 | 0 | 0 | 0 |
| `sistema/delivery-app/src/services/api.ts` | 111 | 12 | 0 | 2 | 0 | 0 | 0 |
| `sistema/delivery-app/src/utils/orderCode.ts` | 14 | 1 | 0 | 1 | 0 | 0 | 0 |
| `sistema/delivery-app/src/vite-env.d.ts` | 2 | 0 | 0 | 0 | 0 | 0 | 0 |
| `sistema/delivery-app/tailwind.config.js` | 22 | 0 | 0 | 0 | 0 | 0 | 0 |
| `sistema/delivery-app/vite.config.ts` | 15 | 0 | 0 | 0 | 0 | 0 | 0 |
| `sistema/ecosystem.config.js` | 26 | 0 | 0 | 0 | 0 | 0 | 3 |
| `sistema/frontend/.eslintrc.cjs` | 26 | 0 | 0 | 0 | 0 | 0 | 0 |
| `sistema/frontend/cypress.config.ts` | 12 | 1 | 0 | 0 | 0 | 0 | 0 |
| `sistema/frontend/cypress/e2e/account-fallback-ui-kit.cy.ts` | 142 | 9 | 0 | 0 | 0 | 0 | 0 |
| `sistema/frontend/cypress/e2e/auth-ui-kit.cy.ts` | 57 | 7 | 0 | 0 | 0 | 0 | 0 |
| `sistema/frontend/cypress/e2e/cart.cy.ts` | 272 | 18 | 0 | 0 | 0 | 1 | 0 |
| `sistema/frontend/cypress/e2e/categories-mapping-api.cy.ts` | 39 | 7 | 0 | 1 | 0 | 0 | 0 |
| `sistema/frontend/cypress/e2e/checkout.cy.ts` | 266 | 14 | 0 | 0 | 0 | 1 | 0 |
| `sistema/frontend/cypress/e2e/mobile-visual-smoke.cy.ts` | 463 | 37 | 0 | 1 | 0 | 0 | 0 |
| `sistema/frontend/cypress/e2e/product-detail.cy.ts` | 92 | 8 | 0 | 0 | 0 | 0 | 0 |
| `sistema/frontend/cypress/e2e/product-pricing.cy.ts` | 180 | 17 | 0 | 0 | 0 | 0 | 0 |
| `sistema/frontend/cypress/e2e/recipes.cy.ts` | 26 | 6 | 0 | 0 | 0 | 0 | 0 |
| `sistema/frontend/cypress/e2e/secondary-routes-visual.cy.ts` | 256 | 16 | 0 | 1 | 0 | 0 | 0 |
| `sistema/frontend/cypress/e2e/smoke.cy.ts` | 33 | 6 | 0 | 0 | 0 | 0 | 0 |
| `sistema/frontend/cypress/e2e/staging-secondary-routes-real.cy.ts` | 208 | 21 | 0 | 8 | 0 | 0 | 0 |
| `sistema/frontend/cypress/e2e/staging-smoke.cy.ts` | 220 | 18 | 0 | 3 | 0 | 1 | 0 |
| `sistema/frontend/cypress/e2e/web-push-subscribe.cy.ts` | 162 | 10 | 0 | 0 | 0 | 0 | 0 |
| `sistema/frontend/postcss.config.js` | 6 | 0 | 0 | 0 | 0 | 0 | 0 |
| `sistema/frontend/public/service-worker.js` | 90 | 6 | 0 | 4 | 0 | 4 | 0 |
| `sistema/frontend/src/App.tsx` | 187 | 27 | 2 | 5 | 0 | 0 | 0 |
| `sistema/frontend/src/components/BannerImage.tsx` | 80 | 1 | 0 | 0 | 0 | 0 | 0 |
| `sistema/frontend/src/components/CriarSenhaCard.tsx` | 103 | 5 | 0 | 6 | 0 | 0 | 0 |
| `sistema/frontend/src/components/DeliveryVerificationModal.tsx` | 585 | 33 | 1 | 24 | 1 | 0 | 0 |
| `sistema/frontend/src/components/ErrorBoundary.tsx` | 51 | 4 | 0 | 1 | 0 | 0 | 0 |
| `sistema/frontend/src/components/Footer.tsx` | 189 | 4 | 0 | 8 | 0 | 0 | 0 |
| `sistema/frontend/src/components/FreeShippingBar.tsx` | 133 | 10 | 0 | 8 | 2 | 0 | 0 |
| `sistema/frontend/src/components/HeroSlider.tsx` | 418 | 31 | 0 | 32 | 1 | 0 | 0 |
| `sistema/frontend/src/components/LoadingButton.tsx` | 46 | 1 | 0 | 1 | 0 | 0 | 0 |
| `sistema/frontend/src/components/LocalityPickerModal.tsx` | 125 | 5 | 0 | 3 | 0 | 0 | 0 |
| `sistema/frontend/src/components/MobileBottomNav.tsx` | 110 | 8 | 0 | 7 | 0 | 0 | 0 |
| `sistema/frontend/src/components/NetworkToast.tsx` | 57 | 8 | 0 | 4 | 1 | 2 | 0 |
| `sistema/frontend/src/components/NotificationBell.tsx` | 167 | 10 | 0 | 24 | 0 | 2 | 0 |
| `sistema/frontend/src/components/PageTransition.tsx` | 26 | 1 | 0 | 0 | 0 | 0 | 0 |
| `sistema/frontend/src/components/ProductImagePlaceholder.tsx` | 28 | 1 | 0 | 0 | 0 | 0 | 0 |
| `sistema/frontend/src/components/ProductShelf.tsx` | 131 | 6 | 0 | 5 | 0 | 0 | 0 |
| `sistema/frontend/src/components/PromoBanner.tsx` | 180 | 3 | 0 | 5 | 0 | 0 | 0 |
| `sistema/frontend/src/components/SEO.tsx` | 70 | 2 | 0 | 7 | 0 | 0 | 0 |
| `sistema/frontend/src/components/Skeleton.tsx` | 44 | 6 | 0 | 0 | 0 | 0 | 0 |
| `sistema/frontend/src/components/StoreProductCard.tsx` | 322 | 17 | 0 | 9 | 0 | 0 | 0 |
| `sistema/frontend/src/components/ui/badge.tsx` | 29 | 1 | 0 | 0 | 0 | 0 | 0 |
| `sistema/frontend/src/components/ui/button.tsx` | 61 | 2 | 0 | 0 | 0 | 0 | 0 |
| `sistema/frontend/src/components/ui/checkbox.tsx` | 18 | 1 | 0 | 0 | 0 | 0 | 0 |
| `sistema/frontend/src/components/ui/input.tsx` | 23 | 1 | 0 | 0 | 0 | 0 | 0 |
| `sistema/frontend/src/components/ui/password-input.tsx` | 35 | 3 | 0 | 3 | 0 | 0 | 0 |
| `sistema/frontend/src/components/ui/radio.tsx` | 18 | 1 | 0 | 0 | 0 | 0 | 0 |
| `sistema/frontend/src/components/ui/select.tsx` | 18 | 1 | 0 | 0 | 0 | 0 | 0 |
| `sistema/frontend/src/components/ui/surface.ts` | 27 | 1 | 0 | 0 | 0 | 0 | 0 |
| `sistema/frontend/src/config/deliveryOperation.ts` | 48 | 0 | 0 | 0 | 0 | 0 | 0 |
| `sistema/frontend/src/contexts/AuthContext.tsx` | 114 | 6 | 0 | 3 | 0 | 0 | 0 |
| `sistema/frontend/src/contexts/CartContext.test.tsx` | 265 | 66 | 0 | 1 | 0 | 0 | 0 |
| `sistema/frontend/src/contexts/CartContext.tsx` | 194 | 28 | 0 | 15 | 0 | 0 | 0 |
| `sistema/frontend/src/contexts/DeliveryVerificationModalContext.tsx` | 36 | 5 | 0 | 1 | 0 | 0 | 0 |
| `sistema/frontend/src/contexts/destinoSeguro.test.ts` | 22 | 4 | 0 | 0 | 0 | 0 | 0 |
| `sistema/frontend/src/hooks/useAddressAutofill.ts` | 190 | 8 | 0 | 10 | 1 | 0 | 0 |
| `sistema/frontend/src/hooks/useAuth.ts` | 7 | 1 | 0 | 0 | 0 | 0 | 0 |
| `sistema/frontend/src/hooks/useAutoDeliveryVerification.ts` | 52 | 4 | 0 | 6 | 0 | 0 | 0 |
| `sistema/frontend/src/hooks/useAutoScroll.ts` | 44 | 4 | 0 | 4 | 1 | 0 | 0 |
| `sistema/frontend/src/hooks/useBannerImpression.ts` | 50 | 6 | 0 | 3 | 0 | 0 | 0 |
| `sistema/frontend/src/hooks/useBrand.ts` | 92 | 2 | 0 | 0 | 0 | 0 | 0 |
| `sistema/frontend/src/hooks/useCMS.ts` | 114 | 10 | 0 | 2 | 0 | 0 | 0 |
| `sistema/frontend/src/hooks/useCart.ts` | 144 | 18 | 0 | 3 | 0 | 0 | 0 |
| `sistema/frontend/src/hooks/useCheckout.ts` | 91 | 16 | 0 | 0 | 0 | 0 | 0 |
| `sistema/frontend/src/hooks/useDeliveryAddress.ts` | 28 | 4 | 0 | 1 | 0 | 0 | 0 |
| `sistema/frontend/src/hooks/useDeliveryOperation.ts` | 35 | 5 | 0 | 2 | 1 | 0 | 0 |
| `sistema/frontend/src/hooks/useDragScroll.ts` | 69 | 5 | 0 | 6 | 0 | 0 | 0 |
| `sistema/frontend/src/hooks/useFreeShipping.ts` | 36 | 2 | 0 | 2 | 0 | 0 | 0 |
| `sistema/frontend/src/hooks/useHomeShelves.ts` | 339 | 31 | 0 | 24 | 0 | 0 | 0 |
| `sistema/frontend/src/hooks/useKnownZoneFreeAbove.ts` | 20 | 4 | 0 | 1 | 0 | 0 | 0 |
| `sistema/frontend/src/hooks/useMediaQuery.ts` | 37 | 6 | 0 | 2 | 0 | 1 | 0 |
| `sistema/frontend/src/hooks/useNotifications.ts` | 170 | 13 | 1 | 15 | 0 | 1 | 0 |
| `sistema/frontend/src/hooks/useOrders.ts` | 66 | 14 | 0 | 2 | 0 | 0 | 0 |
| `sistema/frontend/src/hooks/usePrefersReducedMotion.ts` | 27 | 5 | 0 | 2 | 0 | 1 | 0 |
| `sistema/frontend/src/hooks/useRecipes.ts` | 46 | 6 | 0 | 0 | 0 | 0 | 0 |
| `sistema/frontend/src/lib/cn.ts` | 7 | 1 | 0 | 0 | 0 | 0 | 0 |
| `sistema/frontend/src/main.tsx` | 47 | 4 | 0 | 2 | 0 | 1 | 0 |
| `sistema/frontend/src/pages/Account.tsx` | 826 | 48 | 0 | 44 | 0 | 0 | 0 |
| `sistema/frontend/src/pages/Cart.tsx` | 472 | 32 | 0 | 18 | 0 | 0 | 0 |
| `sistema/frontend/src/pages/Checkout.tsx` | 1500 | 61 | 0 | 81 | 2 | 0 | 0 |
| `sistema/frontend/src/pages/Forbidden.tsx` | 18 | 1 | 0 | 0 | 0 | 0 | 0 |
| `sistema/frontend/src/pages/ForgotPassword.tsx` | 104 | 3 | 0 | 2 | 0 | 0 | 0 |
| `sistema/frontend/src/pages/Home.tsx` | 1202 | 65 | 0 | 34 | 1 | 1 | 0 |
| `sistema/frontend/src/pages/Login.tsx` | 146 | 5 | 0 | 1 | 0 | 0 | 0 |
| `sistema/frontend/src/pages/NotFound.tsx` | 18 | 1 | 0 | 0 | 0 | 0 | 0 |
| `sistema/frontend/src/pages/PrivacyPolicy.tsx` | 215 | 2 | 0 | 0 | 0 | 0 | 0 |
| `sistema/frontend/src/pages/ProductDetail.tsx` | 547 | 32 | 2 | 32 | 0 | 0 | 0 |
| `sistema/frontend/src/pages/Promocoes.tsx` | 78 | 3 | 0 | 1 | 0 | 0 | 0 |
| `sistema/frontend/src/pages/RecipeDetail.tsx` | 389 | 19 | 0 | 16 | 0 | 0 | 0 |
| `sistema/frontend/src/pages/RecipeList.tsx` | 188 | 7 | 0 | 6 | 0 | 0 | 0 |
| `sistema/frontend/src/pages/Register.tsx` | 334 | 13 | 0 | 23 | 0 | 0 | 0 |
| `sistema/frontend/src/pages/ResetPassword.tsx` | 129 | 4 | 0 | 4 | 0 | 0 | 0 |
| `sistema/frontend/src/pages/Search.tsx` | 960 | 78 | 2 | 105 | 1 | 2 | 0 |
| `sistema/frontend/src/pages/TermsOfUse.tsx` | 232 | 2 | 0 | 0 | 0 | 0 | 0 |
| `sistema/frontend/src/pages/WinePage.tsx` | 483 | 30 | 0 | 22 | 0 | 0 | 0 |
| `sistema/frontend/src/services/api.ts` | 500 | 66 | 1 | 22 | 1 | 0 | 0 |
| `sistema/frontend/src/services/deliveryVerification.ts` | 380 | 25 | 5 | 33 | 0 | 2 | 0 |
| `sistema/frontend/src/types/index.ts` | 149 | 0 | 0 | 0 | 0 | 0 | 0 |
| `sistema/frontend/src/utils/analytics.ts` | 34 | 2 | 1 | 2 | 0 | 0 | 0 |
| `sistema/frontend/src/utils/apiError.ts` | 35 | 1 | 0 | 4 | 0 | 0 | 0 |
| `sistema/frontend/src/utils/changeOptions.ts` | 68 | 5 | 0 | 9 | 0 | 0 | 0 |
| `sistema/frontend/src/utils/checkout.test.ts` | 72 | 8 | 0 | 0 | 0 | 0 | 0 |
| `sistema/frontend/src/utils/checkout.ts` | 70 | 6 | 0 | 6 | 0 | 0 | 0 |
| `sistema/frontend/src/utils/checkoutDraft.test.ts` | 46 | 11 | 0 | 0 | 0 | 0 | 0 |
| `sistema/frontend/src/utils/checkoutDraft.ts` | 82 | 3 | 0 | 6 | 0 | 0 | 0 |
| `sistema/frontend/src/utils/deliveryAddress.ts` | 129 | 12 | 0 | 15 | 0 | 2 | 0 |
| `sistema/frontend/src/utils/deliveryOperation.ts` | 290 | 19 | 0 | 19 | 0 | 0 | 0 |
| `sistema/frontend/src/utils/device.ts` | 36 | 2 | 0 | 4 | 0 | 0 | 0 |
| `sistema/frontend/src/utils/format.ts` | 76 | 11 | 0 | 6 | 0 | 0 | 0 |
| `sistema/frontend/src/utils/homeCategories.test.ts` | 312 | 50 | 0 | 0 | 0 | 0 | 0 |
| `sistema/frontend/src/utils/homeCategories.ts` | 392 | 18 | 0 | 23 | 0 | 0 | 0 |
| `sistema/frontend/src/utils/productCard.ts` | 158 | 4 | 0 | 22 | 0 | 0 | 0 |
| `sistema/frontend/src/utils/productDetailSchema.ts` | 166 | 10 | 0 | 17 | 0 | 0 | 0 |
| `sistema/frontend/src/utils/productPricing.test.ts` | 309 | 64 | 0 | 0 | 0 | 0 | 0 |
| `sistema/frontend/src/utils/productPricing.ts` | 150 | 14 | 0 | 31 | 0 | 0 | 0 |
| `sistema/frontend/src/utils/validators.ts` | 119 | 8 | 0 | 12 | 0 | 0 | 0 |
| `sistema/frontend/tailwind.config.js` | 31 | 0 | 0 | 0 | 0 | 0 | 0 |
| `sistema/frontend/vite.config.ts` | 42 | 0 | 0 | 0 | 0 | 0 | 0 |
| `sistema/picking-app/postcss.config.js` | 7 | 0 | 0 | 0 | 0 | 0 | 0 |
| `sistema/picking-app/public/service-worker.js` | 79 | 6 | 0 | 4 | 0 | 4 | 0 |
| `sistema/picking-app/src/App.tsx` | 60 | 6 | 0 | 2 | 0 | 0 | 0 |
| `sistema/picking-app/src/components/AvisoPush.tsx` | 61 | 1 | 0 | 3 | 0 | 0 | 0 |
| `sistema/picking-app/src/components/BarcodeScanner.tsx` | 154 | 11 | 3 | 15 | 0 | 0 | 0 |
| `sistema/picking-app/src/hooks/usePushEquipe.ts` | 138 | 9 | 0 | 17 | 0 | 1 | 0 |
| `sistema/picking-app/src/main.tsx` | 26 | 3 | 0 | 1 | 0 | 1 | 0 |
| `sistema/picking-app/src/pages/Login.tsx` | 74 | 4 | 0 | 4 | 0 | 0 | 0 |
| `sistema/picking-app/src/pages/OrderList.tsx` | 250 | 15 | 0 | 9 | 1 | 0 | 0 |
| `sistema/picking-app/src/pages/OrderPicking.tsx` | 1118 | 97 | 10 | 82 | 2 | 0 | 0 |
| `sistema/picking-app/src/services/api.ts` | 137 | 16 | 0 | 2 | 0 | 0 | 0 |
| `sistema/picking-app/src/utils/orderCode.ts` | 21 | 2 | 0 | 0 | 0 | 0 | 0 |
| `sistema/picking-app/src/vite-env.d.ts` | 2 | 0 | 0 | 0 | 0 | 0 | 0 |
| `sistema/picking-app/tailwind.config.js` | 22 | 0 | 0 | 0 | 0 | 0 | 0 |
| `sistema/picking-app/vite.config.ts` | 15 | 0 | 0 | 0 | 0 | 0 | 0 |
| `sistema/scripts/check-env.js` | 133 | 10 | 0 | 10 | 0 | 0 | 0 |
| `sistema/scripts/check-orphan-fields.js` | 154 | 2 | 0 | 12 | 0 | 0 | 0 |
| `sistema/scripts/check-schema-drift.js` | 99 | 3 | 0 | 5 | 0 | 0 | 0 |
| `sistema/scripts/confirm-web-push-visual.js` | 119 | 8 | 0 | 12 | 0 | 0 | 0 |
| `sistema/scripts/finalize-web-push-homologation.js` | 146 | 9 | 0 | 12 | 0 | 0 | 0 |
| `sistema/scripts/generate-web-push-homologation-report.js` | 241 | 11 | 0 | 45 | 0 | 0 | 0 |
| `sistema/scripts/generate-web-push-vapid.js` | 86 | 6 | 0 | 12 | 0 | 0 | 0 |
| `sistema/scripts/homologate-web-push.js` | 271 | 15 | 0 | 47 | 0 | 0 | 0 |
| `sistema/scripts/inspect-web-push-subscriptions.js` | 258 | 18 | 0 | 33 | 0 | 0 | 0 |
| `sistema/scripts/prepare-web-push-env.js` | 286 | 16 | 0 | 38 | 0 | 0 | 0 |
| `sistema/scripts/prove-web-push-delivery.js` | 303 | 13 | 0 | 39 | 0 | 0 | 0 |
| `sistema/scripts/register-web-push-cdp-chrome.js` | 274 | 26 | 0 | 23 | 3 | 3 | 0 |
| `sistema/scripts/validate-category-tree.js` | 393 | 30 | 0 | 39 | 0 | 0 | 0 |
| `sistema/scripts/validate-web-push-evidence.js` | 353 | 30 | 0 | 31 | 0 | 0 | 0 |
| `sistema/scripts/validate-web-push-readiness.js` | 425 | 25 | 0 | 80 | 0 | 0 | 0 |
| `sistema/scripts/validate-web-push-tooling.js` | 471 | 21 | 0 | 12 | 0 | 0 | 0 |
| `sistema/scripts/verify-web-push-evidence-manifest.js` | 140 | 11 | 0 | 18 | 0 | 0 | 0 |
| `sistema/backend/src/modules/uploads/uploads.service.ts` | 27 | 3 | 0 | 2 | 0 | 0 | 0 |
| `sistema/backend/src/modules/uploads/uploads.service.spec.ts` | 19 | 3 | 0 | 0 | 0 | 0 | 0 |
| `sistema/backend/src/modules/uploads/uploads.module.ts` | 10 | 0 | 0 | 0 | 0 | 0 | 0 |
| `sistema/backend/src/modules/uploads/uploads.controller.ts` | 242 | 7 | 0 | 14 | 0 | 0 | 0 |
| `sistema/backend/src/modules/uploads/uploads.controller.spec.ts` | 24 | 5 | 0 | 0 | 0 | 0 | 0 |
| `sistema/backend/src/modules/uploads/upload-bounds.spec.ts` | 49 | 5 | 0 | 0 | 0 | 0 | 0 |
| `sistema/backend/src/modules/checkout/abandoned-cart.scheduler.ts` | 77 | 2 | 0 | 7 | 0 | 0 | 0 |
| `sistema/backend/src/modules/checkout/abandoned-cart.scheduler.spec.ts` | 65 | 5 | 3 | 0 | 0 | 0 | 0 |

### Maiores funções encontradas no recorte inicial (30)

| Local | Função | Linhas | Ramificações |
|---|---|---:|---:|
| `sistema/frontend/src/pages/Checkout.tsx:54` | Checkout | 1433 | 81 |
| `sistema/admin/src/pages/DeliveryZones.tsx:252` | DeliveryZones | 1346 | 110 |
| `sistema/admin/src/pages/StoreBannersManager.tsx:906` | StoreBannersManager | 1342 | 79 |
| `sistema/admin/src/pages/Dashboard.tsx:273` | AdminDashboard | 1147 | 99 |
| `sistema/admin/src/pages/sections/ProductsSection.tsx:177` | ProductsSection | 1030 | 99 |
| `sistema/frontend/src/pages/Home.tsx:50` | Home | 972 | 28 |
| `sistema/picking-app/src/pages/OrderPicking.tsx:40` | OrderPicking | 935 | 72 |
| `sistema/backend/src/modules/orders/orders.service.spec.ts:107` | <anonima> | 909 | 5 |
| `sistema/admin/src/pages/sections/OrdersSection.tsx:368` | OrdersSection | 902 | 45 |
| `sistema/frontend/src/pages/Search.tsx:109` | MercadoPage | 851 | 105 |
| `sistema/backend/src/modules/integrations/order-orchestration.service.spec.ts:55` | <anonima> | 785 | 0 |
| `sistema/admin/src/pages/sections/CustomersSection.tsx:34` | CustomersSection | 719 | 49 |
| `sistema/admin/src/pages/sections/PickingSection.tsx:116` | PickingSection | 702 | 52 |
| `sistema/frontend/src/pages/Account.tsx:148` | Account | 676 | 36 |
| `sistema/admin/src/pages/sections/ProductSlideOver.tsx:124` | ProductSlideOver | 638 | 37 |
| `sistema/admin/src/pages/sections/BusinessAccountsSection.tsx:111` | BusinessAccountsSection | 610 | 41 |
| `sistema/admin/src/pages/Intelligence.tsx:122` | Intelligence | 557 | 38 |
| `sistema/frontend/src/components/DeliveryVerificationModal.tsx:38` | DeliveryVerificationModal | 528 | 23 |
| `sistema/backend/src/modules/products/products.service.spec.ts:101` | <anonima> | 495 | 1 |
| `sistema/admin/src/pages/CategoriesManager.tsx:111` | CategoriesTab | 492 | 38 |
| `sistema/admin/src/pages/Recipes.tsx:65` | Recipes | 418 | 20 |
| `sistema/admin/src/pages/sections/IntelligenceSearchInsightsPanel.tsx:41` | IntelligenceSearchInsightsPanel | 411 | 14 |
| `sistema/admin/src/pages/CategoriesManager.tsx:619` | MappingTab | 407 | 22 |
| `sistema/frontend/src/pages/Cart.tsx:42` | Cart | 403 | 13 |
| `sistema/admin/src/pages/sections/StaffSection.tsx:72` | StaffSection | 399 | 41 |
| `sistema/backend/src/modules/checkout/checkout.service.spec.ts:3` | <anonima> | 396 | 3 |
| `sistema/backend/src/modules/orders/orders.service.ts:287` | create | 395 | 45 |
| `sistema/backend/src/modules/orders/orders.service.spec.ts:225` | <anonima> | 391 | 0 |
| `sistema/backend/src/modules/delivery/delivery.service.spec.ts:56` | <anonima> | 385 | 0 |
| `sistema/admin/src/components/LayoutManager.tsx:37` | LayoutManager | 379 | 26 |

## Achados acionáveis — evidências e correções propostas

Prioridades seguem impacto local; severidade do advisory não é automaticamente prioridade Urgent. Nenhuma vulnerabilidade foi explorada. IDs F identificam defeitos/dívidas de código e D identificam dependências. Todos os advisories de cada componente estão explícitos.

### F01 — Checkout perde a recusa de substituicao ao criar o pedido

**Prioridade:** high. **Etiqueta solicitada:** code-quality.

**Evidência:** sistema/frontend/src/pages/Checkout.tsx:418; sistema/backend/src/modules/checkout/checkout.service.ts:185; sistema/backend/src/modules/orders/orders.service.ts:624; sistema/backend/src/modules/picking/picking.service.ts:451.

O carrinho persiste allowSubstitution=false e a revisão mostra a recusa, mas confirmSession envia somente productId/quantity e OrdersService grava ALLOW para todos os itens. A separação passa a tratar a troca como autorizada.

**Proposta (não aplicada):**

```text
items: cart.items.map(i => ({ productId: i.productId, quantity: Number(i.quantity), substitutionPolicy: i.allowSubstitution ? "ALLOW" : "DENY" }))
// Preservar a política no DTO interno e na criação de OrderItem, com validação.
```

**Aceite:** Checkout com dois itens, um permitido e outro recusado, deve persistir ALLOW/DENY e mostrar o selo de recusa na separação em mobile e desktop.

**Verificação:** rg -n "allowSubstitution|substitutionPolicy" sistema/backend/src/modules/checkout sistema/backend/src/modules/orders sistema/frontend/src/pages/Checkout.tsx; rodar suites checkout/orders/picking com cenário ponta a ponta

### F02 — Ultima recotacao do pedido escapa da comparacao PRICE_DIVERGED

**Prioridade:** high. **Etiqueta solicitada:** code-quality.

**Evidência:** sistema/backend/src/modules/checkout/checkout.service.ts:141; sistema/backend/src/modules/checkout/checkout.service.ts:151; sistema/backend/src/modules/checkout/checkout.service.ts:182; sistema/backend/src/modules/orders/orders.service.ts:371; sistema/backend/src/modules/orders/orders.service.ts:427.

A comparação usa a cotação de buildQuote; em seguida OrdersService.create executa outra quote e usa seu total sem receber o valor aprovado. Alteração de preço entre essas chamadas produz pedido com total diferente do aprovado. Não foi simulada cobrança externa.

**Proposta (não aplicada):**

```text
ordersService.create({ ...dados, expectedTotal: confirmedTotal })
// Após a cotação final e antes de reservar/criar: comparar centavos com expectedTotal e rejeitar divergência; preferir snapshot/versionamento transacional.
```

**Aceite:** Simular cotação 100 na confirmação e 110 na criação; nenhum pedido, reserva final ou cobrança deve ocorrer e deve retornar PRICE_DIVERGED.

**Verificação:** Rodar checkout.service.spec.ts e orders.service.spec.ts; adicionar teste que altere a cotação somente na chamada final.

**Comandos reproduzíveis adicionais:** partir da raiz do repositório; incluir na suíte o cenário de aceite proposto, pois o teste atual não prova a correção.

```powershell
Set-Location sistema/backend
node node_modules/typescript/bin/tsc --noEmit --incremental false --pretty false
node node_modules/jest/bin/jest.js --runInBand --no-cache --silent
```

### F03 — Outbox marca SENT sem executar a integracao externa

**Prioridade:** high. **Etiqueta solicitada:** code-quality.

**Evidência:** sistema/backend/src/modules/integrations/integration-outbox.service.ts:317; sistema/backend/src/modules/integrations/integration-outbox.service.ts:514; sistema/backend/src/modules/integrations/order-orchestration.service.ts:117; sistema/backend/src/modules/integrations/integration-outbox.service.spec.ts:110.

dispatchEvent só verifica ACTIVE/simulateFailure e devolve acceptedAt; não seleciona provedor, tipo nem invoca transporte. Falhas reais de pedidos entram nessa outbox e o worker manual pode marcá-las SENT sem recuperar a integração. A suíte atual valida o falso sucesso.

**Proposta (não aplicada):**

```text
const dispatcher = dispatchers.resolve(event.connector.provider, event.type)
if (!dispatcher) return { ok: false, error: "Conector sem implementação" }
return dispatcher.send(event.payload, event.idempotencyKey)
```

**Aceite:** Evento de falha de ERP só vira SENT após o fake do adaptador comprovar chamada e resposta de sucesso; provedor sem implementação falha explicitamente.

**Verificação:** Rodar integration-outbox.service.spec.ts e order-orchestration.service.spec.ts; reprodução em memória desta auditoria produziu SENT sem adaptador.

**Comandos reproduzíveis adicionais:** partir da raiz do repositório; incluir na suíte o cenário de aceite proposto, pois o teste atual não prova a correção.

```powershell
Set-Location sistema/backend
node node_modules/typescript/bin/tsc --noEmit --incremental false --pretty false
node node_modules/jest/bin/jest.js --runInBand --no-cache --silent
```

### F04 — Retry da outbox reutiliza chave unica de job e falha na segunda tentativa

Prioridade: **high**. Etiqueta solicitada: `code-quality`.

**Evidência:** sistema/backend/src/modules/integrations/integration-outbox.service.ts:282; sistema/backend/src/modules/integrations/integration-outbox.service.ts:292; sistema/backend/prisma/schema.prisma:1761

Cada processamento cria IntegrationJob com a mesma chave job:<idempotencyKey>; o schema impõe unicidade por tenant/store/connector/key. Após um job FAILED, a segunda tentativa tenta INSERT com a mesma chave e lança P2002 antes de executar o envio.

Revalidado em 12/09/2026 após alterações concorrentes: defeito permanece; referência de linha atualizada.

**Correção sugerida, não aplicada:**

```text
const job = await prisma.integrationJob.upsert({ where: chaveDoEvento, create: dados, update: dadosDaTentativa })
// Uma identidade de job por evento, várias IntegrationAttempt com attemptNo distinto.
```

**Aceite:** Com banco isolado e evento com idempotencyKey, primeira tentativa falha e segunda conclui sem P2002; ambas permanecem auditáveis.

**Verificação:** Inspecionar índice de IntegrationJob e rodar teste de retry usando constraint real, não mock de create sempre bem-sucedido.

**Comandos reproduzíveis adicionais:** partir da raiz do repositório; incluir na suíte o cenário de aceite proposto, pois o teste atual não prova a correção.

```powershell
Set-Location sistema/backend
node node_modules/typescript/bin/tsc --noEmit --incremental false --pretty false
node node_modules/jest/bin/jest.js --runInBand --no-cache --silent
```

### F05 — Worker de outbox nao reivindica eventos de forma atomica

**Prioridade:** medium. **Etiqueta solicitada:** code-quality.

**Evidência:** sistema/backend/src/modules/integrations/integration-outbox.service.ts:263; sistema/backend/src/modules/integrations/integration-outbox.service.ts:270; sistema/backend/src/modules/integrations/integration-outbox.service.ts:297.

O worker lê o evento e só depois atualiza PROCESSING por id, sem condição de status. Duas chamadas concorrentes processam o mesmo evento; em reprodução em memória sem chave opcional, foram criados dois jobs e retornados dois SENT.

**Proposta (não aplicada):**

```text
const claimed = await tx.outboxEvent.updateMany({ where: { id, status: { in: ["PENDING","FAILED"] } }, data: { status: "PROCESSING", lockedAt: now } })
if (claimed.count !== 1) return { skipped: true }
// Alternativa: SELECT FOR UPDATE SKIP LOCKED.
```

**Aceite:** Duas execuções concorrentes geram um envio e uma tentativa ativa; a outra retorna skipped, incluindo evento sem idempotencyKey.

**Verificação:** Reprodução auditada: Promise.all([service.processOutboxEvent("e"), service.processOutboxEvent("e")]) com Prisma falso retornou jobs=2. Validar correção em Postgres isolado.

**Comandos reproduzíveis adicionais:** partir da raiz do repositório; incluir na suíte o cenário de aceite proposto, pois o teste atual não prova a correção.

```powershell
Set-Location sistema/backend
node node_modules/typescript/bin/tsc --noEmit --incremental false --pretty false
node node_modules/jest/bin/jest.js --runInBand --no-cache --silent
```

### F06 — Outbox deixa eventos PROCESSING presos apos interrupcao

**Prioridade:** medium. **Etiqueta solicitada:** code-quality.

**Evidência:** sistema/backend/src/modules/integrations/integration-outbox.service.ts:242; sistema/backend/src/modules/integrations/integration-outbox.service.ts:297; sistema/backend/src/modules/integrations/integration-outbox.service.ts:307.

runDueOutboxBatch seleciona só PENDING/FAILED. Se o processo cair ou a criação do attempt falhar após marcar PROCESSING, lockedAt não tem expiração/reclaim e o evento deixa de ser elegível; só replay manual recupera.

**Proposta (não aplicada):**

```text
// Lease com expiresAt; retomar PROCESSING cuja lease venceu.
// Persistir claim/job/attempt em transação e limpar/reagendar falhas; confirmar idempotência externa antes de reenviar.
```

**Aceite:** Interromper após o claim e reiniciar o worker: evento volta a ser elegível após prazo limitado, sem duplicar efeito externo.

**Verificação:** Rodar suíte outbox com injeção de falha após update PROCESSING e teste de avanço de relógio.

**Comandos reproduzíveis adicionais:** partir da raiz do repositório; incluir na suíte o cenário de aceite proposto, pois o teste atual não prova a correção.

```powershell
Set-Location sistema/backend
node node_modules/typescript/bin/tsc --noEmit --incremental false --pretty false
node node_modules/jest/bin/jest.js --runInBand --no-cache --silent
```

### F07 — Backup pode registrar sucesso quando pg_dump falha

**Prioridade:** high. **Etiqueta solicitada:** code-quality.

**Evidência:** sistema/backup/backup.sh:7; sistema/backup/backup.sh:21; sistema/backup/backup.sh:22; sistema/backup/backup.sh:52.

O script usa set -eu, mas pg_dump | gzip é avaliado pelo status de gzip. Um pg_dump com erro e stdout vazio ainda pode gerar gzip válido e status zero; o script prossegue para retenção e sincronização como se o dump fosse utilizável.

**Proposta (não aplicada):**

```text
// Usar shell com pipefail explicitamente habilitado OU separar dump e gzip.
pg_dump ... > "$arquivo_temporario" || return 1
gzip "$arquivo_temporario" || return 1
// Publicar arquivo final e aplicar retenção somente após validação.
```

**Aceite:** Substituir pg_dump por processo que retorna 1 em teste isolado; não deve publicar dump, apagar backups antigos ou imprimir concluído.

**Verificação:** Inspeção integral de backup.sh; validar erro do primeiro estágio de pipeline e restauração em banco descartável. Nenhum backup real foi executado.

**Comandos reproduzíveis adicionais:** partir da raiz do repositório; incluir na suíte o cenário de aceite proposto, pois o teste atual não prova a correção.

```powershell
& 'C:/Program Files/Git/bin/bash.exe' -n sistema/backup/backup.sh
```

### F08 — Compose de producao e staging omitem variaveis obrigatorias do boot

**Prioridade:** high. **Etiqueta solicitada:** code-quality.

**Evidência:** sistema/docker-compose.prod.yml:69; sistema/docker-compose.prod.yml:87; sistema/docker-compose.staging.yml:51; sistema/backend/src/modules/integrations/order-orchestration.service.ts:34; sistema/backend/src/modules/integrations/solidcom-erp.service.ts:57; docs/deploy.md:94.

O runbook ainda orienta docker-compose.prod.yml, que não repassa SOLIDCOM_BALCAO_CPF embora o campo de classe use requireEnv no boot; também omite ANTENOR_API_* e montagem da CA. Staging não repassa as configurações obrigatórias do ERP. Preencher .env não resolve porque não há env_file.

**Proposta (não aplicada):**

```text
// Alinhar environment/mounts dos manifests suportados com o contrato do backend.
SOLIDCOM_BALCAO_CPF: ${SOLIDCOM_BALCAO_CPF:?obrigatoria}
// Repassar ANTENOR_API_* e CA; ou remover formalmente manifests aposentados e corrigir runbook.
```

**Aceite:** Compose recomendado deve iniciar API em ambiente limpo usando fixtures de integração e expor health sem erro de requireEnv; nenhuma chave real em CI.

**Verificação:** Comparar nomes (sem valores) dos três Compose e requireEnv; teste de boot em ambiente descartável. Não iniciar stack de produção nesta auditoria.

**Comandos reproduzíveis adicionais:** partir da raiz do repositório; incluir na suíte o cenário de aceite proposto, pois o teste atual não prova a correção.

```powershell
rg -n 'SOLIDCOM_BALCAO_CPF|DATABASE_URL|VITE_VAPID_PUBLIC_KEY|node-version|npm run' sistema/docker-compose.yml sistema/docker-compose.prod.yml sistema/docker-compose.staging.yml .github/workflows/ci.yml .github/workflows/test-pr.yml
```

### F09 — Compose prod usa senha crua na DATABASE_URL

**Prioridade:** medium. **Etiqueta solicitada:** code-quality.

**Evidência:** sistema/docker-compose.prod.yml:69; sistema/docker-compose.yml:49; CLAUDE.md:161.

A variante prod interpola POSTGRES_PASSWORD dentro da URL, ao contrário da variante principal que usa POSTGRES_PASSWORD_URLENC. Senhas com delimitadores de URL podem tornar a URL inválida ou alterar componentes; o próprio projeto já documenta essa divergência.

**Proposta (não aplicada):**

```text
DATABASE_URL: postgresql://postgres:${POSTGRES_PASSWORD_URLENC:?defina senha codificada}@db:5432/antenor_db?schema=public
```

**Aceite:** Usar senha sintética com @, #, / e % e verificar parsing/autenticação em banco isolado; a senha crua continua exclusiva do serviço db.

**Verificação:** Comparação estática de DATABASE_URL nos Compose; validar com URL parser e Postgres descartável.

**Comandos reproduzíveis adicionais:** partir da raiz do repositório; incluir na suíte o cenário de aceite proposto, pois o teste atual não prova a correção.

```powershell
rg -n 'SOLIDCOM_BALCAO_CPF|DATABASE_URL|VITE_VAPID_PUBLIC_KEY|node-version|npm run' sistema/docker-compose.yml sistema/docker-compose.prod.yml sistema/docker-compose.staging.yml .github/workflows/ci.yml .github/workflows/test-pr.yml
```

### F10 — Compose prod nao fornece chave publica de push a picking e delivery

**Prioridade:** medium. **Etiqueta solicitada:** code-quality.

**Evidência:** sistema/docker-compose.prod.yml:165; sistema/docker-compose.prod.yml:178; sistema/picking-app/Dockerfile:11; sistema/delivery-app/Dockerfile:11; sistema/picking-app/src/hooks/usePushEquipe.ts:96.

Os Dockerfiles declaram VITE_VAPID_PUBLIC_KEY com default vazio; o Compose prod não fornece build.args nos dois serviços. O hook retorna sem-chave e impede inscrição, mesmo com as variáveis preenchidas na API.

**Proposta (não aplicada):**

```text
build:
  args:
    VITE_VAPID_PUBLIC_KEY: ${VITE_VAPID_PUBLIC_KEY:?defina chave publica}
```

**Aceite:** Imagens de picking/delivery construídas pelo manifest recomendado devem conter a chave pública de fixture e permitir chegar à inscrição; teste mobile e desktop.

**Verificação:** Comparar build.args do compose principal e prod; testar ativação com ServiceWorker/PushManager simulados.

**Comandos reproduzíveis adicionais:** partir da raiz do repositório; incluir na suíte o cenário de aceite proposto, pois o teste atual não prova a correção.

```powershell
rg -n 'SOLIDCOM_BALCAO_CPF|DATABASE_URL|VITE_VAPID_PUBLIC_KEY|node-version|npm run' sistema/docker-compose.yml sistema/docker-compose.prod.yml sistema/docker-compose.staging.yml .github/workflows/ci.yml .github/workflows/test-pr.yml
```

### F11 — PrismaService redeclarado por modulo multiplica pools e nao encerra conexoes

**Prioridade:** medium. **Etiqueta solicitada:** tech-debt.

**Evidência:** sistema/backend/src/common/prisma.service.ts:5; sistema/backend/src/modules/orders/orders.module.ts:16; sistema/backend/src/modules/notifications/notifications.module.ts:19; sistema/backend/src/modules/integrations/integrations.module.ts:37; sistema/backend/src/main.ts:51.

Cada módulo declara PrismaService como provider próprio; sem módulo global compartilhado, são instâncias diferentes de PrismaClient e pools independentes. A classe só chama super e não tem hook de desconexão; o bootstrap não habilita shutdown hooks. Risco de esgotamento sob carga; número de conexões em produção não medido.

**Proposta (não aplicada):**

```text
@Global() @Module({ providers: [PrismaService], exports: [PrismaService] }) class DatabaseModule {}
// Importar uma vez e remover providers locais.
async onModuleDestroy() { await this.$disconnect() }
app.enableShutdownHooks()
```

**Aceite:** Resolver PrismaService a partir de módulos diferentes deve retornar a mesma instância; fechar app libera pool; medir conexões sob carga em ambiente isolado.

**Verificação:** rg -n PrismaService sistema/backend/src -g "*.module.ts"; teste de container Nest e shutdown.

### F12 — Busca de produtos da separacao reaplica resposta apos limpar consulta

**Prioridade:** medium. **Etiqueta solicitada:** code-quality.

**Evidência:** sistema/picking-app/src/pages/OrderPicking.tsx:303; sistema/picking-app/src/pages/OrderPicking.tsx:307; sistema/picking-app/src/pages/OrderPicking.tsx:315.

searchRequestSeq só aumenta quando o timer dispara. Se uma consulta está em voo e o usuário limpa o campo, o ramo curto limpa a lista sem invalidar seq; a resposta antiga ainda passa na checagem e repõe produtos. O timer também não é limpo no unmount.

**Proposta (não aplicada):**

```text
const seq = ++searchRequestSeq.current // ao receber qualquer alteração, antes do ramo curto
clearTimeout(searchDebounceRef.current)
// No unmount: invalidar seq, limpar timer e abortar requisição quando possível.
```

**Aceite:** Disparar busca, limpar campo e resolver resposta antiga: lista continua vazia; desmontar antes do debounce não inicia requisição nem toast.

**Verificação:** Teste com promises controladas e timers falsos em OrderPicking; reproduzir em mobile e desktop.

**Comandos reproduzíveis adicionais:** partir da raiz do repositório; incluir na suíte o cenário de aceite proposto, pois o teste atual não prova a correção.

```powershell
Set-Location sistema/picking-app
node node_modules/typescript/bin/tsc --noEmit --incremental false --pretty false
```

### F13 — Alerta de IDENTITY do Notificador passa nivel incompleto e quebra fila

**Prioridade:** medium. **Etiqueta solicitada:** code-quality.

**Evidência:** Notificador/main.js:250; Notificador/main.js:83; Notificador/main.js:159; Notificador/main.js:170; Notificador/escalation.js:8.

verificarIdentityDav chama toast com objeto contendo só label, enquanto nextToast lê key/label e chama playSound(item.level.sound). No Windows, path.join(..., undefined) lança antes de agendar o fechamento, deixando toastShowing ativo e fila presa.

**Proposta (não aplicada):**

```text
const nivelCritico = LEVELS.find(nivel => nivel.key === "critico")
toast(nivelCritico, titulo, corpo, idade)
// Garantir avanço da fila em finally mesmo se som falhar.
```

**Aceite:** Simular IDENTITY inconsistente no Windows/fake path: exibe alerta crítico, toca som válido e o próximo toast continua após o timeout.

**Verificação:** Teste unitário extraído de nextToast/verificarIdentityDav; node escalation.test.js e node faturamento.test.js.

### F14 — Notificador sobrepoe polling e consultas manuais sem timeout HTTP

**Prioridade:** medium. **Etiqueta solicitada:** code-quality.

**Evidência:** Notificador/main.js:55; Notificador/main.js:66; Notificador/main.js:298; Notificador/main.js:407; Notificador/main.js:436; Notificador/dorsal.js:73.

check é async, mas setInterval e check-now podem iniciá-lo novamente antes de terminar. Fetch não tem deadline explícito; consultas concorrentes compartilham token, estado de avisos e pool global mssql, que cada consulta fecha em finally. Risco de tarefas acumuladas e fechamento do pool em uso.

**Proposta (não aplicada):**

```text
if (checkPromise) return checkPromise
checkPromise = runCheckWithDeadline().finally(() => { checkPromise = null })
// fetch(..., { signal: AbortSignal.timeout(15000) }); agendar próximo ciclo após settle.
```

**Aceite:** Clique manual durante polling lento deve compartilhar a execução; timeout HTTP libera a trava; no máximo um ciclo em voo.

**Verificação:** Testes com fetch pendente, relógio falso e dois check-now; não acessar DORSAL real.

**Comandos reproduzíveis adicionais:** partir da raiz do repositório; incluir na suíte o cenário de aceite proposto, pois o teste atual não prova a correção.

```powershell
Set-Location Notificador
node --check main.js
node escalation.test.js
node faturamento.test.js
```

### F15 — Notificador reautentica indefinidamente quando rota continua retornando 401

**Prioridade:** medium. **Etiqueta solicitada:** code-quality.

**Evidência:** Notificador/main.js:70; Notificador/main.js:223.

fetchOrders e apiJson repetem recursivamente após 401 e login bem-sucedido sem limite de uma renovação. Se o novo token continuar recusado, a promise externa nunca encerra normalmente e loginRetries é zerado em cada login.

**Proposta (não aplicada):**

```text
async function apiJson(path, options, renewed=false) {
  // em 401: se renewed, lançar erro; senão login e repetir com renewed=true
}
```

**Aceite:** Login 200 e rota sempre 401 devem produzir no máximo uma renovação, erro observável e próximo ciclo controlado.

**Verificação:** Teste com fetch simulado contando chamadas; não usar conta real.

**Comandos reproduzíveis adicionais:** partir da raiz do repositório; incluir na suíte o cenário de aceite proposto, pois o teste atual não prova a correção.

```powershell
Set-Location Notificador
node --check main.js
node escalation.test.js
node faturamento.test.js
```

### F16 — Cron de cancelamento considera sempre um lote fixo de 200 pedidos

**Prioridade:** medium. **Etiqueta solicitada:** code-quality.

**Evidência:** sistema/backend/src/modules/integrations/pdv-cancellation.scheduler.ts:64; sistema/backend/src/modules/integrations/pdv-cancellation.scheduler.ts:71.

findMany limita take=200 sem cursor, ordenação ou registro de último check. Com mais de 200 candidatos persistentes, pedidos além do primeiro lote podem nunca ser consultados. Webhooks mitigam, mas o fallback não cobre toda a fila.

**Proposta (não aplicada):**

```text
// Paginar candidatos por id com orderBy/cursor e deadline por rodada;
// ou ordenar por lastCheckedAt e atualizar o watermark.
```

**Aceite:** Criar 201 candidatos em fixture e demonstrar consulta do último em número limitado de rodadas, mesmo sem cancelamentos nos primeiros 200.

**Verificação:** Rodar pdv-cancellation.scheduler.spec.ts com paginação e erro parcial de lote.

**Comandos reproduzíveis adicionais:** partir da raiz do repositório; incluir na suíte o cenário de aceite proposto, pois o teste atual não prova a correção.

```powershell
Set-Location sistema/backend
node node_modules/typescript/bin/tsc --noEmit --incremental false --pretty false
node node_modules/jest/bin/jest.js --runInBand --no-cache --silent
```

### F17 — Sync manual e cron nao compartilham a mesma exclusao mutua

**Prioridade:** medium. **Etiqueta solicitada:** code-quality.

**Evidência:** sistema/backend/src/modules/products/products-sync.scheduler.ts:19; sistema/backend/src/modules/products/products-sync.scheduler.ts:48; sistema/backend/src/modules/products/products.service.ts:1230; sistema/backend/src/modules/products/products.service.ts:1264; sistema/backend/src/modules/products/products.service.ts:1563.

A trava isRunning mora só no scheduler, mas o caminho manual chama diretamente syncFromERP; syncJob controla apenas o disparo manual. Execuções manual/completa/incremental podem aplicar snapshots simultâneos e regravar preço/estoque mais antigo após dado novo.

**Proposta (não aplicada):**

```text
// Concentrar claim de sincronização no serviço compartilhado, com finally;
// se houver múltiplas réplicas, usar lease/advisory lock no banco.
```

**Aceite:** Disparar cron e sync manual ao mesmo tempo deve produzir uma sincronização ativa; provar ordenação/preservação do snapshot mais novo.

**Verificação:** Teste com adaptador ERP de promises controladas, cobrindo syncFromERP e syncRecentFromERP.

**Comandos reproduzíveis adicionais:** partir da raiz do repositório; incluir na suíte o cenário de aceite proposto, pois o teste atual não prova a correção.

```powershell
Set-Location sistema/backend
node node_modules/typescript/bin/tsc --noEmit --incremental false --pretty false
node node_modules/jest/bin/jest.js --runInBand --no-cache --silent
```

### F18 — Lint backend falha por require em implementacao e teste de push

Prioridade: **low**. Etiqueta solicitada: `code-quality`.

**Evidência:** sistema/backend/src/modules/notifications/push-notification.service.ts:14; sistema/backend/src/modules/notifications/push-notification.service.spec.ts:8

ESLint sem fix encontrou duas violações @typescript-eslint/no-var-requires; demais arquivos passaram. O lint do package.json ainda inclui --fix e por isso não foi executado durante auditoria.

Revalidado em 12/09/2026 após alterações concorrentes: defeito permanece; referência de linha atualizada.

**Correção sugerida, não aplicada:**

```text
// Trocar require por import compatível com CommonJS/esModuleInterop;
// caso necessário, exceção local com justificativa e mock equivalente.
```

**Aceite:** ESLint sem fix retorna zero e os testes de push continuam passando.

**Verificação:** node node_modules/eslint/bin/eslint.js src --ext .ts,.tsx --no-cache; jest push-notification.service.spec.ts --runInBand --no-cache

### F19 — Backend desliga verificacoes de codigo morto e acumula 20 diagnosticos

**Prioridade:** low. **Etiqueta solicitada:** tech-debt.

**Evidência:** sistema/backend/tsconfig.json:16; sistema/backend/.eslintrc.cjs:19; sistema/backend/src/main.ts:3; sistema/backend/src/modules/products/products.service.ts:121; sistema/backend/src/modules/products/products.service.ts:2198.

Typecheck padrão passa, mas --noUnusedLocals --noUnusedParameters encontra 20 diagnósticos (imports, interfaces, métodos privados, parâmetros). O lint desliga no-unused-vars; nomes e contratos obsoletos passam sem aviso. Não são 20 bugs de runtime.

**Proposta (não aplicada):**

```text
// Remover declarações sem consumidor após conferir contratos externos.
"noUnusedLocals": true,
"noUnusedParameters": true
// Manter exceções legítimas explícitas.
```

**Aceite:** Typecheck estrito para símbolos não usados retorna zero sem remover argumentos necessários a interfaces públicas.

**Verificação:** node node_modules/typescript/bin/tsc --noEmit --incremental false --noUnusedLocals --noUnusedParameters --pretty false

### F20 — Componentes centrais concentram fluxos inteiros em funcoes acima de 900 linhas

Prioridade: **medium**. Etiqueta solicitada: `tech-debt`.

**Evidência:** sistema/frontend/src/pages/Checkout.tsx:54; sistema/admin/src/pages/DeliveryZones.tsx:252; sistema/admin/src/pages/StoreBannersManager.tsx:906; sistema/admin/src/pages/Dashboard.tsx:275; sistema/picking-app/src/pages/OrderPicking.tsx:40

Varredura AST mediu Checkout=1446 linhas, DeliveryZones=1346, StoreBannersManager=1342, Dashboard=1147 e OrderPicking=935. Misturam I/O, validação, estado e JSX; ramificações incluem callbacks aninhados e não são métrica ciclomática formal. Dificulta testes dos defeitos de estado encontrados.

Revalidado por AST em 12/09/2026 após mudanças concorrentes: os cinco componentes continuam acima de 900 linhas; Dashboard começa agora na linha 275.

**Correção sugerida, não aplicada:**

```text
// Extrair etapas e regras puras por responsabilidade, mantendo orquestração fina.
const checkout = useCheckoutFlow(dependencies)
return <CheckoutSteps state={checkout.state} actions={checkout.actions} />
```

**Aceite:** Manter cenários mobile/desktop e testes dos fluxos; cada regra extraída deve ter fronteira clara sem copiar estado.

**Verificação:** AST por função; testes checkout/picking e typecheck dos apps; comparação visual fora desta fase.

**Comandos reproduzíveis adicionais:** partir da raiz do repositório; incluir na suíte o cenário de aceite proposto, pois o teste atual não prova a correção.

```powershell
Set-Location sistema/frontend
node node_modules/typescript/bin/tsc --noEmit --incremental false --pretty false
node node_modules/vitest/vitest.mjs run --configLoader runner --no-cache
```

### F21 — Hook de push da equipe duplicado integralmente nos dois apps

**Prioridade:** low. **Etiqueta solicitada:** tech-debt.

**Evidência:** sistema/picking-app/src/hooks/usePushEquipe.ts:1; sistema/delivery-app/src/hooks/usePushEquipe.ts:1.

Os dois arquivos são idênticos após normalização de whitespace. Regras de permissão, iOS, VAPID e inscrição precisam ser corrigidas em duas cópias e podem divergir.

**Proposta (não aplicada):**

```text
// Extrair módulo compartilhado pequeno para lógica de push, injetando cliente API e chave pública.
export function usePushEquipe({ api, publicKey }) { ... }
```

**Aceite:** Picking e delivery usam uma implementação, preservam estados e têm testes de permissão denied/default/granted e cleanup.

**Verificação:** Comparar arquivos; typecheck de picking/delivery; testes do módulo compartilhado.

**Comandos reproduzíveis adicionais:** partir da raiz do repositório; incluir na suíte o cenário de aceite proposto, pois o teste atual não prova a correção.

```powershell
Set-Location sistema/picking-app
node node_modules/typescript/bin/tsc --noEmit --incremental false --pretty false
```

### F22 — CI nao valida picking delivery nem testes do Notificador

**Prioridade:** medium. **Etiqueta solicitada:** tech-debt.

**Evidência:** .github/workflows/ci.yml:10; .github/workflows/ci.yml:130; .github/workflows/test-pr.yml:85; sistema/package.json:8.

Jobs de PR validam backend/storefront/admin; picking/delivery não têm job de typecheck/teste e Notificador não é executado. build:all/install:all/dev:all do orquestrador também só incluem três apps. A imagem Docker em push não fornece guardrail de PR para esses fluxos.

**Proposta (não aplicada):**

```text
// Matrix por app: backend/frontend/admin/picking-app/delivery-app.
// Acrescentar node escalation.test.js e node faturamento.test.js para Notificador.
// Alinhar scripts :all com apps suportados.
```

**Aceite:** Introduzir erro de tipo em picking/delivery deve reprovar PR; falha de teste Notificador também. Nenhum acesso externo de integração no CI.

**Verificação:** Inspecionar workflows e package.json; validar execução dos comandos equivalentes em checkout limpo.

**Comandos reproduzíveis adicionais:** partir da raiz do repositório; incluir na suíte o cenário de aceite proposto, pois o teste atual não prova a correção.

```powershell
rg -n 'SOLIDCOM_BALCAO_CPF|DATABASE_URL|VITE_VAPID_PUBLIC_KEY|node-version|npm run' sistema/docker-compose.yml sistema/docker-compose.prod.yml sistema/docker-compose.staging.yml .github/workflows/ci.yml .github/workflows/test-pr.yml
```

### F23 — Health herda bucket auth de 20 requisicoes por minuto

**Prioridade:** medium. **Etiqueta solicitada:** code-quality.

**Evidência:** sistema/backend/src/app.module.ts:39; sistema/backend/src/app.module.ts:59; sistema/backend/src/app.module.ts:78.

AppController não tem RelaxedThrottle/SkipThrottle e herda todos os buckets globais. /health fica no bucket auth de 20/min por tracker, apesar de ser usado por monitoramento e smoke checks; alta frequência pode gerar falso indisponível.

**Proposta (não aplicada):**

```text
@RelaxedThrottle()
@Controller()
class AppController { ... }
// Ou isentar somente health com política explícita.
```

**Aceite:** Mais de 20 probes/min do mesmo IP não devem retornar 429 no intervalo default; rotas auth mantêm restrição.

**Verificação:** Teste HTTP isolado com relógio/controlador e ThrottlerGuard reais.

**Comandos reproduzíveis adicionais:** partir da raiz do repositório; incluir na suíte o cenário de aceite proposto, pois o teste atual não prova a correção.

```powershell
Set-Location sistema/backend
node node_modules/typescript/bin/tsc --noEmit --incremental false --pretty false
node node_modules/jest/bin/jest.js --runInBand --no-cache --silent
```

### F24 — Metrica Prometheus declarada counter e calculada por janela deslizante

**Prioridade:** low. **Etiqueta solicitada:** code-quality.

**Evidência:** sistema/backend/src/common/observability/metrics-registry.ts:11; sistema/backend/src/common/observability/metrics-registry.ts:55; sistema/backend/src/common/observability/metrics-registry.ts:58.

antenor_http_requests_total é declarado counter, porém usa summary.totalRequests limitado a janela de 15 minutos e 10 mil amostras. O valor pode cair sem reinício, e rate/increase interpretam essa queda como reset, distorcendo volume e alertas.

**Proposta (não aplicada):**

```text
// Manter contador cumulativo separado incrementado em observeHttp;
// expor contagem da janela como gauge com outro nome.
```

**Aceite:** Avançar o relógio além da janela deve zerar o gauge, mas não reduzir o counter cumulativo; verificar formato Prometheus.

**Verificação:** Teste de observeHttp/prometheus com relógio falso; nenhum servidor externo necessário.

**Comandos reproduzíveis adicionais:** partir da raiz do repositório; incluir na suíte o cenário de aceite proposto, pois o teste atual não prova a correção.

```powershell
Set-Location sistema/backend
node node_modules/typescript/bin/tsc --noEmit --incremental false --pretty false
node node_modules/jest/bin/jest.js --runInBand --no-cache --silent
```

### F25 — Checkout pode responder falha depois de criar o pedido e converter o carrinho

**Prioridade:** medium. **Etiqueta solicitada:** code-quality.

**Evidência:** sistema/backend/src/modules/checkout/checkout.service.ts:208; sistema/backend/src/modules/checkout/checkout.service.ts:219; sistema/backend/src/modules/checkout/checkout.service.ts:231; sistema/backend/src/modules/checkout/checkout.service.ts:246.

O mesmo try engloba criação do pedido, sessão COMPLETED, conversão de carrinho e eventos de analytics. Se analyticsEvent.create falhar após a conversão, o catch sobrescreve a sessão para FAILED e devolve erro, embora o pedido exista; o retry encontra carrinho convertido. É falha distinta de PRICE_DIVERGED.

**Proposta (não aplicada):**

```text
// Finalizar estado de pedido/sessão/carrinho de modo transacional/idempotente;
// Registrar analytics via outbox ou best-effort após o commit, sem reclassificar pedido concluído como FAILED.
```

**Aceite:** Simular falha somente em analytics após criar pedido: resposta/retry deve retornar o pedido existente; não liberar reservas nem duplicar pedido.

**Verificação:** Rodar checkout.service.spec.ts com rejeição de analyticsEvent.create e recuperação idempotente.

**Comandos reproduzíveis adicionais:** partir da raiz do repositório; incluir na suíte o cenário de aceite proposto, pois o teste atual não prova a correção.

```powershell
Set-Location sistema/backend
node node_modules/typescript/bin/tsc --noEmit --incremental false --pretty false
node node_modules/jest/bin/jest.js --runInBand --no-cache --silent
```

### F26 — Clientes sem paginacao carregam cadastro e enderecos inteiros

**Prioridade:** medium. **Etiqueta solicitada:** tech-debt.

**Evidência:** sistema/backend/src/modules/customers/customers.service.ts:30; sistema/backend/src/modules/customers/customers.service.ts:42; sistema/backend/src/modules/customers/customers.service.ts:71.

findAll usa findMany sem take/skip/cursor e inclui endereços de todos; depois consulta push com IN de todos os IDs. Memória, payload e tempo crescem com o cadastro.

**Proposta (não aplicada):**

```text
// DTO com page/cursor e limite máximo; paginação no banco e contagem separada.
findMany({ where, take: limit, cursor, orderBy: { id: "asc" }, include: { addresses: true } })
```

**Aceite:** Com milhares de clientes a resposta permanece limitada, buscas paginam sem omissão/duplicação, frontend usa paginação.

**Verificação:** Issue equivalente encontrada: JON-44; complementar evidências sem criar duplicata.

**Comandos reproduzíveis adicionais:** partir da raiz do repositório; incluir na suíte o cenário de aceite proposto, pois o teste atual não prova a correção.

```powershell
Set-Location sistema/backend
node node_modules/typescript/bin/tsc --noEmit --incremental false --pretty false
node node_modules/jest/bin/jest.js --runInBand --no-cache --silent
```

### D01 — Atualizar @babel/core nas arvores com alertas npm audit

**Prioridade:** low. **Etiqueta solicitada:** tech-debt.

**Evidência:** sistema/backend/package-lock.json:245 (node_modules/@babel/core 7.29.0; ferramenta de desenvolvimento); sistema/frontend/package-lock.json:138 (node_modules/@babel/core 7.29.0; ferramenta de desenvolvimento); sistema/admin/package-lock.json:87 (node_modules/@babel/core 7.29.0; ferramenta de desenvolvimento).

O npm audit consultado em 11/09/2026 identificou a versão resolvida de @babel/core em faixa vulnerável. Os alertas específicos estão enumerados abaixo; a presença no lockfile não comprova exploração. O alcance depende do adaptador/caminho usado e das pré-condições do advisory; não foi executada exploração.

- https://github.com/advisories/GHSA-4x5r-pxfx-6jf8 — faixa reportada: `<=7.29.0`; severidade do registro: low.

**Proposta (não aplicada):**

```text
// Atualizar @babel/core ou o pacote pai que o resolve para versão fora de TODAS as faixas reportadas.
// Regenerar lockfiles em trabalho separado, conferir compatibilidade e não executar audit fix --force às cegas.
// Se houver salto maior (sharp, por exemplo), tratar breaking changes e formatos suportados antes de publicar.
```

**Aceite:** npm audit deixa de reportar os advisories listados para @babel/core, ou há triagem documentada por advisory com prova de não alcance. Typechecks/testes e fluxos que dependem desse componente permanecem verdes.

**Verificação:** Em cada árvore afetada: npm audit --json --ignore-scripts --logs-max=0; npm explain @babel/core; typecheck/testes da aplicação. Nenhum pacote foi instalado ou atualizado nesta auditoria.

### D02 — Atualizar axios nas arvores com alertas npm audit

**Prioridade:** medium. **Etiqueta solicitada:** tech-debt.

**Evidência:** sistema/backend/package-lock.json:4317 (node_modules/axios 1.16.1; dependência de execução ou transitiva); sistema/frontend/package-lock.json:2672 (node_modules/axios 1.16.1; dependência de execução ou transitiva); sistema/admin/package-lock.json:2374 (node_modules/axios 1.16.1; dependência de execução ou transitiva).

O npm audit consultado em 11/09/2026 identificou a versão resolvida de axios em faixa vulnerável. Os alertas específicos estão enumerados abaixo; a presença no lockfile não comprova exploração. O alcance depende do adaptador/caminho usado e das pré-condições do advisory; não foi executada exploração.

- https://github.com/advisories/GHSA-xj6q-8x83-jv6g — faixa reportada: `>=1.15.2 <1.18.0`; severidade do registro: moderate.
- https://github.com/advisories/GHSA-mmx7-hfxf-jppx — faixa reportada: `>=1.0.0 <1.18.0`; severidade do registro: moderate.
- https://github.com/advisories/GHSA-pmv8-rq9r-6j72 — faixa reportada: `>=1.0.0 <1.18.0`; severidade do registro: moderate.
- https://github.com/advisories/GHSA-mwf2-3pr3-8698 — faixa reportada: `>=1.13.0 <1.18.0`; severidade do registro: moderate.
- https://github.com/advisories/GHSA-gcfj-64vw-6mp9 — faixa reportada: `>=1.15.2 <1.18.0`; severidade do registro: high.
- https://github.com/advisories/GHSA-7q8q-rj6j-mhjq — faixa reportada: `>=1.0.0 <1.18.0`; severidade do registro: moderate.
- https://github.com/advisories/GHSA-jqh4-m9w3-8hp9 — faixa reportada: `>=1.7.0 <1.18.0`; severidade do registro: moderate.
- https://github.com/advisories/GHSA-f4gw-2p7v-4548 — faixa reportada: `>=1.15.0 <1.18.0`; severidade do registro: moderate.
- https://github.com/advisories/GHSA-42h9-826w-cgv3 — faixa reportada: `>=1.0.0 <1.18.0`; severidade do registro: moderate.
- https://github.com/advisories/GHSA-hcpx-6fm6-wx23 — faixa reportada: `>=1.15.1 <1.18.0`; severidade do registro: moderate.

**Proposta (não aplicada):**

```text
// Atualizar axios ou o pacote pai que o resolve para versão fora de TODAS as faixas reportadas.
// Regenerar lockfiles em trabalho separado, conferir compatibilidade e não executar audit fix --force às cegas.
// Se houver salto maior (sharp, por exemplo), tratar breaking changes e formatos suportados antes de publicar.
```

**Aceite:** npm audit deixa de reportar os advisories listados para axios, ou há triagem documentada por advisory com prova de não alcance. Typechecks/testes e fluxos que dependem desse componente permanecem verdes.

**Verificação:** Em cada árvore afetada: npm audit --json --ignore-scripts --logs-max=0; npm explain axios; typecheck/testes da aplicação. Nenhum pacote foi instalado ou atualizado nesta auditoria.

### D03 — Atualizar baseline-browser-mapping nas arvores com alertas npm audit

**Prioridade:** low. **Etiqueta solicitada:** tech-debt.

**Evidência:** sistema/backend/package-lock.json:4492 (node_modules/baseline-browser-mapping 2.10.19; ferramenta de desenvolvimento); sistema/frontend/package-lock.json:2712 (node_modules/baseline-browser-mapping 2.10.19; ferramenta de desenvolvimento); sistema/admin/package-lock.json:2414 (node_modules/baseline-browser-mapping 2.10.19; ferramenta de desenvolvimento).

O npm audit consultado em 11/09/2026 identificou a versão resolvida de baseline-browser-mapping em faixa vulnerável. Os alertas específicos estão enumerados abaixo; a presença no lockfile não comprova exploração. O alcance depende do adaptador/caminho usado e das pré-condições do advisory; não foi executada exploração.

- https://github.com/advisories/GHSA-w5vr-8v7q-w6rv — faixa reportada: `>=2.0.0 <2.11.0`; severidade do registro: moderate.

**Proposta (não aplicada):**

```text
// Atualizar baseline-browser-mapping ou o pacote pai que o resolve para versão fora de TODAS as faixas reportadas.
// Regenerar lockfiles em trabalho separado, conferir compatibilidade e não executar audit fix --force às cegas.
// Se houver salto maior (sharp, por exemplo), tratar breaking changes e formatos suportados antes de publicar.
```

**Aceite:** npm audit deixa de reportar os advisories listados para baseline-browser-mapping, ou há triagem documentada por advisory com prova de não alcance. Typechecks/testes e fluxos que dependem desse componente permanecem verdes.

**Verificação:** Em cada árvore afetada: npm audit --json --ignore-scripts --logs-max=0; npm explain baseline-browser-mapping; typecheck/testes da aplicação. Nenhum pacote foi instalado ou atualizado nesta auditoria.

### D04 — Atualizar body-parser nas arvores com alertas npm audit

**Prioridade:** medium. **Etiqueta solicitada:** tech-debt.

**Evidência:** sistema/backend/package-lock.json:4537 (node_modules/body-parser 2.2.2; dependência de execução ou transitiva).

O npm audit consultado em 11/09/2026 identificou a versão resolvida de body-parser em faixa vulnerável. Os alertas específicos estão enumerados abaixo; a presença no lockfile não comprova exploração. O alcance depende do adaptador/caminho usado e das pré-condições do advisory; não foi executada exploração.

- https://github.com/advisories/GHSA-v422-hmwv-36x6 — faixa reportada: `>=2.0.0 <2.3.0`; severidade do registro: low.

**Proposta (não aplicada):**

```text
// Atualizar body-parser ou o pacote pai que o resolve para versão fora de TODAS as faixas reportadas.
// Regenerar lockfiles em trabalho separado, conferir compatibilidade e não executar audit fix --force às cegas.
// Se houver salto maior (sharp, por exemplo), tratar breaking changes e formatos suportados antes de publicar.
```

**Aceite:** npm audit deixa de reportar os advisories listados para body-parser, ou há triagem documentada por advisory com prova de não alcance. Typechecks/testes e fluxos que dependem desse componente permanecem verdes.

**Verificação:** Em cada árvore afetada: npm audit --json --ignore-scripts --logs-max=0; npm explain body-parser; typecheck/testes da aplicação. Nenhum pacote foi instalado ou atualizado nesta auditoria.

### D05 — Atualizar brace-expansion nas arvores com alertas npm audit

**Prioridade:** medium. **Etiqueta solicitada:** tech-debt.

**Evidência:** sistema/backend/package-lock.json:870 (node_modules/@eslint/eslintrc/node_modules/brace-expansion 1.1.14; ferramenta de desenvolvimento); sistema/backend/package-lock.json:927 (node_modules/@humanwhocodes/config-array/node_modules/brace-expansion 1.1.14; ferramenta de desenvolvimento); sistema/backend/package-lock.json:2146 (node_modules/@jest/reporters/node_modules/brace-expansion 1.1.14; ferramenta de desenvolvimento); sistema/backend/package-lock.json:4578 (node_modules/brace-expansion 2.1.0; ferramenta de desenvolvimento); sistema/backend/package-lock.json:5929 (node_modules/eslint/node_modules/brace-expansion 1.1.14; ferramenta de desenvolvimento); sistema/backend/package-lock.json:6494 (node_modules/fork-ts-checker-webpack-plugin/node_modules/brace-expansion 1.1.15; ferramenta de desenvolvimento); sistema/backend/package-lock.json:6757 (node_modules/glob/node_modules/brace-expansion 5.0.6; ferramenta de desenvolvimento); sistema/backend/package-lock.json:7536 (node_modules/jest-config/node_modules/brace-expansion 1.1.14; ferramenta de desenvolvimento); sistema/backend/package-lock.json:7899 (node_modules/jest-runtime/node_modules/brace-expansion 1.1.14; ferramenta de desenvolvimento); sistema/backend/package-lock.json:9869 (node_modules/rimraf/node_modules/brace-expansion 1.1.14; ferramenta de desenvolvimento); sistema/backend/package-lock.json:10901 (node_modules/test-exclude/node_modules/brace-expansion 1.1.14; ferramenta de desenvolvimento); sistema/frontend/package-lock.json:1149 (node_modules/@eslint/eslintrc/node_modules/brace-expansion 1.1.14; ferramenta de desenvolvimento); sistema/frontend/package-lock.json:1271 (node_modules/@humanwhocodes/config-array/node_modules/brace-expansion 1.1.14; ferramenta de desenvolvimento); sistema/frontend/package-lock.json:2772 (node_modules/brace-expansion 2.1.1; ferramenta de desenvolvimento); sistema/frontend/package-lock.json:3950 (node_modules/eslint/node_modules/brace-expansion 1.1.14; ferramenta de desenvolvimento); sistema/frontend/package-lock.json:4514 (node_modules/glob/node_modules/brace-expansion 1.1.14; ferramenta de desenvolvimento); sistema/admin/package-lock.json:918 (node_modules/@eslint/eslintrc/node_modules/brace-expansion 1.1.14; ferramenta de desenvolvimento); sistema/admin/package-lock.json:1022 (node_modules/@humanwhocodes/config-array/node_modules/brace-expansion 1.1.14; ferramenta de desenvolvimento); sistema/admin/package-lock.json:2464 (node_modules/brace-expansion 2.1.1; ferramenta de desenvolvimento); sistema/admin/package-lock.json:3452 (node_modules/eslint/node_modules/brace-expansion 1.1.14; ferramenta de desenvolvimento); sistema/admin/package-lock.json:3982 (node_modules/glob/node_modules/brace-expansion 1.1.14; ferramenta de desenvolvimento).

O npm audit consultado em 11/09/2026 identificou a versão resolvida de brace-expansion em faixa vulnerável. Os alertas específicos estão enumerados abaixo; a presença no lockfile não comprova exploração. O alcance depende do adaptador/caminho usado e das pré-condições do advisory; não foi executada exploração.

- https://github.com/advisories/GHSA-3jxr-9vmj-r5cp — faixa reportada: `>=2.0.0 <2.1.2`; severidade do registro: high.
- https://github.com/advisories/GHSA-3jxr-9vmj-r5cp — faixa reportada: `<1.1.16`; severidade do registro: high.
- https://github.com/advisories/GHSA-3jxr-9vmj-r5cp — faixa reportada: `>=3.0.0 <5.0.7`; severidade do registro: high.
- https://github.com/advisories/GHSA-mh99-v99m-4gvg — faixa reportada: `<1.1.17`; severidade do registro: high.
- https://github.com/advisories/GHSA-mh99-v99m-4gvg — faixa reportada: `>=2.0.0 <2.1.3`; severidade do registro: high.
- https://github.com/advisories/GHSA-mh99-v99m-4gvg — faixa reportada: `>=4.0.0 <5.0.8`; severidade do registro: high.
- https://github.com/advisories/GHSA-rgw5-rvv9-x895 — faixa reportada: `>=4.0.0 <5.0.9`; severidade do registro: high.
- https://github.com/advisories/GHSA-rgw5-rvv9-x895 — faixa reportada: `>=2.0.0 <2.1.4`; severidade do registro: high.
- https://github.com/advisories/GHSA-rgw5-rvv9-x895 — faixa reportada: `<1.1.18`; severidade do registro: high.

**Proposta (não aplicada):**

```text
// Atualizar brace-expansion ou o pacote pai que o resolve para versão fora de TODAS as faixas reportadas.
// Regenerar lockfiles em trabalho separado, conferir compatibilidade e não executar audit fix --force às cegas.
// Se houver salto maior (sharp, por exemplo), tratar breaking changes e formatos suportados antes de publicar.
```

**Aceite:** npm audit deixa de reportar os advisories listados para brace-expansion, ou há triagem documentada por advisory com prova de não alcance. Typechecks/testes e fluxos que dependem desse componente permanecem verdes.

**Verificação:** Em cada árvore afetada: npm audit --json --ignore-scripts --logs-max=0; npm explain brace-expansion; typecheck/testes da aplicação. Nenhum pacote foi instalado ou atualizado nesta auditoria.

### D06 — Atualizar browserslist nas arvores com alertas npm audit

**Prioridade:** medium. **Etiqueta solicitada:** tech-debt.

**Evidência:** sistema/backend/package-lock.json:4601 (node_modules/browserslist 4.28.2; ferramenta de desenvolvimento); sistema/frontend/package-lock.json:2795 (node_modules/browserslist 4.28.2; ferramenta de desenvolvimento); sistema/admin/package-lock.json:2487 (node_modules/browserslist 4.28.2; ferramenta de desenvolvimento).

O npm audit consultado em 11/09/2026 identificou a versão resolvida de browserslist em faixa vulnerável. Os alertas específicos estão enumerados abaixo; a presença no lockfile não comprova exploração. O alcance depende do adaptador/caminho usado e das pré-condições do advisory; não foi executada exploração.

- https://github.com/advisories/GHSA-c83g-rgw3-j3cx — faixa reportada: `<=4.28.6`; severidade do registro: high.
- https://github.com/advisories/GHSA-73wf-gq98-2v4g — faixa reportada: `<=4.28.6`; severidade do registro: high.

**Proposta (não aplicada):**

```text
// Atualizar browserslist ou o pacote pai que o resolve para versão fora de TODAS as faixas reportadas.
// Regenerar lockfiles em trabalho separado, conferir compatibilidade e não executar audit fix --force às cegas.
// Se houver salto maior (sharp, por exemplo), tratar breaking changes e formatos suportados antes de publicar.
```

**Aceite:** npm audit deixa de reportar os advisories listados para browserslist, ou há triagem documentada por advisory com prova de não alcance. Typechecks/testes e fluxos que dependem desse componente permanecem verdes.

**Verificação:** Em cada árvore afetada: npm audit --json --ignore-scripts --logs-max=0; npm explain browserslist; typecheck/testes da aplicação. Nenhum pacote foi instalado ou atualizado nesta auditoria.

### D07 — Atualizar fast-uri nas arvores com alertas npm audit

**Prioridade:** medium. **Etiqueta solicitada:** tech-debt.

**Evidência:** sistema/backend/package-lock.json:6276 (node_modules/fast-uri 3.1.2; ferramenta de desenvolvimento).

O npm audit consultado em 11/09/2026 identificou a versão resolvida de fast-uri em faixa vulnerável. Os alertas específicos estão enumerados abaixo; a presença no lockfile não comprova exploração. O alcance depende do adaptador/caminho usado e das pré-condições do advisory; não foi executada exploração.

- https://github.com/advisories/GHSA-v2hh-gcrm-f6hx — faixa reportada: `>=3.0.0 <=3.1.3`; severidade do registro: high.
- https://github.com/advisories/GHSA-7p8r-x3mc-p8w7 — faixa reportada: `>=3.0.0 <3.1.5`; severidade do registro: high.
- https://github.com/advisories/GHSA-f65p-4m7j-42xc — faixa reportada: `>=3.0.0 <3.1.6`; severidade do registro: high.
- https://github.com/advisories/GHSA-fph4-wmhf-6fwf — faixa reportada: `>=3.1.2 <3.1.6`; severidade do registro: high.
- https://github.com/advisories/GHSA-jqff-g426-hqxp — faixa reportada: `>=3.0.0 <3.1.6`; severidade do registro: high.
- https://github.com/advisories/GHSA-4c8g-83qw-93j6 — faixa reportada: `>=3.0.0 <3.1.3`; severidade do registro: high.

**Proposta (não aplicada):**

```text
// Atualizar fast-uri ou o pacote pai que o resolve para versão fora de TODAS as faixas reportadas.
// Regenerar lockfiles em trabalho separado, conferir compatibilidade e não executar audit fix --force às cegas.
// Se houver salto maior (sharp, por exemplo), tratar breaking changes e formatos suportados antes de publicar.
```

**Aceite:** npm audit deixa de reportar os advisories listados para fast-uri, ou há triagem documentada por advisory com prova de não alcance. Typechecks/testes e fluxos que dependem desse componente permanecem verdes.

**Verificação:** Em cada árvore afetada: npm audit --json --ignore-scripts --logs-max=0; npm explain fast-uri; typecheck/testes da aplicação. Nenhum pacote foi instalado ou atualizado nesta auditoria.

### D08 — Atualizar form-data nas arvores com alertas npm audit

**Prioridade:** medium. **Etiqueta solicitada:** tech-debt.

**Evidência:** sistema/backend/package-lock.json:6518 (node_modules/form-data 4.0.5; dependência de execução ou transitiva); sistema/frontend/package-lock.json:4282 (node_modules/form-data 4.0.5; dependência de execução ou transitiva); sistema/admin/package-lock.json:3784 (node_modules/form-data 4.0.5; dependência de execução ou transitiva).

O npm audit consultado em 11/09/2026 identificou a versão resolvida de form-data em faixa vulnerável. Os alertas específicos estão enumerados abaixo; a presença no lockfile não comprova exploração. O alcance depende do adaptador/caminho usado e das pré-condições do advisory; não foi executada exploração.

- https://github.com/advisories/GHSA-hmw2-7cc7-3qxx — faixa reportada: `>=4.0.0 <4.0.6`; severidade do registro: high.

**Proposta (não aplicada):**

```text
// Atualizar form-data ou o pacote pai que o resolve para versão fora de TODAS as faixas reportadas.
// Regenerar lockfiles em trabalho separado, conferir compatibilidade e não executar audit fix --force às cegas.
// Se houver salto maior (sharp, por exemplo), tratar breaking changes e formatos suportados antes de publicar.
```

**Aceite:** npm audit deixa de reportar os advisories listados para form-data, ou há triagem documentada por advisory com prova de não alcance. Typechecks/testes e fluxos que dependem desse componente permanecem verdes.

**Verificação:** Em cada árvore afetada: npm audit --json --ignore-scripts --logs-max=0; npm explain form-data; typecheck/testes da aplicação. Nenhum pacote foi instalado ou atualizado nesta auditoria.

### D09 — Atualizar js-yaml nas arvores com alertas npm audit

**Prioridade:** medium. **Etiqueta solicitada:** tech-debt.

**Evidência:** sistema/backend/package-lock.json:1883 (node_modules/@istanbuljs/load-nyc-config/node_modules/js-yaml 3.14.2; ferramenta de desenvolvimento); sistema/backend/package-lock.json:8098 (node_modules/js-yaml 4.1.1; dependência de execução ou transitiva); sistema/frontend/package-lock.json:5147 (node_modules/js-yaml 4.1.1; ferramenta de desenvolvimento); sistema/admin/package-lock.json:4476 (node_modules/js-yaml 4.1.1; ferramenta de desenvolvimento).

O npm audit consultado em 11/09/2026 identificou a versão resolvida de js-yaml em faixa vulnerável. Os alertas específicos estão enumerados abaixo; a presença no lockfile não comprova exploração. O alcance depende do adaptador/caminho usado e das pré-condições do advisory; não foi executada exploração.

- https://github.com/advisories/GHSA-h67p-54hq-rp68 — faixa reportada: `<3.15.0`; severidade do registro: moderate.
- https://github.com/advisories/GHSA-h67p-54hq-rp68 — faixa reportada: `>=4.0.0 <=4.1.1`; severidade do registro: moderate.
- https://github.com/advisories/GHSA-52cp-r559-cp3m — faixa reportada: `>=4.0.0 <4.3.0`; severidade do registro: high.
- https://github.com/advisories/GHSA-52cp-r559-cp3m — faixa reportada: `>=3.0.0 <3.15.0`; severidade do registro: high.
- https://github.com/advisories/GHSA-5p4m-2wfm-xmqj — faixa reportada: `>=3.0.0 <3.15.1`; severidade do registro: high.
- https://github.com/advisories/GHSA-5p4m-2wfm-xmqj — faixa reportada: `>=4.0.0 <4.3.1`; severidade do registro: high.
- https://github.com/advisories/GHSA-2883-xcg3-v3hh — faixa reportada: `>=3.0.0 <3.15.2`; severidade do registro: high.
- https://github.com/advisories/GHSA-2883-xcg3-v3hh — faixa reportada: `>=4.0.0 <4.3.2`; severidade do registro: high.

**Proposta (não aplicada):**

```text
// Atualizar js-yaml ou o pacote pai que o resolve para versão fora de TODAS as faixas reportadas.
// Regenerar lockfiles em trabalho separado, conferir compatibilidade e não executar audit fix --force às cegas.
// Se houver salto maior (sharp, por exemplo), tratar breaking changes e formatos suportados antes de publicar.
```

**Aceite:** npm audit deixa de reportar os advisories listados para js-yaml, ou há triagem documentada por advisory com prova de não alcance. Typechecks/testes e fluxos que dependem desse componente permanecem verdes.

**Verificação:** Em cada árvore afetada: npm audit --json --ignore-scripts --logs-max=0; npm explain js-yaml; typecheck/testes da aplicação. Nenhum pacote foi instalado ou atualizado nesta auditoria.

### D10 — Atualizar multer nas arvores com alertas npm audit

**Prioridade:** high. **Etiqueta solicitada:** tech-debt.

**Evidência:** sistema/backend/package-lock.json:8697 (node_modules/multer 2.1.1; dependência de execução ou transitiva).

O npm audit consultado em 11/09/2026 identificou a versão resolvida de multer em faixa vulnerável. Os alertas específicos estão enumerados abaixo; a presença no lockfile não comprova exploração. A API usa upload/processamento de imagens, aumentando a relevância da dependência em execução.

- https://github.com/advisories/GHSA-72gw-mp4g-v24j — faixa reportada: `>=1.0.0 <2.2.0`; severidade do registro: high.
- https://github.com/advisories/GHSA-3p4h-7m6x-2hcm — faixa reportada: `>=2.0.0-alpha.1 <2.2.0`; severidade do registro: moderate.
- https://github.com/advisories/GHSA-wc9g-mqfw-jrwm — faixa reportada: `<2.3.0`; severidade do registro: high.
- https://github.com/advisories/GHSA-qvfw-j98x-7q72 — faixa reportada: `<2.3.0`; severidade do registro: low.
- https://github.com/advisories/GHSA-535w-7cp7-47q4 — faixa reportada: `<2.3.0`; severidade do registro: high.

**Proposta (não aplicada):**

```text
// Atualizar multer ou o pacote pai que o resolve para versão fora de TODAS as faixas reportadas.
// Regenerar lockfiles em trabalho separado, conferir compatibilidade e não executar audit fix --force às cegas.
// Se houver salto maior (sharp, por exemplo), tratar breaking changes e formatos suportados antes de publicar.
```

**Aceite:** npm audit deixa de reportar os advisories listados para multer, ou há triagem documentada por advisory com prova de não alcance. Typechecks/testes e fluxos que dependem desse componente permanecem verdes.

**Verificação:** Em cada árvore afetada: npm audit --json --ignore-scripts --logs-max=0; npm explain multer; typecheck/testes da aplicação. Nenhum pacote foi instalado ou atualizado nesta auditoria.

### D11 — Atualizar qs nas arvores com alertas npm audit

**Prioridade:** medium. **Etiqueta solicitada:** tech-debt.

**Evidência:** sistema/backend/package-lock.json:9596 (node_modules/qs 6.15.2; dependência de execução ou transitiva); sistema/frontend/package-lock.json:6384 (node_modules/qs 6.15.2; ferramenta de desenvolvimento); sistema/admin/package-lock.json:5531 (node_modules/qs 6.15.2; ferramenta de desenvolvimento).

O npm audit consultado em 11/09/2026 identificou a versão resolvida de qs em faixa vulnerável. Os alertas específicos estão enumerados abaixo; a presença no lockfile não comprova exploração. O alcance depende do adaptador/caminho usado e das pré-condições do advisory; não foi executada exploração.

- https://github.com/advisories/GHSA-x5fp-wj9c-mxmx — faixa reportada: `>=6.14.2 <=6.15.3`; severidade do registro: moderate.
- https://github.com/advisories/GHSA-4mjr-xmp4-gh2g — faixa reportada: `>=2.2.5 <6.16.0`; severidade do registro: moderate.

**Proposta (não aplicada):**

```text
// Atualizar qs ou o pacote pai que o resolve para versão fora de TODAS as faixas reportadas.
// Regenerar lockfiles em trabalho separado, conferir compatibilidade e não executar audit fix --force às cegas.
// Se houver salto maior (sharp, por exemplo), tratar breaking changes e formatos suportados antes de publicar.
```

**Aceite:** npm audit deixa de reportar os advisories listados para qs, ou há triagem documentada por advisory com prova de não alcance. Typechecks/testes e fluxos que dependem desse componente permanecem verdes.

**Verificação:** Em cada árvore afetada: npm audit --json --ignore-scripts --logs-max=0; npm explain qs; typecheck/testes da aplicação. Nenhum pacote foi instalado ou atualizado nesta auditoria.

### D12 — Atualizar sharp nas arvores com alertas npm audit

**Prioridade:** high. **Etiqueta solicitada:** tech-debt.

**Evidência:** sistema/backend/package-lock.json:10171 (node_modules/sharp 0.34.5; dependência de execução ou transitiva).

O npm audit consultado em 11/09/2026 identificou a versão resolvida de sharp em faixa vulnerável. Os alertas específicos estão enumerados abaixo; a presença no lockfile não comprova exploração. A API usa upload/processamento de imagens, aumentando a relevância da dependência em execução.

- https://github.com/advisories/GHSA-f88m-g3jw-g9cj — faixa reportada: `<0.35.0`; severidade do registro: high.
- https://github.com/advisories/GHSA-rgj7-g3m4-5g8c — faixa reportada: `<0.35.4`; severidade do registro: high.

**Proposta (não aplicada):**

```text
// Atualizar sharp ou o pacote pai que o resolve para versão fora de TODAS as faixas reportadas.
// Regenerar lockfiles em trabalho separado, conferir compatibilidade e não executar audit fix --force às cegas.
// Se houver salto maior (sharp, por exemplo), tratar breaking changes e formatos suportados antes de publicar.
```

**Aceite:** npm audit deixa de reportar os advisories listados para sharp, ou há triagem documentada por advisory com prova de não alcance. Typechecks/testes e fluxos que dependem desse componente permanecem verdes.

**Verificação:** Em cada árvore afetada: npm audit --json --ignore-scripts --logs-max=0; npm explain sharp; typecheck/testes da aplicação. Nenhum pacote foi instalado ou atualizado nesta auditoria.

### D13 — Atualizar socket.io-parser nas arvores com alertas npm audit

**Prioridade:** medium. **Etiqueta solicitada:** tech-debt.

**Evidência:** sistema/backend/package-lock.json:10385 (node_modules/socket.io-parser 4.2.6; dependência de execução ou transitiva).

O npm audit consultado em 11/09/2026 identificou a versão resolvida de socket.io-parser em faixa vulnerável. Os alertas específicos estão enumerados abaixo; a presença no lockfile não comprova exploração. O alcance depende do adaptador/caminho usado e das pré-condições do advisory; não foi executada exploração.

- https://github.com/advisories/GHSA-2m8v-j782-fhvr — faixa reportada: `>=4.0.0 <4.2.7`; severidade do registro: high.

**Proposta (não aplicada):**

```text
// Atualizar socket.io-parser ou o pacote pai que o resolve para versão fora de TODAS as faixas reportadas.
// Regenerar lockfiles em trabalho separado, conferir compatibilidade e não executar audit fix --force às cegas.
// Se houver salto maior (sharp, por exemplo), tratar breaking changes e formatos suportados antes de publicar.
```

**Aceite:** npm audit deixa de reportar os advisories listados para socket.io-parser, ou há triagem documentada por advisory com prova de não alcance. Typechecks/testes e fluxos que dependem desse componente permanecem verdes.

**Verificação:** Em cada árvore afetada: npm audit --json --ignore-scripts --logs-max=0; npm explain socket.io-parser; typecheck/testes da aplicação. Nenhum pacote foi instalado ou atualizado nesta auditoria.

### D14 — Atualizar ws nas arvores com alertas npm audit

**Prioridade:** medium. **Etiqueta solicitada:** tech-debt.

**Evidência:** sistema/backend/package-lock.json:11799 (node_modules/ws 8.20.1; dependência de execução ou transitiva).

O npm audit consultado em 11/09/2026 identificou a versão resolvida de ws em faixa vulnerável. Os alertas específicos estão enumerados abaixo; a presença no lockfile não comprova exploração. O alcance depende do adaptador/caminho usado e das pré-condições do advisory; não foi executada exploração.

- https://github.com/advisories/GHSA-96hv-2xvq-fx4p — faixa reportada: `>=8.0.0 <8.21.0`; severidade do registro: high.

**Proposta (não aplicada):**

```text
// Atualizar ws ou o pacote pai que o resolve para versão fora de TODAS as faixas reportadas.
// Regenerar lockfiles em trabalho separado, conferir compatibilidade e não executar audit fix --force às cegas.
// Se houver salto maior (sharp, por exemplo), tratar breaking changes e formatos suportados antes de publicar.
```

**Aceite:** npm audit deixa de reportar os advisories listados para ws, ou há triagem documentada por advisory com prova de não alcance. Typechecks/testes e fluxos que dependem desse componente permanecem verdes.

**Verificação:** Em cada árvore afetada: npm audit --json --ignore-scripts --logs-max=0; npm explain ws; typecheck/testes da aplicação. Nenhum pacote foi instalado ou atualizado nesta auditoria.

### D15 — Atualizar @remix-run/router nas arvores com alertas npm audit

**Prioridade:** medium. **Etiqueta solicitada:** tech-debt.

**Evidência:** sistema/frontend/package-lock.json:1405 (node_modules/@remix-run/router 1.23.2; dependência de execução ou transitiva); sistema/admin/package-lock.json:1189 (node_modules/@remix-run/router 1.23.2; dependência de execução ou transitiva).

O npm audit consultado em 11/09/2026 identificou a versão resolvida de @remix-run/router em faixa vulnerável. Os alertas específicos estão enumerados abaixo; a presença no lockfile não comprova exploração. O alcance depende do adaptador/caminho usado e das pré-condições do advisory; não foi executada exploração.

- https://github.com/advisories/GHSA-2j2x-hqr9-3h42 — faixa reportada: `>=1.3.0 <1.23.3`; severidade do registro: moderate.

**Proposta (não aplicada):**

```text
// Atualizar @remix-run/router ou o pacote pai que o resolve para versão fora de TODAS as faixas reportadas.
// Regenerar lockfiles em trabalho separado, conferir compatibilidade e não executar audit fix --force às cegas.
// Se houver salto maior (sharp, por exemplo), tratar breaking changes e formatos suportados antes de publicar.
```

**Aceite:** npm audit deixa de reportar os advisories listados para @remix-run/router, ou há triagem documentada por advisory com prova de não alcance. Typechecks/testes e fluxos que dependem desse componente permanecem verdes.

**Verificação:** Em cada árvore afetada: npm audit --json --ignore-scripts --logs-max=0; npm explain @remix-run/router; typecheck/testes da aplicação. Nenhum pacote foi instalado ou atualizado nesta auditoria.

### D16 — Atualizar @vitest/mocker nas arvores com alertas npm audit

**Prioridade:** medium. **Etiqueta solicitada:** tech-debt.

**Evidência:** sistema/frontend/package-lock.json:7955 (node_modules/vitest/node_modules/@vitest/mocker 4.1.5; ferramenta de desenvolvimento).

O npm audit consultado em 11/09/2026 identificou a versão resolvida de @vitest/mocker em faixa vulnerável. Os alertas específicos estão enumerados abaixo; a presença no lockfile não comprova exploração. O alcance depende do adaptador/caminho usado e das pré-condições do advisory; não foi executada exploração.

- https://github.com/advisories/GHSA-82fw-gwwq-j7x9 — faixa reportada: `>=2.1.0 <4.1.11`; severidade do registro: moderate.

**Proposta (não aplicada):**

```text
// Atualizar @vitest/mocker ou o pacote pai que o resolve para versão fora de TODAS as faixas reportadas.
// Regenerar lockfiles em trabalho separado, conferir compatibilidade e não executar audit fix --force às cegas.
// Se houver salto maior (sharp, por exemplo), tratar breaking changes e formatos suportados antes de publicar.
```

**Aceite:** npm audit deixa de reportar os advisories listados para @vitest/mocker, ou há triagem documentada por advisory com prova de não alcance. Typechecks/testes e fluxos que dependem desse componente permanecem verdes.

**Verificação:** Em cada árvore afetada: npm audit --json --ignore-scripts --logs-max=0; npm explain @vitest/mocker; typecheck/testes da aplicação. Nenhum pacote foi instalado ou atualizado nesta auditoria.

### D17 — Atualizar esbuild nas arvores com alertas npm audit

**Prioridade:** low. **Etiqueta solicitada:** tech-debt.

**Evidência:** sistema/frontend/package-lock.json:3775 (node_modules/esbuild 0.27.7; ferramenta de desenvolvimento); sistema/admin/package-lock.json:3277 (node_modules/esbuild 0.27.7; ferramenta de desenvolvimento).

O npm audit consultado em 11/09/2026 identificou a versão resolvida de esbuild em faixa vulnerável. Os alertas específicos estão enumerados abaixo; a presença no lockfile não comprova exploração. O alcance depende do adaptador/caminho usado e das pré-condições do advisory; não foi executada exploração.

- https://github.com/advisories/GHSA-g7r4-m6w7-qqqr — faixa reportada: `>=0.27.3 <0.28.1`; severidade do registro: low.

**Proposta (não aplicada):**

```text
// Atualizar esbuild ou o pacote pai que o resolve para versão fora de TODAS as faixas reportadas.
// Regenerar lockfiles em trabalho separado, conferir compatibilidade e não executar audit fix --force às cegas.
// Se houver salto maior (sharp, por exemplo), tratar breaking changes e formatos suportados antes de publicar.
```

**Aceite:** npm audit deixa de reportar os advisories listados para esbuild, ou há triagem documentada por advisory com prova de não alcance. Typechecks/testes e fluxos que dependem desse componente permanecem verdes.

**Verificação:** Em cada árvore afetada: npm audit --json --ignore-scripts --logs-max=0; npm explain esbuild; typecheck/testes da aplicação. Nenhum pacote foi instalado ou atualizado nesta auditoria.

### D18 — Atualizar joi nas arvores com alertas npm audit

**Prioridade:** medium. **Etiqueta solicitada:** tech-debt.

**Evidência:** sistema/frontend/package-lock.json:5122 (node_modules/joi 18.1.2; ferramenta de desenvolvimento); sistema/admin/package-lock.json:4451 (node_modules/joi 18.1.2; ferramenta de desenvolvimento).

O npm audit consultado em 11/09/2026 identificou a versão resolvida de joi em faixa vulnerável. Os alertas específicos estão enumerados abaixo; a presença no lockfile não comprova exploração. O alcance depende do adaptador/caminho usado e das pré-condições do advisory; não foi executada exploração.

- https://github.com/advisories/GHSA-q7cg-457f-vx79 — faixa reportada: `>=18.0.0 <18.2.1`; severidade do registro: moderate.
- https://github.com/advisories/GHSA-6w3j-5fw6-r9vr — faixa reportada: `>=18.0.0 <18.2.5`; severidade do registro: low.
- https://github.com/advisories/GHSA-gg4h-3hg2-grpc — faixa reportada: `>=18.0.0 <18.2.4`; severidade do registro: low.

**Proposta (não aplicada):**

```text
// Atualizar joi ou o pacote pai que o resolve para versão fora de TODAS as faixas reportadas.
// Regenerar lockfiles em trabalho separado, conferir compatibilidade e não executar audit fix --force às cegas.
// Se houver salto maior (sharp, por exemplo), tratar breaking changes e formatos suportados antes de publicar.
```

**Aceite:** npm audit deixa de reportar os advisories listados para joi, ou há triagem documentada por advisory com prova de não alcance. Typechecks/testes e fluxos que dependem desse componente permanecem verdes.

**Verificação:** Em cada árvore afetada: npm audit --json --ignore-scripts --logs-max=0; npm explain joi; typecheck/testes da aplicação. Nenhum pacote foi instalado ou atualizado nesta auditoria.

### D19 — Atualizar nanoid nas arvores com alertas npm audit

**Prioridade:** medium. **Etiqueta solicitada:** tech-debt.

**Evidência:** sistema/frontend/package-lock.json:5777 (node_modules/nanoid 3.3.11; ferramenta de desenvolvimento); sistema/admin/package-lock.json:4988 (node_modules/nanoid 3.3.11; ferramenta de desenvolvimento); sistema/picking-app/package-lock.json:2329 (node_modules/nanoid 3.3.16; ferramenta de desenvolvimento); sistema/delivery-app/package-lock.json:2293 (node_modules/nanoid 3.3.16; ferramenta de desenvolvimento).

O npm audit consultado em 11/09/2026 identificou a versão resolvida de nanoid em faixa vulnerável. Os alertas específicos estão enumerados abaixo; a presença no lockfile não comprova exploração. O alcance depende do adaptador/caminho usado e das pré-condições do advisory; não foi executada exploração.

- https://github.com/advisories/GHSA-28wg-ghj8-5hjv — faixa reportada: `<3.3.16`; severidade do registro: high.
- https://github.com/advisories/GHSA-2v37-7h3g-55p8 — faixa reportada: `<3.3.18`; severidade do registro: high.
- https://github.com/advisories/GHSA-xwg4-73v4-xw9w — faixa reportada: `<3.3.12`; severidade do registro: high.

**Proposta (não aplicada):**

```text
// Atualizar nanoid ou o pacote pai que o resolve para versão fora de TODAS as faixas reportadas.
// Regenerar lockfiles em trabalho separado, conferir compatibilidade e não executar audit fix --force às cegas.
// Se houver salto maior (sharp, por exemplo), tratar breaking changes e formatos suportados antes de publicar.
```

**Aceite:** npm audit deixa de reportar os advisories listados para nanoid, ou há triagem documentada por advisory com prova de não alcance. Typechecks/testes e fluxos que dependem desse componente permanecem verdes.

**Verificação:** Em cada árvore afetada: npm audit --json --ignore-scripts --logs-max=0; npm explain nanoid; typecheck/testes da aplicação. Nenhum pacote foi instalado ou atualizado nesta auditoria.

### D20 — Atualizar postcss nas arvores com alertas npm audit

**Prioridade:** medium. **Etiqueta solicitada:** tech-debt.

**Evidência:** sistema/frontend/package-lock.json:6115 (node_modules/postcss 8.5.10; ferramenta de desenvolvimento); sistema/admin/package-lock.json:5294 (node_modules/postcss 8.5.10; ferramenta de desenvolvimento).

O npm audit consultado em 11/09/2026 identificou a versão resolvida de postcss em faixa vulnerável. Os alertas específicos estão enumerados abaixo; a presença no lockfile não comprova exploração. O alcance depende do adaptador/caminho usado e das pré-condições do advisory; não foi executada exploração.

- https://github.com/advisories/GHSA-6g55-p6wh-862q — faixa reportada: `<=8.5.11`; severidade do registro: high.
- https://github.com/advisories/GHSA-fxqj-rqcc-2cmp — faixa reportada: `<=8.5.22`; severidade do registro: moderate.
- https://github.com/advisories/GHSA-r28c-9q8g-f849 — faixa reportada: `<=8.5.17`; severidade do registro: high.

**Proposta (não aplicada):**

```text
// Atualizar postcss ou o pacote pai que o resolve para versão fora de TODAS as faixas reportadas.
// Regenerar lockfiles em trabalho separado, conferir compatibilidade e não executar audit fix --force às cegas.
// Se houver salto maior (sharp, por exemplo), tratar breaking changes e formatos suportados antes de publicar.
```

**Aceite:** npm audit deixa de reportar os advisories listados para postcss, ou há triagem documentada por advisory com prova de não alcance. Typechecks/testes e fluxos que dependem desse componente permanecem verdes.

**Verificação:** Em cada árvore afetada: npm audit --json --ignore-scripts --logs-max=0; npm explain postcss; typecheck/testes da aplicação. Nenhum pacote foi instalado ou atualizado nesta auditoria.

### D21 — Atualizar postcss-selector-parser nas arvores com alertas npm audit

**Prioridade:** low. **Etiqueta solicitada:** tech-debt.

**Evidência:** sistema/frontend/package-lock.json:6257 (node_modules/postcss-selector-parser 6.1.2; ferramenta de desenvolvimento); sistema/admin/package-lock.json:5436 (node_modules/postcss-selector-parser 6.1.2; ferramenta de desenvolvimento).

O npm audit consultado em 11/09/2026 identificou a versão resolvida de postcss-selector-parser em faixa vulnerável. Os alertas específicos estão enumerados abaixo; a presença no lockfile não comprova exploração. O alcance depende do adaptador/caminho usado e das pré-condições do advisory; não foi executada exploração.

- https://github.com/advisories/GHSA-w9m9-85wc-3x92 — faixa reportada: `>=6.1.0 <6.1.3`; severidade do registro: low.

**Proposta (não aplicada):**

```text
// Atualizar postcss-selector-parser ou o pacote pai que o resolve para versão fora de TODAS as faixas reportadas.
// Regenerar lockfiles em trabalho separado, conferir compatibilidade e não executar audit fix --force às cegas.
// Se houver salto maior (sharp, por exemplo), tratar breaking changes e formatos suportados antes de publicar.
```

**Aceite:** npm audit deixa de reportar os advisories listados para postcss-selector-parser, ou há triagem documentada por advisory com prova de não alcance. Typechecks/testes e fluxos que dependem desse componente permanecem verdes.

**Verificação:** Em cada árvore afetada: npm audit --json --ignore-scripts --logs-max=0; npm explain postcss-selector-parser; typecheck/testes da aplicação. Nenhum pacote foi instalado ou atualizado nesta auditoria.

### D22 — Atualizar react-router nas arvores com alertas npm audit

**Prioridade:** medium. **Etiqueta solicitada:** tech-debt.

**Evidência:** sistema/frontend/package-lock.json:6501 (node_modules/react-router 6.30.3; dependência de execução ou transitiva); sistema/admin/package-lock.json:5639 (node_modules/react-router 6.30.3; dependência de execução ou transitiva).

O npm audit consultado em 11/09/2026 identificou a versão resolvida de react-router em faixa vulnerável. Os alertas específicos estão enumerados abaixo; a presença no lockfile não comprova exploração. O alcance depende do adaptador/caminho usado e das pré-condições do advisory; não foi executada exploração.

- https://github.com/advisories/GHSA-wrjc-x8rr-h8h6 — faixa reportada: `>=6.0.0 <7.18.0`; severidade do registro: moderate.
- https://github.com/advisories/GHSA-337j-9hxr-rhxg — faixa reportada: `>=6.4.0 <7.18.0`; severidade do registro: moderate.
- https://github.com/advisories/GHSA-2j2x-hqr9-3h42 — faixa reportada: `>=6.7.0 <6.30.4`; severidade do registro: moderate.

**Proposta (não aplicada):**

```text
// Atualizar react-router ou o pacote pai que o resolve para versão fora de TODAS as faixas reportadas.
// Regenerar lockfiles em trabalho separado, conferir compatibilidade e não executar audit fix --force às cegas.
// Se houver salto maior (sharp, por exemplo), tratar breaking changes e formatos suportados antes de publicar.
```

**Aceite:** npm audit deixa de reportar os advisories listados para react-router, ou há triagem documentada por advisory com prova de não alcance. Typechecks/testes e fluxos que dependem desse componente permanecem verdes.

**Verificação:** Em cada árvore afetada: npm audit --json --ignore-scripts --logs-max=0; npm explain react-router; typecheck/testes da aplicação. Nenhum pacote foi instalado ou atualizado nesta auditoria.

### D23 — Atualizar react-router-dom nas arvores com alertas npm audit

**Prioridade:** medium. **Etiqueta solicitada:** tech-debt.

**Evidência:** sistema/frontend/package-lock.json:6516 (node_modules/react-router-dom 6.30.3; dependência de execução ou transitiva); sistema/admin/package-lock.json:5654 (node_modules/react-router-dom 6.30.3; dependência de execução ou transitiva).

O npm audit consultado em 11/09/2026 identificou a versão resolvida de react-router-dom em faixa vulnerável. Os alertas específicos estão enumerados abaixo; a presença no lockfile não comprova exploração. O alcance depende do adaptador/caminho usado e das pré-condições do advisory; não foi executada exploração.

- https://github.com/advisories/GHSA-jjmj-jmhj-qwj2 — faixa reportada: `>=6.30.2 <=6.30.5`; severidade do registro: moderate.

**Proposta (não aplicada):**

```text
// Atualizar react-router-dom ou o pacote pai que o resolve para versão fora de TODAS as faixas reportadas.
// Regenerar lockfiles em trabalho separado, conferir compatibilidade e não executar audit fix --force às cegas.
// Se houver salto maior (sharp, por exemplo), tratar breaking changes e formatos suportados antes de publicar.
```

**Aceite:** npm audit deixa de reportar os advisories listados para react-router-dom, ou há triagem documentada por advisory com prova de não alcance. Typechecks/testes e fluxos que dependem desse componente permanecem verdes.

**Verificação:** Em cada árvore afetada: npm audit --json --ignore-scripts --logs-max=0; npm explain react-router-dom; typecheck/testes da aplicação. Nenhum pacote foi instalado ou atualizado nesta auditoria.

### D24 — Atualizar undici nas arvores com alertas npm audit

**Prioridade:** medium. **Etiqueta solicitada:** tech-debt.

**Evidência:** sistema/frontend/package-lock.json:7657 (node_modules/undici 7.25.0; ferramenta de desenvolvimento).

O npm audit consultado em 11/09/2026 identificou a versão resolvida de undici em faixa vulnerável. Os alertas específicos estão enumerados abaixo; a presença no lockfile não comprova exploração. O alcance depende do adaptador/caminho usado e das pré-condições do advisory; não foi executada exploração.

- https://github.com/advisories/GHSA-vmh5-mc38-953g — faixa reportada: `>=7.23.0 <7.28.0`; severidade do registro: high.
- https://github.com/advisories/GHSA-p88m-4jfj-68fv — faixa reportada: `>=7.0.0 <7.28.0`; severidade do registro: moderate.
- https://github.com/advisories/GHSA-vxpw-j846-p89q — faixa reportada: `>=7.0.0 <7.28.0`; severidade do registro: high.
- https://github.com/advisories/GHSA-hm92-r4w5-c3mj — faixa reportada: `>=7.23.0 <7.28.0`; severidade do registro: high.
- https://github.com/advisories/GHSA-g8m3-5g58-fq7m — faixa reportada: `>=7.0.0 <7.28.0`; severidade do registro: low.
- https://github.com/advisories/GHSA-pr7r-676h-xcf6 — faixa reportada: `>=7.0.0 <7.28.0`; severidade do registro: moderate.
- https://github.com/advisories/GHSA-8xcm-r25x-g524 — faixa reportada: `>=7.0.0 <7.29.0`; severidade do registro: moderate.
- https://github.com/advisories/GHSA-4cwx-7wf7-3272 — faixa reportada: `>=7.0.0 <7.29.0`; severidade do registro: high.
- https://github.com/advisories/GHSA-m8rv-5g2x-5cg5 — faixa reportada: `>=7.0.0 <7.29.0`; severidade do registro: moderate.
- https://github.com/advisories/GHSA-jr45-8vmc-qm54 — faixa reportada: `>=7.0.0 <7.29.0`; severidade do registro: moderate.
- https://github.com/advisories/GHSA-v3r7-h72x-cjcm — faixa reportada: `>=7.0.0 <7.29.0`; severidade do registro: moderate.
- https://github.com/advisories/GHSA-35p6-xmwp-9g52 — faixa reportada: `>=7.0.0 <7.28.0`; severidade do registro: low.

**Proposta (não aplicada):**

```text
// Atualizar undici ou o pacote pai que o resolve para versão fora de TODAS as faixas reportadas.
// Regenerar lockfiles em trabalho separado, conferir compatibilidade e não executar audit fix --force às cegas.
// Se houver salto maior (sharp, por exemplo), tratar breaking changes e formatos suportados antes de publicar.
```

**Aceite:** npm audit deixa de reportar os advisories listados para undici, ou há triagem documentada por advisory com prova de não alcance. Typechecks/testes e fluxos que dependem desse componente permanecem verdes.

**Verificação:** Em cada árvore afetada: npm audit --json --ignore-scripts --logs-max=0; npm explain undici; typecheck/testes da aplicação. Nenhum pacote foi instalado ou atualizado nesta auditoria.

### D25 — Atualizar vite nas arvores com alertas npm audit

**Prioridade:** medium. **Etiqueta solicitada:** tech-debt.

**Evidência:** sistema/frontend/package-lock.json:7759 (node_modules/vite 7.3.3; ferramenta de desenvolvimento); sistema/admin/package-lock.json:6789 (node_modules/vite 7.3.3; ferramenta de desenvolvimento).

O npm audit consultado em 11/09/2026 identificou a versão resolvida de vite em faixa vulnerável. Os alertas específicos estão enumerados abaixo; a presença no lockfile não comprova exploração. O alcance depende do adaptador/caminho usado e das pré-condições do advisory; não foi executada exploração.

- https://github.com/advisories/GHSA-v6wh-96g9-6wx3 — faixa reportada: `>=7.0.0 <=7.3.4`; severidade do registro: moderate.
- https://github.com/advisories/GHSA-fx2h-pf6j-xcff — faixa reportada: `>=7.0.0 <=7.3.4`; severidade do registro: high.

**Proposta (não aplicada):**

```text
// Atualizar vite ou o pacote pai que o resolve para versão fora de TODAS as faixas reportadas.
// Regenerar lockfiles em trabalho separado, conferir compatibilidade e não executar audit fix --force às cegas.
// Se houver salto maior (sharp, por exemplo), tratar breaking changes e formatos suportados antes de publicar.
```

**Aceite:** npm audit deixa de reportar os advisories listados para vite, ou há triagem documentada por advisory com prova de não alcance. Typechecks/testes e fluxos que dependem desse componente permanecem verdes.

**Verificação:** Em cada árvore afetada: npm audit --json --ignore-scripts --logs-max=0; npm explain vite; typecheck/testes da aplicação. Nenhum pacote foi instalado ou atualizado nesta auditoria.

### D26 — Atualizar vitest nas arvores com alertas npm audit

**Prioridade:** medium. **Etiqueta solicitada:** tech-debt.

**Evidência:** sistema/frontend/package-lock.json:7865 (node_modules/vitest 4.1.5; ferramenta de desenvolvimento).

O npm audit consultado em 11/09/2026 identificou a versão resolvida de vitest em faixa vulnerável. Os alertas específicos estão enumerados abaixo; a presença no lockfile não comprova exploração. O alcance depende do adaptador/caminho usado e das pré-condições do advisory; não foi executada exploração.

- https://github.com/advisories/GHSA-82fw-gwwq-j7x9 — faixa reportada: `>=2.1.0 <4.1.11`; severidade do registro: moderate.

**Proposta (não aplicada):**

```text
// Atualizar vitest ou o pacote pai que o resolve para versão fora de TODAS as faixas reportadas.
// Regenerar lockfiles em trabalho separado, conferir compatibilidade e não executar audit fix --force às cegas.
// Se houver salto maior (sharp, por exemplo), tratar breaking changes e formatos suportados antes de publicar.
```

**Aceite:** npm audit deixa de reportar os advisories listados para vitest, ou há triagem documentada por advisory com prova de não alcance. Typechecks/testes e fluxos que dependem desse componente permanecem verdes.

**Verificação:** Em cada árvore afetada: npm audit --json --ignore-scripts --logs-max=0; npm explain vitest; typecheck/testes da aplicação. Nenhum pacote foi instalado ou atualizado nesta auditoria.

### D27 — Atualizar shell-quote nas arvores com alertas npm audit

**Prioridade:** medium. **Etiqueta solicitada:** tech-debt.

**Evidência:** sistema/package-lock.json:372 (node_modules/shell-quote 1.8.3; ferramenta de desenvolvimento).

O npm audit consultado em 11/09/2026 identificou a versão resolvida de shell-quote em faixa vulnerável. Os alertas específicos estão enumerados abaixo; a presença no lockfile não comprova exploração. O alcance depende do adaptador/caminho usado e das pré-condições do advisory; não foi executada exploração.

- https://github.com/advisories/GHSA-w7jw-789q-3m8p — faixa reportada: `>=1.1.0 <=1.8.3`; severidade do registro: critical.
- https://github.com/advisories/GHSA-395f-4hp3-45gv — faixa reportada: `<=1.8.4`; severidade do registro: high.

**Proposta (não aplicada):**

```text
// Atualizar shell-quote ou o pacote pai que o resolve para versão fora de TODAS as faixas reportadas.
// Regenerar lockfiles em trabalho separado, conferir compatibilidade e não executar audit fix --force às cegas.
// Se houver salto maior (sharp, por exemplo), tratar breaking changes e formatos suportados antes de publicar.
```

**Aceite:** npm audit deixa de reportar os advisories listados para shell-quote, ou há triagem documentada por advisory com prova de não alcance. Typechecks/testes e fluxos que dependem desse componente permanecem verdes.

**Verificação:** Em cada árvore afetada: npm audit --json --ignore-scripts --logs-max=0; npm explain shell-quote; typecheck/testes da aplicação. Nenhum pacote foi instalado ou atualizado nesta auditoria.


### F27 — Pedidos separacao e rotas retornam hashes de autenticacao dos clientes

Prioridade: **high**. Etiqueta solicitada: `code-quality`.

**Evidência:** sistema/backend/src/modules/orders/orders.service.ts:256 e :270; sistema/backend/src/modules/picking/picking.service.ts:81 e :94; sistema/backend/src/modules/delivery/driver.controller.ts:69 e :89; sistema/backend/prisma/schema.prisma:137 e :141; sistema/backend/src/modules/customers/customers.service.ts:14

As consultas incluem customer:true e devolvem o objeto sem projeção segura. O model contém password, resetTokenHash e resetTokenExpiresAt; stripSecrets existe somente no módulo customers. Staff de picking/delivery pode receber hashes dos clientes relacionados, ampliando exposição de credenciais. Evidência estática; nenhum dado real foi acessado. JON-39, concluída, corrigiu /customers e não estes caminhos.

**Correção sugerida, não aplicada:**

```text
const customerOperationalSelect = { id: true, name: true, whatsapp: true /* apenas dados necessários ao fluxo */ }
include: { customer: { select: customerOperationalSelect } }
// Aplicar a todas as respostas de pedidos/picking/rotas e garantir DTO sem segredos.
```

**Aceite:** Com fixtures sintéticas contendo password/resetTokenHash/resetTokenExpiresAt, todos os endpoints de pedidos, picking e driver devem omitir recursivamente estes campos, mantendo os dados operacionais necessários.

**Verificação:** rg -n "customer: true" sistema/backend/src/modules; testes de contrato autenticados por role e snapshot sanitizado. Revalidar JON-39 sem regressão.




## Ocorrências adicionais confirmadas em 12–13/09/2026

A mesma ausência de projeção segura aparece em sistema/backend/src/modules/business/business.service.ts:75 (addUser), :148 (listCorporateShoppingLists), :186 (createCorporateShoppingList), :342 (listApprovalQueue) e sistema/backend/src/modules/data-privacy/data-privacy.service.ts:72, :100 (exportCustomerData). Todas retornam customer completo, incluindo os campos sensíveis definidos em sistema/backend/prisma/schema.prisma:137, :141 e :142; PrismaService não define omit global. A anonimização também retorna Customer em data-privacy.service.ts:201 sem projeção, mantendo o reset anterior descrito separadamente em JON-119.

Estas ocorrências ficam nesta issue por terem a mesma causa e correção (projeção/sanitização de Customer). Estender o aceite a todas essas respostas: fixture com password/resetTokenHash/resetTokenExpiresAt deve omitir as três chaves, inclusive nas relações e na exportação; preservar dados legítimos solicitados. Não foram exportados hashes ou identificadores reais.

Busca refeita em JON antes da atualização: JON-71 é equivalente sistêmico; JON-39 cobre a correção anterior apenas em CustomersService. Jest dos módulos data-privacy/marketplace passou em 2 suítes/8 testes, mas as fixtures atuais não possuem esses campos sensíveis e não comprovam o aceite.

### F28 — Motorista pode alterar rota de outro motorista da mesma loja

Prioridade: **high**. Etiqueta solicitada: `code-quality`.

**Evidência:** sistema/backend/src/modules/delivery/driver.controller.ts:81, :104, :116 e :123; sistema/backend/src/modules/delivery/delivery.service.ts:877, :918, :984 e :1151

GET de uma rota filtra driverId, mas os três POSTs apenas verificam existência do perfil e descartam driver.id. O serviço consulta rota por id/tenant/store e usa actor apenas para eventos. Uma chamada com id conhecido de rota de outro motorista passa pela autorização e pode iniciar rota, alterar parada ou concluir rota quando o estado permitir.

**Correção sugerida, não aplicada:**

```text
const driver = await findDriverByAdmin(req)
await requireRouteOwner({ id: routeId, driverId: driver.id, ...tenantStore })
// Propagar driverId à consulta/mutação autorizada; manter fluxo administrativo explícito.
```

**Aceite:** Dois motoristas na mesma loja: A recebe 403/404 ao iniciar, alterar parada ou concluir rota de B; nenhuma escrita/evento ocorre. A opera sua própria rota e o administrador mantém gestão autorizada.

**Verificação:** Testes de autorização de DriverController e DeliveryService com dois drivers/duas rotas e tenant distinto; não executado contra produção.

**Comandos reproduzíveis adicionais:** partir da raiz do repositório; incluir na suíte o cenário de aceite proposto, pois o teste atual não prova a correção.

```powershell
Set-Location sistema/backend
node node_modules/typescript/bin/tsc --noEmit --incremental false --pretty false
node node_modules/jest/bin/jest.js --runInBand --no-cache --silent
```

### F29 — Posse da tarefa de separacao pode ser sobrescrita ou contornada

Prioridade: **medium**. Etiqueta solicitada: `code-quality`.

**Evidência:** sistema/backend/src/modules/picking/picker.controller.ts:95; sistema/backend/src/modules/picking/picking.service.ts:312, :338, :344, :380 e :1127

A proteção em startTask rejeita outro separador apenas depois de ler IN_PROGRESS. assignTask atualiza assignedToId sem condição, duas partidas simultâneas de PENDING passam, e ensureTaskCanReceiveItems não valida o responsável de tarefa já IN_PROGRESS. São caminhos da mesma garantia de exclusividade incompleta; um segundo separador pode tomar ou editar tarefa em andamento.

**Correção sugerida, não aplicada:**

```text
// Política única de posse aplicada a claim/start e todas as mutações de itens.
updateMany({ where: { id, status: "PENDING", assignedToId: null }, data: { assignedToId: actorId, status: "IN_PROGRESS" } })
if (count !== 1) throw ConflictException()
assertAssignedPicker(task, actor)
// Reatribuição administrativa separada e auditada.
```

**Aceite:** Duas partidas concorrentes têm exatamente um vencedor; staff B não pode assumir nem registrar/substituir/remover itens da tarefa de A. Reatribuição administrativa autorizada permanece possível.

**Verificação:** Testes de concorrência com barreira na leitura e testes de permissão para claim/start/pick/substitute/remove; não foi feito teste com banco real.

**Comandos reproduzíveis adicionais:** partir da raiz do repositório; incluir na suíte o cenário de aceite proposto, pois o teste atual não prova a correção.

```powershell
Set-Location sistema/backend
node node_modules/typescript/bin/tsc --noEmit --incremental false --pretty false
node node_modules/jest/bin/jest.js --runInBand --no-cache --silent
```

### F30 — Cadastro oferece acesso Admin para staff que o login do painel rejeita

Prioridade: **medium**. Etiqueta solicitada: `code-quality`.

**Evidência:** sistema/admin/src/pages/sections/StaffSection.tsx:11, :157 e :341; sistema/admin/src/hooks/useAuth.ts:18; sistema/backend/src/modules/auth/auth.service.ts:287 e :297

O formulário permite selecionar módulo admin sem Administrador Master e salva role=staff com moduleAccess=[admin]. O login do painel exige admin.role === admin e rejeita esta conta apesar do acesso anunciado. O cadastro produz uma permissão que não funciona; promover a master seria um contorno com privilégio excessivo.

**Correção sugerida, não aplicada:**

```text
// Definir contrato do módulo admin: se staff administrativo for suportado, validar moduleAccess no login e exigir permissões correspondentes nos endpoints.
// Se não for suportado, remover opção admin para staff e impedir combinação inválida no DTO/serviço.
// Não corrigir concedendo role admin automaticamente.
```

**Aceite:** Criar membro pela opção anunciada deve permitir apenas funções autorizadas do painel; se o produto decidir não suportar staff administrativo, opção e payload devem ser rejeitados claramente. Master/picking/delivery sem regressão.

**Verificação:** Teste do formulário StaffSection e login useAuth com role staff/moduleAccess admin; testes dos guards para não ampliar privilégios. Revisão estática confirmou a contradição; nenhuma conta foi criada.

**Comandos reproduzíveis adicionais:** partir da raiz do repositório; incluir na suíte o cenário de aceite proposto, pois o teste atual não prova a correção.

```powershell
Set-Location sistema/admin
node node_modules/typescript/bin/tsc --noEmit --incremental false --pretty false
```

### F31 — Jobs Docker e E2E do CI nao fornecem variavel obrigatoria do bootstrap

Prioridade: **high**. Etiqueta solicitada: `code-quality`.

**Evidência:** .github/workflows/test-pr.yml:86; .github/workflows/ci.yml:139 e :147; sistema/docker-compose.yml:86; sistema/backend/src/modules/integrations/order-orchestration.service.ts:34

Os jobs sobem o Compose principal em checkout limpo sem fornecer SOLIDCOM_BALCAO_CPF. O manifest resolve a variável para vazio e a instanciação de OrderOrchestrationService chama requireEnv de forma incondicional. Assim a API não chega ao health e o gate falha antes dos E2E; variáveis do job backend não são herdadas pelo job e2e-critical. Distinto de F08: aqui o manifest principal tem a chave, mas falta fixture no ambiente CI.

**Correção sugerida, não aplicada:**

```text
// Nos jobs que sobem a stack, definir configuração sintética completa e desabilitar transportes externos.
// Preferir um override Compose de testes e validação explícita de requiredEnv antes de iniciar.
// Nenhum CPF real/segredo de produção no workflow.
```

**Aceite:** Executar pipeline em checkout limpo sem .env local: API inicializa, migrations/seed de teste e E2E alcançam as asserções, sem rede ERP/WhatsApp de produção.

**Verificação:** Inspeção de escopos env nos workflows e default vazio no Compose; reproduzir job em runner isolado. Não subimos containers nesta auditoria.

**Comandos reproduzíveis adicionais:** partir da raiz do repositório; incluir na suíte o cenário de aceite proposto, pois o teste atual não prova a correção.

```powershell
rg -n 'SOLIDCOM_BALCAO_CPF|DATABASE_URL|VITE_VAPID_PUBLIC_KEY|node-version|npm run' sistema/docker-compose.yml sistema/docker-compose.prod.yml sistema/docker-compose.staging.yml .github/workflows/ci.yml .github/workflows/test-pr.yml
```

### F32 — Scripts PowerShell operacionais ignoram falhas de comandos nativos

Prioridade: **medium**. Etiqueta solicitada: `code-quality`.

**Evidência:** sistema/stack-ops.ps1:11, :16 e :64; sistema/release-ops.ps1:136, :137 e :151; sistema/staging-ops.ps1:20 e :23

ErrorActionPreference=Stop não torna exit code não zero de docker/npm uma exceção por padrão. Os scripts continuam após build/up/config/pg_restore falhos; restore-test aceita qualquer contagem positiva de tabelas mesmo com restauração parcial. Repro segura: node -e process.exit(7) | Out-Host continuou com LASTEXITCODE=7, sem invocar Docker.

**Correção sugerida, não aplicada:**

```text
& docker @args
if ($LASTEXITCODE -ne 0) { throw "Comando Docker falhou: $LASTEXITCODE" }
// Capturar código imediatamente em cada execução, incluindo pg_restore; validar integridade do restore além de tabela > 0.
```

**Aceite:** Stub de docker retornando falha em cada etapa deve interromper o script com exit não zero e não imprimir sucesso nem executar próxima mutação; restore parcial precisa falhar.

**Verificação:** Reprodução não mutante da semântica de exit nativo executada em PowerShell; testar scripts com stub em ambiente isolado, sem Docker real.

**Comandos reproduzíveis adicionais:** partir da raiz do repositório; incluir na suíte o cenário de aceite proposto, pois o teste atual não prova a correção.

```powershell
$auditTokens=$null; $auditErrors=$null
[System.Management.Automation.Language.Parser]::ParseFile(((Resolve-Path sistema/stack-ops.ps1).Path),[ref]$auditTokens,[ref]$auditErrors)
$auditErrors
```

### F33 — Inicializador local encerra processos Vite e Nest de outros projetos

Prioridade: **medium**. Etiqueta solicitada: `code-quality`.

**Evidência:** sistema/start-all.sh:6 e :7

pkill -f usa padrões globais nest start e vite, sem limitar diretório ou PIDs pertencentes ao projeto. Executar o inicializador pode interromper servidores de outros projetos do mesmo usuário. O script também anuncia Ctrl+C para parar tudo, mas não mantém PIDs/trap de cleanup dos filhos.

**Correção sugerida, não aplicada:**

```text
// Remover pkill global. Guardar PIDs dos processos iniciados por este script.
trap cleanup EXIT INT TERM
cleanup() { kill "$backendPid" "$frontendPid" "$adminPid" 2>/dev/null || true; }
// Resolver paths a partir da localização do script.
```

**Aceite:** Com outro Vite/Nest de fixture ativo em diretório distinto, iniciar e encerrar este projeto preserva os processos alheios e limpa apenas seus próprios filhos.

**Verificação:** Leitura estática do script completo; teste de processo em sandbox separado, não executado aqui para preservar processos do usuário.

**Comandos reproduzíveis adicionais:** partir da raiz do repositório; incluir na suíte o cenário de aceite proposto, pois o teste atual não prova a correção.

```powershell
& 'C:/Program Files/Git/bin/bash.exe' -n sistema/start-all.sh
```

### F34 — Scripts de release e staging conservam dominio administrativo descontinuado

Prioridade: **low**. Etiqueta solicitada: `code-quality`.

**Evidência:** sistema/release-ops.ps1:10 e :60; sistema/staging-ops.ps1:52 e :53; AGENTS.md:71

O smoke usa por default um endereço com domínio antenor.com.br que as instruções atuais dizem não existir; staging imprime contas nesse domínio. Sem override, o operador testa identidade errada ou segue orientação que diverge do cadastro atual. Não foram consultadas credenciais nem criada conta.

**Correção sugerida, não aplicada:**

```text
// Exigir AdminEmail explícito ou obtê-lo de configuração operacional válida.
// Mensagens de seed devem derivar o endereço efetivamente configurado, sem imprimir senha.
```

**Aceite:** Smoke recebe email de fixture explícito e não presume domínio obsoleto; mensagens de staging refletem os dados configurados e não divulgam senha.

**Verificação:** rg -n "admin@antenor.com.br" sistema/release-ops.ps1 sistema/staging-ops.ps1; teste de parâmetros/saída com fixture.


### F35 — Arquivo JavaScript de configuracao PM2 contem YAML e nao pode ser carregado

Prioridade: **low**. Etiqueta solicitada: `code-quality`.

**Evidência:** sistema/ecosystem.config.js:1, :2, :11 e :19

O arquivo .js contém estrutura YAML apps/listas. A varredura AST ampliada encontrou três erros TS1005; node --check reproduziu SyntaxError Unexpected token : na linha 2, exit 1. A configuração alternativa PM2 é inutilizável nesse formato. Docker é o caminho principal e não há consumidor ativo encontrado para PM2, por isso prioridade Low.

**Correção sugerida, não aplicada:**

```text
module.exports = { apps: [{ name: "mercado-antenor-backend", script: "./dist/main.js", cwd: "./backend" /* demais opções equivalentes */ }] }
// Alternativamente migrar para extensão YAML suportada e atualizar referências; se obsoleta, retirar em trabalho separado.
```

**Aceite:** node --check deve passar se o arquivo continuar .js; teste de carga da configuração deve retornar apps válidos sem iniciar processos nem usar produção.

**Verificação:** node --check sistema/ecosystem.config.js (executado, exit 1); rg -n "ecosystem|pm2" docs sistema -g "*.md" -g "*.json" com exclusões de dependências/artefatos.


### F36 — Proxies Nginx mantem IP antigo da API apos recriacao do container

Prioridade: **medium**. Etiqueta solicitada: `code-quality`.

**Evidência:** sistema/frontend/nginx.conf:41; sistema/admin/nginx.conf:28; sistema/picking-app/nginx.conf:18; sistema/delivery-app/nginx.conf:18

Os proxy_pass usam hostname api literal e não há resolver/upstream resolve. A resolução ocorre ao carregar a configuração; se uma recriação isolada da API mudar o IP, proxies existentes podem seguir no endereço antigo e produzir 502 até reload/restart. Inferência estática apoiada pela documentação oficial; não foi recriado container nesta auditoria. Referência: https://nginx.org/en/docs/http/ngx_http_upstream_module.html#server e https://nginx.org/en/docs/http/ngx_http_proxy_module.html#proxy_pass.

**Correção sugerida, não aplicada:**

```text
// Em versão Nginx compatível, configurar upstream com zone + server api:3001 resolve e resolver DNS da rede Docker.
// Preservar semântica de remoção de /api/ e uploads; alternativa transitória: reload coordenado dos proxies após troca de API.
// Não aplicar proxy_pass variável sem testar reescrita da URI.
```

**Aceite:** Em stack descartável, recriar apenas API com IP diferente; os quatro apps recuperam chamadas sem reiniciar seus proxies. URLs /api/* e uploads mantêm paths corretos; testar HTTP e HTTPS aplicáveis.

**Verificação:** rg -n "proxy_pass|resolver|resolve" sistema/*/nginx*.conf; nginx -t e teste de recriação isolada em ambiente de teste (não executados).


### F37 — Auto scroll nao reage quando usuario ativa reducao de movimento

Prioridade: **low**. Etiqueta solicitada: `code-quality`.

**Evidência:** sistema/frontend/src/hooks/useAutoScroll.ts:21, :24 e :42; sistema/frontend/src/hooks/usePrefersReducedMotion.ts:20

O hook recebe mudanças de prefers-reduced-motion, mas useEffect não inclui prefersReducedMotion nas dependências. Ativar a preferência com a página aberta não limpa o intervalo existente; desativá-la também não reinicia o carrossel. O cleanup está presente e correto no unmount, logo não se trata de vazamento permanente.

**Correção sugerida, não aplicada:**

```text
}, [containerRef, enabled, prefersReducedMotion, step, intervalMs])
```

**Aceite:** Simular mudança matchMedia false→true com carrossel montado: timer é cancelado e não há scroll; true→false respeita enabled e reinicia quando apropriado.

**Verificação:** Teste de hook com matchMedia simulado e timers falsos; leitura estática realizada, alteração não aplicada.

**Comandos reproduzíveis adicionais:** partir da raiz do repositório; incluir na suíte o cenário de aceite proposto, pois o teste atual não prova a correção.

```powershell
Set-Location sistema/frontend
node node_modules/typescript/bin/tsc --noEmit --incremental false --pretty false
node node_modules/vitest/vitest.mjs run --configLoader runner --no-cache
```

### F38 — Watcher perde mensagem quando linha JSONL chega em escritas parciais

Prioridade: **medium**. Etiqueta solicitada: `code-quality`.

**Evidência:** scripts/ai-session-watcher/index.js:56, :193, :197 e :222

O stream é limitado ao tamanho observado no evento, readline entrega também a última linha sem newline, parseLine descarta JSON incompleto, e fileState avança para currentSize. Quando chega o restante, o watcher começa no meio do JSON e descarta novamente, perdendo a sessão na documentação. A integração não preserva cauda parcial por arquivo.

**Correção sugerida, não aplicada:**

```text
// Manter buffer de cauda e offset confirmado por arquivo.
// Processar somente linhas encerradas por newline; juntar próxima leitura à cauda.
// Serializar processFile por caminho para eventos change simultâneos não regredirem o offset.
```

**Aceite:** Escrever uma mensagem JSONL em duas metades deve gerar exatamente um registro após newline; também testar truncamento/rotação e eventos change sobrepostos.

**Verificação:** Teste unitário do leitor incremental com chunks sintéticos; não executar watcher real, que escreve no vault e arquivos históricos.

**Comandos reproduzíveis adicionais:** partir da raiz do repositório; incluir na suíte o cenário de aceite proposto, pois o teste atual não prova a correção.

```powershell
node --check scripts/ai-session-watcher/index.js
```

### F39 — Health detalhado verifica Solidcom legado quando catalogo usa AntenorApi

Prioridade: **medium**. Etiqueta solicitada: `code-quality`.

**Evidência:** sistema/backend/src/modules/integrations/health.controller.ts:42, :128 e :134; sistema/backend/src/modules/products/products.service.ts:1259 e :1281

O catálogo seleciona AntenorApi quando o módulo está habilitado, mas health/detail consulta sempre SOLIDCOM_API_URL e GetProdutos. O painel pode marcar saúde errada do ERP e não detectar falha do provedor ativo. O estado real de produção não foi consultado; a divergência de seleção está no código.

**Correção sugerida, não aplicada:**

```text
const provider = await resolveActiveErpProvider()
return healthAdapter[provider].probe()
// Provedor desabilitado deve constar desabilitado, sem requisição; usar probe leve da API ativa.
```

**Aceite:** Com antenorapi habilitado/solidcom desabilitado, health usa somente o adaptador AntenorApi; falha nele resulta down e legado fora do ar não contamina a avaliação.

**Verificação:** Teste HealthController com módulos de integração simulados nas combinações ativo/inativo e assert de URL chamada, sem rede real.

**Comandos reproduzíveis adicionais:** partir da raiz do repositório; incluir na suíte o cenário de aceite proposto, pois o teste atual não prova a correção.

```powershell
Set-Location sistema/backend
node node_modules/typescript/bin/tsc --noEmit --incremental false --pretty false
node node_modules/jest/bin/jest.js --runInBand --no-cache --silent
```

### F40 — Health publico dispara consulta pesada de ERP a cada requisicao

Prioridade: **medium**. Etiqueta solicitada: `code-quality`.

**Evidência:** sistema/backend/src/modules/integrations/health.controller.ts:31, :32, :38 e :134; sistema/backend/src/common/decorators/relaxed-throttle.decorator.ts:20

health/detail não exige autenticação e usa RelaxedThrottle, ficando no bucket default de 600/min. Cada chamada dispara GetProdutos, que o próprio comentário descreve como pesado (~9,7 s mesmo limit=1), além de banco e demais probes, sem cache ou compartilhamento de execução. É possível amplificar carga de consulta do ERP; não houve teste de carga nem ataque nesta auditoria.

**Correção sugerida, não aplicada:**

```text
// Health público: resposta leve de liveness.
// Detalhe operacional: guard/autorização, cache curto e uma única execução concorrente dos probes.
// Remover consulta de catálogo do caminho público e usar endpoint de saúde leve.
```

**Aceite:** Chamadas públicas não disparam consulta de catálogo; chamadas autorizadas concorrentes compartilham um probe por janela, com timeout e limite de concorrência.

**Verificação:** Teste com spies para contar chamadas externas por lote concorrente; não executar carga contra API/ERP real.

**Comandos reproduzíveis adicionais:** partir da raiz do repositório; incluir na suíte o cenário de aceite proposto, pois o teste atual não prova a correção.

```powershell
Set-Location sistema/backend
node node_modules/typescript/bin/tsc --noEmit --incremental false --pretty false
node node_modules/jest/bin/jest.js --runInBand --no-cache --silent
```

### F41 — Lista da separacao aceita resposta antiga apos alterar filtros

Prioridade: **medium**. Etiqueta solicitada: `code-quality`.

**Evidência:** sistema/picking-app/src/pages/OrderList.tsx:71, :80 e :89

O debounce cancela somente o timer; requisições já iniciadas não são abortadas ou identificadas. Se a busca antiga terminar depois da nova, setOrders sobrescreve a lista com pedidos que não correspondem aos filtros exibidos. Distinto de F12: este fluxo não tem sequenciamento de resposta; F12 possui sequenciamento, mas não o invalida ao limpar o campo.

**Correção sugerida, não aplicada:**

```text
const requestId = ++latestRequest.current
const response = await searchOrders(filters)
if (requestId === latestRequest.current) setOrders(response.data)
// Invalidar ao alterar qualquer filtro e no unmount; abortar request anterior quando suportado.
```

**Aceite:** Duas buscas A e B resolvidas na ordem B→A exibem somente B; mudança de status/data e atualização manual obedecem à mesma regra.

**Verificação:** Teste com promises controladas e timers falsos; verificar mobile e desktop. Não depende de acesso ao ERP.

**Comandos reproduzíveis adicionais:** partir da raiz do repositório; incluir na suíte o cenário de aceite proposto, pois o teste atual não prova a correção.

```powershell
Set-Location sistema/picking-app
node node_modules/typescript/bin/tsc --noEmit --incremental false --pretty false
```

### F42 — Upload rejeitado pelo limite final deixa arquivo gravado em disco

Prioridade: **medium**. Etiqueta solicitada: `code-quality`.

**Evidência:** sistema/backend/src/modules/uploads/uploads.controller.ts:80, :104, :124, :147, :154 e :206

Multer aceita até 25 MB e diskStorage grava antes do ParseFilePipe, mas o validator final limita a 5 MB. Entre 5 e 25 MB, a requisição é rejeitada antes do handler e de seu finally; o arquivo já gravado permanece. No upload de produto, MIME inválido também é rejeitado somente após gravar e antes do bloco try/finally. A proteção de pixels existe, mas não resolve esses arquivos órfãos.

**Correção sugerida, não aplicada:**

```text
// Alinhar limites Multer/ParseFilePipe ao teto real aceito.
// Rejeitar MIME em fileFilter também no endpoint de produto.
// Garantir descarte do arquivo em todas as saídas de validação, com teste de falha antes do handler.
```

**Aceite:** Uploads sintéticos acima do limite e MIME rejeitado retornam 4xx sem deixar novos arquivos temporários/persistentes; imagens aceitas seguem funcionando.

**Verificação:** Teste de integração multipart em diretório temporário isolado cobrindo falha no pipe e no handler; não realizado contra uploads reais.

**Comandos reproduzíveis adicionais:** partir da raiz do repositório; incluir na suíte o cenário de aceite proposto, pois o teste atual não prova a correção.

```powershell
Set-Location sistema/backend
node node_modules/typescript/bin/tsc --noEmit --incremental false --pretty false
node node_modules/jest/bin/jest.js --runInBand --no-cache --silent
```

### F43 — Uploads concorrentes do mesmo produto compartilham arquivos temporarios

Prioridade: **medium**. Etiqueta solicitada: `code-quality`.

**Evidência:** sistema/backend/src/modules/uploads/uploads.controller.ts:135, :169, :195 e :206

O nome de entrada é ean+slot-temp+extensão e o staging é finalPath.new, ambos compartilhados por requisições do mesmo EAN/slot. Dois uploads em paralelo podem truncar a entrada alheia, disputar rename ou ter o temporário removido pelo finally de outra requisição. O staging protege falha isolada, mas não concorrência.

**Correção sugerida, não aplicada:**

```text
const requestId = randomUUID()
const tempName = `${ean}${suffix}-${requestId}.tmp`
const stagingPath = `${finalPath}.${requestId}.new`
// Renomear atomicamente para final e remover somente arquivos pertencentes à própria requisição; definir política para gravações simultâneas.
```

**Aceite:** Duas requisições concorrentes com imagens distintas do mesmo EAN/slot concluem conforme política definida, sem arquivo corrompido, ENOENT provocado por cleanup alheio ou temporários restantes.

**Verificação:** Teste multipart concorrente com barreiras e diretório descartável; revisão estática, sem upload real nesta auditoria.

**Comandos reproduzíveis adicionais:** partir da raiz do repositório; incluir na suíte o cenário de aceite proposto, pois o teste atual não prova a correção.

```powershell
Set-Location sistema/backend
node node_modules/typescript/bin/tsc --noEmit --incremental false --pretty false
node node_modules/jest/bin/jest.js --runInBand --no-cache --silent
```

## Metodologia e comandos executados

A auditoria começou pela leitura integral de AGENTS.md e CLAUDE.md. Foram usados os guias orca-linear e orchestration para pesquisar, registrar e conferir as issues. Não houve subagentes, correções de código, instalação de pacotes, commit, push, deploy, acesso à VPS ou migração de banco.

A enumeração usou `rg --files` e `rg --files --hidden --no-ignore`. A segunda inclui dependências, conteúdo ignorado e oculto. Contagem física e SHA-256 foram calculados por arquivo; a classificação por diretório foi corrigida quando se identificaram os seis arquivos de código do módulo uploads. Os 1049 itens do inventário corrigido incluem 78 CSVs de dados, três PEMs e documentação: esse número não equivale a 1049 programas. A tabela original mantém 1043 linhas e o complemento registra os seis itens reclassificados e os dois novos.

A leitura semântica foi dirigida por fluxos, imports, buscas `rg -n`, tipos e testes. Foram avaliados checkout/preço/substituição, outbox, tarefas e posse de rotas, autenticação, projeção de dados, push, busca assíncrona, timers, schedulers, backup, configurações Docker e operação. Consultas e retornos foram rastreados até seus consumidores. Achados potenciais sem evidência suficiente não foram convertidos em afirmações de falha; uma contagem de timer, any ou import não é prova de vazamento, vulnerabilidade ou código morto.

A AST usou a instalação local de TypeScript, `createSourceFile` e `forEachChild`, sem executar os módulos. O conjunto final de 603 arquivos inclui 601 fontes presentes no inventário corrigido e dois arquivos acrescentados por outra sessão. Foram percorridos todos os nós, contados tamanhos, any, ramificações e chamadas de timers/listeners. A análise de imports do backend considerou 194 arquivos de execução no recorte inicial, sem specs, e identificou dependência recíproca entre integrações e notificações; não foi tomada como prova de ciclo de inicialização Nest.

As prioridades consideram impacto e alcance: High para defeito sistêmico/alto impacto; Medium para impacto relevante com contorno; Low para dívida ou caminho alternativo sem uso principal demonstrado. Não foi confirmado risco que justificasse Urgent. A severidade do advisory é uma dimensão diferente: shell-quote tem alerta critical, mas aparece no ferramental de desenvolvimento, sem exploração ou entrada controlada por atacante demonstrada.

| Comando/execução | Resultado inicial | Revalidação e limites |
|---|---|---|
| `rg --files`; `rg --files --hidden --no-ignore` | 8426 e 176607 arquivos | Fotografia inicial, anterior ao relatório e às alterações concorrentes |
| Python: contagem de linhas e SHA-256 de cada item | 1043 itens classificados inicialmente; seis fontes reclassificadas | 1049 itens na classificação corrigida; 382417 linhas físicas incluindo dados e locks; dois arquivos novos em complemento |
| AST TypeScript, todos os nós | Recorte inicial: 533 arquivos, 102243 linhas, 317 any, zero erros | Recorte final: 603 arquivos, 111255 linhas, 337 any, três erros no arquivo PM2 |
| `node node_modules/typescript/bin/tsc --noEmit --incremental false --pretty false` em cada um dos cinco apps | Todos exit 0 | Backend/frontend/admin repetidos após os deltas: exit 0 |
| ESLint direto, `src --ext .ts,.tsx --no-cache --format json` | Backend: dois erros; frontend/admin: zero | Backend revalidado via API ESLint: 258 arquivos, dois erros, zero avisos, linhas 8/14 de push; F18 |
| `tsc --noEmit --incremental false --noUnusedLocals --noUnusedParameters` no backend | Exit 1, 20 diagnósticos | Ver F19; opções adicionais não estão habilitadas na configuração habitual |
| `node node_modules/jest/bin/jest.js --runInBand --no-cache --silent` no backend | 62 suítes/444 testes passaram, 34,762 s | Repetição após mudanças: 63 suítes/451 testes passaram, 31,264 s, exit 0 |
| `node node_modules/vitest/vitest.mjs run --configLoader runner --no-cache` no frontend | Seis arquivos/118 testes passaram | Repetição: seis arquivos/118 testes passaram, 2,23 s, exit 0 |
| Mesmo Vitest no admin | Falha de inicialização: `__dirname is not defined` em vite.config.ts | Limitação do configLoader runner escolhido para evitar geração de bundle; não prova falha do build normal |
| Admin: `startVitest('test', [], {config:false, watch:false, cache:false, environment:'node', globals:true, include:['src/**/*.test.ts']})`, via `node --input-type=module -`, seguido de close | Um arquivo/seis testes passaram | Execução programática sem carregar vite.config; não valida plugins/aliases/configuração completa |
| `node escalation.test.js` e `node faturamento.test.js` em Notificador | Ambos exit 0, casos declarados passaram | Não abre Electron nem conecta ao ERP |
| `node node_modules/prisma/build/index.js validate` | Schema válido, exit 0 | Repetido após mudança do schema: válido; DATABASE_URL sintética apontando a porta local não utilizada, sem conexão/migration |
| Python `ast.parse` dos cinco scripts .py | Zero erros | Sem execução ou py_compile; nenhum __pycache criado por essa análise |
| Parser PowerShell `Language.Parser.ParseFile` dos 57 .ps1 | Zero erros | Não executa scripts nem seus comandos de alteração |
| `bash -n` nos três .sh | Exit 0 nos três | Valida sintaxe, não fluxo/efeitos |
| JSON estrito/JSONC, YAML e CSS | 29 JSON + 11 JSONC + cinco YAML + nove CSS, zero erros de parse | JSONC por TypeScript, YAML por js-yaml, CSS por PostCSS; não equivale a validar contrato de serviço |
| `node --check sistema/ecosystem.config.js` | Exit 1, SyntaxError na linha 2 | F35 confirmado; arquivo usa YAML em extensão .js |
| Varredura das 71 migrations | 3072 linhas; padrões: CREATE TABLE 112, ALTER 189, UNIQUE INDEX 65, INDEX 218, DROP TABLE 1, DROP COLUMN 1, DELETE FROM 0, UPDATE 106, INSERT 18 | Contagens de ocorrências lexicais, incluindo ON UPDATE; não são contagem de objetos/linhas afetadas |
| Repro em memória do worker outbox | Duas execuções concorrentes produziram dois jobs e ambas retornaram SENT | Prisma e adaptadores simulados; sem banco/rede. Reforça F03/F05 |
| Bash isolado: `set -eu; if ! false &#124; gzip > /dev/null; then ...; else ...; fi` | Ramo de sucesso do pipeline apesar da falha do produtor | Prova a semântica de F07, sem executar pg_dump/backup |
| PowerShell: `node -e 'process.exit(7)' &#124; Out-Host` com ErrorActionPreference Stop | Script continuou; LASTEXITCODE=7 | Prova de F32, sem executar Docker |
| `npm audit --json --ignore-scripts --logs-max=0` e `npm outdated --json --ignore-scripts --logs-max=0` | Tabelas abaixo | Consultas ao registry; sem install, audit fix ou alteração de lockfile |
| `orca linear list-issues --team JON --include-archived --json`, busca na listagem completa por achado, `save-issue` e `issue ID --full --json` | Pesquisa, registro e read-back | A tabela de rastreabilidade identifica cada issue e sua confirmação |

O script npm de lint do backend contém `--fix`; por isso foi substituído pela chamada direta sem correção. Para resumir o lint, uma tentativa auxiliar de Node -e teve erro de sintaxe no próprio comando da auditoria, corrigido em stdin e repetido com êxito; não é falha do repositório. Avisos NO_COLOR/FORCE_COLOR são do terminal. As execuções não geraram relatórios de cobertura em disco nem builds. A configuração e os testes podem carregar .env internamente; valores não foram inspecionados, exportados nem usados em tickets. Prisma informou esse carregamento e recebeu URL sintética explicitamente.

## Visão arquitetural

O sistema é um repositório com pacotes npm separados. A API NestJS concentra catálogo, clientes, pricing, checkout, pedidos, estoque, separação, entrega, CMS, CRM, integrações e observabilidade. Quatro aplicações React/Vite consomem a API: storefront, admin, picking e delivery. Notificador é um processo Electron na operação local, com polling/avisos e integração de faturamento. Scripts auxiliares cuidam de fotos, catálogo e documentação de sessões.

A separação por domínio em `backend/src/modules` facilita localização, mas os serviços misturam persistência Prisma, regras de negócio, integração e produção de respostas HTTP. Checkout depende de pricing, delivery, inventory e orders; orders depende também de integrations e notifications. Products importa integrações para sincronização, e integrações/notificações têm imports nos dois sentidos. O levantamento identificou 31 declarações de PrismaService em módulos/bootstrap: a fronteira de banco não é compartilhada como um singleton explícito, conforme F11.

O fluxo de venda passa por carrinho/sessão, cotação, confirmação, pedido, separação e entrega. Há snapshots, idempotencyKey, eventos de pedido, outbox, jobs, tentativas e dead letters no schema. Esses mecanismos são pertinentes, mas seus contratos não são preservados de ponta a ponta: F01/F02/F25 mostram perdas na conversão/recotação; F03–F06 mostram que a existência de tabelas de fila não garante entrega ou retry correto; F28/F29 mostram diferença entre acesso ao módulo e autorização sobre o recurso.

Os apps compartilham vocabulário e padrões, mas mantêm implementações separadas de API, autenticação, estados e push. React Query convive com carregamento manual e vários estados locais em páginas longas. A duplicação integral de usePushEquipe e os grandes componentes elevam o custo de manter comportamento consistente em mobile/desktop. F12/F41 demonstram respostas assíncronas que podem recolocar estado antigo; F37 demonstra uma dependência ausente em efeito. Cleanup existe em vários hooks examinados, como usePrefersReducedMotion e useAutoScroll; a presença de listeners não foi automaticamente classificada como vazamento.

A infraestrutura principal usa Compose, Postgres, Redis, Meilisearch, API e Nginx dos apps, com um container de backup. Os manifests principal/prod/staging e scripts operacionais têm contratos divergentes. O backend usa build em Node 20 Alpine e mantém ferramentas de desenvolvimento no runner para seed; isso amplia a árvore instalada em runtime, embora nem todo advisory de ferramenta seja alcançável pela aplicação. O ambiente auditado usa Node 26.7.0/npm 11.19.0, portanto estes resultados locais não substituem a execução no mesmo runtime Linux do deploy.

O modelo tenant/store aparece no schema, middlewares e guards. Isso constitui uma base de isolamento, mas não demonstra cobertura universal de todas as consultas nem autorização de posse de rota/tarefa. O achado de exposição de hashes (F27) ilustra a ausência de uma projeção segura compartilhada: a sanitização em CustomersService não protege objetos customer carregados por outros módulos.

Os testes oferecem boa quantidade de verificações locais, mas o total de testes aprovados não mede adequação de cenários. Mocks permitem passar sem constraints reais, disputa por recursos, falha parcial ou transporte externo. Alguns testes de upload apenas procuram padrões no fonte, e alguns testes de controller apenas verificam instanciação. Os testes de aceitação de cada achado especificam os cenários faltantes; nenhuma nova suíte foi gravada nesta fase.


## Dependências e estado de atualização

Consulta ao registry registrada em 11/09/2026. Os números são pacotes vulneráveis reportados em cada árvore, não vulnerabilidades únicas entre os projetos. Somar árvores duplica dependências compartilhadas. Lockfiles não mudaram na revalidação dos hashes; os avisos permanecem associados à fotografia consultada, sem afirmar que o registry ficou imutável.

| Pacote raiz | Low | Moderate | High | Critical | Total audit | Itens outdated |
|---|---:|---:|---:|---:|---:|---:|
| `sistema/backend` | 2 | 3 | 13 | 0 | 18 | 48 |
| `sistema/frontend` | 3 | 9 | 9 | 0 | 21 | 31 |
| `sistema/admin` | 3 | 6 | 8 | 0 | 17 | 27 |
| `sistema/picking-app` | 0 | 0 | 1 | 0 | 1 | 12 |
| `sistema/delivery-app` | 0 | 0 | 1 | 0 | 1 | 12 |
| `sistema` | 0 | 0 | 0 | 1 | 1 | 1 |
| `Notificador` | 0 | 0 | 0 | 0 | 0 | 2 |
| `scripts/ai-session-watcher` | 0 | 0 | 0 | 0 | 0 | Sem saída outdated registrada |

O package.json da raiz não declara dependências. Não foram auditados os bytes de node_modules individualmente como fonte autoral: a análise de terceiros usou resoluções dos locks, npm audit/outdated e advisories. Bibliotecas binárias incorporadas, imagens Docker e runtime Python embarcado não receberam SBOM/scanner dedicado; essa é uma lacuna, não um resultado limpo.

Os achados D01–D27 discriminam evidência de lockfile, versão, dependência de desenvolvimento/execução, cada advisory e sua faixa. D15 foi consolidado na issue de D22 porque repete um advisory da família React Router; D16 foi consolidado em D26 porque é o mesmo advisory de Vitest/mocker. Outros advisories de roteamento continuam explícitos em D22/D23. Sharp e Multer receberam High pelo processamento de imagens/uploads em runtime; shell-quote recebeu Medium porque o alerta critical está no ferramental, sem caminho de exploração demonstrado.

Foram consultadas fontes primárias para a triagem, como [shell-quote](https://github.com/advisories/GHSA-w7jw-789q-3m8p), [Sharp/libvips](https://github.com/advisories/GHSA-f88m-g3jw-g9cj) e [Multer](https://github.com/advisories/GHSA-72gw-mp4g-v24j). A versão de destino precisa sair de **todas** as faixas registradas para o pacote; resolver apenas um advisory pode deixar outro aberto.

### Saída completa resumida de npm outdated

`current` é a versão instalada; `wanted` respeita o range atual; `latest` é o dist-tag retornado pelo registry, que pode exigir migração maior ou até apontar pré-release. A tabela é evidência de atualização disponível, não recomendação para instalar cegamente o dist-tag. Bibliotecas antigas sem vulnerabilidade/defeito demonstrado não receberam um ticket de bug só pela idade.

| Árvore | Dependência | current | wanted | latest |
|---|---|---|---|---|
| `sistema/backend` | `@nestjs/cli` | 11.0.21 | 11.0.24 | 12.0.0 |
| `sistema/backend` | `@nestjs/common` | 11.1.24 | 11.2.3 | 12.0.1 |
| `sistema/backend` | `@nestjs/config` | 4.0.4 | 4.0.4 | 12.0.0 |
| `sistema/backend` | `@nestjs/core` | 11.1.24 | 11.2.3 | 12.0.1 |
| `sistema/backend` | `@nestjs/jwt` | 11.0.2 | 11.0.2 | 12.0.1 |
| `sistema/backend` | `@nestjs/mapped-types` | 2.1.1 | 2.1.1 | 12.0.0 |
| `sistema/backend` | `@nestjs/passport` | 11.0.5 | 11.0.5 | 12.0.0 |
| `sistema/backend` | `@nestjs/platform-express` | 11.1.24 | 11.2.3 | 12.0.1 |
| `sistema/backend` | `@nestjs/schedule` | 5.0.1 | 5.0.1 | 12.0.1 |
| `sistema/backend` | `@nestjs/schematics` | 11.1.0 | 11.1.0 | 12.0.1 |
| `sistema/backend` | `@nestjs/serve-static` | 5.0.5 | 5.0.5 | 12.0.0 |
| `sistema/backend` | `@nestjs/swagger` | 11.4.4 | 11.4.7 | 12.0.1 |
| `sistema/backend` | `@nestjs/testing` | 11.1.24 | 11.2.3 | 12.0.1 |
| `sistema/backend` | `@prisma/client` | 5.22.0 | 5.22.0 | 7.10.0 |
| `sistema/backend` | `@turf/boolean-point-in-polygon` | 7.3.5 | 7.4.0 | 7.4.0 |
| `sistema/backend` | `@turf/helpers` | 7.3.5 | 7.4.0 | 7.4.0 |
| `sistema/backend` | `@types/bcrypt` | 5.0.2 | 5.0.2 | 6.0.0 |
| `sistema/backend` | `@types/express` | 4.17.25 | 4.17.25 | 5.0.6 |
| `sistema/backend` | `@types/jest` | 29.5.14 | 29.5.14 | 30.0.0 |
| `sistema/backend` | `@types/multer` | 2.1.0 | 2.2.0 | 2.2.0 |
| `sistema/backend` | `@types/node` | 20.19.39 | 20.19.43 | 22.20.2 |
| `sistema/backend` | `@types/passport-jwt` | 3.0.13 | 3.0.13 | 4.0.1 |
| `sistema/backend` | `@types/pg` | 8.20.0 | 8.23.1 | 8.23.1 |
| `sistema/backend` | `@types/supertest` | 2.0.16 | 2.0.16 | 7.2.1 |
| `sistema/backend` | `@typescript-eslint/eslint-plugin` | 7.18.0 | 7.18.0 | 8.70.0 |
| `sistema/backend` | `@typescript-eslint/parser` | 7.18.0 | 7.18.0 | 8.70.0 |
| `sistema/backend` | `axios` | 1.16.1 | 1.20.0 | 1.20.0 |
| `sistema/backend` | `class-validator` | 0.14.4 | 0.14.4 | 0.15.1 |
| `sistema/backend` | `compression` | 1.8.1 | 1.8.2 | 1.8.2 |
| `sistema/backend` | `eslint` | 8.57.1 | 8.57.1 | 10.10.0 |
| `sistema/backend` | `eslint-config-prettier` | 9.1.2 | 9.1.2 | 10.1.8 |
| `sistema/backend` | `eslint-plugin-prettier` | 5.5.5 | 5.5.6 | 5.5.6 |
| `sistema/backend` | `helmet` | 7.2.0 | 7.2.0 | 8.3.0 |
| `sistema/backend` | `ioredis` | 5.10.1 | 5.11.1 | 6.0.0 |
| `sistema/backend` | `jest` | 29.7.0 | 29.7.0 | 30.5.1 |
| `sistema/backend` | `meilisearch` | 0.50.0 | 0.50.0 | 0.62.0 |
| `sistema/backend` | `passport` | 0.6.0 | 0.6.0 | 0.7.0 |
| `sistema/backend` | `pg` | 8.20.0 | 8.23.0 | 8.23.0 |
| `sistema/backend` | `prettier` | 3.8.3 | 3.9.6 | 3.9.6 |
| `sistema/backend` | `prisma` | 5.22.0 | 5.22.0 | 8.0.0-rc.13 |
| `sistema/backend` | `redis` | 4.7.1 | 4.7.1 | 6.2.1 |
| `sistema/backend` | `reflect-metadata` | 0.1.14 | 0.1.14 | 0.2.2 |
| `sistema/backend` | `sharp` | 0.34.5 | 0.34.5 | 0.35.4 |
| `sistema/backend` | `supertest` | 6.3.4 | 6.3.4 | 7.2.2 |
| `sistema/backend` | `ts-jest` | 29.4.9 | 29.4.12 | 29.4.12 |
| `sistema/backend` | `ts-loader` | 9.5.7 | 9.6.2 | 9.6.2 |
| `sistema/backend` | `typescript` | 5.9.3 | 5.9.3 | 7.0.2 |
| `sistema/backend` | `uuid` | 13.0.2 | 13.0.2 | 14.0.2 |
| `sistema/frontend` | `@tanstack/react-query` | 4.44.0 | 4.44.0 | 5.102.8 |
| `sistema/frontend` | `@testing-library/react` | 16.3.2 | 16.3.3 | 16.3.3 |
| `sistema/frontend` | `@testing-library/user-event` | 14.6.1 | 14.6.7 | 14.6.7 |
| `sistema/frontend` | `@types/react` | 18.3.28 | 18.3.31 | 19.3.0 |
| `sistema/frontend` | `@types/react-dom` | 18.3.7 | 18.3.7 | 19.3.0 |
| `sistema/frontend` | `@typescript-eslint/eslint-plugin` | 7.18.0 | 7.18.0 | 8.70.0 |
| `sistema/frontend` | `@typescript-eslint/parser` | 7.18.0 | 7.18.0 | 8.70.0 |
| `sistema/frontend` | `@vitejs/plugin-react` | 5.2.0 | 5.2.0 | 6.1.1 |
| `sistema/frontend` | `@vitest/coverage-v8` | 4.1.5 | 4.1.11 | 5.0.0 |
| `sistema/frontend` | `autoprefixer` | 10.5.0 | 10.5.6 | 10.5.6 |
| `sistema/frontend` | `axios` | 1.16.1 | 1.20.0 | 1.20.0 |
| `sistema/frontend` | `cypress` | 15.16.0 | 15.21.1 | 16.0.0 |
| `sistema/frontend` | `date-fns` | 2.30.0 | 2.30.0 | 4.4.0 |
| `sistema/frontend` | `eslint` | 8.57.1 | 8.57.1 | 10.10.0 |
| `sistema/frontend` | `eslint-plugin-react-hooks` | 4.6.2 | 4.6.2 | 7.1.1 |
| `sistema/frontend` | `eslint-plugin-react-refresh` | 0.4.26 | 0.4.26 | 0.5.6 |
| `sistema/frontend` | `framer-motion` | 10.18.0 | 10.18.0 | 13.2.0 |
| `sistema/frontend` | `jsdom` | 29.1.1 | 29.1.1 | 30.0.1 |
| `sistema/frontend` | `lucide-react` | 0.263.1 | 0.263.1 | 1.45.0 |
| `sistema/frontend` | `postcss` | 8.5.10 | 8.5.28 | 8.5.28 |
| `sistema/frontend` | `react` | 18.3.1 | 18.3.1 | 19.3.0 |
| `sistema/frontend` | `react-dom` | 18.3.1 | 18.3.1 | 19.3.0 |
| `sistema/frontend` | `react-router-dom` | 6.30.3 | 6.30.6 | 7.18.3 |
| `sistema/frontend` | `rollup-plugin-visualizer` | 7.0.1 | 7.1.1 | 7.1.1 |
| `sistema/frontend` | `start-server-and-test` | 3.0.2 | 3.0.12 | 3.0.12 |
| `sistema/frontend` | `tailwind-merge` | 3.5.0 | 3.6.0 | 3.6.0 |
| `sistema/frontend` | `tailwindcss` | 3.4.19 | 3.4.19 | 4.3.3 |
| `sistema/frontend` | `typescript` | 5.9.3 | 5.9.3 | 7.0.2 |
| `sistema/frontend` | `vite` | 7.3.3 | 7.3.6 | 8.3.0 |
| `sistema/frontend` | `vitest` | 4.1.5 | 4.1.11 | 5.0.0 |
| `sistema/frontend` | `web-vitals` | 5.2.0 | 5.3.0 | 6.2.1 |
| `sistema/admin` | `@radix-ui/react-slot` | 1.2.4 | 1.3.3 | 1.3.3 |
| `sistema/admin` | `@tanstack/react-query` | 4.44.0 | 4.44.0 | 5.102.8 |
| `sistema/admin` | `@types/leaflet` | 1.9.21 | 1.9.22 | 1.9.22 |
| `sistema/admin` | `@types/react` | 18.3.28 | 18.3.31 | 19.3.0 |
| `sistema/admin` | `@types/react-dom` | 18.3.7 | 18.3.7 | 19.3.0 |
| `sistema/admin` | `@typescript-eslint/eslint-plugin` | 7.18.0 | 7.18.0 | 8.70.0 |
| `sistema/admin` | `@typescript-eslint/parser` | 7.18.0 | 7.18.0 | 8.70.0 |
| `sistema/admin` | `@vitejs/plugin-react` | 5.2.0 | 5.2.0 | 6.1.1 |
| `sistema/admin` | `apexcharts` | 5.10.6 | 5.16.0 | 7.2.0 |
| `sistema/admin` | `autoprefixer` | 10.5.0 | 10.5.6 | 10.5.6 |
| `sistema/admin` | `axios` | 1.16.1 | 1.20.0 | 1.20.0 |
| `sistema/admin` | `cypress` | 15.16.0 | 15.21.1 | 16.0.0 |
| `sistema/admin` | `date-fns` | 2.30.0 | 2.30.0 | 4.4.0 |
| `sistema/admin` | `eslint` | 8.57.1 | 8.57.1 | 10.10.0 |
| `sistema/admin` | `eslint-plugin-react-hooks` | 4.6.2 | 4.6.2 | 7.1.1 |
| `sistema/admin` | `eslint-plugin-react-refresh` | 0.4.26 | 0.4.26 | 0.5.6 |
| `sistema/admin` | `lucide-react` | 0.263.1 | 0.263.1 | 1.45.0 |
| `sistema/admin` | `postcss` | 8.5.10 | 8.5.28 | 8.5.28 |
| `sistema/admin` | `react` | 18.3.1 | 18.3.1 | 19.3.0 |
| `sistema/admin` | `react-apexcharts` | 2.1.0 | 2.1.1 | 2.1.1 |
| `sistema/admin` | `react-dom` | 18.3.1 | 18.3.1 | 19.3.0 |
| `sistema/admin` | `react-router-dom` | 6.30.3 | 6.30.6 | 7.18.3 |
| `sistema/admin` | `start-server-and-test` | 3.0.2 | 3.0.12 | 3.0.12 |
| `sistema/admin` | `tailwindcss` | 3.4.19 | 3.4.19 | 4.3.3 |
| `sistema/admin` | `typescript` | 5.9.3 | 5.9.3 | 7.0.2 |
| `sistema/admin` | `vite` | 7.3.3 | 7.3.6 | 8.3.0 |
| `sistema/admin` | `vitest` | 4.1.11 | 4.1.11 | 5.0.0 |
| `sistema/picking-app` | `@types/react` | 18.3.31 | 18.3.31 | 19.3.0 |
| `sistema/picking-app` | `@types/react-dom` | 18.3.7 | 18.3.7 | 19.3.0 |
| `sistema/picking-app` | `@vitejs/plugin-react` | 5.2.0 | 5.2.0 | 6.1.1 |
| `sistema/picking-app` | `autoprefixer` | 10.5.4 | 10.5.6 | 10.5.6 |
| `sistema/picking-app` | `axios` | 1.19.0 | 1.20.0 | 1.20.0 |
| `sistema/picking-app` | `lucide-react` | 0.263.1 | 0.263.1 | 1.45.0 |
| `sistema/picking-app` | `postcss` | 8.5.25 | 8.5.28 | 8.5.28 |
| `sistema/picking-app` | `react` | 18.3.1 | 18.3.1 | 19.3.0 |
| `sistema/picking-app` | `react-dom` | 18.3.1 | 18.3.1 | 19.3.0 |
| `sistema/picking-app` | `tailwindcss` | 3.4.19 | 3.4.19 | 4.3.3 |
| `sistema/picking-app` | `typescript` | 5.9.3 | 5.9.3 | 7.0.2 |
| `sistema/picking-app` | `vite` | 7.3.6 | 7.3.6 | 8.3.0 |
| `sistema/delivery-app` | `@types/react` | 18.3.31 | 18.3.31 | 19.3.0 |
| `sistema/delivery-app` | `@types/react-dom` | 18.3.7 | 18.3.7 | 19.3.0 |
| `sistema/delivery-app` | `@vitejs/plugin-react` | 5.2.0 | 5.2.0 | 6.1.1 |
| `sistema/delivery-app` | `autoprefixer` | 10.5.4 | 10.5.6 | 10.5.6 |
| `sistema/delivery-app` | `axios` | 1.19.0 | 1.20.0 | 1.20.0 |
| `sistema/delivery-app` | `lucide-react` | 0.263.1 | 0.263.1 | 1.45.0 |
| `sistema/delivery-app` | `postcss` | 8.5.25 | 8.5.28 | 8.5.28 |
| `sistema/delivery-app` | `react` | 18.3.1 | 18.3.1 | 19.3.0 |
| `sistema/delivery-app` | `react-dom` | 18.3.1 | 18.3.1 | 19.3.0 |
| `sistema/delivery-app` | `tailwindcss` | 3.4.19 | 3.4.19 | 4.3.3 |
| `sistema/delivery-app` | `typescript` | 5.9.3 | 5.9.3 | 7.0.2 |
| `sistema/delivery-app` | `vite` | 7.3.6 | 7.3.6 | 8.3.0 |
| `sistema` | `concurrently` | 8.2.2 | 8.2.2 | 10.0.5 |
| `Notificador` | `electron` | 43.4.0 | 43.7.0 | 44.3.0 |
| `Notificador` | `mssql` | 12.7.0 | 12.7.2 | 12.7.2 |

## Linear — rastreabilidade e confirmação

Na fotografia do gate estrutural de 12/09 foram registrados **70 itens de evidência em 68 issues únicas: 67 criadas e JON-44 reutilizada**. O complemento de 13/09, ao final deste relatório, acrescenta 16 issues confirmadas e leva o total atual a 86 evidências/84 issues. JON-44 recebeu evidência adicional, preservação do texto original e revisão justificada de Low para Medium. Não foram criadas duplicatas para D15/D22 nem D16/D26. Todas as 68 issues foram relidas com `orca linear issue ID --full --json`; título, descrição integral retornada, prioridade e conjunto de labels foram confirmados. Não se tomou o JSON de criação sozinho como confirmação final.

**Exceção de etiqueta autorizada pelo coordenador:** o workspace não oferecia `tech-debt` ou `code-quality`; as labels disponíveis foram descobertas pelo CLI e não existe criação de label no comando disponibilizado. A orientação Orca `msg_8e60c8c3fb68` autorizou usar **exatamente uma label provisória, Melhoria**, prefixo `[tech-debt]`/`[code-quality]` no título e campo “Etiqueta obrigatória pendente” na descrição, deixando a reetiquetagem para a fase 5. Portanto, as etiquetas exatas solicitadas originalmente **ainda não estão satisfeitas**. Esta limitação não foi escondida nem substituída por uma label inventada.

As atualizações de descrição, incluindo JON-44/JON-49/JON-63/JON-65/JON-105/JON-113/JON-114 e o complemento de comandos reproduzíveis, retornaram `linear_write_unconfirmed` em algumas chamadas. Foi feito read-back antes de qualquer repetição; o conteúdo já estava aplicado e confirmado, evitando duplicação. JON-106/JON-107 foram criadas por outra sessão e conferidas como não equivalentes a estes achados; não fazem parte das 68 issues desta entrega.

| Achado | Issue | Operação | Etiqueta solicitada | Label confirmada | Prioridade confirmada | Read-back |
|---|---|---|---|---|---|---|
| `F01` | [JON-46](https://linear.app/eojonathan/issue/JON-46/code-quality-checkout-perde-a-recusa-de-substituicao-ao-criar-o-pedido) | Criada | `code-quality` | Melhoria | High | Confirmado |
| `F02` | [JON-47](https://linear.app/eojonathan/issue/JON-47/code-quality-ultima-recotacao-do-pedido-escapa-da-comparacao-price) | Criada | `code-quality` | Melhoria | High | Confirmado |
| `F03` | [JON-48](https://linear.app/eojonathan/issue/JON-48/code-quality-outbox-marca-sent-sem-executar-a-integracao-externa) | Criada | `code-quality` | Melhoria | High | Confirmado |
| `F04` | [JON-49](https://linear.app/eojonathan/issue/JON-49/code-quality-retry-da-outbox-reutiliza-chave-unica-de-job-e-falha-na) | Criada | `code-quality` | Melhoria | High | Confirmado |
| `F05` | [JON-50](https://linear.app/eojonathan/issue/JON-50/code-quality-worker-de-outbox-nao-reivindica-eventos-de-forma-atomica) | Criada | `code-quality` | Melhoria | Medium | Confirmado |
| `F06` | [JON-51](https://linear.app/eojonathan/issue/JON-51/code-quality-outbox-deixa-eventos-processing-presos-apos-interrupcao) | Criada | `code-quality` | Melhoria | Medium | Confirmado |
| `F07` | [JON-52](https://linear.app/eojonathan/issue/JON-52/code-quality-backup-pode-registrar-sucesso-quando-pg-dump-falha) | Criada | `code-quality` | Melhoria | High | Confirmado |
| `F08` | [JON-53](https://linear.app/eojonathan/issue/JON-53/code-quality-compose-de-producao-e-staging-omitem-variaveis) | Criada | `code-quality` | Melhoria | High | Confirmado |
| `F09` | [JON-54](https://linear.app/eojonathan/issue/JON-54/code-quality-compose-prod-usa-senha-crua-na-database-url) | Criada | `code-quality` | Melhoria | Medium | Confirmado |
| `F10` | [JON-55](https://linear.app/eojonathan/issue/JON-55/code-quality-compose-prod-nao-fornece-chave-publica-de-push-a-picking) | Criada | `code-quality` | Melhoria | Medium | Confirmado |
| `F11` | [JON-56](https://linear.app/eojonathan/issue/JON-56/tech-debt-prismaservice-redeclarado-por-modulo-multiplica-pools-e-nao) | Criada | `tech-debt` | Melhoria | Medium | Confirmado |
| `F12` | [JON-57](https://linear.app/eojonathan/issue/JON-57/code-quality-busca-de-produtos-da-separacao-reaplica-resposta-apos) | Criada | `code-quality` | Melhoria | Medium | Confirmado |
| `F13` | [JON-58](https://linear.app/eojonathan/issue/JON-58/code-quality-alerta-de-identity-do-notificador-passa-nivel-incompleto) | Criada | `code-quality` | Melhoria | Medium | Confirmado |
| `F14` | [JON-59](https://linear.app/eojonathan/issue/JON-59/code-quality-notificador-sobrepoe-polling-e-consultas-manuais-sem) | Criada | `code-quality` | Melhoria | Medium | Confirmado |
| `F15` | [JON-60](https://linear.app/eojonathan/issue/JON-60/code-quality-notificador-reautentica-indefinidamente-quando-rota) | Criada | `code-quality` | Melhoria | Medium | Confirmado |
| `F16` | [JON-61](https://linear.app/eojonathan/issue/JON-61/code-quality-cron-de-cancelamento-considera-sempre-um-lote-fixo-de-200) | Criada | `code-quality` | Melhoria | Medium | Confirmado |
| `F17` | [JON-62](https://linear.app/eojonathan/issue/JON-62/code-quality-sync-manual-e-cron-nao-compartilham-a-mesma-exclusao) | Criada | `code-quality` | Melhoria | Medium | Confirmado |
| `F18` | [JON-63](https://linear.app/eojonathan/issue/JON-63/code-quality-lint-backend-falha-por-require-em-implementacao-e-teste) | Criada | `code-quality` | Melhoria | Low | Confirmado |
| `F19` | [JON-64](https://linear.app/eojonathan/issue/JON-64/tech-debt-backend-desliga-verificacoes-de-codigo-morto-e-acumula-20) | Criada | `tech-debt` | Melhoria | Low | Confirmado |
| `F20` | [JON-65](https://linear.app/eojonathan/issue/JON-65/tech-debt-componentes-centrais-concentram-fluxos-inteiros-em-funcoes) | Criada | `tech-debt` | Melhoria | Medium | Confirmado |
| `F21` | [JON-66](https://linear.app/eojonathan/issue/JON-66/tech-debt-hook-de-push-da-equipe-duplicado-integralmente-nos-dois-apps) | Criada | `tech-debt` | Melhoria | Low | Confirmado |
| `F22` | [JON-67](https://linear.app/eojonathan/issue/JON-67/tech-debt-ci-nao-valida-picking-delivery-nem-testes-do-notificador) | Criada | `tech-debt` | Melhoria | Medium | Confirmado |
| `F23` | [JON-68](https://linear.app/eojonathan/issue/JON-68/code-quality-health-herda-bucket-auth-de-20-requisicoes-por-minuto) | Criada | `code-quality` | Melhoria | Medium | Confirmado |
| `F24` | [JON-69](https://linear.app/eojonathan/issue/JON-69/code-quality-metrica-prometheus-declarada-counter-e-calculada-por) | Criada | `code-quality` | Melhoria | Low | Confirmado |
| `F25` | [JON-70](https://linear.app/eojonathan/issue/JON-70/code-quality-checkout-pode-responder-falha-depois-de-criar-o-pedido-e) | Criada | `code-quality` | Melhoria | Medium | Confirmado |
| `F26` | [JON-44](https://linear.app/eojonathan/issue/JON-44/tech-debt-clientes-sem-paginacao-carregam-cadastro-e-enderecos) | Reutilizada/atualizada | `tech-debt` | Melhoria | Medium | Confirmado |
| `D01` | [JON-75](https://linear.app/eojonathan/issue/JON-75/tech-debt-atualizar-babelcore-nas-arvores-com-alertas-npm-audit) | Criada | `tech-debt` | Melhoria | Low | Confirmado |
| `D02` | [JON-76](https://linear.app/eojonathan/issue/JON-76/tech-debt-atualizar-axios-nas-arvores-com-alertas-npm-audit) | Criada | `tech-debt` | Melhoria | Medium | Confirmado |
| `D03` | [JON-77](https://linear.app/eojonathan/issue/JON-77/tech-debt-atualizar-baseline-browser-mapping-nas-arvores-com-alertas) | Criada | `tech-debt` | Melhoria | Low | Confirmado |
| `D04` | [JON-78](https://linear.app/eojonathan/issue/JON-78/tech-debt-atualizar-body-parser-nas-arvores-com-alertas-npm-audit) | Criada | `tech-debt` | Melhoria | Medium | Confirmado |
| `D05` | [JON-79](https://linear.app/eojonathan/issue/JON-79/tech-debt-atualizar-brace-expansion-nas-arvores-com-alertas-npm-audit) | Criada | `tech-debt` | Melhoria | Medium | Confirmado |
| `D06` | [JON-80](https://linear.app/eojonathan/issue/JON-80/tech-debt-atualizar-browserslist-nas-arvores-com-alertas-npm-audit) | Criada | `tech-debt` | Melhoria | Medium | Confirmado |
| `D07` | [JON-81](https://linear.app/eojonathan/issue/JON-81/tech-debt-atualizar-fast-uri-nas-arvores-com-alertas-npm-audit) | Criada | `tech-debt` | Melhoria | Medium | Confirmado |
| `D08` | [JON-82](https://linear.app/eojonathan/issue/JON-82/tech-debt-atualizar-form-data-nas-arvores-com-alertas-npm-audit) | Criada | `tech-debt` | Melhoria | Medium | Confirmado |
| `D09` | [JON-83](https://linear.app/eojonathan/issue/JON-83/tech-debt-atualizar-js-yaml-nas-arvores-com-alertas-npm-audit) | Criada | `tech-debt` | Melhoria | Medium | Confirmado |
| `D10` | [JON-84](https://linear.app/eojonathan/issue/JON-84/tech-debt-atualizar-multer-nas-arvores-com-alertas-npm-audit) | Criada | `tech-debt` | Melhoria | High | Confirmado |
| `D11` | [JON-85](https://linear.app/eojonathan/issue/JON-85/tech-debt-atualizar-qs-nas-arvores-com-alertas-npm-audit) | Criada | `tech-debt` | Melhoria | Medium | Confirmado |
| `D12` | [JON-86](https://linear.app/eojonathan/issue/JON-86/tech-debt-atualizar-sharp-nas-arvores-com-alertas-npm-audit) | Criada | `tech-debt` | Melhoria | High | Confirmado |
| `D13` | [JON-87](https://linear.app/eojonathan/issue/JON-87/tech-debt-atualizar-socketio-parser-nas-arvores-com-alertas-npm-audit) | Criada | `tech-debt` | Melhoria | Medium | Confirmado |
| `D14` | [JON-88](https://linear.app/eojonathan/issue/JON-88/tech-debt-atualizar-ws-nas-arvores-com-alertas-npm-audit) | Criada | `tech-debt` | Melhoria | Medium | Confirmado |
| `D15` | [JON-94](https://linear.app/eojonathan/issue/JON-94/tech-debt-atualizar-familia-react-router-e-dependencias-afetadas-pelos) | Consolidada | `tech-debt` | Melhoria | Medium | Confirmado |
| `D16` | [JON-98](https://linear.app/eojonathan/issue/JON-98/tech-debt-atualizar-vitest-e-mocker-afetados-pelo-mesmo-advisory) | Consolidada | `tech-debt` | Melhoria | Medium | Confirmado |
| `D17` | [JON-89](https://linear.app/eojonathan/issue/JON-89/tech-debt-atualizar-esbuild-nas-arvores-com-alertas-npm-audit) | Criada | `tech-debt` | Melhoria | Low | Confirmado |
| `D18` | [JON-90](https://linear.app/eojonathan/issue/JON-90/tech-debt-atualizar-joi-nas-arvores-com-alertas-npm-audit) | Criada | `tech-debt` | Melhoria | Medium | Confirmado |
| `D19` | [JON-91](https://linear.app/eojonathan/issue/JON-91/tech-debt-atualizar-nanoid-nas-arvores-com-alertas-npm-audit) | Criada | `tech-debt` | Melhoria | Medium | Confirmado |
| `D20` | [JON-92](https://linear.app/eojonathan/issue/JON-92/tech-debt-atualizar-postcss-nas-arvores-com-alertas-npm-audit) | Criada | `tech-debt` | Melhoria | Medium | Confirmado |
| `D21` | [JON-93](https://linear.app/eojonathan/issue/JON-93/tech-debt-atualizar-postcss-selector-parser-nas-arvores-com-alertas) | Criada | `tech-debt` | Melhoria | Low | Confirmado |
| `D22` | [JON-94](https://linear.app/eojonathan/issue/JON-94/tech-debt-atualizar-familia-react-router-e-dependencias-afetadas-pelos) | Criada | `tech-debt` | Melhoria | Medium | Confirmado |
| `D23` | [JON-95](https://linear.app/eojonathan/issue/JON-95/tech-debt-atualizar-react-router-dom-nas-arvores-com-alertas-npm-audit) | Criada | `tech-debt` | Melhoria | Medium | Confirmado |
| `D24` | [JON-96](https://linear.app/eojonathan/issue/JON-96/tech-debt-atualizar-undici-nas-arvores-com-alertas-npm-audit) | Criada | `tech-debt` | Melhoria | Medium | Confirmado |
| `D25` | [JON-97](https://linear.app/eojonathan/issue/JON-97/tech-debt-atualizar-vite-nas-arvores-com-alertas-npm-audit) | Criada | `tech-debt` | Melhoria | Medium | Confirmado |
| `D26` | [JON-98](https://linear.app/eojonathan/issue/JON-98/tech-debt-atualizar-vitest-e-mocker-afetados-pelo-mesmo-advisory) | Criada | `tech-debt` | Melhoria | Medium | Confirmado |
| `D27` | [JON-99](https://linear.app/eojonathan/issue/JON-99/tech-debt-atualizar-shell-quote-nas-arvores-com-alertas-npm-audit) | Criada | `tech-debt` | Melhoria | Medium | Confirmado |
| `F27` | [JON-71](https://linear.app/eojonathan/issue/JON-71/code-quality-pedidos-separacao-e-rotas-retornam-hashes-de-autenticacao) | Criada | `code-quality` | Melhoria | High | Confirmado |
| `F28` | [JON-72](https://linear.app/eojonathan/issue/JON-72/code-quality-motorista-pode-alterar-rota-de-outro-motorista-da-mesma) | Criada | `code-quality` | Melhoria | High | Confirmado |
| `F29` | [JON-73](https://linear.app/eojonathan/issue/JON-73/code-quality-posse-da-tarefa-de-separacao-pode-ser-sobrescrita-ou) | Criada | `code-quality` | Melhoria | Medium | Confirmado |
| `F30` | [JON-74](https://linear.app/eojonathan/issue/JON-74/code-quality-cadastro-oferece-acesso-admin-para-staff-que-o-login-do) | Criada | `code-quality` | Melhoria | Medium | Confirmado |
| `F31` | [JON-100](https://linear.app/eojonathan/issue/JON-100/code-quality-jobs-docker-e-e2e-do-ci-nao-fornecem-variavel-obrigatoria) | Criada | `code-quality` | Melhoria | High | Confirmado |
| `F32` | [JON-101](https://linear.app/eojonathan/issue/JON-101/code-quality-scripts-powershell-operacionais-ignoram-falhas-de) | Criada | `code-quality` | Melhoria | Medium | Confirmado |
| `F33` | [JON-102](https://linear.app/eojonathan/issue/JON-102/code-quality-inicializador-local-encerra-processos-vite-e-nest-de) | Criada | `code-quality` | Melhoria | Medium | Confirmado |
| `F34` | [JON-103](https://linear.app/eojonathan/issue/JON-103/code-quality-scripts-de-release-e-staging-conservam-dominio) | Criada | `code-quality` | Melhoria | Low | Confirmado |
| `F35` | [JON-104](https://linear.app/eojonathan/issue/JON-104/code-quality-arquivo-javascript-de-configuracao-pm2-contem-yaml-e-nao) | Criada | `code-quality` | Melhoria | Low | Confirmado |
| `F36` | [JON-105](https://linear.app/eojonathan/issue/JON-105/code-quality-proxies-nginx-mantem-ip-antigo-da-api-apos-recriacao-do) | Criada | `code-quality` | Melhoria | Medium | Confirmado |
| `F37` | [JON-108](https://linear.app/eojonathan/issue/JON-108/code-quality-auto-scroll-nao-reage-quando-usuario-ativa-reducao-de) | Criada | `code-quality` | Melhoria | Low | Confirmado |
| `F38` | [JON-109](https://linear.app/eojonathan/issue/JON-109/code-quality-watcher-perde-mensagem-quando-linha-jsonl-chega-em) | Criada | `code-quality` | Melhoria | Medium | Confirmado |
| `F39` | [JON-110](https://linear.app/eojonathan/issue/JON-110/code-quality-health-detalhado-verifica-solidcom-legado-quando-catalogo) | Criada | `code-quality` | Melhoria | Medium | Confirmado |
| `F40` | [JON-111](https://linear.app/eojonathan/issue/JON-111/code-quality-health-publico-dispara-consulta-pesada-de-erp-a-cada) | Criada | `code-quality` | Melhoria | Medium | Confirmado |
| `F41` | [JON-112](https://linear.app/eojonathan/issue/JON-112/code-quality-lista-da-separacao-aceita-resposta-antiga-apos-alterar) | Criada | `code-quality` | Melhoria | Medium | Confirmado |
| `F42` | [JON-113](https://linear.app/eojonathan/issue/JON-113/code-quality-upload-rejeitado-pelo-limite-final-deixa-arquivo-gravado) | Criada | `code-quality` | Melhoria | Medium | Confirmado |
| `F43` | [JON-114](https://linear.app/eojonathan/issue/JON-114/code-quality-uploads-concorrentes-do-mesmo-produto-compartilham) | Criada | `code-quality` | Melhoria | Medium | Confirmado |

### Pesquisa de equivalência por achado

A pesquisa inicial usou as 45 issues completas do time JON, incluindo arquivadas, com ausência de paginação restante. Cada linha abaixo corresponde à filtragem textual e à leitura semântica dos candidatos antes do registro. “Candidatos” mede coincidência de texto, não duplicatas. JON-39 corrigiu `/customers`, enquanto F27 cobre respostas de outros módulos; JON-21 trata idempotência do ERP remoto, enquanto F03–F06 tratam o worker local. JON-42/JON-31 são auditorias amplas, sem equivalência automática com cada defeito específico.

| Achado | Termos pesquisados | Candidatos textuais | Decisão |
|---|---|---:|---|
| `F01` | substitui | 2 | Sem equivalente específico; criar achado |
| `F02` | preco | 9 | Sem equivalente específico; criar achado |
| `F03` | outbox | 1 | Sem equivalente específico; criar achado |
| `F04` | outbox | 1 | Sem equivalente específico; criar achado |
| `F05` | outbox | 1 | Sem equivalente específico; criar achado |
| `F06` | outbox | 1 | Sem equivalente específico; criar achado |
| `F07` | backup | 3 | Sem equivalente específico; criar achado |
| `F08` | compose | 0 | Sem equivalente específico; criar achado |
| `F09` | senha | 3 | Sem equivalente específico; criar achado |
| `F10` | push | 3 | Sem equivalente específico; criar achado |
| `F11` | prisma | 1 | Sem equivalente específico; criar achado |
| `F12` | busca | 3 | Sem equivalente específico; criar achado |
| `F13` | identity | 0 | Sem equivalente específico; criar achado |
| `F14` | polling | 2 | Sem equivalente específico; criar achado |
| `F15` | 401 | 1 | Sem equivalente específico; criar achado |
| `F16` | cancelamento | 9 | Sem equivalente específico; criar achado |
| `F17` | sync | 11 | Sem equivalente específico; criar achado |
| `F18` | lint | 0 | Sem equivalente específico; criar achado |
| `F19` | codigo morto | 0 | Sem equivalente específico; criar achado |
| `F20` | componente | 0 | Sem equivalente específico; criar achado |
| `F21` | push | 3 | Sem equivalente específico; criar achado |
| `F22` | CI | 40 | Sem equivalente específico; criar achado |
| `F23` | health | 0 | Sem equivalente específico; criar achado |
| `F24` | Prometheus | 0 | Sem equivalente específico; criar achado |
| `F25` | checkout | 6 | Sem equivalente específico; criar achado |
| `F26` | paginacao | 3 | Reutilizar JON-44 |
| `D01` | @babel/core | 0 | Sem equivalente específico; criar achado |
| `D02` | axios | 0 | Sem equivalente específico; criar achado |
| `D03` | baseline-browser-mapping | 0 | Sem equivalente específico; criar achado |
| `D04` | body-parser | 0 | Sem equivalente específico; criar achado |
| `D05` | brace-expansion | 0 | Sem equivalente específico; criar achado |
| `D06` | browserslist | 0 | Sem equivalente específico; criar achado |
| `D07` | fast-uri | 0 | Sem equivalente específico; criar achado |
| `D08` | form-data | 0 | Sem equivalente específico; criar achado |
| `D09` | js-yaml | 0 | Sem equivalente específico; criar achado |
| `D10` | multer | 0 | Sem equivalente específico; criar achado |
| `D11` | qs | 0 | Sem equivalente específico; criar achado |
| `D12` | sharp | 0 | Sem equivalente específico; criar achado |
| `D13` | socket.io-parser | 0 | Sem equivalente específico; criar achado |
| `D14` | ws | 3 | Sem equivalente específico; criar achado |
| `D15` | @remix-run/router | 0 | Mesmo advisory incluído em D22 |
| `D16` | @vitest/mocker | 0 | Mesmo advisory incluído em D26 |
| `D17` | esbuild | 0 | Sem equivalente específico; criar achado |
| `D18` | joi | 1 | Sem equivalente específico; criar achado |
| `D19` | nanoid | 0 | Sem equivalente específico; criar achado |
| `D20` | postcss | 0 | Sem equivalente específico; criar achado |
| `D21` | postcss-selector-parser | 0 | Sem equivalente específico; criar achado |
| `D22` | react-router | 0 | Sem equivalente específico; criar achado |
| `D23` | react-router-dom | 0 | Sem equivalente específico; criar achado |
| `D24` | undici | 0 | Sem equivalente específico; criar achado |
| `D25` | vite | 1 | Sem equivalente específico; criar achado |
| `D26` | vitest | 0 | Sem equivalente específico; criar achado |
| `D27` | shell-quote | 0 | Sem equivalente específico; criar achado |
| `F27` | senha / hash / customer | 8 | Sem equivalente específico; criar achado |
| `F28` | motorista / rota / driver | 8 | Sem equivalente específico; criar achado |
| `F29` | separa / picking / tarefa | 12 | Sem equivalente específico; criar achado |
| `F30` | staff / equipe / permiss / admin | 14 | Sem equivalente específico; criar achado |
| `F31` | CI / workflow / pipeline / bootstrap | 43 | Sem equivalente específico; criar achado |
| `F32` | PowerShell / restore / backup / script | 5 | Sem equivalente específico; criar achado |
| `F33` | pkill / inicializa / processo / Vite | 2 | Sem equivalente específico; criar achado |
| `F34` | dominio / domínio / email / e-mail | 3 | Sem equivalente específico; criar achado |
| `F35` | PM2 / ecosystem | 0 | Sem equivalente específico; criar achado |
| `F36` | nginx / DNS | 2 | Sem equivalente específico; criar achado |
| `F37` | motion / movimento / carrossel | 1 | Sem equivalente específico; criar achado |
| `F38` | watcher / JSONL / sessão / sessao | 3 | Sem equivalente específico; criar achado |
| `F39` | health / saude / saúde / GetProdutos | 1 | Sem equivalente específico; criar achado |
| `F40` | health / saude / saúde / GetProdutos | 1 | Sem equivalente específico; criar achado |
| `F41` | filtro / busca / separacao | 7 | Sem equivalente específico; criar achado |
| `F42` | upload / temporar / órf / orfa / imagem | 5 | Sem equivalente específico; criar achado |
| `F43` | upload / temporar / órf / orfa / imagem | 5 | Sem equivalente específico; criar achado |

## Revalidação após alterações concorrentes

O relatório foi criado em **11/09/2026 às 20:46:52 -03**. O HEAD inicial não foi capturado explicitamente no instante da enumeração; foi reconstruída uma referência de comparação pelo histórico: `d8c6518f1379e6d87ad1974a08717c6d4cfded46`, commit de 11/09 às 20:07:53 -03. Os digests dos 19 arquivos abaixo coincidem com esse commit, considerando a conversão LF/CRLF do checkout. Isso confirma a fotografia desses arquivos, mas não transforma o horário de criação do relatório em timestamp exato de todos os comandos.

Às **05:14 de 12/09/2026**, a comparação detectou 19 arquivos alterados desde o inventário, incluindo mudanças já commitadas por outra sessão. A revalidação de testes começou às **05:15–05:16 -03**; o HEAD final observado foi `f5ac5759f4a0f4f23511e50503163e0549dbe326` (12/09, 05:15:17 -03). O coordenador orientou em `msg_f9c9af392a26` preservar as mudanças, revalidar os deltas pertinentes e concluir sem aguardar estabilidade indefinida.

Nenhum achado foi invalidado pelos deltas revalidados. F04/F18/F20 tiveram referências/medidas atualizadas no relatório e nas issues, seguidas de novo read-back. F42/F43 são achados adicionais do módulo uploads após corrigir sua classificação no inventário; não são defeitos atribuídos às alterações concorrentes. Os demais itens permanecem associados às evidências e fotografia declaradas. Os dois arquivos novos de lembrete de carrinho foram incluídos na AST/Jest; não se afirma revisão semântica exaustiva da funcionalidade recém-criada.

| Arquivo alterado por outra sessão | SHA inicial (prefixo) | SHA na conferência (prefixo) | Revalidação pertinente |
|---|---|---|---|
| `sistema/admin/src/components/ChangelogModal.tsx` | `80dd0f6d9b2c6c6e` | `891cd80ad41c890a` | Typecheck/AST ou Jest pertinente passaram; não sustentava achado específico invalidado nesta fase |
| `sistema/admin/src/pages/Dashboard.tsx` | `120bac5d59a2559e` | `d4c2c01cb05b3424` | F20 confirmado por AST; função 1147 linhas, início 275 |
| `sistema/admin/src/pages/NotificationsBroadcast.tsx` | `c803140418e41440` | `250ba87d0e45bdd9` | Typecheck/AST ou Jest pertinente passaram; não sustentava achado específico invalidado nesta fase |
| `sistema/admin/src/pages/sections/DashboardSection.tsx` | `f9102c7a36a68261` | `20dfc2db953986ac` | Typecheck/AST ou Jest pertinente passaram; não sustentava achado específico invalidado nesta fase |
| `sistema/admin/src/pages/sections/OrdersSection.tsx` | `f1b4514130918ef4` | `4f98fe935fe4320d` | F20: concentração de UI permanece; alterações não resolvem defeitos de backend |
| `sistema/backend/prisma/schema.prisma` | `542c680a1460b581` | `09631044cc54fdac` | F04/F27 confirmados; índice único agora na linha 1761; campo de carrinho novo |
| `sistema/backend/src/modules/checkout/checkout.module.ts` | `964f643a71df4336` | `e4cee12274c45bab` | F11 confirmado: PrismaService local permanece; scheduler novo adicionado por outra sessão |
| `sistema/backend/src/modules/integrations/antenor-api.service.ts` | `b4664791393dec81` | `72d6c0504ee92f18` | Alterações de contrato não alteram implementação de dispatch da outbox |
| `sistema/backend/src/modules/integrations/order-orchestration.service.spec.ts` | `52b08a8e304f6ca7` | `129710eb514a9758` | Jest atual passou; não invalida defeitos do worker de outbox |
| `sistema/backend/src/modules/integrations/order-orchestration.service.ts` | `f963e261ba9cb051` | `9f33323c0d80c91e` | F03/F08/F31 confirmados: falha ainda enfileira; requireEnv permanece |
| `sistema/backend/src/modules/notifications/ai-notification.service.ts` | `f72e1f4f817a6171` | `8c1706a92e545a89` | Typecheck/AST ou Jest pertinente passaram; não sustentava achado específico invalidado nesta fase |
| `sistema/backend/src/modules/notifications/notifications.controller.ts` | `10a708f13a3a5742` | `c6d1cdd2d4a33496` | Typecheck/AST ou Jest pertinente passaram; não sustentava achado específico invalidado nesta fase |
| `sistema/backend/src/modules/notifications/notifications.service.spec.ts` | `375bae694f08a807` | `b9b5552071e77cc0` | Jest atual passou; novas asserções não cobrem os achados de posse/projeção |
| `sistema/backend/src/modules/notifications/notifications.service.ts` | `69c713e30c3560b6` | `872553bda6abb46b` | Typecheck/AST ou Jest pertinente passaram; não sustentava achado específico invalidado nesta fase |
| `sistema/backend/src/modules/notifications/push-notification.service.ts` | `c6dc6a2f538a2e52` | `d76f47d28e08f78f` | F18 confirmado: erro de lint passou da linha 13 para 14 |
| `sistema/frontend/src/components/DeliveryVerificationModal.tsx` | `36a2168dcf2f2b87` | `0221b25e9f4cd608` | Typecheck/AST ou Jest pertinente passaram; não sustentava achado específico invalidado nesta fase |
| `sistema/frontend/src/components/LocalityPickerModal.tsx` | `2a3cb5bc3f8da5bc` | `c2012146d6ede11b` | Typecheck/AST ou Jest pertinente passaram; não sustentava achado específico invalidado nesta fase |
| `sistema/frontend/src/hooks/useAddressAutofill.ts` | `fe501f606d5feaf0` | `4322497f7452e660` | Typecheck/AST ou Jest pertinente passaram; não sustentava achado específico invalidado nesta fase |
| `sistema/frontend/src/pages/Checkout.tsx` | `b6ff1cc551c9687c` | `2a015aad59edde93` | F01/F02/F25 confirmados no backend; F20 confirmado com 1446 linhas na UI |

As mudanças preexistentes em `docs/deploy.md` foram preservadas. Durante a sessão houve novas alterações em schema e checkout.module, depois commitadas pelo outro ator. Nenhum comando de escrita desta auditoria alterou esses arquivos. O único arquivo gravado por este worker foi este relatório; issues foram a única escrita externa autorizada.

## Limitações e lacunas de cobertura

- **Revisão semântica integral:** não concluída para todos os arquivos e todas as linhas. Inventário, parser/AST e testes foram amplos; a investigação semântica foi dirigida. A coluna de cobertura e os complementos discriminam os níveis. Não há percentual de “código livre de defeitos” nem atestado de revisão manual integral.
- **Etiquetas Linear:** `Melhoria` é provisória, autorizada pelo coordenador. Falta substituir por exatamente `tech-debt` ou `code-quality`, conforme o campo pendente de cada issue. Labels/prioridades atuais foram confirmadas, mas a exigência original de nomes não foi cumprida literalmente.
- **Dados e não-fontes:** uploads reais, backups, binários, certificados, caches, node_modules, runtime embarcado e arquivos privados aparecem na matriz com justificativa. Não foram abertos para inspecionar conteúdo pessoal/segredos. Arquivos criptográficos tiveram somente presença/digest, sem valores publicados. Não foram examinados bytes de todas as dependências como código autoral.
- **Migrations e banco:** validação do schema e varredura estrutural não provam aplicabilidade, reversibilidade, índices efetivos ou ausência de drift. Não houve migrate, seed, restore ou consulta de banco real. Não se mediram locks, pools, memória, consumo de disco nem concorrência em produção.
- **Execução:** testes locais com mocks não substituem E2E de mobile/desktop, navegador real, Electron, upload multipart real, rede ERP, push efetivo, dispositivo iOS/Android ou constraints de Postgres. Cypress/Playwright, build Docker, scanner de imagem, nginx -t e carga não foram executados porque implicariam ambiente, artefatos ou efeitos fora da leitura autorizada.
- **Formato/configuração:** parse válido de YAML/JSON/CSS/PowerShell não valida significado operacional. Arquivos de documentação, markup, batch/VBS, SQL avulso e dados restantes têm revisão semântica integral pendente conforme a matriz. Os relatórios históricos e ferramentas de agentes não foram aceitos como verdade atual do sistema.
- **Dependências:** npm audit/outdated são retratos do registry, podem mudar e não demonstram alcance de exploração. Não foi feito scanner independente de supply chain, SBOM de imagens ou revisão de cada biblioteca nativa. Não foram recomendados upgrades major indiscriminados.
- **Worktree em movimento:** houve alterações de outra sessão e troca de HEAD. As verificações finais cobrem a fotografia e os deltas registrados, sem promessa sobre commits posteriores. Os hashes iniciais foram preservados e os atuais dos deltas foram adicionados.

A entrega documenta evidências acionáveis, testes e limitações. Correções, testes de aceitação propostos, revisão semântica restante, validação em ambiente isolado equivalente ao deploy e ajuste das labels continuam como trabalho posterior; nenhuma correção foi aplicada nesta fase.


### Aceite do gate estrutural pelo coordenador

Em 12/09/2026, a orientação Orca `msg_e115c6b0d347` considerou suficiente para o gate a consolidação estrutural de 70 achados, 68 issues únicas e read-back validado, determinando encerrar após verificar arquivo/git status, sem ampliar o escopo nem perseguir alterações concorrentes posteriores. A entrega atende esse gate autorizado; permanece explicitamente sem certificação de revisão semântica integral e com reetiquetagem pendente conforme as limitações acima.
