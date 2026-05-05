// src/pages/admin/content/ContentArticleHistory.jsx
import React, { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../../../config/http';
import {
  StyledButton,
  StyledError,
  NoteCard,
} from '../../../styles/AdminStyles';
import {
  EventTypePill,
  HashCode,
  HistoryColumn,
  HistoryRow,
  HistoryRowMeta,
  HistorySection,
  HistoryTitle,
  MetaCard,
  ToolbarRow,
  VersionLink,
} from '../../../styles/pages-styles/AdminContentStyles';

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

const summarizePayload = (raw) => {
  if (!raw) return '';
  try {
    const obj = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return Object.entries(obj)
      .map(([k, v]) => `${k}=${typeof v === 'string' ? v : JSON.stringify(v)}`)
      .join(' · ');
  } catch {
    return String(raw);
  }
};

const ContentArticleHistory = ({ articleId }) => {
  const [versions, setVersions] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [openVersion, setOpenVersion] = useState(null);
  const [versionBody, setVersionBody] = useState('');
  const [versionLoading, setVersionLoading] = useState(false);

  const reload = useCallback(async () => {
    if (!articleId) return;
    setLoading(true);
    setError('');
    try {
      const [vs, evs] = await Promise.all([
        apiFetch(`/admin/content/articles/${articleId}/versions`),
        apiFetch(`/admin/content/articles/${articleId}/events`),
      ]);
      setVersions(Array.isArray(vs) ? vs : []);
      setEvents(Array.isArray(evs?.items) ? evs.items : []);
    } catch (e) {
      setError(e?.message || 'No se pudo cargar el historial');
    } finally {
      setLoading(false);
    }
  }, [articleId]);

  useEffect(() => {
    reload();
  }, [reload]);

  const handleOpenVersion = async (versionNumber) => {
    setOpenVersion(versionNumber);
    setVersionBody('');
    setVersionLoading(true);
    try {
      const body = await apiFetch(
        `/admin/content/articles/${articleId}/versions/${versionNumber}/body`
      );
      setVersionBody(typeof body === 'string' ? body : '');
    } catch (e) {
      setVersionBody(`(error cargando: ${e?.message || 'desconocido'})`);
    } finally {
      setVersionLoading(false);
    }
  };

  const handleCloseVersion = () => {
    setOpenVersion(null);
    setVersionBody('');
  };

  if (!articleId) return null;

  return (
    <MetaCard>
      <ToolbarRow style={{ marginTop: 0, marginBottom: 12 }}>
        <h3 style={{ margin: 0 }}>Historial</h3>
        <StyledButton type="button" onClick={reload} disabled={loading}>
          {loading ? 'Recargando...' : 'Recargar'}
        </StyledButton>
      </ToolbarRow>

      {error ? <StyledError>{error}</StyledError> : null}

      <HistorySection>
        <HistoryColumn>
          <HistoryTitle>Versiones ({versions.length})</HistoryTitle>
          {versions.length === 0 ? (
            <NoteCard>Sin versiones todavía. Se crea una al enviar a revisión.</NoteCard>
          ) : (
            versions.map((v) => (
              <HistoryRow key={v.id}>
                <div>
                  <strong>v{v.versionNumber}</strong>
                  {' · '}
                  <VersionLink type="button" onClick={() => handleOpenVersion(v.versionNumber)}>
                    Ver cuerpo
                  </VersionLink>
                </div>
                <HistoryRowMeta>
                  <span>creado por #{v.createdByUserId ?? '-'}</span>
                  <span>{fmtDate(v.createdAt)}</span>
                </HistoryRowMeta>
                <HashCode>{v.bodyContentHash}</HashCode>
              </HistoryRow>
            ))
          )}
        </HistoryColumn>

        <HistoryColumn>
          <HistoryTitle>Eventos ({events.length})</HistoryTitle>
          {events.length === 0 ? (
            <NoteCard>Sin eventos.</NoteCard>
          ) : (
            events.map((e) => (
              <HistoryRow key={e.id}>
                <div>
                  <EventTypePill>{e.eventType}</EventTypePill>
                  {e.versionId ? (
                    <span style={{ marginLeft: 8, fontSize: 11, color: '#64748b' }}>
                      versionId={e.versionId}
                    </span>
                  ) : null}
                </div>
                <HistoryRowMeta>
                  <span>actor #{e.actorUserId}</span>
                  <span>{fmtDate(e.createdAt)}</span>
                </HistoryRowMeta>
                {e.payloadJson ? (
                  <HashCode>{summarizePayload(e.payloadJson)}</HashCode>
                ) : null}
              </HistoryRow>
            ))
          )}
        </HistoryColumn>
      </HistorySection>

      {openVersion != null ? (
        <MetaCard style={{ marginTop: 12 }}>
          <ToolbarRow style={{ marginTop: 0 }}>
            <h4 style={{ margin: 0 }}>Cuerpo de v{openVersion}</h4>
            <StyledButton type="button" onClick={handleCloseVersion}>
              Cerrar
            </StyledButton>
          </ToolbarRow>
          {versionLoading ? (
            <NoteCard>Cargando cuerpo...</NoteCard>
          ) : (
            <pre
              style={{
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                background: '#f8fafc',
                padding: 12,
                borderRadius: 8,
                fontSize: 12,
                lineHeight: 1.5,
                margin: 0,
                maxHeight: 360,
                overflowY: 'auto',
              }}
            >
              {versionBody || '(vacío)'}
            </pre>
          )}
        </MetaCard>
      ) : null}
    </MetaCard>
  );
};

export default ContentArticleHistory;
