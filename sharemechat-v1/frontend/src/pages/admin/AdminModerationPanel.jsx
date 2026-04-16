import React, { useEffect, useRef, useState } from 'react';
import i18n from '../../i18n';
import {
  Badge,
  ControlsRow,
  DbLayout,
  DbTableWrap,
  FieldBlock,
  InlinePanel,
  PanelRow,
  RightInfo,
  SectionTitle,
  SmallBtn,
  StyledButton,
  DarkHeaderTable,
  TableActionButton,
  StyledError,
  StyledSelect,
  TextArea,
} from '../../styles/AdminStyles';

const FINAL_ACTIONS = new Set(['WARNING', 'SUSPEND', 'BAN']);

const AdminModerationPanel = ({ canReview = false }) => {
  const t = (key, options) => i18n.t(key, options);
  const destinationRef = useRef(null);
  const [modStatus, setModStatus] = useState('ALL');
  const [modReports, setModReports] = useState([]);
  const [modLoading, setModLoading] = useState(false);
  const [modError, setModError] = useState('');
  const [modSelectedId, setModSelectedId] = useState(null);
  const [modSaving, setModSaving] = useState(false);

  const [modReviewStatus, setModReviewStatus] = useState('REVIEWING');
  const [modReviewAction, setModReviewAction] = useState('NONE');
  const [modReviewNotes, setModReviewNotes] = useState('');

  const isFinalAction = FINAL_ACTIONS.has(String(modReviewAction || '').toUpperCase());

  const getActionHelp = (actionCode) => {
    const normalized = String(actionCode || 'NONE').toUpperCase();
    return t(`admin.moderation.actionHelp.${normalized}`, {
      defaultValue: t('admin.moderation.actionHelp.NONE'),
    });
  };

  const getStatusHelp = (statusCode) => {
    const normalized = String(statusCode || 'REVIEWING').toUpperCase();
    return t(`admin.moderation.statusHelp.${normalized}`, {
      defaultValue: t('admin.moderation.statusHelp.REVIEWING'),
    });
  };

  const scrollToDestination = () => {
    if (!destinationRef.current) return;
    window.requestAnimationFrame(() => {
      destinationRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  const loadModerationReports = async () => {
    setModLoading(true);
    setModError('');
    try {
      const qs = modStatus === 'ALL' ? '' : `?status=${encodeURIComponent(modStatus)}`;
      const res = await fetch(`/api/admin/moderation/reports${qs}`, { credentials: 'include' });
      if (!res.ok) throw new Error((await res.text()) || i18n.t('admin.moderation.errors.loadReports'));
      const data = await res.json();
      setModReports(Array.isArray(data) ? data : []);
    } catch (e) {
      setModError(e.message || i18n.t('admin.moderation.errors.loadReports'));
      setModReports([]);
    } finally {
      setModLoading(false);
    }
  };

  const loadModerationReportById = async (id) => {
    if (!id) return;
    try {
      const res = await fetch(`/api/admin/moderation/reports/${id}`, { credentials: 'include' });
      if (!res.ok) throw new Error((await res.text()) || i18n.t('admin.moderation.errors.loadReport'));
      const report = await res.json();

      const nextAction = String(report?.adminAction || 'NONE').toUpperCase();
      const nextStatusRaw = String(report?.status || 'REVIEWING').toUpperCase();
      const nextStatus = FINAL_ACTIONS.has(nextAction) ? 'RESOLVED' : nextStatusRaw;

      setModSelectedId(report?.id || null);
      setModReviewAction(nextAction);
      setModReviewStatus(nextStatus);
      setModReviewNotes(report?.resolutionNotes || '');
    } catch (e) {
      setModError(e.message || i18n.t('admin.moderation.errors.loadReport'));
    }
  };

  const handleReviewActionChange = (value) => {
    const nextAction = String(value || 'NONE').toUpperCase();
    setModReviewAction(nextAction);
    if (FINAL_ACTIONS.has(nextAction)) {
      setModReviewStatus('RESOLVED');
    }
  };

  const saveModerationReview = async () => {
    if (!canReview) return;

    const id = Number(modSelectedId);
    if (!id) return;

    const finalStatus = isFinalAction ? 'RESOLVED' : modReviewStatus;

    setModSaving(true);
    setModError('');
    try {
      const res = await fetch(`/api/admin/moderation/reports/${id}/review`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: finalStatus,
          adminAction: modReviewAction,
          resolutionNotes: modReviewNotes,
        }),
      });

      if (!res.ok) throw new Error((await res.text()) || i18n.t('admin.moderation.errors.saveReview'));

      await loadModerationReports();
      await loadModerationReportById(id);
    } catch (e) {
      setModError(e.message || i18n.t('admin.moderation.errors.saveReview'));
    } finally {
      setModSaving(false);
    }
  };

  const fmtTs = (value) => {
    if (!value) return '-';
    try {
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return String(value);
      return date.toLocaleString(i18n.resolvedLanguage || i18n.language);
    } catch {
      return String(value);
    }
  };

  useEffect(() => {
    loadModerationReports();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modStatus]);

  return (
    <div>
      <SectionTitle>{t('admin.moderation.title')}</SectionTitle>

      <div style={{ fontSize: 12, color: '#52607a', lineHeight: 1.55, marginBottom: 8, maxWidth: 980 }}>
        {t('admin.moderation.intro')}
      </div>

      <ControlsRow>
        <FieldBlock>
          <label>{t('admin.moderation.filters.status')}</label>
          <StyledSelect value={modStatus} onChange={(e) => setModStatus(e.target.value)}>
            <option value="ALL">{t('admin.moderation.filters.options.ALL')}</option>
            <option value="OPEN">{t('admin.moderation.filters.options.OPEN')}</option>
            <option value="REVIEWING">{t('admin.moderation.filters.options.REVIEWING')}</option>
            <option value="RESOLVED">{t('admin.moderation.filters.options.RESOLVED')}</option>
            <option value="REJECTED">{t('admin.moderation.filters.options.REJECTED')}</option>
          </StyledSelect>
        </FieldBlock>

        <RightInfo>
          <SmallBtn type="button" onClick={loadModerationReports} disabled={modLoading}>
            {modLoading ? t('admin.moderation.actions.loading') : t('admin.moderation.actions.refresh')}
          </SmallBtn>
        </RightInfo>
      </ControlsRow>

      {modError && <StyledError>{modError}</StyledError>}

      <DbLayout style={{ height: '72vh' }}>
        <DbTableWrap style={{ marginTop: 0 }}>
          <DarkHeaderTable style={{ marginTop: 0 }}>
            <thead>
              <tr>
                <th>{t('admin.moderation.table.id')}</th>
                <th>{t('admin.moderation.table.created')}</th>
                <th>{t('admin.moderation.table.type')}</th>
                <th>{t('admin.moderation.table.status')}</th>
                <th>{t('admin.moderation.table.action')}</th>
                <th>{t('admin.moderation.table.autoBlock')}</th>
                <th>{t('admin.moderation.table.reporter')}</th>
                <th>{t('admin.moderation.table.reported')}</th>
                <th>{t('admin.moderation.table.stream')}</th>
                <th>{t('admin.moderation.table.reviewedBy')}</th>
                <th>{t('admin.moderation.table.reviewedAt')}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {modReports.map((report) => (
                <tr key={report.id} data-selected={modSelectedId === report.id ? 'true' : undefined}>
                  <td>{report.id}</td>
                  <td>{fmtTs(report.createdAt)}</td>
                  <td><Badge>{report.reportType || '-'}</Badge></td>
                  <td><Badge data-variant={String(report.status || '').toLowerCase()}>{report.status || '-'}</Badge></td>
                  <td><strong>{report.adminAction || '-'}</strong></td>
                  <td>{report.autoBlocked ? t('admin.moderation.common.yes') : t('admin.moderation.common.no')}</td>
                  <td>{report.reporterUserId ?? '-'}</td>
                  <td>{report.reportedUserId ?? '-'}</td>
                  <td>{report.streamRecordId ?? '-'}</td>
                  <td>{report.reviewedByUserId ?? '-'}</td>
                  <td>{report.reviewedAt ? fmtTs(report.reviewedAt) : '-'}</td>
                  <td>
                    <TableActionButton
                      type="button"
                      onClick={() => {
                        scrollToDestination();
                        loadModerationReportById(report.id);
                      }}
                      title={t('admin.moderation.actions.detail')}
                    >
                      {t('admin.moderation.actions.detail')}
                    </TableActionButton>
                  </td>
                </tr>
              ))}

              {!modLoading && modReports.length === 0 && (
                <tr>
                  <td colSpan={12} style={{ color: '#6c757d' }}>{t('admin.moderation.empty')}</td>
                </tr>
              )}
            </tbody>
          </DarkHeaderTable>
        </DbTableWrap>

        <div ref={destinationRef} style={{ marginTop: 8, width: '100%', maxWidth: 1200 }}>
          <InlinePanel>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ fontWeight: 700 }}>
                {modSelectedId
                  ? t('admin.moderation.detail.selectedTitle', { id: modSelectedId })
                  : t('admin.moderation.detail.emptyTitle')}
              </div>

              {modSelectedId && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <SmallBtn type="button" onClick={() => loadModerationReportById(modSelectedId)} disabled={modSaving}>
                    {t('admin.moderation.actions.reload')}
                  </SmallBtn>
                  {canReview && (
                    <StyledButton type="button" onClick={saveModerationReview} disabled={modSaving}>
                      {modSaving ? t('admin.moderation.actions.saving') : t('admin.moderation.actions.save')}
                    </StyledButton>
                  )}
                </div>
              )}
            </div>

            {modSelectedId && (
              <>
                {!canReview && (
                  <div style={{ marginTop: 8, fontSize: 12, color: '#6c757d' }}>
                    {t('admin.moderation.readOnlySupport')}
                  </div>
                )}

                <div style={{ marginTop: 8, fontSize: 11, color: '#52607a', lineHeight: 1.55 }}>
                  {t('admin.moderation.reviewHint')}
                </div>

                <PanelRow>
                  <FieldBlock>
                    <label>{t('admin.moderation.detail.adminAction')}</label>
                    {canReview ? (
                      <StyledSelect
                        value={modReviewAction}
                        onChange={(e) => handleReviewActionChange(e.target.value)}
                      >
                        <option value="NONE">NONE</option>
                        <option value="WARNING">WARNING</option>
                        <option value="SUSPEND">SUSPEND</option>
                        <option value="BAN">BAN</option>
                      </StyledSelect>
                    ) : (
                      <div>{modReviewAction || 'NONE'}</div>
                    )}
                    <div style={{ marginTop: 6, fontSize: 11, color: '#74819a', maxWidth: 280, lineHeight: 1.5 }}>
                      {getActionHelp(modReviewAction)}
                    </div>
                  </FieldBlock>

                  <FieldBlock>
                    <label>{t('admin.moderation.detail.caseStatus')}</label>
                    {canReview ? (
                      <StyledSelect
                        value={isFinalAction ? 'RESOLVED' : modReviewStatus}
                        onChange={(e) => setModReviewStatus(e.target.value)}
                        disabled={isFinalAction}
                      >
                        {!isFinalAction && <option value="OPEN">OPEN</option>}
                        {!isFinalAction && <option value="REVIEWING">REVIEWING</option>}
                        <option value="RESOLVED">RESOLVED</option>
                        {!isFinalAction && <option value="REJECTED">REJECTED</option>}
                      </StyledSelect>
                    ) : (
                      <div>{isFinalAction ? 'RESOLVED' : modReviewStatus}</div>
                    )}
                    <div style={{ marginTop: 6, fontSize: 11, color: '#74819a', maxWidth: 280, lineHeight: 1.5 }}>
                      {getStatusHelp(isFinalAction ? 'RESOLVED' : modReviewStatus)}
                    </div>
                  </FieldBlock>
                </PanelRow>

                <FieldBlock style={{ marginTop: 10 }}>
                  <label>{t('admin.moderation.detail.notes')}</label>
                  {canReview ? (
                    <TextArea
                      value={modReviewNotes}
                      onChange={(e) => setModReviewNotes(e.target.value)}
                      placeholder={t('admin.moderation.detail.notesPlaceholder')}
                    />
                  ) : (
                    <div style={{ whiteSpace: 'pre-wrap', minHeight: 72 }}>
                      {modReviewNotes || t('admin.moderation.detail.noNotes')}
                    </div>
                  )}
                </FieldBlock>
              </>
            )}
          </InlinePanel>
        </div>
      </DbLayout>
    </div>
  );
};

export default AdminModerationPanel;
