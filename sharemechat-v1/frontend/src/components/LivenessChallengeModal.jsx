// src/components/LivenessChallengeModal.jsx
//
// ADR-050 Fase B: modal de liveness challenge. Se muestra antes del
// primer startMatch del dia (o cuando el backend cierra el WS con
// close code 4031 LIVENESS_REQUIRED).
//
// Flujo:
//  1. GET /status → si hasCurrentPass=true, llama onSuccess() y no
//     renderiza contenido interactivo.
//  2. Si no hay pass, POST /challenge → recibe {challengeId, type, promptLc}.
//  3. Muestra el prompt localizado + video local (para que el user se vea).
//  4. Countdown 3-2-1 tras pulsar "Empezar".
//  5. Captura N frames espaciados 1.5s usando canvas + video del stream.
//  6. POST /verify multipart con los frames.
//  7. passed=true → onSuccess. passed=false → retry (max 3) o final fail
//     con onCancel.
//
// Props:
//  - open           : boolean
//  - localStream    : MediaStream ya obtenido con getUserMedia (video+audio).
//  - onSuccess()    : () => void — el user paso.
//  - onCancel()     : () => void — user cancelo o agoto intentos.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import i18n from '../i18n';
import {
  Backdrop,
  Wrapper,
  Dialog,
  Header,
  Title,
  CloseBtn,
  Body,
  Footer,
  ModalBtn,
} from '../styles/ModalStyles';
import {
  getLivenessStatus,
  startLivenessChallenge,
  verifyLivenessChallenge,
} from '../api/livenessApi';
import { getApiErrorMessage } from '../utils/apiErrors';

// Constantes de captura. Ajustables pero validadas contra backend
// framesRequired=3 y max 8/request.
const FRAME_COUNT = 3;
const FRAME_INTERVAL_MS = 1500;
const CAPTURE_WIDTH = 640;
const CAPTURE_HEIGHT = 480;
const JPEG_QUALITY = 0.85;
const MAX_ATTEMPTS = 3;

// Fases del state machine interno del modal.
const PHASE_LOADING = 'loading';       // verificando /status o abriendo /challenge
const PHASE_READY = 'ready';           // challenge activo, esperando al user
const PHASE_COUNTDOWN = 'countdown';   // 3-2-1
const PHASE_CAPTURING = 'capturing';   // capturando frames
const PHASE_VERIFYING = 'verifying';   // POST /verify en curso
const PHASE_PASSED = 'passed';
const PHASE_FAILED = 'failed';
const PHASE_COOLDOWN = 'cooldown';     // 429 cooldown_active
const PHASE_ERROR = 'error';

/**
 * Captura un frame JPEG del MediaStream usando canvas.
 * Requiere que el <video> del prop videoRef ya este mostrando el stream
 * (para leer videoWidth/Height reales, si no cae a defaults).
 */
async function captureFrameJpeg(videoElement) {
  if (!videoElement) throw new Error('no_video_element');
  const width = videoElement.videoWidth || CAPTURE_WIDTH;
  const height = videoElement.videoHeight || CAPTURE_HEIGHT;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(videoElement, 0, 0, width, height);
  return await new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('canvas_toBlob_failed'))),
      'image/jpeg',
      JPEG_QUALITY
    );
  });
}

/**
 * Espera N ms respetando cancelacion via ref.
 */
function delay(ms, cancelledRef) {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    if (cancelledRef && cancelledRef.current) {
      clearTimeout(timer);
      resolve();
    }
  });
}

// Estilos inline: tema claro sobrescrito sobre ModalStyles global oscuro.
// Motivacion (feedback operador 2026-07-13): el tema oscuro del proyecto
// hacia poco legibles los textos azules en fondo negro. Este modal
// prefiere gris claro + texto oscuro para mejor UX en el gate previo al
// match. Aplicado via inline para no romper otros modales del proyecto.

const dialogOverride = {
  background: '#f3f5f7',
  color: '#1f2933',
};

const headerOverride = {
  background: 'transparent',
};

const titleOverride = {
  color: '#1e3a8a',
  fontSize: 18,
  fontWeight: 800,
};

const closeBtnOverride = {
  color: '#1e3a8a',
};

const bodyOverride = {
  background: 'transparent',
  color: '#1f2933',
  fontSize: 15,
};

const footerOverride = {
  background: 'transparent',
};

const overlayVideoStyle = {
  width: '100%',
  maxWidth: 340,
  height: 'auto',
  borderRadius: 12,
  background: '#dde3ea',
  transform: 'scaleX(-1)', // efecto espejo (mas natural para el user)
  display: 'block',
  margin: '0 auto',
  border: '1px solid rgba(30, 58, 138, 0.15)',
};

const promptBox = {
  fontSize: 16,
  fontWeight: 700,
  color: '#1e3a8a',
  textAlign: 'center',
  margin: '14px 0 6px',
  lineHeight: 1.4,
};

const subtitleStyle = {
  fontSize: 14,
  color: '#4a5563',
  textAlign: 'center',
  margin: '0 0 12px',
  lineHeight: 1.45,
};

const countdownStyle = {
  fontSize: 54,
  fontWeight: 800,
  color: '#f97316',
  textAlign: 'center',
  margin: '12px 0',
  lineHeight: 1,
};

const statusLine = {
  fontSize: 15,
  color: '#1f2933',
  textAlign: 'center',
  margin: '10px 0 0',
  lineHeight: 1.4,
};

const errorLine = {
  fontSize: 14,
  color: '#a1273a',
  textAlign: 'center',
  marginTop: 8,
  lineHeight: 1.4,
};

const attemptCounter = {
  fontSize: 13,
  color: '#5b6470',
  textAlign: 'center',
  marginTop: 6,
};

export default function LivenessChallengeModal({
  open,
  localStream,
  onSuccess,
  onCancel,
}) {
  const [phase, setPhase] = useState(PHASE_LOADING);
  const [challenge, setChallenge] = useState(null); // {challengeId, challengeType, promptLc}
  const [attemptNumber, setAttemptNumber] = useState(1);
  const [countdown, setCountdown] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  const videoRef = useRef(null);
  const cancelledRef = useRef(false);

  const t = useCallback((key, options) => i18n.t(key, options), []);

  const attachStreamToVideo = useCallback(() => {
    if (videoRef.current && localStream && videoRef.current.srcObject !== localStream) {
      videoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (!open) return undefined;
    cancelledRef.current = false;
    let cancelled = false;

    (async () => {
      setPhase(PHASE_LOADING);
      setErrorMsg('');
      try {
        // Cortocircuito: pass vigente en backend → onSuccess sin abrir challenge.
        const status = await getLivenessStatus();
        if (status && status.hasCurrentPass) {
          if (!cancelled) onSuccess && onSuccess();
          return;
        }

        const challengeRow = await startLivenessChallenge();
        if (cancelled) return;
        // Si el backend nos devuelve un PASSED de idempotencia, tratarlo
        // como pass directo.
        if (challengeRow && challengeRow.status === 'PASSED') {
          onSuccess && onSuccess();
          return;
        }
        setChallenge({
          challengeId: challengeRow.challengeId,
          challengeType: challengeRow.challengeType,
          promptLc: challengeRow.promptLc,
        });
        setAttemptNumber(1);
        setPhase(PHASE_READY);
      } catch (err) {
        if (cancelled) return;
        const raw = err && err.data;
        if (raw && raw.error === 'cooldown_active') {
          setPhase(PHASE_COOLDOWN);
          setErrorMsg(t('liveness.messages.cooldown'));
          return;
        }
        setPhase(PHASE_ERROR);
        setErrorMsg(getApiErrorMessage(err, t('liveness.messages.error')));
      }
    })();

    return () => {
      cancelled = true;
      cancelledRef.current = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (phase !== PHASE_LOADING) attachStreamToVideo();
  }, [phase, attachStreamToVideo]);

  const doCountdownAndCapture = useCallback(async () => {
    if (!challenge) return;
    setErrorMsg('');
    setPhase(PHASE_COUNTDOWN);
    // Countdown 3-2-1
    for (let i = 3; i >= 1; i--) {
      if (cancelledRef.current) return;
      setCountdown(i);
      await delay(1000, cancelledRef);
    }
    setCountdown(0);
    setPhase(PHASE_CAPTURING);

    const frames = [];
    try {
      for (let i = 0; i < FRAME_COUNT; i++) {
        if (cancelledRef.current) return;
        const blob = await captureFrameJpeg(videoRef.current);
        frames.push(blob);
        if (i < FRAME_COUNT - 1) await delay(FRAME_INTERVAL_MS, cancelledRef);
      }
    } catch (err) {
      setPhase(PHASE_ERROR);
      setErrorMsg(t('liveness.messages.captureError'));
      return;
    }

    setPhase(PHASE_VERIFYING);
    try {
      const verifyResult = await verifyLivenessChallenge(challenge.challengeId, frames);
      if (cancelledRef.current) return;
      if (verifyResult && verifyResult.passed) {
        setPhase(PHASE_PASSED);
        // Corto delay para dar feedback visual
        setTimeout(() => {
          if (!cancelledRef.current) onSuccess && onSuccess();
        }, 700);
        return;
      }
      // Fail
      setPhase(PHASE_FAILED);
    } catch (err) {
      if (cancelledRef.current) return;
      setPhase(PHASE_ERROR);
      setErrorMsg(getApiErrorMessage(err, t('liveness.messages.error')));
    }
  }, [challenge, onSuccess, t]);

  const handleRetry = useCallback(async () => {
    if (attemptNumber >= MAX_ATTEMPTS) {
      // Agotados intentos → tratamos como cancel
      onCancel && onCancel();
      return;
    }
    setErrorMsg('');
    setPhase(PHASE_LOADING);
    try {
      const challengeRow = await startLivenessChallenge();
      if (challengeRow && challengeRow.status === 'PASSED') {
        onSuccess && onSuccess();
        return;
      }
      setChallenge({
        challengeId: challengeRow.challengeId,
        challengeType: challengeRow.challengeType,
        promptLc: challengeRow.promptLc,
      });
      setAttemptNumber((n) => n + 1);
      setPhase(PHASE_READY);
    } catch (err) {
      const raw = err && err.data;
      if (raw && raw.error === 'cooldown_active') {
        setPhase(PHASE_COOLDOWN);
        setErrorMsg(t('liveness.messages.cooldown'));
        return;
      }
      setPhase(PHASE_ERROR);
      setErrorMsg(getApiErrorMessage(err, t('liveness.messages.error')));
    }
  }, [attemptNumber, onCancel, onSuccess, t]);

  const handleClose = useCallback(() => {
    cancelledRef.current = true;
    onCancel && onCancel();
  }, [onCancel]);

  if (!open) return null;

  const promptText = challenge
    ? t(`liveness.prompts.${challenge.promptLc}`)
    : '';

  const canRetry = attemptNumber < MAX_ATTEMPTS;

  return (
    <>
      <Backdrop />
      <Wrapper>
        <Dialog data-variant="info" $size="sm" style={dialogOverride}>
          <Header style={headerOverride}>
            <Title style={titleOverride}>{t('liveness.title')}</Title>
            <CloseBtn onClick={handleClose} aria-label={t('common.close')} style={closeBtnOverride}>×</CloseBtn>
          </Header>

          <Body data-kind="default" style={bodyOverride}>
            <div style={subtitleStyle}>{t('liveness.subtitle')}</div>

            <video
              ref={videoRef}
              style={overlayVideoStyle}
              autoPlay
              muted
              playsInline
            />

            {phase === PHASE_LOADING && (
              <div style={statusLine}>{t('liveness.status.loading')}</div>
            )}

            {phase === PHASE_READY && (
              <>
                <div style={promptBox}>{promptText}</div>
                <div style={statusLine}>{t('liveness.status.ready')}</div>
                {attemptNumber > 1 && (
                  <div style={attemptCounter}>
                    {t('liveness.messages.attemptOf', { current: attemptNumber, max: MAX_ATTEMPTS })}
                  </div>
                )}
              </>
            )}

            {phase === PHASE_COUNTDOWN && (
              <>
                <div style={promptBox}>{promptText}</div>
                <div style={countdownStyle}>{countdown > 0 ? countdown : '·'}</div>
              </>
            )}

            {phase === PHASE_CAPTURING && (
              <>
                <div style={promptBox}>{promptText}</div>
                <div style={statusLine}>{t('liveness.status.capturing')}</div>
              </>
            )}

            {phase === PHASE_VERIFYING && (
              <div style={statusLine}>{t('liveness.status.verifying')}</div>
            )}

            {phase === PHASE_PASSED && (
              <div style={{ ...statusLine, color: '#0f7c4d', fontWeight: 700 }}>
                {t('liveness.status.passed')}
              </div>
            )}

            {phase === PHASE_FAILED && (
              <>
                <div style={{ ...statusLine, color: '#a1273a', fontWeight: 700 }}>
                  {t('liveness.status.failed')}
                </div>
                <div style={attemptCounter}>
                  {t('liveness.messages.attemptOf', { current: attemptNumber, max: MAX_ATTEMPTS })}
                </div>
              </>
            )}

            {phase === PHASE_COOLDOWN && (
              <div style={{ ...statusLine, color: '#a1273a', fontWeight: 600 }}>{errorMsg || t('liveness.messages.cooldown')}</div>
            )}

            {phase === PHASE_ERROR && (
              <div style={errorLine}>{errorMsg}</div>
            )}
          </Body>

          <Footer style={footerOverride}>
            {phase === PHASE_READY && (
              <>
                <ModalBtn onClick={handleClose}>{t('common.cancel')}</ModalBtn>
                <ModalBtn data-primary="true" onClick={doCountdownAndCapture}>
                  {t('liveness.actions.start')}
                </ModalBtn>
              </>
            )}
            {phase === PHASE_FAILED && (
              <>
                <ModalBtn onClick={handleClose}>{t('common.cancel')}</ModalBtn>
                {canRetry && (
                  <ModalBtn data-primary="true" onClick={handleRetry}>
                    {t('liveness.actions.retry')}
                  </ModalBtn>
                )}
                {!canRetry && (
                  <ModalBtn onClick={handleClose}>
                    {t('common.close')}
                  </ModalBtn>
                )}
              </>
            )}
            {phase === PHASE_COOLDOWN && (
              <ModalBtn onClick={handleClose}>{t('common.close')}</ModalBtn>
            )}
            {phase === PHASE_ERROR && (
              <>
                <ModalBtn onClick={handleClose}>{t('common.close')}</ModalBtn>
                <ModalBtn data-primary="true" onClick={handleRetry}>
                  {t('liveness.actions.retry')}
                </ModalBtn>
              </>
            )}
          </Footer>
        </Dialog>
      </Wrapper>
    </>
  );
}
