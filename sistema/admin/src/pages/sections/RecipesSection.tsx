import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertCircle, ArrowDown, ArrowUp, ChefHat, ExternalLink, ImageOff, Loader2, Plus, Search, Sparkles, Trash2, UploadCloud, X } from 'lucide-react'
import { WorkspaceDialog } from '../../components/WorkspaceDialog'
import { getApiErrorMessage, productsAPI, recipesAPI, resolveApiUrl, uploadsAPI, type CatalogProduct } from '../../services/api'

// Receitas (refeita em 29/09/2026 com o Jonathan). A tela antiga so tinha
// titulo/descricao/URL da imagem: nao dava para cadastrar ingrediente, modo de
// preparo nem os produtos que o cliente compra com um clique -- por isso
// nunca houve receita publicada. Aqui: editor completo (com colar lista e
// sugestao de produtos pelos ingredientes), agendamento, SEO e categorias.

type Category = { id: string; name: string; slug: string; active: boolean; order: number; _count?: { recipes: number } }
type RecipeRow = {
  id: string
  title: string
  slug: string
  imageUrl?: string | null
  prepTime?: number | null
  active: boolean
  publishedAt?: string | null
  published: boolean
  category?: { name: string } | null
  _count: { ingredients: number; steps: number }
  productCount: number
  unavailableProducts: number
  updatedAt: string
}
type Ingredient = { quantity: string; unit: string; name: string }
type LinkedProduct = { productId: string; note: string; name: string; ean: string; price: number; promo: number | null; available: boolean; hasPhoto?: boolean }
type Status = 'draft' | 'now' | 'schedule'
type Form = {
  id?: string
  title: string
  slug: string
  slugTouched: boolean
  description: string
  imageUrl: string
  prepTime: string
  servings: string
  difficulty: string
  categoryId: string
  status: Status
  scheduleAt: string
  publishedAt: string | null
  seoTitle: string
  seoDescription: string
  ingredients: Ingredient[]
  steps: string[]
  products: LinkedProduct[]
  relatedIds: string[]
}

const SITE = 'https://mercado.antenorefilhos.com.br'
const DIFFICULTY: Array<[string, string]> = [
  ['EASY', 'Fácil'],
  ['MEDIUM', 'Médio'],
  ['HARD', 'Difícil'],
]
const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const slugify = (v: string) =>
  v.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/&/g, ' e ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
const localInput = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)

const EMPTY: Form = {
  title: '',
  slug: '',
  slugTouched: false,
  description: '',
  imageUrl: '',
  prepTime: '',
  servings: '',
  difficulty: '',
  categoryId: '',
  status: 'draft',
  scheduleAt: '',
  publishedAt: null,
  seoTitle: '',
  seoDescription: '',
  ingredients: [{ quantity: '', unit: '', name: '' }],
  steps: [''],
  products: [],
  relatedIds: [],
}

/** "500 g de farinha de trigo" -> { 500, g, farinha de trigo }. O que nao casar vai inteiro no nome. */
const UNITS = 'kg|g|mg|ml|l|litros?|x[ií]caras?(?: \\(ch[aá]\\))?|colher(?:es)?(?: de (?:sopa|ch[aá]|caf[eé]))?|unidades?|un|dentes?|fatias?|latas?|pacotes?|ma[cç]os?|pitadas?|copos?|folhas?|ramos?'
const LINE = new RegExp(`^([\\d.,/½¼¾⅓⅔]+(?:\\s*a\\s*[\\d.,/]+)?)\\s*(${UNITS})?\\.?\\s*(?:de\\s+)?(.+)$`, 'i')
function parseIngredient(raw: string): Ingredient {
  const line = raw.replace(/^[-•*\d]+[.)]\s+(?=\D)/, '').trim()
  const m = line.match(LINE)
  return m ? { quantity: m[1], unit: m[2] || '', name: m[3].trim() } : { quantity: '', unit: '', name: line }
}

function statusOf(r: { active: boolean; publishedAt?: string | null }): 'draft' | 'scheduled' | 'published' {
  if (!r.active) return 'draft'
  if (r.publishedAt && new Date(r.publishedAt).getTime() > Date.now()) return 'scheduled'
  return 'published'
}

function StatusLabel({ r }: { r: { active: boolean; publishedAt?: string | null } }) {
  const s = statusOf(r)
  const dot = { draft: 'bg-gray-300', scheduled: 'bg-amber-500', published: 'bg-emerald-600' }[s]
  const text =
    s === 'draft'
      ? 'Rascunho'
      : s === 'scheduled'
        ? `Agendada · ${new Date(r.publishedAt!).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}`
        : 'Publicada'
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-gray-600">
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      {text}
    </span>
  )
}

export default function RecipesSection() {
  const [rows, setRows] = useState<RecipeRow[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState<'all' | 'published' | 'scheduled' | 'draft'>('all')
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<Form | null>(null)
  const [opening, setOpening] = useState<string | null>(null)
  const [showCategories, setShowCategories] = useState(false)

  const load = useCallback(async () => {
    try {
      const [r, c] = await Promise.all([recipesAPI.list(1, 500), recipesAPI.listCategories()])
      setRows(r.data.data)
      setCategories(c.data)
      setError('')
    } catch (e) {
      setError(getApiErrorMessage(e, 'Não foi possível carregar as receitas.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const counts = useMemo(() => {
    const c = { all: rows.length, published: 0, scheduled: 0, draft: 0 }
    rows.forEach((r) => (c[statusOf(r)] += 1))
    return c
  }, [rows])

  const list = useMemo(() => {
    const q = slugify(search)
    return rows.filter((r) => (filter === 'all' || statusOf(r) === filter) && (!q || slugify(r.title).includes(q)))
  }, [rows, filter, search])

  const openEdit = async (r: RecipeRow) => {
    setOpening(r.id)
    try {
      const { data } = await recipesAPI.getById(r.slug)
      const st = statusOf(data)
      setEditing({
        id: data.id,
        title: data.title,
        slug: data.slug,
        slugTouched: true,
        description: data.description || '',
        imageUrl: data.imageUrl || '',
        prepTime: data.prepTime != null ? String(data.prepTime) : '',
        servings: data.servings != null ? String(data.servings) : '',
        difficulty: data.difficulty || '',
        categoryId: data.categoryId || '',
        status: st === 'draft' ? 'draft' : st === 'scheduled' ? 'schedule' : 'now',
        scheduleAt: data.publishedAt ? localInput(new Date(data.publishedAt)) : '',
        publishedAt: data.publishedAt || null,
        seoTitle: data.seoTitle || '',
        seoDescription: data.seoDescription || '',
        ingredients: data.ingredients.length
          ? data.ingredients.map((i: any) => ({ quantity: i.quantity || '', unit: i.unit || '', name: i.name }))
          : [{ quantity: '', unit: '', name: '' }],
        steps: data.steps.length ? data.steps.map((s: any) => s.content) : [''],
        products: data.products.map((rp: any) => ({
          productId: rp.productId,
          note: rp.note || '',
          name: rp.product.titleMask || rp.product.name,
          ean: rp.product.ean,
          price: rp.product.price,
          promo: rp.product.promotionalPrice && rp.product.promotionalPrice < rp.product.price ? rp.product.promotionalPrice : null,
          available: rp.available !== false,
        })),
        relatedIds: data.relatedTo.map((rel: any) => rel.relatedRecipeId ?? rel.relatedRecipe?.id).filter(Boolean),
      })
    } catch (e) {
      setError(getApiErrorMessage(e, 'Não foi possível abrir a receita.'))
    } finally {
      setOpening(null)
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <div className="flex w-max gap-1 rounded-2xl border border-black/[0.06] bg-white p-1">
            {(
              [
                ['all', 'Todas'],
                ['published', 'Publicadas'],
                ['scheduled', 'Agendadas'],
                ['draft', 'Rascunhos'],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => setFilter(k)}
                className={`whitespace-nowrap rounded-xl px-3 py-1.5 text-sm ${filter === k ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
              >
                {label}
                <span className={`ml-1.5 tabular-nums ${filter === k ? 'text-white/60' : 'text-gray-400'}`}>{counts[k]}</span>
              </button>
            ))}
          </div>
        </div>
        <label className="relative min-w-[180px] flex-1">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar receita" className="h-10 w-full rounded-xl border border-black/[0.06] bg-white pl-9 pr-3 text-sm outline-none focus:border-gray-400" />
        </label>
        <button type="button" onClick={() => setShowCategories(true)} className="h-10 rounded-xl border border-black/[0.06] bg-white px-3 text-sm text-gray-700 hover:bg-gray-50">
          Categorias
        </button>
        <button type="button" onClick={() => setEditing({ ...EMPTY })} className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-gray-900 px-3.5 text-sm text-white hover:bg-gray-800">
          <Plus size={15} /> Nova receita
        </button>
      </div>

      {error && (
        <p role="alert" className="flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">
          <AlertCircle size={16} /> {error}
        </p>
      )}

      {loading ? (
        <div className="h-64 animate-pulse rounded-2xl bg-white/70" />
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-black/[0.06] bg-white p-8 text-center">
          <ChefHat size={32} className="mx-auto text-gray-300" />
          <p className="mt-3 text-sm text-gray-900">Nenhuma receita ainda.</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-gray-500">
            Cada receita mostra os ingredientes à venda na loja com um botão "Adicionar todos ao carrinho". O link "Receitas" do site só aparece quando houver
            pelo menos uma publicada.
          </p>
          <button type="button" onClick={() => setEditing({ ...EMPTY })} className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-gray-900 px-3.5 py-2 text-sm text-white">
            <Plus size={15} /> Criar a primeira
          </button>
        </div>
      ) : list.length === 0 ? (
        <p className="rounded-2xl border border-black/[0.06] bg-white p-8 text-center text-sm text-gray-400">Nenhuma receita aqui.</p>
      ) : (
        <ul className="divide-y divide-black/[0.05] overflow-hidden rounded-2xl border border-black/[0.06] bg-white">
          {list.map((r) => (
            <li key={r.id}>
              <button type="button" onClick={() => openEdit(r)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-gray-50/70">
                <span className="flex h-14 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gray-50">
                  {r.imageUrl ? <img src={resolveApiUrl(r.imageUrl)} alt="" className="h-full w-full object-cover" /> : <ImageOff size={18} className="text-gray-300" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-gray-900">{r.title}</span>
                  <span className="block truncate text-xs text-gray-500">
                    {[r.category?.name, r.prepTime ? `${r.prepTime} min` : null, `${r._count.ingredients} ingredientes`, `${r.productCount} produtos à venda`].filter(Boolean).join(' · ')}
                  </span>
                  <span className="mt-0.5 flex flex-wrap items-center gap-x-3">
                    <StatusLabel r={r} />
                    {r.unavailableProducts > 0 && (
                      <span className="inline-flex items-center gap-1.5 text-xs text-gray-600">
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                        {r.unavailableProducts} {r.unavailableProducts === 1 ? 'produto fora' : 'produtos fora'} do site
                      </span>
                    )}
                    {(r._count.steps === 0 || r._count.ingredients === 0) && <span className="text-xs text-gray-400">incompleta</span>}
                  </span>
                </span>
                {opening === r.id && <Loader2 size={16} className="animate-spin text-gray-400" />}
              </button>
            </li>
          ))}
        </ul>
      )}

      {editing && (
        <RecipeEditor
          initial={editing}
          categories={categories}
          recipes={rows}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            load()
          }}
        />
      )}
      {showCategories && (
        <CategoriesDialog
          categories={categories}
          onClose={() => setShowCategories(false)}
          onChanged={load}
        />
      )}
    </div>
  )
}

// ─── Editor ────────────────────────────────────────────────────────────────

function Section({ title, hint, children, action }: { title: string; hint?: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section>
      <div className="flex items-end justify-between gap-2">
        <div>
          <h4 className="text-[11px] font-medium uppercase tracking-wide text-gray-500">{title}</h4>
          {hint && <p className="mt-0.5 text-xs text-gray-400">{hint}</p>}
        </div>
        {action}
      </div>
      <div className="mt-2">{children}</div>
    </section>
  )
}

const inputCls = 'h-10 w-full rounded-xl border border-black/[0.08] bg-white px-3 text-sm text-gray-900 placeholder:text-gray-400'

function move<T>(list: T[], i: number, d: number) {
  const j = i + d
  if (j < 0 || j >= list.length) return list
  const next = [...list]
  ;[next[i], next[j]] = [next[j], next[i]]
  return next
}

function RowTools({ i, n, onMove, onRemove }: { i: number; n: number; onMove: (d: number) => void; onRemove: () => void }) {
  return (
    <span className="flex shrink-0 items-center">
      <button type="button" aria-label="Subir" disabled={i === 0} onClick={() => onMove(-1)} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 disabled:opacity-25">
        <ArrowUp size={14} />
      </button>
      <button type="button" aria-label="Descer" disabled={i === n - 1} onClick={() => onMove(1)} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 disabled:opacity-25">
        <ArrowDown size={14} />
      </button>
      <button type="button" aria-label="Remover" onClick={onRemove} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-rose-700">
        <X size={14} />
      </button>
    </span>
  )
}

function RecipeEditor({
  initial,
  categories,
  recipes,
  onClose,
  onSaved,
}: {
  initial: Form
  categories: Category[]
  recipes: RecipeRow[]
  onClose: () => void
  onSaved: () => void
}) {
  const [f, setF] = useState<Form>(initial)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [uploading, setUploading] = useState(false)
  const [pasting, setPasting] = useState<'ingredients' | 'steps' | null>(null)
  const [pasteText, setPasteText] = useState('')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<CatalogProduct[]>([])
  const [suggestions, setSuggestions] = useState<Array<{ ingredient: string; product: CatalogProduct; accept: boolean }> | null>(null)
  const [suggesting, setSuggesting] = useState(false)
  const set = (patch: Partial<Form>) => setF((prev) => ({ ...prev, ...patch }))
  const isNew = !f.id

  // Busca de produto (so o que esta no site: e o que o cliente consegue comprar).
  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) {
      setResults([])
      return
    }
    const t = setTimeout(async () => {
      try {
        const r = await productsAPI.catalog({ tab: 'site', search: q, limit: 8 })
        setResults(r.data.data)
      } catch {
        setResults([])
      }
    }, 250)
    return () => clearTimeout(t)
  }, [query])

  const toLinked = (p: CatalogProduct): LinkedProduct => ({
    productId: p.id,
    note: '',
    name: p.displayName,
    ean: p.ean,
    price: p.price,
    promo: p.onPromo ? p.promotionalPrice : null,
    available: p.status === 'ON',
    hasPhoto: p.hasPhoto,
  })

  const addProduct = (p: CatalogProduct) => {
    if (!f.products.some((x) => x.productId === p.id)) set({ products: [...f.products, toLinked(p)] })
    setQuery('')
    setResults([])
  }

  const suggest = async () => {
    const names = f.ingredients.map((i) => i.name.trim()).filter(Boolean)
    if (!names.length) return
    setSuggesting(true)
    try {
      const found = await Promise.all(
        names.map(async (name) => {
          const term = name.replace(/\b(a gosto|picad[oa]s?|ralad[oa]s?|fresc[oa]s?|maduros?|m[ée]dios?|grandes?|pequen[oa]s?)\b/gi, '').trim()
          const r = await productsAPI.catalog({ tab: 'site', search: term || name, limit: 1 })
          const product = r.data.data[0]
          return product ? { ingredient: name, product, accept: true } : null
        }),
      )
      setSuggestions(found.filter((x): x is NonNullable<typeof x> => Boolean(x) && !f.products.some((p) => p.productId === x!.product.id)))
    } finally {
      setSuggesting(false)
    }
  }

  const upload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setUploading(true)
    setError('')
    try {
      const r = await uploadsAPI.upload(file, 'recipe')
      set({ imageUrl: r.data.url })
    } catch (err) {
      setError(getApiErrorMessage(err, 'Não foi possível enviar a foto.'))
    } finally {
      setUploading(false)
    }
  }

  const applyPaste = () => {
    const lines = pasteText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
    if (pasting === 'ingredients') {
      const kept = f.ingredients.filter((i) => i.name.trim())
      set({ ingredients: [...kept, ...lines.map(parseIngredient)] })
    } else if (pasting === 'steps') {
      const kept = f.steps.filter((s) => s.trim())
      set({ steps: [...kept, ...lines.map((l) => l.replace(/^(passo\s*)?\d+[.)\-:]\s*/i, ''))] })
    }
    setPasting(null)
    setPasteText('')
  }

  const ingredients = f.ingredients.filter((i) => i.name.trim())
  const steps = f.steps.map((s) => s.trim()).filter(Boolean)
  const missing = [
    !f.title.trim() && 'título',
    f.status !== 'draft' && !f.imageUrl && 'foto',
    f.status !== 'draft' && !ingredients.length && 'ingredientes',
    f.status !== 'draft' && !steps.length && 'modo de preparo',
    f.status === 'schedule' && !f.scheduleAt && 'data da publicação',
  ].filter(Boolean) as string[]

  const save = async () => {
    if (missing.length) return
    setSaving(true)
    setError('')
    const publishedAt =
      f.status === 'draft'
        ? f.publishedAt
        : f.status === 'schedule'
          ? new Date(f.scheduleAt).toISOString()
          : f.publishedAt && new Date(f.publishedAt).getTime() <= Date.now()
            ? f.publishedAt
            : new Date().toISOString()
    const payload = {
      title: f.title.trim(),
      slug: (f.slug.trim() || slugify(f.title)).slice(0, 80),
      description: f.description.trim() || null,
      imageUrl: f.imageUrl || null,
      prepTime: f.prepTime ? Number(f.prepTime) : null,
      servings: f.servings ? Number(f.servings) : null,
      difficulty: f.difficulty || null,
      categoryId: f.categoryId || null,
      active: f.status !== 'draft',
      publishedAt,
      seoTitle: f.seoTitle.trim() || null,
      seoDescription: f.seoDescription.trim() || null,
      ingredients: ingredients.map((i) => ({ name: i.name.trim(), quantity: i.quantity.trim() || undefined, unit: i.unit.trim() || undefined })),
      steps: steps.map((content) => ({ content })),
      products: f.products.map((p) => ({ productId: p.productId, note: p.note.trim() || undefined })),
      relatedIds: f.relatedIds,
    }
    try {
      if (f.id) await recipesAPI.update(f.id, payload)
      else await recipesAPI.create(payload)
      onSaved()
    } catch (e) {
      setError(getApiErrorMessage(e, 'Não foi possível salvar a receita.'))
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    if (!f.id || !window.confirm(`Excluir "${f.title}"? A página da receita sai do site. Não dá para desfazer.`)) return
    setSaving(true)
    try {
      await recipesAPI.remove(f.id)
      onSaved()
    } catch (e) {
      setError(getApiErrorMessage(e, 'Não foi possível excluir.'))
      setSaving(false)
    }
  }

  const seoTitle = f.seoTitle || f.title
  const seoDesc = f.seoDescription || f.description || `Receita de ${f.title || '...'} com ingredientes do Mercado Antenor & Filhos.`
  const livePublished = statusOf({ active: initial.status !== 'draft', publishedAt: initial.publishedAt }) === 'published' && !isNew

  return (
    <>
    <WorkspaceDialog
      label={f.title || 'Nova receita'}
      onClose={onClose}
      closeOnEsc={!pasting}
      title={
        <>
          <h3 className="truncate text-base font-semibold text-gray-900">{f.title || 'Nova receita'}</h3>
          <p className="mt-0.5 truncate text-xs text-gray-400">
            {SITE.replace('https://', '')}/receitas/{f.slug || slugify(f.title) || '...'}
          </p>
        </>
      }
      actions={
        livePublished ? (
          <a href={`${SITE}/receitas/${f.slug}`} target="_blank" rel="noreferrer" className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1.5 text-xs text-gray-700 hover:bg-gray-100">
            <ExternalLink size={13} /> Ver no site
          </a>
        ) : undefined
      }
      footer={
        <div className="space-y-2 sm:flex sm:items-center sm:gap-3 sm:space-y-0">
          <div className="grid grid-cols-3 gap-1 rounded-xl bg-gray-100 p-1 sm:w-[380px] sm:shrink-0">
            {(
              [
                ['draft', 'Rascunho'],
                ['now', livePublished ? 'Publicada' : 'Publicar agora'],
                ['schedule', 'Agendar'],
              ] as Array<[Status, string]>
            ).map(([v, label]) => (
              <button key={v} type="button" onClick={() => set({ status: v })} className={`rounded-lg px-2 py-1.5 text-sm ${f.status === v ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600'}`}>
                {label}
              </button>
            ))}
          </div>
          {f.status === 'schedule' && (
            <input type="datetime-local" value={f.scheduleAt} min={localInput(new Date())} onChange={(e) => set({ scheduleAt: e.target.value })} className={`${inputCls} sm:w-56 sm:shrink-0`} />
          )}
          <div className="min-w-0 flex-1 text-xs">
            {error && <p className="text-rose-700">{error}</p>}
            {missing.length > 0 && <p className="text-gray-500">Falta: {missing.join(', ')}.</p>}
          </div>
          <div className="flex items-center gap-2">
            {!isNew && (
              <button type="button" onClick={remove} disabled={saving} aria-label="Excluir receita" className="rounded-xl p-2 text-gray-400 hover:bg-gray-100 hover:text-rose-700">
                <Trash2 size={16} />
              </button>
            )}
            <button type="button" onClick={onClose} className="ml-auto rounded-xl px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
              Cancelar
            </button>
            <button type="button" onClick={save} disabled={saving || missing.length > 0} className="rounded-xl bg-gray-900 px-5 py-2 text-sm text-white disabled:opacity-40">
              {saving ? 'Salvando…' : f.status === 'draft' ? 'Salvar rascunho' : f.status === 'schedule' ? 'Agendar' : 'Publicar'}
            </button>
          </div>
        </div>
      }
    >
      {/* Computador: a receita a esquerda; o que vende e o Google a direita. Celular: uma coluna. */}
      <div className="grid gap-8 px-4 py-5 sm:px-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:gap-10">
        <div className="space-y-8">
          <Section title="Receita">
            <div className="space-y-3">
              <input
                value={f.title}
                onChange={(e) => set({ title: e.target.value, ...(f.slugTouched ? {} : { slug: slugify(e.target.value) }) })}
                placeholder="Título, ex.: Picanha na brasa com farofa"
                className={`${inputCls} text-base`}
              />
              <textarea
                value={f.description}
                onChange={(e) => set({ description: e.target.value })}
                rows={3}
                placeholder="Uma ou duas frases que dão vontade de fazer. Aparece no topo da receita e no Google."
                className="w-full rounded-xl border border-black/[0.08] px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400"
              />
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <label className="block text-xs text-gray-500">
                  Tempo (min)
                  <input inputMode="numeric" value={f.prepTime} onChange={(e) => set({ prepTime: e.target.value.replace(/\D/g, '') })} className={`${inputCls} mt-1`} />
                </label>
                <label className="block text-xs text-gray-500">
                  Porções
                  <input inputMode="numeric" value={f.servings} onChange={(e) => set({ servings: e.target.value.replace(/\D/g, '') })} className={`${inputCls} mt-1`} />
                </label>
                <label className="col-span-2 block text-xs text-gray-500">
                  Categoria
                  <select value={f.categoryId} onChange={(e) => set({ categoryId: e.target.value })} className={`${inputCls} mt-1`}>
                    <option value="">Sem categoria</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div>
                <span className="text-xs text-gray-500">Dificuldade</span>
                <div className="mt-1 grid grid-cols-4 gap-1 rounded-xl bg-gray-100 p-1">
                  {[['', 'Não informar'], ...DIFFICULTY].map(([v, label]) => (
                    <button key={v} type="button" onClick={() => set({ difficulty: v })} className={`rounded-lg px-2 py-1.5 text-sm ${f.difficulty === v ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600'}`}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </Section>

          <Section title="Foto" hint="Pode enviar a foto como estiver: ela é recortada em formato horizontal (16:9) e comprimida sozinha. Aparece no topo da receita e no compartilhamento.">
            <div className="relative flex aspect-video items-center justify-center overflow-hidden rounded-xl border border-black/[0.06] bg-gray-50">
              {f.imageUrl ? <img src={resolveApiUrl(f.imageUrl)} alt="" className="h-full w-full object-cover" /> : <ImageOff size={28} className="text-gray-300" />}
              {uploading && (
                <span className="absolute inset-0 flex items-center justify-center bg-white/70">
                  <Loader2 size={20} className="animate-spin text-gray-600" />
                </span>
              )}
            </div>
            <div className="mt-2 flex gap-2 text-sm">
              <label className={`inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-black/[0.08] px-3 py-1.5 text-gray-800 hover:bg-gray-50 ${uploading ? 'pointer-events-none opacity-40' : ''}`}>
                <UploadCloud size={15} /> {f.imageUrl ? 'Trocar foto' : 'Enviar foto'}
                <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={upload} />
              </label>
              {f.imageUrl && (
                <button type="button" onClick={() => set({ imageUrl: '' })} className="rounded-xl px-3 py-1.5 text-gray-600 hover:bg-gray-100">
                  Remover
                </button>
              )}
            </div>
          </Section>

          <Section
            title={`Ingredientes · ${ingredients.length}`}
            hint="Quantidade, medida e o ingrediente."
            action={
              <button type="button" onClick={() => setPasting('ingredients')} className="text-xs text-gray-700 underline-offset-2 hover:underline">
                Colar lista
              </button>
            }
          >
            <ul className="space-y-2">
              {f.ingredients.map((ing, i) => (
                <li key={i} className="flex items-center gap-2">
                  <input value={ing.quantity} onChange={(e) => set({ ingredients: f.ingredients.map((x, k) => (k === i ? { ...x, quantity: e.target.value } : x)) })} placeholder="500" className={`${inputCls} w-16 shrink-0 px-2`} />
                  <input value={ing.unit} onChange={(e) => set({ ingredients: f.ingredients.map((x, k) => (k === i ? { ...x, unit: e.target.value } : x)) })} placeholder="g" className={`${inputCls} w-20 shrink-0 px-2`} />
                  <input value={ing.name} onChange={(e) => set({ ingredients: f.ingredients.map((x, k) => (k === i ? { ...x, name: e.target.value } : x)) })} placeholder="farinha de trigo" className={`${inputCls} min-w-0 flex-1`} />
                  <RowTools
                    i={i}
                    n={f.ingredients.length}
                    onMove={(d) => set({ ingredients: move(f.ingredients, i, d) })}
                    onRemove={() => set({ ingredients: f.ingredients.length > 1 ? f.ingredients.filter((_, k) => k !== i) : [{ quantity: '', unit: '', name: '' }] })}
                  />
                </li>
              ))}
            </ul>
            <button type="button" onClick={() => set({ ingredients: [...f.ingredients, { quantity: '', unit: '', name: '' }] })} className="mt-2 inline-flex items-center gap-1 text-sm text-gray-700 hover:underline">
              <Plus size={14} /> Ingrediente
            </button>
          </Section>

          <Section
            title={`Modo de preparo · ${steps.length} passos`}
            action={
              <button type="button" onClick={() => setPasting('steps')} className="text-xs text-gray-700 underline-offset-2 hover:underline">
                Colar texto
              </button>
            }
          >
            <ol className="space-y-2">
              {f.steps.map((s, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="mt-2 w-5 shrink-0 text-right text-sm tabular-nums text-gray-400">{i + 1}.</span>
                  <textarea
                    value={s}
                    onChange={(e) => set({ steps: f.steps.map((x, k) => (k === i ? e.target.value : x)) })}
                    rows={2}
                    placeholder="Descreva o passo"
                    className="min-w-0 flex-1 rounded-xl border border-black/[0.08] px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400"
                  />
                  <RowTools i={i} n={f.steps.length} onMove={(d) => set({ steps: move(f.steps, i, d) })} onRemove={() => set({ steps: f.steps.length > 1 ? f.steps.filter((_, k) => k !== i) : [''] })} />
                </li>
              ))}
            </ol>
            <button type="button" onClick={() => set({ steps: [...f.steps, ''] })} className="mt-2 inline-flex items-center gap-1 text-sm text-gray-700 hover:underline">
              <Plus size={14} /> Passo
            </button>
          </Section>
        </div>

        <div className="space-y-8">
          <Section
            title={`Produtos para comprar · ${f.products.length}`}
            hint="O cliente adiciona ao carrinho com um clique. Produto que sair do site some da receita sozinho e volta quando voltar."
            action={
              <button type="button" onClick={suggest} disabled={suggesting || !ingredients.length} className="inline-flex items-center gap-1 text-xs text-gray-700 underline-offset-2 hover:underline disabled:opacity-40">
                {suggesting ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />} Sugerir pelos ingredientes
              </button>
            }
          >
            {suggestions && (
              <div className="mb-3 rounded-xl border border-black/[0.08] p-3">
                {suggestions.length === 0 ? (
                  <p className="text-sm text-gray-500">Nenhuma sugestão nova: os ingredientes não acharam produto no site ou já estão na lista.</p>
                ) : (
                  <>
                    <p className="text-xs text-gray-500">Confira: a sugestão é pelo nome, então vale olhar cada uma.</p>
                    <ul className="mt-2 space-y-1.5">
                      {suggestions.map((s, i) => (
                        <li key={s.product.id}>
                          <label className="flex items-center gap-2 text-sm">
                            <input type="checkbox" checked={s.accept} onChange={(e) => setSuggestions(suggestions.map((x, k) => (k === i ? { ...x, accept: e.target.checked } : x)))} />
                            <span className="w-28 shrink-0 truncate text-gray-500">{s.ingredient}</span>
                            <span className="min-w-0 flex-1 truncate text-gray-900">{s.product.displayName}</span>
                            <span className="shrink-0 tabular-nums text-gray-500">{brl(s.product.onPromo && s.product.promotionalPrice ? s.product.promotionalPrice : s.product.price)}</span>
                          </label>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
                <div className="mt-3 flex justify-end gap-2">
                  <button type="button" onClick={() => setSuggestions(null)} className="rounded-lg px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100">
                    Fechar
                  </button>
                  {suggestions.some((s) => s.accept) && (
                    <button
                      type="button"
                      onClick={() => {
                        set({ products: [...f.products, ...suggestions.filter((s) => s.accept).map((s) => toLinked(s.product))] })
                        setSuggestions(null)
                      }}
                      className="rounded-lg bg-gray-900 px-3 py-1.5 text-sm text-white"
                    >
                      Adicionar {suggestions.filter((s) => s.accept).length}
                    </button>
                  )}
                </div>
              </div>
            )}

            <div className="relative">
              <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar produto da loja para adicionar" className={`${inputCls} pl-9`} />
              {results.length > 0 && (
                <ul className="absolute left-0 right-0 top-11 z-10 max-h-72 overflow-y-auto rounded-xl border border-black/[0.08] bg-white shadow-lg">
                  {results.map((p) => (
                    <li key={p.id}>
                      <button type="button" onClick={() => addProduct(p)} className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-gray-50">
                        <ProductThumb ean={p.ean} hasPhoto={p.hasPhoto} />
                        <span className="min-w-0 flex-1 truncate text-sm text-gray-900">{p.displayName}</span>
                        <span className="shrink-0 text-sm tabular-nums text-gray-600">{brl(p.onPromo && p.promotionalPrice ? p.promotionalPrice : p.price)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {f.products.length > 0 && (
              <ul className="mt-2 divide-y divide-black/[0.05] rounded-xl border border-black/[0.06]">
                {f.products.map((p, i) => (
                  <li key={p.productId} className="flex items-center gap-3 px-3 py-2">
                    <ProductThumb ean={p.ean} hasPhoto={p.hasPhoto ?? true} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-gray-900">{p.name}</span>
                      <input
                        value={p.note}
                        onChange={(e) => set({ products: f.products.map((x, k) => (k === i ? { ...x, note: e.target.value } : x)) })}
                        placeholder="Observação (opcional), ex.: para a farofa"
                        className="mt-0.5 w-full border-0 bg-transparent p-0 text-xs text-gray-500 placeholder:text-gray-300 focus:outline-none"
                      />
                    </span>
                    <span className="shrink-0 text-right text-xs">
                      <span className="block tabular-nums text-gray-700">{brl(p.promo ?? p.price)}</span>
                      {!p.available && (
                        <span className="inline-flex items-center gap-1 text-gray-500">
                          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> fora do site
                        </span>
                      )}
                    </span>
                    <RowTools i={i} n={f.products.length} onMove={(d) => set({ products: move(f.products, i, d) })} onRemove={() => set({ products: f.products.filter((_, k) => k !== i) })} />
                  </li>
                ))}
              </ul>
            )}
          </Section>

          {recipes.filter((r) => r.id !== f.id).length > 0 && (
            <Section title="Receitas relacionadas" hint="Aparecem no fim da receita. Só as publicadas são mostradas.">
              <div className="flex flex-wrap gap-2">
                {recipes
                  .filter((r) => r.id !== f.id)
                  .map((r) => {
                    const on = f.relatedIds.includes(r.id)
                    return (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => set({ relatedIds: on ? f.relatedIds.filter((x) => x !== r.id) : [...f.relatedIds, r.id] })}
                        className={`rounded-full border px-3 py-1 text-sm ${on ? 'border-gray-900 bg-gray-900 text-white' : 'border-black/[0.08] text-gray-700 hover:bg-gray-50'}`}
                      >
                        {r.title}
                      </button>
                    )
                  })}
              </div>
            </Section>
          )}

          <Section title="No Google" hint="Opcional. Vazio usa o título e a descrição.">
            <div className="rounded-xl border border-black/[0.06] p-3">
              <p className="truncate text-xs text-gray-500">{SITE.replace('https://', '')} › receitas</p>
              <p className="truncate text-base text-[#1a0dab]">{seoTitle.slice(0, 60) || 'Título da receita'}</p>
              <p className="line-clamp-2 text-sm text-gray-600">{seoDesc.slice(0, 160)}</p>
            </div>
            <div className="mt-3 space-y-3">
              <label className="block text-xs text-gray-500">
                Título no Google <span className={f.seoTitle.length > 60 ? 'text-amber-600' : ''}>{f.seoTitle.length}/60</span>
                <input value={f.seoTitle} onChange={(e) => set({ seoTitle: e.target.value })} placeholder={f.title} className={`${inputCls} mt-1`} />
              </label>
              <label className="block text-xs text-gray-500">
                Descrição no Google <span className={f.seoDescription.length > 160 ? 'text-amber-600' : ''}>{f.seoDescription.length}/160</span>
                <textarea value={f.seoDescription} onChange={(e) => set({ seoDescription: e.target.value })} rows={2} className="mt-1 w-full rounded-xl border border-black/[0.08] px-3 py-2 text-sm text-gray-900" />
              </label>
              <label className="block text-xs text-gray-500">
                Endereço da página
                <span className="mt-1 flex items-center rounded-xl border border-black/[0.08] pl-3 text-sm">
                  <span className="shrink-0 text-gray-400">/receitas/</span>
                  <input
                    value={f.slug}
                    onChange={(e) => set({ slug: slugify(e.target.value), slugTouched: true })}
                    className="h-10 min-w-0 flex-1 rounded-r-xl border-0 bg-transparent px-1 text-gray-900 focus:outline-none"
                  />
                </span>
                {!isNew && livePublished && f.slug !== initial.slug && <span className="mt-1 block text-amber-700">Mudar o endereço quebra links já compartilhados desta receita.</span>}
              </label>
            </div>
          </Section>
        </div>
      </div>
    </WorkspaceDialog>

      {pasting && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/30 sm:items-center sm:p-4" onClick={(e) => (e.stopPropagation(), setPasting(null))}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-lg rounded-t-2xl bg-white p-5 sm:rounded-2xl">
            <h3 className="text-base font-semibold text-gray-900">{pasting === 'ingredients' ? 'Colar ingredientes' : 'Colar modo de preparo'}</h3>
            <p className="mt-1 text-xs text-gray-500">
              {pasting === 'ingredients' ? 'Um ingrediente por linha, ex.: "500 g de farinha de trigo". Quantidade e medida são separadas sozinhas.' : 'Um passo por linha. A numeração é tirada sozinha.'}
            </p>
            <textarea autoFocus value={pasteText} onChange={(e) => setPasteText(e.target.value)} rows={10} className="mt-3 w-full rounded-xl border border-black/[0.08] px-3 py-2 text-sm text-gray-900" />
            <div className="mt-3 flex justify-end gap-2">
              <button type="button" onClick={() => setPasting(null)} className="rounded-xl px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                Cancelar
              </button>
              <button type="button" onClick={applyPaste} disabled={!pasteText.trim()} className="rounded-xl bg-gray-900 px-4 py-2 text-sm text-white disabled:opacity-40">
                Adicionar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function ProductThumb({ ean, hasPhoto }: { ean: string; hasPhoto: boolean }) {
  const [failed, setFailed] = useState(false)
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gray-50">
      {hasPhoto && !failed ? (
        <img src={resolveApiUrl(`/thumbs/products/${ean}.webp`)} alt="" loading="lazy" className="h-full w-full object-contain" onError={() => setFailed(true)} />
      ) : (
        <ImageOff size={14} className="text-gray-300" />
      )}
    </span>
  )
}

// ─── Categorias de receita ────────────────────────────────────────────────

function CategoriesDialog({ categories, onClose, onChanged }: { categories: Category[]; onClose: () => void; onChanged: () => void }) {
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null)

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true)
    setError('')
    try {
      await fn()
      await onChanged()
    } catch (e) {
      setError(getApiErrorMessage(e, 'Não foi possível salvar.'))
    } finally {
      setBusy(false)
    }
  }

  const sorted = [...categories].sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, 'pt-BR'))
  const reorder = (i: number, d: number) => {
    const next = move(sorted, i, d)
    run(() => Promise.all(next.map((c, k) => (c.order !== k ? recipesAPI.updateCategory(c.id, { order: k }) : null))))
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/30 sm:items-center sm:p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white p-5 sm:rounded-2xl">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-gray-900">Categorias de receita</h3>
          <button type="button" onClick={onClose} aria-label="Fechar" className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100">
            <X size={18} />
          </button>
        </div>
        <p className="mt-1 text-xs text-gray-500">Viram filtros na página de receitas do site. Só aparecem as que têm receita publicada.</p>

        <form
          className="mt-4 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            const n = name.trim()
            if (!n) return
            run(() => recipesAPI.createCategory({ name: n, slug: slugify(n), order: categories.length })).then(() => setName(''))
          }}
        >
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nova categoria, ex.: Churrasco" className={inputCls} />
          <button type="submit" disabled={busy || !name.trim()} className="shrink-0 rounded-xl bg-gray-900 px-3 text-sm text-white disabled:opacity-40">
            Adicionar
          </button>
        </form>
        {error && <p className="mt-2 text-xs text-rose-700">{error}</p>}

        <ul className="mt-3 divide-y divide-black/[0.05]">
          {sorted.map((c, i) => (
            <li key={c.id} className="flex items-center gap-2 py-2">
              {editing?.id === c.id ? (
                <form
                  className="flex min-w-0 flex-1 gap-1"
                  onSubmit={(e) => {
                    e.preventDefault()
                    const n = editing.name.trim()
                    if (n) run(() => recipesAPI.updateCategory(c.id, { name: n, slug: slugify(n) })).then(() => setEditing(null))
                  }}
                >
                  <input autoFocus value={editing.name} onChange={(e) => setEditing({ id: c.id, name: e.target.value })} className={`${inputCls} h-9`} />
                  <button type="submit" className="rounded-lg px-2 text-sm text-gray-800 hover:bg-gray-100">
                    Salvar
                  </button>
                </form>
              ) : (
                <button type="button" onClick={() => setEditing({ id: c.id, name: c.name })} className={`min-w-0 flex-1 truncate text-left text-sm ${c.active ? 'text-gray-900' : 'text-gray-400'}`}>
                  {c.name}
                  <span className="ml-1.5 text-xs text-gray-400">{c._count?.recipes ?? 0}</span>
                </button>
              )}
              <button type="button" onClick={() => run(() => recipesAPI.updateCategory(c.id, { active: !c.active }))} className="rounded-lg px-2 py-1 text-xs text-gray-600 hover:bg-gray-100">
                {c.active ? 'Ocultar' : 'Mostrar'}
              </button>
              <RowTools
                i={i}
                n={sorted.length}
                onMove={(d) => reorder(i, d)}
                onRemove={() => {
                  if (window.confirm(`Excluir a categoria "${c.name}"? As receitas dela continuam, só ficam sem categoria.`)) run(() => recipesAPI.deleteCategory(c.id))
                }}
              />
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
