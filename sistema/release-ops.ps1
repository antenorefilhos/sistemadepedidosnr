param(
  [Parameter(Position = 0)]
  [ValidateSet('preflight', 'smoke', 'backup', 'restore-test')]
  [string]$Command = 'preflight',

  [string]$DumpPath = '',
  [string]$ApiUrl = 'http://localhost:3001',
  [string]$StorefrontUrl = 'http://localhost:3000',
  [string]$AdminUrl = 'http://localhost:3002',
  [string]$AdminEmail = 'admin@antenor.com.br',
  [string]$AdminPassword = 'admin2026'
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Resolve-Path (Join-Path $root '..')
$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$artifactRoot = Join-Path $projectRoot 'artifacts'
$backupDir = Join-Path $artifactRoot 'backups'
$releaseDir = Join-Path $artifactRoot 'release'

function Ensure-Dir([string]$Path) {
  if (-not (Test-Path $Path)) {
    New-Item -ItemType Directory -Path $Path | Out-Null
  }
}

function Write-Step([string]$Message) {
  Write-Host "`n==> $Message" -ForegroundColor Cyan
}

function Invoke-JsonGet([string]$Url) {
  try {
    return Invoke-RestMethod -Method Get -Uri $Url -TimeoutSec 20
  } catch {
    return [pscustomobject]@{ status = 'error'; error = $_.Exception.Message }
  }
}

function Test-WebOk([string]$Url) {
  try {
    $response = Invoke-WebRequest -Method Get -Uri $Url -UseBasicParsing -TimeoutSec 20
    return [pscustomobject]@{ ok = $true; statusCode = [int]$response.StatusCode }
  } catch {
    $statusCode = if ($_.Exception.Response) { [int]$_.Exception.Response.StatusCode } else { 0 }
    return [pscustomobject]@{ ok = $false; statusCode = $statusCode; error = $_.Exception.Message }
  }
}

function Invoke-Smoke {
  Ensure-Dir $releaseDir

  Write-Step 'Validando superficies HTTP'
  $apiHealth = Invoke-JsonGet "$ApiUrl/health"
  $storefront = Test-WebOk $StorefrontUrl
  $admin = Test-WebOk $AdminUrl

  Write-Step 'Validando login admin e endpoints operacionais'
  $login = Invoke-RestMethod -Method Post -Uri "$ApiUrl/auth/login" -ContentType 'application/json' -Body (@{
    email = $AdminEmail
    password = $AdminPassword
  } | ConvertTo-Json)

  $headers = @{ Authorization = "Bearer $($login.access_token)" }
  $products = Invoke-RestMethod -Method Get -Uri "$ApiUrl/products/admin?page=1&limit=3" -Headers $headers
  $orders = Invoke-RestMethod -Method Get -Uri "$ApiUrl/admin/orders?limit=3" -Headers $headers
  $integrations = Invoke-RestMethod -Method Get -Uri "$ApiUrl/integrations/solidcom/status" -Headers $headers

  $report = [pscustomobject]@{
    generatedAt = (Get-Date).ToString('o')
    apiUrl = $ApiUrl
    storefrontUrl = $StorefrontUrl
    adminUrl = $AdminUrl
    apiHealth = $apiHealth
    storefront = $storefront
    admin = $admin
    authenticated = [bool]$login.access_token
    productsReturned = @($products.data).Count
    ordersReturned = @($orders.items).Count
    solidcomEnabled = [bool]$integrations.enabled
  }

  $outPath = Join-Path $releaseDir "smoke-$timestamp.json"
  $report | ConvertTo-Json -Depth 8 | Set-Content -Path $outPath -Encoding UTF8
  Write-Host "Relatorio: $outPath" -ForegroundColor Green

  if ($apiHealth.status -ne 'ok' -or -not $storefront.ok -or -not $admin.ok -or -not $login.access_token) {
    throw 'Smoke test falhou. Consulte o relatorio gerado.'
  }
}

function Invoke-Backup {
  Ensure-Dir $backupDir
  $fileName = "antenor-db-$timestamp.dump"
  $containerPath = "/tmp/$fileName"
  $hostPath = Join-Path $backupDir $fileName

  Write-Step 'Gerando backup PostgreSQL em formato custom'
  docker exec antenor_db pg_dump -U postgres -d antenor_db -Fc -f $containerPath | Out-Host
  docker cp "antenor_db:$containerPath" $hostPath | Out-Host
  docker exec antenor_db rm -f $containerPath | Out-Host

  if (-not (Test-Path $hostPath)) {
    throw "Backup nao encontrado apos docker cp: $hostPath"
  }

  Write-Host "Backup: $hostPath" -ForegroundColor Green
}

function Invoke-RestoreTest {
  if (-not $DumpPath) {
    $latest = Get-ChildItem -Path $backupDir -Filter '*.dump' -ErrorAction SilentlyContinue |
      Sort-Object LastWriteTime -Descending |
      Select-Object -First 1
    if ($latest) {
      $DumpPath = $latest.FullName
    }
  }

  if (-not $DumpPath -or -not (Test-Path $DumpPath)) {
    throw 'Informe -DumpPath ou gere um backup antes de rodar restore-test.'
  }

  $container = "antenor_restore_test_$timestamp"
  try {
    Write-Step "Subindo PostgreSQL temporario para restore-test ($container)"
    docker run --rm --name $container -e POSTGRES_PASSWORD=restore_test -e POSTGRES_DB=restore_test -d postgres:15-alpine | Out-Host

    for ($i = 0; $i -lt 30; $i++) {
      $ready = docker exec $container pg_isready -U postgres -d restore_test 2>$null
      if ($LASTEXITCODE -eq 0) { break }
      Start-Sleep -Seconds 1
    }

    docker cp $DumpPath "${container}:/tmp/restore.dump" | Out-Host
    docker exec $container pg_restore -U postgres -d restore_test --clean --if-exists /tmp/restore.dump | Out-Host
    $tables = docker exec $container psql -U postgres -d restore_test -tAc "select count(*) from information_schema.tables where table_schema='public';"
    Write-Host "Tabelas restauradas no schema public: $tables" -ForegroundColor Green

    if ([int]$tables -le 0) {
      throw 'Restore-test nao encontrou tabelas no schema public.'
    }
  } finally {
    docker rm -f $container 2>$null | Out-Null
  }
}

switch ($Command) {
  'preflight' {
    Write-Step 'Validando compose local e staging'
    docker compose -f "$root/docker-compose.yml" config --quiet | Out-Host
    docker compose -f "$root/docker-compose.staging.yml" config --quiet | Out-Host
    Invoke-Smoke
  }
  'smoke' { Invoke-Smoke }
  'backup' { Invoke-Backup }
  'restore-test' { Invoke-RestoreTest }
}
