// src/components/CookieBanner.jsx
import React, { useEffect, useState } from 'react';
import { CookieBar, CookieText, CookieActions, CookieBtnPrimary, CookieBtnSecondary, CookieLinkPlain
} from '../styles/public-styles/HomeStyles';

const CookieBanner = () => {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
      try
      {
          const consent = localStorage.getItem('smc_cookie_consent');
          if (!consent) setVisible(true);
      } catch { setVisible(true); } }, []);
  const handleAccept = () => {
      try {
          localStorage.setItem('smc_cookie_consent', 'accepted');
      } catch {} setVisible(false); };
  const handleConfigure = () => {
      try {
          localStorage.setItem('smc_cookie_consent', 'configured');
      } catch {} setVisible(false); };
  const handleReject = () => {
      try {
          localStorage.setItem('smc_cookie_consent', 'rejected');
      } catch {} setVisible(false); };
  if (!visible)
  return null;
  return (
      <CookieBar>
          <CookieText>Al hacer clic en <strong>“Aceptar todas las cookies”</strong>, usted acepta que las cookies se guarden en su dispositivo para mejorar la navegación del sitio, analizar el uso del mismo y colaborar con nuestros estudios para marketing. Para más información, consulta nuestra <a href="/cookies">Política de cookies</a>.</CookieText>
          <CookieActions>
              <CookieBtnSecondary type="button" onClick={handleConfigure}>Configuración de cookies</CookieBtnSecondary>
              <CookieBtnPrimary type="button" onClick={handleAccept}>Aceptar todas las cookies</CookieBtnPrimary>
              <CookieLinkPlain type="button" onClick={handleReject}>Continuar sin aceptar</CookieLinkPlain>
          </CookieActions>
      </CookieBar>);
};

export default CookieBanner;
