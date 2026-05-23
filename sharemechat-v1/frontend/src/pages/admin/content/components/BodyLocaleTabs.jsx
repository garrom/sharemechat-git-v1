// src/pages/admin/content/components/BodyLocaleTabs.jsx
//
// Componente reusable que centraliza el patron "selector ES|EN + contenido
// de la traduccion activa" usado en tres sitios del admin del CMS (paquete 6,
// ADR-025):
//
//  1. Editor del body en `ContentArticleEditor.jsx` (modo `editable`):
//     muestra inputs para title/slug/seoTitle/metaDescription + textarea del
//     body markdown. Llama a PATCH /translations/{locale} para los campos
//     SEO y a PUT /translations/{locale}/body para el body.
//
//  2. Modal de preview en `ContentArticleEditor.jsx` (modo `preview`):
//     selector + render HTML pasado por prop.
//
//  3. Apertura de body de version en `ContentArticleHistory.jsx`
//     (modo `versionReadonly`): selector poblado solo con los locales que
//     la version tiene congelados + render markdown plano pasado por prop.
//
// El componente NO hace los fetch ni los PATCH directamente; el padre se
// encarga de eso y pasa los datos por prop. Asi el mismo componente sirve
// para tres flujos distintos sin acoplamiento al backend.
//
// Props clave:
//  - `mode`: 'editable' | 'preview' | 'versionReadonly'.
//  - `availableLocales`: ['es','en'] por defecto. En version se pasa solo los
//    locales que esa version tiene congelados.
//  - `activeLocale`, `onActiveLocaleChange`: estado controlado por el padre.
//  - En modo editable: `translation`, `body`, `onBodyChange`, `onSaveSeo`,
//    `onSaveBody`, `saving*` flags, `errors`, `missingTranslation` flag.
//  - En modo preview/versionReadonly: `content` (string HTML o markdown).
//
// Validacion UI-side de longitudes y formato slug es local; la verdad
// canonica esta en el backend (paquetes 2 + 6.5). Mostramos contadores y
// warning inline cuando el operador excede, sin bloquear el teclado.

import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyledButton, StyledError, StyledInput, NoteCard, TabsBar, TabButton } from '../../../../styles/AdminStyles';
import {
  BriefArea,
  HelperText,
  LabelText,
  MarkdownArea,
  MetaCard,
  ToolbarRow,
} from '../../../../styles/pages-styles/AdminContentStyles';

// Limites UI-side (replican backend, paquetes 2 + 6.5 + ADR-027):
//   TITLE_MAX = 255, SLUG_MAX = 160, SEO_TITLE_MAX = 60,
//   META_DESCRIPTION_MAX = 160, BRIEF_MAX = 8192. Si el operador excede,
//   mostramos warning inline y deshabilitamos "Guardar SEO"; el PATCH del
//   backend es el rechazo definitivo.
const LIMITS = {
  title: 255,
  slug: 160,
  seoTitle: 60,
  metaDescription: 160,
  brief: 8192,
};
// ADR-027: brief obligatorio en locale primario ES; opcional en EN.
const BRIEF_REQUIRED_LOCALE = 'es';
// Umbral visual de aviso: a partir de aqui el contador del brief cambia
// a color de warning aunque siga por debajo del maximo. Coherente con el
// patron usado por el operador para tener margen visible antes del corte.
const BRIEF_WARN_THRESHOLD = 8000;
const SLUG_REGEX = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const BODY_MAX_BYTES_HINT = 204800;

const lengthWarn = (value, max) => {
  const used = value ? value.length : 0;
  return { used, max, exceeded: used > max };
};

const BodyLocaleTabs = ({
  mode = 'editable',
  availableLocales = ['es', 'en'],
  activeLocale,
  onActiveLocaleChange,
  // Modo editable:
  translation,
  body,
  onBodyChange,
  onSeoFieldsChange,
  seoDraft,
  onSaveSeo,
  onSaveBody,
  savingSeo = false,
  savingBody = false,
  bodyError = '',
  seoError = '',
  missingTranslation = false,
  disabled = false,
  // Modo preview / versionReadonly:
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

  // Mode editable.
  if (missingTranslation) {
    return (
      <div>
        {renderTabs()}
        <NoteCard>
          {t('editor.translationMissing',
            'Esta traducción aún no existe. Genérala con el panel IA pegando un JSON bilingüe, o escribe directamente abajo y pulsa "Guardar cuerpo" para crearla.')}
        </NoteCard>
        <MetaCard>
          <LabelText>{t('editor.fieldBody', 'Cuerpo (markdown)')}</LabelText>
          <MarkdownArea
            value={body || ''}
            disabled={disabled}
            onChange={(e) => onBodyChange && onBodyChange(e.target.value)}
            placeholder={t('editor.fieldBodyPlaceholder', '# Título\n\nEscribe el cuerpo en markdown...')}
          />
          {bodyError ? <StyledError>{bodyError}</StyledError> : null}
          <ToolbarRow>
            <StyledButton
              type="button"
              onClick={onSaveBody}
              disabled={savingBody || disabled}
            >
              {savingBody
                ? t('editor.btnSavingBody', 'Guardando cuerpo...')
                : t('editor.btnSaveBody', 'Guardar cuerpo')}
            </StyledButton>
            <HelperText>
              {t('editor.bodyBytesUsed',
                  '{{used}} bytes / {{max}} bytes máximo (configurable backend)',
                  { used: new Blob([body || '']).size, max: BODY_MAX_BYTES_HINT })}
            </HelperText>
          </ToolbarRow>
        </MetaCard>
      </div>
    );
  }

  const draft = seoDraft || {};
  const titleWarn = lengthWarn(draft.title, LIMITS.title);
  const slugWarn = lengthWarn(draft.slug, LIMITS.slug);
  const seoTitleWarn = lengthWarn(draft.seoTitle, LIMITS.seoTitle);
  const metaDescWarn = lengthWarn(draft.metaDescription, LIMITS.metaDescription);
  const briefWarn = lengthWarn(draft.brief, LIMITS.brief);
  const briefRequired = activeLocale === BRIEF_REQUIRED_LOCALE;
  const briefEmpty = !(draft.brief && draft.brief.trim().length > 0);
  const briefMissingRequired = briefRequired && briefEmpty;
  const briefWarnZone = !briefWarn.exceeded
    && briefWarn.used >= BRIEF_WARN_THRESHOLD;
  const slugFormatInvalid = draft.slug
    ? !SLUG_REGEX.test(draft.slug.trim())
    : false;

  const handleSeoField = (key, value) => {
    if (typeof onSeoFieldsChange === 'function') {
      onSeoFieldsChange({ ...draft, [key]: value });
    }
  };

  return (
    <div>
      {renderTabs()}

      <MetaCard>
        <h4 style={{ margin: '0 0 12px 0' }}>
          {t('editor.tabsTitle', 'Contenido por idioma')} — {activeLocale.toUpperCase()}
        </h4>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <LabelText>{t('editor.fieldTranslationTitle', 'Título')}</LabelText>
            <StyledInput
              type="text"
              value={draft.title || ''}
              disabled={disabled}
              onChange={(e) => handleSeoField('title', e.target.value)}
              placeholder={t('editor.fieldTranslationTitlePlaceholder', 'Título de la traducción')}
            />
            <HelperText style={{ color: titleWarn.exceeded ? '#b91c1c' : '#64748b' }}>
              {t('editor.lengthCounter', '{{used}}/{{max}} caracteres',
                  { used: titleWarn.used, max: titleWarn.max })}
            </HelperText>
          </div>
          <div>
            <LabelText>{t('editor.fieldTranslationSlug', 'Slug')}</LabelText>
            <StyledInput
              type="text"
              value={draft.slug || ''}
              disabled={disabled}
              onChange={(e) => handleSeoField('slug', e.target.value)}
              placeholder={t('editor.fieldTranslationSlugPlaceholder', 'kebab-case-de-este-locale')}
            />
            <HelperText style={{ color: (slugWarn.exceeded || slugFormatInvalid) ? '#b91c1c' : '#64748b' }}>
              {slugFormatInvalid
                ? t('editor.slugInvalid', 'Formato inválido: solo minúsculas, dígitos y guiones')
                : t('editor.lengthCounter', '{{used}}/{{max}} caracteres',
                    { used: slugWarn.used, max: slugWarn.max })}
            </HelperText>
          </div>
        </div>

        <div style={{ marginTop: 12 }}>
          <LabelText>{t('editor.fieldSeoTitle', 'SEO title')}</LabelText>
          <StyledInput
            type="text"
            value={draft.seoTitle || ''}
            disabled={disabled}
            onChange={(e) => handleSeoField('seoTitle', e.target.value)}
            placeholder={t('editor.fieldSeoTitlePlaceholder', 'Para <title> y open graph')}
          />
          <HelperText style={{ color: seoTitleWarn.exceeded ? '#b91c1c' : '#64748b' }}>
            {t('editor.lengthCounter', '{{used}}/{{max}} caracteres',
                { used: seoTitleWarn.used, max: seoTitleWarn.max })}
          </HelperText>
        </div>

        <div style={{ marginTop: 12 }}>
          <LabelText>{t('editor.fieldMetaDescription', 'Meta description')}</LabelText>
          <BriefArea
            rows={3}
            value={draft.metaDescription || ''}
            disabled={disabled}
            onChange={(e) => handleSeoField('metaDescription', e.target.value)}
            placeholder={t('editor.fieldMetaDescriptionPlaceholder', 'Para <meta name="description">')}
          />
          <HelperText style={{ color: metaDescWarn.exceeded ? '#b91c1c' : '#64748b' }}>
            {t('editor.lengthCounter', '{{used}}/{{max}} caracteres',
                { used: metaDescWarn.used, max: metaDescWarn.max })}
          </HelperText>
        </div>

        {/* Brief per-locale (ADR-027). ES obligatorio para enviar a revision;
            EN opcional. */}
        <div style={{ marginTop: 12 }}>
          <LabelText>
            {t('editor.fieldBrief', 'Brief')}
            {briefRequired ? (
              <span style={{ color: '#b91c1c', marginLeft: 4 }}>*</span>
            ) : null}
          </LabelText>
          <BriefArea
            rows={4}
            value={draft.brief || ''}
            disabled={disabled}
            onChange={(e) => handleSeoField('brief', e.target.value)}
            placeholder={t('editor.fieldBriefPlaceholder',
              'Texto descriptivo de 1-2 frases visible en cards del blog y cabecera del detalle')}
          />
          <HelperText style={{
            color: briefWarn.exceeded || briefMissingRequired
              ? '#b91c1c'
              : briefWarnZone
                ? '#b45309'
                : '#64748b',
          }}>
            {briefMissingRequired
              ? t('editor.briefRequired',
                  'El brief en ES es obligatorio para enviar a revisión.')
              : t('editor.lengthCounter', '{{used}}/{{max}} caracteres',
                  { used: briefWarn.used, max: briefWarn.max })}
          </HelperText>
          {!briefMissingRequired ? (
            <HelperText style={{ color: '#64748b' }}>
              {briefRequired
                ? t('editor.briefHelperEs',
                    'Visible en cards del listado público y cabecera del detalle. Obligatorio en ES.')
                : t('editor.briefHelperEn',
                    'Visible en cards del listado público y cabecera del detalle. Opcional en EN; el pipeline IA lo genera al traducir.')}
            </HelperText>
          ) : null}
        </div>

        {seoError ? <StyledError style={{ marginTop: 8 }}>{seoError}</StyledError> : null}

        <ToolbarRow>
          <StyledButton
            type="button"
            onClick={onSaveSeo}
            disabled={savingSeo || disabled
              || titleWarn.exceeded || slugWarn.exceeded
              || seoTitleWarn.exceeded || metaDescWarn.exceeded
              || briefWarn.exceeded || briefMissingRequired
              || slugFormatInvalid}
          >
            {savingSeo
              ? t('editor.btnSavingSeo', 'Guardando SEO...')
              : t('editor.btnSaveSeo', 'Guardar campos SEO')}
          </StyledButton>
        </ToolbarRow>
      </MetaCard>

      <MetaCard>
        <LabelText>{t('editor.fieldBody', 'Cuerpo (markdown)')}</LabelText>
        <MarkdownArea
          value={body || ''}
          disabled={disabled}
          onChange={(e) => onBodyChange && onBodyChange(e.target.value)}
          placeholder={t('editor.fieldBodyPlaceholder', '# Título\n\nEscribe el cuerpo en markdown...')}
        />
        {bodyError ? <StyledError>{bodyError}</StyledError> : null}
        <ToolbarRow>
          <StyledButton
            type="button"
            onClick={onSaveBody}
            disabled={savingBody || disabled}
          >
            {savingBody
              ? t('editor.btnSavingBody', 'Guardando cuerpo...')
              : t('editor.btnSaveBody', 'Guardar cuerpo')}
          </StyledButton>
          <HelperText>
            {t('editor.bodyBytesUsed',
                '{{used}} bytes / {{max}} bytes máximo (configurable backend)',
                { used: new Blob([body || '']).size, max: BODY_MAX_BYTES_HINT })}
          </HelperText>
        </ToolbarRow>
      </MetaCard>
    </div>
  );
};

export default BodyLocaleTabs;
export { LIMITS, SLUG_REGEX };
