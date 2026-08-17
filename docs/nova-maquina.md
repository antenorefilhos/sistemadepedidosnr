# Mudar de máquina (reformatação, PC novo, etc.)

Este projeto é pensado pra ser portátil: tudo que importa (código, `.env`,
uploads, docs, vault linkado) vive dentro da pasta do projeto — hoje em
`F:\VC.VERSE\PROJETOS\antenor e filhos\pedidos nr\`, num HD separado do `C:`
do sistema. Reformatar o `C:` não afeta o projeto em si. O que precisa de
atenção é o que fica **fora** da pasta do projeto, em `C:`.

## O que já está seguro (dentro da pasta do projeto)

- Código-fonte inteiro, `.env`/`.env.local`/`.env.staging` de todo serviço
  (`sistema/`, `sistema/backend/`, `Notificador/`) — mesmo sendo
  `.gitignore`d, estão em disco dentro da pasta, não em `C:`.
- Fotos de produto (`sistema/backend/uploads/products/`).
- `.claude/skills/` do projeto (ex: skill `/salvar`) e `.claude/launch.json`
  — também dentro da pasta, mesmo sendo `.gitignore`d.
- `AGENTS.md` e `docs/` — versionados no git, chegam em qualquer clone novo.

## O que precisa de backup manual antes de reformatar

Roda isso ANTES de reformatar (destino é a própria pasta do projeto, que já
vai pro HD junto):

```powershell
mkdir "F:\VC.VERSE\PROJETOS\antenor e filhos\pedidos nr\_backup-pre-formatacao"
Copy-Item -Recurse "C:\Users\<usuario>\.claude" "F:\VC.VERSE\PROJETOS\antenor e filhos\pedidos nr\_backup-pre-formatacao\claude-global-config"
Copy-Item -Recurse "C:\Users\<usuario>\.ssh" "F:\VC.VERSE\PROJETOS\antenor e filhos\pedidos nr\_backup-pre-formatacao\ssh"
```

| Item | Por quê |
|---|---|
| `C:\Users\<usuario>\.claude\` | Config global do Claude Code + memória auto-persistente entre sessões (`.claude/projects/*/memory/`) — perde tudo que o agente aprendeu sobre você e o projeto se não copiar. |
| `C:\Users\<usuario>\.ssh\antenor_vps` (+ `.pub`, `config`) | Chave SSH sem senha cadastrada no painel Hostinger pra acesso à VPS. Sem ela, precisa gerar uma nova e recadastrar em VPS → Configurações → Chaves SSH. |

**Volumes Docker locais (`pgdata`, `meili_data`)**: vivem dentro do disco
virtual do WSL2/Docker Desktop, não são arquivos comuns pra copiar — se não
fizer backup específico do Docker Desktop (Settings → Resources → Advanced,
ou `wsl --export`), o ambiente local recomeça do zero depois (schema volta
via `prisma migrate deploy`, dados via reimport/reseed do ERP). Não é
crítico — produção não depende disso — só dá retrabalho de setup local.
Redis não tem volume, é cache/fila descartável por design.

**Credencial de `git push`**: fica no Windows Credential Manager (`git
config credential.helper` = `wincred`), não é arquivo pra copiar — só loga
de novo (`git push` pede usuário/token na primeira vez na máquina nova).

## Depois de reformatar / na máquina nova

1. Reinstala: Docker Desktop, Node.js, Git, Claude Code.
2. Restaura o backup:
   ```powershell
   Copy-Item -Recurse "F:\VC.VERSE\PROJETOS\antenor e filhos\pedidos nr\_backup-pre-formatacao\claude-global-config" "C:\Users\<usuario>\.claude"
   Copy-Item -Recurse "F:\VC.VERSE\PROJETOS\antenor e filhos\pedidos nr\_backup-pre-formatacao\ssh" "C:\Users\<usuario>\.ssh"
   ```
3. Testa o acesso à VPS: `ssh antenor-vps "echo ok"` (usa o `Host antenor-vps`
   já configurado em `~/.ssh/config`, restaurado no passo 2).
4. Sobe o ambiente local: `docker compose -f sistema/docker-compose.yml up -d --build`.
5. Confirma o `git remote`/login: `git -C "F:\...\pedidos nr" push` (vai
   pedir autenticação na primeira vez).

## Aconteceu de verdade: chave SSH não foi copiada (17/08/2026)

Numa reformatação real, o backup em `_backup-pre-formatacao/` só continha
`claude-global-config` — a pasta `.ssh` nunca foi copiada, apesar da
instrução acima. Resultado: nenhuma chave pra VPS na máquina nova. Solução
aplicada: gerou-se uma chave nova (`ssh-keygen -t ed25519`), cadastrada como
chave *adicional* no painel Hostinger (VPS → Configurações → Chaves SSH,
nome `claude-code@antenor`) — não substitui a original, só soma. **Confirme
de verdade que `Copy-Item -Recurse ... .ssh` rodou** antes de reformatar;
não custa nada e evita ter que regenerar chave e recadastrar no painel toda
vez.

## Vault Obsidian

O vault (`E:\_Biblioteca\Notas Obsidian\Antenor e Filhos\`) está num terceiro
disco, fora tanto do `C:` quanto da pasta do projeto — confirme que ele
também sobrevive à reformatação (é `E:`, então deve sobreviver junto com o
`F:`, mas vale conferir antes de formatar o `C:` que os dois discos
continuam saudáveis). Ver estrutura em [AGENTS.md](../AGENTS.md).
