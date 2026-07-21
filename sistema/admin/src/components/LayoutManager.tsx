import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  ExternalLink,
  Eye,
  EyeOff,
  GripVertical,
  Image as ImageIcon,
  Link2,
  Loader2,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { cmsAPI, uploadsAPI, getApiErrorMessage, resolveApiUrl } from '../services/api';
import PromoBannersManager from './PromoBannersManager';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';

interface HeroSlide {
  id: string;
  title: string;
  tag?: string;
  description?: string;
  ctaLabel?: string;
  imageUrl: string;
  link?: string;
  order: number;
  active: boolean;
}

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

interface SlideFormErrors {
  title?: string;
  imageUrl?: string;
  order?: string;
  link?: string;
}

const MAX_IMAGE_SIZE_MB = 5;

const createEmptySlide = (order: number): Partial<HeroSlide> => ({
  title: '',
  tag: '',
  description: '',
  ctaLabel: '',
  imageUrl: '',
  link: '',
  order,
  active: true,
});

const isValidLink = (value: string) => {
  if (!value.trim()) return true;
  if (value.startsWith('/')) return true;

  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
};

const getLinkPreviewLabel = (value: string) => {
  if (!value.trim()) return 'Sem destino definido';
  if (value.startsWith('/')) return `Interno: ${value}`;
  return `Externo: ${value}`;
};

export default function LayoutManager() {
  const [slides, setSlides] = useState<HeroSlide[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSlideModalOpen, setIsSlideModalOpen] = useState(false);
  const [editingSlide, setEditingSlide] = useState<Partial<HeroSlide> | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [slideErrors, setSlideErrors] = useState<SlideFormErrors>({});
  const [savingSlide, setSavingSlide] = useState(false);
  const [reorderingSlides, setReorderingSlides] = useState(false);
  const [draggingSlideId, setDraggingSlideId] = useState<string | null>(null);
  const [pendingDeleteSlide, setPendingDeleteSlide] = useState<HeroSlide | null>(null);
  const [categorySearch, setCategorySearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [categoryBusyId, setCategoryBusyId] = useState<string | null>(null);
  const [slideBusyId, setSlideBusyId] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

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

  const activeSlidesCount = slides.filter(slide => slide.active).length;
  const inactiveSlidesCount = slides.length - activeSlidesCount;
  const visibleCategoriesCount = categories.filter(category => category.active).length;

  const loadData = async () => {
    try {
      setLoading(true);
      const [slidesRes, catsRes] = await Promise.all([
        cmsAPI.heroSlides.getAll(),
        cmsAPI.categories.getAll(),
      ]);
      setSlides(slidesRes.data);
      setCategories(catsRes.data);
    } catch (error) {
      pushNotice('error', getApiErrorMessage(error, 'Erro ao carregar dados do layout'));
    } finally {
      setLoading(false);
    }
  };

  const resetSlideModal = () => {
    setIsSlideModalOpen(false);
    setEditingSlide(null);
    setSlideErrors({});
    setUploading(null);
  };

  const openNewSlideModal = () => {
    setEditingSlide(createEmptySlide(slides.length));
    setSlideErrors({});
    setIsSlideModalOpen(true);
  };

  const openEditSlideModal = (slide: HeroSlide) => {
    setEditingSlide({ ...slide });
    setSlideErrors({});
    setIsSlideModalOpen(true);
  };

  const validateSlide = (slide: Partial<HeroSlide>) => {
    const nextErrors: SlideFormErrors = {};

    if (!slide.title?.trim()) {
      nextErrors.title = 'Informe o título do banner.';
    }

    if (!slide.imageUrl?.trim()) {
      nextErrors.imageUrl = 'Envie uma imagem para o banner.';
    }

    if (!Number.isInteger(slide.order) || Number(slide.order) < 0) {
      nextErrors.order = 'A ordem precisa ser um número inteiro maior ou igual a zero.';
    }

    if (slide.link && !isValidLink(slide.link)) {
      nextErrors.link = 'Use uma rota interna começando com / ou uma URL http/https válida.';
    }

    return nextErrors;
  };

  const persistSlideOrder = async (orderedSlides: HeroSlide[]) => {
    setReorderingSlides(true);
    try {
      await Promise.all(
        orderedSlides.map((slide, index) => cmsAPI.heroSlides.update(slide.id, { order: index }))
      );
      setSlides(orderedSlides.map((slide, index) => ({ ...slide, order: index })));
      pushNotice('success', 'Ordem dos slides atualizada.');
    } catch (error) {
      pushNotice('error', getApiErrorMessage(error, 'Erro ao reordenar slides'));
      loadData();
    } finally {
      setReorderingSlides(false);
      setDraggingSlideId(null);
    }
  };

  const moveSlide = async (slideId: string, direction: -1 | 1) => {
    const index = slides.findIndex(slide => slide.id === slideId);
    const targetIndex = index + direction;

    if (index < 0 || targetIndex < 0 || targetIndex >= slides.length || reorderingSlides) return;

    const nextSlides = [...slides];
    const [movedSlide] = nextSlides.splice(index, 1);
    nextSlides.splice(targetIndex, 0, movedSlide);
    setSlides(nextSlides.map((slide, order) => ({ ...slide, order })));
    await persistSlideOrder(nextSlides);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'category' | 'hero', id?: string) => {
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
      setUploading(id || 'new');
      const res = await uploadsAPI.upload(file);
      const url = res.data.url;

      if (type === 'category' && id) {
        setCategoryBusyId(id);
        await cmsAPI.categories.update(id, { bannerUrl: url });
        setCategories(prev => prev.map(c => c.id === id ? { ...c, bannerUrl: url } : c));
        pushNotice('success', 'Banner da categoria atualizado.');
      } else if (type === 'hero' && id && id !== 'new') {
        await cmsAPI.heroSlides.update(id, { imageUrl: url });
        setSlides(prev => prev.map(s => s.id === id ? { ...s, imageUrl: url } : s));
        pushNotice('success', 'Imagem do slide atualizada.');
      } else if (type === 'hero' && (id === 'new' || !id)) {
        setEditingSlide(prev => ({ ...prev, imageUrl: url }));
        setSlideErrors(prev => ({ ...prev, imageUrl: undefined }));
        pushNotice('success', 'Imagem enviada com sucesso.');
      }
    } catch (error) {
      pushNotice('error', getApiErrorMessage(error, 'Erro no upload'));
    } finally {
      setUploading(null);
      setCategoryBusyId(null);
      e.target.value = '';
    }
  };

  const handleSaveSlide = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!editingSlide) return;

    const nextErrors = validateSlide(editingSlide);
    setSlideErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      pushNotice('error', 'Revise os campos obrigatórios antes de salvar.');
      return;
    }

    try {
      setSavingSlide(true);
      if (editingSlide.id) {
        await cmsAPI.heroSlides.update(editingSlide.id, editingSlide);
        pushNotice('success', 'Slide atualizado.');
      } else {
        await cmsAPI.heroSlides.create(editingSlide);
        pushNotice('success', 'Slide criado.');
      }
      resetSlideModal();
      await loadData();
    } catch (error) {
      pushNotice('error', getApiErrorMessage(error, 'Erro ao salvar slide'));
    } finally {
      setSavingSlide(false);
    }
  };

  const handleDeleteSlide = async () => {
    if (!pendingDeleteSlide) return;

    try {
      await cmsAPI.heroSlides.remove(pendingDeleteSlide.id);
      setPendingDeleteSlide(null);
      pushNotice('success', 'Slide removido.');
      await loadData();
    } catch (error) {
      pushNotice('error', getApiErrorMessage(error, 'Erro ao excluir'));
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

  const handleToggleSlide = async (slide: HeroSlide) => {
    try {
      setSlideBusyId(slide.id);
      await cmsAPI.heroSlides.update(slide.id, { active: !slide.active });
      setSlides(prev => prev.map(item => item.id === slide.id ? { ...item, active: !item.active } : item));
      pushNotice('success', slide.active ? 'Slide desativado.' : 'Slide ativado.');
    } catch (error) {
      pushNotice('error', getApiErrorMessage(error, 'Erro ao atualizar slide'));
    } finally {
      setSlideBusyId(null);
    }
  };

  const handleDropSlide = async (targetSlideId: string) => {
    if (!draggingSlideId || draggingSlideId === targetSlideId || reorderingSlides) return;

    const currentIndex = slides.findIndex(slide => slide.id === draggingSlideId);
    const targetIndex = slides.findIndex(slide => slide.id === targetSlideId);

    if (currentIndex < 0 || targetIndex < 0) return;

    const nextSlides = [...slides];
    const [draggedSlide] = nextSlides.splice(currentIndex, 1);
    nextSlides.splice(targetIndex, 0, draggedSlide);
    setSlides(nextSlides.map((slide, order) => ({ ...slide, order })));
    await persistSlideOrder(nextSlides);
  };

  const slideLinkValue = editingSlide?.link || '';
  const slideLinkValid = isValidLink(slideLinkValue);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-[#5d082a]" size={40} />
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

      {/* Hero Slider Management */}
      <section className="overflow-hidden rounded-[16px] border border-[#ead7df] bg-[linear-gradient(180deg,#fffafc_0%,#ffffff_38%,#fff8fb_100%)] shadow-[0_18px_60px_rgba(93,8,42,0.08)]">
        <div className="flex flex-col gap-6 border-b border-[#f1dbe3] p-6 sm:p-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-4">
            <div>
            <h2 className="text-xl font-bold text-gray-800">Slider de Destaque (Topo)</h2>
              <p className="text-sm text-gray-500">Banners rotativos que aparecem no topo da página inicial.</p>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-[#f1dbe3] bg-white px-4 py-3">
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#8d5b70]">Total</p>
                <p className="mt-2 text-2xl font-black text-[#5d082a]">{slides.length}</p>
              </div>
              <div className="rounded-lg border border-emerald-100 bg-emerald-50 px-4 py-3">
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-700">Ativos</p>
                <p className="mt-2 text-2xl font-black text-emerald-900">{activeSlidesCount}</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">Inativos</p>
                <p className="mt-2 text-2xl font-black text-slate-700">{inactiveSlidesCount}</p>
              </div>
            </div>
          </div>
          <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
            <div className="rounded-lg border border-[#f1dbe3] bg-white px-4 py-3 text-xs text-gray-500">
              Reordene arrastando os cards ou use os controles de seta para manter suporte por teclado.
            </div>
            <Button
            onClick={openNewSlideModal}
            className="h-12 justify-center rounded-lg bg-[#5d082a] px-4 text-white hover:bg-[#4a0622]"
            disabled={reorderingSlides}
          >
            <Plus size={18} /> Novo Slide
          </Button>
          </div>
        </div>

        <div className="p-6 sm:p-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {slides.map(slide => (
              <div
                key={slide.id}
                draggable={!reorderingSlides}
                onDragStart={() => setDraggingSlideId(slide.id)}
                onDragOver={e => e.preventDefault()}
                onDrop={() => handleDropSlide(slide.id)}
                onDragEnd={() => setDraggingSlideId(null)}
                className={`group relative overflow-hidden rounded-[14px] border bg-white transition ${
                  draggingSlideId === slide.id
                    ? 'border-[#5d082a] shadow-[0_20px_50px_rgba(93,8,42,0.18)]'
                    : 'border-[#ead7df] shadow-[0_12px_30px_rgba(93,8,42,0.08)] hover:-translate-y-1 hover:shadow-[0_18px_45px_rgba(93,8,42,0.14)]'
                } ${!slide.active ? 'opacity-75' : ''}`}
              >
                <div className="relative aspect-video bg-[#f7edf1]">
                  <img src={resolveApiUrl(slide.imageUrl)} alt={`Banner ${slide.title}`} className="h-full w-full object-cover" />
                  <div className="absolute inset-x-0 top-0 flex items-start justify-between p-3">
                    <Badge variant="outline" className="border-white/70 bg-white/92 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[#5d082a] shadow-sm">
                      <GripVertical size={12} />
                      Arrastar
                    </Badge>
                    <Badge
                      variant={slide.active ? 'success' : 'secondary'}
                      className={`px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] ${
                        slide.active ? '' : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {slide.active ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center gap-3 bg-black/50 opacity-0 transition group-hover:opacity-100">
                    <Button
                      type="button"
                      onClick={() => openEditSlideModal(slide)}
                      variant="secondary"
                      size="icon"
                      className="rounded-full bg-white text-gray-800 transition hover:scale-110 hover:bg-white"
                      aria-label={`Editar slide ${slide.title}`}
                    >
                      <ImageIcon size={18} />
                    </Button>
                    <Button
                      type="button"
                      onClick={() => setPendingDeleteSlide(slide)}
                      variant="destructive"
                      size="icon"
                      className="rounded-full bg-red-500 text-white transition hover:scale-110 hover:bg-red-600"
                      aria-label={`Excluir slide ${slide.title}`}
                    >
                      <Trash2 size={18} />
                    </Button>
                  </div>
                </div>
                <div className="space-y-4 p-5">
                  <div className="flex items-center justify-between gap-3">
                     <Badge variant="outline" className="border-[#f7dce7] bg-[#fdf0f4] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[#5d082a]">{slide.tag || 'Destaque'}</Badge>
                     <span className="text-[11px] text-gray-400 font-mono">ordem {slide.order}</span>
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-800">{slide.title}</h3>
                    {slide.description && (
                      <p className="mt-1 text-xs text-gray-500 line-clamp-2">{slide.description}</p>
                    )}
                    <div className="mt-2 flex items-center gap-2">
                      {slide.ctaLabel && (
                         <Badge className="bg-[#5d082a] px-3 py-0.5 text-[10px] font-bold text-white hover:bg-[#5d082a]">{slide.ctaLabel}</Badge>
                      )}
                      <p className="flex items-center gap-1 text-xs text-gray-400 truncate">
                        <Link2 size={12} />
                        <span className="truncate">{slide.link ? getLinkPreviewLabel(slide.link) : 'Sem link'}</span>
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      type="button"
                      onClick={() => handleToggleSlide(slide)}
                      disabled={slideBusyId === slide.id}
                      variant="secondary"
                      className={`min-h-11 rounded-lg px-3 py-2 ${
                        slide.active
                          ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                          : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                      }`}
                      aria-label={slide.active ? `Desativar slide ${slide.title}` : `Ativar slide ${slide.title}`}
                    >
                      {slide.active ? <EyeOff size={16} /> : <Eye size={16} />}
                      {slide.active ? 'Desativar' : 'Ativar'}
                    </Button>
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        type="button"
                        onClick={() => moveSlide(slide.id, -1)}
                        disabled={reorderingSlides || slide.order === 0}
                        variant="outline"
                        className="min-h-11 rounded-lg border-[#ead7df] text-gray-600 hover:bg-[#fff5f8]"
                        aria-label={`Mover slide ${slide.title} para cima`}
                      >
                        <ArrowUp size={16} />
                      </Button>
                      <Button
                        type="button"
                        onClick={() => moveSlide(slide.id, 1)}
                        disabled={reorderingSlides || slide.order === slides.length - 1}
                        variant="outline"
                        className="min-h-11 rounded-lg border-[#ead7df] text-gray-600 hover:bg-[#fff5f8]"
                        aria-label={`Mover slide ${slide.title} para baixo`}
                      >
                        <ArrowDown size={16} />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          {slides.length === 0 && <p className="py-12 text-center italic text-gray-400">Nenhum slide cadastrado ainda.</p>}
        </div>
      </section>

      {/* Category Banners Management */}
      <section className="overflow-hidden rounded-[16px] border border-[#ead7df] bg-white shadow-[0_18px_60px_rgba(93,8,42,0.08)]">
        <div className="border-b border-[#f1dbe3] bg-[linear-gradient(180deg,#fffafc_0%,#fff 100%)] p-6 sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-4">
              <div>
                <h2 className="text-xl font-bold text-gray-800">Banners das Seções (Categorias)</h2>
                <p className="text-sm text-gray-500">Imagens de fundo para as divisões da vitrine na Home.</p>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="rounded-lg border border-[#f1dbe3] bg-white px-4 py-3">
                  <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#8d5b70]">Categorias</p>
                  <p className="mt-2 text-2xl font-black text-[#5d082a]">{categories.length}</p>
                </div>
                <div className="rounded-lg border border-emerald-100 bg-emerald-50 px-4 py-3">
                  <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-700">Visíveis</p>
                  <p className="mt-2 text-2xl font-black text-emerald-900">{visibleCategoriesCount}</p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">Filtradas</p>
                  <p className="mt-2 text-2xl font-black text-slate-700">{filteredCategories.length}</p>
                </div>
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
            <TableHeader className="bg-gray-50 text-xs tracking-wider text-gray-600">
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
              {filteredCategories.map(cat => (
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
                        onChange={(e) => handleFileUpload(e, 'category', cat.id)} 
                      />
                    </Label>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {filteredCategories.length === 0 && (
            <div className="px-6 py-12 text-center text-sm text-gray-400">
              Nenhuma categoria encontrada com os filtros atuais.
            </div>
          )}
        </div>
      </section>

      <PromoBannersManager />

      {/* Slide Edit Modal */}
      {isSlideModalOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 px-4 py-8 backdrop-blur-sm sm:py-12">
          <div className="w-full max-w-md overflow-hidden rounded-lg bg-white shadow-2xl ring-1 ring-black/5">
            <div className="flex items-center justify-between border-b border-gray-100 p-5 sm:p-6">
              <h3 className="text-lg font-bold">{editingSlide?.id ? 'Editar Slide' : 'Novo Slide'}</h3>
              <Button type="button" onClick={resetSlideModal} variant="ghost" size="icon" className="rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-700" aria-label="Fechar modal de slide">
                <X size={24} />
              </Button>
            </div>
            <form onSubmit={handleSaveSlide} className="space-y-4 p-5 sm:p-6">
              <div>
                <Label className="mb-1 block text-xs font-bold uppercase text-gray-500">Título do Banner</Label>
                <Input
                  type="text" 
                  value={editingSlide?.title || ''}
                  onChange={e => {
                    setEditingSlide(prev => ({ ...prev, title: e.target.value }));
                    setSlideErrors(prev => ({ ...prev, title: undefined }));
                  }}
                  className={`rounded-lg px-4 focus-visible:ring-[#5d082a] ${slideErrors.title ? 'border-red-300 bg-red-50' : ''}`}
                  placeholder="Ex: Carnes Nobres Selecionadas"
                  aria-invalid={Boolean(slideErrors.title)}
                />
                {slideErrors.title && <p className="mt-1 text-xs text-red-600">{slideErrors.title}</p>}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="mb-1 block text-xs font-bold uppercase text-gray-500">Tag (Opcional)</Label>
                  <Input
                    type="text" 
                    value={editingSlide?.tag || ''}
                    onChange={e => setEditingSlide(prev => ({ ...prev, tag: e.target.value }))}
                    className="rounded-lg px-4 focus-visible:ring-[#5d082a]"
                    placeholder="Ex: OFERTA"
                  />
                </div>
                <div>
                  <Label className="mb-1 block text-xs font-bold uppercase text-gray-500">Ordem</Label>
                  <Input
                    type="number" 
                    value={editingSlide?.order || 0}
                    min={0}
                    onChange={e => {
                      const value = Number(e.target.value);
                      setEditingSlide(prev => ({ ...prev, order: Number.isNaN(value) ? 0 : value }));
                      setSlideErrors(prev => ({ ...prev, order: undefined }));
                    }}
                    className={`rounded-lg px-4 focus-visible:ring-[#5d082a] ${slideErrors.order ? 'border-red-300 bg-red-50' : ''}`}
                    aria-invalid={Boolean(slideErrors.order)}
                  />
                  {slideErrors.order && <p className="mt-1 text-xs text-red-600">{slideErrors.order}</p>}
                </div>
              </div>
              <div>
                <Label className="mb-1 block text-xs font-bold uppercase text-gray-500">Descrição (Opcional)</Label>
                <Textarea
                  value={editingSlide?.description || ''}
                  onChange={e => setEditingSlide(prev => ({ ...prev, description: e.target.value }))}
                  rows={3}
                  className="resize-none rounded-lg px-4 focus-visible:ring-[#5d082a]"
                  placeholder="Ex: Rótulos selecionados para presentear ou comemorar."
                />
              </div>
              <div>
                <Label className="mb-1 block text-xs font-bold uppercase text-gray-500">Texto do Botão (Opcional)</Label>
                <Input
                  type="text"
                  value={editingSlide?.ctaLabel || ''}
                  onChange={e => setEditingSlide(prev => ({ ...prev, ctaLabel: e.target.value }))}
                  className="rounded-lg px-4 focus-visible:ring-[#5d082a]"
                  placeholder="Ex: Ver vinhos"
                />
                <p className="mt-1 text-[11px] text-gray-400">Se não preenchido, o botão usará "Ver oferta".</p>
              </div>
              <div>
                <Label className="mb-1 block text-xs font-bold uppercase text-gray-500">Link de Destino</Label>
                <Input
                  type="text" 
                  value={editingSlide?.link || ''}
                  onChange={e => {
                    setEditingSlide(prev => ({ ...prev, link: e.target.value }));
                    setSlideErrors(prev => ({ ...prev, link: undefined }));
                  }}
                  className={`rounded-lg px-4 focus-visible:ring-[#5d082a] ${slideErrors.link ? 'border-red-300 bg-red-50' : ''}`}
                  placeholder="Ex: /vinhos ou link externo"
                  aria-invalid={Boolean(slideErrors.link)}
                />
                {slideErrors.link ? (
                  <p className="mt-1 text-xs text-red-600">{slideErrors.link}</p>
                ) : (
                  <div className={`mt-2 flex items-center gap-2 rounded-lg border px-3 py-2 text-xs ${slideLinkValid ? 'border-[#ead7df] bg-[#fff8fb] text-gray-600' : 'border-red-200 bg-red-50 text-red-700'}`}>
                    <ExternalLink size={14} />
                    {getLinkPreviewLabel(slideLinkValue)}
                  </div>
                )}
              </div>
              <div className="rounded-lg border border-[#ead7df] bg-[#fff8fb] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#8d5b70]">Visibilidade</p>
                    <p className="mt-1 text-sm text-gray-500">Controle se o banner deve aparecer na home assim que for salvo.</p>
                  </div>
                  <Button
                    type="button"
                    onClick={() => setEditingSlide(prev => ({ ...prev, active: !(prev?.active ?? true) }))}
                    variant="secondary"
                    className={`min-h-11 rounded-md px-4 ${(editingSlide?.active ?? true) ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-100' : 'bg-slate-200 text-slate-700 hover:bg-slate-200'}`}
                    aria-pressed={editingSlide?.active ?? true}
                  >
                    {(editingSlide?.active ?? true) ? <Eye size={16} /> : <EyeOff size={16} />}
                    {(editingSlide?.active ?? true) ? 'Ativo na home' : 'Oculto na home'}
                  </Button>
                </div>
              </div>
              <div>
                <Label className="mb-1 block text-xs font-bold uppercase text-gray-500">Imagem do Banner</Label>
                <p className="text-xs text-gray-500">Use imagem horizontal. Formatos aceitos: JPG, PNG, WebP. Tamanho máximo de 5MB.</p>
                <div className={`relative mt-2 aspect-video overflow-hidden rounded-lg border-2 border-dashed bg-gray-100 ${slideErrors.imageUrl ? 'border-red-300' : 'border-gray-300'} group`}>
                  {editingSlide?.imageUrl ? (
                    <>
                      <img src={resolveApiUrl(editingSlide.imageUrl)} className="w-full h-full object-cover" alt="Pré-visualização do banner" />
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                         <Label className="cursor-pointer rounded-lg bg-white px-4 py-2 text-xs font-bold text-gray-800">
                           Alterar Foto
                           <Input type="file" className="hidden" accept="image/*" onChange={e => handleFileUpload(e, 'hero')} aria-label="Alterar imagem do slide" />
                         </Label>
                      </div>
                    </>
                  ) : (
                    <Label className="absolute inset-0 flex cursor-pointer flex-col items-center justify-center transition hover:bg-gray-200">
                       <ImageIcon size={32} className="text-gray-400 mb-2" />
                       <span className="text-xs text-gray-500">Clique para subir imagem</span>
                       {uploading === 'new' && <span className="text-[10px] text-[#5d082a] font-bold mt-1">Subindo...</span>}
                       <Input type="file" className="hidden" accept="image/*" onChange={e => handleFileUpload(e, 'hero')} aria-label="Enviar imagem do slide" />
                    </Label>
                  )}
                </div>
                {slideErrors.imageUrl && <p className="mt-1 text-xs text-red-600">{slideErrors.imageUrl}</p>}
              </div>
              <Button
                type="submit"
                disabled={savingSlide || uploading === 'new'}
                className="h-12 w-full rounded-lg bg-[#5d082a] font-bold text-white shadow-lg shadow-[#5d082a]/20 hover:bg-[#4a0622]"
              >
                {savingSlide ? 'Salvando...' : 'Salvar Slide'}
              </Button>
            </form>
          </div>
        </div>
      )}

      {pendingDeleteSlide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-[16px] bg-white p-6 shadow-2xl">
            <div className="flex items-start gap-4">
              <div className="rounded-lg bg-red-50 p-3 text-red-600">
                <Trash2 size={20} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">Excluir slide</h3>
                <p className="mt-2 text-sm text-gray-500">
                  O slide <span className="font-semibold text-gray-700">{pendingDeleteSlide.title}</span> será removido do carrossel. Esta ação não pode ser desfeita.
                </p>
              </div>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <Button
                type="button"
                onClick={() => setPendingDeleteSlide(null)}
                variant="outline"
                className="min-h-11 rounded-lg border-gray-200 px-4 py-3 text-gray-700 hover:bg-gray-50"
              >
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={handleDeleteSlide}
                variant="destructive"
                className="min-h-11 rounded-lg bg-red-600 px-4 py-3 text-white hover:bg-red-700"
              >
                Excluir slide
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
