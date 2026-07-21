# 🐛 DEBUGAR — Comece por aqui

Revisado em: 1 de maio de 2026

## Regra #1: Levantar tudo antes de debugar

**Copie-colar isto no PowerShell:**

```powershell
cd "F:\VC.VERSE\PROJETOS\antenor e filhos\pedidos nr\sistema"
.\startup-for-debug.ps1
```

Espere ver `[SUCCESS] STACK PRONTA PARA DEBUG!`

Se não funcionar, tente:
```powershell
docker compose down
docker compose up -d db redis meili api storefront admin
docker compose ps
```

---

## URLs para testar

| Serviço | Link |
|---------|------|
| Loja | http://localhost:3000 / https://localhost:3443 |
| Admin | http://localhost:3002 / https://localhost:3444 |
| API | http://localhost:3001 |
| Swagger | http://localhost:3001/api |

---

## Problemas comuns

### Admin mostra erro 502
→ API ainda está iniciando. Esperar 5 segundos e recarregar.

### Nenhuma página carrega
→ Algum serviço parou. Executar:
```powershell
docker compose ps
```
Se algum não está "Up", todos estão parados. Rodar `startup-for-debug.ps1` novamente.

### Precisa ver logs em tempo real
```powershell
docker compose logs -f           # TUDO
docker compose logs -f api       # Só API
docker compose logs -f admin     # Só Admin
docker compose logs -f db        # Só banco
```

---

## Parar tudo (quando terminar)
```powershell
docker compose down
```

---

## Para mais detalhes
- [QUICK_COMMANDS.md](QUICK_COMMANDS.md) — Todos os comandos
- Guia completo de startup Docker: `memories/repo/docker-startup-complete.md` (arquivo externo antigo, nao presente neste workspace)
- [INICIO_AQUI.md](../01%20-%20Projeto/INICIO_AQUI.md) — Regras do projeto
