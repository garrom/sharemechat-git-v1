import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useHistory } from 'react-router-dom';
import {
  StyledContainer,
  StyledTable,
  StyledButton,
  StyledLinkButton,
  StyledError,
  StyledSelect,
} from '../styles/DashboardAdminStyles';
import Roles from '../constants/Roles';

const DashboardAdmin = () => {
  const [userData] = useState({ name: 'Administrador' });
  const [users, setUsers] = useState([]);
  const [statusFilter, setStatusFilter] = useState('ALL'); // ALL | PENDING | APPROVED | REJECTED
  const [pageSize, setPageSize] = useState(10); // 10,20,30,40,50
  const [activeTab, setActiveTab] = useState('models'); // models | users | finance | db
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [waitingModelsCount, setWaitingModelsCount] = useState(null);
  const [waitingClientsCount, setWaitingClientsCount] = useState(null);
  const [statsUpdatedAt, setStatsUpdatedAt] = useState(null);
  const [statsError, setStatsError] = useState('');
  const [modelsStreamingCount, setModelsStreamingCount] = useState(null);
  const [clientsStreamingCount, setClientsStreamingCount] = useState(null);


  const wsAdminRef = useRef(null);
  const pingAdminRef = useRef(null);
  const history = useHistory();
  const token = localStorage.getItem('token');

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
    if (activeTab !== 'stats') {
      // limpiar si salgo de la pestaña
      if (pingAdminRef.current) { clearInterval(pingAdminRef.current); pingAdminRef.current = null; }
      if (wsAdminRef.current) { try { wsAdminRef.current.close(); } catch {} wsAdminRef.current = null; }
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
        // refresco periódico: ping + stats
        pingAdminRef.current = setInterval(() => {
          if (wsAdminRef.current?.readyState === WebSocket.OPEN) {
            wsAdminRef.current.send(JSON.stringify({ type: 'ping' }));
            wsAdminRef.current.send(JSON.stringify({ type: 'stats' }));
          }
        }, 10000); // cada 10s
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
      ws.onclose  = () => {
        if (pingAdminRef.current) { clearInterval(pingAdminRef.current); pingAdminRef.current = null; }
      };
    } catch (e) {
      setStatsError(e.message || 'No se pudo abrir estadísticas.');
    }

    return () => {
      if (pingAdminRef.current) { clearInterval(pingAdminRef.current); pingAdminRef.current = null; }
      if (wsAdminRef.current) { try { wsAdminRef.current.close(); } catch {} wsAdminRef.current = null; }
    };
  }, [activeTab, token]);


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
    try {
      const response = await fetch(`/api/admin/review/${userId}?action=${action}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('Error al actualizar verificación');
      const message = await response.text();
      alert(message || 'Estado actualizado');
      fetchUsers(); // refresco
    } catch (err) {
      setError(err.message || 'Error actualizando estado');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    history.push('/');
  };

  // Filtro por estado en cliente
  const filteredUsers = useMemo(() => {
    if (statusFilter === 'ALL') return users;
    return users.filter(u => (u.verificationStatus || 'PENDING') === statusFilter);
  }, [users, statusFilter]);

  // Limitar Nº de resultados mostrados
  const displayedUsers = useMemo(
    () => filteredUsers.slice(0, Number(pageSize)),
    [filteredUsers, pageSize]
  );

  return (
    <StyledContainer>
      {/* Header + Logout */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2>Hola, {userData.name} (Rol: {Roles.ADMIN})</h2>
        <StyledLinkButton onClick={handleLogout}>Salir</StyledLinkButton>
      </div>

      {/* Navbar simple de secciones */}
      <div style={{
        display: 'flex',
        gap: 8,
        marginBottom: 20,
        borderBottom: '1px solid #e5e5e5',
        paddingBottom: 8
      }}>
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
          Gestión Financiera
        </StyledButton>
        <StyledButton
          onClick={() => setActiveTab('db')}
          style={{ backgroundColor: activeTab === 'db' ? '#007bff' : '#6c757d' }}
        >
          Gestión BBDD
        </StyledButton>
      </div>

       {/* PESTAÑA GESTION MODELOS */}

      {activeTab === 'models' && (
        <>
          <h3>Gestión de Modelos</h3>

          {/* Filtros sencillos */}
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>Estado</label>
              <StyledSelect
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="ALL">Todos</option>
                <option value="PENDING">Pendiente</option>
                <option value="APPROVED">Aprobado</option>
                <option value="REJECTED">Rechazado</option>
              </StyledSelect>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>Resultados</label>
              <StyledSelect
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
              >
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

          {/* Contenedor con scroll para la tabla */}
          <div style={{ maxHeight: 480, overflowY: 'auto', border: '1px solid #eee', borderRadius: 6 }}>
            <StyledTable>
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Rol</th>
                  <th>Tipo</th>
                  <th>Estado de Verificación</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {/* 🔧 Usar displayedUsers en vez de users */}
                {displayedUsers.map((user) => {
                  const v = user.verificationStatus || 'PENDING';
                  return (
                    <tr key={user.id}>
                      <td>{user.email}</td>
                      <td>{user.role}</td>
                      <td>{user.userType}</td>
                      <td>{v}</td>
                      <td>
                        {v === 'PENDING' && (
                          <>
                            <StyledButton
                              style={{ backgroundColor: '#28a745', marginRight: '10px' }}
                              onClick={() => handleReview(user.id, 'APPROVE')}
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
                          <span style={{ color: '#dc3545', fontWeight: 'bold' }}>
                            Rechazada permanentemente
                          </span>
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
                gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                gap: 12,
                marginTop: 12,
              }}
            >
              {/* Card: Modelos en cola */}
              <div style={{ border: '1px solid #eee', borderRadius: 10, padding: 16, background: '#fff' }}>
                <div style={{ fontSize: 12, color: '#6c757d' }}>Modelos en cola</div>
                <div style={{ fontSize: 28, fontWeight: 700 }}>
                  {waitingModelsCount ?? '—'}
                </div>
                <div style={{ fontSize: 12, color: '#6c757d', marginTop: 6 }}>
                  {statsUpdatedAt ? `Actualizado: ${statsUpdatedAt.toLocaleTimeString()}` : 'Actualizando…'}
                </div>
              </div>

              {/* Modelos en streaming */}
              <div style={{ border: '1px solid #eee', borderRadius: 10, padding: 16, background: '#fff' }}>
                <div style={{ fontSize: 12, color: '#6c757d' }}>Modelos en streaming</div>
                <div style={{ fontSize: 28, fontWeight: 700 }}>
                  {modelsStreamingCount ?? '—'}
                </div>
                <div style={{ fontSize: 12, color: '#6c757d', marginTop: 6 }}>
                  {statsUpdatedAt ? `Actualizado: ${statsUpdatedAt.toLocaleTimeString()}` : 'Actualizando…'}
                </div>
              </div>

              {/* Clientes en streaming */}
              <div style={{ border: '1px solid #eee', borderRadius: 10, padding: 16, background: '#fff' }}>
                <div style={{ fontSize: 12, color: '#6c757d' }}>Clientes en streaming</div>
                <div style={{ fontSize: 28, fontWeight: 700 }}>
                  {clientsStreamingCount ?? '—'}
                </div>
                <div style={{ fontSize: 12, color: '#6c757d', marginTop: 6 }}>
                  {statsUpdatedAt ? `Actualizado: ${statsUpdatedAt.toLocaleTimeString()}` : 'Actualizando…'}
                </div>
              </div>

              {/* Cards vacías para futuras KPIs */}
              <div style={{ border: '1px solid #f4f4f4', borderRadius: 10, padding: 16, background: '#fafafa', color: '#bbb' }}>
                <div style={{ fontSize: 12 }}>KPI futura</div>
                <div style={{ fontSize: 20, marginTop: 8 }}>—</div>
              </div>

              <div style={{ border: '1px solid #f4f4f4', borderRadius: 10, padding: 16, background: '#fafafa', color: '#bbb' }}>
                <div style={{ fontSize: 12 }}>KPI futura</div>
                <div style={{ fontSize: 20, marginTop: 8 }}>—</div>
              </div>
            </div>
          </div>
        )}


      {activeTab === 'finance' && (
        <div style={{ marginTop: 24 }}>
          <h3>Gestión Financiera</h3>
          <p>Próximamente.</p>
        </div>
      )}

      {activeTab === 'db' && (
        <div style={{ marginTop: 24 }}>
          <h3>Gestión BBDD</h3>
          <p>Próximamente.</p>
        </div>
      )}
    </StyledContainer>
  );
};

export default DashboardAdmin;
