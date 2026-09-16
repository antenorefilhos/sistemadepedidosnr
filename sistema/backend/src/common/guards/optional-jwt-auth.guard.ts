import { ExecutionContext, Injectable } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'

/**
 * JON-132 (Auditoria 360, High): carrinho/checkout publicos aceitavam
 * customerId cru do corpo da requisicao, sem verificar contra o JWT --
 * mesmo um cliente LOGADO (com Authorization valido) tinha o customerId
 * decidido pelo corpo, nao pelo token, entao um corpo adulterado (client
 * modificado, XSS) atribuia carrinho/pedido a outra conta so informando o
 * id dela.
 *
 * Guest checkout continua funcionando sem token nenhum -- decisao de
 * produto documentada (CLAUDE.md, ALLOW_GUEST_CHECKOUT). Esse guard so
 * populariza req.user QUANDO existe um token valido; sem token, deixa
 * passar com req.user=null igual antes. O controller usa req.user.id
 * (quando role=customer) no lugar do customerId do corpo -- nunca o
 * contrario.
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    return super.canActivate(context) as Promise<boolean>
  }

  handleRequest(_err: unknown, user: unknown) {
    // Nunca lanca: sem token (ou token invalido/expirado), segue anonimo.
    return (user as never) || null
  }
}
