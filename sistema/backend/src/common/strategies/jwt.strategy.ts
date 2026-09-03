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
        select: { id: true, blocked: true },
      })
      if (!customer) throw new UnauthorizedException('Conta nao encontrada.')
      if (customer.blocked) throw new UnauthorizedException('Conta suspensa.')
    } else {
      const admin = await this.prisma.admin.findUnique({
        where: { id: payload.id },
        select: { id: true, active: true, role: true, moduleAccess: true },
      })
      if (!admin) throw new UnauthorizedException('Conta nao encontrada.')
      if (!admin.active) throw new UnauthorizedException('Conta desativada.')

      // Papel e modulos vem do BANCO, nao do token: tirar o modulo `delivery`
      // de alguem na tela Equipe passa a valer na hora, sem esperar o token
      // velho expirar. O token so prova QUEM e; o que a pessoa pode e agora.
      return {
        id: payload.id,
        email: payload.email,
        name: payload.name,
        role: admin.role || payload.role,
        tenantId: payload.tenantId,
        storeId: payload.storeId,
        permissions: payload.permissions || [],
        moduleAccess: admin.role === 'admin' ? payload.moduleAccess || [] : admin.moduleAccess || [],
      }
    }

    return {
      id: payload.id,
      email: payload.email,
      name: payload.name,
      role: payload.role,
      tenantId: payload.tenantId,
      storeId: payload.storeId,
      permissions: payload.permissions || [],
      moduleAccess: payload.moduleAccess || [],
    }
  }
}
