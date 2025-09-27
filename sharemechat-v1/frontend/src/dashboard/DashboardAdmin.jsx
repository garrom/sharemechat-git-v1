import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useHistory } from 'react-router-dom';
import Roles from '../constants/Roles';
import {
  StyledContainer,
  StyledTable,
  StyledButton,
  StyledLinkButton,
  StyledError,
  StyledSelect,
  HeaderBar,
  TabsBar,
  TabButton,
  ControlsRow,
  FieldBlock,
  RightInfo,
  ScrollBox,
  SectionTitle,
  CardsGrid,
  StatCard,
  NoteCard,
  FinanceList,
  FinanceItem,
  DbLayout,
  DbFilters,
  DbTableWrap,
  FloatingBtn,
  DocGrid,
  DocLink,
  CheckBox,
  LogoutButton
} from '../styles/AdminStyles';

const DashboardAdmin = () => {
  const [userData] = useState({ name: 'Administrador' });
  const [users, setUsers] = useState([]);
  const [statusFilter, setStatusFilter] = useState('ALL'); // ALL | PENDING | APPROVED | REJECTED
  const [pageSize, setPageSize] = useState(10); // 10,20,30,40,50
  const [activeTab, setActiveTab] = useState('models'); // models | users | finance | db
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // ---- Stats
  const [waitingModelsCount, setWaitingModelsCount] = useState(null);
  const [waitingClientsCount, setWaitingClientsCount] = useState(null);
  const [statsUpdatedAt, setStatsUpdatedAt] = useState(null);
  const [statsError, setStatsError] = useState('');
  const [modelsStreamingCount, setModelsStreamingCount] = useState(null);
  const [clientsStreamingCount, setClientsStreamingCount] = useState(null);

  // ---- Finance
  const [topModels, setTopModels] = useState([]);
  const [topClients, setTopClients] = useState([]);
  const [financeSummary, setFinanceSummary] = useState(null);
  const [financeLoading, setFinanceLoading] = useState(false);
  const [financeError, setFinanceError] = useState('');

  // ---- DB view
  const [dbTable, setDbTable] = useState('');
  const [dbLimit, setDbLimit] = useState(10);
  const [dbRows, setDbRows] = useState([]);
  const [dbLoading, setDbLoading] = useState(false);
  const [dbError, setDbError] = useState('');

  // ---- Revisión de documentos
  const [docsByUser, setDocsByUser] = useState({});
  const [checksByUser, setChecksByUser] = useState({});
  const [savingCheckKey, setSavingCheckKey] = useState(null); // "userId:field"

  const wsAdminRef = useRef(null);
  const pingAdminRef = useRef(null);
  const history = useHistory();
  const token = localStorage.getItem('token');

  const DB_TABLES = [
    'users',
    'clients',
    'models',
    'transactions',
    'balances',
    'platform_transactions',
    'platform_balances',
    'stream_records',
    'favorites_clients',
    'favorites_models',
    'gifts',
    'messages',
    'password_reset_tokens',
    'unsubscribe',
    'client_documents',
    'model_documents',
    'consent_events',
    'model_review_checklist',
  ];

  const LIMIT_OPTIONS = [10, 20, 30, 40, 50, 100];

  // -------- helpers revisión
  const loadModelDocs = async (userId) => {
    try {
      const res = await fetch(`/api/admin/model-docs/${userId}`, {
        headers: { Authorization: `Bearer ${token}` },
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
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
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

  // ---------------- effects
  useEffect(() => {
    if (!token) {
      history.push('/');
      return;
    }
    if (activeTab === 'models') {
      fetchUsers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, history, activeTab]);

  useEffect(() => {
    if (activeTab !== 'models') return;
    const ids = (users || [])
      .filter((u) => (u.verificationStatus || 'PENDING') === 'PENDING' && !!u.id)
      .map((u) => u.id);
    ids.forEach((id) => {
      if (docsByUser[id] === undefined) {
        loadModelDocs(id);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, users]);

  useEffect(() => {
    if (activeTab !== 'stats') {
      if (pingAdminRef.current) {
        clearInterval(pingAdminRef.current);
        pingAdminRef.current = null;
      }
      if (wsAdminRef.current) {
        try {
          wsAdminRef.current.close();
        } catch {}
        wsAdminRef.current = null;
      }
      return;
    }
    if (!token) return;

    setStatsError('');
    try {
      const wsUrl = `wss://test.sharemechat.com/match?token=${encodeURIComponent(token)}`;
      const ws = new WebSocket(wsUrl);
      wsAdminRef.current = ws;

      ws.onopen = () => {
        ws.send(JSON.stringify({ type: 'stats' }));
        pingAdminRef.current = setInterval(() => {
          if (wsAdminRef.current?.readyState === WebSocket.OPEN) {
            wsAdminRef.current.send(JSON.stringify({ type: 'stats' }));
          }
        }, 60000);
      };

      ws.onmessage = (evt) => {
        const data = JSON.parse(evt.data);
        if (data.type === 'queue-stats') {
          setWaitingModelsCount(data.waitingModels);
          setWaitingClientsCount(data.waitingClients);
          setModelsStreamingCount(data.modelsStreaming ?? data.activePairs ?? null);
          setClientsStreamingCount(data.clientsStreaming ?? data.activePairs ?? null);
          setStatsUpdatedAt(new Date());
        }
      };

      ws.onerror = () => setStatsError('Error de conexión con estadísticas.');
      ws.onclose = () => {
        if (pingAdminRef.current) {
          clearInterval(pingAdminRef.current);
          pingAdminRef.current = null;
        }
      };
    } catch (e) {
      setStatsError(e.message || 'No se pudo abrir estadísticas.');
    }

    return () => {
      if (pingAdminRef.current) {
        clearInterval(pingAdminRef.current);
        pingAdminRef.current = null;
      }
      if (wsAdminRef.current) {
        try {
          wsAdminRef.current.close();
        } catch {}
        wsAdminRef.current = null;
      }
    };
  }, [activeTab, token]);

  useEffect(() => {
    if (activeTab !== 'finance') return;
    (async () => {
      setFinanceLoading(true);
      setFinanceError('');
      try {
        const [mRes, cRes, sRes] = await Promise.all([
          fetch('/api/admin/finance/top-models?limit=10', { headers: { Authorization: `Bearer ${token}` } }),
          fetch('/api/admin/finance/top-clients?limit=10', { headers: { Authorization: `Bearer ${token}` } }),
          fetch('/api/admin/finance/summary', { headers: { Authorization: `Bearer ${token}` } }),
        ]);
        if (!mRes.ok || !cRes.ok || !sRes.ok) throw new Error('Error al cargar análisis financieros');
        const [m, c, s] = await Promise.all([mRes.json(), cRes.json(), sRes.json()]);
        setTopModels(Array.isArray(m) ? m : []);
        setTopClients(Array.isArray(c) ? c : []);
        setFinanceSummary(s || null);
      } catch (e) {
        setFinanceError(e.message || 'Error al cargar análisis financieros');
      } finally {
        setFinanceLoading(false);
      }
    })();
  }, [activeTab, token]);

  useEffect(() => {
    if (activeTab !== 'db' || !dbTable) return;
    (async () => {
      setDbLoading(true);
      setDbError('');
      try {
        const res = await fetch(`/api/admin/db/view?table=${encodeURIComponent(dbTable)}&limit=${dbLimit}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error((await res.text()) || 'Error al consultar BBDD');
        const data = await res.json();
        setDbRows(Array.isArray(data) ? data : []);
      } catch (e) {
        setDbError(e.message || 'Error al consultar BBDD');
        setDbRows([]);
      } finally {
        setDbLoading(false);
      }
    })();
  }, [activeTab, dbTable, dbLimit, token]);

  // --------------- data fetchers base
  const fetchUsers = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/admin/models', {
        headers: { Authorization: `Bearer ${token}` },
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
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('Error al actualizar verificación');
      const message = await response.text();
      alert(message || 'Estado actualizado');
      fetchUsers();
    } catch (err) {
      setError(err.message || 'Error actualizando estado');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    history.push('/');
  };

  const filteredUsers = useMemo(() => {
    if (statusFilter === 'ALL') return users;
    return users.filter((u) => (u.verificationStatus || 'PENDING') === statusFilter);
  }, [users, statusFilter]);

  const displayedUsers = useMemo(() => filteredUsers.slice(0, Number(pageSize)), [filteredUsers, pageSize]);

  const isHiddenDbCell = (tableName, colName) => {
    const t = String(tableName || '').toLowerCase();
    const k = String(colName || '').toLowerCase();
    if (t === 'users' && (k === 'biography' || k === 'interests')) return true;
    if (t === 'messages' && k === 'body') return true;
    return false;
  };

  return (
    <StyledContainer>
      {/* Header + Logout */}
      <HeaderBar>
        <h2>Hola, {userData.name} (Rol: {Roles.ADMIN})</h2>
        <LogoutButton onClick={handleLogout} title="Cerrar sesión">Salir</LogoutButton>
      </HeaderBar>

      {/* Tabs */}
      <TabsBar>
        <TabButton active={activeTab === 'models'} onClick={() => setActiveTab('models')}>Gestión Modelos</TabButton>
        <TabButton active={activeTab === 'stats'} onClick={() => setActiveTab('stats')}>Estadísticas</TabButton>
        <TabButton active={activeTab === 'finance'} onClick={() => setActiveTab('finance')}>Análisis Financiero</TabButton>
        <TabButton active={activeTab === 'db'} onClick={() => setActiveTab('db')}>Vista BBDD</TabButton>
      </TabsBar>

      {/* MODELOS */}
      {activeTab === 'models' && (
        <>
          <SectionTitle>Gestión de Modelos</SectionTitle>

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
      )}

      {/* ESTADÍSTICAS */}
      {activeTab === 'stats' && (
        <div>
          <SectionTitle>Estadísticas</SectionTitle>
          {statsError && <StyledError>{statsError}</StyledError>}

          <CardsGrid>
            <StatCard>
              <div className="label">Modelos en cola</div>
              <div className="value">{waitingModelsCount ?? '—'}</div>
              <div className="meta">
                {statsUpdatedAt ? `Actualizado: ${statsUpdatedAt.toLocaleTimeString()}` : 'Actualizando…'}
              </div>
            </StatCard>

            <StatCard>
              <div className="label">Modelos en streaming</div>
              <div className="value">{modelsStreamingCount ?? '—'}</div>
              <div className="meta">
                {statsUpdatedAt ? `Actualizado: ${statsUpdatedAt.toLocaleTimeString()}` : 'Actualizando…'}
              </div>
            </StatCard>

            <StatCard>
              <div className="label">Clientes en streaming</div>
              <div className="value">{clientsStreamingCount ?? '—'}</div>
              <div className="meta">
                {statsUpdatedAt ? `Actualizado: ${statsUpdatedAt.toLocaleTimeString()}` : 'Actualizando…'}
              </div>
            </StatCard>

            <NoteCard>
              <div className="label">KPI futura</div>
              <div className="value">—</div>
            </NoteCard>

            <NoteCard>
              <div className="label">KPI futura</div>
              <div className="value">—</div>
            </NoteCard>
          </CardsGrid>
        </div>
      )}

      {/* FINANZAS */}
      {activeTab === 'finance' && (
        <div>
          <SectionTitle>Análisis financieros</SectionTitle>
          {financeError && <StyledError>{financeError}</StyledError>}

          <CardsGrid>
            <StatCard>
              <div className="label">Ganancias brutas (facturación total)</div>
              <div className="value">{financeLoading ? '…' : financeSummary?.grossBillingEUR ?? '—'}</div>
              <div className="meta">Sin descontar participación de modelos.</div>
            </StatCard>

            <StatCard>
              <div className="label">Ganancias netas (plataforma)</div>
              <div className="value">{financeLoading ? '…' : financeSummary?.netProfitEUR ?? '—'}</div>
              <div className="meta">Descontado lo que se lleva la modelo.</div>
            </StatCard>

            <StatCard>
              <div className="label">% beneficio / facturación</div>
              <div className="value">{financeLoading ? '…' : financeSummary?.profitPercent ?? '—'}</div>
              <div className="meta">(neto / bruto) × 100</div>
            </StatCard>

            <StatCard>
              <div className="label">Top 10 modelos por ingresos</div>
              <FinanceList>
                {(financeLoading ? [] : topModels).map((it, i) => (
                  <FinanceItem key={i}>
                    {it.nickname || it.name || it.email || `Modelo #${it.modelId}`} — <strong>{it.totalEarningsEUR}</strong>
                  </FinanceItem>
                ))}
                {!financeLoading && topModels.length === 0 && <div>Sin datos.</div>}
              </FinanceList>
            </StatCard>

            <StatCard>
              <div className="label">Top 10 clientes por pagos</div>
              <FinanceList>
                {(financeLoading ? [] : topClients).map((it, i) => (
                  <FinanceItem key={i}>
                    {it.nickname || it.name || it.email || `Cliente #${it.clientId}`} — <strong>{it.totalPagosEUR}</strong>
                  </FinanceItem>
                ))}
                {!financeLoading && topClients.length === 0 && <div>Sin datos.</div>}
              </FinanceList>
            </StatCard>

            <NoteCard $muted>
              <div className="label">Nota</div>
              <div className="meta">
                Pendiente: Separar ganacia Streaming y Regalos; mostrar nº usuarios modelo/cliente y nº clientes/modelos
              </div>
            </NoteCard>

            {Array.from({ length: 6 }).map((_, i) => (
              <NoteCard key={i}>
                <div className="label">KPI futura</div>
                <div className="value">—</div>
              </NoteCard>
            ))}
          </CardsGrid>
        </div>
      )}

      {/* VISTA BBDD */}
      {activeTab === 'db' && (
        <div>
          <SectionTitle>Vista BBDD</SectionTitle>

          <DbLayout>
            <DbFilters id="dbFilters">
              <FieldBlock style={{ minWidth: 220 }}>
                <label>Tabla</label>
                <StyledSelect value={dbTable} onChange={(e) => setDbTable(e.target.value)}>
                  <option value="" disabled>Selecciona una tabla…</option>
                  {DB_TABLES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </StyledSelect>
              </FieldBlock>

              <FieldBlock style={{ minWidth: 120 }}>
                <label>Últimos</label>
                <StyledSelect value={dbLimit} onChange={(e) => setDbLimit(Number(e.target.value))} disabled={!dbTable}>
                  {LIMIT_OPTIONS.map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </StyledSelect>
              </FieldBlock>

              <RightInfo>
                {dbTable === '' ? 'Elige una tabla para ver datos.' : dbLoading ? 'Cargando…' : ''}
              </RightInfo>
            </DbFilters>

            <DbTableWrap>
              <StyledTable>
                <thead>
                  <tr>
                    {dbRows.length > 0
                      ? Object.keys(dbRows[0]).map((k) => <th key={k}>{k}</th>)
                      : <th style={{ textAlign: 'left' }}>Sin datos</th>}
                  </tr>
                </thead>
                <tbody>
                  {dbRows.map((row, idx) => (
                    <tr key={idx}>
                      {Object.keys(dbRows[0] || {}).map((k) => {
                        const hide = isHiddenDbCell(dbTable, k);
                        const raw = row[k];
                        const text = raw == null ? '' : String(raw);
                        const shown = hide ? '' : text.slice(0, 120) + (text.length > 120 ? '…' : '');
                        const title = hide ? '' : raw == null ? '' : text;
                        return (
                          <td key={k} title={title}>
                            {shown === '' ? '' : shown}
                            {shown === '' && raw == null ? '—' : ''}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </StyledTable>

              {dbError && (
                <div style={{ padding: 12 }}>
                  <StyledError>{dbError}</StyledError>
                </div>
              )}
            </DbTableWrap>
          </DbLayout>

          <FloatingBtn
            type="button"
            onClick={() =>
              document.getElementById('dbFilters')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
            }
          >
            Filtros
          </FloatingBtn>
        </div>
      )}
    </StyledContainer>
  );
};

export default DashboardAdmin;
