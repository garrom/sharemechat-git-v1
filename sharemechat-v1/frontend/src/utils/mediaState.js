export function createIdleMediaState(lastReason = 'idle') {
  return {
    status: 'idle',
    streamId: null,
    videoTrackId: null,
    hasVideoTrack: false,
    readyState: null,
    enabled: null,
    muted: null,
    lastReason,
    updatedAt: Date.now(),
  };
}

export function createMediaStateSnapshot(stream, options = {}) {
  const videoTrack = getPrimaryVideoTrack(stream);
  const hasVideoTrack = !!videoTrack;

  let status = options.status;
  if (!status) {
    if (!stream) {
      status = 'idle';
    } else if (!hasVideoTrack) {
      status = 'degraded';
    } else if (videoTrack.readyState !== 'live') {
      status = 'degraded';
    } else if (videoTrack.muted) {
      status = 'degraded';
    } else {
      status = 'live';
    }
  }

  return {
    status,
    streamId: stream?.id ?? null,
    videoTrackId: videoTrack?.id ?? null,
    hasVideoTrack,
    readyState: videoTrack?.readyState ?? null,
    enabled: typeof videoTrack?.enabled === 'boolean' ? videoTrack.enabled : null,
    muted: typeof videoTrack?.muted === 'boolean' ? videoTrack.muted : null,
    lastReason: options.lastReason ?? null,
    updatedAt: options.updatedAt ?? Date.now(),
  };
}

export function resetMediaObserver(cleanupRef) {
  try {
    cleanupRef?.current?.();
  } catch {}
  if (cleanupRef) {
    cleanupRef.current = () => {};
  }
}

export function attachMediaObserver(stream, setState, cleanupRef, initialReason) {
  resetMediaObserver(cleanupRef);
  if (!cleanupRef) {
    return;
  }
  cleanupRef.current = observePrimaryVideoTrack(
    stream,
    (nextState) => setState(nextState),
    { initialReason }
  );
}

export function observePrimaryVideoTrack(stream, onState, options = {}) {
  if (typeof onState !== 'function') {
    return () => {};
  }

  if (!stream) {
    onState(createMediaStateSnapshot(null, {
      status: options.statusWhenMissingStream || 'idle',
      lastReason: options.initialReason || 'stream:missing',
    }));
    return () => {};
  }

  const videoTrack = getPrimaryVideoTrack(stream);
  if (!videoTrack) {
    onState(createMediaStateSnapshot(stream, {
      status: 'degraded',
      lastReason: options.initialReason || 'video-track:missing',
    }));
    return () => {};
  }

  const emit = (status, lastReason) => {
    onState(createMediaStateSnapshot(stream, { status, lastReason }));
  };

  emit(
    videoTrack.readyState === 'live' && !videoTrack.muted ? 'live' : 'degraded',
    options.initialReason || 'observer:attached'
  );

  const handleEnded = () => emit('lost', 'track:ended');
  const handleMute = () => emit('degraded', 'track:mute');
  const handleUnmute = () => emit(videoTrack.readyState === 'live' ? 'live' : 'degraded', 'track:unmute');

  videoTrack.addEventListener?.('ended', handleEnded);
  videoTrack.addEventListener?.('mute', handleMute);
  videoTrack.addEventListener?.('unmute', handleUnmute);

  return () => {
    videoTrack.removeEventListener?.('ended', handleEnded);
    videoTrack.removeEventListener?.('mute', handleMute);
    videoTrack.removeEventListener?.('unmute', handleUnmute);
  };
}

export function getPrimaryVideoTrack(stream) {
  const tracks = typeof stream?.getVideoTracks === 'function' ? stream.getVideoTracks() : [];
  return Array.isArray(tracks) && tracks.length > 0 ? tracks[0] : null;
}
