# Deploy de produção

Runbook completo: da conta nova na Hostinger até o sistema no ar em
`https://mercado.antenorefilhos.com.br` com certificado válido. Segue o plano
em `docs/roadmap.md` (Semana 3).

## 1. Contratar o servidor (Jonathan)

Hostinger, plano **VPS KVM 2** (2 vCPU / 8 GB RAM / 100 GB NVMe). Contrate o
período mais curto disponível — o preço de renovação sobe bastante depois do
contrato promocional, melhor reavaliar cedo do que travar 2 anos.

Sistema operacional: **Ubuntu 24.04 LTS**. Anote o IP público do servidor.

## 2. Apontar o DNS (Jonathan)

`antenorefilhos.com.br` já existe e é usado pela outra loja no domínio raiz —
não mexer nele. No painel de DNS, criar 5 registros `A`, todos apontando pro
IP do VPS novo:

| tipo | nome | valor |
|---|---|---|
| A | `mercado` | `<IP do VPS>` |
| A | `admin` | `<IP do VPS>` |
| A | `api` | `<IP do VPS>` |
| A | `separacao` | `<IP do VPS>` |
| A | `entrega` | `<IP do VPS>` |

Propagação leva de minutos a algumas horas. Confirme antes de seguir:
```bash
dig +short mercado.antenorefilhos.com.br
```
Deve devolver o IP do VPS.

## 3. Preparar o servidor

Acesso via SSH (`ssh root@<IP do VPS>`), depois:

```bash
apt update && apt upgrade -y
curl -fsSL https://get.docker.com | sh
apt install -y git ufw

# Firewall: so SSH, HTTP e HTTPS. Tudo mais (Postgres, Redis, Meili) nunca
# teve porta publicada no compose de producao -- isto e defesa em profundidade.
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
```

## 4. Clonar o repositório e configurar

```bash
git clone <url-do-repositorio> /opt/antenor
cd /opt/antenor/sistema

cp .env.production.example .env.production
```

Editar `.env.production` e preencher:
- `POSTGRES_PASSWORD`, `JWT_SECRET` (mín. 32 chars), `MEILI_MASTER_KEY` — gerar
  com `openssl rand -base64 32` cada um, nunca reaproveitar os defaults locais.
- `SOLIDCOM_API_URL`, `SOLIDCOM_CNPJ`, `SOLIDCOM_CODECOM` — credenciais reais
  do ERP (ver `docs/solidcom-api.md`).
- `VITE_MAPBOX_ACCESS_TOKEN` — necessário pro GPS de precisão funcionar
  (posição do cliente decidindo a zona por polígono).
- `ADMIN_PASSWORD` — senha do usuário master, criada no seed.

Os campos de domínio (`CORS_ORIGIN`, `FRONTEND_URL`, `ADMIN_URL`,
`VITE_API_URL`, `WEB_PUSH_ORIGIN`) já vêm certos no `.example`.

## 5. Configurar backup remoto (opcional, mas recomendado)

Sem isto, o backup fica só no próprio servidor — não protege contra o
servidor cair ou ser perdido, só contra erro humano (apagar produto, etc).

```bash
cp backup/rclone.conf.example backup/rclone.conf
# editar backup/rclone.conf com as credenciais do object storage
# (Backblaze B2 ou similar; ver comentários no arquivo)
```

E em `.env.production`:
```
BACKUP_RCLONE_REMOTE=antenor-backup:antenor-backups
```

## 6. Subir a stack

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production build
docker compose -f docker-compose.prod.yml --env-file .env.production up -d
```

Primeira subida do Caddy demora alguns segundos a mais: ele está obtendo os
5 certificados Let's Encrypt. Acompanhar:
```bash
docker compose -f docker-compose.prod.yml logs -f proxy
```

## 7. Migrar o banco e semear o admin

```bash
docker compose -f docker-compose.prod.yml exec api npx prisma migrate deploy
docker compose -f docker-compose.prod.yml exec api npx prisma db seed
```

`ADMIN_PASSWORD` no `.env.production` é a senha usada no seed — guardar em
lugar seguro, não fica em texto claro em lugar nenhum além dali.

## 8. Verificar

- `curl -I https://mercado.antenorefilhos.com.br` → `200`, certificado válido
  (não autoassinado — confirme no navegador, cadeado sem aviso).
- Repetir para `admin.`, `api.`, `separacao.`, `entrega.`.
- `curl https://api.antenorefilhos.com.br/api` → Swagger responde.
- De outro computador (fora da rede do servidor):
  ```bash
  nc -zv <IP do VPS> 5432   # deve FALHAR (connection refused/timeout)
  nc -zv <IP do VPS> 7700   # deve FALHAR
  ```
  Se qualquer um desses conectar, pare e revise — significa que o Postgres
  ou o Meili estão expostos na internet.
- Testar o GPS de verdade num celular contra `https://mercado.antenorefilhos.com.br/`
  — é o teste que era impossível em `localhost` (GPS exige HTTPS).
- Confirmar que o backup rodou:
  ```bash
  docker compose -f docker-compose.prod.yml logs backup
  docker compose -f docker-compose.prod.yml exec backup ls -la /backup/daily
  ```

## 9. Testar restauração (fazer isto pelo menos uma vez)

Backup que nunca foi restaurado é uma esperança, não uma garantia.

```bash
docker compose -f docker-compose.prod.yml exec backup \
  sh -c 'gunzip -c /backup/daily/db_*.sql.gz | head -50'
```

Confirma que o dump tem `CREATE TABLE` e dados reais, não está vazio ou
corrompido. Restaurar de fato num banco separado antes de confiar de vez.

## Rotina depois do ar

- **Deploy de código novo**: `git pull`, rebuild só do serviço que mudou
  (`docker compose -f docker-compose.prod.yml build api && docker compose -f docker-compose.prod.yml up -d api`),
  rodar `prisma migrate deploy` se teve migration nova.
- **Ver logs**: `docker compose -f docker-compose.prod.yml logs -f <serviço>`.
- **Renovação de certificado**: automática, Caddy cuida sozinho. Só investigar
  se o cadeado sumir — geralmente é DNS que mudou ou porta 80 bloqueada.
