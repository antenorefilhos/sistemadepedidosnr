import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { recipesAPI, getApiErrorMessage } from '../services/api'
import { ChefHat, Plus, Pencil, Trash2, Eye, EyeOff } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'

interface RecipeSummary {
  id: string
  title: string
  slug: string
  description?: string
  imageUrl?: string
  prepTime?: number
  servings?: number
  difficulty?: string
  active: boolean
  publishedAt?: string
  category?: { name: string; slug: string }
}

interface PaginatedRecipes {
  data: RecipeSummary[]
  total: number
  page: number
  limit: number
  hasNextPage: boolean
}

const DIFFICULTY_LABEL: Record<string, string> = {
  EASY: 'Facil',
  MEDIUM: 'Medio',
  HARD: 'Dificil',
}

const INITIAL_FORM = {
  title: '',
  slug: '',
  description: '',
  imageUrl: '',
  prepTime: '',
  servings: '',
  difficulty: '',
  categoryId: '',
  active: true,
  publishedAt: '',
}

function generateSlug(title: string) {
  return title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export default function Recipes() {
  const qc = useQueryClient()
  const [page, setPage] = useState(1)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<RecipeSummary | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<RecipeSummary | null>(null)
  const [form, setForm] = useState<typeof INITIAL_FORM>(INITIAL_FORM)
  const [error, setError] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['admin-recipes', page],
    queryFn: async () => {
      const res = await recipesAPI.list(page, 20)
      return res.data as PaginatedRecipes
    },
  })

  const { data: categories = [] } = useQuery({
    queryKey: ['recipe-categories'],
    queryFn: async () => {
      const res = await recipesAPI.listCategories()
      return res.data as { id: string; name: string; slug: string }[]
    },
  })

  const recipes = data?.data ?? []

  const createMut = useMutation({
    mutationFn: (payload: any) => recipesAPI.create(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-recipes'] })
      closeForm()
    },
    onError: (err) => setError(getApiErrorMessage(err)),
  })

  const updateMut = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: any }) => recipesAPI.update(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-recipes'] })
      closeForm()
    },
    onError: (err) => setError(getApiErrorMessage(err)),
  })

  const toggleMut = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      recipesAPI.update(id, { active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-recipes'] }),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => recipesAPI.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-recipes'] })
      setDeleteTarget(null)
    },
    onError: (err) => setError(getApiErrorMessage(err)),
  })

  const closeForm = useCallback(() => {
    setShowForm(false)
    setEditing(null)
    setForm(INITIAL_FORM)
    setError(null)
  }, [])

  const openCreate = useCallback(() => {
    setEditing(null)
    setForm(INITIAL_FORM)
    setShowForm(true)
  }, [])

  const openEdit = useCallback((recipe: RecipeSummary) => {
    setEditing(recipe)
    setForm({
      title: recipe.title,
      slug: recipe.slug,
      description: recipe.description ?? '',
      imageUrl: recipe.imageUrl ?? '',
      prepTime: recipe.prepTime != null ? String(recipe.prepTime) : '',
      servings: recipe.servings != null ? String(recipe.servings) : '',
      difficulty: recipe.difficulty ?? '',
      categoryId: '',
      active: recipe.active,
      publishedAt: recipe.publishedAt ? recipe.publishedAt.slice(0, 16) : '',
    })
    setShowForm(true)
  }, [])

  const handleChange = (field: keyof typeof INITIAL_FORM, value: string | boolean) => {
    setForm((prev) => {
      const next = { ...prev, [field]: value }
      if (field === 'title' && !editing) {
        next.slug = generateSlug(String(value))
      }
      return next
    })
  }

  const handleSubmit = () => {
    setError(null)
    if (!form.title.trim() || !form.slug.trim()) {
      setError('Titulo e slug sao obrigatorios.')
      return
    }

    const payload = {
      title: form.title.trim(),
      slug: form.slug.trim(),
      description: form.description.trim() || undefined,
      imageUrl: form.imageUrl.trim() || undefined,
      prepTime: form.prepTime ? Number(form.prepTime) : undefined,
      servings: form.servings ? Number(form.servings) : undefined,
      difficulty: form.difficulty || undefined,
      categoryId: form.categoryId || undefined,
      active: form.active,
      publishedAt: form.publishedAt ? new Date(form.publishedAt).toISOString() : undefined,
    }

    if (editing) {
      updateMut.mutate({ id: editing.id, payload })
    } else {
      createMut.mutate(payload)
    }
  }

  const isSaving = createMut.isPending || updateMut.isPending

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <ChefHat className="text-[#5D082A]" size={24} />
          <h1 className="text-2xl font-bold text-gray-800">Receitas</h1>
        </div>
        <Button
          type="button"
          onClick={openCreate}
        >
          <Plus size={16} /> Nova receita
        </Button>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          {error}
        </div>
      )}

      {showForm && (
        <div className="mb-6 bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
          <h2 className="text-lg font-bold text-gray-800 mb-4">
            {editing ? 'Editar receita' : 'Nova receita'}
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="mb-1 block text-xs text-gray-600">Titulo *</Label>
              <Input
                type="text"
                value={form.title}
                onChange={(e) => handleChange('title', e.target.value)}
                placeholder="Picanha na Brasa"
              />
            </div>

            <div>
              <Label className="mb-1 block text-xs text-gray-600">Slug *</Label>
              <Input
                type="text"
                value={form.slug}
                onChange={(e) => handleChange('slug', e.target.value)}
                className="font-mono"
                placeholder="picanha-na-brasa"
              />
            </div>

            <div className="md:col-span-2">
              <Label className="mb-1 block text-xs text-gray-600">Descricao</Label>
              <Textarea
                value={form.description}
                onChange={(e) => handleChange('description', e.target.value)}
                rows={2}
              />
            </div>

            <div className="md:col-span-2">
              <Label className="mb-1 block text-xs text-gray-600">URL da imagem</Label>
              <Input
                type="text"
                value={form.imageUrl}
                onChange={(e) => handleChange('imageUrl', e.target.value)}
              />
            </div>

            <div>
              <Label className="mb-1 block text-xs text-gray-600">Tempo de preparo (min)</Label>
              <Input
                type="number"
                value={form.prepTime}
                onChange={(e) => handleChange('prepTime', e.target.value)}
                min={0}
              />
            </div>

            <div>
              <Label className="mb-1 block text-xs text-gray-600">Porcoes</Label>
              <Input
                type="number"
                value={form.servings}
                onChange={(e) => handleChange('servings', e.target.value)}
                min={1}
              />
            </div>

            <div>
              <Label className="mb-1 block text-xs text-gray-600">Dificuldade</Label>
              <Select
                value={form.difficulty}
                onChange={(e) => handleChange('difficulty', e.target.value)}
              >
                <option value="">Sem classificacao</option>
                <option value="EASY">Facil</option>
                <option value="MEDIUM">Medio</option>
                <option value="HARD">Dificil</option>
              </Select>
            </div>

            <div>
              <Label className="mb-1 block text-xs text-gray-600">Categoria</Label>
              <Select
                value={form.categoryId}
                onChange={(e) => handleChange('categoryId', e.target.value)}
              >
                <option value="">Sem categoria</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <Label className="mb-1 block text-xs text-gray-600">Publicacao</Label>
              <Input
                type="datetime-local"
                value={form.publishedAt}
                onChange={(e) => handleChange('publishedAt', e.target.value)}
              />
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="active"
                checked={form.active}
                onChange={(e) => handleChange('active', e.target.checked)}
              />
              <Label htmlFor="active" className="text-sm font-normal text-gray-700">Ativa</Label>
            </div>
          </div>

          <div className="flex gap-3 mt-6">
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={isSaving}
            >
              {isSaving ? 'Salvando...' : editing ? 'Salvar alteracoes' : 'Criar receita'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={closeForm}
            >
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-14 bg-gray-100 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : recipes.length === 0 ? (
        <div className="text-center py-20 text-gray-500">
          <ChefHat size={36} className="mx-auto mb-3 text-gray-300" />
          <p className="font-semibold">Nenhuma receita cadastrada.</p>
          <p className="text-sm">Clique em "Nova receita" para comecar.</p>
        </div>
      ) : (
        <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead>Titulo</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Dificuldade</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="text-right">Acoes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recipes.map((recipe) => (
                <TableRow key={recipe.id}>
                  <TableCell>
                    <p className="font-semibold text-gray-800 line-clamp-1">{recipe.title}</p>
                    <p className="text-xs text-gray-400 font-mono">{recipe.slug}</p>
                  </TableCell>
                  <TableCell className="text-gray-600">
                    {recipe.category?.name ?? <span className="text-gray-300">—</span>}
                  </TableCell>
                  <TableCell className="text-gray-600">
                    {recipe.difficulty ? (DIFFICULTY_LABEL[recipe.difficulty] ?? recipe.difficulty) : '—'}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant={recipe.active ? 'success' : 'secondary'} className="justify-center">
                      {recipe.active ? 'Ativa' : 'Inativa'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => toggleMut.mutate({ id: recipe.id, active: !recipe.active })}
                        title={recipe.active ? 'Desativar' : 'Ativar'}
                      >
                        {recipe.active ? <EyeOff size={15} /> : <Eye size={15} />}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => openEdit(recipe)}
                        title="Editar"
                      >
                        <Pencil size={15} />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteTarget(recipe)}
                        className="text-red-500 hover:text-red-600"
                        title="Excluir"
                      >
                        <Trash2 size={15} />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {(data?.hasNextPage || page > 1) && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
              <Button
                type="button"
                variant="link"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-0"
              >
                ← Anterior
              </Button>
              <span className="text-xs text-gray-500">Pagina {page}</span>
              <Button
                type="button"
                variant="link"
                size="sm"
                onClick={() => setPage((p) => p + 1)}
                disabled={!data?.hasNextPage}
                className="px-0"
              >
                Proxima →
              </Button>
            </div>
          )}
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow-xl">
            <h2 className="text-lg font-bold text-gray-900">Excluir receita?</h2>
            <p className="mt-2 text-sm text-gray-600">
              Esta acao remove "{deleteTarget.title}" do cadastro de receitas.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setDeleteTarget(null)}>
                Cancelar
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={deleteMut.isPending}
                onClick={() => deleteMut.mutate(deleteTarget.id)}
              >
                {deleteMut.isPending ? 'Excluindo...' : 'Excluir'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
