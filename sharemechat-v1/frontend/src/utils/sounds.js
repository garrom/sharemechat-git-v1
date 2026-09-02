// sounds.js — feedback sonoro de UX (2026-09-01).
//
// Sonidos elegidos por el operador desde el mock:
//   - incomingCall → "Clásico" (timbre tipo teléfono, en bucle hasta responder)
//   - giftReceived → "Chispas" (arpegio ascendente)
//   - giftSent     → "Whoosh + pop"
//   - message      → "Ding"
//   - match        → "Conexión" (dos tonos cálidos)
//
// Se sintetizan en el navegador con Web Audio API (sin ficheros externos, sin
// dependencias). El usuario los activa/desactiva con un interruptor en Ajustes;
// la preferencia se guarda en localStorage. El volumen lo gobierna el dispositivo
// (patrón estándar de WhatsApp/Telegram/Discord: on/off, no slider propio).
//
// Política de autoplay: los navegadores no dejan sonar sin una interacción previa
// del usuario. El AudioContext se crea de forma perezosa y se "resume" en el
// primer gesto (click/keydown/touch) mediante un listener de una sola vez.

const STORAGE_KEY = 'smc_sounds_enabled';

let ctx = null;
let master = null;
let gestureHooked = false;
let ringTimer = null; // bucle del timbre de llamada entrante

// ---- preferencia on/off (por defecto ACTIVADO) ----
export function isSoundsEnabled() {
  try {
    return localStorage.getItem(STORAGE_KEY) !== 'off';
  } catch (_) {
    return true;
  }
}

export function setSoundsEnabled(enabled) {
  try {
    localStorage.setItem(STORAGE_KEY, enabled ? 'on' : 'off');
  } catch (_) { /* modo incógnito / storage bloqueado: no persiste, no rompe */ }
  if (!enabled) stopIncomingCall();
}

// ---- infra de audio ----
function ensureCtx() {
  if (ctx) return ctx;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.7;
    master.connect(ctx.destination);
  } catch (_) {
    ctx = null;
  }
  return ctx;
}

// Resume del contexto en el primer gesto del usuario (una sola vez).
function hookFirstGesture() {
  if (gestureHooked || typeof window === 'undefined') return;
  gestureHooked = true;
  const resume = () => {
    const c = ensureCtx();
    if (c && c.state === 'suspended') c.resume().catch(() => {});
  };
  ['click', 'keydown', 'touchstart'].forEach((ev) =>
    window.addEventListener(ev, resume, { once: true, passive: true })
  );
}
if (typeof window !== 'undefined') hookFirstGesture();

function now() { return ctx.currentTime + 0.02; }

function beep(freq, t0, dur, type, peak) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type || 'sine';
  o.frequency.setValueAtTime(freq, t0);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(peak || 0.3, t0 + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g); g.connect(master);
  o.start(t0); o.stop(t0 + dur + 0.05);
}

function noiseBuf(dur) {
  const n = Math.floor(ctx.sampleRate * dur);
  const b = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  return b;
}

// ---- los 5 sonidos elegidos ----
function sndIncomingCall() {           // "Clásico": doble timbre warble
  const t = now();
  for (let r = 0; r < 2; r++) {
    const s = t + r * 0.72;
    for (let i = 0; i < 8; i++) beep(i % 2 ? 620 : 480, s + i * 0.05, 0.05, 'sine', 0.2);
  }
}
function sndGiftReceived() {           // "Chispas": arpegio ascendente
  const t = now();
  [523, 659, 784, 1047, 1319].forEach((f, i) => beep(f, t + i * 0.07, 0.28, 'triangle', 0.22));
}
function sndGiftSent() {               // "Whoosh + pop"
  const t = now();
  const s = ctx.createBufferSource(); s.buffer = noiseBuf(0.4);
  const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 1.3;
  bp.frequency.setValueAtTime(350, t); bp.frequency.exponentialRampToValueAtTime(2600, t + 0.3);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.22, t + 0.06); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
  s.connect(bp); bp.connect(g); g.connect(master); s.start(t); s.stop(t + 0.45);
  const t2 = t + 0.32; // pop
  const o = ctx.createOscillator(); const pg = ctx.createGain(); o.type = 'sine';
  o.frequency.setValueAtTime(720, t2); o.frequency.exponentialRampToValueAtTime(190, t2 + 0.12);
  pg.gain.setValueAtTime(0.0001, t2); pg.gain.exponentialRampToValueAtTime(0.34, t2 + 0.005); pg.gain.exponentialRampToValueAtTime(0.0001, t2 + 0.14);
  o.connect(pg); pg.connect(master); o.start(t2); o.stop(t2 + 0.2);
}
function sndMessage() {                // "Ding"
  beep(1175, now(), 0.35, 'sine', 0.22);
}
function sndMatch() {                  // "Conexión": dos tonos cálidos
  const t = now();
  beep(392, t, 0.2, 'sine', 0.28);
  beep(587, t + 0.16, 0.42, 'sine', 0.28);
}

const REGISTRY = {
  incomingCall: sndIncomingCall,
  giftReceived: sndGiftReceived,
  giftSent: sndGiftSent,
  message: sndMessage,
  match: sndMatch,
};

// ---- API pública ----
// Reproduce un sonido de una sola vez. No-op si están desactivados o el navegador
// aún no permite audio. Nunca lanza (envuelto en try/catch).
export function playSound(name) {
  try {
    if (!isSoundsEnabled()) return;
    const fn = REGISTRY[name];
    if (!fn) return;
    const c = ensureCtx();
    if (!c) return;
    if (c.state === 'suspended') { c.resume().catch(() => {}); return; } // aún sin gesto: no suena, no rompe
    fn();
  } catch (_) { /* nunca romper la UI por un sonido */ }
}

// Timbre de llamada entrante: suena en bucle hasta stopIncomingCall().
export function startIncomingCall() {
  try {
    if (!isSoundsEnabled()) return;
    stopIncomingCall();
    const c = ensureCtx();
    if (!c) return;
    if (c.state === 'suspended') { c.resume().catch(() => {}); return; }
    sndIncomingCall();
    ringTimer = setInterval(() => {
      try { if (isSoundsEnabled() && ctx && ctx.state === 'running') sndIncomingCall(); } catch (_) {}
    }, 3000);
  } catch (_) {}
}

export function stopIncomingCall() {
  if (ringTimer) { clearInterval(ringTimer); ringTimer = null; }
}

const sounds = { playSound, startIncomingCall, stopIncomingCall, isSoundsEnabled, setSoundsEnabled };
export default sounds;
