param (
  [Parameter(Position = 0)]
  [ValidateSet('preflight', 'monitor', 'rollback')]
  [string]$Command = 'preflight',

  [string]$CategoryTreeApiUrl = 'http://localhost:4001'
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$releaseDir = Join-Path $root '..\artifacts\release'
$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'

function Ensure-ReleaseDir {
  if (-not (Test-Path $releaseDir)) {
    New-Item -ItemType Directory -Path $releaseDir | Out-Null
  }
}

function Write-Step([string]$msg) {
  Write-Host "`n==> $msg" -ForegroundColor Cyan
}

function Invoke-HealthJson([string]$url) {
  try {
    return Invoke-RestMethod -Uri $url -Method Get -TimeoutSec 15
  }
  catch {
    return [pscustomobject]@{ status = 'error'; error = $_.Exception.Message }
  }
}

function Invoke-CategoryTreeValidation([string]$apiUrl, [string]$runId) {
  $evidenceDir = "artifacts/category-tree-validation/$runId"
  $previous = Get-Location

  try {
    Set-Location $root
    $output = & npm run validate:category-tree -- --api-url $apiUrl --evidence-dir $evidenceDir 2>&1
    $exitCode = $LASTEXITCODE

    return [pscustomobject]@{
      apiUrl = $apiUrl
      ok = ($exitCode -eq 0)
      exitCode = $exitCode
      evidenceDir = Join-Path $root $evidenceDir
      output = @($output | ForEach-Object { "$_" })
    }
  }
  catch {
    return [pscustomobject]@{
      apiUrl = $apiUrl
      ok = $false
      exitCode = 1
      evidenceDir = Join-Path $root $evidenceDir
      output = @($_.Exception.Message)
    }
  }
  finally {
    Set-Location $previous
  }
}

switch ($Command) {
  'preflight' {
    Ensure-ReleaseDir

    Write-Step 'Coletando status de containers staging'
    $containers = docker compose -f "$root/docker-compose.staging.yml" ps --format "{{.Name}}|{{.State}}|{{.Status}}|{{.Ports}}"

    Write-Step 'Coletando health e stats do staging'
    $health = Invoke-HealthJson 'http://localhost:4001/health'
    $stats = Invoke-HealthJson 'http://localhost:4001/api/categories/stats/mapping'

    Write-Step 'Validando arvore de categorias'
    $categoryTree = Invoke-CategoryTreeValidation $CategoryTreeApiUrl "go-live-preflight-$timestamp"

    $report = [pscustomobject]@{
      generatedAt = (Get-Date).ToString('o')
      environment = 'staging'
      endpoints = [pscustomobject]@{
        storefront = 'http://localhost:4000'
        api = 'http://localhost:4001'
        admin = 'http://localhost:4002'
      }
      health = $health
      mappingStats = $stats
      categoryTree = $categoryTree
      containers = $containers
      rollbackCommands = @(
        'docker compose -f sistema/docker-compose.staging.yml down',
        'docker compose down',
        'docker compose up -d --build'
      )
      monitorCommands = @(
        'docker compose -f sistema/docker-compose.staging.yml logs -f api_staging',
        'curl http://localhost:4001/health',
        'curl http://localhost:4001/api/categories/stats/mapping',
        'cd sistema && npm run validate:category-tree -- --api-url http://localhost:4001 --evidence-dir artifacts/category-tree-validation/go-live-manual'
      )
    }

    $outPath = Join-Path $releaseDir "go-live-preflight-$timestamp.json"
    $report | ConvertTo-Json -Depth 8 | Set-Content -Path $outPath -Encoding UTF8

    Write-Step 'Preflight concluido'
    Write-Host "Relatorio: $outPath" -ForegroundColor Green
    Write-Host "Health: $($health.status)" -ForegroundColor Green
    if ($stats.success -eq $true) {
      Write-Host "mapped=$($stats.data.mapped) pending=$($stats.data.pending) total=$($stats.data.total) unmapped=$($stats.data.unmapped)" -ForegroundColor Green
    }
    if ($categoryTree.ok -eq $true) {
      Write-Host "Category tree: OK ($($categoryTree.apiUrl))" -ForegroundColor Green
    } else {
      Write-Host "Category tree: FAILED ($($categoryTree.apiUrl))" -ForegroundColor Yellow
      Write-Host "Evidence: $($categoryTree.evidenceDir)" -ForegroundColor Yellow
    }
  }

  'monitor' {
    Write-Step 'Comandos de monitoramento sugeridos'
    Write-Host 'docker compose -f sistema/docker-compose.staging.yml logs -f api_staging'
    Write-Host 'Invoke-RestMethod http://localhost:4001/health | ConvertTo-Json'
    Write-Host 'Invoke-RestMethod http://localhost:4001/api/categories/stats/mapping | ConvertTo-Json'
    Write-Host 'cd sistema && npm run validate:category-tree -- --api-url http://localhost:4001 --evidence-dir artifacts/category-tree-validation/go-live-manual'
  }

  'rollback' {
    Write-Step 'Comandos de rollback sugeridos (local/staging)'
    Write-Host 'docker compose -f sistema/docker-compose.staging.yml down'
    Write-Host 'docker compose down'
    Write-Host 'docker compose up -d --build'
  }
}
