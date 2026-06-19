import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '../../i18n';
import styled from 'styled-components';
import {
  CardsGrid,
  ControlsRow,
  DarkHeaderTable,
  FieldBlock,
  RightInfo,
  SectionTitle,
  StatCard,
  StyledButton,
  StyledError,
  StyledSelect,
  TabsBar,
  TabButton,
  TableActionGroup,
  TableDangerButton,
  TableSuccessButton,
  TextArea,
} from '../../styles/AdminStyles';

// ----------------------------------------------------------------------
// Constantes
// ----------------------------------------------------------------------

const STATUS_OPTIONS_QUEUE = ['PENDING', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'CANCELLED'];
const SEVERITY_OPTIONS = ['GREEN', 'AMBER', 'RED', 'CRITICAL'];
const CATEGORY_OPTIONS = [
  'NUDITY',
  'WEAPONS',
  'DRUGS',
  'VIOLENCE',
  'GORE',
  'SELF_HARM',
  'GAMBLING',
  'OFFENSIVE_SYMBOLS',
  'MINORS',
  'OTHER',
];
const STATUS_OPTIONS_SESSIONS = ['ACTIVE', 'DEGRADED', 'STOPPED', 'ERROR'];
const PROVIDER_MODES = ['MOCK', 'SIGHTENGINE', 'HIVE', 'REKOGNITION'];

// ----------------------------------------------------------------------
// Estilos locales (calcados de AdminAssetModerationPanel: modal inline)
// ----------------------------------------------------------------------

const QueueTable = styled(DarkHeaderTable)`
  border: 1px solid #b4beca;

  tbody tr td {
    background: #fff !important;
    border-bottom-color: #d6dde5;
    vertical-align: middle;
  }

  tbody tr:hover td {
    background: #f1f4f7 !important;
  }
`;

const ModalBackdrop = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(20, 30, 45, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
`;

const ModalCard = styled.div`
  background: #fff;
  border-radius: 12px;
  width: min(540px, calc(100% - 32px));
  padding: 22px 24px;
  box-shadow: 0 18px 48px rgba(15, 23, 42, 0.25);
`;

const ModalTitle = styled.h4`
  margin: 0 0 12px 0;
  font-size: 1.05rem;
  color: #162033;
`;

const ModalSubtitle = styled.div`
  font-size: 0.85rem;
  color: #52607a;
  margin-bottom: 14px;
  line-height: 1.4;
`;

const ModalActions = styled.div`
  display: flex;
  gap: 10px;
  justify-content: flex-end;
  margin-top: 18px;
`;

const KillStreamRow = styled.label`
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 10px;
  font-size: 0.85rem;
  color: #324155;
`;

// ----------------------------------------------------------------------
// Componente principal
// ----------------------------------------------------------------------

const AdminStreamModerationPanel = ({ canModerate = false, canChangeConfig = false }) => {
  const { t } = useTranslation();
  const tt = (key, options) => i18n.t(key, options);

  const [subTab, setSubTab] = useState('queue');

  // ------------------ Cola ------------------
  const [items, setItems] = useState([]);
  const [stats, setStats] = useState({ pending: 0, inReview: 0, approved: 0, rejected: 0, cancelled: 0 });
  const [statusFilter, setStatusFilter] = useState('PENDING');
  const [severityFilter, setSeverityFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [loadingQueue, setLoadingQueue] = useState(false);
  const [queueError, setQueueError] = useState('');

  // ------------------ Modal reject ------------------
  const [rejectTarget, setRejectTarget] = useState(null);
  const [rejectDecisionCode, setRejectDecisionCode] = useState('');
  const [rejectNote, setRejectNote] = useState('');
  const [rejectKillStream, setRejectKillStream] = useState(false);
  const [rejectSubmitting, setRejectSubmitting] = useState(false);
  const [rejectError, setRejectError] = useState('');

  // ------------------ Sesiones ------------------
  const [sessions, setSessions] = useState([]);
  const [sessionsStatusFilter, setSessionsStatusFilter] = useState('ACTIVE');
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [sessionsError, setSessionsError] = useState('');

  // ------------------ Config ------------------
  const [config, setConfig] = useState(null);
  const [configMode, setConfigMode] = useState('');
  const [configNote, setConfigNote] = useState('');
  const [loadingConfig, setLoadingConfig] = useState(false);
  const [configError, setConfigError] = useState('');
  const [configSubmitting, setConfigSubmitting] = useState(false);
  const [confirmConfigOpen, setConfirmConfigOpen] = useState(false);

  // ------------------------------------------------------------------
  // Fetchers
  // ------------------------------------------------------------------

  const fetchQueueAndStats = useCallback(async () => {
    setLoadingQueue(true);
    setQueueError('');
    try {
      const qs = new URLSearchParams();
      if (statusFilter) qs.set('status', statusFilter);
      if (severityFilter) qs.set('severity', severityFilter);
      if (categoryFilter) qs.set('category', categoryFilter);
      const [queueRes, statsRes] = await Promise.all([
        fetch(`/api/admin/stream-moderation/queue?${qs.toString()}`, { credentials: 'include' }),
        fetch('/api/admin/stream-moderation/stats', { credentials: 'include' }),
      ]);
      if (!queueRes.ok) throw new Error((await queueRes.text()) || tt('admin.streamModeration.errors.loadFailed'));
      if (!statsRes.ok) throw new Error((await statsRes.text()) || tt('admin.streamModeration.errors.loadFailed'));
      const rows = await queueRes.json();
      const s = await statsRes.json();
      setItems(Array.isArray(rows) ? rows : []);
      setStats({
        pending: Number(s?.pending) || 0,
        inReview: Number(s?.inReview) || 0,
        approved: Number(s?.approved) || 0,
        rejected: Number(s?.rejected) || 0,
        cancelled: Number(s?.cancelled) || 0,
      });
    } catch (err) {
      setQueueError(err.message || tt('admin.streamModeration.errors.loadFailed'));
    } finally {
      setLoadingQueue(false);
    }
  }, [statusFilter, severityFilter, categoryFilter]);

  const fetchSessions = useCallback(async () => {
    setLoadingSessions(true);
    setSessionsError('');
    try {
      const qs = sessionsStatusFilter ? `?status=${encodeURIComponent(sessionsStatusFilter)}` : '';
      const res = await fetch(`/api/admin/stream-moderation/sessions${qs}`, { credentials: 'include' });
      if (!res.ok) throw new Error((await res.text()) || tt('admin.streamModeration.errors.loadFailed'));
      const rows = await res.json();
      setSessions(Array.isArray(rows) ? rows : []);
    } catch (err) {
      setSessionsError(err.message || tt('admin.streamModeration.errors.loadFailed'));
    } finally {
      setLoadingSessions(false);
    }
  }, [sessionsStatusFilter]);

  const fetchConfig = useCallback(async () => {
    setLoadingConfig(true);
    setConfigError('');
    try {
      const res = await fetch('/api/admin/stream-moderation/config', { credentials: 'include' });
      if (!res.ok) throw new Error((await res.text()) || tt('admin.streamModeration.errors.loadFailed'));
      const data = await res.json();
      setConfig(data);
      setConfigMode(data?.activeMode || '');
      setConfigNote(data?.note || '');
    } catch (err) {
      setConfigError(err.message || tt('admin.streamModeration.errors.loadFailed'));
    } finally {
      setLoadingConfig(false);
    }
  }, []);

  useEffect(() => {
    if (subTab === 'queue') fetchQueueAndStats();
  }, [subTab, fetchQueueAndStats]);

  useEffect(() => {
    if (subTab === 'sessions') fetchSessions();
  }, [subTab, fetchSessions]);

  useEffect(() => {
    if (subTab === 'config') fetchConfig();
  }, [subTab, fetchConfig]);

  // ------------------------------------------------------------------
  // Acciones de cola
  // ------------------------------------------------------------------

  const handleApprove = async (reviewId) => {
    if (!canModerate) return;
    try {
      const res = await fetch(`/api/admin/stream-moderation/queue/${reviewId}/approve`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: null }),
      });
      if (!res.ok) throw new Error((await res.text()) || tt('admin.streamModeration.errors.actionFailed'));
      await fetchQueueAndStats();
    } catch (err) {
      setQueueError(err.message || tt('admin.streamModeration.errors.actionFailed'));
    }
  };

  const openRejectModal = (row) => {
    if (!canModerate) return;
    setRejectTarget(row);
    setRejectDecisionCode('');
    setRejectNote('');
    setRejectKillStream(false);
    setRejectError('');
  };

  const closeRejectModal = () => {
    if (rejectSubmitting) return;
    setRejectTarget(null);
    setRejectDecisionCode('');
    setRejectNote('');
    setRejectKillStream(false);
    setRejectError('');
  };

  const submitReject = async () => {
    if (!rejectTarget) return;
    if (!rejectDecisionCode.trim()) {
      setRejectError(tt('admin.streamModeration.errors.actionFailed'));
      return;
    }
    setRejectSubmitting(true);
    setRejectError('');
    try {
      const res = await fetch(`/api/admin/stream-moderation/queue/${rejectTarget.id}/reject`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          decisionCode: rejectDecisionCode.trim(),
          note: rejectNote.trim() || null,
          killStreamIfActive: rejectKillStream,
        }),
      });
      if (!res.ok) throw new Error((await res.text()) || tt('admin.streamModeration.errors.actionFailed'));
      setRejectTarget(null);
      setRejectDecisionCode('');
      setRejectNote('');
      setRejectKillStream(false);
      await fetchQueueAndStats();
    } catch (err) {
      setRejectError(err.message || tt('admin.streamModeration.errors.actionFailed'));
    } finally {
      setRejectSubmitting(false);
    }
  };

  // ------------------------------------------------------------------
  // Acciones de config
  // ------------------------------------------------------------------

  const openConfirmConfig = () => {
    if (!canChangeConfig) return;
    if (!configMode || !PROVIDER_MODES.includes(configMode)) {
      setConfigError(tt('admin.streamModeration.errors.actionFailed'));
      return;
    }
    setConfirmConfigOpen(true);
  };

  const closeConfirmConfig = () => {
    if (configSubmitting) return;
    setConfirmConfigOpen(false);
  };

  const submitConfig = async () => {
    setConfigSubmitting(true);
    setConfigError('');
    try {
      const res = await fetch('/api/admin/stream-moderation/config/mode', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: configMode,
          note: configNote.trim() || null,
        }),
      });
      if (!res.ok) throw new Error((await res.text()) || tt('admin.streamModeration.errors.actionFailed'));
      setConfirmConfigOpen(false);
      await fetchConfig();
    } catch (err) {
      setConfigError(err.message || tt('admin.streamModeration.errors.actionFailed'));
    } finally {
      setConfigSubmitting(false);
    }
  };

  // ------------------------------------------------------------------
  // Helpers de render
  // ------------------------------------------------------------------

  const fmtTs = (iso) => (iso ? String(iso).replace('T', ' ').slice(0, 19) : '-');
  const fmtScore = (v) => (v == null ? '-' : Number(v).toFixed(2));

  const queueOptions = useMemo(
    () => STATUS_OPTIONS_QUEUE.map((v) => ({ value: v, label: v })),
    []
  );

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------

  return (
    <div>
      <CardsGrid>
        <StatCard>
          <div style={{ fontSize: 12, color: '#52607a' }}>{tt('admin.streamModeration.stats.pending')}</div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>{stats.pending}</div>
        </StatCard>
        <StatCard>
          <div style={{ fontSize: 12, color: '#52607a' }}>{tt('admin.streamModeration.stats.inReview')}</div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>{stats.inReview}</div>
        </StatCard>
        <StatCard>
          <div style={{ fontSize: 12, color: '#52607a' }}>{tt('admin.streamModeration.stats.rejected')}</div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>{stats.rejected}</div>
        </StatCard>
      </CardsGrid>

      <TabsBar style={{ marginTop: 16 }}>
        <TabButton active={subTab === 'queue'} onClick={() => setSubTab('queue')}>
          {tt('admin.streamModeration.subTabs.queue')}
        </TabButton>
        <TabButton active={subTab === 'sessions'} onClick={() => setSubTab('sessions')}>
          {tt('admin.streamModeration.subTabs.sessions')}
        </TabButton>
        <TabButton active={subTab === 'config'} onClick={() => setSubTab('config')}>
          {tt('admin.streamModeration.subTabs.config')}
        </TabButton>
      </TabsBar>

      {subTab === 'queue' && (
        <div style={{ marginTop: 16 }}>
          <ControlsRow>
            <FieldBlock>
              <label>{tt('admin.streamModeration.queue.filters.status')}</label>
              <StyledSelect
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                {queueOptions.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </StyledSelect>
            </FieldBlock>
            <FieldBlock>
              <label>{tt('admin.streamModeration.queue.filters.severity')}</label>
              <StyledSelect
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value)}
              >
                <option value="">{tt('admin.streamModeration.queue.filters.all')}</option>
                {SEVERITY_OPTIONS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </StyledSelect>
            </FieldBlock>
            <FieldBlock>
              <label>{tt('admin.streamModeration.queue.filters.category')}</label>
              <StyledSelect
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
              >
                <option value="">{tt('admin.streamModeration.queue.filters.all')}</option>
                {CATEGORY_OPTIONS.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </StyledSelect>
            </FieldBlock>
            <RightInfo>
              <StyledButton onClick={fetchQueueAndStats}>
                {loadingQueue ? '...' : 'Refresh'}
              </StyledButton>
            </RightInfo>
          </ControlsRow>

          {queueError && <StyledError>{queueError}</StyledError>}

          <QueueTable>
            <thead>
              <tr>
                <th>{tt('admin.streamModeration.queue.priority')}</th>
                <th>{tt('admin.streamModeration.queue.severity')}</th>
                <th>{tt('admin.streamModeration.queue.category')}</th>
                <th>{tt('admin.streamModeration.queue.score')}</th>
                <th>{tt('admin.streamModeration.queue.streamId')}</th>
                <th>{tt('admin.streamModeration.queue.frameTimestamp')}</th>
                <th>{tt('admin.streamModeration.queue.createdAt')}</th>
                <th>{tt('admin.streamModeration.queue.actions.approve')} / {tt('admin.streamModeration.queue.actions.reject')}</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr><td colSpan={8} style={{ textAlign: 'center', color: '#52607a' }}>—</td></tr>
              ) : (
                items.map((r) => (
                  <tr key={r.id}>
                    <td>{r.priority}</td>
                    <td>{r.severity}</td>
                    <td>{r.category}</td>
                    <td>{fmtScore(r.score)}</td>
                    <td>{r.streamRecordId}</td>
                    <td>{fmtTs(r.frameTimestamp)}</td>
                    <td>{fmtTs(r.createdAt)}</td>
                    <td>
                      <TableActionGroup>
                        <TableSuccessButton
                          disabled={!canModerate}
                          onClick={() => handleApprove(r.id)}
                        >
                          {tt('admin.streamModeration.queue.actions.approve')}
                        </TableSuccessButton>
                        <TableDangerButton
                          disabled={!canModerate}
                          onClick={() => openRejectModal(r)}
                        >
                          {tt('admin.streamModeration.queue.actions.reject')}
                        </TableDangerButton>
                      </TableActionGroup>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </QueueTable>
        </div>
      )}

      {subTab === 'sessions' && (
        <div style={{ marginTop: 16 }}>
          <ControlsRow>
            <FieldBlock>
              <label>{tt('admin.streamModeration.sessions.status')}</label>
              <StyledSelect
                value={sessionsStatusFilter}
                onChange={(e) => setSessionsStatusFilter(e.target.value)}
              >
                <option value="">{tt('admin.streamModeration.queue.filters.all')}</option>
                {STATUS_OPTIONS_SESSIONS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </StyledSelect>
            </FieldBlock>
            <RightInfo>
              <StyledButton onClick={fetchSessions}>
                {loadingSessions ? '...' : 'Refresh'}
              </StyledButton>
            </RightInfo>
          </ControlsRow>

          {sessionsError && <StyledError>{sessionsError}</StyledError>}

          <QueueTable>
            <thead>
              <tr>
                <th>{tt('admin.streamModeration.sessions.id')}</th>
                <th>{tt('admin.streamModeration.sessions.streamId')}</th>
                <th>{tt('admin.streamModeration.sessions.provider')}</th>
                <th>{tt('admin.streamModeration.sessions.status')}</th>
                <th>{tt('admin.streamModeration.sessions.startedAt')}</th>
                <th>{tt('admin.streamModeration.sessions.framesSubmitted')}</th>
                <th>{tt('admin.streamModeration.sessions.verdictsReceived')}</th>
                <th>{tt('admin.streamModeration.sessions.degradedSince')}</th>
              </tr>
            </thead>
            <tbody>
              {sessions.length === 0 ? (
                <tr><td colSpan={8} style={{ textAlign: 'center', color: '#52607a' }}>—</td></tr>
              ) : (
                sessions.map((s) => (
                  <tr key={s.id}>
                    <td>{s.id}</td>
                    <td>{s.streamRecordId}</td>
                    <td>{s.provider}</td>
                    <td>{s.status}</td>
                    <td>{fmtTs(s.startedAt)}</td>
                    <td>{s.framesSubmitted}</td>
                    <td>{s.verdictsReceived}</td>
                    <td>{fmtTs(s.degradedSince)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </QueueTable>
        </div>
      )}

      {subTab === 'config' && (
        <div style={{ marginTop: 16 }}>
          <SectionTitle>{tt('admin.streamModeration.title')}</SectionTitle>
          {configError && <StyledError>{configError}</StyledError>}
          <FieldBlock>
            <label>{tt('admin.streamModeration.config.activeMode')}</label>
            <StyledSelect
              value={configMode}
              disabled={!canChangeConfig || loadingConfig}
              onChange={(e) => setConfigMode(e.target.value)}
            >
              {PROVIDER_MODES.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </StyledSelect>
          </FieldBlock>
          <FieldBlock>
            <label>{tt('admin.streamModeration.config.note')}</label>
            <TextArea
              rows={3}
              value={configNote}
              disabled={!canChangeConfig || loadingConfig}
              onChange={(e) => setConfigNote(e.target.value)}
            />
          </FieldBlock>
          <StyledButton
            disabled={!canChangeConfig || loadingConfig || configSubmitting}
            onClick={openConfirmConfig}
          >
            {tt('admin.streamModeration.config.save')}
          </StyledButton>
        </div>
      )}

      {rejectTarget && (
        <ModalBackdrop>
          <ModalCard>
            <ModalTitle>{tt('admin.streamModeration.modal.reject.title')}</ModalTitle>
            <ModalSubtitle>
              #{rejectTarget.id} — {rejectTarget.severity} / {rejectTarget.category}
            </ModalSubtitle>
            <FieldBlock>
              <label>{tt('admin.streamModeration.modal.reject.decisionCode')}</label>
              <input
                type="text"
                maxLength={50}
                value={rejectDecisionCode}
                onChange={(e) => setRejectDecisionCode(e.target.value)}
                style={{ width: '100%', padding: '8px', borderRadius: 6, border: '1px solid #d6dde5' }}
              />
            </FieldBlock>
            <FieldBlock>
              <label>{tt('admin.streamModeration.modal.reject.note')}</label>
              <TextArea
                rows={3}
                value={rejectNote}
                onChange={(e) => setRejectNote(e.target.value)}
              />
            </FieldBlock>
            <KillStreamRow>
              <input
                type="checkbox"
                checked={rejectKillStream}
                onChange={(e) => setRejectKillStream(e.target.checked)}
              />
              {tt('admin.streamModeration.modal.reject.killStream')}
            </KillStreamRow>
            {rejectError && <StyledError>{rejectError}</StyledError>}
            <ModalActions>
              <StyledButton onClick={closeRejectModal} disabled={rejectSubmitting}>
                {tt('admin.streamModeration.modal.reject.cancel')}
              </StyledButton>
              <TableDangerButton onClick={submitReject} disabled={rejectSubmitting}>
                {tt('admin.streamModeration.modal.reject.confirm')}
              </TableDangerButton>
            </ModalActions>
          </ModalCard>
        </ModalBackdrop>
      )}

      {confirmConfigOpen && (
        <ModalBackdrop>
          <ModalCard>
            <ModalTitle>{tt('admin.streamModeration.config.modal.title')}</ModalTitle>
            <ModalSubtitle>{tt('admin.streamModeration.config.modal.warning')}</ModalSubtitle>
            {configError && <StyledError>{configError}</StyledError>}
            <ModalActions>
              <StyledButton onClick={closeConfirmConfig} disabled={configSubmitting}>
                {tt('admin.streamModeration.config.modal.cancel')}
              </StyledButton>
              <TableSuccessButton onClick={submitConfig} disabled={configSubmitting}>
                {tt('admin.streamModeration.config.modal.confirm')}
              </TableSuccessButton>
            </ModalActions>
          </ModalCard>
        </ModalBackdrop>
      )}
    </div>
  );
};

export default AdminStreamModerationPanel;
