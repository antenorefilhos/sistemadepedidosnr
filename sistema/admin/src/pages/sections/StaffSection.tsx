import { useCallback, useEffect, useMemo, useState } from 'react'
import { Eye, EyeOff, Plus, RefreshCw, Save, Search, ShieldCheck, UserCheck, UserX, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { getApiErrorMessage, staffAPI, type PermissionCatalogItem, type StaffMember } from '../../services/api'
import { SectionEmptyState, SectionMetric, SectionPanel, SectionToolbar } from './SectionChrome'

const MODULES = [
  { key: 'admin', label: 'Admin', hint: 'Painel administrativo (esta tela)' },
  { key: 'picking', label: 'Separação', hint: 'App de separação de pedidos' },
  { key: 'delivery', label: 'Entrega', hint: 'App do motorista' },
] as const

const MODULE_COLORS: Record<string, string> = {
  admin: 'bg-purple-100 text-purple-800',
  picking: 'bg-blue-100 text-blue-800',
  delivery: 'bg-green-100 text-green-800',
}

const MODULE_LABELS: Record<string, string> = {
  admin: 'Admin',
  picking: 'Separação',
  delivery: 'Entrega',
}

const PERMISSION_GROUP_LABELS: Record<string, string> = {
  orders: 'Pedidos',
  picking: 'Separação',
  catalog: 'Catálogo',
  pricing: 'Preços',
  customers: 'Clientes',
  integrations: 'Integrações',
  inventory: 'Estoque',
  promotions: 'Promoções',
  reports: 'Relatórios',
  audit: 'Auditoria',
  settings: 'Configurações',
  users: 'Usuários',
  crm: 'CRM',
}

type StaffForm = {
  name: string
  email: string
  password: string
  isMaster: boolean
  moduleAccess: string[]
  permissions: string[]
}

const EMPTY_FORM: StaffForm = { name: '', email: '', password: '', isMaster: false, moduleAccess: [], permissions: [] }

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function groupPermissions(items: PermissionCatalogItem[]) {
  const groups = new Map<string, PermissionCatalogItem[]>()
  for (const item of items) {
    const prefix = item.key.split('.')[0]
    if (!groups.has(prefix)) groups.set(prefix, [])
    groups.get(prefix)!.push(item)
  }
  return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b))
}

export default function StaffSection() {
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [permissionCatalog, setPermissionCatalog] = useState<PermissionCatalogItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filterModule, setFilterModule] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all')
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<StaffForm>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [toast, setToast] = useState<{ tone: 'success' | 'error'; message: string } | null>(null)

  const loadStaff = useCallback(async () => {
    setLoading(true)
    try {
      const [staffRes, permissionsRes] = await Promise.all([staffAPI.list(), staffAPI.listPermissions()])
      setStaff(staffRes.data)
      setPermissionCatalog(permissionsRes.data)
      setError('')
    } catch (err) {
      setError(getApiErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadStaff() }, [loadStaff])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3000)
    return () => clearTimeout(t)
  }, [toast])

  const permissionGroups = useMemo(() => groupPermissions(permissionCatalog), [permissionCatalog])

  const memberModules = (m: StaffMember) => (m.role === 'admin' ? ['admin', 'picking', 'delivery'] : m.moduleAccess || [])

  const filtered = useMemo(() => {
    let list = staff
    if (filterModule) list = list.filter(s => memberModules(s).includes(filterModule))
    if (filterStatus !== 'all') list = list.filter(s => (filterStatus === 'active' ? s.active : !s.active))
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(s => s.name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q))
    }
    return list
  }, [staff, filterModule, filterStatus, search])

  // Conta so quem tem o modulo de verdade no moduleAccess -- nao usa memberModules()
  // aqui porque ele "infla" admin/master em todo modulo (acesso implicito via guard),
  // o que faria "Acesso Separacao"/"Acesso Entrega" contar o master junto com quem
  // realmente é separador/entregador.
  const countByModule = (moduleKey: string) =>
    staff.filter(s => s.active && (moduleKey === 'admin' ? s.role === 'admin' : (s.moduleAccess || []).includes(moduleKey))).length
  const masters = staff.filter(s => s.role === 'admin' && s.active).length
  const inactive = staff.filter(s => !s.active).length

  const resetForm = () => { setForm(EMPTY_FORM); setEditingId(null) }

  const toggleModule = (key: string) => {
    setForm(f => ({
      ...f,
      moduleAccess: f.moduleAccess.includes(key) ? f.moduleAccess.filter(m => m !== key) : [...f.moduleAccess, key],
    }))
  }

  const togglePermission = (key: string) => {
    setForm(f => ({
      ...f,
      permissions: f.permissions.includes(key) ? f.permissions.filter(p => p !== key) : [...f.permissions, key],
    }))
  }

  const handleSave = async () => {
    if (!form.name || !form.email) return
    if (!form.isMaster && form.moduleAccess.length === 0) {
      setError('Selecione pelo menos um módulo de acesso.')
      return
    }
    setSaving(true)
    try {
      const role = form.isMaster ? 'admin' : 'staff'
      if (editingId) {
        const payload: Record<string, unknown> = { name: form.name, email: form.email, role }
        if (form.password) payload.password = form.password
        if (!form.isMaster) {
          payload.moduleAccess = form.moduleAccess
          payload.permissions = form.permissions
        }
        await staffAPI.update(editingId, payload)
        setToast({ tone: 'success', message: 'Membro atualizado.' })
      } else {
        if (!form.password || form.password.length < 6) {
          setError('Senha deve ter no mínimo 6 caracteres')
          setSaving(false)
          return
        }
        await staffAPI.create({
          name: form.name,
          email: form.email,
          password: form.password,
          role,
          ...(form.isMaster ? {} : { moduleAccess: form.moduleAccess, permissions: form.permissions }),
        })
        setToast({ tone: 'success', message: 'Membro criado.' })
      }
      setShowForm(false)
      resetForm()
      await loadStaff()
    } catch (err) {
      setError(getApiErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const handleToggle = async (id: string) => {
    try {
      await staffAPI.toggleActive(id)
      await loadStaff()
      setToast({ tone: 'success', message: 'Status alterado.' })
    } catch (err) {
      setError(getApiErrorMessage(err))
    }
  }

  const handleEdit = (m: StaffMember) => {
    setEditingId(m.id)
    setForm({
      name: m.name,
      email: m.email,
      password: '',
      isMaster: m.role === 'admin',
      moduleAccess: m.moduleAccess || [],
      permissions: m.permissions || [],
    })
    setShowForm(true)
  }

  return (
    <div className="space-y-4">
      {toast && (
        <div className={`fixed bottom-4 right-4 z-50 flex items-center gap-2 px-4 py-2.5 rounded-lg border shadow-lg text-sm ${
          toast.tone === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          {toast.message}
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <SectionMetric label="Acesso Admin" value={countByModule('admin')} tone="default" />
        <SectionMetric label="Acesso Separação" value={countByModule('picking')} tone="default" />
        <SectionMetric label="Acesso Entrega" value={countByModule('delivery')} tone="default" />
        <SectionMetric label="Masters" value={masters} tone="default" />
        <SectionMetric label="Inativos" value={inactive} tone={inactive > 0 ? 'warning' as any : 'default'} />
      </div>

      <SectionToolbar>
        <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap flex-1">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <Input
              type="search"
              placeholder="Buscar por nome ou email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                aria-label="Limpar busca"
              >
                <X size={14} />
              </button>
            )}
          </div>
          <Select value={filterModule} onChange={(e) => setFilterModule(e.target.value)} className="w-44">
            <option value="">Todos os módulos</option>
            <option value="admin">Acesso Admin</option>
            <option value="picking">Acesso Separação</option>
            <option value="delivery">Acesso Entrega</option>
          </Select>
          <Select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as any)} className="w-32">
            <option value="all">Todos</option>
            <option value="active">Ativos</option>
            <option value="inactive">Inativos</option>
          </Select>
          <Button variant="ghost" onClick={loadStaff} disabled={loading} aria-label="Atualizar lista">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </Button>
        </div>
        <Button onClick={() => { setShowForm(true); resetForm() }}>
          <Plus size={14} />
          <span className="ml-1">Novo Membro</span>
        </Button>
        </div>
      </SectionToolbar>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-2">
          {error}
          <button onClick={() => setError('')} className="ml-2 font-medium underline">fechar</button>
        </div>
      )}

      {showForm && (
        <SectionPanel>
          <div className="p-4 space-y-4">
            <p className="font-semibold text-[#2d0b18]">
              {editingId ? 'Editar Membro' : 'Novo Membro da Equipe'}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                placeholder="Nome completo"
                value={form.name}
                onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
              />
              <Input
                placeholder="Email"
                type="email"
                value={form.email}
                onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))}
              />
              <div className="relative">
                <Input
                  placeholder={editingId ? 'Nova senha (deixe vazio para manter)' : 'Senha (mín. 6 caracteres)'}
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={(e) => setForm(f => ({ ...f, password: e.target.value }))}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <label className="flex items-start gap-2.5 rounded-lg border border-purple-200 bg-purple-50 px-3 py-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={form.isMaster}
                onChange={(e) => setForm(f => ({ ...f, isMaster: e.target.checked }))}
                className="mt-0.5"
              />
              <span>
                <span className="flex items-center gap-1.5 font-semibold text-purple-900 text-sm">
                  <ShieldCheck size={14} /> Administrador Master
                </span>
                <span className="text-xs text-purple-700">Acesso total a todos os módulos e permissões, sem restrição. Reserve para poucas contas.</span>
              </span>
            </label>

            {!form.isMaster && (
              <>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-2">Módulos de acesso</p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {MODULES.map(mod => (
                      <label
                        key={mod.key}
                        className={`flex items-start gap-2 rounded-lg border px-3 py-2.5 cursor-pointer transition-colors ${
                          form.moduleAccess.includes(mod.key) ? 'border-[#5D082A]/40 bg-[#fff5f8]' : 'border-gray-200 bg-white'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={form.moduleAccess.includes(mod.key)}
                          onChange={() => toggleModule(mod.key)}
                          className="mt-0.5"
                        />
                        <span>
                          <span className="block text-sm font-semibold text-gray-800">{mod.label}</span>
                          <span className="block text-xs text-gray-500">{mod.hint}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-2">
                    Permissões dentro dos módulos ({form.permissions.length} selecionadas)
                  </p>
                  <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-72 overflow-y-auto">
                    {permissionGroups.map(([group, items]) => (
                      <div key={group} className="p-3">
                        <p className="text-xs font-bold text-[#5D082A] mb-1.5">{PERMISSION_GROUP_LABELS[group] || group}</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                          {items.map(item => (
                            <label key={item.key} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={form.permissions.includes(item.key)}
                                onChange={() => togglePermission(item.key)}
                              />
                              {item.description || item.key}
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                    {permissionGroups.length === 0 && (
                      <p className="text-xs text-gray-400 p-3">Nenhuma permissão cadastrada.</p>
                    )}
                  </div>
                </div>
              </>
            )}

            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={() => { setShowForm(false); resetForm() }}>Cancelar</Button>
              <Button onClick={handleSave} disabled={saving || !form.name || !form.email}>
                <Save size={14} />
                <span className="ml-1">{saving ? 'Salvando...' : editingId ? 'Salvar' : 'Criar'}</span>
              </Button>
            </div>
          </div>
        </SectionPanel>
      )}

      {filtered.length === 0 && !loading ? (
        <SectionEmptyState
          title="Nenhum membro encontrado"
          description={search || filterModule || filterStatus !== 'all' ? 'Ajuste os filtros ou crie um novo membro.' : "Clique em 'Novo Membro' para dar acesso a separadores, entregadores ou outros administradores."}
        />
      ) : (
        <SectionPanel>
          <div className="divide-y divide-[#f5e6ec]">
            {filtered.map(m => (
              <div key={m.id} className="px-4 py-3 flex items-center gap-3 hover:bg-[#fdf5f8] transition-colors">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold ${
                    m.active ? 'bg-[#f5e6ec] text-[#8b1a42]' : 'bg-gray-100 text-gray-400'
                  }`}
                  aria-hidden="true"
                >
                  {getInitials(m.name)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`font-medium text-sm truncate ${m.active ? 'text-[#2d0b18]' : 'text-gray-400 line-through'}`}>
                    {m.name}
                  </p>
                  <p className="text-xs text-gray-500 truncate">{m.email}</p>
                </div>
                <div className="flex gap-1 flex-wrap justify-end max-w-[220px]">
                  {m.role === 'admin' ? (
                    <Badge className="text-xs bg-purple-100 text-purple-800 flex items-center gap-1">
                      <ShieldCheck size={11} /> Master
                    </Badge>
                  ) : (memberModules(m).length === 0 ? (
                    <Badge className="text-xs bg-gray-100 text-gray-500">Sem módulo</Badge>
                  ) : (
                    memberModules(m).map(mod => (
                      <Badge key={mod} className={`text-xs ${MODULE_COLORS[mod] || 'bg-gray-100 text-gray-600'}`}>
                        {MODULE_LABELS[mod] || mod}
                      </Badge>
                    ))
                  ))}
                </div>
                {!m.active && (
                  <Badge className="text-xs bg-gray-200 text-gray-600">Inativo</Badge>
                )}
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" onClick={() => handleEdit(m)} className="text-xs">
                    Editar
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (m.active && !window.confirm(`Desativar o acesso de ${m.name}?`)) return
                      handleToggle(m.id)
                    }}
                    className={`text-xs ${m.active ? 'text-red-600 hover:text-red-700' : 'text-green-600 hover:text-green-700'}`}
                  >
                    {m.active ? <UserX size={14} /> : <UserCheck size={14} />}
                    <span className="ml-1">{m.active ? 'Desativar' : 'Ativar'}</span>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </SectionPanel>
      )}
    </div>
  )
}
