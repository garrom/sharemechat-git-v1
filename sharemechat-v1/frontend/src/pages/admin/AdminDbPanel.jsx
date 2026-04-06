import React, { useEffect, useState } from 'react';
import {
  DbFilters,
  DbLayout,
  DbTableWrap,
  FieldBlock,
  FloatingBtn,
  RightInfo,
  SectionTitle,
  StyledError,
  StyledSelect,
  StyledTable,
} from '../../styles/AdminStyles';

const DB_TABLES = [
  'accounting_anomalies',
  'audit_runs',
  'balances',
  'client_documents',
  'clients',
  'consent_events',
  'favorites_clients',
  'favorites_models',
  'gifts',
  'messages',
  'model_contract_acceptances',
  'model_documents',
  'model_earning_tiers',
  'model_review_checklist',
  'model_tier_daily_snapshots',
  'moderation_reports',
  'models',
  'password_reset_tokens',
  'payment_sessions',
  'payout_requests',
  'platform_balances',
  'platform_transactions',
  'stream_records',
  'stream_status_events',
  'transactions',
  'unsubscribe',
  'user_blocks',
  'user_trial_streams',
  'users',
];

const LIMIT_OPTIONS = [10, 20, 30, 40, 50, 100];

const AdminDbPanel = ({ hideTitle = false }) => {
  const [dbTable, setDbTable] = useState('');
  const [dbLimit, setDbLimit] = useState(10);
  const [dbRows, setDbRows] = useState([]);
  const [dbLoading, setDbLoading] = useState(false);
  const [dbError, setDbError] = useState('');

  const isHiddenDbCell = (tableName, colName) => {
    const t = String(tableName || '').toLowerCase();
    const k = String(colName || '').toLowerCase();
    if (t === 'users' && (k === 'password' || k === 'biography' || k === 'interests' || k === 'regist_ip' || k === 'risk_reason')) return true;
    if (t === 'messages' && k === 'body') return true;
    if (t === 'password_reset_tokens' && k === 'token_hash') return true;
    if (t === 'consent_events' && (k === 'sig' || k === 'ip_hint')) return true;
    return false;
  };

  useEffect(() => {
    if (!dbTable) return;
    (async () => {
      setDbLoading(true);
      setDbError('');
      try {
        const res = await fetch(`/api/admin/db/view?table=${encodeURIComponent(dbTable)}&limit=${dbLimit}`, {
          credentials: 'include',
        });
        if (!res.ok) throw new Error((await res.text()) || 'Error al consultar BBDD');
        const data = await res.json();
        setDbRows(Array.isArray(data) ? data : []);
      } catch (e) {
        setDbError(e.message || 'Error al consultar BBDD');
        setDbRows([]);
      } finally {
        setDbLoading(false);
      }
    })();
  }, [dbTable, dbLimit]);

  return (
    <div>
      {!hideTitle && <SectionTitle>Exploracion tecnica raw</SectionTitle>}

      <DbLayout>
        <DbFilters id="dbFilters">
          <FieldBlock style={{ minWidth: 220 }}>
            <label>Tabla</label>
            <StyledSelect value={dbTable} onChange={(e) => setDbTable(e.target.value)}>
              <option value="" disabled>Selecciona una tabla...</option>
              {DB_TABLES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </StyledSelect>
          </FieldBlock>

          <FieldBlock style={{ minWidth: 120 }}>
            <label>Últimos</label>
            <StyledSelect value={dbLimit} onChange={(e) => setDbLimit(Number(e.target.value))} disabled={!dbTable}>
              {LIMIT_OPTIONS.map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </StyledSelect>
          </FieldBlock>

          <RightInfo>
            {dbTable === '' ? 'Elige una tabla para ver datos.' : dbLoading ? 'Cargando…' : ''}
          </RightInfo>
        </DbFilters>

        <DbTableWrap>
          <StyledTable>
            <thead>
              <tr>
                {dbRows.length > 0
                  ? Object.keys(dbRows[0]).map((k) => <th key={k}>{k}</th>)
                  : <th style={{ textAlign: 'left' }}>Sin datos</th>}
              </tr>
            </thead>
            <tbody>
              {dbRows.map((row, idx) => (
                <tr key={idx}>
                  {Object.keys(dbRows[0] || {}).map((k) => {
                    const hide = isHiddenDbCell(dbTable, k);
                    const raw = row[k];
                    const text = raw == null ? '' : String(raw);
                    const shown = hide ? '' : text.slice(0, 120) + (text.length > 120 ? '…' : '');
                    const title = hide ? '' : raw == null ? '' : text;
                    return (
                      <td key={k} title={title}>
                        {shown === '' ? '' : shown}
                        {shown === '' && raw == null ? '—' : ''}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </StyledTable>

          {dbError && (
            <div style={{ padding: 12 }}>
              <StyledError>{dbError}</StyledError>
            </div>
          )}
        </DbTableWrap>
      </DbLayout>

      <FloatingBtn
        type="button"
        onClick={() =>
          document.getElementById('dbFilters')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }
      >
        Filtros
      </FloatingBtn>
    </div>
  );
};

export default AdminDbPanel;
