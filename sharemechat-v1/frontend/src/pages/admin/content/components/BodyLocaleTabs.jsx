// src/pages/admin/content/components/BodyLocaleTabs.jsx
//
// Componente reusable para las vistas de LECTURA per-locale del CMS admin
// (paquete 6, ADR-025):
//
//  1. Modal de preview en `ContentArticleEditor.jsx` (modo `preview`):
//     selector ES|EN + render HTML pasado por prop.
//
//  2. Apertura de body de version en `ContentArticleHistory.jsx`
//     (modo `versionReadonly`): selector poblado solo con los locales que
//     la version tiene congelados + render markdown plano pasado por prop.
//
// El modo `editable` (edicion del articulo vivo) VIVIO aqui hasta 2C.2 y
// ahora usa `BodyLocaleSections` (sin pestañas, stacked ES arriba, EN
// debajo). Motivo: bug UX persistente ligado al click de pestaña; se
// retira la superficie que causa friccion. Ver informes:
//   - docs/analysis/2026-07-05-cms-2c1-maintenance-overlay-repro.md
//   - docs/analysis/2026-07-05-cms-2c1-en-tab-overlay-diagnosis.md
//
// Los modos preview/versionReadonly SIGUEN con tabs porque son vistas de
// lectura (no de edicion): el operador no puede acumular "cambios sin
// guardar" al alternar, la fuente del bug ya no aplica.
//
// Props clave:
//  - `mode`: 'preview' | 'versionReadonly'.
//  - `availableLocales`: ['es','en'] por defecto. En version se pasa solo los
//    locales que esa version tiene congelados.
//  - `activeLocale`, `onActiveLocaleChange`: estado controlado por el padre.
//  - `content` (string HTML o markdown segun modo).

import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyledError, NoteCard, TabsBar, TabButton } from '../../../../styles/AdminStyles';

const BodyLocaleTabs = ({
  mode = 'preview',
  availableLocales = ['es', 'en'],
  activeLocale,
  onActiveLocaleChange,
  content = '',
  contentLoading = false,
  contentError = '',
  contentEmptyKey = 'editor.translationMissing',
}) => {
  const { t } = useTranslation('cms');

  const handleTabClick = (locale) => {
    if (locale === activeLocale) return;
    if (typeof onActiveLocaleChange === 'function') {
      onActiveLocaleChange(locale);
    }
  };

  const renderTabs = () => (
    <TabsBar>
      {availableLocales.map((loc) => (
        <TabButton
          key={loc}
          type="button"
          $active={loc === activeLocale}
          onClick={() => handleTabClick(loc)}
        >
          {loc === 'es'
            ? t('editor.tabEs', 'Español (es)')
            : t('editor.tabEn', 'English (en)')}
        </TabButton>
      ))}
    </TabsBar>
  );

  if (mode === 'preview') {
    return (
      <div>
        {renderTabs()}
        {contentLoading ? (
          <NoteCard>{t('preview.loading', 'Generando preview...')}</NoteCard>
        ) : contentError ? (
          <StyledError>{contentError}</StyledError>
        ) : !content ? (
          <NoteCard>{t(contentEmptyKey, 'Sin contenido para este idioma.')}</NoteCard>
        ) : (
          <div
            style={{
              padding: 16,
              maxHeight: '70vh',
              overflowY: 'auto',
              border: '1px solid #e2e8f0',
              borderRadius: 8,
              background: '#fff',
            }}
            // El backend ya sanitiza (jsoup safelist); confiamos en el
            // contrato. Si en el futuro el render lleva iframes o scripts
            // dinamicos, revisar el sanitizado en MarkdownRendererService.
            dangerouslySetInnerHTML={{ __html: content }}
          />
        )}
      </div>
    );
  }

  if (mode === 'versionReadonly') {
    return (
      <div>
        {renderTabs()}
        {contentLoading ? (
          <NoteCard>{t('history.loadingBody', 'Cargando cuerpo...')}</NoteCard>
        ) : contentError ? (
          <StyledError>{contentError}</StyledError>
        ) : !content ? (
          <NoteCard>
            {t('history.versionLocaleEmpty', 'Esta versión no tiene body en este idioma.')}
          </NoteCard>
        ) : (
          <pre
            style={{
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              background: '#f8fafc',
              padding: 12,
              borderRadius: 8,
              fontSize: 12,
              lineHeight: 1.5,
              margin: 0,
              maxHeight: 360,
              overflowY: 'auto',
            }}
          >
            {content}
          </pre>
        )}
      </div>
    );
  }

  // Cualquier otro modo (incluido el antiguo 'editable') es error de uso.
  return null;
};

export default BodyLocaleTabs;
