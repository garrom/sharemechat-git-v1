// SEO helpers for blog SPA pages. Used by BlogArticleView.jsx
// (detail) and BlogContent.jsx (listing). All helpers are
// idempotent: calling them multiple times with the same
// arguments leaves the DOM in the same state.

// Inserta o actualiza un <meta> tag en <head>. Si attrs.content
// es '' o null, elimina el atributo content del elemento (deja
// el elemento vacío pero presente).
export const upsertMeta = (selector, attrs) => {
  if (typeof document === 'undefined') return null;
  let el = document.head.querySelector(selector);
  if (!el) {
    el = document.createElement('meta');
    document.head.appendChild(el);
  }
  Object.entries(attrs).forEach(([k, v]) => {
    if (v == null || v === '') {
      el.removeAttribute(k);
    } else {
      el.setAttribute(k, v);
    }
  });
  return el;
};

// Inserta o actualiza <link rel="canonical"> en <head>.
export const upsertCanonicalLink = (href) => {
  if (typeof document === 'undefined') return null;
  let el = document.head.querySelector('link[rel="canonical"]');
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', 'canonical');
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
  return el;
};

// Inserta o actualiza un <link> arbitrario en <head>,
// identificado por selector. Útil para hreflang alternates.
// Al crear el elemento, extrae los pares atributo="valor" del
// selector (formato [attr="value"]) y los aplica al elemento
// recién creado, para que pueda ser localizado luego por el
// mismo selector. attrs sobreescribe / amplía esos atributos.
export const upsertLink = (selector, attrs) => {
  if (typeof document === 'undefined') return null;
  let el = document.head.querySelector(selector);
  if (!el) {
    el = document.createElement('link');
    const matches = selector.matchAll(/\[([^=\]]+)="([^"]+)"\]/g);
    for (const m of matches) {
      el.setAttribute(m[1], m[2]);
    }
    document.head.appendChild(el);
  }
  Object.entries(attrs).forEach(([k, v]) => {
    if (v == null || v === '') {
      el.removeAttribute(k);
    } else {
      el.setAttribute(k, v);
    }
  });
  return el;
};

// Elimina un <meta> o <link> del <head>. No falla si no existe.
export const removeMeta = (selector) => {
  if (typeof document === 'undefined') return;
  const el = document.head.querySelector(selector);
  if (el && el.parentNode) el.parentNode.removeChild(el);
};

// Inserta o actualiza un <script type="application/ld+json"> con
// un id concreto. Usa data-jsonld-id="${id}" como identificador
// (no atributo id) para no chocar con otros elementos del DOM y
// preservar el comportamiento previo del componente que ya
// consume este helper.
export const upsertJsonLd = (id, jsonObj) => {
  if (typeof document === 'undefined') return null;
  let el = document.head.querySelector(
    `script[type="application/ld+json"][data-jsonld-id="${id}"]`
  );
  if (!el) {
    el = document.createElement('script');
    el.setAttribute('type', 'application/ld+json');
    el.setAttribute('data-jsonld-id', id);
    document.head.appendChild(el);
  }
  el.textContent = JSON.stringify(jsonObj);
  return el;
};

// Trunca un texto a max caracteres añadiendo '…' al final si se
// corta. Longitud total resultante siempre <= max. Defensivo
// ante null/undefined/no-string.
export const truncate = (text, max) => {
  if (!text) return '';
  const t = String(text).trim();
  if (t.length <= max) return t;
  return t.slice(0, max - 1).trimEnd() + '…';
};

// Card raster 1200x630 de marca para previews sociales (og:image,
// twitter:image). Vive en el bucket assets canonico publico
// (assets.sharemechat.com/brand/og-default-1200x630.png) y se
// genero el 2026-06-10 dentro del frente SEO. Compartida por:
//  - BlogContent (listado /blog/{locale}): siempre la card.
//  - BlogArticleView (articulo /blog/{locale}/{slug}): fallback
//    cuando el articulo no trae heroImageUrl propia.
//  - Seo (paginas estaticas home/footer): ya la usa via su
//    propia constante DEFAULT_OG_IMAGE en src/components/Seo.jsx.
// IMPORTANTE: logo192.png (192x192) NO debe usarse como og:image
// porque las preview cards de FB/X/WhatsApp lo recortan o lo
// renderizan en miniatura. Su uso correcto es JSON-LD
// publisher.logo (ImageObject), donde una imagen cuadrada
// pequena es lo esperado por Google Rich Results.
export const DEFAULT_OG_IMAGE = 'https://assets.sharemechat.com/brand/og-default-1200x630.png';
export const DEFAULT_OG_IMAGE_WIDTH = '1200';
export const DEFAULT_OG_IMAGE_HEIGHT = '630';
export const DEFAULT_OG_IMAGE_TYPE = 'image/png';
// Texto alt de la card de marca por defecto cuando NO disponemos de
// hero propia del articulo. Bilingue minimo (es/en) segun locale.
export const DEFAULT_OG_IMAGE_ALT_ES = 'SharemeChat — Videochat 1 a 1 con modelos verificadas';
export const DEFAULT_OG_IMAGE_ALT_EN = 'SharemeChat — 1-to-1 video chat with verified models';
// Handle X corporativo (unico, mismo para site y creator).
export const TWITTER_HANDLE = '@shareme_chat';

// Mapea locale corto (ej. 'es') a etiqueta BCP47 completa
// (ej. 'es-ES'). Fallback 'es-ES'.
export const mapLocaleToBcp47 = (locale) => {
  const map = {
    es: 'es-ES',
    en: 'en-US',
    fr: 'fr-FR',
  };
  return map[locale] || 'es-ES';
};

// Mapea locale corto a etiqueta Open Graph (ej. 'es_ES').
// Fallback 'es_ES'.
export const mapLocaleToOg = (locale) => {
  const map = {
    es: 'es_ES',
    en: 'en_US',
    fr: 'fr_FR',
  };
  return map[locale] || 'es_ES';
};
