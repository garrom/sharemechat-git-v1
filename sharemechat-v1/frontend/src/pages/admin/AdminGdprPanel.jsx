// Panel admin GDPR art. 15: DPO ejecuta export de datos de un usuario.
// Consume GET /api/admin/gdpr/export/{userId} y dispara descarga del
// JSON estructurado. UI minimalista - runbook manual en
// docs/04-operations/runbooks.md sigue como referencia para paso 2
// (verificacion de identidad) y paso 6 (empaquetado final anonimizando
// datos de terceros).

import React, { useCallback, useState } from 'react';
import i18n from '../../i18n';
import { apiFetch } from '../../config/http';
import { buildApiUrl } from '../../config/api';

const wrap = { padding: '20px 24px', maxWidth: 780 };
const card = {
  background: '#ffffff', border: '1px solid #e1e4e8', borderRadius: 12,
  boxShadow: '0 2px 8px rgba(0,0,0,0.04)', padding: 24, marginBottom: 16,
};
const label = { display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600, color: '#3a4152' };
const input = {
  width: '100%', padding: '10px 12px', borderRadius: 8,
  border: '1px solid #d0d7de', fontSize: 14, boxSizing: 'border-box',
};
const btn = (variant = 'primary', disabled = false) => ({
  padding: '10px 18px', borderRadius: 8, border: 'none',
  background: disabled ? '#c9d1d9' : variant === 'primary' ? '#2f81f7' : '#e6edf3',
  color: variant === 'primary' ? '#ffffff' : '#1a1f2e',
  fontSize: 14, fontWeight: 600, cursor: disabled ? 'not-allowed' : 'pointer',
  marginRight: 8,
});
const info = { padding: 14, background: '#eef6ff', borderRadius: 8, marginBottom: 12, color: '#0a3969', fontSize: 13 };
const okBox = { padding: 14, background: '#e6f4ea', borderRadius: 8, color: '#137333', border: '1px solid #b7e0c1', marginBottom: 12 };
const errBox = { padding: 14, background: '#fde7e9', borderRadius: 8, color: '#b3261e', border: '1px solid #f5c2c7', marginBottom: 12 };
const legend = { marginTop: 20, padding: 16, background: '#f5f6f8', borderRadius: 8, fontSize: 12, color: '#6b7280', lineHeight: 1.6 };

const AdminGdprPanel = () => {
  const t = useCallback((key, options) => i18n.t(key, options), []);
  const [userIdInput, setUserIdInput] = useState('');
  const [foundUser, setFoundUser] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const searchUser = async () => {
    setError('');
    setSuccess('');
    setFoundUser(null);
    const uid = parseInt(userIdInput, 10);
    if (!Number.isFinite(uid) || uid <= 0) {
      setError(t('admin.gdpr.invalidUserId', { defaultValue: 'Introduce un userId numérico válido.' }));
      return;
    }
    try {
      setBusy(true);
      const data = await apiFetch(`/admin/gdpr/user-lookup/${uid}`);
      setFoundUser(data);
    } catch (e) {
      if (e?.status === 404) {
        setError(t('admin.gdpr.userNotFound', { defaultValue: 'Usuario no encontrado.' }));
      } else {
        setError(t('admin.gdpr.searchError', { defaultValue: 'Error buscando usuario.' }));
      }
    } finally {
      setBusy(false);
    }
  };

  const downloadExport = async () => {
    if (!foundUser?.id) return;
    setError('');
    setSuccess('');
    try {
      setBusy(true);
      const res = await fetch(buildApiUrl(`/admin/gdpr/export/${foundUser.id}`), {
        method: 'GET',
        credentials: 'include',
        headers: { 'Accept': 'application/json' },
      });
      if (!res.ok) {
        if (res.status === 404) {
          setError(t('admin.gdpr.userNotFound', { defaultValue: 'Usuario no encontrado.' }));
        } else if (res.status === 401 || res.status === 403) {
          setError(t('admin.gdpr.unauthorized', { defaultValue: 'Sin permisos para exportar datos GDPR.' }));
        } else {
          setError(t('admin.gdpr.exportError', { defaultValue: 'Error generando export GDPR.' }));
        }
        return;
      }
      const blob = await res.blob();
      const cd = res.headers.get('Content-Disposition') || '';
      const match = cd.match(/filename="([^"]+)"/);
      const filename = match ? match[1] : `gdpr-export-user-${foundUser.id}.json`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setSuccess(t('admin.gdpr.exportOk', { defaultValue: 'Descarga iniciada. Verifica el fichero antes de enviarlo al interesado.' }));
    } catch (e) {
      setError(t('admin.gdpr.exportError', { defaultValue: 'Error generando export GDPR.' }));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={wrap}>
      <div style={card}>
        <div style={info}>
          {t('admin.gdpr.reminder', {
            defaultValue: 'Antes de exportar: verifica la identidad del solicitante según el runbook GDPR art. 15. La descarga queda registrada en el log del servidor.',
          })}
        </div>

        <label style={label}>{t('admin.gdpr.userIdLabel', { defaultValue: 'User ID del solicitante' })}</label>
        <input
          type="number"
          min="1"
          style={input}
          value={userIdInput}
          onChange={(e) => setUserIdInput(e.target.value)}
          placeholder="123"
          disabled={busy}
        />
        <div style={{ marginTop: 12 }}>
          <button type="button" style={btn('secondary', busy)} onClick={searchUser} disabled={busy}>
            {t('admin.gdpr.searchBtn', { defaultValue: 'Buscar usuario' })}
          </button>
        </div>

        {error && <div style={{ ...errBox, marginTop: 16 }}>{error}</div>}
        {success && <div style={{ ...okBox, marginTop: 16 }}>{success}</div>}

        {foundUser && (
          <div style={{ marginTop: 20, padding: 16, background: '#f5f6f8', borderRadius: 8 }}>
            <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 4 }}>
              {t('admin.gdpr.userFound', { defaultValue: 'Usuario encontrado:' })}
            </div>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#1a1f2e' }}>
              #{foundUser.id} · {foundUser.email}
            </div>
            <div style={{ fontSize: 13, color: '#3a4152', marginTop: 4 }}>
              {t('admin.gdpr.userRole', { defaultValue: 'Rol' })}: {foundUser.role || '-'} · {t('admin.gdpr.userStatus', { defaultValue: 'Estado' })}: {foundUser.verificationStatus || '-'}
            </div>
            <div style={{ marginTop: 16 }}>
              <button type="button" style={btn('primary', busy)} onClick={downloadExport} disabled={busy}>
                {t('admin.gdpr.downloadBtn', { defaultValue: 'Descargar JSON GDPR' })}
              </button>
            </div>
          </div>
        )}

        <div style={legend}>
          <strong>{t('admin.gdpr.legendTitle', { defaultValue: 'Recordatorio operativo' })}</strong>
          <br />
          {t('admin.gdpr.legendBody', {
            defaultValue: '1) Verifica identidad del solicitante antes de exportar. 2) El JSON contiene datos personales sensibles; anonimiza terceros al empaquetar el envío final. 3) Envía por canal cifrado con contraseña separada. 4) Registra la respuesta en el diario del DPO (id petición, fecha, categorías entregadas).',
          })}
          <br />
          {t('admin.gdpr.runbookRef', {
            defaultValue: 'Runbook completo: docs/04-operations/runbooks.md sección "Runbook de petición GDPR art. 15".',
          })}
        </div>
      </div>
    </div>
  );
};

export default AdminGdprPanel;
