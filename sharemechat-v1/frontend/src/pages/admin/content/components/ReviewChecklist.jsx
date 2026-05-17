// src/pages/admin/content/components/ReviewChecklist.jsx
//
// Checklist preventivo de invariantes necesarias para que el backend acepte
// la transicion DRAFT -> IN_REVIEW (paquete 6, bloque 7, ADR-025).
//
// Espeja exactamente las verificaciones que ContentArticleService.
// assertReadyForReview hace server-side:
//   - heroImageUrl no vacio
//   - brief no vacio
//   - translations ES y EN ambas existentes
//   - body presente (bodyS3Key no vacio) en cada locale
//   - title presente en cada locale
//   - seoTitle presente en cada locale
//   - metaDescription presente en cada locale
//
// El componente no hace fetch propio: consume directamente el
// `ArticleDetailDTO` que el editor padre ya tiene cargado, y notifica al
// padre via `onChecklistChange(allPassed)` para que pueda habilitar /
// deshabilitar el boton "Enviar a revisión" de la barra de transiciones.
//
// Solo se renderiza cuando el articulo esta en DRAFT (el padre decide
// montarlo o no). Cuando todos los flags pasan, se muestra un banner verde
// "Todos los campos completos. Puedes enviar a revisión.".

import React, { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { MetaCard } from '../../../../styles/pages-styles/AdminContentStyles';

const isNonEmpty = (s) => typeof s === 'string' && s.trim().length > 0;

const findTranslation = (article, locale) => {
  if (!article || !Array.isArray(article.translations)) return null;
  return article.translations.find((t) => t && t.locale === locale) || null;
};

const ReviewChecklist = ({ article, onChecklistChange }) => {
  const { t } = useTranslation('cms');

  const checks = useMemo(() => {
    if (!article) {
      return {
        items: [],
        allPassed: false,
        missingCount: 0,
      };
    }

    const trEs = findTranslation(article, 'es');
    const trEn = findTranslation(article, 'en');

    const flags = [
      {
        key: 'hero',
        label: t('checklist.hero', 'Hero image configurada'),
        ok: isNonEmpty(article.heroImageUrl),
      },
      {
        key: 'brief',
        label: t('checklist.brief', 'Brief presente'),
        ok: isNonEmpty(article.brief),
      },
      {
        key: 'bodyEs',
        label: t('checklist.bodyEs', 'Cuerpo ES presente'),
        ok: !!trEs && isNonEmpty(trEs.bodyS3Key),
      },
      {
        key: 'bodyEn',
        label: t('checklist.bodyEn', 'Cuerpo EN presente'),
        ok: !!trEn && isNonEmpty(trEn.bodyS3Key),
      },
      {
        key: 'titleEs',
        label: t('checklist.titleEs', 'Título ES'),
        ok: !!trEs && isNonEmpty(trEs.title),
      },
      {
        key: 'titleEn',
        label: t('checklist.titleEn', 'Título EN'),
        ok: !!trEn && isNonEmpty(trEn.title),
      },
      {
        key: 'seoTitleEs',
        label: t('checklist.seoTitleEs', 'SEO title ES'),
        ok: !!trEs && isNonEmpty(trEs.seoTitle),
      },
      {
        key: 'seoTitleEn',
        label: t('checklist.seoTitleEn', 'SEO title EN'),
        ok: !!trEn && isNonEmpty(trEn.seoTitle),
      },
      {
        key: 'metaDescriptionEs',
        label: t('checklist.metaDescriptionEs', 'Meta description ES'),
        ok: !!trEs && isNonEmpty(trEs.metaDescription),
      },
      {
        key: 'metaDescriptionEn',
        label: t('checklist.metaDescriptionEn', 'Meta description EN'),
        ok: !!trEn && isNonEmpty(trEn.metaDescription),
      },
    ];

    const missingCount = flags.filter((f) => !f.ok).length;
    return {
      items: flags,
      allPassed: missingCount === 0,
      missingCount,
    };
  }, [article, t]);

  // Notificar al padre cuando cambie el estado del checklist.
  useEffect(() => {
    if (typeof onChecklistChange === 'function') {
      onChecklistChange(checks.allPassed);
    }
  }, [checks.allPassed, onChecklistChange]);

  if (!article) return null;

  return (
    <MetaCard>
      <h3 style={{ margin: '0 0 4px 0' }}>
        {t('checklist.title', 'Listo para enviar a revisión')}
      </h3>
      <p style={{ margin: '0 0 12px 0', fontSize: 12, color: '#475569' }}>
        {t('checklist.subtitle',
          'El backend exige que todos estos campos estén presentes antes de transitar DRAFT → IN_REVIEW.')}
      </p>

      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {checks.items.map((item) => (
          <li
            key={item.key}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '4px 0',
              fontSize: 13,
              color: item.ok ? '#15803d' : '#b91c1c',
            }}
          >
            <span style={{
              display: 'inline-block',
              width: 18,
              fontWeight: 700,
            }}>{item.ok ? '✓' : '✗'}</span>
            <span>{item.label}</span>
          </li>
        ))}
      </ul>

      <div
        style={{
          marginTop: 12,
          padding: '8px 12px',
          borderRadius: 6,
          fontSize: 13,
          background: checks.allPassed ? '#dcfce7' : '#fef3c7',
          color: checks.allPassed ? '#166534' : '#92400e',
        }}
      >
        {checks.allPassed
          ? t('checklist.allReady', 'Todos los campos completos. Puedes enviar a revisión.')
          : t('checklist.someMissing',
              'Faltan {{count}} campo(s) por completar antes de enviar a revisión.',
              { count: checks.missingCount })}
      </div>
    </MetaCard>
  );
};

export default ReviewChecklist;
