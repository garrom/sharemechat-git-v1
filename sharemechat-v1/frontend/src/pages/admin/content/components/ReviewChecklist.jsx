// src/pages/admin/content/components/ReviewChecklist.jsx
//
// Guion editorial del flujo CMS (paquete 7.5, ADR-025). Reemplaza al
// checklist plano de invariantes del paquete 7 con un modelo que refleja
// el flujo real del operador en 5 pasos:
//
//   1. Crear artículo.
//   2. Generar artículo completo (run IA + Cowork).
//   3. Validar JSON y revisar vista previa.
//   4. Enviar a revisión.
//   5. Publicar.
//
// El componente sigue calculando internamente los 10 invariantes tecnicos
// del backend (hero, body ES, body EN, title ES, title EN, seo_title ES,
// seo_title EN, meta_description ES, meta_description EN, brief ES) y los
// expone al padre via `onChecklistChange(allChecksPassed: boolean)`. La
// diferencia con el paquete 7 es que esos 10 ya NO se pintan en pantalla;
// solo aparecen como warning en el paso 4 si faltan ("red de seguridad"
// para el operador: el flujo editorial dice 'ya puedes enviar' pero el
// backend exige que esos 10 campos esten presentes).
//
// ADR-027 (10.A.10): brief paso de ser compartido del articulo a ser
// per-locale en la translation. El invariante `briefEs` exige
// `trEs.brief` no vacio. EN puede pasar a IN_REVIEW sin brief (lo dice
// `assertReadyForReview` en backend); no hay invariante `briefEn`.
//
// Casos terminales:
//   - article.state === 'PUBLISHED' con flujo completo: mensaje verde de
//     exito "Artículo publicado. El flujo editorial ha terminado.".
//   - article.state === 'RETRACTED': mensaje neutro "Artículo retractado.
//     Estado terminal." sin listar pasos (no hay nada que hacer).
//
// Heuristica de paso actual (de arriba abajo, primer match gana):
//
//   - article == null              -> paso 1 actual.
//   - article != null Y todas las translations completas
//     (body+title+slug+seoTitle+metaDescription para ES Y EN):
//       - state DRAFT      -> paso 4 actual.
//       - state IN_REVIEW  -> paso 5 actual.
//       - state PUBLISHED  -> todos completados (mensaje exito).
//       - state RETRACTED  -> terminal especial.
//   - article != null pero translations incompletas:
//       - hay run VALIDATED o hay algun body con contenido -> paso 3 actual.
//       - resto -> paso 2 actual.
//
// `runs` es prop opcional. Si no se pasa, la regla "hay run VALIDATED"
// se evalua como false; en ese caso la heuristica usa solo "hay algun
// body con contenido" para decidir entre paso 2 y paso 3. Esto es la
// regla degradada documentada en el prompt del paquete 7.5: en el
// editor padre actual los runs viven encapsulados dentro del AIPanel
// y no se elevan al state del padre, asi que `runs` llega null y la
// heuristica funciona por contenido de translations.

import React, { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { MetaCard } from '../../../../styles/pages-styles/AdminContentStyles';

const isNonEmpty = (s) => typeof s === 'string' && s.trim().length > 0;

const findTranslation = (article, locale) => {
  if (!article || !Array.isArray(article.translations)) return null;
  return article.translations.find((t) => t && t.locale === locale) || null;
};

const isTranslationFullyPopulated = (tr) =>
  !!tr
  && isNonEmpty(tr.bodyS3Key)
  && isNonEmpty(tr.title)
  && isNonEmpty(tr.slug)
  && isNonEmpty(tr.seoTitle)
  && isNonEmpty(tr.metaDescription);

/**
 * Calcula los 10 invariantes tecnicos que el backend exige antes de
 * transitar DRAFT -> IN_REVIEW. Espeja exactamente la logica server-side
 * de ContentArticleService.assertReadyForReview. Se sigue calculando aun
 * cuando no se pintan en pantalla, porque alimentan `allChecksPassed`.
 */
const computeInvariants = (article, t) => {
  if (!article) {
    return [];
  }
  const trEs = findTranslation(article, 'es');
  const trEn = findTranslation(article, 'en');
  return [
    { key: 'hero', label: t('checklist.hero', 'Hero image configurada'),
      ok: isNonEmpty(article.heroImageUrl) },
    { key: 'briefEs', label: t('checklist.briefEs', 'Brief ES presente'),
      ok: !!trEs && isNonEmpty(trEs.brief) },
    { key: 'bodyEs', label: t('checklist.bodyEs', 'Cuerpo ES presente'),
      ok: !!trEs && isNonEmpty(trEs.bodyS3Key) },
    { key: 'bodyEn', label: t('checklist.bodyEn', 'Cuerpo EN presente'),
      ok: !!trEn && isNonEmpty(trEn.bodyS3Key) },
    { key: 'titleEs', label: t('checklist.titleEs', 'Título ES'),
      ok: !!trEs && isNonEmpty(trEs.title) },
    { key: 'titleEn', label: t('checklist.titleEn', 'Título EN'),
      ok: !!trEn && isNonEmpty(trEn.title) },
    { key: 'seoTitleEs', label: t('checklist.seoTitleEs', 'SEO title ES'),
      ok: !!trEs && isNonEmpty(trEs.seoTitle) },
    { key: 'seoTitleEn', label: t('checklist.seoTitleEn', 'SEO title EN'),
      ok: !!trEn && isNonEmpty(trEn.seoTitle) },
    { key: 'metaDescriptionEs',
      label: t('checklist.metaDescriptionEs', 'Meta description ES'),
      ok: !!trEs && isNonEmpty(trEs.metaDescription) },
    { key: 'metaDescriptionEn',
      label: t('checklist.metaDescriptionEn', 'Meta description EN'),
      ok: !!trEn && isNonEmpty(trEn.metaDescription) },
  ];
};

/**
 * Decide el paso editorial actual (indice 0-4) y el estado terminal si
 * aplica. Sigue la heuristica documentada en la cabecera del fichero.
 */
const computeCurrentStep = (article, runs) => {
  if (!article) return { currentIdx: 0, terminal: null };

  if (article.state === 'RETRACTED') {
    return { currentIdx: -1, terminal: 'retracted' };
  }

  const trEs = findTranslation(article, 'es');
  const trEn = findTranslation(article, 'en');
  const allTranslationsFull =
    isTranslationFullyPopulated(trEs) && isTranslationFullyPopulated(trEn);

  if (allTranslationsFull) {
    if (article.state === 'DRAFT') {
      return { currentIdx: 3, terminal: null }; // paso 4
    }
    if (article.state === 'IN_REVIEW') {
      return { currentIdx: 4, terminal: null }; // paso 5
    }
    if (article.state === 'PUBLISHED') {
      return { currentIdx: -1, terminal: 'published' };
    }
  }

  // Articulo creado pero translations incompletas: paso 2 o 3.
  const hasValidatedRun = Array.isArray(runs)
    ? runs.some((r) => r && r.status === 'VALIDATED')
    : false;
  const hasAnyBodyContent =
    (trEs && isNonEmpty(trEs.bodyS3Key))
    || (trEn && isNonEmpty(trEn.bodyS3Key));

  if (hasValidatedRun || hasAnyBodyContent) {
    return { currentIdx: 2, terminal: null }; // paso 3
  }
  return { currentIdx: 1, terminal: null }; // paso 2
};

const ReviewChecklist = ({ article, runs = null, onChecklistChange }) => {
  const { t } = useTranslation('cms');

  // 1. Invariantes tecnicos (solo se usan internamente; alimentan
  //    `allChecksPassed` y el warning del paso 4).
  const invariants = useMemo(() => computeInvariants(article, t), [article, t]);
  const allInvariantsOk = invariants.length > 0 && invariants.every((i) => i.ok);
  const allChecksPassed = allInvariantsOk && article?.state === 'DRAFT';
  const missingInvariants = invariants.filter((i) => !i.ok);

  // 2. Flujo editorial (lo que se pinta en pantalla).
  const { currentIdx, terminal } = useMemo(
    () => computeCurrentStep(article, runs),
    [article, runs]
  );

  // 3. Notificar al padre el flag agregado del backend.
  useEffect(() => {
    if (typeof onChecklistChange === 'function') {
      onChecklistChange(allChecksPassed);
    }
  }, [allChecksPassed, onChecklistChange]);

  // 4. Definicion de los 5 pasos editoriales (i18n preventiva con fallback ES).
  const editorialSteps = useMemo(() => ([
    {
      key: 'create',
      label: t('checklist.step1Label', 'Crear artículo'),
      hint: t('checklist.step1Hint',
        "Rellena slug inicial, título inicial y metadata compartida, luego pulsa 'Crear artículo'."),
    },
    {
      key: 'generate',
      label: t('checklist.step2Label', 'Generar artículo completo con IA'),
      hint: t('checklist.step2Hint',
        "Pulsa 'Generar artículo completo' en el panel Asistente IA, copia el prompt al portapapeles y ejecútalo en Cowork. Espera el JSON bilingüe."),
    },
    {
      key: 'apply',
      label: t('checklist.step3Label', 'Validar JSON y revisar vista previa'),
      hint: t('checklist.step3Hint',
        "Pega el JSON bilingüe en el panel Asistente IA, pulsa 'Validar y aplicar'. Después abre 'Vista previa' para revisar el render."),
    },
    {
      key: 'send',
      label: t('checklist.step4Label', 'Enviar a revisión'),
      hint: t('checklist.step4Hint',
        "Cuando hayas revisado el contenido, pulsa 'Enviar a revisión' arriba para congelar la versión y pasar al flujo de aprobación."),
    },
    {
      key: 'publish',
      label: t('checklist.step5Label', 'Publicar'),
      hint: t('checklist.step5Hint',
        "Pulsa 'Publicar' arriba para hacer visible el artículo en el blog público."),
    },
  ]), [t]);

  // ============================================================
  // Render terminales
  // ============================================================
  if (terminal === 'retracted') {
    return (
      <MetaCard>
        <div style={{
          padding: '12px 16px',
          borderRadius: 6,
          fontSize: 14,
          background: '#f1f5f9',
          color: '#475569',
        }}>
          {t('checklist.terminalRetracted', 'Artículo retractado. Estado terminal.')}
        </div>
      </MetaCard>
    );
  }

  if (terminal === 'published') {
    return (
      <MetaCard>
        <div style={{
          padding: '12px 16px',
          borderRadius: 6,
          fontSize: 14,
          background: '#dcfce7',
          color: '#166534',
          fontWeight: 600,
        }}>
          {t('checklist.terminalPublished',
            'Artículo publicado. El flujo editorial ha terminado.')}
        </div>
      </MetaCard>
    );
  }

  // ============================================================
  // Render guion editorial
  // ============================================================
  return (
    <MetaCard>
      <h3 style={{ margin: '0 0 4px 0' }}>
        {t('checklist.flowTitle', 'Flujo editorial')}
      </h3>
      <p style={{ margin: '0 0 12px 0', fontSize: 12, color: '#475569' }}>
        {t('checklist.flowSubtitle',
          'Sigue los pasos del flujo editorial del CMS. El paso destacado es el siguiente que toca; los pasos completados aparecen atenuados.')}
      </p>

      <ol style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {editorialSteps.map((step, idx) => {
          const status = idx < currentIdx
            ? 'done'
            : idx === currentIdx
              ? 'current'
              : 'pending';
          const colorByStatus = {
            done: '#94a3b8',
            current: '#1d4ed8',
            pending: '#cbd5e1',
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

      {/* Red de seguridad: cuando el operador esta en el paso 4 ("Enviar a
          revisión") pero el backend exige campos que faltan, mostramos un
          warning con la lista. El boton "Enviar a revisión" arriba ya se
          deshabilita via onChecklistChange(false). */}
      {currentIdx === 3 && !allChecksPassed && missingInvariants.length > 0 ? (
        <div
          style={{
            marginTop: 12,
            padding: '8px 12px',
            borderRadius: 6,
            fontSize: 13,
            background: '#fef3c7',
            color: '#92400e',
          }}
        >
          <strong>
            {t('checklist.invariantsWarning',
              'Faltan campos por completar antes de enviar a revisión:')}
          </strong>{' '}
          {missingInvariants.map((i) => i.label).join(', ')}.
        </div>
      ) : null}
    </MetaCard>
  );
};

export default ReviewChecklist;
