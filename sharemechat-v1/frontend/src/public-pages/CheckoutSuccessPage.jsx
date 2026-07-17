// ADR-051 Fase 4c: landing tras hosted checkout NOWPayments -> success.
// El usuario vuelve aqui con ?orderId=<uuid>. El credit al saldo llega
// via webhook del vendor de forma asincrona; hacemos polling al backend
// hasta ver status=SUCCESS o timeout. Ownership guardado por el backend
// (solo el dueno de la sesion puede leerla).
//
// Fase 4h fix: estilos inline explicitos (fondo blanco garantizado)
// tras detectar en test end-to-end que ForgotResetPassStyles renderizaba
// invisible sobre el layout publico del checkout.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useHistory, useLocation } from 'react-router-dom';
import i18n from '../i18n';
import { useSession } from '../components/SessionProvider';
import { getSessionStatus } from '../api/billingApi';

const POLL_INTERVAL_MS = 3000;
const MAX_ATTEMPTS = 10; // 10 * 3s = 30s

const wrapStyle = {
  minHeight: '80vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '32px 16px',
  background: '#f5f6f8',
};
const cardStyle = {
  width: '100%',
  maxWidth: 480,
  background: '#ffffff',
  border: '1px solid #e1e4e8',
  borderRadius: 12,
  boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
  padding: 32,
  color: '#1a1f2e',
  textAlign: 'center',
};
const titleStyle = { margin: '0 0 16px', fontSize: 22, fontWeight: 600, color: '#1a1f2e' };
const pStyle = { margin: '0 0 12px', color: '#3a4152', lineHeight: 1.5 };
const hintStyle = { fontSize: 13, color: '#6b7280', margin: '0 0 20px' };
const okBoxStyle = {
  padding: '14px 16px', borderRadius: 8, background: '#e6f4ea',
  color: '#137333', border: '1px solid #b7e0c1', marginBottom: 16, fontWeight: 500,
};
const errBoxStyle = {
  padding: '14px 16px', borderRadius: 8, background: '#fde7e9',
  color: '#b3261e', border: '1px solid #f5c2c7', marginBottom: 16, fontWeight: 500,
};
const btnStyle = {
  width: '100%', padding: '12px 16px', borderRadius: 8, border: 'none',
  background: '#2f81f7', color: '#ffffff', fontSize: 15, fontWeight: 600,
  cursor: 'pointer', marginTop: 8,
};
const spinnerStyle = {
  width: 40, height: 40, borderRadius: '50%',
  border: '3px solid #e1e4e8', borderTopColor: '#2f81f7',
  margin: '8px auto 20px', animation: 'checkout-spin 0.9s linear infinite',
};

const CheckoutSuccessPage = () => {
  const t = useCallback((key, options) => i18n.t(key, options), []);
  const history = useHistory();
  const location = useLocation();
  const { user } = useSession();

  const orderId = useMemo(
    () => new URLSearchParams(location.search).get('orderId') || '',
    [location.search]
  );

  const [phase, setPhase] = useState('verifying'); // verifying | success | failed | expired | timeout | notFound
  const [session, setSession] = useState(null);
  const attemptsRef = useRef(0);
  const stopRef = useRef(false);

  useEffect(() => {
    if (!orderId) {
      setPhase('notFound');
      return () => {};
    }

    stopRef.current = false;
    attemptsRef.current = 0;
    let timerId = null;

    const tick = async () => {
      if (stopRef.current) return;
      attemptsRef.current += 1;
      try {
        const data = await getSessionStatus(orderId);
        if (stopRef.current) return;
        setSession(data);
        if (data.status === 'SUCCESS') { stopRef.current = true; setPhase('success'); return; }
        if (data.status === 'FAILED')  { stopRef.current = true; setPhase('failed');  return; }
        if (data.status === 'EXPIRED') { stopRef.current = true; setPhase('expired'); return; }
      } catch (e) {
        if (e?.status === 404) { stopRef.current = true; setPhase('notFound'); return; }
      }
      if (attemptsRef.current >= MAX_ATTEMPTS) { stopRef.current = true; setPhase('timeout'); return; }
      timerId = setTimeout(tick, POLL_INTERVAL_MS);
    };

    tick();

    return () => {
      stopRef.current = true;
      if (timerId) clearTimeout(timerId);
    };
  }, [orderId]);

  const goToDashboard = useCallback(() => {
    const role = user?.role || '';
    if (role === 'CLIENT') history.push('/client');
    else if (role === 'MODEL') history.push('/model');
    else if (role === 'USER') history.push('/dashboard-user-client');
    else history.push('/');
  }, [history, user?.role]);

  const packMinutes = session?.packId === 'P10' ? 10
    : session?.packId === 'P20' ? 22
    : session?.packId === 'P40' ? 44 : '';

  return (
    <div style={wrapStyle}>
      <style>{`@keyframes checkout-spin { to { transform: rotate(360deg); } }`}</style>
      <div style={cardStyle}>
        <h2 style={titleStyle}>{t('checkout.success.title')}</h2>

        {phase === 'verifying' && (
          <>
            <div style={spinnerStyle} />
            <p style={pStyle}>{t('checkout.success.verifying')}</p>
            <p style={hintStyle}>{t('checkout.success.verifyingHint')}</p>
          </>
        )}

        {phase === 'success' && (
          <>
            <div style={okBoxStyle} role="status">
              {t('checkout.success.confirmed', { minutes: packMinutes })}
            </div>
            <button type="button" style={btnStyle} onClick={goToDashboard}>
              {t('checkout.success.backToAccount')}
            </button>
          </>
        )}

        {phase === 'failed' && (
          <>
            <div style={errBoxStyle} role="alert">{t('checkout.success.failed')}</div>
            <button type="button" style={btnStyle} onClick={goToDashboard}>
              {t('checkout.success.backToAccount')}
            </button>
          </>
        )}

        {phase === 'expired' && (
          <>
            <div style={errBoxStyle} role="alert">{t('checkout.success.expired')}</div>
            <button type="button" style={btnStyle} onClick={goToDashboard}>
              {t('checkout.success.backToAccount')}
            </button>
          </>
        )}

        {phase === 'timeout' && (
          <>
            <p style={pStyle}>{t('checkout.success.timeout')}</p>
            <button type="button" style={btnStyle} onClick={goToDashboard}>
              {t('checkout.success.backToAccount')}
            </button>
          </>
        )}

        {phase === 'notFound' && (
          <>
            <div style={errBoxStyle} role="alert">{t('checkout.success.notFound')}</div>
            <button type="button" style={btnStyle} onClick={goToDashboard}>
              {t('checkout.success.backToAccount')}
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default CheckoutSuccessPage;
