// ADR-059 Fase 4 — isSingleEmoji: true si el texto es EXACTAMENTE 1 emoji
// (render "jumbo" sin globo, estilo WhatsApp).

import { isSingleEmoji } from './emojiUtils';

describe('isSingleEmoji', () => {
  test('un solo emoji -> true', () => {
    expect(isSingleEmoji('😀')).toBe(true);
    expect(isSingleEmoji('❤️')).toBe(true); // con selector de variación
    expect(isSingleEmoji('👍🏽')).toBe(true); // con modificador de tono (un grafema)
    expect(isSingleEmoji('  😀  ')).toBe(true); // trim
  });

  test('dos o más emojis -> false', () => {
    expect(isSingleEmoji('😀😀')).toBe(false);
    expect(isSingleEmoji('😀🎉')).toBe(false);
  });

  test('emoji + texto o con letras/números -> false', () => {
    expect(isSingleEmoji('😀a')).toBe(false);
    expect(isSingleEmoji('hola')).toBe(false);
    expect(isSingleEmoji('5')).toBe(false);
    expect(isSingleEmoji('😀 5')).toBe(false);
  });

  test('vacío / whitespace / null -> false', () => {
    expect(isSingleEmoji('')).toBe(false);
    expect(isSingleEmoji('   ')).toBe(false);
    expect(isSingleEmoji(null)).toBe(false);
    expect(isSingleEmoji(undefined)).toBe(false);
  });
});
