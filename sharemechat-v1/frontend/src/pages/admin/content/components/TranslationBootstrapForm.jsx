// src/pages/admin/content/components/TranslationBootstrapForm.jsx
//
// Formulario para instanciar una traduccion nueva (ADR-045 subpasada 2C.1,
// endpoint 2C.0 POST /admin/content/articles/{id}/translations). Se usa
// exclusivamente para la traduccion EN cuando aun no existe (bodyMissing).
//
// Refactor 2C.3 (2026-07-06): la UX previa mostraba slug y title como
// campos obligatorios visibles, cuando el 95% de las veces el pipeline los
// sobrescribira (fase cms-translate-en). Ahora solo Primary keyword EN +
// Secondary keywords EN son visibles por defecto. Slug/title siguen en el
// state autoderivados (slug=`${slugEs}-en`, title=titulo ES) y viajan al
// backend, pero se ocultan tras un toggle "Opciones avanzadas" plegable
// para el caso 5% donde el operador quiere cambiarlos manualmente.
//
// El boton dice "Guardar keywords EN": lo unico que el operador declara
// aqui son las keywords; el resto del contenido lo hace el pipeline
// despues. Al pulsarlo se crea la translation con las keywords + slug/title
// auto y despues el operador puede seguir editando keywords via el boton
// normal "Guardar campos SEO (EN)" del bloque completo.
//
// Extraido de BodyLocaleTabs.jsx en el refactor stacked (2C.2); simplificado
// en 2C.3 (este refactor).

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
  const [advancedOpen, setAdvancedOpen] = React.useState(false);

  React.useEffect(() => {
    setSlug(suggestedSlug || '');
    setTitle(suggestedTitle || '');
  }, [suggestedSlug, suggestedTitle]);

  const slugFormatInvalid = slug ? !SLUG_REGEX.test(slug.trim()) : false;
  const slugTooLong = (slug || '').length > LIMITS.slug;
  const titleTooLong = (title || '').length > LIMITS.title;
  const primaryTooLong = (primaryKeyword || '').length > LIMITS.primaryKeyword;
  // Slug y title son OBLIGATORIOS en el backend. Como los pre-rellenamos
  // automaticamente desde ES, en la practica nunca estan vacios; el `cannotSubmit`
  // solo bloquea si el operador los vacia manualmente desde el toggle avanzado
  // o si la ES aun no ha sido guardada (suggestedSlug/Title vacios).
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

  const missingEsSuggestions = !suggestedSlug || !suggestedTitle;

  return (
    <MetaCard>
      <div>
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

      {/* Toggle "Opciones avanzadas" para el 5% de casos donde el operador
          quiere manipular slug/title EN a mano en vez de dejar que el
          pipeline los sobrescriba. Cerrado por defecto. */}
      <div style={{ marginTop: 16 }}>
        <button
          type="button"
          onClick={() => setAdvancedOpen((v) => !v)}
          disabled={disabled || creating}
          style={{
            background: 'transparent',
            border: 'none',
            padding: 0,
            fontSize: 12,
            color: '#475569',
            cursor: (disabled || creating) ? 'default' : 'pointer',
            textDecoration: 'underline',
          }}
        >
          {advancedOpen
            ? t('editor.translationBootstrap.advancedHide', '▾ Ocultar opciones avanzadas (slug + título)')
            : t('editor.translationBootstrap.advancedShow', '▸ Opciones avanzadas (slug + título)')}
        </button>
      </div>

      {advancedOpen ? (
        <div style={{
          marginTop: 12,
          padding: 12,
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: 8,
        }}>
          <HelperText style={{ marginBottom: 8, color: '#64748b' }}>
            {t('editor.translationBootstrap.advancedIntro',
              'Autoderivados del ES. El pipeline los actualizará durante la traducción. Solo tócalos si sabes lo que haces.')}
          </HelperText>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <LabelText>
                {t('editor.translationBootstrap.slugLabel', 'Slug EN')}
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
        </div>
      ) : null}

      {/* Aviso solo si las sugerencias auto (slug/title del ES) no estan
          disponibles. Ocurre cuando ES aun no tiene slug o title guardados.
          El operador debe abrir el toggle avanzado y rellenar a mano, o
          guardar antes el ES. */}
      {missingEsSuggestions ? (
        <HelperText style={{ marginTop: 8, color: '#b45309' }}>
          {t('editor.translationBootstrap.needEsFirst',
            'Slug o título ES vacíos: guarda primero los campos SEO del bloque ES para autoderivar el EN, o abre "opciones avanzadas" para rellenarlos a mano.')}
        </HelperText>
      ) : null}

      {error ? <StyledError style={{ marginTop: 8 }}>{error}</StyledError> : null}

      <ToolbarRow>
        <StyledButton
          type="button"
          onClick={handleCreate}
          disabled={cannotSubmit}
        >
          {creating
            ? t('editor.translationBootstrap.btnSaving', 'Guardando keywords EN…')
            : t('editor.translationBootstrap.btnSave', 'Guardar keywords EN')}
        </StyledButton>
      </ToolbarRow>
    </MetaCard>
  );
};

export default TranslationBootstrapForm;
