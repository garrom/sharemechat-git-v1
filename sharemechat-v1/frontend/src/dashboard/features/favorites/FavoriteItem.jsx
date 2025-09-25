import React from 'react';

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
    pick.profilePic ||
    pick.urlPic ||
    pick.pic ||
    pick.avatar ||
    pick.photo ||
    pick.docs_urlPic ||
    null;

  // LOG: trazamos qué llegó y qué seleccionamos
  try {
    console.debug(`[avatar][${ctx}]`, {
      userId: user?.id,
      nickname: user?.nickname,
      chosen: result,
      picks: pick,
    });
  } catch {}

  return result;
};

const FavoriteItem = ({ user, onClick, onRemove, removing, onChat }) => {
  const handleChat = (e) => {
    e.stopPropagation();
    if (onChat) {
      onChat(user);
    } else {
      window.dispatchEvent(new CustomEvent('open-fav-chat', { detail: { user } }));
    }
  };

  const avatar = resolveProfilePic(user, 'FavoriteItem') || '/img/avatar.png';

  return (
    <div
      onClick={() => onClick && onClick(user)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '8px 10px',
        border: '1px solid #eee',
        borderRadius: 10,
        marginBottom: 8,
        cursor: onClick ? 'pointer' : 'default',
        background: '#fff'
      }}
    >
      <img
        src={avatar}
        alt={user.nickname || user.email || 'user'}
        onError={(e) => { e.currentTarget.src = '/img/avatar.png'; }}
        style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover' }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {user.nickname || user.name || user.email || `Usuario ${user.id}`}
        </div>
        <div style={{ fontSize: 12, color: '#6c757d' }}>
          {user.role || user.userType || ''}
        </div>
      </div>

      <button
        onClick={handleChat}
        style={{
          padding: '6px 10px',
          border: '1px solid #ddd',
          background: '#fff',
          borderRadius: 8,
          cursor: 'pointer',
          marginRight: 8
        }}
      >
        Chatear
      </button>

      {onRemove && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove(user);
          }}
          disabled={removing}
          style={{
            padding: '6px 10px',
            border: '1px solid #ddd',
            background: removing ? '#f8f9fa' : '#fff',
            borderRadius: 8,
            cursor: 'pointer'
          }}
        >
          {removing ? 'Quitando…' : 'Quitar'}
        </button>
      )}
    </div>
  );
};

export default FavoriteItem;
