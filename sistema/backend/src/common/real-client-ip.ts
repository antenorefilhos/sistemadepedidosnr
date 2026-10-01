import { isIP } from 'net'
import type { NextFunction, Request, Response } from 'express'

const PRIVATE_V4 = /^(10\.|127\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/
/** Rede interna (Docker, loopback): quem fala com a API por dentro, nunca um cliente da internet. */
export function isPrivateIp(ip?: string | null): boolean {
  const v = String(ip || '').trim().replace(/^::ffff:/i, '')
  if (!v) return false
  if (isIP(v) === 4) return PRIVATE_V4.test(v)
  return v === '::1' || /^f[cd]/i.test(v)
}

/**
 * IP real do cliente atras do tunel Cloudflare (01/10/2026).
 *
 * Caminho de producao: cliente -> Cloudflare -> cloudflared -> Caddy -> API.
 * Com `trust proxy` = 1, o req.ip era o do conteiner do cloudflared
 * (172.18.0.12) para TODO mundo: antifraude por IP inutil e o rate limit
 * (ThrottlerGuard rastreia por req.ip) compartilhado entre todos os clientes.
 *
 * O Cloudflare manda o IP real em CF-Connecting-IP. So vale quando a conexao
 * chegou ao Caddy pela rede interna (o cloudflared): o Caddy tambem atende
 * direto pela internet nas portas 80/443, e ai o "peer" e um IP publico -- o
 * cabecalho e ignorado e ninguem consegue escolher o proprio IP forjando-o.
 * Reescreve o X-Forwarded-For para o req.ip (e tudo que usa ele) ja sair certo.
 */
export function realClientIp(req: Request, _res: Response, next: NextFunction) {
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',').map((s) => s.trim()).filter(Boolean)
  const peer = forwarded.length ? forwarded[forwarded.length - 1] : req.socket?.remoteAddress
  const cf = String(req.headers['cf-connecting-ip'] || '').trim()
  if (cf && isIP(cf) && isPrivateIp(peer)) req.headers['x-forwarded-for'] = cf
  next()
}
