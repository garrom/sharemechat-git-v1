import React, { useEffect, useState } from 'react';
import i18n from '../i18n';
import {
  CookieBar,
  CookieText,
  CookieActions,
  CookieBtnPrimary,
  CookieBtnSecondary,
  CookieLinkPlain
} from '../styles/public-styles/HomeStyles';

const CookieBanner = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      const consent = localStorage.getItem('smc_cookie_consent');
      if (!consent) setVisible(true);
    } catch {
      setVisible(true);
    }
  }, []);

  const handleAccept = () => {
    try {
      localStorage.setItem('smc_cookie_consent', 'accepted');
    } catch {}
    setVisible(false);
  };

  const handleConfigure = () => {
    try {
      localStorage.setItem('smc_cookie_consent', 'configured');
    } catch {}
    setVisible(false);
  };

  const handleReject = () => {
    try {
      localStorage.setItem('smc_cookie_consent', 'rejected');
    } catch {}
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <CookieBar>
      <CookieText>
        {i18n.t('common.cookies.bannerText')}{' '}
        <a href="/cookies">Política de cookies</a>.
      </CookieText>
      <CookieActions>
        <CookieBtnSecondary type="button" onClick={handleConfigure}>
          {i18n.t('common.cookies.configure')}
        </CookieBtnSecondary>
        <CookieBtnPrimary type="button" onClick={handleAccept}>
          {i18n.t('common.cookies.acceptAll')}
        </CookieBtnPrimary>
        <CookieLinkPlain type="button" onClick={handleReject}>
          {i18n.t('common.cookies.continueWithoutAccepting')}
        </CookieLinkPlain>
      </CookieActions>
    </CookieBar>
  );
};

export default CookieBanner;