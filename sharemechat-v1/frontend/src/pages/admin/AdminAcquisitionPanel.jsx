import React, { useEffect, useState } from 'react';
import i18n from '../../i18n';
import {
  CardsGrid,
  SectionTitle,
  StatCard,
  StyledError,
} from '../../styles/AdminStyles';

// Panel de adquisicion / crecimiento (backoffice). Consume el endpoint
// read-only /api/admin/acquisition/overview (AdminController -> AdminService),
// que agrega la capa B de atribucion first-touch (ADR-057) + users. Datos
// first-party (server-side): sin contaminacion de bots/consent/adblock, a
// diferencia de GA4. Solo lectura; no muta nada. Textos con defaultValue para
// no depender de nuevas claves i18n (mismo patron que DashboardAdmin).
const WINDOWS = [7, 30, 90];

const AdminAcquisitionPanel = () => {
  const t = (key, options) => i18n.t(key, options);
  const [days, setDays] = useState(30);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const fetchData = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await fetch(`/api/admin/acquisition/overview?days=${days}`, {
          credentials: 'include',
        });
        if (!res.ok) {
          throw new Error(
            (await res.text())
            || t('admin.acquisition.errors.load', { defaultValue: 'No se pudo cargar la analítica de adquisición' }),
          );
        }
        const json = await res.json();
        if (!cancelled) setData(json);
      } catch (e) {
        if (!cancelled) {
          setError(e.message || t('admin.acquisition.errors.load', { defaultValue: 'No se pudo cargar la analítica de adquisición' }));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchData();
    return () => {
      cancelled = true;
    };
  }, [days]);

  const renderTable = (title, rows, labelFn, keyHeader) => (
    <div style={{ marginTop: 24 }}>
      <h4 style={{ margin: '0 0 8px' }}>{title}</h4>
      {(!rows || rows.length === 0) ? (
        <div style={{ opacity: 0.6, fontSize: 14 }}>
          {t('admin.acquisition.empty', { defaultValue: 'Sin datos en esta ventana' })}
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '6px 8px', borderBottom: '1px solid rgba(128,128,128,0.35)' }}>
                  {keyHeader}
                </th>
                <th style={{ textAlign: 'right', padding: '6px 8px', borderBottom: '1px solid rgba(128,128,128,0.35)' }}>
                  {t('admin.acquisition.cols.count', { defaultValue: 'Registros' })}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid rgba(128,128,128,0.12)' }}>
                    {labelFn(r)}
                  </td>
                  <td style={{ padding: '6px 8px', textAlign: 'right', borderBottom: '1px solid rgba(128,128,128,0.12)' }}>
                    {r.count}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  return (
    <div>
      <SectionTitle>{t('admin.acquisition.title', { defaultValue: 'Adquisición' })}</SectionTitle>

      <div style={{ margin: '8px 0 16px', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ fontSize: 13, opacity: 0.7 }}>
          {t('admin.acquisition.window', { defaultValue: 'Ventana' })}:
        </span>
        {WINDOWS.map((w) => (
          <button
            key={w}
            type="button"
            onClick={() => setDays(w)}
            style={{
              padding: '4px 10px',
              cursor: 'pointer',
              borderRadius: 6,
              border: '1px solid rgba(128,128,128,0.4)',
              background: days === w ? 'rgba(99,102,241,0.20)' : 'transparent',
              fontWeight: days === w ? 700 : 400,
            }}
          >
            {t('admin.acquisition.days', { n: w, defaultValue: '{{n}} días' })}
          </button>
        ))}
        {loading && (
          <span style={{ fontSize: 12, opacity: 0.6 }}>
            {t('admin.acquisition.loading', { defaultValue: 'Cargando…' })}
          </span>
        )}
      </div>

      {error && <StyledError>{error}</StyledError>}

      {data && (
        <>
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

          {renderTable(
            t('admin.acquisition.tables.bySource', { defaultValue: 'Por canal (utm_source)' }),
            data.bySource, (r) => String(r.source ?? '-'),
            t('admin.acquisition.cols.source', { defaultValue: 'Canal' }),
          )}
          {renderTable(
            t('admin.acquisition.tables.byReferrerHost', { defaultValue: 'Por sitio de origen (referrer)' }),
            data.byReferrerHost, (r) => String(r.host ?? '-'),
            t('admin.acquisition.cols.host', { defaultValue: 'Referrer' }),
          )}
          {renderTable(
            t('admin.acquisition.tables.topLandingPaths', { defaultValue: 'Landing pages que convierten (mide el blog/GEO)' }),
            data.topLandingPaths, (r) => String(r.path ?? '-'),
            t('admin.acquisition.cols.path', { defaultValue: 'Landing' }),
          )}
          {renderTable(
            t('admin.acquisition.tables.byCountry', { defaultValue: 'Por país' }),
            data.byCountry, (r) => String(r.country ?? '-'),
            t('admin.acquisition.cols.country', { defaultValue: 'País' }),
          )}
          {renderTable(
            t('admin.acquisition.tables.byRole', { defaultValue: 'Por rol / tipo' }),
            data.byRole,
            (r) => `${r.role ?? '-'}${r.userType ? ' / ' + r.userType : ''}`,
            t('admin.acquisition.cols.role', { defaultValue: 'Rol / tipo' }),
          )}
          {renderTable(
            t('admin.acquisition.tables.byDay', { defaultValue: 'Registros por día' }),
            data.byDay, (r) => String(r.day ?? '-'),
            t('admin.acquisition.cols.day', { defaultValue: 'Día' }),
          )}
        </>
      )}
    </div>
  );
};

export default AdminAcquisitionPanel;
