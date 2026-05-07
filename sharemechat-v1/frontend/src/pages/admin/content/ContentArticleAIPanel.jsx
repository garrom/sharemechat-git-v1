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
  AdvancedRunSection,
  AdvancedToggleButton,
  AdvancedToggleRow,
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

// ADR-014: FULL_ARTICLE_ORCHESTRATED es el flujo principal recomendado, sustituyendo al
// antiguo FULL_ARTICLE (ADR-013, superseded). RESEARCH y REVIEW quedan como herramientas
// avanzadas, ocultas por defecto. OUTLINE / DRAFT / SEO siguen disponibles a nivel backend
// pero NO se ofrecen como botones aqui; los runs historicos de esos tipos (incluido el
// antiguo FULL_ARTICLE) siguen apareciendo en la tabla de runs porque la lista se carga
// desde backend, no del frontend.
const RUN_TYPE_PRIMARY = 'FULL_ARTICLE_ORCHESTRATED';
const RUN_TYPES_ADVANCED = ['RESEARCH', 'REVIEW'];

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

const TERMINAL_STATES_FOR_APPLY = new Set(['PUBLISHED', 'RETRACTED']);

const ContentArticleAIPanel = ({ articleId, articleState, onAiDraftApplied }) => {
  const [runs, setRuns] = useState([]);
  const [activeRun, setActiveRun] = useState(null);
  const [rawOutput, setRawOutput] = useState('');
  const [modelId, setModelId] = useState('');
  const [modelVersion, setModelVersion] = useState('');

  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [applying, setApplying] = useState(false);
  const [copyHint, setCopyHint] = useState('');
  const [error, setError] = useState('');
  const [okMessage, setOkMessage] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  const articleIsTerminal = articleState
    ? TERMINAL_STATES_FOR_APPLY.has(articleState)
    : false;

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

  const handleApplyDraft = async () => {
    if (!activeRun?.id || !activeRun?.articleId || applying) return;
    if (activeRun.status !== 'VALIDATED' || !activeRun.outputValidated) {
      setError('El run debe estar VALIDATED para aplicar.');
      return;
    }
    if (articleIsTerminal) {
      setError(`Artículo en estado ${articleState}. Reabre una nueva versión antes de aplicar contenido.`);
      return;
    }
    setApplying(true);
    setError('');
    setOkMessage('');
    try {
      await apiFetch(
        `/admin/content/articles/${activeRun.articleId}/runs/${activeRun.id}/apply-draft`,
        { method: 'POST' }
      );
      setOkMessage('Draft aplicado al artículo. El cuerpo se ha rellenado.');
      if (typeof onAiDraftApplied === 'function') {
        onAiDraftApplied();
      }
      reload();
    } catch (e) {
      setError(e?.message || 'No se pudo aplicar el draft al artículo');
    } finally {
      setApplying(false);
    }
  };

  const handleCopyDraftMarkdown = async () => {
    if (!activeRun?.id || !activeRun?.articleId) return;
    try {
      // El frontend no tiene el JSON canonico; lo pedimos al endpoint de detail,
      // que ya lo expone via /runs/{runId}. Como atajo de fallback usamos el
      // prompt para descartar; el copiado real del draft requiere parsear el
      // output canonico desde server, fuera del alcance de este boton fallback.
      // Mientras tanto, instruimos al usuario.
      await navigator.clipboard.writeText(
        '(Para copiar draft_markdown, abre output_validated.json desde el servidor o usa "Aplicar al artículo".)'
      );
      setCopyHint('Aviso copiado: usa "Aplicar al artículo" como vía principal.');
      setTimeout(() => setCopyHint(''), 3500);
    } catch {
      setCopyHint('No se pudo copiar; usa "Aplicar al artículo".');
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
        <HelperText>Generar artículo con IA:</HelperText>
        <AIRunTypeButton
          type="button"
          disabled={creating}
          onClick={() => handleCreateRun(RUN_TYPE_PRIMARY)}
        >
          {creating ? 'Creando…' : 'Generar artículo completo'}
        </AIRunTypeButton>
      </AIRunTypeBar>

      <AdvancedToggleRow>
        <AdvancedToggleButton
          type="button"
          onClick={() => setShowAdvanced((v) => !v)}
        >
          {showAdvanced ? '▾ Ocultar opciones avanzadas' : '▸ Mostrar opciones avanzadas'}
        </AdvancedToggleButton>
        <HelperText>
          Avanzado: runs discretos para casos puntuales o debugging.
        </HelperText>
      </AdvancedToggleRow>

      {showAdvanced ? (
        <AdvancedRunSection>
          <HelperText>Run discreto:</HelperText>
          {RUN_TYPES_ADVANCED.map((rt) => (
            <AIRunTypeButton
              key={rt}
              type="button"
              disabled={creating}
              onClick={() => handleCreateRun(rt)}
            >
              {rt}
            </AIRunTypeButton>
          ))}
        </AdvancedRunSection>
      ) : null}

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
                <>
                  <ToolbarRow>
                    <StyledButton
                      type="button"
                      onClick={handleApplyDraft}
                      disabled={applying || articleIsTerminal}
                    >
                      {applying ? 'Aplicando…' : 'Aplicar al artículo'}
                    </StyledButton>
                    <StyledButton
                      type="button"
                      onClick={handleCopyDraftMarkdown}
                    >
                      Copiar draft_markdown (fallback)
                    </StyledButton>
                    {copyHint ? <HelperText>{copyHint}</HelperText> : null}
                  </ToolbarRow>
                  {articleIsTerminal ? (
                    <NoteCard>
                      Artículo en estado <strong>{articleState}</strong>. Reabre una nueva
                      versión antes de aplicar contenido.
                    </NoteCard>
                  ) : (
                    <NoteCard>
                      Output validado. Guardado canónico en{' '}
                      <code style={{ fontSize: 11 }}>output_validated.json</code>. Pulsa
                      <strong> Aplicar al artículo</strong> para volcar{' '}
                      <code style={{ fontSize: 11 }}>draft_markdown</code> al cuerpo del
                      artículo. La acción no publica ni cambia estado.
                    </NoteCard>
                  )}
                </>
              ) : null}
            </>
          )}
        </AIPanelColumn>
      </AIPanelGrid>
    </MetaCard>
  );
};

export default ContentArticleAIPanel;
