# ===================================
# Startup completo para DEBUG
# SEMPRE rodar isso antes de navegar!
# ===================================

param(
  [switch]$Rebuild
)

$ErrorActionPreference = 'Stop'
Set-Location -Path $PSScriptRoot

Write-Host ""
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  INICIANDO STACK COMPLETA PARA DEBUG" -ForegroundColor Cyan
Write-Host "  NUNCA debugar com servicos parciais!" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host ""

# 1. BUILD se solicitado
if ($Rebuild) {
  Write-Host "[*] Building images (api, storefront, admin)..." -ForegroundColor Yellow
  docker compose build api storefront admin
  Write-Host "[OK] Build concluido" -ForegroundColor Green
  Write-Host ""
}

# 2. STARTUP completa
Write-Host "[*] Levantando stack completa (db, redis, meili, api, storefront, admin)..." -ForegroundColor Cyan
docker compose up -d db redis meili api storefront admin

# 3. ESPERAR inicialização
Write-Host ""
Write-Host "[*] Aguardando servicos iniciarem..." -ForegroundColor Yellow
Start-Sleep -Seconds 3

# 4. VERIFICAR status
Write-Host ""
Write-Host "[CHECK] Status dos servicos:" -ForegroundColor Cyan
Write-Host ""

$containers = @('db', 'redis', 'meili', 'api', 'storefront', 'admin')
$allHealthy = $true

foreach ($container in $containers) {
  $status = docker compose ps $container --format '{{.Status}}'
  
  if ($status -like "Up*") {
    Write-Host "  [OK] $container".PadRight(25) + "  $status" -ForegroundColor Green
  } else {
    Write-Host "  [FAIL] $container".PadRight(25) + "  $status" -ForegroundColor Red
    $allHealthy = $false
  }
}

Write-Host ""

# 5. VERIFICAR endpoints
Write-Host "[CHECK] Verificando endpoints:" -ForegroundColor Cyan
Write-Host ""

$endpoints = @(
  @{ name = "Storefront"; url = "http://localhost:3000" },
  @{ name = "Admin"; url = "http://localhost:3002" },
  @{ name = "API/Swagger"; url = "http://localhost:3001/api" }
)

foreach ($endpoint in $endpoints) {
  try {
    $response = curl.exe -s -o /dev/null -w "%{http_code}" $endpoint.url
    if ($response -eq "200" -or $response -eq "302" -or $response -eq "404") {
      Write-Host "  [OK] $($endpoint.name)".PadRight(25) + "  $response ($($endpoint.url))" -ForegroundColor Green
    } else {
      Write-Host "  [WAIT] $($endpoint.name)".PadRight(25) + "  $response (aguarde...)" -ForegroundColor Yellow
      $allHealthy = $false
    }
  } catch {
    Write-Host "  [FAIL] $($endpoint.name)".PadRight(25) + "  erro de conexao" -ForegroundColor Red
    $allHealthy = $false
  }
}

Write-Host ""
Write-Host "==========================================================" -ForegroundColor Cyan

if ($allHealthy) {
  Write-Host ""
  Write-Host "[SUCCESS] STACK PRONTA PARA DEBUG!" -ForegroundColor Green
  Write-Host ""
  Write-Host "Acesse:" -ForegroundColor Cyan
  Write-Host "  - Loja:    http://localhost:3000" -ForegroundColor Gray
  Write-Host "  - Admin:   http://localhost:3002" -ForegroundColor Gray
  Write-Host "  - API:     http://localhost:3001" -ForegroundColor Gray
  Write-Host "  - Swagger: http://localhost:3001/api" -ForegroundColor Gray
  Write-Host ""
} else {
  Write-Host ""
  Write-Host "[WARNING] Alguns servicos ainda estao iniciando..." -ForegroundColor Yellow
  Write-Host "          Aguarde 10 segundos e verifique: docker compose ps" -ForegroundColor Yellow
  Write-Host ""
  Write-Host "Ver logs:" -ForegroundColor Yellow
  Write-Host "  - docker compose logs -f api    (Logs da API)" -ForegroundColor Gray
  Write-Host "  - docker compose logs -f admin  (Logs do Admin)" -ForegroundColor Gray
  Write-Host "  - docker compose logs -f db     (Logs do BD)" -ForegroundColor Gray
  Write-Host ""
}

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host ""
