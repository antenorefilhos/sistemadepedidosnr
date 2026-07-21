# AI_COORDINATION.md - Coordenacao de IAs

Data: 23 de abril de 2026
Versao de referencia: 1.6.0-alpha

## Papeis e hierarquia

| Ferramenta | Papel | Responsabilidade |
|------------|-------|------------------|
| OpenRouter (Jonathan) | Orquestrador | Arquitetura, roadmap, governanca documental e aprovacoes estruturais. |
| GitHub Copilot | Tatico | Implementacao local, refactors focados, testes e validacoes do trecho alterado. |
| VS Code / Open Code | Interface | Ambiente de execucao, navegacao e verificacao. |

## Regras para o agente tatico

### UI e UX
- usar ui-ux-pro-max em toda demanda de interface
- manter burgundy, gold e glassmorphism como base visual
- preservar acessibilidade, navegacao por teclado e densidade mobile

### Arquitetura
- backend NestJS deve concentrar regras em services e DTOs
- frontend e admin devem manter contratos tipados e React Query para dados remotos
- evitar any e contratos improvisados

### Governanca de mudancas
- toda mudanca estrutural deve ser refletida na documentacao canonica
- snapshots historicos ficam em archives; documentos vivos ficam em md
- roadmap ativo fica em [ROADMAP.md](./ROADMAP.md)

## Diretriz estrategica atual

- a Fase 21 formal do roadmap e a API propria da Antenor & Filhos
- o dominio interno deve ser modelado pela API propria, nao pela API da Solidcom
- a Solidcom deve operar como integracao de segundo plano para ERP