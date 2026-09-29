import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertCircle, Loader2, RefreshCw, Search } from 'lucide-react'
import { getApiErrorMessage, mostruarioAdminAPI, productsAPI, type MostruarioMetricas, type MostruarioProduto } from '../../services/api'

// Mostruario (refeita em 29/09/2026). O motor da AntenorApi decide o que fica
// no site pelo que VENDE no caixa, nao so pelo estoque do ERP (que erra muito
// em producao propria): mantem no ar produto com estoque negativo que esta
// vendendo e tira do ar ("quarentena") o que a separacao nao acha.
// Esta tela mostra essa decisao e o motivo de cada uma, e permite liberar.

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const num = (v: number) => v.toLocaleString('pt-BR', { maximumFractionDigits: 3 })
const PER = 50

export default function MostruarioSection() {
  const [metrics, setMetrics] = useState<MostruarioMetricas | null>(null)
  const [quarantine, setQuarantine] = useState<MostruarioProduto[]>([])
  const [saved, setSaved] = useState<MostruarioProduto[] | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  // Quantos estao de fato no nosso site (mesma conta da tela Produtos).
  const [siteCount, setSiteCount] = useState<number | null>(null)
  useEffect(() => {
    productsAPI
      .catalog({ tab: 'site', limit: 1 })
      .then((r) => setSiteCount(r.data.counts.site))
      .catch(() => setSiteCount(null))
  }, [])

  const load = useCallback(async () => {
    try {
      const [m, q, s] = await Promise.all([mostruarioAdminAPI.getMetricas(), mostruarioAdminAPI.getQuarentena(), mostruarioAdminAPI.getProdutosSalvos()])
      setMetrics(m.data)
      setQuarantine(q.data)
      setSaved(s.data)
      setError('')
    } catch (e) {
      setError(getApiErrorMessage(e, 'Não foi possível falar com a AntenorApi agora.'))
    }
  }, [])
  useEffect(() => {
    load()
  }, [load])

  const recalc = async () => {
    setBusy('recalc')
    try {
      await mostruarioAdminAPI.recalcular()
      await load()
    } catch (e) {
      setError(getApiErrorMessage(e, 'Não foi possível recalcular.'))
    } finally {
      setBusy(null)
    }
  }

  const release = async (p: MostruarioProduto) => {
    if (!window.confirm(`Liberar "${p.nome}" agora? Ele volta ao site mesmo com corte recente na separação.`)) return
    setBusy(String(p.cdProduto))
    try {
      await mostruarioAdminAPI.desbloquear({ cdProduto: p.cdProduto, motivo: 'Liberado manualmente no admin' })
      await load()
    } catch (e) {
      setError(getApiErrorMessage(e, 'Não foi possível liberar.'))
    } finally {
      setBusy(null)
    }
  }

  const filtered = useMemo(() => {
    const fold = (v: string) => v.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    const q = fold(search.trim())
    return (saved || [])
      .filter((p) => !q || fold(p.nome).includes(q) || String(p.cdProduto) === q || fold(p.departamento || '').includes(q))
      .sort((a, b) => (b.vezesVendidoPDV48h || 0) - (a.vezesVendidoPDV48h || 0))
  }, [saved, search])
  const pages = Math.max(1, Math.ceil(filtered.length / PER))
  const r = metrics?.resumo

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-black/[0.06] bg-white px-4 py-3">
        <p className="min-w-0 flex-1 text-sm text-gray-600">
          O motor da AntenorApi decide o que fica no site pelo que <span className="text-gray-900">vende no caixa</span>, não só pelo estoque do ERP.
          {metrics && <span className="text-gray-400"> Atualizado {new Date(metrics.atualizadoEm).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}.</span>}
        </p>
        <button type="button" onClick={recalc} disabled={busy !== null} className="inline-flex items-center gap-1.5 rounded-xl border border-black/[0.08] px-3 py-1.5 text-sm text-gray-800 hover:bg-gray-50 disabled:opacity-40">
          <RefreshCw size={14} className={busy === 'recalc' ? 'animate-spin' : ''} /> Recalcular agora
        </button>
      </div>

      {error && (
        <p role="alert" className="flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">
          <AlertCircle size={16} /> {error}
        </p>
      )}

      {!metrics ? (
        !error && <div className="h-64 animate-pulse rounded-2xl bg-white/70" />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Mantidos por vender no caixa" value={num(saved ? saved.length : metrics.impactoOperacional.produtosSalvosDoEstoqueNegativo)} note="estoque do ERP zerado ou negativo" />
            <Stat label="Presença garantida" value={num(r!.tier1PresencaGarantida)} note="vende com frequência" />
            <Stat label="Cauda longa" value={num(r!.tier2CaudaLongaAtiva)} note="vende pouco, fica se tiver estoque" />
            <Stat label="Em quarentena" value={num(r!.emQuarentenaPicking)} note="2+ faltas na separação em 48 h" />
            <Stat label="Ocultos por precaução" value={num(r!.tier3OcultosPreventivos)} note="sem venda recente" />
            <Stat label="Tirados do mix" value={num(r!.tier3MortosExpurgados)} note="sem venda há muito tempo" />
            <Stat label="Mix curado" value={num(r!.totalMixCurado)} note="produtos avaliados" />
            <Stat
              label="No site"
              value={siteCount != null ? num(siteCount) : num(r!.totalAtivosNoSite)}
              note={siteCount != null ? `a AntenorApi libera ${num(r!.totalAtivosNoSite)}; o site ainda tira ocultos e sem categoria` : 'pela AntenorApi'}
            />
          </div>

          <section className="rounded-2xl border border-black/[0.06] bg-white p-4 sm:p-5">
            <h3 className="text-[11px] font-medium uppercase tracking-wide text-gray-500">Em quarentena</h3>
            <p className="mt-0.5 text-xs text-gray-400">A separação marcou falta 2+ vezes em 48 h: sai do site até voltar a vender no caixa. Libere se o produto já chegou.</p>
            {quarantine.length === 0 ? (
              <p className="mt-3 text-sm text-gray-400">Nenhum produto em quarentena agora.</p>
            ) : (
              <ul className="mt-2 divide-y divide-black/[0.05]">
                {quarantine.map((p) => (
                  <li key={p.cdProduto} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2.5 text-sm">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-gray-900">{p.nome}</span>
                      <span className="text-xs text-gray-500">
                        {p.totalCortesPicking48h} falta(s) em 48 h{p.ultimoCortePicking && ` · última ${new Date(p.ultimoCortePicking).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}`}
                      </span>
                    </span>
                    <button type="button" onClick={() => release(p)} disabled={busy !== null} className="inline-flex items-center gap-1.5 rounded-xl border border-black/[0.08] px-3 py-1.5 text-sm text-gray-800 hover:bg-gray-50 disabled:opacity-40">
                      {busy === String(p.cdProduto) && <Loader2 size={13} className="animate-spin" />} Liberar
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.8fr)_minmax(0,1fr)]">
            <section className="min-w-0 rounded-2xl border border-black/[0.06] bg-white">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-black/[0.05] px-4 py-3">
                <div>
                  <h3 className="text-[11px] font-medium uppercase tracking-wide text-gray-500">Mantidos no ar por vender no caixa · {num(filtered.length)}</h3>
                  <p className="text-xs text-gray-400">Estoque do ERP zerado ou negativo, mas o caixa vende: o motor mantém no site.</p>
                </div>
                <label className="relative w-full sm:w-64">
                  <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    value={search}
                    onChange={(e) => (setSearch(e.target.value), setPage(0))}
                    placeholder="Produto, código ou departamento"
                    className="h-9 w-full rounded-xl border border-black/[0.06] pl-9 pr-3 text-sm outline-none focus:border-gray-400"
                  />
                </label>
              </div>
              <div className="hidden grid-cols-[minmax(0,1fr)_90px_90px_90px] gap-3 px-4 py-2 text-[11px] uppercase tracking-wide text-gray-400 md:grid">
                <span>Produto · motivo</span>
                <span className="text-right">Estoque ERP</span>
                <span className="text-right">Vendas 48 h</span>
                <span className="text-right">Preço</span>
              </div>
              <ul className="divide-y divide-black/[0.05]">
                {filtered.slice(page * PER, page * PER + PER).map((p) => (
                  <li key={p.cdProduto} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 px-4 py-2.5 text-sm md:grid-cols-[minmax(0,1fr)_90px_90px_90px] md:items-center">
                    <span className="min-w-0">
                      <span className="block truncate text-gray-900">{p.nome}</span>
                      <span className="block truncate text-xs text-gray-500">
                        {p.cdProduto} · {p.departamento} · {p.motivoClassificacao}
                      </span>
                    </span>
                    <span className="text-right tabular-nums text-gray-600 md:block">
                      <span className="text-xs text-gray-400 md:hidden">estoque </span>
                      {num(p.estoqueERP)}
                    </span>
                    <span className="col-span-2 text-xs tabular-nums text-gray-500 md:col-span-1 md:text-right md:text-sm md:text-gray-900">
                      <span className="md:hidden">vendas 48 h </span>
                      {p.vezesVendidoPDV48h}
                      <span className="md:hidden"> · {brl(p.precoVenda)}</span>
                    </span>
                    <span className="hidden text-right tabular-nums text-gray-900 md:block">{brl(p.precoVenda)}</span>
                  </li>
                ))}
              </ul>
              {pages > 1 && (
                <div className="flex items-center justify-between border-t border-black/[0.05] px-4 py-2.5 text-xs text-gray-500">
                  <span className="tabular-nums">
                    {page * PER + 1}–{Math.min((page + 1) * PER, filtered.length)} de {num(filtered.length)}
                  </span>
                  <span className="flex gap-1">
                    <button type="button" disabled={page === 0} onClick={() => setPage(page - 1)} className="rounded-lg px-2 py-1 hover:bg-gray-100 disabled:opacity-30">
                      Anterior
                    </button>
                    <button type="button" disabled={page >= pages - 1} onClick={() => setPage(page + 1)} className="rounded-lg px-2 py-1 hover:bg-gray-100 disabled:opacity-30">
                      Próxima
                    </button>
                  </span>
                </div>
              )}
            </section>

            <section className="rounded-2xl border border-black/[0.06] bg-white p-4 sm:p-5">
              <h3 className="text-[11px] font-medium uppercase tracking-wide text-gray-500">Departamentos com mais itens mantidos</h3>
              <ul className="mt-3 space-y-2">
                {metrics.topDepartamentosGarantidos.map((d) => (
                  <li key={d.departamento} className="text-sm">
                    <div className="flex justify-between gap-2">
                      <span className="truncate text-gray-700">{d.departamento}</span>
                      <span className="shrink-0 tabular-nums text-xs text-gray-500">
                        {d.itensSalvos} de {d.totalItens}
                      </span>
                    </div>
                    <div className="mt-1 h-1 rounded-full bg-gray-100">
                      <div className="h-1 rounded-full bg-[#5D082A]/70" style={{ width: `${(d.itensSalvos / Math.max(1, d.totalItens)) * 100}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </>
      )}
    </div>
  )
}

function Stat({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="rounded-2xl border border-black/[0.06] bg-white p-4">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="mt-0.5 text-2xl font-semibold tabular-nums text-gray-900">{value}</p>
      <p className="text-xs text-gray-400">{note}</p>
    </div>
  )
}
