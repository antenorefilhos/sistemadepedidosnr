import { useCallback, useEffect, useMemo, useState } from 'react'
import { Eye, EyeOff, Plus, RefreshCw, Save, Search, UserCheck, UserX, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { getApiErrorMessage, staffAPI, type StaffMember } from '../../services/api'
import { SectionEmptyState, SectionMetric, SectionPanel, SectionToolbar } from './SectionChrome'

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrador',
  picker: 'Separador',
  driver: 'Entregador',
}

const ROLE_COLORS: Record<string, string> = {
  admin: 'bg-purple-100 text-purple-800',
  picker: 'bg-blue-100 text-blue-800',
  driver: 'bg-green-100 text-green-800',
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export default function StaffSection() {
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filterRole, setFilterRole] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all')
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'picker' })
  const [saving, setSaving] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [toast, setToast] = useState<{ tone: 'success' | 'error'; message: string } | null>(null)

  const loadStaff = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await staffAPI.list()
      setStaff(data)
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

  const filtered = useMemo(() => {
    let list = staff
    if (filterRole) list = list.filter(s => s.role === filterRole)
    if (filterStatus !== 'all') list = list.filter(s => (filterStatus === 'active' ? s.active : !s.active))
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(s => s.name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q))
    }
    return list
  }, [staff, filterRole, filterStatus, search])

  const pickers = staff.filter(s => s.role === 'picker' && s.active).length
  const drivers = staff.filter(s => s.role === 'driver' && s.active).length
  const admins = staff.filter(s => s.role === 'admin' && s.active).length
  const inactive = staff.filter(s => !s.active).length

  const handleSave = async () => {
    if (!form.name || !form.email) return
    setSaving(true)
    try {
      if (editingId) {
        const payload: Record<string, string> = {}
        if (form.name) payload.name = form.name
        if (form.email) payload.email = form.email
        if (form.role) payload.role = form.role
        if (form.password) payload.password = form.password
        await staffAPI.update(editingId, payload)
        setToast({ tone: 'success', message: 'Membro atualizado.' })
      } else {
        if (!form.password || form.password.length < 6) {
          setError('Senha deve ter no mínimo 6 caracteres')
          setSaving(false)
          return
        }
        await staffAPI.create(form)
        setToast({ tone: 'success', message: 'Membro criado.' })
      }
      setShowForm(false)
      setEditingId(null)
      setForm({ name: '', email: '', password: '', role: 'picker' })
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
    setForm({ name: m.name, email: m.email, password: '', role: m.role })
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
        <SectionMetric label="Separadores" value={pickers} tone="default" />
        <SectionMetric label="Entregadores" value={drivers} tone="default" />
        <SectionMetric label="Admins" value={admins} tone="default" />
        <SectionMetric label="Inativos" value={inactive} tone={inactive > 0 ? 'warning' as any : 'default'} />
      </div>

      <SectionToolbar>
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
          <Select value={filterRole} onChange={(e) => setFilterRole(e.target.value)} className="w-40">
            <option value="">Todas as funções</option>
            <option value="picker">Separadores</option>
            <option value="driver">Entregadores</option>
            <option value="admin">Administradores</option>
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
        <Button onClick={() => { setShowForm(true); setEditingId(null); setForm({ name: '', email: '', password: '', role: 'picker' }) }}>
          <Plus size={14} />
          <span className="ml-1">Novo Membro</span>
        </Button>
      </SectionToolbar>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-2">
          {error}
          <button onClick={() => setError('')} className="ml-2 font-medium underline">fechar</button>
        </div>
      )}

      {showForm && (
        <SectionPanel>
          <div className="p-4 space-y-3">
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
              <Select value={form.role} onChange={(e) => setForm(f => ({ ...f, role: e.target.value }))}>
                <option value="picker">Separador</option>
                <option value="driver">Entregador</option>
                <option value="admin">Administrador</option>
              </Select>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={() => { setShowForm(false); setEditingId(null) }}>Cancelar</Button>
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
          description={search || filterRole || filterStatus !== 'all' ? 'Ajuste os filtros ou crie um novo membro.' : "Clique em 'Novo Membro' para adicionar separadores, entregadores ou administradores."}
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
                <Badge className={`text-xs ${ROLE_COLORS[m.role] || 'bg-gray-100 text-gray-600'}`}>
                  {ROLE_LABELS[m.role] || m.role}
                </Badge>
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
                    onClick={() => handleToggle(m.id)}
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
