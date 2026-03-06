// frontend/src/pages/admin/audit/AuditSessionIntegrityPanel.jsx
import React, { useState } from 'react';
import {
  CardsGrid,
  NoteCard,
  RightInfo,
  StatCard,
  StyledButton,
  StyledError,
  StyledSelect,
  StyledTable,
} from '../../../styles/AdminStyles';

const ANOM_LIMIT_OPTIONS = [10, 20, 50, 100, 200];

const AuditSessionIntegrityPanel = () => {
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
        body: JSON.stringify({
          scope: 'SESSION_INTEGRITY',
          dryRun: true,
        }),
      });

      if (!res.ok) {
        throw new Error((await res.text()) || 'Error ejecutando session integrity audit');
      }

      const data = await res.json();
      setAuditResult(data || null);
    } catch (e) {
      setAuditError(e.message || 'Error ejecutando session integrity audit');
    } finally {
      setAuditLoading(false);
    }
  };

  const loadAnomalies = async () => {
    setAnomLoading(true);
    setAnomError('');

    try {
      const res = await fetch(
        `/api/admin/audit/anomalies?limit=${encodeURIComponent(anomLimit)}&typePrefix=${encodeURIComponent('SI_')}`,
        {
          credentials: 'include',
        }
      );

      if (!res.ok) {
        throw new Error((await res.text()) || 'Error cargando anomalías de session integrity');
      }

      const data = await res.json();
      setAnomalies(Array.isArray(data) ? data : []);
    } catch (e) {
      setAnomError(e.message || 'Error cargando anomalías de session integrity');
      setAnomalies([]);
    } finally {
      setAnomLoading(false);
    }
  };

  const fmtTs = (v) => {
    if (!v) return '-';
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
    return s.length > n ? `${s.slice(0, n)}...` : s;
    };

  return (
    <div>
      <CardsGrid>
        <StatCard>
          <div className="label">Session Integrity audit</div>
          <div className="meta">
            Busca incoherencias del ciclo de vida de streams RANDOM y CALLING:
            <ul style={{ margin: '8px 0 0 18px' }}>
              <li>Stream cerrado sin evento ENDED</li>
              <li>Stream confirmado sin evento CONFIRMED</li>
              <li>Evento CONFIRMED sin confirmed_at</li>
              <li>Evento terminal sin end_time</li>
              <li>Timestamps invalidos</li>
              <li>Multiples streams activos para el mismo usuario</li>
              <li>Stream confirmado y cerrado sin cargo</li>
              <li>Stream confirmado y cerrado sin earning</li>
            </ul>
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 12, flexWrap: 'wrap' }}>
            <StyledButton onClick={runAudit} disabled={auditLoading}>
              {auditLoading ? 'Ejecutando...' : 'Ejecutar session integrity'}
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
          <div className="label">Ultimas anomalías Session Integrity</div>

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
              {anomLoading ? 'Cargando...' : 'Cargar anomalías'}
            </StyledButton>

            <RightInfo>
              {anomLoading ? 'Consultando anomalías SI_...' : anomalies.length > 0 ? `${anomalies.length} filas` : ''}
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
                      <th>Stream</th>
                      <th>Detected</th>
                      <th>Descripcion</th>
                    </tr>
                  </thead>
                  <tbody>
                    {anomalies.map((a) => (
                      <tr key={a.id ?? `${a.anomalyType}-${a.streamRecordId ?? 'x'}`}>
                        <td>{a.id ?? '-'}</td>
                        <td>{a.anomalyType ?? '-'}</td>
                        <td>{a.severity ?? '-'}</td>
                        <td>{a.status ?? '-'}</td>
                        <td>{a.userId ?? '-'}</td>
                        <td>{a.streamRecordId ?? '-'}</td>
                        <td>{fmtTs(a.detectedAt)}</td>
                        <td title={a.description || ''}>{short(a.description, 140) || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </StyledTable>
              </div>
            )}
          </div>
        </StatCard>

        <NoteCard $muted>
          <div className="label">Nota operativa</div>
          <div className="meta">
            Esta fase solo observa e informa. No modifica streams, no cierra sesiones y no altera la lógica de negocio.
          </div>
        </NoteCard>
      </CardsGrid>
    </div>
  );
};

export default AuditSessionIntegrityPanel;