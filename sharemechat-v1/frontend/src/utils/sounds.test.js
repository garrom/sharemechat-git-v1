import {
  isSoundsEnabled,
  setSoundsEnabled,
  playSound,
  startIncomingCall,
  stopIncomingCall,
} from './sounds';

// jsdom no tiene Web Audio API (window.AudioContext), así que aquí verificamos
// la lógica pura (preferencia on/off en localStorage) y que las funciones NUNCA
// lanzan aunque no haya audio disponible — la UI no debe romperse por un sonido.
describe('sounds', () => {
  beforeEach(() => { try { localStorage.clear(); } catch (_) {} });

  test('activado por defecto', () => {
    expect(isSoundsEnabled()).toBe(true);
  });

  test('setSoundsEnabled persiste on/off', () => {
    setSoundsEnabled(false);
    expect(isSoundsEnabled()).toBe(false);
    setSoundsEnabled(true);
    expect(isSoundsEnabled()).toBe(true);
  });

  test('playSound no lanza sin AudioContext y respeta el off', () => {
    setSoundsEnabled(false);
    expect(() => playSound('message')).not.toThrow();
    setSoundsEnabled(true);
    expect(() => playSound('giftReceived')).not.toThrow();
    expect(() => playSound('nombre-desconocido')).not.toThrow();
  });

  test('startIncomingCall/stopIncomingCall no lanzan', () => {
    expect(() => { startIncomingCall(); stopIncomingCall(); }).not.toThrow();
  });
});
