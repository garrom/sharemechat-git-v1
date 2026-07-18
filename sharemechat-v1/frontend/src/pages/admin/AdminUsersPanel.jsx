// Panel admin "Clientes y Modelos" (2026-07-18): embudo agregado sin
// duplicar lo que ya muestra AdminModelsPanel. Consume el endpoint
// GET /api/admin/users/segments. Carga solo al pulsar "Cargar" (o al
// abrir la vista); refresh es manual via boton.

import React, { useCallback, useEffect, useState } from 'react';
import i18n from '../../i18n';
import { apiFetch } from '../../config/http';

const wrap = { padding: '20px 24px', maxWidth: 1100 };
const grid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 16 };
const card = {
  background: '#ffffff', border: '1px solid #e1e4e8', borderRadius: 12,
  boxShadow: '0 2px 8px rgba(0,0,0,0.04)', padding: 16,
};
const kpiLabel = { fontSize: 12, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 };
const kpiValue = { fontSize: 28, fontWeight: 700, color: '#18212f', lineHeight: 1.1 };
const kpiMeta = { fontSize: 12, color: '#8b93a1', marginTop: 4 };
const sectionTitle = { fontSize: 15, fontWeight: 700, color: '#18212f', margin: '20px 0 8px' };
const btn = (variant = 'primary', disabled = false) => ({
  padding: '8px 16px', borderRadius: 8, border: 'none',
  background: disabled ? '#c9d1d9' : variant === 'primary' ? '#2f81f7' : '#e6edf3',
  color: variant === 'primary' ? '#ffffff' : '#1a1f2e',
  fontSize: 13, fontWeight: 600, cursor: disabled ? 'not-allowed' : 'pointer',
});
const table = { width: '100%', borderCollapse: 'collapse', fontSize: 13, background: '#fff', border: '1px solid #e1e4e8', borderRadius: 8, overflow: 'hidden' };
const th = { textAlign: 'left', padding: '10px 12px', background: '#f4f6f9', color: '#3a4152', fontWeight: 600, borderBottom: '1px solid #e1e4e8' };
const td = { padding: '10px 12px', borderBottom: '1px solid #eef1f4', color: '#18212f' };
const badge = (bg, fg) => ({ display: 'inline-block', padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600, background: bg, color: fg });
const errBox = { padding: 12, background: '#fde7e9', borderRadius: 8, color: '#b3261e', border: '1px solid #f5c2c7', marginBottom: 12, fontSize: 13 };
const hint = { fontSize: 12, color: '#8b93a1', marginTop: 6 };

const fmtDate = (iso) => {
  if (!iso) return '-';
  try {
    const d = new Date(iso);
    return d.toISOString().slice(0, 16).replace('T', ' ');
  } catch { return String(iso); }
};

const AdminUsersPanel = () => {
  const t = useCallback((key, options) => i18n.t(key, options), []);
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [loadedAt, setLoadedAt] = useState(null);

  const load = useCallback(async () => {
    setBusy(true);
    setError('');
    try {
      // apiFetch devuelve el JSON parseado (o lanza en !ok / red / 5xx).
      const json = await apiFetch('/admin/users/segments');
      setData(json);
      setLoadedAt(new Date());
    } catch (e) {
      setError(t('admin.users.errorLoad', { defaultValue: 'No se pudo cargar. Reintenta.' }));
    } finally {
      setBusy(false);
    }
  }, [t]);

  useEffect(() => { load(); }, [load]);

  const clients = data?.clients;
  const models = data?.models;
  const breakdown = models?.formModelBreakdown;

  return (
    <div style={wrap}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <button style={btn('primary', busy)} onClick={load} disabled={busy}>
          {busy
            ? t('admin.users.loading', { defaultValue: 'Cargando...' })
            : t('admin.users.refresh', { defaultValue: 'Refrescar' })}
        </button>
        {loadedAt && (
          <span style={hint}>
            {t('admin.users.loadedAt', { defaultValue: 'Actualizado' })}: {fmtDate(loadedAt.toISOString())}
          </span>
        )}
      </div>

      {error && <div style={errBox}>{error}</div>}

      {/* -------- Bloque Clientes -------- */}
      <div style={sectionTitle}>{t('admin.users.clientsSection', { defaultValue: 'Clientes' })}</div>
      <div style={grid}>
        <div style={card}>
          <div style={kpiLabel}>{t('admin.users.totalRegistered', { defaultValue: 'Total registrados' })}</div>
          <div style={kpiValue}>{clients?.total ?? '-'}</div>
          <div style={kpiMeta}>{t('admin.users.clientsTotalMeta', { defaultValue: 'FORM_CLIENT + CLIENT' })}</div>
        </div>
        <div style={card}>
          <div style={kpiLabel}>{t('admin.users.formClient', { defaultValue: 'En formulario' })}</div>
          <div style={kpiValue}>{clients?.formClient ?? '-'}</div>
          <div style={kpiMeta}>{t('admin.users.formClientMeta', { defaultValue: 'Registrados sin pagar todavia' })}</div>
        </div>
        <div style={card}>
          <div style={kpiLabel}>{t('admin.users.activeClient', { defaultValue: 'Ya clientes' })}</div>
          <div style={kpiValue}>{clients?.active ?? '-'}</div>
          <div style={kpiMeta}>{t('admin.users.activeClientMeta', { defaultValue: 'Han pagado al menos 1 vez' })}</div>
        </div>
        <div style={card}>
          <div style={kpiLabel}>{t('admin.users.conversion', { defaultValue: 'Conversion' })}</div>
          <div style={kpiValue}>{clients?.activePct ?? '-'}</div>
          <div style={kpiMeta}>{t('admin.users.conversionMeta', { defaultValue: 'De registrado a cliente' })}</div>
        </div>
      </div>

      <div style={{ ...sectionTitle, fontSize: 13, color: '#3a4152' }}>
        {t('admin.users.recentFormClients', { defaultValue: 'Ultimos 10 clientes en formulario' })}
      </div>
      <table style={table}>
        <thead>
          <tr>
            <th style={th}>ID</th>
            <th style={th}>Nickname</th>
            <th style={th}>Email</th>
            <th style={th}>Pais</th>
            <th style={th}>Locale</th>
            <th style={th}>IP</th>
            <th style={th}>Registro</th>
          </tr>
        </thead>
        <tbody>
          {(data?.recentFormClients || []).length === 0 && (
            <tr><td style={td} colSpan={7}>{t('admin.users.noRows', { defaultValue: 'Sin registros' })}</td></tr>
          )}
          {(data?.recentFormClients || []).map((u) => (
            <tr key={u.id}>
              <td style={td}>{u.id}</td>
              <td style={td}>{u.nickname || '-'}</td>
              <td style={td}>{u.email}</td>
              <td style={td}>{u.countryDetected || '-'}</td>
              <td style={td}>{u.uiLocale || '-'}</td>
              <td style={td}>{u.registIp || '-'}</td>
              <td style={td}>{fmtDate(u.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* -------- Bloque Modelos -------- */}
      <div style={sectionTitle}>{t('admin.users.modelsSection', { defaultValue: 'Modelos' })}</div>
      <div style={grid}>
        <div style={card}>
          <div style={kpiLabel}>{t('admin.users.totalRegistered', { defaultValue: 'Total registradas' })}</div>
          <div style={kpiValue}>{models?.total ?? '-'}</div>
          <div style={kpiMeta}>{t('admin.users.modelsTotalMeta', { defaultValue: 'FORM_MODEL + MODEL' })}</div>
        </div>
        <div style={card}>
          <div style={kpiLabel}>{t('admin.users.formModel', { defaultValue: 'En formulario / KYC' })}</div>
          <div style={kpiValue}>{models?.formModel ?? '-'}</div>
          <div style={kpiMeta}>
            {breakdown
              ? `${breakdown.noKyc} sin KYC · ${breakdown.kycPending} pending · ${breakdown.kycRejected} rejected`
              : '-'}
          </div>
        </div>
        <div style={card}>
          <div style={kpiLabel}>{t('admin.users.activeModel', { defaultValue: 'Ya modelos' })}</div>
          <div style={kpiValue}>{models?.active ?? '-'}</div>
          <div style={kpiMeta}>{t('admin.users.activeModelMeta', { defaultValue: 'KYC aprobado, operativas' })}</div>
        </div>
        <div style={card}>
          <div style={kpiLabel}>{t('admin.users.conversion', { defaultValue: 'Conversion' })}</div>
          <div style={kpiValue}>{models?.activePct ?? '-'}</div>
          <div style={kpiMeta}>{t('admin.users.conversionMetaModel', { defaultValue: 'De registrada a modelo activa' })}</div>
        </div>
      </div>

      <div style={{ ...sectionTitle, fontSize: 13, color: '#3a4152' }}>
        {t('admin.users.recentFormModelsNoKyc', { defaultValue: 'Ultimas 10 modelos sin KYC iniciado' })}
        <span style={{ ...badge('#eef4fb', '#4a6b8b'), marginLeft: 8, fontWeight: 500 }}>
          {t('admin.users.hintNoDup', { defaultValue: 'Las que ya iniciaron KYC se ven en vista Modelos' })}
        </span>
      </div>
      <table style={table}>
        <thead>
          <tr>
            <th style={th}>ID</th>
            <th style={th}>Nickname</th>
            <th style={th}>Email</th>
            <th style={th}>Pais</th>
            <th style={th}>Locale</th>
            <th style={th}>IP</th>
            <th style={th}>Registro</th>
          </tr>
        </thead>
        <tbody>
          {(data?.recentFormModelsNoKyc || []).length === 0 && (
            <tr><td style={td} colSpan={7}>{t('admin.users.noRows', { defaultValue: 'Sin registros' })}</td></tr>
          )}
          {(data?.recentFormModelsNoKyc || []).map((u) => (
            <tr key={u.id}>
              <td style={td}>{u.id}</td>
              <td style={td}>{u.nickname || '-'}</td>
              <td style={td}>{u.email}</td>
              <td style={td}>{u.countryDetected || '-'}</td>
              <td style={td}>{u.uiLocale || '-'}</td>
              <td style={td}>{u.registIp || '-'}</td>
              <td style={td}>{fmtDate(u.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default AdminUsersPanel;
