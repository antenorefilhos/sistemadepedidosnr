param(
  [ValidateSet('up', 'build', 'validate', 'cleanup', 'all')]
  [string]$Action = 'all'
)

$ErrorActionPreference = 'Stop'
Set-Location -Path $PSScriptRoot

function Invoke-Up {
  Write-Host 'Subindo stack principal (db, redis, meili, api, storefront, admin)...' -ForegroundColor Cyan
  docker compose up -d db redis meili api storefront admin | Out-Host
}

function Invoke-Build {
  Write-Host 'Buildando imagens (api, storefront, admin)...' -ForegroundColor Cyan
  docker compose build api storefront admin | Out-Host
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
