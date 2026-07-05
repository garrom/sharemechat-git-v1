// src/pages/admin/content/components/BodyLocaleSections.jsx
//
// Paquete 2C.2 (ADR-045): reemplazo del selector de pestañas ES|EN del
// modo `editable` de BodyLocaleTabs. Ahora los dos locales se apilan en
// la misma vista: ES arriba, EN debajo. El operador puede editar ambos
// idiomas simultaneamente sin cambio de pestaña.
//
// Motivacion: bug UX persistente y no reproducible ligado al click del
// selector de pestañas (informes 2026-07-05-cms-2c1-maintenance-overlay-repro.md
// y 2026-07-05-cms-2c1-en-tab-overlay-diagnosis.md). La solucion
// pragmatica es retirar la superficie que causa friccion: sin click de
// pestaña, sin bug del click de pestaña.
//
// Alcance del cambio:
//  - Solo cambia el layout. Mismo backend, mismos DTOs, mismos endpoints.
//  - Cada seccion (ES / EN) conserva los mismos campos que tenia en su
//    pestaña: Keywords SEO + titulo/slug/seoTitle/metaDescription/brief +
//    boton "Guardar campos SEO ({locale})" + editor markdown de cuerpo.
//  - Boton parametrizado por locale para que el operador sepa siempre en
//    que idioma opera ("Guardar campos SEO (ES)" vs "Guardar campos SEO (EN)").
//  - EN sin translation instanciada (bodyMissing) sigue mostrando
//    TranslationBootstrapForm; se instancia via POST /translations
//    (endpoint 2C.0).
//
// El modo `preview` y `versionReadonly` siguen usando BodyLocaleTabs
// (con tabs) — son vistas de lectura donde la pestaña es la UX adecuada.

import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  StyledButton,
  StyledError,
  StyledInput,
  NoteCard,
} from '../../../../styles/AdminStyles';
import {
  BriefArea,
  HelperText,
  LabelText,
  MarkdownArea,
  MetaCard,
  ToolbarRow,
} from '../../../../styles/pages-styles/AdminContentStyles';
import TranslationBootstrapForm from './TranslationBootstrapForm';
import {
  LIMITS,
  BRIEF_REQUIRED_LOCALE,
  BRIEF_WARN_THRESHOLD,
  SLUG_REGEX,
  BODY_MAX_BYTES_HINT,
  lengthWarn,
  countNormalizedSecondaries,
} from './bodyLocaleConstants';

// -----------------------------------------------------------------------
// Bloque de un locale (self-contained): Keywords SEO + campos + body.
// -----------------------------------------------------------------------
const LocaleSection = ({
  locale,
  seoDraft,
  onSeoFieldsChange,
  onSaveSeo,
  savingSeo,
  seoError,
  body,
  onBodyChange,
  onSaveBody,
  savingBody,
  bodyError,
  disabled,
}) => {
  const { t } = useTranslation('cms');

  const draft = seoDraft || {};
  const titleWarn = lengthWarn(draft.title, LIMITS.title);
  const slugWarn = lengthWarn(draft.slug, LIMITS.slug);
  const seoTitleWarn = lengthWarn(draft.seoTitle, LIMITS.seoTitle);
  const metaDescWarn = lengthWarn(draft.metaDescription, LIMITS.metaDescription);
  const briefWarn = lengthWarn(draft.brief, LIMITS.brief);
  const briefRequired = locale === BRIEF_REQUIRED_LOCALE;
  const briefEmpty = !(draft.brief && draft.brief.trim().length > 0);
  const briefMissingRequired = briefRequired && briefEmpty;
  const briefWarnZone = !briefWarn.exceeded && briefWarn.used >= BRIEF_WARN_THRESHOLD;
  const slugFormatInvalid = draft.slug
    ? !SLUG_REGEX.test(draft.slug.trim())
    : false;
  const primaryKeywordWarn = lengthWarn(draft.primaryKeyword, LIMITS.primaryKeyword);
  const primaryRequired = locale === BRIEF_REQUIRED_LOCALE;
  const primaryEmpty = !(draft.primaryKeyword && draft.primaryKeyword.trim().length > 0);
  const primaryMissingRequired = primaryRequired && primaryEmpty;
  const secondariesCount = countNormalizedSecondaries(draft.secondaryKeywords);
  const secondariesOverCap = secondariesCount > LIMITS.secondaryKeywordsMaxItems;

  const handleSeoField = (key, value) => {
    if (typeof onSeoFieldsChange === 'function') {
      onSeoFieldsChange({ ...draft, [key]: value });
    }
  };

  const localeUpper = locale.toUpperCase();
  const saveDisabled = savingSeo || disabled
    || titleWarn.exceeded || slugWarn.exceeded
    || seoTitleWarn.exceeded || metaDescWarn.exceeded
    || briefWarn.exceeded || briefMissingRequired
    || slugFormatInvalid
    || primaryKeywordWarn.exceeded;

  return (
    <div>
      <MetaCard>
        <h4 style={{ margin: '0 0 12px 0' }}>
          {t('editor.tabsTitle', 'Contenido por idioma')} — {localeUpper}
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
              {locale === 'es'
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
              placeholder={locale === 'es'
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
                {locale === 'es'
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
            disabled={saveDisabled}
          >
            {savingSeo
              ? t('editor.btnSavingSeoLocale',
                  'Guardando SEO ({{locale}})…',
                  { locale: localeUpper })
              : t('editor.btnSaveSeoLocale',
                  'Guardar campos SEO ({{locale}})',
                  { locale: localeUpper })}
          </StyledButton>
        </ToolbarRow>
      </MetaCard>

      <MetaCard>
        <LabelText>
          {t('editor.fieldBodyLocale',
            'Cuerpo ({{locale}}, markdown)',
            { locale: localeUpper })}
        </LabelText>
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
              ? t('editor.btnSavingBodyLocale',
                  'Guardando cuerpo ({{locale}})…',
                  { locale: localeUpper })
              : t('editor.btnSaveBodyLocale',
                  'Guardar cuerpo ({{locale}})',
                  { locale: localeUpper })}
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

// -----------------------------------------------------------------------
// BodyLocaleSections: contenedor apilado ES arriba, EN debajo.
// -----------------------------------------------------------------------
const BodyLocaleSections = ({
  // ES
  esTranslation,
  esSeoDraft,
  onEsSeoFieldsChange,
  onSaveEsSeo,
  savingEsSeo,
  esSeoError,
  esBody,
  onEsBodyChange,
  onSaveEsBody,
  savingEsBody,
  esBodyError,
  esBodyMissing,   // reservado por simetria; ES nunca deberia ser missing en la practica

  // EN
  enTranslation,
  enSeoDraft,
  onEnSeoFieldsChange,
  onSaveEnSeo,
  savingEnSeo,
  enSeoError,
  enBody,
  onEnBodyChange,
  onSaveEnBody,
  savingEnBody,
  enBodyError,
  enBodyMissing,

  // Bootstrap EN (endpoint 2C.0)
  onCreateTranslation,
  suggestedEnSlug = '',
  suggestedEnTitle = '',
  creatingTranslation = false,
  createTranslationError = '',

  disabled = false,
}) => {
  const { t } = useTranslation('cms');

  return (
    <div>
      {/* ============ Bloque ES ============ */}
      <LocaleSection
        locale="es"
        seoDraft={esSeoDraft}
        onSeoFieldsChange={onEsSeoFieldsChange}
        onSaveSeo={onSaveEsSeo}
        savingSeo={savingEsSeo}
        seoError={esSeoError}
        body={esBody}
        onBodyChange={onEsBodyChange}
        onSaveBody={onSaveEsBody}
        savingBody={savingEsBody}
        bodyError={esBodyError}
        disabled={disabled}
      />

      {/* Separador visual */}
      <div style={{ height: 24 }} />

      {/* ============ Bloque EN ============ */}
      {enBodyMissing ? (
        <div>
          <MetaCard>
            <h4 style={{ margin: '0 0 12px 0' }}>
              {t('editor.tabsTitle', 'Contenido por idioma')} — EN
            </h4>
            <NoteCard style={{ marginBottom: 12 }}>
              {t('editor.translationMissingEnStacked',
                'La traducción EN aún no está instanciada. Rellena los campos mínimos abajo para crearla; el pipeline IA la completará luego.')}
            </NoteCard>
          </MetaCard>
          <TranslationBootstrapForm
            locale="en"
            suggestedSlug={suggestedEnSlug}
            suggestedTitle={suggestedEnTitle}
            onCreate={onCreateTranslation}
            creating={creatingTranslation}
            error={createTranslationError}
            disabled={disabled}
          />
        </div>
      ) : (
        <LocaleSection
          locale="en"
          seoDraft={enSeoDraft}
          onSeoFieldsChange={onEnSeoFieldsChange}
          onSaveSeo={onSaveEnSeo}
          savingSeo={savingEnSeo}
          seoError={enSeoError}
          body={enBody}
          onBodyChange={onEnBodyChange}
          onSaveBody={onSaveEnBody}
          savingBody={savingEnBody}
          bodyError={enBodyError}
          disabled={disabled}
        />
      )}
    </div>
  );
};

export default BodyLocaleSections;
