import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckBox,
  ControlsRow,
  DocGrid,
  DocLink,
  FieldBlock,
  RightInfo,
  ScrollBox,
  SectionTitle,
  StyledButton,
  StyledError,
  StyledSelect,
  StyledTable,
} from '../../styles/AdminStyles';

const AdminModelsPanel = () => {
  const [users, setUsers] = useState([]);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [pageSize, setPageSize] = useState(10);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [kycCfgLoading, setKycCfgLoading] = useState(false);
  const [kycCfgSaving, setKycCfgSaving] = useState(false);
  const [kycCfgError, setKycCfgError] = useState('');
  const [kycCfg, setKycCfg] = useState(null);
  const [kycModeDraft, setKycModeDraft] = useState('VERIFF');

  const [docsByUser, setDocsByUser] = useState({});
  const [checksByUser, setChecksByUser] = useState({});
  const [savingCheckKey, setSavingCheckKey] = useState(null);

  const loadModelDocs = async (userId) => {
    try {
      const res = await fetch(`/api/admin/model-docs/${userId}`, {
        credentials: 'include',
      });
      if (!res.ok) return;
      const data = await res.json();

      setDocsByUser((m) => ({
        ...m,
        [userId]: {
          urlVerificFront: data.urlVerificFront || null,
          urlVerificBack: data.urlVerificBack || null,
          urlVerificDoc: data.urlVerificDoc || null,
        },
      }));
      const cl = data.checklist || {};
      setChecksByUser((m) => ({
        ...m,
        [userId]: {
          frontOk: !!cl.frontOk,
          backOk: !!cl.backOk,
          selfieOk: !!cl.selfieOk,
        },
      }));
    } catch {
      // noop
    }
  };

  const updateCheck = async (userId, field, value) => {
    setChecksByUser((prev) => ({ ...prev, [userId]: { ...prev[userId], [field]: value } }));
    setSavingCheckKey(`${userId}:${field}`);
    try {
      const res = await fetch(`/api/admin/model-checklist/${userId}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value }),
      });
      if (!res.ok) throw new Error((await res.text()) || 'Error guardando checklist');
      const data = await res.json();
      setChecksByUser((prev) => ({
        ...prev,
        [userId]: {
          frontOk: !!data.frontOk,
          backOk: !!data.backOk,
          selfieOk: !!data.selfieOk,
        },
      }));
    } catch (e) {
      alert(e.message || 'No se pudo guardar el check');
      setChecksByUser((prev) => ({ ...prev, [userId]: { ...prev[userId], [field]: !value } }));
    } finally {
      setSavingCheckKey(null);
    }
  };

  const canApprove = (userId) => {
    const d = docsByUser[userId] || {};
    const c = checksByUser[userId] || {};
    const hasF = !!d.urlVerificFront;
    const hasB = !!d.urlVerificBack;
    const hasS = !!d.urlVerificDoc;
    return hasF && hasB && hasS && !!c.frontOk && !!c.backOk && !!c.selfieOk;
  };

  const fetchUsers = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/admin/models', {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Error al cargar modelos');
      const data = await response.json();
      setUsers(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || 'Error cargando datos');
    } finally {
      setLoading(false);
    }
  };

  const loadKycConfig = async () => {
    setKycCfgLoading(true);
    setKycCfgError('');
    try {
      const res = await fetch('/api/kyc/config/model-onboarding', {
        credentials: 'include',
      });
      if (!res.ok) throw new Error((await res.text()) || 'Error cargando configuración KYC');
      const data = await res.json();
      setKycCfg(data || null);
      setKycModeDraft((data?.activeMode || 'VERIFF').toUpperCase());
    } catch (e) {
      setKycCfgError(e.message || 'Error cargando configuración KYC');
      setKycCfg(null);
    } finally {
      setKycCfgLoading(false);
    }
  };

  const saveKycMode = async () => {
    setKycCfgSaving(true);
    setKycCfgError('');
    try {
      const res = await fetch('/api/admin/kyc/model-onboarding/mode', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: kycModeDraft,
          note: `Cambio desde Admin UI a ${kycModeDraft}`,
        }),
      });
      if (!res.ok) throw new Error((await res.text()) || 'Error guardando modo KYC');
      await loadKycConfig();
    } catch (e) {
      setKycCfgError(e.message || 'Error guardando modo KYC');
    } finally {
      setKycCfgSaving(false);
    }
  };

  const handleReview = async (userId, action) => {
    if (action === 'REJECT') {
      const ok = window.confirm(
        '¿Quiere realmente rechazar la verificación de la modelo?\nEsta acción es permanente.'
      );
      if (!ok) return;
    }

    try {
      const response = await fetch(`/api/admin/review/${userId}?action=${action}`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Error al actualizar verificación');
      const message = await response.text();
      alert(message || 'Estado actualizado');
      fetchUsers();
    } catch (err) {
      setError(err.message || 'Error actualizando estado');
    }
  };

  useEffect(() => {
    fetchUsers();
    loadKycConfig();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const ids = (users || [])
      .filter((u) => (u.verificationStatus || 'PENDING') === 'PENDING' && !!u.id)
      .map((u) => u.id);
    ids.forEach((id) => {
      if (docsByUser[id] === undefined) {
        loadModelDocs(id);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [users]);

  const filteredUsers = useMemo(() => {
    if (statusFilter === 'ALL') return users;
    return users.filter((u) => (u.verificationStatus || 'PENDING') === statusFilter);
  }, [users, statusFilter]);

  const displayedUsers = useMemo(() => filteredUsers.slice(0, Number(pageSize)), [filteredUsers, pageSize]);

  return (
    <>
      <SectionTitle>Gestión de Modelos</SectionTitle>

      <div
        style={{
          width: '100%',
          maxWidth: '1200px',
          background: '#fff',
          border: '1px solid #eee',
          borderRadius: '10px',
          padding: '14px',
          marginBottom: '12px',
        }}
      >
        <div style={{ fontWeight: 600, marginBottom: 10 }}>
          Configuración KYC Onboarding
        </div>

        {kycCfgError && <StyledError>{kycCfgError}</StyledError>}

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <FieldBlock>
            <label>Modo KYC</label>
            <StyledSelect
              value={kycModeDraft}
              onChange={(e) => setKycModeDraft(e.target.value)}
              disabled={kycCfgLoading || kycCfgSaving}
            >
              <option value="VERIFF">VERIFF (automático)</option>
              <option value="MANUAL">MANUAL (documentos)</option>
            </StyledSelect>
          </FieldBlock>

          <StyledButton onClick={saveKycMode} disabled={kycCfgLoading || kycCfgSaving}>
            {kycCfgSaving ? 'Guardando…' : 'Guardar modo'}
          </StyledButton>
        </div>

        <div style={{ marginTop: 10, fontSize: 12, color: '#6c757d' }}>
          <div>
            <strong>Actual:</strong> {kycCfg?.activeMode || '—'}
          </div>
          <div>
            <strong>manualEnabled:</strong> {String(kycCfg?.manualEnabled ?? '—')} |{' '}
            <strong>veriffEnabled:</strong> {String(kycCfg?.veriffEnabled ?? '—')}
          </div>
        </div>
      </div>

      <ControlsRow>
        <FieldBlock>
          <label>Estado</label>
          <StyledSelect value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="ALL">Todos</option>
            <option value="PENDING">Pendiente</option>
            <option value="APPROVED">Aprobado</option>
            <option value="REJECTED">Rechazado</option>
          </StyledSelect>
        </FieldBlock>

        <FieldBlock>
          <label>Resultados</label>
          <StyledSelect value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))}>
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={30}>30</option>
            <option value={40}>40</option>
            <option value={50}>50</option>
          </StyledSelect>
        </FieldBlock>

        <RightInfo>
          <StyledButton onClick={fetchUsers} disabled={loading}>
            {loading ? 'Actualizando...' : 'Refrescar'}
          </StyledButton>
        </RightInfo>
      </ControlsRow>

      {loading && <div>Cargando...</div>}
      {error && <StyledError>{error}</StyledError>}

      <ScrollBox>
        <StyledTable>
          <thead>
            <tr>
              <th>ID</th>
              <th>Email</th>
              <th>Rol</th>
              <th>Tipo</th>
              <th>Estado de Verificación</th>
              <th>Suscripción</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {displayedUsers.map((user) => {
              const v = user.verificationStatus || 'PENDING';
              if (!user.id) {
                return (
                  <tr key={user.email || Math.random()}>
                    <td>—</td>
                    <td>{user.email}</td>
                    <td>{user.role}</td>
                    <td>{user.userType}</td>
                    <td>{v}</td>
                    <td>{String(user?.unsubscribe).toLowerCase() === 'true' || String(user?.unsubscribe) === '1' ? 'Baja' : 'Alta'}</td>
                    <td>
                      <span style={{ color: '#dc3545' }}>ID no válido</span>
                    </td>
                  </tr>
                );
              }

              const docUrls = docsByUser[user.id] || {};
              const checks = checksByUser[user.id] || {};
              const mkBtn = (label, url, fieldKey) => {
                const saving = savingCheckKey === `${user.id}:${fieldKey}`;
                return (
                  <div key={fieldKey} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <DocLink
                      href={url || '#'}
                      target="_blank"
                      rel="noreferrer"
                      $disabled={!url}
                      onClick={(e) => { if (!url) e.preventDefault(); }}
                      title={url ? 'Abrir documento' : 'No disponible'}
                    >
                      {label}
                    </DocLink>
                    <CheckBox
                      type="checkbox"
                      disabled={!url || saving}
                      checked={!!checks[fieldKey]}
                      onChange={(e) => updateCheck(user.id, fieldKey, e.target.checked)}
                      title={!url ? 'No hay documento' : 'Marcar como validado'}
                    />
                  </div>
                );
              };

              return (
                <tr key={user.id}>
                  <td>{user.id}</td>
                  <td>{user.email}</td>
                  <td>{user.role}</td>
                  <td>{user.userType}</td>
                  <td>{v}</td>
                  <td>{String(user?.unsubscribe).toLowerCase() === 'true' || String(user?.unsubscribe) === '1' ? 'Baja' : 'Alta'}</td>
                  <td>
                    {v === 'PENDING' && (
                      <>
                        <DocGrid>
                          {mkBtn('Frontal', docUrls.urlVerificFront, 'frontOk')}
                          {mkBtn('Trasera', docUrls.urlVerificBack, 'backOk')}
                          {mkBtn('Selfie/PDF', docUrls.urlVerificDoc, 'selfieOk')}
                        </DocGrid>

                        <StyledButton
                          onClick={() => handleReview(user.id, 'APPROVE')}
                          disabled={!canApprove(user.id)}
                          title={!canApprove(user.id) ? 'Valida los 3 documentos primero' : 'Aprobar modelo'}
                          style={{ marginRight: '10px' }}
                        >
                          Aprobar
                        </StyledButton>

                        <StyledButton
                          style={{ backgroundColor: '#dc3545' }}
                          onClick={() => handleReview(user.id, 'REJECT')}
                        >
                          Rechazar
                        </StyledButton>
                      </>
                    )}

                    {v === 'APPROVED' && (
                      <StyledButton
                        style={{ backgroundColor: '#dc3545' }}
                        onClick={() => handleReview(user.id, 'REJECT')}
                      >
                        Rechazar
                      </StyledButton>
                    )}

                    {v === 'REJECTED' && (
                      <span style={{ color: '#dc3545', fontWeight: 'bold' }}>Rechazada permanentemente</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </StyledTable>
      </ScrollBox>
    </>
  );
};

export default AdminModelsPanel;
