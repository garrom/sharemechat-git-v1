import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '../../i18n';
import styled from 'styled-components';
import {
  CardsGrid,
  ControlsRow,
  FieldBlock,
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
  TextArea,
  TableSuccessButton,
} from '../../styles/AdminStyles';

// ----------------------------------------------------------------------
// Constantes del panel
// ----------------------------------------------------------------------

const REASON_CODES = [
  'LIGHTING',
  'QUALITY',
  'EXPLICIT',
  'FACE_NOT_VISIBLE',
  'IDENTITY_MISMATCH',
  'WATERMARK',
  'THIRD_PARTIES',
  'CONTACT_INFO',
  'INVALID_FORMAT',
  'OTHER',
];

const STATUS_OPTION_VALUES = ['PENDING_REVIEW', 'APPROVED', 'REJECTED', 'CANCELLED'];

const getStatusOptions = (tt) => [
  { value: 'PENDING_REVIEW', label: tt('admin.common.status.pending') },
  { value: 'APPROVED', label: tt('admin.common.status.approved') },
  { value: 'REJECTED', label: tt('admin.common.status.rejected') },
  { value: 'CANCELLED', label: tt('admin.assetModeration.statusLabels.CANCELLED') },
];

const getStatusLabel = (tt) => ({
  PENDING_REVIEW: tt('admin.common.status.pending'),
  APPROVED: tt('admin.common.status.approved'),
  REJECTED: tt('admin.common.status.rejected'),
  CANCELLED: tt('admin.assetModeration.statusLabels.CANCELLED'),
});

const getAssetLabel = (tt) => ({
  PIC: tt('admin.assetModeration.assetTypes.PIC'),
  VIDEO: tt('admin.assetModeration.assetTypes.VIDEO'),
});

// ----------------------------------------------------------------------
// Estilos locales (siguen estética de AdminModelsPanel)
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

const ThumbWrap = styled.button`
  appearance: none;
  border: 1px solid #d6dde5;
  background: #f8fafc;
  padding: 0;
  border-radius: 6px;
  overflow: hidden;
  cursor: pointer;
  width: 64px;
  height: 64px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: border-color 120ms ease;

  &:hover {
    border-color: #1e3a8a;
  }

  & > img,
  & > video {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
`;

const ModalBackdrop = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(20, 30, 45, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  padding: 24px;
`;

const ModalCard = styled.div`
  background: #fff;
  border: 1px solid #d6dde5;
  border-radius: 10px;
  width: 100%;
  max-width: 520px;
  padding: 22px 24px;
  box-shadow: 0 16px 38px rgba(20, 30, 45, 0.25);
`;

const ModalTitle = styled.h3`
  margin: 0 0 6px;
  font-size: 1.1rem;
  color: #162033;
`;

const ModalSubtitle = styled.div`
  font-size: 0.85rem;
  color: #52607a;
  margin-bottom: 16px;
  line-height: 1.4;
`;

const ModalActions = styled.div`
  display: flex;
  gap: 10px;
  justify-content: flex-end;
  margin-top: 18px;
`;

const RejectionReasonText = styled.div`
  font-size: 0.85rem;
  color: #b91c1c;
  margin-top: 4px;
  line-height: 1.4;
  max-width: 360px;
`;

// ----------------------------------------------------------------------
// Componente principal
// ----------------------------------------------------------------------

const AdminAssetModerationPanel = ({ canModerate = false, canRejectApproved = false }) => {
  const { t } = useTranslation();
  const tt = (key, options) => i18n.t(key, options);
  const STATUS_OPTIONS = useMemo(() => getStatusOptions(tt), [t]);
  const STATUS_LABEL = useMemo(() => getStatusLabel(tt), [t]);
  const ASSET_LABEL = useMemo(() => getAssetLabel(tt), [t]);

  const [items, setItems] = useState([]);
  const [stats, setStats] = useState({ pendingReview: 0, approved: 0, rejected: 0 });
  const [statusFilter, setStatusFilter] = useState('PENDING_REVIEW');
  const [pageSize, setPageSize] = useState(20);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Modal de rechazo
  const [rejectTarget, setRejectTarget] = useState(null); // { id, email, assetType }
  const [rejectReasonCode, setRejectReasonCode] = useState('');
  const [rejectReasonText, setRejectReasonText] = useState('');
  const [rejectSubmitting, setRejectSubmitting] = useState(false);
  const [rejectError, setRejectError] = useState('');

  // ------------------------------------------------------------------
  // Carga de datos
  // ------------------------------------------------------------------

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const qs = statusFilter ? `?status=${encodeURIComponent(statusFilter)}` : '';
      const [queueRes, statsRes] = await Promise.all([
        fetch(`/api/admin/model-assets/queue${qs}`, { credentials: 'include' }),
        fetch('/api/admin/model-assets/stats', { credentials: 'include' }),
      ]);

      if (!queueRes.ok) throw new Error((await queueRes.text()) || tt('admin.assetModeration.errors.loadQueue'));
      if (!statsRes.ok) throw new Error((await statsRes.text()) || tt('admin.assetModeration.errors.loadStats'));

      const rows = await queueRes.json();
      const s = await statsRes.json();

      setItems(Array.isArray(rows) ? rows : []);
      setStats({
        pendingReview: Number(s?.pendingReview) || 0,
        approved: Number(s?.approved) || 0,
        rejected: Number(s?.rejected) || 0,
      });
    } catch (err) {
      setError(err.message || tt('admin.assetModeration.errors.loadData'));
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ------------------------------------------------------------------
  // Acciones
  // ------------------------------------------------------------------

  const handleApprove = async (reviewId) => {
    if (!canModerate) return;
    try {
      const res = await fetch(`/api/admin/model-assets/${reviewId}/approve`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) throw new Error((await res.text()) || tt('admin.assetModeration.errors.approve'));
      await fetchData();
    } catch (err) {
      setError(err.message || tt('admin.assetModeration.errors.approve'));
    }
  };

  const openRejectModal = (row, mode = 'pending') => {
    // mode: 'pending' (PENDING_REVIEW → REJECTED) o 'retroactive'
    // (APPROVED → genera fila REJECTED nueva + desactiva asset).
    if (mode === 'retroactive') {
      if (!canRejectApproved) return;
    } else if (!canModerate) {
      return;
    }
    setRejectTarget({ id: row.id, email: row.email, assetType: row.assetType, mode });
    setRejectReasonCode('');
    setRejectReasonText('');
    setRejectError('');
  };

  const closeRejectModal = () => {
    if (rejectSubmitting) return;
    setRejectTarget(null);
    setRejectReasonCode('');
    setRejectReasonText('');
    setRejectError('');
  };

  const submitReject = async () => {
    if (!rejectTarget) return;
    if (!rejectReasonCode) {
      setRejectError(tt('admin.assetModeration.errors.reasonRequired'));
      return;
    }
    if (rejectReasonCode === 'OTHER' && !rejectReasonText.trim()) {
      setRejectError(tt('admin.assetModeration.errors.detailRequiredOther'));
      return;
    }
    setRejectSubmitting(true);
    setRejectError('');
    try {
      const endpointPath = rejectTarget.mode === 'retroactive'
        ? `/api/admin/model-assets/${rejectTarget.id}/reject-retroactive`
        : `/api/admin/model-assets/${rejectTarget.id}/reject`;
      const res = await fetch(endpointPath, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reasonCode: rejectReasonCode,
          reasonText: rejectReasonText.trim() || null,
        }),
      });
      if (!res.ok) throw new Error((await res.text()) || tt('admin.assetModeration.errors.reject'));
      setRejectTarget(null);
      setRejectReasonCode('');
      setRejectReasonText('');
      await fetchData();
    } catch (err) {
      setRejectError(err.message || tt('admin.assetModeration.errors.reject'));
    } finally {
      setRejectSubmitting(false);
    }
  };

  // ------------------------------------------------------------------
  // Helpers de render
  // ------------------------------------------------------------------

  const displayedItems = useMemo(
    () => items.slice(0, Number(pageSize)),
    [items, pageSize]
  );

  const reasonLabel = (code) => {
    if (!code) return '-';
    return t(`admin.assetModeration.reasons.${code}`, { defaultValue: code });
  };

  const renderPreview = (row) => {
    const url = row.assetUrl;
    if (!url) return <span style={{ color: '#9aa3b2' }}>-</span>;
    const isVideo = row.assetType === 'VIDEO';
    return (
      <ThumbWrap
        type="button"
        onClick={() => window.open(url, '_blank', 'noopener,noreferrer')}
        title={isVideo ? tt('admin.assetModeration.tooltips.openVideo') : tt('admin.assetModeration.tooltips.openPhoto')}
      >
        {isVideo ? (
          // `#t=0.1` fuerza al navegador a renderizar el primer frame visible
          <video src={`${url}#t=0.1`} preload="metadata" muted />
        ) : (
          <img src={url} alt="" />
        )}
      </ThumbWrap>
    );
  };

  const formatTimestamp = (iso) => {
    if (!iso) return '-';
    try {
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return iso;
      return d.toLocaleString();
    } catch {
      return iso;
    }
  };

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------

  return (
    <>
      <SectionTitle>{tt('admin.assetModeration.title')}</SectionTitle>

      <div style={{ fontSize: 12, color: '#52607a', lineHeight: 1.55, marginBottom: 8, maxWidth: 980 }}>
        {tt('admin.assetModeration.descriptions.intro')}
      </div>

      <CardsGrid style={{ marginBottom: 10 }}>
        <StatCard>
          <div className="label">{tt('admin.common.stats.pending')}</div>
          <div className="value">{stats.pendingReview}</div>
          <div className="meta">{tt('admin.assetModeration.descriptions.pendingMeta')}</div>
        </StatCard>
        <StatCard>
          <div className="label">{tt('admin.common.stats.approved')}</div>
          <div className="value">{stats.approved}</div>
          <div className="meta">{tt('admin.assetModeration.descriptions.approvedMeta')}</div>
        </StatCard>
        <StatCard>
          <div className="label">{tt('admin.common.stats.rejected')}</div>
          <div className="value">{stats.rejected}</div>
          <div className="meta">{tt('admin.assetModeration.descriptions.rejectedMeta')}</div>
        </StatCard>
      </CardsGrid>

      <ControlsRow>
        <FieldBlock>
          <label>{tt('admin.common.columns.status')}</label>
          <StyledSelect value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </StyledSelect>
        </FieldBlock>

        <FieldBlock>
          <label>{tt('admin.common.labels.results')}</label>
          <StyledSelect value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))}>
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={30}>30</option>
            <option value={40}>40</option>
            <option value={50}>50</option>
          </StyledSelect>
        </FieldBlock>

        <RightInfo>
          <SmallBtn type="button" onClick={fetchData} disabled={loading}>
            {loading ? tt('admin.common.status.refreshing') : tt('admin.common.buttons.refresh')}
          </SmallBtn>
        </RightInfo>
      </ControlsRow>

      {loading && <div style={{ fontSize: 12, color: '#52607a' }}>{tt('admin.assetModeration.empty.loading')}</div>}
      {error && <StyledError>{error}</StyledError>}

      <div style={{ overflowX: 'auto' }}>
        <QueueTable style={{ marginTop: 0 }}>
          <thead>
            <tr>
              <th>{tt('admin.common.columns.id')}</th>
              <th>{tt('admin.common.columns.model')}</th>
              <th>{tt('admin.common.columns.type')}</th>
              <th>{tt('admin.common.columns.preview')}</th>
              <th>{tt('admin.common.columns.uploaded')}</th>
              <th>{tt('admin.common.columns.status')}</th>
              <th>{tt('admin.common.columns.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {displayedItems.length === 0 && !loading && (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', color: '#6c757d', padding: 16 }}>
                  {tt('admin.assetModeration.empty.noReviews')}
                </td>
              </tr>
            )}
            {displayedItems.map((row) => {
              const isPending = row.status === 'PENDING_REVIEW';
              return (
                <tr key={row.id}>
                  <td>{row.id}</td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{row.email}</div>
                    {row.nickname && row.nickname !== row.email && (
                      <div style={{ fontSize: 11, color: '#74819a' }}>{row.nickname}</div>
                    )}
                    <div style={{ fontSize: 11, color: '#9aa3b2' }}>userId: {row.userId}</div>
                  </td>
                  <td>{ASSET_LABEL[row.assetType] || row.assetType}</td>
                  <td>{renderPreview(row)}</td>
                  <td style={{ fontSize: 12 }}>{formatTimestamp(row.uploadedAt)}</td>
                  <td>
                    <strong>{STATUS_LABEL[row.status] || row.status}</strong>
                    {row.status === 'REJECTED' && row.rejectionReasonCode && (
                      <RejectionReasonText>
                        {reasonLabel(row.rejectionReasonCode)}
                        {row.rejectionReasonText && (
                          <>
                            <br />
                            <em>{row.rejectionReasonText}</em>
                          </>
                        )}
                      </RejectionReasonText>
                    )}
                  </td>
                  <td>
                    {isPending && canModerate && (
                      <TableActionGroup>
                        <TableSuccessButton
                          onClick={() => handleApprove(row.id)}
                          title={tt('admin.assetModeration.tooltips.approve')}
                        >
                          {tt('admin.common.buttons.approve')}
                        </TableSuccessButton>
                        <TableDangerButton
                          onClick={() => openRejectModal(row, 'pending')}
                          title={tt('admin.assetModeration.tooltips.rejectWithReason')}
                        >
                          {tt('admin.common.buttons.reject')}
                        </TableDangerButton>
                      </TableActionGroup>
                    )}
                    {isPending && !canModerate && (
                      <span style={{ color: '#6c757d' }}>{tt('admin.assetModeration.empty.readOnly')}</span>
                    )}
                    {!isPending && row.status === 'APPROVED' && canRejectApproved && (
                      <TableActionGroup>
                        <TableDangerButton
                          onClick={() => openRejectModal(row, 'retroactive')}
                          title={tt('admin.assetModeration.tooltips.rejectRetroactive')}
                        >
                          {tt('admin.assetModeration.buttons.rejectRetroactive')}
                        </TableDangerButton>
                      </TableActionGroup>
                    )}
                    {!isPending && !(row.status === 'APPROVED' && canRejectApproved) && (
                      <span style={{ color: '#9aa3b2' }}>—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </QueueTable>
      </div>

      {rejectTarget && (
        <ModalBackdrop onClick={closeRejectModal}>
          <ModalCard onClick={(e) => e.stopPropagation()}>
            <ModalTitle>
              {rejectTarget.mode === 'retroactive'
                ? tt('admin.assetModeration.confirmations.modalTitleRetroactive')
                : tt('admin.assetModeration.confirmations.modalTitle')}
            </ModalTitle>
            <ModalSubtitle>
              {ASSET_LABEL[rejectTarget.assetType] || rejectTarget.assetType} {tt('admin.assetModeration.confirmations.ofModel')}{' '}<strong>{rejectTarget.email}</strong>.{' '}
              {rejectTarget.mode === 'retroactive'
                ? tt('admin.assetModeration.confirmations.subtitleRetroactive')
                : tt('admin.assetModeration.confirmations.subtitlePending')}
            </ModalSubtitle>

            <FieldBlock style={{ marginBottom: 12 }}>
              <label>{tt('admin.assetModeration.fields.reason')}</label>
              <StyledSelect
                value={rejectReasonCode}
                onChange={(e) => setRejectReasonCode(e.target.value)}
                disabled={rejectSubmitting}
              >
                <option value="">{tt('admin.assetModeration.fields.selectPlaceholder')}</option>
                {REASON_CODES.map((code) => (
                  <option key={code} value={code}>
                    {reasonLabel(code)}
                  </option>
                ))}
              </StyledSelect>
            </FieldBlock>

            {rejectReasonCode === 'OTHER' && (
              <FieldBlock style={{ marginBottom: 12 }}>
                <label>{tt('admin.assetModeration.fields.detailOther')}</label>
                <TextArea
                  rows={3}
                  value={rejectReasonText}
                  onChange={(e) => setRejectReasonText(e.target.value)}
                  placeholder={tt('admin.assetModeration.fields.detailPlaceholder')}
                  disabled={rejectSubmitting}
                  maxLength={500}
                />
              </FieldBlock>
            )}

            {rejectReasonCode && rejectReasonCode !== 'OTHER' && (
              <FieldBlock style={{ marginBottom: 12 }}>
                <label>{tt('admin.assetModeration.fields.extraNote')}</label>
                <TextArea
                  rows={2}
                  value={rejectReasonText}
                  onChange={(e) => setRejectReasonText(e.target.value)}
                  placeholder={tt('admin.assetModeration.fields.extraNotePlaceholder')}
                  disabled={rejectSubmitting}
                  maxLength={500}
                />
              </FieldBlock>
            )}

            {rejectError && <StyledError>{rejectError}</StyledError>}

            <ModalActions>
              <SmallBtn type="button" onClick={closeRejectModal} disabled={rejectSubmitting}>
                {tt('admin.common.buttons.cancel')}
              </SmallBtn>
              <StyledButton
                onClick={submitReject}
                disabled={rejectSubmitting || !rejectReasonCode}
              >
                {rejectSubmitting ? tt('admin.common.status.submitting') : tt('admin.assetModeration.buttons.confirmReject')}
              </StyledButton>
            </ModalActions>
          </ModalCard>
        </ModalBackdrop>
      )}
    </>
  );
};

export default AdminAssetModerationPanel;
