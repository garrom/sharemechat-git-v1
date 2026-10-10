import { apiFetch } from '../config/http';

let configPromise = null;
let cachedPeerConfig = null;

function normalizeIceServer(rawServer) {
  if (!rawServer || typeof rawServer !== 'object') {
    throw new Error('Invalid ICE server entry');
  }

  const urlsValue = rawServer.urls;
  const urls = Array.isArray(urlsValue)
    ? urlsValue.map((value) => String(value || '').trim()).filter(Boolean)
    : String(urlsValue || '').trim();

  if ((Array.isArray(urls) && urls.length === 0) || (!Array.isArray(urls) && !urls)) {
    throw new Error('ICE server urls missing');
  }

  const normalized = { urls };

  if (rawServer.username != null && String(rawServer.username).trim()) {
    normalized.username = String(rawServer.username).trim();
  }

  if (rawServer.credential != null && String(rawServer.credential).trim()) {
    normalized.credential = String(rawServer.credential).trim();
  }

  return normalized;
}

function normalizePeerConfig(rawConfig) {
  const servers = Array.isArray(rawConfig?.iceServers)
    ? rawConfig.iceServers.map(normalizeIceServer)
    : [];

  if (servers.length === 0) {
    throw new Error('ICE configuration is empty');
  }

  // iceTransportPolicy='relay' (2026-10-10): forzamos que TODA la media vaya
  // por el TURN en vez de permitir P2P directo. Sin esto (policy por defecto
  // 'all'), el navegador prioriza candidatos host/srflx (P2P directo); en
  // redes restrictivas/moviles/CGNAT la ruta directa conecta y se cae a los
  // ~1 min, y como el par elegido no era el relay, ICE no reconmuta en
  // caliente -> congelado/pantalla negra mientras la sesion sigue viva. Forzar
  // relay elimina ese fallo a costa de mas ancho de banda en el TURN. Punto
  // unico: lo heredan todos los peers (cliente trial/pago y modelo, random y
  // llamada) porque todos consumen loadWebRtcPeerConfig().
  return { iceServers: servers, iceTransportPolicy: 'relay' };
}

export async function loadWebRtcPeerConfig() {
  if (cachedPeerConfig) return cachedPeerConfig;

  if (!configPromise) {
    configPromise = apiFetch('/webrtc/config')
      .then((data) => {
        const normalized = normalizePeerConfig(data);
        cachedPeerConfig = normalized;
        return normalized;
      })
      .catch((error) => {
        configPromise = null;
        throw error;
      });
  }

  return configPromise;
}
