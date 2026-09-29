import { Controller, Get, Header, Param, Req, Res } from '@nestjs/common'
import { ApiExcludeController } from '@nestjs/swagger'
import type { Request, Response } from 'express'
import { RelaxedThrottle } from '../../common/decorators/relaxed-throttle.decorator'
import { productPath, SeoService } from './seo.service'

// Rotas servidas pelo nginx do storefront (ver frontend/nginx.conf):
// /sitemap.xml, /p/<slug>, /produto/<id> e /receitas/<slug> chegam aqui antes da SPA.
@ApiExcludeController()
@RelaxedThrottle()
@Controller('seo')
export class SeoController {
  constructor(private readonly seo: SeoService) {}

  @Get('sitemap.xml')
  @Header('Content-Type', 'application/xml; charset=utf-8')
  @Header('Cache-Control', 'public, max-age=3600')
  sitemap() {
    return this.seo.buildSitemap()
  }

  @Get('p/:slug')
  async productPage(@Param('slug') slug: string, @Req() req: Request, @Res() res: Response) {
    const erpProductId = Number((String(slug).match(/-(\d+)$/) || [])[1])
    const product = erpProductId ? await this.seo.findProductByErpId(erpProductId) : null
    if (!product) return this.sendIndex(res, 404)

    // Slug desatualizado (nome mudou no ERP): 301 para a URL canonica.
    const canonical = productPath(product)
    // Mantem a query (?n= do aviso, utm_*): sem ela o clique no push se perdia.
    const query = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : ''
    if (canonical !== `/p/${slug}`) return res.redirect(301, canonical + query)

    try {
      const html = await this.seo.renderProductPage(product)
      res.status(200).type('html').set('Cache-Control', 'public, max-age=300').send(html)
    } catch {
      return this.sendIndex(res, 200)
    }
  }

  // Link antigo /produto/<cuid> -> 301 para a URL limpa (sinal certo para o Google).
  @Get('produto/:id')
  async legacyProduct(@Param('id') id: string, @Req() req: Request, @Res() res: Response) {
    const product = await this.seo.findProductById(id)
    const query = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : ''
    if (product?.erpProductId) return res.redirect(301, productPath(product) + query)
    return this.sendIndex(res, product ? 200 : 404)
  }

  @Get('receitas/:slug')
  async recipePage(@Param('slug') slug: string, @Res() res: Response) {
    const recipe = await this.seo.findPublishedRecipe(slug)
    if (!recipe) return this.sendIndex(res, 404)
    try {
      const html = await this.seo.renderRecipePage(recipe)
      res.status(200).type('html').set('Cache-Control', 'public, max-age=300').send(html)
    } catch {
      return this.sendIndex(res, 200)
    }
  }

  private async sendIndex(res: Response, status: number) {
    const html = await this.seo.fallbackIndex()
    if (!html) return res.status(502).send('')
    return res.status(status).type('html').set('Cache-Control', 'no-cache').send(html)
  }
}
