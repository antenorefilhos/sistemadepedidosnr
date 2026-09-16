param(
  [ValidateSet('up', 'build', 'validate', 'cleanup', 'all')]
  [string]$Action = 'all'
)

$ErrorActionPreference = 'Stop'
Set-Location -Path $PSScriptRoot

# JON-101 (Auditoria 360, Medium): ErrorActionPreference=Stop nao vira
# exceção pra exit code != 0 de comando nativo (docker/npm) -- so afeta
# erros do PowerShell/.NET. Sem checar $LASTEXITCODE, um build/up que falha
# so imprime erro do proprio Docker e o script segue como se tivesse dado
# certo, inclusive chamando os passos seguintes sobre uma stack quebrada.
function Assert-LastExitCode([string]$context) {
  if ($LASTEXITCODE -ne 0) {
    throw "Comando falhou ($context): exit code $LASTEXITCODE"
  }
}

function Invoke-Up {
  Write-Host 'Subindo stack principal (db, redis, meili, api, storefront, admin)...' -ForegroundColor Cyan
  docker compose up -d db redis meili api storefront admin | Out-Host
  Assert-LastExitCode 'docker compose up'
}

function Invoke-Build {
  Write-Host 'Buildando imagens (api, storefront, admin)...' -ForegroundColor Cyan
  docker compose build api storefront admin | Out-Host
  Assert-LastExitCode 'docker compose build'
}

function Invoke-Validate {
  Write-Host 'Validando endpoints de busca...' -ForegroundColor Cyan
  $urls = @(
    'http://localhost:3001/products/suggest?q=abac&limit=5',
    'http://localhost:3001/products?search=abacate&limit=3',
    'http://localhost:3001/products?search=abacate%20preco%3C30&limit=3',
    'http://localhost:3001/products?search=categoria:GERAL%20abacate&limit=3',
    'http://localhost:3001/products?search=abacate%20-oleo&limit=3'
  )

  foreach ($url in $urls) {
    Write-Host "`n> $url" -ForegroundColor Yellow
    curl.exe -s "$url" | Out-Host
  }
}

function Invoke-Cleanup {
  Write-Host 'Removendo containers temporarios de run (--rm que ficaram presos)...' -ForegroundColor Cyan
  $ids = docker ps -aq --filter "name=sistema-api-run-"
  if ($ids) {
    foreach ($id in $ids) {
      try {
        docker rm -f $id | Out-Host
      } catch {
        Write-Host "Ignorando falha ao remover container temporario $id" -ForegroundColor DarkYellow
      }
    }
  } else {
    Write-Host 'Nenhum container temporario encontrado.' -ForegroundColor DarkGray
  }
}

switch ($Action) {
  'up' { Invoke-Up }
  'build' { Invoke-Build }
  'validate' { Invoke-Validate }
  'cleanup' { Invoke-Cleanup }
  'all' {
    Invoke-Cleanup
    Invoke-Build
    Invoke-Up
    Invoke-Validate
  }
}

Write-Host "`nConcluido: $Action" -ForegroundColor Green
