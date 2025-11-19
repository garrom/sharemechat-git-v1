//DashboardUserClient.jsx
import React, { useState, useEffect } from 'react';
import { useHistory } from 'react-router-dom';
import {
  Shell, Navbar, NavbarRight, LogoutBtn,
  Main, Card, Row, Input, PrimaryBtn,StyledBrand,
  Muted, OkMsg, ErrMsg
} from '../../styles/pages-styles/DashboardUserCliModStyles';
import { useAppModals } from '../../components/useAppModals';

const DashboardUserClient = () => {
  const history = useHistory();
  const [userName, setUserName] = useState('Usuario');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const token = localStorage.getItem('token');
  const { alert, openPurchaseModal } = useAppModals();

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
    setErr('');
    setMsg('');

    const tokenLS = localStorage.getItem('token');
    if (!tokenLS) {
      await alert({
        title: 'Sesión expirada',
        message: 'Inicia sesión de nuevo para completar el pago.',
        variant: 'warning',
        size: 'sm',
      });
      history.push('/');
      return;
    }

    // 1) Abrimos el modal de packs (mismo que en DashboardClient)
    const result = await openPurchaseModal({
      context: 'manual', // texto genérico "Añadir minutos"
    });

    // Usuario cierra o cancela el modal
    if (!result.confirmed || !result.pack) return;

    const { pack } = result;
    const amount = Number(pack.price);

    setLoading(true);
    try {
      const res = await fetch('/api/transactions/first', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenLS}`,
        },
        body: JSON.stringify({
          amount,
          operationType: 'INGRESO',
          description: `Primer pago (${pack.minutes} minutos) para activar cuenta premium`,
        }),
      });

      const txt = await res.text();
      if (!res.ok) throw new Error(txt || 'Error al procesar el pago');

      setMsg('Pago realizado. Ya eres CLIENT.');

      await alert({
        title: 'Pago realizado',
        message: `Se ha procesado el pack de ${pack.minutes} minutos. Tu cuenta ya está activada como CLIENT.`,
        variant: 'success',
        size: 'sm',
      });

      setTimeout(() => history.push('/client'), 800);
    } catch (e) {
      const msgErr = e.message || 'Error al procesar el pago.';
      setErr(msgErr);
      await alert({
        title: 'Error',
        message: msgErr,
        variant: 'danger',
        size: 'sm',
      });
    } finally {
      setLoading(false);
    }
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
            <PrimaryBtn onClick={handleFirstPayment} disabled={loading}>
              {loading ? 'Procesando…' : 'Elegir pack y hacerme Premium'}
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
