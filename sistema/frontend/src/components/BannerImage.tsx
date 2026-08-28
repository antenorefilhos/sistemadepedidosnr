/**
 * Foto de fundo de um banner, escolhendo entre a arte de desktop e a de mobile.
 *
 * O campo "Foto mobile" existe no admin desde sempre e era salvo no banco, mas
 * nenhuma tela da loja lia -- o celular recebia a arte de desktop recortada.
 * Doi mais aqui do que pareceria: a proporcao do card muda muito entre as duas
 * telas (hero e' 1.49:1 no celular e 3.67:1 no desktop), entao uma arte so
 * sempre perde de um lado.
 *
 * `<picture>` com media query em vez de `srcset`/`sizes`: a escolha aqui nao e'
 * por densidade de tela nem por largura do arquivo, e' por PROPORCAO -- sao
 * duas artes com enquadramento diferente, e quem decide e' o breakpoint do
 * layout (md do Tailwind = 768px), nao o navegador.
 *
 * Sem foto mobile cadastrada, cai na de desktop -- que e' o comportamento que
 * ja existia, entao ligar isto nao muda nada para quem so tem uma arte.
 *
 * As duas URLs chegam JA resolvidas (resolveApiUrl no chamador): resolver aqui
 * de novo quebraria, porque a funcao nao e' idempotente -- ela prefixa a base
 * da API e rodar duas vezes geraria /api/api/uploads/...
 */

/**
 * Que parte da foto sobrevive ao corte, deduzida do alinhamento do texto.
 *
 * O `align` do banner diz de que lado ficam titulo e botao; o assunto da foto
 * quase sempre esta do lado OPOSTO, porque foi assim que a arte foi montada
 * (e o gradiente escurece justamente o lado do texto). Entao texto a esquerda
 * -> preserva a direita da foto no corte, e vice-versa.
 *
 * Importa principalmente no celular sem arte propria: la o card e ~1.5:1 contra
 * ~3.7:1 do desktop, entao o corte lateral e agressivo e centralizar cortaria
 * metade do assunto de cada lado. Deduzir do align evita mais um campo pro
 * operador preencher -- e pra quem quiser controle fino, `objectPosition`
 * sobrescreve.
 */
const POSITION_BY_ALIGN: Record<'left' | 'center' | 'right', string> = {
  left: 'right center',
  center: 'center',
  right: 'left center',
}
export function BannerImage({
  desktopUrl,
  mobileUrl,
  alt,
  className = 'absolute inset-0 h-full w-full object-cover',
  align = 'center',
  objectPosition,
  loading = 'lazy',
  fetchPriority,
  draggable,
}: {
  desktopUrl: string
  mobileUrl?: string | null
  alt: string
  className?: string
  /** Alinhamento do texto do banner -- define o corte da foto (ver acima). */
  align?: 'left' | 'center' | 'right'
  /** Sobrescreve o corte deduzido do `align`. */
  objectPosition?: string
  loading?: 'lazy' | 'eager'
  fetchPriority?: 'high' | 'low' | 'auto'
  draggable?: boolean
}) {
  return (
    <picture>
      {mobileUrl && <source media="(max-width: 767px)" srcSet={mobileUrl} />}
      <img
        src={desktopUrl}
        alt={alt}
        className={className}
        style={{ objectPosition: objectPosition ?? POSITION_BY_ALIGN[align] }}
        loading={loading}
        fetchPriority={fetchPriority}
        draggable={draggable}
      />
    </picture>
  )
}
