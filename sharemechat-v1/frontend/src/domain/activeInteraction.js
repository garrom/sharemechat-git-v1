const MODE_IDLE = 'idle';
const MODE_RANDOM = 'random';
const MODE_FAVORITES_CHAT = 'favorites-chat';
const MODE_FAVORITES_CALL = 'favorites-call';

const SOURCE_NONE = 'none';
const SOURCE_RANDOM = 'random';
const SOURCE_FAVORITES = 'favorites';
const SOURCE_INCOMING_CALL = 'incoming-call';
const SOURCE_OUTGOING_CALL = 'outgoing-call';

const CALL_STATUS_IDLE = 'idle';

const toPositiveNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const toCleanString = (value) => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

const pickDisplayName = (value) => {
  if (!value || typeof value !== 'object') return null;

  return (
    toCleanString(value.displayName) ||
    toCleanString(value.peerName) ||
    toCleanString(value.name) ||
    toCleanString(value.nickname) ||
    toCleanString(value.email) ||
    null
  );
};

const isAcceptedFavoriteRelation = (relation) => {
  return (
    String(relation?.status || '').toLowerCase() === 'active' &&
    String(relation?.invited || '').toLowerCase() === 'accepted'
  );
};

export const ACTIVE_INTERACTION_MODES = {
  IDLE: MODE_IDLE,
  RANDOM: MODE_RANDOM,
  FAVORITES_CHAT: MODE_FAVORITES_CHAT,
  FAVORITES_CALL: MODE_FAVORITES_CALL,
};

export const ACTIVE_INTERACTION_SOURCES = {
  NONE: SOURCE_NONE,
  RANDOM: SOURCE_RANDOM,
  FAVORITES: SOURCE_FAVORITES,
  INCOMING_CALL: SOURCE_INCOMING_CALL,
  OUTGOING_CALL: SOURCE_OUTGOING_CALL,
};

export const normalizePeerMeta = (value) => {
  if (value == null) return null;

  const raw = typeof value === 'object' ? value : { userId: value };
  const userId =
    toPositiveNumber(raw.userId) ||
    toPositiveNumber(raw.id) ||
    toPositiveNumber(raw.peerUserId);

  if (!userId) return null;

  return {
    userId,
    role: toCleanString(raw.role) || toCleanString(raw.peerRole) || null,
    displayName: pickDisplayName(raw),
    avatarUrl:
      toCleanString(raw.avatarUrl) ||
      toCleanString(raw.avatar) ||
      toCleanString(raw.profilePic) ||
      null,
  };
};

export const normalizeFavoriteRelation = (value) => {
  if (!value || typeof value !== 'object') return null;

  const status = toCleanString(value.status);
  const invited = toCleanString(value.invited);
  const presence = toCleanString(value.presence);

  if (!status && !invited && !presence) return null;

  return {
    status: status || null,
    invited: invited || null,
    presence: presence || null,
  };
};

export const buildActionTarget = (peerOrId, options = {}) => {
  const peer = normalizePeerMeta(peerOrId);
  const peerId = peer?.userId || null;
  const allowMessage = options.allowMessage !== false;
  const allowGift = options.allowGift !== false;
  const allowCall = options.allowCall === true;

  return {
    peerUserId: peerId,
    messageToUserId: allowMessage ? peerId : null,
    giftToUserId: allowGift ? peerId : null,
    callToUserId: allowCall ? peerId : null,
  };
};

export const createIdleInteraction = () => {
  return {
    mode: MODE_IDLE,
    source: SOURCE_NONE,
    peer: null,
    favoriteRelation: null,
    actionTarget: buildActionTarget(null, {
      allowMessage: false,
      allowGift: false,
      allowCall: false,
    }),
    call: {
      status: CALL_STATUS_IDLE,
      role: null,
      lockedTarget: false,
      lockedPeerId: null,
      streamRecordId: null,
    },
    random: null,
  };
};

export const createFavoritesChatInteraction = (peerMeta, favoriteRelation, options = {}) => {
  const peer = normalizePeerMeta(peerMeta);
  const relation = normalizeFavoriteRelation(favoriteRelation);
  const allowMessaging = isAcceptedFavoriteRelation(relation);

  return {
    mode: MODE_FAVORITES_CHAT,
    source: toCleanString(options.source) || SOURCE_FAVORITES,
    peer,
    favoriteRelation: relation,
    actionTarget: buildActionTarget(peer, {
      allowMessage: allowMessaging,
      allowGift: allowMessaging,
      allowCall: allowMessaging,
    }),
    call: {
      status: toCleanString(options.callStatus) || CALL_STATUS_IDLE,
      role: toCleanString(options.callRole) || null,
      lockedTarget: options.lockedTarget === true,
      lockedPeerId:
        toPositiveNumber(options.lockedPeerId) ||
        (options.lockedTarget === true ? peer?.userId || null : null),
      streamRecordId: toPositiveNumber(options.streamRecordId),
    },
    random: null,
  };
};

export const createFavoritesCallInteraction = (peerMeta, favoriteRelation, options = {}) => {
  const peer = normalizePeerMeta(peerMeta);
  const relation = normalizeFavoriteRelation(favoriteRelation);
  const allowMessaging = isAcceptedFavoriteRelation(relation);

  return {
    mode: MODE_FAVORITES_CALL,
    source: toCleanString(options.source) || SOURCE_FAVORITES,
    peer,
    favoriteRelation: relation,
    actionTarget: buildActionTarget(peer, {
      allowMessage: allowMessaging,
      allowGift: allowMessaging,
      allowCall: allowMessaging,
    }),
    call: {
      status: toCleanString(options.callStatus) || CALL_STATUS_IDLE,
      role: toCleanString(options.callRole) || null,
      lockedTarget: options.lockedTarget !== false,
      lockedPeerId:
        toPositiveNumber(options.lockedPeerId) ||
        peer?.userId ||
        null,
      streamRecordId: toPositiveNumber(options.streamRecordId),
    },
    random: null,
  };
};

export const createRandomInteraction = (peerMeta, options = {}) => {
  const peer = normalizePeerMeta(peerMeta);

  return {
    mode: MODE_RANDOM,
    source: toCleanString(options.source) || SOURCE_RANDOM,
    peer,
    favoriteRelation: null,
    actionTarget: buildActionTarget(peer, {
      allowMessage: false,
      allowGift: false,
      allowCall: false,
    }),
    call: {
      status: CALL_STATUS_IDLE,
      role: null,
      lockedTarget: false,
      lockedPeerId: null,
      streamRecordId: null,
    },
    random: peer
      ? {
          peerUserId: peer.userId,
          peerRole: peer.role,
          streamRecordId: toPositiveNumber(options.streamRecordId),
        }
      : null,
  };
};

export const getInteractionPeerId = (interaction) => {
  return (
    toPositiveNumber(interaction?.peer?.userId) ||
    toPositiveNumber(interaction?.random?.peerUserId) ||
    toPositiveNumber(interaction?.actionTarget?.peerUserId) ||
    null
  );
};

export const isSameInteractionPeer = (interaction, peerOrId) => {
  const currentPeerId = getInteractionPeerId(interaction);
  const candidatePeerId = normalizePeerMeta(peerOrId)?.userId || toPositiveNumber(peerOrId);

  if (!currentPeerId || !candidatePeerId) return false;
  return currentPeerId === candidatePeerId;
};

export const isInteractionLocked = (interaction) => {
  if (!interaction || typeof interaction !== 'object') return false;

  if (interaction.call?.lockedTarget === true) return true;
  return toPositiveNumber(interaction.call?.lockedPeerId) != null;
};

export const canSendInteractionMessage = (interaction) => {
  if (!interaction || typeof interaction !== 'object') return false;

  if (
    interaction.mode === MODE_FAVORITES_CHAT ||
    interaction.mode === MODE_FAVORITES_CALL
  ) {
    return (
      isAcceptedFavoriteRelation(interaction.favoriteRelation) &&
      toPositiveNumber(interaction.actionTarget?.messageToUserId) != null
    );
  }

  return false;
};

export const canSendInteractionGift = (interaction) => {
  if (!interaction || typeof interaction !== 'object') return false;

  if (
    interaction.mode === MODE_FAVORITES_CHAT ||
    interaction.mode === MODE_FAVORITES_CALL
  ) {
    return (
      isAcceptedFavoriteRelation(interaction.favoriteRelation) &&
      toPositiveNumber(interaction.actionTarget?.giftToUserId) != null
    );
  }

  return false;
};

export const canStartInteractionCall = (interaction) => {
  if (!interaction || typeof interaction !== 'object') return false;

  if (
    interaction.mode !== MODE_FAVORITES_CHAT &&
    interaction.mode !== MODE_FAVORITES_CALL
  ) {
    return false;
  }

  return (
    isAcceptedFavoriteRelation(interaction.favoriteRelation) &&
    toPositiveNumber(interaction.actionTarget?.callToUserId) != null
  );
};
