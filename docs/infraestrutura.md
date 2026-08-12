# Infraestrutura de produção — referência completa

Este documento é o retrato do que está **realmente rodando** em produção hoje
(12/08/2026), para consulta rápida ou migração futura. `docs/deploy.md` é o
passo a passo de como subir do zero; este arquivo é "o que existe e onde".

**Nenhum valor de segredo real está neste arquivo** (regra do projeto — ver
CLAUDE.md, "Zero segredos no repo"). Onde um segredo é citado, é só o *nome*
da variável e *onde* ela mora — nunca o valor.

## 1. Servidor (VPS)

| Item | Valor |
|---|---|
| Provedor | Hostinger |
| Plano | VPS KVM 2 (2 vCPU / 8 GB RAM / 100 GB NVMe) |
| IP público | `179.198.122.67` |
| Sistema operacional | Ubuntu 26.04 LTS |
| Acesso | SSH `root@179.198.122.67` — senha guardada só localmente/gestor de senhas, nunca commitada |
| Firewall (ufw) | Só `22/tcp` (SSH), `80/tcp`, `443/tcp` liberados. Tudo mais bloqueado, inclusive do lado de dentro (Postgres/Redis/Meili nunca têm porta publicada no host) |
| Localização do repositório no servidor | `/opt/antenor` (clone de `https://github.com/antenorefilhos/sistemadepedidosnr.git`, branch `main`) |

**Reserva de recursos**: a stack do Antenor tem `mem_limit`/`cpus` fixados em
cada serviço no `docker-compose.prod.yml` (~4.5GB RAM, teto de ~2 vCPU) —
combinado, deliberado, porque a VPS também roda outros testes/ferramentas do
Jonathan. Ver comentário no topo do arquivo pra reajustar se precisar.

## 2. DNS — `antenorefilhos.com.br`

O domínio raiz é **compartilhado**: o sistema da outra loja (hospedado no
**Vercel**) usa o domínio raiz e o `www`. O sistema Antenor usa 5 subdomínios
próprios, todos apontando para o IP da VPS acima.

**Onde gerenciar**: painel de DNS da **Hostinger**
(`hpanel.hostinger.com` → Domínios → `antenorefilhos.com.br` → DNS/Nameservers).
O domínio está registrado no **Registro.br**, mas os nameservers do
Registro.br (`ns1.dns-parking.com` / `ns2.dns-parking.com`) delegam a zona
inteira pra Hostinger — é lá, não no Registro.br, que os registros de verdade
ficam.

### Registros do sistema Antenor (criados hoje)

| Tipo | Nome | Valor | TTL |
|---|---|---|---|
| A | `mercado` | `179.198.122.67` | 14400 |
| A | `admin` | `179.198.122.67` | 14400 |
| A | `api` | `179.198.122.67` | 14400 |
| A | `separacao` | `179.198.122.67` | 14400 |
| A | `entrega` | `179.198.122.67` | 14400 |

### Registros do Resend (e-mail transacional — recuperação de senha)

| Tipo | Nome | Valor | TTL | Prioridade |
|---|---|---|---|---|
| TXT | `resend._domainkey` | `p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQD0JMrdvD/h/69UZQeck0CU1HvkRwd3gV16r2tJ4JEnvfYdonEr4J2CL9AJ+Oq8/KdooYu3ChjLczZabG/Sl+GvnW3XH19AS6xyaj8O2NiiduTDrQWguf8uF9pKexPLqvbJY7OGGo58vPdrBDnRhmSoED0QIbLaBh70wQUBXL/7PwIDAQAB` | 3600 | — |
| MX | `send` | `feedback-smtp.sa-east-1.amazonses.com` | 3600 | 10 |
| TXT | `send` | `v=spf1 include:amazonses.com ~all` | 3600 | — |

Esses registros são em subdomínios próprios (`resend._domainkey.` e `send.`),
por isso não conflitam com o SPF/DKIM que já existiam pro e-mail real da
empresa (`hostingermail-*`). Domínio verificado no Resend com o nome
**raiz** `antenorefilhos.com.br` (não um subdomínio `mail.`) — o Resend usa
os registros acima só nos nomes específicos deles, o resto da zona continua
livre.

### Registros que já existiam (não mexer — são de outros sistemas)

- `A @` → `216.198.79.1` (Vercel, sistema da outra loja)
- `CNAME www` → `b9b6736591077641.vercel-dns-017.com` (idem)
- `MX @` (2 registros, prioridade 5 e 10) → `mx1.hostinger.com` / `mx2.hostinger.com` (e-mail real `@antenorefilhos.com.br`)
- `TXT @` → SPF do Hostinger Mail
- `CNAME hostingermail-a/b/c._domainkey`, `TXT hostingermail1._domainkey`, `CNAME autodiscover`, `CNAME autoconfig`, `TXT _dmarc`, `A ftp` → todos do e-mail/FTP Hostinger, não relacionados ao sistema

## 3. Stack Docker (produção)

Arquivo: `sistema/docker-compose.prod.yml`. Comando de subida:
```bash
cd /opt/antenor/sistema
docker compose -f docker-compose.prod.yml --env-file .env.production up -d
```

| Serviço | Container | Imagem | Porta publicada |
|---|---|---|---|
| Banco | `antenor_db` | postgres:15-alpine | nenhuma (só rede interna) |
| Cache | `antenor_redis` | redis:7-alpine | nenhuma |
| Busca | `antenor_meili` | getmeili/meilisearch:v1.11 | nenhuma |
| API | `antenor_api` | build local (`backend/Dockerfile`) | nenhuma (só o proxy fala com ela) |
| Loja | `antenor_storefront` | build local (`frontend/Dockerfile`) | nenhuma |
| Admin | `antenor_admin` | build local (`admin/Dockerfile`) | nenhuma |
| Separação | `antenor_picking` | build local (`picking-app/Dockerfile`) | nenhuma |
| Entrega | `antenor_delivery` | build local (`delivery-app/Dockerfile`) | nenhuma |
| Proxy/HTTPS | `antenor_proxy` | caddy:2-alpine | **80, 443** (única coisa exposta na internet) |
| Backup | `antenor_backup` | build local (`backup/Dockerfile`) | nenhuma |

Rede: todos na mesma rede Docker `antenor_network` (bridge). Volumes
nomeados: `pgdata`, `meili_data`, `uploads_data`, `caddy_data`,
`caddy_config`, `backup_data`.

### Caddy (reverse proxy + HTTPS automático)

Arquivo: `sistema/Caddyfile`. Um bloco por subdomínio, `reverse_proxy` pro
container/porta interna correspondente. Certificado Let's Encrypt/ZeroSSL
obtido e renovado automaticamente, sem certbot, sem cron.

**5 domínios HTTPS ativos hoje**:
- `https://mercado.antenorefilhos.com.br` → storefront
- `https://admin.antenorefilhos.com.br` → admin
- `https://api.antenorefilhos.com.br` → api (porta 3001 interna)
- `https://separacao.antenorefilhos.com.br` → picking-app
- `https://entrega.antenorefilhos.com.br` → delivery-app

## 4. Segredos — inventário (valores só em `/opt/antenor/sistema/.env.production` no servidor)

Nenhum destes está no repositório. Lista de quais existem e pra que servem,
sem os valores:

| Variável | Pra que serve |
|---|---|
| `POSTGRES_PASSWORD` | senha do Postgres, gerada aleatoriamente no deploy |
| `JWT_SECRET` | assinatura dos tokens de login (min 32 chars) |
| `MEILI_MASTER_KEY` | chave master do MeiliSearch |
| `ADMIN_PASSWORD` | senha inicial da conta `admin@antenorefilhos.com.br` (gerada no seed; trocável via `/redefinir-senha`) |
| `QA_CUSTOMER_PASSWORD` | senha das contas de teste do seed (picker/driver) |
| `SOLIDCOM_API_URL`, `SOLIDCOM_CNPJ`, `SOLIDCOM_CODECOM`, `SOLIDCOM_BALCAO_CPF` | credenciais reais do ERP Solidcom — ver `docs/solidcom-api.md` |
| `VITE_MAPBOX_ACCESS_TOKEN` | token do Mapbox (geocoding/GPS de precisão no checkout) |
| `RESEND_API_KEY` | envio de e-mail transacional (recuperação de senha do admin) — key com permissão **Full access** (precisa gerenciar domínio) |
| `RESEND_FROM_EMAIL` | remetente dos e-mails (hoje `Antenor & Filhos <onboarding@resend.dev>` — trocar pra `@antenorefilhos.com.br` depois que o domínio verificar no Resend) |

**Se precisar migrar de servidor**: copiar o `.env.production` inteiro do
servidor antigo pro novo via `scp`/SFTP direto (nunca via git, nunca colado
em chat) — é o único lugar onde todos esses valores existem juntos.

## 5. Banco de dados — dado inicial vs dado curado

Um banco novo (`prisma migrate deploy` + `prisma db seed`) nasce **vazio de
categorização** — o seed cria só um punhado de produtos e nenhum mapeamento
categoria→produto. A vitrine fica vazia até:

1. **Sync real do ERP** rodar (`POST /products/sync`, autenticado admin) —
   traz o catálogo completo (~15.800 produtos).
2. **Mapeamentos de categoria** existirem. Hoje (12/08/2026) foram
   **importados do banco de desenvolvimento local** via `pg_dump --data-only`
   das tabelas `categories_cms`, `category_classification_mappings`,
   `product_category_mappings`, `classification_rules` — são meses de
   curadoria manual feita ao longo do projeto, nunca capturados em migration.
   **Se migrar de banco de novo no futuro, repetir esse export/import** (ou,
   melhor, considerar transformar isso numa migration/seed formal pra não
   depender do banco de dev existir).
3. **Reindexar a busca** depois do sync: `POST /admin/search/reindex`
   (autenticado admin) — sem isso o MeiliSearch fica com índice desatualizado
   e `/products` pode devolver menos resultado que o banco tem.

## 6. Bugs reais achados e corrigidos durante este deploy

Nenhum deles tinha aparecido antes porque **nunca tinha rodado um deploy do
zero contra um banco/imagem realmente novos**. Todos já corrigidos e
commitados:

1. **Migration `add_admin_module_access` quebrava banco novo** — dependia da
   coluna `admins.role` que nunca foi criada por uma migration formal (só via
   `db push` em dev). Corrigido: `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`.
2. **`prisma db seed` quebrava em imagem de produção real** — dois problemas
   empilhados: (a) `npm prune --production` no Dockerfile removia
   `ts-node`/`typescript`, que o seed precisa em runtime; (b) mesmo com eles
   presentes, `ts-node arquivo.ts` como entrypoint direto do `node` quebra em
   Node 20.19+/22+ (`ERR_UNKNOWN_FILE_EXTENSION`) — o hook de `require` do
   ts-node não intercepta a resolução do próprio entrypoint. Corrigido:
   Dockerfile sem prune + comando de seed trocado pra
   `node -r ts-node/register -e "require('./prisma/seed.ts')"`.
3. **`docker-compose.prod.yml` não passava `ADMIN_PASSWORD`/`QA_CUSTOMER_PASSWORD`
   pro container da API** — o seed sempre ia falhar em produção mesmo com o
   `.env.production` preenchido certo.
4. **Health check do Solidcom com timeout curto demais** — 5s, mas o endpoint
   real (`GetProdutos`) leva ~9.7s a partir dessa VPS. Marcava "down" um ERP
   que respondia normal. Corrigido pra 15s (o sync de verdade já usa 15-30s
   pros mesmos endpoints).
5. **Handshake TLS externo falhando ("alert 80 internal_error") logo após o
   Caddy emitir os 5 certificados** — sumiu sozinho depois de um
   `docker restart antenor_proxy`; nunca reapareceu depois. Causa exata não
   identificada (suspeita: estado interno do Caddy travado durante emissão
   simultânea de 5 certificados), mas não é recorrente — não precisou de
   fix de código.

## 7. Recuperação de senha do admin (Resend)

Antes deste deploy **não existia nenhum mecanismo de recuperação** — a única
saída era resetar a senha direto no banco via SSH. Implementado hoje:

- `POST /auth/forgot-password` — sempre responde genérico (nunca revela se o
  e-mail existe), gera token aleatório, guarda só o **hash** (sha256) no
  banco com expiração de 1h, manda link por e-mail via Resend.
- `POST /auth/reset-password` — valida hash + expiração, troca a senha.
- Tela `/redefinir-senha` no admin (pedir link, e com `?token=` na URL,
  definir nova senha). Link "Esqueci minha senha" na tela de login.
- **Cobertura**: hoje só a conta master (`role=admin`) e qualquer staff têm
  esse fluxo — não depende de WhatsApp (o `WhatsAppService` existente só gera
  link `wa.me`, não envia nada sozinho; automatizar por WhatsApp de verdade
  exigiria contratar Twilio/Z-API, decisão adiada).
- Domínio `antenorefilhos.com.br` verificado no Resend (ver seção 2) —
  depois de verificado, trocar `RESEND_FROM_EMAIL` no `.env.production` pra
  um remetente `@antenorefilhos.com.br` em vez do sandbox `onboarding@resend.dev`.

## 8. Pendências conhecidas (não bloqueiam operação, mas valem registro)

- **Backup remoto não configurado** (`BACKUP_RCLONE_REMOTE` vazio). O backup
  diário roda e fica só no próprio servidor — protege contra erro humano
  (apagar produto sem querer), não contra o servidor cair ou ser perdido.
- **`OrdersService.remove()` não libera reserva de slot** ao deletar pedido —
  achado e corrigido em dev (commit `50902c7`), presente neste deploy.
- **Teste de restauração de backup** ainda não feito nesta VPS (runbook
  descreve o passo, ver `docs/deploy.md` seção 9) — fazer pelo menos uma vez.
- **GPS em celular real** ainda não testado contra o domínio HTTPS de
  produção (só era impossível em `localhost`; agora que HTTPS existe, vale
  testar).

## 9. Se precisar migrar para outro servidor/provedor

Checklist mínimo, na ordem:

1. Provisionar novo servidor, instalar Docker (ver `docs/deploy.md` passo 3).
2. Clonar o repositório (`git clone` do GitHub — sempre atualizado, é a fonte
   de verdade do código).
3. Copiar o `.env.production` do servidor antigo pro novo via scp/SFTP direto
   (nunca por git/chat).
4. Fazer backup do Postgres do servidor antigo
   (`pg_dump antenor_db > full.sql`, incluindo schema+dados) e restaurar no
   novo — isso já traz junto os mapeamentos de categoria e todo o catálogo,
   sem precisar repetir a importação da seção 5.
5. Copiar o volume `uploads_data` (fotos de produto) do servidor antigo.
6. Apontar os 5 registros DNS (seção 2) pro IP novo — o Caddy emite
   certificado novo sozinho assim que resolver.
7. Se o Resend ficar no mesmo domínio, os registros de e-mail (DKIM/SPF)
   **não mudam** — são DNS, não dependem do servidor.
8. Rodar `docker compose -f docker-compose.prod.yml --env-file .env.production up -d`.
9. Verificar: `curl -I https://mercado.antenorefilhos.com.br`, checar
   `/health/detail`, testar login admin, testar um pedido de ponta a ponta.
