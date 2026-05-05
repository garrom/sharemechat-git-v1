// src/pages/admin/content/ContentArticleEditor.jsx
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../../../config/http';
import { useSession } from '../../../components/SessionProvider';
import { isBackofficeAdmin } from '../../../utils/backofficeAccess';
import {
  Badge,
  NoteCard,
  StyledButton,
  StyledError,
  StyledInput,
  StyledSelect,
} from '../../../styles/AdminStyles';
import {
  BriefArea,
  DangerButton,
  EditorLayout,
  EditorRow,
  HashCode,
  HelperText,
  LabelText,
  MarkdownArea,
  MetaCard,
  OkBanner,
  ReadOnlyNotice,
  StatusInline,
  ToolbarRow,
  TransitionBar,
  TransitionButton,
  TransitionLabel,
} from '../../../styles/pages-styles/AdminContentStyles';
import ContentArticleHistory from './ContentArticleHistory';
import ContentArticleAIPanel from './ContentArticleAIPanel';

const EDITABLE_STATES = new Set(['IDEA', 'OUTLINE_READY', 'DRAFT_GENERATED']);

const TRANSITIONS_BY_STATE = {
  IDEA: [
    { to: 'OUTLINE_READY', label: 'Marcar outline listo', tone: 'default', input: null },
    { to: 'DRAFT_GENERATED', label: 'Pasar a borrador', tone: 'default', input: null },
  ],
  OUTLINE_READY: [
    { to: 'DRAFT_GENERATED', label: 'Pasar a borrador', tone: 'default', input: null },
  ],
  DRAFT_GENERATED: [
    { to: 'IN_REVIEW', label: 'Enviar a revisión', tone: 'success', input: null },
  ],
  IN_REVIEW: [
    { to: 'APPROVED', label: 'Aprobar', tone: 'success',
      input: { name: 'comment', required: false, prompt: 'Comentario (opcional):' } },
    { to: 'DRAFT_GENERATED', label: 'Rechazar', tone: 'danger',
      input: { name: 'reason', required: true, prompt: 'Razón del rechazo:' } },
  ],
  APPROVED: [
    { to: 'DRAFT_GENERATED', label: 'Reabrir como borrador', tone: 'default',
      input: { name: 'reason', required: false, prompt: 'Razón (opcional):' } },
  ],
  SCHEDULED: [],
  PUBLISHED: [],
  RETRACTED: [],
};

const initialMeta = {
  slug: '',
  locale: 'es',
  title: '',
  category: '',
  brief: '',
  keywords: '',
};

const BODY_MAX_BYTES_HINT = 204800;

const ContentArticleEditor = ({ articleId, onBack }) => {
  const isNew = articleId == null;
  const { user } = useSession();
  const isAdmin = isBackofficeAdmin(user);

  const [meta, setMeta] = useState(initialMeta);
  const [currentId, setCurrentId] = useState(articleId);
  const [state, setState] = useState(isNew ? null : 'IDEA');
  const [currentVersionId, setCurrentVersionId] = useState(null);
  const [bodyContentHash, setBodyContentHash] = useState('');
  const [body, setBody] = useState('');

  const [loading, setLoading] = useState(false);
  const [savingMeta, setSavingMeta] = useState(false);
  const [savingBody, setSavingBody] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const [historyTick, setHistoryTick] = useState(0);
  const [error, setError] = useState('');
  const [okMessage, setOkMessage] = useState('');

  const stateIsEditable = state ? EDITABLE_STATES.has(state) : true;
  const fieldsLocked = !!currentId && !stateIsEditable && !isAdmin;
  const availableTransitions = useMemo(
    () => (state ? (TRANSITIONS_BY_STATE[state] || []) : []),
    [state]
  );

  const updateMeta = (key, value) =>
    setMeta((prev) => ({ ...prev, [key]: value }));

  const loadAll = useCallback(async (id) => {
    setLoading(true);
    setError('');
    setOkMessage('');
    try {
      const detail = await apiFetch(`/admin/content/articles/${id}`);
      setMeta({
        slug: detail.slug || '',
        locale: detail.locale || 'es',
        title: detail.title || '',
        category: detail.category || '',
        brief: detail.brief || '',
        keywords: detail.keywords || '',
      });
      setCurrentId(detail.id);
      setState(detail.state || 'IDEA');
      setCurrentVersionId(detail.currentVersionId || null);
      setBodyContentHash(detail.bodyContentHash || '');

      const bodyText = await apiFetch(`/admin/content/articles/${id}/body`);
      setBody(typeof bodyText === 'string' ? bodyText : '');
    } catch (e) {
      setError(e?.message || 'Error cargando articulo');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isNew && articleId) {
      loadAll(articleId);
    }
  }, [articleId, isNew, loadAll]);

  const handleCreate = async () => {
    setSavingMeta(true);
    setError('');
    setOkMessage('');
    try {
      const created = await apiFetch('/admin/content/articles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: meta.slug,
          locale: meta.locale,
          title: meta.title,
          brief: meta.brief || null,
          category: meta.category || null,
          keywords: meta.keywords || null,
        }),
      });
      setCurrentId(created.id);
      setState(created.state || 'IDEA');
      setOkMessage('Articulo creado. Ahora puedes editar el cuerpo abajo.');
    } catch (e) {
      setError(e?.message || 'No se pudo crear el articulo');
    } finally {
      setSavingMeta(false);
    }
  };

  const handleSaveMeta = async () => {
    if (!currentId) return;
    setSavingMeta(true);
    setError('');
    setOkMessage('');
    try {
      const updated = await apiFetch(`/admin/content/articles/${currentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: meta.title,
          brief: meta.brief,
          category: meta.category,
          keywords: meta.keywords,
        }),
      });
      if (updated?.state) setState(updated.state);
      setOkMessage('Metadata guardada.');
    } catch (e) {
      setError(e?.message || 'No se pudo guardar la metadata');
    } finally {
      setSavingMeta(false);
    }
  };

  const handleSaveBody = async () => {
    if (!currentId) return;
    setSavingBody(true);
    setError('');
    setOkMessage('');
    try {
      const result = await apiFetch(`/admin/content/articles/${currentId}/body`, {
        method: 'PUT',
        headers: { 'Content-Type': 'text/plain' },
        body,
      });
      if (result?.bodyContentHash) {
        setBodyContentHash(result.bodyContentHash);
      }
      const bytes = result?.byteSize ?? '?';
      setOkMessage(`Cuerpo guardado (${bytes} bytes).`);
    } catch (e) {
      setError(e?.message || 'No se pudo guardar el cuerpo');
    } finally {
      setSavingBody(false);
    }
  };

  const handleDelete = async () => {
    if (!currentId) return;
    if (!window.confirm('Borrar articulo? Solo se permite si esta en estado IDEA.')) return;
    setDeleting(true);
    setError('');
    setOkMessage('');
    try {
      await apiFetch(`/admin/content/articles/${currentId}`, { method: 'DELETE' });
      onBack();
    } catch (e) {
      setError(e?.message || 'No se pudo borrar el articulo');
      setDeleting(false);
    }
  };

  const handleTransition = async (transition) => {
    if (!currentId || transitioning) return;
    let comment = null;
    let reason = null;
    if (transition.input) {
      // eslint-disable-next-line no-alert
      const value = window.prompt(transition.input.prompt, '');
      if (value === null) return; // user cancelled
      const trimmed = (value || '').trim();
      if (transition.input.required && !trimmed) {
        setError(`${transition.input.name} es obligatorio para "${transition.label}".`);
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
      if (updated?.state) setState(updated.state);
      if (updated && Object.prototype.hasOwnProperty.call(updated, 'currentVersionId')) {
        setCurrentVersionId(updated.currentVersionId || null);
      }
      setOkMessage(`Estado actualizado a ${updated?.state || transition.to}.`);
      setHistoryTick((t) => t + 1);
    } catch (e) {
      setError(e?.message || 'No se pudo aplicar la transicion');
    } finally {
      setTransitioning(false);
    }
  };

  const canSubmitMetaCreate = isNew && !currentId;
  const canDelete = !!currentId && state === 'IDEA';
  const slugLocaleLocked = !isNew && !!currentId;
  const bytesUsed = new Blob([body || '']).size;

  return (
    <EditorLayout>
      <StatusInline>
        <StyledButton type="button" onClick={onBack}>
          ← Volver al listado
        </StyledButton>
        {currentId ? (
          <>
            <span>ID: <strong>{currentId}</strong></span>
            <span>Estado: <Badge>{state || '-'}</Badge></span>
            {currentVersionId ? (
              <span>versionId: <strong>{currentVersionId}</strong></span>
            ) : null}
            {bodyContentHash ? (
              <span>hash cuerpo: <HashCode>{bodyContentHash}</HashCode></span>
            ) : null}
            {isAdmin ? <span>(modo ADMIN)</span> : null}
          </>
        ) : (
          <span>Creando nuevo articulo</span>
        )}
      </StatusInline>

      {currentId && availableTransitions.length > 0 ? (
        <TransitionBar>
          <TransitionLabel>Acciones disponibles</TransitionLabel>
          {availableTransitions.map((t) => (
            <TransitionButton
              key={t.to}
              type="button"
              $tone={t.tone}
              disabled={transitioning}
              onClick={() => handleTransition(t)}
            >
              {transitioning ? '...' : t.label}
            </TransitionButton>
          ))}
        </TransitionBar>
      ) : null}

      {currentId && fieldsLocked ? (
        <ReadOnlyNotice>
          Edición bloqueada en estado <strong>{state}</strong>. Para modificar
          metadata o cuerpo, primero reabre como borrador.
        </ReadOnlyNotice>
      ) : null}

      {error ? <StyledError>{error}</StyledError> : null}
      {okMessage ? <OkBanner>{okMessage}</OkBanner> : null}
      {loading ? <NoteCard>Cargando articulo...</NoteCard> : null}

      <MetaCard>
        <h3 style={{ margin: '0 0 12px 0' }}>Metadata</h3>

        <EditorRow $cols={2}>
          <div>
            <LabelText>Slug</LabelText>
            <StyledInput
              type="text"
              value={meta.slug}
              disabled={slugLocaleLocked}
              onChange={(e) => updateMeta('slug', e.target.value)}
              placeholder="mi-articulo-en-slug-kebab-case"
            />
          </div>
          <div>
            <LabelText>Locale</LabelText>
            <StyledSelect
              value={meta.locale}
              disabled={slugLocaleLocked}
              onChange={(e) => updateMeta('locale', e.target.value)}
            >
              <option value="es">es</option>
              <option value="en">en</option>
            </StyledSelect>
          </div>
        </EditorRow>

        <EditorRow $cols={1}>
          <div>
            <LabelText>Titulo</LabelText>
            <StyledInput
              type="text"
              value={meta.title}
              disabled={fieldsLocked}
              onChange={(e) => updateMeta('title', e.target.value)}
              placeholder="Titulo del articulo"
            />
          </div>
        </EditorRow>

        <EditorRow $cols={2}>
          <div>
            <LabelText>Categoria</LabelText>
            <StyledInput
              type="text"
              value={meta.category}
              disabled={fieldsLocked}
              onChange={(e) => updateMeta('category', e.target.value)}
              placeholder="ej: producto, modelos, seguridad"
            />
          </div>
          <div>
            <LabelText>Keywords</LabelText>
            <StyledInput
              type="text"
              value={meta.keywords}
              disabled={fieldsLocked}
              onChange={(e) => updateMeta('keywords', e.target.value)}
              placeholder="ej: chat, video, modelo"
            />
          </div>
        </EditorRow>

        <EditorRow $cols={1}>
          <div>
            <LabelText>Brief</LabelText>
            <BriefArea
              rows={4}
              value={meta.brief}
              disabled={fieldsLocked}
              onChange={(e) => updateMeta('brief', e.target.value)}
              placeholder="Resumen interno del articulo"
            />
          </div>
        </EditorRow>

        <ToolbarRow>
          {canSubmitMetaCreate ? (
            <StyledButton type="button" onClick={handleCreate} disabled={savingMeta}>
              {savingMeta ? 'Creando...' : 'Crear articulo'}
            </StyledButton>
          ) : (
            <StyledButton
              type="button"
              onClick={handleSaveMeta}
              disabled={savingMeta || !currentId || fieldsLocked}
            >
              {savingMeta ? 'Guardando...' : 'Guardar metadata'}
            </StyledButton>
          )}
          {canDelete ? (
            <DangerButton type="button" onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Borrando...' : 'Eliminar articulo'}
            </DangerButton>
          ) : null}
        </ToolbarRow>
      </MetaCard>

      <MetaCard>
        <h3 style={{ margin: '0 0 12px 0' }}>Cuerpo (markdown)</h3>
        {!currentId ? (
          <NoteCard>
            Crea el articulo primero con el boton &quot;Crear articulo&quot;.
            El cuerpo se podra editar despues.
          </NoteCard>
        ) : (
          <>
            <MarkdownArea
              value={body}
              disabled={fieldsLocked}
              onChange={(e) => setBody(e.target.value)}
              placeholder={'# Titulo\n\nEscribe el cuerpo en markdown...'}
            />
            <ToolbarRow>
              <StyledButton
                type="button"
                onClick={handleSaveBody}
                disabled={savingBody || fieldsLocked}
              >
                {savingBody ? 'Guardando...' : 'Guardar cuerpo'}
              </StyledButton>
              <HelperText>
                {bytesUsed} bytes / {BODY_MAX_BYTES_HINT} bytes maximo (configurable backend).
              </HelperText>
            </ToolbarRow>
          </>
        )}
      </MetaCard>

      {currentId ? (
        <ContentArticleAIPanel articleId={currentId} />
      ) : null}

      {currentId ? (
        <ContentArticleHistory key={historyTick} articleId={currentId} />
      ) : null}
    </EditorLayout>
  );
};

export default ContentArticleEditor;
