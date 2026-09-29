import { useCallback, useEffect, useState } from 'react'
import { Loader2, X } from 'lucide-react'
import { getApiErrorMessage, searchHealthAPI, type IntelligenceResponse, type SearchCheck } from '../../services/api'

type NoResult = IntelligenceResponse['search']['noResult'][number]

/**
 * Buscas sem resultado conferidas AGORA (29/09/2026): o que ja foi resolvido
 * aparece como resolvido; o que continua falhando diz por que (produto fora do
 * site ou inexistente) e permite criar um sinonimo na hora.
 */
export function NoResultSearches({ items }: { items: NoResult[] }) {
  const [checks, setChecks] = useState<Record<string, SearchCheck>>({})
  const [synonyms, setSynonyms] = useState<Array<{ id: string; term: string; equivalents: string[] }>>([])
  const [editing, setEditing] = useState<string | null>(null)
  const [equivalent, setEquivalent] = useState('')
  const [probe, setProbe] = useState<SearchCheck | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const recheck = useCallback(async (terms: string[]) => {
    if (!terms.length) return
    const r = await searchHealthAPI.check(terms)
    setChecks((prev) => ({ ...prev, ...Object.fromEntries(r.data.map((c) => [c.term, c])) }))
  }, [])
  const loadSynonyms = useCallback(() => searchHealthAPI.synonyms().then((r) => setSynonyms(r.data)).catch(() => undefined), [])

  useEffect(() => {
    recheck(items.map((i) => i.term)).catch(() => undefined)
    loadSynonyms()
  }, [items, recheck, loadSynonyms])

  // Quantos produtos a palavra equivalente acha (antes de salvar).
  useEffect(() => {
    const term = equivalent.split(',')[0]?.trim()
    if (!term || term.length < 2) {
      setProbe(null)
      return
    }
    const t = setTimeout(() => {
      searchHealthAPI
        .check([term])
        .then((r) => setProbe(r.data[0] || null))
        .catch(() => setProbe(null))
    }, 300)
    return () => clearTimeout(t)
  }, [equivalent])

  const save = async (term: string) => {
    setSaving(true)
    setError('')
    try {
      await searchHealthAPI.addSynonym(
        term,
        equivalent
          .split(',')
          .map((e) => e.trim())
          .filter(Boolean),
      )
      setEditing(null)
      setEquivalent('')
      await loadSynonyms()
      // A busca aplica o sinonimo em instantes.
      setTimeout(() => recheck([term]).catch(() => undefined), 1500)
    } catch (e) {
      setError(getApiErrorMessage(e, 'Não foi possível salvar o sinônimo.'))
    } finally {
      setSaving(false)
    }
  }

  const removeSynonym = async (id: string, term: string) => {
    if (!window.confirm(`Remover o sinônimo de "${term}"?`)) return
    await searchHealthAPI.removeSynonym(id).catch(() => undefined)
    await loadSynonyms()
    setTimeout(() => recheck([term]).catch(() => undefined), 1500)
  }

  if (!items.length) return <p className="text-sm text-gray-400">Nenhuma busca sem resultado no período.</p>
  const failing = (t: string) => Boolean(checks[t] && checks[t].total === 0)
  const sorted = [...items].sort((a, b) => Number(failing(b.term)) - Number(failing(a.term)) || b.empty - a.empty)

  return (
    <div>
      <ul className="divide-y divide-black/[0.05]">
        {sorted.map((s) => {
          const c = checks[s.term]
          const ex = c?.diagnosis?.examples?.[0]
          return (
            <li key={s.term} className="py-2.5 text-sm">
              <div className="flex items-baseline justify-between gap-3">
                <span className="min-w-0">
                  <span className="block truncate text-gray-900">{s.term}</span>
                  <span className="text-xs text-gray-400">
                    {s.empty}× sem resultado · última em {new Date(s.last).toLocaleDateString('pt-BR')}
                  </span>
                </span>
                {/* Produto existe mas esta fora do site: sinonimo nao resolve (resolve reativar no ERP). */}
                {c && c.total === 0 && editing !== s.term && (!ex || ex.reason.startsWith('no site')) && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditing(s.term)
                      setEquivalent('')
                      setError('')
                    }}
                    className="shrink-0 rounded-lg px-2 py-1 text-xs text-gray-700 hover:bg-gray-100"
                  >
                    Criar sinônimo
                  </button>
                )}
              </div>
              <p className="mt-1 flex items-start gap-1.5 text-xs">
                {!c ? (
                  <span className="text-gray-400">conferindo…</span>
                ) : c.total > 0 ? (
                  <>
                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-600" />
                    <span className="text-gray-500">
                      Resolvido: hoje acha {c.total} produto(s), ex.: {c.sample[0]}
                    </span>
                  </>
                ) : ex ? (
                  <>
                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                    <span className="text-gray-600">
                      Existe no cadastro, mas está fora do site: {ex.name} ({ex.reason})
                    </span>
                  </>
                ) : (
                  <>
                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                    <span className="text-gray-600">Não existe no cadastro com esse nome. Crie um sinônimo ou cadastre o produto no ERP.</span>
                  </>
                )}
              </p>
              {editing === s.term && (
                <div className="mt-2 rounded-xl border border-black/[0.08] p-3">
                  <label className="block text-xs text-gray-600">
                    Quem buscar <span className="text-gray-900">&ldquo;{s.term}&rdquo;</span> também vê o resultado de:
                    <input
                      autoFocus
                      value={equivalent}
                      onChange={(e) => setEquivalent(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && equivalent.trim()) save(s.term)
                      }}
                      placeholder="ex.: maizena (separe várias com vírgula)"
                      className="mt-1 h-9 w-full rounded-lg border border-black/[0.08] px-3 text-sm text-gray-900 placeholder:text-gray-400"
                    />
                  </label>
                  {probe && (
                    <p className="mt-1 text-xs text-gray-500">
                      &ldquo;{probe.term}&rdquo; {probe.total > 0 ? `acha ${probe.total} produto(s), ex.: ${probe.sample[0]}` : 'também não acha nada no site'}
                    </p>
                  )}
                  {error && <p className="mt-1 text-xs text-rose-700">{error}</p>}
                  <div className="mt-2 flex justify-end gap-2">
                    <button type="button" onClick={() => setEditing(null)} className="rounded-lg px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100">
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={() => save(s.term)}
                      disabled={!equivalent.trim() || saving}
                      className="inline-flex items-center gap-1 rounded-lg bg-gray-900 px-3 py-1.5 text-xs text-white disabled:opacity-40"
                    >
                      {saving && <Loader2 size={12} className="animate-spin" />} Salvar
                    </button>
                  </div>
                </div>
              )}
            </li>
          )
        })}
      </ul>
      {synonyms.length > 0 && (
        <div className="mt-3 border-t border-black/[0.05] pt-3">
          <p className="text-xs text-gray-500">Sinônimos criados aqui</p>
          <ul className="mt-1.5 flex flex-wrap gap-1.5">
            {synonyms.map((syn) => (
              <li key={syn.id} className="inline-flex items-center gap-1 rounded-full border border-black/[0.08] py-0.5 pl-2.5 pr-1 text-xs text-gray-700">
                {syn.term} → {syn.equivalents.join(', ')}
                <button
                  type="button"
                  aria-label={`Remover sinônimo ${syn.term}`}
                  onClick={() => removeSynonym(syn.id, syn.term)}
                  className="rounded-full p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                >
                  <X size={12} />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
