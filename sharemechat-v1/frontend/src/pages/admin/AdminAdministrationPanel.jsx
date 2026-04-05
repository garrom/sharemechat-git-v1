import React, { useMemo, useState } from 'react';
import { apiFetch } from '../../config/http';
import {
  CardsGrid,
  ScrollBox,
  SmallBtn,
  StatCard,
  StyledError,
  StyledInput,
  StyledTable,
} from '../../styles/AdminStyles';

const pillStyle = (tone = 'neutral') => {
  const tones = {
    neutral: { bg: '#eef3fb', color: '#344054', border: '#d7deea' },
    admin: { bg: '#dce9ff', color: '#0f4aa8', border: '#b8d0fb' },
    support: { bg: '#e7f7ea', color: '#166534', border: '#c7ebcf' },
    audit: { bg: '#fff1d6', color: '#9a6700', border: '#f3ddad' },
    warning: { bg: '#fff1d6', color: '#9a6700', border: '#f3ddad' },
    add: { bg: '#ddf7e5', color: '#166534', border: '#bfe9ca' },
    remove: { bg: '#ffe2e0', color: '#b42318', border: '#f4c5c0' },
  };
  const resolved = tones[tone] || tones.neutral;
  return {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '4px 8px',
    margin: '0 6px 6px 0',
    borderRadius: 999,
    border: `1px solid ${resolved.border}`,
    background: resolved.bg,
    color: resolved.color,
    fontSize: 12,
    fontWeight: 700,
    whiteSpace: 'nowrap',
  };
};

const roleTone = (role) => {
  const normalized = String(role || '').toUpperCase();
  if (normalized === 'ADMIN') return 'admin';
  if (normalized === 'SUPPORT') return 'support';
  if (normalized === 'AUDIT') return 'audit';
  return 'neutral';
};

const AdminAdministrationPanel = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [selectedUserId, setSelectedUserId] = useState(null);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const next = await apiFetch('/admin/administration/backoffice-users');
      setData(next || null);
    } catch (e) {
      setError(e.message || 'No se pudo cargar la administracion interna.');
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    load();
  }, []);

  const users = Array.isArray(data?.users) ? data.users : [];
  const summary = data?.summary || {};

  const filteredUsers = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter((user) => {
      const haystack = [
        user.email,
        user.nickname,
        user.productRole,
        ...(Array.isArray(user.backofficeRoles) ? user.backofficeRoles : []),
        ...(Array.isArray(user.effectivePermissions) ? user.effectivePermissions : []),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [query, users]);

  const selectedUser = filteredUsers.find((item) => item.userId === selectedUserId) || null;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 16 }}>
        <div style={{ maxWidth: 760, fontSize: 14, color: '#52607a', lineHeight: 1.55 }}>
          Vista operativa de usuarios con acceso de backoffice, roles asignados, permisos efectivos y overrides visibles.
          No permite cambios todavia; sirve como base de lectura y control interno.
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <StyledInput
            type="text"
            style={{ maxWidth: 260 }}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por email, rol o permiso"
          />
          <SmallBtn type="button" onClick={load} disabled={loading}>
            {loading ? 'Actualizando...' : 'Refrescar'}
          </SmallBtn>
        </div>
      </div>

      {error && <StyledError>{error}</StyledError>}

      <CardsGrid style={{ marginBottom: 16 }}>
        <StatCard>
          <div className="label">Usuarios con acceso</div>
          <div className="value">{summary.totalUsers ?? users.length}</div>
          <div className="meta">Usuarios visibles con acceso efectivo de backoffice.</div>
        </StatCard>
        <StatCard>
          <div className="label">ADMIN</div>
          <div className="value">{summary.adminUsers ?? 0}</div>
          <div className="meta">Usuarios con rol backoffice ADMIN efectivo.</div>
        </StatCard>
        <StatCard>
          <div className="label">SUPPORT</div>
          <div className="value">{summary.supportUsers ?? 0}</div>
          <div className="meta">Usuarios con rol backoffice SUPPORT efectivo.</div>
        </StatCard>
        <StatCard>
          <div className="label">Overrides</div>
          <div className="value">{summary.usersWithOverrides ?? 0}</div>
          <div className="meta">Usuarios con ajustes explicitos sobre permisos.</div>
        </StatCard>
      </CardsGrid>

      <div style={{ display: 'grid', gridTemplateColumns: selectedUser ? 'minmax(0, 1.4fr) minmax(320px, 0.9fr)' : '1fr', gap: 16 }}>
        <ScrollBox style={{ maxWidth: '100%', maxHeight: '70vh' }}>
          <StyledTable style={{ maxWidth: '100%', marginTop: 0 }}>
            <thead>
              <tr>
                <th>Usuario</th>
                <th>Rol producto</th>
                <th>Roles backoffice</th>
                <th>Permisos</th>
                <th>Overrides</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ color: '#74819a' }}>
                    No hay usuarios que coincidan con el filtro actual.
                  </td>
                </tr>
              ) : filteredUsers.map((user) => (
                <tr
                  key={user.userId}
                  onClick={() => setSelectedUserId((prev) => prev === user.userId ? null : user.userId)}
                  style={{
                    cursor: 'pointer',
                    background: selectedUserId === user.userId ? '#f5f9ff' : undefined,
                  }}
                >
                  <td>
                    <div style={{ fontWeight: 700, color: '#162033' }}>{user.email}</div>
                    <div style={{ fontSize: 12, color: '#74819a', marginTop: 4 }}>
                      ID #{user.userId}{user.nickname ? ` - ${user.nickname}` : ''}
                    </div>
                  </td>
                  <td>
                    <span style={pillStyle()}>{user.productRole || 'N/D'}</span>
                  </td>
                  <td>
                    {(user.backofficeRoles || []).length > 0 ? user.backofficeRoles.map((role) => (
                      <span key={role} style={pillStyle(roleTone(role))}>{role}</span>
                    )) : <span style={{ color: '#74819a' }}>Sin rol asignado</span>}
                  </td>
                  <td>
                    <strong>{Array.isArray(user.effectivePermissions) ? user.effectivePermissions.length : 0}</strong>
                    <div style={{ fontSize: 12, color: '#74819a', marginTop: 4 }}>
                      {user.effectivePermissions?.slice(0, 2).join(', ') || 'Sin permisos visibles'}
                    </div>
                  </td>
                  <td>
                    {user.hasOverrides ? (
                      <span style={pillStyle('warning')}>Si</span>
                    ) : (
                      <span style={{ color: '#74819a' }}>No</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </StyledTable>
        </ScrollBox>

        {selectedUser ? (
          <div style={{
            border: '1px solid #d7deea',
            borderRadius: 16,
            background: '#fff',
            padding: 18,
            boxShadow: '0 10px 30px rgba(15, 24, 38, 0.04)',
          }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#162033' }}>Detalle de acceso</div>
            <div style={{ marginTop: 6, fontSize: 13, color: '#52607a', lineHeight: 1.5 }}>
              {selectedUser.email}
            </div>

            <div style={{ marginTop: 18 }}>
              <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#74819a', marginBottom: 8 }}>
                Roles backoffice efectivos
              </div>
              <div>
                {(selectedUser.backofficeRoles || []).map((role) => (
                  <span key={role} style={pillStyle(roleTone(role))}>{role}</span>
                ))}
                {(selectedUser.backofficeRoles || []).length === 0 ? <div style={{ color: '#74819a' }}>Sin roles efectivos.</div> : null}
              </div>
            </div>

            <div style={{ marginTop: 18 }}>
              <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#74819a', marginBottom: 8 }}>
                Overrides
              </div>
              <div>
                {(selectedUser.overrideAdditions || []).length > 0 ? (
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 12, color: '#52607a', marginBottom: 6 }}>Permisos anadidos</div>
                    {selectedUser.overrideAdditions.map((item) => (
                      <span key={item} style={pillStyle('add')}>{item}</span>
                    ))}
                  </div>
                ) : null}

                {(selectedUser.overrideRemovals || []).length > 0 ? (
                  <div>
                    <div style={{ fontSize: 12, color: '#52607a', marginBottom: 6 }}>Permisos retirados</div>
                    {selectedUser.overrideRemovals.map((item) => (
                      <span key={item} style={pillStyle('remove')}>{item}</span>
                    ))}
                  </div>
                ) : null}

                {(selectedUser.overrideAdditions || []).length === 0 && (selectedUser.overrideRemovals || []).length === 0 ? (
                  <div style={{ color: '#74819a' }}>Sin overrides explicitos.</div>
                ) : null}
              </div>
            </div>

            <div style={{ marginTop: 18 }}>
              <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#74819a', marginBottom: 8 }}>
                Permisos efectivos
              </div>
              <div style={{ maxHeight: 260, overflow: 'auto', paddingRight: 4 }}>
                {(selectedUser.effectivePermissions || []).length > 0 ? selectedUser.effectivePermissions.map((permission) => (
                  <span key={permission} style={pillStyle()}>{permission}</span>
                )) : <div style={{ color: '#74819a' }}>Sin permisos efectivos visibles.</div>}
              </div>
            </div>
          </div>
        ) : (
          <div style={{
            border: '1px dashed #d7deea',
            borderRadius: 16,
            background: '#f8fafc',
            padding: 18,
            color: '#52607a',
            lineHeight: 1.55,
          }}>
            Selecciona un usuario para ver el detalle de roles, permisos efectivos y overrides.
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminAdministrationPanel;
