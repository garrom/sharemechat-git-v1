import { useCallback, useRef, useState } from 'react';
import {
  ACTIVE_INTERACTION_MODES,
  ACTIVE_INTERACTION_SOURCES,
  createFavoritesCallInteraction,
  createFavoritesChatInteraction,
  createIdleInteraction,
  createRandomInteraction,
  normalizeFavoriteRelation,
  normalizePeerMeta,
} from './activeInteraction';

const toPositiveNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const normalizeInteractionState = (value) => {
  if (!value || typeof value !== 'object') {
    return createIdleInteraction();
  }

  const mode = value.mode;
  const peer = normalizePeerMeta(value.peer);
  const favoriteRelation = normalizeFavoriteRelation(value.favoriteRelation);

  if (mode === ACTIVE_INTERACTION_MODES.RANDOM) {
    return createRandomInteraction(peer, {
      source: value.source,
      streamRecordId: value?.random?.streamRecordId,
    });
  }

  if (mode === ACTIVE_INTERACTION_MODES.FAVORITES_CALL) {
    return createFavoritesCallInteraction(peer, favoriteRelation, {
      source: value.source,
      callStatus: value?.call?.status,
      callRole: value?.call?.role,
      lockedTarget: value?.call?.lockedTarget,
      lockedPeerId: value?.call?.lockedPeerId,
      streamRecordId: value?.call?.streamRecordId,
    });
  }

  if (mode === ACTIVE_INTERACTION_MODES.FAVORITES_CHAT) {
    return createFavoritesChatInteraction(peer, favoriteRelation, {
      source: value.source,
      callStatus: value?.call?.status,
      callRole: value?.call?.role,
      lockedTarget: value?.call?.lockedTarget,
      lockedPeerId: value?.call?.lockedPeerId,
      streamRecordId: value?.call?.streamRecordId,
    });
  }

  return createIdleInteraction();
};

export const useActiveInteraction = (initialInteraction) => {
  const initialState = normalizeInteractionState(initialInteraction);
  const [interactionState, setInteractionState] = useState(initialState);
  const interactionRef = useRef(initialState);

  const setInteraction = useCallback((nextValue) => {
    setInteractionState((prevValue) => {
      const resolvedValue =
        typeof nextValue === 'function' ? nextValue(prevValue) : nextValue;
      const normalizedValue = normalizeInteractionState(resolvedValue);
      interactionRef.current = normalizedValue;
      return normalizedValue;
    });
  }, []);

  const activateFavoritesChat = useCallback((peerMeta, favoriteRelation, options = {}) => {
    setInteraction(
      createFavoritesChatInteraction(peerMeta, favoriteRelation, {
        source: options.source || ACTIVE_INTERACTION_SOURCES.FAVORITES,
        callStatus: options.callStatus,
        callRole: options.callRole,
        lockedTarget: options.lockedTarget,
        lockedPeerId: options.lockedPeerId,
        streamRecordId: options.streamRecordId,
      })
    );
  }, [setInteraction]);

  const activateFavoritesCall = useCallback((peerMeta, favoriteRelation, options = {}) => {
    setInteraction(
      createFavoritesCallInteraction(peerMeta, favoriteRelation, {
        source: options.source || ACTIVE_INTERACTION_SOURCES.OUTGOING_CALL,
        callStatus: options.callStatus,
        callRole: options.callRole,
        lockedTarget: options.lockedTarget,
        lockedPeerId: options.lockedPeerId,
        streamRecordId: options.streamRecordId,
      })
    );
  }, [setInteraction]);

  const activateRandomInteraction = useCallback((peerMeta, options = {}) => {
    setInteraction(
      createRandomInteraction(peerMeta, {
        source: options.source || ACTIVE_INTERACTION_SOURCES.RANDOM,
        streamRecordId: options.streamRecordId,
      })
    );
  }, [setInteraction]);

  const setIncomingCallInteraction = useCallback((peerMeta, favoriteRelation, options = {}) => {
    setInteraction((prevInteraction) =>
      createFavoritesCallInteraction(
        peerMeta,
        favoriteRelation || prevInteraction?.favoriteRelation,
        {
          source: options.source || ACTIVE_INTERACTION_SOURCES.INCOMING_CALL,
          callStatus: options.callStatus || 'incoming',
          callRole: options.callRole || 'callee',
          lockedTarget: true,
          lockedPeerId:
            options.lockedPeerId ||
            normalizePeerMeta(peerMeta)?.userId ||
            null,
          streamRecordId: options.streamRecordId,
        }
      )
    );
  }, [setInteraction]);

  const markCallAcceptedOnInteraction = useCallback((options = {}) => {
    setInteraction((prevInteraction) => {
      if (!prevInteraction || !prevInteraction.peer) {
        return prevInteraction || createIdleInteraction();
      }

      return createFavoritesCallInteraction(
        prevInteraction.peer,
        prevInteraction.favoriteRelation,
        {
          source: options.source || prevInteraction.source,
          callStatus: options.callStatus || 'in-call',
          callRole: options.callRole || prevInteraction.call?.role,
          lockedTarget: true,
          lockedPeerId:
            options.lockedPeerId ||
            prevInteraction.call?.lockedPeerId ||
            prevInteraction.peer?.userId,
          streamRecordId:
            options.streamRecordId ||
            prevInteraction.call?.streamRecordId,
        }
      );
    });
  }, [setInteraction]);

  const syncFavoriteRelation = useCallback((favoriteRelation) => {
    const normalizedRelation = normalizeFavoriteRelation(favoriteRelation);

    setInteraction((prevInteraction) => {
      if (!prevInteraction || !prevInteraction.peer) {
        return prevInteraction || createIdleInteraction();
      }

      if (prevInteraction.mode === ACTIVE_INTERACTION_MODES.FAVORITES_CALL) {
        return createFavoritesCallInteraction(prevInteraction.peer, normalizedRelation, {
          source: prevInteraction.source,
          callStatus: prevInteraction.call?.status,
          callRole: prevInteraction.call?.role,
          lockedTarget: prevInteraction.call?.lockedTarget,
          lockedPeerId: prevInteraction.call?.lockedPeerId,
          streamRecordId: prevInteraction.call?.streamRecordId,
        });
      }

      if (prevInteraction.mode === ACTIVE_INTERACTION_MODES.FAVORITES_CHAT) {
        return createFavoritesChatInteraction(prevInteraction.peer, normalizedRelation, {
          source: prevInteraction.source,
          callStatus: prevInteraction.call?.status,
          callRole: prevInteraction.call?.role,
          lockedTarget: prevInteraction.call?.lockedTarget,
          lockedPeerId: prevInteraction.call?.lockedPeerId,
          streamRecordId: prevInteraction.call?.streamRecordId,
        });
      }

      return {
        ...prevInteraction,
        favoriteRelation: normalizedRelation,
      };
    });
  }, [setInteraction]);

  const lockInteractionTarget = useCallback((peerId) => {
    setInteraction((prevInteraction) => {
      if (!prevInteraction || !prevInteraction.peer) {
        return prevInteraction || createIdleInteraction();
      }

      const lockedPeerId =
        toPositiveNumber(peerId) ||
        toPositiveNumber(prevInteraction.peer?.userId) ||
        null;

      return {
        ...prevInteraction,
        call: {
          ...(prevInteraction.call || {}),
          status: prevInteraction.call?.status || 'idle',
          role: prevInteraction.call?.role || null,
          lockedTarget: true,
          lockedPeerId,
          streamRecordId: prevInteraction.call?.streamRecordId || null,
        },
      };
    });
  }, [setInteraction]);

  const unlockInteractionTarget = useCallback(() => {
    setInteraction((prevInteraction) => {
      if (!prevInteraction || !prevInteraction.peer) {
        return prevInteraction || createIdleInteraction();
      }

      return {
        ...prevInteraction,
        call: {
          ...(prevInteraction.call || {}),
          status: prevInteraction.call?.status || 'idle',
          role: prevInteraction.call?.role || null,
          lockedTarget: false,
          lockedPeerId: null,
          streamRecordId: prevInteraction.call?.streamRecordId || null,
        },
      };
    });
  }, [setInteraction]);

  const clearInteraction = useCallback(() => {
    setInteraction(createIdleInteraction());
  }, [setInteraction]);

  const interaction = interactionState;

  return {
    interaction,
    setInteraction,
    interactionRef,
    activateFavoritesChat,
    activateFavoritesCall,
    activateRandomInteraction,
    setIncomingCallInteraction,
    markCallAcceptedOnInteraction,
    syncFavoriteRelation,
    lockInteractionTarget,
    unlockInteractionTarget,
    clearInteraction,
  };
};

export default useActiveInteraction;
