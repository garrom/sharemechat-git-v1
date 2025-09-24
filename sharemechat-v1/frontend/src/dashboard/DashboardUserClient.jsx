import React, { useState, useEffect } from 'react';
import { useHistory } from 'react-router-dom';
import {
  StyledContainer,
  StyledNavbar,
  StyledNavButton,
  StyledIconWrapper,
  StyledMainContent,
  StyledLeftColumn,
  StyledCenter,
  StyledRightColumn,
  StyledActionButton,
} from '../styles/ClientStyles';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSignOutAlt, faUser } from '@fortawesome/free-solid-svg-icons';

const DashboardUserClient = () => {
  const history = useHistory();
  const [userName, setUserName] = useState('Usuario');
  const [amount, setAmount] = useState('10.00'); // importe por defecto
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const token = localStorage.getItem('token');

  useEffect(() => {
    if (!token) {
      history.push('/');
      return;
    }
    // Cargar datos del usuario
    (async () => {
      try {
        const res = await fetch('/api/users/me', {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res.status === 401) {
          localStorage.removeItem('token');
          history.push('/');
          return;
        }
        if (res.ok) {
          const data = await res.json();
          // PRIORIDAD AL NICKNAME
          setUserName(data.nickname || data.name || data.email || 'Usuario');
        }
      } catch {}
    })();
  }, [token, history]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    history.push('/');
  };

  const handleProfile = () => {
    history.push('/perfil-client'); // o la ruta que uses para el perfil
  };

  const handleFirstPayment = async () => {
    setErr('');
    setMsg('');
    if (!amount || Number(amount) <= 0) {
      setErr('Introduce un importe válido (> 0)');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/transactions/first', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          amount: Number(amount),
          operationType: 'INGRESO',
          description: 'Primer pago para activar cuenta premium',
        }),
      });
      const txt = await res.text();
      if (!res.ok) {
        throw new Error(txt || 'Error al procesar el pago');
      }
      setMsg('Pago realizado. Ya eres CLIENT.');
      // Opcional: redirigir al dashboard definitivo de cliente
      setTimeout(() => history.push('/client'), 800);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <StyledContainer>
      <StyledNavbar>
        <span>Mi Logo</span>
        <div>
          <span className="me-3">Hola, {userName}</span>
          <StyledNavButton onClick={handleLogout}>
            <FontAwesomeIcon icon={faSignOutAlt} />
            <StyledIconWrapper>Salir</StyledIconWrapper>
          </StyledNavButton>

        </div>
      </StyledNavbar>

      <StyledMainContent>
        <StyledLeftColumn />
        <StyledCenter>
          <h3>Activa tu cuenta Premium</h3>
          <p style={{ marginTop: 8, opacity: 0.8 }}>
            Realiza tu primer pago para convertirte en <strong>CLIENT</strong> y empezar a usar todas las funciones.
          </p>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 16 }}>
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              style={{ padding: 8, borderRadius: 6, border: '1px solid #ccc', width: 140 }}
              placeholder="Importe"
            />
            <StyledActionButton onClick={handleFirstPayment} disabled={loading}>
              {loading ? 'Procesando…' : 'Hacerme Premium / Pagar'}
            </StyledActionButton>
          </div>

          {msg && <p style={{ color: 'green', marginTop: 12 }}>{msg}</p>}
          {err && <p style={{ color: 'red', marginTop: 12 }}>{err}</p>}
        </StyledCenter>
        <StyledRightColumn />
      </StyledMainContent>
    </StyledContainer>
  );
};

export default DashboardUserClient;
