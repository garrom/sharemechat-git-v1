//FavoriteItem.jsx
import React, { useState } from 'react';
import i18n from '../../i18n';
import { initialOf } from '../../utils/defaultAvatar';
import {
  ItemCard, Avatar, LetterAvatar, Info, Name, Meta, Actions, Btn,
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

  const [imgFailed, setImgFailed] = useState(false);
  const photo = resolveProfilePic(user, 'FavoriteItem');
  const hasPhoto = !!photo && !imgFailed;
  const initialName = user?.nickname || user?.name || user?.email;


  return (
    <ItemCard
      $clickable={!!onClick && !user?.blocked}
      data-disabled={user?.blocked ? 'true' : 'false'}
      onClick={() => {
        if (user?.blocked) return;
        onClick && onClick(user);
      }}
    >
      {hasPhoto ? (
        <Avatar
          src={photo}
          alt={user.nickname || user.email || 'user'}
          onError={() => setImgFailed(true)}
        />
      ) : (
        <LetterAvatar $size={40} aria-hidden="true">{initialOf(initialName)}</LetterAvatar>
      )}
      <Info>
        <Name>{user.nickname || user.name || user.email || i18n.t('favorites.states.unknownUser', { id: user.id })}</Name>
        <Meta>
          {user.role || user.userType || ''}
        </Meta>

      </Info>

      <Actions>
        <Btn
          type="button"
          onClick={handleChat}
          disabled={user?.blocked}
          title={user?.blocked ? i18n.t('favorites.states.blocked') : i18n.t('favorites.actions.chat')}
        >
          {i18n.t('favorites.actions.chat')}
        </Btn>
        {onRemove && (
          <Btn
            type="button"
            onClick={(e) => { e.stopPropagation(); if (user?.blocked) return; onRemove(user); }}
            disabled={removing || user?.blocked}
            aria-label={i18n.t('favorites.actions.remove')}
            title={user?.blocked ? i18n.t('favorites.states.blocked') : i18n.t('favorites.actions.remove')}
          >
            {removing ? i18n.t('favorites.actions.removing') : i18n.t('favorites.actions.removeShort')}
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
            title={i18n.t('favorites.actions.unblock')}
          >
            {i18n.t('favorites.actions.unblock')}
          </Btn>
        )}

      </Actions>
    </ItemCard>
  );
};

export default FavoriteItem;
