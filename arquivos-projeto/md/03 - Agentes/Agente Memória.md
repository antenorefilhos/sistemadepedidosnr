---
tipo: agente
status: ativo
funcao: memoria
prioridade: alta
criado: 2026-05-24
atualizado: 2026-05-24
tags:
  - agente
  - memoria
  - contexto
---

# Agente Memória

## Função

Manter a memória contínua do projeto, garantindo que o contexto atualizado e a linha do tempo histórica estejam sempre em sincronia com o código e as decisões tomadas.

## Responsabilidades

- Atualizar [[Contexto Atual]]
- Atualizar [[Onde Parei]]
- Registrar mudanças em [[Histórico de Alterações]]
- Registrar decisões em [[Decisões]]
- Manter lista de pendências sincronizada
- Evitar perda de contexto ao fazer handoff entre sessões
- Garantir a integridade dos Wikilinks e conformidade com o `agent.md`

## Quando Atualizar

Atualizar quando:
- Uma nova decisão for tomada;
- Uma tarefa/milestone for concluído;
- Uma nova pendência ou bug surgir;
- O usuário alterar os objetivos prioritários;
- A sessão de trabalho estiver sendo encerrada para handoff.
