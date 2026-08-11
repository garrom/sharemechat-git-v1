import React, { useEffect, useState } from 'react';
import i18n from '../../i18n';
import {
  CardsGrid,
  SectionTitle,
  StatCard,
  StyledError,
} from '../../styles/AdminStyles';

// Panel de adquisicion / crecimiento (backoffice). Consume el endpoint
// read-only /api/admin/acquisition/overview (agrega la capa B ADR-057 + users).
// Dos pestanas: "Tablas" (grid escalable con scroll interno por tarjeta, no
// scroll infinito) y "Graficos" (barras SVG/CSS sin dependencia nueva).
// Datos first-party (server-side); no muta nada. Textos con defaultValue (ES).
// NOTA: todas las llamadas a i18n.t() ocurren en render (nunca a nivel modulo).
const WINDOWS = [7, 30, 90];
const BAR = '#4f46e5';

// Config de desgloses (sin llamar a t() aqui; el label es solo acceso a datos).
const BREAKDOWNS = [
  { key: 'bySource', titleKey: 'admin.acquisition.tables.bySource', titleDef: 'Por canal (utm_source)', colKey: 'admin.acquisition.cols.source', colDef: 'Canal', label: (r) => String(r.source ?? '-') },
  { key: 'byReferrerHost', titleKey: 'admin.acquisition.tables.byReferrerHost', titleDef: 'Por sitio de origen (referrer)', colKey: 'admin.acquisition.cols.host', colDef: 'Referrer', label: (r) => String(r.host ?? '-') },
  { key: 'topLandingPaths', titleKey: 'admin.acquisition.tables.topLandingPaths', titleDef: 'Landing pages que convierten', colKey: 'admin.acquisition.cols.path', colDef: 'Landing', label: (r) => String(r.path ?? '-') },
  { key: 'byCountry', titleKey: 'admin.acquisition.tables.byCountry', titleDef: 'Por país', colKey: 'admin.acquisition.cols.country', colDef: 'País', label: (r) => String(r.country ?? '-') },
  { key: 'byRole', titleKey: 'admin.acquisition.tables.byRole', titleDef: 'Por rol / tipo', colKey: 'admin.acquisition.cols.role', colDef: 'Rol / tipo', label: (r) => `${r.role ?? '-'}${r.userType ? ' / ' + r.userType : ''}` },
];

const gridStyle = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16, marginTop: 16 };
const cardStyle = { border: '1px solid rgba(128,128,128,0.22)', borderRadius: 10, padding: '14px 16px', background: 'rgba(128,128,128,0.03)', minWidth: 0 };
const cardTitleStyle = { margin: '0 0 10px', fontSize: 14, fontWeight: 700 };

// Barras horizontales (categorico). Estilo calcado de AdminComplianceDashboardPanel.
const HBars = ({ rows, labelFn, emptyText }) => {
  if (!rows || rows.length === 0) return <div style={{ opacity: 0.6, fontSize: 13 }}>{emptyText}</div>;
  const max = Math.max(...rows.map((r) => r.count || 0), 1);
  return (
    <div>
      {rows.map((r, i) => {
        const v = r.count || 0;
        const pct = Math.round((v / max) * 100);
        const label = labelFn(r);
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
            <div title={label} style={{ width: 140, fontSize: 12, color: '#475569', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</div>
            <div style={{ flex: 1, background: 'rgba(128,128,128,0.15)', borderRadius: 4, height: 14 }}>
              <div style={{ width: pct + '%', background: BAR, height: '100%', borderRadius: 4 }} />
            </div>
            <div style={{ width: 44, textAlign: 'right', fontSize: 13, fontWeight: 600 }}>{v}</div>
          </div>
        );
      })}
    </div>
  );
};

// Barras verticales para la serie diaria.
const DayBars = ({ rows, emptyText }) => {
  if (!rows || rows.length === 0) return <div style={{ opacity: 0.6, fontSize: 13 }}>{emptyText}</div>;
  const max = Math.max(...rows.map((r) => r.count || 0), 1);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 140, overflowX: 'auto', paddingTop: 8 }}>
      {rows.map((r, i) => {
        const h = Math.round(((r.count || 0) / max) * 100);
        return (
          <div key={i} title={`${r.day}: ${r.count}`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 16 }}>
            <div style={{ fontSize: 10, color: '#64748b' }}>{r.count}</div>
            <div style={{ width: 13, height: h + '%', minHeight: 2, background: BAR, borderRadius: '3px 3px 0 0' }} />
            <div style={{ fontSize: 9, color: '#94a3b8', whiteSpace: 'nowrap', marginTop: 4 }}>{String(r.day ?? '').slice(5)}</div>
          </div>
        );
      })}
    </div>
  );
};

// Tabla compacta con scroll interno (escalable, no scroll de pagina).
const MiniTable = ({ rows, labelFn, colHeader, countHeader, emptyText }) => (
  <div style={{ maxHeight: 260, overflowY: 'auto', overflowX: 'auto' }}>
    {(!rows || rows.length === 0) ? (
      <div style={{ opacity: 0.6, fontSize: 13 }}>{emptyText}</div>
    ) : (
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', padding: '5px 8px', position: 'sticky', top: 0, background: '#f8fafc', borderBottom: '1px solid rgba(128,128,128,0.35)' }}>{colHeader}</th>
            <th style={{ textAlign: 'right', padding: '5px 8px', position: 'sticky', top: 0, background: '#f8fafc', borderBottom: '1px solid rgba(128,128,128,0.35)' }}>{countHeader}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <td style={{ padding: '5px 8px', borderBottom: '1px solid rgba(128,128,128,0.12)' }}>{labelFn(r)}</td>
              <td style={{ padding: '5px 8px', textAlign: 'right', borderBottom: '1px solid rgba(128,128,128,0.12)' }}>{r.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    )}
  </div>
);

const TabButton = ({ active, onClick, children }) => (
  <button
    type="button"
    onClick={onClick}
    style={{ padding: '6px 14px', cursor: 'pointer', borderRadius: 8, border: '1px solid rgba(128,128,128,0.4)', background: active ? 'rgba(79,70,229,0.18)' : 'transparent', fontWeight: active ? 700 : 500 }}
  >
    {children}
  </button>
);

const AdminAcquisitionPanel = () => {
  const t = (key, options) => i18n.t(key, options);
  const [days, setDays] = useState(30);
  const [tab, setTab] = useState('tables');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const fetchData = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await fetch(`/api/admin/acquisition/overview?days=${days}`, { credentials: 'include' });
        if (!res.ok) throw new Error((await res.text()) || t('admin.acquisition.errors.load', { defaultValue: 'No se pudo cargar la analítica de adquisición' }));
        const json = await res.json();
        if (!cancelled) setData(json);
      } catch (e) {
        if (!cancelled) setError(e.message || t('admin.acquisition.errors.load', { defaultValue: 'No se pudo cargar la analítica de adquisición' }));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchData();
    return () => { cancelled = true; };
  }, [days]);

  const emptyText = t('admin.acquisition.empty', { defaultValue: 'Sin datos en esta ventana' });
  const countHeader = t('admin.acquisition.cols.count', { defaultValue: 'Registros' });
  const dayTitle = t('admin.acquisition.tables.byDay', { defaultValue: 'Registros por día' });
  const dayCol = t('admin.acquisition.cols.day', { defaultValue: 'Día' });

  return (
    <div>
      <SectionTitle>{t('admin.acquisition.title', { defaultValue: 'Adquisición' })}</SectionTitle>

      {/* Controles: ventana + pestanas (compartidos) */}
      <div style={{ margin: '8px 0 16px', display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 13, opacity: 0.7 }}>{t('admin.acquisition.window', { defaultValue: 'Ventana' })}:</span>
          {WINDOWS.map((w) => (
            <button key={w} type="button" onClick={() => setDays(w)}
              style={{ padding: '4px 10px', cursor: 'pointer', borderRadius: 6, border: '1px solid rgba(128,128,128,0.4)', background: days === w ? 'rgba(79,70,229,0.18)' : 'transparent', fontWeight: days === w ? 700 : 400 }}>
              {t('admin.acquisition.days', { n: w, defaultValue: '{{n}} días' })}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <TabButton active={tab === 'tables'} onClick={() => setTab('tables')}>{t('admin.acquisition.tabs.tables', { defaultValue: 'Tablas' })}</TabButton>
          <TabButton active={tab === 'charts'} onClick={() => setTab('charts')}>{t('admin.acquisition.tabs.charts', { defaultValue: 'Gráficos' })}</TabButton>
        </div>
        {loading && <span style={{ fontSize: 12, opacity: 0.6 }}>{t('admin.acquisition.loading', { defaultValue: 'Cargando…' })}</span>}
      </div>

      {error && <StyledError>{error}</StyledError>}

      {data && (
        <>
          {/* KPIs (visibles en ambas pestanas) */}
          <CardsGrid>
            <StatCard>
              <div className="label">{t('admin.acquisition.cards.total', { defaultValue: 'Registros totales' })}</div>
              <div className="value">{data.totalRegistrations ?? '-'}</div>
              <div className="meta">{t('admin.acquisition.cards.windowMeta', { n: data.windowDays, defaultValue: 'Últimos {{n}} días' })}</div>
            </StatCard>
            <StatCard>
              <div className="label">{t('admin.acquisition.cards.attributed', { defaultValue: 'Con atribución' })}</div>
              <div className="value">{data.withAttribution ?? '-'}</div>
              <div className="meta">{t('admin.acquisition.cards.pctMeta', { pct: data.attributionCoveragePct, defaultValue: '{{pct}}% del total' })}</div>
            </StatCard>
            <StatCard>
              <div className="label">{t('admin.acquisition.cards.verified', { defaultValue: 'Email verificado' })}</div>
              <div className="value">{data.emailVerified ?? '-'}</div>
              <div className="meta">{t('admin.acquisition.cards.pctMeta', { pct: data.emailVerifiedPct, defaultValue: '{{pct}}% del total' })}</div>
            </StatCard>
          </CardsGrid>

          {tab === 'tables' && (
            <div style={gridStyle}>
              {BREAKDOWNS.map((b) => (
                <div key={b.key} style={cardStyle}>
                  <h4 style={cardTitleStyle}>{t(b.titleKey, { defaultValue: b.titleDef })}</h4>
                  <MiniTable rows={data[b.key]} labelFn={b.label} colHeader={t(b.colKey, { defaultValue: b.colDef })} countHeader={countHeader} emptyText={emptyText} />
                </div>
              ))}
              <div style={{ ...cardStyle, gridColumn: '1 / -1' }}>
                <h4 style={cardTitleStyle}>{dayTitle}</h4>
                <MiniTable rows={data.byDay} labelFn={(r) => String(r.day ?? '-')} colHeader={dayCol} countHeader={countHeader} emptyText={emptyText} />
              </div>
            </div>
          )}

          {tab === 'charts' && (
            <div style={gridStyle}>
              {BREAKDOWNS.map((b) => (
                <div key={b.key} style={cardStyle}>
                  <h4 style={cardTitleStyle}>{t(b.titleKey, { defaultValue: b.titleDef })}</h4>
                  <HBars rows={data[b.key]} labelFn={b.label} emptyText={emptyText} />
                </div>
              ))}
              <div style={{ ...cardStyle, gridColumn: '1 / -1' }}>
                <h4 style={cardTitleStyle}>{dayTitle}</h4>
                <DayBars rows={data.byDay} emptyText={emptyText} />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default AdminAcquisitionPanel;
