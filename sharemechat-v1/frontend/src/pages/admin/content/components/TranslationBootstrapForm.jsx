// src/pages/admin/content/components/TranslationBootstrapForm.jsx
//
// Formulario para instanciar una traduccion nueva (ADR-045 subpasada 2C.1,
// endpoint 2C.0 POST /admin/content/articles/{id}/translations). Se usa
// exclusivamente para la traduccion EN cuando aun no existe (bodyMissing).
//
// Pre-rellena slug con `${slugEs}-en` y title con el ES para minimizar
// friccion; el operador puede editarlos antes de crear. Primary EN y
// secondaries EN son opcionales (ADR-045 D3): si el operador rellena
// primary, la fase 4.5 del pipeline la HONRA; si vacia, la deriva del ES
// adaptando al mercado anglosajon.
//
// Extraido de BodyLocaleTabs.jsx en el refactor stacked (2C.2): pasa a
// ser un componente autonomo importado desde BodyLocaleSections.jsx.

import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyledButton, StyledError, StyledInput } from '../../../../styles/AdminStyles';
import {
  HelperText,
  LabelText,
  MetaCard,
  ToolbarRow,
} from '../../../../styles/pages-styles/AdminContentStyles';
import {
  LIMITS,
  SLUG_REGEX,
  countNormalizedSecondaries,
} from './bodyLocaleConstants';

const TranslationBootstrapForm = ({
  locale,
  suggestedSlug,
  suggestedTitle,
  onCreate,
  creating,
  error,
  disabled,
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
  );
};

export default TranslationBootstrapForm;
