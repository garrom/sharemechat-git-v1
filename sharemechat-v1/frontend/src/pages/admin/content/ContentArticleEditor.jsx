// src/pages/admin/content/ContentArticleEditor.jsx
//
// Editor del articulo logico bilingue (paquete 6, ADR-025).
//
// Cambios respecto al modelo viejo (paquete 0):
//
//  Metadata compartida (top del editor):
//   - Eliminados los campos "Título" y "Locale". El titulo es per-locale;
//     el locale del articulo se hardcodea a "es" al crear.
//   - Conservados: heroImageUrl, category, keywords, brief,
//     responsibleEditorUserId.
//   - PATCH /api/admin/content/articles/{id} con esos 5 campos compartidos.
//
//  Contenido por idioma (BodyLocaleTabs):
//   - Selector ES|EN encima del editor del body.
//   - En cada pestaña: inputs editables para title, slug, seoTitle,
//     metaDescription (paquete 6.5 PATCH /translations/{locale}) +
//     textarea del body (PUT /translations/{locale}/body).
//   - Si la traduccion no existe (caso EN antes de apply-bilingual),
//     estado vacio con mensaje claro.
//
//  Checklist preventivo (ReviewChecklist):
//   - Solo visible en DRAFT. Lista de invariantes para IN_REVIEW.
//   - El boton "Enviar a revisión" queda deshabilitado hasta que todos
//     los checks estén en verde.
//
//  Modal de preview:
//   - Selector ES|EN dentro del modal usando BodyLocaleTabs en modo
//     `preview`.
//   - GET /api/admin/content/articles/{id}/translations/{locale}/preview
//     (antes era `/preview` sin locale).
//
//  AIPanel:
//   - Componente reescrito en otro fichero. Se le pasa `onBilingualApplied`
//     para que recargue el detalle del articulo tras un apply exitoso.
//
//  i18n preventiva con namespace `cms` en todo el componente.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { apiFetch } from '../../../config/http';
import { useSession } from '../../../components/SessionProvider';
import { isBackofficeAdmin } from '../../../utils/backofficeAccess';
import {
  Badge,
  NoteCard,
  StyledButton,
  StyledError,
  StyledInput,
} from '../../../styles/AdminStyles';
import {
  BriefArea,
  DangerButton,
  EditorLayout,
  EditorRow,
  HashCode,
  HelperText,
  LabelText,
  MetaCard,
  OkBanner,
  PreviewBadge,
  PreviewHeaderBar,
  PreviewOverlay,
  PreviewSheet,
  ReadOnlyNotice,
  StatusInline,
  ToolbarRow,
  TransitionBar,
  TransitionButton,
  TransitionLabel,
} from '../../../styles/pages-styles/AdminContentStyles';
import ContentArticleHistory from './ContentArticleHistory';
import ContentArticleAIPanel from './ContentArticleAIPanel';
import BodyLocaleTabs from './components/BodyLocaleTabs';
import ReviewChecklist from './components/ReviewChecklist';

// ADR-016: terminales bloquean edicion incluso para ADMIN.
const TERMINAL_STATES = new Set(['PUBLISHED', 'RETRACTED']);

const fmtDate = (v) => {
  if (!v) return '';
  try {
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString();
  } catch {
    return '';
  }
};

// Definiciones de las transiciones disponibles por estado origen.
// El componente itera estas para renderizar la barra de transiciones.
// Las labels y prompts se resuelven via t(); el `tone` controla el color.
const buildTransitionsConfig = (t) => ({
  DRAFT: [
    {
      to: 'IN_REVIEW',
      label: t('transitions.toInReview', 'Enviar a revisión'),
      tone: 'success',
      input: null,
      requiresChecklist: true,
    },
  ],
  IN_REVIEW: [
    {
      to: 'DRAFT',
      label: t('transitions.toDraft', 'Devolver a borrador'),
      tone: 'default',
      input: { name: 'reason', required: false, prompt: t('transitions.reasonPrompt', 'Razón (opcional):') },
    },
    {
      to: 'PUBLISHED',
      label: t('transitions.toPublished', 'Publicar'),
      tone: 'success',
      input: { name: 'comment', required: false, prompt: t('transitions.commentPublishPrompt', 'Comentario de publicación (opcional):') },
    },
  ],
  PUBLISHED: [
    {
      to: 'RETRACTED',
      label: t('transitions.toRetracted', 'Retractar'),
      tone: 'danger',
      confirmRequired: true,
      confirmText: t('transitions.retractConfirm',
        '¿Retirar este artículo? Devolverá 410 Gone a los visitantes y desaparecerá del sitemap. La operación no es reversible desde la UI.'),
      input: { name: 'reason', required: false, prompt: t('transitions.reasonRetractPrompt', 'Razón de la retractación (opcional):') },
    },
  ],
  SCHEDULED: [],
  RETRACTED: [],
});

const initialSharedMeta = {
  category: '',
  brief: '',
  keywords: '',
  heroImageUrl: '',
  responsibleEditorUserId: '',
};

const initialCreateMeta = {
  slug: '',
  title: '',
};

const emptySeoDraft = { title: '', slug: '', seoTitle: '', metaDescription: '' };

const ContentArticleEditor = ({ articleId, onBack }) => {
  const { t } = useTranslation('cms');
  const isNew = articleId == null;
  const { user } = useSession();
  const isAdmin = isBackofficeAdmin(user);

  // ============================================================
  // Estado del articulo cargado del backend
  // ============================================================
  const [article, setArticle] = useState(null); // ArticleDetailDTO completo
  const [currentId, setCurrentId] = useState(articleId);
  const [state, setState] = useState(isNew ? null : 'DRAFT');

  // Metadata compartida en edicion (5 campos)
  const [sharedMeta, setSharedMeta] = useState(initialSharedMeta);
  // Campos extra solo en flujo de creacion (slug ES + title ES iniciales)
  const [createMeta, setCreateMeta] = useState(initialCreateMeta);

  // ============================================================
  // Estado del editor por locale (BodyLocaleTabs en modo editable)
  // ============================================================
  const [activeBodyLocale, setActiveBodyLocale] = useState('es');
  const [body, setBody] = useState('');
  const [bodyDirty, setBodyDirty] = useState(false);
  const [bodyMissing, setBodyMissing] = useState(false); // 404 al fetch body
  const [seoDraft, setSeoDraft] = useState(emptySeoDraft);
  const [seoDirty, setSeoDirty] = useState(false);

  // ============================================================
  // Flags transversales
  // ============================================================
  const [loading, setLoading] = useState(false);
  const [savingMeta, setSavingMeta] = useState(false);
  const [savingSeo, setSavingSeo] = useState(false);
  const [savingBody, setSavingBody] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const [historyTick, setHistoryTick] = useState(0);
  const [error, setError] = useState('');
  const [okMessage, setOkMessage] = useState('');
  const [bodyError, setBodyError] = useState('');
  const [seoError, setSeoError] = useState('');
  const [checklistAllPassed, setChecklistAllPassed] = useState(false);

  // ============================================================
  // Preview modal
  // ============================================================
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLocale, setPreviewLocale] = useState('es');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewArticle, setPreviewArticle] = useState(null);
  const [previewError, setPreviewError] = useState('');

  const stateIsTerminal = state ? TERMINAL_STATES.has(state) : false;
  // Bloqueo de edicion. Mismo criterio que paquete 0:
  //   - terminales: bloquean siempre (ADMIN no bypassa).
  //   - IN_REVIEW: solo ADMIN puede editar; el resto solo en DRAFT.
  const fieldsLocked = !!currentId
    && (stateIsTerminal
        || (state && state !== 'DRAFT' && !isAdmin));

  const transitionsConfig = useMemo(() => buildTransitionsConfig(t), [t]);
  const availableTransitions = state ? (transitionsConfig[state] || []) : [];

  // ============================================================
  // Helpers
  // ============================================================
  const updateShared = (key, value) =>
    setSharedMeta((prev) => ({ ...prev, [key]: value }));
  const updateCreate = (key, value) =>
    setCreateMeta((prev) => ({ ...prev, [key]: value }));

  const findTranslation = (art, locale) => {
    if (!art || !Array.isArray(art.translations)) return null;
    return art.translations.find((tr) => tr && tr.locale === locale) || null;
  };

  const applyArticle = useCallback((dto) => {
    setArticle(dto);
    setCurrentId(dto.id);
    setState(dto.state || 'DRAFT');
    setSharedMeta({
      category: dto.category || '',
      brief: dto.brief || '',
      keywords: dto.keywords || '',
      heroImageUrl: dto.heroImageUrl || '',
      responsibleEditorUserId: dto.responsibleEditorUserId
        ? String(dto.responsibleEditorUserId)
        : '',
    });
  }, []);

  const loadArticle = useCallback(async (id) => {
    setLoading(true);
    setError('');
    setOkMessage('');
    try {
      const detail = await apiFetch(`/admin/content/articles/${id}`);
      applyArticle(detail);
    } catch (e) {
      setError(e?.message || t('editor.errLoad', 'Error cargando artículo'));
    } finally {
      setLoading(false);
    }
  }, [applyArticle, t]);

  // Cargar body de la traduccion activa. Si 404 -> estado "missing".
  const loadActiveBody = useCallback(async (id, locale, art) => {
    setBodyError('');
    setBody('');
    setBodyDirty(false);
    setBodyMissing(false);

    // Rellenar el draft SEO desde la translation activa (si existe).
    const tr = findTranslation(art, locale);
    if (tr) {
      setSeoDraft({
        title: tr.title || '',
        slug: tr.slug || '',
        seoTitle: tr.seoTitle || '',
        metaDescription: tr.metaDescription || '',
      });
      setSeoDirty(false);
    } else {
      setSeoDraft(emptySeoDraft);
      setSeoDirty(false);
    }

    // Fetch body markdown. 404 => translation aun no existe.
    try {
      const md = await apiFetch(`/admin/content/articles/${id}/translations/${locale}/body`);
      setBody(typeof md === 'string' ? md : '');
    } catch (e) {
      // apiFetch lanza error con .status segun convencion del proyecto.
      if (e && e.status === 404) {
        setBodyMissing(true);
        setBody('');
      } else {
        setBodyError(e?.message || t('editor.errLoadBody', 'No se pudo cargar el cuerpo'));
      }
    }
  }, [t]);

  useEffect(() => {
    if (!isNew && articleId) {
      loadArticle(articleId);
    }
  }, [articleId, isNew, loadArticle]);

  // Cuando cambia el articulo cargado o el locale activo, recargamos body+seo.
  useEffect(() => {
    if (currentId && article) {
      loadActiveBody(currentId, activeBodyLocale, article);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentId, activeBodyLocale, article]);

  // ============================================================
  // Cambio de pestana ES|EN con guard de cambios sin guardar
  // ============================================================
  const handleLocaleChange = (newLocale) => {
    if (newLocale === activeBodyLocale) return;
    if (bodyDirty || seoDirty) {
      const localeLabel = activeBodyLocale === 'es' ? 'ES' : 'EN';
      // eslint-disable-next-line no-alert
      const ok = window.confirm(
        t('editor.unsavedConfirm',
          'Tienes cambios sin guardar en {{locale}}. ¿Descartar?',
          { locale: localeLabel }));
      if (!ok) return;
    }
    setActiveBodyLocale(newLocale);
  };

  // ============================================================
  // Acciones: crear
  // ============================================================
  const handleCreate = async () => {
    setSavingMeta(true);
    setError('');
    setOkMessage('');
    try {
      const created = await apiFetch('/admin/content/articles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: createMeta.slug,
          // Paquete 6: locale hardcoded en frontend; el backend (paquete 2)
          // rechaza con 400 cualquier otro valor en createArticle.
          locale: 'es',
          title: createMeta.title,
          brief: sharedMeta.brief || null,
          category: sharedMeta.category || null,
          keywords: sharedMeta.keywords || null,
          heroImageUrl: sharedMeta.heroImageUrl || null,
          responsibleEditorUserId: sharedMeta.responsibleEditorUserId
            ? Number(sharedMeta.responsibleEditorUserId) || null
            : null,
        }),
      });
      applyArticle(created);
      setOkMessage(t('editor.msgArticleCreated',
        'Artículo creado. Continúa rellenando los campos lingüísticos y el body en las pestañas ES/EN.'));
    } catch (e) {
      setError(e?.message || t('editor.errCreate', 'No se pudo crear el artículo'));
    } finally {
      setSavingMeta(false);
    }
  };

  // ============================================================
  // Acciones: PATCH metadata compartida
  // ============================================================
  const handleSaveSharedMeta = async () => {
    if (!currentId) return;
    setSavingMeta(true);
    setError('');
    setOkMessage('');
    try {
      const updated = await apiFetch(`/admin/content/articles/${currentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brief: sharedMeta.brief,
          category: sharedMeta.category,
          keywords: sharedMeta.keywords,
          heroImageUrl: sharedMeta.heroImageUrl,
          responsibleEditorUserId: sharedMeta.responsibleEditorUserId
            ? Number(sharedMeta.responsibleEditorUserId) || null
            : null,
        }),
      });
      applyArticle(updated);
      setOkMessage(t('editor.msgMetadataSaved', 'Metadata guardada.'));
    } catch (e) {
      setError(e?.message || t('editor.errSaveMetadata', 'No se pudo guardar la metadata'));
    } finally {
      setSavingMeta(false);
    }
  };

  // ============================================================
  // Acciones: PATCH per-locale (paquete 6.5)
  // ============================================================
  const handleSaveSeo = async () => {
    if (!currentId) return;
    setSavingSeo(true);
    setSeoError('');
    setOkMessage('');
    try {
      // Solo enviamos los campos que difieren del valor actual; el resto
      // null. El backend ignora null = no cambiar.
      const tr = findTranslation(article, activeBodyLocale);
      const payload = {};
      if ((seoDraft.title || '') !== (tr?.title || '')) payload.title = seoDraft.title || null;
      if ((seoDraft.slug || '') !== (tr?.slug || '')) payload.slug = seoDraft.slug || null;
      if ((seoDraft.seoTitle || '') !== (tr?.seoTitle || '')) payload.seoTitle = seoDraft.seoTitle || null;
      if ((seoDraft.metaDescription || '') !== (tr?.metaDescription || '')) {
        payload.metaDescription = seoDraft.metaDescription || null;
      }
      const result = await apiFetch(
        `/admin/content/articles/${currentId}/translations/${activeBodyLocale}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      );
      // result es TranslationDetailDTO. Refrescamos el articulo completo
      // para que el checklist y el resto de la UI reflejen el cambio.
      void result;
      await loadArticle(currentId);
      setSeoDirty(false);
      setOkMessage(t('editor.msgSeoSaved', 'Campos SEO guardados.'));
    } catch (e) {
      setSeoError(e?.message || t('editor.errSaveSeo', 'No se pudieron guardar los campos SEO'));
    } finally {
      setSavingSeo(false);
    }
  };

  // ============================================================
  // Acciones: PUT body per-locale
  // ============================================================
  const handleSaveBody = async () => {
    if (!currentId) return;
    setSavingBody(true);
    setBodyError('');
    setOkMessage('');
    try {
      const result = await apiFetch(
        `/admin/content/articles/${currentId}/translations/${activeBodyLocale}/body`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'text/plain' },
          body,
        }
      );
      const bytes = result?.byteSize ?? '?';
      setBodyDirty(false);
      setBodyMissing(false);
      // Recargar articulo para refrescar bodyS3Key/bodyContentHash en
      // translations -> permite que el checklist marque body presente.
      await loadArticle(currentId);
      setOkMessage(t('editor.msgBodySaved', 'Cuerpo guardado ({{bytes}} bytes).', { bytes }));
    } catch (e) {
      setBodyError(e?.message || t('editor.errSaveBody', 'No se pudo guardar el cuerpo'));
    } finally {
      setSavingBody(false);
    }
  };

  // ============================================================
  // Acciones: preview
  // ============================================================
  const handleOpenPreview = async () => {
    if (!currentId) return;
    setPreviewOpen(true);
    setPreviewLocale(activeBodyLocale);
    await loadPreview(activeBodyLocale);
  };

  const loadPreview = async (locale) => {
    setPreviewLoading(true);
    setPreviewError('');
    setPreviewArticle(null);
    try {
      const data = await apiFetch(
        `/admin/content/articles/${currentId}/translations/${locale}/preview`
      );
      setPreviewArticle(data);
    } catch (e) {
      setPreviewError(e?.message || t('preview.errLoad', 'No se pudo cargar la vista previa'));
    } finally {
      setPreviewLoading(false);
    }
  };

  const handlePreviewLocaleChange = (newLocale) => {
    setPreviewLocale(newLocale);
    loadPreview(newLocale);
  };

  const handleClosePreview = () => {
    setPreviewOpen(false);
    setPreviewArticle(null);
    setPreviewError('');
  };

  // ============================================================
  // Acciones: delete
  // ============================================================
  const handleDelete = async () => {
    if (!currentId) return;
    // eslint-disable-next-line no-alert
    if (!window.confirm(t('editor.deleteConfirm',
        '¿Borrar artículo? Solo se permite si está en estado DRAFT.'))) return;
    setDeleting(true);
    setError('');
    setOkMessage('');
    try {
      await apiFetch(`/admin/content/articles/${currentId}`, { method: 'DELETE' });
      onBack();
    } catch (e) {
      setError(e?.message || t('editor.errDelete', 'No se pudo borrar el artículo'));
      setDeleting(false);
    }
  };

  // ============================================================
  // Acciones: transition
  // ============================================================
  const handleTransition = async (transition) => {
    if (!currentId || transitioning) return;
    if (transition.requiresChecklist && !checklistAllPassed) {
      setError(t('transitions.blockedByChecklist',
        'El checklist preventivo bloquea el envío a revisión: completa todos los campos para habilitar el botón.'));
      return;
    }
    if (transition.confirmRequired) {
      const confirmText = transition.confirmText
        || `¿Confirmar la transición a ${transition.to}? La operación no es reversible desde la UI.`;
      // eslint-disable-next-line no-alert
      if (!window.confirm(confirmText)) return;
    }
    let comment = null;
    let reason = null;
    if (transition.input) {
      // eslint-disable-next-line no-alert
      const value = window.prompt(transition.input.prompt, '');
      if (value === null) return;
      const trimmed = (value || '').trim();
      if (transition.input.required && !trimmed) {
        setError(`${transition.input.name} required for "${transition.label}".`);
        return;
      }
      if (transition.input.name === 'comment') comment = trimmed || null;
      if (transition.input.name === 'reason') reason = trimmed || null;
    }
    setTransitioning(true);
    setError('');
    setOkMessage('');
    try {
      const updated = await apiFetch(
        `/admin/content/articles/${currentId}/transition`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            toState: transition.to,
            comment,
            reason,
          }),
        }
      );
      applyArticle(updated);
      setOkMessage(t('transitions.stateOk', 'Estado actualizado a {{state}}.',
          { state: updated?.state || transition.to }));
      setHistoryTick((tick) => tick + 1);
    } catch (e) {
      setError(e?.message || t('transitions.errTransition', 'No se pudo aplicar la transición'));
    } finally {
      setTransitioning(false);
    }
  };

  // ============================================================
  // Render
  // ============================================================
  const canSubmitCreate = isNew && !currentId;
  const canDelete = !!currentId && state === 'DRAFT';
  const isDraft = state === 'DRAFT';
  const activeTranslation = findTranslation(article, activeBodyLocale);
  const currentVersionId = article?.currentVersionId || null;
  const bodyContentHash = activeTranslation?.bodyContentHash || '';

  // Wrappers que marcan dirty cuando el operador edita.
  const handleBodyChange = (v) => {
    setBody(v);
    setBodyDirty(true);
  };
  const handleSeoDraftChange = (next) => {
    setSeoDraft(next);
    setSeoDirty(true);
  };

  return (
    <EditorLayout>
      <StatusInline>
        <StyledButton type="button" onClick={onBack}>
          {t('editor.back', '← Volver al listado')}
        </StyledButton>
        {currentId ? (
          <>
            <span>{t('editor.idLabel', 'ID:')} <strong>{currentId}</strong></span>
            <span>{t('editor.stateLabel', 'Estado:')} <Badge>{state || '-'}</Badge></span>
            {currentVersionId ? (
              <span>{t('editor.versionIdLabel', 'versionId:')} <strong>{currentVersionId}</strong></span>
            ) : null}
            {bodyContentHash ? (
              <span>{t('editor.bodyHashLabel', 'hash cuerpo:')} <HashCode>{bodyContentHash}</HashCode></span>
            ) : null}
            {isAdmin ? <span>{t('editor.adminMode', '(modo ADMIN)')}</span> : null}
            <StyledButton type="button" onClick={handleOpenPreview}>
              {t('editor.btnPreview', 'Vista previa')}
            </StyledButton>
          </>
        ) : (
          <span>{t('editor.creating', 'Creando nuevo artículo')}</span>
        )}
      </StatusInline>

      {currentId && availableTransitions.length > 0 ? (
        <TransitionBar>
          <TransitionLabel>{t('transitions.barLabel', 'Acciones disponibles')}</TransitionLabel>
          {availableTransitions.map((tr) => {
            const isBlocked = tr.requiresChecklist && !checklistAllPassed;
            return (
              <TransitionButton
                key={tr.to}
                type="button"
                $tone={tr.tone}
                disabled={transitioning || isBlocked}
                onClick={() => handleTransition(tr)}
                title={isBlocked
                  ? t('transitions.blockedByChecklist',
                      'El checklist preventivo bloquea el envío a revisión: completa todos los campos para habilitar el botón.')
                  : undefined}
              >
                {transitioning ? t('transitions.inProgress', '...') : tr.label}
              </TransitionButton>
            );
          })}
        </TransitionBar>
      ) : null}

      {currentId && fieldsLocked ? (
        <ReadOnlyNotice>
          {t('editor.lockedNotice',
            'Edición bloqueada en estado {{state}}. Para modificar metadata o cuerpo, primero reabre como borrador.',
            { state })}
        </ReadOnlyNotice>
      ) : null}

      {error ? <StyledError>{error}</StyledError> : null}
      {okMessage ? <OkBanner>{okMessage}</OkBanner> : null}
      {loading ? <NoteCard>{t('editor.loading', 'Cargando artículo...')}</NoteCard> : null}

      {/* Checklist preventivo: solo en DRAFT */}
      {currentId && isDraft && article ? (
        <ReviewChecklist
          article={article}
          onChecklistChange={setChecklistAllPassed}
        />
      ) : null}

      {/* Metadata compartida */}
      <MetaCard>
        <h3 style={{ margin: '0 0 12px 0' }}>{t('editor.metadataTitle', 'Metadata compartida')}</h3>

        {/* Campos solo de creacion (slug ES + title ES iniciales). Ocultos
            tras crear el articulo. */}
        {canSubmitCreate ? (
          <>
            <EditorRow $cols={2}>
              <div>
                <LabelText>{t('editor.fieldInitialSlug', 'Slug inicial (ES)')}</LabelText>
                <StyledInput
                  type="text"
                  value={createMeta.slug}
                  onChange={(e) => updateCreate('slug', e.target.value)}
                  placeholder={t('editor.fieldInitialSlugPlaceholder', 'mi-articulo-en-slug-kebab-case')}
                />
              </div>
              <div>
                <LabelText>{t('editor.fieldInitialTitle', 'Título inicial (ES)')}</LabelText>
                <StyledInput
                  type="text"
                  value={createMeta.title}
                  onChange={(e) => updateCreate('title', e.target.value)}
                  placeholder={t('editor.fieldInitialTitlePlaceholder', 'Título del artículo en español')}
                />
              </div>
            </EditorRow>
            <HelperText>
              {t('editor.creationHelper',
                'El artículo se crea siempre en ES. La traducción EN se genera desde el panel IA después.')}
            </HelperText>
          </>
        ) : null}

        <EditorRow $cols={2}>
          <div>
            <LabelText>{t('editor.fieldCategory', 'Categoría')}</LabelText>
            <StyledInput
              type="text"
              value={sharedMeta.category}
              disabled={fieldsLocked}
              onChange={(e) => updateShared('category', e.target.value)}
              placeholder={t('editor.fieldCategoryPlaceholder', 'ej: producto, modelos, seguridad')}
            />
          </div>
          <div>
            <LabelText>{t('editor.fieldKeywords', 'Keywords')}</LabelText>
            <StyledInput
              type="text"
              value={sharedMeta.keywords}
              disabled={fieldsLocked}
              onChange={(e) => updateShared('keywords', e.target.value)}
              placeholder={t('editor.fieldKeywordsPlaceholder', 'ej: chat, video, modelo')}
            />
          </div>
        </EditorRow>

        <EditorRow $cols={1}>
          <div>
            <LabelText>{t('editor.fieldBrief', 'Brief')}</LabelText>
            <BriefArea
              rows={4}
              value={sharedMeta.brief}
              disabled={fieldsLocked}
              onChange={(e) => updateShared('brief', e.target.value)}
              placeholder={t('editor.fieldBriefPlaceholder', 'Resumen interno del artículo')}
            />
          </div>
        </EditorRow>

        <EditorRow $cols={1}>
          <div>
            <LabelText>{t('editor.fieldHero', 'Hero image URL')}</LabelText>
            <StyledInput
              type="url"
              value={sharedMeta.heroImageUrl}
              disabled={fieldsLocked}
              onChange={(e) => updateShared('heroImageUrl', e.target.value)}
              placeholder={t('editor.fieldHeroPlaceholder', 'https://assets.test.sharemechat.com/blog/<slug>.webp')}
            />
            <HelperText>
              {t('editor.fieldHeroHelper',
                'URL absoluta de la imagen (4:3) ya subida al bucket de assets. Obligatoria para enviar a revisión.')}
            </HelperText>
          </div>
        </EditorRow>

        <EditorRow $cols={1}>
          <div>
            <LabelText>{t('editor.fieldResponsibleEditor', 'Editor responsable (userId)')}</LabelText>
            <StyledInput
              type="number"
              value={sharedMeta.responsibleEditorUserId}
              disabled={fieldsLocked}
              onChange={(e) => updateShared('responsibleEditorUserId', e.target.value)}
              placeholder={t('editor.fieldResponsibleEditorPlaceholder',
                'ID numérico del editor humano responsable')}
            />
          </div>
        </EditorRow>

        <ToolbarRow>
          {canSubmitCreate ? (
            <StyledButton type="button" onClick={handleCreate} disabled={savingMeta}>
              {savingMeta
                ? t('editor.btnCreating', 'Creando...')
                : t('editor.btnCreate', 'Crear artículo')}
            </StyledButton>
          ) : (
            <StyledButton
              type="button"
              onClick={handleSaveSharedMeta}
              disabled={savingMeta || !currentId || fieldsLocked}
            >
              {savingMeta
                ? t('editor.btnSavingMetadata', 'Guardando...')
                : t('editor.btnSaveMetadata', 'Guardar metadata')}
            </StyledButton>
          )}
          {canDelete ? (
            <DangerButton type="button" onClick={handleDelete} disabled={deleting}>
              {deleting
                ? t('editor.btnDeleting', 'Borrando...')
                : t('editor.btnDelete', 'Eliminar artículo')}
            </DangerButton>
          ) : null}
        </ToolbarRow>
      </MetaCard>

      {/* Contenido por idioma (BodyLocaleTabs editable) */}
      {currentId ? (
        <MetaCard>
          <h3 style={{ margin: '0 0 12px 0' }}>{t('editor.tabsTitle', 'Contenido por idioma')}</h3>
          <BodyLocaleTabs
            mode="editable"
            availableLocales={['es', 'en']}
            activeLocale={activeBodyLocale}
            onActiveLocaleChange={handleLocaleChange}
            translation={activeTranslation}
            body={body}
            onBodyChange={handleBodyChange}
            seoDraft={seoDraft}
            onSeoFieldsChange={handleSeoDraftChange}
            onSaveSeo={handleSaveSeo}
            onSaveBody={handleSaveBody}
            savingSeo={savingSeo}
            savingBody={savingBody}
            bodyError={bodyError}
            seoError={seoError}
            missingTranslation={bodyMissing}
            disabled={fieldsLocked}
          />
        </MetaCard>
      ) : null}

      {/* AIPanel */}
      {currentId ? (
        <ContentArticleAIPanel
          articleId={currentId}
          articleState={state}
          onBilingualApplied={() => {
            setOkMessage(t('ai.msgApplied',
              'Artículo actualizado con la traducción bilingüe. Revisa las pestañas ES y EN.'));
            loadArticle(currentId);
            setHistoryTick((tick) => tick + 1);
          }}
        />
      ) : null}

      {currentId ? (
        <ContentArticleHistory key={historyTick} articleId={currentId} />
      ) : null}

      {/* Modal preview */}
      {previewOpen ? (
        <PreviewOverlay onClick={handleClosePreview}>
          <PreviewSheet onClick={(e) => e.stopPropagation()}>
            <PreviewHeaderBar>
              <div>
                <PreviewBadge>
                  {t('preview.badge', 'Vista previa privada — no publicada')}
                </PreviewBadge>
              </div>
              <StyledButton type="button" onClick={handleClosePreview}>
                {t('preview.btnClose', 'Cerrar')}
              </StyledButton>
            </PreviewHeaderBar>

            {previewArticle ? (
              <div style={{ padding: '0 12px 12px', fontSize: 13, color: '#475569' }}>
                <strong>{previewArticle.title}</strong>
                {previewArticle.publishedAt
                  ? ` · ${fmtDate(previewArticle.publishedAt)}`
                  : ` · ${t('editor.creating', 'sin publicar (preview)')}`}
              </div>
            ) : null}

            <BodyLocaleTabs
              mode="preview"
              availableLocales={['es', 'en']}
              activeLocale={previewLocale}
              onActiveLocaleChange={handlePreviewLocaleChange}
              content={previewArticle?.htmlBody || ''}
              contentLoading={previewLoading}
              contentError={previewError}
              contentEmptyKey="preview.empty"
            />
          </PreviewSheet>
        </PreviewOverlay>
      ) : null}
    </EditorLayout>
  );
};

export default ContentArticleEditor;
