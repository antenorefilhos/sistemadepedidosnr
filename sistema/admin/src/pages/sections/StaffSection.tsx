import { useCallback, useEffect, useState } from 'react'
import { Eye, EyeOff, Plus, RefreshCw, Save, UserCheck, UserX, Users } from 'lucide-react'
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

export default function StaffSection() {
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filterRole, setFilterRole] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'picker' })
  const [saving, setSaving] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

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

  const filtered = filterRole ? staff.filter(s => s.role === filterRole) : staff
  const pickers = staff.filter(s => s.role === 'picker' && s.active).length
  const drivers = staff.filter(s => s.role === 'driver' && s.active).length
  const admins = staff.filter(s => s.role === 'admin' && s.active).length

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
      } else {
        if (!form.password || form.password.length < 6) {
          setError('Senha deve ter no minimo 6 caracteres')
          setSaving(false)
          return
        }
        await staffAPI.create(form)
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
      <div className="flex flex-wrap gap-3">
        <SectionMetric label="Separadores" value={pickers} tone="default" />
        <SectionMetric label="Entregadores" value={drivers} tone="default" />
        <SectionMetric label="Admins" value={admins} tone="default" />
      </div>

      <SectionToolbar>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={filterRole} onChange={(e) => setFilterRole(e.target.value)}>
            <option value="">Todas as funcoes</option>
            <option value="picker">Separadores</option>
            <option value="driver">Entregadores</option>
            <option value="admin">Administradores</option>
          </Select>
          <Button variant="ghost" onClick={loadStaff} disabled={loading}>
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
                  placeholder={editingId ? 'Nova senha (deixe vazio para manter)' : 'Senha (min 6 caracteres)'}
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={(e) => setForm(f => ({ ...f, password: e.target.value }))}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
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
          description="Clique em 'Novo Membro' para adicionar separadores, entregadores ou administradores."
        />
      ) : (
        <SectionPanel>
          <div className="divide-y divide-[#f5e6ec]">
            {filtered.map(m => (
              <div key={m.id} className="px-4 py-3 flex items-center gap-3 hover:bg-[#fdf5f8] transition-colors">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${m.active ? 'bg-[#f5e6ec]' : 'bg-gray-100'}`}>
                  <Users size={16} className={m.active ? 'text-[#8b1a42]' : 'text-gray-400'} />
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
