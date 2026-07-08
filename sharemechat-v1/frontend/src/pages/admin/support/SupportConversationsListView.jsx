import React, { useCallback, useEffect, useState } from 'react';
import styled from 'styled-components';
import i18n from '../../../i18n';
import { apiFetch } from '../../../config/http';
import PillStatus from './components/PillStatus';
import SupportButton from './components/SupportButton';

// Frente B.3.2 (ADR-046). Listado de conversaciones con filtros + paginación.
// Sin auto-refresh (el badge global cubre "hay algo nuevo"; el operador recarga
// a mano cuando quiere revisar la cola en detalle).

const Wrap = styled.div`
  padding: 12px 4px;
`;

const Toolbar = styled.div`
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
  align-items: center;
  margin-bottom: 12px;
`;

const FilterGroup = styled.div`
  display: flex;
  gap: 6px;
  align-items: center;
`;

const RadioBtn = styled.button`
  padding: 4px 10px;
  font-size: 0.78rem;
  border-radius: 999px;
  border: 1px solid ${(p) => (p.$active ? '#1e3a8a' : '#d1d5db')};
  background: ${(p) => (p.$active ? '#1e3a8a' : '#fff')};
  color: ${(p) => (p.$active ? '#fff' : '#1f2937')};
  cursor: pointer;
`;

const Select = styled.select`
  padding: 4px 8px;
  font-size: 0.85rem;
  border-radius: 6px;
  border: 1px solid #d1d5db;
`;

const Label = styled.span`
  font-size: 0.78rem;
  color: #64748b;
  font-weight: 600;
  margin-right: 4px;
`;

const Spacer = styled.span`
  flex: 1;
`;

const Meta = styled.div`
  font-size: 0.82rem;
  color: #52607a;
`;

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-size: 0.88rem;
`;

const Th = styled.th`
  text-align: left;
  padding: 8px 6px;
  border-bottom: 2px solid #e2e8f0;
  color: #475569;
  font-weight: 700;
  font-size: 0.78rem;
  letter-spacing: 0.02em;
  text-transform: uppercase;
`;

const Td = styled.td`
  padding: 10px 6px;
  border-bottom: 1px solid #f1f5f9;
  vertical-align: middle;
`;

const Row = styled.tr`
  cursor: pointer;
  &:hover td { background: #f8fafc; }
`;

const UserBlock = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
`;

const UserEmail = styled.div`
  font-weight: 600;
  color: #0f172a;
`;

const UserRoleMsgs = styled.div`
  font-size: 0.72rem;
  color: #64748b;
`;

const RoleChip = styled.span`
  display: inline-block;
  padding: 1px 6px;
  border-radius: 4px;
  background: #eef2ff;
  color: #4338ca;
  font-size: 0.68rem;
  font-weight: 700;
  margin-right: 6px;
`;

const AgentBlock = styled.div`
  font-size: 0.85rem;
  color: #1f2937;
`;

const AgentUnassigned = styled.span`
  color: #b45309;
  font-style: italic;
  font-size: 0.82rem;
`;

const RelativeTime = styled.span`
  color: #64748b;
  font-size: 0.82rem;
`;

const ErrorLine = styled.div`
  padding: 8px 12px;
  background: #fef2f2;
  color: #991b1b;
  border-radius: 6px;
  border: 1px solid #fecaca;
  margin: 8px 0;
  font-size: 0.85rem;
`;

const Pagination = styled.div`
  display: flex;
  gap: 8px;
  align-items: center;
  padding: 12px 4px;
`;

const relativeFrom = (isoStr) => {
  if (!isoStr) return '';
  try {
    const d = new Date(isoStr);
    if (Number.isNaN(d.getTime())) return '';
    const diffMs = Date.now() - d.getTime();
    const diffMin = Math.round(diffMs / 60000);
    if (diffMin < 1) return 'ahora';
    if (diffMin < 60) return `hace ${diffMin} min`;
    const diffH = Math.round(diffMin / 60);
    if (diffH < 24) return `hace ${diffH} h`;
    const diffD = Math.round(diffH / 24);
    if (diffD < 7) return `hace ${diffD} d`;
    const yyyy = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mo}-${dd}`;
  } catch {
    return '';
  }
};

const STATUS_FILTERS = [
  { key: 'ALL', apiValue: null, agentFilter: null, unassignedOnly: false },
  { key: 'ESCALATED_UNASSIGNED', apiValue: 'ESCALATED', agentFilter: 'unassigned' },
  { key: 'HUMAN_HANDLING', apiValue: 'HUMAN_HANDLING', agentFilter: null },
  { key: 'RESOLVED', apiValue: 'RESOLVED', agentFilter: null },
];

const AGENT_FILTERS = [
  { key: 'all', apiValue: null },
  { key: 'me', apiValue: 'me' },
  { key: 'unassigned', apiValue: 'unassigned' },
];

const SupportConversationsListView = ({ onOpenDetail, refreshTick = 0 }) => {
  const t = (key, opts) => i18n.t(key, opts);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [agentFilter, setAgentFilter] = useState('all');
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(20);
  const [pageData, setPageData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setErr('');
    try {
      const preset = STATUS_FILTERS.find((f) => f.key === statusFilter) || STATUS_FILTERS[0];
      // Resolucion del filtro compuesto:
      // - "ESCALATED_UNASSIGNED" fuerza status=ESCALATED + assignedAgentId=unassigned.
      // - En el resto de casos, el select de agente aplica normal.
      const effectiveStatus = preset.apiValue;
      let effectiveAgent = preset.agentFilter !== undefined ? preset.agentFilter : null;
      if (statusFilter === 'ALL' || statusFilter === 'RESOLVED' || statusFilter === 'HUMAN_HANDLING') {
        const agentPreset = AGENT_FILTERS.find((f) => f.key === agentFilter) || AGENT_FILTERS[0];
        effectiveAgent = agentPreset.apiValue;
      }
      const qs = new URLSearchParams();
      if (effectiveStatus) qs.set('status', effectiveStatus);
      if (effectiveAgent) qs.set('assignedAgentId', effectiveAgent);
      qs.set('page', String(page));
      qs.set('size', String(size));
      const data = await apiFetch(`/admin/support/conversations?${qs.toString()}`);
      setPageData(data || null);
    } catch (e) {
      setErr(e?.message || 'Error');
      setPageData(null);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, agentFilter, page, size]);

  useEffect(() => {
    load();
  }, [load, refreshTick]);

  const rows = pageData?.content || [];
  const totalElements = pageData?.totalElements || 0;
  const totalPages = pageData?.totalPages || 0;

  const showAgentFilter = statusFilter === 'ALL' || statusFilter === 'RESOLVED' || statusFilter === 'HUMAN_HANDLING';

  return (
    <Wrap>
      <Toolbar>
        <FilterGroup>
          <Label>{t('admin.support.filters.status')}</Label>
          {STATUS_FILTERS.map((f) => (
            <RadioBtn
              key={f.key}
              $active={statusFilter === f.key}
              onClick={() => { setStatusFilter(f.key); setPage(0); }}
              type="button"
            >
              {t(`admin.support.filters.statusOptions.${f.key}`)}
            </RadioBtn>
          ))}
        </FilterGroup>
        {showAgentFilter ? (
          <FilterGroup>
            <Label>{t('admin.support.filters.agent')}</Label>
            <Select
              value={agentFilter}
              onChange={(e) => { setAgentFilter(e.target.value); setPage(0); }}
            >
              {AGENT_FILTERS.map((f) => (
                <option key={f.key} value={f.key}>
                  {t(`admin.support.filters.agentOptions.${f.key}`)}
                </option>
              ))}
            </Select>
          </FilterGroup>
        ) : null}
        <Spacer />
        <FilterGroup>
          <Label>{t('admin.support.filters.pageSize')}</Label>
          <Select
            value={size}
            onChange={(e) => { setSize(Number(e.target.value)); setPage(0); }}
          >
            <option value={20}>20</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </Select>
        </FilterGroup>
        <SupportButton variant="secondary" size="sm" onClick={load} disabled={loading}>
          {loading ? t('admin.support.common.loading') : t('admin.support.actions.reload')}
        </SupportButton>
      </Toolbar>

      {err ? <ErrorLine>{err}</ErrorLine> : null}

      <Meta>
        {t('admin.support.list.summary', {
          from: totalElements === 0 ? 0 : page * size + 1,
          to: Math.min(totalElements, (page + 1) * size),
          total: totalElements,
        })}
      </Meta>

      <Table>
        <thead>
          <tr>
            <Th>{t('admin.support.columns.user')}</Th>
            <Th>{t('admin.support.columns.status')}</Th>
            <Th>{t('admin.support.columns.agent')}</Th>
            <Th>{t('admin.support.columns.lastMessage')}</Th>
            <Th>{t('admin.support.columns.actions')}</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((c) => (
            <Row key={c.id} onClick={() => onOpenDetail && onOpenDetail(c.id)}>
              <Td>
                <UserBlock>
                  <UserEmail>{c.userEmail || `#${c.userId}`}</UserEmail>
                  <UserRoleMsgs>
                    {c.userRole ? <RoleChip>{c.userRole}</RoleChip> : null}
                    {t('admin.support.list.msgsCount', { count: Number(c.messageCount) || 0 })}
                  </UserRoleMsgs>
                </UserBlock>
              </Td>
              <Td>
                <PillStatus
                  status={c.resolutionStatus}
                  label={t(`admin.support.status.${c.resolutionStatus}`, {
                    defaultValue: c.resolutionStatus,
                  })}
                />
              </Td>
              <Td>
                {c.assignedProfileDisplayName ? (
                  <AgentBlock>{c.assignedProfileDisplayName}</AgentBlock>
                ) : (
                  <AgentUnassigned>{t('admin.support.list.unassigned')}</AgentUnassigned>
                )}
              </Td>
              <Td>
                <RelativeTime>
                  {relativeFrom(c.lastMessageAt || c.updatedAt)}
                </RelativeTime>
              </Td>
              <Td>
                <SupportButton
                  variant="secondary"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onOpenDetail) onOpenDetail(c.id);
                  }}
                >
                  {t('admin.support.actions.open')}
                </SupportButton>
              </Td>
            </Row>
          ))}
          {!loading && rows.length === 0 ? (
            <tr>
              <Td colSpan={5} style={{ padding: '20px 6px', color: '#64748b', textAlign: 'center' }}>
                {t('admin.support.list.empty')}
              </Td>
            </tr>
          ) : null}
        </tbody>
      </Table>

      <Pagination>
        <SupportButton
          size="sm"
          variant="secondary"
          onClick={() => setPage(Math.max(0, page - 1))}
          disabled={page === 0 || loading}
        >
          {t('admin.support.pagination.prev')}
        </SupportButton>
        <Meta>
          {t('admin.support.pagination.pageOf', {
            page: page + 1,
            total: Math.max(1, totalPages),
          })}
        </Meta>
        <SupportButton
          size="sm"
          variant="secondary"
          onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
          disabled={page >= totalPages - 1 || loading}
        >
          {t('admin.support.pagination.next')}
        </SupportButton>
      </Pagination>
    </Wrap>
  );
};

export default SupportConversationsListView;
