import { SkipThrottle } from '@nestjs/throttler'

/**
 * O ThrottlerGuard aplica TODOS os buckets nomeados registrados em
 * ThrottlerModule.forRoot() a TODA rota, sempre -- e um comportamento da lib
 * (ver node_modules/@nestjs/throttler/dist/throttler.guard.js: o loop em
 * `canActivate` percorre `this.throttlers` incondicionalmente; `@Throttle`
 * so troca o limite/ttl de um bucket que ja seria checado, nao faz a rota
 * "entrar" nele). Rota sem decorator nenhum fica presa ao bucket mais
 * apertado -- hoje o `auth`, 20 req/min -- foi o que quebrou o upload em
 * lote de fotos (ver CLAUDE.md).
 *
 * Este decorator e o oposto do padrao da lib: uma rota so fica sob `auth`,
 * `checkout` ou `webhook` se o handler que precisa deles usar `@Throttle`
 * explicitamente (como authcontroller.ts e checkout.controller.ts ja fazem).
 * Todo o resto usa isto para cair no bucket `default` (600/min), que e o
 * unico que faz sentido como padrao global.
 */
export const RelaxedThrottle = () => SkipThrottle({ auth: true, checkout: true, webhook: true })
