#!/usr/bin/env bash
# Mostra ou troca a acao do Cloudflare Managed Free Ruleset da zona
# antenorefilhos.com.br (log <-> block).
#
# O painel da Cloudflare NAO edita esta regra (a pagina do conjunto gerenciado
# responde 404, porque ela foi criada por API em 17/09/2026), entao a troca e
# feita pela API. Roda na VPS, que tem o CLOUDFLARE_API_TOKEN no
# .env.production; o token nunca e impresso.
#
# Uso, a partir da raiz do repo no PC:
#   ssh antenor-vps 'bash -s -- status' < sistema/scripts/cloudflare-waf-managed.sh
#   ssh antenor-vps 'bash -s -- block'  < sistema/scripts/cloudflare-waf-managed.sh
#   ssh antenor-vps 'bash -s -- log'    < sistema/scripts/cloudflare-waf-managed.sh   # desfaz
set -euo pipefail

MODE="${1:-}"
case "$MODE" in
  status|log|block) ;;
  *) echo "uso: bash -s -- <status|log|block>" >&2; exit 2 ;;
esac

TOKEN=$(grep -E '^CLOUDFLARE_API_TOKEN=' /opt/antenor/sistema/.env.production | head -1 | cut -d= -f2- | tr -d "\"'\r")
[ -n "$TOKEN" ] || { echo "CLOUDFLARE_API_TOKEN nao encontrado no .env.production" >&2; exit 1; }
export TOKEN MODE

python3 - <<'PY'
import json, os, sys, urllib.error, urllib.request

ZONE = 'cc1a05ea312e1a08a16d57e17ede8345'
FREE_RULESET = '77454fe2d30c4220b5701f6fdfb893ba'  # Cloudflare Managed Free Ruleset
HEADERS = {'Authorization': 'Bearer ' + os.environ['TOKEN'], 'Content-Type': 'application/json'}
MODE = os.environ['MODE']


def call(method, path, body=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request('https://api.cloudflare.com/client/v4' + path, method=method, headers=HEADERS, data=data)
    try:
        return json.load(urllib.request.urlopen(req, timeout=30))
    except urllib.error.HTTPError as e:
        return json.load(e)


entry = call('GET', f'/zones/{ZONE}/rulesets/phases/http_request_firewall_managed/entrypoint')
if not entry.get('success'):
    sys.exit(f"falha ao ler o WAF: {entry.get('errors')}")
ruleset = entry['result']
rule = next((r for r in ruleset.get('rules', []) if (r.get('action_parameters') or {}).get('id') == FREE_RULESET), None)
if not rule:
    sys.exit('regra do Managed Free Ruleset nao encontrada na zona')

current = (rule['action_parameters'].get('overrides') or {}).get('action') or 'padrao do conjunto'
print(f'acao atual do Managed Free Ruleset: {current}')
if MODE == 'status':
    sys.exit(0)
if current == MODE:
    print('ja esta assim, nada a fazer')
    sys.exit(0)

params = dict(rule['action_parameters'])
overrides = dict(params.get('overrides') or {})
overrides['action'] = MODE
params['overrides'] = overrides
body = {
    'action': rule['action'],
    'action_parameters': params,
    'expression': rule['expression'],
    'description': f'Cloudflare Managed Free Ruleset - modo {MODE}',
    'enabled': rule.get('enabled', True),
}
out = call('PATCH', f"/zones/{ZONE}/rulesets/{ruleset['id']}/rules/{rule['id']}", body)
if not out.get('success'):
    sys.exit(f"falha ao trocar: {out.get('errors')}")
new = next((r for r in out['result']['rules'] if r['id'] == rule['id']), {})
print('acao agora:', (new.get('action_parameters', {}).get('overrides') or {}).get('action'))
PY
