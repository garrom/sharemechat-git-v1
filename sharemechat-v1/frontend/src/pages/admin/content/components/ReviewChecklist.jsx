// src/pages/admin/content/components/ReviewChecklist.jsx
//
// Checklist preventivo de invariantes necesarias para que el backend acepte
// la transicion DRAFT -> IN_REVIEW (paquete 6 bloque 7, refinado en paquete 7
// bloque 2 a guion progresivo).
//
// Reescritura paquete 7: en lugar de una lista plana con ✓/✗ que pide al
// operador escanear 10 items en paralelo, el componente ahora muestra un
// guion editorial:
//
//   1. PASOS COMPLETADOS (verde, ✓, atenuados): el operador ve lo ya hecho.
//   2. PASO ACTUAL (acento azul, destacado): "este es el siguiente paso".
//      Solo uno a la vez. Mensaje claro de qué hacer.
//   3. PASOS PENDIENTES (gris claro): aparecen pero sin urgencia visual,
//      para que el operador anticipe qué viene despues.
//
// Cuando todos pasan, se muestra el mensaje final "Todo listo. Pulsa
// 'Enviar a revisión' para continuar.".
//
// El contrato hacia el padre no cambia: `onChecklistChange(allPassed)` se
// invoca con el estado agregado y el padre lo usa para habilitar el boton
// "Enviar a revisión" en la barra de transiciones.
//
// Espeja exactamente las verificaciones server-side de
// ContentArticleService.assertReadyForReview.

import React, { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { MetaCard } from '../../../../styles/pages-styles/AdminContentStyles';

const isNonEmpty = (s) => typeof s === 'string' && s.trim().length > 0;

const findTranslation = (article, locale) => {
  if (!article || !Array.isArray(article.translations)) return null;
  return article.translations.find((t) => t && t.locale === locale) || null;
};

// Orden lógico del flujo editorial. La razón:
//   - Primero metadata compartida (hero + brief): el operador la configura
//     manualmente al crear el articulo, antes de generar IA.
//   - Despues ES completo (cuerpo + SEO): tipicamente lo aporta el JSON
//     bilingue del AIPanel.
//   - Despues EN completo: mismo bloque del JSON bilingue.
//   - Final: todo verde, enviar a revision.
const STEP_ORDER = [
  'hero',
  'brief',
  'bodyEs',
  'titleEs',
  'seoTitleEs',
  'metaDescriptionEs',
  'bodyEn',
  'titleEn',
  'seoTitleEn',
  'metaDescriptionEn',
];

const buildSteps = (article, t) => {
  if (!article) return STEP_ORDER.map((key) => ({ key, label: '', ok: false }));
  const trEs = findTranslation(article, 'es');
  const trEn = findTranslation(article, 'en');

  return [
    {
      key: 'hero',
      label: t('checklist.hero', 'Hero image configurada'),
      hint: t('checklist.hintHero',
        'Sube la imagen 4:3 al bucket de assets y pega la URL en el bloque "Metadata compartida".'),
      ok: isNonEmpty(article.heroImageUrl),
    },
    {
      key: 'brief',
      label: t('checklist.brief', 'Brief presente'),
      hint: t('checklist.hintBrief',
        'Resumen interno del artículo. Se edita en el bloque "Metadata compartida".'),
      ok: isNonEmpty(article.brief),
    },
    {
      key: 'bodyEs',
      label: t('checklist.bodyEs', 'Cuerpo ES presente'),
      hint: t('checklist.hintBodyEs',
        'Pestaña ES: escribe o pega el cuerpo markdown y guarda. Lo más fácil: aplicar JSON bilingüe desde el panel IA.'),
      ok: !!trEs && isNonEmpty(trEs.bodyS3Key),
    },
    {
      key: 'titleEs',
      label: t('checklist.titleEs', 'Título ES'),
      hint: t('checklist.hintTitleEs',
        'Pestaña ES: rellena el campo "Título" y pulsa "Guardar campos SEO".'),
      ok: !!trEs && isNonEmpty(trEs.title),
    },
    {
      key: 'seoTitleEs',
      label: t('checklist.seoTitleEs', 'SEO title ES'),
      hint: t('checklist.hintSeoTitleEs',
        'Pestaña ES: rellena "SEO title" (máximo 60 caracteres) y pulsa "Guardar campos SEO".'),
      ok: !!trEs && isNonEmpty(trEs.seoTitle),
    },
    {
      key: 'metaDescriptionEs',
      label: t('checklist.metaDescriptionEs', 'Meta description ES'),
      hint: t('checklist.hintMetaDescriptionEs',
        'Pestaña ES: rellena "Meta description" (máximo 160 caracteres) y pulsa "Guardar campos SEO".'),
      ok: !!trEs && isNonEmpty(trEs.metaDescription),
    },
    {
      key: 'bodyEn',
      label: t('checklist.bodyEn', 'Cuerpo EN presente'),
      hint: t('checklist.hintBodyEn',
        'Pestaña EN: si no existe, genérala desde el panel IA con un JSON bilingüe, o escribe el cuerpo manualmente y guarda.'),
      ok: !!trEn && isNonEmpty(trEn.bodyS3Key),
    },
    {
      key: 'titleEn',
      label: t('checklist.titleEn', 'Título EN'),
      hint: t('checklist.hintTitleEn',
        'Pestaña EN: rellena "Título" y pulsa "Guardar campos SEO".'),
      ok: !!trEn && isNonEmpty(trEn.title),
    },
    {
      key: 'seoTitleEn',
      label: t('checklist.seoTitleEn', 'SEO title EN'),
      hint: t('checklist.hintSeoTitleEn',
        'Pestaña EN: rellena "SEO title" (máximo 60 caracteres) y pulsa "Guardar campos SEO".'),
      ok: !!trEn && isNonEmpty(trEn.seoTitle),
    },
    {
      key: 'metaDescriptionEn',
      label: t('checklist.metaDescriptionEn', 'Meta description EN'),
      hint: t('checklist.hintMetaDescriptionEn',
        'Pestaña EN: rellena "Meta description" (máximo 160 caracteres) y pulsa "Guardar campos SEO".'),
      ok: !!trEn && isNonEmpty(trEn.metaDescription),
    },
  ];
};

const ReviewChecklist = ({ article, onChecklistChange }) => {
  const { t } = useTranslation('cms');

  const steps = useMemo(() => buildSteps(article, t), [article, t]);

  const allPassed = steps.every((s) => s.ok);
  const currentIndex = allPassed
    ? -1
    : steps.findIndex((s) => !s.ok); // primer paso no completado

  useEffect(() => {
    if (typeof onChecklistChange === 'function') {
      onChecklistChange(allPassed);
    }
  }, [allPassed, onChecklistChange]);

  if (!article) return null;

  return (
    <MetaCard>
      <h3 style={{ margin: '0 0 4px 0' }}>
        {t('checklist.title', 'Listo para enviar a revisión')}
      </h3>
      <p style={{ margin: '0 0 12px 0', fontSize: 12, color: '#475569' }}>
        {t('checklist.subtitleProgressive',
          'Sigue el guion editorial. Cuando todos los pasos estén completados, podrás enviar el artículo a revisión.')}
      </p>

      <ol style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {steps.map((step, idx) => {
          const status = step.ok
            ? 'done'
            : idx === currentIndex
              ? 'current'
              : 'pending';
          const colorByStatus = {
            done: '#94a3b8',     // gris atenuado para "ya hecho"
            current: '#1d4ed8',  // azul de acento para "toca ahora"
            pending: '#cbd5e1',  // gris claro para "vendra despues"
          };
          const iconByStatus = {
            done: '✓',
            current: '▸',
            pending: '○',
          };
          const fontWeightByStatus = {
            done: 400,
            current: 700,
            pending: 400,
          };
          const textDecorationByStatus = {
            done: 'line-through',
            current: 'none',
            pending: 'none',
          };
          return (
            <li
              key={step.key}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 10,
                padding: '6px 0',
                fontSize: 13,
                color: colorByStatus[status],
                fontWeight: fontWeightByStatus[status],
              }}
            >
              <span style={{
                display: 'inline-block',
                width: 18,
                textAlign: 'center',
                fontWeight: 700,
              }}>{iconByStatus[status]}</span>
              <span style={{ flex: 1 }}>
                <span style={{ textDecoration: textDecorationByStatus[status] }}>
                  {step.label}
                </span>
                {status === 'current' ? (
                  <div style={{
                    marginTop: 4,
                    fontSize: 12,
                    fontWeight: 400,
                    color: '#334155',
                  }}>
                    {step.hint}
                  </div>
                ) : null}
              </span>
            </li>
          );
        })}
      </ol>

      <div
        style={{
          marginTop: 12,
          padding: '8px 12px',
          borderRadius: 6,
          fontSize: 13,
          background: allPassed ? '#dcfce7' : '#eff6ff',
          color: allPassed ? '#166534' : '#1e40af',
          fontWeight: allPassed ? 600 : 400,
        }}
      >
        {allPassed
          ? t('checklist.allReadyProgressive',
              "Todo listo. Pulsa 'Enviar a revisión' para continuar.")
          : t('checklist.currentStepHint',
              'Estás en el paso {{step}} de {{total}}.',
              { step: currentIndex + 1, total: steps.length })}
      </div>
    </MetaCard>
  );
};

export default ReviewChecklist;
