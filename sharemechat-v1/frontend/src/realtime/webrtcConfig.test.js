/**
 * Config WebRTC: normalización de los ICE servers que llegan del backend y
 * la caché. Un servidor sin `urls` o una config vacía deben lanzar (no dejar
 * arrancar una conexión con config inválida); la caché evita re-pedir.
 */
describe('loadWebRtcPeerConfig', () => {
  let apiFetchMock;
  let loadWebRtcPeerConfig;

  beforeEach(() => {
    jest.resetModules();
    apiFetchMock = jest.fn();
    jest.doMock('../config/http', () => ({ apiFetch: apiFetchMock }));
    loadWebRtcPeerConfig = require('./webrtcConfig').loadWebRtcPeerConfig;
  });

  test('normaliza y devuelve iceServers válidos (trim de username/credential)', async () => {
    apiFetchMock.mockResolvedValue({
      iceServers: [{ urls: 'stun:stun.test:3478', username: '  user  ', credential: 'pw' }],
    });
    const cfg = await loadWebRtcPeerConfig();
    expect(cfg.iceServers).toHaveLength(1);
    expect(cfg.iceServers[0].urls).toBe('stun:stun.test:3478');
    expect(cfg.iceServers[0].username).toBe('user');
    expect(cfg.iceServers[0].credential).toBe('pw');
  });

  test('lanza si un ICE server no trae urls', async () => {
    apiFetchMock.mockResolvedValue({ iceServers: [{ username: 'u' }] });
    await expect(loadWebRtcPeerConfig()).rejects.toThrow(/urls/);
  });

  test('lanza si la config no trae iceServers', async () => {
    apiFetchMock.mockResolvedValue({ iceServers: [] });
    await expect(loadWebRtcPeerConfig()).rejects.toThrow(/empty/i);
  });

  test('cachea: la segunda llamada no vuelve a pedir al backend', async () => {
    apiFetchMock.mockResolvedValue({ iceServers: [{ urls: 'stun:x:1' }] });
    await loadWebRtcPeerConfig();
    await loadWebRtcPeerConfig();
    expect(apiFetchMock).toHaveBeenCalledTimes(1);
  });

  test('ante error resetea el promise para poder reintentar', async () => {
    apiFetchMock.mockRejectedValueOnce(new Error('net down'));
    await expect(loadWebRtcPeerConfig()).rejects.toThrow('net down');

    apiFetchMock.mockResolvedValue({ iceServers: [{ urls: 'stun:x:1' }] });
    const cfg = await loadWebRtcPeerConfig(); // reintento OK
    expect(cfg.iceServers[0].urls).toBe('stun:x:1');
    expect(apiFetchMock).toHaveBeenCalledTimes(2);
  });
});
