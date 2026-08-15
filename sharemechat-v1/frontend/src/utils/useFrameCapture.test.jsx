// ADR-059 Fase 4 — useFrameCapture: captura cliente-side de frames del stream
// del modelo para moderación IA (ADR-036). <video>+<canvas> offscreen →
// JPEG → POST multipart /streams/{id}/frames cada cadenceMs (tick 0 inmediato).
// Se mockean document.createElement (video/canvas, jsdom no da dimensiones ni
// canvas real) y apiFetch. Fake timers para la cadencia.

import React from 'react';
import { render, act } from '@testing-library/react';
import useFrameCapture from './useFrameCapture';
import { apiFetch } from '../config/http';

jest.mock('../config/http', () => ({ apiFetch: jest.fn() }));

function Host({ streamId, enabled, cadenceMs, hasStream = true }) {
  const ref = React.useRef(hasStream ? { id: 'stream' } : null);
  useFrameCapture(streamId, ref, enabled, cadenceMs);
  return null;
}

let origCreateElement;
let warnSpy;

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

  // Mock video (jsdom no puebla videoWidth) y canvas (jsdom no tiene 2d/toBlob).
  origCreateElement = document.createElement.bind(document);
  jest.spyOn(document, 'createElement').mockImplementation((tag) => {
    if (tag === 'video') {
      return { muted: false, playsInline: false, autoplay: false, srcObject: null, videoWidth: 640, videoHeight: 480 };
    }
    if (tag === 'canvas') {
      return {
        width: 0, height: 0,
        getContext: () => ({ drawImage: jest.fn() }),
        toBlob: (cb) => cb(new Blob(['x'], { type: 'image/jpeg' })),
      };
    }
    return origCreateElement(tag);
  });
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

// Flushea los microtasks del tick async (toBlob + apiFetch) sin avanzar timers.
const flush = async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); };

test('enabled=false -> inerte (no captura)', async () => {
  render(<Host streamId={5} enabled={false} />);
  await act(async () => { await flush(); });
  expect(apiFetch).not.toHaveBeenCalled();
});

test('streamId no positivo -> inerte', async () => {
  render(<Host streamId={0} enabled />);
  await act(async () => { await flush(); });
  expect(apiFetch).not.toHaveBeenCalled();
});

test('sin MediaStream en la ref -> inerte', async () => {
  render(<Host streamId={5} enabled hasStream={false} />);
  await act(async () => { await flush(); });
  expect(apiFetch).not.toHaveBeenCalled();
});

test('happy: tick 0 inmediato envía POST multipart a /streams/{id}/frames', async () => {
  apiFetch.mockResolvedValue(undefined);
  render(<Host streamId={7} enabled cadenceMs={15000} />);
  await act(async () => { await flush(); });

  expect(apiFetch).toHaveBeenCalledTimes(1);
  const [path, opts] = apiFetch.mock.calls[0];
  expect(path).toBe('/streams/7/frames');
  expect(opts.method).toBe('POST');
  expect(opts.body).toBeInstanceOf(FormData);
  expect(opts.signal).toBeDefined();
});

test('cadencia: cada cadenceMs envía otro frame', async () => {
  apiFetch.mockResolvedValue(undefined);
  render(<Host streamId={7} enabled cadenceMs={15000} />);
  await act(async () => { await flush(); });
  expect(apiFetch).toHaveBeenCalledTimes(1);

  await act(async () => { jest.advanceTimersByTime(15000); await flush(); });
  expect(apiFetch).toHaveBeenCalledTimes(2);
});

test('error 403 (sesión cerrada server-side) -> detiene el loop', async () => {
  apiFetch.mockRejectedValue({ status: 403 });
  render(<Host streamId={7} enabled cadenceMs={15000} />);
  await act(async () => { await flush(); });
  expect(apiFetch).toHaveBeenCalledTimes(1);

  // Tras el 403 el loop se detiene: avanzar la cadencia no envía más.
  await act(async () => { jest.advanceTimersByTime(45000); await flush(); });
  expect(apiFetch).toHaveBeenCalledTimes(1);
});

test('error 5xx -> continúa (siguiente tick reintenta)', async () => {
  apiFetch.mockRejectedValue({ status: 503 });
  render(<Host streamId={7} enabled cadenceMs={15000} />);
  await act(async () => { await flush(); });
  expect(apiFetch).toHaveBeenCalledTimes(1);

  await act(async () => { jest.advanceTimersByTime(15000); await flush(); });
  expect(apiFetch).toHaveBeenCalledTimes(2);
});
