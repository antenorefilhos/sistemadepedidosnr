import { useEffect, useState } from 'react';
import {
  Check,
  AlertCircle,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Eye,
  EyeOff,
  Image as ImageIcon,
  Link2,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import { cmsAPI, getApiErrorMessage, productsAPI, resolveApiUrl, uploadsAPI } from '../services/api';
import type { AdminProduct } from '../services/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

interface PromoBanner {
  id: string;
  title: string;
  subtitle?: string;
  link?: string;
  badge?: string;
  highlightNote?: string;
  highlightedProductId?: string;
  highlightedProduct?: {
    id: string;
    name: string;
  };
  description?: string;
  imageUrl: string;
  ctaLabel?: string;
  ctaTo?: string;
  align: 'left' | 'right';
  active: boolean;
  order: number;
}

interface Notice {
  id: number;
  tone: 'success' | 'error';
  message: string;
}

interface PromoFormErrors {
  title?: string;
  imageUrl?: string;
  order?: string;
  link?: string;
}

const MAX_IMAGE_SIZE_MB = 5;

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

export default function PromoBannersManager() {
  const [items, setItems] = useState<PromoBanner[]>([]);
  const [loading, setLoading] = useState(true);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<PromoBanner> | null>(null);
  const [errors, setErrors] = useState<PromoFormErrors>({});
  const [pendingDelete, setPendingDelete] = useState<PromoBanner | null>(null);
  const [productSearch, setProductSearch] = useState('');
  const [productOptions, setProductOptions] = useState<AdminProduct[]>([]);
  const [productSearchLoading, setProductSearchLoading] = useState(false);

  const pushNotice = (tone: Notice['tone'], message: string) => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setNotices(prev => [...prev, { id, tone, message }]);
    window.setTimeout(() => {
      setNotices(prev => prev.filter(notice => notice.id !== id));
    }, 4000);
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const response = await cmsAPI.promoBanners.getAll();
      const sorted = [...response.data].sort((a: PromoBanner, b: PromoBanner) => a.order - b.order);
      setItems(sorted);
    } catch (error) {
      pushNotice('error', getApiErrorMessage(error, 'Erro ao carregar banners promocionais'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (!isModalOpen) return;

    const loadProducts = async () => {
      try {
        setProductSearchLoading(true);
        const response = await productsAPI.getAdmin({
          search: productSearch.trim() || undefined,
          page: 1,
          limit: 8,
        });
        setProductOptions((response.data?.data || []) as AdminProduct[]);
      } catch (error) {
        pushNotice('error', getApiErrorMessage(error, 'Erro ao buscar produtos'));
      } finally {
        setProductSearchLoading(false);
      }
    };

    const timeout = window.setTimeout(loadProducts, 180);
    return () => window.clearTimeout(timeout);
  }, [isModalOpen, productSearch]);

  const resetModal = () => {
    setIsModalOpen(false);
    setEditing(null);
    setErrors({});
    setUploading(false);
    setProductSearch('');
    setProductOptions([]);
  };

  const openNewModal = () => {
    setEditing({
      title: '',
      subtitle: '',
      highlightNote: '',
      highlightedProductId: '',
      description: '',
      imageUrl: '',
      ctaLabel: '',
      link: '',
      align: 'left',
      active: true,
      order: items.length,
    });
    setErrors({});
    setProductSearch('');
    setIsModalOpen(true);
  };

  const validate = (payload: Partial<PromoBanner>) => {
    const nextErrors: PromoFormErrors = {};

    if (!payload.title?.trim()) {
      nextErrors.title = 'Informe um titulo para o banner.';
    }

    if (!payload.imageUrl?.trim()) {
      nextErrors.imageUrl = 'Envie uma imagem para o banner.';
    }

    if (!Number.isInteger(payload.order) || Number(payload.order) < 0) {
      nextErrors.order = 'A ordem precisa ser um numero inteiro maior ou igual a zero.';
    }

    const destinationLink = payload.link ?? payload.ctaTo;
    if (destinationLink && !isValidLink(destinationLink)) {
      nextErrors.link = 'Use uma rota interna iniciando com / ou URL http/https valida.';
    }

    return nextErrors;
  };

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      pushNotice('error', 'Selecione um arquivo de imagem valido.');
      event.target.value = '';
      return;
    }

    if (file.size > MAX_IMAGE_SIZE_MB * 1024 * 1024) {
      pushNotice('error', `A imagem deve ter no maximo ${MAX_IMAGE_SIZE_MB}MB.`);
      event.target.value = '';
      return;
    }

    try {
      setUploading(true);
      const response = await uploadsAPI.upload(file);
      setEditing(prev => ({ ...prev, imageUrl: response.data.url }));
      setErrors(prev => ({ ...prev, imageUrl: undefined }));
      pushNotice('success', 'Imagem enviada com sucesso.');
    } catch (error) {
      pushNotice('error', getApiErrorMessage(error, 'Erro no upload do banner'));
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editing) return;

    const nextErrors = validate(editing);
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      pushNotice('error', 'Revise os campos obrigatorios antes de salvar.');
      return;
    }

    try {
      setSaving(true);
      const payload = {
        ...editing,
        subtitle: editing.subtitle ?? editing.badge,
        link: editing.link ?? editing.ctaTo,
        highlightedProductId: String(editing.highlightedProductId || '').trim() || null,
      };

      if (editing.id) {
        await cmsAPI.promoBanners.update(editing.id, payload);
        pushNotice('success', 'Banner promocional atualizado.');
      } else {
        await cmsAPI.promoBanners.create(payload);
        pushNotice('success', 'Banner promocional criado.');
      }
      resetModal();
      await loadData();
    } catch (error) {
      pushNotice('error', getApiErrorMessage(error, 'Erro ao salvar banner promocional'));
    } finally {
      setSaving(false);
    }
  };

  const persistOrder = async (ordered: PromoBanner[]) => {
    try {
      await Promise.all(ordered.map((item, index) => cmsAPI.promoBanners.update(item.id, { order: index })));
      setItems(ordered.map((item, index) => ({ ...item, order: index })));
    } catch (error) {
      pushNotice('error', getApiErrorMessage(error, 'Erro ao reordenar banners'));
      await loadData();
    }
  };

  const moveItem = async (id: string, direction: -1 | 1) => {
    const index = items.findIndex(item => item.id === id);
    const targetIndex = index + direction;
    if (index < 0 || targetIndex < 0 || targetIndex >= items.length) return;

    const nextItems = [...items];
    const [moved] = nextItems.splice(index, 1);
    nextItems.splice(targetIndex, 0, moved);
    setItems(nextItems.map((item, itemOrder) => ({ ...item, order: itemOrder })));
    await persistOrder(nextItems);
  };

  const handleToggle = async (item: PromoBanner) => {
    try {
      setBusyId(item.id);
      await cmsAPI.promoBanners.update(item.id, { active: !item.active });
      setItems(prev => prev.map(current => (current.id === item.id ? { ...current, active: !current.active } : current)));
      pushNotice('success', item.active ? 'Banner ocultado da home.' : 'Banner ativado na home.');
    } catch (error) {
      pushNotice('error', getApiErrorMessage(error, 'Erro ao atualizar banner'));
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async () => {
    if (!pendingDelete) return;

    try {
      await cmsAPI.promoBanners.remove(pendingDelete.id);
      setPendingDelete(null);
      pushNotice('success', 'Banner promocional removido.');
      await loadData();
    } catch (error) {
      pushNotice('error', getApiErrorMessage(error, 'Erro ao remover banner'));
    }
  };

  const activeCount = items.filter(item => item.active).length;

  return (
    <section className="overflow-hidden rounded-[16px] border border-[#ead7df] bg-[linear-gradient(180deg,#fffafc_0%,#ffffff_38%,#fff8fb_100%)] shadow-[0_18px_60px_rgba(93,8,42,0.08)]">
      {notices.length > 0 && (
        <div className="border-b border-[#f1dbe3] px-6 py-4 sm:px-8">
          <div className="flex flex-col gap-2">
            {notices.map(notice => (
              <div
                key={notice.id}
                className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-sm ${
                  notice.tone === 'success'
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                    : 'border-red-200 bg-red-50 text-red-900'
                }`}
              >
                {notice.tone === 'success' ? <CheckCircle2 size={16} className="mt-0.5" /> : <AlertCircle size={16} className="mt-0.5" />}
                <span className="flex-1">{notice.message}</span>
                <Button
                  type="button"
                  onClick={() => setNotices(prev => prev.filter(item => item.id !== notice.id))}
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 rounded-full text-current hover:bg-black/5 hover:text-current"
                  aria-label="Fechar aviso"
                >
                  <X size={12} />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="border-b border-[#f1dbe3] p-6 sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-bold text-gray-800">Banners Promocionais da Home</h2>
              <p className="text-sm text-gray-500">Gerencie os banners grandes entre as secoes da pagina inicial.</p>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-[#f1dbe3] bg-white px-4 py-3">
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#8d5b70]">Total</p>
                <p className="mt-2 text-2xl font-black text-[#5d082a]">{items.length}</p>
              </div>
              <div className="rounded-lg border border-emerald-100 bg-emerald-50 px-4 py-3">
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-700">Ativos</p>
                <p className="mt-2 text-2xl font-black text-emerald-900">{activeCount}</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">Inativos</p>
                <p className="mt-2 text-2xl font-black text-slate-700">{items.length - activeCount}</p>
              </div>
            </div>
          </div>

          <Button
            type="button"
            onClick={openNewModal}
            className="min-h-11 rounded-lg bg-[#5d082a] px-4 py-3 text-white hover:bg-[#4a0622]"
          >
            <Plus size={18} /> Novo Banner
          </Button>
        </div>
      </div>

      <div className="p-6 sm:p-8">
        {loading ? (
          <div className="flex h-40 items-center justify-center">
            <Loader2 className="animate-spin text-[#5d082a]" size={32} />
          </div>
        ) : items.length === 0 ? (
          <p className="py-12 text-center italic text-gray-400">Nenhum banner promocional cadastrado ainda.</p>
        ) : (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {items.map(item => (
              <div key={item.id} className="overflow-hidden rounded-lg border border-[#ead7df] bg-white shadow-[0_12px_30px_rgba(93,8,42,0.08)]">
                <div className="relative aspect-[16/7] bg-[#f7edf1]">
                  <img src={resolveApiUrl(item.imageUrl)} alt={item.title} className="h-full w-full object-cover" />
                  <Badge variant="outline" className="absolute left-3 top-3 border-white/70 bg-white/95 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[#5d082a]">
                    ordem {item.order}
                  </Badge>
                  <Badge variant="outline" className="absolute right-3 top-3 border-white/70 bg-white/95 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-gray-700">
                    {item.align === 'right' ? 'Alinhado direita' : 'Alinhado esquerda'}
                  </Badge>
                </div>
                <div className="space-y-4 p-5">
                  <div>
                    <h3 className="font-bold text-gray-800">{item.title}</h3>
                    <p className="mt-1 text-xs font-semibold uppercase tracking-[0.18em] text-[#8d5b70]">{item.subtitle || item.badge || 'Sem subtitulo'}</p>
                    <p className="mt-1 text-sm text-gray-500">{item.description || 'Sem descricao informada.'}</p>
                    {(item.highlightedProduct?.name || item.highlightedProductId) && (
                      <p className="mt-1 text-xs text-[#5d082a]">
                        Produto exaltado: {item.highlightedProduct?.name || item.highlightedProductId}
                      </p>
                    )}
                    {item.highlightNote && (
                      <p className="mt-1 text-xs text-gray-600">Nota: {item.highlightNote}</p>
                    )}
                    <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
                      <Link2 size={13} />
                      <span className="truncate">{item.link || item.ctaTo || 'Sem destino configurado'}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      type="button"
                      onClick={() => handleToggle(item)}
                      disabled={busyId === item.id}
                      variant="secondary"
                      className={`min-h-11 rounded-lg px-3 py-2 ${
                        item.active
                          ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                          : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                      }`}
                    >
                      {item.active ? <EyeOff size={16} /> : <Eye size={16} />}
                      {item.active ? 'Desativar' : 'Ativar'}
                    </Button>
                    <Button
                      type="button"
                      onClick={() => {
                        setEditing({ ...item });
                        setErrors({});
                        setIsModalOpen(true);
                      }}
                      variant="outline"
                      className="min-h-11 rounded-lg border-[#ead7df] text-gray-700 hover:bg-[#fff5f8]"
                    >
                      <Pencil size={16} /> Editar
                    </Button>
                  </div>

                  <div className="grid grid-cols-4 gap-2">
                    <Button
                      type="button"
                      onClick={() => moveItem(item.id, -1)}
                      disabled={item.order === 0}
                      variant="outline"
                      className="min-h-11 rounded-lg border-[#ead7df] text-gray-600 hover:bg-[#fff5f8]"
                      aria-label={`Mover banner ${item.title} para cima`}
                    >
                      <ArrowUp size={16} />
                    </Button>
                    <Button
                      type="button"
                      onClick={() => moveItem(item.id, 1)}
                      disabled={item.order === items.length - 1}
                      variant="outline"
                      className="min-h-11 rounded-lg border-[#ead7df] text-gray-600 hover:bg-[#fff5f8]"
                      aria-label={`Mover banner ${item.title} para baixo`}
                    >
                      <ArrowDown size={16} />
                    </Button>
                    <Label className="col-span-1 flex min-h-11 cursor-pointer items-center justify-center rounded-lg border border-[#ead7df] text-gray-600 transition hover:bg-[#fff5f8]">
                      <ImageIcon size={16} />
                      <Input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        aria-label={`Trocar imagem do banner ${item.title}`}
                        onChange={async event => {
                          const file = event.target.files?.[0];
                          if (!file) return;

                          if (!file.type.startsWith('image/')) {
                            pushNotice('error', 'Selecione um arquivo de imagem valido.');
                            event.target.value = '';
                            return;
                          }

                          if (file.size > MAX_IMAGE_SIZE_MB * 1024 * 1024) {
                            pushNotice('error', `A imagem deve ter no maximo ${MAX_IMAGE_SIZE_MB}MB.`);
                            event.target.value = '';
                            return;
                          }

                          try {
                            setBusyId(item.id);
                            const response = await uploadsAPI.upload(file);
                            await cmsAPI.promoBanners.update(item.id, { imageUrl: response.data.url });
                            setItems(prev =>
                              prev.map(current =>
                                current.id === item.id ? { ...current, imageUrl: response.data.url } : current,
                              ),
                            );
                            pushNotice('success', 'Imagem do banner atualizada.');
                          } catch (error) {
                            pushNotice('error', getApiErrorMessage(error, 'Erro ao trocar imagem'));
                          } finally {
                            setBusyId(null);
                            event.target.value = '';
                          }
                        }}
                      />
                    </Label>
                    <Button
                      type="button"
                      onClick={() => setPendingDelete(item)}
                      variant="outline"
                      className="min-h-11 rounded-lg border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                      aria-label={`Excluir banner ${item.title}`}
                    >
                      <Trash2 size={16} />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {isModalOpen && editing && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 px-4 py-8 backdrop-blur-sm sm:py-12">
          <div className="w-full max-w-md overflow-hidden rounded-lg bg-white shadow-2xl ring-1 ring-black/5">
            <div className="flex items-center justify-between border-b border-gray-100 p-5 sm:p-6">
              <h3 className="text-lg font-bold">{editing.id ? 'Editar Banner Promocional' : 'Novo Banner Promocional'}</h3>
              <Button
                type="button"
                onClick={resetModal}
                variant="ghost"
                size="icon"
                className="rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                aria-label="Fechar modal de banner promocional"
              >
                <X size={24} />
              </Button>
            </div>

            <form onSubmit={handleSave} className="space-y-4 p-5 sm:p-6">
              <div>
                <Label className="mb-1 block text-xs font-bold uppercase text-gray-500">Titulo</Label>
                <Input
                  type="text"
                  value={editing.title || ''}
                  onChange={event => {
                    setEditing(prev => ({ ...prev, title: event.target.value }));
                    setErrors(prev => ({ ...prev, title: undefined }));
                  }}
                  className={`rounded-lg px-4 focus-visible:ring-[#5d082a] ${errors.title ? 'border-red-300 bg-red-50' : ''}`}
                />
                {errors.title && <p className="mt-1 text-xs text-red-600">{errors.title}</p>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="mb-1 block text-xs font-bold uppercase text-gray-500">Subtitulo</Label>
                  <Input
                    type="text"
                    value={editing.subtitle || editing.badge || ''}
                    onChange={event => setEditing(prev => ({ ...prev, subtitle: event.target.value }))}
                    className="rounded-lg px-4 focus-visible:ring-[#5d082a]"
                  />
                </div>
                <div>
                  <Label className="mb-1 block text-xs font-bold uppercase text-gray-500">Ordem</Label>
                  <Input
                    type="number"
                    min={0}
                    value={editing.order ?? 0}
                    onChange={event => {
                      const value = Number(event.target.value);
                      setEditing(prev => ({ ...prev, order: Number.isNaN(value) ? 0 : value }));
                      setErrors(prev => ({ ...prev, order: undefined }));
                    }}
                    className={`rounded-lg px-4 focus-visible:ring-[#5d082a] ${errors.order ? 'border-red-300 bg-red-50' : ''}`}
                  />
                  {errors.order && <p className="mt-1 text-xs text-red-600">{errors.order}</p>}
                </div>
              </div>

              <div>
                <Label className="mb-1 block text-xs font-bold uppercase text-gray-500">Descricao</Label>
                <Textarea
                  value={editing.description || ''}
                  onChange={event => setEditing(prev => ({ ...prev, description: event.target.value }))}
                  rows={3}
                  className="resize-none rounded-lg px-4 focus-visible:ring-[#5d082a]"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="mb-1 block text-xs font-bold uppercase text-gray-500">Buscar produto exaltado</Label>
                  <Input
                    type="search"
                    value={productSearch}
                    onChange={event => setProductSearch(event.target.value)}
                    className="rounded-lg px-4 focus-visible:ring-[#5d082a]"
                    placeholder="Nome, EAN ou termo"
                  />
                </div>
                <div>
                  <Label className="mb-1 block text-xs font-bold uppercase text-gray-500">Nota do destaque</Label>
                  <Input
                    type="text"
                    value={editing.highlightNote || ''}
                    onChange={event => setEditing(prev => ({ ...prev, highlightNote: event.target.value }))}
                    className="rounded-lg px-4 focus-visible:ring-[#5d082a]"
                    placeholder="ex: Mais pedido da semana"
                  />
                </div>
              </div>

              <div className="rounded-lg border border-[#ead7df] bg-[#fff8fb] p-3">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#8d5b70]">Produto selecionado</p>
                  {editing.highlightedProductId && (
                    <Button
                      type="button"
                      onClick={() => setEditing(prev => ({ ...prev, highlightedProductId: '', highlightedProduct: undefined }))}
                      variant="link"
                      size="sm"
                      className="h-auto px-0 text-xs font-bold text-[#5d082a]"
                    >
                      Limpar
                    </Button>
                  )}
                </div>
                {editing.highlightedProductId ? (
                  <p className="text-sm text-gray-700">
                    {editing.highlightedProduct?.name || editing.highlightedProductId}
                  </p>
                ) : (
                  <p className="text-sm text-gray-400">Nenhum produto exaltado selecionado.</p>
                )}
              </div>

              <div className="space-y-2 rounded-lg border border-[#ead7df] bg-white p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#8d5b70]">Sugestões de produto</p>
                  {productSearchLoading && <Loader2 size={14} className="animate-spin text-[#5d082a]" />}
                </div>
                <div className="max-h-48 space-y-2 overflow-y-auto pr-1">
                  {productOptions.map((product) => {
                    const isSelected = editing.highlightedProductId === product.id;
                    return (
                      <Button
                        key={product.id}
                        type="button"
                        onClick={() => setEditing(prev => ({ ...prev, highlightedProductId: product.id, highlightedProduct: { id: product.id, name: product.name } }))}
                        variant="outline"
                        className={`h-auto w-full items-start justify-between rounded-lg px-3 py-3 text-left whitespace-normal ${
                          isSelected
                            ? 'border-[#5d082a] bg-[#fff3f7]'
                            : 'border-[#ead7df] hover:bg-[#fff8fb] hover:text-gray-900'
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-gray-800">{product.name}</p>
                          <p className="mt-1 text-xs text-gray-500">EAN {product.ean} {product.stock != null ? `• estoque ${product.stock}` : ''}</p>
                        </div>
                        {isSelected && <Check size={16} className="mt-0.5 shrink-0 text-[#5d082a]" />}
                      </Button>
                    );
                  })}
                  {!productSearchLoading && productOptions.length === 0 && (
                    <p className="py-2 text-sm text-gray-400">Nenhum produto encontrado para a busca atual.</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="mb-1 block text-xs font-bold uppercase text-gray-500">Texto do botao</Label>
                  <Input
                    type="text"
                    value={editing.ctaLabel || ''}
                    onChange={event => setEditing(prev => ({ ...prev, ctaLabel: event.target.value }))}
                    className="rounded-lg px-4 focus-visible:ring-[#5d082a]"
                  />
                </div>
                <div>
                  <Label className="mb-1 block text-xs font-bold uppercase text-gray-500">Alinhamento</Label>
                  <Select
                    value={editing.align || 'left'}
                    onChange={event => setEditing(prev => ({ ...prev, align: event.target.value as 'left' | 'right' }))}
                    className="rounded-lg px-4 focus-visible:ring-[#5d082a]"
                  >
                    <option value="left">Esquerda</option>
                    <option value="right">Direita</option>
                  </Select>
                </div>
              </div>

              <div>
                <Label className="mb-1 block text-xs font-bold uppercase text-gray-500">Link da colecao</Label>
                <Input
                  type="text"
                  value={editing.link || editing.ctaTo || ''}
                  onChange={event => {
                    setEditing(prev => ({ ...prev, link: event.target.value }));
                    setErrors(prev => ({ ...prev, link: undefined }));
                  }}
                  className={`rounded-lg px-4 focus-visible:ring-[#5d082a] ${errors.link ? 'border-red-300 bg-red-50' : ''}`}
                  placeholder="/busca?q=oferta"
                />
                {errors.link && <p className="mt-1 text-xs text-red-600">{errors.link}</p>}
              </div>

              <div className="rounded-lg border border-[#ead7df] bg-[#fff8fb] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#8d5b70]">Visibilidade</p>
                    <p className="mt-1 text-sm text-gray-500">Controla se este banner aparece na home.</p>
                  </div>
                  <Button
                    type="button"
                    onClick={() => setEditing(prev => ({ ...prev, active: !(prev?.active ?? true) }))}
                    variant="secondary"
                    className={`min-h-11 rounded-md px-4 ${(editing.active ?? true) ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-100' : 'bg-slate-200 text-slate-700 hover:bg-slate-200'}`}
                  >
                    {(editing.active ?? true) ? <Eye size={16} /> : <EyeOff size={16} />}
                    {(editing.active ?? true) ? 'Ativo na home' : 'Oculto na home'}
                  </Button>
                </div>
              </div>

              <div>
                <Label className="mb-1 block text-xs font-bold uppercase text-gray-500">Imagem</Label>
                <div className={`relative mt-2 aspect-[16/7] overflow-hidden rounded-lg border-2 border-dashed bg-gray-100 ${errors.imageUrl ? 'border-red-300' : 'border-gray-300'} group`}>
                  {editing.imageUrl ? (
                    <>
                      <img src={resolveApiUrl(editing.imageUrl)} className="h-full w-full object-cover" alt="Pre-visualizacao do banner" />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition group-hover:opacity-100">
                        <Label className="cursor-pointer rounded-lg bg-white px-4 py-2 text-xs font-bold text-gray-800">
                          Alterar imagem
                          <Input type="file" className="hidden" accept="image/*" onChange={handleUpload} aria-label="Alterar imagem do banner promocional" />
                        </Label>
                      </div>
                    </>
                  ) : (
                    <Label className="absolute inset-0 flex cursor-pointer flex-col items-center justify-center transition hover:bg-gray-200/70">
                      <ImageIcon size={32} className="mb-2 text-gray-400" />
                      <span className="text-xs text-gray-500">Clique para subir imagem</span>
                      <Input type="file" className="hidden" accept="image/*" onChange={handleUpload} aria-label="Enviar imagem do banner promocional" />
                    </Label>
                  )}
                </div>
                {errors.imageUrl && <p className="mt-1 text-xs text-red-600">{errors.imageUrl}</p>}
              </div>

              <Button
                type="submit"
                disabled={saving || uploading}
                className="h-12 w-full rounded-lg bg-[#5d082a] font-bold text-white hover:bg-[#4a0622]"
              >
                {saving ? 'Salvando...' : 'Salvar Banner'}
              </Button>
            </form>
          </div>
        </div>
      )}

      {pendingDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-[16px] bg-white p-6 shadow-2xl">
            <div className="flex items-start gap-4">
              <div className="rounded-lg bg-red-50 p-3 text-red-600">
                <Trash2 size={20} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">Excluir banner promocional</h3>
                <p className="mt-2 text-sm text-gray-500">
                  O banner <span className="font-semibold text-gray-700">{pendingDelete.title}</span> sera removido da home. Esta acao nao pode ser desfeita.
                </p>
              </div>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <Button
                type="button"
                onClick={() => setPendingDelete(null)}
                variant="outline"
                className="min-h-11 rounded-lg border-gray-200 px-4 py-3 text-gray-700 hover:bg-gray-50"
              >
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={handleDelete}
                variant="destructive"
                className="min-h-11 rounded-lg bg-red-600 px-4 py-3 text-white hover:bg-red-700"
              >
                Excluir banner
              </Button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
