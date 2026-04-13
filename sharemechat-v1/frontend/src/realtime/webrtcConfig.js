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

  return { iceServers: servers };
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
