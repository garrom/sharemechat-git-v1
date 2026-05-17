// src/pages/admin/content/ContentArticleAIPanel.jsx
//
// Panel IA reescrito para el modelo bilingue (paquete 6, ADR-025).
//
// Cambios respecto al modelo viejo (paquete 0, ADR-014 / ADR-024 superseded):
//  - Un unico textarea para el JSON bilingüe schema 2.0
//    (`{shared, locales:{es,en}}`), no dos textareas separados ES/EN.
//  - Un unico boton "Validar y aplicar" que llama a
//    POST /apply-bilingual atomicamente (validacion + aplicacion en una
//    sola transaccion server-side).
//  - Eliminado el flujo viejo de dos pasos: `POST /output`,
//    `POST /output-bilingual`, `POST /apply-draft`, "Copiar draft markdown".
//  - i18n preventiva con namespace `cms`.
//
// El listado de runs historicos y el render del prompt expandido se
// conservan: siguen llegando del backend tal cual. Lo unico que cambia es
// la rama del "submit del JSON".

import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
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

// ADR-014: FULL_ARTICLE_ORCHESTRATED es el flujo principal. RESEARCH y
// REVIEW quedan como runs discretos avanzados (debugging).
const RUN_TYPE_PRIMARY = 'FULL_ARTICLE_ORCHESTRATED';
const RUN_TYPES_ADVANCED = ['RESEARCH', 'REVIEW'];

const DEFAULT_MODEL_ID = 'claude-opus-4-7';

const TERMINAL_STATES_FOR_APPLY = new Set(['PUBLISHED', 'RETRACTED']);

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

const ContentArticleAIPanel = ({
  articleId,
  articleState,
  onBilingualApplied,
}) => {
  const { t } = useTranslation('cms');

  const [runs, setRuns] = useState([]);
  const [activeRun, setActiveRun] = useState(null);
  const [rawJson, setRawJson] = useState('');
  const [modelId, setModelId] = useState(DEFAULT_MODEL_ID);
  const [modelVersion, setModelVersion] = useState('');

  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [applying, setApplying] = useState(false);
  const [copyHint, setCopyHint] = useState('');
  const [error, setError] = useState('');
  const [validationErrors, setValidationErrors] = useState([]);
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
      setError(e?.message || t('ai.errLoadRuns', 'No se pudieron cargar los runs IA'));
    } finally {
      setLoading(false);
    }
  }, [articleId, t]);

  useEffect(() => {
    reload();
  }, [reload]);

  const resetSubmitState = () => {
    setError('');
    setOkMessage('');
    setValidationErrors([]);
    setCopyHint('');
  };

  const handleCreateRun = async (runType) => {
    if (!articleId || creating) return;
    setCreating(true);
    resetSubmitState();
    try {
      const created = await apiFetch(`/admin/content/articles/${articleId}/runs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ runType }),
      });
      setActiveRun(created);
      setRawJson('');
      setOkMessage(
        t('ai.msgRunCreated',
          'Run {{runType}} creado (id={{id}}). Copia el prompt, ejecútalo en Claude Cowork y pega el JSON bilingüe abajo.',
          { runType, id: created?.id })
      );
      reload();
    } catch (e) {
      setError(e?.message || t('ai.errCreateRun', 'No se pudo crear el run'));
    } finally {
      setCreating(false);
    }
  };

  const handleOpenRun = async (runId) => {
    resetSubmitState();
    try {
      const detail = await apiFetch(`/admin/content/runs/${runId}`);
      setActiveRun(detail);
      setRawJson('');
    } catch (e) {
      setError(e?.message || t('ai.errLoadRun', 'No se pudo cargar el run'));
    }
  };

  const handleCopyPrompt = async () => {
    if (!activeRun?.prompt) return;
    try {
      await navigator.clipboard.writeText(activeRun.prompt);
      setCopyHint(t('ai.msgPromptCopied', 'Prompt copiado al portapapeles.'));
      setTimeout(() => setCopyHint(''), 2500);
    } catch {
      setCopyHint(t('ai.errCopyManual', 'Selecciona el texto manualmente y copia (Ctrl/Cmd+C).'));
    }
  };

  const handleValidateApply = async () => {
    if (!activeRun?.id || !activeRun?.articleId || applying) return;
    if (articleIsTerminal) {
      setError(t('ai.msgConflict',
        'Operación rechazada: el artículo está en estado no editable.'));
      return;
    }
    if (!modelId.trim()) {
      setError(t('ai.errModelId',
        'Declara el modelId exacto que ejecutó (ej. claude-opus-4-7).'));
      return;
    }
    if (!rawJson.trim()) {
      setError(t('ai.errRawEmpty', 'Pega el JSON bilingüe antes de validar.'));
      return;
    }

    setApplying(true);
    resetSubmitState();
    try {
      const result = await apiFetch(
        `/admin/content/articles/${activeRun.articleId}/runs/${activeRun.id}/apply-bilingual`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            rawJson,
            modelId: modelId.trim(),
            modelVersion: modelVersion.trim() || null,
          }),
        }
      );
      // El backend devuelve ApplyBilingualResultDTO con `runDetail` y
      // `articleDetail`. Si el resultado contiene errores de validacion,
      // el run viene en estado REJECTED.
      const updatedRun = result?.runDetail || result?.run || null;
      if (updatedRun) setActiveRun(updatedRun);

      if (updatedRun && updatedRun.status === 'REJECTED'
          && Array.isArray(updatedRun.validationErrors)
          && updatedRun.validationErrors.length > 0) {
        setValidationErrors(updatedRun.validationErrors);
        setError(t('ai.msgRejected',
          'JSON rechazado por validación ({{errors}} errores). Corrige y reintenta.',
          { errors: updatedRun.validationErrors.length }));
      } else {
        setOkMessage(t('ai.msgApplied',
          'Artículo actualizado con la traducción bilingüe. Revisa las pestañas ES y EN.'));
        // No limpiamos el textarea (operador puede querer ver el JSON
        // aplicado). Si quiere reintentar, lo edita encima.
        if (typeof onBilingualApplied === 'function') {
          onBilingualApplied();
        }
      }
      reload();
    } catch (e) {
      // Errores fuera del happy path: 400 con message, 409 estado no
      // editable, 500 generico. apiFetch lanza con e.message + e.status si
      // los expone; si vienen validationErrors en el cuerpo, tambien.
      const message = e?.message || t('ai.errApply', 'No se pudo aplicar el JSON al artículo');
      const errs = Array.isArray(e?.validationErrors) ? e.validationErrors : null;
      if (errs && errs.length > 0) {
        setValidationErrors(errs);
        setError(t('ai.msgRejected',
          'JSON rechazado por validación ({{errors}} errores). Corrige y reintenta.',
          { errors: errs.length }));
      } else if (e?.status === 409) {
        setError(t('ai.msgConflict',
          'Operación rechazada: el artículo está en estado no editable.'));
      } else {
        setError(message);
      }
    } finally {
      setApplying(false);
    }
  };

  if (!articleId) return null;

  return (
    <MetaCard>
      <ToolbarRow style={{ marginTop: 0, marginBottom: 12 }}>
        <h3 style={{ margin: 0 }}>
          {t('ai.title', 'Asistente IA (Claude Cowork — bilingüe schema 2.0)')}
        </h3>
        <StyledButton type="button" onClick={reload} disabled={loading}>
          {loading
            ? t('ai.btnReloading', 'Recargando...')
            : t('ai.btnReload', 'Recargar')}
        </StyledButton>
      </ToolbarRow>

      <AIRunTypeBar>
        <HelperText>{t('ai.lblGenerate', 'Generar artículo con IA:')}</HelperText>
        <AIRunTypeButton
          type="button"
          disabled={creating}
          onClick={() => handleCreateRun(RUN_TYPE_PRIMARY)}
        >
          {creating
            ? t('ai.btnGenerating', 'Creando…')
            : t('ai.btnGenerateFull', 'Generar artículo completo')}
        </AIRunTypeButton>
      </AIRunTypeBar>

      <AdvancedToggleRow>
        <AdvancedToggleButton
          type="button"
          onClick={() => setShowAdvanced((v) => !v)}
        >
          {showAdvanced
            ? `▾ ${t('ai.advancedHide', 'Ocultar opciones avanzadas')}`
            : `▸ ${t('ai.advancedToggle', 'Mostrar opciones avanzadas')}`}
        </AdvancedToggleButton>
        <HelperText>
          {t('ai.advancedHelper',
            'Avanzado: runs discretos para casos puntuales o debugging.')}
        </HelperText>
      </AdvancedToggleRow>

      {showAdvanced ? (
        <AdvancedRunSection>
          <HelperText>{t('ai.advancedRunLabel', 'Run discreto:')}</HelperText>
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
          <h4 style={{ marginTop: 0, marginBottom: 10 }}>
            {t('ai.runsTitle', 'Runs del artículo')}
          </h4>
          {runs.length === 0 ? (
            <NoteCard>{t('ai.runsEmpty', 'Sin runs todavía. Crea uno arriba.')}</NoteCard>
          ) : (
            <RunListTable>
              <thead>
                <tr>
                  <th>{t('ai.runsColId', 'ID')}</th>
                  <th>{t('ai.runsColType', 'Tipo')}</th>
                  <th>{t('ai.runsColStatus', 'Estado')}</th>
                  <th>{t('ai.runsColModel', 'Modelo')}</th>
                  <th>{t('ai.runsColCreated', 'Creado')}</th>
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
                    <td>{r.modelId || <em style={{ color: '#94a3b8' }}>{t('ai.runsColModelPending', 'pendiente')}</em>}</td>
                    <td>{fmtDate(r.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </RunListTable>
          )}
        </AIPanelColumn>

        <AIPanelColumn>
          <h4 style={{ marginTop: 0, marginBottom: 10 }}>
            {t('ai.selectedTitle', 'Run seleccionado')}
          </h4>
          {!activeRun ? (
            <NoteCard>{t('ai.selectedEmpty', 'Selecciona un run de la lista o crea uno nuevo.')}</NoteCard>
          ) : (
            <>
              <InlineRow>
                <span>{t('ai.rowInfoId', 'id {{id}}', { id: activeRun.id })}</span>
                <span>{t('ai.rowInfoType', 'tipo {{type}}', { type: activeRun.runType })}</span>
                <RunStatusBadge $status={activeRun.status}>{activeRun.status}</RunStatusBadge>
                {activeRun.modelId
                  ? <span>{t('ai.rowInfoModel', 'model {{model}}', { model: activeRun.modelId })}</span>
                  : null}
              </InlineRow>
              {activeRun.promptHash ? (
                <InlineRow>
                  <HelperText>{t('ai.promptHashLabel', 'promptHash:')}</HelperText>
                  <HashCode>{activeRun.promptHash}</HashCode>
                </InlineRow>
              ) : null}
              {activeRun.outputHash ? (
                <InlineRow>
                  <HelperText>{t('ai.outputHashLabel', 'outputHash:')}</HelperText>
                  <HashCode>{activeRun.outputHash}</HashCode>
                </InlineRow>
              ) : null}

              {activeRun.prompt ? (
                <>
                  <InlineRow>
                    <strong style={{ fontSize: 13 }}>{t('ai.promptExpanded', 'Prompt expandido')}</strong>
                    <StyledButton type="button" onClick={handleCopyPrompt}>
                      {t('ai.btnCopyPrompt', 'Copiar prompt')}
                    </StyledButton>
                    {copyHint ? <HelperText>{copyHint}</HelperText> : null}
                  </InlineRow>
                  <PromptPre>{activeRun.prompt}</PromptPre>
                </>
              ) : null}

              {/* Submit del JSON bilingue. Disponible mientras el run no
                  este aplicado / publicado y el articulo no este en estado
                  terminal. */}
              {(activeRun.status === 'PENDING' || activeRun.status === 'REJECTED') ? (
                <>
                  <InlineRow style={{ marginTop: 16 }}>
                    <StyledInput
                      placeholder={t('ai.modelIdPlaceholder', 'modelId (ej. claude-opus-4-7)')}
                      value={modelId}
                      onChange={(e) => setModelId(e.target.value)}
                    />
                    <StyledInput
                      placeholder={t('ai.modelVersionPlaceholder', 'modelVersion (opcional)')}
                      value={modelVersion}
                      onChange={(e) => setModelVersion(e.target.value)}
                    />
                  </InlineRow>

                  <HelperText style={{ marginTop: 12 }}>
                    {t('ai.lblJsonBilingual', 'JSON bilingüe (schema 2.0)')}
                  </HelperText>
                  <RawOutputArea
                    value={rawJson}
                    onChange={(e) => setRawJson(e.target.value)}
                    placeholder={t('ai.jsonBilingualPlaceholder',
                      'Pega aquí el JSON completo que te devuelva Cowork. Debe contener las claves shared y locales.es y locales.en.')}
                  />

                  {validationErrors.length > 0 ? (
                    <>
                      <strong style={{ fontSize: 13, display: 'block', margin: '8px 0' }}>
                        {t('ai.validationErrorsTitle', 'Errores de validación')}
                      </strong>
                      <ValidationErrorsBox>
                        {validationErrors.map((er, idx) => (
                          <div key={idx}>
                            <strong>{er.field || 'body'}:</strong> {er.message}
                          </div>
                        ))}
                      </ValidationErrorsBox>
                    </>
                  ) : null}

                  <ToolbarRow>
                    <StyledButton
                      type="button"
                      onClick={handleValidateApply}
                      disabled={applying || articleIsTerminal}
                    >
                      {applying
                        ? t('ai.btnValidating', 'Validando y aplicando...')
                        : t('ai.btnValidateApply', 'Validar y aplicar')}
                    </StyledButton>
                    <HelperText>
                      {t('ai.applyHelper',
                        'Operación atómica: el backend valida el JSON contra el schema 2.0, actualiza la traducción ES y la EN, actualiza la metadata compartida, y deja el artículo listo para revisión.')}
                    </HelperText>
                  </ToolbarRow>
                  {articleIsTerminal ? (
                    <NoteCard>
                      {t('ai.msgConflict',
                        'Operación rechazada: el artículo está en estado no editable.')}
                    </NoteCard>
                  ) : null}
                </>
              ) : null}

              {activeRun.status === 'VALIDATED' || activeRun.status === 'APPLIED' ? (
                <NoteCard>
                  {t('ai.msgApplied',
                    'Artículo actualizado con la traducción bilingüe. Revisa las pestañas ES y EN.')}
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
