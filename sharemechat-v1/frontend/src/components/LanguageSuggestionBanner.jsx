import React, { useMemo, useState } from 'react';
import i18n from '../i18n';
import { useSession } from './SessionProvider';
import {
  getBrowserLocale,
  getResolvedLocale,
  localePrefix,
  PREFIXED_LOCALES,
} from '../i18n/localeUtils';
import { getLocaleNativeName } from '../i18n/localeConfig';

/**
 * Fase 3 i18n (2026-08-22): banner sugerente, "sin imponer". Si el idioma del
 * navegador es uno de los idiomas de UI y distinto de la página actual, ofrece
 * cambiar. Solo para visitantes NO logueados (los logueados usan el selector y
 * tienen su ui_locale). Un navegador en un idioma sin UI (p. ej. malgache) no
 * dispara nada (getBrowserLocale devuelve null).
 *
 * Descartable: se recuerda en localStorage por idioma sugerido.
 */
const DISMISS_KEY = 'sharemechat.langSuggestDismissed';

const stripLocalePrefix = (pathname) => {
  for (const loc of PREFIXED_LOCALES) {
    if (pathname === `/${loc}`) return '/';
    if (pathname.startsWith(`/${loc}/`)) return pathname.slice(loc.length + 1);
  }
  return pathname;
};

const isBlogPath = () => {
  if (typeof window === 'undefined' || !window.location) return false;
  const p = window.location.pathname;
  return p === '/blog' || p.startsWith('/blog/');
};

const getDismissed = () => {
  try { return window.localStorage.getItem(DISMISS_KEY); } catch { return null; }
};

export default function LanguageSuggestionBanner() {
  const { user } = useSession();
  const [dismissed, setDismissed] = useState(() => getDismissed());

  const suggested = useMemo(() => getBrowserLocale(), []); // locale de UI o null
  const current = getResolvedLocale(i18n);

  // Condiciones para mostrar: hay sugerencia de UI, distinta de la actual, no
  // logueado, no en el blog (locale propio) y no descartada para ese idioma.
  const show = !!suggested
    && suggested !== current
    && !user
    && !isBlogPath()
    && dismissed !== suggested;

  if (!show) return null;

  const nativeName = getLocaleNativeName(suggested);

  const onSwitch = () => {
    if (typeof window === 'undefined' || !window.location) return;
    const base = stripLocalePrefix(window.location.pathname);
    const prefix = localePrefix(suggested); // '' para es (default)
    let newPath = prefix + (base === '/' ? '' : base);
    if (newPath === '') newPath = '/';
    window.location.assign(newPath + window.location.search + window.location.hash);
  };

  const onDismiss = () => {
    try { window.localStorage.setItem(DISMISS_KEY, suggested); } catch { /* no-op */ }
    setDismissed(suggested);
  };

  return (
    <div
      role="region"
      aria-label={i18n.t('common.locale.suggestAria', { defaultValue: 'Sugerencia de idioma' })}
      style={{
        background: '#fff7f7', borderBottom: '1px solid #f3d9d9',
        padding: '9px 16px', display: 'flex', alignItems: 'center',
        justifyContent: 'center', gap: 14, flexWrap: 'wrap',
        fontSize: 14, color: '#1f2933',
      }}
    >
      <span>
        {i18n.t('common.locale.suggest', {
          lang: nativeName,
          defaultValue: 'SharemeChat también está en {{lang}}.',
        })}
      </span>
      <button
        type="button"
        onClick={onSwitch}
        style={{
          background: '#ea1d1d', color: '#fff', border: 'none', borderRadius: 8,
          padding: '5px 14px', fontSize: 13.5, fontWeight: 700, cursor: 'pointer',
        }}
      >
        {i18n.t('common.locale.switch', { defaultValue: 'Cambiar' })}
      </button>
      <button
        type="button"
        onClick={onDismiss}
        aria-label={i18n.t('common.locale.dismiss', { defaultValue: 'Descartar' })}
        style={{
          background: 'transparent', border: 'none', color: '#8b94a1',
          fontSize: 18, lineHeight: 1, cursor: 'pointer', padding: '0 4px',
        }}
      >
        ×
      </button>
    </div>
  );
}
