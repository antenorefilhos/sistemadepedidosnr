const LOCAL_ENVS = new Set(['', 'development', 'test'])
const INSECURE_SECRETS = new Set(['secret', 'change-me', 'changeme', 'jwt-secret'])

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
