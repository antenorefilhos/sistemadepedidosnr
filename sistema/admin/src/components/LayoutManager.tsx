import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Image as ImageIcon,
  Search,
  X,
} from 'lucide-react';
import { cmsAPI, uploadsAPI, getApiErrorMessage, resolveApiUrl } from '../services/api';
import { SectionMetric, SectionEmptyState } from '../pages/sections/SectionChrome';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';

const CATEGORIES_PER_PAGE = 20;
const MAX_IMAGE_SIZE_MB = 5;

interface Category {
  id: string;
  name: string;
  bannerUrl?: string;
  active: boolean;
  priority: number;
  limit: number;
  curatedProductIds?: string[];
}

interface Notice {
  id: number;
  tone: 'success' | 'error';
  message: string;
}

export default function LayoutManager() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [uploading, setUploading] = useState<string | null>(null);
  const [categorySearch, setCategorySearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [categoryBusyId, setCategoryBusyId] = useState<string | null>(null);
  const [categoryPage, setCategoryPage] = useState(0);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    setCategoryPage(0);
  }, [categorySearch, categoryFilter]);

  const pushNotice = (tone: Notice['tone'], message: string) => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setNotices(prev => [...prev, { id, tone, message }]);
    window.setTimeout(() => {
      setNotices(prev => prev.filter(notice => notice.id !== id));
    }, 4000);
  };

  const filteredCategories = categories.filter(category => {
    const matchesSearch = category.name.toLowerCase().includes(categorySearch.trim().toLowerCase());
    const matchesFilter =
      categoryFilter === 'all' ||
      (categoryFilter === 'active' && category.active) ||
      (categoryFilter === 'inactive' && !category.active);

    return matchesSearch && matchesFilter;
  });

  const categoryPageCount = Math.max(1, Math.ceil(filteredCategories.length / CATEGORIES_PER_PAGE));
  const paginatedCategories = filteredCategories.slice(
    categoryPage * CATEGORIES_PER_PAGE,
    categoryPage * CATEGORIES_PER_PAGE + CATEGORIES_PER_PAGE
  );

  const visibleCategoriesCount = categories.filter(category => category.active).length;

  const loadData = async () => {
    try {
      setLoading(true);
      const catsRes = await cmsAPI.categories.getAll();
      setCategories(catsRes.data);
    } catch (error) {
      pushNotice('error', getApiErrorMessage(error, 'Erro ao carregar categorias'));
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, id: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      pushNotice('error', 'Selecione um arquivo de imagem válido.');
      e.target.value = '';
      return;
    }

    if (file.size > MAX_IMAGE_SIZE_MB * 1024 * 1024) {
      pushNotice('error', `A imagem deve ter no máximo ${MAX_IMAGE_SIZE_MB}MB.`);
      e.target.value = '';
      return;
    }

    try {
      setUploading(id);
      setCategoryBusyId(id);
      const res = await uploadsAPI.upload(file);
      const url = res.data.url;
      await cmsAPI.categories.update(id, { bannerUrl: url });
      setCategories(prev => prev.map(c => c.id === id ? { ...c, bannerUrl: url } : c));
      pushNotice('success', 'Banner da categoria atualizado.');
    } catch (error) {
      pushNotice('error', getApiErrorMessage(error, 'Erro no upload'));
    } finally {
      setUploading(null);
      setCategoryBusyId(null);
      e.target.value = '';
    }
  };

  const handleToggleCategory = async (id: string, active: boolean) => {
    try {
      setCategoryBusyId(id);
      await cmsAPI.categories.update(id, { active });
      setCategories(prev => prev.map(c => c.id === id ? { ...c, active } : c));
      pushNotice('success', active ? 'Categoria exibida na home.' : 'Categoria ocultada da home.');
    } catch (error) {
      pushNotice('error', getApiErrorMessage(error, 'Erro ao atualizar categoria'));
    } finally {
      setCategoryBusyId(null);
    }
  };

  const handleUpdateCategoryNumber = async (id: string, field: 'priority' | 'limit', value: number) => {
    try {
      setCategoryBusyId(id);
      await cmsAPI.categories.update(id, { [field]: value });
      setCategories(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c));
      pushNotice('success', field === 'priority' ? 'Prioridade da categoria atualizada.' : 'Limite de produtos atualizado.');
    } catch (error) {
      pushNotice('error', getApiErrorMessage(error, 'Erro ao atualizar categoria'));
    } finally {
      setCategoryBusyId(null);
    }
  };

  const handleUpdateCategoryCuration = async (id: string, value: string) => {
    const curatedProductIds = value
      .split(/[\s,;]+/)
      .map(item => item.trim())
      .filter(Boolean);

    try {
      setCategoryBusyId(id);
      await cmsAPI.categories.update(id, { curatedProductIds });
      setCategories(prev => prev.map(c => c.id === id ? { ...c, curatedProductIds } : c));
      pushNotice('success', 'Curadoria manual da categoria atualizada.');
    } catch (error) {
      pushNotice('error', getApiErrorMessage(error, 'Erro ao atualizar curadoria'));
    } finally {
      setCategoryBusyId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <ImageIcon className="animate-pulse text-[#5d082a]" size={40} />
      </div>
    );
  }

  return (
    <div className="space-y-12 pb-20">
      {notices.length > 0 && (
        <div aria-live="polite" className="fixed right-4 top-4 z-[60] flex w-[min(26rem,calc(100vw-2rem))] flex-col gap-3">
          {notices.map(notice => (
            <div
              key={notice.id}
              className={`flex items-start gap-3 rounded-lg border px-4 py-3 shadow-lg backdrop-blur ${
                notice.tone === 'success'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                  : 'border-red-200 bg-red-50 text-red-900'
              }`}
              role="status"
            >
              {notice.tone === 'success' ? <CheckCircle2 size={18} className="mt-0.5 shrink-0" /> : <AlertCircle size={18} className="mt-0.5 shrink-0" />}
              <div className="min-w-0 flex-1 text-sm font-medium">{notice.message}</div>
              <Button
                type="button"
                aria-label="Fechar aviso"
                onClick={() => setNotices(prev => prev.filter(item => item.id !== notice.id))}
                variant="ghost"
                size="icon"
                className="h-6 w-6 rounded-full text-current hover:bg-black/5 hover:text-current"
              >
                <X size={14} />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Category Banners Management */}
      <section className="overflow-hidden rounded-[16px] border border-[#ead7df] bg-white shadow-[0_18px_60px_rgba(93,8,42,0.08)]">
        <div className="border-b border-[#f1dbe3] bg-[linear-gradient(180deg,#fffafc_0%,#fff 100%)] p-6 sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-4">
              <div>
                <h2 className="text-xl font-bold text-gray-800">Banners das Seções (Categorias)</h2>
                <p className="text-sm text-gray-500">
                  Imagens de fundo para as divisões da vitrine na Home. Banners de carrossel, intercalados,
                  tarjas e popup ficam em Loja &gt; Banners.
                </p>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <SectionMetric label="Categorias" value={categories.length} tone="brand" />
                <SectionMetric label="Visíveis" value={visibleCategoriesCount} tone="success" />
                <SectionMetric label="Filtradas" value={filteredCategories.length} tone="neutral" />
              </div>
            </div>
            <div className="flex w-full max-w-xl flex-col gap-3">
              <Label className="relative block">
                <Search size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                <Input
                  type="search"
                  value={categorySearch}
                  onChange={e => setCategorySearch(e.target.value)}
                  placeholder="Buscar categoria"
                  className="h-12 rounded-lg border-[#ead7df] bg-white pl-11 pr-4 text-gray-700 focus-visible:ring-[#5d082a]/10"
                  aria-label="Buscar categoria"
                />
              </Label>
              <div className="flex flex-wrap gap-2">
                {[
                  { value: 'all', label: 'Todas' },
                  { value: 'active', label: 'Visíveis' },
                  { value: 'inactive', label: 'Ocultas' },
                ].map(option => (
                  <Button
                    key={option.value}
                    type="button"
                    onClick={() => setCategoryFilter(option.value as 'all' | 'active' | 'inactive')}
                    variant="ghost"
                    size="sm"
                    className={`rounded-md px-4 text-xs font-bold uppercase tracking-[0.18em] ${
                      categoryFilter === option.value
                        ? 'bg-[#5d082a] text-white'
                        : 'bg-[#fdf0f4] text-[#5d082a] hover:bg-[#f7dce7]'
                    }`}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </div>
        <div>
          <Table className="text-left">
            <TableHeader className="bg-[#fdf0f4] text-xs tracking-wider text-[#5d082a]">
              <TableRow>
                <TableHead className="px-6 py-4">Categoria</TableHead>
                <TableHead className="px-6 py-4">Banner Atual</TableHead>
                <TableHead className="px-6 py-4">Status</TableHead>
                <TableHead className="px-4 py-4 text-center">Prioridade</TableHead>
                <TableHead className="px-4 py-4 text-center">Limite</TableHead>
                <TableHead className="px-6 py-4">Curadoria Manual (IDs)</TableHead>
                <TableHead className="px-6 py-4 text-right">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedCategories.map(cat => (
                <TableRow key={cat.id} className="hover:bg-gray-50/50">
                  <TableCell className="px-6 py-4 font-bold text-gray-800">{cat.name}</TableCell>
                  <TableCell className="px-6 py-4">
                    {cat.bannerUrl ? (
                      <div className="w-32 h-12 rounded overflow-hidden border border-gray-200">
                        <img src={resolveApiUrl(cat.bannerUrl)} alt={`Banner da categoria ${cat.name}`} className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <Badge variant="outline" className="border-gray-200 text-xs italic text-gray-400">Sem banner</Badge>
                    )}
                  </TableCell>
                  <TableCell className="px-6 py-4">
                    <Button
                      type="button"
                      onClick={() => handleToggleCategory(cat.id, !cat.active)}
                      variant="ghost"
                      size="sm"
                      className={`h-8 rounded-md px-3 text-[10px] font-bold uppercase ${
                        cat.active ? 'bg-[#fdf0f4] text-[#4a0622]' : 'bg-gray-100 text-gray-500'
                      }`}
                      disabled={categoryBusyId === cat.id}
                      aria-label={cat.active ? `Ocultar categoria ${cat.name} da home` : `Exibir categoria ${cat.name} na home`}
                    >
                      {cat.active ? 'Visível na Home' : 'Oculto'}
                    </Button>
                  </TableCell>
                  <TableCell className="px-4 py-4 text-center">
                    <Input
                      key={`${cat.id}-priority-${cat.priority}`}
                      type="number"
                      defaultValue={cat.priority}
                      min={0}
                      disabled={categoryBusyId === cat.id}
                      onBlur={(e) => {
                        const val = parseInt(e.target.value, 10);
                        if (!Number.isNaN(val) && val !== cat.priority) {
                          handleUpdateCategoryNumber(cat.id, 'priority', val);
                        }
                      }}
                      className="mx-auto h-9 w-16 rounded-lg border-gray-200 px-2 text-center focus-visible:ring-[#5d082a]/10"
                      aria-label={`Prioridade da categoria ${cat.name}`}
                    />
                  </TableCell>
                  <TableCell className="px-4 py-4 text-center">
                    <Input
                      key={`${cat.id}-limit-${cat.limit}`}
                      type="number"
                      defaultValue={cat.limit}
                      min={1}
                      disabled={categoryBusyId === cat.id}
                      onBlur={(e) => {
                        const val = parseInt(e.target.value, 10);
                        if (!Number.isNaN(val) && val >= 1 && val !== cat.limit) {
                          handleUpdateCategoryNumber(cat.id, 'limit', val);
                        }
                      }}
                      className="mx-auto h-9 w-16 rounded-lg border-gray-200 px-2 text-center focus-visible:ring-[#5d082a]/10"
                      aria-label={`Limite de produtos da categoria ${cat.name}`}
                    />
                  </TableCell>
                  <TableCell className="px-6 py-4">
                    <Textarea
                      key={`${cat.id}-curated-${(cat.curatedProductIds || []).join(',')}`}
                      defaultValue={(cat.curatedProductIds || []).join(', ')}
                      disabled={categoryBusyId === cat.id}
                      onBlur={(e) => {
                        const next = e.target.value.trim();
                        const current = (cat.curatedProductIds || []).join(', ');
                        if (next !== current) {
                          handleUpdateCategoryCuration(cat.id, next);
                        }
                      }}
                      rows={2}
                      placeholder="IDs separados por vírgula"
                      className="min-h-16 min-w-[220px] resize-none rounded-lg border-gray-200 px-2 py-1 text-xs focus-visible:ring-[#5d082a]/10"
                      aria-label={`IDs curados da categoria ${cat.name}`}
                    />
                  </TableCell>
                  <TableCell className="px-6 py-4 text-right">
                    <Label className="inline-flex h-9 cursor-pointer items-center justify-center gap-2 rounded-lg bg-gray-100 px-3 text-xs font-semibold text-gray-700 transition hover:bg-gray-200">
                      <ImageIcon size={14} />
                      {uploading === cat.id || categoryBusyId === cat.id ? 'Subindo...' : 'Trocar Foto'}
                      <Input
                        type="file"
                        className="hidden"
                        accept="image/*"
                        aria-label={`Trocar banner da categoria ${cat.name}`}
                        onChange={(e) => handleFileUpload(e, cat.id)}
                      />
                    </Label>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {filteredCategories.length === 0 && (
            <div className="p-6">
              <SectionEmptyState
                title="Nenhuma categoria encontrada"
                description="Ajuste a busca ou os filtros para ver outras categorias."
              />
            </div>
          )}
          {filteredCategories.length > 0 && categoryPageCount > 1 && (
            <div className="flex items-center justify-between gap-4 border-t border-[#f1dbe3] px-6 py-4">
              <p className="text-xs text-gray-500">
                Página {categoryPage + 1} de {categoryPageCount} · {filteredCategories.length} categorias
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  onClick={() => setCategoryPage(p => Math.max(0, p - 1))}
                  disabled={categoryPage === 0}
                  variant="outline"
                  size="sm"
                  className="rounded-md border-[#ead7df] text-[#5d082a] hover:bg-[#fff5f8]"
                >
                  Anterior
                </Button>
                <Button
                  type="button"
                  onClick={() => setCategoryPage(p => Math.min(categoryPageCount - 1, p + 1))}
                  disabled={categoryPage >= categoryPageCount - 1}
                  variant="outline"
                  size="sm"
                  className="rounded-md border-[#ead7df] text-[#5d082a] hover:bg-[#fff5f8]"
                >
                  Próxima
                </Button>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
