import { Injectable } from '@nestjs/common'
import { Strategy } from 'passport-jwt'
import { PassportStrategy } from '@nestjs/passport'
import { resolveJwtSecret } from '../security/jwt-secret'

type JwtPayload = {
  id: string
  email: string
  name: string
  role: string
  tenantId?: string
  storeId?: string
  permissions?: string[]
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
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

  validate(payload: JwtPayload) {
    return {
      id: payload.id,
      email: payload.email,
      name: payload.name,
      role: payload.role,
      tenantId: payload.tenantId,
      storeId: payload.storeId,
      permissions: payload.permissions || [],
    }
  }
}
