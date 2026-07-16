// ADR-051 Fase 4d: landing tras hosted checkout NOWPayments -> cancel.
// El usuario aborto el pago desde el hosted checkout del vendor.
// Mensaje breve + CTA para volver al dashboard segun rol.

import React, { useCallback } from 'react';
import { useHistory } from 'react-router-dom';
import i18n from '../i18n';
import { useSession } from '../components/SessionProvider';
import {
  Container, Card, Title, Paragraph,
  ButtonPrimary
} from '../styles/public-styles/ForgotResetPassStyles';

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
    <Container>
      <Card>
        <Title>{t('checkout.cancel.title')}</Title>
        <Paragraph>{t('checkout.cancel.message')}</Paragraph>
        <ButtonPrimary type="button" onClick={goToDashboard}>
          {t('checkout.cancel.retry')}
        </ButtonPrimary>
      </Card>
    </Container>
  );
};

export default CheckoutCancelPage;
