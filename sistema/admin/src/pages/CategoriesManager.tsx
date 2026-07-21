import { Fragment, useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cmsAPI, uploadsAPI, resolveApiUrl, getApiErrorMessage } from '../services/api'
import {
  AlertTriangle,
  GripVertical,
  Image as ImageIcon,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  RefreshCw,
  X,
  Tag,
  LayoutGrid,
  Check,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Category {
  id: string
  name: string
  parentId?: string | null
  bannerUrl?: string | null
  active: boolean
  priority: number
  limit: number
  curatedProductIds?: string[]
}

type EanMappingSuggestion = {
  ean: string
  productName: string
  categoryId: string
  categoryName: string
  source: 'product.category' | 'mercadological_inference'
  reason: string
}

type EanMappingWorkflowResult = {
  success: boolean
  dryRun: boolean
  applied: number
  validation?: {
    valid: boolean
    total: number
    errors: Array<{ index: number; ean: string; error: string }>
    warnings: Array<{ index: number; ean: string; warning: string }>
  }
}

type PendingCategoryMappingItem = {
  id: string
  ean: string
  productName: string
  suggestedCategoryN1: string | null
  suggestedCategoryN2: string | null
  suggestedCategory?: { id: string; name: string } | null
  reason: string
  notes?: string | null
  createdAt: string
}

type MappingStats = {
  mapped: number
  pending: number
  total: number
  unmapped: number
}

// ─── Tab: Gerenciar Categorias ────────────────────────────────────────────────


// Utilitário para montar árvore de categorias
function buildCategoryTree(categories: Category[]): CategoryTreeNode[] {
  const map = new Map<string, CategoryTreeNode>()
  const roots: CategoryTreeNode[] = []
  categories.forEach((cat) => {
    map.set(cat.id, { ...cat, children: [] })
  })
  map.forEach((node) => {
    if (node.parentId && map.has(node.parentId)) {
      map.get(node.parentId)!.children.push(node)
    } else {
      roots.push(node)
    }
  })

  const sortByPriority = (a: CategoryTreeNode, b: CategoryTreeNode) => {
    if (a.priority !== b.priority) return a.priority - b.priority
    return a.name.localeCompare(b.name)
  }

  const sortRecursively = (nodes: CategoryTreeNode[]) => {
    nodes.sort(sortByPriority)
    for (const node of nodes) {
      if (node.children.length > 0) sortRecursively(node.children)
    }
  }

  sortRecursively(roots)
  return roots
}

type CategoryTreeNode = Category & { children: CategoryTreeNode[] }

function CategoriesTab() {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState<string | null>(null)
  const [uploading, setUploading] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<Category | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [draggedCategoryId, setDraggedCategoryId] = useState<string | null>(null)
  const [dropTargetCategoryId, setDropTargetCategoryId] = useState<string | null>(null)
  const [reordering, setReordering] = useState(false)
  const [actionError, setActionError] = useState('')

  // Form de nova categoria
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [newPriority, setNewPriority] = useState(0)
  const [newLimit, setNewLimit] = useState(6)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')

  // Edição inline de nome
  const [editingNameId, setEditingNameId] = useState<string | null>(null)
  const [editingNameValue, setEditingNameValue] = useState('')

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await cmsAPI.categories.getAll()
      setCategories(res.data || [])
    } catch {
      setError('Falha ao carregar categorias.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const handleCreate = async () => {
    if (!newName.trim()) { setCreateError('Nome obrigatório.'); return }
    setCreating(true)
    setCreateError('')
    setActionError('')
    try {
      await cmsAPI.categories.create({ name: newName.trim(), priority: newPriority, limit: newLimit })
      setShowCreate(false)
      setNewName('')
      setNewPriority(0)
      setNewLimit(6)
      await load()
    } catch (e: any) {
      setCreateError(getApiErrorMessage(e, 'Erro ao criar categoria.'))
    } finally {
      setCreating(false)
    }
  }

  const handleToggle = async (id: string, active: boolean) => {
    setSaving(id)
    setActionError('')
    try {
      await cmsAPI.categories.update(id, { active })
      setCategories((prev) => prev.map((c) => (c.id === id ? { ...c, active } : c)))
    } finally {
      setSaving(null)
    }
  }

  const handleFieldBlur = async (id: string, field: 'priority' | 'limit', value: number) => {
    const cat = categories.find((c) => c.id === id)
    if (!cat || cat[field] === value) return
    setSaving(id)
    setActionError('')
    try {
      await cmsAPI.categories.update(id, { [field]: value })
      setCategories((prev) => prev.map((c) => (c.id === id ? { ...c, [field]: value } : c)))
    } finally {
      setSaving(null)
    }
  }

  const handleSaveName = async (id: string) => {
    const trimmed = editingNameValue.trim()
    if (!trimmed) { setEditingNameId(null); return }
    setSaving(id)
    setActionError('')
    try {
      await cmsAPI.categories.update(id, { name: trimmed })
      setCategories((prev) => prev.map((c) => (c.id === id ? { ...c, name: trimmed } : c)))
    } finally {
      setSaving(null)
      setEditingNameId(null)
    }
  }

  const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>, id: string) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(id)
    setActionError('')
    try {
      const uploadRes = await uploadsAPI.upload(file)
      await cmsAPI.categories.update(id, { bannerUrl: uploadRes.data.url })
      setCategories((prev) => prev.map((c) => (c.id === id ? { ...c, bannerUrl: uploadRes.data.url } : c)))
    } finally {
      setUploading(null)
    }
  }

  const handleDelete = async () => {
    if (!pendingDelete) return
    setDeleting(true)
    setActionError('')
    try {
      await cmsAPI.categories.remove(pendingDelete.id)
      setCategories((prev) => prev.filter((c) => c.id !== pendingDelete.id))
      setPendingDelete(null)
    } catch (e: any) {
      setActionError(getApiErrorMessage(e, 'Erro ao excluir categoria.'))
    } finally {
      setDeleting(false)
    }
  }

  const getSiblingsSorted = (parentId?: string | null) => {
    return categories
      .filter((category) => (category.parentId ?? null) === (parentId ?? null))
      .slice()
      .sort((a, b) => {
        if (a.priority !== b.priority) return a.priority - b.priority
        return a.name.localeCompare(b.name)
      })
  }

  const reorderByDragAndDrop = async (targetCategoryId: string) => {
    if (!draggedCategoryId || draggedCategoryId === targetCategoryId) return

    const dragged = categories.find((category) => category.id === draggedCategoryId)
    const target = categories.find((category) => category.id === targetCategoryId)
    if (!dragged || !target) return

    // Mantém a operação dentro do mesmo nível da árvore (mesmo parentId).
    if ((dragged.parentId ?? null) !== (target.parentId ?? null)) return

    const siblings = getSiblingsSorted(dragged.parentId)
    const fromIndex = siblings.findIndex((category) => category.id === dragged.id)
    const toIndex = siblings.findIndex((category) => category.id === target.id)
    if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return

    const reordered = siblings.slice()
    const [moved] = reordered.splice(fromIndex, 1)
    reordered.splice(toIndex, 0, moved)

    const nextPriorityById = new Map<string, number>()
    reordered.forEach((category, index) => {
      nextPriorityById.set(category.id, index)
    })

    const changed = reordered.filter((category) => category.priority !== nextPriorityById.get(category.id))
    if (changed.length === 0) return

    const previous = categories
    setReordering(true)
    setActionError('')
    setCategories((prev) =>
      prev.map((category) => {
        const nextPriority = nextPriorityById.get(category.id)
        return typeof nextPriority === 'number' ? { ...category, priority: nextPriority } : category
      }),
    )

    try {
      await Promise.all(
        changed.map((category) =>
          cmsAPI.categories.update(category.id, { priority: nextPriorityById.get(category.id) }),
        ),
      )
    } catch {
      setCategories(previous)
      setActionError('Não foi possível reordenar as categorias agora. Tente novamente.')
    } finally {
      setReordering(false)
    }
  }

  // Expande/recolhe nó
  const toggleExpand = (id: string) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  // Renderização recursiva da árvore
  function renderTree(nodes: CategoryTreeNode[], depth = 0): JSX.Element[] {
    return nodes.map((cat) => (
      <Fragment key={cat.id}>
        <TableRow
          draggable={!reordering}
          onDragStart={() => setDraggedCategoryId(cat.id)}
          onDragEnd={() => {
            setDraggedCategoryId(null)
            setDropTargetCategoryId(null)
          }}
          onDragOver={(event) => {
            event.preventDefault()
            if (draggedCategoryId !== cat.id) setDropTargetCategoryId(cat.id)
          }}
          onDrop={async (event) => {
            event.preventDefault()
            await reorderByDragAndDrop(cat.id)
            setDraggedCategoryId(null)
            setDropTargetCategoryId(null)
          }}
          className={`transition hover:bg-gray-50/50 ${dropTargetCategoryId === cat.id ? 'bg-[#fff1f7]' : ''} ${reordering ? 'opacity-70' : ''}`}
        >
          <TableCell className="min-w-[180px] px-4 py-3 font-medium text-gray-800">
            <div className="flex items-center gap-2" style={{ paddingLeft: depth * 24 }}>
              {cat.children.length > 0 && (
                <Button
                  type="button"
                  onClick={() => toggleExpand(cat.id)}
                  variant="ghost"
                  size="icon"
                  className="h-7 w-[18px] rounded text-xs text-gray-400 hover:bg-[#fff7fa] hover:text-[#5d082a]"
                  style={{ width: 18 }}
                  aria-label={expanded[cat.id] ? 'Recolher' : 'Expandir'}
                >
                  {expanded[cat.id] ? '▼' : '▶'}
                </Button>
              )}
              {editingNameId === cat.id ? (
                <div className="flex items-center gap-1">
                  <Input
                    autoFocus
                    type="text"
                    value={editingNameValue}
                    onChange={(e) => setEditingNameValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveName(cat.id)
                      if (e.key === 'Escape') setEditingNameId(null)
                    }}
                    className="h-9 w-full rounded border-[#5d082a] text-sm shadow-none focus-visible:ring-[#5d082a]/20"
                  />
                  <Button type="button" onClick={() => handleSaveName(cat.id)} variant="ghost" size="icon" className="h-8 w-8 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-800"><Check size={14} /></Button>
                  <Button type="button" onClick={() => setEditingNameId(null)} variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:bg-gray-50 hover:text-gray-600"><X size={14} /></Button>
                </div>
              ) : (
                <div className="flex items-center gap-2 group">
                  <span>{cat.name}</span>
                  <Button
                    type="button"
                    onClick={() => { setEditingNameId(cat.id); setEditingNameValue(cat.name) }}
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-gray-400 opacity-0 transition-opacity hover:bg-[#fff7fa] hover:text-[#5d082a] group-hover:opacity-100"
                    title="Renomear"
                  >
                    <Pencil size={13} />
                  </Button>
                </div>
              )}
            </div>
          </TableCell>
          <TableCell className="px-4 py-3">
            <div className="flex items-center gap-2">
              {cat.bannerUrl ? (
                <div className="w-20 h-10 rounded overflow-hidden border border-gray-200 flex-shrink-0">
                  <img src={resolveApiUrl(cat.bannerUrl)} alt="" className="w-full h-full object-cover" />
                </div>
              ) : (
                <span className="text-xs text-gray-400 italic">Sem banner</span>
              )}
              <label className="cursor-pointer text-xs text-gray-500 hover:text-[#5d082a] flex items-center gap-1">
                <ImageIcon size={12} />
                {uploading === cat.id ? 'Enviando...' : cat.bannerUrl ? 'Trocar' : 'Adicionar'}
                <Input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleBannerUpload(e, cat.id)}
                  aria-label={`Enviar banner da categoria ${cat.name}`}
                />
              </label>
            </div>
          </TableCell>
          <TableCell className="px-4 py-3 text-center">
            <Button
              type="button"
              onClick={() => handleToggle(cat.id, !cat.active)}
              disabled={saving === cat.id}
              variant="ghost"
              size="sm"
              className={`h-8 rounded-full px-3 py-1 text-[11px] font-bold transition ${cat.active ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-100' : 'bg-gray-100 text-gray-500 hover:bg-gray-100'}`}
            >
              {saving === cat.id ? '...' : cat.active ? 'Sim' : 'Não'}
            </Button>
          </TableCell>
          <TableCell className="px-4 py-3 text-center">
            <div className="flex items-center justify-center gap-1 text-gray-400">
              <GripVertical size={14} className="cursor-grab" />
              <span className="text-[11px] uppercase tracking-wide">Arraste</span>
            </div>
          </TableCell>
          <TableCell className="px-4 py-3 text-center">
            <Input
              key={`${cat.id}-l-${cat.limit}`}
              type="number"
              defaultValue={cat.limit}
              min={1}
              disabled={saving === cat.id}
              onBlur={(e) => handleFieldBlur(cat.id, 'limit', Number(e.target.value))}
              className="mx-auto h-9 w-16 rounded border-gray-200 text-center text-sm shadow-none focus-visible:ring-[#5d082a]/20 disabled:opacity-50"
            />
          </TableCell>
          <TableCell className="px-4 py-3 text-right">
            <Button
              type="button"
              onClick={() => { setActionError(''); setPendingDelete(cat) }}
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded p-1.5 text-gray-400 transition hover:bg-red-50 hover:text-red-600"
              title="Excluir categoria"
            >
              <Trash2 size={14} />
            </Button>
          </TableCell>
        </TableRow>
        {cat.children.length > 0 && expanded[cat.id] && renderTree(cat.children, depth + 1)}
      </Fragment>
    ))
  }

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <Loader2 size={20} className="animate-spin text-[#5d082a] mr-2" />
      <span className="text-sm text-gray-500">Carregando...</span>
    </div>
  )

  if (error) return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
  )

  const tree = buildCategoryTree(categories)

  return (
    <>
      <div className="space-y-4">
      {/* Header actions */}
      <div className="flex items-center justify-between gap-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-gray-200 bg-white px-4 py-3">
            <p className="text-xs text-gray-500">Total</p>
            <p className="text-2xl font-bold text-gray-800">{categories.length}</p>
          </div>
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
            <p className="text-xs text-emerald-700">Visíveis</p>
            <p className="text-2xl font-bold text-emerald-800">{categories.filter((c) => c.active).length}</p>
          </div>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <Button type="button" onClick={load} variant="outline" size="sm" className="rounded border-gray-300 text-xs hover:bg-gray-50">
            <RefreshCw size={12} /> Atualizar
          </Button>
          <Button
            type="button"
            onClick={() => setShowCreate(true)}
            size="sm"
            className="rounded bg-[#5d082a] px-3 py-2 text-xs text-white hover:bg-[#7a1038]"
          >
            <Plus size={13} /> Nova Categoria
          </Button>
        </div>
      </div>

      {actionError && (
        <div className="flex items-start justify-between gap-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">
          <div className="flex items-start gap-2">
            <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
            <span>{actionError}</span>
          </div>
          <Button
            type="button"
            onClick={() => setActionError('')}
            variant="ghost"
            size="icon"
            className="h-6 w-6 flex-shrink-0 rounded-full p-0 text-red-500 hover:bg-red-100 hover:text-red-700"
            aria-label="Dispensar erro"
          >
            <X size={13} />
          </Button>
        </div>
      )}

      {/* Form criar */}
      {showCreate && (
        <div className="rounded-lg border border-[#5d082a]/30 bg-[#fffafc] p-4 space-y-3">
          <p className="text-sm font-semibold text-[#5d082a]">Nova Categoria</p>
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs text-gray-500 mb-1">Nome da categoria (como será exibido)</label>
              <Input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Ex: Bebidas Geladas"
                className="h-10 rounded border-gray-300 text-sm shadow-none focus-visible:ring-[#5d082a]/20"
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Prioridade</label>
              <Input type="number" value={newPriority} onChange={(e) => setNewPriority(Number(e.target.value))} className="h-10 w-20 rounded border-gray-300 text-center text-sm shadow-none focus-visible:ring-[#5d082a]/20" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Limite produtos</label>
              <Input type="number" value={newLimit} min={1} onChange={(e) => setNewLimit(Number(e.target.value))} className="h-10 w-20 rounded border-gray-300 text-center text-sm shadow-none focus-visible:ring-[#5d082a]/20" />
            </div>
            <Button type="button" onClick={handleCreate} disabled={creating} className="h-10 rounded bg-[#5d082a] px-4 py-2 text-sm text-white hover:bg-[#7a1038]">
              {creating ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              Criar
            </Button>
            <Button type="button" onClick={() => { setShowCreate(false); setCreateError('') }} variant="outline" size="icon" className="h-10 w-10 rounded border-gray-300 text-gray-600 hover:bg-gray-50">
              <X size={14} />
            </Button>
          </div>
          {createError && <p className="text-xs text-red-600">{createError}</p>}
        </div>
      )}

      {/* Árvore de categorias */}
      <div className="rounded-lg border border-gray-200 bg-white overflow-x-auto">
        <Table className="w-full text-left text-sm">
          <TableHeader className="border-b border-gray-200 bg-gray-50 text-xs uppercase tracking-wider text-gray-500">
            <TableRow className="hover:bg-transparent">
              <TableHead className="px-4 py-3">Nome</TableHead>
              <TableHead className="px-4 py-3">Banner</TableHead>
              <TableHead className="px-4 py-3 text-center">Visível</TableHead>
              <TableHead className="w-24 px-4 py-3 text-center">Ordem</TableHead>
              <TableHead className="w-20 px-4 py-3 text-center">Limite</TableHead>
              <TableHead className="px-4 py-3 text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y divide-gray-100">
            {renderTree(tree)}
          </TableBody>
        </Table>
        {tree.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-8">Nenhuma categoria cadastrada.</p>
        )}
      </div>

      </div>

      {/* Modal de confirmação de exclusão */}
      {pendingDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" role="dialog" aria-modal="true" aria-labelledby="delete-category-title">
          <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow-xl">
            <div className="flex items-start gap-3 mb-4">
              <AlertTriangle size={20} className="text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <p id="delete-category-title" className="font-semibold text-gray-800">Excluir categoria</p>
                <p className="text-sm text-gray-500 mt-1">
                  Tem certeza que deseja excluir <strong>{pendingDelete.name}</strong>?
                  Esta ação pode impactar vitrines e mapeamentos vinculados.
                </p>
                {actionError && (
                  <div className="mt-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700" role="alert">
                    {actionError}
                  </div>
                )}
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" onClick={() => { setActionError(''); setPendingDelete(null) }} variant="outline" className="rounded border-gray-300 px-4 py-2 text-sm hover:bg-gray-50">Cancelar</Button>
              <Button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="rounded bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700"
              >
                {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                Excluir
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ─── Tab: Mapeamento EAN (modelo novo) ───────────────────────────────────────

function MappingTab({ mode = 'all' }: { mode?: 'all' | 'automation' | 'review' }) {
  const [stats, setStats] = useState<MappingStats | null>(null)
  const [suggestions, setSuggestions] = useState<EanMappingSuggestion[]>([])
  const [pendingMappings, setPendingMappings] = useState<PendingCategoryMappingItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [workflowLoading, setWorkflowLoading] = useState(false)
  const [workflowResult, setWorkflowResult] = useState<EanMappingWorkflowResult | null>(null)
  const [pendingActionId, setPendingActionId] = useState<string | null>(null)

  const loadStats = async () => {
    const res = await cmsAPI.categories.getMappingStats()
    setStats(res.data?.data || null)
  }

  const loadPending = async () => {
    const res = await cmsAPI.categories.getPendingMappings({ limit: 25, offset: 0 })
    setPendingMappings(res.data?.data || [])
  }

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      await Promise.all([loadStats(), loadSuggestions(), loadPending()])
    } catch {
      setError('Falha ao carregar dados.')
    } finally {
      setLoading(false)
    }
  }

  const loadSuggestions = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await cmsAPI.categories.getMappingSuggestions({ limit: 200, onlyUnmapped: true })
      setSuggestions(res.data.data || [])
    } catch {
      setError('Falha ao gerar sugestões EAN.')
    } finally {
      setLoading(false)
    }
  }

  const resolvePending = async (item: PendingCategoryMappingItem, action: 'approve' | 'reject') => {
    if (action === 'approve' && !item.suggestedCategory?.id) return

    setPendingActionId(item.id)
    setError('')
    try {
      if (action === 'approve') {
        await cmsAPI.categories.approvePendingMapping(item.id, {
          categoryId: item.suggestedCategory!.id,
          notes: `Aprovado via admin com base em ${item.reason}`,
        })
      } else {
        await cmsAPI.categories.rejectPendingMapping(item.id, {
          notes: `Rejeitado via admin. Motivo original: ${item.reason}`,
        })
      }

      await Promise.all([loadStats(), loadSuggestions(), loadPending()])
    } catch {
      setError(action === 'approve' ? 'Falha ao aprovar pendência.' : 'Falha ao rejeitar pendência.')
    } finally {
      setPendingActionId(null)
    }
  }

  const runMappingWorkflow = async (dryRun: boolean) => {
    setWorkflowLoading(true)
    setError('')
    try {
      const res = await cmsAPI.categories.applyMappingSuggestions({ dryRun, limit: 200 })
      setWorkflowResult(res.data)
      await Promise.all([loadStats(), loadSuggestions()])
    } catch {
      setError(dryRun ? 'Falha ao executar dry-run.' : 'Falha ao aplicar mapeamentos.')
    } finally {
      setWorkflowLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <Loader2 size={20} className="animate-spin text-[#5d082a] mr-2" />
      <span className="text-sm text-gray-500">Carregando categorias...</span>
    </div>
  )

  if (error) return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
  )

  return (
    <div className="space-y-4">
      {/* EAN mapping workflow */}
      <div className="rounded-lg border border-[#5d082a]/20 bg-[#fffafc] p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-[#5d082a]">Aplicar mapeamento EAN {'>'} categoria (modelo novo)</p>
            <p className="text-xs text-gray-500 mt-1">
              Fluxo oficial por EAN com linguagem comercial: Departamento e Seção. A tela legada de classificação foi descontinuada.
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Departamento = grupo principal da loja. Seção = subdivisão dentro do departamento.
            </p>
          </div>
          <div className="flex gap-2 flex-wrap justify-end">
            <Button type="button" onClick={loadSuggestions} disabled={workflowLoading} variant="outline" size="sm" className="rounded border-gray-300 text-xs hover:bg-gray-50">
              Gerar sugestões
            </Button>
            <Button type="button" onClick={() => runMappingWorkflow(true)} disabled={workflowLoading} variant="outline" size="sm" className="rounded border-amber-300 bg-amber-50 text-xs text-amber-800 hover:bg-amber-100">
              Dry-run
            </Button>
            <Button type="button" onClick={() => runMappingWorkflow(false)} disabled={workflowLoading} size="sm" className="rounded bg-[#5d082a] text-xs text-white hover:bg-[#7a1038]">
              Aplicar real
            </Button>
          </div>
        </div>

        {workflowResult && (
          <div className={`rounded-lg border p-3 text-xs ${workflowResult.dryRun ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-emerald-200 bg-emerald-50 text-emerald-900'}`}>
            <p className="font-semibold">
              {workflowResult.dryRun ? 'Dry-run concluído' : 'Aplicação concluída'}
            </p>
            <p className="mt-1">Aplicados: {workflowResult.applied} | Válido: {workflowResult.validation?.valid ? 'sim' : 'não'} | Total analisado: {workflowResult.validation?.total ?? 0}</p>
            {(workflowResult.validation?.errors?.length ?? 0) > 0 && (
              <p className="mt-1">Erros: {workflowResult.validation?.errors.length}</p>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-lg border border-gray-200 bg-white px-4 py-3">
            <p className="text-xs text-gray-500">Mapeados</p>
            <p className="text-2xl font-bold text-gray-800">{stats?.mapped ?? 0}</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white px-4 py-3">
            <p className="text-xs text-gray-500">Pendentes</p>
            <p className="text-2xl font-bold text-gray-800">{stats?.pending ?? 0}</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white px-4 py-3">
            <p className="text-xs text-gray-500">Total produtos</p>
            <p className="text-2xl font-bold text-gray-800">{stats?.total ?? 0}</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white px-4 py-3">
            <p className="text-xs text-gray-500">Sem mapeamento</p>
            <p className="text-2xl font-bold text-gray-800">{stats?.unmapped ?? 0}</p>
          </div>
        </div>

        {(mode === 'all' || mode === 'automation') && suggestions.length > 0 && (
          <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Sugestões de mapeamento</p>
              <Badge variant="outline" className="rounded-full border-gray-200 bg-gray-50 text-xs text-gray-500">{suggestions.length} itens</Badge>
            </div>
            <div className="max-h-72 overflow-auto divide-y divide-gray-100">
              {suggestions.slice(0, 20).map((s) => (
                <div key={s.ean} className="px-4 py-3 text-xs flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-gray-800">{s.productName}</p>
                    <p className="text-gray-500">EAN {s.ean} • {s.source === 'product.category' ? 'categoria do produto' : 'inferência mercadológica'}</p>
                    <p className="text-gray-400">{s.reason}</p>
                  </div>
                  <Badge className="shrink-0 rounded bg-[#5d082a]/10 px-2 py-1 font-semibold text-[#5d082a]">{s.categoryName}</Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        {(mode === 'all' || mode === 'review') && (
          <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Pendências de categorização</p>
              <p className="text-[11px] text-gray-400 mt-1">Exibe motivo original do handoff e notas da fila PENDING.</p>
            </div>
            <Badge variant="outline" className="rounded-full border-gray-200 bg-gray-50 text-xs text-gray-500">{pendingMappings.length} itens</Badge>
          </div>
          <div className="max-h-80 overflow-auto divide-y divide-gray-100">
            {pendingMappings.length === 0 ? (
              <p className="px-4 py-6 text-sm text-gray-400">Nenhuma pendência disponível para revisão.</p>
            ) : (
              pendingMappings.map((item) => (
                <div key={item.id} className="px-4 py-3 text-xs flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <p className="font-semibold text-gray-800">{item.productName}</p>
                    <p className="text-gray-500">EAN {item.ean}</p>
                    <p className="text-gray-500">Motivo: <span className="font-medium text-gray-700">{item.reason}</span></p>
                    {item.notes && <p className="text-gray-400">{item.notes}</p>}
                    <p className="text-[11px] text-gray-400">
                      Sugestão: Departamento {item.suggestedCategoryN1 || 'não definido'}{item.suggestedCategoryN2 ? ` / Seção ${item.suggestedCategoryN2}` : ''}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Button
                      type="button"
                      onClick={() => resolvePending(item, 'reject')}
                      disabled={pendingActionId === item.id}
                      variant="outline"
                      size="sm"
                      className="rounded border-gray-300 text-[11px] hover:bg-gray-50"
                    >
                      Rejeitar
                    </Button>
                    <Button
                      type="button"
                      onClick={() => resolvePending(item, 'approve')}
                      disabled={pendingActionId === item.id || !item.suggestedCategory?.id}
                      size="sm"
                      className="rounded bg-[#5d082a] text-[11px] text-white hover:bg-[#7a1038]"
                    >
                      Aprovar
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Tela principal com abas ──────────────────────────────────────────────────

type Tab = 'setup' | 'automation' | 'review'

export default function CategoriesManager() {
  const [tab, setTab] = useState<Tab>('setup')
  const steps: Array<{ id: Tab; label: string; shortLabel: string }> = [
    { id: 'setup', label: '1. Estrutura da loja', shortLabel: 'Estrutura da loja' },
    { id: 'automation', label: '2. Sugestões automáticas', shortLabel: 'Sugestões automáticas' },
    { id: 'review', label: '3. Revisão final', shortLabel: 'Revisão final' },
  ]

  const currentStepIndex = steps.findIndex((step) => step.id === tab)
  const nextStep = currentStepIndex < steps.length - 1 ? steps[currentStepIndex + 1] : null
  const previousStep = currentStepIndex > 0 ? steps[currentStepIndex - 1] : null

  const nowInstructionByStep: Record<Tab, { title: string; subtitle: string }> = {
    setup: {
      title: 'O que fazer agora: organize os departamentos e seções da loja.',
      subtitle: 'Revise nomes, prioridade, visibilidade e limite por seção antes de aplicar automações.',
    },
    automation: {
      title: 'O que fazer agora: gere sugestões e aplique mapeamentos automáticos com segurança.',
      subtitle: 'Use dry-run primeiro para validar impacto, depois aplique real se estiver tudo consistente.',
    },
    review: {
      title: 'O que fazer agora: trate pendências para finalizar a categorização.',
      subtitle: 'Aprove ou rejeite cada item pendente para manter o catálogo limpo e consistente.',
    },
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-[#ead7df] bg-[#fffafc] p-4">
        <p className="text-sm font-semibold text-[#5d082a]">Fluxo guiado de categorização</p>
        <p className="mt-1 text-xs text-gray-600">Siga as etapas em sequência para configurar departamentos, revisar sugestões automáticas e finalizar pendências.</p>
      </div>

      {/* Passos guiados */}
      <div className="flex flex-wrap gap-2 rounded-lg border border-gray-200 bg-gray-100 p-1">
        <Button
          type="button"
          onClick={() => setTab('setup')}
          variant="ghost"
          className={`rounded-md px-4 py-2 text-sm font-medium transition ${tab === 'setup' ? 'bg-white text-[#5d082a] shadow-sm hover:bg-white' : 'text-gray-600 hover:text-gray-800'}`}
        >
          <LayoutGrid size={15} />
          {steps[0].label}
        </Button>
        <Button
          type="button"
          onClick={() => setTab('automation')}
          variant="ghost"
          className={`rounded-md px-4 py-2 text-sm font-medium transition ${tab === 'automation' ? 'bg-white text-[#5d082a] shadow-sm hover:bg-white' : 'text-gray-600 hover:text-gray-800'}`}
        >
          <Tag size={15} />
          {steps[1].label}
        </Button>
        <Button
          type="button"
          onClick={() => setTab('review')}
          variant="ghost"
          className={`rounded-md px-4 py-2 text-sm font-medium transition ${tab === 'review' ? 'bg-white text-[#5d082a] shadow-sm hover:bg-white' : 'text-gray-600 hover:text-gray-800'}`}
        >
          <Check size={15} />
          {steps[2].label}
        </Button>
      </div>

      <div className="rounded-lg border border-[#ead7df] bg-white p-4">
        <p className="text-sm font-semibold text-[#5d082a]">{nowInstructionByStep[tab].title}</p>
        <p className="mt-1 text-xs text-gray-600">{nowInstructionByStep[tab].subtitle}</p>
      </div>

      {tab === 'setup' && <CategoriesTab />}
      {tab === 'automation' && <MappingTab mode="automation" />}
      {tab === 'review' && <MappingTab mode="review" />}

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-200 bg-white p-3">
        <p className="text-xs text-gray-500">Etapa atual: <span className="font-semibold text-[#5d082a]">{steps[currentStepIndex].shortLabel}</span></p>
        <div className="flex items-center gap-2">
          {previousStep && (
            <Button
              type="button"
              onClick={() => setTab(previousStep.id)}
              variant="outline"
              className="rounded-lg border-gray-300 px-3 py-2 text-xs font-semibold text-gray-700 transition hover:bg-gray-50"
            >
              Voltar para {previousStep.shortLabel}
            </Button>
          )}
          {nextStep && (
            <Button
              type="button"
              onClick={() => setTab(nextStep.id)}
              className="rounded-lg bg-[#5d082a] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#7a1038]"
            >
              Próxima etapa: {nextStep.shortLabel}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
