const LOCAL_ENVS = new Set(['', 'development', 'test'])
// JON-144 (Auditoria 360, High): docker-compose.yml e docker-compose.staging.yml
// tem fallback ${JWT_SECRET:-...} com um valor LITERAL commitado no repo, com
// 32+ chars -- passava batido no check de comprimento abaixo. Se a env real
// nao for configurada (staging/producao rodando sem .env completo), a API
// sobe normalmente usando um segredo que qualquer um le no git. Comprimento
// nao prova segredo: os dois valores commitados entram aqui INDEPENDENTE do
// tamanho, mesmo padrao das strings curtas ja bloqueadas.
const INSECURE_SECRETS = new Set([
  'secret',
  'change-me',
  'changeme',
  'jwt-secret',
  'antenor_local_stack_jwt_secret_2026_min_32_chars',
  'staging-jwt-secret-change-before-production',
])

export function resolveJwtSecret() {
  const env = String(process.env.NODE_ENV || '').trim().toLowerCase()
  const secret = String(process.env.JWT_SECRET || '').trim()

  if (LOCAL_ENVS.has(env)) {
    return secret || 'development-only-jwt-secret'
  }

  if (!secret || secret.length < 32 || INSECURE_SECRETS.has(secret.toLowerCase())) {
    throw new Error('JWT_SECRET forte e obrigatorio fora de ambiente local.')
  }

  return secret
}
