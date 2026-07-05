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

// Limites UI-side (replican backend, paquetes 2 + 6.5 + ADR-027 + ADR-045):
//   TITLE_MAX = 255, SLUG_MAX = 160, SEO_TITLE_MAX = 60,
//   META_DESCRIPTION_MAX = 160, BRIEF_MAX = 8192, PRIMARY_KEYWORD_MAX = 120,
//   SECONDARY_KEYWORDS_MAX_ITEMS = 5. Si el operador excede, mostramos
//   warning inline y deshabilitamos "Guardar SEO"; el PATCH del backend
//   es el rechazo definitivo.
const LIMITS = {
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

// ADR-045 subpasada 2C.1: cuenta terminos coma-separados normalizados
// (trim, sin vacios, dedup case-insensitive) para mostrar el contador y
// el warning "over cap" en el input de secondary_keywords. El backend
// aplica la misma normalizacion (2A ContentArticleService.normalizeSecondaryKeywords)
// mas cap silencioso a 5; la UI solo lo refleja.
const countNormalizedSecondaries = (csv) => {
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

// ADR-045 subpasada 2C.1: form embedded en BodyLocaleTabs cuando la
// translation aun no existe. Pre-rellena slug con `${slugEs}-en` y title
// con el ES para minimizar friccion; el operador puede editarlos antes de
// crear. Primary EN y secondaries EN son opcionales (ADR-045 D3): si el
// operador rellena primary, la fase 4.5 del pipeline la HONRA; si vacia,
// la deriva del ES adaptando al mercado anglosajon.
const TranslationBootstrapForm = ({
  locale,
  suggestedSlug,
  suggestedTitle,
  onCreate,
  creating,
  error,
  disabled,
  renderTabs,
}) => {
  const { t } = useTranslation('cms');
  const [slug, setSlug] = React.useState(suggestedSlug || '');
  const [title, setTitle] = React.useState(suggestedTitle || '');
  const [primaryKeyword, setPrimaryKeyword] = React.useState('');
  const [secondaryKeywords, setSecondaryKeywords] = React.useState('');

  React.useEffect(() => {
    setSlug(suggestedSlug || '');
    setTitle(suggestedTitle || '');
  }, [suggestedSlug, suggestedTitle]);

  const slugFormatInvalid = slug ? !SLUG_REGEX.test(slug.trim()) : false;
  const slugTooLong = (slug || '').length > LIMITS.slug;
  const titleTooLong = (title || '').length > LIMITS.title;
  const primaryTooLong = (primaryKeyword || '').length > LIMITS.primaryKeyword;
  const cannotSubmit = disabled || creating
    || !(slug && slug.trim())
    || !(title && title.trim())
    || slugFormatInvalid
    || slugTooLong
    || titleTooLong
    || primaryTooLong;

  const handleCreate = () => {
    if (cannotSubmit) return;
    if (typeof onCreate !== 'function') return;
    onCreate({
      locale,
      slug: slug.trim(),
      title: title.trim(),
      primaryKeyword: primaryKeyword.trim() || null,
      secondaryKeywords: secondaryKeywords.trim() || null,
    });
  };

  return (
    <div>
      {renderTabs()}
      <MetaCard>
        <h4 style={{ margin: '0 0 8px 0' }}>
          {t('editor.translationBootstrap.title', 'Instanciar traducción EN')}
        </h4>
        <p style={{ margin: '0 0 12px 0', fontSize: 13, color: '#475569' }}>
          {t('editor.translationBootstrap.intro',
            'Esta traducción aún no existe. Rellena los campos mínimos y crea la fila; el pipeline IA la completará al ejecutarse.')}
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <LabelText>
              {t('editor.translationBootstrap.slugLabel', 'Slug EN')}
              <span style={{ color: '#b91c1c', marginLeft: 4 }}>*</span>
            </LabelText>
            <StyledInput
              type="text"
              value={slug}
              disabled={disabled || creating}
              onChange={(e) => setSlug(e.target.value)}
              placeholder={t('editor.translationBootstrap.slugPlaceholder', 'kebab-case')}
            />
            <HelperText style={{ color: (slugFormatInvalid || slugTooLong) ? '#b91c1c' : '#64748b' }}>
              {slugFormatInvalid
                ? t('editor.slugInvalid', 'Formato inválido: solo minúsculas, dígitos y guiones')
                : t('editor.translationBootstrap.slugHelper',
                    'Debe ser distinto del slug ES (ADR-022 D2). Sugerido: {{suggested}}.',
                    { suggested: suggestedSlug || '-' })}
            </HelperText>
          </div>
          <div>
            <LabelText>
              {t('editor.translationBootstrap.titleLabel', 'Título EN')}
              <span style={{ color: '#b91c1c', marginLeft: 4 }}>*</span>
            </LabelText>
            <StyledInput
              type="text"
              value={title}
              disabled={disabled || creating}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('editor.fieldTranslationTitlePlaceholder', 'Título de la traducción')}
            />
            <HelperText style={{ color: titleTooLong ? '#b91c1c' : '#64748b' }}>
              {t('editor.translationBootstrap.titleHelper',
                'El pipeline IA lo actualizará al traducir. Puedes dejar este provisional.')}
            </HelperText>
          </div>
        </div>

        <div style={{ marginTop: 12 }}>
          <LabelText>
            {t('editor.keywordsSection.primaryLabelEn', 'Primary keyword')}
          </LabelText>
          <StyledInput
            type="text"
            value={primaryKeyword}
            disabled={disabled || creating}
            onChange={(e) => setPrimaryKeyword(e.target.value)}
            placeholder={t('editor.keywordsSection.primaryPlaceholderEn', 'ej: safe video chat')}
          />
          <HelperText style={{ color: primaryTooLong ? '#b91c1c' : '#64748b' }}>
            {t('editor.keywordsSection.primaryHelperEn',
              'Si la dejas vacía, el pipeline IA la derivará del ES adaptándola al mercado anglosajón.')}
          </HelperText>
        </div>

        <div style={{ marginTop: 12 }}>
          <LabelText>
            {t('editor.keywordsSection.secondaryLabel', 'Secondary keywords')}
          </LabelText>
          <StyledInput
            type="text"
            value={secondaryKeywords}
            disabled={disabled || creating}
            onChange={(e) => setSecondaryKeywords(e.target.value)}
            placeholder={t('editor.keywordsSection.secondaryPlaceholder',
              'separadas por comas, ej: verified cam models, private 1v1 chat')}
          />
          <HelperText>
            {t('editor.keywordsSection.secondaryCounter', '{{used}}/5 términos',
              { used: countNormalizedSecondaries(secondaryKeywords) })}
          </HelperText>
        </div>

        {error ? <StyledError style={{ marginTop: 8 }}>{error}</StyledError> : null}

        <ToolbarRow>
          <StyledButton
            type="button"
            onClick={handleCreate}
            disabled={cannotSubmit}
          >
            {creating
              ? t('editor.translationBootstrap.btnCreating', 'Creando…')
              : t('editor.translationBootstrap.btnCreate', 'Instanciar traducción EN')}
          </StyledButton>
        </ToolbarRow>
      </MetaCard>
    </div>
  );
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
  // ADR-045 subpasada 2C.1: flujo de instanciacion de translation EN
  // antes del pipeline (endpoint POST /translations creado en 2C.0).
  // Cuando missingTranslation=true, el editor pinta el form de
  // instanciacion en lugar del textarea de body. El padre gestiona el
  // POST y la recarga del articulo tras 201.
  onCreateTranslation,     // ({ locale, slug, title, primaryKeyword, secondaryKeywords }) => Promise
  suggestedSlug = '',      // Pre-relleno del slug (padre: `${slugEs}-en`).
  suggestedTitle = '',     // Pre-relleno del title (padre: title ES).
  creatingTranslation = false,
  createTranslationError = '',
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
  // ADR-045 subpasada 2C.1: si la translation aun no existe, en lugar del
  // fallback antiguo (textarea + Guardar cuerpo, que ya no funciona tras
  // el fix de 2C.0 que retiro el orElseGet on-demand) pintamos el form de
  // instanciacion con slug + title obligatorios + primary/secondaries
  // opcionales, mediante POST /admin/content/articles/{id}/translations.
  if (missingTranslation) {
    return (
      <TranslationBootstrapForm
        locale={activeLocale}
        suggestedSlug={suggestedSlug}
        suggestedTitle={suggestedTitle}
        onCreate={onCreateTranslation}
        creating={creatingTranslation}
        error={createTranslationError}
        disabled={disabled}
        renderTabs={renderTabs}
      />
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
  // ADR-045 subpasada 2C.1: warnings para Keywords SEO.
  const primaryKeywordWarn = lengthWarn(draft.primaryKeyword, LIMITS.primaryKeyword);
  const primaryRequired = activeLocale === BRIEF_REQUIRED_LOCALE; // ES obligatoria
  const primaryEmpty = !(draft.primaryKeyword && draft.primaryKeyword.trim().length > 0);
  const primaryMissingRequired = primaryRequired && primaryEmpty;
  const secondariesCount = countNormalizedSecondaries(draft.secondaryKeywords);
  const secondariesOverCap = secondariesCount > LIMITS.secondaryKeywordsMaxItems;

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

        {/* ADR-045 subpasada 2C.1 (D6): bloque Keywords SEO per-locale.
            Va al inicio del formulario porque el operador debe declararlas
            antes de lanzar el pipeline (gate ADR-045 D3 exige primary ES). */}
        <div
          style={{
            padding: 12,
            marginBottom: 16,
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: 8,
          }}
        >
          <h5 style={{ margin: '0 0 10px 0', fontSize: 14 }}>
            {t('editor.keywordsSection.title', 'Keywords SEO')}
          </h5>
          <div>
            <LabelText>
              {activeLocale === 'es'
                ? t('editor.keywordsSection.primaryLabelEs', 'Primary keyword')
                : t('editor.keywordsSection.primaryLabelEn', 'Primary keyword')}
              {primaryRequired ? (
                <span style={{ color: '#b91c1c', marginLeft: 4 }}>*</span>
              ) : null}
            </LabelText>
            <StyledInput
              type="text"
              value={draft.primaryKeyword || ''}
              disabled={disabled}
              onChange={(e) => handleSeoField('primaryKeyword', e.target.value)}
              placeholder={activeLocale === 'es'
                ? t('editor.keywordsSection.primaryPlaceholderEs', 'ej: videochat seguro')
                : t('editor.keywordsSection.primaryPlaceholderEn', 'ej: safe video chat')}
            />
            <HelperText style={{
              color: primaryKeywordWarn.exceeded || primaryMissingRequired
                ? '#b91c1c'
                : '#64748b',
            }}>
              {primaryMissingRequired
                ? t('editor.keywordsSection.primaryHelperEs',
                    'Eje SEO del artículo español. Obligatoria para lanzar el pipeline IA y para enviar a revisión.')
                : t('editor.lengthCounter', '{{used}}/{{max}} caracteres',
                    { used: primaryKeywordWarn.used, max: primaryKeywordWarn.max })}
            </HelperText>
            {!primaryMissingRequired ? (
              <HelperText style={{ color: '#64748b' }}>
                {activeLocale === 'es'
                  ? t('editor.keywordsSection.primaryHelperEs',
                      'Eje SEO del artículo español. Obligatoria para lanzar el pipeline IA y para enviar a revisión.')
                  : t('editor.keywordsSection.primaryHelperEn',
                      'Si la dejas vacía, el pipeline IA la derivará del ES adaptándola al mercado anglosajón.')}
              </HelperText>
            ) : null}
          </div>

          <div style={{ marginTop: 12 }}>
            <LabelText>
              {t('editor.keywordsSection.secondaryLabel', 'Secondary keywords')}
            </LabelText>
            <StyledInput
              type="text"
              value={draft.secondaryKeywords || ''}
              disabled={disabled}
              onChange={(e) => handleSeoField('secondaryKeywords', e.target.value)}
              placeholder={t('editor.keywordsSection.secondaryPlaceholder',
                'separadas por comas, ej: verificar modelos, 1v1 privado, chat webcam')}
            />
            <HelperText style={{ color: secondariesOverCap ? '#b45309' : '#64748b' }}>
              {secondariesOverCap
                ? t('editor.keywordsSection.secondaryOverCap',
                    'Solo se guardarán los 5 primeros (backend cap).')
                : t('editor.keywordsSection.secondaryCounter', '{{used}}/5 términos',
                    { used: secondariesCount })}
            </HelperText>
            <HelperText style={{ color: '#64748b' }}>
              {t('editor.keywordsSection.secondaryHelper',
                'Cluster semántico. Máximo 5. Máximo 120 caracteres por término.')}
            </HelperText>
          </div>
        </div>

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
              || slugFormatInvalid
              || primaryKeywordWarn.exceeded}
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
