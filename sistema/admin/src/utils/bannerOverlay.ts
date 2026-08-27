/**
 * Tinta do overlay do banner no PREVIEW do admin.
 *
 * Isto e uma copia deliberada de `buildOverlayGradient`/`buildOverlaySolid`
 * (sistema/frontend/src/utils/homeCategories.ts). Admin e storefront sao
 * pacotes npm separados, e cada imagem Docker builda com o contexto na propria
 * pasta (`context: ./admin`, `context: ./frontend` no docker-compose) -- um
 * modulo fisicamente compartilhado ficaria fora dos dois contextos e quebraria
 * o build.
 *
 * A divergencia entre as duas copias e barrada por teste: o storefront tem um
 * caso que importa ESTE arquivo por caminho relativo e compara a saida das
 * duas implementacoes stop a stop (homeCategories.test.ts, bloco "paridade com
 * o preview do admin"). Os testes rodam no host, sem Docker, entao alcancam os
 * dois pacotes. Se mexer nos stops de um lado sem mexer no outro, o teste do
 * frontend quebra.
 */

const DEFAULT_TONE = { r: 0x23, g: 0x1f, b: 0x20, a: 1 };

const parseTone = (tone: string): { r: number; g: number; b: number; a: number } => {
  const trimmed = tone.trim();
  const rgbaMatch = trimmed.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?\)/i);
  if (rgbaMatch) {
    return {
      r: Number(rgbaMatch[1]),
      g: Number(rgbaMatch[2]),
      b: Number(rgbaMatch[3]),
      a: rgbaMatch[4] !== undefined ? Number(rgbaMatch[4]) : 1,
    };
  }
  const hexMatch = trimmed.match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hexMatch) {
    const clean = hexMatch[1].length === 3 ? hexMatch[1].split('').map((c) => c + c).join('') : hexMatch[1];
    const num = parseInt(clean, 16);
    return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255, a: 1 };
  }
  return DEFAULT_TONE;
};

/** Gradiente direcional dos slots hero e intercalado/categoria. */
export const buildOverlayGradient = (tone: string, align: 'left' | 'center' | 'right' = 'left'): string => {
  const { r, g, b, a } = parseTone(tone);
  const rgba = (multiplier: number) => `rgba(${r}, ${g}, ${b}, ${(a * multiplier).toFixed(2)})`;

  if (align === 'center') {
    return `linear-gradient(to bottom, ${rgba(1)} 0%, ${rgba(0.6)} 50%, ${rgba(1)} 100%)`;
  }

  const direction = align === 'right' ? 'to left' : 'to right';
  return `linear-gradient(${direction}, ${rgba(1)} 0%, ${rgba(0.75)} 55%, transparent 100%)`;
};

/** Tinta uniforme dos slots tarja e popup (conteudo ocupa a largura toda). */
export const buildOverlaySolid = (tone: string, alphaMultiplier = 0.72): string => {
  const { r, g, b, a } = parseTone(tone);
  return `rgba(${r}, ${g}, ${b}, ${Math.min(1, a * alphaMultiplier).toFixed(2)})`;
};
