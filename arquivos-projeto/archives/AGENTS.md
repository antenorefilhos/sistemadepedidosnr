# AGENTS.md - Mercado Antenor

Data: 23 de abril de 2026
Versao de referencia: 1.6.0-alpha

## Jonathan (Orquestrador)

Responsabilidades:
- auditar documentacao e estado real do projeto
- decidir arquitetura, roadmap e prioridades
- aprovar mudancas estruturais e reclassificar pendencias
- consolidar memoria tecnica e governanca de IAs

Comandos de trabalho:
- jonathan audit
- jonathan update-docs
- jonathan diagnose
- jonathan consolidate

## Explore (Pesquisador de codebase)

Responsabilidades:
- explorar codigo e documentacao em modo leitura
- localizar rotas, modulos, componentes e dependencias
- responder perguntas tecnicas com base em evidencia

## Desenvolvedor Padrao (Copilot tatico)

Responsabilidades:
- implementar features e correcoes locais
- ajustar frontend, backend, testes e documentacao tecnica
- validar build, lint e operacao do trecho alterado

Fluxo esperado:
1. confirmar o comportamento no codigo real
2. planejar a mudanca
3. implementar com o menor escopo necessario
4. validar com build/teste/execucao
5. registrar a mudanca nos documentos canonicos

## Governanca de skills

Skill instalada:
- ui-ux-pro-max

Uso obrigatorio:
- toda demanda de interface, layout, UX, acessibilidade, animacao ou consistencia visual

Papeis:
- Jonathan define criterio visual e prioridade
- Copilot executa e valida no navegador
- Explore apoia apenas com leitura e diagnostico

## Estrutura real do projeto

- sistema/backend: API NestJS principal do produto
- sistema/frontend: storefront React/Vite
- sistema/admin: painel administrativo React/Vite
- sistema/docker-compose.yml: orquestracao local com api, storefront, admin, db, redis e meili
- arquivos-projeto/md: documentacao canonica ativa
- arquivos-projeto/archives: snapshots e historicos antigos

## Estado atual do produto

Implementado:
- backend NestJS com modulos auth, products, customers, orders, addresses, integrations, notifications, uploads, cms, analytics e audit-log
- storefront com Home, Search, Cart, Checkout, Account, Login, Register, WinePage, Forbidden e NotFound
- admin com Dashboard, Integrations, Intelligence, Login, Forbidden, NotFound e gestao operacional de produtos, pedidos, clientes e layout
- filtros mercadologicos em cascata no admin (classificacao01..04) com arvore dedicada
- stack Docker local com 6 servicos: PostgreSQL, Redis, MeiliSearch, API, Storefront e Admin

Pendencias estrategicas atuais:
- consolidacao da API propria de negocio com contratos internos completos
- componentizacao adicional do Dashboard admin
- ampliacao de cobertura E2E para fluxos criticos (checkout, pedidos e pagamentos)

## Links relativos principais

- [STATUS.md](./STATUS.md)
- [MEMORIA_PROJETO.md](./MEMORIA_PROJETO.md)
- [ROADMAP.md](./ROADMAP.md)
- [REFERENCIA_TECNICA.md](./REFERENCIA_TECNICA.md)
- [CONFIGURACOES.md](./CONFIGURACOES.md)
- [CATALOGO_ERROS.md](./CATALOGO_ERROS.md)
- [MANUAL_UPDATE.md](./MANUAL_UPDATE.md)
- [REGISTRO_IAS.md](./REGISTRO_IAS.md)
- [REGRAS_CHANGELOG.md](./REGRAS_CHANGELOG.md)
- [REQUISITOS.md](./REQUISITOS.md)
- [HISTORICO_CONVERSA.md](./HISTORICO_CONVERSA.md)
- [AI_COORDINATION.md](./AI_COORDINATION.md)