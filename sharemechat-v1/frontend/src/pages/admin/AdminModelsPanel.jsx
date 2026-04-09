import React, { useEffect, useMemo, useState } from 'react';
import styled from 'styled-components';
import {
  CardsGrid,
  CheckBox,
  ControlsRow,
  DocGrid,
  DocLink,
  FieldBlock,
  InlinePanel,
  RightInfo,
  SectionTitle,
  SmallBtn,
  StatCard,
  StyledButton,
  DarkHeaderTable,
  TableActionGroup,
  TableDangerButton,
  StyledError,
  StyledSelect,
  TableSuccessButton,
} from '../../styles/AdminStyles';

const ModelsTable = styled(DarkHeaderTable)`
  border: 1px solid #b4beca;

  tbody tr td {
    background: #fff !important;
    border-bottom-color: #d6dde5;
  }

  tbody tr:hover td {
    background: #f1f4f7 !important;
  }
`;

const AdminModelsPanel = ({
  canReadKycMode = false,
  canUpdateChecklist = false,
  canReviewModels = false,
  canChangeKycMode = false,
  canViewSensitiveDocs = false,
}) => {
  const [users, setUsers] = useState([]);
  const [statusFilter, setStatusFilter] = useState('ACTIVE');
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
    if (!canViewSensitiveDocs) return;

    try {
      const res = await fetch(`/api/admin/model-docs/${userId}`, {
        credentials: 'include',
      });
      if (!res.ok) return;

      const data = await res.json();
      setDocsByUser((prev) => ({
        ...prev,
        [userId]: {
          urlVerificFront: data.urlVerificFront || null,
          urlVerificBack: data.urlVerificBack || null,
          urlVerificDoc: data.urlVerificDoc || null,
        },
      }));

      const checklist = data.checklist || {};
      setChecksByUser((prev) => ({
        ...prev,
        [userId]: {
          frontOk: !!checklist.frontOk,
          backOk: !!checklist.backOk,
          selfieOk: !!checklist.selfieOk,
        },
      }));
    } catch {
      // noop
    }
  };

  const updateCheck = async (userId, field, value) => {
    if (!canUpdateChecklist) return;

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
    const docs = docsByUser[userId] || {};
    const checks = checksByUser[userId] || {};
    const hasFront = !!docs.urlVerificFront;
    const hasBack = !!docs.urlVerificBack;
    const hasSelfie = !!docs.urlVerificDoc;
    return hasFront && hasBack && hasSelfie && !!checks.frontOk && !!checks.backOk && !!checks.selfieOk;
  };

  const fetchUsers = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/admin/models', {
        credentials: 'include',
      });
      if (!response.ok) throw new Error((await response.text()) || 'Error al cargar modelos');

      const data = await response.json();
      const rows = Array.isArray(data) ? data : [];
      setUsers(rows);
      setChecksByUser((prev) => {
        const next = { ...prev };
        rows.forEach((user) => {
          if (!user?.id) return;
          next[user.id] = {
            frontOk: !!user.modelChecklistFrontOk,
            backOk: !!user.modelChecklistBackOk,
            selfieOk: !!user.modelChecklistSelfieOk,
          };
        });
        return next;
      });
    } catch (err) {
      setError(err.message || 'Error cargando datos');
    } finally {
      setLoading(false);
    }
  };

  const loadKycConfig = async () => {
    if (!canReadKycMode) return;

    setKycCfgLoading(true);
    setKycCfgError('');
    try {
      const res = await fetch('/api/kyc/config/model-onboarding', {
        credentials: 'include',
      });
      if (!res.ok) throw new Error((await res.text()) || 'Error cargando configuracion KYC');
      const data = await res.json();
      setKycCfg(data || null);
      setKycModeDraft((data?.activeMode || 'VERIFF').toUpperCase());
    } catch (e) {
      setKycCfgError(e.message || 'Error cargando configuracion KYC');
      setKycCfg(null);
    } finally {
      setKycCfgLoading(false);
    }
  };

  const saveKycMode = async () => {
    if (!canChangeKycMode) return;

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
    if (!canReviewModels) return;

    if (action === 'REJECT') {
      const ok = window.confirm(
        'Quieres rechazar la verificacion de esta modelo?\nEsta accion se considera definitiva en el flujo actual.'
      );
      if (!ok) return;
    }

    try {
      const response = await fetch(`/api/admin/review/${userId}?action=${action}`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!response.ok) throw new Error((await response.text()) || 'Error al actualizar verificacion');
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
    if (!canViewSensitiveDocs) return;

    const ids = (users || [])
      .filter((user) => (user.verificationStatus || 'PENDING') === 'PENDING' && !!user.id)
      .map((user) => user.id);

    ids.forEach((id) => {
      if (docsByUser[id] === undefined) {
        loadModelDocs(id);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [users, canViewSensitiveDocs]);

  const filteredUsers = useMemo(() => {
    if (statusFilter === 'ALL') return users;
    if (statusFilter === 'ACTIVE') {
      return users.filter((user) => {
        const verification = String(user?.verificationStatus || 'PENDING').toUpperCase();
        const isUnsubscribed =
          String(user?.unsubscribe).toLowerCase() === 'true' || String(user?.unsubscribe) === '1';
        return verification === 'APPROVED' && !isUnsubscribed;
      });
    }
    return users.filter((user) => (user.verificationStatus || 'PENDING') === statusFilter);
  }, [users, statusFilter]);

  const displayedUsers = useMemo(
    () => filteredUsers.slice(0, Number(pageSize)),
    [filteredUsers, pageSize]
  );

  const statusSummary = useMemo(() => {
    const summary = { total: users.length, pending: 0, approved: 0, rejected: 0 };
    users.forEach((user) => {
      const status = String(user?.verificationStatus || 'PENDING').toUpperCase();
      if (status === 'APPROVED') summary.approved += 1;
      else if (status === 'REJECTED') summary.rejected += 1;
      else summary.pending += 1;
    });
    return summary;
  }, [users]);

  const renderChecklistCell = (user) => {
    const checks = checksByUser[user.id] || {};
    const docs = docsByUser[user.id] || {};

    const items = [
      { label: 'Frontal', fieldKey: 'frontOk', url: docs.urlVerificFront },
      { label: 'Trasera', fieldKey: 'backOk', url: docs.urlVerificBack },
      { label: 'Selfie/PDF', fieldKey: 'selfieOk', url: docs.urlVerificDoc },
    ];

    return (
      <DocGrid>
        {items.map(({ label, fieldKey, url }) => {
          const saving = savingCheckKey === `${user.id}:${fieldKey}`;
          const content = canViewSensitiveDocs ? (
            <DocLink
              href={url || '#'}
              target="_blank"
              rel="noreferrer"
              $disabled={!url}
              onClick={(e) => {
                if (!url) e.preventDefault();
              }}
              title={url ? 'Abrir documento' : 'No disponible'}
            >
              {label}
            </DocLink>
          ) : (
            <span>{label}</span>
          );

          return (
            <div key={fieldKey} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {content}
              <CheckBox
                type="checkbox"
                disabled={!canUpdateChecklist || saving}
                checked={!!checks[fieldKey]}
                onChange={(e) => updateCheck(user.id, fieldKey, e.target.checked)}
                title={canUpdateChecklist ? 'Marcar como validado' : 'Sin permiso para actualizar checklist'}
              />
            </div>
          );
        })}
      </DocGrid>
    );
  };

  return (
    <>
      <SectionTitle>Modelos</SectionTitle>

      <div style={{ fontSize: 12, color: '#52607a', lineHeight: 1.55, marginBottom: 8, maxWidth: 980 }}>
        Vista operativa de onboarding y revision de modelos. Permite filtrar estados, validar documentacion y ejecutar aprobacion o rechazo cuando el flujo actual lo permite.
      </div>

      <CardsGrid style={{ marginBottom: 10 }}>
        <StatCard>
          <div className="label">Total visible</div>
          <div className="value">{statusSummary.total}</div>
          <div className="meta">Modelos cargados en la vista.</div>
        </StatCard>
        <StatCard>
          <div className="label">Pendientes</div>
          <div className="value">{statusSummary.pending}</div>
          <div className="meta">Requieren validacion o decision.</div>
        </StatCard>
        <StatCard>
          <div className="label">Aprobados</div>
          <div className="value">{statusSummary.approved}</div>
          <div className="meta">Ya pasaron a flujo operativo.</div>
        </StatCard>
        <StatCard>
          <div className="label">Rechazados</div>
          <div className="value">{statusSummary.rejected}</div>
          <div className="meta">Casos cerrados sin aprobacion.</div>
        </StatCard>
      </CardsGrid>

      {canReadKycMode && (
        <InlinePanel style={{ maxWidth: 1200, marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, color: '#162033' }}>
                Configuracion KYC de onboarding
              </div>
              <div style={{ marginTop: 4, fontSize: 12, color: '#52607a', lineHeight: 1.5, maxWidth: 720 }}>
                Controla si el alta de modelos sigue el flujo automatico con Veriff o el flujo manual con revision documental.
              </div>
            </div>
          </div>

          {kycCfgError && <StyledError>{kycCfgError}</StyledError>}

          {canChangeKycMode ? (
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end', marginTop: 10 }}>
              <FieldBlock>
                <label>Modo KYC</label>
                <StyledSelect
                  value={kycModeDraft}
                  onChange={(e) => setKycModeDraft(e.target.value)}
                  disabled={kycCfgLoading || kycCfgSaving}
                >
                  <option value="VERIFF">VERIFF (automatico)</option>
                  <option value="MANUAL">MANUAL (documentos)</option>
                </StyledSelect>
              </FieldBlock>

              <StyledButton onClick={saveKycMode} disabled={kycCfgLoading || kycCfgSaving}>
                {kycCfgSaving ? 'Guardando...' : 'Guardar modo'}
              </StyledButton>
            </div>
          ) : (
            <div style={{ marginTop: 10, fontSize: 12, color: '#6c757d' }}>
              Lectura del modo KYC actual. El cambio global queda reservado a ADMIN.
            </div>
          )}

          <div style={{ marginTop: 10, fontSize: 12, color: '#6c757d', lineHeight: 1.5 }}>
            <div>
              <strong>Actual:</strong> {kycCfg?.activeMode || '-'}
            </div>
            <div>
              <strong>manualEnabled:</strong> {String(kycCfg?.manualEnabled ?? '-')} |{' '}
              <strong>veriffEnabled:</strong> {String(kycCfg?.veriffEnabled ?? '-')}
            </div>
          </div>
        </InlinePanel>
      )}

      <ControlsRow>
        <FieldBlock>
          <label>Estado</label>
          <StyledSelect value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="ALL">Todos</option>
            <option value="ACTIVE">Activas</option>
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
          <SmallBtn type="button" onClick={fetchUsers} disabled={loading}>
            {loading ? 'Actualizando...' : 'Refrescar'}
          </SmallBtn>
        </RightInfo>
      </ControlsRow>

      {loading && <div style={{ fontSize: 12, color: '#52607a' }}>Cargando...</div>}
      {error && <StyledError>{error}</StyledError>}

      <div style={{ overflowX: 'auto' }}>
        <ModelsTable style={{ marginTop: 0 }}>
          <thead>
            <tr>
              <th>ID</th>
              <th>Email</th>
              <th>Rol</th>
              <th>Tipo</th>
              <th>Verificacion</th>
              <th>Cuenta</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {displayedUsers.map((user) => {
              const verification = user.verificationStatus || 'PENDING';

              if (!user.id) {
                return (
                  <tr key={user.email || Math.random()}>
                    <td>-</td>
                    <td>{user.email}</td>
                    <td>{user.role}</td>
                    <td>{user.userType}</td>
                    <td>{verification}</td>
                    <td>{String(user?.unsubscribe).toLowerCase() === 'true' || String(user?.unsubscribe) === '1' ? 'Baja' : 'Alta'}</td>
                    <td>
                      <span style={{ color: '#dc3545' }}>ID no valido</span>
                    </td>
                  </tr>
                );
              }

              return (
                <tr key={user.id}>
                  <td>{user.id}</td>
                  <td>{user.email}</td>
                  <td>{user.role}</td>
                  <td>{user.userType}</td>
                  <td>
                    <strong>{verification}</strong>
                    {verification === 'PENDING' && (
                      <div style={{ fontSize: 11, color: '#74819a', marginTop: 4 }}>
                        Pendiente de validacion y decision.
                      </div>
                    )}
                  </td>
                  <td>{String(user?.unsubscribe).toLowerCase() === 'true' || String(user?.unsubscribe) === '1' ? 'Baja' : 'Alta'}</td>
                  <td>
                    {verification === 'PENDING' && canUpdateChecklist && renderChecklistCell(user)}

                    {verification === 'PENDING' && canReviewModels && (
                      <TableActionGroup>
                        <TableSuccessButton
                          onClick={() => handleReview(user.id, 'APPROVE')}
                          disabled={!canApprove(user.id)}
                          title={!canApprove(user.id) ? 'Valida los 3 documentos primero' : 'Aprobar modelo'}
                        >
                          Aprobar
                        </TableSuccessButton>

                        <TableDangerButton
                          onClick={() => handleReview(user.id, 'REJECT')}
                        >
                          Rechazar
                        </TableDangerButton>
                      </TableActionGroup>
                    )}

                    {verification === 'APPROVED' && canReviewModels && (
                      <TableActionGroup>
                        <TableDangerButton onClick={() => handleReview(user.id, 'REJECT')}>
                          Rechazar
                        </TableDangerButton>
                      </TableActionGroup>
                    )}

                    {verification === 'REJECTED' && (
                      <span style={{ color: '#dc3545', fontWeight: 'bold' }}>Rechazada permanentemente</span>
                    )}

                    {!canUpdateChecklist && !canReviewModels && verification !== 'REJECTED' && (
                      <span style={{ color: '#6c757d' }}>Solo lectura</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </ModelsTable>
      </div>
    </>
  );
};

export default AdminModelsPanel;
