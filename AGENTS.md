# AGENTS.md — Antenor & Filhos (Sistema de Pedidos)

- **Idioma**: TUDO SEMPRE EM PT-BR.
- **Fonte de verdade das regras operacionais do código**: [CLAUDE.md](CLAUDE.md), na raiz deste repo. Este arquivo não duplica aquelas regras — só referencia. Leia o CLAUDE.md antes de qualquer tarefa de código.
- **Modelo de memória**: vault Obsidian (Zettelkasten) + `docs/` deste repo + Graphify (knowledge graph). Três camadas, cada uma com um papel diferente — ver seção 4.

---

## 1. Caminhos oficiais

| O quê | Onde |
|---|---|
| Código-fonte (este repo) | `F:\VC.VERSE\PROJETOS\antenor e filhos\pedidos nr\` |
| Vault Obsidian do projeto | `E:\_Biblioteca\Notas Obsidian\Antenor e Filhos\` |
| Deploy (VPS Hostinger) | `root@179.198.122.67`, repo clonado em `/opt/antenor` (branch `main`) |
| Domínio | `antenorefilhos.com.br` (subdomínios: `mercado.`, `admin.`, `api.`, `separacao.`, `entrega.`) |

Não confundir com caminhos antigos que aparecem em notas arquivadas do vault
(`D:\NOVA ORGANIZAÇÃO\PROJETOS\...` não existe mais — era de um setup
anterior). Os caminhos acima são os reais, verificados nesta reorganização.

---

## 2. Estrutura da vault Obsidian (Zettelkasten)

Reorganizada em 2026-08-12 a partir de uma estrutura numerada antiga
(`00 - Dashboard`, `01 - Projeto`, etc.) que tinha ~15 arquivos duplicando a
mesma informação de "status atual" em versões divergentes. Nada foi
apagado — os originais estão em `archive/originais-pre-migracao/`.

```
E:\_Biblioteca\Notas Obsidian\Antenor e Filhos\
├── AGENTS.md                    # este arquivo, espelhado do repo
├── architecture/                # visão geral, decisões, milestones, riscos, runbook de release
├── pipeline/                    # integração ERP Solidcom, webhooks, API pública
├── data/                        # configurações, modelo de dados/schema, histórico de migrations
├── features/                    # CMS, testes, operação local/Docker, referência técnica frontend/backend
├── logs/                        # sessões passadas, formato YYYY-MM-DD-descricao.md
├── archive/                     # ferramental Obsidian antigo (Graphify/Dataview/Templates) + originais pré-migração
├── versionamento.md             # log cronológico correlacionado aos commits git reais
└── walkthrough.md               # síntese em prosa das entregas recentes
```

**Achado importante da migração**: o vault estava congelado numa foto de
maio–julho de 2026 — nenhum conceito hoje central no código real
(`RelaxedThrottle`, trava `PRICE_DIVERGED` do checkout, `staff`/
`moduleAccess`, domínio `@antenorefilhos.com.br`) aparecia em nenhuma nota.
Ao consultar qualquer nota migrada como fonte de verdade sobre o estado
*atual* do sistema, confira contra o código ou o `CLAUDE.md` antes de
confiar — o vault registra decisões e arquitetura, não é live state.

**Pendência sinalizada pela migração**: algumas notas antigas (`data/
configuracoes.md`, `features/referencia-tecnica-frontend-backend.md`)
citavam `admin@antenor.com.br` — esse domínio **não existe** (ver
CLAUDE.md, "Domínio e acessos"; o correto é `@antenorefilhos.com.br`). Ficou
sinalizado como alerta dentro dos próprios arquivos migrados, não corrigido
às cegas — confirme antes de reusar qualquer credencial/e-mail de nota
antiga do vault.

---

## 3. Regras de documentação (Zettelkasten)

- Wikilinks `[[nome-da-nota]]` ou `[[pasta/nome-da-nota]]` para conexões no graph view do Obsidian.
- Frontmatter YAML obrigatório em toda nota: `title`, `tags`, `created`, `updated`, `status`, `type`.
- Nomes de arquivo em `kebab-case`.
- Não duplicar conteúdo que já vive em `docs/` do repo de código
  (`docs/roadmap.md`, `docs/infraestrutura.md`, `docs/deploy.md`,
  `docs/solidcom-api.md`) — referencie por caminho relativo a partir do
  vault em vez de copiar.

---

## 4. Graphify + Vault

O Graphify (skill `/graphify` do Claude Code) roda contra este vault,
construindo um knowledge graph navegável a partir das notas. O ferramental
específico do Graphify (dashboards, configuração, guias de visualização)
mora em `archive/graphify-tooling/` — não é lixo, é infraestrutura da
própria skill, só não é conteúdo de trabalho do dia a dia.

O repo de código também tem uma pasta `docs/obsidian/` — isso é uma saída
pontual de sincronização (ex: `_CRITICO_Sincronizacao ERP Solidcom.md`),
não o vault inteiro. As duas coisas são independentes: o vault em `E:\...`
é o wiki de trabalho; `docs/obsidian/` no repo é um artefato específico
versionado com o código.

---

## 5. Regras de commit git

Padrão real observado no histórico deste repo (`git log --oneline`) — siga
este, não invente um genérico:

```
tipo(escopo): descrição curta em pt-br, direta, sem ponto final
```

Exemplos reais:
- `fix(checkout): nao deixa GPS automatico sobrescrever endereco ja verificado na home`
- `feat(storefront): login com e-mail, CPF ou celular`
- `docs: registra bug do DNS cache do nginx apos rebuild isolado da api`
- `fix(admin): F5 sempre voltava pra dashboard, perdia a tela atual`

Tipos usados: `feat`, `fix`, `docs`, `refactor`, `perf`, `test`, `chore`.
Escopo entre parênteses quando o commit é claramente de uma área
(`storefront`, `admin`, `checkout`, `search`, `orders`, `pwa`); omitido
quando é transversal. Mensagens sem acento (o repo tradicionalmente escreve
commits sem acentuação, embora prosa normal em docs/comentários use
acentuação normal).

Regras adicionais (já em vigor neste projeto, ver CLAUDE.md):
- Corrigir bug vale nas duas versões (mobile prioridade, depois desktop).
- Nunca commitar segredo, token, CPF ou CNPJ real.
- Nunca commitar sem pedido explícito do usuário — `git commit`/`push` são
  ações confirmadas, não automáticas.

---

## 6. Versionamento

Cada melhoria relevante é documentada em `versionamento.md` na raiz do
vault, correlacionada ao(s) commit(s) git reais que a implementaram (hash +
mensagem), em ordem cronológica reversa (mais recente no topo). Não inventar
números de versão semver que o projeto não usa de fato — a unidade real de
versionamento aqui é o commit.
