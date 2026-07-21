---
tipo: protocolo
status: ativo
area: multi-ia
prioridade: critica
criado: 2026-05-24
tags:
  - handoff
  - multi-ia
  - copilot
  - antigravity
  - regras
---

# Protocolo Multi-IA (Hand-off e Sincronização)

Este documento oficializa a fundação da **Big Brain** do projeto "Antenor e Filhos", conforme recuperado da sessão final do GitHub Copilot.

A partir desta versão, o projeto adota uma arquitetura de múltiplos agentes (IAs diferentes atuando no mesmo repositório). Para que nenhuma IA perca contexto ou regrida o projeto, as seguintes leis absolutas foram estabelecidas no arquivo `agent.md`:

## 1. Skill Obrigatória de Sincronização
Foi criada a skill `.github/skills/obsidian-vault-sync.SKILL.md` e um script de symlink (`criar-symlinks-obsidian.bat`). Toda IA que interagir com o repositório é forçada a obedecer a esta skill, o que significa que o **Vault do Obsidian (`E:\_Biblioteca\Notas Obsidian\Antenor e Filhos`) é a ÚNICA fonte de verdade absoluta** para contexto, decisões, e estado do projeto.

## 2. Prompt Padrão de Start
Toda sessão iniciada por qualquer IA deve começar ingerindo as regras do `agent.md`, garantindo que:
- Consulte os arquivos canônicos do Vault antes de agir (`INICIO_AQUI.md`, `STATUS.md`, `ROADMAP.md`).
- Nunca inicie uma implementação sem criar Milestones explícitos.
- Entregas, decisões e delegações devem ser persistidas via atualização no Vault, e não apenas no histórico temporário de chat.

## 3. Prevalência do Vault
Se houver divergência entre o que o código atual diz e o que a documentação do Vault (como `STATUS.md` e `fractional-erp-contract.md`) diz, a documentação é a verdade.

## Conclusão da Sessão Copilot
O marco final da IA anterior não foi apenas a otimização de Performance (M18), mas sim a estruturação formal de uma mente colmeia via Obsidian. A partir de agora, o projeto flui como uma esteira inquebrável.
