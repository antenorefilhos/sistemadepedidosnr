/**
 * Imagem na largura em que a tela vai mostrar (08/10/2026).
 *
 * - Unsplash: troca o `w=` (os banners vinham com 1600 px, ~200 KB).
 * - Envio do admin (`/uploads/<arquivo>`, banner e receita): pede a variante
 *   `/thumbs/uploads/<arquivo>?w=` que a API gera e guarda -- a original pode
 *   ter ate 2000 px (receita de 1344 px num card de 278 px).
 * - Qualquer outra (foto de produto, outro site): passa direto.
 *
 * `width` e a largura em pixels de tela 2x (card de 278 px -> 640).
 */
const UPLOAD_RE = /^(.*?)\/uploads\/([0-9A-Za-z_-]{1,80}\.(?:webp|jpe?g|png))(?:\?.*)?$/

export function sizedImageUrl(url: string | null | undefined, width: number): string | null {
  if (!url) return null
  const upload = url.match(UPLOAD_RE)
  if (upload) return `${upload[1]}/thumbs/uploads/${upload[2]}?w=${width}`
  if (!url.includes('images.unsplash.com')) return url
  try {
    const parsed = new URL(url)
    if (parsed.hostname !== 'images.unsplash.com') return url
    parsed.searchParams.set('w', String(width))
    parsed.searchParams.set('q', '70')
    if (!parsed.searchParams.has('auto')) parsed.searchParams.set('auto', 'format')
    return parsed.toString()
  } catch {
    return url
  }
}
