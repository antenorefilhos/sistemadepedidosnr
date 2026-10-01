import { Controller, Get, NotFoundException, Param, Res } from '@nestjs/common'
import { ApiExcludeController } from '@nestjs/swagger'
import type { Response } from 'express'
import { existsSync, mkdirSync, statSync } from 'fs'
import { join } from 'path'
import sharp from 'sharp'
import { RelaxedThrottle } from '../../common/decorators/relaxed-throttle.decorator'

// Miniatura da foto do produto para cards/vitrines (28/09/2026): as fotos
// originais tem ~1260 px e media de 67 KB (ate 600 KB); o card mostra ~200 px.
// Uma vitrine de 30 itens baixava ~2 MB. A miniatura (400 px, webp q72) e
// gerada na primeira requisicao e refeita sozinha quando a original fica mais
// nova (troca de foto no admin), sem tarefa agendada.
const ORIGINALS = join(process.cwd(), 'uploads', 'products')
const THUMBS = join(ORIGINALS, 'thumb')
const THUMB_SIZE = 400

@ApiExcludeController()
@RelaxedThrottle()
@Controller('thumbs/products')
export class ThumbsController {
  @Get(':file')
  async thumb(@Param('file') file: string, @Res() res: Response) {
    const ean = (String(file).match(/^([0-9A-Za-z_-]{1,40})\.webp$/) || [])[1]
    if (!ean) throw new NotFoundException()
    const original = ['webp', 'jpg', 'jpeg', 'png'].map((ext) => join(ORIGINALS, `${ean}.${ext}`)).find((p) => existsSync(p))
    if (!original) throw new NotFoundException()

    const target = join(THUMBS, `${ean}.webp`)
    if (!existsSync(target) || statSync(target).mtimeMs < statSync(original).mtimeMs) {
      mkdirSync(THUMBS, { recursive: true })
      await sharp(original).resize(THUMB_SIZE, THUMB_SIZE, { fit: 'inside', withoutEnlargement: true }).webp({ quality: 72 }).toFile(target)
    }
    // Navegador reconfere a cada 5 min (304 com ETag); a borda guarda 1 dia e
    // e purgada na troca de foto (uploads.controller). Antes o navegador
    // guardava 1 dia e mostrava a foto antiga depois da troca.
    res.set('Cache-Control', 'public, max-age=300, s-maxage=86400')
    return res.sendFile(target)
  }
}
