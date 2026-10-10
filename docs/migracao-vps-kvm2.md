# Migração para a VPS nova (Hostinger KVM 2)

Jonathan já comprou a VPS nova (10/10/2026). Este documento é o plano —
atualiza conforme a migração avança, igual ao `roadmap.md`.

## Por que a arquitetura atual torna isso barato

Duas decisões já tomadas (e documentadas no `CLAUDE.md`) deixam a migração
simples, sem precisar trocar DNS no meio do processo:

- **Cloudflare Tunnel (`cloudflared`)**: a VPS não tem IP público exposto no
  DNS — o `cloudflared` abre uma conexão de saída pro Cloudflare usando um
  token (`CLOUDFLARE_TUNNEL_TOKEN`). O Cloudflare roteia pra **onde quer que
  esse token esteja rodando**, não pra um IP fixo. Então o corte final não é
  "mudar DNS e esperar propagar" — é "derrubar o `cloudflared` velho e subir
  o novo", praticamente instantâneo.
- **Tudo em Docker Compose**, um arquivo só (`docker-compose.prod.yml`), 11
  serviços, 6 volumes nomeados. Reproduzir o ambiente é `docker compose up`
  com o mesmo `.env.production`.

**Risco real do corte**: os dois `cloudflared` (antigo e novo) **nunca podem
estar rodando ao mesmo tempo** apontando pra bancos diferentes — o Cloudflare
distribuiria requisição entre os dois, e pedido feito num banco não existiria
no outro. A ordem do corte (abaixo) existe por causa disso.

## O que precisa migrar

| O quê | Como | Observação |
|---|---|---|
| Banco Postgres (`pgdata`) | `pg_dump` → `psql` na nova | Já tem backup diário rodando (`backup/backup.sh`), mas sem destino externo (`RCLONE_REMOTE` vazio) — os dumps vivem só na própria VPS que estamos trocando. Fazer um dump **fresco** na hora do corte, não confiar no backup de ontem. |
| Fotos de produto (`uploads_data`) | `rsync`/`tar`+`scp` | ~790 MB hoje (ver tamanho do backup mais recente). |
| Índice de busca (`meili_data`) | **Reindexar**, não copiar | Mais simples e robusto que mover dado binário do Meilisearch: `POST /products/admin/reindex-search` depois que o banco novo estiver no ar. |
| `.env.production` | `scp` direto, nunca pelo git | 77 variáveis (ver `.env.production.example`). Inclui `CLOUDFLARE_TUNNEL_TOKEN`, `CLOUDFLARE_API_TOKEN`, `ANTENOR_API_KEY`, `RESEND_API_KEY`, senha do Postgres (crua e urlencoded), `ADMIN_PASSWORD`. |
| Certificado da AntenorApi (`ANTENOR_API_CA_PATH`) | `scp` | Confirmar onde o arquivo vive hoje na VPS (fora do `.env`, é um arquivo `.pem`/`.crt`). |
| Chave SSH de acesso | Cadastrar a chave desta máquina (ou gerar uma nova) no painel Hostinger da VPS nova | Mesma lógica do `claude-code@antenor` já cadastrado na atual (17/08/2026). |
| `docker-compose.prod.yml`, código | `git clone` na VPS nova | Já está no GitHub, não precisa copiar manualmente. |

**O que NÃO precisa migrar:** `caddy_data`/`caddy_config` (certificado TLS —
o Caddy gera um novo sozinho; como o Cloudflare já termina TLS na borda, não
é nem crítico). `backup_data` antigo pode ficar pra trás ou vir como
histórico, não é operacional.

## Passo a passo proposto

### 1. Preparar a VPS nova (sem afetar a produção)
- Acesso SSH (preciso do IP e de como logar — ver pergunta no fim).
- Instalar Docker + Docker Compose.
- Cadastrar a chave SSH desta máquina no painel Hostinger da nova.
- `git clone` do repositório.
- `scp` do `.env.production` e do certificado da AntenorApi da VPS atual pra
  nova (nunca pelo git — regra de zero segredos no repo vale igual aqui).

### 2. Primeira carga de dados (pode rodar com a produção no ar, sem pressa)
- Dump do Postgres na atual, restaurar na nova.
- Copiar `uploads_data` (rsync, repetível — não perde nada rodar de novo).
- Subir o stack inteiro na nova **sem o `cloudflared`** (ou com ele desligado
  no compose), testando por IP/porta direto ou por um hostname temporário.
- Rodar `node scripts/check-env.js` e `check-schema-drift.js` na nova pra
  confirmar que nada ficou faltando.
- Conferir os crons (sync do ERP, fila de notificações, backup) escritos
  certo no `.env.production` da nova.

### 3. Corte (janela curta, de preferência fora do horário de pico)
1. Aviso de manutenção curto, se o Jonathan quiser (não é estritamente
   necessário dado o tamanho da janela).
2. Dump **final** do Postgres na VPS atual (pedidos mais recentes).
3. Restaurar esse dump final na VPS nova (por cima do dump de teste do passo
   2 anterior — ou `--clean` antes).
4. `rsync` final do `uploads_data` (só a diferença desde a cópia de teste).
5. **Derrubar o `cloudflared` da VPS atual.**
6. **Subir o `cloudflared` da VPS nova** (mesmo `CLOUDFLARE_TUNNEL_TOKEN` do
   `.env.production` copiado — ou gerar um token novo pro túnel, se preferir
   trocar também; nesse caso precisa reapontar as 5 rotas no painel
   Cloudflare Zero Trust antes do corte, não depois).
7. Reindexar a busca (`POST /products/admin/reindex-search`).
8. Testar os 5 subdomínios (mercado/admin/api/separacao/entrega) na nova.
9. Conferir um pedido de teste ponta a ponta (ver regra de dados oficiais —
   limpar depois, sem deixar sujeira).

### 4. Pós-corte
- Acompanhar logs da nova por um tempo (sync do ERP rodando, cron de
  notificação, Mostruário).
- Manter a VPS antiga **parada, não apagada**, por alguns dias como
  contingência (rollback = religar o `cloudflared` de lá).
- Atualizar `~/.ssh/config` (`Host antenor-vps`) pra apontar pro IP novo.
- Atualizar este documento com a data real do corte e qualquer imprevisto.

## Em aberto — preciso de você antes de começar

1. **Acesso à VPS nova**: IP e como logar (usuário/senha ou já tem uma chave
   SSH cadastrada)?
2. **Horário do corte**: tem preferência de dia/hora de menor movimento, ou
   decido com base no horário de funcionamento da loja?
3. **Token do túnel**: reaproveita o mesmo `CLOUDFLARE_TUNNEL_TOKEN` (corte
   mais simples, só troca onde ele roda) ou prefere um túnel novo do zero?
