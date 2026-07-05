// src/components/MaintenanceProvider.jsx
//
// Paquete 10.A.3.pre: red de seguridad SPA para ventanas de mantenimiento
// del backend. Se complementa con OriginGroup en CloudFront (primario:
// backend, secundario: bucket S3 con HTML de mantenimiento estatico). Si el
// backend devuelve 502/503/504 a una llamada /api/*, CloudFront enruta al
// origen secundario y la SPA recibe HTML donde esperaba JSON. Esta capa
// detecta ese patron (o el 5xx directo si CloudFront aun no ha conmutado)
// y muestra un overlay bloqueante; un poll cada 30s al backend desactiva
// el overlay cuando vuelve.
//
// Comunicacion interceptor (config/http.js) <-> React: CustomEvent
// 'sharemechat:maintenance' en window con detail.active. Mismo patron que
// SessionProvider con 'auth:logout'.
//
// El overlay es bilingue hardcoded (EN + ES). NO depende de i18n porque
// un fallo de bootstrap del backend puede coincidir con i18n no inicializado.

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState
} from 'react';
import styled, { keyframes } from 'styled-components';

const MaintenanceCtx = createContext({ active: false });

const HEALTH_PATH = '/api/users/me';
const POLL_INTERVAL_MS = 30000;
const HEALTH_FETCH_TIMEOUT_MS = 5000;

const EVENT_NAME = 'sharemechat:maintenance';

// Fix.F1 (2026-07-06, informe get-body-html-diagnosis): cerramos la deuda
// anterior — el helper viejo exigía Content-Type application/json exacto y
// leía como "caído" cualquier 401 con CT vacío (el backend responde 401 con
// content-length 0 y sin CT header), lo que dejaba el overlay pegado entre
// sesiones caducadas y renovadas.
//
// Regla positiva y simétrica a isMaintenanceResponse de http.js: el backend
// está VIVO si respondió cualquier cosa que NO sea 5xx. Un 200, 401, 403,
// 404 o similar es señal de que el origin API está atendiendo — aunque la
// respuesta concreta sea un rechazo de negocio o auth.
const isBackendAlive = (res) => {
  if (!res) return false;
  if (res.status >= 500 && res.status < 600) return false;
  return true;
};

const pingBackend = async () => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), HEALTH_FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(HEALTH_PATH, {
      method: 'GET',
      credentials: 'include',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
      cache: 'no-store'
    });
    return isBackendAlive(res);
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
};

export const MaintenanceProvider = ({ children }) => {
  const [active, setActive] = useState(false);
  const pollRef = useRef(null);

  const stopPoll = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const startPoll = useCallback(() => {
    stopPoll();
    pollRef.current = setInterval(async () => {
      const alive = await pingBackend();
      if (alive) {
        // El backend ha vuelto: cierra el overlay. Despachamos por el mismo
        // canal para mantener un unico punto de mutacion.
        window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: { active: false } }));
      }
    }, POLL_INTERVAL_MS);
  }, [stopPoll]);

  useEffect(() => {
    const handler = (ev) => {
      const next = !!(ev && ev.detail && ev.detail.active);
      setActive((prev) => {
        if (prev === next) return prev;
        if (next) {
          startPoll();
        } else {
          stopPoll();
        }
        return next;
      });
    };
    window.addEventListener(EVENT_NAME, handler);
    return () => {
      window.removeEventListener(EVENT_NAME, handler);
      stopPoll();
    };
  }, [startPoll, stopPoll]);

  return (
    <MaintenanceCtx.Provider value={{ active }}>
      {children}
      {active && <MaintenanceOverlay />}
    </MaintenanceCtx.Provider>
  );
};

export const useMaintenance = () => useContext(MaintenanceCtx);

// Helper para que el interceptor (no-React) dispare el flag global.
export const notifyMaintenance = (isActive) => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: { active: !!isActive } }));
};

// --------------------------------------------------------------
// Overlay (UI puro, bilingue hardcoded, sin i18n por robustez)
// --------------------------------------------------------------

const fadeIn = keyframes`
  from { opacity: 0; }
  to { opacity: 1; }
`;

const Backdrop = styled.div`
  position: fixed;
  inset: 0;
  z-index: 2147483000;
  background: #f6f6f6;
  color: #1c1c1c;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto,
               'Helvetica Neue', Arial, sans-serif;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  animation: ${fadeIn} 0.15s ease-out;
`;

const Card = styled.main`
  max-width: 560px;
  width: 100%;
  text-align: center;
`;

const Brand = styled.h1`
  font-size: clamp(2.2rem, 6vw, 3.4rem);
  font-weight: 800;
  letter-spacing: 0.18em;
  color: #111;
  margin: 0 0 48px;
  line-height: 1;

  &::after {
    content: '';
    display: block;
    width: 56px;
    height: 2px;
    background: #111;
    margin: 24px auto 0;
    opacity: 0.5;
  }
`;

const MsgEn = styled.p`
  font-size: 1.05rem;
  line-height: 1.55;
  color: #2a2a2a;
  margin: 0 0 20px;
`;

const MsgEs = styled.p`
  font-size: 1rem;
  line-height: 1.55;
  color: #555;
  margin: 0;
`;

const MaintenanceOverlay = () => (
  <Backdrop role="alertdialog" aria-modal="true" aria-label="Maintenance">
    <Card>
      <Brand>SHAREMECHAT</Brand>
      <MsgEn>
        We're currently performing scheduled maintenance.
        We'll be back shortly. Thanks for your patience.
      </MsgEn>
      <MsgEs>
        Estamos realizando tareas de mantenimiento.
        Volvemos en unos minutos. Gracias por tu paciencia.
      </MsgEs>
    </Card>
  </Backdrop>
);

export default MaintenanceProvider;
