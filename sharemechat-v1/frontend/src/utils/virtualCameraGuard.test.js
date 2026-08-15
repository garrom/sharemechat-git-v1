// ADR-059 Fase 4 — virtualCameraGuard: anti-fraude Nivel 1 que bloquea
// virtual cameras conocidas (OBS/ManyCam/...) tras getUserMedia. Seguridad:
// conviene blindar el matcheo de blacklist y las ramas de fallo.

import { checkPhysicalCamera, stopAllTracks } from './virtualCameraGuard';

function fakeTrack({ label = '', deviceId = 'dev-1' } = {}) {
  return {
    label,
    getSettings: () => ({ deviceId }),
    stop: jest.fn(),
  };
}
function fakeStream(tracks = []) {
  return { getVideoTracks: () => tracks, getTracks: () => tracks };
}

describe('checkPhysicalCamera', () => {
  test('sin stream o sin getVideoTracks -> no-video-track (bloquea)', async () => {
    expect(await checkPhysicalCamera(null)).toMatchObject({ allowed: false, reason: 'no-video-track' });
    expect(await checkPhysicalCamera({})).toMatchObject({ allowed: false, reason: 'no-video-track' });
  });

  test('sin tracks de video -> no-video-track', async () => {
    expect(await checkPhysicalCamera(fakeStream([]))).toMatchObject({ allowed: false, reason: 'no-video-track' });
  });

  test('label de virtual camera conocida -> blacklisted (bloquea, case-insensitive)', async () => {
    const r = await checkPhysicalCamera(fakeStream([fakeTrack({ label: 'OBS Virtual Camera' })]));
    expect(r).toMatchObject({ allowed: false, reason: 'blacklisted', deviceLabel: 'OBS Virtual Camera' });
    expect(r.matchedRule).toBe('obs virtual camera');

    const r2 = await checkPhysicalCamera(fakeStream([fakeTrack({ label: 'MyManyCam device' })]));
    expect(r2.reason).toBe('blacklisted');
  });

  test('cámara física real -> ok (permite)', async () => {
    const r = await checkPhysicalCamera(fakeStream([fakeTrack({ label: 'FaceTime HD Camera' })]));
    expect(r).toMatchObject({ allowed: true, reason: 'ok', matchedRule: null });
  });

  test('sin label en el track: cae a enumerateDevices() para resolver el label', async () => {
    const enumerateDevices = jest.fn().mockResolvedValue([
      { kind: 'audioinput', deviceId: 'dev-1', label: 'Mic' },
      { kind: 'videoinput', deviceId: 'dev-1', label: 'ManyCam Virtual Webcam' },
    ]);
    Object.defineProperty(global.navigator, 'mediaDevices', { configurable: true, value: { enumerateDevices } });

    const r = await checkPhysicalCamera(fakeStream([fakeTrack({ label: '', deviceId: 'dev-1' })]));
    expect(enumerateDevices).toHaveBeenCalled();
    expect(r).toMatchObject({ allowed: false, reason: 'blacklisted' });
  });

  test('enumerateDevices lanza -> enumeration-failed (bloquea)', async () => {
    const enumerateDevices = jest.fn().mockRejectedValue(new Error('denied'));
    Object.defineProperty(global.navigator, 'mediaDevices', { configurable: true, value: { enumerateDevices } });

    const r = await checkPhysicalCamera(fakeStream([fakeTrack({ label: '', deviceId: 'dev-1' })]));
    expect(r).toMatchObject({ allowed: false, reason: 'enumeration-failed' });
  });

  test('sin deviceId ni label -> no-device-id (bloquea por defecto)', async () => {
    const track = { label: '', getSettings: () => ({}) };
    const r = await checkPhysicalCamera(fakeStream([track]));
    expect(r).toMatchObject({ allowed: false, reason: 'no-device-id' });
  });
});

describe('stopAllTracks', () => {
  test('para todos los tracks', () => {
    const t1 = fakeTrack(); const t2 = fakeTrack();
    stopAllTracks(fakeStream([t1, t2]));
    expect(t1.stop).toHaveBeenCalled();
    expect(t2.stop).toHaveBeenCalled();
  });

  test('null / sin getTracks -> no lanza', () => {
    expect(() => stopAllTracks(null)).not.toThrow();
    expect(() => stopAllTracks({})).not.toThrow();
  });
});
