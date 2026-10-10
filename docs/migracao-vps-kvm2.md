# Migração para a VPS nova (Hostinger KVM 2)

Jonathan já comprou a VPS nova (10/10/2026). Este documento é o plano —
atualiza conforme a migração avança, igual ao `roadmap.md`.

## Status (10/10/2026)

**Passo 1 (preparar) e passo 2 (primeira carga) concluídos.** Falta só o
passo 3 (corte) — decisão do Jonathan sobre horário.

- **VPS nova**: ID Hostinger `2049592`, IP `179.199.155.81`, KVM 2 (2 vCPU/
  8 GB/100 GB), Ubuntu 26.04 LTS, data center 22 (mesmo da atual). Acessada
  via a API da Hostinger (plugin oficial instalado no Claude Code), sem
  precisar de senha — a chave `claude-code@antenor` foi cadastrada nela do
  mesmo jeito que já estava na atual. `Host antenor-vps-nova` no
  `~/.ssh/config`.
- **Token do túnel**: Jonathan confirmou reaproveitar o `CLOUDFLARE_TUNNEL_TOKEN`
  atual — corte mais simples, nenhuma rota pra reapontar no painel Cloudflare.
- **Otimizações aplicadas na VPS nova** (a atual não tinha nenhuma destas —
  vale considerar aplicar lá também antes ou durante o corte):
  - Swap de 4 GB (`swappiness=10`, só emergência) — a atual roda sem swap
    nenhum há 8 GB inteiros de RAM sem rede de segurança contra OOM.
  - `vm.overcommit_memory=1` (recomendação oficial do Redis), `somaxconn`
    e `inotify.max_user_watches` no mesmo nível da atual.
  - UFW ativo (22/80/443, igual à atual).
  - **Login root por senha estava habilitado na atual** (`PasswordAuthentication
    yes` efetivo, apesar de dois arquivos de drop-in do cloud-init se
    contradizendo — `50-cloud-init.conf` dizia `yes`, `60-cloudimg-settings.conf`
    dizia `no`, o primeiro vence). Na VPS nova, removido o drop-in conflitante
    e forçado `PasswordAuthentication no` / `PermitRootLogin prohibit-password`
    — só chave, nunca senha. Testado acesso por chave antes e depois de cada
    mudança.
  - fail2ban instalado e ativo pro SSH (5 tentativas, 1h de ban) — a atual
    não tem.
  - `unattended-upgrades` e NTP confirmados (já vinham ativos de fábrica).
  - Docker: `daemon.json` replicado (log rotation 10 MB×3, pools de rede),
    mesma versão de Compose.
- **Dados migrados e conferidos:**
  - Banco: `pg_dump`/`pg_restore` direto entre as duas VPS. Contagem de
    `products` (14.992) e `orders` (20) bate exato nas duas.
  - Fotos de produto (`uploads_data`): `rsync` **direto entre as duas VPS**
    (gerei uma chave temporária na nova e autorizei na antiga só pra isso,
    sem passar pelo meu link local) — 13.379 arquivos, 790 MB, tamanho
    idêntico nos dois lados.
  - Busca: reindexada do zero na nova (14.992 produtos no Meilisearch),
    como o plano já previa — nunca copiamos o volume do Meilisearch.
  - `check-env.js --prod`: 37 divergências, **idênticas às da VPS atual**
    (rodei o mesmo check nas duas pra confirmar) — são gaps pré-existentes
    (features não conectadas tipo NFE/Pagamentos/Hubspot, não é bug da
    migração), fora de escopo aqui.
  - `check-schema-drift.js`: schema e banco batem, só as 20 divergências
    benignas de sempre.
  - Os 5 subdomínios testados direto nos containers (bypassando o Caddy) e
    via Caddy por HTTP (porta 80, confirma que o roteamento por `Host`
    reconhece os 5 certo) — todos OK.
- **Dois achados corrigidos no caminho:**
  - O container `storefront`/`admin` não subia (nginx recusava por falta de
    `/etc/antenor-certs/cert.pem` — certificado self-signed interno, nunca
    trafega pela rede, gerado direto na VPS, nunca esteve no git). Gerei um
    novo igual na VPS nova.
  - **Parei a API logo depois do primeiro teste** porque os schedulers dela
    (sync do ERP, push de notificação) já ligam sozinhos ao subir — rodando
    nas duas VPS ao mesmo tempo, duplicaria notificação push pra cliente de
    verdade. Só volto a ligar a API perto do corte de fato.
  - **Parei o Caddy (`proxy`) depois de confirmar o roteamento** — ele tenta
    emitir certificado Let's Encrypt de verdade pros 5 domínios assim que
    sobe, e falha (porque o DNS/túnel ainda aponta pra VPS atual, como tem
    que ser até o corte). Tentativa falha repetida consome o **mesmo limite
    semanal do Let's Encrypt** que vale pro certificado real no dia do corte
    — por isso parei antes de insistir à toa.
- **Estado atual dos containers na VPS nova:** `db`, `redis`, `meili` rodando;
  `api`, `proxy`, `cloudflared` parados de propósito (só sobem no corte).
  `storefront`/`admin`/`picking`/`delivery`/`backup` rodando (não têm o
  mesmo risco de duplicar nada).

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

## Em aberto — só falta isto antes do corte

1. ~~Acesso à VPS nova~~ — resolvido via API da Hostinger.
2. ~~Token do túnel~~ — resolvido, reaproveita o atual.
3. **Horário do corte**: tem preferência de dia/hora de menor movimento, ou
   decido com base no horário de funcionamento da loja?
