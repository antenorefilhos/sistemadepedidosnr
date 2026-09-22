import { Injectable, Logger } from '@nestjs/common'
import axios from 'axios'

/**
 * Purge cirurgico do cache do Cloudflare por URL exata -- ver CLAUDE.md,
 * "Armadilha: Cloudflare cacheia resposta de erro (404/5xx) por tras do
 * proxy". A mesma armadilha vale pra 200: `/uploads/` no nginx do storefront
 * tem `Cache-Control: public, max-age=604800` (7 dias) de proposito (foto de
 * produto raramente muda), entao trocar a foto de um produto (mesmo EAN,
 * mesma URL) fica invisivel pro cliente ate a borda expirar sozinha, sem
 * isso. `CLOUDFLARE_ZONE_ID` nao e segredo (identificador publico de zona,
 * ver CLAUDE.md); `CLOUDFLARE_API_TOKEN` e o token de conta que ja vive em
 * `.env.production`.
 *
 * Feature opcional, nao critica: falha (env ausente, erro de rede, 4xx da
 * API) so gera warn e retorna -- nunca derruba o upload que a chamou. Sem
 * purge, a foto so demora a aparecer (7 dias no pior caso); com upload
 * quebrando por causa disso, a foto nunca troca.
 */
@Injectable()
export class CloudflareCacheService {
  private readonly logger = new Logger(CloudflareCacheService.name)
  private static readonly ZONE_ID = 'cc1a05ea312e1a08a16d57e17ede8345' // antenorefilhos.com.br, publico

  isConfigured() {
    return Boolean(process.env.CLOUDFLARE_API_TOKEN?.trim())
  }

  async purgeUrls(urls: string[]) {
    if (!this.isConfigured() || urls.length === 0) return
    try {
      await axios.post(
        `https://api.cloudflare.com/client/v4/zones/${CloudflareCacheService.ZONE_ID}/purge_cache`,
        { files: urls },
        { headers: { Authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`, 'Content-Type': 'application/json' }, timeout: 10_000 },
      )
    } catch (error) {
      this.logger.warn(`Falha ao purgar cache do Cloudflare (${urls.join(', ')}): ${error instanceof Error ? error.message : 'erro desconhecido'}`)
    }
  }
}
