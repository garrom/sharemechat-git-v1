import React, { useState, useEffect } from 'react';
import { useHistory } from 'react-router-dom';
import {
  Shell, Navbar, NavbarRight, LogoutBtn,
  Main, Card, Row, Input, PrimaryBtn,StyledBrand,
  Muted, OkMsg, ErrMsg
} from '../styles/DashboardUserCliModStyles';

const DashboardUserClient = () => {
  const history = useHistory();
  const [userName, setUserName] = useState('Usuario');
  const [amount, setAmount] = useState('10.00');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const token = localStorage.getItem('token');

  useEffect(() => {
    if (!token) { history.push('/'); return; }
    (async () => {
      try {
        const res = await fetch('/api/users/me', { headers: { Authorization: `Bearer ${token}` } });
        if (res.status === 401) { localStorage.removeItem('token'); history.push('/'); return; }
        if (res.ok) {
          const data = await res.json();
          setUserName(data.nickname || data.name || data.email || 'Usuario');
        }
      } catch {}
    })();
  }, [token, history]);

  const handleLogout = () => { localStorage.removeItem('token'); history.push('/'); };

  const handleFirstPayment = async () => {
    setErr(''); setMsg('');
    if (!amount || Number(amount) <= 0) { setErr('Introduce un importe válido (> 0)'); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/transactions/first', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          amount: Number(amount),
          operationType: 'INGRESO',
          description: 'Primer pago para activar cuenta premium',
        }),
      });
      const txt = await res.text();
      if (!res.ok) throw new Error(txt || 'Error al procesar el pago');
      setMsg('Pago realizado. Ya eres CLIENT.');
      setTimeout(() => history.push('/client'), 800);
    } catch (e) {
      setErr(e.message);
    } finally { setLoading(false); }
  };

  return (
    <Shell>
      <Navbar $variant="client">
        <StyledBrand href="/" aria-label="SharemeChat" />
        <NavbarRight>
          <span>Hola, {userName}</span>
          <LogoutBtn onClick={handleLogout} title="Cerrar sesión">Salir</LogoutBtn>
        </NavbarRight>
      </Navbar>

      <Main>
        <Card>
          <h3>Activa tu cuenta Premium</h3>
          <Muted>Realiza tu primer pago para convertirte en <strong>CLIENT</strong> y empezar a usar todas las funciones.</Muted>

          <Row style={{ marginTop: 16 }}>
            <Input
              type="number"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Importe"
              aria-label="Importe"
            />
            <PrimaryBtn onClick={handleFirstPayment} disabled={loading}>
              {loading ? 'Procesando…' : 'Hacerme Premium / Pagar'}
            </PrimaryBtn>
          </Row>

          {msg && <OkMsg>{msg}</OkMsg>}
          {err && <ErrMsg>{err}</ErrMsg>}
        </Card>
      </Main>
    </Shell>
  );
};

export default DashboardUserClient;
