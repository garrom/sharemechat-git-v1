import React, { useState } from 'react';
import {
  CardsGrid,
  CheckBox,
  NoteCard,
  RightInfo,
  SectionTitle,
  StatCard,
  StyledButton,
  StyledError,
  StyledSelect,
  StyledTable,
} from '../../styles/AdminStyles';

const ANOM_LIMIT_OPTIONS = [10, 20, 50, 100, 200];

const AdminAuditPanel = () => {
  const [auditDryRun, setAuditDryRun] = useState(true);
  const [auditScope, setAuditScope] = useState('DEFAULT');
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState('');
  const [auditResult, setAuditResult] = useState(null);

  const [anomLimit, setAnomLimit] = useState(20);
  const [anomLoading, setAnomLoading] = useState(false);
  const [anomError, setAnomError] = useState('');
  const [anomalies, setAnomalies] = useState([]);

  const runAudit = async () => {
    setAuditLoading(true);
    setAuditError('');
    setAuditResult(null);
    try {
      const res = await fetch('/api/admin/audit/run', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ scope: auditScope, dryRun: auditDryRun }),
      });
      if (!res.ok) throw new Error((await res.text()) || 'Error ejecutando auditoría');
      const data = await res.json();
      setAuditResult(data || null);
    } catch (e) {
      setAuditError(e.message || 'Error ejecutando auditoría');
    } finally {
      setAuditLoading(false);
    }
  };

  const loadAnomalies = async () => {
    setAnomLoading(true);
    setAnomError('');
    try {
      const res = await fetch(`/api/admin/audit/anomalies?limit=${encodeURIComponent(anomLimit)}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error((await res.text()) || 'Error cargando anomalías');
      const data = await res.json();
      setAnomalies(Array.isArray(data) ? data : []);
    } catch (e) {
      setAnomError(e.message || 'Error cargando anomalías');
      setAnomalies([]);
    } finally {
      setAnomLoading(false);
    }
  };

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

  const short = (v, n = 60) => {
    if (v == null) return '';
    const s = String(v);
    return s.length > n ? `${s.slice(0, n)}…` : s;
  };

  return (
    <div>
      <SectionTitle>Auditoría contable</SectionTitle>

      <CardsGrid>
        <StatCard>
          <div className="label">Ejecución del audit</div>
          <div className="meta">
            Revisión determinista basada en ledger:
            <ul style={{ margin: '8px 0 0 18px' }}>
              <li>Transactions sin Balance</li>
              <li>Balance vs Ledger (SUM vs último balance)</li>
              <li>Plataforma: platform_transactions sin platform_balance</li>
            </ul>
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 12, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 180 }}>
              <div style={{ fontSize: 12, opacity: 0.8 }}>Scope</div>
              <StyledSelect value={auditScope} onChange={(e) => setAuditScope(e.target.value)}>
                <option value="DEFAULT">DEFAULT</option>
                <option value="SELFTEST">SELFTEST</option>
              </StyledSelect>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 18 }}>
              <CheckBox
                type="checkbox"
                checked={auditDryRun}
                onChange={(e) => setAuditDryRun(e.target.checked)}
                title="Dry Run: no persiste anomalías"
              />
              <span style={{ fontSize: 13 }}>Dry Run (no persistir anomalías)</span>
            </div>

            <StyledButton onClick={runAudit} disabled={auditLoading}>
              {auditLoading ? 'Ejecutando…' : 'Ejecutar auditoría'}
            </StyledButton>
          </div>

          {auditError && <StyledError style={{ marginTop: 10 }}>{auditError}</StyledError>}

          {auditResult && (
            <div style={{ marginTop: 12, fontSize: 13 }}>
              <div><strong>Resultado:</strong></div>
              <div style={{ marginTop: 6 }}>
                auditRunId: <strong>{auditResult.auditRunId}</strong>
              </div>
              <div>
                status: <strong>{auditResult.status}</strong>
              </div>
              <div>
                checksExecuted: <strong>{auditResult.checksExecuted}</strong>
              </div>
              <div>
                anomaliesFound: <strong>{auditResult.anomaliesFound}</strong>
              </div>
              <div>
                anomaliesCreated: <strong>{auditResult.anomaliesCreated}</strong>
              </div>
              <div>
                executionMs: <strong>{auditResult.executionMs}</strong>
              </div>
            </div>
          )}
        </StatCard>

        <StatCard>
          <div className="label">Últimas anomalías</div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 12, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 160 }}>
              <div style={{ fontSize: 12, opacity: 0.8 }}>Mostrar</div>
              <StyledSelect value={anomLimit} onChange={(e) => setAnomLimit(Number(e.target.value))}>
                {ANOM_LIMIT_OPTIONS.map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </StyledSelect>
            </div>

            <StyledButton onClick={loadAnomalies} disabled={anomLoading}>
              {anomLoading ? 'Cargando…' : 'Cargar anomalías'}
            </StyledButton>

            <RightInfo>
              {anomLoading ? 'Consultando /api/admin/audit/anomalies…' : anomalies.length > 0 ? `${anomalies.length} filas` : ''}
            </RightInfo>
          </div>

          {anomError && <StyledError style={{ marginTop: 10 }}>{anomError}</StyledError>}

          <div style={{ marginTop: 12 }}>
            {anomalies.length === 0 && !anomLoading && (
              <div style={{ opacity: 0.8 }}>Sin anomalías para mostrar.</div>
            )}

            {anomalies.length > 0 && (
              <div style={{ overflowX: 'auto' }}>
                <StyledTable>
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Tipo</th>
                      <th>Severidad</th>
                      <th>Status</th>
                      <th>User</th>
                      <th>Tx</th>
                      <th>PlatformTx</th>
                      <th>Stream</th>
                      <th>Detected</th>
                      <th>Run</th>
                      <th>Descripción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {anomalies.map((a) => (
                      <tr key={a.id ?? `${a.anomalyType}-${Math.random()}`}>
                        <td>{a.id ?? '—'}</td>
                        <td>{a.anomalyType ?? '—'}</td>
                        <td>{a.severity ?? '—'}</td>
                        <td>{a.status ?? '—'}</td>
                        <td>{a.userId ?? '—'}</td>
                        <td>{a.transactionId ?? '—'}</td>
                        <td>{a.platformTransactionId ?? '—'}</td>
                        <td>{a.streamRecordId ?? '—'}</td>
                        <td>{fmtTs(a.detectedAt)}</td>
                        <td>{a.auditRunId ?? '—'}</td>
                        <td title={a.description || ''}>{short(a.description, 90) || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </StyledTable>
              </div>
            )}
          </div>
        </StatCard>

        <NoteCard $muted>
          <div className="label">Operativa recomendada</div>
          <div className="meta">
            Usa Dry Run en producción para inspección. Cambia a Dry Run = false solo cuando quieras persistir anomalías.
          </div>
        </NoteCard>
      </CardsGrid>
    </div>
  );
};

export default AdminAuditPanel;
