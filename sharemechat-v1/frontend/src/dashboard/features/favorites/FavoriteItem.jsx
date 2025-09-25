import React from 'react';

const FavoriteItem = ({ user, onClick, onRemove, removing, onChat }) => {
  // handler local: usa onChat si viene, si no emite un CustomEvent (fallback)
  const handleChat = (e) => {
    e.stopPropagation();
    if (onChat) {
      onChat(user);
    } else {
      // Fallback sin dependencia del padre
      window.dispatchEvent(new CustomEvent('open-fav-chat', { detail: { user } }));
    }
  };

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
        src={user.profilePic || 'https://via.placeholder.com/48'}
        alt={user.nickname || user.email || 'user'}
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

      {/* Botón Chatear siempre visible en favoritos */}
      <button
        onClick={handleChat} // <-- nuevo comportamiento robusto
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