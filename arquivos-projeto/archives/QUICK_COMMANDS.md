# QUICK_COMMANDS.md - Comandos Rapidos

Data: 23 de abril de 2026
Versao de referencia: 1.6.0-alpha

## Regra operacional

- Execute comandos de Docker Compose a partir de `sistema/`.
- Em PowerShell, use `curl.exe` para evitar conflito com `Invoke-WebRequest`.

## Subir ambiente completo

```powershell
Set-Location "F:/VC.VERSE/PROJETOS/antenor e filhos/pedidos nr/sistema"
docker compose up -d db redis meili api storefront admin
docker compose ps
```

## Reiniciar somente API

```powershell
Set-Location "F:/VC.VERSE/PROJETOS/antenor e filhos/pedidos nr/sistema"
docker compose build api
docker compose up -d --force-recreate api
docker compose logs --tail=80 api
```

## Validacoes rapidas

```powershell
Set-Location "F:/VC.VERSE/PROJETOS/antenor e filhos/pedidos nr/sistema"
curl.exe -s -o NUL -w "health %{http_code} %{content_type}`n" "http://localhost:3001/health"
curl.exe -s -o NUL -w "storefront %{http_code} %{content_type}`n" "http://localhost:3000/"
curl.exe -s -o NUL -w "admin %{http_code} %{content_type}`n" "http://localhost:3002/"
```

## Testar imagens de produto

```powershell
Set-Location "F:/VC.VERSE/PROJETOS/antenor e filhos/pedidos nr/sistema"
curl.exe -s -o NUL -w "img100 %{http_code} %{content_type}`n" "http://localhost:3000/uploads/products/100.webp"
curl.exe -s -o NUL -w "img404-fallback %{http_code} %{content_type}`n" "http://localhost:3000/uploads/products/nao-existe.webp"
```

## Testar checkout convidado

```powershell
Set-Location "F:/VC.VERSE/PROJETOS/antenor e filhos/pedidos nr/sistema"
$body = @{ name = "Convidado Teste"; whatsapp = "11999990000" } | ConvertTo-Json
Invoke-RestMethod -Uri "http://localhost:3001/auth/customer/guest-checkout" -Method Post -ContentType "application/json" -Body $body
```

## Importacao em lote de imagens

```powershell
Set-Location "F:/VC.VERSE/PROJETOS/antenor e filhos/pedidos nr/sistema"
docker compose run --rm \
  -v "F:/VC.VERSE/PROJETOS/antenor e filhos/PRODUTOS/DA CASA:/imports/da-casa:ro" \
  -v "F:/VC.VERSE/PROJETOS/antenor e filhos/PRODUTOS/SUBIDOS:/imports/subidos:ro" \
  api node /app/scripts/import-images.js "/imports/da-casa" "/imports/subidos" --min-score=0.64
```

## Sync de produtos via Solidcom

```powershell
Set-Location "F:/VC.VERSE/PROJETOS/antenor e filhos/pedidos nr/sistema"
docker compose run --rm api node /app/scripts/do-sync.js
```

## Prisma

```powershell
Set-Location "F:/VC.VERSE/PROJETOS/antenor e filhos/pedidos nr/sistema/backend"
npx prisma migrate deploy
npx prisma generate
npx prisma migrate dev --name add_priority_limit_to_categories
```

## Vitrines da Home via CMS

Listar configuracao atual de categorias:

```powershell
curl.exe -s "http://localhost:3001/cms/categories"
```

Atualizar ordem e quantidade de uma secao (requer token admin):

```powershell
$token = "SEU_TOKEN_ADMIN"
$body = @{ priority = 1; limit = 8; active = $true } | ConvertTo-Json
Invoke-RestMethod -Uri "http://localhost:3001/cms/categories/ID_DA_CATEGORIA" -Method Patch -Headers @{ Authorization = "Bearer $token" } -ContentType "application/json" -Body $body
```

## Build local sem Docker

```powershell
npm --prefix sistema/backend run build
npm --prefix sistema/frontend run build
npm --prefix sistema/admin run build
```

## Enderecos

- Loja: http://localhost:3000
- Admin: http://localhost:3002
- API: http://localhost:3001
- Swagger: http://localhost:3001/api
- Meili: http://localhost:7700
