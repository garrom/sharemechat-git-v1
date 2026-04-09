import React, { useMemo, useState } from 'react';
import { useSession } from '../../components/SessionProvider';
import { apiFetch } from '../../config/http';
import {
  FieldBlock,
  InlinePanel,
  PanelRow,
  StyledButton,
  StyledError,
} from '../../styles/AdminStyles';

const formatDateTime = (value) => {
  if (!value) return 'No disponible';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString('es-ES');
};

const infoValueStyle = {
  fontSize: 13,
  color: '#162033',
  lineHeight: 1.5,
  wordBreak: 'break-word',
};

const okStyle = {
  color: '#2f5d37',
  margin: '8px 0',
  fontSize: 12,
};

const inputStyle = {
  width: '100%',
  padding: '8px 9px',
  border: '1px solid #bcc6d1',
  borderRadius: 4,
  fontSize: 12,
  color: '#18212f',
  background: '#fff',
};

const AdminProfilePage = () => {
  const { user } = useSession();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const effectiveBackofficeRoles = useMemo(() => (
    Array.isArray(user?.backofficeRoles) ? user.backofficeRoles.filter(Boolean) : []
  ), [user]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (!currentPassword || !newPassword || !confirmPassword) {
      setError('Completa los tres campos de contrasena.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('La nueva contrasena y la confirmacion no coinciden.');
      return;
    }
    if (newPassword.length < 10) {
      setError('La nueva contrasena debe tener al menos 10 caracteres.');
      return;
    }
    if (/\s/.test(newPassword)) {
      setError('La nueva contrasena no puede contener espacios.');
      return;
    }

    try {
      setSubmitting(true);
      await apiFetch('/users/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setSuccess('Contrasena actualizada correctamente.');
    } catch (e) {
      setError(e.message || 'No se pudo actualizar la contrasena.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <InlinePanel>
        <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#74819a', marginBottom: 10 }}>
          Datos basicos
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
          <FieldBlock>
            <label>Email</label>
            <div style={infoValueStyle}>{user?.email || 'No disponible'}</div>
          </FieldBlock>
          <FieldBlock>
            <label>Nickname</label>
            <div style={infoValueStyle}>{user?.nickname || 'No disponible'}</div>
          </FieldBlock>
          <FieldBlock>
            <label>Rol de producto</label>
            <div style={infoValueStyle}>{user?.role || 'No disponible'}</div>
          </FieldBlock>
          <FieldBlock>
            <label>Roles backoffice efectivos</label>
            <div style={infoValueStyle}>{effectiveBackofficeRoles.length > 0 ? effectiveBackofficeRoles.join(', ') : 'Sin roles efectivos'}</div>
          </FieldBlock>
          <FieldBlock>
            <label>Email validado</label>
            <div style={infoValueStyle}>{user?.emailVerifiedAt ? `Si, ${formatDateTime(user.emailVerifiedAt)}` : 'No'}</div>
          </FieldBlock>
          <FieldBlock>
            <label>Estado de cuenta</label>
            <div style={infoValueStyle}>{user?.accountStatus || 'No disponible'}</div>
          </FieldBlock>
          <FieldBlock>
            <label>Idioma UI</label>
            <div style={infoValueStyle}>{user?.uiLocale || 'No disponible'}</div>
          </FieldBlock>
          <FieldBlock>
            <label>User ID</label>
            <div style={infoValueStyle}>{user?.id ?? 'No disponible'}</div>
          </FieldBlock>
        </div>
      </InlinePanel>

      <InlinePanel>
        <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#74819a', marginBottom: 10 }}>
          Cambio de contrasena
        </div>
        <div style={{ fontSize: 12, color: '#52607a', marginBottom: 10, lineHeight: 1.55 }}>
          Este cambio afecta solo a tu cuenta autenticada de Backoffice y utiliza el flujo actual del usuario autenticado.
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gap: 12 }}>
            <FieldBlock>
              <label>Contrasena actual</label>
              <input
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                style={inputStyle}
              />
            </FieldBlock>
            <FieldBlock>
              <label>Nueva contrasena</label>
              <input
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                style={inputStyle}
              />
            </FieldBlock>
            <FieldBlock>
              <label>Confirmar nueva contrasena</label>
              <input
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                style={inputStyle}
              />
            </FieldBlock>
          </div>

          <div style={{ marginTop: 10, fontSize: 12, color: '#52607a', lineHeight: 1.55 }}>
            La nueva contrasena debe tener al menos 10 caracteres y no puede contener espacios.
          </div>

          {error ? <StyledError>{error}</StyledError> : null}
          {success ? <div style={okStyle}>{success}</div> : null}

          <PanelRow>
            <StyledButton type="submit" disabled={submitting}>
              {submitting ? 'Actualizando...' : 'Cambiar contrasena'}
            </StyledButton>
          </PanelRow>
        </form>
      </InlinePanel>
    </div>
  );
};

export default AdminProfilePage;
