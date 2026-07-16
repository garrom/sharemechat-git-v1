// ADR-051 Fase 4c: landing tras hosted checkout NOWPayments -> success.
// El usuario vuelve aqui con ?orderId=<uuid>. El credit al saldo llega
// via webhook del vendor de forma asincrona; hacemos polling al backend
// hasta ver status=SUCCESS o timeout. Ownership guardado por el backend
// (solo el dueno de la sesion puede leerla).

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useHistory, useLocation } from 'react-router-dom';
import i18n from '../i18n';
import { useSession } from '../components/SessionProvider';
import { getSessionStatus } from '../api/billingApi';
import {
  Container, Card, Title, Paragraph,
  StatusOk, StatusErr, ButtonPrimary
} from '../styles/public-styles/ForgotResetPassStyles';

const POLL_INTERVAL_MS = 3000;
const MAX_ATTEMPTS = 10; // 10 * 3s = 30s

const CheckoutSuccessPage = () => {
  const t = useCallback((key, options) => i18n.t(key, options), []);
  const history = useHistory();
  const location = useLocation();
  const { user, refresh: refreshSession } = useSession();

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

    const tick = async () => {
      if (stopRef.current) return;
      attemptsRef.current += 1;
      try {
        const data = await getSessionStatus(orderId);
        setSession(data);
        if (data.status === 'SUCCESS') {
          stopRef.current = true;
          setPhase('success');
          try { await refreshSession?.(); } catch { /* noop */ }
          return;
        }
        if (data.status === 'FAILED') {
          stopRef.current = true;
          setPhase('failed');
          return;
        }
        if (data.status === 'EXPIRED') {
          stopRef.current = true;
          setPhase('expired');
          return;
        }
      } catch (e) {
        if (e?.status === 404) {
          stopRef.current = true;
          setPhase('notFound');
          return;
        }
      }
      if (attemptsRef.current >= MAX_ATTEMPTS) {
        stopRef.current = true;
        setPhase('timeout');
        return;
      }
      setTimeout(tick, POLL_INTERVAL_MS);
    };

    tick();

    return () => {
      stopRef.current = true;
    };
  }, [orderId, refreshSession]);

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
        <Title>{t('checkout.success.title')}</Title>

        {phase === 'verifying' && (
          <>
            <Paragraph>{t('checkout.success.verifying')}</Paragraph>
            <Paragraph style={{ fontSize: 13, opacity: 0.75 }}>
              {t('checkout.success.verifyingHint')}
            </Paragraph>
          </>
        )}

        {phase === 'success' && (
          <>
            <StatusOk role="status">
              {t('checkout.success.confirmed', {
                minutes: session?.packId === 'P10' ? 10 : session?.packId === 'P20' ? 22 : session?.packId === 'P40' ? 44 : '',
              })}
            </StatusOk>
            <ButtonPrimary type="button" onClick={goToDashboard}>
              {t('checkout.success.backToAccount')}
            </ButtonPrimary>
          </>
        )}

        {phase === 'failed' && (
          <>
            <StatusErr role="alert">{t('checkout.success.failed')}</StatusErr>
            <ButtonPrimary type="button" onClick={goToDashboard}>
              {t('checkout.success.backToAccount')}
            </ButtonPrimary>
          </>
        )}

        {phase === 'expired' && (
          <>
            <StatusErr role="alert">{t('checkout.success.expired')}</StatusErr>
            <ButtonPrimary type="button" onClick={goToDashboard}>
              {t('checkout.success.backToAccount')}
            </ButtonPrimary>
          </>
        )}

        {phase === 'timeout' && (
          <>
            <Paragraph>{t('checkout.success.timeout')}</Paragraph>
            <ButtonPrimary type="button" onClick={goToDashboard}>
              {t('checkout.success.backToAccount')}
            </ButtonPrimary>
          </>
        )}

        {phase === 'notFound' && (
          <>
            <StatusErr role="alert">{t('checkout.success.notFound')}</StatusErr>
            <ButtonPrimary type="button" onClick={goToDashboard}>
              {t('checkout.success.backToAccount')}
            </ButtonPrimary>
          </>
        )}
      </Card>
    </Container>
  );
};

export default CheckoutSuccessPage;
