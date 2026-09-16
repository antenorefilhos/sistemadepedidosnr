import { Injectable, UnauthorizedException } from '@nestjs/common'
import { Strategy } from 'passport-jwt'
import { PassportStrategy } from '@nestjs/passport'
import { PrismaService } from '../prisma.service'
import { resolveJwtSecret } from '../security/jwt-secret'

type JwtPayload = {
  id: string
  email: string
  name: string
  role: string
  tenantId?: string
  storeId?: string
  permissions?: string[]
  moduleAccess?: string[]
  // JON-138: ausente em token emitido antes desta mudanca -- trata como 0,
  // mesmo default de quem nunca trocou senha, pra nao derrubar sessao valida
  // so por ser anterior ao deploy.
  tokenVersion?: number
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private prisma: PrismaService) {
    super({
      jwtFromRequest: (req) => {
        const auth = req.headers.authorization
        if (!auth) return null
        return auth.replace('Bearer ', '')
      },
      ignoreExpiration: false,
      secretOrKey: resolveJwtSecret(),
    })
  }

  /**
   * Alem de conferir a assinatura, confere se a CONTA ainda vale.
   *
   * Token assinado nao tem revogacao: ate 03/09/2026 este guard so validava a
   * assinatura, entao desativar um funcionario na tela Equipe (ou bloquear um
   * cliente) nao derrubava a sessao dele -- o acesso so acabava quando o token
   * expirava sozinho. Com as 24h de antes isso ficava contido; com a sessao
   * longa que separacao e entrega precisam (o celular do funcionario nao pode
   * pedir login a cada turno), um demitido manteria acesso por 30 dias.
   *
   * A consulta so acontece em rota autenticada -- o catalogo do storefront e
   * publico e nao passa por aqui --, entao o custo cai sobre requisicao que ja
   * ia ao banco de qualquer forma.
   */
  async validate(payload: JwtPayload) {
    if (!payload?.id) throw new UnauthorizedException('Token invalido.')

    if (payload.role === 'customer') {
      const customer = await this.prisma.customer.findUnique({
        where: { id: payload.id },
        select: { id: true, blocked: true, tokenVersion: true, tenantId: true },
      })
      if (!customer) throw new UnauthorizedException('Conta nao encontrada.')
      if (customer.blocked) throw new UnauthorizedException('Conta suspensa.')
      // JON-138: token emitido antes de uma troca/reset de senha tem
      // tokenVersion desatualizado -- rejeita mesmo com assinatura valida.
      if ((payload.tokenVersion ?? 0) !== (customer.tokenVersion ?? 0)) {
        throw new UnauthorizedException('Sessao expirada por troca de senha. Faca login novamente.')
      }
      // JON-143: tenantId vinha do payload -- conta movida pra outro tenant
      // mantinha o contexto antigo por toda a validade do token (30 dias pra
      // customer). tenantId agora vem do banco, igual a role/moduleAccess do
      // admin abaixo. storeId permanece do payload: nao ha hoje uma nocao de
      // "loja atual" persistida por conta (so vinculo tenant), reavaliar
      // exige decisao de produto sobre qual store escolher quando ha mais de
      // uma no tenant.
      return {
        id: payload.id,
        email: payload.email,
        name: payload.name,
        role: payload.role,
        tenantId: customer.tenantId,
        storeId: payload.storeId,
        permissions: payload.permissions || [],
        moduleAccess: payload.moduleAccess || [],
      }
    } else {
      const admin = await this.prisma.admin.findUnique({
        where: { id: payload.id },
        select: { id: true, active: true, role: true, moduleAccess: true, tokenVersion: true, tenantId: true },
      })
      if (!admin) throw new UnauthorizedException('Conta nao encontrada.')
      if (!admin.active) throw new UnauthorizedException('Conta desativada.')
      if ((payload.tokenVersion ?? 0) !== (admin.tokenVersion ?? 0)) {
        throw new UnauthorizedException('Sessao expirada por troca de senha. Faca login novamente.')
      }

      // Papel e modulos vem do BANCO, nao do token: tirar o modulo `delivery`
      // de alguem na tela Equipe passa a valer na hora, sem esperar o token
      // velho expirar. O token so prova QUEM e; o que a pessoa pode e agora.
      // JON-143: tenantId idem -- vinha do payload, agora vem do banco.
      return {
        id: payload.id,
        email: payload.email,
        name: payload.name,
        role: admin.role || payload.role,
        tenantId: admin.tenantId,
        storeId: payload.storeId,
        permissions: payload.permissions || [],
        moduleAccess: admin.role === 'admin' ? payload.moduleAccess || [] : admin.moduleAccess || [],
      }
    }
  }
}
