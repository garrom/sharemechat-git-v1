import React, { useEffect, useState } from 'react';
import {
  StyledTable,
  StyledButton,
  StyledError,
  StyledSelect,
  StyledInput,
  ControlsRow,
  FieldBlock,
  RightInfo,
  ScrollBox,
  InlinePanel,
  PanelRow,
  SmallBtn,
  Badge
} from '../../styles/AdminStyles';

const DEFAULT_FILTERS = {
  q: '',
  streamType: 'ALL',
  status: 'ALL',
  minDurationSec: '',
  limit: 200,
};

const AdminActiveStreamsPanel = () => {
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [streams, setStreams] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [selectedStreamId, setSelectedStreamId] = useState(null);
  const [selectedDetail, setSelectedDetail] = useState(null);

  useEffect(() => {
    fetchActiveStreams(DEFAULT_FILTERS);
  }, []);

  const fmtTs = (v) => {
    if (!v) return '—';
    try {
      const d = new Date(v);
      if (Number.isNaN(d.getTime())) return String(v);
      return d.toLocaleString();
    } catch {
      return String(v);
    }
  };

  const formatDuration = (seconds) => {
    const total = Number(seconds);
    if (!Number.isFinite(total) || total < 0) return '0m 0s';
    const mins = Math.floor(total / 60);
    const secs = Math.floor(total % 60);
    return `${mins}m ${secs}s`;
  };

  const short = (value, max = 120) => {
    if (value == null) return '';
    const text = typeof value === 'string' ? value : JSON.stringify(value);
    return text.length > max ? `${text.slice(0, max)}...` : text;
  };

  const getParticipant = (item, role) => {
    const lowerRole = String(role || '').toLowerCase();
    const candidate =
      item?.[lowerRole] ||
      item?.[`${lowerRole}User`] ||
      item?.[`${lowerRole}Account`] ||
      item?.participants?.[lowerRole] ||
      null;

    const id =
      candidate?.id ??
      item?.[`${lowerRole}Id`] ??
      item?.[`${lowerRole}UserId`] ??
      item?.[`${lowerRole}_id`] ??
      null;

    const email =
      candidate?.email ??
      item?.[`${lowerRole}Email`] ??
      item?.[`${lowerRole}_email`] ??
      null;

    const nickname =
      candidate?.nickname ??
      item?.[`${lowerRole}Nickname`] ??
      item?.[`${lowerRole}_nickname`] ??
      null;

    return {
      id,
      email,
      nickname,
      label: nickname || email || (id != null ? `#${id}` : '—'),
    };
  };

  const getStatus = (item) => item?.statusDerivado || item?.derivedStatus || item?.status || '—';

  const isStuck = (item) => Boolean(item?.stuck);

  const buildQuery = (nextFilters) => {
    const params = new URLSearchParams();
    if (nextFilters.q && nextFilters.q.trim()) params.set('q', nextFilters.q.trim());
    if (nextFilters.streamType && nextFilters.streamType !== 'ALL') params.set('streamType', nextFilters.streamType);
    if (nextFilters.status && nextFilters.status !== 'ALL') params.set('status', nextFilters.status);
    if (nextFilters.minDurationSec !== '' && nextFilters.minDurationSec != null) params.set('minDurationSec', String(nextFilters.minDurationSec));
    if (nextFilters.limit) params.set('limit', String(nextFilters.limit));
    return params.toString();
  };

  const fetchActiveStreams = async (nextFilters = filters) => {
    setLoading(true);
    setError('');
    try {
      const query = buildQuery(nextFilters);
      const res = await fetch(`/api/admin/streams/active${query ? `?${query}` : ''}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error((await res.text()) || 'Error al cargar streams activos');
      const data = await res.json();
      setStreams(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e.message || 'Error al cargar streams activos');
      setStreams([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchStreamDetail = async (id) => {
    if (!id) return;
    setDetailLoading(true);
    setDetailError('');
    try {
      const res = await fetch(`/api/admin/streams/${id}?limitEvents=20`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error((await res.text()) || 'Error al cargar detalle del stream');
      const data = await res.json();
      setSelectedDetail(data || null);
      setSelectedStreamId(id);
    } catch (e) {
      setDetailError(e.message || 'Error al cargar detalle del stream');
      setSelectedDetail(null);
      setSelectedStreamId(id);
    } finally {
      setDetailLoading(false);
    }
  };

  const applyFilters = () => {
    fetchActiveStreams(filters);
  };

  const resetFilters = () => {
    setFilters(DEFAULT_FILTERS);
    fetchActiveStreams(DEFAULT_FILTERS);
  };

  const handleOpenDetail = async (streamId) => {
    if (selectedStreamId === streamId) {
      setSelectedStreamId(null);
      setSelectedDetail(null);
      setDetailError('');
      return;
    }
    await fetchStreamDetail(streamId);
  };

  const s = selectedDetail?.stream || selectedDetail || null;
  const detailEvents = Array.isArray(selectedDetail?.events) ? selectedDetail.events : [];

  return (
    <div style={{ width: '100%', maxWidth: 1200 }}>
      <ControlsRow>
        <FieldBlock>
          <label>Buscar</label>
          <StyledInput
            type="text"
            value={filters.q}
            onChange={(e) => setFilters((prev) => ({ ...prev, q: e.target.value }))}
            placeholder="ID, email o nickname"
          />
        </FieldBlock>

        <FieldBlock>
          <label>Tipo</label>
          <StyledSelect value={filters.streamType} onChange={(e) => setFilters((prev) => ({ ...prev, streamType: e.target.value }))}>
            <option value="ALL">ALL</option>
            <option value="CALLING">CALLING</option>
            <option value="RANDOM">RANDOM</option>
            <option value="UNKNOWN">UNKNOWN</option>
          </StyledSelect>
        </FieldBlock>

        <FieldBlock>
          <label>Status</label>
          <StyledSelect value={filters.status} onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))}>
            <option value="ALL">ALL</option>
            <option value="active">active</option>
            <option value="connecting">connecting</option>
          </StyledSelect>
        </FieldBlock>

        <FieldBlock>
          <label>Duración mínima (s)</label>
          <StyledInput
            type="number"
            min="0"
            value={filters.minDurationSec}
            onChange={(e) => setFilters((prev) => ({ ...prev, minDurationSec: e.target.value }))}
            placeholder="0"
          />
        </FieldBlock>

        <FieldBlock>
          <label>Límite</label>
          <StyledSelect value={filters.limit} onChange={(e) => setFilters((prev) => ({ ...prev, limit: Number(e.target.value) }))}>
            <option value={50}>50</option>
            <option value={100}>100</option>
            <option value={200}>200</option>
            <option value={500}>500</option>
          </StyledSelect>
        </FieldBlock>

        <StyledButton type="button" onClick={applyFilters} disabled={loading}>
          {loading ? 'Cargando…' : 'Aplicar'}
        </StyledButton>

        <SmallBtn type="button" onClick={resetFilters} disabled={loading}>
          Reset
        </SmallBtn>

        <RightInfo>
          {loading ? 'Cargando…' : `${streams.length} streams`}
        </RightInfo>
      </ControlsRow>

      {error && <StyledError>{error}</StyledError>}

      <ScrollBox>
        <StyledTable>
          <thead>
            <tr>
              <th>ID</th>
              <th>Tipo</th>
              <th>Cliente</th>
              <th>Modelo</th>
              <th>Inicio</th>
              <th>Duración</th>
              <th>Estado</th>
              <th></th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {streams.map((stream) => {
              const client = getParticipant(stream, 'client');
              const model = getParticipant(stream, 'model');
              const streamId = stream?.id ?? stream?.streamId ?? stream?.streamRecordId;
              const derivedStatus = getStatus(stream);

              return (
                <tr key={streamId ?? `${client.label}-${model.label}-${stream?.startTime || Math.random()}`}>
                  <td>{streamId ?? '—'}</td>
                  <td>{stream?.streamType || '—'}</td>
                  <td>{client.id != null ? `#${client.id} · ${client.label}` : client.label}</td>
                  <td>{model.id != null ? `#${model.id} · ${model.label}` : model.label}</td>
                  <td>{fmtTs(stream?.startTime)}</td>
                  <td>{formatDuration(stream?.durationSeconds)}</td>
                  <td>
                    <Badge data-variant={String(derivedStatus).toLowerCase()}>{derivedStatus}</Badge>
                  </td>
                  <td>
                    {isStuck(stream) && <Badge data-variant="danger">STUCK</Badge>}
                  </td>
                  <td>
                    <SmallBtn type="button" onClick={() => handleOpenDetail(streamId)}>
                      {selectedStreamId === streamId ? 'Cerrar' : 'Detalle'}
                    </SmallBtn>
                  </td>
                </tr>
              );
            })}

            {!loading && streams.length === 0 && (
              <tr>
                <td colSpan={9} style={{ color: '#6c757d' }}>Sin streams activos.</td>
              </tr>
            )}
          </tbody>
        </StyledTable>
      </ScrollBox>

      {selectedStreamId && (
        <div style={{ marginTop: 12 }}>
          <InlinePanel>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ fontWeight: 700 }}>
                Detalle stream #{selectedStreamId}
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <SmallBtn type="button" onClick={() => fetchStreamDetail(selectedStreamId)} disabled={detailLoading}>
                  {detailLoading ? 'Cargando…' : 'Recargar detalle'}
                </SmallBtn>
                <SmallBtn
                  type="button"
                  onClick={() => {
                    setSelectedStreamId(null);
                    setSelectedDetail(null);
                    setDetailError('');
                  }}
                >
                  Cerrar detalle
                </SmallBtn>
              </div>
            </div>

            {detailError && <StyledError>{detailError}</StyledError>}
            {detailLoading && !selectedDetail && <div>Cargando…</div>}

            {selectedDetail && (
              <>
                <PanelRow>
                  <FieldBlock>
                    <label>Tipo</label>
                    <div>{s?.streamType || '—'}</div>
                  </FieldBlock>

                  <FieldBlock>
                    <label>Cliente</label>
                    <div>{s?.clientId != null ? `#${s.clientId} · ${s?.clientNickname || s?.clientEmail || '—'}` : '—'}</div>
                  </FieldBlock>

                  <FieldBlock>
                    <label>Modelo</label>
                    <div>{s?.modelId != null ? `#${s.modelId} · ${s?.modelNickname || s?.modelEmail || '—'}` : '—'}</div>
                  </FieldBlock>
                </PanelRow>

                <PanelRow>
                  <FieldBlock>
                    <label>Inicio</label>
                    <div>{fmtTs(s?.startTime)}</div>
                  </FieldBlock>

                  <FieldBlock>
                    <label>Confirmado</label>
                    <div>{fmtTs(s?.confirmedAt)}</div>
                  </FieldBlock>

                  <FieldBlock>
                    <label>Fin</label>
                    <div>{fmtTs(s?.endTime)}</div>
                  </FieldBlock>

                  <FieldBlock>
                    <label>Duración</label>
                    <div>{formatDuration(s?.durationSeconds)}</div>
                  </FieldBlock>
                </PanelRow>

                <PanelRow>
                  <FieldBlock>
                    <label>Status</label>
                    <div>
                      <Badge data-variant={String(s?.statusDerivado || '—').toLowerCase()}>{s?.statusDerivado || '—'}</Badge>
                    </div>
                  </FieldBlock>

                  <FieldBlock>
                    <label>Stuck</label>
                    <div>{s?.stuck ? <Badge data-variant="danger">STUCK</Badge> : 'No'}</div>
                  </FieldBlock>
                </PanelRow>

                <div style={{ marginTop: 14, fontWeight: 700 }}>
                  Eventos
                </div>

                <div style={{ marginTop: 8 }}>
                  {detailEvents.length === 0 && !detailLoading && (
                    <div style={{ color: '#6c757d' }}>Sin eventos.</div>
                  )}

                  {detailEvents.length > 0 && (
                    <ScrollBox style={{ maxHeight: 320 }}>
                      <StyledTable>
                        <thead>
                          <tr>
                            <th>Fecha</th>
                            <th>Evento</th>
                            <th>Reason</th>
                            <th>Metadata</th>
                          </tr>
                        </thead>
                        <tbody>
                          {detailEvents.map((event, index) => (
                            <tr key={event?.id ?? `${event?.createdAt}-${event?.eventType}-${index}`}>
                              <td>{fmtTs(event?.createdAt)}</td>
                              <td>{event?.eventType || '—'}</td>
                              <td>{event?.reason || '—'}</td>
                              <td title={event?.metadata ? JSON.stringify(event.metadata) : ''}>{event?.metadata ? short(event.metadata, 140) : '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </StyledTable>
                    </ScrollBox>
                  )}
                </div>
              </>
            )}
          </InlinePanel>
        </div>
      )}
    </div>
  );
};

export default AdminActiveStreamsPanel;
