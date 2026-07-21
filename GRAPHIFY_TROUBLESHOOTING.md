# 🔧 Graphify Troubleshooting — Resolvendo Erros

**Data:** 21 de julho de 2026  
**Status:** Guia de solução de problemas  

---

## ❌ ERRO: `graphify: command not found` ou `not recognized`

### Cenário 1: Graphify Não Está no PATH

**Sintoma:**
```powershell
graphify .
# Erro: graphify: command not found
# ou: 'graphify' is not recognized as an internal or external command
```

### Solução 1A: Reinstalar com PATH correto

```powershell
# Passo 1: Desinstalar versão antiga
uv tool uninstall graphifyy

# Passo 2: Reinstalar (vai adicionar ao PATH automaticamente)
uv tool install graphifyy

# Passo 3: Fechar PowerShell completamente e abrir nova janela
# (Importante! PATH só atualiza ao abrir novo terminal)

# Passo 4: Verificar instalação
graphify --version
```

### Solução 1B: Se ainda não funcionar, usar caminho completo

```powershell
# Encontrar onde foi instalado
where uv
# Resultado: C:\Users\Jonathan\AppData\Local\Programs\uv\uv.exe

# Usar caminho completo (mude conforme seu resultado)
& "$env:APPDATA\..\Local\Python312\Scripts\graphify.exe" .

# Ou tente:
& "$env:APPDATA\..\Local\uv\bin\graphify.exe" .

# Ou:
$env:APPDATA\..\Local\Programs\Python\Python312\Scripts\graphify.exe .
```

---

## ❌ ERRO: `no LLM API key found`

**Sintoma:**
```powershell
graphify .
# error: no LLM API key found (2306 doc/paper/image file(s) need semantic extraction)
# Set GEMINI_API_KEY or GOOGLE_API_KEY (gemini), MOONSHOT_API_KEY (kimi), 
# ANTHROPIC_API_KEY (claude), OPENAI_API_KEY (openai), etc.
```

### Solução 2: Usar `--code-only` (NÃO precisa API key)

```powershell
# Mapear APENAS código (sem documentos/imagens)
graphify . --code-only

# Ou com output customizado
graphify . --code-only --output ./graphify-index.json

# Ou se quiser incluir docs, precisa de API key:
# Set uma variável de ambiente e tente
$env:ANTHROPIC_API_KEY="sk-ant-..." # Seu API key do Anthropic
graphify . --output ./graphify-knowledge.json
```

### Se quiser usar API key do Anthropic:

1. **Obter API key:**
   - Ir em https://console.anthropic.com/
   - Criar/copiar sua API key

2. **Definir no PowerShell (temporário):**
   ```powershell
   $env:ANTHROPIC_API_KEY="sk-ant-xxxxx"
   graphify . --output ./graphify-knowledge.json
   ```

3. **Ou definir permanentemente (Windows):**
   ```powershell
   # Abrir PowerShell como Admin
   [Environment]::SetEnvironmentVariable("ANTHROPIC_API_KEY", "sk-ant-xxxxx", "User")
   
   # Depois reiniciar PowerShell
   ```

---

## ✅ SOLUÇÃO RECOMENDADA (Funciona 100%)

Se nada acima funcionar, use esta abordagem:

### Passo 1: Instalar Fresh

```powershell
# Abrir PowerShell COMO ADMINISTRADOR

# Desinstalar tudo relacionado
uv tool uninstall graphifyy

# Reinstalar
uv tool install graphifyy

# Sair e abrir PowerShell NOVO (não fechar a janela, abrir outra)
# Isso garante que PATH seja lido novamente
```

### Passo 2: Testar Versão

```powershell
# Em PowerShell novo:
graphify --version
# Esperado: graphify 0.9.22 (ou similar)
```

### Passo 3: Rodar Graphify

```powershell
# Navegar até projeto
Set-Location "F:\VC.VERSE\PROJETOS\antenor e filhos\pedidos nr"

# Rodar com --code-only (sem API key)
graphify . --code-only --output ./graphify-knowledge.json

# Esperado: Arquivo graphify-knowledge.json criado
```

---

## 🔍 DIAGNOSTICAR O PROBLEMA

Se continuar não funcionando, execute:

```powershell
# 1. Verificar se uv está instalado
uv --version

# 2. Listar ferramentas instaladas
uv tool list

# 3. Procurar graphify em qualquer lugar
where graphify
# ou
Get-Command graphify -ErrorAction SilentlyContinue

# 4. Verificar PATH
$env:PATH -split ";" | Select-String "uv\|graphify\|local\bin"

# 5. Tentar versão longa do comando
python -m graphify --version

# 6. Verificar Python disponível
python --version
pip --version
```

---

## ✨ ALTERNATIVA: Se Graphify Não Funcionar

Se depois de tudo Graphify ainda não funcionar, use **Canvas + Graph View nativo** do Obsidian (já está pronto):

```
Obsidian:
1. Abrir "Grafo-Milestones.canvas" → Grafo visual interativo
2. Abrir Graph View (ícone 📊) → Grafo automático

Isso substitui Graphify completamente.
```

---

## 📋 CHECKLIST FINAL

- [ ] Abrir PowerShell **como Admin**
- [ ] Rodar `uv tool install graphifyy`
- [ ] **Fechar PowerShell completamente**
- [ ] Abrir **nova** janela PowerShell
- [ ] Testar `graphify --version`
- [ ] Navegar até projeto: `Set-Location "F:\VC.VERSE\PROJETOS\antenor e filhos\pedidos nr"`
- [ ] Rodar: `graphify . --code-only --output ./graphify-knowledge.json`
- [ ] Verificar: `ls graphify-knowledge.json`

---

## 🎯 SE AINDA NÃO FUNCIONAR

Envie o erro exato aqui:

```
1. Output completo do comando que deu erro
2. Resultado de: graphify --version
3. Resultado de: where graphify
4. Resultado de: uv tool list
```

Com essas informações, posso diagnoscar exatamente o que está acontecendo.

---

*Guia atualizado em 21 de julho de 2026*
