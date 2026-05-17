import React from 'react';
import i18n from '../i18n';
import { useSession } from './SessionProvider';
import { getResolvedLocale, getAvailableLocales } from '../i18n/localeUtils';
import { LOCALE_LABELS } from '../i18n/localeConfig';
import { LocaleSwitch, LocaleButton } from '../styles/NavbarStyles';
import { isAdminSurface } from '../utils/runtimeSurface';
import { useBlogLocale } from '../pages/blog/BlogLocaleContext';

// Paquete 5 (ADR-025): la URL del blog publico lleva el locale en path
// (`/blog/{locale}[/{slug}]`). El switcher detecta si estamos en una ruta
// del blog y aplica logica diferenciada:
//
//  - En rutas /blog/...: leer alternates del BlogLocaleContext. Si el
//    visitante esta en un detalle de articulo y existe alternate del
//    locale destino, navega al slug equivalente. Si no existe alternate
//    (articulo solo publicado en un idioma) o si estamos en el listado,
//    navega al listado del locale destino /blog/{locale}.
//
//  - En el resto del producto (rutas no-blog): mantiene el comportamiento
//    historico de basename `/en` global.
//
// Si el detalle de articulo no tiene alternate publicado en el otro locale,
// el boton de ese locale aparece deshabilitado con tooltip explicativo
// ("Este articulo aun no esta traducido"). Esa decision (deshabilitar vs
// caer al listado) viene del operador en ADR-025 paquete 5.

const switchToBlogLocale = (targetLocale, blogCtx) => {
  if (typeof window === 'undefined' || !window.location) return;
  // Si hay alternate publicado para el locale destino, salta al slug
  // equivalente.
  const alt = (blogCtx?.alternates || [])
    .find((a) => a && a.locale === targetLocale && a.url);
  if (alt && alt.url) {
    // alt.url es URL absoluta segun ArticleAlternateDTO; usar location.assign
    // para forzar full page load (re-monta el Router con el nuevo basename
    // y vuelve a ejecutar la deteccion de path en App.jsx).
    window.location.assign(alt.url);
    return;
  }
  // Sin alternate publicado: vamos al listado del locale destino.
  window.location.assign(`/blog/${targetLocale}`);
};

const switchToLocaleByUrl = (targetLocale) => {
  if (typeof window === 'undefined' || !window.location) return;
  const currentPath = window.location.pathname;
  const currentSearch = window.location.search;
  const currentHash = window.location.hash;

  // Quitar prefijo /en si esta presente para obtener la ruta "base"
  // (la ruta que ven los componentes dentro del Router, sin basename).
  let basePath;
  if (currentPath === '/en') {
    basePath = '/';
  } else if (currentPath.startsWith('/en/')) {
    basePath = currentPath.slice(3); // quita "/en", deja "/..."
  } else {
    basePath = currentPath;
  }

  // Construir la URL destino segun el locale objetivo. ES es el default
  // sin prefijo; EN va con prefijo /en/. Aplica al resto del producto;
  // las rutas del blog tienen su propio handler (switchToBlogLocale).
  let newPath;
  if (targetLocale === 'en') {
    newPath = basePath === '/' ? '/en' : '/en' + basePath;
  } else {
    newPath = basePath;
  }

  window.location.assign(newPath + currentSearch + currentHash);
};

const isOnBlogPath = () => {
  if (typeof window === 'undefined' || !window.location) return false;
  const p = window.location.pathname;
  return p === '/blog' || p.startsWith('/blog/');
};

const LocaleSwitcher = ({ onAfterChange, style }) => {
  const { updateUiLocale } = useSession();
  const blogCtx = useBlogLocale();

  const currentLocale = getResolvedLocale(i18n);
  const locales = getAvailableLocales();

  // En detalle de articulo, los locales sin alternate publicado se
  // deshabilitan con tooltip. Lo calculamos por boton.
  const isLocaleAvailableForBlog = (loc) => {
    if (!blogCtx) return true; // estamos en listado o fuera de detalle
    if (loc === blogCtx.currentLocale) return true; // activo siempre
    if (!blogCtx.currentSlug) return true; // estamos en listado
    // Detalle de articulo: el locale destino esta disponible solo si hay
    // alternate publicado para el.
    const hasAlternate = (blogCtx.alternates || [])
      .some((a) => a && a.locale === loc);
    return hasAlternate;
  };

  const handleChange = async (locale) => {
    if (locale === currentLocale) return;

    // Rutas del blog (paquete 5): logica dedicada, independiente del
    // basename global del producto.
    if (!isAdminSurface() && isOnBlogPath()) {
      if (onAfterChange) {
        try { onAfterChange(locale); } catch (e) { /* no-op */ }
      }
      switchToBlogLocale(locale, blogCtx);
      return;
    }

    // Resto del producto: comportamiento historico de basename `/en`.
    if (!isAdminSurface()) {
      if (onAfterChange) {
        try { onAfterChange(locale); } catch (e) { /* no-op */ }
      }
      switchToLocaleByUrl(locale);
      return;
    }

    // Admin surface: cambia i18n + persiste preferencia.
    try {
      await updateUiLocale(locale);
      if (onAfterChange) onAfterChange(locale);
    } catch (e) {
      console.error('Locale change error', e);
    }
  };

  return (
    <LocaleSwitch style={style}>
      {locales.map((locale) => {
        const isBlogDetail = !!(blogCtx && blogCtx.currentSlug);
        const available = isLocaleAvailableForBlog(locale);
        const disabled = isBlogDetail && !available;
        return (
          <LocaleButton
            key={locale}
            type="button"
            $active={currentLocale === locale}
            disabled={disabled}
            title={
              disabled
                ? (locale === 'en'
                    ? 'This article is not yet translated'
                    : 'Este artículo aún no está traducido')
                : undefined
            }
            onClick={() => { if (!disabled) handleChange(locale); }}
          >
            {LOCALE_LABELS[locale] || locale.toUpperCase()}
          </LocaleButton>
        );
      })}
    </LocaleSwitch>
  );
};

export default LocaleSwitcher;
