// src/pages/admin/content/ContentArticleEditor.jsx
//
// Editor del articulo logico bilingue (paquete 6, ADR-025; brief reubicado
// per ADR-027 en 10.A.10). Refactor 2C.2 (post 2C.1): la vista "Contenido
// por idioma" pasa de pestañas ES|EN a secciones apiladas (ES arriba, EN
// debajo). Motivacion: bug UX persistente ligado al click de pestaña; se
// retira la superficie que causa friccion. Ver informes
// docs/analysis/2026-07-05-cms-2c1-maintenance-overlay-repro.md y
// docs/analysis/2026-07-05-cms-2c1-en-tab-overlay-diagnosis.md.
//
// Estructura vigente:
//
//  Metadata compartida (top del editor):
//   - Campos: heroImageUrl, category. `brief` es per-locale (ADR-027).
//   - Al crear, `brief` viaja en el payload de creacion y el servicio lo
//     escribe en la translation ES.
//   - PATCH /api/admin/content/articles/{id} con los 2 campos compartidos
//     restantes.
//
//  Contenido por idioma (BodyLocaleSections):
//   - Bloque ES arriba y bloque EN debajo, ambos visibles simultaneamente.
//   - Cada bloque tiene Keywords SEO (Primary + Secondary) + titulo/slug/
//     seoTitle/metaDescription/brief + boton "Guardar campos SEO ({locale})"
//     + editor markdown de cuerpo.
//   - Si la traduccion EN no existe (bodyMissing por 404 del body EN),
//     el bloque EN muestra TranslationBootstrapForm con slug/title
//     pre-rellenados. Al instanciar via POST /translations el bloque pasa
//     al formulario completo.
//
//  Checklist preventivo (ReviewChecklist):
//   - Solo visible en DRAFT. Lista de invariantes para IN_REVIEW.
//   - El boton "Enviar a revisión" queda deshabilitado hasta que todos
//     los checks estén en verde.
//
//  Modal de preview:
//   - Selector ES|EN dentro del modal usando BodyLocaleTabs en modo
//     `preview` (esta vista sigue con tabs porque es de lectura, no de
//     edicion; la fuente del bug no aplica).
//   - GET /api/admin/content/articles/{id}/translations/{locale}/preview.
//
//  AIPanel:
//   - Componente reescrito en otro fichero. Se le pasa `onBilingualApplied`
//     para que recargue el detalle del articulo tras un apply exitoso.

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
import BodyLocaleSections from './components/BodyLocaleSections';
import BodyLocaleTabs from './components/BodyLocaleTabs';
import ReviewChecklist from './components/ReviewChecklist';
import ConfirmModal from './components/ConfirmModal';

// ADR-016: terminales bloquean edicion incluso para ADMIN.
const TERMINAL_STATES = new Set(['PUBLISHED', 'RETRACTED']);

const LOCALES = ['es', 'en'];

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

// Paquete 7 bloque 1: `responsibleEditorUserId` se conserva en BD y DTOs
// (la columna sigue existiendo y aceptando valor desde otras vias) pero
// no se expone como input del editor admin. Cuando se decida
// reintroducirlo, hacerlo como dropdown poblado desde el listado de
// usuarios backoffice via /api/admin/users, no input numerico libre.
// ADR-045 subpasada 2C.1 (D5): retirado `keywords` compartido del state y
// del PATCH de metadata. Las keywords SEO viven ahora per-locale en
// BodyLocaleSections (primary_keyword + secondary_keywords).
const initialSharedMeta = {
  category: '',
  heroImageUrl: '',
};

// brief inicial (ADR-027): se persiste en la translation ES recien creada.
// Para crear se pasa en root del POST; ArticleCreateRequest lo sigue
// aceptando alli y el servicio lo escribe en la translation.
const initialCreateMeta = {
  slug: '',
  title: '',
  brief: '',
};

// ADR-045 subpasada 2C.1: seoDraft gana primaryKeyword y secondaryKeywords.
// - primaryKeyword: string (obligatorio en ES para el gate D3).
// - secondaryKeywords: string coma-separado (backend normaliza en 2A).
const emptySeoDraft = {
  title: '', slug: '', seoTitle: '', metaDescription: '', brief: '',
  primaryKeyword: '', secondaryKeywords: '',
};

const BRIEF_MAX = 8192;

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

  // Metadata compartida en edicion
  const [sharedMeta, setSharedMeta] = useState(initialSharedMeta);
  // Campos extra solo en flujo de creacion (slug ES + title ES iniciales)
  const [createMeta, setCreateMeta] = useState(initialCreateMeta);

  // ============================================================
  // Estado del editor por locale (2C.2: doble state, sin activeLocale)
  // Cada locale tiene: seoDraft + body + errores + dirty flags + missing flag.
  // ============================================================
  const [esSeoDraft, setEsSeoDraft] = useState(emptySeoDraft);
  const [enSeoDraft, setEnSeoDraft] = useState(emptySeoDraft);
  const [esBody, setEsBody] = useState('');
  const [enBody, setEnBody] = useState('');
  const [esBodyMissing, setEsBodyMissing] = useState(false);
  const [enBodyMissing, setEnBodyMissing] = useState(false);
  const [esBodyError, setEsBodyError] = useState('');
  const [enBodyError, setEnBodyError] = useState('');
  const [esSeoError, setEsSeoError] = useState('');
  const [enSeoError, setEnSeoError] = useState('');

  // ============================================================
  // Flags transversales
  // ============================================================
  const [loading, setLoading] = useState(false);
  const [savingMeta, setSavingMeta] = useState(false);
  const [savingEsSeo, setSavingEsSeo] = useState(false);
  const [savingEnSeo, setSavingEnSeo] = useState(false);
  const [savingEsBody, setSavingEsBody] = useState(false);
  const [savingEnBody, setSavingEnBody] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const [historyTick, setHistoryTick] = useState(0);
  const [error, setError] = useState('');
  const [okMessage, setOkMessage] = useState('');
  const [checklistAllPassed, setChecklistAllPassed] = useState(false);

  // ADR-045 subpasada 2C.1: instanciacion de translation nueva via
  // POST /admin/content/articles/{id}/translations (endpoint 2C.0).
  const [creatingTranslation, setCreatingTranslation] = useState(false);
  const [createTranslationError, setCreateTranslationError] = useState('');

  // ============================================================
  // Preview modal (mantiene tabs — es vista de lectura, no de edicion)
  // ============================================================
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLocale, setPreviewLocale] = useState('es');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewArticle, setPreviewArticle] = useState(null);
  const [previewError, setPreviewError] = useState('');

  // ============================================================
  // ConfirmModal: estado generico para los 3 casos que quedan del editor
  // tras 2C.2 (el caso "discardChanges" del cambio de pestaña ya no existe
  // porque ya no hay pestañas de edicion):
  //   - 'deleteArticle': borrar articulo.
  //   - 'transition': transicion destructive (retract) o con razon/comentario.
  // ============================================================
  const [confirmModal, setConfirmModal] = useState(null);
  const closeConfirmModal = () => setConfirmModal(null);

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
      heroImageUrl: dto.heroImageUrl || '',
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

  // ============================================================
  // Carga del seoDraft + body de UN locale a partir del article ya cargado.
  // 2C.2: la llamada anterior "loadActiveBody" queda parametrizada por
  // locale y se llama para ambos ES y EN al cargar el articulo (y tras
  // guardar SEO o body para refrescar el locale afectado).
  // ============================================================
  const loadLocaleData = useCallback(async (id, locale, art) => {
    const setSeoDraft = locale === 'es' ? setEsSeoDraft : setEnSeoDraft;
    const setBody = locale === 'es' ? setEsBody : setEnBody;
    const setBodyMissing = locale === 'es' ? setEsBodyMissing : setEnBodyMissing;
    const setBodyError = locale === 'es' ? setEsBodyError : setEnBodyError;

    setBodyError('');
    setBody('');
    setBodyMissing(false);

    // Rellenar el draft SEO desde la translation activa (si existe). Incluye
    // brief desde ADR-027 y keywords SEO per-locale desde ADR-045 2A/2C.1.
    // secondaryKeywords viene del backend como array; aqui lo convertimos a
    // string coma-separado para el input plano.
    const tr = findTranslation(art, locale);
    if (tr) {
      const secArray = Array.isArray(tr.secondaryKeywords) ? tr.secondaryKeywords : [];
      setSeoDraft({
        title: tr.title || '',
        slug: tr.slug || '',
        seoTitle: tr.seoTitle || '',
        metaDescription: tr.metaDescription || '',
        brief: tr.brief || '',
        primaryKeyword: tr.primaryKeyword || '',
        secondaryKeywords: secArray.join(', '),
      });
    } else {
      setSeoDraft(emptySeoDraft);
      // Fix.A (2026-07-06, informe get-body-html-diagnosis): si la translation
      // no existe (comun en EN antes del bootstrap 2C.0), NO hacer fetch del
      // body. El backend responderia 404 pero la distribucion CloudFront lo
      // convierte a 200+index.html (CustomErrorResponses SPA fallback), lo
      // que confundia a apiFetch y disparaba MaintenanceOverlay ademas de
      // meter HTML como body markdown en el editor.
      setBodyMissing(true);
      return;
    }

    // Fetch body markdown. 404 => body aun no persistido en S3.
    try {
      const md = await apiFetch(`/admin/content/articles/${id}/translations/${locale}/body`);
      // Fix.C (2026-07-06, informe get-body-html-diagnosis): defense-in-depth
      // frente al mismo problema del Fix.A cuando la translation SI existe
      // pero no tiene body S3 todavia (o el objeto S3 fue borrado). En ese
      // caso el backend responde 404, CloudFront lo convierte a 200+index.html
      // y el string devuelto es el HTML del bucket admin. Detectamos ese HTML
      // por su prefijo `<!doctype` (case-insensitive) y lo tratamos como body
      // missing en vez de meterlo literal como markdown en el textarea.
      const md_str = typeof md === 'string' ? md : '';
      if (/^\s*<!doctype\s/i.test(md_str)) {
        setBodyMissing(true);
        setBody('');
      } else {
        setBody(md_str);
      }
    } catch (e) {
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

  // Cuando cambia el articulo cargado, recargamos body+seo de AMBOS locales.
  useEffect(() => {
    if (currentId && article) {
      LOCALES.forEach((loc) => {
        loadLocaleData(currentId, loc, article);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentId, article]);

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
          // ADR-027: brief viaja en el payload de creacion y el servicio lo
          // escribe en la translation ES (no en el articulo padre).
          brief: createMeta.brief || null,
          category: sharedMeta.category || null,
          heroImageUrl: sharedMeta.heroImageUrl || null,
        }),
      });
      applyArticle(created);
      setOkMessage(t('editor.msgArticleCreated',
        'Artículo creado. Continúa rellenando los campos lingüísticos y el body en las secciones ES/EN.'));
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
          category: sharedMeta.category,
          heroImageUrl: sharedMeta.heroImageUrl,
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
  // Acciones: PATCH per-locale (paquete 6.5) — parametrizado por locale.
  // ============================================================
  const buildSeoPayload = (locale) => {
    const seoDraft = locale === 'es' ? esSeoDraft : enSeoDraft;
    const tr = findTranslation(article, locale);
    const currentSecondariesCsv = Array.isArray(tr?.secondaryKeywords)
      ? tr.secondaryKeywords.join(', ')
      : '';
    const payload = {};
    if ((seoDraft.title || '') !== (tr?.title || '')) payload.title = seoDraft.title || null;
    if ((seoDraft.slug || '') !== (tr?.slug || '')) payload.slug = seoDraft.slug || null;
    if ((seoDraft.seoTitle || '') !== (tr?.seoTitle || '')) payload.seoTitle = seoDraft.seoTitle || null;
    if ((seoDraft.metaDescription || '') !== (tr?.metaDescription || '')) {
      payload.metaDescription = seoDraft.metaDescription || null;
    }
    if ((seoDraft.brief || '') !== (tr?.brief || '')) {
      payload.brief = seoDraft.brief || null;
    }
    if ((seoDraft.primaryKeyword || '') !== (tr?.primaryKeyword || '')) {
      payload.primaryKeyword = seoDraft.primaryKeyword && seoDraft.primaryKeyword.trim()
        ? seoDraft.primaryKeyword.trim()
        : null;
    }
    if ((seoDraft.secondaryKeywords || '') !== currentSecondariesCsv) {
      payload.secondaryKeywords = seoDraft.secondaryKeywords || '';
    }
    return payload;
  };

  const handleSaveSeo = async (locale) => {
    if (!currentId) return;
    const setSaving = locale === 'es' ? setSavingEsSeo : setSavingEnSeo;
    const setSeoError = locale === 'es' ? setEsSeoError : setEnSeoError;
    setSaving(true);
    setSeoError('');
    setOkMessage('');
    try {
      const payload = buildSeoPayload(locale);
      await apiFetch(
        `/admin/content/articles/${currentId}/translations/${locale}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      );
      // Refrescamos el articulo completo para que el checklist y el resto
      // de la UI reflejen el cambio en ambos locales.
      await loadArticle(currentId);
      setOkMessage(t('editor.msgSeoSavedLocale',
        'Campos SEO ({{locale}}) guardados.',
        { locale: locale.toUpperCase() }));
    } catch (e) {
      setSeoError(e?.message || t('editor.errSaveSeo', 'No se pudieron guardar los campos SEO'));
    } finally {
      setSaving(false);
    }
  };

  // ============================================================
  // Acciones: PUT body per-locale — parametrizado por locale.
  // ============================================================
  const handleSaveBody = async (locale) => {
    if (!currentId) return;
    const body = locale === 'es' ? esBody : enBody;
    const setSaving = locale === 'es' ? setSavingEsBody : setSavingEnBody;
    const setBodyError = locale === 'es' ? setEsBodyError : setEnBodyError;
    const setBodyMissing = locale === 'es' ? setEsBodyMissing : setEnBodyMissing;
    setSaving(true);
    setBodyError('');
    setOkMessage('');
    try {
      const result = await apiFetch(
        `/admin/content/articles/${currentId}/translations/${locale}/body`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'text/plain' },
          body,
        }
      );
      const bytes = result?.byteSize ?? '?';
      setBodyMissing(false);
      // Recargar articulo para refrescar bodyS3Key/bodyContentHash en
      // translations -> permite que el checklist marque body presente.
      await loadArticle(currentId);
      setOkMessage(t('editor.msgBodySavedLocale',
        'Cuerpo ({{locale}}) guardado ({{bytes}} bytes).',
        { locale: locale.toUpperCase(), bytes }));
    } catch (e) {
      setBodyError(e?.message || t('editor.errSaveBody', 'No se pudo guardar el cuerpo'));
    } finally {
      setSaving(false);
    }
  };

  // ============================================================
  // Acciones: instanciar translation (ADR-045 subpasada 2C.1 + 2C.0)
  // ============================================================
  const handleCreateTranslation = async ({
    locale, slug, title, primaryKeyword, secondaryKeywords,
  }) => {
    if (!currentId) return;
    setCreatingTranslation(true);
    setCreateTranslationError('');
    setError('');
    setOkMessage('');
    try {
      await apiFetch(`/admin/content/articles/${currentId}/translations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          locale,
          slug,
          title,
          primaryKeyword: primaryKeyword || null,
          secondaryKeywords: secondaryKeywords || null,
        }),
      });
      await loadArticle(currentId);
      setOkMessage(t('editor.translationBootstrap.msgCreated',
        'Traducción EN creada. Continúa rellenando los campos SEO y el body.'));
    } catch (e) {
      setCreateTranslationError(
        e?.message || t('editor.translationBootstrap.errCreate',
          'No se pudo instanciar la traducción EN'));
    } finally {
      setCreatingTranslation(false);
    }
  };

  // ============================================================
  // Acciones: preview
  // ============================================================
  const handleOpenPreview = async () => {
    if (!currentId) return;
    setPreviewOpen(true);
    setPreviewLocale('es');
    await loadPreview('es');
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
  const performDelete = async () => {
    if (!currentId) return;
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

  const handleDelete = () => {
    if (!currentId) return;
    // Paquete 7 bloque 4: ConfirmModal en lugar de window.confirm.
    setConfirmModal({
      title: t('confirmModal.deleteTitle', 'Borrar artículo'),
      message: t('editor.deleteConfirm',
        '¿Borrar artículo? Solo se permite si está en estado DRAFT.'),
      confirmLabel: t('confirmModal.btnDelete', 'Borrar'),
      cancelLabel: t('confirmModal.btnCancel', 'Cancelar'),
      tone: 'danger',
      onConfirm: () => {
        closeConfirmModal();
        performDelete();
      },
      onCancel: closeConfirmModal,
    });
  };

  // ============================================================
  // Acciones: transition (idem paquete 7 bloque 4)
  // ============================================================
  const performTransition = async (transition, comment, reason) => {
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

  const askInputThenTransition = (transition) => {
    if (!transition.input) {
      performTransition(transition, null, null);
      return;
    }
    setConfirmModal({
      title: transition.label,
      message: '',
      inputLabel: transition.input.prompt,
      inputPlaceholder: '',
      inputRequired: !!transition.input.required,
      confirmLabel: t('confirmModal.btnContinue', 'Continuar'),
      cancelLabel: t('confirmModal.btnCancel', 'Cancelar'),
      onConfirm: (value) => {
        closeConfirmModal();
        let comment = null;
        let reason = null;
        const trimmed = value ? value.trim() : '';
        if (transition.input.name === 'comment') comment = trimmed || null;
        if (transition.input.name === 'reason') reason = trimmed || null;
        performTransition(transition, comment, reason);
      },
      onCancel: closeConfirmModal,
    });
  };

  const handleTransition = (transition) => {
    if (!currentId || transitioning) return;
    if (transition.requiresChecklist && !checklistAllPassed) {
      setError(t('transitions.blockedByChecklist',
        'El checklist preventivo bloquea el envío a revisión: completa todos los campos para habilitar el botón.'));
      return;
    }
    if (transition.confirmRequired) {
      setConfirmModal({
        title: transition.label,
        message: transition.confirmText
          || t('transitions.confirmGeneric',
              '¿Confirmar la transición a {{to}}? La operación no es reversible desde la UI.',
              { to: transition.to }),
        confirmLabel: transition.label,
        cancelLabel: t('confirmModal.btnCancel', 'Cancelar'),
        tone: transition.tone === 'danger' ? 'danger' : 'default',
        onConfirm: () => {
          closeConfirmModal();
          askInputThenTransition(transition);
        },
        onCancel: closeConfirmModal,
      });
      return;
    }
    askInputThenTransition(transition);
  };

  // ============================================================
  // Render
  // ============================================================
  const canSubmitCreate = isNew && !currentId;
  const canDelete = !!currentId && state === 'DRAFT';
  const isDraft = state === 'DRAFT';
  const currentVersionId = article?.currentVersionId || null;
  const translationEs = findTranslation(article, 'es');
  const translationEn = findTranslation(article, 'en');
  const bodyContentHashEs = translationEs?.bodyContentHash || '';

  // ADR-045 subpasada 2C.1: primary ES presente controla el gate visual
  // del boton "Generar articulo completo" del panel IA. El backend ya lo
  // bloquea con 409 (ContentRunService.assertPrimaryKeywordEsPresent en 2A);
  // el UI lo refleja antes de dejar clicar.
  const primaryEsPresent = !!(translationEs?.primaryKeyword
    && translationEs.primaryKeyword.trim().length > 0);

  // Sugerencias pre-relleno para el form de instanciacion de translation EN
  // (ADR-045 subpasada 2C.1 D-detalle 2C.1-3/4): slug = `${slugEs}-en`,
  // title = titulo ES. El operador puede editarlos antes de crear.
  const suggestedEnSlug = translationEs?.slug ? `${translationEs.slug}-en` : '';
  const suggestedEnTitle = translationEs?.title || '';

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
            {bodyContentHashEs ? (
              <span>{t('editor.bodyHashLabel', 'hash cuerpo:')} <HashCode>{bodyContentHashEs}</HashCode></span>
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

        {/* Campos solo de creacion: slug ES + title ES + brief ES iniciales. */}
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
            <EditorRow $cols={1}>
              <div>
                <LabelText>
                  {t('editor.fieldInitialBrief', 'Brief inicial (ES)')}
                  <span style={{ color: '#b91c1c', marginLeft: 4 }}>*</span>
                </LabelText>
                <BriefArea
                  rows={4}
                  value={createMeta.brief}
                  onChange={(e) => updateCreate('brief', e.target.value)}
                  placeholder={t('editor.fieldInitialBriefPlaceholder',
                    'Texto descriptivo de 1-2 frases visible en cards del blog y cabecera del detalle')}
                />
                <HelperText style={{
                  color: createMeta.brief.length > BRIEF_MAX
                    ? '#b91c1c'
                    : createMeta.brief.length >= 8000
                      ? '#b45309'
                      : '#64748b',
                }}>
                  {t('editor.lengthCounter', '{{used}}/{{max}} caracteres',
                    { used: createMeta.brief.length, max: BRIEF_MAX })}
                </HelperText>
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
            <LabelText>{t('editor.fieldHero', 'Hero image URL')}</LabelText>
            <StyledInput
              type="url"
              value={sharedMeta.heroImageUrl}
              disabled={fieldsLocked}
              onChange={(e) => updateShared('heroImageUrl', e.target.value)}
              placeholder={t('editor.fieldHeroPlaceholder', 'https://assets.sharemechat.com/blog/<slug>.webp')}
            />
            <HelperText>
              {t('editor.fieldHeroHelper',
                'URL absoluta de la imagen (4:3) ya subida al bucket de assets. Obligatoria para enviar a revisión.')}
            </HelperText>
          </div>
        </EditorRow>

        <ToolbarRow>
          {canSubmitCreate ? (
            <StyledButton
              type="button"
              onClick={handleCreate}
              disabled={
                savingMeta
                || !createMeta.slug.trim()
                || !createMeta.title.trim()
                || !createMeta.brief.trim()
                || createMeta.brief.length > BRIEF_MAX
              }
              title={
                !createMeta.brief.trim()
                  ? t('editor.briefRequired',
                      'El brief en ES es obligatorio para enviar a revisión.')
                  : undefined
              }
            >
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

      {/* Contenido por idioma (BodyLocaleSections apilado 2C.2) */}
      {currentId ? (
        <MetaCard>
          <h3 style={{ margin: '0 0 12px 0' }}>{t('editor.sectionsTitle', 'Contenido por idioma (ES + EN)')}</h3>
          <BodyLocaleSections
            // ES
            esTranslation={translationEs}
            esSeoDraft={esSeoDraft}
            onEsSeoFieldsChange={setEsSeoDraft}
            onSaveEsSeo={() => handleSaveSeo('es')}
            savingEsSeo={savingEsSeo}
            esSeoError={esSeoError}
            esBody={esBody}
            onEsBodyChange={setEsBody}
            onSaveEsBody={() => handleSaveBody('es')}
            savingEsBody={savingEsBody}
            esBodyError={esBodyError}
            esBodyMissing={esBodyMissing}
            // EN
            enTranslation={translationEn}
            enSeoDraft={enSeoDraft}
            onEnSeoFieldsChange={setEnSeoDraft}
            onSaveEnSeo={() => handleSaveSeo('en')}
            savingEnSeo={savingEnSeo}
            enSeoError={enSeoError}
            enBody={enBody}
            onEnBodyChange={setEnBody}
            onSaveEnBody={() => handleSaveBody('en')}
            savingEnBody={savingEnBody}
            enBodyError={enBodyError}
            enBodyMissing={enBodyMissing}
            // Bootstrap EN
            onCreateTranslation={handleCreateTranslation}
            suggestedEnSlug={suggestedEnSlug}
            suggestedEnTitle={suggestedEnTitle}
            creatingTranslation={creatingTranslation}
            createTranslationError={createTranslationError}
            disabled={fieldsLocked}
          />
        </MetaCard>
      ) : null}

      {/* AIPanel */}
      {currentId ? (
        <ContentArticleAIPanel
          articleId={currentId}
          articleState={state}
          primaryEsPresent={primaryEsPresent}
          onBilingualApplied={() => {
            setOkMessage(t('ai.msgApplied',
              'Artículo actualizado con la traducción bilingüe. Revisa las secciones ES y EN.'));
            loadArticle(currentId);
            setHistoryTick((tick) => tick + 1);
          }}
        />
      ) : null}

      {currentId ? (
        <ContentArticleHistory key={historyTick} articleId={currentId} />
      ) : null}

      {/* ConfirmModal generico */}
      <ConfirmModal
        isOpen={confirmModal != null}
        title={confirmModal?.title}
        message={confirmModal?.message}
        confirmLabel={confirmModal?.confirmLabel}
        cancelLabel={confirmModal?.cancelLabel}
        tone={confirmModal?.tone || 'default'}
        inputLabel={confirmModal?.inputLabel}
        inputPlaceholder={confirmModal?.inputPlaceholder}
        inputRequired={confirmModal?.inputRequired || false}
        onConfirm={confirmModal?.onConfirm || (() => {})}
        onCancel={confirmModal?.onCancel || closeConfirmModal}
      />

      {/* Modal preview (mantiene tabs — vista de lectura) */}
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

            {article?.heroImageUrl ? (
              <div style={{
                padding: '0 12px 12px',
                display: 'flex',
                justifyContent: 'center',
              }}>
                <img
                  src={article.heroImageUrl}
                  alt={t('preview.heroAlt', 'Hero image del artículo')}
                  loading="lazy"
                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                  style={{
                    maxWidth: '100%',
                    maxHeight: 280,
                    objectFit: 'cover',
                    borderRadius: 8,
                    border: '1px solid #e2e8f0',
                  }}
                />
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
