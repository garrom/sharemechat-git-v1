// src/pages/admin/AdminPresencePanel.jsx
//
// Card 1 Fase 2: heatmap de telemetría de presencia (día×hora, Europe/Madrid).
// Consume:
//   GET /api/admin/stats/presence/heatmap/platform     → agregado plataforma
//   GET /api/admin/stats/presence/heatmap?modelUserId= → por modelo
// Intensidad 0-100 por casilla (frecuencia relativa de presencia observada).
// En PRELAUNCH el heatmap sale vacío hasta que el sampler acumule datos.

import React, { useCallback, useEffect, useState } from 'react';
import i18n from '../../i18n';
import { apiFetch } from '../../config/http';

const DAYS = [1, 2, 3, 4, 5, 6, 7];
const HOURS = Array.from({ length: 24 }, (_, h) => h);

export default function AdminPresencePanel() {
  const t = (k, o) => i18n.t(k, o);
  const [scope, setScope] = useState('platform'); // 'platform' | 'model'
  const [modelId, setModelId] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const url = scope === 'model' && modelId
        ? `/admin/stats/presence/heatmap?modelUserId=${encodeURIComponent(modelId)}`
        : '/admin/stats/presence/heatmap/platform';
      const res = await apiFetch(url);
      setData(res);
    } catch (e) {
      setError(e?.message || t('admin.presence.error', { defaultValue: 'Error al cargar' }));
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [scope, modelId]);

  useEffect(() => { if (scope === 'platform') load(); }, [scope, load]);

  const grid = {};
  (data?.buckets || []).forEach((b) => { grid[`${b.dayOfWeek}-${b.hour}`] = b; });
  const dayName = (d) => t(`modelProfileExpanded.days.${d}`, { defaultValue: `${d}` });
  const totalSamples = (data?.buckets || []).reduce((acc, b) => acc + (b.onlineCount || 0), 0);

  const cellStyle = (b) => {
    const intensity = b?.intensity || 0;
    const alpha = intensity > 0 ? 0.12 + (intensity / 100) * 0.88 : 0;
    return {
      width: 22, height: 20, borderRadius: 3,
      background: intensity > 0 ? `rgba(234,29,29,${alpha.toFixed(2)})` : '#f1f3f5',
      border: '1px solid #e6e7ea',
    };
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 14 }}>
        <button type="button" onClick={() => setScope('platform')}
          style={tabBtn(scope === 'platform')}>
          {t('admin.presence.platform', { defaultValue: 'Plataforma' })}
        </button>
        <button type="button" onClick={() => setScope('model')}
          style={tabBtn(scope === 'model')}>
          {t('admin.presence.byModel', { defaultValue: 'Por modelo' })}
        </button>
        {scope === 'model' && (
          <>
            <input
              type="number"
              value={modelId}
              onChange={(e) => setModelId(e.target.value)}
              placeholder={t('admin.presence.modelIdPlaceholder', { defaultValue: 'ID de la modelo' })}
              style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #ccd2d9', width: 150 }}
            />
            <button type="button" onClick={load} disabled={!modelId} style={tabBtn(false)}>
              {t('admin.presence.load', { defaultValue: 'Cargar' })}
            </button>
          </>
        )}
        <span style={{ marginLeft: 'auto', fontSize: 12.5, color: '#6d7783' }}>
          {t('admin.presence.samples', { defaultValue: 'Muestras online' })}: <strong>{totalSamples}</strong>
          {data?.weeks ? ` · ${data.weeks} sem` : ''}
        </span>
      </div>

      {loading && <p style={{ color: '#6d7783' }}>{t('admin.presence.loading', { defaultValue: 'Cargando…' })}</p>}
      {error && <p style={{ color: '#b04242' }}>{error}</p>}

      {!loading && !error && totalSamples === 0 && (
        <p style={{ color: '#6d7783', fontStyle: 'italic' }}>
          {t('admin.presence.empty', { defaultValue: 'Sin datos de presencia todavía (se llena con el uso real).' })}
        </p>
      )}

      {!loading && !error && totalSamples > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'separate', borderSpacing: 3 }}>
            <thead>
              <tr>
                <th></th>
                {HOURS.map((h) => (
                  <th key={h} style={{ fontSize: 10, color: '#93a0ac', fontWeight: 600, width: 22 }}>
                    {h % 3 === 0 ? h : ''}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {DAYS.map((d) => (
                <tr key={d}>
                  <td style={{ fontSize: 12, color: '#45525f', paddingRight: 8, whiteSpace: 'nowrap', textAlign: 'right' }}>
                    {dayName(d)}
                  </td>
                  {HOURS.map((h) => {
                    const b = grid[`${d}-${h}`];
                    return (
                      <td key={h}>
                        <div
                          style={cellStyle(b)}
                          title={`${dayName(d)} ${h}:00 · ${b?.onlineCount || 0}`}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <p style={{ fontSize: 11.5, color: '#93a0ac', marginTop: 8 }}>
            {t('admin.presence.axisNote', { defaultValue: 'Hora peninsular (Europe/Madrid). Intensidad = frecuencia relativa de presencia observada.' })}
          </p>
        </div>
      )}
    </div>
  );
}

const tabBtn = (active) => ({
  padding: '6px 14px',
  borderRadius: 999,
  border: '1px solid ' + (active ? '#354556' : '#ccd2d9'),
  background: active ? '#354556' : '#fff',
  color: active ? '#fff' : '#45525f',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
});
