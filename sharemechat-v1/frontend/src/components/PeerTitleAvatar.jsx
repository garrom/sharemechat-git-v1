import React from 'react';
import { StyledTitleAvatar, StyledTitleInitial } from '../styles/pages-styles/VideochatStyles';
import { initialOf } from '../utils/defaultAvatar';

// Avatar del peer en la cabecera del chat/llamada (sobre el vídeo).
// - Con foto  -> <img> circular (StyledTitleAvatar).
// - Sin foto  -> círculo con la inicial del nickname (StyledTitleInitial).
// NUNCA usa la silueta negra: esa queda reservada al avatar propio del navbar.
export default function PeerTitleAvatar({ photoUrl, name, style }) {
  if (photoUrl) {
    return <StyledTitleAvatar src={photoUrl} alt="" style={style} />;
  }
  return (
    <StyledTitleInitial style={style} aria-hidden="true">
      {initialOf(name)}
    </StyledTitleInitial>
  );
}
