import React, { useEffect, useMemo, useRef, useState } from 'react';
import i18n from '../../i18n';
import { apiFetch } from '../../config/http';
import {
  CardsGrid,
  CheckBox,
  FieldBlock,
  InlinePanel,
  PanelRow,
  SmallBtn,
  StatCard,
  StyledButton,
  DarkHeaderTable,
  TableActionButton,
  TableActionGroup,
  StyledError,
  StyledInput,
  StyledSelect,
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
    neutral: { bg: '#f8fafb', color: '#4b5565', border: '#d5dbe3' },
    admin: { bg: '#f5f7fa', color: '#37485d', border: '#cfd7e1' },
    support: { bg: '#f6f8f6', color: '#425647', border: '#d3dad4' },
    audit: { bg: '#faf9f6', color: '#675b41', border: '#ddd8cb' },
    warning: { bg: '#faf9f6', color: '#675b41', border: '#ddd8cb' },
    add: { bg: '#f6f8f6', color: '#425647', border: '#d3dad4' },
    remove: { bg: '#faf7f7', color: '#714848', border: '#ded2d2' },
    active: { bg: '#f6f8f6', color: '#425647', border: '#d3dad4' },
    inactive: { bg: '#faf7f7', color: '#714848', border: '#ded2d2' },
  };
  const resolved = tones[tone] || tones.neutral;
  return {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '2px 6px',
    margin: '0 6px 6px 0',
    borderRadius: 4,
    border: `1px solid ${resolved.border}`,
    background: resolved.bg,
    color: resolved.color,
    fontSize: 11,
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
const normalizeRoleCode = (role) => String(role || '').trim().toUpperCase();
const normalizeRoleCodes = (items) => normalizeList(items).map(normalizeRoleCode).filter(Boolean);

const compactActionBtnStyle = {
  minWidth: 96,
};

const permissionModeBtnStyle = (currentMode, buttonMode) => {
  const isActive = currentMode === buttonMode;

  if (buttonMode === 'inherit') {
    return isActive
      ? { background: '#dde7f2', borderColor: '#8fa4ba', color: '#1b2d40' }
      : { background: '#f7f9fb', borderColor: '#d8e0e8', color: '#99a5b3' };
  }

  if (buttonMode === 'add') {
    return isActive
      ? { background: '#deefe1', borderColor: '#8fb698', color: '#213f28' }
      : { background: '#f8faf8', borderColor: '#dbe4dc', color: '#9aa89d' };
  }

  return isActive
    ? { background: '#f3dfe3', borderColor: '#c99aa2', color: '#5a2c33' }
    : { background: '#fbf8f8', borderColor: '#e6dcdd', color: '#a78f92' };
};

const buildFormState = (source, fallbackUserId = null) => ({
  userId: source?.userId ?? fallbackUserId,
  email: source?.email || '',
  nickname: source?.nickname || '',
  password: '',
  active: Boolean(source?.accessActive),
  roleCodes: normalizeRoleCodes(source?.assignedRoles),
  overrideAdditions: normalizeList(source?.overrideAdditions),
  overrideRemovals: normalizeList(source?.overrideRemovals),
  note: '',
});

const scrollToRef = (ref) => {
  if (!ref?.current) return;
  window.requestAnimationFrame(() => {
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
};

const AdminAdministrationPanel = () => {
  const t = (key, options) => i18n.t(key, options);
  const detailRequestRef = useRef(0);
  const destinationRef = useRef(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [accessFilter, setAccessFilter] = useState('ACTIVE');
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
      setError(e.message || t('admin.administration.errors.loadList'));
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
    const requestId = detailRequestRef.current + 1;
    detailRequestRef.current = requestId;
    setDetailLoading(true);
    setDetailError('');
    try {
      const next = await apiFetch(`/admin/administration/backoffice-users/${userId}`);
      if (detailRequestRef.current !== requestId) {
        return;
      }
      setDetail(next || null);
      setForm(buildFormState(next, userId));
      setStatusNote('');
    } catch (e) {
      if (detailRequestRef.current !== requestId) {
        return;
      }
      setDetail(null);
      setDetailError(e.message || t('admin.administration.errors.loadDetail'));
    } finally {
      if (detailRequestRef.current === requestId) {
        setDetailLoading(false);
      }
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
    return users.filter((user) => {
      const hasActiveAccess = Boolean(user.hasEffectiveAccess && user.accessActive);
      if (accessFilter === 'ACTIVE' && !hasActiveAccess) return false;
      if (accessFilter === 'INACTIVE' && hasActiveAccess) return false;

      if (!q) return true;
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
  }, [query, users, accessFilter]);

  const availableRoles = normalizeRoleCodes(
    normalizeList(detail?.availableRoles).length ? normalizeList(detail?.availableRoles) : FALLBACK_ROLES
  );
  const availablePermissions = normalizeList(detail?.availablePermissions).length ? normalizeList(detail?.availablePermissions) : FALLBACK_PERMISSIONS;

  const selectForEdit = (userId) => {
    setSelectedUserId(userId);
    setEditorMode('edit');
    setFormError('');
    scrollToRef(destinationRef);
    if (detail?.userId === userId) {
      setForm(buildFormState(detail, userId));
      setStatusNote('');
    }
  };

  const startCreateFromLookup = (candidate) => {
    setSelectedUserId(null);
    setDetail(null);
    setEditorMode('create');
    setFormError('');
    scrollToRef(destinationRef);
    setForm({
      userId: candidate.userId,
      email: candidate.email,
      nickname: candidate.nickname || '',
      password: '',
      active: true,
      roleCodes: normalizeRoleCodes(candidate.assignedRoles),
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
    setDetailError('');
    setStatusNote('');
    scrollToRef(destinationRef);
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
      setLookupError(e.message || t('admin.administration.errors.lookupUser'));
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
      setFormError(e.message || t('admin.administration.errors.saveAccess'));
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
      setFormError(e.message || t('admin.administration.errors.resendVerification'));
    } finally {
      setResendingUserId(null);
    }
  };

  const updateStatus = async (userId, active) => {
    setFormError('');
    const note = statusNote.trim();
    try {
      const next = await apiFetch(`/admin/administration/backoffice-users/${userId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active, note }),
      });
      await load(userId);
      setSelectedUserId(userId);
      setDetail(next || null);
      setForm((prev) => ({
        ...prev,
        active: Boolean(next?.accessActive),
      }));
      setStatusNote('');
    } catch (e) {
      setFormError(e.message || t('admin.administration.errors.updateStatus'));
    }
  };

  const selectedSummary = filteredUsers.find((item) => item.userId === selectedUserId) || null;
  const showEditor = editorMode === 'edit' || editorMode === 'create';
  const hasFreshDetailForSelectedUser = detail?.userId === selectedUserId;
  const waitingForEditDetail = editorMode === 'edit' && selectedUserId && !hasFreshDetailForSelectedUser;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 16 }}>
        <div style={{ maxWidth: 820, fontSize: 13, color: '#52607a', lineHeight: 1.55 }}>
          {t('admin.administration.descriptions.panelIntro')}
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <StyledInput
            type="text"
            style={{ maxWidth: 260 }}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('admin.administration.placeholders.searchUsers')}
          />
          <SmallBtn type="button" onClick={() => load(selectedUserId)} disabled={loading}>
            {loading ? t('admin.common.status.refreshing') : t('admin.common.buttons.refresh')}
          </SmallBtn>
        </div>
      </div>

      {error && <StyledError>{error}</StyledError>}

      <CardsGrid style={{ marginBottom: 16 }}>
        <StatCard><div className="label">{t('admin.administration.stats.backofficeDomain')}</div><div className="value">{summary.totalUsers ?? users.length}</div><div className="meta">{t('admin.administration.descriptions.metaTotalUsers')}</div></StatCard>
        <StatCard><div className="label">{t('admin.administration.stats.explicitConfig')}</div><div className="value">{summary.explicitUsers ?? 0}</div><div className="meta">{t('admin.administration.descriptions.metaExplicitUsers')}</div></StatCard>
        <StatCard><div className="label">{t('admin.administration.stats.implicitAccess')}</div><div className="value">{summary.implicitAdminUsers ?? 0}</div><div className="meta">{t('admin.administration.descriptions.metaImplicitAdmin')}</div></StatCard>
        <StatCard><div className="label">{t('admin.administration.stats.effectiveAccess')}</div><div className="value">{summary.effectiveUsers ?? 0}</div><div className="meta">{t('admin.administration.descriptions.metaEffectiveUsers')}</div></StatCard>
        <StatCard><div className="label">ADMIN</div><div className="value">{summary.adminUsers ?? 0}</div><div className="meta">{t('admin.administration.descriptions.metaAdmin')}</div></StatCard>
        <StatCard><div className="label">SUPPORT</div><div className="value">{summary.supportUsers ?? 0}</div><div className="meta">{t('admin.administration.descriptions.metaSupport')}</div></StatCard>
        <StatCard><div className="label">AUDIT</div><div className="value">{summary.auditUsers ?? 0}</div><div className="meta">{t('admin.administration.descriptions.metaAudit')}</div></StatCard>
        <StatCard><div className="label">{t('admin.administration.stats.overrides')}</div><div className="value">{summary.usersWithOverrides ?? 0}</div><div className="meta">{t('admin.administration.descriptions.metaOverrides')}</div></StatCard>
        <StatCard><div className="label">{t('admin.administration.stats.inactive')}</div><div className="value">{summary.inactiveUsers ?? 0}</div><div className="meta">{t('admin.administration.descriptions.metaInactive')}</div></StatCard>
      </CardsGrid>

      <InlinePanel style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#162033' }}>{t('admin.administration.create.title')}</div>
        <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
          {t('admin.administration.descriptions.createIntro')}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
          <PanelRow style={{ marginTop: 0 }}>
          <FieldBlock style={{ minWidth: 280, flex: '1 1 320px' }}>
            <label>{t('admin.administration.create.existingUser')}</label>
            <StyledInput
              value={lookupQuery}
              onChange={(e) => setLookupQuery(e.target.value)}
              placeholder={t('admin.administration.placeholders.emailOrUserId')}
              style={{ maxWidth: '100%' }}
            />
          </FieldBlock>
          <SmallBtn type="button" onClick={runLookup} disabled={lookupLoading}>{lookupLoading ? t('admin.administration.buttons.searching') : t('admin.administration.buttons.searchUser')}</SmallBtn>
          </PanelRow>
          <div style={{ paddingTop: 10, borderTop: '1px solid #e7edf3', display: 'flex', justifyContent: 'flex-start' }}>
            <SmallBtn type="button" onClick={startCreateNewUser}>
              {t('admin.administration.buttons.newInternalUser')}
            </SmallBtn>
          </div>
        </div>
        {lookupError && <StyledError>{lookupError}</StyledError>}
        {lookupResults.length > 0 && (
          <div style={{ overflowX: 'auto', marginTop: 10 }}>
            <DarkHeaderTable style={{ marginTop: 0 }}>
              <thead><tr><th>{t('admin.common.columns.id')}</th><th>{t('admin.administration.columns.mail')}</th><th>{t('admin.administration.columns.productRole')}</th><th>{t('admin.administration.columns.access')}</th><th>{t('admin.administration.columns.action')}</th></tr></thead>
              <tbody>
                {lookupResults.map((item) => (
                  <tr key={item.userId}>
                    <td>{item.userId}</td>
                    <td>{item.email}</td>
                    <td><span style={pillStyle()}>{item.productRole || t('admin.administration.pills.notDefined')}</span></td>
                    <td>{item.hasEffectiveAccess && item.accessActive ? t('admin.administration.pills.active') : t('admin.administration.pills.noAccess')}</td>
                    <td>
                      {item.hasExplicitConfiguration ? (
                        <TableActionButton type="button" onClick={() => selectForEdit(item.userId)}>
                          {t('admin.administration.buttons.editAccess')}
                        </TableActionButton>
                      ) : (
                        <TableActionButton type="button" onClick={() => startCreateFromLookup(item)}>
                          {item.hasImplicitAdminAccess ? t('admin.administration.buttons.createConfig') : t('admin.administration.buttons.createAccess')}
                        </TableActionButton>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </DarkHeaderTable>
          </div>
        )}
      </InlinePanel>

      <div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 8 }}>
          <FieldBlock>
            <label>{t('admin.administration.columns.access')}</label>
            <StyledSelect value={accessFilter} onChange={(e) => setAccessFilter(e.target.value)}>
              <option value="ACTIVE">{t('admin.administration.filters.accessActive')}</option>
              <option value="ALL">{t('admin.common.labels.all')}</option>
              <option value="INACTIVE">{t('admin.administration.pills.noAccess')}</option>
            </StyledSelect>
          </FieldBlock>
        </div>
        <div style={{ maxWidth: '100%', maxHeight: '48vh', overflowX: 'auto' }}>
          <DarkHeaderTable style={{ maxWidth: '100%', marginTop: 0 }}>
            <thead>
              <tr>
                <th>{t('admin.common.columns.id')}</th>
                <th>{t('admin.administration.columns.mail')}</th>
                <th>{t('admin.administration.columns.productRole')}</th>
                <th>{t('admin.administration.columns.backofficeRoles')}</th>
                <th>{t('admin.administration.columns.access')}</th>
                <th>{t('admin.administration.columns.permissions')}</th>
                <th>{t('admin.administration.columns.overrides')}</th>
                <th>{t('admin.common.columns.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length === 0 ? (
                <tr><td colSpan="8" style={{ color: '#74819a' }}>{t('admin.administration.empty.noUsersMatch')}</td></tr>
              ) : filteredUsers.map((user) => (
                <tr key={user.userId} data-selected={selectedUserId === user.userId ? 'true' : undefined}>
                  <td>{user.userId}</td>
                  <td>{user.email}</td>
                  <td><span style={pillStyle()}>{user.productRole || t('admin.administration.pills.notDefined')}</span></td>
                  <td>{normalizeList(user.assignedRoles).length > 0 ? user.assignedRoles.map((role) => <span key={role} style={pillStyle(roleTone(role))}>{role}</span>) : <span style={{ color: '#74819a' }}>{t('admin.administration.pills.noAssignment')}</span>}</td>
                  <td>{user.hasEffectiveAccess && user.accessActive ? t('admin.administration.pills.active') : t('admin.administration.pills.noAccess')}</td>
                  <td>{user.effectivePermissionsCount || 0}</td>
                  <td>{user.hasOverrides ? <span style={pillStyle('warning')}>{t('admin.common.generic.yes')}</span> : <span style={{ color: '#74819a' }}>{t('admin.common.generic.no')}</span>}</td>
                  <td>
                    <TableActionGroup>
                      <TableActionButton type="button" onClick={() => { setSelectedUserId(user.userId); setEditorMode('view'); scrollToRef(destinationRef); }}>{t('admin.administration.buttons.viewDetail')}</TableActionButton>
                      <TableActionButton type="button" onClick={() => selectForEdit(user.userId)}>{t('admin.administration.buttons.editAccess')}</TableActionButton>
                      {!user.emailVerifiedAt ? <TableActionButton type="button" onClick={() => resendVerification(user.userId)} disabled={resendingUserId === user.userId}>{resendingUserId === user.userId ? t('admin.administration.buttons.resending') : t('admin.administration.buttons.resendValidation')}</TableActionButton> : null}
                    </TableActionGroup>
                  </td>
                </tr>
              ))}
            </tbody>
          </DarkHeaderTable>
        </div>

        <div ref={destinationRef} style={{ marginTop: 18 }}>
          <div style={{ border: '1px solid #c9d1db', borderRadius: 4, background: '#fff', padding: 18, boxShadow: 'none' }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#162033' }}>
            {editorMode === 'create' ? t('admin.administration.editor.titleCreate') : showEditor ? t('admin.administration.editor.titleEdit') : t('admin.administration.editor.titleView')}
          </div>
          <div style={{ marginTop: 6, fontSize: 13, color: '#52607a', lineHeight: 1.5 }}>
            {showEditor ? t('admin.administration.descriptions.editorHelp') : t('admin.administration.descriptions.viewHelp')}
          </div>

          {detailError && <StyledError>{detailError}</StyledError>}
          {formError && <StyledError>{formError}</StyledError>}
          {(detailLoading || waitingForEditDetail) && (
            <div style={{ marginTop: 16, color: '#74819a' }}>{t('admin.administration.empty.loadingDetail')}</div>
          )}

          {!detailLoading && !waitingForEditDetail && !showEditor && !detail && (
            <div style={{ marginTop: 16, color: '#52607a', lineHeight: 1.55 }}>{t('admin.administration.empty.pickUser')}</div>
          )}

          {!detailLoading && !waitingForEditDetail && (showEditor || detail) && (
            <div style={{ marginTop: 16 }}>
              <InlinePanel style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{form.email || detail?.email || selectedSummary?.email || t('admin.administration.pills.internalUser')}</div>
                <div style={{ marginTop: 4, fontSize: 12, color: '#74819a' }}>
                  {form.userId || detail?.userId || selectedSummary?.userId ? `User ID #${form.userId || detail?.userId || selectedSummary?.userId}` : ''}
                  {form.userId || detail?.userId || selectedSummary?.userId ? ' · ' : ''}
                  {t('admin.administration.editor.productRoleLabel')} {detail?.productRole || selectedSummary?.productRole || t('admin.administration.pills.notDefined')}
                </div>
                <div style={{ marginTop: 8, fontSize: 12, color: '#52607a', lineHeight: 1.6 }}>
                  <div>{detail?.accessActive ? t('admin.administration.editor.accessActive') : t('admin.administration.editor.accessInactive')}</div>
                  <div>{detail?.hasEffectiveAccess ? t('admin.administration.editor.effectiveAccess') : t('admin.administration.editor.noEffectiveAccess')}</div>
                  <div>{detail?.emailVerifiedAt || selectedSummary?.emailVerifiedAt ? t('admin.administration.editor.emailValidated') : t('admin.administration.editor.emailPending')}</div>
                  {detail?.hasExplicitConfiguration ? <div>{t('admin.administration.editor.explicitConfig')}</div> : null}
                  {detail?.hasImplicitAdminAccess ? <div>{t('admin.administration.editor.implicitAccess')}</div> : null}
                  {detail?.accountStatus ? <div>{detail.accountStatus}</div> : null}
                </div>
              </InlinePanel>

              {showEditor ? (
                <>
                  {editorMode === 'create' && !form.userId ? (
                    <InlinePanel key="create-empty-user" style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#74819a', marginBottom: 10 }}>{t('admin.administration.editor.internalUserBase')}</div>
                      <PanelRow>
                        <FieldBlock style={{ minWidth: 220, flex: '1 1 220px' }}>
                          <label>{t('admin.common.columns.email')}</label>
                          <StyledInput autoComplete="off" value={form.email} onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))} placeholder={t('admin.administration.placeholders.email')} />
                        </FieldBlock>
                        <FieldBlock style={{ minWidth: 180, flex: '1 1 180px' }}>
                          <label>{t('admin.administration.editor.nicknameLabel')}</label>
                          <StyledInput autoComplete="off" value={form.nickname} onChange={(e) => setForm((prev) => ({ ...prev, nickname: e.target.value }))} placeholder={t('admin.administration.placeholders.internalAlias')} />
                        </FieldBlock>
                      </PanelRow>
                      <FieldBlock>
                        <label>{t('admin.administration.editor.initialPasswordLabel')}</label>
                        <StyledInput autoComplete="new-password" type="password" value={form.password} onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))} placeholder={t('admin.administration.placeholders.passwordHint')} />
                      </FieldBlock>
                    </InlinePanel>
                  ) : null}

                  <InlinePanel style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#74819a', marginBottom: 10 }}>{t('admin.administration.editor.backofficeRoles')}</div>
                    <div style={{ fontSize: 12, color: '#52607a', marginBottom: 10 }}>{t('admin.administration.descriptions.rolesHelp')}</div>
                    {availableRoles.map((role) => (
                      <label key={role} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <CheckBox type="checkbox" checked={form.roleCodes.includes(normalizeRoleCode(role))} onChange={() => toggleRole(normalizeRoleCode(role))} />
                        <span style={{ ...pillStyle(roleTone(role)), margin: 0 }}>{role}</span>
                      </label>
                    ))}
                    <div style={{ fontSize: 12, color: '#334155', marginTop: 12 }}>
                      {t('admin.administration.warnings.saveDoesNotChangeStatus')}
                    </div>
                    {editorMode === 'create' ? (
                      <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12 }}>
                        <CheckBox type="checkbox" checked={Boolean(form.active)} onChange={(e) => setForm((prev) => ({ ...prev, active: e.target.checked }))} />
                        <span>{t('admin.administration.descriptions.keepActiveAfterCreate')}</span>
                      </label>
                    ) : null}
                  </InlinePanel>

                  <InlinePanel style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#74819a', marginBottom: 10 }}>{t('admin.administration.editor.permissionOverrides')}</div>
                    <div style={{ fontSize: 12, color: '#52607a', marginBottom: 10 }}>{t('admin.administration.descriptions.overridesHelp')}</div>
                    {availablePermissions.map((permission) => {
                      const mode = form.overrideAdditions.includes(permission) ? 'add' : form.overrideRemovals.includes(permission) ? 'remove' : 'inherit';
                      return (
                        <div key={permission} style={{ borderTop: '1px solid #eef2f7', padding: '8px 0' }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: '#162033', marginBottom: 6 }}>{permission}</div>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            <SmallBtn type="button" onClick={() => setPermissionMode(permission, 'inherit')} style={permissionModeBtnStyle(mode, 'inherit')}>{t('admin.administration.buttons.inherit')}</SmallBtn>
                            <SmallBtn type="button" onClick={() => setPermissionMode(permission, 'add')} style={permissionModeBtnStyle(mode, 'add')}>{t('admin.administration.buttons.grant')}</SmallBtn>
                            <SmallBtn type="button" onClick={() => setPermissionMode(permission, 'remove')} style={permissionModeBtnStyle(mode, 'remove')}>{t('admin.administration.buttons.remove')}</SmallBtn>
                          </div>
                        </div>
                      );
                    })}
                  </InlinePanel>

                  <FieldBlock>
                    <label>{t('admin.administration.editor.noteConfigLabel')}</label>
                    <TextArea value={form.note} onChange={(e) => setForm((prev) => ({ ...prev, note: e.target.value }))} placeholder={t('admin.administration.placeholders.noteConfig')} />
                  </FieldBlock>

                  {editorMode !== 'create' ? (
                    <FieldBlock>
                      <label>{t('admin.administration.editor.noteStatusLabel')}</label>
                      <TextArea value={statusNote} onChange={(e) => setStatusNote(e.target.value)} placeholder={t('admin.administration.placeholders.noteStatus')} />
                    </FieldBlock>
                  ) : null}

                  <PanelRow>
                    <StyledButton type="button" onClick={saveForm} disabled={saving}>{saving ? t('admin.common.status.saving') : editorMode === 'create' ? t('admin.administration.buttons.createAccess') : t('admin.administration.buttons.saveChanges')}</StyledButton>
                    {editorMode !== 'create' && form.userId ? (
                      <SmallBtn type="button" style={compactActionBtnStyle} onClick={() => updateStatus(form.userId, !detail?.accessActive)}>
                        {detail?.accessActive ? t('admin.administration.buttons.deactivateAccess') : t('admin.administration.buttons.activateAccess')}
                      </SmallBtn>
                    ) : null}
                    <SmallBtn type="button" style={compactActionBtnStyle} onClick={() => { setEditorMode('view'); setFormError(''); if (selectedUserId) loadDetail(selectedUserId); else { setForm(emptyForm); setDetail(null); } }}>{t('admin.common.buttons.cancel')}</SmallBtn>
                  </PanelRow>
                </>
              ) : (
                <>
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#74819a', marginBottom: 8 }}>{t('admin.administration.view.assignedRoles')}</div>
                    {normalizeList(detail?.assignedRoles).length > 0 ? (
                      <div style={{ fontSize: 12, color: '#334155', lineHeight: 1.6 }}>
                        {detail.assignedRoles.join(', ')}
                      </div>
                    ) : <span style={{ color: '#74819a' }}>{t('admin.administration.empty.noAssignedRoles')}</span>}
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#74819a', marginBottom: 8 }}>{t('admin.administration.view.accessSemantics')}</div>
                    <div style={{ fontSize: 12, color: '#334155', lineHeight: 1.6 }}>
                      <div>{detail?.hasExplicitConfiguration ? t('admin.administration.editor.explicitConfig') : t('admin.administration.view.noExplicitConfig')}</div>
                      {detail?.hasImplicitAdminAccess ? <div>{t('admin.administration.editor.implicitAccess')}</div> : null}
                      <div>{detail?.hasExplicitAccessRow ? t('admin.administration.view.explicitStatusRow') : t('admin.administration.view.noExplicitStatusRow')}</div>
                      <div>{detail?.emailVerifiedAt ? t('admin.administration.editor.emailValidated') : t('admin.administration.view.emailPendingValidation')}</div>
                    </div>
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#74819a', marginBottom: 8 }}>{t('admin.administration.view.effectiveRoles')}</div>
                    {normalizeList(detail?.effectiveRoles).length > 0 ? (
                      <div style={{ fontSize: 12, color: '#334155', lineHeight: 1.6 }}>
                        {detail.effectiveRoles.join(', ')}
                      </div>
                    ) : <span style={{ color: '#74819a' }}>{t('admin.administration.empty.noEffectiveRoles')}</span>}
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#74819a', marginBottom: 8 }}>{t('admin.administration.view.manualOverrides')}</div>
                    {normalizeList(detail?.overrideAdditions).length > 0 || normalizeList(detail?.overrideRemovals).length > 0 ? (
                      <div style={{ fontSize: 12, color: '#334155', lineHeight: 1.6 }}>
                        {normalizeList(detail?.overrideAdditions).map((item) => <div key={`add-${item}`}>+ {item}</div>)}
                        {normalizeList(detail?.overrideRemovals).map((item) => <div key={`remove-${item}`}>- {item}</div>)}
                      </div>
                    ) : <span style={{ color: '#74819a' }}>{t('admin.administration.empty.noOverrides')}</span>}
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#74819a', marginBottom: 8 }}>{t('admin.administration.view.effectivePermissions')}</div>
                    <div style={{ maxHeight: 190, overflow: 'auto', paddingRight: 4 }}>
                      {normalizeList(detail?.effectivePermissions).length > 0 ? (
                        <div style={{ fontSize: 12, color: '#334155', lineHeight: 1.6 }}>
                          {normalizeList(detail?.effectivePermissions).map((permission) => <div key={permission}>{permission}</div>)}
                        </div>
                      ) : <span style={{ color: '#74819a' }}>{t('admin.administration.empty.noEffectivePermissions')}</span>}
                    </div>
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#74819a', marginBottom: 8 }}>{t('admin.administration.view.recentTraceability')}</div>
                    {normalizeList(detail?.recentAuditLogs).length > 0 ? detail.recentAuditLogs.map((item) => (
                      <InlinePanel key={item.id} style={{ marginBottom: 8 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
                          <strong style={{ fontSize: 12 }}>{item.action}</strong>
                          <span style={{ fontSize: 11, color: '#74819a' }}>{item.createdAt || ''}</span>
                        </div>
                        <div style={{ fontSize: 12, color: '#52607a' }}>{item.summary || t('admin.administration.empty.noSummary')}</div>
                      </InlinePanel>
                    )) : <span style={{ color: '#74819a' }}>{t('admin.administration.empty.noAuditLogs')}</span>}
                  </div>
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
