import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useHistory } from 'react-router-dom';
import {
  StyledContainer,
  StyledTable,
  StyledButton,
  StyledLinkButton,
  StyledError,
  StyledSelect,
} from '../styles/AdminStyles';
import Roles from '../constants/Roles';

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

  // ---- Revisión de documentos (nuevo)
  const [docsByUser, setDocsByUser] = useState({});     // { [userId]: { urlVerificFront, urlVerificBack, urlVerificDoc } }
  const [checksByUser, setChecksByUser] = useState({}); // { [userId]: { frontOk, backOk, selfieOk } }
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
    'model_review_checklist'
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
      // revert
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
    // Si quisieras exigir solo checks (aunque falte doc): return !!c.frontOk && !!c.backOk && !!c.selfieOk;
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

  // Cargar docs/checks para cada modelo PENDING visible (una vez tengamos users)
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

  // Dentro de DashboardAdmin.jsx
  const handleReview = async (userId, action) => {
    // Confirmación específica para RECHAZAR
    if (action === 'REJECT') {
      const ok = window.confirm(
        '¿Quiere realmente rechazar la verificación de la modelo?\nEsta acción es permanente.'
      );
      if (!ok) return; // el admin canceló
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

  // ---------- Ocultación de campos largos/sensibles en la vista BBDD ----------
  const isHiddenDbCell = (tableName, colName) => {
    const t = String(tableName || '').toLowerCase();
    const k = String(colName || '').toLowerCase();
    if (t === 'users' && (k === 'biography' || k === 'interests')) return true;
    if (t === 'messages' && k === 'body') return true;
    return false;
  };
  // ---------------------------------------------------------------------------

  return (
    <StyledContainer>
      {/* Header + Logout */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2>
          Hola, {userData.name} (Rol: {Roles.ADMIN})
        </h2>
        <StyledLinkButton onClick={handleLogout}>Salir</StyledLinkButton>
      </div>

      {/* Navbar simple de secciones */}
      <div
        style={{
          display: 'flex',
          gap: 8,
          marginBottom: 20,
          borderBottom: '1px solid #e5e5e5',
          paddingBottom: 8,
        }}
      >
        <StyledButton
          onClick={() => setActiveTab('models')}
          style={{ backgroundColor: activeTab === 'models' ? '#007bff' : '#6c757d' }}
        >
          Gestión Modelos
        </StyledButton>
        <StyledButton
          onClick={() => setActiveTab('stats')}
          style={{ backgroundColor: activeTab === 'stats' ? '#007bff' : '#6c757d' }}
        >
          Estadisticas
        </StyledButton>
        <StyledButton
          onClick={() => setActiveTab('finance')}
          style={{ backgroundColor: activeTab === 'finance' ? '#007bff' : '#6c757d' }}
        >
          Analisis Financiero
        </StyledButton>
        <StyledButton
          onClick={() => setActiveTab('db')}
          style={{ backgroundColor: activeTab === 'db' ? '#007bff' : '#6c757d' }}
        >
          Vista BBDD
        </StyledButton>
      </div>

      {/* PESTAÑA GESTION MODELOS */}
      {activeTab === 'models' && (
        <>
          <h3>Gestión de Modelos</h3>

          <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>Estado</label>
              <StyledSelect value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="ALL">Todos</option>
                <option value="PENDING">Pendiente</option>
                <option value="APPROVED">Aprobado</option>
                <option value="REJECTED">Rechazado</option>
              </StyledSelect>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>Resultados</label>
              <StyledSelect value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))}>
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={30}>30</option>
                <option value={40}>40</option>
                <option value={50}>50</option>
              </StyledSelect>
            </div>

            <div style={{ marginLeft: 'auto' }}>
              <StyledButton onClick={fetchUsers} disabled={loading}>
                {loading ? 'Actualizando...' : 'Refrescar'}
              </StyledButton>
            </div>
          </div>

          {loading && <div>Cargando...</div>}
          {error && <StyledError>{error}</StyledError>}

          <div style={{ maxHeight: 480, overflowY: 'auto', border: '1px solid #eee', borderRadius: 6 }}>
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
                        <a
                          href={url || '#'}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => {
                            if (!url) e.preventDefault();
                          }}
                          style={{
                            pointerEvents: url ? 'auto' : 'none',
                            opacity: url ? 1 : 0.5,
                            border: '1px solid #ced4da',
                            padding: '6px 8px',
                            borderRadius: 6,
                            textDecoration: 'none',
                            color: '#0d6efd',
                          }}
                          title={url ? 'Abrir documento' : 'No disponible'}
                        >
                          {label}
                        </a>
                        <input
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
                            {/* Descargas + checks */}
                            <div
                              style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(3, minmax(160px, 1fr))',
                                gap: 8,
                                marginBottom: 8,
                              }}
                            >
                              {mkBtn('Frontal', docUrls.urlVerificFront, 'frontOk')}
                              {mkBtn('Trasera', docUrls.urlVerificBack, 'backOk')}
                              {mkBtn('Selfie/PDF', docUrls.urlVerificDoc, 'selfieOk')}
                            </div>

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
          </div>
        </>
      )}

      {/* PESTAÑA ESTADISTICA */}
      {activeTab === 'stats' && (
        <div style={{ marginTop: 24 }}>
          <h3>Estadísticas</h3>
          {statsError && <StyledError>{statsError}</StyledError>}

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
              gap: 12,
              marginTop: 12,
            }}
          >
            <div style={{ border: '1px solid #eee', borderRadius: 10, padding: 16, background: '#fff' }}>
              <div style={{ fontSize: 12, color: '#6c757d' }}>Modelos en cola</div>
              <div style={{ fontSize: 28, fontWeight: 700 }}>{waitingModelsCount ?? '—'}</div>
              <div style={{ fontSize: 12, color: '#6c757d', marginTop: 6 }}>
                {statsUpdatedAt ? `Actualizado: ${statsUpdatedAt.toLocaleTimeString()}` : 'Actualizando…'}
              </div>
            </div>

            <div style={{ border: '1px solid #eee', borderRadius: 10, padding: 16, background: '#fff' }}>
              <div style={{ fontSize: 12, color: '#6c757d' }}>Modelos en streaming</div>
              <div style={{ fontSize: 28, fontWeight: 700 }}>{modelsStreamingCount ?? '—'}</div>
              <div style={{ fontSize: 12, color: '#6c757d', marginTop: 6 }}>
                {statsUpdatedAt ? `Actualizado: ${statsUpdatedAt.toLocaleTimeString()}` : 'Actualizando…'}
              </div>
            </div>

            <div style={{ border: '1px solid #eee', borderRadius: 10, padding: 16, background: '#fff' }}>
              <div style={{ fontSize: 12, color: '#6c757d' }}>Clientes en streaming</div>
              <div style={{ fontSize: 28, fontWeight: 700 }}>{clientsStreamingCount ?? '—'}</div>
              <div style={{ fontSize: 12, color: '#6c757d', marginTop: 6 }}>
                {statsUpdatedAt ? `Actualizado: ${statsUpdatedAt.toLocaleTimeString()}` : 'Actualizando…'}
              </div>
            </div>

            <div
              style={{
                border: '1px solid #f4f4f4',
                borderRadius: 10,
                padding: 16,
                background: '#fafafa',
                color: '#bbb',
              }}
            >
              <div style={{ fontSize: 12 }}>KPI futura</div>
              <div style={{ fontSize: 20, marginTop: 8 }}>—</div>
            </div>

            <div
              style={{
                border: '1px solid #f4f4f4',
                borderRadius: 10,
                padding: 16,
                background: '#fafafa',
                color: '#bbb',
              }}
            >
              <div style={{ fontSize: 12 }}>KPI futura</div>
              <div style={{ fontSize: 20, marginTop: 8 }}>—</div>
            </div>
          </div>
        </div>
      )}

      {/* PESTAÑA ANALISIS FINANCIERO */}
      {activeTab === 'finance' && (
        <div style={{ marginTop: 24 }}>
          <h3>Análisis financieros</h3>
          {financeError && <StyledError>{financeError}</StyledError>}

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
              gap: 12,
              marginTop: 12,
            }}
          >
            <div style={{ border: '1px solid #eee', borderRadius: 10, padding: 16, background: '#fff' }}>
              <div style={{ fontSize: 12, color: '#6c757d' }}>Ganancias brutas (facturación total)</div>
              <div style={{ fontSize: 28, fontWeight: 700 }}>
                {financeLoading ? '…' : financeSummary?.grossBillingEUR ?? '—'}
              </div>
              <div style={{ fontSize: 12, color: '#6c757d', marginTop: 6 }}>Sin descontar participación de modelos.</div>
            </div>

            <div style={{ border: '1px solid #eee', borderRadius: 10, padding: 16, background: '#fff' }}>
              <div style={{ fontSize: 12, color: '#6c757d' }}>Ganancias netas (plataforma)</div>
              <div style={{ fontSize: 28, fontWeight: 700 }}>
                {financeLoading ? '…' : financeSummary?.netProfitEUR ?? '—'}
              </div>
              <div style={{ fontSize: 12, color: '#6c757d', marginTop: 6 }}>Descontado lo que se lleva la modelo.</div>
            </div>

            <div style={{ border: '1px solid #eee', borderRadius: 10, padding: 16, background: '#fff' }}>
              <div style={{ fontSize: 12, color: '#6c757d' }}>% beneficio / facturación</div>
              <div style={{ fontSize: 28, fontWeight: 700 }}>
                {financeLoading ? '…' : financeSummary?.profitPercent ?? '—'}
              </div>
              <div style={{ fontSize: 12, color: '#6c757d', marginTop: 6 }}>(neto / bruto) × 100</div>
            </div>

            <div style={{ border: '1px solid #eee', borderRadius: 10, padding: 16, background: '#fff' }}>
              <div style={{ fontSize: 12, color: '#6c757d' }}>Top 10 modelos por ingresos</div>
              <ol style={{ marginTop: 8, paddingLeft: 18 }}>
                {(financeLoading ? [] : topModels).map((it, i) => (
                  <li key={i} style={{ marginBottom: 6 }}>
                    {it.nickname || it.name || it.email || `Modelo #${it.modelId}`} —{' '}
                    <strong>{it.totalEarningsEUR}</strong>
                  </li>
                ))}
                {!financeLoading && topModels.length === 0 && <div>Sin datos.</div>}
              </ol>
            </div>

            <div style={{ border: '1px solid #eee', borderRadius: 10, padding: 16, background: '#fff' }}>
              <div style={{ fontSize: 12, color: '#6c757d' }}>Top 10 clientes por pagos</div>
              <ol style={{ marginTop: 8, paddingLeft: 18 }}>
                {(financeLoading ? [] : topClients).map((it, i) => (
                  <li key={i} style={{ marginBottom: 6 }}>
                    {it.nickname || it.name || it.email || `Cliente #${it.clientId}`} —{' '}
                    <strong>{it.totalPagosEUR}</strong>
                  </li>
                ))}
                {!financeLoading && topClients.length === 0 && <div>Sin datos.</div>}
              </ol>
            </div>

            <div style={{ border: '1px dashed #eee', borderRadius: 10, padding: 16, background: '#fafafa' }}>
              <div style={{ fontSize: 12, color: '#6c757d' }}>Nota</div>
              <div style={{ fontSize: 14, marginTop: 8 }}>
                Pendiente: Separar ganacia Sreaming y Regalos, Mostrar num usuarios modelo y cliente y num clientes y modelos
              </div>
            </div>

            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                style={{
                  border: '1px solid #f4f4f4',
                  borderRadius: 10,
                  padding: 16,
                  background: '#fafafa',
                  color: '#bbb',
                }}
              >
                <div style={{ fontSize: 12 }}>KPI futura</div>
                <div style={{ fontSize: 20, marginTop: 8 }}>—</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* PESTAÑA VISTA BBDD */}
      {activeTab === 'db' && (
        <div style={{ marginTop: 24 }}>
          <h3>Vista BBDD</h3>

          <div
            style={{
              display: 'grid',
              gridTemplateRows: 'auto 1fr',
              height: '75vh',
              minHeight: 480,
              overflow: 'visible',
            }}
          >
            <div
              id="dbFilters"
              style={{
                display: 'flex',
                gap: 12,
                alignItems: 'flex-end',
                padding: '8px 0',
                borderBottom: '1px solid #eee',
                background: '#fff',
                overflow: 'visible',
                zIndex: 1,
              }}
            >
              <div style={{ minWidth: 220 }}>
                <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>Tabla</label>
                <StyledSelect value={dbTable} onChange={(e) => setDbTable(e.target.value)}>
                  <option value="" disabled>
                    Selecciona una tabla…
                  </option>
                  {DB_TABLES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </StyledSelect>
              </div>

              <div style={{ minWidth: 120 }}>
                <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>Últimos</label>
                <StyledSelect value={dbLimit} onChange={(e) => setDbLimit(Number(e.target.value))} disabled={!dbTable}>
                  {LIMIT_OPTIONS.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </StyledSelect>
              </div>

              <div style={{ marginLeft: 'auto', fontSize: 12, color: '#6c757d' }}>
                {dbTable === '' ? 'Elige una tabla para ver datos.' : dbLoading ? 'Cargando…' : ''}
              </div>
            </div>

            <div
              style={{
                overflow: 'auto',
                border: '1px solid #eee',
                borderRadius: 6,
                marginTop: 8,
                position: 'relative',
                background: '#fff',
              }}
            >
              <StyledTable>
                <thead>
                  <tr>
                    {dbRows.length > 0 ? (
                      Object.keys(dbRows[0]).map((k) => <th key={k}>{k}</th>)
                    ) : (
                      <th style={{ textAlign: 'left' }}>Sin datos</th>
                    )}
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
            </div>
          </div>

          <button
            type="button"
            onClick={() =>
              document.getElementById('dbFilters')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
            }
            style={{
              position: 'fixed',
              right: 16,
              bottom: 16,
              zIndex: 9999,
              padding: '10px 14px',
              border: '1px solid #ddd',
              borderRadius: 8,
              background: '#fff',
              cursor: 'pointer',
            }}
          >
            Filtros
          </button>
        </div>
      )}
    </StyledContainer>
  );
};

export default DashboardAdmin;
