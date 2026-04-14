function parseTokenFromCandidate(candidateValue, token) {
  if (typeof candidateValue !== 'string' || !candidateValue.trim()) {
    return null;
  }

  const parts = candidateValue.trim().split(/\s+/);
  const index = parts.indexOf(token);
  if (index === -1 || index + 1 >= parts.length) {
    return null;
  }

  return parts[index + 1] || null;
}

export function parseIceCandidateType(candidateValue) {
  return parseTokenFromCandidate(candidateValue, 'typ');
}

export function parseIceCandidateProtocol(candidateValue) {
  if (typeof candidateValue !== 'string' || !candidateValue.trim()) {
    return null;
  }

  const parts = candidateValue.trim().split(/\s+/);
  return parts.length >= 3 ? parts[2] : null;
}

export function getIceSignalLogDetails(signal) {
  const signalType = signal?.type || (signal?.candidate ? 'candidate' : 'unknown');
  const candidatePayload =
    typeof signal?.candidate === 'string'
      ? signal.candidate
      : signal?.candidate?.candidate || null;

  return {
    signalType,
    candidateValue: candidatePayload,
    candidateType: parseIceCandidateType(candidatePayload),
    protocol: parseIceCandidateProtocol(candidatePayload),
    candidateEmpty: signalType === 'candidate' ? !candidatePayload : false,
  };
}

function describeSelectedPair(localType, remoteType) {
  const types = [localType, remoteType].filter(Boolean);

  if (types.includes('relay')) {
    return 'ICE selected pair: relay (TURN)';
  }
  if (types.includes('srflx') || types.includes('prflx')) {
    return 'ICE selected pair: srflx (STUN)';
  }
  if (types.includes('host')) {
    return 'ICE selected pair: host (direct)';
  }

  return 'ICE selected pair: unknown';
}

async function collectSelectedIcePair(pc) {
  if (!pc || typeof pc.getStats !== 'function') {
    return null;
  }

  const stats = await pc.getStats();
  let selectedPair = null;

  for (const report of stats.values()) {
    if (report.type === 'transport' && report.selectedCandidatePairId) {
      selectedPair = stats.get(report.selectedCandidatePairId) || null;
      if (selectedPair) break;
    }
  }

  if (!selectedPair) {
    for (const report of stats.values()) {
      if (report.type !== 'candidate-pair') continue;
      if (report.selected || (report.nominated && report.state === 'succeeded')) {
        selectedPair = report;
        break;
      }
    }
  }

  if (!selectedPair) {
    return null;
  }

  const localCandidate = selectedPair.localCandidateId
    ? stats.get(selectedPair.localCandidateId) || null
    : null;
  const remoteCandidate = selectedPair.remoteCandidateId
    ? stats.get(selectedPair.remoteCandidateId) || null
    : null;

  const localType = localCandidate?.candidateType || null;
  const remoteType = remoteCandidate?.candidateType || null;
  const protocol = selectedPair.protocol || localCandidate?.protocol || remoteCandidate?.protocol || null;
  const relayProtocol =
    localCandidate?.relayProtocol || remoteCandidate?.relayProtocol || selectedPair.relayProtocol || null;

  return {
    summary: describeSelectedPair(localType, remoteType),
    localType,
    remoteType,
    protocol,
    relayProtocol,
    pairId: selectedPair.id || null,
    pairState: selectedPair.state || null,
    key: [
      selectedPair.id || 'pair',
      selectedPair.state || 'unknown',
      localType || 'unknown',
      remoteType || 'unknown',
      protocol || 'unknown',
      relayProtocol || 'none',
    ].join('|'),
  };
}

export function createSelectedIcePairLogger(logPrefix) {
  let lastKey = null;

  return async (pc) => {
    try {
      const summary = await collectSelectedIcePair(pc);
      if (!summary || summary.key === lastKey) {
        return;
      }

      lastKey = summary.key;
      console.log(
        `[ICE_TRACE] ts=${Date.now()} ${logPrefix} ${summary.summary} localType=${summary.localType || 'unknown'} remoteType=${summary.remoteType || 'unknown'} protocol=${summary.protocol || 'unknown'} relayProtocol=${summary.relayProtocol || 'n/a'} pairState=${summary.pairState || 'unknown'} pairId=${summary.pairId || 'unknown'}`
      );
    } catch (error) {
      console.warn(
        `[ICE_TRACE] ts=${Date.now()} ${logPrefix} ICE selected pair stats failed error=${error?.message || 'unknown'}`
      );
    }
  };
}

export function attachIceDebugObservers({ pc, logPrefix, onStateChange, logSelectedPair }) {
  if (!pc || typeof pc.addEventListener !== 'function') {
    return;
  }

  pc.addEventListener('icecandidate', (event) => {
    const candidate = event?.candidate;
    if (!candidate) {
      console.log(
        `[ICE_TRACE] ts=${Date.now()} ${logPrefix} event=icecandidate candidateType=end-of-candidates`
      );
      return;
    }

    const candidateType = candidate.type || parseIceCandidateType(candidate.candidate);
    const protocol = candidate.protocol || parseIceCandidateProtocol(candidate.candidate);
    console.log(
      `[ICE_TRACE] ts=${Date.now()} ${logPrefix} event=icecandidate candidateType=${candidateType || 'unknown'} protocol=${protocol || 'unknown'}`
    );
  });

  const emitState = () => {
    try {
      onStateChange?.();
    } catch {}
    try {
      logSelectedPair?.(pc);
    } catch {}
  };

  pc.addEventListener('iceconnectionstatechange', emitState);
  pc.addEventListener('connectionstatechange', emitState);
  pc.addEventListener('icegatheringstatechange', emitState);
  pc.addEventListener('signalingstatechange', emitState);
}
