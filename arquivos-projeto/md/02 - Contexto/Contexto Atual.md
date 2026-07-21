---
tipo: contexto
status: ativo
area: memoria
prioridade: alta
criado: 2026-05-24
atualizado: 2026-05-24
tags:
  - contexto
  - memoria
  - retomada
---

# Contexto Atual

<!-- AUTO START -->
## Estado do Projeto

Stack 100% operacional (storefront: 3000, admin: 3002, api: 3001). M39 em execução ativa: backoffice de produtos reformulado com modal centralizada premium e gestão de mídia integrada. 34/34 testes Cypress E2E passando.

## Última Atualização

- **Data:** 2026-05-25
- **O que mudou:** M39 — Tela de edição de produtos completamente redesenhada (slide-over → modal centralizada) e gestão de mídia de produto implementada (upload de 2 slots de foto + URL de vídeo promocional).
- **Por que mudou:** A tela lateral gerava má experiência de uso (tela vazia ao lado). O operador precisava de forma de associar fotos e vídeos aos produtos.

## Onde o Usuário Parou

Entrega do M39 M6 concluída: upload dual-slot de imagens + campo de vídeo promocional. As décisões de arquitetura (upload físico para fotos, link para vídeo) estão documentadas no `Histórico de Alterações.md`.

## Objetivo Atual

Continuar o M39 com foco nos próximos sub-milestones: filtros operacionais, seleção em lote e edição rápida inline.

## Próximas Ações

- [x] Redesign da modal de edição de produto (M39 M5 ✅)
- [x] Upload dual-slot de fotos + campo URL de vídeo (M39 M6 ✅)
- [ ] Filtros salvos e atalhos operacionais (sem estoque, sem categoria, inativos)
- [ ] Seleção em lote e ações massivas na tabela de produtos
- [ ] Avaliar retomada de M33 (Inteligência Avançada)

## Decisões Recentes

- **[25/05] Modal centralizada:** slide-over lateral substituído por modal w-[92vw] com grid 2 colunas — melhor uso de espaço e UX premium.
- **[25/05] Upload por slot:** Foto 1 → `{ean}.webp`, Foto 2 → `{ean}_2.webp`. Backend NestJS com rota `/:ean/:slot?` opcional.
- **[25/05] Vídeo por link (não upload):** YouTube, Instagram e TikTok são convertidos para iframe embed no storefront pela função `ProductVideoEmbed`.
- **[24/05] Memory-Wiki Obsidian:** arquivos canônicos mantidos em `arquivos-projeto/md/` para compatibilidade com `agent.md` e automações.

## Arquivos Importantes

- [[Home]]
- [[Onde Parei]]
- [[ROADMAP|ROADMAP.md]]
- [[STATUS|STATUS.md]]
- [[Agentes]]
- [[Pendências]]
<!-- AUTO END -->

## Observações Manuais

<!-- MANUAL START -->
Espaço reservado para anotações humanas.
<!-- MANUAL END -->
