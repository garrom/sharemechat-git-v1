import React from 'react';
import { render, screen } from '@testing-library/react';
import { useMessageTranslations } from './useMessageTranslations';
import { translateBatch } from '../api/translationApi';

/**
 * ADR-059 Fase 4 (frontend): tests del hook `useMessageTranslations` (traductor
 * P2P, pending-hardening §5.3). Reglas: traduce SOLO mensajes recibidos (sender
 * != viewer), en lote (`translateBatch`), cachea, y SALTA si showOriginal /
 * disabled / sin idioma / gift / body vacío.
 *
 * Patrón de test de hooks en este repo (RTL v12, sin renderHook): un componente
 * HARNESS que consume el hook y pinta `getTranslation(probeId)` en el DOM. El
 * único borde de red es `translateBatch`, que se mockea.
 */

jest.mock('../api/translationApi', () => ({ translateBatch: jest.fn() }));

function Host({ probeId, ...opts }) {
  const { getTranslation } = useMessageTranslations(opts);
  return <div data-testid="out">{getTranslation(probeId) || 'NONE'}</div>;
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('useMessageTranslations', () => {
  test('traduce un mensaje recibido y lo expone por getTranslation', async () => {
    translateBatch.mockResolvedValue([{ messageId: 10, translatedText: 'hola-traducido' }]);
    render(
      <Host
        probeId={10}
        messages={[{ id: 10, senderId: 2, body: 'hello' }]}
        viewerId={1}
        viewerLang="es"
        enabled
        showOriginal={false}
      />
    );

    expect(await screen.findByText('hola-traducido')).toBeInTheDocument();
    expect(translateBatch).toHaveBeenCalledWith([10], 'es');
  });

  test('NO traduce los mensajes propios (senderId === viewerId)', () => {
    render(
      <Host
        probeId={11}
        messages={[{ id: 11, senderId: 1, body: 'mío' }]}
        viewerId={1}
        viewerLang="es"
        enabled
        showOriginal={false}
      />
    );

    expect(screen.getByTestId('out')).toHaveTextContent('NONE');
    expect(translateBatch).not.toHaveBeenCalled();
  });

  test('showOriginal activo: no traduce', () => {
    render(
      <Host
        probeId={12}
        messages={[{ id: 12, senderId: 2, body: 'hello' }]}
        viewerId={1}
        viewerLang="es"
        enabled
        showOriginal
      />
    );

    expect(screen.getByTestId('out')).toHaveTextContent('NONE');
    expect(translateBatch).not.toHaveBeenCalled();
  });

  test('disabled: no traduce', () => {
    render(
      <Host
        probeId={13}
        messages={[{ id: 13, senderId: 2, body: 'hello' }]}
        viewerId={1}
        viewerLang="es"
        enabled={false}
        showOriginal={false}
      />
    );

    expect(screen.getByTestId('out')).toHaveTextContent('NONE');
    expect(translateBatch).not.toHaveBeenCalled();
  });

  test('salta gifts y cuerpos vacíos (no genera peticiones)', () => {
    render(
      <Host
        probeId={14}
        messages={[
          { id: 14, senderId: 2, gift: true, body: '[[GIFT:5]]' },
          { id: 15, senderId: 2, body: '   ' },
        ]}
        viewerId={1}
        viewerLang="es"
        enabled
        showOriginal={false}
      />
    );

    expect(screen.getByTestId('out')).toHaveTextContent('NONE');
    expect(translateBatch).not.toHaveBeenCalled();
  });
});
