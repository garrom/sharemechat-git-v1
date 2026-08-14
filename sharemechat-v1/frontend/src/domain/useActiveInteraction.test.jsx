import React from 'react';
import { render, act } from '@testing-library/react';
import useActiveInteraction from './useActiveInteraction';
import { ACTIVE_INTERACTION_MODES, ACTIVE_INTERACTION_SOURCES } from './activeInteraction';

/**
 * ADR-059 Fase 4 (frontend): tests del hook core `useActiveInteraction` — la
 * máquina de estados de la interacción activa (idle / random / favorites-chat /
 * favorites-call). Lógica PURA sobre las factories de `./activeInteraction`
 * (que se usan REALES, no mockeadas: probamos las transiciones de verdad).
 *
 * Patrón hooks: un componente HARNESS que consume el hook y expone su API en una
 * variable capturada (`api`); las acciones se disparan dentro de `act(...)` y se
 * asertan sobre `api.interaction`, que apunta al último render tras el act.
 */

let api;
function Host({ initial }) {
  api = useActiveInteraction(initial);
  return null;
}
const mount = (initial) => render(<Host initial={initial} />);

const PEER = { userId: 3, role: 'model', nickname: 'Ana' };
const ACCEPTED = { status: 'active', invited: 'accepted', presence: 'online' };

describe('useActiveInteraction', () => {
  test('estado inicial: idle sin peer', () => {
    mount();
    expect(api.interaction.mode).toBe(ACTIVE_INTERACTION_MODES.IDLE);
    expect(api.interaction.peer).toBeNull();
  });

  test('activateRandomInteraction: pasa a RANDOM con el peer', () => {
    mount();
    act(() => api.activateRandomInteraction({ userId: 2, role: 'model' }));

    expect(api.interaction.mode).toBe(ACTIVE_INTERACTION_MODES.RANDOM);
    expect(api.interaction.peer.userId).toBe(2);
    expect(api.interaction.random.peerUserId).toBe(2);
    expect(api.interaction.source).toBe(ACTIVE_INTERACTION_SOURCES.RANDOM);
  });

  test('activateFavoritesCall: FAVORITES_CALL bloqueado al peer por defecto', () => {
    mount();
    act(() => api.activateFavoritesCall(PEER, ACCEPTED));

    expect(api.interaction.mode).toBe(ACTIVE_INTERACTION_MODES.FAVORITES_CALL);
    expect(api.interaction.peer.userId).toBe(3);
    expect(api.interaction.favoriteRelation.status).toBe('active');
    expect(api.interaction.call.lockedTarget).toBe(true);
    expect(api.interaction.call.lockedPeerId).toBe(3);
  });

  test('setIncomingCallInteraction: llamada entrante (incoming/callee, bloqueada)', () => {
    mount();
    act(() => api.setIncomingCallInteraction({ userId: 4 }, ACCEPTED));

    expect(api.interaction.mode).toBe(ACTIVE_INTERACTION_MODES.FAVORITES_CALL);
    expect(api.interaction.call.status).toBe('incoming');
    expect(api.interaction.call.role).toBe('callee');
    expect(api.interaction.call.lockedTarget).toBe(true);
    expect(api.interaction.call.lockedPeerId).toBe(4);
    expect(api.interaction.source).toBe(ACTIVE_INTERACTION_SOURCES.INCOMING_CALL);
  });

  test('markCallAcceptedOnInteraction: de entrante a in-call preservando el peer', () => {
    mount();
    act(() => api.setIncomingCallInteraction({ userId: 4 }, ACCEPTED));
    act(() => api.markCallAcceptedOnInteraction());

    expect(api.interaction.call.status).toBe('in-call');
    expect(api.interaction.peer.userId).toBe(4); // se preserva
  });

  test('lock/unlock target: fija y luego libera el peer', () => {
    mount();
    act(() => api.activateFavoritesChat(PEER, ACCEPTED));

    act(() => api.lockInteractionTarget(9));
    expect(api.interaction.call.lockedTarget).toBe(true);
    expect(api.interaction.call.lockedPeerId).toBe(9);

    act(() => api.unlockInteractionTarget());
    expect(api.interaction.call.lockedTarget).toBe(false);
    expect(api.interaction.call.lockedPeerId).toBeNull();
  });

  test('clearInteraction: vuelve a idle', () => {
    mount();
    act(() => api.activateFavoritesCall(PEER, ACCEPTED));
    act(() => api.clearInteraction());

    expect(api.interaction.mode).toBe(ACTIVE_INTERACTION_MODES.IDLE);
    expect(api.interaction.peer).toBeNull();
  });
});
