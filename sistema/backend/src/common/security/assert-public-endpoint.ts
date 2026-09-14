import { BadRequestException } from '@nestjs/common'
import { lookup } from 'dns/promises'
import { isIP } from 'net'

/**
 * JON-140 (Auditoria 360, High): inscricao de Web Push aceitava qualquer
 * `endpoint` sem validar -- um cliente autenticado podia registrar
 * `http://127.0.0.1:6379/` (ou qualquer IP privado/metadata da rede da
 * VPS) e o servidor, ao mandar a proxima notificacao, faria a requisicao
 * de SAIDA pra esse destino via web-push (SSRF classico, servidor vira
 * proxy pra rede interna dele mesmo).
 *
 * So aceita https:// e so aceita host cujos enderecos resolvidos sao TODOS
 * publicos -- cobre tanto IP literal na URL quanto DNS rebinding (dominio
 * que resolve pra IP privado).
 */
export async function assertPublicHttpsEndpoint(rawUrl: string): Promise<void> {
  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    throw new BadRequestException('Endpoint de push invalido.')
  }

  if (url.protocol !== 'https:') {
    throw new BadRequestException('Endpoint de push precisa ser https://.')
  }
  if (url.username || url.password) {
    throw new BadRequestException('Endpoint de push nao pode conter credenciais na URL.')
  }

  const hostname = url.hostname
  const literalIpVersion = isIP(hostname)
  const addresses: string[] = []

  if (literalIpVersion) {
    addresses.push(hostname)
  } else {
    try {
      const resolved = await lookup(hostname, { all: true, verbatim: true })
      addresses.push(...resolved.map((r) => r.address))
    } catch {
      throw new BadRequestException('Nao foi possivel resolver o host do endpoint de push.')
    }
  }

  if (addresses.length === 0 || addresses.some((addr) => isPrivateOrReservedIp(addr))) {
    throw new BadRequestException('Endpoint de push aponta para um destino de rede nao permitido.')
  }
}

function isPrivateOrReservedIp(address: string): boolean {
  const version = isIP(address)
  if (version === 4) return isPrivateIpv4(address)
  if (version === 6) return isPrivateIpv6(address)
  return true // nem IPv4 nem IPv6 valido -- recusa por seguranca
}

function isPrivateIpv4(address: string): boolean {
  const parts = address.split('.').map(Number)
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p) || p < 0 || p > 255)) return true
  const [a, b] = parts
  if (a === 10) return true // 10.0.0.0/8
  if (a === 127) return true // loopback
  if (a === 169 && b === 254) return true // link-local
  if (a === 172 && b >= 16 && b <= 31) return true // 172.16.0.0/12
  if (a === 192 && b === 168) return true // 192.168.0.0/16
  if (a === 100 && b >= 64 && b <= 127) return true // CGNAT 100.64.0.0/10
  if (a === 0) return true // "esta rede"
  if (a >= 224) return true // multicast (224+) e reservado (240+)
  if (a === 192 && b === 0 && parts[2] === 0) return true // 192.0.0.0/24 (IETF protocol assignments)
  if (a === 198 && (b === 18 || b === 19)) return true // benchmarking 198.18.0.0/15
  return false
}

function isPrivateIpv6(address: string): boolean {
  const lower = address.toLowerCase()
  if (lower === '::1') return true // loopback
  if (lower === '::') return true // unspecified
  if (lower.startsWith('fc') || lower.startsWith('fd')) return true // fc00::/7 unique local
  if (lower.startsWith('fe80:') || lower.startsWith('fe8') || lower.startsWith('fe9') || lower.startsWith('fea') || lower.startsWith('feb')) return true // fe80::/10 link-local
  // IPv4-mapped (::ffff:a.b.c.d) -- valida a parte v4 embutida tambem.
  const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)
  if (mapped) return isPrivateIpv4(mapped[1])
  return false
}
