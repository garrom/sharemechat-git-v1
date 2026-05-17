// src/pages/admin/content/ContentArticleHistory.jsx
//
// Historial de versiones y eventos editoriales (paquete 6, ADR-025).
//
// Cambios respecto al modelo viejo (paquete 0):
//  - Abrir body de version usa el endpoint nuevo per-locale:
//    GET /api/admin/content/articles/{id}/versions/{n}/translations/{locale}/body
//    (antes era `/versions/{n}/body` sin locale).
//  - Reutiliza el componente `BodyLocaleTabs` en modo `versionReadonly`
//    para el selector ES|EN. El selector se pobla solo con los locales
//    que la version tiene congelados (campo `translations` del VersionDTO).
//  - i18n preventiva con namespace `cms`.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
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
import BodyLocaleTabs from './components/BodyLocaleTabs';

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
  const { t } = useTranslation('cms');

  const [versions, setVersions] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Version abierta + locale activo de su body.
  const [openVersion, setOpenVersion] = useState(null); // VersionDTO completo
  const [versionLocale, setVersionLocale] = useState('es');
  const [versionBody, setVersionBody] = useState('');
  const [versionBodyLoading, setVersionBodyLoading] = useState(false);
  const [versionBodyError, setVersionBodyError] = useState('');

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
      setError(e?.message || t('history.errLoad', 'No se pudo cargar el historial'));
    } finally {
      setLoading(false);
    }
  }, [articleId, t]);

  useEffect(() => {
    reload();
  }, [reload]);

  const loadVersionBody = useCallback(async (version, locale) => {
    if (!version || !locale) return;
    setVersionBodyLoading(true);
    setVersionBodyError('');
    setVersionBody('');
    try {
      const body = await apiFetch(
        `/admin/content/articles/${articleId}/versions/${version.versionNumber}/translations/${locale}/body`
      );
      setVersionBody(typeof body === 'string' ? body : '');
    } catch (e) {
      setVersionBodyError(
        t('history.errLoadVersionBody', '(error cargando: {{message}})',
            { message: e?.message || '?' })
      );
    } finally {
      setVersionBodyLoading(false);
    }
  }, [articleId, t]);

  const handleOpenVersion = (version) => {
    setOpenVersion(version);
    // Locale inicial: prefiere ES si la version lo tiene, si no, el primer
    // locale disponible.
    const availableLocales = Array.isArray(version?.translations)
      ? version.translations.map((tv) => tv.locale)
      : ['es'];
    const initial = availableLocales.includes('es')
      ? 'es'
      : (availableLocales[0] || 'es');
    setVersionLocale(initial);
    loadVersionBody(version, initial);
  };

  const handleVersionLocaleChange = (newLocale) => {
    setVersionLocale(newLocale);
    loadVersionBody(openVersion, newLocale);
  };

  const handleCloseVersion = () => {
    setOpenVersion(null);
    setVersionBody('');
    setVersionBodyError('');
  };

  const openVersionAvailableLocales = useMemo(() => {
    if (!openVersion || !Array.isArray(openVersion.translations)) return ['es'];
    return openVersion.translations.map((tv) => tv.locale);
  }, [openVersion]);

  if (!articleId) return null;

  return (
    <MetaCard>
      <ToolbarRow style={{ marginTop: 0, marginBottom: 12 }}>
        <h3 style={{ margin: 0 }}>{t('history.title', 'Historial')}</h3>
        <StyledButton type="button" onClick={reload} disabled={loading}>
          {loading
            ? t('history.btnReloading', 'Recargando...')
            : t('history.btnReload', 'Recargar')}
        </StyledButton>
      </ToolbarRow>

      {error ? <StyledError>{error}</StyledError> : null}

      <HistorySection>
        <HistoryColumn>
          <HistoryTitle>
            {t('history.versionsTitle', 'Versiones ({{count}})', { count: versions.length })}
          </HistoryTitle>
          {versions.length === 0 ? (
            <NoteCard>
              {t('history.versionsEmpty', 'Sin versiones todavía. Se crea una al enviar a revisión.')}
            </NoteCard>
          ) : (
            versions.map((v) => (
              <HistoryRow key={v.id}>
                <div>
                  <strong>{t('history.versionLabel', 'v{{n}}', { n: v.versionNumber })}</strong>
                  {' · '}
                  <VersionLink type="button" onClick={() => handleOpenVersion(v)}>
                    {t('history.openBody', 'Ver cuerpo')}
                  </VersionLink>
                </div>
                <HistoryRowMeta>
                  <span>{t('history.createdBy', 'creado por #{{userId}}',
                      { userId: v.createdByUserId ?? '-' })}</span>
                  <span>{fmtDate(v.createdAt)}</span>
                </HistoryRowMeta>
                {/* Lista mini de locales presentes en la version */}
                <HistoryRowMeta>
                  {Array.isArray(v.translations)
                    ? v.translations.map((tv) => (
                        <code
                          key={tv.locale}
                          style={{
                            background: '#eef2ff',
                            color: '#3730a3',
                            padding: '2px 6px',
                            borderRadius: 4,
                            fontSize: 11,
                          }}
                        >
                          {tv.locale}
                        </code>
                      ))
                    : null}
                </HistoryRowMeta>
              </HistoryRow>
            ))
          )}
        </HistoryColumn>

        <HistoryColumn>
          <HistoryTitle>
            {t('history.eventsTitle', 'Eventos ({{count}})', { count: events.length })}
          </HistoryTitle>
          {events.length === 0 ? (
            <NoteCard>{t('history.eventsEmpty', 'Sin eventos.')}</NoteCard>
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
                  <span>{t('history.actorBy', 'actor #{{userId}}', { userId: e.actorUserId })}</span>
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

      {openVersion ? (
        <MetaCard style={{ marginTop: 12 }}>
          <ToolbarRow style={{ marginTop: 0 }}>
            <h4 style={{ margin: 0 }}>
              {t('history.openBodyTitle', 'Cuerpo de v{{n}}',
                  { n: openVersion.versionNumber })}
            </h4>
            <StyledButton type="button" onClick={handleCloseVersion}>
              {t('history.btnClose', 'Cerrar')}
            </StyledButton>
          </ToolbarRow>

          <BodyLocaleTabs
            mode="versionReadonly"
            availableLocales={openVersionAvailableLocales}
            activeLocale={versionLocale}
            onActiveLocaleChange={handleVersionLocaleChange}
            content={versionBody}
            contentLoading={versionBodyLoading}
            contentError={versionBodyError}
          />
        </MetaCard>
      ) : null}
    </MetaCard>
  );
};

export default ContentArticleHistory;
