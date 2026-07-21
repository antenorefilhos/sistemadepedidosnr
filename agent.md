# Agent Workflow Rules

---

## Skill obrigatória

Toda IA deve seguir a skill `.github/skills/obsidian-vault-sync.SKILL.md` para integração, sincronização e uso do vault Obsidian como fonte primária de contexto, decisões e delegações.

---

## PROMPT PADRÃO DE START (toda IA)

"Ao iniciar qualquer sessão ou leitura deste projeto, siga obrigatoriamente:
1. Leia e siga todas as regras deste agent.md.
2. Use o vault Obsidian do projeto como fonte primária de contexto, decisões, histórico e delegações.
3. Antes de responder, consulte sempre os arquivos canônicos do vault (sob `01 - Projeto/` e `02 - Contexto/`, como `INICIO_AQUI.md`, `STATUS.md`, `ROADMAP.md`, `MEMORIA_PROJETO.md`, etc).
4. Não inicie nenhuma implementação sem milestones explícitos e registrados.
5. Toda entrega, decisão ou delegação deve ser registrada e sincronizada no vault.
6. Se houver divergência entre vault e código, o vault é a verdade."

## Milestones obrigatorios em toda tarefa (SEM EXCECAO)

Antes de executar qualquer tarefa, criar milestones curtos e sequenciais.
Isso inclui tarefas simples, ajustes pontuais, correcoes rapidas e requests de "continue".

Formato minimo:
1. M1 - Diagnostico e mapeamento
2. M2 - Implementacao
3. M3 - Validacao e deploy
4. M4 - Atualizacao de documentacao

## Regra de execucao

### Integração multi-IA e uso obrigatório do vault Obsidian

- Toda IA (Copilot, Antigravity, Codex, etc.) deve usar o vault Obsidian do projeto como fonte PRIMÁRIA de contexto, decisões, histórico, delegações e documentação.
- Antes de responder, pesquisar e referenciar sempre os arquivos canônicos do vault (sob `01 - Projeto/` e `02 - Contexto/`, como `INICIO_AQUI.md`, `STATUS.md`, `ROADMAP.md`, `MEMORIA_PROJETO.md`, etc).
- Toda sessão, contexto, milestone, decisão e entrega deve ser registrada e sincronizada no vault.
- Delegações entre IAs devem ser feitas via atualização dos arquivos do vault, nunca apenas por mensagem temporária.
- Se o contexto do vault divergir do código, o vault é a verdade e o código deve ser ajustado.
- Não iniciar implementação sem milestones definidos.
- Atualizar o status de cada milestone ao concluir.
- Em tarefas grandes, quebrar por módulo (frontend, admin, backend).
- Encerrar somente com validação e documentação sincronizadas no vault.
- Se uma resposta for enviada sem milestones, a resposta está fora do padrão e deve ser corrigida no próximo turno.
