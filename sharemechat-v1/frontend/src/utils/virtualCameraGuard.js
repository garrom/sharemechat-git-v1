// src/utils/virtualCameraGuard.js
//
// Anti-fraude camara Fase A (2026-07-13): blacklist de virtual cameras
// conocidas para evitar que la modelo (o el cliente) hagan streaming
// con OBS Virtual Camera / ManyCam / Snap Camera / etc. inyectando
// video pregrabado.
//
// Diseño:
// - Se invoca DESPUES de un getUserMedia() exitoso. Antes, los labels
//   de enumerateDevices() estan enmascarados por el navegador.
// - Extrae deviceId del track de video activo, lo cruza con
//   enumerateDevices() para obtener el label real, y matchea contra
//   una lista negra ESPECIFICA (nombres de fabricantes conocidos).
// - NO usa regla generica tipo "virtual" en el nombre porque cortaria
//   casos legitimos: Continuity Camera en macOS Ventura+, NVIDIA
//   Broadcast, EpocCam usada como camara auxiliar, etc.
// - Cero llamadas a red: verificacion 100% local en el navegador.
//
// Es una defensa Nivel 1 (barata, evadible renombrando el driver).
// Cubre el 90% del uso casual. La Fase B (liveness challenge server-side)
// se aborda como frente separado.

// Blacklist ordenada por popularidad decreciente. Cada entrada es un
// substring case-insensitive; si el label del track lo CONTIENE, se
// bloquea. Mantener conservador: solo fabricantes claramente asociados
// a captura no-fisica.
const VIRTUAL_CAMERA_BLACKLIST = [
  'OBS Virtual Camera',
  'OBS Camera',
  'OBS-Camera',
  'ManyCam',
  'Snap Camera',
  'SnapCam',
  'XSplit VCam',
  'XSplit Broadcaster',
  'DroidCam',
  'DroidCamX',
  'Iriun Webcam',
  'EpocCam',       // OBS lo usa como source; standalone es legitimo pero raro
  'e2eSoft VCam',
  'e2eSoft iVCam',
  'iVCam',
  'Reincubate Camo',
  'Camo',
  'Elgato Virtual Camera',
  'SplitCam',
  'WebcamMax',
  'YouCam Perfect',
  'YouCam',
  'AlterCam',
  'CyberLink YouCam',
  'FineCam',
  'MMHmm',
  'Loola.tv',
];

const normalize = (s) => (s || '').toString().trim().toLowerCase();
const VIRTUAL_CAMERA_BLACKLIST_LC = VIRTUAL_CAMERA_BLACKLIST.map(normalize);

/**
 * Comprueba si el track de video activo pertenece a una virtual camera
 * conocida. Devuelve un objeto plano; el caller decide el UX.
 *
 * @param {MediaStream} stream - stream ya obtenido con getUserMedia
 * @returns {Promise<{
 *   allowed: boolean,
 *   reason: 'no-video-track' | 'no-device-id' | 'blacklisted' | 'ok' | 'enumeration-failed',
 *   deviceLabel: string | null,
 *   matchedRule: string | null,
 * }>}
 */
export async function checkPhysicalCamera(stream) {
  const empty = {
    allowed: false,
    reason: 'no-video-track',
    deviceLabel: null,
    matchedRule: null,
  };

  if (!stream || typeof stream.getVideoTracks !== 'function') {
    return empty;
  }
  const videoTracks = stream.getVideoTracks();
  if (!videoTracks.length) {
    return empty;
  }

  const track = videoTracks[0];
  const settings = typeof track.getSettings === 'function' ? track.getSettings() : {};
  const deviceId = settings && settings.deviceId ? String(settings.deviceId) : null;

  // El label del propio track puede estar disponible directamente.
  // Chrome lo da tras getUserMedia; Firefox tambien. Lo usamos como
  // fuente primaria y cae a enumerateDevices() como respaldo.
  let deviceLabel = typeof track.label === 'string' ? track.label : '';

  if (!deviceLabel && deviceId) {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const found = (devices || []).find(
        (d) => d.kind === 'videoinput' && d.deviceId === deviceId
      );
      if (found && found.label) {
        deviceLabel = String(found.label);
      }
    } catch {
      return {
        allowed: false,
        reason: 'enumeration-failed',
        deviceLabel: null,
        matchedRule: null,
      };
    }
  }

  if (!deviceId && !deviceLabel) {
    // Ningun identificador. En este contexto es un caso raro (permisos
    // parciales o navegador exotico). Bloqueamos por defecto: mejor
    // rechazar que dejar pasar sin poder decidir.
    return {
      allowed: false,
      reason: 'no-device-id',
      deviceLabel: null,
      matchedRule: null,
    };
  }

  const labelLc = normalize(deviceLabel);
  const matchedRule = VIRTUAL_CAMERA_BLACKLIST_LC.find((rule) =>
    labelLc.includes(rule)
  );

  if (matchedRule) {
    return {
      allowed: false,
      reason: 'blacklisted',
      deviceLabel: deviceLabel || null,
      matchedRule,
    };
  }

  return {
    allowed: true,
    reason: 'ok',
    deviceLabel: deviceLabel || null,
    matchedRule: null,
  };
}

/**
 * Cierra todos los tracks de un stream. Util cuando el guard rechaza
 * y hay que soltar la camara para que el navegador la libere.
 * @param {MediaStream|null} stream
 */
export function stopAllTracks(stream) {
  if (!stream || typeof stream.getTracks !== 'function') return;
  try {
    stream.getTracks().forEach((t) => {
      try { t.stop(); } catch { /* noop */ }
    });
  } catch { /* noop */ }
}
