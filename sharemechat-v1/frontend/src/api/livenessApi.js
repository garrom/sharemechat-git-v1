// src/api/livenessApi.js
//
// Helpers del endpoint /api/streaming/liveness/* (ADR-050 Fase B).

import { apiFetch } from '../config/http';

/**
 * GET /api/streaming/liveness/status
 *
 * @returns {Promise<{ hasCurrentPass: boolean, passedUntil?: string, challengeType?: string }>}
 */
export async function getLivenessStatus() {
  const res = await apiFetch('/streaming/liveness/status', { method: 'GET' });
  // apiFetch parsea el body como JSON si la respuesta lo trae; el proyecto
  // lo hace en el propio wrapper. Devolvemos el objeto directamente.
  return res || { hasCurrentPass: false };
}

/**
 * POST /api/streaming/liveness/challenge
 *
 * @returns {Promise<{
 *   challengeId: number,
 *   challengeType: string,
 *   promptLc: string,
 *   status: string,
 *   hasCurrentPass?: boolean,
 *   passedUntil?: string,
 * }>}
 */
export async function startLivenessChallenge() {
  return await apiFetch('/streaming/liveness/challenge', { method: 'POST' });
}

/**
 * POST /api/streaming/liveness/verify?challengeId=<id>
 * Body: multipart/form-data con `frames` repetido N veces.
 *
 * @param {number} challengeId
 * @param {Blob[]} frameBlobs
 * @returns {Promise<{ challengeId: number, status: string, passed: boolean, passedUntil?: string }>}
 */
export async function verifyLivenessChallenge(challengeId, frameBlobs) {
  const fd = new FormData();
  for (let i = 0; i < frameBlobs.length; i++) {
    // El backend acepta ambos como parts con nombre 'frames' porque el
    // controller espera List<MultipartFile> con @RequestPart("frames").
    fd.append('frames', frameBlobs[i], `frame-${i}.jpg`);
  }
  const path = `/streaming/liveness/verify?challengeId=${encodeURIComponent(challengeId)}`;
  return await apiFetch(path, {
    method: 'POST',
    body: fd,
    // No fijar Content-Type: el navegador anade boundary correcto.
  });
}
