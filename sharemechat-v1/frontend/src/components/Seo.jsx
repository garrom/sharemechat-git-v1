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

// Imagen por defecto de marca para previews sociales. Generada como
// raster 1200x630 y subida a assets-sharemechat-{test,audit,prod}.
// Mientras no exista en TEST/AUDIT, el SVG fallback del index.html
// sigue siendo el ultimo recurso.
const DEFAULT_OG_IMAGE = 'https://assets.sharemechat.com/brand/og-default-1200x630.png';

const buildAbsoluteUrl = (urlPath) => {
  const origin = PRODUCT_ORIGIN
    || (typeof window !== 'undefined' && window.location ? window.location.origin : 'https://sharemechat.com');
  const path = urlPath && urlPath.startsWith('/') ? urlPath : `/${urlPath || ''}`;
  return `${origin}${path === '/' ? '/' : path}`;
};

const buildLocaleAlternate = (urlPath, locale) => {
  // En el SPA producto el basename del Router es "/en" cuando aplica;
  // bajo "/" sirve ES. Por tanto las URLs alternativas son:
  //   ES -> ORIGIN + urlPath
  //   EN -> ORIGIN + "/en" + urlPath (salvo home, que es "/en")
  const base = buildAbsoluteUrl(urlPath);
  if (locale === 'es') return base;
  if (urlPath === '/' || urlPath === '') {
    return `${PRODUCT_ORIGIN || (typeof window !== 'undefined' && window.location ? window.location.origin : 'https://sharemechat.com')}/en`;
  }
  const origin = PRODUCT_ORIGIN || (typeof window !== 'undefined' && window.location ? window.location.origin : 'https://sharemechat.com');
  return `${origin}/en${urlPath}`;
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
  const activeLocale = (i18n.language || 'es').slice(0, 2);

  // Canonical: si localeAware y locale=en, usa el alternate EN. Para
  // paginas ES-only, canonical siempre ES.
  const canonical = localeAware && activeLocale === 'en'
    ? buildLocaleAlternate(urlPath, 'en')
    : buildAbsoluteUrl(urlPath);

  const ogImage = image || DEFAULT_OG_IMAGE;
  const ogLocale = activeLocale === 'en' ? 'en_US' : 'es_ES';
  const inLanguage = activeLocale === 'en' ? 'en' : 'es';

  return (
    <Helmet>
      <html lang={inLanguage} />
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={canonical} />

      {/* hreflang ES <-> EN + x-default (mercado primario ES). */}
      {localeAware && (
        <link rel="alternate" hrefLang="es" href={buildLocaleAlternate(urlPath, 'es')} />
      )}
      {localeAware && (
        <link rel="alternate" hrefLang="en" href={buildLocaleAlternate(urlPath, 'en')} />
      )}
      {localeAware && (
        <link rel="alternate" hrefLang="x-default" href={buildLocaleAlternate(urlPath, 'es')} />
      )}

      {/* Open Graph */}
      <meta property="og:type" content={ogType} />
      <meta property="og:site_name" content="SharemeChat" />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={canonical} />
      <meta property="og:locale" content={ogLocale} />
      <meta property="og:image" content={ogImage} />

      {/* Twitter Card */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={ogImage} />

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
