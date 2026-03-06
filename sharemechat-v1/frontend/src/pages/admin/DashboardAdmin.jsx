import React, { useEffect, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { apiFetch } from '../../config/http';
import Roles from '../../constants/Roles';
import {
  HeaderBar,
  LogoutButton,
  SectionTitle,
  StyledContainer,
} from '../../styles/AdminStyles';
import AdminActiveStreamsPanel from './AdminActiveStreamsPanel';
import AdminAuditPanel from './AdminAuditPanel';
import AdminDbPanel from './AdminDbPanel';
import AdminFinancePanel from './AdminFinancePanel';
import AdminModelsPanel from './AdminModelsPanel';
import AdminModerationPanel from './AdminModerationPanel';
import AdminStatsPanel from './AdminStatsPanel';
import AdminTabs from './AdminTabs';

const DashboardAdmin = () => {
  const [userData] = useState({ name: 'Administrador' });
  const [activeTab, setActiveTab] = useState('models');
  const history = useHistory();

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/users/me', {
          credentials: 'include',
        });

        if (res.status === 401) {
          history.push('/');
          return;
        }

        if (!res.ok) throw new Error();

        const data = await res.json();
        if (data.role !== Roles.ADMIN) {
          history.push('/');
        }
      } catch {
        history.push('/');
      }
    })();
  }, [history]);

  const handleLogout = async () => {
    try {
      await apiFetch('/auth/logout', { method: 'POST' });
    } catch {
      /* noop */
    }
    history.push('/');
  };

  return (
    <StyledContainer>
      <HeaderBar>
        <h2>Hola, {userData.name} (Rol: {Roles.ADMIN})</h2>
        <LogoutButton onClick={handleLogout} title="Cerrar sesión">Salir</LogoutButton>
      </HeaderBar>

      <AdminTabs activeTab={activeTab} setActiveTab={setActiveTab} />

      {activeTab === 'models' && <AdminModelsPanel />}
      {activeTab === 'stats' && <AdminStatsPanel />}
      {activeTab === 'finance' && <AdminFinancePanel />}
      {activeTab === 'db' && <AdminDbPanel />}
      {activeTab === 'audit' && <AdminAuditPanel />}
      {activeTab === 'moderation' && <AdminModerationPanel />}

      {activeTab === 'streams' && (
        <div>
          <SectionTitle>Streams activos</SectionTitle>
          <AdminActiveStreamsPanel />
        </div>
      )}
    </StyledContainer>
  );
};

export default DashboardAdmin;
