import React from 'react';
import { render, act } from '@testing-library/react';
import { useTranslationSettings } from './useTranslationSettings';
import { getTranslationConfig } from '../api/translationApi';

/**
 * ADR-059 Fase 4 (frontend): tests del hook `useTranslationSettings` (traductor
 * P2P, §5.3). Carga la config de traducción (async), persiste el toggle
 * `showOriginal` en localStorage, y resuelve `viewerLang` con precedencia
 * (preferredChatLang > uiLocale). Mock del seam `getTranslationConfig`;
 * localStorage real de jsdom.
 */

jest.mock('../api/translationApi', () => ({ getTranslationConfig: jest.fn() }));

const KEY = 'sharemechat.chat.showOriginal';

let ts;
function Host({ viewerUser = null }) {
  ts = useTranslationSettings(viewerUser);
  return null;
}
const flush = () => act(async () => {});

beforeEach(() => {
  jest.clearAllMocks();
  window.localStorage.clear();
  getTranslationConfig.mockResolvedValue({ enabled: true, provider: 'google', langs: ['es', 'en'] });
});

describe('useTranslationSettings', () => {
  test('carga la config de traducción', async () => {
    render(<Host />);
    await flush();
    expect(ts.loading).toBe(false);
    expect(ts.enabled).toBe(true);
    expect(ts.provider).toBe('google');
    expect(ts.supportedLangs).toEqual(['es', 'en']);
  });

  test('config falla: la feature queda apagada (enabled=false), sin error visible', async () => {
    getTranslationConfig.mockRejectedValue(new Error('down'));
    render(<Host />);
    await flush();
    expect(ts.enabled).toBe(false);
    expect(ts.loading).toBe(false);
  });

  test('showOriginal se inicializa desde localStorage', async () => {
    window.localStorage.setItem(KEY, 'true');
    render(<Host />);
    await flush();
    expect(ts.showOriginal).toBe(true);
  });

  test('setShowOriginal / toggleShowOriginal persisten en localStorage', async () => {
    render(<Host />);
    await flush();

    act(() => ts.setShowOriginal(true));
    expect(ts.showOriginal).toBe(true);
    expect(window.localStorage.getItem(KEY)).toBe('true');

    act(() => ts.toggleShowOriginal());
    expect(ts.showOriginal).toBe(false);
    expect(window.localStorage.getItem(KEY)).toBe('false');
  });

  test('viewerLang: preferredChatLang gana sobre uiLocale; null si ninguno', async () => {
    render(<Host viewerUser={{ preferredChatLang: 'fr', uiLocale: 'es' }} />);
    await flush();
    expect(ts.viewerLang).toBe('fr');

    render(<Host viewerUser={{ uiLocale: 'es' }} />);
    await flush();
    expect(ts.viewerLang).toBe('es');

    render(<Host viewerUser={{}} />);
    await flush();
    expect(ts.viewerLang).toBeNull();
  });
});
