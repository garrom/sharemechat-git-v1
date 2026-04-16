import React, { useEffect, useMemo, useState } from 'react';
import i18n from '../../i18n';
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
  const t = (key, options) => i18n.t(key, options);
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
        setError(e.message || i18n.t('admin.overview.errors.load'));
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
  const loadedLabel = loadedAt ? loadedAt.toLocaleTimeString() : t('admin.overview.loadingSync');

  const priorityItems = useMemo(() => {
    const items = [];

    if (modelSummary.pending > 0) {
      items.push({
        key: 'models',
        tone: '#fff1d6',
        title: t('admin.overview.priority.pendingModels.title', { count: modelSummary.pending }),
        meta: t('admin.overview.priority.pendingModels.meta'),
        action: t('admin.overview.priority.pendingModels.action'),
      });
    }

    if (openReports > 0) {
      items.push({
        key: 'moderation',
        tone: '#ffe2e0',
        title: t('admin.overview.priority.openReports.title', { count: openReports }),
        meta: t('admin.overview.priority.openReports.meta'),
        action: t('admin.overview.priority.openReports.action'),
      });
    }

    if (Number(stats?.randomWaitingViewers || 0) > 0 || Number(stats?.randomWaitingModels || 0) > 0) {
      items.push({
        key: 'operations',
        tone: '#dce9ff',
        title: t('admin.overview.priority.randomQueue.title'),
        meta: t('admin.overview.priority.randomQueue.meta', {
          models: stats?.randomWaitingModels ?? '-',
          viewers: stats?.randomWaitingViewers ?? '-',
        }),
        action: t('admin.overview.priority.randomQueue.action'),
      });
    }

    if (items.length === 0) {
      items.push({
        key: 'overview',
        tone: '#eef3fb',
        title: t('admin.overview.priority.noPending.title'),
        meta: t('admin.overview.priority.noPending.meta'),
        action: null,
      });
    }

    return items.slice(0, 3);
  }, [modelSummary.pending, openReports, stats, t]);

  return (
    <>
      {error ? <StyledError>{error}</StyledError> : null}

      <div style={{ width: '100%', maxWidth: 1180 }}>
        <MetricGrid>
          <MetricCard>
            <div className="label">{t('admin.overview.metrics.activeStreams.label')}</div>
            <div className="value">{loading ? '...' : activeStreams}</div>
            <div className="meta">{t('admin.overview.metrics.activeStreams.meta', { loadedLabel })}</div>
          </MetricCard>

          <MetricCard>
            <div className="label">{t('admin.overview.metrics.pendingOnboarding.label')}</div>
            <div className="value">{loading ? '...' : modelSummary.pending}</div>
            <div className="meta">{t('admin.overview.metrics.pendingOnboarding.meta')}</div>
          </MetricCard>

          <MetricCard>
            <div className="label">{t('admin.overview.metrics.openReports.label')}</div>
            <div className="value">{loading ? '...' : openReports}</div>
            <div className="meta">{t('admin.overview.metrics.openReports.meta')}</div>
          </MetricCard>

          <MetricCard>
            <div className="label">{t('admin.overview.metrics.financeAdjustments.label')}</div>
            <div className="value">
              {capabilities.canRefund
                ? t('admin.overview.metrics.financeAdjustments.manual')
                : t('admin.overview.metrics.financeAdjustments.notAvailable')}
            </div>
            <div className="meta">
              {capabilities.canRefund
                ? t('admin.overview.metrics.financeAdjustments.metaEnabled')
                : t('admin.overview.metrics.financeAdjustments.metaDisabled')}
            </div>
          </MetricCard>
        </MetricGrid>

        <OverviewGrid $stacked style={{ marginTop: 16 }}>
          <OverviewSpan $stacked $span={7} $spanTablet={6}>
            <SurfaceCard>
              <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 14 }}>{t('admin.overview.activity.title')}</div>
              <InlineKpiRow>
                <InlineKpi>
                  <div className="label">{t('admin.overview.activity.queueModels')}</div>
                  <div className="value">{stats?.randomWaitingModels ?? '-'}</div>
                </InlineKpi>
                <InlineKpi $tone="warning">
                  <div className="label">{t('admin.overview.activity.queueViewers')}</div>
                  <div className="value">{stats?.randomWaitingViewers ?? '-'}</div>
                </InlineKpi>
                <InlineKpi $tone="success">
                  <div className="label">{t('admin.overview.activity.randomPairs')}</div>
                  <div className="value">{stats?.randomActivePairs ?? '-'}</div>
                </InlineKpi>
                <InlineKpi>
                  <div className="label">{t('admin.overview.activity.directCalls')}</div>
                  <div className="value">{stats?.directActiveCalls ?? '-'}</div>
                </InlineKpi>
              </InlineKpiRow>

              <div style={{ marginTop: 16, fontSize: 13, lineHeight: 1.6, color: '#52607a' }}>
                {t('admin.overview.activity.note')}
              </div>
            </SurfaceCard>
          </OverviewSpan>

          <OverviewSpan $stacked $span={5} $spanTablet={6}>
            <SurfaceCard>
              <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 14 }}>{t('admin.overview.quickActions.title')}</div>
              <QuickActionsGrid>
                {capabilities.canViewStreams ? (
                  <QuickActionButton type="button" onClick={() => onOpen('operations')}>
                    <div className="title">{t('admin.overview.quickActions.operations.title')}</div>
                    <div className="meta">{t('admin.overview.quickActions.operations.meta')}</div>
                  </QuickActionButton>
                ) : null}

                {capabilities.canViewModels ? (
                  <QuickActionButton type="button" onClick={() => onOpen('models')}>
                    <div className="title">{t('admin.overview.quickActions.models.title')}</div>
                    <div className="meta">{t('admin.overview.quickActions.models.meta')}</div>
                  </QuickActionButton>
                ) : null}

                {capabilities.canViewModeration ? (
                  <QuickActionButton type="button" onClick={() => onOpen('moderation')}>
                    <div className="title">{t('admin.overview.quickActions.moderation.title')}</div>
                    <div className="meta">{t('admin.overview.quickActions.moderation.meta')}</div>
                  </QuickActionButton>
                ) : null}

                {capabilities.canViewFinance ? (
                  <QuickActionButton type="button" onClick={() => onOpen('finance')}>
                    <div className="title">{t('admin.overview.quickActions.finance.title')}</div>
                    <div className="meta">{t('admin.overview.quickActions.finance.meta')}</div>
                  </QuickActionButton>
                ) : null}
              </QuickActionsGrid>
            </SurfaceCard>
          </OverviewSpan>

          <OverviewSpan $stacked $span={6} $spanTablet={6}>
            <SurfaceCard>
              <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 14 }}>{t('admin.overview.priority.title')}</div>
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
              <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 14 }}>{t('admin.overview.statusSummary.title')}</div>
              <InlineKpiRow>
                <InlineKpi $tone="warning">
                  <div className="label">{t('admin.overview.statusSummary.pending')}</div>
                  <div className="value">{loading ? '...' : modelSummary.pending}</div>
                </InlineKpi>
                <InlineKpi $tone="success">
                  <div className="label">{t('admin.overview.statusSummary.approved')}</div>
                  <div className="value">{loading ? '...' : modelSummary.approved}</div>
                </InlineKpi>
                <InlineKpi $tone="danger">
                  <div className="label">{t('admin.overview.statusSummary.rejected')}</div>
                  <div className="value">{loading ? '...' : modelSummary.rejected}</div>
                </InlineKpi>
              </InlineKpiRow>
            </SurfaceCard>
          </OverviewSpan>

          <OverviewSpan $stacked $span={6} $spanTablet={6}>
            <SurfaceCard>
              <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 14 }}>{t('admin.overview.finance.title')}</div>
              <InlineKpiRow>
                <InlineKpi>
                  <div className="label">{t('admin.overview.finance.gross')}</div>
                  <div className="value">{financeSummary?.grossRevenueEUR ?? '-'}</div>
                </InlineKpi>
                <InlineKpi $tone="success">
                  <div className="label">{t('admin.overview.finance.netMargin')}</div>
                  <div className="value">{financeSummary?.netProfitEUR ?? '-'}</div>
                </InlineKpi>
                <InlineKpi>
                  <div className="label">{t('admin.overview.finance.marginPercent')}</div>
                  <div className="value">{financeSummary?.profitPercent ?? '-'}</div>
                </InlineKpi>
              </InlineKpiRow>
            </SurfaceCard>
          </OverviewSpan>

          <OverviewSpan $stacked $span={12} $spanTablet={6}>
            <AdminPlaceholderPanel
              title={t('admin.overview.placeholder.title')}
              body={t('admin.overview.placeholder.body')}
              note={t('admin.overview.placeholder.note')}
            />
          </OverviewSpan>
        </OverviewGrid>
      </div>
    </>
  );
};

export default AdminOverviewPanel;
