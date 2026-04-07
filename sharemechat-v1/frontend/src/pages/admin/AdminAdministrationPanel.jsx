import React, { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../../config/http';
import {
  CardsGrid,
  CheckBox,
  FieldBlock,
  InlinePanel,
  PanelRow,
  ScrollBox,
  SmallBtn,
  StatCard,
  StyledButton,
  StyledError,
  StyledInput,
  StyledTable,
  TextArea,
} from '../../styles/AdminStyles';

const FALLBACK_ROLES = ['ADMIN', 'SUPPORT', 'AUDIT'];
const FALLBACK_PERMISSIONS = [
  'MODELS.READ_KYC_MODE',
  'MODELS.READ_LIST',
  'MODELS.UPDATE_CHECKLIST',
  'MODERATION.READ_REPORT_DETAIL',
  'MODERATION.READ_REPORTS',
  'STREAMS.READ_ACTIVE',
  'STREAMS.READ_DETAIL',
  'STATS.READ_OVERVIEW',
  'FINANCE.READ_SUMMARY',
  'FINANCE.READ_TOP_CLIENTS',
  'FINANCE.READ_TOP_MODELS',
];

const pillStyle = (tone = 'neutral') => {
  const tones = {
    neutral: { bg: '#eef3fb', color: '#344054', border: '#d7deea' },
    admin: { bg: '#dce9ff', color: '#0f4aa8', border: '#b8d0fb' },
    support: { bg: '#e7f7ea', color: '#166534', border: '#c7ebcf' },
    audit: { bg: '#fff1d6', color: '#9a6700', border: '#f3ddad' },
    warning: { bg: '#fff1d6', color: '#9a6700', border: '#f3ddad' },
    add: { bg: '#ddf7e5', color: '#166534', border: '#bfe9ca' },
    remove: { bg: '#ffe2e0', color: '#b42318', border: '#f4c5c0' },
    active: { bg: '#ddf7e5', color: '#166534', border: '#bfe9ca' },
    inactive: { bg: '#ffe2e0', color: '#b42318', border: '#f4c5c0' },
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

const emptyForm = {
  userId: null,
  email: '',
  nickname: '',
  password: '',
  active: true,
  roleCodes: [],
  overrideAdditions: [],
  overrideRemovals: [],
  note: '',
};

const normalizeList = (items) => Array.isArray(items) ? items : [];

const compactActionBtnStyle = {
  padding: '4px 7px',
  fontSize: 10,
  borderRadius: 8,
  lineHeight: 1.15,
};

const selectedRowStyle = {
  background: '#f5f9ff',
  boxShadow: 'inset 3px 0 0 #9dbcf5',
};

const AdminAdministrationPanel = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [editorMode, setEditorMode] = useState('view');
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [statusNote, setStatusNote] = useState('');
  const [resendingUserId, setResendingUserId] = useState(null);

  const [lookupQuery, setLookupQuery] = useState('');
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState('');
  const [lookupResults, setLookupResults] = useState([]);

  const load = async (preferredUserId = null) => {
    setLoading(true);
    setError('');
    try {
      const next = await apiFetch('/admin/administration/backoffice-users');
      setData(next || null);
      if (preferredUserId) {
        setSelectedUserId(preferredUserId);
      }
    } catch (e) {
      setError(e.message || 'No se pudo cargar la administracion interna.');
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  const loadDetail = async (userId) => {
    if (!userId) {
      setDetail(null);
      setEditorMode('view');
      return;
    }
    setDetailLoading(true);
    setDetailError('');
    try {
      const next = await apiFetch(`/admin/administration/backoffice-users/${userId}`);
      setDetail(next || null);
      setForm({
        userId: next?.userId ?? userId,
        email: next?.email || '',
        nickname: next?.nickname || '',
        password: '',
        active: Boolean(next?.accessActive),
        roleCodes: normalizeList(next?.assignedRoles),
        overrideAdditions: normalizeList(next?.overrideAdditions),
        overrideRemovals: normalizeList(next?.overrideRemovals),
        note: '',
      });
      setStatusNote('');
    } catch (e) {
      setDetail(null);
      setDetailError(e.message || 'No se pudo cargar el detalle del acceso.');
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (selectedUserId) {
      loadDetail(selectedUserId);
    }
  }, [selectedUserId]);

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
        ...(Array.isArray(user.assignedRoles) ? user.assignedRoles : []),
        ...(Array.isArray(user.effectiveRoles) ? user.effectiveRoles : []),
        ...(Array.isArray(user.overrideAdditions) ? user.overrideAdditions : []),
        ...(Array.isArray(user.overrideRemovals) ? user.overrideRemovals : []),
      ].filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(q);
    });
  }, [query, users]);

  const availableRoles = normalizeList(detail?.availableRoles).length ? normalizeList(detail?.availableRoles) : FALLBACK_ROLES;
  const availablePermissions = normalizeList(detail?.availablePermissions).length ? normalizeList(detail?.availablePermissions) : FALLBACK_PERMISSIONS;

  const selectForEdit = (userId) => {
    setSelectedUserId(userId);
    setEditorMode('edit');
    setFormError('');
  };

  const startCreateFromLookup = (candidate) => {
    setSelectedUserId(null);
    setDetail(null);
    setEditorMode('create');
    setFormError('');
    setForm({
      userId: candidate.userId,
      email: candidate.email,
      nickname: candidate.nickname || '',
      password: '',
      active: true,
      roleCodes: [],
      overrideAdditions: [],
      overrideRemovals: [],
      note: '',
    });
  };

  const startCreateNewUser = () => {
    setSelectedUserId(null);
    setDetail(null);
    setEditorMode('create');
    setFormError('');
    setForm({
      ...emptyForm,
      active: true,
    });
  };

  const runLookup = async () => {
    const q = lookupQuery.trim();
    if (!q) {
      setLookupResults([]);
      return;
    }
    setLookupLoading(true);
    setLookupError('');
    try {
      const next = await apiFetch(`/admin/administration/users/search?q=${encodeURIComponent(q)}&limit=10`);
      setLookupResults(Array.isArray(next) ? next : []);
    } catch (e) {
      setLookupError(e.message || 'No se pudo buscar el usuario.');
      setLookupResults([]);
    } finally {
      setLookupLoading(false);
    }
  };

  const toggleRole = (role) => {
    setForm((prev) => ({
      ...prev,
      roleCodes: prev.roleCodes.includes(role)
        ? prev.roleCodes.filter((item) => item !== role)
        : [...prev.roleCodes, role],
    }));
  };

  const setPermissionMode = (permission, mode) => {
    setForm((prev) => {
      const additions = prev.overrideAdditions.filter((item) => item !== permission);
      const removals = prev.overrideRemovals.filter((item) => item !== permission);
      if (mode === 'add') additions.push(permission);
      if (mode === 'remove') removals.push(permission);
      return {
        ...prev,
        overrideAdditions: additions.sort(),
        overrideRemovals: removals.sort(),
      };
    });
  };

  const saveForm = async () => {
    setSaving(true);
    setFormError('');
    try {
      const payload = {
        userId: form.userId,
        email: form.email,
        nickname: form.nickname,
        password: form.password,
        active: form.active,
        roleCodes: form.roleCodes,
        overrideAdditions: form.overrideAdditions,
        overrideRemovals: form.overrideRemovals,
        note: form.note,
      };
      const next = editorMode === 'create'
        ? await apiFetch('/admin/administration/backoffice-users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
        : await apiFetch(`/admin/administration/backoffice-users/${form.userId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });

      await load(next?.userId || form.userId);
      if (next?.userId || form.userId) {
        setSelectedUserId(next?.userId || form.userId);
      }
      setEditorMode('view');
      setLookupResults([]);
      setLookupQuery('');
    } catch (e) {
      setFormError(e.message || 'No se pudo guardar el acceso backoffice.');
    } finally {
      setSaving(false);
    }
  };

  const resendVerification = async (userId) => {
    if (!userId) return;
    setResendingUserId(userId);
    setFormError('');
    try {
      await apiFetch(`/admin/administration/backoffice-users/${userId}/resend-verification`, { method: 'POST' });
      await load(userId);
      setSelectedUserId(userId);
      await loadDetail(userId);
    } catch (e) {
      setFormError(e.message || 'No se pudo reenviar el email de validacion.');
    } finally {
      setResendingUserId(null);
    }
  };

  const updateStatus = async (userId, active) => {
    setFormError('');
    const note = statusNote.trim();
    if (!note) {
      setFormError('La nota es obligatoria para cambiar el estado del acceso backoffice.');
      return;
    }
    try {
      const next = await apiFetch(`/admin/administration/backoffice-users/${userId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active, note }),
      });
      await load(userId);
      setSelectedUserId(userId);
      setDetail(next || null);
      setStatusNote('');
    } catch (e) {
      setFormError(e.message || 'No se pudo actualizar el estado del acceso.');
    }
  };

  const selectedSummary = filteredUsers.find((item) => item.userId === selectedUserId) || null;
  const showEditor = editorMode === 'edit' || editorMode === 'create';

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 16 }}>
        <div style={{ maxWidth: 820, fontSize: 13, color: '#52607a', lineHeight: 1.55 }}>
          Administracion interna del acceso backoffice para usuarios ya existentes. Se distingue entre configuracion explicita,
          acceso implicito por rol producto ADMIN y acceso efectivo real. El estado inactivo bloquea la entrada incluso para un ADMIN implicito.
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <StyledInput
            type="text"
            style={{ maxWidth: 260 }}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por email, rol u override"
          />
          <SmallBtn type="button" onClick={startCreateNewUser}>
            Nuevo usuario interno
          </SmallBtn>
          <SmallBtn type="button" onClick={() => load(selectedUserId)} disabled={loading}>
            {loading ? 'Actualizando...' : 'Refrescar'}
          </SmallBtn>
        </div>
      </div>

      {error && <StyledError>{error}</StyledError>}

      <CardsGrid style={{ marginBottom: 16 }}>
        <StatCard><div className="label">Dominio backoffice</div><div className="value">{summary.totalUsers ?? users.length}</div><div className="meta">Usuarios visibles en este dominio, con acceso explicito o implicito.</div></StatCard>
        <StatCard><div className="label">Configuracion explicita</div><div className="value">{summary.explicitUsers ?? 0}</div><div className="meta">Roles, overrides o estado gestionados explicitamente.</div></StatCard>
        <StatCard><div className="label">Acceso implicito</div><div className="value">{summary.implicitAdminUsers ?? 0}</div><div className="meta">Acceso heredado por role producto ADMIN.</div></StatCard>
        <StatCard><div className="label">Acceso efectivo</div><div className="value">{summary.effectiveUsers ?? 0}</div><div className="meta">Usuarios con roles efectivos reales de backoffice.</div></StatCard>
        <StatCard><div className="label">ADMIN</div><div className="value">{summary.adminUsers ?? 0}</div><div className="meta">Acceso administrativo efectivo.</div></StatCard>
        <StatCard><div className="label">SUPPORT</div><div className="value">{summary.supportUsers ?? 0}</div><div className="meta">Operativa de soporte/backoffice.</div></StatCard>
        <StatCard><div className="label">AUDIT</div><div className="value">{summary.auditUsers ?? 0}</div><div className="meta">Visibilidad de auditoria interna.</div></StatCard>
        <StatCard><div className="label">Overrides</div><div className="value">{summary.usersWithOverrides ?? 0}</div><div className="meta">Permisos ajustados manualmente.</div></StatCard>
        <StatCard><div className="label">Inactivos</div><div className="value">{summary.inactiveUsers ?? 0}</div><div className="meta">Accesos configurados pero bloqueados.</div></StatCard>
      </CardsGrid>

      <InlinePanel style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#162033' }}>Crear acceso backoffice</div>
        <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
          Puedes crear un usuario interno nuevo desde el boton superior o buscar un usuario ya existente por email o userId para habilitar acceso interno.
        </div>
        <PanelRow>
          <FieldBlock style={{ minWidth: 280, flex: '1 1 320px' }}>
            <label>Usuario existente</label>
            <StyledInput
              value={lookupQuery}
              onChange={(e) => setLookupQuery(e.target.value)}
              placeholder="Email o userId"
              style={{ maxWidth: '100%' }}
            />
          </FieldBlock>
          <SmallBtn type="button" onClick={runLookup} disabled={lookupLoading}>{lookupLoading ? 'Buscando...' : 'Buscar usuario'}</SmallBtn>
        </PanelRow>
        {lookupError && <StyledError>{lookupError}</StyledError>}
        {lookupResults.length > 0 && (
          <div style={{ overflowX: 'auto', marginTop: 10 }}>
            <StyledTable style={{ marginTop: 0 }}>
              <thead><tr><th>Usuario</th><th>Rol producto</th><th>Acceso actual</th><th>Accion</th></tr></thead>
              <tbody>
                {lookupResults.map((item) => (
                  <tr key={item.userId}>
                    <td><strong>{item.email}</strong><div style={{ fontSize: 12, color: '#74819a', marginTop: 4 }}>ID #{item.userId}{item.nickname ? ` - ${item.nickname}` : ''}</div></td>
                    <td><span style={pillStyle()}>{item.productRole || 'N/D'}</span></td>
                    <td>
                      <span style={pillStyle(item.emailVerifiedAt ? 'active' : 'warning')}>{item.emailVerifiedAt ? 'Email validado' : 'Email pendiente'}</span>
                      {item.hasExplicitConfiguration ? <span style={pillStyle('warning')}>Explicito</span> : null}
                      {item.hasImplicitAdminAccess ? <span style={pillStyle('admin')}>Implicito ADMIN</span> : null}
                      {item.hasEffectiveAccess ? <span style={pillStyle(item.accessActive ? 'active' : 'inactive')}>{item.accessActive ? 'Efectivo' : 'Bloqueado'}</span> : <span style={{ color: '#74819a' }}>Sin acceso</span>}
                    </td>
                    <td>
                      {item.hasExplicitConfiguration ? (
                        <SmallBtn type="button" onClick={() => selectForEdit(item.userId)}>Editar acceso</SmallBtn>
                      ) : (
                        <SmallBtn type="button" onClick={() => startCreateFromLookup(item)}>{item.hasImplicitAdminAccess ? 'Crear configuracion' : 'Crear acceso'}</SmallBtn>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </StyledTable>
          </div>
        )}
      </InlinePanel>

      <div>
        <ScrollBox style={{ maxWidth: '100%', maxHeight: '48vh' }}>
          <StyledTable style={{ maxWidth: '100%', marginTop: 0 }}>
            <thead>
              <tr>
                <th>Usuario</th>
                <th>Rol producto</th>
                <th>Roles backoffice</th>
                <th>Acceso</th>
                <th>Permisos</th>
                <th>Overrides</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length === 0 ? (
                <tr><td colSpan="7" style={{ color: '#74819a' }}>No hay usuarios que coincidan con el filtro actual.</td></tr>
              ) : filteredUsers.map((user) => (
                <tr key={user.userId} style={selectedUserId === user.userId ? selectedRowStyle : undefined}>
                  <td>
                    <strong>{user.email}</strong>
                    <div style={{ fontSize: 12, color: '#74819a', marginTop: 4 }}>ID #{user.userId}{user.nickname ? ` - ${user.nickname}` : ''}</div>
                    <div style={{ marginTop: 6 }}>
                      <span style={pillStyle(user.emailVerifiedAt ? 'active' : 'warning')}>{user.emailVerifiedAt ? 'Email validado' : 'Email pendiente'}</span>
                    </div>
                  </td>
                  <td><span style={pillStyle()}>{user.productRole || 'N/D'}</span></td>
                  <td>{normalizeList(user.assignedRoles).length > 0 ? user.assignedRoles.map((role) => <span key={role} style={pillStyle(roleTone(role))}>{role}</span>) : <span style={{ color: '#74819a' }}>Sin asignacion</span>}</td>
                  <td>
                    {user.hasExplicitConfiguration ? <span style={pillStyle('warning')}>Explicito</span> : null}
                    {user.hasImplicitAdminAccess ? <span style={pillStyle('admin')}>Implicito ADMIN</span> : null}
                    <span style={pillStyle(user.hasEffectiveAccess ? (user.accessActive ? 'active' : 'inactive') : 'neutral')}>
                      {user.hasEffectiveAccess ? (user.accessActive ? 'Efectivo' : 'Bloqueado') : 'Sin acceso'}
                    </span>
                  </td>
                  <td>{user.effectivePermissionsCount || 0}</td>
                  <td>{user.hasOverrides ? <span style={pillStyle('warning')}>Si</span> : <span style={{ color: '#74819a' }}>No</span>}</td>
                  <td>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      <SmallBtn type="button" style={compactActionBtnStyle} onClick={() => { setSelectedUserId(user.userId); setEditorMode('view'); }}>Ver detalle</SmallBtn>
                      <SmallBtn type="button" style={compactActionBtnStyle} onClick={() => selectForEdit(user.userId)}>Editar acceso</SmallBtn>
                      <SmallBtn type="button" style={compactActionBtnStyle} onClick={() => { setSelectedUserId(user.userId); setEditorMode('view'); }}>Gestionar estado</SmallBtn>
                      {!user.emailVerifiedAt ? <SmallBtn type="button" style={compactActionBtnStyle} onClick={() => resendVerification(user.userId)} disabled={resendingUserId === user.userId}>{resendingUserId === user.userId ? 'Reenviando...' : 'Reenviar validacion'}</SmallBtn> : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </StyledTable>
        </ScrollBox>

        <div style={{ marginTop: 18 }}>
          <div style={{ border: '1px solid #d7deea', borderRadius: 14, background: '#f8fbff', padding: '14px 16px', marginBottom: 14 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#162033' }}>Area de edicion de acceso backoffice</div>
            <div style={{ marginTop: 4, fontSize: 12, color: '#64748b', lineHeight: 1.5 }}>
              Usa la tabla superior para seleccionar un usuario y realiza abajo los cambios o la revision de detalle.
            </div>
          </div>

          <div style={{ border: '1px solid #d7deea', borderRadius: 16, background: '#fff', padding: 18, boxShadow: '0 10px 30px rgba(15, 24, 38, 0.04)' }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#162033' }}>
            {editorMode === 'create' ? 'Nuevo acceso backoffice' : showEditor ? 'Editar acceso backoffice' : 'Detalle de acceso'}
          </div>
          <div style={{ marginTop: 6, fontSize: 13, color: '#52607a', lineHeight: 1.5 }}>
            {showEditor ? 'Los roles conceden acceso base. Los overrides anaden o retiran permisos concretos sin tocar el rol.' : 'Selecciona un usuario para revisar acceso explicito o implicito, permisos efectivos y trazabilidad.'}
          </div>

          {detailError && <StyledError>{detailError}</StyledError>}
          {formError && <StyledError>{formError}</StyledError>}
          {detailLoading && <div style={{ marginTop: 16, color: '#74819a' }}>Cargando detalle...</div>}

          {!detailLoading && !showEditor && !detail && (
            <div style={{ marginTop: 16, color: '#52607a', lineHeight: 1.55 }}>Elige un usuario de la tabla o usa la busqueda superior para crear un acceso nuevo.</div>
          )}

          {!detailLoading && (showEditor || detail) && (
            <div style={{ marginTop: 16 }}>
              <InlinePanel style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{form.email || detail?.email || selectedSummary?.email || 'Usuario interno'}</div>
                <div style={{ marginTop: 4, fontSize: 12, color: '#74819a' }}>
                  {form.userId || detail?.userId || selectedSummary?.userId ? `User ID #${form.userId || detail?.userId || selectedSummary?.userId} - ` : ''}Rol producto {detail?.productRole || selectedSummary?.productRole || 'N/D'}
                </div>
                <div style={{ marginTop: 8 }}>
                  <span style={pillStyle(detail?.accessActive ? 'active' : 'inactive')}>{detail?.accessActive ? 'Acceso activo' : 'Acceso inactivo'}</span>
                  {detail?.hasExplicitConfiguration ? <span style={pillStyle('warning')}>Configuracion explicita</span> : null}
                  {detail?.hasImplicitAdminAccess ? <span style={pillStyle('admin')}>Acceso implicito por ADMIN producto</span> : null}
                  {detail?.hasEffectiveAccess ? <span style={pillStyle('active')}>Acceso efectivo</span> : <span style={pillStyle('inactive')}>Sin acceso efectivo</span>}
                  <span style={pillStyle((detail?.emailVerifiedAt || selectedSummary?.emailVerifiedAt) ? 'active' : 'warning')}>{detail?.emailVerifiedAt || selectedSummary?.emailVerifiedAt ? 'Email validado' : 'Email pendiente'}</span>
                  {detail?.accountStatus ? <span style={pillStyle()}>{detail.accountStatus}</span> : null}
                </div>
              </InlinePanel>

              {showEditor ? (
                <>
                  {editorMode === 'create' && !form.userId ? (
                    <InlinePanel style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#74819a', marginBottom: 10 }}>Usuario interno base</div>
                      <PanelRow>
                        <FieldBlock style={{ minWidth: 220, flex: '1 1 220px' }}>
                          <label>Email</label>
                          <StyledInput value={form.email} onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))} placeholder="usuario@sharemechat.com" />
                        </FieldBlock>
                        <FieldBlock style={{ minWidth: 180, flex: '1 1 180px' }}>
                          <label>Nickname</label>
                          <StyledInput value={form.nickname} onChange={(e) => setForm((prev) => ({ ...prev, nickname: e.target.value }))} placeholder="alias interno" />
                        </FieldBlock>
                      </PanelRow>
                      <FieldBlock>
                        <label>Contrasena inicial</label>
                        <StyledInput type="password" value={form.password} onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))} placeholder="Minimo 10 caracteres, sin espacios" />
                      </FieldBlock>
                    </InlinePanel>
                  ) : null}

                  <InlinePanel style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#74819a', marginBottom: 10 }}>Roles backoffice</div>
                    <div style={{ fontSize: 12, color: '#52607a', marginBottom: 10 }}>Asigna uno o varios roles operativos reales: ADMIN, SUPPORT o AUDIT.</div>
                    {availableRoles.map((role) => (
                      <label key={role} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <CheckBox type="checkbox" checked={form.roleCodes.includes(role)} onChange={() => toggleRole(role)} />
                        <span style={{ ...pillStyle(roleTone(role)), margin: 0 }}>{role}</span>
                      </label>
                    ))}
                    <div style={{ fontSize: 12, color: '#334155', marginTop: 12 }}>
                      Guardar configuracion no cambia el estado del acceso. La activacion o desactivacion se gestiona solo con el boton especifico y nota obligatoria.
                    </div>
                    {editorMode === 'create' ? (
                      <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12 }}>
                        <CheckBox type="checkbox" checked={Boolean(form.active)} onChange={(e) => setForm((prev) => ({ ...prev, active: e.target.checked }))} />
                        <span>Dejar el acceso backoffice activo tras la creacion</span>
                      </label>
                    ) : null}
                  </InlinePanel>

                  <InlinePanel style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#74819a', marginBottom: 10 }}>Overrides de permisos</div>
                    <div style={{ fontSize: 12, color: '#52607a', marginBottom: 10 }}>Inherit mantiene el permiso segun los roles. Grant lo anade explicitamente. Remove lo bloquea explicitamente.</div>
                    {availablePermissions.map((permission) => {
                      const mode = form.overrideAdditions.includes(permission) ? 'add' : form.overrideRemovals.includes(permission) ? 'remove' : 'inherit';
                      return (
                        <div key={permission} style={{ borderTop: '1px solid #eef2f7', padding: '8px 0' }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: '#162033', marginBottom: 6 }}>{permission}</div>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            <SmallBtn type="button" onClick={() => setPermissionMode(permission, 'inherit')} style={mode === 'inherit' ? { background: '#eef4ff', borderColor: '#9dbcf5' } : null}>Inherit</SmallBtn>
                            <SmallBtn type="button" onClick={() => setPermissionMode(permission, 'add')} style={mode === 'add' ? { background: '#e8f7eb', borderColor: '#bfe9ca' } : null}>Grant</SmallBtn>
                            <SmallBtn type="button" onClick={() => setPermissionMode(permission, 'remove')} style={mode === 'remove' ? { background: '#ffecec', borderColor: '#f4c5c0' } : null}>Remove</SmallBtn>
                          </div>
                        </div>
                      );
                    })}
                  </InlinePanel>

                  <FieldBlock>
                    <label>Nota para guardar configuracion</label>
                    <TextArea value={form.note} onChange={(e) => setForm((prev) => ({ ...prev, note: e.target.value }))} placeholder="Motivo corto del cambio de roles u overrides. Queda guardado en la trazabilidad basica." />
                  </FieldBlock>

                  {editorMode !== 'create' ? (
                    <FieldBlock>
                      <label>Nota para activar o desactivar</label>
                      <TextArea value={statusNote} onChange={(e) => setStatusNote(e.target.value)} placeholder="Obligatoria para cualquier cambio de estado del acceso." />
                    </FieldBlock>
                  ) : null}

                  <PanelRow>
                    <StyledButton type="button" onClick={saveForm} disabled={saving}>{saving ? 'Guardando...' : editorMode === 'create' ? 'Crear acceso' : 'Guardar cambios'}</StyledButton>
                    {editorMode !== 'create' && form.userId ? (
                      <SmallBtn type="button" style={compactActionBtnStyle} onClick={() => updateStatus(form.userId, !detail?.accessActive)}>
                        {detail?.accessActive ? 'Desactivar acceso' : 'Activar acceso'}
                      </SmallBtn>
                    ) : null}
                    <SmallBtn type="button" style={compactActionBtnStyle} onClick={() => { setEditorMode('view'); setFormError(''); if (selectedUserId) loadDetail(selectedUserId); else { setForm(emptyForm); setDetail(null); } }}>Cancelar</SmallBtn>
                  </PanelRow>
                </>
              ) : (
                <>
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#74819a', marginBottom: 8 }}>Roles asignados</div>
                    {normalizeList(detail?.assignedRoles).length > 0 ? detail.assignedRoles.map((role) => <span key={role} style={pillStyle(roleTone(role))}>{role}</span>) : <span style={{ color: '#74819a' }}>Sin roles asignados explicitamente.</span>}
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#74819a', marginBottom: 8 }}>Semantica de acceso</div>
                    {detail?.hasExplicitConfiguration ? <span style={pillStyle('warning')}>Configuracion explicita</span> : <span style={pillStyle()}>Sin configuracion explicita</span>}
                    {detail?.hasImplicitAdminAccess ? <span style={pillStyle('admin')}>Acceso implicito por ADMIN producto</span> : null}
                    {detail?.hasExplicitAccessRow ? <span style={pillStyle()}>Fila explicita de estado</span> : <span style={pillStyle()}>Sin fila explicita de estado</span>}
                    <span style={pillStyle(detail?.emailVerifiedAt ? 'active' : 'warning')}>{detail?.emailVerifiedAt ? 'Email validado' : 'Email pendiente de validacion'}</span>
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#74819a', marginBottom: 8 }}>Roles efectivos</div>
                    {normalizeList(detail?.effectiveRoles).length > 0 ? detail.effectiveRoles.map((role) => <span key={role} style={pillStyle(roleTone(role))}>{role}</span>) : <span style={{ color: '#74819a' }}>Sin roles efectivos.</span>}
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#74819a', marginBottom: 8 }}>Overrides manuales</div>
                    {normalizeList(detail?.overrideAdditions).map((item) => <span key={`add-${item}`} style={pillStyle('add')}>+ {item}</span>)}
                    {normalizeList(detail?.overrideRemovals).map((item) => <span key={`remove-${item}`} style={pillStyle('remove')}>- {item}</span>)}
                    {normalizeList(detail?.overrideAdditions).length === 0 && normalizeList(detail?.overrideRemovals).length === 0 ? <span style={{ color: '#74819a' }}>Sin overrides explicitos.</span> : null}
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#74819a', marginBottom: 8 }}>Permisos efectivos</div>
                    <div style={{ maxHeight: 190, overflow: 'auto', paddingRight: 4 }}>
                      {normalizeList(detail?.effectivePermissions).map((permission) => <span key={permission} style={pillStyle()}>{permission}</span>)}
                      {normalizeList(detail?.effectivePermissions).length === 0 ? <span style={{ color: '#74819a' }}>Sin permisos efectivos visibles.</span> : null}
                    </div>
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#74819a', marginBottom: 8 }}>Trazabilidad reciente</div>
                    {normalizeList(detail?.recentAuditLogs).length > 0 ? detail.recentAuditLogs.map((item) => (
                      <InlinePanel key={item.id} style={{ marginBottom: 8 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
                          <strong style={{ fontSize: 12 }}>{item.action}</strong>
                          <span style={{ fontSize: 11, color: '#74819a' }}>{item.createdAt || ''}</span>
                        </div>
                        <div style={{ fontSize: 12, color: '#52607a' }}>{item.summary || 'Sin resumen'}</div>
                      </InlinePanel>
                    )) : <span style={{ color: '#74819a' }}>Sin cambios administrativos registrados.</span>}
                  </div>
                  <FieldBlock>
                    <label>Nota para activar o desactivar</label>
                    <TextArea value={statusNote} onChange={(e) => setStatusNote(e.target.value)} placeholder="Obligatoria para cualquier cambio de estado del acceso." />
                  </FieldBlock>
                  <PanelRow>
                    <SmallBtn type="button" style={compactActionBtnStyle} onClick={() => setEditorMode('edit')}>Editar acceso</SmallBtn>
                    {detail?.userId ? <SmallBtn type="button" style={compactActionBtnStyle} onClick={() => updateStatus(detail.userId, !detail.accessActive)}>{detail.accessActive ? 'Desactivar acceso' : 'Activar acceso'}</SmallBtn> : null}
                    {detail?.userId && !detail?.emailVerifiedAt ? <SmallBtn type="button" style={compactActionBtnStyle} onClick={() => resendVerification(detail.userId)} disabled={resendingUserId === detail.userId}>{resendingUserId === detail.userId ? 'Reenviando...' : 'Reenviar validacion'}</SmallBtn> : null}
                  </PanelRow>
                </>
              )}
            </div>
          )}
        </div>
        </div>
      </div>
    </div>
  );
};

export default AdminAdministrationPanel;
