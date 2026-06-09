import React, { useEffect, useMemo, useRef, useState } from 'react';
import styled from 'styled-components';
import i18n from '../../i18n';
import { apiFetch } from '../../config/http';
import {
  Badge,
  ControlsRow,
  FieldBlock,
  InlinePanel,
  RightInfo,
  SmallBtn,
  StyledButton,
  DarkHeaderTable,
  TableActionButton,
  TableActionGroup,
  StyledError,
  StyledInput,
  StyledSelect,
} from '../../styles/AdminStyles';
import AdminDbPanel from './AdminDbPanel';

const PanelTabButton = styled(SmallBtn)`
  padding: 6px 10px;
  border: 1px solid ${({ $active }) => ($active ? '#c7d4e2' : '#465568')};
  background: ${({ $active }) => ($active ? '#eef4fb' : '#334255')};
  color: ${({ $active }) => ($active ? '#18212f' : '#eef3f8')};
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;

  &:hover:not(:disabled) {
    background: ${({ $active }) => ($active ? '#eef4fb' : '#e6eef8')};
    border-color: ${({ $active }) => ($active ? '#c7d4e2' : '#c1cfde')};
    color: #18212f;
  }
`;

const LIMIT_OPTIONS = [10, 20, 50, 100];
const STREAM_TYPES = ['', 'RANDOM', 'CALLING'];
const STREAM_STATUSES = ['', 'connecting', 'active', 'closed'];
const PAYMENT_STATUSES = ['', 'PENDING', 'SUCCESS', 'FAILED', 'EXPIRED'];
const PAYOUT_STATUSES = ['', 'REQUESTED', 'APPROVED', 'REJECTED', 'PAID', 'CANCELED'];
const OPERATION_TYPES = [
  '',
  'STREAM_CHARGE',
  'STREAM_EARNING',
  'STREAM_MARGIN',
  'MANUAL_REFUND',
  'FIRST_PAYMENT',
  'ADD_BALANCE',
  'PAYOUT_REQUEST',
  'PAYOUT_RELEASE',
  'GIFT_SEND',
  'GIFT_EARNING',
];

const toneForStreamStatus = (status) => {
  if (status === 'active') return 'active';
  if (status === 'connecting') return 'connecting';
  return 'closed';
};

const toneForPaymentStatus = (status) => {
  if (status === 'SUCCESS' || status === 'PAID' || status === 'APPROVED') return 'resolved';
  if (status === 'PENDING' || status === 'REQUESTED') return 'open';
  if (status === 'FAILED' || status === 'REJECTED' || status === 'CANCELED') return 'danger';
  return 'closed';
};

const fmtTs = (value) => {
  if (!value) return '-';
  try {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    return d.toLocaleString();
  } catch {
    return String(value);
  }
};

const fmtMoney = (value, currency = 'EUR') => {
  if (value == null || value === '') return '-';
  const num = Number(value);
  if (Number.isNaN(num)) return String(value);
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num);
  } catch {
    return `${num.toFixed(2)} ${currency}`;
  }
};

const short = (value, size = 96) => {
  if (value == null) return '-';
  const text = String(value);
  return text.length > size ? `${text.slice(0, size)}...` : text;
};

const DataSection = ({ title, meta, children }) => (
  <InlinePanel style={{ marginTop: 10 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', marginBottom: 8 }}>
      <div>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>{title}</div>
        {meta ? <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>{meta}</div> : null}
      </div>
    </div>
    {children}
  </InlinePanel>
);

const AdminDataPanel = () => {
  const t = (key, options) => i18n.t(key, options);
  const streamDetailRef = useRef(null);
  const [activeTab, setActiveTab] = useState('streams');

  const [streamsQuery, setStreamsQuery] = useState('');
  const [streamsType, setStreamsType] = useState('');
  const [streamsStatus, setStreamsStatus] = useState('');
  const [streamsLimit, setStreamsLimit] = useState(20);
  const [streamsRows, setStreamsRows] = useState([]);
  const [streamsLoading, setStreamsLoading] = useState(false);
  const [streamsError, setStreamsError] = useState('');
  const [selectedStreamId, setSelectedStreamId] = useState(null);
  const [selectedStreamDetail, setSelectedStreamDetail] = useState(null);
  const [streamDetailLoading, setStreamDetailLoading] = useState(false);
  const [streamDetailError, setStreamDetailError] = useState('');

  const [paymentsQuery, setPaymentsQuery] = useState('');
  const [paymentsOperationType, setPaymentsOperationType] = useState('');
  const [paymentsStatus, setPaymentsStatus] = useState('');
  const [payoutStatus, setPayoutStatus] = useState('');
  const [paymentsLimit, setPaymentsLimit] = useState(20);
  const [paymentsData, setPaymentsData] = useState({
    transactions: [],
    paymentSessions: [],
    payoutRequests: [],
    balances: [],
  });
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  const [paymentsError, setPaymentsError] = useState('');

  const scrollToStreamDetail = () => {
    if (!streamDetailRef.current) return;
    window.requestAnimationFrame(() => {
      streamDetailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  const loadStreamDetail = async (streamId, options = {}) => {
    const shouldScroll = Boolean(options.scroll);
    if (!streamId) return;
    setSelectedStreamId(streamId);
    setStreamDetailLoading(true);
    setStreamDetailError('');
    try {
      const detail = await apiFetch(`/admin/streams/${streamId}?limitEvents=20`);
      setSelectedStreamDetail(detail || null);
      if (shouldScroll) {
        scrollToStreamDetail();
      }
    } catch (e) {
      setStreamDetailError(e.message || t('admin.data.errors.streamDetailLoad'));
      setSelectedStreamDetail(null);
      if (shouldScroll) {
        scrollToStreamDetail();
      }
    } finally {
      setStreamDetailLoading(false);
    }
  };

  const loadStreams = async () => {
    setStreamsLoading(true);
    setStreamsError('');
    try {
      const params = new URLSearchParams();
      if (streamsQuery.trim()) params.set('q', streamsQuery.trim());
      if (streamsType) params.set('streamType', streamsType);
      if (streamsStatus) params.set('status', streamsStatus);
      params.set('limit', String(streamsLimit));

      const rows = await apiFetch(`/admin/data/streams?${params.toString()}`);
      const safeRows = Array.isArray(rows) ? rows : [];
      setStreamsRows(safeRows);

      if (safeRows.length > 0) {
        const nextId = selectedStreamId && safeRows.some((row) => row.id === selectedStreamId)
          ? selectedStreamId
          : safeRows[0].id;
        await loadStreamDetail(nextId);
      } else {
        setSelectedStreamId(null);
        setSelectedStreamDetail(null);
      }
    } catch (e) {
      setStreamsError(e.message || t('admin.data.errors.streamsLoad'));
      setStreamsRows([]);
      setSelectedStreamId(null);
      setSelectedStreamDetail(null);
    } finally {
      setStreamsLoading(false);
    }
  };

  const loadPayments = async () => {
    setPaymentsLoading(true);
    setPaymentsError('');
    try {
      const params = new URLSearchParams();
      if (paymentsQuery.trim()) params.set('q', paymentsQuery.trim());
      if (paymentsOperationType) params.set('operationType', paymentsOperationType);
      if (paymentsStatus) params.set('paymentStatus', paymentsStatus);
      if (payoutStatus) params.set('payoutStatus', payoutStatus);
      params.set('limit', String(paymentsLimit));

      const data = await apiFetch(`/admin/data/payments?${params.toString()}`);
      setPaymentsData({
        transactions: Array.isArray(data?.transactions) ? data.transactions : [],
        paymentSessions: Array.isArray(data?.paymentSessions) ? data.paymentSessions : [],
        payoutRequests: Array.isArray(data?.payoutRequests) ? data.payoutRequests : [],
        balances: Array.isArray(data?.balances) ? data.balances : [],
      });
    } catch (e) {
      setPaymentsError(e.message || t('admin.data.errors.paymentsLoad'));
      setPaymentsData({
        transactions: [],
        paymentSessions: [],
        payoutRequests: [],
        balances: [],
      });
    } finally {
      setPaymentsLoading(false);
    }
  };

  const focusStreamsByValue = async (value) => {
    if (value == null || value === '') return;
    setActiveTab('streams');
    setStreamsQuery(String(value));
    setStreamsLoading(true);
    setStreamsError('');
    try {
      const params = new URLSearchParams();
      params.set('q', String(value));
      if (streamsType) params.set('streamType', streamsType);
      if (streamsStatus) params.set('status', streamsStatus);
      params.set('limit', String(streamsLimit));

      const rows = await apiFetch(`/admin/data/streams?${params.toString()}`);
      const safeRows = Array.isArray(rows) ? rows : [];
      setStreamsRows(safeRows);

      if (safeRows.length > 0) {
        const nextId = safeRows[0].id;
        await loadStreamDetail(nextId);
      } else {
        setSelectedStreamId(null);
        setSelectedStreamDetail(null);
      }
    } catch (e) {
      setStreamsError(e.message || t('admin.data.errors.streamsLoad'));
      setStreamsRows([]);
      setSelectedStreamId(null);
      setSelectedStreamDetail(null);
    } finally {
      setStreamsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'streams' && streamsRows.length === 0 && !streamsLoading) {
      loadStreams();
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'payments'
      && paymentsData.transactions.length === 0
      && paymentsData.paymentSessions.length === 0
      && paymentsData.payoutRequests.length === 0
      && paymentsData.balances.length === 0
      && !paymentsLoading) {
      loadPayments();
    }
  }, [activeTab]);

  const paymentCounts = useMemo(() => ([
    { label: t('admin.data.stats.transactions'), value: paymentsData.transactions.length },
    { label: t('admin.data.stats.paymentSessions'), value: paymentsData.paymentSessions.length },
    { label: t('admin.data.stats.payoutRequests'), value: paymentsData.payoutRequests.length },
    { label: t('admin.data.stats.balances'), value: paymentsData.balances.length },
  ]), [paymentsData]);

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
        <PanelTabButton type="button" onClick={() => setActiveTab('streams')} $active={activeTab === 'streams'}>
          {t('admin.data.tabs.streams')}
        </PanelTabButton>
        <PanelTabButton type="button" onClick={() => setActiveTab('payments')} $active={activeTab === 'payments'}>
          {t('admin.data.tabs.payments')}
        </PanelTabButton>
        <PanelTabButton type="button" onClick={() => setActiveTab('raw')} $active={activeTab === 'raw'}>
          {t('admin.data.tabs.raw')}
        </PanelTabButton>
      </div>

      {activeTab === 'streams' && (
        <>
          <ControlsRow>
            <FieldBlock style={{ minWidth: 240, flex: '1 1 260px' }}>
              <label>{t('admin.data.filters.searchStreamsLabel')}</label>
              <StyledInput
                value={streamsQuery}
                onChange={(e) => setStreamsQuery(e.target.value)}
                placeholder={t('admin.data.filters.searchStreamsPlaceholder')}
                style={{ maxWidth: '100%' }}
              />
            </FieldBlock>

            <FieldBlock style={{ minWidth: 140 }}>
              <label>{t('admin.common.columns.type')}</label>
              <StyledSelect value={streamsType} onChange={(e) => setStreamsType(e.target.value)}>
                {STREAM_TYPES.map((value) => (
                  <option key={value || 'all'} value={value}>{value || t('admin.common.labels.all')}</option>
                ))}
              </StyledSelect>
            </FieldBlock>

            <FieldBlock style={{ minWidth: 140 }}>
              <label>{t('admin.common.columns.status')}</label>
              <StyledSelect value={streamsStatus} onChange={(e) => setStreamsStatus(e.target.value)}>
                {STREAM_STATUSES.map((value) => (
                  <option key={value || 'all'} value={value}>{value || t('admin.common.labels.all')}</option>
                ))}
              </StyledSelect>
            </FieldBlock>

            <FieldBlock style={{ minWidth: 110 }}>
              <label>{t('admin.data.filters.limit')}</label>
              <StyledSelect value={streamsLimit} onChange={(e) => setStreamsLimit(Number(e.target.value))}>
                {LIMIT_OPTIONS.map((value) => (
                  <option key={value} value={value}>{value}</option>
                ))}
              </StyledSelect>
            </FieldBlock>

            <StyledButton type="button" onClick={loadStreams} disabled={streamsLoading}>
              {streamsLoading ? t('admin.common.status.loading') : t('admin.common.buttons.search')}
            </StyledButton>

            <RightInfo>
              {streamsLoading ? t('admin.data.info.searchingStreams') : t('admin.data.info.rowsCount', { count: streamsRows.length })}
            </RightInfo>
          </ControlsRow>

          {streamsError && <StyledError>{streamsError}</StyledError>}

          <DataSection
            title={t('admin.common.labels.results')}
            meta={t('admin.data.descriptions.streamsResults')}
          >
            <div style={{ overflowX: 'auto' }}>
              <DarkHeaderTable>
                <thead>
                  <tr>
                    <th>{t('admin.data.columns.stream')}</th>
                    <th>{t('admin.common.columns.type')}</th>
                    <th>{t('admin.common.columns.status')}</th>
                    <th>{t('admin.data.columns.client')}</th>
                    <th>{t('admin.common.columns.model')}</th>
                    <th>{t('admin.data.columns.start')}</th>
                    <th>{t('admin.data.columns.confirmed')}</th>
                    <th>{t('admin.data.columns.end')}</th>
                    <th>{t('admin.common.columns.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {streamsRows.length === 0 && (
                    <tr>
                      <td colSpan="9">{t('admin.data.empty.streams')}</td>
                    </tr>
                  )}
                  {streamsRows.map((row) => (
                    <tr
                      key={row.id}
                      data-selected={selectedStreamId === row.id ? 'true' : undefined}
                    >
                      <td>{row.id}</td>
                      <td>{row.stream_type || '-'}</td>
                      <td><Badge data-variant={toneForStreamStatus(row.status)}>{row.status || '-'}</Badge></td>
                      <td title={row.client_email || ''}>{row.client_id} - {row.client_nickname || row.client_email || '-'}</td>
                      <td title={row.model_email || ''}>{row.model_id} - {row.model_nickname || row.model_email || '-'}</td>
                      <td>{fmtTs(row.start_time)}</td>
                      <td>{fmtTs(row.confirmed_at)}</td>
                      <td>{fmtTs(row.end_time)}</td>
                      <td>
                        <TableActionGroup>
                          <TableActionButton type="button" onClick={() => loadStreamDetail(row.id, { scroll: true })}>
                            {t('admin.data.buttons.viewDetail')}
                          </TableActionButton>
                          {row.client_id ? (
                            <TableActionButton type="button" onClick={() => focusStreamsByValue(row.client_id)}>
                              {t('admin.data.buttons.client')}
                            </TableActionButton>
                          ) : null}
                          {row.model_id ? (
                            <TableActionButton type="button" onClick={() => focusStreamsByValue(row.model_id)}>
                              {t('admin.data.buttons.model')}
                            </TableActionButton>
                          ) : null}
                        </TableActionGroup>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </DarkHeaderTable>
            </div>
          </DataSection>

          <div ref={streamDetailRef}>
            <DataSection
            title={t('admin.data.sectionTitles.streamDetail')}
            meta={t('admin.data.descriptions.streamDetail')}
            >
              {streamDetailError && <StyledError>{streamDetailError}</StyledError>}
              {streamDetailLoading && <div style={{ color: '#64748b' }}>{t('admin.data.info.loadingDetail')}</div>}
              {!streamDetailLoading && !selectedStreamDetail && (
                <div style={{ color: '#64748b' }}>{t('admin.data.info.selectStreamHint')}</div>
              )}
              {!streamDetailLoading && selectedStreamDetail && (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8 }}>
                    <InlinePanel>
                      <div style={{ fontSize: 11, color: '#64748b' }}>{t('admin.data.columns.stream')}</div>
                      <div style={{ marginTop: 4, fontSize: 16, fontWeight: 700 }}>{selectedStreamDetail.stream?.streamId ?? '-'}</div>
                    </InlinePanel>
                    <InlinePanel>
                      <div style={{ fontSize: 11, color: '#64748b' }}>{t('admin.common.columns.type')}</div>
                      <div style={{ marginTop: 4, fontSize: 16, fontWeight: 700 }}>{selectedStreamDetail.stream?.streamType ?? '-'}</div>
                    </InlinePanel>
                    <InlinePanel>
                      <div style={{ fontSize: 11, color: '#64748b' }}>{t('admin.common.columns.status')}</div>
                      <div style={{ marginTop: 4 }}><Badge data-variant={toneForStreamStatus(selectedStreamDetail.stream?.statusDerivado)}>{selectedStreamDetail.stream?.statusDerivado ?? '-'}</Badge></div>
                    </InlinePanel>
                    <InlinePanel>
                      <div style={{ fontSize: 11, color: '#64748b' }}>{t('admin.data.columns.duration')}</div>
                      <div style={{ marginTop: 4, fontSize: 16, fontWeight: 700 }}>{selectedStreamDetail.stream?.durationSeconds ?? 0}s</div>
                    </InlinePanel>
                  </div>

                  <div style={{ overflowX: 'auto', marginTop: 10 }}>
                    <DarkHeaderTable>
                      <thead>
                        <tr>
                          <th>{t('admin.data.columns.event')}</th>
                          <th>{t('admin.data.columns.reason')}</th>
                          <th>{t('admin.common.columns.date')}</th>
                          <th>{t('admin.data.columns.metadata')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(selectedStreamDetail.events || []).length === 0 && (
                          <tr>
                            <td colSpan="4">{t('admin.data.empty.streamEvents')}</td>
                          </tr>
                        )}
                        {(selectedStreamDetail.events || []).map((event) => (
                          <tr key={event.id}>
                            <td>{event.eventType || '-'}</td>
                            <td>{event.reason || '-'}</td>
                            <td>{fmtTs(event.createdAt)}</td>
                            <td title={event.metadata || ''}>{short(event.metadata, 120)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </DarkHeaderTable>
                  </div>
                </>
              )}
            </DataSection>
          </div>
        </>
      )}

      {activeTab === 'payments' && (
        <>
          <ControlsRow>
            <FieldBlock style={{ minWidth: 240, flex: '1 1 260px' }}>
              <label>{t('admin.data.filters.searchPaymentsLabel')}</label>
              <StyledInput
                value={paymentsQuery}
                onChange={(e) => setPaymentsQuery(e.target.value)}
                placeholder={t('admin.data.filters.searchPaymentsPlaceholder')}
                style={{ maxWidth: '100%' }}
              />
            </FieldBlock>

            <FieldBlock style={{ minWidth: 160 }}>
              <label>{t('admin.data.filters.operationType')}</label>
              <StyledSelect value={paymentsOperationType} onChange={(e) => setPaymentsOperationType(e.target.value)}>
                {OPERATION_TYPES.map((value) => (
                  <option key={value || 'all'} value={value}>{value || t('admin.common.labels.all')}</option>
                ))}
              </StyledSelect>
            </FieldBlock>

            <FieldBlock style={{ minWidth: 150 }}>
              <label>{t('admin.data.filters.paymentStatus')}</label>
              <StyledSelect value={paymentsStatus} onChange={(e) => setPaymentsStatus(e.target.value)}>
                {PAYMENT_STATUSES.map((value) => (
                  <option key={value || 'all'} value={value}>{value || t('admin.common.labels.all')}</option>
                ))}
              </StyledSelect>
            </FieldBlock>

            <FieldBlock style={{ minWidth: 150 }}>
              <label>{t('admin.data.filters.payoutStatus')}</label>
              <StyledSelect value={payoutStatus} onChange={(e) => setPayoutStatus(e.target.value)}>
                {PAYOUT_STATUSES.map((value) => (
                  <option key={value || 'all'} value={value}>{value || t('admin.common.labels.all')}</option>
                ))}
              </StyledSelect>
            </FieldBlock>

            <FieldBlock style={{ minWidth: 110 }}>
              <label>{t('admin.data.filters.limit')}</label>
              <StyledSelect value={paymentsLimit} onChange={(e) => setPaymentsLimit(Number(e.target.value))}>
                {LIMIT_OPTIONS.map((value) => (
                  <option key={value} value={value}>{value}</option>
                ))}
              </StyledSelect>
            </FieldBlock>

            <StyledButton type="button" onClick={loadPayments} disabled={paymentsLoading}>
              {paymentsLoading ? t('admin.common.status.loading') : t('admin.common.buttons.search')}
            </StyledButton>

            <RightInfo>
              {paymentsLoading ? t('admin.data.info.searchingPayments') : t('admin.data.info.paymentsCrossContext')}
            </RightInfo>
          </ControlsRow>

          {paymentsError && <StyledError>{paymentsError}</StyledError>}

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
            {paymentCounts.map((item) => (
              <InlinePanel key={item.label} style={{ minWidth: 140, flex: '0 0 auto' }}>
                <div style={{ fontSize: 11, color: '#64748b' }}>{item.label}</div>
                <div style={{ marginTop: 4, fontSize: 18, fontWeight: 700 }}>{item.value}</div>
              </InlinePanel>
            ))}
          </div>

          <DataSection title={t('admin.data.sectionTitles.payments')} meta={t('admin.data.descriptions.paymentsSection')}>
            <div style={{ overflowX: 'auto' }}>
              <DarkHeaderTable>
                <thead>
                  <tr>
                    <th>{t('admin.common.columns.id')}</th>
                    <th>{t('admin.common.columns.user')}</th>
                    <th>{t('admin.common.columns.type')}</th>
                    <th>{t('admin.common.columns.amount')}</th>
                    <th>{t('admin.data.columns.stream')}</th>
                    <th>{t('admin.common.columns.date')}</th>
                    <th>{t('admin.data.columns.description')}</th>
                    <th>{t('admin.common.columns.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {paymentsData.transactions.length === 0 && (
                    <tr>
                      <td colSpan="8">{t('admin.data.empty.transactions')}</td>
                    </tr>
                  )}
                  {paymentsData.transactions.map((row) => (
                    <tr key={`tx-${row.id}`}>
                      <td>{row.id}</td>
                      <td title={row.user_email || ''}>{row.user_id} - {row.user_nickname || row.user_email || '-'}</td>
                      <td>{row.operation_type || '-'}</td>
                      <td>{fmtMoney(row.amount)}</td>
                      <td>{row.stream_record_id ?? '-'}</td>
                      <td>{fmtTs(row.timestamp)}</td>
                      <td title={row.description || ''}>{short(row.description, 90)}</td>
                      <td>
                        {row.stream_record_id ? (
                          <TableActionButton type="button" onClick={() => focusStreamsByValue(row.stream_record_id)}>
                            {t('admin.data.buttons.viewStream')}
                          </TableActionButton>
                        ) : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </DarkHeaderTable>
            </div>
          </DataSection>

          <DataSection title={t('admin.data.sectionTitles.paymentSessions')} meta={t('admin.data.descriptions.paymentSessions')}>
            <div style={{ overflowX: 'auto' }}>
              <DarkHeaderTable>
                <thead>
                  <tr>
                    <th>{t('admin.common.columns.id')}</th>
                    <th>{t('admin.common.columns.user')}</th>
                    <th>{t('admin.data.columns.pack')}</th>
                    <th>{t('admin.common.columns.amount')}</th>
                    <th>{t('admin.common.columns.status')}</th>
                    <th>{t('admin.data.columns.order')}</th>
                    <th>{t('admin.data.columns.pspTx')}</th>
                    <th>{t('admin.data.columns.createdAt')}</th>
                  </tr>
                </thead>
                <tbody>
                  {paymentsData.paymentSessions.length === 0 && (
                    <tr>
                      <td colSpan="8">{t('admin.data.empty.paymentSessions')}</td>
                    </tr>
                  )}
                  {paymentsData.paymentSessions.map((row) => (
                    <tr key={`ps-${row.id}`}>
                      <td>{row.id}</td>
                      <td title={row.user_email || ''}>{row.user_id} - {row.user_nickname || row.user_email || '-'}</td>
                      <td>{row.pack_id || '-'}</td>
                      <td>{fmtMoney(row.amount, row.currency || 'EUR')}</td>
                      <td><Badge data-variant={toneForPaymentStatus(row.status)}>{row.status || '-'}</Badge></td>
                      <td title={row.order_id || ''}>{short(row.order_id, 24)}</td>
                      <td title={row.psp_transaction_id || ''}>{short(row.psp_transaction_id, 24)}</td>
                      <td>{fmtTs(row.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </DarkHeaderTable>
            </div>
          </DataSection>

          <DataSection title={t('admin.data.sectionTitles.payoutRequests')} meta={t('admin.data.descriptions.payoutRequests')}>
            <div style={{ overflowX: 'auto' }}>
              <DarkHeaderTable>
                <thead>
                  <tr>
                    <th>{t('admin.common.columns.id')}</th>
                    <th>{t('admin.common.columns.model')}</th>
                    <th>{t('admin.common.columns.amount')}</th>
                    <th>{t('admin.common.columns.status')}</th>
                    <th>{t('admin.data.columns.reason')}</th>
                    <th>{t('admin.data.columns.reviewedBy')}</th>
                    <th>{t('admin.data.columns.createdAt')}</th>
                  </tr>
                </thead>
                <tbody>
                  {paymentsData.payoutRequests.length === 0 && (
                    <tr>
                      <td colSpan="7">{t('admin.data.empty.payoutRequests')}</td>
                    </tr>
                  )}
                  {paymentsData.payoutRequests.map((row) => (
                    <tr key={`pr-${row.id}`}>
                      <td>{row.id}</td>
                      <td title={row.model_email || ''}>{row.model_user_id} - {row.model_nickname || row.model_email || '-'}</td>
                      <td>{fmtMoney(row.amount, row.currency || 'EUR')}</td>
                      <td><Badge data-variant={toneForPaymentStatus(row.status)}>{row.status || '-'}</Badge></td>
                      <td title={row.reason || ''}>{short(row.reason, 80)}</td>
                      <td>{row.reviewed_by_user_id ?? '-'}</td>
                      <td>{fmtTs(row.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </DarkHeaderTable>
            </div>
          </DataSection>

          <DataSection title={t('admin.data.sectionTitles.balances')} meta={t('admin.data.descriptions.balances')}>
            <div style={{ overflowX: 'auto' }}>
              <DarkHeaderTable>
                <thead>
                  <tr>
                    <th>{t('admin.common.columns.id')}</th>
                    <th>{t('admin.common.columns.user')}</th>
                    <th>{t('admin.data.columns.tx')}</th>
                    <th>{t('admin.common.columns.type')}</th>
                    <th>{t('admin.common.columns.amount')}</th>
                    <th>{t('admin.data.columns.balance')}</th>
                    <th>{t('admin.common.columns.date')}</th>
                  </tr>
                </thead>
                <tbody>
                  {paymentsData.balances.length === 0 && (
                    <tr>
                      <td colSpan="7">{t('admin.data.empty.balances')}</td>
                    </tr>
                  )}
                  {paymentsData.balances.map((row) => (
                    <tr key={`bal-${row.id}`}>
                      <td>{row.id}</td>
                      <td title={row.user_email || ''}>{row.user_id} - {row.user_nickname || row.user_email || '-'}</td>
                      <td>
                        {row.transaction_id ? (
                          <span style={{ fontWeight: 700, color: '#0f172a' }}>{t('admin.data.labels.txPrefix')} #{row.transaction_id}</span>
                        ) : '-'}
                      </td>
                      <td>{row.operation_type || '-'}</td>
                      <td>{fmtMoney(row.amount)}</td>
                      <td>{fmtMoney(row.balance)}</td>
                      <td>{fmtTs(row.timestamp)}</td>
                    </tr>
                  ))}
                </tbody>
              </DarkHeaderTable>
            </div>
          </DataSection>
        </>
      )}

      {activeTab === 'raw' && (
        <DataSection
          title={t('admin.data.sectionTitles.raw')}
          meta={t('admin.data.descriptions.rawExploration')}
        >
          <AdminDbPanel hideTitle />
        </DataSection>
      )}
    </div>
  );
};

export default AdminDataPanel;
