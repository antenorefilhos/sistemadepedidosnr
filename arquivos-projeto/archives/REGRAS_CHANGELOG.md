# REGRAS_CHANGELOG.md - Padrao de Versionamento

Versao de referencia: 1.6.0-alpha
Ultima atualizacao: 23 de abril de 2026

## Formato obrigatorio

| Versão | Data | Persona | Autor | Descrição |
|--------|------|---------|-------|-----------|
| 1.4.1-alpha | 18/04/2026 | Jonathan (Orquestrador) | AI (GPT-5.3-Codex) | Correção de build do Admin e alinhamento técnico para PostgreSQL. |
| 1.4.2-alpha | 18/04/2026 | Jonathan (Orquestrador) | AI (GPT-5.3-Codex) | Restore PostgreSQL validado com migração aplicada e sync operacional. |
| 1.4.5-alpha | 19/04/2026 | Jonathan (Orquestrador) | AI (GPT-5.3-Codex) | RBAC, CI e UX operacional do Admin consolidados. |
| 1.4.6-alpha | 19/04/2026 | Jonathan (Orquestrador) | AI (GPT-5.4) | UX polish do admin, modais, dashboard e consistência visual do menu lateral. |
| 1.4.7-alpha | 19/04/2026 | Jonathan (Orquestrador) | AI (GPT-5.4) | Roadmap ativo promovido e Fase 21 da API própria formalizada como próxima etapa estratégica. |
| 1.5.0-alpha | 19/04/2026 | Jonathan (Orquestrador) | AI (GPT-5.3-Codex) | Fases 22-24 consolidadas (orquestração, webhook de pagamentos, testes unitários e i18n). |
| 1.5.1-alpha | 20/04/2026 | Jonathan (Orquestrador) | AI (GPT-5.3-Codex) | Filtro mercadológico do admin corrigido, paginação estabilizada e documentação canônica sincronizada com o código real. |
| 1.5.2-alpha | 21/04/2026 | Jonathan (Orquestrador) | AI (GPT-5.3-Codex) | Home/Carrinho liberados sem login, checkout convidado com flags, correção de imagens via proxy /uploads e documentação canônica atualizada. |
| 1.6.0-alpha | 23/04/2026 | Jonathan (Orquestrador) | AI (GPT-5.3-Codex) | Phase 26 e 27 consolidadas: vitrines CMS com priority/limit (incluindo controles no admin), pagamentos marcados como ativos no painel de integrações e sincronização canônica de versões na documentação. |

## Regras

- usar SemVer com sufixo quando o ciclo ainda nao estiver fechado
- registrar apenas fatos implementados ou validados
- nao misturar roadmap com changelog
- manter sempre a tabela acima no formato exato
- **fonte de verdade da versao do produto**: a maior versao registrada nesta tabela (e refletida em `STATUS.md`/headers canônicos)
- **nao usar** `version` de `package.json` (apps) como versao do produto; esses manifests seguem o ciclo de build, nao o SemVer canonico do projeto