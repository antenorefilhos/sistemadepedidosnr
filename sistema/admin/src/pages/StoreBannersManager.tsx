import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  Image as ImageIcon,
  Layers,
  LayoutGrid,
  Link2,
  Loader2,
  Monitor,
  MousePointerClick,
  Package,
  Pencil,
  Plus,
  Smartphone,
  Tag,
  Trash2,
  X,
} from 'lucide-react';
import { cmsAPI, getApiErrorMessage, productsAPI, resolveApiUrl, uploadsAPI } from '../services/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';

/* ─── Types ─────────────────────────────────────────── */

type BannerSlot = 'hero' | 'intercalado' | 'category' | 'tarja' | 'popup';
type LinkType = 'url' | 'category' | 'product' | 'search';
type BannerPages = 'home' | 'all' | 'category' | 'product';
type LinkTarget = '_self' | '_blank';

interface StoreBanner {
  id: string;
  name: string;
  slot: BannerSlot;
  targetCategory?: string | null;
  active: boolean;
  linkType: LinkType;
  linkValue?: string | null;
  linkTarget: LinkTarget;
  title?: string | null;
  description?: string | null;
  badgeText?: string | null;
  highlightNote?: string | null;
  ctaLabel?: string | null;
  overlayColor?: string | null;
  align?: 'left' | 'right';
  sponsorName?: string | null;
  desktopImageUrl: string;
  mobileImageUrl?: string | null;
  pages: BannerPages;
  startDate?: string | null;
  endDate?: string | null;
  campaignErpId?: number | null;
  campaignName?: string | null;
  campaignEndDate?: string | null;
  campaignFound?: boolean | null;
  order: number;
  impressionsCount: number;
  clicksCount: number;
}

interface FormState {
  name: string;
  slot: BannerSlot;
  targetCategory: string;
  active: boolean;
  linkType: LinkType;
  linkValue: string;
  linkTarget: LinkTarget;
  title: string;
  description: string;
  badgeText: string;
  highlightNote: string;
  ctaLabel: string;
  overlayColor: string;
  align: 'left' | 'right';
  sponsorName: string;
  desktopImageUrl: string;
  mobileImageUrl: string;
  pages: BannerPages;
  startDate: string;
  endDate: string;
  campaignErpId: string;
}

interface FormErrors {
  name?: string;
  desktopImageUrl?: string;
  endDate?: string;
}

interface Notice {
  id: number;
  tone: 'success' | 'error';
  message: string;
}

/* ─── Constants ──────────────────────────────────────── */

const SLOT_TABS: { value: BannerSlot | 'all'; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'hero', label: 'Carrossel Hero' },
  { value: 'intercalado', label: 'Banners Intercalados' },
  { value: 'category', label: 'Categorias' },
  { value: 'tarja', label: 'Tarjas Informativas' },
  { value: 'popup', label: 'Popup' },
];

const SLOT_OPTIONS: { value: BannerSlot; label: string; shortLabel: string; dims: string; icon: typeof Monitor }[] = [
  { value: 'hero', label: 'Topo Principal (Hero Carousel)', shortLabel: 'Hero Carousel', dims: 'Desktop até 1920px · Mobile até 767px', icon: Monitor },
  { value: 'intercalado', label: 'Entre as Prateleiras (Intercalado)', shortLabel: 'Intercalado', dims: 'Desktop até 850px · Mobile até 767px', icon: LayoutGrid },
  { value: 'category', label: 'Topo de Categoria', shortLabel: 'Categoria', dims: 'Desktop até 850px · Mobile até 767px', icon: Tag },
  { value: 'tarja', label: 'Tarja de Aviso / Regras', shortLabel: 'Tarja', dims: 'Desktop até 1920px · Mobile até 767px', icon: AlertTriangle },
  { value: 'popup', label: 'Popup', shortLabel: 'Popup', dims: 'Desktop até 900px · Mobile até 767px', icon: Layers },
];

const PAGES_OPTIONS: { value: BannerPages; label: string }[] = [
  { value: 'home', label: 'Página inicial' },
  { value: 'all', label: 'Todas as páginas' },
  { value: 'category', label: 'Páginas de categoria' },
  { value: 'product', label: 'Páginas de produto' },
];

const SLOT_LABEL: Record<BannerSlot, string> = {
  hero: 'Hero',
  intercalado: 'Intercalado',
  category: 'Categoria',
  tarja: 'Tarja',
  popup: 'Popup',
};

const SLOT_COLOR: Record<BannerSlot, string> = {
  hero: 'bg-blue-100 text-blue-700',
  intercalado: 'bg-purple-100 text-purple-700',
  category: 'bg-emerald-100 text-emerald-700',
  tarja: 'bg-amber-100 text-amber-700',
  popup: 'bg-rose-100 text-rose-700',
};

const ART_GUIDE: Record<BannerSlot, { desktop: string; desktopKb: number; mobile: string; mobileKb: number }> = {
  hero: { desktop: '1920x720', desktopKb: 350, mobile: '1080x1350', mobileKb: 220 },
  tarja: { desktop: '1920x420', desktopKb: 280, mobile: '1080x560', mobileKb: 180 },
  intercalado: { desktop: '850x520', desktopKb: 220, mobile: '1080x700', mobileKb: 180 },
  category: { desktop: '850x520', desktopKb: 220, mobile: '1080x700', mobileKb: 180 },
  popup: { desktop: '900x600', desktopKb: 220, mobile: '900x1200', mobileKb: 180 },
};

const MAX_IMAGE_SIZE_MB = 5;

const emptyForm = (): FormState => ({
  name: '',
  slot: 'hero',
  targetCategory: '',
  active: true,
  linkType: 'url',
  linkValue: '',
  linkTarget: '_self',
  title: '',
  description: '',
  badgeText: '',
  highlightNote: '',
  ctaLabel: '',
  overlayColor: '',
  align: 'left',
  sponsorName: '',
  desktopImageUrl: '',
  mobileImageUrl: '',
  pages: 'home',
  startDate: '',
  endDate: '',
  campaignErpId: '',
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

type ScheduleStatus = 'scheduled' | 'live' | 'expired' | 'always' | 'campaign-live' | 'campaign-missing';

function getScheduleStatus(item: StoreBanner): ScheduleStatus {
  if (item.campaignErpId != null) {
    return item.campaignFound ? 'campaign-live' : 'campaign-missing';
  }
  const now = Date.now();
  const start = item.startDate ? new Date(item.startDate).getTime() : null;
  const end = item.endDate ? new Date(item.endDate).getTime() : null;
  if (start && now < start) return 'scheduled';
  if (end && now > end) return 'expired';
  if (!start && !end) return 'always';
  return 'live';
}

const SCHEDULE_STATUS_LABEL: Record<ScheduleStatus, string> = {
  scheduled: 'Agendado',
  live: 'No ar',
  expired: 'Expirado',
  always: 'Sempre ativo',
  'campaign-live': 'Segue encarte',
  'campaign-missing': 'Encarte não sincronizado',
};

const SCHEDULE_STATUS_COLOR: Record<ScheduleStatus, string> = {
  scheduled: 'text-amber-600',
  live: 'text-emerald-600',
  expired: 'text-gray-400',
  always: 'text-gray-400',
  'campaign-live': 'text-emerald-600',
  'campaign-missing': 'text-amber-600',
};

/* ─── Preview layout blocks ─────────────────────────── */

function PreviewLayout({ banners }: { banners: StoreBanner[] }) {
  const has = (slot: BannerSlot) => banners.some((b) => b.active && b.slot === slot);
  const intercaladoCount = banners.filter((b) => b.active && b.slot === 'intercalado').length;

  return (
    <div className="w-full max-w-xl mx-auto space-y-1 select-none">
      <div className="h-8 rounded bg-gray-200 flex items-center px-3 text-xs text-gray-400 font-medium">Menu Superior</div>

      {has('hero') ? (
        <div className="h-24 rounded bg-gradient-to-r from-blue-200 to-blue-100 flex items-center justify-center text-xs text-blue-600 font-semibold border border-blue-200">
          Hero
        </div>
      ) : (
        <div className="h-24 rounded border-2 border-dashed border-gray-200 flex items-center justify-center text-xs text-gray-300">
          Hero (vazio)
        </div>
      )}

      {has('tarja') && (
        <div className="h-8 rounded bg-amber-100 flex items-center justify-center text-xs text-amber-600 font-semibold border border-amber-200">
          Tarja Informativa
        </div>
      )}

      <div className="grid grid-cols-3 gap-1">
        {[0, 1, 2].map((i) => {
          const active = i < intercaladoCount;
          return active ? (
            <div key={i} className="h-12 rounded bg-purple-100 flex items-center justify-center text-xs text-purple-600 font-semibold border border-purple-200">
              Intercalado {i + 1}
            </div>
          ) : (
            <div key={i} className="h-12 rounded border-2 border-dashed border-gray-200 flex items-center justify-center text-[10px] text-gray-300">
              Intercalado {i + 1}
            </div>
          );
        })}
      </div>

      {has('category') && (
        <div className="h-16 rounded bg-emerald-100 flex items-center justify-center text-xs text-emerald-600 font-semibold border border-emerald-200">
          Categoria
        </div>
      )}

      {has('popup') && (
        <div className="h-16 w-24 mx-auto rounded bg-rose-100 flex items-center justify-center text-xs text-rose-600 font-semibold border border-rose-200">
          Popup
        </div>
      )}

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
  const [activeTab, setActiveTab] = useState<BannerSlot | 'all'>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<StoreBanner | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [errors, setErrors] = useState<FormErrors>({});
  const [saving, setSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<StoreBanner | null>(null);
  const [uploadingDesktop, setUploadingDesktop] = useState(false);
  const [uploadingMobile, setUploadingMobile] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [categories, setCategories] = useState<{ id: string; name: string; active: boolean }[]>([]);
  const [productQuery, setProductQuery] = useState('');
  const [productResults, setProductResults] = useState<{ id: string; name: string; ean: string }[]>([]);
  const [productSearching, setProductSearching] = useState(false);
  const [selectedProductLabel, setSelectedProductLabel] = useState('');
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

  useEffect(() => {
    cmsAPI.categories.getAll()
      .then((res) => setCategories((res.data as any[]).filter((c) => c.active !== false)))
      .catch(() => {});
  }, []);

  // Autocomplete de produto pro "Abrir Produto" -- debounce simples, sem lib extra.
  useEffect(() => {
    if (!productQuery.trim() || productQuery.trim().length < 2) {
      setProductResults([]);
      return;
    }
    const timer = window.setTimeout(async () => {
      try {
        setProductSearching(true);
        const res = await productsAPI.getAdmin({ page: 1, limit: 6, search: productQuery.trim() });
        setProductResults(((res.data as any)?.data || []).map((p: any) => ({ id: p.id, name: p.name, ean: p.ean })));
      } catch {
        setProductResults([]);
      } finally {
        setProductSearching(false);
      }
    }, 300);
    return () => window.clearTimeout(timer);
  }, [productQuery]);

  const visibleItems = useMemo(
    () => (activeTab === 'all' ? items : items.filter((item) => item.slot === activeTab)),
    [items, activeTab],
  );

  /* ── modal helpers ── */

  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyForm(), slot: activeTab === 'all' ? 'hero' : activeTab });
    setErrors({});
    setAdvancedOpen(false);
    setProductQuery('');
    setProductResults([]);
    setSelectedProductLabel('');
    setIsModalOpen(true);
  };

  const openEdit = (item: StoreBanner) => {
    setEditing(item);
    setForm({
      name: item.name,
      slot: item.slot,
      targetCategory: item.targetCategory ?? '',
      active: item.active,
      linkType: item.linkType ?? 'url',
      linkValue: item.linkValue ?? '',
      linkTarget: item.linkTarget ?? '_self',
      title: item.title ?? '',
      description: item.description ?? '',
      badgeText: item.badgeText ?? '',
      highlightNote: item.highlightNote ?? '',
      ctaLabel: item.ctaLabel ?? '',
      overlayColor: item.overlayColor ?? '',
      align: item.align ?? 'left',
      sponsorName: item.sponsorName ?? '',
      desktopImageUrl: item.desktopImageUrl,
      mobileImageUrl: item.mobileImageUrl ?? '',
      pages: item.pages,
      startDate: item.startDate ? item.startDate.slice(0, 16) : '',
      endDate: item.endDate ? item.endDate.slice(0, 16) : '',
      campaignErpId: item.campaignErpId != null ? String(item.campaignErpId) : '',
    });
    setErrors({});
    setAdvancedOpen(false);
    setProductQuery('');
    setProductResults([]);
    setSelectedProductLabel(item.linkType === 'product' ? (item.linkValue || '') : '');
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
    if (!form.desktopImageUrl.trim()) errs.desktopImageUrl = 'Imagem desktop é obrigatória';
    if (
      form.startDate &&
      form.endDate &&
      new Date(form.endDate) <= new Date(form.startDate)
    ) {
      errs.endDate = 'Fim deve ser após o início (mínimo 1h de intervalo)';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  /* ── upload ── */

  const handleUpload = async (
    file: File,
    field: 'desktopImageUrl' | 'mobileImageUrl',
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
      pushNotice('success', `${field === 'desktopImageUrl' ? 'Desktop' : 'Mobile'} enviado com sucesso`);
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
        slot: form.slot,
        targetCategory: form.slot === 'category' ? (form.targetCategory.trim() || null) : null,
        active: form.active,
        linkType: form.linkType,
        linkValue: form.linkValue.trim() || null,
        linkTarget: form.linkTarget,
        title: form.title.trim() || null,
        description: form.description.trim() || null,
        badgeText: form.badgeText.trim() || null,
        highlightNote: form.slot === 'intercalado' ? (form.highlightNote.trim() || null) : null,
        ctaLabel: form.ctaLabel.trim() || null,
        overlayColor: form.overlayColor.trim() || null,
        align: form.slot === 'intercalado' ? form.align : 'left',
        sponsorName: form.sponsorName.trim() || null,
        desktopImageUrl: form.desktopImageUrl,
        mobileImageUrl: form.mobileImageUrl.trim() || null,
        pages: form.pages,
        startDate: form.startDate || null,
        endDate: form.endDate || null,
        campaignErpId: form.campaignErpId.trim() ? Number(form.campaignErpId.trim()) : null,
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
    const next = [...visibleItems];
    const target = direction === 'up' ? index - 1 : index + 1;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    const updated = next.map((b, i) => ({ ...b, order: i }));
    setItems((prev) => {
      const others = prev.filter((b) => !updated.some((u) => u.id === b.id));
      return [...others, ...updated].sort((a, b) => a.order - b.order);
    });
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

  const dimHint = SLOT_OPTIONS.find((t) => t.value === form.slot)?.dims ?? '';
  const artGuide = ART_GUIDE[form.slot];

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
            Espaços publicitários unificados: hero, intercalados, categoria, tarja e popup.
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

      {/* Slot tabs */}
      <div className="flex items-center gap-1 border-b border-gray-200 overflow-x-auto no-scrollbar">
        {SLOT_TABS.map((tab) => {
          const count = tab.value === 'all' ? items.length : items.filter((i) => i.slot === tab.value).length;
          return (
            <button
              key={tab.value}
              type="button"
              onClick={() => setActiveTab(tab.value)}
              className={`shrink-0 px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.value
                  ? 'border-gray-900 text-gray-900'
                  : 'border-transparent text-gray-400 hover:text-gray-600'
              }`}
            >
              {tab.label}
              {count > 0 && <span className="ml-1.5 text-xs text-gray-400">{count}</span>}
            </button>
          );
        })}
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
          ) : visibleItems.length === 0 ? (
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
            visibleItems.map((item, idx) => {
              const status = getScheduleStatus(item);
              return (
              <div
                key={item.id}
                className={`bg-white border rounded-xl p-4 flex gap-4 items-center transition ${item.active ? 'border-gray-200' : 'border-gray-100 opacity-60'}`}
              >
                {/* image thumb */}
                <div className="w-20 h-14 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                  {item.desktopImageUrl ? (
                    <img
                      src={resolveApiUrl(item.desktopImageUrl)}
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
                    <Badge variant="secondary" className={`border-transparent px-1.5 py-0.5 text-[10px] font-bold ${SLOT_COLOR[item.slot]}`}>
                      {SLOT_LABEL[item.slot]}
                    </Badge>
                    <span className="text-sm font-medium text-gray-800 truncate">{item.name}</span>
                    {item.mobileImageUrl && (
                      <Badge variant="outline" className="gap-0.5 border-gray-200 text-[10px] font-medium text-gray-400">
                        <Smartphone size={10} /> mobile
                      </Badge>
                    )}
                    {item.sponsorName && (
                      <Badge variant="outline" className="border-gray-200 text-[10px] font-medium text-gray-400">
                        {item.sponsorName}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                    <p className={`text-xs flex items-center gap-1 ${SCHEDULE_STATUS_COLOR[status]}`}>
                      <Calendar size={11} />
                      {SCHEDULE_STATUS_LABEL[status]}
                      {item.campaignErpId != null && item.campaignFound && item.campaignName && ` · ${item.campaignName}`}
                      {item.campaignErpId != null && item.campaignFound && item.campaignEndDate && ` até ${new Date(item.campaignEndDate).toLocaleDateString('pt-BR')}`}
                      {item.campaignErpId == null && item.startDate && ` · ${new Date(item.startDate).toLocaleDateString('pt-BR')}`}
                      {item.campaignErpId == null && item.endDate && ` → ${new Date(item.endDate).toLocaleDateString('pt-BR')}`}
                    </p>
                    <p className="text-xs text-gray-400 flex items-center gap-1">
                      <MousePointerClick size={11} />
                      {item.clicksCount} clique{item.clicksCount === 1 ? '' : 's'}
                    </p>
                  </div>
                  {item.linkValue && (
                    <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1 truncate">
                      <Link2 size={10} />
                      {item.linkValue}
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
                    disabled={idx === visibleItems.length - 1 || busyId === item.id}
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
              );
            })
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
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">

              {/* ══════════ CAMADA 1 — CONFIGURAÇÃO BÁSICA ══════════ */}
              <section className="space-y-4">
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
                    placeholder="Ex: Banner Promoção de Verão Desktop"
                  />
                  {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
                </div>

                {/* Onde vai aparecer? -- cards visuais */}
                <div>
                  <Label className="block text-xs font-medium text-gray-600 mb-2">Onde vai aparecer?</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {SLOT_OPTIONS.map((opt) => {
                      const Icon = opt.icon;
                      const isActive = form.slot === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => set('slot', opt.value)}
                          className={`flex flex-col items-center gap-1.5 rounded-xl border-2 px-3 py-4 text-center transition-colors ${
                            isActive
                              ? 'border-gray-900 bg-gray-900 text-white'
                              : 'border-gray-200 text-gray-600 hover:border-gray-400'
                          }`}
                        >
                          <Icon size={22} />
                          <span className="text-xs font-semibold leading-tight">{opt.shortLabel}</span>
                        </button>
                      );
                    })}
                  </div>
                  {dimHint && (
                    <p className="text-[11px] text-gray-400 mt-2 flex items-center gap-1">
                      <Monitor size={10} /> {dimHint}
                    </p>
                  )}
                </div>

                {/* Target category — only for slot=category */}
                {form.slot === 'category' && (
                  <div>
                    <Label className="block text-xs font-medium text-gray-600 mb-1">Qual categoria?</Label>
                    <Select
                      value={form.targetCategory}
                      onChange={(e) => set('targetCategory', e.target.value)}
                      className="rounded-lg border-gray-200 text-sm focus-visible:ring-gray-900"
                    >
                      <option value="">Selecione a categoria</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.name}>{c.name}</option>
                      ))}
                    </Select>
                  </div>
                )}

                {/* Upload das fotos */}
                <div>
                  <Label className="block text-xs font-medium text-gray-600 mb-1">
                    <Monitor size={11} className="inline mr-1" />
                    Foto desktop <span className="text-red-400">*</span>
                    <span className="ml-1 font-normal text-gray-400">
                      (recomendado: {artGuide.desktop} · ate {artGuide.desktopKb} KB)
                    </span>
                  </Label>
                  {form.desktopImageUrl && (
                    <div className="relative mb-2 w-full h-24 rounded-lg overflow-hidden bg-gray-100">
                      <img src={resolveApiUrl(form.desktopImageUrl)} alt="preview desktop" className="w-full h-full object-cover" />
                      <Button
                        type="button"
                        onClick={() => set('desktopImageUrl', '')}
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
                      if (file) handleUpload(file, 'desktopImageUrl', setUploadingDesktop);
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
                    {uploadingDesktop ? 'Enviando...' : form.desktopImageUrl ? 'Trocar foto desktop' : 'Selecionar foto desktop'}
                  </Button>
                  {errors.desktopImageUrl && <p className="text-xs text-red-500 mt-1">{errors.desktopImageUrl}</p>}
                </div>

                <div>
                  <Label className="block text-xs font-medium text-gray-600 mb-1">
                    <Smartphone size={11} className="inline mr-1" />
                    Foto mobile
                    <span className="ml-1 font-normal text-gray-400">
                      (opcional · recomendado: {artGuide.mobile} · ate {artGuide.mobileKb} KB)
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
                    {uploadingMobile ? 'Enviando...' : form.mobileImageUrl ? 'Trocar foto mobile' : 'Selecionar foto mobile'}
                  </Button>
                  <p className="text-[11px] text-gray-400 mt-1">
                    Se não definida, exibirá a foto desktop redimensionada.
                  </p>
                </div>

                {/* O que acontece ao clicar? -- 3 botoes diretos */}
                <div>
                  <Label className="block text-xs font-medium text-gray-600 mb-2">O que acontece ao clicar?</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { value: 'product' as LinkType, label: 'Abrir Produto', icon: Package },
                      { value: 'category' as LinkType, label: 'Abrir Categoria', icon: Tag },
                      { value: 'url' as LinkType, label: 'Link Externo', icon: Link2 },
                    ].map((opt) => {
                      const Icon = opt.icon;
                      const isActive = form.linkType === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => set('linkType', opt.value)}
                          className={`flex flex-col items-center gap-1 rounded-xl border-2 px-2 py-3 text-center transition-colors ${
                            isActive ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-200 text-gray-600 hover:border-gray-400'
                          }`}
                        >
                          <Icon size={18} />
                          <span className="text-[11px] font-semibold leading-tight">{opt.label}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Produto -- autocomplete */}
                  {form.linkType === 'product' && (
                    <div className="mt-3 relative">
                      <Input
                        type="text"
                        value={selectedProductLabel || productQuery}
                        onChange={(e) => {
                          setSelectedProductLabel('');
                          setProductQuery(e.target.value);
                          set('linkValue', '');
                        }}
                        className="rounded-lg border-gray-200 text-sm focus-visible:ring-gray-900"
                        placeholder="Buscar produto pelo nome..."
                      />
                      {productSearching && (
                        <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-gray-400" />
                      )}
                      {productResults.length > 0 && !selectedProductLabel && (
                        <div className="absolute z-10 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg max-h-48 overflow-y-auto">
                          {productResults.map((p) => (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => {
                                set('linkValue', p.id);
                                setSelectedProductLabel(p.name);
                                setProductResults([]);
                              }}
                              className="flex w-full flex-col items-start px-3 py-2 text-left text-sm hover:bg-gray-50"
                            >
                              <span className="font-medium text-gray-800">{p.name}</span>
                              <span className="text-[11px] text-gray-400">EAN {p.ean}</span>
                            </button>
                          ))}
                        </div>
                      )}
                      {form.linkValue && !selectedProductLabel && (
                        <p className="text-[11px] text-gray-400 mt-1">Produto vinculado: ID {form.linkValue}</p>
                      )}
                    </div>
                  )}

                  {/* Categoria -- dropdown */}
                  {form.linkType === 'category' && (
                    <Select
                      value={form.linkValue}
                      onChange={(e) => set('linkValue', e.target.value)}
                      className="mt-3 rounded-lg border-gray-200 text-sm focus-visible:ring-gray-900"
                    >
                      <option value="">Selecione a categoria</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.name}>{c.name}</option>
                      ))}
                    </Select>
                  )}

                  {/* URL -- campo simples */}
                  {form.linkType === 'url' && (
                    <>
                      <Input
                        type="text"
                        value={form.linkValue}
                        onChange={(e) => set('linkValue', e.target.value)}
                        className="mt-3 rounded-lg border-gray-200 text-sm focus-visible:ring-gray-900"
                        placeholder="https:// ou /caminho-relativo"
                      />
                      {!isValidUrl(form.linkValue) && (
                        <p className="text-xs text-amber-500 mt-1">URL inválida</p>
                      )}
                    </>
                  )}
                </div>
              </section>

              {/* ══════════ CAMADA 2 — OPÇÕES AVANÇADAS (acordeão) ══════════ */}
              <section className="border-t border-gray-100 pt-4">
                <button
                  type="button"
                  onClick={() => setAdvancedOpen((v) => !v)}
                  className="flex w-full items-center justify-between text-sm font-semibold text-gray-700"
                >
                  Opções avançadas
                  {advancedOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>

                {advancedOpen && (
                  <div className="mt-4 space-y-4">
                    {/* Sponsor */}
                    <div>
                      <Label className="block text-xs font-medium text-gray-600 mb-1">
                        Patrocinador
                        <span className="ml-1 font-normal text-gray-400">(opcional — ex: Ambev, Seara, Friboi)</span>
                      </Label>
                      <Input
                        type="text"
                        value={form.sponsorName}
                        onChange={(e) => set('sponsorName', e.target.value)}
                        className="rounded-lg border-gray-200 text-sm focus-visible:ring-gray-900"
                        placeholder="Ex: Ambev"
                      />
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

                    {/* Link target — only for url links */}
                    {form.linkType === 'url' && form.linkValue.trim() && (
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

                    {/* Textos sobre a imagem */}
                    <div>
                      <Label className="block text-xs font-medium text-gray-600 mb-1">
                        Título do banner <span className="font-normal text-gray-400">(opcional)</span>
                      </Label>
                      <Input
                        type="text"
                        value={form.title}
                        onChange={(e) => set('title', e.target.value)}
                        className="rounded-lg border-gray-200 text-sm focus-visible:ring-gray-900"
                        placeholder="Ex: Promoção de Verão"
                      />
                    </div>

                    <div>
                      <Label className="block text-xs font-medium text-gray-600 mb-1">
                        Descrição <span className="font-normal text-gray-400">(opcional)</span>
                      </Label>
                      <Input
                        type="text"
                        value={form.description}
                        onChange={(e) => set('description', e.target.value)}
                        className="rounded-lg border-gray-200 text-sm focus-visible:ring-gray-900"
                        placeholder="Texto de apoio exibido sob o título"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="block text-xs font-medium text-gray-600 mb-1">
                          Selo <span className="font-normal text-gray-400">(opcional)</span>
                        </Label>
                        <Input
                          type="text"
                          value={form.badgeText}
                          onChange={(e) => set('badgeText', e.target.value)}
                          className="rounded-lg border-gray-200 text-sm focus-visible:ring-gray-900"
                          placeholder="Ex: Só hoje"
                        />
                      </div>
                      <div>
                        <Label className="block text-xs font-medium text-gray-600 mb-1">
                          Texto do botão <span className="font-normal text-gray-400">(opcional)</span>
                        </Label>
                        <Input
                          type="text"
                          value={form.ctaLabel}
                          onChange={(e) => set('ctaLabel', e.target.value)}
                          className="rounded-lg border-gray-200 text-sm focus-visible:ring-gray-900"
                          placeholder="Ex: Ver oferta"
                        />
                      </div>
                    </div>

                    <div>
                      <Label className="block text-xs font-medium text-gray-600 mb-1">
                        Cor do overlay
                        <span className="ml-1 font-normal text-gray-400">(opcional — ex: rgba(0,0,0,0.4))</span>
                      </Label>
                      <Input
                        type="text"
                        value={form.overlayColor}
                        onChange={(e) => set('overlayColor', e.target.value)}
                        className="rounded-lg border-gray-200 text-sm focus-visible:ring-gray-900"
                        placeholder="rgba(0,0,0,0.4)"
                      />
                    </div>

                    {/* Highlight note + align — so relevante pra banners intercalados em par (duo) */}
                    {form.slot === 'intercalado' && (
                      <>
                        <div>
                          <Label className="block text-xs font-medium text-gray-600 mb-1">
                            Nota do produto exaltado
                            <span className="ml-1 font-normal text-gray-400">(opcional — usada quando o link é um produto)</span>
                          </Label>
                          <Input
                            type="text"
                            value={form.highlightNote}
                            onChange={(e) => set('highlightNote', e.target.value)}
                            className="rounded-lg border-gray-200 text-sm focus-visible:ring-gray-900"
                            placeholder="Ex: Direto da nossa boutique"
                          />
                        </div>
                        <div>
                          <Label className="block text-xs font-medium text-gray-600 mb-1">Alinhamento do texto</Label>
                          <div className="flex gap-2">
                            {[
                              { value: 'left', label: 'Esquerda' },
                              { value: 'right', label: 'Direita' },
                            ].map((opt) => (
                              <Button
                                key={opt.value}
                                type="button"
                                onClick={() => set('align', opt.value as 'left' | 'right')}
                                variant={form.align === opt.value ? 'default' : 'outline'}
                                size="sm"
                                className={`flex-1 rounded-lg text-xs ${form.align === opt.value ? 'border-gray-900 bg-gray-900 text-white hover:bg-gray-900' : 'border-gray-200 text-gray-600 hover:border-gray-400'}`}
                              >
                                {opt.label}
                              </Button>
                            ))}
                          </div>
                        </div>
                      </>
                    )}

                    {/* Encarte / campanha */}
                    <div className="border-t border-gray-100 pt-4">
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Vincular a um encarte</p>
                      <p className="text-[11px] text-gray-400 mb-2">
                        Opcional. Informe o código do encarte no Solidcom e o banner fica ativo automaticamente
                        enquanto o encarte estiver vigente lá — sem precisar mexer em datas abaixo.
                      </p>
                      <Label className="block text-xs font-medium text-gray-600 mb-1">Código do encarte (Solidcom)</Label>
                      <Input
                        type="number"
                        value={form.campaignErpId}
                        onChange={(e) => set('campaignErpId', e.target.value)}
                        className="rounded-lg border-gray-200 text-sm focus-visible:ring-gray-900"
                        placeholder="Ex: 375"
                      />
                      {form.campaignErpId.trim() && (
                        editing?.campaignErpId === Number(form.campaignErpId) ? (
                          editing.campaignFound ? (
                            <p className="text-xs text-emerald-600 mt-1">
                              Vinculado a "{editing.campaignName}"
                              {editing.campaignEndDate && ` · vigente até ${new Date(editing.campaignEndDate).toLocaleDateString('pt-BR')}`}
                            </p>
                          ) : (
                            <p className="text-xs text-amber-600 mt-1">
                              Encarte {form.campaignErpId} ainda não sincronizado — o banner fica oculto até ele existir no catálogo.
                            </p>
                          )
                        ) : (
                          <p className="text-[11px] text-gray-400 mt-1">Salve para conferir se o código já existe.</p>
                        )
                      )}
                    </div>

                    {/* Agendamento manual */}
                    <div className={form.campaignErpId.trim() ? 'opacity-40 pointer-events-none' : ''}>
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Agendamento manual</p>
                      <p className="text-[11px] text-gray-400 mb-2">
                        {form.campaignErpId.trim()
                          ? 'Ignorado enquanto o banner estiver vinculado a um encarte acima.'
                          : 'Opcional. Intervalo mínimo de 1h entre início e fim.'}
                      </p>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="block text-xs font-medium text-gray-600 mb-1">
                            <Calendar size={10} className="inline mr-1" />
                            Início
                          </Label>
                          <Input
                            type="datetime-local"
                            value={form.startDate}
                            onChange={(e) => set('startDate', e.target.value)}
                            disabled={Boolean(form.campaignErpId.trim())}
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
                            value={form.endDate}
                            onChange={(e) => set('endDate', e.target.value)}
                            disabled={Boolean(form.campaignErpId.trim())}
                            className={`rounded-lg text-sm focus-visible:ring-gray-900 ${errors.endDate ? 'border-red-400' : 'border-gray-200'}`}
                          />
                          {errors.endDate && (
                            <p className="text-xs text-red-500 mt-1">{errors.endDate}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
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
