// ADR-059 Fase 4 — mediaState: snapshot y observador de salud del track de
// video (live/degraded/lost/idle). Usado por el videochat para reflejar el
// estado real de la cámara. Se testea con stream/track fake (sin media real).

import {
  createIdleMediaState,
  createMediaStateSnapshot,
  getPrimaryVideoTrack,
  observePrimaryVideoTrack,
  resetMediaObserver,
  attachMediaObserver,
} from './mediaState';

// Track fake con registro de listeners para simular eventos ended/mute/unmute.
function fakeTrack({ id = 'vt1', readyState = 'live', muted = false, enabled = true } = {}) {
  const listeners = {};
  return {
    id,
    readyState,
    muted,
    enabled,
    addEventListener: jest.fn((ev, cb) => { listeners[ev] = cb; }),
    removeEventListener: jest.fn((ev) => { delete listeners[ev]; }),
    __emit: (ev) => listeners[ev] && listeners[ev](),
  };
}

function fakeStream({ id = 's1', videoTracks = [] } = {}) {
  return { id, getVideoTracks: () => videoTracks };
}

describe('getPrimaryVideoTrack', () => {
  test('devuelve el primer video track, o null', () => {
    const t = fakeTrack();
    expect(getPrimaryVideoTrack(fakeStream({ videoTracks: [t] }))).toBe(t);
    expect(getPrimaryVideoTrack(fakeStream({ videoTracks: [] }))).toBeNull();
    expect(getPrimaryVideoTrack(null)).toBeNull();
    expect(getPrimaryVideoTrack({})).toBeNull(); // sin getVideoTracks
  });
});

describe('createIdleMediaState', () => {
  test('estado idle con reason por defecto y personalizado', () => {
    expect(createIdleMediaState()).toMatchObject({ status: 'idle', hasVideoTrack: false, lastReason: 'idle' });
    expect(createIdleMediaState('stopped').lastReason).toBe('stopped');
  });
});

describe('createMediaStateSnapshot', () => {
  test('sin stream -> idle', () => {
    expect(createMediaStateSnapshot(null)).toMatchObject({ status: 'idle', hasVideoTrack: false, streamId: null });
  });

  test('track live + no muted -> live', () => {
    const t = fakeTrack({ readyState: 'live', muted: false, enabled: true });
    const snap = createMediaStateSnapshot(fakeStream({ id: 's9', videoTracks: [t] }));
    expect(snap).toMatchObject({
      status: 'live', streamId: 's9', videoTrackId: 'vt1',
      hasVideoTrack: true, readyState: 'live', enabled: true, muted: false,
    });
  });

  test('sin video track -> degraded', () => {
    expect(createMediaStateSnapshot(fakeStream({ videoTracks: [] })).status).toBe('degraded');
  });

  test('track no-live o muted -> degraded', () => {
    expect(createMediaStateSnapshot(fakeStream({ videoTracks: [fakeTrack({ readyState: 'ended' })] })).status).toBe('degraded');
    expect(createMediaStateSnapshot(fakeStream({ videoTracks: [fakeTrack({ muted: true })] })).status).toBe('degraded');
  });

  test('options.status fuerza el estado', () => {
    const t = fakeTrack();
    expect(createMediaStateSnapshot(fakeStream({ videoTracks: [t] }), { status: 'lost', lastReason: 'x' }))
      .toMatchObject({ status: 'lost', lastReason: 'x' });
  });
});

describe('observePrimaryVideoTrack', () => {
  test('onState no-función -> devuelve noop sin lanzar', () => {
    expect(typeof observePrimaryVideoTrack(fakeStream(), null)).toBe('function');
  });

  test('sin stream -> emite idle y devuelve noop', () => {
    const onState = jest.fn();
    const cleanup = observePrimaryVideoTrack(null, onState, { initialReason: 'r' });
    expect(onState).toHaveBeenCalledWith(expect.objectContaining({ status: 'idle', lastReason: 'r' }));
    expect(typeof cleanup).toBe('function');
  });

  test('sin video track -> emite degraded', () => {
    const onState = jest.fn();
    observePrimaryVideoTrack(fakeStream({ videoTracks: [] }), onState);
    expect(onState).toHaveBeenCalledWith(expect.objectContaining({ status: 'degraded' }));
  });

  test('track live: emite live al enganchar, registra listeners, y reacciona a ended -> lost', () => {
    const t = fakeTrack({ readyState: 'live', muted: false });
    const onState = jest.fn();
    const cleanup = observePrimaryVideoTrack(fakeStream({ videoTracks: [t] }), onState, { initialReason: 'attach' });
    expect(onState).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'live', lastReason: 'attach' }));
    expect(t.addEventListener).toHaveBeenCalledWith('ended', expect.any(Function));

    t.__emit('ended');
    expect(onState).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'lost', lastReason: 'track:ended' }));

    cleanup();
    expect(t.removeEventListener).toHaveBeenCalledWith('ended', expect.any(Function));
  });
});

describe('resetMediaObserver / attachMediaObserver', () => {
  test('resetMediaObserver llama al cleanup previo y deja un noop', () => {
    const prev = jest.fn();
    const ref = { current: prev };
    resetMediaObserver(ref);
    expect(prev).toHaveBeenCalled();
    expect(typeof ref.current).toBe('function');
    expect(() => ref.current()).not.toThrow();
  });

  test('attachMediaObserver setea cleanupRef.current a partir del observador', () => {
    const ref = { current: null };
    attachMediaObserver(fakeStream({ videoTracks: [fakeTrack()] }), jest.fn(), ref, 'init');
    expect(typeof ref.current).toBe('function');
  });
});
