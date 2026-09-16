import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  Image as ImageIcon,
  Layers,
  Link2,
  Loader2,
  Monitor,
  Package,
  Plus,
  Smartphone,
  Tag,
  Trash2,
  X,
} from 'lucide-react';
import { cmsAPI, getApiErrorMessage, productsAPI, resolveApiUrl, uploadsAPI } from '../services/api';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { FieldHint } from '@/components/ui/field-hint';
import { FIELD_LIMITS, resolvePagesForSlot } from '../utils/bannerRules';
import type { BannerPages, BannerSlot } from '../utils/bannerRules';
import { PreviewLayout } from '../components/BannerPreview';
import { BannerListItem } from '../components/BannerListItem';
import {
  type LinkType,
  type LinkTarget,
  type StoreBanner,
  type FormState,
  type FormErrors,
  type Notice,
  type BannerTemplate,
  SLOT_TABS,
  SLOT_OPTIONS,
  ART_GUIDE,
  MAX_IMAGE_SIZE_MB,
  OVERLAY_PRESETS,
  DEFAULT_OVERLAY_HEX,
  DEFAULT_OVERLAY_OPACITY,
  parseOverlayColor,
  composeOverlayColor,
  BANNER_TEMPLATES,
  emptyForm,
  isValidUrl,
  previewCategoryDestination,
  PAGES_OPTIONS,
} from '../utils/bannerTemplates';


// Limites alinhados com o que cabe no banner sem estourar/truncar: titulo tem
// line-clamp-2 e descricao line-clamp-3 no storefront, entao acima disso o
// texto e cortado na exibicao em vez de simplesmente ficar menor.
function CharCounter({ value, max }: { value: string; max: number }) {
  const used = value.length;
  return (
    <span className={`text-[11px] tabular-nums ${used >= max ? 'text-red-600' : used >= max * 0.9 ? 'text-amber-600' : 'text-gray-400'}`}>
      {used}/{max}
    </span>
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
  const [categories, setCategories] = useState<{ id: string; name: string; active: boolean }[]>([]);
  const [productQuery, setProductQuery] = useState('');
  const [productResults, setProductResults] = useState<{ id: string; name: string; ean: string }[]>([]);
  const [productSearching, setProductSearching] = useState(false);
  const [selectedProductLabel, setSelectedProductLabel] = useState('');
  const [appliedTemplateId, setAppliedTemplateId] = useState<string | null>(null);
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
    setProductQuery('');
    setProductResults([]);
    setSelectedProductLabel('');
    setAppliedTemplateId(null);
    setIsModalOpen(true);
  };

  const applyTemplate = (template: BannerTemplate) => {
    setForm((prev) => ({
      ...prev,
      slot: template.slot,
      // Mesma regra do setSlot: o modelo tambem troca o slot, entao a pagina
      // de publicacao acompanha (senao o modelo de categoria nasceria com
      // pages='home' e o banner nao apareceria).
      pages: resolvePagesForSlot(prev.pages, template.slot),
      title: template.title,
      description: template.description,
      badgeText: template.badgeText,
      ctaLabel: template.ctaLabel,
      overlayColor: template.overlayColor,
      align: template.align ?? prev.align,
    }));
    setAppliedTemplateId(template.id);
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
      displayDuration: item.displayDuration ?? 5,
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
    setProductQuery('');
    setProductResults([]);
    setSelectedProductLabel(item.linkType === 'product' ? (item.linkValue || '') : '');
    setAppliedTemplateId(null);
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
        // linkType='campaign' nao tem campo de valor proprio -- o destino e
        // sempre o campaignErpId que ja preencheu acima, evita duplicar o
        // numero em dois campos que podiam ficar dessincronizados.
        linkValue: form.linkType === 'campaign' ? form.campaignErpId.trim() || null : form.linkValue.trim() || null,
        linkTarget: form.linkTarget,
        title: form.title.trim() || null,
        description: form.description.trim() || null,
        badgeText: form.badgeText.trim() || null,
        highlightNote: form.slot === 'intercalado' ? (form.highlightNote.trim() || null) : null,
        ctaLabel: form.ctaLabel.trim() || null,
        overlayColor: form.overlayColor.trim() || null,
        align: form.slot === 'hero' || form.slot === 'intercalado' ? form.align : 'left',
        displayDuration: form.slot === 'hero' ? form.displayDuration : 5,
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

  // Trocar o slot reposiciona o banner, entao a pagina de publicacao acompanha.
  // Sem isso um banner de categoria criado com o default ('Página inicial')
  // ficaria salvo e invisivel -- cadastra, salva, nao aparece, ninguem avisa.
  // "Todas as páginas" e' preservado: e' escolha deliberada de quem quer o
  // banner em mais de um lugar.
  const setSlot = (slot: BannerSlot) =>
    setForm((prev) => ({
      ...prev,
      slot,
      pages: resolvePagesForSlot(prev.pages, slot),
    }));

  const dimHint = SLOT_OPTIONS.find((t) => t.value === form.slot)?.dims ?? '';
  const artGuide = ART_GUIDE[form.slot];
  const { hex: overlayHex, opacity: overlayOpacity } = form.overlayColor.trim()
    ? parseOverlayColor(form.overlayColor)
    : { hex: DEFAULT_OVERLAY_HEX, opacity: DEFAULT_OVERLAY_OPACITY };
  // So desabilita o agendamento manual quando a campanha do encarte ja foi
  // confirmada (existe no catalogo) -- enquanto nao sincroniza, e o unico
  // controle de vigencia que o usuario tem (fallback em store-banners.service.ts).
  const campaignConfirmed =
    Boolean(form.campaignErpId.trim()) &&
    editing?.campaignErpId === Number(form.campaignErpId) &&
    editing?.campaignFound === true;

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
      <div className="grid grid-cols-1 lg:grid-cols-[440px_1fr] gap-6 items-start">

        {/* Preview panel */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 sticky top-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Pré-visualização</p>
          {loading ? (
            <div className="h-64 flex items-center justify-center text-gray-300">
              <Loader2 size={20} className="animate-spin" />
            </div>
          ) : (
            <PreviewLayout banners={items} onSelectBanner={openEdit} />
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
            visibleItems.map((item, idx) => (
              <BannerListItem
                key={item.id}
                item={item}
                idx={idx}
                isLast={idx === visibleItems.length - 1}
                busyId={busyId}
                onMoveUp={() => moveItem(idx, 'up')}
                onMoveDown={() => moveItem(idx, 'down')}
                onToggleActive={() => toggleActive(item)}
                onEdit={() => openEdit(item)}
                onDelete={() => setPendingDelete(item)}
              />
            ))
          )}
        </div>
      </div>

      {/* End of space-y-6 */}
      </div>

      {/* ── Form Modal ────────────────────────────────── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={closeModal} />
          <div className="relative z-10 flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">

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

              {/* ══════════ MODELOS PRONTOS (so na criacao) ══════════ */}
              {!editing && (
                <section className="space-y-2">
                  <Label className="block text-xs font-medium text-gray-600">
                    Começar de um modelo <span className="font-normal text-gray-400">(opcional — preenche título, selo, botão e overlay; imagem e nome continuam manuais)</span>
                  </Label>
                  <div className="grid grid-cols-2 gap-2">
                    {BANNER_TEMPLATES.map((template) => {
                      const isActive = appliedTemplateId === template.id;
                      return (
                        <button
                          key={template.id}
                          type="button"
                          onClick={() => applyTemplate(template)}
                          className={`flex items-center gap-2 rounded-lg border-2 px-3 py-2 text-left transition-colors ${
                            isActive ? 'border-gray-900 bg-gray-50' : 'border-gray-200 hover:border-gray-400'
                          }`}
                        >
                          <span className="h-6 w-6 shrink-0 rounded-full border border-black/10" style={{ background: template.swatch }} />
                          <span className="min-w-0">
                            <span className="block truncate text-xs font-semibold text-gray-800">{template.label}</span>
                            <span className="block truncate text-[11px] text-gray-400">{template.badgeText} · {template.ctaLabel}</span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  {appliedTemplateId && (
                    <p className="text-[11px] text-emerald-700 font-medium">
                      ✓ Modelo aplicado — ajuste o que quiser abaixo (título, textos e overlay estão em "Opções avançadas").
                    </p>
                  )}
                </section>
              )}

              {/* ══════════ SEÇÃO 1 — CONTEÚDO ══════════ */}
              <section className="space-y-4">
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Conteúdo</h4>

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
                    <span className="ml-1 font-normal text-gray-400">(texto ALT da imagem — SEO)</span><FieldHint>Só para você achar o banner nesta lista. O cliente nunca vê este nome — o que aparece na loja é o Título.</FieldHint>
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
                  <Label className="block text-xs font-medium text-gray-600 mb-2">Onde vai aparecer?<FieldHint>O formato e o lugar do banner. Hero é o carrossel grande do topo; Intercalado fica entre as prateleiras; Categoria abre na página do departamento; Tarja é a faixa fina; Popup abre sobre a tela.</FieldHint></Label>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                    {SLOT_OPTIONS.map((opt) => {
                      const Icon = opt.icon;
                      const isActive = form.slot === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setSlot(opt.value)}
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
                    <Label className="block text-xs font-medium text-gray-600 mb-1">Qual categoria?<FieldHint>Em qual departamento este banner aparece. Obrigatório no banner de Categoria — sem isso ele não tem onde ser exibido.</FieldHint></Label>
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
              </section>

              {/* ══════════ SEÇÃO 2 — CLIQUE E VIGÊNCIA ══════════ */}
              <section className="space-y-4 border-t border-gray-100 pt-4">
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Clique e vigência</h4>

                {/* Encarte / campanha -- vem ANTES do bloco de clique de proposito:
                    o botao "Produtos do Encarte" ali embaixo so habilita depois
                    de preencher este codigo. */}
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-1">Vincular a um encarte <span className="font-normal text-gray-400">(opcional)</span></p>
                  <p className="text-[11px] text-gray-400 mb-2">
                    Informe o código do encarte no Solidcon e o banner fica ativo automaticamente
                    enquanto o encarte estiver vigente lá — sem precisar mexer em datas abaixo.
                  </p>
                  <Label className="block text-xs font-medium text-gray-600 mb-1">Código do encarte (Solidcon)</Label>
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
                          Encarte {form.campaignErpId} ainda não sincronizado — até lá, o banner usa o agendamento manual abaixo.
                        </p>
                      )
                    ) : (
                      <p className="text-[11px] text-gray-400 mt-1">Salve para conferir se o código já existe.</p>
                    )
                  )}
                </div>

                {/* O que acontece ao clicar? -- 4 botoes diretos */}
                <div>
                  <Label className="block text-xs font-medium text-gray-600 mb-2">O que acontece ao clicar?</Label>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {[
                      { value: 'product' as LinkType, label: 'Abrir Produto', icon: Package },
                      { value: 'category' as LinkType, label: 'Abrir Categoria', icon: Tag },
                      { value: 'url' as LinkType, label: 'Link Externo', icon: Link2 },
                      // Habilitado so com um codigo de encarte preenchido -- sem
                      // ele nao ha pra onde levar o clique (ver campo acima).
                      { value: 'campaign' as LinkType, label: 'Produtos do Encarte', icon: Layers, needsCampaign: true },
                    ].map((opt) => {
                      const Icon = opt.icon;
                      const isActive = form.linkType === opt.value;
                      const disabled = Boolean(opt.needsCampaign) && !form.campaignErpId.trim();
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          disabled={disabled}
                          onClick={() => set('linkType', opt.value)}
                          title={disabled ? 'Preencha o código do encarte acima primeiro' : undefined}
                          className={`flex flex-col items-center gap-1 rounded-xl border-2 px-2 py-3 text-center transition-colors ${
                            disabled
                              ? 'cursor-not-allowed border-gray-100 text-gray-300'
                              : isActive
                                ? 'border-gray-900 bg-gray-900 text-white'
                                : 'border-gray-200 text-gray-600 hover:border-gray-400'
                          }`}
                        >
                          <Icon size={18} />
                          <span className="text-[11px] font-semibold leading-tight">{opt.label}</span>
                        </button>
                      );
                    })}
                  </div>
                  {form.linkType === 'campaign' && (
                    <p className="mt-2 text-[11px] text-gray-400">
                      Ao clicar, o cliente vai para a página com todos os produtos do encarte {form.campaignErpId.trim() || '—'}.
                    </p>
                  )}

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
                    <>
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
                      {form.linkValue && (
                        <p className="text-[11px] text-emerald-700 mt-1.5 flex items-center gap-1 font-medium">
                          ✓ Destino no site: {previewCategoryDestination(form.linkValue)}
                        </p>
                      )}
                    </>
                  )}

                  {/* URL -- campo simples + janela de destino junto, direto abaixo */}
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
                      {form.linkValue.trim() && (
                        <div className="mt-3">
                          <Label className="block text-xs font-medium text-gray-600 mb-1">Quando clicar no link<FieldHint>Mesma janela mantém o cliente na loja. Nova janela é para link de fora (site de fornecedor), pra não perder o carrinho.</FieldHint></Label>
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
                    </>
                  )}
                </div>

                {/* Agendamento manual -- so trava quando a campanha do encarte ja
                    foi confirmada (existe no catalogo); enquanto nao sincroniza,
                    e o fallback de vigencia (ver store-banners.service.ts). */}
                <div className={campaignConfirmed ? 'opacity-40 pointer-events-none' : ''}>
                  <p className="text-xs font-semibold text-gray-500 mb-1">Agendamento manual</p>
                  <p className="text-[11px] text-gray-400 mb-2">
                    {campaignConfirmed
                      ? 'Ignorado -- o banner segue a vigência do encarte acima.'
                      : form.campaignErpId.trim()
                        ? 'Encarte ainda não sincronizado: usado como fallback de vigência até lá.'
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
                        disabled={campaignConfirmed}
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
                        disabled={campaignConfirmed}
                        className={`rounded-lg text-sm focus-visible:ring-gray-900 ${errors.endDate ? 'border-red-400' : 'border-gray-200'}`}
                      />
                      {errors.endDate && (
                        <p className="text-xs text-red-500 mt-1">{errors.endDate}</p>
                      )}
                    </div>
                  </div>
                </div>
              </section>

              {/* ══════════ SEÇÃO 3 — TEXTOS E APARÊNCIA ══════════ */}
              <section className="space-y-4 border-t border-gray-100 pt-4">
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Textos e aparência</h4>

                {/* Textos sobre a imagem */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <Label className="block text-xs font-medium text-gray-600">
                      Título do banner <span className="font-normal text-gray-400">(opcional)</span>
                    </Label>
                    <CharCounter value={form.title} max={FIELD_LIMITS.title} />
                  </div>
                  <Input
                    type="text"
                    maxLength={FIELD_LIMITS.title}
                    value={form.title}
                    onChange={(e) => set('title', e.target.value)}
                    className="rounded-lg border-gray-200 text-sm focus-visible:ring-gray-900"
                    placeholder="Ex: Promoção de Verão"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <Label className="block text-xs font-medium text-gray-600">
                      Descrição <span className="font-normal text-gray-400">(opcional)</span>
                    </Label>
                    <CharCounter value={form.description} max={FIELD_LIMITS.description} />
                  </div>
                  <Textarea
                    rows={2}
                    maxLength={FIELD_LIMITS.description}
                    value={form.description}
                    onChange={(e) => set('description', e.target.value)}
                    className="min-h-0 rounded-lg border-gray-200 text-sm focus-visible:ring-gray-900"
                    placeholder="Texto de apoio exibido sob o título"
                  />
                  <p className="text-[11px] text-gray-500 mt-1">
                    Enter quebra a linha no banner. O texto ocupa no máximo 2/3 da largura pra
                    não cobrir a foto.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <Label className="block text-xs font-medium text-gray-600">
                        Selo <span className="font-normal text-gray-400">(opcional)</span>
                      </Label>
                      <CharCounter value={form.badgeText} max={FIELD_LIMITS.badgeText} />
                    </div>
                    <Input
                      type="text"
                      maxLength={FIELD_LIMITS.badgeText}
                      value={form.badgeText}
                      onChange={(e) => set('badgeText', e.target.value)}
                      className="rounded-lg border-gray-200 text-sm focus-visible:ring-gray-900"
                      placeholder="Ex: Só hoje"
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <Label className="block text-xs font-medium text-gray-600">
                        Texto do botão <span className="font-normal text-gray-400">(opcional)</span>
                      </Label>
                      <CharCounter value={form.ctaLabel} max={FIELD_LIMITS.ctaLabel} />
                    </div>
                    <Input
                      type="text"
                      maxLength={FIELD_LIMITS.ctaLabel}
                      value={form.ctaLabel}
                      onChange={(e) => set('ctaLabel', e.target.value)}
                      className="rounded-lg border-gray-200 text-sm focus-visible:ring-gray-900"
                      placeholder="Ex: Ver oferta"
                    />
                  </div>
                </div>

                <div>
                  <Label className="block text-xs font-medium text-gray-600 mb-1">
                    Cor do overlay <span className="font-normal text-gray-400">(opcional — escurece a foto pra dar contraste ao texto)</span>
                  </Label>

                  {/* Chips de presets */}
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    {OVERLAY_PRESETS.map((preset) => {
                      const isActive = form.overlayColor.trim() && overlayHex.toLowerCase() === preset.hex.toLowerCase();
                      return (
                        <button
                          key={preset.hex}
                          type="button"
                          title={preset.label}
                          onClick={() => set('overlayColor', composeOverlayColor(preset.hex, overlayOpacity))}
                          className={`h-7 w-7 rounded-full border-2 transition-transform ${isActive ? 'scale-110 border-gray-900' : 'border-white shadow-sm hover:scale-105'}`}
                          style={{ background: preset.hex, boxShadow: isActive ? undefined : '0 0 0 1px #e5e7eb' }}
                        />
                      );
                    })}
                    {form.overlayColor.trim() && (
                      <Button
                        type="button"
                        onClick={() => set('overlayColor', '')}
                        variant="ghost"
                        size="sm"
                        className="h-7 rounded-full px-2 text-[11px] text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                      >
                        Remover
                      </Button>
                    )}
                  </div>

                  {/* Seletor nativo + opacidade */}
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      aria-label="Escolher cor do overlay"
                      value={overlayHex}
                      onChange={(e) => set('overlayColor', composeOverlayColor(e.target.value, overlayOpacity))}
                      className="h-9 w-9 shrink-0 cursor-pointer rounded-lg border border-gray-200 bg-transparent p-0.5"
                    />
                    <div className="flex-1">
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={overlayOpacity}
                        onChange={(e) => set('overlayColor', composeOverlayColor(overlayHex, Number(e.target.value)))}
                        className="w-full accent-gray-900"
                        aria-label="Opacidade do overlay"
                      />
                    </div>
                    <span className="w-9 shrink-0 text-right text-xs text-gray-400">{overlayOpacity}%</span>
                  </div>

                  {/* Preview */}
                  <div
                    className="mt-2 h-9 rounded-lg border border-gray-200"
                    style={{ background: form.overlayColor.trim() || 'repeating-linear-gradient(45deg, #f3f4f6, #f3f4f6 6px, #fff 6px, #fff 12px)' }}
                  />
                </div>

                {/* Nota do produto exaltado -- so relevante pra banners intercalados em par (duo) */}
                {form.slot === 'intercalado' && (
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
                )}

                {/* Alinhamento -- hero e intercalado sao os slots com texto/CTA sobrepostos
                    na imagem, onde faz sentido escolher onde o bloco fica ancorado. */}
                {(form.slot === 'hero' || form.slot === 'intercalado') && (
                  <div>
                    <Label className="block text-xs font-medium text-gray-600 mb-1">Alinhamento do conteúdo<FieldHint>De que lado ficam título, texto e botão. O escurecimento da foto acompanha: alinhou à direita, a sombra vai pra direita e libera o outro lado pra imagem aparecer.</FieldHint></Label>
                    <div className="flex gap-2">
                      {[
                        { value: 'left', label: 'Esquerda' },
                        { value: 'center', label: 'Centro' },
                        { value: 'right', label: 'Direita' },
                      ].map((opt) => (
                        <Button
                          key={opt.value}
                          type="button"
                          onClick={() => set('align', opt.value as 'left' | 'center' | 'right')}
                          variant={form.align === opt.value ? 'default' : 'outline'}
                          size="sm"
                          className={`flex-1 rounded-lg text-xs ${form.align === opt.value ? 'border-gray-900 bg-gray-900 text-white hover:bg-gray-900' : 'border-gray-200 text-gray-600 hover:border-gray-400'}`}
                        >
                          {opt.label}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Tempo em tela -- so o hero roda em carrossel, os outros
                    slots ficam parados, entao a duracao nao se aplica. */}
                {form.slot === 'hero' && (
                  <div>
                    <Label className="block text-xs font-medium text-gray-600 mb-1">Tempo em tela</Label>
                    <div className="flex gap-2">
                      {[3, 5, 7, 10].map((seconds) => (
                        <Button
                          key={seconds}
                          type="button"
                          onClick={() => set('displayDuration', seconds)}
                          variant={form.displayDuration === seconds ? 'default' : 'outline'}
                          size="sm"
                          className={`flex-1 rounded-lg text-xs ${form.displayDuration === seconds ? 'border-gray-900 bg-gray-900 text-white hover:bg-gray-900' : 'border-gray-200 text-gray-600 hover:border-gray-400'}`}
                        >
                          {seconds}s
                        </Button>
                      ))}
                      <Input
                        type="number"
                        min={1}
                        max={60}
                        value={form.displayDuration}
                        onChange={(e) => set('displayDuration', Number(e.target.value))}
                        className="w-20 rounded-lg border-gray-200 text-sm focus-visible:ring-gray-900"
                        aria-label="Tempo em tela em segundos"
                      />
                    </div>
                    <p className="text-[11px] text-gray-500 mt-1">
                      Segundos que este banner fica visível antes do carrossel avançar (1 a 60).
                      Texto mais longo pede mais tempo de leitura.
                    </p>
                  </div>
                )}
              </section>

              {/* ══════════ SEÇÃO 4 — AVANÇADO ══════════ */}
              <section className="space-y-4 border-t border-gray-100 pt-4">
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Avançado</h4>

                {/* Sponsor */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <Label className="block text-xs font-medium text-gray-600">
                      Patrocinador <span className="font-normal text-gray-400">(opcional)</span>
                    </Label>
                    <CharCounter value={form.sponsorName} max={FIELD_LIMITS.sponsorName} />
                  </div>
                  <Input
                    type="text"
                    maxLength={FIELD_LIMITS.sponsorName}
                    value={form.sponsorName}
                    onChange={(e) => set('sponsorName', e.target.value)}
                    className="rounded-lg border-gray-200 text-sm focus-visible:ring-gray-900"
                    placeholder="Ex: Patrocinado por Ambev"
                  />
                  <p className="text-[11px] text-gray-500 mt-1">
                    O selo mostra exatamente o que você digitar — escreva "Patrocinado por X",
                    "Oferecimento Y" ou o que preferir. Em branco, não aparece nada.
                  </p>
                </div>

                {/* Pages */}
                <div>
                  <Label className="block text-xs font-medium text-gray-600 mb-1">Página de publicação<FieldHint>Em que telas este banner pode sair. Acompanha sozinho o tipo escolhido acima; troque para "Todas as páginas" só se quiser o mesmo banner na home e nas categorias.</FieldHint></Label>
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
