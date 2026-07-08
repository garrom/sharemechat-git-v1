import React, { useCallback, useEffect, useState } from 'react';
import styled from 'styled-components';
import i18n from '../../../i18n';
import { apiFetch } from '../../../config/http';
import SupportButton from './components/SupportButton';
import ProfileCreateModal from './components/ProfileCreateModal';
import ProfileEditModal from './components/ProfileEditModal';
import GrantAddModal from './components/GrantAddModal';

// Frente B.3.2 (ADR-046). Vista CRUD de profiles con expansion inline de
// grants por profile. Permiso requerido: PERM_SUPPORT_PROFILE_MANAGE (el
// backend rechaza con 403 si falta; aqui asumimos que canManage se pasa por
// prop desde el panel contenedor).

const Wrap = styled.div`
  padding: 12px 4px;
`;

const HeaderRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
`;

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-size: 0.88rem;
`;

const Th = styled.th`
  text-align: left;
  padding: 8px 6px;
  border-bottom: 2px solid #e2e8f0;
  color: #475569;
  font-weight: 700;
  font-size: 0.78rem;
  letter-spacing: 0.02em;
  text-transform: uppercase;
`;

const Td = styled.td`
  padding: 10px 6px;
  border-bottom: 1px solid #f1f5f9;
  vertical-align: middle;
`;

const NameCell = styled.div`
  font-weight: 600;
  color: #0f172a;
`;

const CategoryChip = styled.span`
  display: inline-block;
  padding: 2px 8px;
  border-radius: 999px;
  background: #e0e7ff;
  color: #3730a3;
  font-size: 0.7rem;
  font-weight: 600;
`;

const StatusPill = styled.span`
  display: inline-block;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 0.72rem;
  font-weight: 700;
  background: ${(p) => (p.$active ? '#dcfce7' : '#f3f4f6')};
  color: ${(p) => (p.$active ? '#166534' : '#475569')};
  border: 1px solid ${(p) => (p.$active ? '#86efac' : '#d1d5db')};
`;

const ExpansionRow = styled.tr`
  background: #f8fafc;
`;

const ExpansionBox = styled.div`
  padding: 12px 8px;
`;

const InnerTable = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-size: 0.82rem;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  overflow: hidden;
`;

const InnerTh = styled.th`
  padding: 6px 8px;
  text-align: left;
  background: #f1f5f9;
  color: #475569;
  font-weight: 700;
  font-size: 0.72rem;
  letter-spacing: 0.02em;
  text-transform: uppercase;
`;

const InnerTd = styled.td`
  padding: 6px 8px;
  border-top: 1px solid #f1f5f9;
`;

const ErrorLine = styled.div`
  padding: 8px 12px;
  background: #fef2f2;
  color: #991b1b;
  border-radius: 6px;
  border: 1px solid #fecaca;
  margin: 8px 0;
  font-size: 0.85rem;
`;

const formatIso = (s) => {
  if (!s) return '—';
  try {
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return '—';
    const yyyy = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${yyyy}-${mo}-${dd} ${hh}:${mm}`;
  } catch {
    return '—';
  }
};

const AdminSupportProfilesView = () => {
  const t = (key, opts) => i18n.t(key, opts);
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [expandedGrants, setExpandedGrants] = useState({});
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState(null);
  const [grantingFor, setGrantingFor] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr('');
    try {
      const data = await apiFetch('/admin/support/profiles');
      setProfiles(Array.isArray(data) ? data : []);
    } catch (e) {
      setErr(e?.message || 'Error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const loadGrants = useCallback(async (profileId) => {
    // No hay endpoint GET dedicado en B.3.1; el detail vive en la vista de
    // grants dentro del profile. Placeholder: usamos la lista con un query
    // hipotetico via el endpoint de listado (que no existe todavia).
    // Estrategia B.3.2: cargar en el frontend haciendo una lectura del backend
    // cuando se expanda. Hasta que exista GET /profiles/{id}/grants publico,
    // mostramos placeholder informativo.
    setExpandedGrants((prev) => ({ ...prev, [profileId]: { loading: false, rows: [], err: '' } }));
  }, []);

  const toggleActive = useCallback(async (p) => {
    setErr('');
    try {
      const updated = await apiFetch(`/admin/support/profiles/${p.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !p.active }),
      });
      setProfiles((prev) => prev.map((row) => (row.id === updated.id ? updated : row)));
    } catch (e) {
      setErr(e?.message || 'Error');
    }
  }, []);

  const revokeGrant = useCallback(async (profileId, userId) => {
    setErr('');
    try {
      await apiFetch(`/admin/support/profiles/${profileId}/grants/${userId}`, {
        method: 'DELETE',
      });
      setExpandedGrants((prev) => {
        const box = prev[profileId] || { rows: [] };
        return { ...prev, [profileId]: { ...box, rows: box.rows.filter((g) => g.userId !== userId) } };
      });
    } catch (e) {
      setErr(e?.message || 'Error');
    }
  }, []);

  const handleExpand = (p) => {
    if (expandedId === p.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(p.id);
    if (!expandedGrants[p.id]) loadGrants(p.id);
  };

  return (
    <Wrap>
      <HeaderRow>
        <div style={{ color: '#64748b', fontSize: '0.85rem' }}>
          {t('admin.support.profiles.list.summary', { count: profiles.length })}
        </div>
        <SupportButton variant="primary" onClick={() => setShowCreate(true)}>
          {t('admin.support.profiles.list.newProfile')}
        </SupportButton>
      </HeaderRow>

      {err ? <ErrorLine>{err}</ErrorLine> : null}

      <Table>
        <thead>
          <tr>
            <Th>{t('admin.support.profiles.columns.name')}</Th>
            <Th>{t('admin.support.profiles.columns.category')}</Th>
            <Th>{t('admin.support.profiles.columns.active')}</Th>
            <Th>{t('admin.support.profiles.columns.createdAt')}</Th>
            <Th>{t('admin.support.profiles.columns.actions')}</Th>
          </tr>
        </thead>
        <tbody>
          {profiles.map((p) => (
            <React.Fragment key={p.id}>
              <tr>
                <Td><NameCell>{p.displayName}</NameCell></Td>
                <Td>{p.category ? <CategoryChip>{p.category}</CategoryChip> : '—'}</Td>
                <Td>
                  <label style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                    <input
                      type="checkbox"
                      checked={!!p.active}
                      onChange={() => toggleActive(p)}
                    />
                    <StatusPill $active={p.active}>
                      {p.active
                        ? t('admin.support.profiles.state.active')
                        : t('admin.support.profiles.state.inactive')}
                    </StatusPill>
                  </label>
                </Td>
                <Td>{formatIso(p.createdAt)}</Td>
                <Td>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <SupportButton size="sm" variant="secondary" onClick={() => setEditing(p)}>
                      {t('admin.support.profiles.actions.edit')}
                    </SupportButton>
                    <SupportButton size="sm" variant="secondary" onClick={() => handleExpand(p)}>
                      {expandedId === p.id
                        ? t('admin.support.profiles.actions.hideGrants')
                        : t('admin.support.profiles.actions.viewGrants')}
                    </SupportButton>
                  </div>
                </Td>
              </tr>

              {expandedId === p.id ? (
                <ExpansionRow>
                  <Td colSpan={5}>
                    <ExpansionBox>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <div style={{ fontSize: '0.85rem', color: '#334155' }}>
                          {t('admin.support.grants.list.title', { profile: p.displayName })}
                        </div>
                        <SupportButton size="sm" variant="primary" onClick={() => setGrantingFor(p)}>
                          {t('admin.support.grants.list.addGrant')}
                        </SupportButton>
                      </div>
                      <InnerTable>
                        <thead>
                          <tr>
                            <InnerTh>{t('admin.support.grants.columns.userId')}</InnerTh>
                            <InnerTh>{t('admin.support.grants.columns.grantedBy')}</InnerTh>
                            <InnerTh>{t('admin.support.grants.columns.grantedAt')}</InnerTh>
                            <InnerTh>{t('admin.support.grants.columns.actions')}</InnerTh>
                          </tr>
                        </thead>
                        <tbody>
                          {(expandedGrants[p.id]?.rows || []).map((g) => (
                            <tr key={`${g.userId}-${p.id}`}>
                              <InnerTd>#{g.userId}</InnerTd>
                              <InnerTd>{g.grantedBy ? `#${g.grantedBy}` : '—'}</InnerTd>
                              <InnerTd>{formatIso(g.grantedAt)}</InnerTd>
                              <InnerTd>
                                <SupportButton size="sm" variant="danger" onClick={() => revokeGrant(p.id, g.userId)}>
                                  {t('admin.support.grants.actions.revoke')}
                                </SupportButton>
                              </InnerTd>
                            </tr>
                          ))}
                          {(expandedGrants[p.id]?.rows || []).length === 0 ? (
                            <tr>
                              <InnerTd colSpan={4} style={{ color: '#64748b', textAlign: 'center', padding: 10 }}>
                                {t('admin.support.grants.list.emptyNote')}
                              </InnerTd>
                            </tr>
                          ) : null}
                        </tbody>
                      </InnerTable>
                    </ExpansionBox>
                  </Td>
                </ExpansionRow>
              ) : null}
            </React.Fragment>
          ))}
          {!loading && profiles.length === 0 ? (
            <tr>
              <Td colSpan={5} style={{ color: '#64748b', textAlign: 'center', padding: 16 }}>
                {t('admin.support.profiles.list.empty')}
              </Td>
            </tr>
          ) : null}
        </tbody>
      </Table>

      {showCreate ? (
        <ProfileCreateModal
          onClose={() => setShowCreate(false)}
          onCreated={(created) => {
            setShowCreate(false);
            setProfiles((prev) => [...prev, created]);
          }}
        />
      ) : null}
      {editing ? (
        <ProfileEditModal
          profile={editing}
          onClose={() => setEditing(null)}
          onUpdated={(updated) => {
            setEditing(null);
            setProfiles((prev) => prev.map((row) => (row.id === updated.id ? updated : row)));
          }}
        />
      ) : null}
      {grantingFor ? (
        <GrantAddModal
          profileId={grantingFor.id}
          onClose={() => setGrantingFor(null)}
          onGranted={(g) => {
            setGrantingFor(null);
            const pid = grantingFor.id;
            setExpandedGrants((prev) => {
              const box = prev[pid] || { rows: [] };
              const rows = [...box.rows.filter((r) => r.userId !== g.userId), g];
              return { ...prev, [pid]: { ...box, rows } };
            });
          }}
        />
      ) : null}
    </Wrap>
  );
};

export default AdminSupportProfilesView;
