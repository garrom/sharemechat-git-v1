// ADR-051 Fase 4d: landing tras hosted checkout NOWPayments -> cancel.
// El usuario aborto el pago desde el hosted checkout del vendor.
// Mensaje breve + CTA para volver al dashboard segun rol.
//
// Fase 4h fix: estilos inline explicitos (misma razon que
// CheckoutSuccessPage - los tokens de ForgotResetPassStyles no
// renderizaban visibles sobre el layout publico).

import React, { useCallback } from 'react';
import { useHistory } from 'react-router-dom';
import i18n from '../i18n';
import { useSession } from '../components/SessionProvider';

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
const pStyle = { margin: '0 0 20px', color: '#3a4152', lineHeight: 1.5 };
const btnStyle = {
  width: '100%', padding: '12px 16px', borderRadius: 8, border: 'none',
  background: '#2f81f7', color: '#ffffff', fontSize: 15, fontWeight: 600,
  cursor: 'pointer',
};

const CheckoutCancelPage = () => {
  const t = useCallback((key, options) => i18n.t(key, options), []);
  const history = useHistory();
  const { user } = useSession();

  const goToDashboard = useCallback(() => {
    const role = user?.role || '';
    if (role === 'CLIENT') history.push('/client');
    else if (role === 'MODEL') history.push('/model');
    else if (role === 'USER') history.push('/dashboard-user-client');
    else history.push('/');
  }, [history, user?.role]);

  return (
    <div style={wrapStyle}>
      <div style={cardStyle}>
        <h2 style={titleStyle}>{t('checkout.cancel.title')}</h2>
        <p style={pStyle}>{t('checkout.cancel.message')}</p>
        <button type="button" style={btnStyle} onClick={goToDashboard}>
          {t('checkout.cancel.retry')}
        </button>
      </div>
    </div>
  );
};

export default CheckoutCancelPage;
