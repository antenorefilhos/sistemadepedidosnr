# Manual de Inicialização — Antenor & Filhos

Revisado em: 2 de maio de 2026 · Stack: Docker Compose · 6 containers

---

## Pré-requisito: Docker Desktop

O Docker Desktop **precisa estar rodando** antes de qualquer comando.

- Abra o Docker Desktop pela barra de tarefas ou inicie via:

```powershell
Start-Process "C:\Program Files\Docker\Docker\Docker Desktop.exe"
```

- Aguarde o ícone ficar estável (não animado). Confirme que está pronto:

```powershell
docker info
```

> Se retornar erro 500 ou "cannot connect", o engine ainda está inicializando. Aguarde mais 20–30s e tente novamente.

---

## Passo 1 — Subir toda a stack

```powershell
cd "F:\VC.VERSE\PROJETOS\antenor e filhos\pedidos nr\sistema"
docker compose up -d
```

Aguarde ~10s para a API e o banco inicializarem. Confirme:

```powershell
docker ps --format "table {{.Names}}`t{{.Status}}`t{{.Ports}}"
```

Todos os 6 containers devem aparecer como `Up`:

| Container | Porta |
|---|---|
| `antenor_storefront` | 3000 |
| `antenor_admin` | 3002 |
| `antenor_api` | 3001 |
| `antenor_db` | 5432 |
| `antenor_meili` | 7700 |
| `antenor_redis` | 6379 (interno) |

---

## Passo 2 — Verificar saúde da API

```powershell
Invoke-RestMethod http://localhost:3001/health | ConvertTo-Json
```

Resposta esperada:
```json
{ "status": "ok", "timestamp": "..." }
```

Para ver DB / Redis / MeiliSearch individualmente (requer login de admin):

```powershell
Invoke-RestMethod http://localhost:3001/health/detail | ConvertTo-Json -Depth 3
```

---

## Passo 3 — Acessar os serviços

| Serviço | URL | Credencial |
|---|---|---|
| **Loja (storefront)** | http://localhost:3000 | — |
| **Painel admin** | http://localhost:3002 | `admin@antenor.com.br` / `admin2026` |
| **API REST** | http://localhost:3001 | JWT (via login) |
| **Swagger UI** | http://localhost:3001/api | — |
| **PostgreSQL** | `localhost:5432` | user: `postgres` / pass: `antenor_password_2026` / db: `antenor_db` |
| **MeiliSearch** | http://localhost:7700 | — |

---

## Parar tudo

```powershell
cd "F:\VC.VERSE\PROJETOS\antenor e filhos\pedidos nr\sistema"
docker compose down
```

---

## Rebuild após editar código

### Backend (NestJS)

```powershell
cd "F:\VC.VERSE\PROJETOS\antenor e filhos\pedidos nr\sistema\backend"
npm run build

cd "F:\VC.VERSE\PROJETOS\antenor e filhos\pedidos nr\sistema"
docker compose build api --no-cache
docker compose up -d --force-recreate api
```

### Storefront (React)

```powershell
cd "F:\VC.VERSE\PROJETOS\antenor e filhos\pedidos nr\sistema\frontend"
npm run build

cd "F:\VC.VERSE\PROJETOS\antenor e filhos\pedidos nr\sistema"
docker compose build storefront --no-cache
docker compose up -d --force-recreate storefront
```

### Admin (React)

```powershell
cd "F:\VC.VERSE\PROJETOS\antenor e filhos\pedidos nr\sistema\admin"
npm run build

cd "F:\VC.VERSE\PROJETOS\antenor e filhos\pedidos nr\sistema"
docker compose build admin --no-cache
docker compose up -d --force-recreate admin
```

---

## Logs em tempo real

```powershell
# Todos os serviços
docker compose logs -f

# Só a API (mais útil para debug)
docker compose logs -f api

# Só o banco
docker compose logs -f db
```

---

## Rodar testes

```powershell
# Unit tests backend (125 testes)
cd "F:\VC.VERSE\PROJETOS\antenor e filhos\pedidos nr\sistema\backend"
npm test

# Guardrail de contrato da fila de pendências (M-CAT)
npm run test:pending-contract

# Unit tests frontend (60 testes)
cd "F:\VC.VERSE\PROJETOS\antenor e filhos\pedidos nr\sistema\frontend"
npx vitest run
```

Comando central (a partir de `sistema/`):

```powershell
cd "F:\VC.VERSE\PROJETOS\antenor e filhos\pedidos nr\sistema"
npm run validate:pending-contract
```

---

## Aplicar migration do Prisma

```powershell
cd "F:\VC.VERSE\PROJETOS\antenor e filhos\pedidos nr\sistema"
docker compose run --rm api npx prisma migrate deploy
```

---

## Troubleshooting

**Docker retorna erro 500 ao tentar `docker ps`**
→ Engine ainda inicializando. Aguarde 20–30s e tente novamente.

**Admin ou Storefront retorna 502 Bad Gateway**
→ A API ainda está subindo. Espere 5–10s e recarregue.

**API não responde em `localhost:3001`**
→ `docker compose logs -f api` — procure erro de boot ou falha de conexão com o banco.

**PostgreSQL não conecta**
→ `docker compose logs -f db` — verifique se a inicialização terminou.

**Limpar tudo e recomeçar do zero (destrói os volumes)**
```powershell
docker compose down -v
docker compose up -d
```

---

## Go-live (pacote operacional)

Executar preflight com snapshot do staging:

```powershell
cd "F:\VC.VERSE\PROJETOS\antenor e filhos\pedidos nr\sistema"
.\go-live-ops.ps1 preflight
```

Relatório gerado em:

```text
artifacts/release/go-live-preflight-<timestamp>.json
```

Comandos rápidos de monitoramento:

```powershell
.\go-live-ops.ps1 monitor
docker compose -f docker-compose.staging.yml logs -f api_staging
Invoke-RestMethod http://localhost:4001/health | ConvertTo-Json
Invoke-RestMethod http://localhost:4001/api/categories/stats/mapping | ConvertTo-Json
```

Comandos rápidos de rollback (staging/local):

```powershell
.\go-live-ops.ps1 rollback
```

### Janela de monitoramento (24h)

Executar checkpoints em T+0h, T+1h, T+4h, T+8h e T+24h:

```powershell
cd "F:\VC.VERSE\PROJETOS\antenor e filhos\pedidos nr\sistema"
.\go-live-ops.ps1 preflight
```

Em cada checkpoint, validar:

```powershell
Invoke-RestMethod http://localhost:4001/health | ConvertTo-Json
Invoke-RestMethod http://localhost:4001/api/categories/stats/mapping | ConvertTo-Json
docker compose -f docker-compose.staging.yml ps
```

Critério de alerta:

- `health` diferente de `ok`
- `pending` subir acima de 0 sem ação planejada
- aumento inesperado de `unmapped` sem mudança de política
- falha de container (`Exited`/`Restarting`)

---

## Rate limiting (segurança)

Os endpoints de autenticação têm limite por IP:

| Endpoint | Limite |
|---|---|
| `POST /auth/login` | 10 req/min |
| `POST /auth/customer/login` | 10 req/min |
| `POST /auth/customer/register` | 5 req/min |
| Demais endpoints | 120 req/min |

Após exceder: resposta `429 Too Many Requests`. Aguarde 1 minuto para liberar.

