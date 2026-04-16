import React, { useEffect, useRef, useState } from 'react';
import i18n from '../../i18n';
import {
  StyledButton,
  DarkHeaderTable,
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
  TableActionButton,
  TableDangerButton,
  Badge
} from '../../styles/AdminStyles';

const DEFAULT_FILTERS = {
  q: '',
  streamType: 'ALL',
  minDurationSec: '',
  limit: 200,
};

const AdminActiveStreamsPanel = ({ canKill = false }) => {
  const t = (key, options) => i18n.t(key, options);
  const destinationRef = useRef(null);
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [streams, setStreams] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [selectedStreamId, setSelectedStreamId] = useState(null);
  const [selectedDetail, setSelectedDetail] = useState(null);

  const scrollToDestination = () => {
    if (!destinationRef.current) return;
    window.requestAnimationFrame(() => {
      destinationRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  useEffect(() => {
    fetchActiveStreams(DEFAULT_FILTERS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      label: nickname || email || (id != null ? `#${id}` : '-'),
    };
  };

  const getStatus = (item) => item?.statusDerivado || item?.derivedStatus || item?.status || '-';
  const isStuck = (item) => Boolean(item?.stuck);

  const buildQuery = (nextFilters) => {
    const params = new URLSearchParams();
    if (nextFilters.q && nextFilters.q.trim()) params.set('q', nextFilters.q.trim());
    if (nextFilters.streamType && nextFilters.streamType !== 'ALL') params.set('streamType', nextFilters.streamType);
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
      if (!res.ok) throw new Error((await res.text()) || i18n.t('admin.streams.errors.loadList'));
      const data = await res.json();
      setStreams(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e.message || i18n.t('admin.streams.errors.loadList'));
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
      if (!res.ok) throw new Error((await res.text()) || i18n.t('admin.streams.errors.loadDetail'));
      const data = await res.json();
      setSelectedDetail(data || null);
      setSelectedStreamId(id);
    } catch (e) {
      setDetailError(e.message || i18n.t('admin.streams.errors.loadDetail'));
      setSelectedDetail(null);
      setSelectedStreamId(id);
    } finally {
      setDetailLoading(false);
    }
  };

  const killStream = async (streamId) => {
    if (!canKill || !streamId) return;
    if (!window.confirm(t('admin.streams.confirmKill'))) return;

    setError('');
    try {
      const res = await fetch(`/api/admin/streams/${streamId}/kill`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error((await res.text()) || i18n.t('admin.streams.errors.kill'));
      await fetchActiveStreams(filters);
      if (selectedStreamId === streamId) {
        setSelectedStreamId(null);
        setSelectedDetail(null);
        setDetailError('');
      }
    } catch (e) {
      setError(e.message || i18n.t('admin.streams.errors.kill'));
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
    scrollToDestination();
    await fetchStreamDetail(streamId);
  };

  const streamDetail = selectedDetail?.stream || selectedDetail || null;
  const detailEvents = Array.isArray(selectedDetail?.events) ? selectedDetail.events : [];

  return (
    <div style={{ width: '100%', maxWidth: 1200 }}>
      <ControlsRow>
        <FieldBlock>
          <label>{t('admin.streams.filters.search')}</label>
          <StyledInput
            type="text"
            value={filters.q}
            onChange={(e) => setFilters((prev) => ({ ...prev, q: e.target.value }))}
            placeholder={t('admin.streams.filters.searchPlaceholder')}
          />
        </FieldBlock>

        <FieldBlock>
          <label>{t('admin.streams.filters.type')}</label>
          <StyledSelect value={filters.streamType} onChange={(e) => setFilters((prev) => ({ ...prev, streamType: e.target.value }))}>
            <option value="ALL">ALL</option>
            <option value="CALLING">CALLING</option>
            <option value="RANDOM">RANDOM</option>
            <option value="UNKNOWN">UNKNOWN</option>
          </StyledSelect>
        </FieldBlock>

        <FieldBlock>
          <label>{t('admin.streams.filters.minDuration')}</label>
          <StyledInput
            type="number"
            min="0"
            value={filters.minDurationSec}
            onChange={(e) => setFilters((prev) => ({ ...prev, minDurationSec: e.target.value }))}
            placeholder="0"
          />
        </FieldBlock>

        <FieldBlock>
          <label>{t('admin.streams.filters.limit')}</label>
          <StyledSelect value={filters.limit} onChange={(e) => setFilters((prev) => ({ ...prev, limit: Number(e.target.value) }))}>
            <option value={50}>50</option>
            <option value={100}>100</option>
            <option value={200}>200</option>
            <option value={500}>500</option>
          </StyledSelect>
        </FieldBlock>

        <StyledButton type="button" onClick={applyFilters} disabled={loading}>
          {loading ? t('admin.streams.actions.loading') : t('admin.streams.actions.apply')}
        </StyledButton>

        <SmallBtn type="button" onClick={resetFilters} disabled={loading}>
          {t('admin.streams.actions.reset')}
        </SmallBtn>

        <RightInfo>
          {loading
            ? t('admin.streams.actions.loading')
            : t('admin.streams.resultsCount', { count: streams.length })}
        </RightInfo>
      </ControlsRow>

      {error && <StyledError>{error}</StyledError>}

      {!canKill && (
        <div style={{ marginBottom: 12, fontSize: 13, color: '#6c757d' }}>
          {t('admin.streams.readOnlySupport')}
        </div>
      )}

      <div style={{ overflowX: 'auto' }}>
        <DarkHeaderTable style={{ marginTop: 0 }}>
          <thead>
            <tr>
              <th>{t('admin.streams.table.id')}</th>
              <th>{t('admin.streams.table.type')}</th>
              <th>{t('admin.streams.table.client')}</th>
              <th>{t('admin.streams.table.model')}</th>
              <th>{t('admin.streams.table.start')}</th>
              <th>{t('admin.streams.table.duration')}</th>
              <th>{t('admin.streams.table.status')}</th>
              <th></th>
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
                <tr
                  key={streamId ?? `${client.label}-${model.label}-${stream?.startTime || Math.random()}`}
                  data-selected={selectedStreamId === streamId ? 'true' : undefined}
                >
                  <td>{streamId ?? '-'}</td>
                  <td>{stream?.streamType || '-'}</td>
                  <td>{client.id != null ? `#${client.id} - ${client.label}` : client.label}</td>
                  <td>{model.id != null ? `#${model.id} - ${model.label}` : model.label}</td>
                  <td>{fmtTs(stream?.startTime)}</td>
                  <td>{formatDuration(stream?.durationSeconds)}</td>
                  <td>
                    <Badge data-variant={String(derivedStatus).toLowerCase()}>{derivedStatus}</Badge>
                  </td>
                  <td>
                    {isStuck(stream) && <Badge data-variant="danger">{t('admin.streams.table.stuck')}</Badge>}
                  </td>
                  <td>
                    <TableActionButton type="button" onClick={() => handleOpenDetail(streamId)}>
                      {selectedStreamId === streamId ? t('admin.streams.actions.close') : t('admin.streams.actions.detail')}
                    </TableActionButton>
                  </td>
                  <td>
                    {canKill && derivedStatus !== 'closed' && (
                      <TableDangerButton type="button" onClick={() => killStream(streamId)}>
                        {t('admin.streams.actions.kill')}
                      </TableDangerButton>
                    )}
                  </td>
                </tr>
              );
            })}

            {!loading && streams.length === 0 && (
              <tr>
                <td colSpan={10} style={{ color: '#6c757d' }}>{t('admin.streams.empty')}</td>
              </tr>
            )}
          </tbody>
        </DarkHeaderTable>
      </div>

      {selectedStreamId && (
        <div ref={destinationRef} style={{ marginTop: 12 }}>
          <InlinePanel>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ fontWeight: 700 }}>
                {t('admin.streams.detail.title', { id: selectedStreamId })}
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <SmallBtn type="button" onClick={() => fetchStreamDetail(selectedStreamId)} disabled={detailLoading}>
                  {detailLoading ? t('admin.streams.actions.loading') : t('admin.streams.actions.reloadDetail')}
                </SmallBtn>
                <SmallBtn
                  type="button"
                  onClick={() => {
                    setSelectedStreamId(null);
                    setSelectedDetail(null);
                    setDetailError('');
                  }}
                >
                  {t('admin.streams.actions.closeDetail')}
                </SmallBtn>
              </div>
            </div>

            {detailError && <StyledError>{detailError}</StyledError>}
            {detailLoading && !selectedDetail && <div>{t('admin.streams.actions.loading')}</div>}

            {selectedDetail && (
              <>
                <PanelRow>
                  <FieldBlock>
                    <label>{t('admin.streams.detail.type')}</label>
                    <div>{streamDetail?.streamType || '-'}</div>
                  </FieldBlock>

                  <FieldBlock>
                    <label>{t('admin.streams.detail.client')}</label>
                    <div>{streamDetail?.clientId != null ? `#${streamDetail.clientId} - ${streamDetail?.clientNickname || streamDetail?.clientEmail || '-'}` : '-'}</div>
                  </FieldBlock>

                  <FieldBlock>
                    <label>{t('admin.streams.detail.model')}</label>
                    <div>{streamDetail?.modelId != null ? `#${streamDetail.modelId} - ${streamDetail?.modelNickname || streamDetail?.modelEmail || '-'}` : '-'}</div>
                  </FieldBlock>
                </PanelRow>

                <PanelRow>
                  <FieldBlock>
                    <label>{t('admin.streams.detail.start')}</label>
                    <div>{fmtTs(streamDetail?.startTime)}</div>
                  </FieldBlock>

                  <FieldBlock>
                    <label>{t('admin.streams.detail.confirmed')}</label>
                    <div>{fmtTs(streamDetail?.confirmedAt)}</div>
                  </FieldBlock>

                  <FieldBlock>
                    <label>{t('admin.streams.detail.end')}</label>
                    <div>{fmtTs(streamDetail?.endTime)}</div>
                  </FieldBlock>

                  <FieldBlock>
                    <label>{t('admin.streams.detail.duration')}</label>
                    <div>{formatDuration(streamDetail?.durationSeconds)}</div>
                  </FieldBlock>
                </PanelRow>

                <PanelRow>
                  <FieldBlock>
                    <label>{t('admin.streams.detail.status')}</label>
                    <div>
                      <Badge data-variant={String(streamDetail?.statusDerivado || '-').toLowerCase()}>{streamDetail?.statusDerivado || '-'}</Badge>
                    </div>
                  </FieldBlock>

                  <FieldBlock>
                    <label>{t('admin.streams.detail.stuck')}</label>
                    <div>{streamDetail?.stuck ? <Badge data-variant="danger">{t('admin.streams.table.stuck')}</Badge> : t('admin.streams.common.no')}</div>
                  </FieldBlock>
                </PanelRow>

                <div style={{ marginTop: 14, fontWeight: 700 }}>
                  {t('admin.streams.events.title')}
                </div>

                <div style={{ marginTop: 8 }}>
                  {detailEvents.length === 0 && !detailLoading && (
                    <div style={{ color: '#6c757d' }}>{t('admin.streams.events.empty')}</div>
                  )}

                  {detailEvents.length > 0 && (
                    <ScrollBox style={{ maxHeight: 320 }}>
                      <DarkHeaderTable>
                        <thead>
                          <tr>
                            <th>{t('admin.streams.events.table.date')}</th>
                            <th>{t('admin.streams.events.table.event')}</th>
                            <th>{t('admin.streams.events.table.reason')}</th>
                            <th>{t('admin.streams.events.table.metadata')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {detailEvents.map((event, index) => (
                            <tr key={event?.id ?? `${event?.createdAt}-${event?.eventType}-${index}`}>
                              <td>{fmtTs(event?.createdAt)}</td>
                              <td>{event?.eventType || '-'}</td>
                              <td>{event?.reason || '-'}</td>
                              <td title={event?.metadata ? JSON.stringify(event.metadata) : ''}>{event?.metadata ? short(event.metadata, 140) : '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </DarkHeaderTable>
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
