import { Controller, Get, NotFoundException, Param, Query, Res } from '@nestjs/common'
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

// Versao menor das imagens enviadas pelo admin (08/10/2026): banner e foto de
// receita ficam no tamanho do envio (ate 2000 px, webp q90 -- 1344 px de
// receita aparecia num card de 278 px; banner principal de 240 KB no celular).
// O site pede a largura que vai mostrar; a variante e gerada na primeira vez,
// guardada em disco e refeita sozinha se a original mudar. Larguras fixas: um
// `?w=` livre deixaria qualquer um encher o disco com variantes.
const UPLOADS = join(process.cwd(), 'uploads')
const VARIANTS = join(UPLOADS, 'thumb-w')
export const VARIANT_WIDTHS = [320, 480, 640, 800, 1200, 1600]

/** A largura pedida vira a menor variante que cobre ela (ou a maior). */
export function variantWidth(requested: unknown): number {
  const width = Number(requested) || 800
  return VARIANT_WIDTHS.find((w) => w >= width) ?? VARIANT_WIDTHS[VARIANT_WIDTHS.length - 1]
}

@ApiExcludeController()
@RelaxedThrottle()
@Controller('thumbs/uploads')
export class UploadVariantsController {
  @Get(':file')
  async variant(@Param('file') file: string, @Query('w') w: string, @Res() res: Response) {
    // So arquivo da raiz de uploads/ (banner, receita): nome sem barra nem "..".
    const match = String(file).match(/^([0-9A-Za-z_-]{1,80})\.(webp|jpg|jpeg|png)$/)
    if (!match) throw new NotFoundException()
    const original = join(UPLOADS, `${match[1]}.${match[2]}`)
    if (!existsSync(original)) throw new NotFoundException()

    const width = variantWidth(w)
    const dir = join(VARIANTS, String(width))
    const target = join(dir, `${match[1]}.webp`)
    if (!existsSync(target) || statSync(target).mtimeMs < statSync(original).mtimeMs) {
      mkdirSync(dir, { recursive: true })
      await sharp(original).resize({ width, withoutEnlargement: true }).webp({ quality: 72, effort: 5, smartSubsample: true }).toFile(target)
    }
    // O nome da original nunca muda de conteudo (uuid novo a cada envio):
    // pode ficar no navegador e na borda por bastante tempo.
    res.set('Cache-Control', 'public, max-age=604800, s-maxage=2592000')
    return res.sendFile(target)
  }
}
