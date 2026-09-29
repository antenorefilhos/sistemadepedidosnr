import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertCircle, Eye, EyeOff, Plus, Search } from 'lucide-react'
import { getApiErrorMessage, staffAPI, type StaffMember } from '../../services/api'
import { useAuth } from '../../hooks/useAuth'

// Equipe (refeita em 29/09/2026 com o Jonathan). Mesmos acessos de antes, tela
// honesta: o que a pessoa faz (separa, entrega, administra), se esta ativa e
// quando usou pela ultima vez. Sairam as 23 "permissoes dentro dos modulos":
// so o master entra no painel, e ele ja tem tudo -- as caixinhas nao mudavam
// nada na pratica.

type Form = { name: string; email: string; password: string; isMaster: boolean; picking: boolean; delivery: boolean }
const EMPTY: Form = { name: '', email: '', password: '', isMaster: false, picking: false, delivery: false }

function lastSeen(iso?: string | null) {
  if (!iso) return 'nunca usou'
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (min < 15) return 'usando agora'
  if (min < 60) return `há ${min} min`
  if (min < 1440) return `há ${Math.floor(min / 60)} h`
  const d = Math.floor(min / 1440)
  return d === 1 ? 'ontem' : `há ${d} dias`
}

function roles(m: StaffMember) {
  if (m.role === 'admin') return 'Administrador · acesso total'
  const parts = [(m.moduleAccess || []).includes('picking') && 'Separa pedidos', (m.moduleAccess || []).includes('delivery') && 'Faz entregas'].filter(Boolean)
  return parts.length ? parts.join(' · ') : 'Sem acesso a nenhum app'
}

export default function StaffSection() {
  const { getAdminData } = useAuth()
  const me = getAdminData()
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [showInactive, setShowInactive] = useState(false)
  const [editing, setEditing] = useState<StaffMember | 'new' | null>(null)
  const [form, setForm] = useState<Form>(EMPTY)
  const [showPassword, setShowPassword] = useState(false)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await staffAPI.list()
      setStaff(res.data)
      setError('')
    } catch (e) {
      setError(getApiErrorMessage(e, 'Não foi possível carregar a equipe.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const inactiveCount = staff.filter((s) => !s.active).length
  const list = useMemo(() => {
    const q = search.trim().toLowerCase()
    return staff
      .filter((s) => showInactive || s.active)
      .filter((s) => !q || s.name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q))
      .sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name, 'pt-BR'))
  }, [staff, search, showInactive])

  const openNew = () => {
    setForm(EMPTY)
    setShowPassword(false)
    setEditing('new')
  }
  const openEdit = (m: StaffMember) => {
    setForm({
      name: m.name,
      email: m.email,
      password: '',
      isMaster: m.role === 'admin',
      picking: (m.moduleAccess || []).includes('picking'),
      delivery: (m.moduleAccess || []).includes('delivery'),
    })
    setShowPassword(false)
    setEditing(m)
  }

  const isNew = editing === 'new'
  const editingMaster = editing !== null && editing !== 'new' && editing.role === 'admin'
  // O servidor nao deixa editar a conta de OUTRO administrador (protecao contra tomada de conta).
  const blocked = editingMaster && editing?.id !== me?.id
  const moduleAccess = [form.picking && 'picking', form.delivery && 'delivery'].filter(Boolean) as string[]
  const valid = form.name.trim() && form.email.trim() && (form.isMaster || moduleAccess.length > 0) && (!isNew || form.password.length >= 6) && (!form.password || form.password.length >= 6)

  const save = async () => {
    if (!editing || !valid) return
    setSaving(true)
    setError('')
    try {
      if (editing === 'new') {
        await staffAPI.create({
          name: form.name.trim(),
          email: form.email.trim(),
          password: form.password,
          role: form.isMaster ? 'admin' : 'staff',
          ...(form.isMaster ? {} : { moduleAccess }),
        })
      } else {
        await staffAPI.update(editing.id, {
          name: form.name.trim(),
          email: form.email.trim(),
          ...(form.password ? { password: form.password } : {}),
          ...(editing.role === 'admin' ? {} : { moduleAccess }),
        })
      }
      setEditing(null)
      await load()
    } catch (e) {
      setError(getApiErrorMessage(e, 'Não foi possível salvar.'))
    } finally {
      setSaving(false)
    }
  }

  const toggle = async (m: StaffMember) => {
    if (m.active && !window.confirm(`Desativar o acesso de ${m.name}? A sessão dessa pessoa cai na hora, inclusive nos apps.`)) return
    try {
      await staffAPI.toggleActive(m.id)
      await load()
    } catch (e) {
      setError(getApiErrorMessage(e, 'Não foi possível mudar o acesso.'))
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative min-w-[200px] flex-1">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nome ou e-mail" className="h-10 w-full rounded-xl border border-black/[0.06] bg-white pl-9 pr-3 text-sm outline-none focus:border-gray-400" />
        </label>
        {inactiveCount > 0 && (
          <label className="flex items-center gap-2 rounded-xl border border-black/[0.06] bg-white px-3 py-2 text-sm text-gray-600">
            <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
            Mostrar inativos ({inactiveCount})
          </label>
        )}
        <button type="button" onClick={openNew} className="inline-flex items-center gap-1.5 rounded-xl bg-gray-900 px-3.5 py-2 text-sm text-white hover:bg-gray-800">
          <Plus size={15} /> Nova pessoa
        </button>
      </div>

      {error && (
        <p role="alert" className="flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">
          <AlertCircle size={16} /> {error}
        </p>
      )}

      {loading ? (
        <div className="h-40 animate-pulse rounded-2xl bg-white/70" />
      ) : list.length === 0 ? (
        <p className="rounded-2xl border border-black/[0.06] bg-white p-8 text-center text-sm text-gray-400">Ninguém encontrado.</p>
      ) : (
        <ul className="divide-y divide-black/[0.05] overflow-hidden rounded-2xl border border-black/[0.06] bg-white">
          {list.map((m) => {
            const isMaster = m.role === 'admin'
            return (
              <li key={m.id} className={`flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 ${m.active ? '' : 'opacity-50'}`}>
                <button type="button" onClick={() => openEdit(m)} className="min-w-0 flex-1 text-left">
                  <span className="block text-sm text-gray-900">
                    {m.name}
                    {m.id === me?.id && <span className="text-gray-400"> · você</span>}
                    {!m.active && <span className="text-gray-400"> · inativo</span>}
                  </span>
                  <span className="block truncate text-xs text-gray-500">{m.email}</span>
                  <span className="block text-xs text-gray-500">{roles(m)}</span>
                </button>
                <span className="text-xs tabular-nums text-gray-500">{lastSeen(m.lastSeenAt)}</span>
                {!isMaster && (
                  <button
                    type="button"
                    onClick={() => toggle(m)}
                    className={`rounded-xl px-3 py-1.5 text-xs ${m.active ? 'text-rose-700 hover:bg-rose-50' : 'text-gray-800 hover:bg-gray-100'}`}
                  >
                    {m.active ? 'Desativar' : 'Reativar'}
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      )}
      <p className="text-xs text-gray-400">"Último uso" conta qualquer uso do painel ou dos apps, e começou a ser registrado em 29/09/2026.</p>

      {editing && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/30 sm:items-center sm:p-4">
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white p-5 sm:rounded-2xl">
            <h3 className="text-base font-semibold text-gray-900">{isNew ? 'Nova pessoa' : form.name || 'Editar'}</h3>

            {blocked ? (
              <p className="mt-3 text-sm text-gray-600">Contas de administrador só podem ser editadas pela própria pessoa, para ninguém conseguir trocar a senha de outro administrador.</p>
            ) : (
              <div className="mt-4 space-y-3">
                <label className="block text-xs text-gray-500">
                  Nome
                  <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1 h-10 w-full rounded-xl border border-black/[0.08] px-3 text-sm text-gray-900" />
                </label>
                <label className="block text-xs text-gray-500">
                  E-mail de acesso
                  <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="mt-1 h-10 w-full rounded-xl border border-black/[0.08] px-3 text-sm text-gray-900" />
                </label>
                <label className="block text-xs text-gray-500">
                  {isNew ? 'Senha (mínimo 6 caracteres)' : 'Nova senha (deixe em branco para manter)'}
                  <span className="relative mt-1 block">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={form.password}
                      onChange={(e) => setForm({ ...form, password: e.target.value })}
                      autoComplete="new-password"
                      className="h-10 w-full rounded-xl border border-black/[0.08] px-3 pr-10 text-sm text-gray-900"
                    />
                    <button type="button" onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </span>
                  {!isNew && form.password && <span className="mt-1 block text-gray-400">Trocar a senha encerra as sessões abertas dessa pessoa.</span>}
                </label>

                <fieldset className="space-y-2">
                  <legend className="mb-1 text-xs text-gray-500">O que essa pessoa faz</legend>
                  {editingMaster ? (
                    <p className="rounded-xl bg-gray-50 p-3 text-sm text-gray-700">Administrador · acesso total ao painel e aos apps.</p>
                  ) : (
                    <>
                      <label className="flex items-start gap-3 rounded-xl border border-black/[0.08] p-3 text-sm">
                        <input type="checkbox" className="mt-0.5" checked={form.picking} disabled={form.isMaster} onChange={(e) => setForm({ ...form, picking: e.target.checked })} />
                        <span><span className="block text-gray-900">Separa pedidos</span><span className="block text-xs text-gray-500">Usa o app de separação</span></span>
                      </label>
                      <label className="flex items-start gap-3 rounded-xl border border-black/[0.08] p-3 text-sm">
                        <input type="checkbox" className="mt-0.5" checked={form.delivery} disabled={form.isMaster} onChange={(e) => setForm({ ...form, delivery: e.target.checked })} />
                        <span><span className="block text-gray-900">Faz entregas</span><span className="block text-xs text-gray-500">Usa o app do entregador</span></span>
                      </label>
                      {isNew && (
                        <label className="flex items-start gap-3 rounded-xl border border-black/[0.08] p-3 text-sm">
                          <input type="checkbox" className="mt-0.5" checked={form.isMaster} onChange={(e) => setForm({ ...form, isMaster: e.target.checked })} />
                          <span><span className="block text-gray-900">Administrador</span><span className="block text-xs text-gray-500">Acesso total ao painel e aos apps. Crie só para quem realmente precisa.</span></span>
                        </label>
                      )}
                    </>
                  )}
                </fieldset>
              </div>
            )}

            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setEditing(null)} className="rounded-xl px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">{blocked ? 'Fechar' : 'Cancelar'}</button>
              {!blocked && (
                <button type="button" disabled={!valid || saving} onClick={save} className="rounded-xl bg-gray-900 px-4 py-2 text-sm text-white disabled:opacity-40">
                  {saving ? 'Salvando…' : isNew ? 'Criar' : 'Salvar'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
