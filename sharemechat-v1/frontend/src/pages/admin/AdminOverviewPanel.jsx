import React, { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../../config/http';
import { StyledError } from '../../styles/AdminStyles';
import {
  InlineKpi,
  InlineKpiRow,
  MetricCard,
  MetricGrid,
  OverviewGrid,
  OverviewSpan,
  QuickActionButton,
  QuickActionsGrid,
  SurfaceCard,
} from '../../styles/AdminShellStyles';
import AdminPlaceholderPanel from './components/AdminPlaceholderPanel';

const AdminOverviewPanel = ({
  capabilities,
  onOpen,
}) => {
  const [stats, setStats] = useState(null);
  const [models, setModels] = useState([]);
  const [reports, setReports] = useState([]);
  const [financeSummary, setFinanceSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [loadedAt, setLoadedAt] = useState(null);

  useEffect(() => {
    let cancelled = false;

    const loadOverview = async () => {
      setLoading(true);
      setError('');
      try {
        const requests = [];

        requests.push(
          capabilities.canViewStats
            ? apiFetch('/admin/stats/overview')
            : Promise.resolve(null)
        );

        requests.push(
          capabilities.canViewModels
            ? apiFetch('/admin/models')
            : Promise.resolve([])
        );

        requests.push(
          capabilities.canViewModeration
            ? apiFetch('/admin/moderation/reports?status=OPEN')
            : Promise.resolve([])
        );

        requests.push(
          capabilities.canViewFinance
            ? apiFetch('/admin/finance/summary')
            : Promise.resolve(null)
        );

        const [statsData, modelsData, reportsData, financeData] = await Promise.all(requests);

        if (cancelled) return;

        setStats(statsData || null);
        setModels(Array.isArray(modelsData) ? modelsData : []);
        setReports(Array.isArray(reportsData) ? reportsData : []);
        setFinanceSummary(financeData || null);
        setLoadedAt(new Date());
      } catch (e) {
        if (cancelled) return;
        setError(e.message || 'No se pudo cargar el overview.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadOverview();
    return () => {
      cancelled = true;
    };
  }, [capabilities]);

  const modelSummary = useMemo(() => {
    const initial = {
      pending: 0,
      approved: 0,
      rejected: 0,
    };

    return models.reduce((acc, item) => {
      const status = String(item?.verificationStatus || '').toUpperCase();
      if (status === 'APPROVED') acc.approved += 1;
      else if (status === 'REJECTED') acc.rejected += 1;
      else acc.pending += 1;
      return acc;
    }, initial);
  }, [models]);

  const openReports = reports.length;
  const activeStreams = Number(stats?.persistedRandomActive || 0) + Number(stats?.persistedCallingActive || 0);
  const loadedLabel = loadedAt ? loadedAt.toLocaleTimeString() : 'sincronizando';
  const priorityItems = useMemo(() => {
    const items = [];

    if (modelSummary.pending > 0) {
      items.push({
        key: 'models',
        tone: '#fff1d6',
        title: `${modelSummary.pending} modelos pendientes de revision`,
        meta: 'Conviene revisar onboarding y documentacion pendiente.',
        action: 'Abrir Modelos',
      });
    }

    if (openReports > 0) {
      items.push({
        key: 'moderation',
        tone: '#ffe2e0',
        title: `${openReports} reports abiertos`,
        meta: 'Hay incidencias pendientes de triage o decision.',
        action: 'Abrir Moderacion',
      });
    }

    if (Number(stats?.randomWaitingViewers || 0) > 0 || Number(stats?.randomWaitingModels || 0) > 0) {
      items.push({
        key: 'operations',
        tone: '#dce9ff',
        title: 'Colas activas en random',
        meta: `Modelos en cola: ${stats?.randomWaitingModels ?? '-'} · Clientes en cola: ${stats?.randomWaitingViewers ?? '-'}`,
        action: 'Abrir Operaciones',
      });
    }

    if (items.length === 0) {
      items.push({
        key: 'overview',
        tone: '#eef3fb',
        title: 'Sin pendientes prioritarios visibles',
        meta: 'Con los datos cargados en esta portada no se detectan colas o pendientes relevantes.',
        action: null,
      });
    }

    return items.slice(0, 3);
  }, [modelSummary.pending, openReports, stats]);

  return (
    <>
      {error ? <StyledError>{error}</StyledError> : null}

      <div style={{ width: '100%', maxWidth: 860 }}>
        <MetricGrid>
          <MetricCard>
            <div className="label">Streams activos</div>
            <div className="value">{loading ? '...' : activeStreams}</div>
            <div className="meta">Random activos y llamadas directas persistidas. Ultima actualizacion: {loadedLabel}.</div>
          </MetricCard>

          <MetricCard>
            <div className="label">Onboarding pendiente</div>
            <div className="value">{loading ? '...' : modelSummary.pending}</div>
            <div className="meta">Modelos pendientes de revision o todavia no aprobados.</div>
          </MetricCard>

          <MetricCard>
            <div className="label">Reports abiertos</div>
            <div className="value">{loading ? '...' : openReports}</div>
            <div className="meta">Casos de moderacion en estado OPEN, listos para triage.</div>
          </MetricCard>

          <MetricCard>
            <div className="label">Ajustes financieros</div>
            <div className="value">{capabilities.canRefund ? 'Manual' : 'N/D'}</div>
            <div className="meta">
              {capabilities.canRefund
                ? 'Refund manual disponible en Ajustes financieros.'
                : 'Todavia no hay endpoint especifico para un contador de refunds recientes.'}
            </div>
          </MetricCard>
        </MetricGrid>

        <OverviewGrid $stacked style={{ marginTop: 16 }}>
        <OverviewSpan $stacked $span={7} $spanTablet={6}>
          <SurfaceCard>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 14 }}>Actividad operativa</div>
            <InlineKpiRow>
              <InlineKpi>
                <div className="label">Modelos en cola</div>
                <div className="value">{stats?.randomWaitingModels ?? '-'}</div>
              </InlineKpi>
              <InlineKpi $tone="warning">
                <div className="label">Clientes en cola</div>
                <div className="value">{stats?.randomWaitingViewers ?? '-'}</div>
              </InlineKpi>
              <InlineKpi $tone="success">
                <div className="label">Pares random</div>
                <div className="value">{stats?.randomActivePairs ?? '-'}</div>
              </InlineKpi>
              <InlineKpi>
                <div className="label">Llamadas directas</div>
                <div className="value">{stats?.directActiveCalls ?? '-'}</div>
              </InlineKpi>
            </InlineKpiRow>

            <div style={{ marginTop: 16, fontSize: 13, lineHeight: 1.6, color: '#52607a' }}>
              Esta portada reutiliza datos ya disponibles del panel actual. Sirve como punto de entrada operativo y no sustituye todavia los modulos de detalle.
            </div>
          </SurfaceCard>
        </OverviewSpan>

        <OverviewSpan $stacked $span={5} $spanTablet={6}>
          <SurfaceCard>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 14 }}>Accesos rapidos</div>
            <QuickActionsGrid>
              {capabilities.canViewStreams ? (
                <QuickActionButton type="button" onClick={() => onOpen('operations')}>
                  <div className="title">Operaciones en tiempo real</div>
                  <div className="meta">Ver actividad de runtime, streams activos y acciones de corte.</div>
                </QuickActionButton>
              ) : null}

              {capabilities.canViewModels ? (
                <QuickActionButton type="button" onClick={() => onOpen('models')}>
                  <div className="title">Onboarding de modelos</div>
                  <div className="meta">Revisar pendientes, documentos y estados de verificacion.</div>
                </QuickActionButton>
              ) : null}

              {capabilities.canViewModeration ? (
                <QuickActionButton type="button" onClick={() => onOpen('moderation')}>
                  <div className="title">Moderacion</div>
                  <div className="meta">Abrir reports y continuar el flujo de revision.</div>
                </QuickActionButton>
              ) : null}

              {capabilities.canViewFinance ? (
                <QuickActionButton type="button" onClick={() => onOpen('finance')}>
                  <div className="title">Finanzas</div>
                  <div className="meta">Consultar resumen economico y rendimiento principal.</div>
                </QuickActionButton>
              ) : null}
            </QuickActionsGrid>
          </SurfaceCard>
        </OverviewSpan>

        <OverviewSpan $stacked $span={6} $spanTablet={6}>
          <SurfaceCard>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 14 }}>Pendientes prioritarios</div>
            <div style={{ display: 'grid', gap: 10 }}>
              {priorityItems.map((item) => (
                <div
                  key={item.title}
                  style={{
                    border: '1px solid #d7deea',
                    borderRadius: 12,
                    padding: '12px 14px',
                    background: item.tone,
                  }}
                >
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#162033' }}>{item.title}</div>
                  <div style={{ marginTop: 6, fontSize: 13, lineHeight: 1.5, color: '#52607a' }}>{item.meta}</div>
                  {item.action ? (
                    <button
                      type="button"
                      onClick={() => onOpen(item.key)}
                      style={{
                        marginTop: 10,
                        border: '1px solid #c0cad9',
                        background: '#fff',
                        color: '#162033',
                        borderRadius: 10,
                        padding: '8px 10px',
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      {item.action}
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
          </SurfaceCard>
        </OverviewSpan>

        <OverviewSpan $stacked $span={6} $spanTablet={6}>
          <SurfaceCard>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 14 }}>Onboarding y estados</div>
            <InlineKpiRow>
              <InlineKpi $tone="warning">
                <div className="label">Pendientes</div>
                <div className="value">{loading ? '...' : modelSummary.pending}</div>
              </InlineKpi>
              <InlineKpi $tone="success">
                <div className="label">Aprobados</div>
                <div className="value">{loading ? '...' : modelSummary.approved}</div>
              </InlineKpi>
              <InlineKpi $tone="danger">
                <div className="label">Rechazados</div>
                <div className="value">{loading ? '...' : modelSummary.rejected}</div>
              </InlineKpi>
            </InlineKpiRow>
          </SurfaceCard>
        </OverviewSpan>

        <OverviewSpan $stacked $span={6} $spanTablet={6}>
          <SurfaceCard>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 14 }}>Resumen economico</div>
            <InlineKpiRow>
              <InlineKpi>
                <div className="label">Bruto</div>
                <div className="value">{financeSummary?.grossRevenueEUR ?? '-'}</div>
              </InlineKpi>
              <InlineKpi $tone="success">
                <div className="label">Margen neto</div>
                <div className="value">{financeSummary?.netProfitEUR ?? '-'}</div>
              </InlineKpi>
              <InlineKpi>
                <div className="label">% margen</div>
                <div className="value">{financeSummary?.profitPercent ?? '-'}</div>
              </InlineKpi>
            </InlineKpiRow>
          </SurfaceCard>
        </OverviewSpan>

        <OverviewSpan $stacked $span={12} $spanTablet={6}>
          <AdminPlaceholderPanel
            title="Base del nuevo backoffice"
            body="La portada nueva ya agrupa overview, operaciones, modelos, moderacion, finanzas, control interno, datos internos y administracion. Los modulos existentes siguen vivos dentro de esta estructura mientras se redisena su logica interna."
            note="En esta fase no se introduce backend nuevo. Los bloques sin fuente dedicada siguen marcados como transicion o placeholder operativo."
          />
        </OverviewSpan>
        </OverviewGrid>
      </div>
    </>
  );
};

export default AdminOverviewPanel;
