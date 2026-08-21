// src/components/Seo.jsx
//
// Componente reutilizable para emitir metadata SEO por pagina en el SPA
// publico (home + paginas estaticas del footer). Reemplaza el title,
// description, canonical y bloque og:/twitter:/JSON-LD del index.html
// para CADA ruta en concreto, en lugar de heredar el fallback global.
//
// El blog (BlogContent, BlogArticleView, BlogNotFound) usa su propio
// sistema imperativo basado en seoHelpers.js y queda intacto en este
// lote. La uniformidad de codigo (migrar blog a Helmet) queda como
// deuda media.
//
// Para la previa social en FB / X / WhatsApp (scrapers que NO ejecutan
// JS), el SPA todavia depende del index.html fallback hasta que se
// implemente el prerender (deuda C documentada en el plan).
//
// Convenciones:
//  - title final: `${t('seo.<pageKey>.title')}` (sin sufijo de marca:
//    los textos ya lo incluyen donde aplica, para tener control total).
//  - description: `${t('seo.<pageKey>.description')}`.
//  - canonical: `${ORIGIN}${urlPath}`, donde ORIGIN se calcula con
//    runtimeEnv (sharemechat.com en PROD, test.sharemechat.com en TEST,
//    audit.sharemechat.com en AUDIT, fallback a window.location.origin).
//  - hreflang: si el componente recibe `localeAware=true`, emite
//    hreflang es <-> en + x-default (apunta al ES, mercado primario).
//    Si la pagina es ES-only (p.ej. /legal por ADR-022 D9), pasar
//    `localeAware={false}`.
//  - og:image: por defecto la tarjeta de marca raster que vive en el
//    bucket de assets (assets.sharemechat.com/brand/og-default-1200x630.png).
//    Se puede sobrescribir via prop `image`.
//  - JSON-LD: emite `WebPage` (no WebSite, que ya esta en el index.html
//    global), con name/description/url/inLanguage.

import React from 'react';
import { Helmet } from 'react-helmet-async';
import i18n from '../i18n';
import { PRODUCT_ORIGIN } from '../config/runtimeEnv';
import { SUPPORTED_LOCALES, DEFAULT_LOCALE } from '../i18n/localeConfig';
import { localePrefix } from '../i18n/localeUtils';

// og:locale por idioma de UI (Fase 1 i18n). Fallback razonable si se añade uno
// sin mapear.
const OG_LOCALES = { es: 'es_ES', en: 'en_US', fr: 'fr_FR', de: 'de_DE', pt: 'pt_BR' };

// Imagen por defecto de marca para previews sociales. Generada como
// raster 1200x630 y subida a assets-sharemechat-{test,audit,prod}.
// Mientras no exista en TEST/AUDIT, el SVG fallback del index.html
// sigue siendo el ultimo recurso.
const DEFAULT_OG_IMAGE = 'https://assets.sharemechat.com/brand/og-default-1200x630.png';
const DEFAULT_OG_IMAGE_WIDTH = '1200';
const DEFAULT_OG_IMAGE_HEIGHT = '630';
const DEFAULT_OG_IMAGE_TYPE = 'image/png';
// Handle X corporativo (unico, mismo para site y creator).
const TWITTER_HANDLE = '@shareme_chat';

const buildAbsoluteUrl = (urlPath) => {
  const origin = PRODUCT_ORIGIN
    || (typeof window !== 'undefined' && window.location ? window.location.origin : 'https://sharemechat.com');
  const path = urlPath && urlPath.startsWith('/') ? urlPath : `/${urlPath || ''}`;
  return `${origin}${path === '/' ? '/' : path}`;
};

const buildLocaleAlternate = (urlPath, locale) => {
  // Generalizado a N idiomas (Fase 1 i18n). El default (es) va sin prefijo;
  // el resto con /<locale>. Home => ORIGIN + prefijo (o "/" para es).
  const origin = PRODUCT_ORIGIN
    || (typeof window !== 'undefined' && window.location ? window.location.origin : 'https://sharemechat.com');
  const prefix = localePrefix(locale); // '' para es (default)
  const path = urlPath && urlPath.startsWith('/') ? urlPath : `/${urlPath || ''}`;
  if (path === '/' || path === '') return `${origin}${prefix || '/'}`;
  return `${origin}${prefix}${path}`;
};

/**
 * <Seo>
 *
 * Props:
 *  - pageKey: 'home' | 'legal' | 'faq' | 'safety' | 'rules' | 'cookies'.
 *    Lee `seo.<pageKey>.title` y `seo.<pageKey>.description` de i18n.
 *  - urlPath: ruta canonica de la pagina (p.ej. "/", "/faq").
 *  - localeAware: si la pagina existe en ES y EN, emite hreflang +
 *    canonical apuntando al idioma actual. Si es ES-only, pasar false.
 *  - image (opcional): URL absoluta de la imagen og/twitter por defecto.
 *  - ogType (opcional, default 'website'): valor de og:type.
 */
const Seo = ({ pageKey, urlPath, localeAware = true, image, ogType = 'website' }) => {
  const t = (k) => i18n.t(k);
  const title = t(`seo.${pageKey}.title`);
  const description = t(`seo.${pageKey}.description`);
  const rawLocale = (i18n.language || DEFAULT_LOCALE).slice(0, 2);
  const activeLocale = SUPPORTED_LOCALES.includes(rawLocale) ? rawLocale : DEFAULT_LOCALE;

  // Canonical: en páginas localeAware apunta al alternate del idioma activo
  // (para es devuelve la base). Páginas ES-only -> canonical base.
  const canonical = localeAware
    ? buildLocaleAlternate(urlPath, activeLocale)
    : buildAbsoluteUrl(urlPath);

  const ogImage = image || DEFAULT_OG_IMAGE;
  const ogLocale = OG_LOCALES[activeLocale] || OG_LOCALES[DEFAULT_LOCALE];
  const inLanguage = activeLocale;

  return (
    <Helmet>
      <html lang={inLanguage} />
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={canonical} />

      {/* hreflang por cada idioma de UI + x-default (mercado primario ES). */}
      {localeAware && SUPPORTED_LOCALES.map((loc) => (
        <link key={loc} rel="alternate" hrefLang={loc} href={buildLocaleAlternate(urlPath, loc)} />
      ))}
      {localeAware && (
        <link rel="alternate" hrefLang="x-default" href={buildLocaleAlternate(urlPath, DEFAULT_LOCALE)} />
      )}

      {/* Open Graph. Dimensiones/type/alt solo cuando usamos la card
          default de marca: si el caller pasa una imagen propia via prop
          `image`, no conocemos sus metadatos y dejamos que el crawler
          los infiera. alt = title de la pagina (descripcion semantica
          mas relevante para preview cards y accesibilidad). */}
      <meta property="og:type" content={ogType} />
      <meta property="og:site_name" content="SharemeChat" />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={canonical} />
      <meta property="og:locale" content={ogLocale} />
      <meta property="og:image" content={ogImage} />
      {!image && <meta property="og:image:width" content={DEFAULT_OG_IMAGE_WIDTH} />}
      {!image && <meta property="og:image:height" content={DEFAULT_OG_IMAGE_HEIGHT} />}
      {!image && <meta property="og:image:type" content={DEFAULT_OG_IMAGE_TYPE} />}
      <meta property="og:image:alt" content={title} />

      {/* Twitter Card. site/creator = mismo handle corporativo. */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:site" content={TWITTER_HANDLE} />
      <meta name="twitter:creator" content={TWITTER_HANDLE} />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={ogImage} />
      <meta name="twitter:image:alt" content={title} />

      {/* JSON-LD WebPage (el WebSite global del index.html no se duplica). */}
      <script type="application/ld+json">
        {JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'WebPage',
          name: title,
          description,
          url: canonical,
          inLanguage,
          isPartOf: {
            '@type': 'WebSite',
            name: 'SharemeChat',
            url: buildAbsoluteUrl('/'),
          },
        })}
      </script>
    </Helmet>
  );
};

export default Seo;
