import React from 'react';
import i18n from '../i18n';
import { useSession } from './SessionProvider';
import { getResolvedLocale, getAvailableLocales } from '../i18n/localeUtils';
import { LOCALE_LABELS } from '../i18n/localeConfig';
import { LocaleSwitch, LocaleButton } from '../styles/NavbarStyles';
import { isAdminSurface } from '../utils/runtimeSurface';

// Fase 4B.5 (ADR-022): en product surface el cambio de locale es una
// NAVEGACION entre URLs porque el basename del Router (4B.3) se decide
// del prefijo de path. window.location.assign provoca page reload y la
// app se monta con el basename correcto, re-ejecutando la deteccion en
// App.jsx. Caso simple: solo se reescribe el prefijo /en/, manteniendo
// el resto del path, query y hash. Si el slug del path no existe en el
// locale destino (ej. /en/blog/<slug-ES> -> 404), el componente del
// blog lo maneja mostrando t('blog:states.notFound'). Caso B mas rico
// (consultar alternates del DTO para mapear slug ES <-> EN del mismo
// grupo) queda como deuda futura.
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
  // sin prefijo (ADR-022 D2); EN va con prefijo /en/.
  let newPath;
  if (targetLocale === 'en') {
    newPath = basePath === '/' ? '/en' : '/en' + basePath;
  } else {
    newPath = basePath;
  }

  window.location.assign(newPath + currentSearch + currentHash);
};

const LocaleSwitcher = ({ onAfterChange, style }) => {

  const { updateUiLocale } = useSession();

  const currentLocale = getResolvedLocale(i18n);
  const locales = getAvailableLocales();

  const handleChange = async (locale) => {
    if (locale === currentLocale) return;

    // Product surface (ADR-022 / 4B.5): la URL es la fuente de verdad del
    // locale. Navegamos al prefijo correspondiente; el page reload vuelve
    // a ejecutar la deteccion en App.jsx y monta el Router con basename
    // correcto. No tocamos i18n aqui ni persistimos en localStorage
    // (4B.6 cubre persistencia explicita si se decide en el futuro).
    if (!isAdminSurface()) {
      if (onAfterChange) {
        try { onAfterChange(locale); } catch (e) { /* no-op */ }
      }
      switchToLocaleByUrl(locale);
      return;
    }

    // Admin surface: no existen URLs con prefijo /en/ (basename fijo "/"
    // por 4B.3). El switcher conserva el comportamiento previo: cambia
    // i18n + persiste preferencia (localStorage anonimo o PUT a
    // /users/me/ui-locale si hay sesion).
    try {
      await updateUiLocale(locale);
      if (onAfterChange) onAfterChange(locale);
    } catch (e) {
      console.error('Locale change error', e);
    }
  };

  return (
    <LocaleSwitch style={style}>
      {locales.map((locale) => (
        <LocaleButton
          key={locale}
          type="button"
          $active={currentLocale === locale}
          onClick={() => handleChange(locale)}
        >
          {LOCALE_LABELS[locale] || locale.toUpperCase()}
        </LocaleButton>
      ))}
    </LocaleSwitch>
  );
};

export default LocaleSwitcher;
