import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertCircle, Bell, Copy, Download, ImageOff, KeyRound, Loader2, MessageCircle, Pencil, Search } from 'lucide-react'
import { WorkspaceDialog } from '../../components/WorkspaceDialog'
import {
  addressesAPI,
  customersAdminAPI,
  customersAPI,
  getApiErrorMessage,
  resolveApiUrl,
  type CustomerDetail,
  type CustomerRow,
} from '../../services/api'
import { OrderDetail, STATUS_LABEL } from './OrdersSection'

// Clientes (refeita em 29/09/2026 com o Jonathan). A tela antiga baixava todos os
// pedidos so para contar (e contava cancelados), tinha colunas (kanban) e filtros
// de "tem e-mail/endereco". Agora: quem compra, quanto, quando foi a ultima vez,
// quem sumiu e quem nunca comprou -- e, no perfil, o historico de pedidos, o que
// a pessoa mais compra, os dados e a conta (senha, bloqueio, avisos, clube).

type Segment = 'all' | 'buyers' | 'repeat' | 'lapsed' | 'never' | 'new' | 'blocked'
type Sort = 'last' | 'spent' | 'orders' | 'created' | 'name'
const DAY = 86_400_000
const SEGMENTS: Array<{ key: Segment; label: string; hint: string; test: (c: CustomerRow) => boolean }> = [
  { key: 'all', label: 'Todos', hint: 'Todos os cadastros.', test: () => true },
  { key: 'buyers', label: 'Compraram', hint: 'Pelo menos um pedido válido.', test: (c) => c.orders > 0 },
  { key: 'repeat', label: 'Voltaram a comprar', hint: 'Dois pedidos ou mais: os clientes fiéis.', test: (c) => c.orders >= 2 },
  {
    key: 'lapsed',
    label: 'Sumiram',
    hint: 'Compraram, mas não pedem há mais de 30 dias. Bons para um aviso ou uma mensagem.',
    test: (c) => c.orders > 0 && !!c.lastOrderAt && Date.now() - new Date(c.lastOrderAt).getTime() > 30 * DAY,
  },
  { key: 'never', label: 'Nunca compraram', hint: 'Cadastraram e não fizeram pedido válido.', test: (c) => c.orders === 0 },
  { key: 'new', label: 'Novos', hint: 'Cadastro nos últimos 30 dias.', test: (c) => Date.now() - new Date(c.createdAt).getTime() <= 30 * DAY },
  { key: 'blocked', label: 'Bloqueados', hint: 'Não conseguem entrar nem comprar.', test: (c) => c.blocked },
]
const ORIGIN_LABEL: Record<string, string> = {
  INDICACAO: 'Indicação',
  LOJA_FISICA: 'Loja física',
  OUTROS: 'Outros',
  DESCONHECIDO: 'Não informou',
  guest_checkout: 'Comprou sem cadastro',
}

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const fold = (v: string) => v.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const digits = (v: string) => v.replace(/\D/g, '')
const phone = (v: string) => {
  const d = digits(v)
  return d.length === 11 ? `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}` : d.length === 10 ? `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}` : v
}
const cpfFmt = (v: string) => (digits(v).length === 11 ? digits(v).replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4') : v)
function ago(iso: string | null) {
  if (!iso) return '—'
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / DAY)
  if (d <= 0) return 'hoje'
  if (d === 1) return 'ontem'
  if (d < 30) return `há ${d} dias`
  return new Date(iso).toLocaleDateString('pt-BR')
}
const waLink = (whatsapp: string, text?: string) => {
  const d = digits(whatsapp)
  const full = d.startsWith('55') && d.length >= 12 ? d : `55${d}`
  return `https://wa.me/${full}${text ? `?text=${encodeURIComponent(text)}` : ''}`
}

export default function CustomersSection() {
  const [rows, setRows] = useState<CustomerRow[] | null>(null)
  const [error, setError] = useState('')
  const [segment, setSegment] = useState<Segment>('all')
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<Sort>('last')
  const [openId, setOpenId] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setRows((await customersAdminAPI.list()).data)
      setError('')
    } catch (e) {
      setError(getApiErrorMessage(e, 'Não foi possível carregar os clientes.'))
    }
  }, [])
  useEffect(() => {
    load()
  }, [load])

  const counts = useMemo(() => Object.fromEntries(SEGMENTS.map((s) => [s.key, (rows || []).filter(s.test).length])) as Record<Segment, number>, [rows])
  const list = useMemo(() => {
    const test = SEGMENTS.find((s) => s.key === segment)!.test
    const q = fold(search.trim())
    const qd = digits(search)
    const time = (v: string | null) => (v ? new Date(v).getTime() : 0)
    return (rows || [])
      .filter(test)
      .filter((c) => !q || fold(`${c.name} ${c.email || ''}`).includes(q) || (qd.length >= 3 && (digits(c.whatsapp).includes(qd) || digits(c.cpf).includes(qd))))
      .sort((a, b) =>
        sort === 'spent'
          ? b.spent - a.spent
          : sort === 'orders'
            ? b.orders - a.orders
            : sort === 'created'
              ? time(b.createdAt) - time(a.createdAt)
              : sort === 'name'
                ? a.name.localeCompare(b.name, 'pt-BR')
                : time(b.lastOrderAt) - time(a.lastOrderAt) || time(b.createdAt) - time(a.createdAt),
      )
  }, [rows, segment, search, sort])

  const exportCsv = () => {
    const cell = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`
    const lines = [
      ['Nome', 'WhatsApp', 'E-mail', 'Bairro', 'Pedidos', 'Total gasto', 'Último pedido', 'Recebe avisos'].map(cell).join(';'),
      ...list.map((c) =>
        [c.name, phone(c.whatsapp), c.email, c.neighborhood, c.orders, c.spent.toFixed(2).replace('.', ','), c.lastOrderAt ? new Date(c.lastOrderAt).toLocaleDateString('pt-BR') : '', c.pushDevices ? 'sim' : 'não']
          .map(cell)
          .join(';'),
      ),
    ]
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' }))
    a.download = `clientes-${segment}-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const totals = useMemo(() => {
    const buyers = (rows || []).filter((c) => c.orders > 0)
    const spent = buyers.reduce((a, c) => a + c.spent, 0)
    const orders = buyers.reduce((a, c) => a + c.orders, 0)
    return { buyers: buyers.length, spent, ticket: orders ? spent / orders : 0, repeatRate: buyers.length ? Math.round((buyers.filter((c) => c.orders >= 2).length / buyers.length) * 100) : 0 }
  }, [rows])

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      {rows && (
        <div className="flex flex-wrap gap-x-6 gap-y-1 rounded-2xl border border-black/[0.06] bg-white px-4 py-3 text-sm text-gray-600">
          <span>
            <span className="tabular-nums text-gray-900">{rows.length}</span> cadastros
          </span>
          <span>
            <span className="tabular-nums text-gray-900">{totals.buyers}</span> já compraram
          </span>
          <span>
            <span className="tabular-nums text-gray-900">{totals.repeatRate}%</span> voltaram a comprar
          </span>
          <span>
            ticket médio <span className="tabular-nums text-gray-900">{brl(totals.ticket)}</span>
          </span>
          <span>
            <span className="tabular-nums text-gray-900">{rows.filter((c) => c.pushDevices > 0).length}</span> recebem avisos no celular
          </span>
        </div>
      )}

      <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <div className="flex w-max gap-1 rounded-2xl border border-black/[0.06] bg-white p-1">
          {SEGMENTS.map((s) => (
            <button key={s.key} type="button" onClick={() => setSegment(s.key)} className={`whitespace-nowrap rounded-xl px-3 py-1.5 text-sm ${segment === s.key ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-50'}`}>
              {s.label}
              <span className={`ml-1.5 tabular-nums ${segment === s.key ? 'text-white/60' : 'text-gray-400'}`}>{counts[s.key] ?? 0}</span>
            </button>
          ))}
        </div>
      </div>
      <p className="text-xs text-gray-500">{SEGMENTS.find((s) => s.key === segment)?.hint}</p>

      <div className="flex flex-wrap items-center gap-2">
        <label className="relative min-w-[220px] flex-1">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nome, WhatsApp, CPF ou e-mail" className="h-10 w-full rounded-xl border border-black/[0.06] bg-white pl-9 pr-3 text-sm outline-none focus:border-gray-400" />
        </label>
        <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="h-10 rounded-xl border border-black/[0.06] bg-white px-3 text-sm text-gray-700">
          <option value="last">Último pedido</option>
          <option value="spent">Mais gastou</option>
          <option value="orders">Mais pedidos</option>
          <option value="created">Cadastro mais recente</option>
          <option value="name">Nome</option>
        </select>
        <button type="button" onClick={exportCsv} disabled={!list.length} className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-black/[0.06] bg-white px-3 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-40">
          <Download size={14} /> Exportar
        </button>
      </div>

      {error && (
        <p role="alert" className="flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">
          <AlertCircle size={16} /> {error}
        </p>
      )}

      {!rows ? (
        !error && <div className="h-64 animate-pulse rounded-2xl bg-white/70" />
      ) : list.length === 0 ? (
        <p className="rounded-2xl border border-black/[0.06] bg-white p-8 text-center text-sm text-gray-400">Nenhum cliente aqui.</p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-black/[0.06] bg-white">
          <div className="hidden grid-cols-[minmax(0,1fr)_80px_120px_120px_70px] gap-4 border-b border-black/[0.05] px-4 py-2 text-[11px] uppercase tracking-wide text-gray-400 md:grid">
            <span>Cliente</span>
            <span className="text-right">Pedidos</span>
            <span className="text-right">Total gasto</span>
            <span>Último pedido</span>
            <span className="text-center">Avisos</span>
          </div>
          <ul className="divide-y divide-black/[0.05]">
            {list.map((c) => (
              <li key={c.id}>
                <button type="button" onClick={() => setOpenId(c.id)} className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 px-4 py-3 text-left hover:bg-gray-50/70 md:grid-cols-[minmax(0,1fr)_80px_120px_120px_70px]">
                  <span className="min-w-0">
                    <span className="block truncate text-sm text-gray-900">
                      {c.name}
                      {c.blocked && <span className="text-rose-700"> · bloqueado</span>}
                      {!c.hasPassword && <span className="text-gray-400"> · sem senha</span>}
                    </span>
                    <span className="block truncate text-xs text-gray-500">
                      {phone(c.whatsapp)}
                      {c.neighborhood && ` · ${c.neighborhood}`}
                    </span>
                  </span>
                  <span className="text-right text-sm tabular-nums text-gray-900 md:block">
                    {c.orders}
                    <span className="text-xs text-gray-400 md:hidden"> ped.</span>
                  </span>
                  <span className="col-span-2 text-xs text-gray-500 md:col-span-1 md:text-right md:text-sm md:text-gray-900">
                    <span className="tabular-nums">{c.orders ? brl(c.spent) : '—'}</span>
                    <span className="md:hidden"> · último pedido {ago(c.lastOrderAt)}</span>
                  </span>
                  <span className="hidden text-sm text-gray-600 md:block">{ago(c.lastOrderAt)}</span>
                  <span className="hidden justify-center md:flex">{c.pushDevices > 0 ? <Bell size={15} className="text-gray-700" aria-label="Recebe avisos" /> : <span className="text-gray-300">—</span>}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {openId && <CustomerProfile id={openId} onClose={() => setOpenId(null)} onChanged={load} />}
    </div>
  )
}

// ─── Perfil ────────────────────────────────────────────────────────────────

function CustomerProfile({ id, onClose, onChanged }: { id: string; onClose: () => void; onChanged: () => void }) {
  const [c, setC] = useState<CustomerDetail | null>(null)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ name: '', whatsapp: '', email: '', cpf: '' })
  const [addrEditing, setAddrEditing] = useState<string | null>(null)
  const [addr, setAddr] = useState({ street: '', number: '', complement: '', neighborhood: '', city: '', state: '', zipCode: '' })
  const [busy, setBusy] = useState<string | null>(null)
  const [reset, setReset] = useState<{ resetUrl: string } | null>(null)
  const [copied, setCopied] = useState(false)
  const [loyalty, setLoyalty] = useState<string | null>(null)
  const [orderOpen, setOrderOpen] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const d = (await customersAdminAPI.detail(id)).data
      setC(d)
      setForm({ name: d.name, whatsapp: d.whatsapp, email: d.email || '', cpf: d.cpf })
      setError('')
    } catch (e) {
      setError(getApiErrorMessage(e, 'Não foi possível abrir o cliente.'))
    }
  }, [id])
  useEffect(() => {
    load()
  }, [load])

  const run = async (key: string, fn: () => Promise<unknown>) => {
    setBusy(key)
    setError('')
    try {
      await fn()
      await load()
      onChanged()
      return true
    } catch (e) {
      setError(getApiErrorMessage(e, 'Não foi possível salvar.'))
      return false
    } finally {
      setBusy(null)
    }
  }

  const saveProfile = async () => {
    const ok = await run('profile', () => customersAPI.update(id, { name: form.name.trim(), whatsapp: digits(form.whatsapp), email: form.email.trim() || undefined, cpf: digits(form.cpf) }))
    if (ok) setEditing(false)
  }
  const saveAddress = async () => {
    if (!addrEditing) return
    const ok = await run('address', () => addressesAPI.update(id, addrEditing, addr))
    if (ok) setAddrEditing(null)
  }
  const toggleBlock = async () => {
    if (!c) return
    if (!c.blocked) {
      if (!window.confirm(`Bloquear ${c.name}? A pessoa não consegue mais entrar nem comprar, e a sessão cai na hora.`)) return
      const reason = window.prompt('Motivo (fica registrado só aqui):') || undefined
      await run('block', () => customersAPI.setBlocked(id, true, reason))
    } else {
      await run('block', () => customersAPI.setBlocked(id, false))
    }
  }
  const makeReset = async () => {
    setBusy('reset')
    try {
      setReset((await customersAPI.generateResetLink(id)).data)
    } catch (e) {
      setError(getApiErrorMessage(e, 'Não foi possível gerar o link.'))
    } finally {
      setBusy(null)
    }
  }
  const checkLoyalty = async () => {
    setBusy('loyalty')
    try {
      const r = (await customersAdminAPI.loyalty(id)).data
      setLoyalty(r.clubeFidelidade ? `Participa do Clube Antenor${r.categoria?.descricao ? ` · ${r.categoria.descricao}` : ''}` : 'Não participa do Clube Antenor')
    } catch {
      setLoyalty('Não foi possível consultar agora.')
    } finally {
      setBusy(null)
    }
  }

  const input = 'h-10 w-full rounded-xl border border-black/[0.08] bg-white px-3 text-sm text-gray-900'

  return (
    <>
      <WorkspaceDialog
        label={c?.name || 'Cliente'}
        onClose={onClose}
        closeOnEsc={!orderOpen}
        title={
          <>
            <h3 className="truncate text-base font-semibold text-gray-900">
              {c?.name || 'Carregando…'}
              {c?.blocked && <span className="text-sm font-normal text-rose-700"> · bloqueado</span>}
            </h3>
            {c && (
              <p className="mt-0.5 truncate text-xs text-gray-500">
                {phone(c.whatsapp)} · cliente desde {new Date(c.createdAt).toLocaleDateString('pt-BR')}
              </p>
            )}
          </>
        }
        actions={
          c ? (
            <a href={waLink(c.whatsapp, `Olá, ${c.name.split(' ')[0]}! Aqui é da Antenor & Filhos.`)} target="_blank" rel="noreferrer" className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-black/[0.08] px-3 py-1.5 text-sm text-gray-800 hover:bg-gray-50">
              <MessageCircle size={15} /> WhatsApp
            </a>
          ) : undefined
        }
      >
        {!c ? (
          error ? <p className="m-6 text-sm text-rose-700">{error}</p> : <div className="m-6 h-64 animate-pulse rounded-2xl bg-gray-100" />
        ) : (
          <div className="grid grid-cols-1 gap-8 px-4 py-5 sm:px-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] lg:gap-10">
            {/* Esquerda: o que o cliente compra */}
            <div className="space-y-7">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <Stat label="Pedidos" value={String(c.summary.orders)} note={c.summary.cancelled ? `${c.summary.cancelled} cancelado(s)` : undefined} />
                <Stat label="Total gasto" value={brl(c.summary.spent)} />
                <Stat label="Ticket médio" value={c.summary.orders ? brl(c.summary.avgTicket) : '—'} />
                <Stat label="Último pedido" value={ago(c.summary.lastOrderAt)} />
              </div>

              <section>
                <H title="Pedidos" hint="Toque para abrir o pedido." />
                {c.orders.length === 0 ? (
                  <p className="mt-2 text-sm text-gray-400">Nenhum pedido ainda.</p>
                ) : (
                  <ul className="mt-2 divide-y divide-black/[0.05] rounded-xl border border-black/[0.06]">
                    {c.orders.map((o) => (
                      <li key={o.id}>
                        <button type="button" onClick={() => setOrderOpen(o.id)} className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm hover:bg-gray-50">
                          <span className="w-24 shrink-0 text-xs tabular-nums text-gray-500">{new Date(o.createdAt).toLocaleDateString('pt-BR')}</span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-gray-900">{o.dav ? `DAV ${o.dav}` : `#${o.id.slice(-8).toUpperCase()}`}</span>
                            <span className={`block truncate text-xs ${['CANCELLED', 'REFUNDED'].includes(o.status) ? 'text-gray-400 line-through' : 'text-gray-500'}`}>
                              {STATUS_LABEL[o.status] || o.status} · {o.items} itens · {o.pickup ? 'retirada' : 'entrega'}
                            </span>
                          </span>
                          <span className="shrink-0 tabular-nums text-gray-900">{brl(o.total)}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {c.topProducts.length > 0 && (
                <section>
                  <H title="O que mais compra" hint="Em quantos pedidos cada produto apareceu." />
                  <ul className="mt-2 divide-y divide-black/[0.05]">
                    {c.topProducts.map((p) => (
                      <li key={p.productId} className="flex items-center gap-3 py-2 text-sm">
                        <Thumb ean={p.ean} />
                        <span className="min-w-0 flex-1 truncate text-gray-900">{p.name}</span>
                        <span className="shrink-0 text-xs tabular-nums text-gray-500">{p.times}×</span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </div>

            {/* Direita: dados e conta */}
            <div className="space-y-7">
              {error && <p className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">{error}</p>}
              <section>
                <div className="flex items-end justify-between">
                  <H title="Dados" />
                  {!editing && (
                    <button type="button" onClick={() => setEditing(true)} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-gray-700 hover:bg-gray-100">
                      <Pencil size={12} /> Editar
                    </button>
                  )}
                </div>
                {editing ? (
                  <div className="mt-2 space-y-3">
                    <Field label="Nome">
                      <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={input} />
                    </Field>
                    <Field label="WhatsApp" help="É o login do cliente e o contato da entrega.">
                      <input inputMode="tel" value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} className={input} />
                    </Field>
                    <Field label="E-mail" help="Opcional.">
                      <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={input} />
                    </Field>
                    <Field label="CPF" help="Usado na nota fiscal e no Clube Antenor.">
                      <input inputMode="numeric" value={form.cpf} onChange={(e) => setForm({ ...form, cpf: e.target.value })} className={input} />
                    </Field>
                    <div className="flex justify-end gap-2">
                      <button type="button" onClick={() => setEditing(false)} className="rounded-xl px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100">
                        Cancelar
                      </button>
                      <button type="button" onClick={saveProfile} disabled={busy === 'profile' || !form.name.trim()} className="rounded-xl bg-gray-900 px-3.5 py-1.5 text-sm text-white disabled:opacity-40">
                        {busy === 'profile' ? 'Salvando…' : 'Salvar'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <dl className="mt-2 divide-y divide-black/[0.05] text-sm">
                    <Row label="WhatsApp" value={phone(c.whatsapp)} />
                    <Row label="E-mail" value={c.email || '—'} />
                    <Row label="CPF" value={cpfFmt(c.cpf)} mono />
                    <Row label="Como conheceu" value={c.origin ? ORIGIN_LABEL[c.origin] || c.origin : '—'} />
                  </dl>
                )}
              </section>

              <section>
                <H title="Endereços" />
                {c.addresses.length === 0 ? (
                  <p className="mt-2 text-sm text-gray-400">Nenhum endereço.</p>
                ) : (
                  <ul className="mt-2 space-y-2">
                    {c.addresses.map((a) => (
                      <li key={a.id} className="rounded-xl border border-black/[0.06] p-3 text-sm">
                        {addrEditing === a.id ? (
                          <div className="grid grid-cols-6 gap-2">
                            <input placeholder="Rua" value={addr.street} onChange={(e) => setAddr({ ...addr, street: e.target.value })} className={`${input} col-span-4`} />
                            <input placeholder="Nº" value={addr.number} onChange={(e) => setAddr({ ...addr, number: e.target.value })} className={`${input} col-span-2`} />
                            <input placeholder="Complemento" value={addr.complement} onChange={(e) => setAddr({ ...addr, complement: e.target.value })} className={`${input} col-span-6`} />
                            <input placeholder="Bairro" value={addr.neighborhood} onChange={(e) => setAddr({ ...addr, neighborhood: e.target.value })} className={`${input} col-span-3`} />
                            <input placeholder="Cidade" value={addr.city} onChange={(e) => setAddr({ ...addr, city: e.target.value })} className={`${input} col-span-3`} />
                            <input placeholder="UF" value={addr.state} onChange={(e) => setAddr({ ...addr, state: e.target.value })} className={`${input} col-span-2`} />
                            <input placeholder="CEP" value={addr.zipCode} onChange={(e) => setAddr({ ...addr, zipCode: e.target.value })} className={`${input} col-span-4`} />
                            <div className="col-span-6 flex justify-end gap-2">
                              <button type="button" onClick={() => setAddrEditing(null)} className="rounded-xl px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100">
                                Cancelar
                              </button>
                              <button type="button" onClick={saveAddress} disabled={busy === 'address'} className="rounded-xl bg-gray-900 px-3.5 py-1.5 text-sm text-white disabled:opacity-40">
                                {busy === 'address' ? 'Salvando…' : 'Salvar'}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-start justify-between gap-2">
                            <span className="min-w-0">
                              <span className="block text-gray-900">
                                {a.street}, {a.number}
                                {a.complement ? ` · ${a.complement}` : ''}
                              </span>
                              <span className="block text-xs text-gray-500">
                                {a.neighborhood} · {a.city}
                                {a.isDefault && ' · principal'}
                              </span>
                            </span>
                            <button
                              type="button"
                              aria-label="Editar endereço"
                              onClick={() => {
                                setAddrEditing(a.id)
                                setAddr({ street: a.street, number: a.number, complement: a.complement || '', neighborhood: a.neighborhood, city: a.city, state: a.state, zipCode: a.zipCode })
                              }}
                              className="shrink-0 rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                            >
                              <Pencil size={13} />
                            </button>
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section>
                <H title="Conta" />
                <dl className="mt-2 divide-y divide-black/[0.05] text-sm">
                  <Row label="Senha" value={c.hasPassword ? 'Tem senha' : 'Sem senha (comprou como convidado)'} />
                  <Row label="Avisos no celular" value={c.pushDevices ? `Ativados em ${c.pushDevices} aparelho(s)` : 'Não ativou'} />
                  <div className="flex items-center justify-between gap-2 py-2">
                    <dt className="text-gray-500">Clube Antenor</dt>
                    <dd className="text-right text-gray-900">
                      {loyalty ?? (
                        <button type="button" onClick={checkLoyalty} disabled={busy === 'loyalty'} className="inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-xs text-gray-700 hover:bg-gray-100">
                          {busy === 'loyalty' && <Loader2 size={12} className="animate-spin" />} Consultar no ERP
                        </button>
                      )}
                    </dd>
                  </div>
                </dl>

                <div className="mt-3 space-y-2">
                  {reset ? (
                    <div className="rounded-xl border border-black/[0.08] p-3">
                      <p className="text-xs text-gray-500">Link para {c.hasPassword ? 'trocar a' : 'criar uma'} senha. Vale por 1 hora.</p>
                      <p className="mt-1 break-all font-mono text-[11px] text-gray-700">{reset.resetUrl}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <a
                          href={waLink(c.whatsapp, `Olá, ${c.name.split(' ')[0]}! Use este link para ${c.hasPassword ? 'trocar' : 'criar'} sua senha na Antenor & Filhos (vale por 1 hora): ${reset.resetUrl}`)}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-lg bg-gray-900 px-3 py-1.5 text-xs text-white"
                        >
                          <MessageCircle size={13} /> Enviar pelo WhatsApp
                        </a>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard?.writeText(reset.resetUrl)
                            setCopied(true)
                            setTimeout(() => setCopied(false), 1500)
                          }}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-black/[0.08] px-3 py-1.5 text-xs text-gray-800 hover:bg-gray-50"
                        >
                          <Copy size={13} /> {copied ? 'Copiado' : 'Copiar'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button type="button" onClick={makeReset} disabled={busy === 'reset'} className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-black/[0.08] px-3 py-2 text-sm text-gray-800 hover:bg-gray-50 disabled:opacity-40">
                      <KeyRound size={14} /> {c.hasPassword ? 'Gerar link para trocar a senha' : 'Gerar link para criar a senha'}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={toggleBlock}
                    disabled={busy === 'block'}
                    className={`w-full rounded-xl px-3 py-2 text-sm disabled:opacity-40 ${c.blocked ? 'border border-black/[0.08] text-gray-800 hover:bg-gray-50' : 'text-rose-700 hover:bg-rose-50'}`}
                  >
                    {c.blocked ? 'Desbloquear' : 'Bloquear cliente'}
                  </button>
                  {c.blocked && c.blockedReason && <p className="text-xs text-gray-500">Motivo do bloqueio: {c.blockedReason}</p>}
                </div>
              </section>
            </div>
          </div>
        )}
      </WorkspaceDialog>
      {orderOpen && <OrderDetail orderId={orderOpen} onClose={() => setOrderOpen(null)} onChanged={load} />}
    </>
  )
}

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div>
      <p className="text-xs text-gray-500">{label}</p>
      <p className="mt-0.5 text-lg font-semibold tabular-nums text-gray-900">{value}</p>
      {note && <p className="text-xs text-gray-400">{note}</p>}
    </div>
  )
}

function H({ title, hint }: { title: string; hint?: string }) {
  return (
    <div>
      <h4 className="text-[11px] font-medium uppercase tracking-wide text-gray-500">{title}</h4>
      {hint && <p className="mt-0.5 text-xs text-gray-400">{hint}</p>}
    </div>
  )
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <dt className="text-gray-500">{label}</dt>
      <dd className={`min-w-0 truncate text-right text-gray-900 ${mono ? 'font-mono text-xs' : ''}`}>{value}</dd>
    </div>
  )
}

function Field({ label, help, children }: { label: string; help?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-gray-700">{label}</span>
      {help && <span className="block text-xs text-gray-400">{help}</span>}
      <span className="mt-1 block">{children}</span>
    </label>
  )
}

function Thumb({ ean }: { ean: string }) {
  const [broken, setBroken] = useState(false)
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gray-50">
      {!broken ? <img src={resolveApiUrl(`/thumbs/products/${ean}.webp`)} alt="" loading="lazy" className="h-full w-full object-contain" onError={() => setBroken(true)} /> : <ImageOff size={13} className="text-gray-300" />}
    </span>
  )
}

