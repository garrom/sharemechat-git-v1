import React from 'react';
import {
  ItemCard, Avatar, Info, Name, Meta, Actions, Btn,
} from '../../../styles/features/FavoritesStyles';

const resolveProfilePic = (user = {}, ctx = 'FavoriteItem') => {
  const pick = {
    profilePic: user?.profilePic,
    urlPic: user?.urlPic ?? user?.url_pic,
    pic: user?.pic,
    avatar: user?.avatar,
    photo: user?.photo,
    docs_urlPic:
      user?.documents?.urlPic ??
      user?.documents?.url_pic ??
      user?.modelDocuments?.urlPic ??
      user?.model_documents?.url_pic ??
      user?.clientDocuments?.urlPic ??
      user?.client_documents?.url_pic,
  };
  const result =
    pick.profilePic || pick.urlPic || pick.pic || pick.avatar || pick.photo || pick.docs_urlPic || null;

  try { console.debug(`[avatar][${ctx}]`, { userId: user?.id, nickname: user?.nickname, chosen: result, picks: pick }); } catch {}
  return result;
};

const FavoriteItem = ({ user, onClick, onRemove, removing, onChat }) => {
  const handleChat = (e) => {
    e.stopPropagation();
    if (onChat) onChat(user);
    else window.dispatchEvent(new CustomEvent('open-fav-chat', { detail: { user } }));
  };

  const avatar = resolveProfilePic(user, 'FavoriteItem') || '/img/avatar.png';

  return (
    <ItemCard $clickable={!!onClick} onClick={() => onClick && onClick(user)}>
      <Avatar
        src={avatar}
        alt={user.nickname || user.email || 'user'}
        onError={(e) => { e.currentTarget.src = '/img/avatar.png'; }}
      />
      <Info>
        <Name>{user.nickname || user.name || user.email || `Usuario ${user.id}`}</Name>
        <Meta>{user.role || user.userType || ''}</Meta>
      </Info>

      <Actions>
        <Btn type="button" onClick={handleChat}>Chatear</Btn>
        {onRemove && (
          <Btn
            type="button"
            onClick={(e) => { e.stopPropagation(); onRemove(user); }}
            disabled={removing}
            aria-label="Quitar de favoritos"
            title="Quitar de favoritos"
          >
            {removing ? 'Quitando…' : 'Quitar'}
          </Btn>
        )}
      </Actions>
    </ItemCard>
  );
};

export default FavoriteItem;
