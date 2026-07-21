import { useEffect, useState, useRef } from 'react';
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  Calendar,
  CheckCircle2,
  Eye,
  EyeOff,
  Image as ImageIcon,
  Link2,
  Loader2,
  Monitor,
  Pencil,
  Plus,
  Smartphone,
  Trash2,
  X,
} from 'lucide-react';
import { cmsAPI, getApiErrorMessage, resolveApiUrl, uploadsAPI } from '../services/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';

/* ─── Types ─────────────────────────────────────────── */

type BannerType = 'full' | 'tarja' | 'vitrine' | 'mini' | 'lateral';
type BannerPages = 'home' | 'all' | 'category' | 'product';
type LinkTarget = '_self' | '_blank';

interface StoreBanner {
  id: string;
  name: string;
  type: BannerType;
  active: boolean;
  link?: string | null;
  linkTarget: LinkTarget;
  title?: string | null;
  imageUrl: string;
  mobileImageUrl?: string | null;
  pages: BannerPages;
  scheduledStart?: string | null;
  scheduledEnd?: string | null;
  order: number;
}

interface FormState {
  name: string;
  type: BannerType;
  active: boolean;
  link: string;
  linkTarget: LinkTarget;
  title: string;
  imageUrl: string;
  mobileImageUrl: string;
  pages: BannerPages;
  scheduledStart: string;
  scheduledEnd: string;
}

interface FormErrors {
  name?: string;
  imageUrl?: string;
  scheduledEnd?: string;
}

interface Notice {
  id: number;
  tone: 'success' | 'error';
  message: string;
}

/* ─── Constants ──────────────────────────────────────── */

const BANNER_TYPES: { value: BannerType; label: string; dims: string }[] = [
  { value: 'full', label: 'Full Banner', dims: 'Desktop até 1920px · Mobile até 767px' },
  { value: 'tarja', label: 'Banner Tarja', dims: 'Desktop até 1920px · Mobile até 767px' },
  { value: 'vitrine', label: 'Banner Vitrine', dims: 'Desktop até 850px · Mobile até 767px' },
  { value: 'mini', label: 'Mini Banner', dims: 'Desktop 260–270px · Mobile até 767px' },
  { value: 'lateral', label: 'Banner Lateral', dims: 'Desktop até 260px · Mobile até 767px' },
];

const PAGES_OPTIONS: { value: BannerPages; label: string }[] = [
  { value: 'home', label: 'Página inicial' },
  { value: 'all', label: 'Todas as páginas' },
  { value: 'category', label: 'Páginas de categoria' },
  { value: 'product', label: 'Páginas de produto' },
];

const TYPE_LABEL: Record<BannerType, string> = {
  full: 'Full',
  tarja: 'Tarja',
  vitrine: 'Vitrine',
  mini: 'Mini',
  lateral: 'Lateral',
};

const TYPE_COLOR: Record<BannerType, string> = {
  full: 'bg-blue-100 text-blue-700',
  tarja: 'bg-amber-100 text-amber-700',
  vitrine: 'bg-purple-100 text-purple-700',
  mini: 'bg-emerald-100 text-emerald-700',
  lateral: 'bg-rose-100 text-rose-700',
};

const ART_GUIDE: Record<BannerType, { desktop: string; desktopKb: number; mobile: string; mobileKb: number }> = {
  full: { desktop: '1920x720', desktopKb: 350, mobile: '1080x1350', mobileKb: 220 },
  tarja: { desktop: '1920x420', desktopKb: 280, mobile: '1080x560', mobileKb: 180 },
  vitrine: { desktop: '850x520', desktopKb: 220, mobile: '1080x700', mobileKb: 180 },
  mini: { desktop: '270x270', desktopKb: 120, mobile: '540x540', mobileKb: 120 },
  lateral: { desktop: '260x420', desktopKb: 140, mobile: '540x700', mobileKb: 150 },
};

const MAX_IMAGE_SIZE_MB = 5;

const emptyForm = (): FormState => ({
  name: '',
  type: 'full',
  active: true,
  link: '',
  linkTarget: '_self',
  title: '',
  imageUrl: '',
  mobileImageUrl: '',
  pages: 'home',
  scheduledStart: '',
  scheduledEnd: '',
});

const isValidUrl = (v: string) => {
  if (!v.trim()) return true;
  if (v.startsWith('/')) return true;
  try {
    const u = new URL(v);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
};

/* ─── Preview layout blocks ─────────────────────────── */

function PreviewLayout({ banners }: { banners: StoreBanner[] }) {
  const has = (type: BannerType) => banners.some((b) => b.active && b.type === type);
  const miniCount = banners.filter((b) => b.active && b.type === 'mini').length;

  return (
    <div className="w-full max-w-xl mx-auto space-y-1 select-none">
      {/* menu bar placeholder */}
      <div className="h-8 rounded bg-gray-200 flex items-center px-3 text-xs text-gray-400 font-medium">Menu Superior</div>

      {/* full banner */}
      {has('full') ? (
        <div className="h-24 rounded bg-gradient-to-r from-blue-200 to-blue-100 flex items-center justify-center text-xs text-blue-600 font-semibold border border-blue-200">
          Full Banner
        </div>
      ) : (
        <div className="h-24 rounded border-2 border-dashed border-gray-200 flex items-center justify-center text-xs text-gray-300">
          Full Banner (vazio)
        </div>
      )}

      {/* tarja */}
      {has('tarja') && (
        <div className="h-8 rounded bg-amber-100 flex items-center justify-center text-xs text-amber-600 font-semibold border border-amber-200">
          Banner Tarja
        </div>
      )}

      {/* vitrine */}
      {has('vitrine') ? (
        <div className="h-20 rounded bg-gradient-to-r from-purple-200 to-purple-100 flex items-center justify-center text-xs text-purple-600 font-semibold border border-purple-200">
          Banner Vitrine
        </div>
      ) : (
        <div className="h-20 rounded border-2 border-dashed border-gray-200 flex items-center justify-center text-xs text-gray-300">
          Banner Vitrine (vazio)
        </div>
      )}

      {/* mini banners */}
      <div className="grid grid-cols-3 gap-1">
        {[0, 1, 2].map((i) => {
          const active = i < miniCount;
          return active ? (
            <div key={i} className="h-12 rounded bg-emerald-100 flex items-center justify-center text-xs text-emerald-600 font-semibold border border-emerald-200">
              Mini {i + 1}
            </div>
          ) : (
            <div key={i} className="h-12 rounded border-2 border-dashed border-gray-200 flex items-center justify-center text-[10px] text-gray-300">
              Mini {i + 1}
            </div>
          );
        })}
      </div>

      {/* lateral */}
      {has('lateral') && (
        <div className="h-16 w-24 rounded bg-rose-100 flex items-center justify-center text-xs text-rose-600 font-semibold border border-rose-200">
          Lateral
        </div>
      )}

      {/* products listing */}
      <div className="h-14 rounded bg-gray-100 flex items-center justify-center text-xs text-gray-400">
        Listagem de Produtos
      </div>
    </div>
  );
}

/* ─── Main Component ─────────────────────────────────── */

export default function StoreBannersManager() {
  const [items, setItems] = useState<StoreBanner[]>([]);
  const [loading, setLoading] = useState(true);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<StoreBanner | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [errors, setErrors] = useState<FormErrors>({});
  const [saving, setSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<StoreBanner | null>(null);
  const [uploadingDesktop, setUploadingDesktop] = useState(false);
  const [uploadingMobile, setUploadingMobile] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const desktopInputRef = useRef<HTMLInputElement>(null);
  const mobileInputRef = useRef<HTMLInputElement>(null);

  const pushNotice = (tone: Notice['tone'], message: string) => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setNotices((prev) => [...prev, { id, tone, message }]);
    window.setTimeout(() => setNotices((prev) => prev.filter((n) => n.id !== id)), 4000);
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await cmsAPI.storeBanners.getAll();
      setItems([...res.data].sort((a: StoreBanner, b: StoreBanner) => a.order - b.order));
    } catch (err) {
      pushNotice('error', getApiErrorMessage(err, 'Erro ao carregar banners'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  /* ── modal helpers ── */

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm());
    setErrors({});
    setIsModalOpen(true);
  };

  const openEdit = (item: StoreBanner) => {
    setEditing(item);
    setForm({
      name: item.name,
      type: item.type,
      active: item.active,
      link: item.link ?? '',
      linkTarget: item.linkTarget ?? '_self',
      title: item.title ?? '',
      imageUrl: item.imageUrl,
      mobileImageUrl: item.mobileImageUrl ?? '',
      pages: item.pages,
      scheduledStart: item.scheduledStart ? item.scheduledStart.slice(0, 16) : '',
      scheduledEnd: item.scheduledEnd ? item.scheduledEnd.slice(0, 16) : '',
    });
    setErrors({});
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditing(null);
  };

  /* ── validation ── */

  const validate = (): boolean => {
    const errs: FormErrors = {};
    if (!form.name.trim()) errs.name = 'Nome é obrigatório';
    if (!form.imageUrl.trim()) errs.imageUrl = 'Imagem desktop é obrigatória';
    if (
      form.scheduledStart &&
      form.scheduledEnd &&
      new Date(form.scheduledEnd) <= new Date(form.scheduledStart)
    ) {
      errs.scheduledEnd = 'Fim deve ser após o início (mínimo 1h de intervalo)';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  /* ── upload ── */

  const handleUpload = async (
    file: File,
    field: 'imageUrl' | 'mobileImageUrl',
    setUploading: (v: boolean) => void,
  ) => {
    if (file.size > MAX_IMAGE_SIZE_MB * 1024 * 1024) {
      pushNotice('error', `Arquivo muito grande (máx ${MAX_IMAGE_SIZE_MB} MB)`);
      return;
    }
    try {
      setUploading(true);
      const res = await uploadsAPI.upload(file);
      const uploadedUrl = res.data?.url || res.data?.data?.url || (typeof res.data === 'string' ? res.data : '');
      if (!uploadedUrl) {
        console.error('Upload response structure:', res.data);
        pushNotice('error', 'URL de upload não foi retornada pela API');
        setUploading(false);
        return;
      }
      setForm((prev) => ({ ...prev, [field]: uploadedUrl }));
      pushNotice('success', `${field === 'imageUrl' ? 'Desktop' : 'Mobile'} enviado com sucesso`);
    } catch (err) {
      pushNotice('error', getApiErrorMessage(err, 'Erro no upload'));
      console.error('Upload error:', err);
    } finally {
      setUploading(false);
    }
  };

  /* ── save ── */

  const handleSave = async () => {
    if (!validate()) return;
    try {
      setSaving(true);
      const payload = {
        name: form.name.trim(),
        type: form.type,
        active: form.active,
        link: form.link.trim() || null,
        linkTarget: form.linkTarget,
        title: form.title.trim() || null,
        imageUrl: form.imageUrl,
        mobileImageUrl: form.mobileImageUrl.trim() || null,
        pages: form.pages,
        scheduledStart: form.scheduledStart || null,
        scheduledEnd: form.scheduledEnd || null,
        order: editing?.order ?? items.length,
      };
      if (editing) {
        await cmsAPI.storeBanners.update(editing.id, payload);
        pushNotice('success', 'Banner atualizado');
      } else {
        await cmsAPI.storeBanners.create(payload);
        pushNotice('success', 'Banner criado');
      }
      closeModal();
      loadData();
    } catch (err) {
      pushNotice('error', getApiErrorMessage(err, 'Erro ao salvar banner'));
    } finally {
      setSaving(false);
    }
  };

  /* ── toggle active ── */

  const toggleActive = async (item: StoreBanner) => {
    try {
      setBusyId(item.id);
      await cmsAPI.storeBanners.update(item.id, { active: !item.active });
      setItems((prev) => prev.map((b) => (b.id === item.id ? { ...b, active: !b.active } : b)));
    } catch (err) {
      pushNotice('error', getApiErrorMessage(err, 'Erro ao atualizar status'));
    } finally {
      setBusyId(null);
    }
  };

  /* ── reorder ── */

  const moveItem = async (index: number, direction: 'up' | 'down') => {
    const next = [...items];
    const target = direction === 'up' ? index - 1 : index + 1;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    const updated = next.map((b, i) => ({ ...b, order: i }));
    setItems(updated);
    try {
      await Promise.all(updated.map((b) => cmsAPI.storeBanners.update(b.id, { order: b.order })));
    } catch (err) {
      pushNotice('error', getApiErrorMessage(err, 'Erro ao reordenar'));
      loadData();
    }
  };

  /* ── delete ── */

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    try {
      setBusyId(pendingDelete.id);
      await cmsAPI.storeBanners.remove(pendingDelete.id);
      setItems((prev) => prev.filter((b) => b.id !== pendingDelete.id));
      pushNotice('success', 'Banner removido');
    } catch (err) {
      pushNotice('error', getApiErrorMessage(err, 'Erro ao remover'));
    } finally {
      setBusyId(null);
      setPendingDelete(null);
    }
  };

  /* ── form helpers ── */

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const dimHint = BANNER_TYPES.find((t) => t.value === form.type)?.dims ?? '';
  const artGuide = ART_GUIDE[form.type];

  /* ─────────────────────────────────────────────────── */

  return (
    <>
      <div className="space-y-6">

      {/* Notices */}
      <div className="fixed top-4 right-4 z-[200] flex flex-col gap-2 pointer-events-none">
        {notices.map((n) => (
          <div
            key={n.id}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg shadow-lg text-sm font-medium pointer-events-auto transition-all
              ${n.tone === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}
          >
            {n.tone === 'success' ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
            {n.message}
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Banners da Loja</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Configure banners por tipo, página e agendamento. Arraste para reordenar.
          </p>
        </div>
        <Button
          onClick={openCreate}
          className="rounded-lg bg-gray-900 text-white hover:bg-gray-700"
        >
          <Plus size={15} />
          Novo banner
        </Button>
      </div>

      {/* Two-column layout: preview + list */}
      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6 items-start">

        {/* Preview panel */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 sticky top-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Pré-visualização</p>
          {loading ? (
            <div className="h-64 flex items-center justify-center text-gray-300">
              <Loader2 size={20} className="animate-spin" />
            </div>
          ) : (
            <PreviewLayout banners={items} />
          )}
        </div>

        {/* Banner list */}
        <div className="space-y-3">
          {loading ? (
            <div className="flex items-center justify-center h-40 text-gray-400">
              <Loader2 size={20} className="animate-spin mr-2" /> Carregando...
            </div>
          ) : items.length === 0 ? (
            <div className="border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center py-14 gap-3 text-gray-400">
              <ImageIcon size={28} />
              <p className="text-sm">Nenhum banner cadastrado ainda</p>
              <Button
                onClick={openCreate}
                variant="link"
                className="h-auto p-0 text-sm font-medium text-gray-700"
              >
                Criar primeiro banner
              </Button>
            </div>
          ) : (
            items.map((item, idx) => (
              <div
                key={item.id}
                className={`bg-white border rounded-xl p-4 flex gap-4 items-center transition ${item.active ? 'border-gray-200' : 'border-gray-100 opacity-60'}`}
              >
                {/* image thumb */}
                <div className="w-20 h-14 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                  {item.imageUrl ? (
                    <img
                      src={resolveApiUrl(item.imageUrl)}
                      alt={item.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-300">
                      <ImageIcon size={18} />
                    </div>
                  )}
                </div>

                {/* info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="secondary" className={`border-transparent px-1.5 py-0.5 text-[10px] font-bold ${TYPE_COLOR[item.type]}`}>
                      {TYPE_LABEL[item.type]}
                    </Badge>
                    <span className="text-sm font-medium text-gray-800 truncate">{item.name}</span>
                    {item.mobileImageUrl && (
                      <Badge variant="outline" className="gap-0.5 border-gray-200 text-[10px] font-medium text-gray-400">
                        <Smartphone size={10} /> mobile
                      </Badge>
                    )}
                  </div>
                  {item.scheduledStart && (
                    <p className="text-xs text-amber-600 mt-0.5 flex items-center gap-1">
                      <Calendar size={11} />
                      {new Date(item.scheduledStart).toLocaleDateString('pt-BR')}
                      {item.scheduledEnd && ` → ${new Date(item.scheduledEnd).toLocaleDateString('pt-BR')}`}
                    </p>
                  )}
                  {item.link && (
                    <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1 truncate">
                      <Link2 size={10} />
                      {item.link}
                    </p>
                  )}
                </div>

                {/* actions */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  <Button
                    title="Mover para cima"
                    disabled={idx === 0 || busyId === item.id}
                    onClick={() => moveItem(idx, 'up')}
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                  >
                    <ArrowUp size={14} />
                  </Button>
                  <Button
                    title="Mover para baixo"
                    disabled={idx === items.length - 1 || busyId === item.id}
                    onClick={() => moveItem(idx, 'down')}
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                  >
                    <ArrowDown size={14} />
                  </Button>
                  <Button
                    title={item.active ? 'Desativar' : 'Ativar'}
                    onClick={() => toggleActive(item)}
                    disabled={busyId === item.id}
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                  >
                    {busyId === item.id ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : item.active ? (
                      <Eye size={14} />
                    ) : (
                      <EyeOff size={14} />
                    )}
                  </Button>
                  <Button
                    title="Editar"
                    onClick={() => openEdit(item)}
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                  >
                    <Pencil size={14} />
                  </Button>
                  <Button
                    title="Remover"
                    onClick={() => setPendingDelete(item)}
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded text-gray-400 hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* End of space-y-6 */}
      </div>

      {/* ── Form Modal ────────────────────────────────── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={closeModal} />
          <div className="relative z-10 w-full max-w-lg h-full bg-white shadow-2xl flex flex-col overflow-hidden">

            {/* modal header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
              <h3 className="text-base font-semibold text-gray-900">
                {editing ? 'Editar banner' : 'Novo banner'}
              </h3>
              <Button onClick={closeModal} variant="ghost" size="icon" className="h-8 w-8 rounded text-gray-400 hover:bg-gray-100">
                <X size={16} />
              </Button>
            </div>

            {/* modal body */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">

              {/* ── Configurações básicas ── */}
              <section className="space-y-3">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Configurações básicas</p>

                {/* Active toggle */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-700">Banner ativo</span>
                  <Label className="relative inline-flex w-10 h-5 cursor-pointer items-center">
                    <Checkbox
                      className="peer sr-only"
                      checked={form.active}
                      onChange={(event) => set('active', event.target.checked)}
                      aria-label="Alternar status do banner"
                    />
                    <span className="absolute inset-0 rounded-full bg-gray-300 transition-colors peer-checked:bg-emerald-500" />
                    <span className="absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5" />
                  </Label>
                </div>

                {/* Name */}
                <div>
                  <Label className="block text-xs font-medium text-gray-600 mb-1">
                    Nome do banner <span className="text-red-400">*</span>
                    <span className="ml-1 font-normal text-gray-400">(texto ALT da imagem — SEO)</span>
                  </Label>
                  <Input
                    type="text"
                    value={form.name}
                    onChange={(e) => set('name', e.target.value)}
                    className={`rounded-lg text-sm focus-visible:ring-gray-900 ${errors.name ? 'border-red-400' : 'border-gray-200'}`}
                    placeholder="Ex: Banner Summer Sale Desktop"
                  />
                  {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
                </div>

                {/* Type */}
                <div>
                  <Label className="block text-xs font-medium text-gray-600 mb-1">Tipo de banner</Label>
                  <Select
                    value={form.type}
                    onChange={(e) => set('type', e.target.value as BannerType)}
                    className="rounded-lg border-gray-200 text-sm focus-visible:ring-gray-900"
                  >
                    {BANNER_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </Select>
                  {dimHint && (
                    <p className="text-[11px] text-gray-400 mt-1 flex items-center gap-1">
                      <Monitor size={10} /> {dimHint}
                    </p>
                  )}
                </div>

                {/* Pages */}
                <div>
                  <Label className="block text-xs font-medium text-gray-600 mb-1">Página de publicação</Label>
                  <Select
                    value={form.pages}
                    onChange={(e) => set('pages', e.target.value as BannerPages)}
                    className="rounded-lg border-gray-200 text-sm focus-visible:ring-gray-900"
                  >
                    {PAGES_OPTIONS.map((p) => (
                      <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                  </Select>
                </div>

                {/* Link */}
                <div>
                  <Label className="block text-xs font-medium text-gray-600 mb-1">
                    Link do banner
                    <span className="ml-1 font-normal text-gray-400">(opcional)</span>
                  </Label>
                  <Input
                    type="text"
                    value={form.link}
                    onChange={(e) => set('link', e.target.value)}
                    className="rounded-lg border-gray-200 text-sm focus-visible:ring-gray-900"
                    placeholder="https:// ou /caminho-relativo"
                  />
                  {!isValidUrl(form.link) && (
                    <p className="text-xs text-amber-500 mt-1">URL inválida</p>
                  )}
                </div>

                {/* Link target — only when link is filled */}
                {form.link.trim() && (
                  <div>
                    <Label className="block text-xs font-medium text-gray-600 mb-1">Quando clicar no link</Label>
                    <div className="flex gap-2">
                      {[
                        { value: '_self', label: 'Mesma janela' },
                        { value: '_blank', label: 'Nova janela' },
                      ].map((opt) => (
                        <Button
                          key={opt.value}
                          type="button"
                          onClick={() => set('linkTarget', opt.value as LinkTarget)}
                          variant={form.linkTarget === opt.value ? 'default' : 'outline'}
                          size="sm"
                          className={`flex-1 rounded-lg text-xs ${form.linkTarget === opt.value ? 'border-gray-900 bg-gray-900 text-white hover:bg-gray-900' : 'border-gray-200 text-gray-600 hover:border-gray-400'}`}
                        >
                          {opt.label}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Title */}
                <div>
                  <Label className="block text-xs font-medium text-gray-600 mb-1">
                    Título do banner
                    <span className="ml-1 font-normal text-gray-400">(opcional — exibido sob a imagem)</span>
                  </Label>
                  <Input
                    type="text"
                    value={form.title}
                    onChange={(e) => set('title', e.target.value)}
                    className="rounded-lg border-gray-200 text-sm focus-visible:ring-gray-900"
                    placeholder="Ex: Promoção de Verão"
                  />
                </div>
              </section>

              {/* ── Imagens ── */}
              <section className="space-y-3">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Imagens</p>

                {/* Desktop image */}
                <div>
                  <Label className="block text-xs font-medium text-gray-600 mb-1">
                    <Monitor size={11} className="inline mr-1" />
                    Imagem desktop <span className="text-red-400">*</span>
                    <span className="ml-1 font-normal text-gray-400">
                      (recomendado: {artGuide.desktop} · ate {artGuide.desktopKb} KB)
                    </span>
                  </Label>
                  {form.imageUrl && (
                    <div className="relative mb-2 w-full h-24 rounded-lg overflow-hidden bg-gray-100">
                      <img src={resolveApiUrl(form.imageUrl)} alt="preview desktop" className="w-full h-full object-cover" />
                      <Button
                        type="button"
                        onClick={() => set('imageUrl', '')}
                        variant="ghost"
                        size="icon"
                        className="absolute top-1 right-1 h-6 w-6 rounded-full bg-white/80 text-gray-600 hover:bg-white"
                      >
                        <X size={12} />
                      </Button>
                    </div>
                  )}
                  <Input
                    ref={desktopInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    aria-label="Enviar imagem desktop do banner"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleUpload(file, 'imageUrl', setUploadingDesktop);
                      e.target.value = '';
                    }}
                  />
                  <Button
                    type="button"
                    disabled={uploadingDesktop}
                    onClick={() => desktopInputRef.current?.click()}
                    variant="outline"
                    className="w-full justify-center rounded-lg border-2 border-dashed border-gray-200 px-3 py-3 text-sm text-gray-500 hover:border-gray-400 hover:text-gray-700"
                  >
                    {uploadingDesktop ? <Loader2 size={14} className="animate-spin" /> : <ImageIcon size={14} />}
                    {uploadingDesktop ? 'Enviando...' : form.imageUrl ? 'Trocar imagem desktop' : 'Selecionar imagem desktop'}
                  </Button>
                  {errors.imageUrl && <p className="text-xs text-red-500 mt-1">{errors.imageUrl}</p>}
                </div>

                {/* Mobile image */}
                <div>
                  <Label className="block text-xs font-medium text-gray-600 mb-1">
                    <Smartphone size={11} className="inline mr-1" />
                    Imagem mobile
                    <span className="ml-1 font-normal text-gray-400">
                      (opcional — exibida em telas &lt; 767px · recomendado: {artGuide.mobile} · ate {artGuide.mobileKb} KB)
                    </span>
                  </Label>
                  {form.mobileImageUrl && (
                    <div className="relative mb-2 w-32 h-20 rounded-lg overflow-hidden bg-gray-100">
                      <img src={resolveApiUrl(form.mobileImageUrl)} alt="preview mobile" className="w-full h-full object-cover" />
                      <Button
                        type="button"
                        onClick={() => set('mobileImageUrl', '')}
                        variant="ghost"
                        size="icon"
                        className="absolute top-1 right-1 h-6 w-6 rounded-full bg-white/80 text-gray-600 hover:bg-white"
                      >
                        <X size={12} />
                      </Button>
                    </div>
                  )}
                  <Input
                    ref={mobileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    aria-label="Enviar imagem mobile do banner"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleUpload(file, 'mobileImageUrl', setUploadingMobile);
                      e.target.value = '';
                    }}
                  />
                  <Button
                    type="button"
                    disabled={uploadingMobile}
                    onClick={() => mobileInputRef.current?.click()}
                    variant="outline"
                    className="w-full justify-center rounded-lg border-2 border-dashed border-gray-200 px-3 py-2.5 text-sm text-gray-500 hover:border-gray-400 hover:text-gray-700"
                  >
                    {uploadingMobile ? <Loader2 size={14} className="animate-spin" /> : <Smartphone size={14} />}
                    {uploadingMobile ? 'Enviando...' : form.mobileImageUrl ? 'Trocar imagem mobile' : 'Selecionar imagem mobile'}
                  </Button>
                  <p className="text-[11px] text-gray-400 mt-1">
                    Se não definida, exibirá a imagem desktop redimensionada. Largura máx: 767px.
                  </p>
                </div>
              </section>

              {/* ── Agendamento ── */}
              <section className="space-y-3">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Agendamento automático</p>
                <p className="text-[11px] text-gray-400 -mt-1">
                  Opcional. Intervalo mínimo de 1h entre início e fim. Pode haver pequeno delay por cache.
                </p>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="block text-xs font-medium text-gray-600 mb-1">
                      <Calendar size={10} className="inline mr-1" />
                      Início
                    </Label>
                    <Input
                      type="datetime-local"
                      value={form.scheduledStart}
                      onChange={(e) => set('scheduledStart', e.target.value)}
                      className="rounded-lg border-gray-200 text-sm focus-visible:ring-gray-900"
                    />
                  </div>
                  <div>
                    <Label className="block text-xs font-medium text-gray-600 mb-1">
                      <Calendar size={10} className="inline mr-1" />
                      Fim
                    </Label>
                    <Input
                      type="datetime-local"
                      value={form.scheduledEnd}
                      onChange={(e) => set('scheduledEnd', e.target.value)}
                      className={`rounded-lg text-sm focus-visible:ring-gray-900 ${errors.scheduledEnd ? 'border-red-400' : 'border-gray-200'}`}
                    />
                    {errors.scheduledEnd && (
                      <p className="text-xs text-red-500 mt-1">{errors.scheduledEnd}</p>
                    )}
                  </div>
                </div>
              </section>
            </div>

            {/* modal footer */}
            <div className="px-5 py-4 border-t border-gray-100 flex items-center justify-end gap-3 flex-shrink-0">
              <Button
                onClick={closeModal}
                variant="outline"
                className="rounded-lg border-gray-200 text-sm text-gray-700 hover:bg-gray-50"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleSave}
                disabled={saving}
                className="rounded-lg bg-gray-900 text-sm text-white hover:bg-gray-700"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : null}
                {editing ? 'Salvar alterações' : 'Criar banner'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete confirm modal ───────────────────────── */}
      {pendingDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setPendingDelete(null)} />
          <div className="relative z-10 bg-white rounded-xl shadow-xl p-6 w-full max-w-sm space-y-4">
            <div className="flex items-start gap-3">
              <AlertCircle size={20} className="text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-gray-900 text-sm">Remover banner?</p>
                <p className="text-sm text-gray-500 mt-1">
                  <strong>{pendingDelete.name}</strong> será removido permanentemente.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                onClick={() => setPendingDelete(null)}
                variant="outline"
                className="rounded-lg border-gray-200 text-sm text-gray-700 hover:bg-gray-50"
              >
                Cancelar
              </Button>
              <Button
                onClick={confirmDelete}
                disabled={!!busyId}
                variant="destructive"
                className="rounded-lg bg-red-600 text-sm text-white hover:bg-red-700"
              >
                {busyId ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                Remover
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
