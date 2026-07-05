// Constantes UI compartidas para los formularios de traduccion per-locale
// del CMS admin (paquete 6.5 + ADR-027 + ADR-045). Se importan desde
// BodyLocaleSections.jsx y TranslationBootstrapForm.jsx.
//
// Los limites replican los del backend (paquetes 2 + 6.5 + ADR-027 + ADR-045)
// para dar warning inline al operador antes de que el backend rechace.

export const LIMITS = {
  title: 255,
  slug: 160,
  seoTitle: 60,
  metaDescription: 160,
  brief: 8192,
  primaryKeyword: 120,
  secondaryKeywordItem: 120,
  secondaryKeywordsMaxItems: 5,
};

// ADR-027: brief obligatorio en locale primario ES; opcional en EN.
// Reutilizamos la misma constante como "locale que exige primary keyword"
// (ADR-045 subpasada 2C.1 D3).
export const BRIEF_REQUIRED_LOCALE = 'es';

// Umbral visual de aviso: a partir de aqui el contador del brief cambia
// a color de warning aunque siga por debajo del maximo.
export const BRIEF_WARN_THRESHOLD = 8000;

export const SLUG_REGEX = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export const BODY_MAX_BYTES_HINT = 204800;

export const lengthWarn = (value, max) => {
  const used = value ? value.length : 0;
  return { used, max, exceeded: used > max };
};

// ADR-045 subpasada 2C.1: cuenta terminos coma-separados normalizados
// (trim, sin vacios, dedup case-insensitive) para mostrar el contador y
// el warning "over cap" en el input de secondary_keywords. El backend
// aplica la misma normalizacion (2A ContentArticleService.normalizeSecondaryKeywords)
// mas cap silencioso a 5; la UI solo lo refleja.
export const countNormalizedSecondaries = (csv) => {
  if (!csv || typeof csv !== 'string') return 0;
  const seen = new Set();
  csv.split(',').forEach((raw) => {
    const term = (raw || '').trim();
    if (!term) return;
    const key = term.toLowerCase();
    seen.add(key);
  });
  return seen.size;
};
