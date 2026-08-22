import React, { useState, useRef, useEffect } from 'react';
import i18n from '../i18n';
import { useSession } from './SessionProvider';
import {
  getResolvedLocale,
  getAvailableLocales,
  PREFIXED_LOCALES,
  localePrefix,
} from '../i18n/localeUtils';
import { getLocaleNativeName, getLocaleLabel, ADMIN_LOCALES } from '../i18n/localeConfig';
import { LocaleWrap, LocaleTrigger, LocaleMenu, LocaleOption } from '../styles/NavbarStyles';
import { isAdminSurface } from '../utils/runtimeSurface';
import { useBlogLocale } from '../pages/blog/BlogLocaleContext';

// Fase 1 i18n (2026-08-20): el selector pasa de pills a DROPDOWN de ancho fijo
// (no crece al cambiar de idioma; escala a N idiomas). Es el idioma de UI
// (Nivel A, set limitado a lo traducido). Ver
// docs/07-roadmap/i18n-language-redesign-plan.md.
//
// Locale por URL (ADR-022): ES sin prefijo, el resto con /<locale>. La eleccion
// se persiste en user.ui_locale (emails, etc.) antes de navegar.
//
// Blog (ADR-025): el blog tiene su propio locale en path (/blog/{locale}). Hoy
// solo publica es/en, asi que en rutas de blog los idiomas nuevos se deshabilitan
// (el frente de blog i18n esta en standby).

const BLOG_LOCALES = ['es', 'en'];

const switchToBlogLocale = (targetLocale, blogCtx) => {
  if (typeof window === 'undefined' || !window.location) return;
  const alt = (blogCtx?.alternates || [])
    .find((a) => a && a.locale === targetLocale && a.url);
  if (alt && alt.url) {
    window.location.assign(alt.url);
    return;
  }
  window.location.assign(`/blog/${targetLocale}`);
};

// Quita cualquier prefijo de locale del pathname para obtener la ruta "base"
// (la que ven los componentes dentro del Router, sin basename).
const stripLocalePrefix = (pathname) => {
  for (const loc of PREFIXED_LOCALES) {
    if (pathname === `/${loc}`) return '/';
    if (pathname.startsWith(`/${loc}/`)) return pathname.slice(loc.length + 1);
  }
  return pathname;
};

const switchToLocaleByUrl = (targetLocale) => {
  if (typeof window === 'undefined' || !window.location) return;
  const currentSearch = window.location.search;
  const currentHash = window.location.hash;

  const basePath = stripLocalePrefix(window.location.pathname);
  const prefix = localePrefix(targetLocale); // '' para es (default), '/xx' resto
  let newPath = prefix + (basePath === '/' ? '' : basePath);
  if (newPath === '') newPath = '/';

  window.location.assign(newPath + currentSearch + currentHash);
};

const isOnBlogPath = () => {
  if (typeof window === 'undefined' || !window.location) return false;
  const p = window.location.pathname;
  return p === '/blog' || p.startsWith('/blog/');
};

const LocaleSwitcher = ({ onAfterChange, style, guard }) => {
  const { updateUiLocale, user } = useSession();
  const blogCtx = useBlogLocale();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  const currentLocale = getResolvedLocale(i18n);
  // El backoffice (admin) solo ofrece es/en: no se traduce a fr/de/pt, así que
  // ofrecerlos dejaría la UI en inglés por fallback. En producto, el set completo.
  const locales = isAdminSurface() ? ADMIN_LOCALES : getAvailableLocales();

  useEffect(() => {
    if (!open) return undefined;
    const onDocClick = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    const onEsc = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  // En rutas de blog, solo es/en estan disponibles (blog i18n en standby); en
  // detalle de articulo, ademas, un locale sin alternate publicado se deshabilita.
  const isLocaleAvailableForBlog = (loc) => {
    if (!blogCtx) return true;
    if (!BLOG_LOCALES.includes(loc)) return false;
    if (loc === blogCtx.currentLocale) return true;
    if (!blogCtx.currentSlug) return true;
    return (blogCtx.alternates || []).some((a) => a && a.locale === loc);
  };

  const handleChange = async (locale) => {
    setOpen(false);
    if (locale === currentLocale) return;

    // Guard de sesión activa (streaming/llamada): en producto el cambio de idioma
    // navega por URL con recarga COMPLETA, que rompería una comunicación en curso.
    // Se aplica el mismo cortafuegos que el resto de la navegación del dashboard
    // (handleGoBlog, etc.): si hay stream/llamada, avisa y NO cambia. En público
    // y admin no se pasa `guard`, así que no bloquea nada.
    if (guard) {
      let allowed = true;
      try { allowed = await guard(); } catch (e) { allowed = true; }
      if (!allowed) return;
    }

    if (!isAdminSurface() && isOnBlogPath()) {
      if (onAfterChange) { try { onAfterChange(locale); } catch (e) { /* no-op */ } }
      switchToBlogLocale(locale, blogCtx);
      return;
    }

    // Resto del producto: idioma MOSTRADO por URL (ADR-022), pero PERSISTIDO en
    // user.ui_locale (emails, etc.). Persistimos antes de navegar (full reload).
    if (!isAdminSurface()) {
      if (user) {
        try { await updateUiLocale(locale); }
        catch (e) { console.error('Locale persist error', e); }
      }
      if (onAfterChange) { try { onAfterChange(locale); } catch (e) { /* no-op */ } }
      switchToLocaleByUrl(locale);
      return;
    }

    // Admin surface: cambia i18n + persiste preferencia (sin navegar).
    try {
      await updateUiLocale(locale);
      if (onAfterChange) onAfterChange(locale);
    } catch (e) {
      console.error('Locale change error', e);
    }
  };

  const blogDisabledTitle = i18n.t('common.locale.blogNotTranslated', {
    defaultValue: 'El blog aún no está en este idioma',
  });

  return (
    <LocaleWrap style={style} ref={wrapRef}>
      <LocaleTrigger
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={i18n.t('common.locale.label', { defaultValue: 'Idioma' })}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="code" aria-hidden="true">{getLocaleLabel(currentLocale)}</span>
        <span className="lbl">{getLocaleNativeName(currentLocale)}</span>
        <span className="chev" aria-hidden="true">▾</span>
      </LocaleTrigger>

      <LocaleMenu $open={open} role="listbox">
        {locales.map((locale) => {
          const disabled = !isLocaleAvailableForBlog(locale);
          const active = currentLocale === locale;
          return (
            <LocaleOption
              key={locale}
              type="button"
              role="option"
              aria-selected={active}
              $active={active}
              disabled={disabled}
              title={disabled ? blogDisabledTitle : undefined}
              onClick={() => { if (!disabled) handleChange(locale); }}
            >
              <span className="code" aria-hidden="true">{getLocaleLabel(locale)}</span>
              <span className="name">{getLocaleNativeName(locale)}</span>
              {active && <span className="check" aria-hidden="true">✓</span>}
            </LocaleOption>
          );
        })}
      </LocaleMenu>
    </LocaleWrap>
  );
};

export default LocaleSwitcher;
