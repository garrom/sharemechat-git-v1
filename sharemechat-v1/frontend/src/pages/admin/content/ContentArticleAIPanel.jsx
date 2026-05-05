// src/pages/admin/content/ContentArticleAIPanel.jsx
import React, { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../../../config/http';
import {
  NoteCard,
  StyledButton,
  StyledError,
  StyledInput,
} from '../../../styles/AdminStyles';
import {
  AIPanelColumn,
  AIPanelGrid,
  AIRunTypeBar,
  AIRunTypeButton,
  HashCode,
  HelperText,
  InlineRow,
  MetaCard,
  OkBanner,
  PromptPre,
  RawOutputArea,
  RunListTable,
  RunStatusBadge,
  ToolbarRow,
  ValidationErrorsBox,
} from '../../../styles/pages-styles/AdminContentStyles';

// FULL_ARTICLE primero: flujo principal recomendado (ADR-013).
// Los discretos se mantienen para casos avanzados / debugging.
const RUN_TYPES = ['FULL_ARTICLE', 'RESEARCH', 'OUTLINE', 'DRAFT', 'REVIEW', 'SEO'];

const fmtDate = (v) => {
  if (!v) return '-';
  try {
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return String(v);
    return d.toLocaleString();
  } catch {
    return String(v);
  }
};

const ContentArticleAIPanel = ({ articleId }) => {
  const [runs, setRuns] = useState([]);
  const [activeRun, setActiveRun] = useState(null);
  const [rawOutput, setRawOutput] = useState('');
  const [modelId, setModelId] = useState('');
  const [modelVersion, setModelVersion] = useState('');

  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [copyHint, setCopyHint] = useState('');
  const [error, setError] = useState('');
  const [okMessage, setOkMessage] = useState('');

  const reload = useCallback(async () => {
    if (!articleId) return;
    setLoading(true);
    setError('');
    try {
      const list = await apiFetch(`/admin/content/articles/${articleId}/runs`);
      setRuns(Array.isArray(list) ? list : []);
    } catch (e) {
      setError(e?.message || 'No se pudieron cargar los runs IA');
    } finally {
      setLoading(false);
    }
  }, [articleId]);

  useEffect(() => {
    reload();
  }, [reload]);

  const handleCreateRun = async (runType) => {
    if (!articleId || creating) return;
    setCreating(true);
    setError('');
    setOkMessage('');
    setCopyHint('');
    try {
      const created = await apiFetch(`/admin/content/articles/${articleId}/runs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ runType }),
      });
      setActiveRun(created);
      setRawOutput('');
      setModelId('');
      setModelVersion('');
      setOkMessage(
        `Run ${runType} creado (id=${created?.id}). Copia el prompt, ejecútalo en Claude Cowork y pega el JSON abajo.`
      );
      reload();
    } catch (e) {
      setError(e?.message || 'No se pudo crear el run');
    } finally {
      setCreating(false);
    }
  };

  const handleOpenRun = async (runId) => {
    setError('');
    setOkMessage('');
    setCopyHint('');
    try {
      const detail = await apiFetch(`/admin/content/runs/${runId}`);
      setActiveRun(detail);
      setRawOutput('');
    } catch (e) {
      setError(e?.message || 'No se pudo cargar el run');
    }
  };

  const handleCopyPrompt = async () => {
    if (!activeRun?.prompt) return;
    try {
      await navigator.clipboard.writeText(activeRun.prompt);
      setCopyHint('Prompt copiado al portapapeles.');
      setTimeout(() => setCopyHint(''), 2500);
    } catch {
      setCopyHint('Selecciona el texto manualmente y copia (Ctrl/Cmd+C).');
    }
  };

  const handleSubmitOutput = async () => {
    if (!activeRun?.id || submitting) return;
    if (!modelId.trim()) {
      setError('Declara el modelId exacto que ejecutó (ej. claude-opus-4-5).');
      return;
    }
    if (!rawOutput.trim()) {
      setError('Pega el output JSON antes de validar.');
      return;
    }
    setSubmitting(true);
    setError('');
    setOkMessage('');
    try {
      const updated = await apiFetch(
        `/admin/content/articles/${activeRun.articleId}/runs/${activeRun.id}/output`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            rawOutput,
            modelId: modelId.trim(),
            modelVersion: modelVersion.trim() || null,
          }),
        }
      );
      setActiveRun(updated);
      if (updated?.status === 'VALIDATED') {
        setOkMessage('Output validado y guardado.');
        setRawOutput('');
      } else if (updated?.status === 'REJECTED') {
        setOkMessage('');
        setError(`Output rechazado por validación (${updated?.validationErrors?.length || 0} errores).`);
      } else {
        setOkMessage(`Run en estado ${updated?.status}.`);
      }
      reload();
    } catch (e) {
      setError(e?.message || 'No se pudo enviar el output');
    } finally {
      setSubmitting(false);
    }
  };

  if (!articleId) return null;

  return (
    <MetaCard>
      <ToolbarRow style={{ marginTop: 0, marginBottom: 12 }}>
        <h3 style={{ margin: 0 }}>Asistente IA (Claude Cowork — manual structured)</h3>
        <StyledButton type="button" onClick={reload} disabled={loading}>
          {loading ? 'Recargando...' : 'Recargar'}
        </StyledButton>
      </ToolbarRow>

      <AIRunTypeBar>
        <HelperText>Crear run nuevo:</HelperText>
        {RUN_TYPES.map((rt) => (
          <AIRunTypeButton
            key={rt}
            type="button"
            disabled={creating}
            onClick={() => handleCreateRun(rt)}
          >
            {rt}
          </AIRunTypeButton>
        ))}
      </AIRunTypeBar>

      {error ? <StyledError>{error}</StyledError> : null}
      {okMessage ? <OkBanner>{okMessage}</OkBanner> : null}

      <AIPanelGrid>
        <AIPanelColumn>
          <h4 style={{ marginTop: 0, marginBottom: 10 }}>Runs del artículo</h4>
          {runs.length === 0 ? (
            <NoteCard>Sin runs todavía. Crea uno arriba.</NoteCard>
          ) : (
            <RunListTable>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Tipo</th>
                  <th>Estado</th>
                  <th>Modelo</th>
                  <th>Creado</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((r) => (
                  <tr
                    key={r.id}
                    className={activeRun?.id === r.id ? 'selected' : ''}
                    onClick={() => handleOpenRun(r.id)}
                    style={{ cursor: 'pointer' }}
                  >
                    <td>{r.id}</td>
                    <td><strong>{r.runType || '-'}</strong></td>
                    <td><RunStatusBadge $status={r.status}>{r.status}</RunStatusBadge></td>
                    <td>{r.modelId || <em style={{ color: '#94a3b8' }}>pendiente</em>}</td>
                    <td>{fmtDate(r.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </RunListTable>
          )}
        </AIPanelColumn>

        <AIPanelColumn>
          <h4 style={{ marginTop: 0, marginBottom: 10 }}>Run seleccionado</h4>
          {!activeRun ? (
            <NoteCard>Selecciona un run de la lista o crea uno nuevo.</NoteCard>
          ) : (
            <>
              <InlineRow>
                <span>id <strong>{activeRun.id}</strong></span>
                <span>tipo <strong>{activeRun.runType}</strong></span>
                <RunStatusBadge $status={activeRun.status}>{activeRun.status}</RunStatusBadge>
                {activeRun.modelId ? <span>model {activeRun.modelId}</span> : null}
              </InlineRow>
              {activeRun.promptHash ? (
                <InlineRow>
                  <HelperText>promptHash:</HelperText>
                  <HashCode>{activeRun.promptHash}</HashCode>
                </InlineRow>
              ) : null}
              {activeRun.outputHash ? (
                <InlineRow>
                  <HelperText>outputHash:</HelperText>
                  <HashCode>{activeRun.outputHash}</HashCode>
                </InlineRow>
              ) : null}

              {activeRun.prompt ? (
                <>
                  <InlineRow>
                    <strong style={{ fontSize: 13 }}>Prompt expandido</strong>
                    <StyledButton type="button" onClick={handleCopyPrompt}>
                      Copiar prompt
                    </StyledButton>
                    {copyHint ? <HelperText>{copyHint}</HelperText> : null}
                  </InlineRow>
                  <PromptPre>{activeRun.prompt}</PromptPre>
                </>
              ) : null}

              {activeRun.status === 'PENDING' ? (
                <>
                  <InlineRow>
                    <StyledInput
                      placeholder="modelId (ej. claude-opus-4-5)"
                      value={modelId}
                      onChange={(e) => setModelId(e.target.value)}
                    />
                    <StyledInput
                      placeholder="modelVersion (opcional)"
                      value={modelVersion}
                      onChange={(e) => setModelVersion(e.target.value)}
                    />
                  </InlineRow>
                  <RawOutputArea
                    value={rawOutput}
                    onChange={(e) => setRawOutput(e.target.value)}
                    placeholder='Pega aquí el JSON crudo devuelto por Claude Cowork...'
                  />
                  <ToolbarRow>
                    <StyledButton
                      type="button"
                      onClick={handleSubmitOutput}
                      disabled={submitting}
                    >
                      {submitting ? 'Validando...' : 'Validar y guardar'}
                    </StyledButton>
                    <HelperText>
                      El backend valida el JSON y guarda raw + validated en S3.
                    </HelperText>
                  </ToolbarRow>
                </>
              ) : null}

              {activeRun.status === 'REJECTED'
                && Array.isArray(activeRun.validationErrors)
                && activeRun.validationErrors.length > 0 ? (
                <>
                  <strong style={{ fontSize: 13, display: 'block', margin: '8px 0' }}>
                    Errores de validación
                  </strong>
                  <ValidationErrorsBox>
                    {activeRun.validationErrors.map((er, idx) => (
                      <div key={idx}>
                        <strong>{er.field || 'body'}:</strong> {er.message}
                      </div>
                    ))}
                  </ValidationErrorsBox>
                </>
              ) : null}

              {activeRun.status === 'VALIDATED' ? (
                <NoteCard>
                  Output validado. Guardado canónico en{' '}
                  <code style={{ fontSize: 11 }}>output_validated.json</code>. En Fase 3A
                  el output <strong>no se aplica al artículo</strong>; queda como referencia
                  auditable.
                </NoteCard>
              ) : null}
            </>
          )}
        </AIPanelColumn>
      </AIPanelGrid>
    </MetaCard>
  );
};

export default ContentArticleAIPanel;
