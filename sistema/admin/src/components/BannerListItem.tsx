import { ArrowDown, ArrowUp, Calendar, Eye, EyeOff, Image as ImageIcon, Link2, Loader2, MousePointerClick, Pencil, Smartphone, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { resolveApiUrl } from '../services/api';
import { SLOT_LABEL, SLOT_COLOR, getScheduleStatus, SCHEDULE_STATUS_LABEL, SCHEDULE_STATUS_COLOR, type StoreBanner } from '../utils/bannerTemplates';

/** Linha da lista de banners de StoreBannersManager -- extraida (JON-65,
 * Auditoria 360) por so depender de props/callbacks, sem estado proprio. */
export function BannerListItem({
  item, idx, isLast, busyId, onMoveUp, onMoveDown, onToggleActive, onEdit, onDelete,
}: {
  item: StoreBanner;
  idx: number;
  isLast: boolean;
  busyId: string | null;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onToggleActive: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const status = getScheduleStatus(item);
  return (
    <div
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
          onClick={onMoveUp}
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded text-gray-400 hover:bg-gray-100 hover:text-gray-700"
        >
          <ArrowUp size={14} />
        </Button>
        <Button
          title="Mover para baixo"
          disabled={isLast || busyId === item.id}
          onClick={onMoveDown}
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded text-gray-400 hover:bg-gray-100 hover:text-gray-700"
        >
          <ArrowDown size={14} />
        </Button>
        <Button
          title={item.active ? 'Desativar' : 'Ativar'}
          onClick={onToggleActive}
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
          onClick={onEdit}
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded text-gray-400 hover:bg-gray-100 hover:text-gray-700"
        >
          <Pencil size={14} />
        </Button>
        <Button
          title="Remover"
          onClick={onDelete}
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded text-gray-400 hover:bg-red-50 hover:text-red-600"
        >
          <Trash2 size={14} />
        </Button>
      </div>
    </div>
  );
}
