//FavoriteItem.jsx
import React from 'react';
import {
  ItemCard, Avatar, Info, Name, Meta, Actions, Btn,
} from '../../styles/pages-styles/FavoritesStyles';

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
    if (user?.blocked) return;
    if (onChat) onChat(user);
    else window.dispatchEvent(new CustomEvent('open-fav-chat', { detail: { user } }));
  };

  const role = String(user?.role || user?.userType || '').toUpperCase();
  const fallback = role === 'MODEL' ? '/img/avatarChica.png' : '/img/avatarChico.png';
  const avatar = resolveProfilePic(user, 'FavoriteItem') || fallback;


  return (
    <ItemCard
      $clickable={!!onClick && !user?.blocked}
      data-disabled={user?.blocked ? 'true' : 'false'}
      onClick={() => {
        if (user?.blocked) return;
        onClick && onClick(user);
      }}
    >
      <Avatar
        src={avatar}
        alt={user.nickname || user.email || 'user'}
        onError={(e) => {
          const r = String(user?.role || user?.userType || '').toUpperCase();
          e.currentTarget.src = r === 'MODEL' ? '/img/avatarChica.png' : '/img/avatarChico.png';
        }}
      />
      <Info>
        <Name>{user.nickname || user.name || user.email || `Usuario ${user.id}`}</Name>
        <Meta>
          {user.role || user.userType || ''}
        </Meta>

      </Info>

      <Actions>
        <Btn
          type="button"
          onClick={handleChat}
          disabled={user?.blocked}
          title={user?.blocked ? 'Usuario bloqueado' : 'Chatear'}
        >
          Chatear
        </Btn>
        {onRemove && (
          <Btn
            type="button"
            onClick={(e) => { e.stopPropagation(); if (user?.blocked) return; onRemove(user); }}
            disabled={removing || user?.blocked}
            aria-label="Quitar de favoritos"
            title={user?.blocked ? 'Usuario bloqueado' : 'Quitar de favoritos'}
          >
            {removing ? 'Quitando…' : 'Quitar'}
          </Btn>

        )}
        {user?.blocked && (
          <Btn
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              window.dispatchEvent(
                new CustomEvent('unblock-user', { detail: { user } })
              );
            }}
            title="Desbloquear usuario"
          >
            Desbloquear
          </Btn>
        )}

      </Actions>
    </ItemCard>
  );
};

export default FavoriteItem;
