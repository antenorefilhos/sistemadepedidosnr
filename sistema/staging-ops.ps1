# staging-ops.ps1
# Script de operacao do ambiente de staging.
# Uso: .\staging-ops.ps1 [up|down|reset|seed|smoke|status]

param (
  [Parameter(Position = 0)]
  [string]$Command = "status"
)

$EnvFileArg = if (Test-Path ".env.staging") { "--env-file .env.staging" } else { "" }
$Compose = "docker compose $EnvFileArg -f docker-compose.staging.yml".Replace("  ", " ")

function Write-Step($msg) { Write-Host "`n==> $msg" -ForegroundColor Cyan }

switch ($Command) {

  "up" {
    Write-Step "Subindo stack de staging..."
    Invoke-Expression "$Compose up -d --build"
    Write-Step "Aguardando API inicializar (30s)..."
    Start-Sleep -Seconds 30
    Write-Step "Rodando migrations..."
    Invoke-Expression "$Compose exec api_staging npx prisma migrate deploy"
    Write-Step "Stack staging iniciada."
    Write-Host "  loja:  http://localhost:4000" -ForegroundColor Green
    Write-Host "  api:   http://localhost:4001" -ForegroundColor Green
    Write-Host "  admin: http://localhost:4002" -ForegroundColor Green
  }

  "down" {
    Write-Step "Derrubando stack de staging (dados preservados)..."
    Invoke-Expression "$Compose down"
  }

  "reset" {
    Write-Step "Reset completo — remove containers e volumes de staging..."
    $confirm = Read-Host "Confirma reset com perda de dados staging? (s/N)"
    if ($confirm -ne 's') { Write-Host "Cancelado."; exit 0 }
    Invoke-Expression "$Compose down -v"
    Write-Host "Reset concluido. Rode '.\staging-ops.ps1 up' para recriar."
  }

  "seed" {
    Write-Step "Aplicando seed completo no staging..."
    $env:DATABASE_URL = "postgresql://postgres:antenor_staging_2026@localhost:5433/antenor_staging?schema=public"
    Push-Location backend
    try {
      npm run prisma:seed
      npm run seed:qa
      Write-Host "Seed staging aplicado: admin@antenor.com.br / admin2026" -ForegroundColor Green
      Write-Host "QA admin adicional: qa.admin@antenor.com.br / admin2026" -ForegroundColor Green
    } finally {
      Pop-Location
      Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue
    }
  }

  "smoke" {
    Write-Step "Executando smoke no staging (http://localhost:4000)..."
    Set-Location frontend
    $env:CYPRESS_BASE_URL = "http://localhost:4000"
    $env:CYPRESS_API_URL  = "http://localhost:4001"
    npx cypress run --spec "cypress/e2e/smoke.cy.ts" --config baseUrl=http://localhost:4000
    Set-Location ..
  }

  "status" {
    Write-Step "Status dos containers de staging:"
    Invoke-Expression "$Compose ps"
    Write-Step "Health checks:"
    try { $h = Invoke-RestMethod -Uri 'http://localhost:4001/health' -ErrorAction Stop; Write-Host "  api health: $($h.status)" -ForegroundColor Green } catch { Write-Host "  api: offline" -ForegroundColor Red }
    try { Invoke-WebRequest -Uri 'http://localhost:4000' -UseBasicParsing -ErrorAction Stop | Out-Null; Write-Host "  storefront: online" -ForegroundColor Green } catch { Write-Host "  storefront: offline" -ForegroundColor Red }
    try { Invoke-WebRequest -Uri 'http://localhost:4002' -UseBasicParsing -ErrorAction Stop | Out-Null; Write-Host "  admin: online" -ForegroundColor Green } catch { Write-Host "  admin: offline" -ForegroundColor Red }
  }

  default {
    Write-Host "Uso: .\staging-ops.ps1 [up|down|reset|seed|smoke|status]"
  }
}
