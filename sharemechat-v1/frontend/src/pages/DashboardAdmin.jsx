import React, { useState, useEffect } from 'react';
import { useHistory } from 'react-router-dom';
import {
  StyledContainer,
  StyledTable,
  StyledButton,
  StyledLinkButton,
  StyledError,
  StyledInput,
  StyledSelect,
} from '../styles/DashboardAdminStyles';
import Roles from '../constants/Roles';
import UserTypes from '../constants/UserTypes';

const DashboardAdmin = () => {
  const [userData, setUserData] = useState({ name: 'Administrador' });
  const [users, setUsers] = useState([]);
  const [filters, setFilters] = useState({ role: '', id: '', name: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const history = useHistory();
  const token = localStorage.getItem('token');

  useEffect(() => {
    if (!token) {
      history.push('/');
      return;
    }
    fetchUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, history]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/models', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('Error al cargar modelos');
      const data = await response.json();
      setUsers(data);
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
      fetchUsers();
    } catch (err) {
      setError(err.message || 'Error actualizando estado');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    history.push('/');
  };

  const handleFilterChange = (e) => {
    setFilters({ ...filters, [e.target.name]: e.target.value });
  };

  return (
    <StyledContainer>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2>Hola, {userData.name} (Rol: {Roles.ADMIN})</h2>
        <StyledLinkButton onClick={handleLogout}>Salir</StyledLinkButton>
      </div>

      <h3>Gestión de Modelos</h3>
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
        <StyledSelect name="role" value={filters.role} onChange={handleFilterChange}>
          <option value="">Todos los roles</option>
          <option value={Roles.USER}>USER</option>
          <option value={Roles.CLIENT}>CLIENT</option>
          <option value={Roles.MODEL}>MODEL</option>
          <option value={Roles.ADMIN}>ADMIN</option>
        </StyledSelect>
        <StyledInput
          type="number"
          name="id"
          value={filters.id}
          onChange={handleFilterChange}
          placeholder="ID"
        />
        <StyledInput
          type="text"
          name="name"
          value={filters.name}
          onChange={handleFilterChange}
          placeholder="Nombre"
        />
        <StyledButton disabled>Filtrar</StyledButton>
      </div>

      {loading && <div>Cargando...</div>}
      {error && <StyledError>{error}</StyledError>}

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
                <td>{user.userType}</td> {/* visual, no condiciona la lógica */}
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
                    <StyledButton
                      style={{ backgroundColor: '#ffc107' }}
                      onClick={() => handleReview(user.id, 'PENDING')}
                    >
                      Poner en Pendiente
                    </StyledButton>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </StyledTable>
    </StyledContainer>
  );
};

export default DashboardAdmin;
