import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { AlertCircle, ExternalLink } from 'lucide-react'
import { brandAPI, getApiErrorMessage, homeLayoutAPI, type HomeShelfResult, type HomeVitrinesSnapshot } from '../../services/api'

// Layout do Site (refeita em 30/09/2026). A tela antiga editava banner,
// limite e curadoria por departamento: o banner nao aparecia em lugar nenhum
// da loja, e limite/curadoria so valiam no plano B (AntenorApi fora do ar);
// mostrar/ocultar e ordem ja ficam em Departamentos. Aqui: a pagina inicial
// de cima para baixo, com o que cada bloco mostra agora, os controles que so
// existem aqui (faixa, cada vitrine automatica, receitas, "Tudo do Mercado",
// encarte em destaque) e quanto cada vitrine leva ao carrinho e ao pedido.

type Target = 'storeBanners' | 'sponsoredShelves' | 'recipes' | 'categories'
type Props = { onNavigate: (section: Target) => void }

const SITE = 'https://mercado.antenorefilhos.com.br'
const TZ = 'America/Sao_Paulo'
const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const stripEmoji = (s: string) => s.replace(/\p{Extended_Pictographic}️?/gu, '').trim()
const isHomeBanner = (b: { pages?: string | null }) => !b.pages || b.pages === 'home' || b.pages === 'all'
const bannerLabel = (b: { title?: string | null; name?: string | null }) => (b.title || b.name || 'Sem título').replace(/\s+/g, ' ')

type Data = {
  hidden: Set<string>
  vitrines: HomeVitrinesSnapshot | null
  banners: Array<{ id: string; slot: string; title?: string | null; name?: string | null; pages?: string | null }>
  sponsored: Array<{ id: string; title: string; products: unknown[] }>
  recipes: number
  campaigns: Array<{ id: string; name: string; highlightInHome: boolean; items: unknown[]; endDate: string }>
}

export default function HomeLayoutSection({ onNavigate }: Props) {
  const [data, setData] = useState<Data | null>(null)
  const [results, setResults] = useState<{ trackingSince: string | null; byShelf: Map<string | null, HomeShelfResult> } | null>(null)
  const [days, setDays] = useState(30)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const [brand, vitrines, banners, sponsored, recipes, campaigns] = await Promise.all([
        brandAPI.get(),
        homeLayoutAPI.vitrines().catch(() => ({ data: null })),
        homeLayoutAPI.banners(),
        homeLayoutAPI.sponsored(),
        homeLayoutAPI.recipes(),
        homeLayoutAPI.campaigns(),
      ])
      let hidden: string[] = []
      try {
        hidden = JSON.parse(brand.data?.homeLayout || '{}').hidden || []
      } catch {
        hidden = []
      }
      const now = Date.now()
      setData({
        hidden: new Set(hidden),
        vitrines: vitrines.data,
        banners: banners.data.filter(isHomeBanner),
        sponsored: sponsored.data.filter((s) => s.products.length > 0),
        recipes: recipes.data.total ?? recipes.data.data.length,
        campaigns: campaigns.data.filter((c) => c.active && new Date(c.startDate).getTime() <= now && new Date(c.endDate).getTime() >= now),
      })
      setError('')
    } catch (e) {
      setError(getApiErrorMessage(e, 'Não foi possível carregar a página inicial.'))
    }
  }, [])
  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    homeLayoutAPI
      .results(days)
      .then(({ data: r }) => setResults({ trackingSince: r.trackingSince, byShelf: new Map(r.shelves.map((s) => [s.shelf, s])) }))
      .catch(() => setResults(null))
  }, [days])

  const toggle = async (key: string) => {
    if (!data) return
    const next = new Set(data.hidden)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    setBusy(key)
    setData({ ...data, hidden: next })
    try {
      await brandAPI.update({ homeLayout: JSON.stringify({ hidden: [...next] }) })
      setError('')
    } catch (e) {
      setData({ ...data, hidden: data.hidden })
      setError(getApiErrorMessage(e, 'Não foi possível salvar.'))
    } finally {
      setBusy(null)
    }
  }

  const toggleCampaign = async (id: string, on: boolean) => {
    if (!data) return
    setBusy(`encarte:${id}`)
    try {
      await homeLayoutAPI.setCampaignHighlight(id, on)
      setData({ ...data, campaigns: data.campaigns.map((c) => (c.id === id ? { ...c, highlightInHome: on } : c)) })
      setError('')
    } catch (e) {
      setError(getApiErrorMessage(e, 'Não foi possível salvar.'))
    } finally {
      setBusy(null)
    }
  }

  const shown = (key: string) => !data?.hidden.has(key)
  const r = (key: string) => results?.byShelf.get(key)
  const homeTotals = useMemo(() => {
    const all = [...(results?.byShelf.values() || [])]
    return {
      adds: all.reduce((a, s) => a + s.adds, 0),
      tracked: all.filter((s) => s.shelf).reduce((a, s) => a + s.adds, 0),
      orders: all.reduce((a, s) => a + s.orders, 0),
      revenue: all.reduce((a, s) => a + s.revenue, 0),
    }
  }, [results])

  if (!data) {
    return (
      <div className="mx-auto max-w-7xl">
        {error ? <ErrorBox message={error} /> : <div className="h-96 animate-pulse rounded-2xl bg-white/70" />}
      </div>
    )
  }

  const hero = data.banners.filter((b) => b.slot === 'hero')
  const between = data.banners.filter((b) => b.slot === 'intercalado')
  const tarja = data.banners.filter((b) => b.slot === 'tarja')
  const popup = data.banners.filter((b) => b.slot === 'popup')
  const carrosseis = data.vitrines?.carrosseis || []
  const liveIds = new Set(carrosseis.map((c) => `vitrine:${c.id}`))
  const hiddenOffToday = [...data.hidden].filter((k) => k.startsWith('vitrine:') && !liveIds.has(k))
  const visibleVitrines = carrosseis.filter((c) => shown(`vitrine:${c.id}`)).length
  const personality = data.vitrines?.personalidadeAtiva
  const since = results?.trackingSince ? new Date(results.trackingSince).toLocaleString('pt-BR', { timeZone: TZ, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : null

  let step = 0
  const n = () => ++step

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-gray-500">
          A página inicial de cima para baixo, como o cliente vê no celular. As vitrines mudam sozinhas com o dia e a época; aqui você esconde o que não quer e vê o que cada uma vende.
        </p>
        <div className="flex items-center gap-2">
          <div className="grid grid-cols-2 gap-1 rounded-xl bg-gray-100 p-1">
            {[7, 30].map((d) => (
              <button key={d} type="button" onClick={() => setDays(d)} className={`rounded-lg px-3 py-1.5 text-sm ${days === d ? 'bg-gray-900 text-white' : 'text-gray-600'}`}>
                {d} dias
              </button>
            ))}
          </div>
          <a href={SITE} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-xl border border-black/[0.08] bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
            Abrir a loja <ExternalLink size={14} />
          </a>
        </div>
      </div>

      {error && <ErrorBox message={error} />}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Stat label="Vitrines no ar" value={data.vitrines ? `${visibleVitrines} de ${carrosseis.length}` : '—'} hint={personality ? stripEmoji(personality.titulo) : 'AntenorApi sem resposta: a loja usa as vitrines de reserva'} />
        <Stat
          label="Postos no carrinho pela página inicial"
          value={String(homeTotals.adds)}
          hint={
            homeTotals.tracked < homeTotals.adds
              ? `últimos ${days} dias; ${homeTotals.tracked ? `${homeTotals.tracked} com a vitrine anotada` : 'a vitrine de cada um passa a ser anotada a partir de 30/09'}`
              : `últimos ${days} dias`
          }
        />
        <Stat
          label="Viraram pedido"
          value={homeTotals.orders ? `${homeTotals.orders} pedido(s)` : '—'}
          hint={homeTotals.orders ? `${brl(homeTotals.revenue)} nesses produtos, até 24 h depois do clique` : since ? `contando desde ${since}` : 'nenhum no período'}
        />
      </div>

      <ol className="overflow-hidden rounded-2xl border border-black/[0.06] bg-white">
        <Block n={n()} title="Banners do topo" detail={hero.length ? `${hero.length} no ar: ${hero.map(bannerLabel).join(' · ')}` : 'Nenhum banner no ar.'} source="Você cadastra">
          <GoTo onClick={() => onNavigate('storeBanners')}>Editar em Banners</GoTo>
        </Block>

        <Block
          n={n()}
          title="Faixa do dia"
          detail={personality?.bannerPrincipal ? `“${personality.bannerPrincipal.headline}”` : 'Sem faixa hoje.'}
          source="Automática: muda com o dia e a época"
          off={!shown('faixa')}
        >
          <Switch on={shown('faixa')} disabled={busy === 'faixa'} onClick={() => toggle('faixa')} label="Faixa do dia" />
        </Block>

        <Block
          n={n()}
          title="Encartes em destaque"
          detail={data.campaigns.length ? `${data.campaigns.length} encarte(s) vigente(s) do ERP. Ligue para aparecer como vitrine logo aqui.` : 'Nenhum encarte vigente agora. Quando o ERP mandar um, ele aparece aqui para você destacar.'}
          source="Vem do ERP"
        >
          {null}
        </Block>
        {data.campaigns.map((c) => (
          <Sub key={c.id} title={c.name} detail={`${c.items.length} produto(s) · até ${new Date(c.endDate).toLocaleDateString('pt-BR', { timeZone: TZ })}`} result={r(`encarte:${c.id}`)} off={!c.highlightInHome}>
            <Switch on={c.highlightInHome} disabled={busy === `encarte:${c.id}`} onClick={() => toggleCampaign(c.id, !c.highlightInHome)} label={c.name} />
          </Sub>
        ))}

        <Block n={n()} title="Vitrines patrocinadas" detail={data.sponsored.length ? data.sponsored.map((s) => `${s.title} (${s.products.length})`).join(' · ') : 'Nenhuma no ar.'} source="Você cadastra">
          <GoTo onClick={() => onNavigate('sponsoredShelves')}>Editar em Vitrines Patrocinadas</GoTo>
        </Block>
        {data.sponsored.map((s) => r(`patrocinada:${s.id}`) && <Sub key={s.id} title={s.title} detail="" result={r(`patrocinada:${s.id}`)} />)}

        <Block
          n={n()}
          title={personality ? `Vitrines do dia: ${stripEmoji(personality.titulo)}` : 'Vitrines do dia'}
          detail={
            data.vitrines
              ? `${carrosseis.length} vitrine(s) montadas agora pela AntenorApi. Receitas entram depois da 2ª; os banners intercalados (${between.length}), entre as vitrines.`
              : 'A AntenorApi não respondeu. A loja está usando as vitrines de reserva.'
          }
          source="Automáticas"
        >
          {null}
        </Block>
        {carrosseis.map((c, i) => (
          <Sub
            key={c.id}
            title={`${i + 1}. ${stripEmoji(c.titulo)}`}
            detail={`${c.produtos.length} produtos`}
            href={c.linkVerTudo ? `${SITE}${c.linkVerTudo}` : undefined}
            result={r(`vitrine:${c.id}`)}
            off={!shown(`vitrine:${c.id}`)}
          >
            <Switch on={shown(`vitrine:${c.id}`)} disabled={busy === `vitrine:${c.id}`} onClick={() => toggle(`vitrine:${c.id}`)} label={stripEmoji(c.titulo)} />
          </Sub>
        ))}
        {hiddenOffToday.length > 0 && (
          <li className="border-t border-black/[0.05] bg-gray-50/60 px-4 py-2.5 pl-12 text-xs text-gray-500">
            Também ocultas, mas fora do ar hoje:{' '}
            {hiddenOffToday.map((k, i) => (
              <span key={k}>
                {i > 0 && ', '}
                {k.slice('vitrine:'.length)}{' '}
                <button type="button" className="underline" onClick={() => toggle(k)}>
                  mostrar
                </button>
              </span>
            ))}
          </li>
        )}

        <Block n={n()} title="Receitas" detail={`${data.recipes} receita(s) no site; mostra as mais recentes, depois da 2ª vitrine.`} source="Você cadastra" off={!shown('receitas')}>
          <GoTo onClick={() => onNavigate('recipes')}>Receitas</GoTo>
          <Switch on={shown('receitas')} disabled={busy === 'receitas'} onClick={() => toggle('receitas')} label="Receitas" />
        </Block>

        <Block n={n()} title="Banners intercalados" detail={between.length ? `${between.length} no ar, em pares entre as vitrines: ${between.map(bannerLabel).join(' · ')}` : 'Nenhum no ar.'} source="Você cadastra">
          <GoTo onClick={() => onNavigate('storeBanners')}>Editar em Banners</GoTo>
        </Block>

        <Block n={n()} title="Tudo do Mercado" detail="Amostra do catálogo no fim da página, com link para a loja inteira." source="Automático" result={r('tudo')} off={!shown('tudo')}>
          <Switch on={shown('tudo')} disabled={busy === 'tudo'} onClick={() => toggle('tudo')} label="Tudo do Mercado" />
        </Block>

        <Block
          n={n()}
          title="Tarja e pop-up"
          detail={[tarja.length ? `Tarja: ${tarja.map(bannerLabel).join(' · ')}` : 'Sem tarja', popup.length ? `Pop-up: ${popup.map(bannerLabel).join(' · ')}` : 'sem pop-up'].join(' · ')}
          source="Você cadastra"
        >
          <GoTo onClick={() => onNavigate('storeBanners')}>Editar em Banners</GoTo>
        </Block>
      </ol>

      <p className="text-xs text-gray-400">
        A barra de departamentos segue a ordem e os nomes de{' '}
        <button type="button" onClick={() => onNavigate('categories')} className="underline">
          Departamentos
        </button>
        . "Viraram pedido": o mesmo aparelho fechou pedido com o produto em até 24 h depois de pôr no carrinho pela vitrine.
      </p>
    </div>
  )
}

function Block({ n, title, detail, source, off, result, children }: { n: number; title: string; detail: string; source: string; off?: boolean; result?: HomeShelfResult; children: ReactNode }) {
  return (
    <li className="flex flex-col gap-3 border-t border-black/[0.05] px-4 py-4 first:border-t-0 sm:flex-row sm:items-center">
      <span className="flex min-w-0 flex-1 gap-3">
        <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs tabular-nums ${off ? 'bg-gray-100 text-gray-400' : 'bg-gray-900 text-white'}`}>{n}</span>
        <span className="min-w-0">
          <span className={`block text-sm font-medium ${off ? 'text-gray-400 line-through' : 'text-gray-900'}`}>{title}</span>
          <span className="block text-xs text-gray-500">{detail}</span>
          <span className="block text-[11px] uppercase tracking-wide text-gray-400">{source}</span>
        </span>
      </span>
      {result && <ResultLine result={result} />}
      <span className="flex shrink-0 items-center gap-3 pl-9 sm:pl-0">{children}</span>
    </li>
  )
}

function Sub({ title, detail, href, result, off, children }: { title: string; detail: string; href?: string; result?: HomeShelfResult; off?: boolean; children?: ReactNode }) {
  return (
    <li className="flex items-center gap-3 border-t border-black/[0.04] px-4 py-2.5 pl-12">
      <span className="min-w-0 flex-1">
        <span className={`block truncate text-sm ${off ? 'text-gray-400 line-through' : 'text-gray-800'}`}>{title}</span>
        <span className="block text-xs text-gray-500">
          {detail}
          {href && (
            <>
              {detail ? ' · ' : ''}
              <a href={href} target="_blank" rel="noopener noreferrer" className="underline">
                ver no site
              </a>
            </>
          )}
        </span>
        {result && (
          <span className="block text-xs text-gray-600 sm:hidden">
            <ResultText result={result} />
          </span>
        )}
      </span>
      {result && (
        <span className="hidden w-56 shrink-0 text-right text-xs text-gray-600 sm:block">
          <ResultText result={result} />
        </span>
      )}
      {children}
    </li>
  )
}

function ResultLine({ result }: { result: HomeShelfResult }) {
  return (
    <span className="pl-9 text-xs text-gray-600 sm:w-56 sm:pl-0 sm:text-right">
      <ResultText result={result} />
    </span>
  )
}

function ResultText({ result }: { result: HomeShelfResult }) {
  return (
    <span className="tabular-nums">
      {result.adds} no carrinho · {result.orders} pedido(s){result.revenue > 0 ? ` · ${brl(result.revenue)}` : ''}
    </span>
  )
}

function GoTo({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="rounded-lg border border-black/[0.08] px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50">
      {children}
    </button>
  )
}

function Switch({ on, disabled, onClick, label }: { on: boolean; disabled?: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={`${label}: ${on ? 'aparece na página inicial' : 'oculto'}`}
      disabled={disabled}
      onClick={onClick}
      className={`relative h-6 w-10 shrink-0 rounded-full transition-colors disabled:opacity-50 ${on ? 'bg-gray-900' : 'bg-gray-200'}`}
    >
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? 'left-[18px]' : 'left-0.5'}`} />
    </button>
  )
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-2xl border border-black/[0.06] bg-white p-4">
      <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums text-gray-900">{value}</p>
      <p className="mt-0.5 text-xs text-gray-500">{hint}</p>
    </div>
  )
}

function ErrorBox({ message }: { message: string }) {
  return (
    <p role="alert" className="flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">
      <AlertCircle size={16} /> {message}
    </p>
  )
}
