import React, { useEffect, useMemo, useState } from 'react';
import styled from 'styled-components';
import i18n from '../../i18n';
import {
  CardsGrid,
  CheckBox,
  ControlsRow,
  DocGrid,
  DocLink,
  FieldBlock,
  InlinePanel,
  RightInfo,
  SectionTitle,
  SmallBtn,
  StatCard,
  StyledButton,
  DarkHeaderTable,
  TableActionGroup,
  TableDangerButton,
  StyledError,
  StyledSelect,
  TableSuccessButton,
} from '../../styles/AdminStyles';

const ModelsTable = styled(DarkHeaderTable)`
  border: 1px solid #b4beca;

  tbody tr td {
    background: #fff !important;
    border-bottom-color: #d6dde5;
  }

  tbody tr:hover td {
    background: #f1f4f7 !important;
  }
`;

const AdminModelsPanel = ({
  canReadKycMode = false,
  canUpdateChecklist = false,
  canReviewModels = false,
  canChangeKycMode = false,
  canViewSensitiveDocs = false,
}) => {
  const t = (key, options) => i18n.t(key, options);
  const [users, setUsers] = useState([]);
  const [statusFilter, setStatusFilter] = useState('ACTIVE');
  const [pageSize, setPageSize] = useState(10);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [kycCfgLoading, setKycCfgLoading] = useState(false);
  const [kycCfgSaving, setKycCfgSaving] = useState(false);
  const [kycCfgError, setKycCfgError] = useState('');
  const [kycCfg, setKycCfg] = useState(null);
  const [kycModeDraft, setKycModeDraft] = useState('DIDIT');

  const [docsByUser, setDocsByUser] = useState({});
  const [checksByUser, setChecksByUser] = useState({});
  const [savingCheckKey, setSavingCheckKey] = useState(null);

  const loadModelDocs = async (userId) => {
    if (!canViewSensitiveDocs) return;

    try {
      const res = await fetch(`/api/admin/model-docs/${userId}`, {
        credentials: 'include',
      });
      if (!res.ok) return;

      const data = await res.json();
      setDocsByUser((prev) => ({
        ...prev,
        [userId]: {
          urlVerificFront: data.urlVerificFront || null,
          urlVerificBack: data.urlVerificBack || null,
          urlVerificDoc: data.urlVerificDoc || null,
        },
      }));

      const checklist = data.checklist || {};
      setChecksByUser((prev) => ({
        ...prev,
        [userId]: {
          frontOk: !!checklist.frontOk,
          backOk: !!checklist.backOk,
          selfieOk: !!checklist.selfieOk,
        },
      }));
    } catch {
      // noop
    }
  };

  const updateCheck = async (userId, field, value) => {
    if (!canUpdateChecklist) return;

    setChecksByUser((prev) => ({ ...prev, [userId]: { ...prev[userId], [field]: value } }));
    setSavingCheckKey(`${userId}:${field}`);

    try {
      const res = await fetch(`/api/admin/model-checklist/${userId}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value }),
      });
      if (!res.ok) throw new Error((await res.text()) || t('admin.models.errors.savingChecklist'));

      const data = await res.json();
      setChecksByUser((prev) => ({
        ...prev,
        [userId]: {
          frontOk: !!data.frontOk,
          backOk: !!data.backOk,
          selfieOk: !!data.selfieOk,
        },
      }));
    } catch (e) {
      alert(e.message || t('admin.models.errors.couldNotSaveCheck'));
      setChecksByUser((prev) => ({ ...prev, [userId]: { ...prev[userId], [field]: !value } }));
    } finally {
      setSavingCheckKey(null);
    }
  };

  const canApprove = (userId) => {
    const docs = docsByUser[userId] || {};
    const checks = checksByUser[userId] || {};
    const hasFront = !!docs.urlVerificFront;
    const hasBack = !!docs.urlVerificBack;
    const hasSelfie = !!docs.urlVerificDoc;
    return hasFront && hasBack && hasSelfie && !!checks.frontOk && !!checks.backOk && !!checks.selfieOk;
  };

  const fetchUsers = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/admin/models', {
        credentials: 'include',
      });
      if (!response.ok) throw new Error((await response.text()) || t('admin.models.errors.loadingModels'));

      const data = await response.json();
      const rows = Array.isArray(data) ? data : [];
      setUsers(rows);
      setChecksByUser((prev) => {
        const next = { ...prev };
        rows.forEach((user) => {
          if (!user?.id) return;
          next[user.id] = {
            frontOk: !!user.modelChecklistFrontOk,
            backOk: !!user.modelChecklistBackOk,
            selfieOk: !!user.modelChecklistSelfieOk,
          };
        });
        return next;
      });
    } catch (err) {
      setError(err.message || t('admin.models.errors.loadingData'));
    } finally {
      setLoading(false);
    }
  };

  const loadKycConfig = async () => {
    if (!canReadKycMode) return;

    setKycCfgLoading(true);
    setKycCfgError('');
    try {
      const res = await fetch('/api/kyc/config/model-onboarding', {
        credentials: 'include',
      });
      if (!res.ok) throw new Error((await res.text()) || t('admin.models.errors.loadingKycConfig'));
      const data = await res.json();
      setKycCfg(data || null);
      setKycModeDraft((data?.activeMode || 'DIDIT').toUpperCase());
    } catch (e) {
      setKycCfgError(e.message || t('admin.models.errors.loadingKycConfig'));
      setKycCfg(null);
    } finally {
      setKycCfgLoading(false);
    }
  };

  const saveKycMode = async () => {
    if (!canChangeKycMode) return;

    setKycCfgSaving(true);
    setKycCfgError('');
    try {
      const res = await fetch('/api/admin/kyc/model-onboarding/mode', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: kycModeDraft,
          note: t('admin.models.descriptions.kycModeChangeNote', { mode: kycModeDraft }),
        }),
      });
      if (!res.ok) throw new Error((await res.text()) || t('admin.models.errors.savingKycMode'));
      await loadKycConfig();
    } catch (e) {
      setKycCfgError(e.message || t('admin.models.errors.savingKycMode'));
    } finally {
      setKycCfgSaving(false);
    }
  };

  const handleReview = async (userId, action) => {
    if (!canReviewModels) return;

    if (action === 'REJECT') {
      const ok = window.confirm(t('admin.models.confirmations.rejectVerification'));
      if (!ok) return;
    }

    if (action === 'REPEAT') {
      const ok = window.confirm(t('admin.models.confirmations.repeatVerification'));
      if (!ok) return;
    }

    try {
      const response = await fetch(`/api/admin/review/${userId}?action=${action}`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!response.ok) throw new Error((await response.text()) || t('admin.models.errors.updatingVerification'));
      const message = await response.text();
      alert(message || t('admin.models.success.statusUpdated'));
      fetchUsers();
    } catch (err) {
      setError(err.message || t('admin.models.errors.updatingStatus'));
    }
  };

  useEffect(() => {
    fetchUsers();
    loadKycConfig();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!canViewSensitiveDocs) return;

    const ids = (users || [])
      .filter((user) => (user.verificationStatus || 'PENDING') === 'PENDING' && !!user.id)
      .map((user) => user.id);

    ids.forEach((id) => {
      if (docsByUser[id] === undefined) {
        loadModelDocs(id);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [users, canViewSensitiveDocs]);

  const filteredUsers = useMemo(() => {
    if (statusFilter === 'ALL') return users;
    if (statusFilter === 'ACTIVE') {
      return users.filter((user) => {
        const verification = String(user?.verificationStatus || 'PENDING').toUpperCase();
        const isUnsubscribed =
          String(user?.unsubscribe).toLowerCase() === 'true' || String(user?.unsubscribe) === '1';
        return verification === 'APPROVED' && !isUnsubscribed;
      });
    }
    return users.filter((user) => (user.verificationStatus || 'PENDING') === statusFilter);
  }, [users, statusFilter]);

  const displayedUsers = useMemo(
    () => filteredUsers.slice(0, Number(pageSize)),
    [filteredUsers, pageSize]
  );

  const statusSummary = useMemo(() => {
    const summary = { total: users.length, pending: 0, approved: 0, rejected: 0 };
    users.forEach((user) => {
      const status = String(user?.verificationStatus || 'PENDING').toUpperCase();
      if (status === 'APPROVED') summary.approved += 1;
      else if (status === 'REJECTED') summary.rejected += 1;
      else summary.pending += 1;
    });
    return summary;
  }, [users]);

  const renderChecklistCell = (user) => {
    const checks = checksByUser[user.id] || {};
    const docs = docsByUser[user.id] || {};

    const items = [
      { label: t('admin.models.checklist.front'), fieldKey: 'frontOk', url: docs.urlVerificFront },
      { label: t('admin.models.checklist.back'), fieldKey: 'backOk', url: docs.urlVerificBack },
      { label: t('admin.models.checklist.selfie'), fieldKey: 'selfieOk', url: docs.urlVerificDoc },
    ];

    return (
      <DocGrid>
        {items.map(({ label, fieldKey, url }) => {
          const saving = savingCheckKey === `${user.id}:${fieldKey}`;
          const content = canViewSensitiveDocs ? (
            <DocLink
              href={url || '#'}
              target="_blank"
              rel="noreferrer"
              $disabled={!url}
              onClick={(e) => {
                if (!url) e.preventDefault();
              }}
              title={url ? t('admin.models.descriptions.openDocumentTooltip') : t('admin.models.descriptions.documentNotAvailableTooltip')}
            >
              {label}
            </DocLink>
          ) : (
            <span>{label}</span>
          );

          return (
            <div key={fieldKey} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {content}
              <CheckBox
                type="checkbox"
                disabled={!canUpdateChecklist || saving}
                checked={!!checks[fieldKey]}
                onChange={(e) => updateCheck(user.id, fieldKey, e.target.checked)}
                title={canUpdateChecklist ? t('admin.models.descriptions.markAsValidatedTooltip') : t('admin.models.descriptions.noPermissionChecklistTooltip')}
              />
            </div>
          );
        })}
      </DocGrid>
    );
  };

  return (
    <>
      <SectionTitle>{t('admin.models.title')}</SectionTitle>

      <div style={{ fontSize: 12, color: '#52607a', lineHeight: 1.55, marginBottom: 8, maxWidth: 980 }}>
        {t('admin.models.descriptions.panelIntro')}
      </div>

      <CardsGrid style={{ marginBottom: 10 }}>
        <StatCard>
          <div className="label">{t('admin.common.stats.totalVisible')}</div>
          <div className="value">{statusSummary.total}</div>
          <div className="meta">{t('admin.models.descriptions.totalMeta')}</div>
        </StatCard>
        <StatCard>
          <div className="label">{t('admin.common.stats.pending')}</div>
          <div className="value">{statusSummary.pending}</div>
          <div className="meta">{t('admin.models.descriptions.pendingMeta')}</div>
        </StatCard>
        <StatCard>
          <div className="label">{t('admin.common.stats.approved')}</div>
          <div className="value">{statusSummary.approved}</div>
          <div className="meta">{t('admin.models.descriptions.approvedMeta')}</div>
        </StatCard>
        <StatCard>
          <div className="label">{t('admin.common.stats.rejected')}</div>
          <div className="value">{statusSummary.rejected}</div>
          <div className="meta">{t('admin.models.descriptions.rejectedMeta')}</div>
        </StatCard>
      </CardsGrid>

      {canReadKycMode && (
        <InlinePanel style={{ maxWidth: 1200, marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, color: '#162033' }}>
                {t('admin.models.kyc.title')}
              </div>
              <div style={{ marginTop: 4, fontSize: 12, color: '#52607a', lineHeight: 1.5, maxWidth: 720 }}>
                {t('admin.models.descriptions.kycConfigIntro')}
              </div>
            </div>
          </div>

          {kycCfgError && <StyledError>{kycCfgError}</StyledError>}

          {canChangeKycMode ? (
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end', marginTop: 10 }}>
              <FieldBlock>
                <label>{t('admin.models.kyc.modeLabel')}</label>
                <StyledSelect
                  value={kycModeDraft}
                  onChange={(e) => setKycModeDraft(e.target.value)}
                  disabled={kycCfgLoading || kycCfgSaving}
                >
                  <option value="MANUAL">{t('admin.models.kyc.optionManual')}</option>
                  <option value="DIDIT">{t('admin.models.kyc.optionDidit')}</option>
                </StyledSelect>
              </FieldBlock>

              <StyledButton onClick={saveKycMode} disabled={kycCfgLoading || kycCfgSaving}>
                {kycCfgSaving ? t('admin.common.status.saving') : t('admin.models.kyc.saveMode')}
              </StyledButton>
            </div>
          ) : (
            <div style={{ marginTop: 10, fontSize: 12, color: '#6c757d' }}>
              {t('admin.models.descriptions.kycReadOnlyInfo')}
            </div>
          )}

          <div style={{ marginTop: 10, fontSize: 12, color: '#6c757d', lineHeight: 1.5 }}>
            <div>
              <strong>{t('admin.models.kyc.currentLabel')}:</strong> {kycCfg?.activeMode || '-'}
            </div>
            <div>
              <strong>manualEnabled:</strong> {String(kycCfg?.manualEnabled ?? '-')} |{' '}
              <strong>diditEnabled:</strong> {String(kycCfg?.diditEnabled ?? '-')}
            </div>
            {String(kycCfg?.activeMode || '').toUpperCase() === 'VERIFF' && (
              <div style={{ marginTop: 6, color: '#b00020' }}>
                {t('admin.models.kyc.veriffLegacyWarning')}
              </div>
            )}
          </div>
        </InlinePanel>
      )}

      <ControlsRow>
        <FieldBlock>
          <label>{t('admin.common.columns.status')}</label>
          <StyledSelect value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="ALL">{t('admin.common.labels.all')}</option>
            <option value="ACTIVE">{t('admin.models.filters.statusActive')}</option>
            <option value="PENDING">{t('admin.common.status.pending')}</option>
            <option value="APPROVED">{t('admin.common.status.approved')}</option>
            <option value="REJECTED">{t('admin.common.status.rejected')}</option>
          </StyledSelect>
        </FieldBlock>

        <FieldBlock>
          <label>{t('admin.common.labels.results')}</label>
          <StyledSelect value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))}>
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={30}>30</option>
            <option value={40}>40</option>
            <option value={50}>50</option>
          </StyledSelect>
        </FieldBlock>

        <RightInfo>
          <SmallBtn type="button" onClick={fetchUsers} disabled={loading}>
            {loading ? t('admin.common.status.refreshing') : t('admin.common.buttons.refresh')}
          </SmallBtn>
        </RightInfo>
      </ControlsRow>

      {loading && <div style={{ fontSize: 12, color: '#52607a' }}>{t('admin.common.status.loading')}</div>}
      {error && <StyledError>{error}</StyledError>}

      <div style={{ overflowX: 'auto' }}>
        <ModelsTable style={{ marginTop: 0 }}>
          <thead>
            <tr>
              <th>{t('admin.common.columns.id')}</th>
              <th>{t('admin.common.columns.email')}</th>
              <th>{t('admin.common.columns.role')}</th>
              <th>{t('admin.common.columns.type')}</th>
              <th>{t('admin.common.columns.verification')}</th>
              <th>{t('admin.common.columns.account')}</th>
              <th>{t('admin.common.columns.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {displayedUsers.map((user) => {
              const verification = user.verificationStatus || 'PENDING';

              if (!user.id) {
                return (
                  <tr key={user.email || Math.random()}>
                    <td>-</td>
                    <td>{user.email}</td>
                    <td>{user.role}</td>
                    <td>{user.userType}</td>
                    <td>{verification}</td>
                    <td>{String(user?.unsubscribe).toLowerCase() === 'true' || String(user?.unsubscribe) === '1' ? t('admin.models.pills.unsubscribed') : t('admin.models.pills.subscribed')}</td>
                    <td>
                      <span style={{ color: '#dc3545' }}>{t('admin.models.pills.invalidId')}</span>
                    </td>
                  </tr>
                );
              }

              return (
                <tr key={user.id}>
                  <td>{user.id}</td>
                  <td>{user.email}</td>
                  <td>{user.role}</td>
                  <td>{user.userType}</td>
                  <td>
                    <strong>{verification}</strong>
                    {verification === 'PENDING' && (
                      <div style={{ fontSize: 11, color: '#74819a', marginTop: 4 }}>
                        {t('admin.models.descriptions.pendingRowHint')}
                      </div>
                    )}
                  </td>
                  <td>{String(user?.unsubscribe).toLowerCase() === 'true' || String(user?.unsubscribe) === '1' ? t('admin.models.pills.unsubscribed') : t('admin.models.pills.subscribed')}</td>
                  <td>
                    {verification === 'PENDING' && canUpdateChecklist && renderChecklistCell(user)}

                    {verification === 'PENDING' && canReviewModels && (
                      <TableActionGroup>
                        <TableSuccessButton
                          onClick={() => handleReview(user.id, 'APPROVE')}
                          disabled={!canApprove(user.id)}
                          title={!canApprove(user.id) ? t('admin.models.descriptions.approveTooltipDisabled') : t('admin.models.descriptions.approveTooltipEnabled')}
                        >
                          {t('admin.common.buttons.approve')}
                        </TableSuccessButton>

                        <TableDangerButton
                          onClick={() => handleReview(user.id, 'REJECT')}
                        >
                          {t('admin.common.buttons.reject')}
                        </TableDangerButton>
                      </TableActionGroup>
                    )}

                    {verification === 'APPROVED' && String(user.role || '').toUpperCase() === 'USER' && canReviewModels && (
                      <TableActionGroup>
                        <TableSuccessButton
                          onClick={() => handleReview(user.id, 'APPROVE')}
                          title={t('admin.models.descriptions.promoteToModelTooltip')}
                        >
                          {t('admin.models.actions.promoteToModel')}
                        </TableSuccessButton>
                        <SmallBtn
                          onClick={() => handleReview(user.id, 'REPEAT')}
                          title={t('admin.models.descriptions.repeatTooltip')}
                        >
                          {t('admin.models.actions.repeat')}
                        </SmallBtn>
                        <TableDangerButton onClick={() => handleReview(user.id, 'REJECT')}>
                          {t('admin.common.buttons.reject')}
                        </TableDangerButton>
                      </TableActionGroup>
                    )}

                    {verification === 'APPROVED' && String(user.role || '').toUpperCase() === 'MODEL' && canReviewModels && (
                      <TableActionGroup>
                        <TableDangerButton onClick={() => handleReview(user.id, 'REJECT')}>
                          {t('admin.common.buttons.reject')}
                        </TableDangerButton>
                      </TableActionGroup>
                    )}

                    {verification === 'REJECTED' && canReviewModels && (
                      <TableActionGroup>
                        <SmallBtn
                          onClick={() => handleReview(user.id, 'REPEAT')}
                          title={t('admin.models.descriptions.repeatTooltip')}
                        >
                          {t('admin.models.actions.repeat')}
                        </SmallBtn>
                      </TableActionGroup>
                    )}
                    {verification === 'REJECTED' && !canReviewModels && (
                      <span style={{ color: '#dc3545', fontWeight: 'bold' }}>{t('admin.models.descriptions.permanentlyRejected')}</span>
                    )}

                    {!canUpdateChecklist && !canReviewModels && verification !== 'REJECTED' && (
                      <span style={{ color: '#6c757d' }}>{t('admin.models.pills.readOnly')}</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </ModelsTable>
      </div>
    </>
  );
};

export default AdminModelsPanel;
