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
  StyledTable,
} from '../../../styles/AdminStyles';

const RUNTIME_HEALTH_TYPES = [
  'RH_ACTIVE_PAIR_WITHOUT_DB_STREAM',
  'RH_ACTIVE_CALL_WITHOUT_DB_STREAM',
  'RH_MODEL_AVAILABLE_WITH_ACTIVE_WORK',
  'RH_MODEL_BUSY_WITHOUT_ACTIVE_WORK',
  'RH_QUEUE_MEMBER_ALREADY_PAIRED',
  'RH_RINGING_STALE',
  'RH_REDIS_ACTIVE_SESSION_WITHOUT_DB_STREAM',
  'RH_LOCK_WITHOUT_ACTIVE_WORK',
];

const RuntimeHealthAnomaliesTable = ({ anomalies, loading }) => {
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

  const short = (v, n = 120) => {
    if (v == null) return '';
    const s = String(v);
    return s.length > n ? `${s.slice(0, n)}…` : s;
  };

  if (loading) {
    return <div>Cargando…</div>;
  }

  if (!anomalies.length) {
    return <div style={{ opacity: 0.8 }}>Sin anomalías Runtime Health para mostrar.</div>;
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <StyledTable>
        <thead>
          <tr>
            <th>ID</th>
            <th>Tipo</th>
            <th>Severidad</th>
            <th>Status</th>
            <th>User</th>
            <th>Stream</th>
            <th>Detected</th>
            <th>Run</th>
            <th>Descripción</th>
          </tr>
        </thead>
        <tbody>
          {anomalies.map((a) => (
            <tr key={a.id ?? `${a.anomalyType}-${a.detectedAt}-${Math.random()}`}>
              <td>{a.id ?? '—'}</td>
              <td>{a.anomalyType ?? '—'}</td>
              <td>{a.severity ?? '—'}</td>
              <td>{a.status ?? '—'}</td>
              <td>{a.userId ?? '—'}</td>
              <td>{a.streamRecordId ?? '—'}</td>
              <td>{fmtTs(a.detectedAt)}</td>
              <td>{a.auditRunId ?? '—'}</td>
              <td title={a.description || ''}>{short(a.description, 140) || '—'}</td>
            </tr>
          ))}
        </tbody>
      </StyledTable>
    </div>
  );
};

const AuditRuntimeHealthPanel = () => {
  const [auditDryRun, setAuditDryRun] = useState(true);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState('');
  const [auditResult, setAuditResult] = useState(null);

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
        body: JSON.stringify({
          scope: 'RUNTIME_HEALTH',
          dryRun: auditDryRun,
        }),
      });

      if (!res.ok) {
        throw new Error((await res.text()) || 'Error ejecutando Runtime Health');
      }

      const data = await res.json();
      setAuditResult(data || null);
    } catch (e) {
      setAuditError(e.message || 'Error ejecutando Runtime Health');
    } finally {
      setAuditLoading(false);
    }
  };

  const loadAnomalies = async () => {
    setAnomLoading(true);
    setAnomError('');

    try {
      const res = await fetch('/api/admin/audit/anomalies?limit=200', {
        credentials: 'include',
      });

      if (!res.ok) {
        throw new Error((await res.text()) || 'Error cargando anomalías');
      }

      const data = await res.json();
      const rows = Array.isArray(data) ? data : [];
      const filtered = rows.filter((a) => RUNTIME_HEALTH_TYPES.includes(a?.anomalyType));
      setAnomalies(filtered);
    } catch (e) {
      setAnomError(e.message || 'Error cargando anomalías');
      setAnomalies([]);
    } finally {
      setAnomLoading(false);
    }
  };

  return (
    <div>
      <SectionTitle>Runtime Health audit</SectionTitle>

      <CardsGrid>
        <StatCard>
          <div className="label">Runtime Health</div>
          <div className="meta">
            Busca incoherencias entre memoria runtime, Redis y base de datos:
            <ul style={{ margin: '8px 0 0 18px' }}>
              <li>Pair RANDOM activa en memoria sin stream activo en BBDD</li>
              <li>Call activa en memoria sin stream CALLING activo en BBDD</li>
              <li>Modelo AVAILABLE pero con trabajo activo</li>
              <li>Modelo BUSY sin trabajo activo</li>
              <li>Sesión en cola y a la vez emparejada</li>
              <li>Ringing colgado</li>
              <li>Redis session:active sin stream real</li>
              <li>Locks huérfanos</li>
            </ul>
          </div>

          <div
            style={{
              display: 'flex',
              gap: 10,
              alignItems: 'center',
              marginTop: 12,
              flexWrap: 'wrap',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <CheckBox
                type="checkbox"
                checked={auditDryRun}
                onChange={(e) => setAuditDryRun(e.target.checked)}
                title="Dry Run: no persiste anomalías"
              />
              <span style={{ fontSize: 13 }}>Dry Run (no persistir anomalías)</span>
            </div>

            <StyledButton onClick={runAudit} disabled={auditLoading}>
              {auditLoading ? 'Ejecutando…' : 'Ejecutar runtime health'}
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
          <div className="label">Últimas anomalías Runtime Health</div>

          <div
            style={{
              display: 'flex',
              gap: 10,
              alignItems: 'center',
              marginTop: 12,
              flexWrap: 'wrap',
            }}
          >
            <StyledButton onClick={loadAnomalies} disabled={anomLoading}>
              {anomLoading ? 'Cargando…' : 'Cargar anomalías'}
            </StyledButton>

            <RightInfo>
              {anomLoading ? 'Consultando /api/admin/audit/anomalies…' : anomalies.length > 0 ? `${anomalies.length} filas` : ''}
            </RightInfo>
          </div>

          {anomError && <StyledError style={{ marginTop: 10 }}>{anomError}</StyledError>}

          <div style={{ marginTop: 12 }}>
            <RuntimeHealthAnomaliesTable anomalies={anomalies} loading={anomLoading} />
          </div>
        </StatCard>

        <NoteCard $muted>
          <div className="label">Operativa recomendada</div>
          <div className="meta">
            Úsalo para detectar descuadres entre runtime y persistencia. En preproducción, ejecútalo en Dry Run.
          </div>
        </NoteCard>
      </CardsGrid>
    </div>
  );
};

export default AuditRuntimeHealthPanel;