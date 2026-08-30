import { createMsgSocketEngine } from './msgSocketEngine';

/**
 * Motor WS de messages/calls. Sin este test, una regresión en los guards de
 * reconexión (OPEN/CONNECTING/manualClose) rompe el canal en silencio: o abre
 * sockets duplicados, o deja de reconectar. Se usa un WebSocket falso + timers
 * simulados.
 */

class FakeWS {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  constructor(url) {
    this.url = url;
    this.readyState = FakeWS.CONNECTING;
    this.sent = [];
    this.closed = false;
    FakeWS.instances.push(this);
  }
  send(data) { this.sent.push(data); }
  close() { this.closed = true; }
}
FakeWS.instances = [];

describe('createMsgSocketEngine', () => {
  let adapter;
  let setReady;

  beforeEach(() => {
    jest.useFakeTimers();
    FakeWS.instances = [];
    global.WebSocket = FakeWS;
    setReady = jest.fn();
    adapter = {
      buildWsUrl: () => 'ws://test/messages',
      WS_PATHS: { messages: '/messages' },
      msgSocketRef: { current: null },
      msgPingRef: { current: null },
      msgReconnectRef: { current: null },
      callStatusRef: { current: null },
      callPeerIdRef: { current: null },
      setReady,
      clearMsgTimers: jest.fn(),
      onMessage: jest.fn(),
      reconnectAfterMs: 1500,
      pingEveryMs: 30000,
    };
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('guard OPEN: si ya hay socket OPEN no abre otro', () => {
    const existing = new FakeWS('x');
    existing.readyState = FakeWS.OPEN;
    adapter.msgSocketRef.current = existing;

    createMsgSocketEngine(adapter).open();

    expect(setReady).toHaveBeenCalledWith(true);
    expect(FakeWS.instances).toHaveLength(1); // no se creó ninguno nuevo
  });

  test('guard CONNECTING: no reabre mientras conecta', () => {
    const existing = new FakeWS('x');
    existing.readyState = FakeWS.CONNECTING;
    adapter.msgSocketRef.current = existing;

    createMsgSocketEngine(adapter).open();

    expect(FakeWS.instances).toHaveLength(1);
  });

  test('abre un socket nuevo cuando no hay ninguno', () => {
    createMsgSocketEngine(adapter).open();
    expect(FakeWS.instances).toHaveLength(1);
    expect(adapter.msgSocketRef.current).toBe(FakeWS.instances[0]);
    expect(setReady).toHaveBeenCalledWith(false);
  });

  test('onopen marca ready y arranca el ping periódico', () => {
    createMsgSocketEngine(adapter).open();
    const s = FakeWS.instances[0];
    s.readyState = FakeWS.OPEN;
    s.onopen();

    expect(setReady).toHaveBeenLastCalledWith(true);
    jest.advanceTimersByTime(30000);
    expect(s.sent).toContain(JSON.stringify({ type: 'ping' }));
  });

  test('onclose sin manualClose reprograma la reconexión', () => {
    createMsgSocketEngine(adapter).open();
    const s = FakeWS.instances[0];

    s.onclose();
    expect(adapter.msgSocketRef.current).toBeNull();

    jest.advanceTimersByTime(1500);
    expect(FakeWS.instances.length).toBeGreaterThanOrEqual(2); // reconectó
  });

  test('onclose con manualClose NO reconecta', () => {
    createMsgSocketEngine(adapter).open();
    const s = FakeWS.instances[0];
    s.__manualClose = true;

    s.onclose();
    jest.advanceTimersByTime(5000);
    expect(FakeWS.instances).toHaveLength(1); // no reconectó
  });

  test('ignora eventos de un socket que ya no es el actual', () => {
    createMsgSocketEngine(adapter).open();
    const viejo = FakeWS.instances[0];
    adapter.msgSocketRef.current = new FakeWS('otro'); // el viejo deja de ser current

    viejo.onopen();
    viejo.onmessage({ data: 'x' });

    expect(adapter.onMessage).not.toHaveBeenCalled();
  });
});
