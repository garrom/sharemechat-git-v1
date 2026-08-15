import {
  normalizePeerMeta,
  normalizeFavoriteRelation,
  buildActionTarget,
  getInteractionPeerId,
  isSameInteractionPeer,
  isInteractionLocked,
  canSendInteractionMessage,
  canSendInteractionGift,
  canStartInteractionCall,
  createIdleInteraction,
  createRandomInteraction,
  createFavoritesChatInteraction,
  createFavoritesCallInteraction,
} from './activeInteraction';

/**
 * ADR-059 Fase 4 (frontend): tests de los HELPERS PUROS de dominio de la
 * interacción (`activeInteraction`). Son funciones sin estado que gatean la
 * lógica de negocio de favoritos: quién es el peer, si está bloqueado, y sobre
 * todo si se puede MENSAJEAR / REGALAR / LLAMAR (solo con relación de favorito
 * ACEPTADA). Unit test directo, sin React.
 */

const ACCEPTED = { status: 'active', invited: 'accepted', presence: 'online' };
const PENDING = { status: 'active', invited: 'pending', presence: 'online' };

describe('activeInteraction · normalizePeerMeta', () => {
  test('normaliza objeto con userId y elige displayName por precedencia', () => {
    expect(normalizePeerMeta({ userId: 5, nickname: 'Ana', role: 'model' })).toEqual({
      userId: 5,
      role: 'model',
      displayName: 'Ana',
      avatarUrl: null,
    });
    // displayName gana sobre nickname; email como último recurso.
    expect(normalizePeerMeta({ userId: 1, displayName: 'D', nickname: 'N' }).displayName).toBe('D');
    expect(normalizePeerMeta({ userId: 1, email: 'e@x.com' }).displayName).toBe('e@x.com');
  });

  test('acepta id / peerUserId / número suelto, y devuelve null sin id válido', () => {
    expect(normalizePeerMeta({ id: 7 }).userId).toBe(7);
    expect(normalizePeerMeta({ peerUserId: 9 }).userId).toBe(9);
    expect(normalizePeerMeta(3)).toEqual({ userId: 3, role: null, displayName: null, avatarUrl: null });
    expect(normalizePeerMeta({ role: 'x' })).toBeNull();
    expect(normalizePeerMeta(null)).toBeNull();
    expect(normalizePeerMeta({ userId: 0 })).toBeNull(); // no positivo
  });
});

describe('activeInteraction · normalizeFavoriteRelation', () => {
  test('normaliza status/invited/presence; vacío -> null', () => {
    expect(normalizeFavoriteRelation(ACCEPTED)).toEqual({
      status: 'active', invited: 'accepted', presence: 'online',
    });
    expect(normalizeFavoriteRelation({})).toBeNull();
    expect(normalizeFavoriteRelation(null)).toBeNull();
  });
});

describe('activeInteraction · buildActionTarget', () => {
  test('respeta los flags allow* (message/gift ON por defecto, call OFF)', () => {
    expect(buildActionTarget({ userId: 2 })).toEqual({
      peerUserId: 2, messageToUserId: 2, giftToUserId: 2, callToUserId: null,
    });
    expect(buildActionTarget({ userId: 2 }, { allowMessage: false, allowGift: false, allowCall: true })).toEqual({
      peerUserId: 2, messageToUserId: null, giftToUserId: null, callToUserId: 2,
    });
  });
});

describe('activeInteraction · getInteractionPeerId / isSameInteractionPeer', () => {
  test('resuelve el peerId desde peer/random y compara', () => {
    const random = createRandomInteraction({ userId: 4 });
    expect(getInteractionPeerId(random)).toBe(4);
    expect(getInteractionPeerId(createIdleInteraction())).toBeNull();

    expect(isSameInteractionPeer(random, 4)).toBe(true);
    expect(isSameInteractionPeer(random, { userId: 4 })).toBe(true);
    expect(isSameInteractionPeer(random, 5)).toBe(false);
  });
});

describe('activeInteraction · isInteractionLocked', () => {
  test('true si lockedTarget o lockedPeerId; false en idle/random', () => {
    expect(isInteractionLocked(createFavoritesCallInteraction({ userId: 3 }, ACCEPTED))).toBe(true);
    expect(isInteractionLocked(createIdleInteraction())).toBe(false);
    expect(isInteractionLocked(createRandomInteraction({ userId: 2 }))).toBe(false);
  });
});

describe('activeInteraction · gates can* (mensajear/regalar/llamar)', () => {
  test('favoritos con relación ACEPTADA: permite mensajear, regalar y llamar', () => {
    const chat = createFavoritesChatInteraction({ userId: 3 }, ACCEPTED);
    expect(canSendInteractionMessage(chat)).toBe(true);
    expect(canSendInteractionGift(chat)).toBe(true);
    expect(canStartInteractionCall(chat)).toBe(true);
  });

  test('favoritos con relación NO aceptada (invited pending): bloquea todo', () => {
    const chat = createFavoritesChatInteraction({ userId: 3 }, PENDING);
    expect(canSendInteractionMessage(chat)).toBe(false);
    expect(canSendInteractionGift(chat)).toBe(false);
    expect(canStartInteractionCall(chat)).toBe(false);
  });

  test('random / idle: nunca permite mensajear/regalar/llamar', () => {
    const random = createRandomInteraction({ userId: 3 });
    expect(canSendInteractionMessage(random)).toBe(false);
    expect(canSendInteractionGift(random)).toBe(false);
    expect(canStartInteractionCall(random)).toBe(false);
    expect(canSendInteractionMessage(createIdleInteraction())).toBe(false);
  });
});
