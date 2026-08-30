import {
  parseIceCandidateType,
  parseIceCandidateProtocol,
  getIceSignalLogDetails,
} from './iceObserver';

/**
 * Parsers puros de candidatos ICE (núcleo WebRTC). Sin red, alto valor:
 * un error aquí clasifica mal el tipo/protocolo del candidato y rompe el
 * diagnóstico de conexión sin que nada lo delate.
 */

const HOST = 'candidate:1 1 udp 2130706431 192.168.1.10 54321 typ host';
const SRFLX = 'candidate:2 1 udp 1677729535 1.2.3.4 51528 typ srflx raddr 0.0.0.0 rport 0';
const RELAY = 'candidate:3 1 tcp 999 5.6.7.8 3478 typ relay';

describe('parseIceCandidateType', () => {
  test('extrae el tipo tras el token typ', () => {
    expect(parseIceCandidateType(HOST)).toBe('host');
    expect(parseIceCandidateType(SRFLX)).toBe('srflx');
    expect(parseIceCandidateType(RELAY)).toBe('relay');
  });

  test('devuelve null si no hay typ, o entrada vacía/no-string', () => {
    expect(parseIceCandidateType('candidate:1 1 udp 999 1.2.3.4 5 foo bar')).toBeNull();
    expect(parseIceCandidateType('')).toBeNull();
    expect(parseIceCandidateType(null)).toBeNull();
    expect(parseIceCandidateType(42)).toBeNull();
  });

  test('devuelve null si typ está al final sin valor', () => {
    expect(parseIceCandidateType('candidate:1 1 udp 999 1.2.3.4 5 typ')).toBeNull();
  });
});

describe('parseIceCandidateProtocol', () => {
  test('devuelve el protocolo (parts[2])', () => {
    expect(parseIceCandidateProtocol(HOST)).toBe('udp');
    expect(parseIceCandidateProtocol(RELAY)).toBe('tcp');
  });

  test('devuelve null con menos de 3 partes o entrada vacía', () => {
    expect(parseIceCandidateProtocol('candidate:1 1')).toBeNull();
    expect(parseIceCandidateProtocol('')).toBeNull();
    expect(parseIceCandidateProtocol(null)).toBeNull();
  });
});

describe('getIceSignalLogDetails', () => {
  test('normaliza un signal con candidate string', () => {
    const d = getIceSignalLogDetails({ type: 'candidate', candidate: SRFLX });
    expect(d.signalType).toBe('candidate');
    expect(d.candidateType).toBe('srflx');
    expect(d.protocol).toBe('udp');
    expect(d.candidateEmpty).toBe(false);
  });

  test('acepta candidate como objeto {candidate: "..."}', () => {
    const d = getIceSignalLogDetails({ candidate: { candidate: HOST } });
    expect(d.signalType).toBe('candidate');
    expect(d.candidateType).toBe('host');
  });

  test('marca candidateEmpty cuando el tipo es candidate pero viene vacío', () => {
    const d = getIceSignalLogDetails({ type: 'candidate', candidate: null });
    expect(d.candidateEmpty).toBe(true);
    expect(d.candidateType).toBeNull();
  });

  test('un signal de tipo offer no se marca como candidato vacío', () => {
    const d = getIceSignalLogDetails({ type: 'offer' });
    expect(d.signalType).toBe('offer');
    expect(d.candidateEmpty).toBe(false);
  });
});
