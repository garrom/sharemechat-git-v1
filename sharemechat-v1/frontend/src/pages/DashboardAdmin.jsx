import React, { useState, useEffect, useMemo } from 'react';
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
import UserTypes from '../constants/UserTypes';

const DashboardAdmin = () => {
  const [userData] = useState({ name: 'Administrador' });
  const [users, setUsers] = useState([]);
  const [statusFilter, setStatusFilter] = useState('ALL'); // ALL | PENDING | APPROVED | REJECTED
  const [pageSize, setPageSize] = useState(10); // 10,20,30,40,50
  const [activeTab, setActiveTab] = useState('models'); // models | users | finance | db
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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

  const fetchUsers = async () => {
    setLoading(true);
    setError('');
    try {
      // Mantengo tu endpoint EXACTO (sin params). Filtro y limito en cliente.
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
      fetchUsers(); // refrescamos la lista
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
  const displayedUsers = useMemo(() => filteredUsers.slice(0, Number(pageSize)), [filteredUsers, pageSize]);

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
          onClick={() => setActiveTab('users')}
          style={{ backgroundColor: activeTab === 'users' ? '#007bff' : '#6c757d' }}
        >
          Gestión Usuarios
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

      {/* Contenido por pestaña */}
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
               {users.map((user) => {
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

                       {/* 🔒 Ya no mostramos "Poner en Pendiente" para REJECTED */}
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

      {activeTab === 'users' && (
        <div style={{ marginTop: 24 }}>
          <h3>Gestión de Usuarios</h3>
          <p>Próximamente.</p>
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
