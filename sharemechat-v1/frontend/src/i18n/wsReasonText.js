export function getWsReasonKey(reasonCode) {
  if (!reasonCode) return null;

  switch (reasonCode) {
    case 'LANGUAGE_MATCH_PRIMARY':
      return 'ws.match.language.primary';

    case 'LANGUAGE_MATCH_SHARED':
      return 'ws.match.language.shared';

    case 'LANGUAGE_MATCH_FALLBACK':
      return 'ws.match.language.fallback';

    case 'NO_SUPPLY_MODELS':
      return 'ws.noModel.supply';

    case 'NO_SUPPLY_CLIENTS':
      return 'ws.noClient.supply';

    case 'NO_MATCH_FOUND':
      return 'ws.noMatch.found';

    default:
      return 'ws.unknown';
  }
}
