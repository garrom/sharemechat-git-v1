// emojiUtils.js
// isSingleEmoji: true si el texto es EXACTAMENTE un emoji (una sola unidad
// visible, sin letras ni numeros). Uso: renderizar "jumbo" sin globo estilo
// WhatsApp — 1 emoji solo => grande sin globo; 2+ emojis o emoji+texto =>
// globo normal.
export function isSingleEmoji(text) {
  const t = (text || '').trim();
  if (!t) return false;
  // Con letras o numeros no es un emoji suelto.
  if (/[\p{L}\p{N}]/u.test(t)) return false;
  // Tiene que contener al menos un pictografico.
  if (!/\p{Extended_Pictographic}/u.test(t)) return false;
  try {
    if (typeof Intl !== 'undefined' && Intl.Segmenter) {
      const seg = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
      const graphemes = Array.from(seg.segment(t));
      return graphemes.length === 1;
    }
  } catch (e) {
    // cae al fallback
  }
  // Fallback sin Intl.Segmenter: sin espacios y longitud corta (1 emoji con
  // posibles selectores de variacion / modificadores).
  return !/\s/.test(t) && t.length <= 8;
}
