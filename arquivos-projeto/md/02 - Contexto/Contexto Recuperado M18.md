---
tipo: contexto-recuperado
status: ativo
area: memoria
prioridade: alta
criado: 2026-05-24
tags:
  - recuperacao
  - vscode-brain
  - copilot
  - m18
  - memorias-repo
---

# Contexto Recuperado do VSCode (Brain)

Este documento centraliza as informações e contexto recuperados do histórico de chat do GitHub Copilot (o "brain" do VSCode de 145MB), para manter a wiki inteligente e atualizada em relação ao que as IAs anteriores construíram.

## Estado do Milestone 18 (Performance & Core Web Vitals)
Apesar de pequenos conflitos em documentações antigas, o **M18 está essencialmente CONCLUÍDO**, com as seguintes entregas técnicas realizadas:
- **Code-splitting e Bundle:** Bundle principal reduzido drasticamente (de 26.72 kB para 6.52 kB gzip - redução de ~76%).
- **Chunks Manuais:** Configurados para bibliotecas pesadas (`axios`, `date-fns`, `react-hot-toast`, `react-helmet-async`).
- **Otimização de Imagens e Renderização:** Preconnect hints configurados, imagens com atributos `width`/`height` explícitos e `decoding="async"`.
- **Nginx:** Configurado cache imutável de 1 ano e compressão `gzip level 6`.
- **Monitoramento:** Web-vitals integrados e disparando no `main.tsx`.

**O que ficou pendente (DoD em Produção):**
- [ ] Lighthouse score de 90+ (depende de testes no ambiente real/deploy).
- [ ] LCP (Largest Contentful Paint) menor que 2.5s (depende de dados acumulados pelo uso no RUM - Real User Monitoring).

## Próximos Passos (Transição de M18 para M19 / M39)
A discussão no momento da parada focava em se o desenvolvimento deveria:
1. Avançar para o **M19** (UX Avançado e Interatividade).
2. Focar no **M39** (Módulo Admin - UX de Produtos, seleção em lote, painel lateral).

## Conhecimento Implícito (Repositório /memories/repo/)
O brain revelou a existência de diversas regras e "contratos" fundamentais aprendidos pela IA nas sessões anteriores. Elas guiam as guardrails do projeto e formam o modelo mental do e-commerce:

- `cms-vitrines-priority-limit.md`
- `docker-startup-complete.md`
- `fractional-erp-contract.md` (Contrato do ERP)
- `frontend-typescript-build-guardrails.md` (Regras de Build do TS no Frontend)
- `m1-taxonomia-unificada.md` (Taxonomia)
- `m2-collections-contract-compat.md` (Coleções)
- `phase21-order-orchestration.md` (Orquestração de Pedidos)
- `product-pricing-single-source.md` (Precificação de Produtos como Fonte Única - uso de `productPricing.ts`)
- `solidcom-classification-sync.md` (Sincronização com ERP Solidcom)

> [!tip] Inteligência da Wiki
> Este arquivo serve para injetar na "Big Brain" do Obsidian todo o contexto contínuo que antes ficava isolado nas sessões do Copilot. Qualquer nova IA que ler isso saberá exatamente o nível de maturidade arquitetural e de performance atual (M18 concluído, regras rígidas de precificação, etc).

## Transição Oficial e Symlinks

O último ato da sessão que gerou este contexto foi a formalização do modelo Multi-IA, estabelecendo regras absolutas de sincronização com este Vault e alterando o arquivo `agent.md`. Leia [[Protocolo Multi-IA]] para os detalhes da estruturação da mente colmeia.
