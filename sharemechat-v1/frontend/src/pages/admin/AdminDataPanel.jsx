import React, { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../../config/http';
import {
  Badge,
  ControlsRow,
  FieldBlock,
  InlinePanel,
  RightInfo,
  SmallBtn,
  StyledButton,
  StyledError,
  StyledInput,
  StyledSelect,
  StyledTable,
} from '../../styles/AdminStyles';
import AdminDbPanel from './AdminDbPanel';

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

  const loadStreamDetail = async (streamId) => {
    if (!streamId) return;
    setSelectedStreamId(streamId);
    setStreamDetailLoading(true);
    setStreamDetailError('');
    try {
      const detail = await apiFetch(`/admin/streams/${streamId}?limitEvents=20`);
      setSelectedStreamDetail(detail || null);
    } catch (e) {
      setStreamDetailError(e.message || 'Error cargando el detalle del stream');
      setSelectedStreamDetail(null);
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
      setStreamsError(e.message || 'Error cargando streams');
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
      setPaymentsError(e.message || 'Error cargando transacciones y pagos');
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
    { label: 'Transacciones', value: paymentsData.transactions.length },
    { label: 'Payment sessions', value: paymentsData.paymentSessions.length },
    { label: 'Payout requests', value: paymentsData.payoutRequests.length },
    { label: 'Balances', value: paymentsData.balances.length },
  ]), [paymentsData]);

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
        <SmallBtn type="button" onClick={() => setActiveTab('streams')} style={activeTab === 'streams' ? { background: '#e8f0ff', borderColor: '#9dbcf5' } : null}>
          Streams y sesiones
        </SmallBtn>
        <SmallBtn type="button" onClick={() => setActiveTab('payments')} style={activeTab === 'payments' ? { background: '#e8f0ff', borderColor: '#9dbcf5' } : null}>
          Pagos y operaciones
        </SmallBtn>
        <SmallBtn type="button" onClick={() => setActiveTab('raw')} style={activeTab === 'raw' ? { background: '#e8f0ff', borderColor: '#9dbcf5' } : null}>
          Exploracion raw
        </SmallBtn>
      </div>

      {activeTab === 'streams' && (
        <>
          <ControlsRow>
            <FieldBlock style={{ minWidth: 240, flex: '1 1 260px' }}>
              <label>Buscar por userId, streamId, email o nickname</label>
              <StyledInput
                value={streamsQuery}
                onChange={(e) => setStreamsQuery(e.target.value)}
                placeholder="Ej: 154, client@email.com o nickname"
                style={{ maxWidth: '100%' }}
              />
            </FieldBlock>

            <FieldBlock style={{ minWidth: 140 }}>
              <label>Tipo</label>
              <StyledSelect value={streamsType} onChange={(e) => setStreamsType(e.target.value)}>
                {STREAM_TYPES.map((value) => (
                  <option key={value || 'all'} value={value}>{value || 'Todos'}</option>
                ))}
              </StyledSelect>
            </FieldBlock>

            <FieldBlock style={{ minWidth: 140 }}>
              <label>Estado</label>
              <StyledSelect value={streamsStatus} onChange={(e) => setStreamsStatus(e.target.value)}>
                {STREAM_STATUSES.map((value) => (
                  <option key={value || 'all'} value={value}>{value || 'Todos'}</option>
                ))}
              </StyledSelect>
            </FieldBlock>

            <FieldBlock style={{ minWidth: 110 }}>
              <label>Limite</label>
              <StyledSelect value={streamsLimit} onChange={(e) => setStreamsLimit(Number(e.target.value))}>
                {LIMIT_OPTIONS.map((value) => (
                  <option key={value} value={value}>{value}</option>
                ))}
              </StyledSelect>
            </FieldBlock>

            <StyledButton type="button" onClick={loadStreams} disabled={streamsLoading}>
              {streamsLoading ? 'Cargando...' : 'Buscar'}
            </StyledButton>

            <RightInfo>
              {streamsLoading ? 'Buscando streams...' : `${streamsRows.length} filas`}
            </RightInfo>
          </ControlsRow>

          {streamsError && <StyledError>{streamsError}</StyledError>}

          <DataSection
            title="Resultados"
            meta="Vista inicial para investigar streams por usuario, stream concreto o identidad visible."
          >
            <div style={{ overflowX: 'auto' }}>
              <StyledTable>
                <thead>
                  <tr>
                    <th>Stream</th>
                    <th>Tipo</th>
                    <th>Estado</th>
                    <th>Cliente</th>
                    <th>Modelo</th>
                    <th>Inicio</th>
                    <th>Confirmado</th>
                    <th>Cierre</th>
                  </tr>
                </thead>
                <tbody>
                  {streamsRows.length === 0 && (
                    <tr>
                      <td colSpan="8">Sin resultados para los filtros actuales.</td>
                    </tr>
                  )}
                  {streamsRows.map((row) => (
                    <tr
                      key={row.id}
                      onClick={() => loadStreamDetail(row.id)}
                      style={selectedStreamId === row.id ? { background: '#eef4ff', cursor: 'pointer' } : { cursor: 'pointer' }}
                    >
                      <td>{row.id}</td>
                      <td>{row.stream_type || '-'}</td>
                      <td><Badge data-variant={toneForStreamStatus(row.status)}>{row.status || '-'}</Badge></td>
                      <td title={row.client_email || ''}>{row.client_id} - {row.client_nickname || row.client_email || '-'}</td>
                      <td title={row.model_email || ''}>{row.model_id} - {row.model_nickname || row.model_email || '-'}</td>
                      <td>{fmtTs(row.start_time)}</td>
                      <td>{fmtTs(row.confirmed_at)}</td>
                      <td>{fmtTs(row.end_time)}</td>
                    </tr>
                  ))}
                </tbody>
              </StyledTable>
            </div>
          </DataSection>

          <DataSection
            title="Detalle del stream"
            meta="Se reutiliza el detalle operativo existente con eventos del stream para no duplicar logica."
          >
            {streamDetailError && <StyledError>{streamDetailError}</StyledError>}
            {streamDetailLoading && <div style={{ color: '#64748b' }}>Cargando detalle...</div>}
            {!streamDetailLoading && !selectedStreamDetail && (
              <div style={{ color: '#64748b' }}>Selecciona un stream para ver su contexto y sus eventos.</div>
            )}
            {!streamDetailLoading && selectedStreamDetail && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8 }}>
                  <InlinePanel>
                    <div style={{ fontSize: 11, color: '#64748b' }}>Stream</div>
                    <div style={{ marginTop: 4, fontSize: 16, fontWeight: 700 }}>{selectedStreamDetail.stream?.streamId ?? '-'}</div>
                  </InlinePanel>
                  <InlinePanel>
                    <div style={{ fontSize: 11, color: '#64748b' }}>Tipo</div>
                    <div style={{ marginTop: 4, fontSize: 16, fontWeight: 700 }}>{selectedStreamDetail.stream?.streamType ?? '-'}</div>
                  </InlinePanel>
                  <InlinePanel>
                    <div style={{ fontSize: 11, color: '#64748b' }}>Estado</div>
                    <div style={{ marginTop: 4 }}><Badge data-variant={toneForStreamStatus(selectedStreamDetail.stream?.statusDerivado)}>{selectedStreamDetail.stream?.statusDerivado ?? '-'}</Badge></div>
                  </InlinePanel>
                  <InlinePanel>
                    <div style={{ fontSize: 11, color: '#64748b' }}>Duracion</div>
                    <div style={{ marginTop: 4, fontSize: 16, fontWeight: 700 }}>{selectedStreamDetail.stream?.durationSeconds ?? 0}s</div>
                  </InlinePanel>
                </div>

                <div style={{ overflowX: 'auto', marginTop: 10 }}>
                  <StyledTable>
                    <thead>
                      <tr>
                        <th>Evento</th>
                        <th>Motivo</th>
                        <th>Fecha</th>
                        <th>Metadata</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(selectedStreamDetail.events || []).length === 0 && (
                        <tr>
                          <td colSpan="4">Sin eventos para este stream.</td>
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
                  </StyledTable>
                </div>
              </>
            )}
          </DataSection>
        </>
      )}

      {activeTab === 'payments' && (
        <>
          <ControlsRow>
            <FieldBlock style={{ minWidth: 240, flex: '1 1 260px' }}>
              <label>Buscar por userId, id, email, nickname u orderId</label>
              <StyledInput
                value={paymentsQuery}
                onChange={(e) => setPaymentsQuery(e.target.value)}
                placeholder="Ej: 154, email, nickname u orderId"
                style={{ maxWidth: '100%' }}
              />
            </FieldBlock>

            <FieldBlock style={{ minWidth: 160 }}>
              <label>Operation type</label>
              <StyledSelect value={paymentsOperationType} onChange={(e) => setPaymentsOperationType(e.target.value)}>
                {OPERATION_TYPES.map((value) => (
                  <option key={value || 'all'} value={value}>{value || 'Todos'}</option>
                ))}
              </StyledSelect>
            </FieldBlock>

            <FieldBlock style={{ minWidth: 150 }}>
              <label>Payment status</label>
              <StyledSelect value={paymentsStatus} onChange={(e) => setPaymentsStatus(e.target.value)}>
                {PAYMENT_STATUSES.map((value) => (
                  <option key={value || 'all'} value={value}>{value || 'Todos'}</option>
                ))}
              </StyledSelect>
            </FieldBlock>

            <FieldBlock style={{ minWidth: 150 }}>
              <label>Payout status</label>
              <StyledSelect value={payoutStatus} onChange={(e) => setPayoutStatus(e.target.value)}>
                {PAYOUT_STATUSES.map((value) => (
                  <option key={value || 'all'} value={value}>{value || 'Todos'}</option>
                ))}
              </StyledSelect>
            </FieldBlock>

            <FieldBlock style={{ minWidth: 110 }}>
              <label>Limite</label>
              <StyledSelect value={paymentsLimit} onChange={(e) => setPaymentsLimit(Number(e.target.value))}>
                {LIMIT_OPTIONS.map((value) => (
                  <option key={value} value={value}>{value}</option>
                ))}
              </StyledSelect>
            </FieldBlock>

            <StyledButton type="button" onClick={loadPayments} disabled={paymentsLoading}>
              {paymentsLoading ? 'Cargando...' : 'Buscar'}
            </StyledButton>

            <RightInfo>
              {paymentsLoading ? 'Buscando datos financieros...' : 'Contexto cruzado de transacciones, pagos, payouts y balances'}
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

          <DataSection title="Pagos y operaciones" meta="Incluye transacciones, payment sessions, payouts y contexto basico de balances para investigar un caso.">
            <div style={{ overflowX: 'auto' }}>
              <StyledTable>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>User</th>
                    <th>Tipo</th>
                    <th>Amount</th>
                    <th>Stream</th>
                    <th>Fecha</th>
                    <th>Descripcion</th>
                  </tr>
                </thead>
                <tbody>
                  {paymentsData.transactions.length === 0 && (
                    <tr>
                      <td colSpan="7">Sin transacciones para los filtros actuales.</td>
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
                    </tr>
                  ))}
                </tbody>
              </StyledTable>
            </div>
          </DataSection>

          <DataSection title="Payment sessions" meta="Contexto de intentos de pago y sesiones PSP relacionadas con el caso investigado.">
            <div style={{ overflowX: 'auto' }}>
              <StyledTable>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>User</th>
                    <th>Pack</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Order</th>
                    <th>PSP Tx</th>
                    <th>Creada</th>
                  </tr>
                </thead>
                <tbody>
                  {paymentsData.paymentSessions.length === 0 && (
                    <tr>
                      <td colSpan="8">Sin payment sessions para los filtros actuales.</td>
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
              </StyledTable>
            </div>
          </DataSection>

          <DataSection title="Payout requests" meta="Primera vista util para seguir retiros de modelo y su transicion de estado.">
            <div style={{ overflowX: 'auto' }}>
              <StyledTable>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Modelo</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Reason</th>
                    <th>Reviewed by</th>
                    <th>Creada</th>
                  </tr>
                </thead>
                <tbody>
                  {paymentsData.payoutRequests.length === 0 && (
                    <tr>
                      <td colSpan="7">Sin payout requests para los filtros actuales.</td>
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
              </StyledTable>
            </div>
          </DataSection>

          <DataSection title="Balances" meta="Contexto basico del ledger para entender saldo y huella de una operacion.">
            <div style={{ overflowX: 'auto' }}>
              <StyledTable>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>User</th>
                    <th>Tx</th>
                    <th>Tipo</th>
                    <th>Amount</th>
                    <th>Balance</th>
                    <th>Fecha</th>
                  </tr>
                </thead>
                <tbody>
                  {paymentsData.balances.length === 0 && (
                    <tr>
                      <td colSpan="7">Sin balances para los filtros actuales.</td>
                    </tr>
                  )}
                  {paymentsData.balances.map((row) => (
                    <tr key={`bal-${row.id}`}>
                      <td>{row.id}</td>
                      <td title={row.user_email || ''}>{row.user_id} - {row.user_nickname || row.user_email || '-'}</td>
                      <td>{row.transaction_id ?? '-'}</td>
                      <td>{row.operation_type || '-'}</td>
                      <td>{fmtMoney(row.amount)}</td>
                      <td>{fmtMoney(row.balance)}</td>
                      <td>{fmtTs(row.timestamp)}</td>
                    </tr>
                  ))}
                </tbody>
              </StyledTable>
            </div>
          </DataSection>
        </>
      )}

      {activeTab === 'raw' && (
        <DataSection
          title="Exploracion tecnica raw"
          meta="Subnivel tecnico solo para ADMIN. Se mantiene el visor raw actual mientras se amplian las consultas internas guiadas."
        >
          <AdminDbPanel hideTitle />
        </DataSection>
      )}
    </div>
  );
};

export default AdminDataPanel;
