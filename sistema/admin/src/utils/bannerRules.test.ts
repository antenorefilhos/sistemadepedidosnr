import { describe, it, expect } from 'vitest';
import { DEFAULT_PAGES_BY_SLOT, FIELD_LIMITS, resolvePagesForSlot } from './bannerRules';
import type { BannerSlot } from './bannerRules';

describe('resolvePagesForSlot', () => {
  // O caso que motivou a regra: banner de categoria nascendo com pages='home'
  // ficava salvo no banco e invisivel na loja, sem erro nenhum.
  it('slot de categoria puxa a pagina de categoria', () => {
    expect(resolvePagesForSlot('home', 'category')).toBe('category');
  });

  it('voltar pra um slot de home traz a pagina de volta junto', () => {
    expect(resolvePagesForSlot('category', 'hero')).toBe('home');
    expect(resolvePagesForSlot('category', 'intercalado')).toBe('home');
  });

  // "Todas as paginas" e' escolha deliberada do operador: trocar o slot depois
  // nao pode desfazer em silencio o que ele marcou de proposito.
  it('preserva "todas as paginas" em qualquer troca de slot', () => {
    const slots: BannerSlot[] = ['hero', 'intercalado', 'category', 'tarja', 'popup'];
    for (const slot of slots) {
      expect(resolvePagesForSlot('all', slot)).toBe('all');
    }
  });

  it('todo slot tem uma pagina default definida', () => {
    const slots: BannerSlot[] = ['hero', 'intercalado', 'category', 'tarja', 'popup'];
    for (const slot of slots) {
      expect(DEFAULT_PAGES_BY_SLOT[slot]).toBeTruthy();
    }
  });
});

describe('FIELD_LIMITS', () => {
  // O storefront corta a descricao em line-clamp-3 e o titulo em 2 linhas.
  // Limite alto demais deixa o operador digitar texto que a loja trunca sem
  // avisar -- ele salva, olha a loja e nao entende por que sumiu metade.
  it('descricao cabe no line-clamp-3 do card', () => {
    expect(FIELD_LIMITS.description).toBeLessThanOrEqual(160);
  });

  it('selos e CTA ficam curtos o bastante pra nao quebrar a linha do topo', () => {
    expect(FIELD_LIMITS.badgeText).toBeLessThanOrEqual(25);
    expect(FIELD_LIMITS.ctaLabel).toBeLessThanOrEqual(25);
    expect(FIELD_LIMITS.sponsorName).toBeLessThanOrEqual(30);
  });
});
