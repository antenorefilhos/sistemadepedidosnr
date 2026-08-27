---
name: salvar
description: Fecha a sessão de trabalho — registra o que foi feito no vault Obsidian (versionamento.md, walkthrough.md, log da sessão), sincroniza o changelog do painel admin com o versionamento e atualiza docs/roadmap.md quando algo da sessão resolveu ou abriu um item lá. Use quando o usuário disser "/salvar" ou "salva a documentação"/"registra isso".
---

# /salvar

Fecha o registro da sessão atual. Rápido e direto — não é pra reescrever o
vault inteiro, só anexar o que mudau desde o último `/salvar`.

Caminhos fixos deste projeto (ver [AGENTS.md](../../../AGENTS.md)):
- Repo: `F:\VC.VERSE\PROJETOS\antenor e filhos\pedidos nr\`
- Vault: `E:\_Biblioteca\Notas Obsidian\Antenor e Filhos\`

## Passos

1. **Descubra o que mudou desde o último `/salvar`.**
   Leia a primeira linha de commit registrada no topo de
   `E:\_Biblioteca\Notas Obsidian\Antenor e Filhos\versionamento.md`
   (formato de tabela, hash na primeira coluna). Rode:
   ```bash
   git -C "F:\VC.VERSE\PROJETOS\antenor e filhos\pedidos nr" log --oneline <ultimo-hash>..HEAD
   ```
   Se `versionamento.md` não tiver nenhum hash ainda (vazio ou primeira vez),
   use os commits desta sessão que você mesmo fez/observou.

2. **Atualize `versionamento.md`** (raiz do vault): insira as novas linhas
   no TOPO da tabela (mais recente primeiro) — hash curto, mensagem,
   data. Não reescreva o arquivo inteiro, só insira.

3. **Atualize `walkthrough.md`** (raiz do vault): acrescente um parágrafo
   curto (3-6 linhas, prosa, PT-BR) resumindo o que a sessão entregou —
   bugs corrigidos, decisões tomadas, o porquê quando relevante. Não repita
   o changelog de commits que já está em `versionamento.md`, sintetize o
   *significado*. Atualize também o campo `atualizado:` no frontmatter.

4. **Crie o log da sessão** em
   `E:\_Biblioteca\Notas Obsidian\Antenor e Filhos\logs\YYYY-MM-DD-descricao-curta.md`
   (data de hoje, descrição em kebab-case de 2-4 palavras). Frontmatter
   obrigatório (`title`, `tags`, `created`, `updated`, `status`, `type`).
   Conteúdo: o que foi pedido, o que foi investigado/decidido, o que ficou
   pendente ou precisa de decisão do usuário. Curto — é um log, não um
   relatório.

5. **Sincronize o changelog do painel admin** com o que entrou no
   `versionamento.md`. Isso é o que o lojista vê no badge de versão da
   Dashboard — se ficar pra trás, o admin anuncia uma versão que já mudou.

   Arquivos:
   - `sistema/admin/src/components/ChangelogModal.tsx` (array `ADMIN_CHANGELOG`)
   - `sistema/admin/package.json` (campo `version`)

   Regras:
   - **Uma entrada por sessão, não por commit.** O changelog é lido pelo
     lojista, não por dev: agrupe os commits da sessão numa release só.
   - Se a versão do topo (`ADMIN_CHANGELOG[0]`) **ainda não foi entregue ao
     cliente**, acrescente os destaques novos nela em vez de criar outra.
     Crie versão nova quando a anterior já foi deployada e comunicada.
   - Bump da versão: `patch` pra correções, `minor` pra funcionalidade nova.
     **O `version` do `package.json` tem que bater com `ADMIN_CHANGELOG[0].version`**
     — é de lá que sai o badge; esquecer isso faz o admin mostrar a versão
     antiga com o changelog novo.
   - Escreva em linguagem de lojista, não de commit: "Bolinhas do carrossel
     saíram de cima da foto", não "refactor: move dots outside overflow
     container". Sem nome de arquivo, sem hash, sem jargão.
   - `type`: `feat` pra capacidade nova, `fix` pra correção, `perf` pra
     desempenho, `docs` pra documentação.
   - Só entra o que o lojista percebe. Refactor interno, dedup de código,
     teste e ajuste de build ficam de fora — esses já estão no
     `versionamento.md` e no log da sessão.

   Isso mexe em código (não só doc), então vale o passo 7: só commita/deploya
   com confirmação explícita.

6. **Se algo da sessão resolveu ou abriu um item de**
   `F:\VC.VERSE\PROJETOS\antenor e filhos\pedidos nr\docs\roadmap.md`,
   marque o checkbox (`[ ]` → `[x]`) ou adicione a linha nova, seguindo o
   formato já existente no arquivo. Só mexa se realmente houver
   correspondência clara — não force um item pra caber.

7. **Pergunte antes de commitar/pushar código** — `/salvar` documenta, não
   commita mudanças de código automaticamente. O passo 5 mexe em código do
   admin (`ChangelogModal.tsx` e `package.json`) e só chega no lojista depois
   de rebuildar o container `antenor_admin` — ofereça commit+deploy junto,
   mas só execute com confirmação explícita, mesma regra de sempre do
   projeto (CLAUDE.md). Vale também pras docs (`docs/roadmap.md`,
   `AGENTS.md`, `CLAUDE.md`).

8. **Responda curto**: liste em 3-5 linhas o que foi atualizado (arquivos
   tocados), sem repetir o conteúdo inteiro. Regra do projeto: respostas
   curtas.
