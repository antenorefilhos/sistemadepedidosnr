# QUICKSTART - Projeto Antenor & Filhos

Data: 23 de abril de 2026
Versao de referencia: 1.6.0-alpha

## Subir tudo em 5 minutos (Docker)

```powershell
Set-Location "F:/VC.VERSE/PROJETOS/antenor e filhos/pedidos nr/sistema"
docker compose up -d db redis meili api storefront admin
docker compose ps
```

## URLs

- Loja: http://localhost:3000
- Admin: http://localhost:3002
- API: http://localhost:3001
- Swagger: http://localhost:3001/api
- Meili: http://localhost:7700

## Sanidade rapida

```powershell
curl.exe -s -o NUL -w "health %{http_code} %{content_type}`n" "http://localhost:3001/health"
curl.exe -s -o NUL -w "storefront %{http_code} %{content_type}`n" "http://localhost:3000/"
curl.exe -s -o NUL -w "admin %{http_code} %{content_type}`n" "http://localhost:3002/"
curl.exe -s -o NUL -w "cms-categories %{http_code} %{content_type}`n" "http://localhost:3001/cms/categories"
curl.exe -s -o NUL -w "uploads-missing %{http_code} %{content_type}`n" "http://localhost:3000/uploads/products/nao-existe.webp"
```

## Ajuste comercial rapido de vitrines

- use `/cms/categories` para controlar `active`, `priority` e `limit`
- apos alterar no admin/API, recarregue a Home para conferir nova ordem e composicao

## Teste rapido de checkout convidado

```powershell
Set-Location "F:/VC.VERSE/PROJETOS/antenor e filhos/pedidos nr/sistema"
$body = @{ name = "Convidado Teste"; whatsapp = "11999990000" } | ConvertTo-Json
Invoke-RestMethod -Uri "http://localhost:3001/auth/customer/guest-checkout" -Method Post -ContentType "application/json" -Body $body
```

## Sync de produtos (Solidcom)

```powershell
Set-Location "F:/VC.VERSE/PROJETOS/antenor e filhos/pedidos nr/sistema"
docker compose run --rm api node /app/scripts/do-sync.js
```

## Cobertura de fotos em lote

```powershell
Set-Location "F:/VC.VERSE/PROJETOS/antenor e filhos/pedidos nr/sistema"
docker compose run --rm \
  -v "F:/VC.VERSE/PROJETOS/antenor e filhos/PRODUTOS/DA CASA:/imports/da-casa:ro" \
  -v "F:/VC.VERSE/PROJETOS/antenor e filhos/PRODUTOS/SUBIDOS:/imports/subidos:ro" \
  api node /app/scripts/import-images.js "/imports/da-casa" "/imports/subidos" --min-score=0.64
```

## Encerrar ambiente

```powershell
Set-Location "F:/VC.VERSE/PROJETOS/antenor e filhos/pedidos nr/sistema"
docker compose down
```
