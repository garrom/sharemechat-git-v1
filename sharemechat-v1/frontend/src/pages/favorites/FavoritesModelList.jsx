//FavoritesModelList.jsx
import React, { useEffect, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEllipsisVertical } from '@fortawesome/free-solid-svg-icons';
import {
  List, StateRow, ItemCard, Avatar, Info, Name, Badges, DotWrap, StatusDot
} from '../../styles/pages-styles/FavoritesStyles';
import StatusBadge from '../../widgets/StatusBadge';

function FavListItem({ user, avatarUrl, onSelect, onRemove, onContextMenu, selected = false, hasUnread = false }) {
  const placeholder = '/img/avatarChico.png';
  const [imgSrc, setImgSrc] = useState(placeholder);

  useEffect(() => {
    if (avatarUrl && typeof avatarUrl === 'string') {
      setImgSrc(avatarUrl);
    }
    // si no hay avatarUrl, no tocamos el src para evitar repaints
  }, [avatarUrl]);

  const invited = String(user.invited || '').trim().toLowerCase();
  const presence = String(user.presence || 'offline').toLowerCase();
  console.log('[Fav:models] item presence', {
    id: user?.id,
    nick: user?.nickname,
    presence
  });

  return (
    <ItemCard
      $clickable
      data-fav-card="true"
      data-selected={selected ? 'true' : 'false'}
      aria-selected={selected ? 'true' : 'false'}
      onClick={() => onSelect?.(user)}
      style={selected ? { background: '#e7f1ff', borderColor: '#b6d4fe' } : undefined}
    >
      <DotWrap>
        <Avatar
          src={imgSrc}
          alt=""
          $size={28}
          onError={(e) => { e.currentTarget.src = '/img/avatarChico.png'; }}
        />
        <StatusDot
          className={presence === 'busy' ? 'busy' : (presence === 'online' ? 'online' : 'offline')}
          aria-label={presence}
        />
      </DotWrap>

      <Info>
        <Name>{user.nickname || `Usuario #${user.id}`}</Name>
      </Info>

      <Badges>
        {invited !== 'accepted' && (
          <StatusBadge
            value={invited}
            title={invited === 'sent' ? 'enviado' : invited}
            size={16}
          />
        )}
      </Badges>

      {hasUnread && (
        <div
          style={{
            width: 10,
            height: 10,
            borderRadius: '50%',
            backgroundColor: '#0d6efd',
            marginRight: 6,
          }}
          aria-label="Tienes mensajes sin leer"
          title="Tienes mensajes sin leer"
        />
      )}

      {/* Botón menú (tres puntos) */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          const inv = invited;
          if (inv === 'pending' || inv === 'sent') return;

          const cardEl = e.currentTarget.closest('[data-fav-card]');
          const rect = cardEl ? cardEl.getBoundingClientRect() : e.currentTarget.getBoundingClientRect();

          const vw = window.innerWidth || document.documentElement.clientWidth || 0;
          const menuWidth = 220;
          let x = rect.left;
          if (x + menuWidth > vw - 8) {
            x = vw - menuWidth - 8;
          }

          const y = rect.bottom + 4;

          if (onContextMenu) {
            onContextMenu(user, { x, y });
          }
        }}
        style={{
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          padding: '4px 6px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
        aria-label="Opciones"
        title="Opciones"
      >
        <FontAwesomeIcon icon={faEllipsisVertical} />
      </button>

    </ItemCard>
  );
}

export default function FavoritesModelList({ onSelect, reloadTrigger = 0, selectedId = null, onContextMenu }) {
  const [items, setItems] = useState([]);
  const [avatarMap, setAvatarMap] = useState({});
  const [loading, setLoading] = useState(false);
  const [unreadMap, setUnreadMap] = useState({});
  const token = localStorage.getItem('token');

  // 1) Cargar favoritos + presencia
  useEffect(() => {
    let ignore = false;
    const load = async () => {
      if (!token) return;
      setLoading(true);
      try {
        const res = await fetch('/api/favorites/clients/meta', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) throw new Error((await res.text()) || `HTTP ${res.status}`);
        const data = await res.json();
        if (!ignore) {
          const mapped = (data || []).map(d => {
            const u = d?.user || {};
            return {
              ...u,
              invited: d?.invited,
              status: d?.status,
              presence: d?.presence || 'offline',
              role: u.role || 'CLIENT',
              userType: u.userType || 'CLIENT',
            };
          });
          const filtered = mapped.filter(item => String(item.invited || '').toLowerCase() !== 'rejected');
          setItems(filtered);
        }
      } catch (e) {
        console.warn('[favorites-model] load error:', e?.message);
        if (!ignore) setItems([]);
      } finally {
        if (!ignore) setLoading(false);
      }
    };
    load();
    return () => { ignore = true; };
  }, [token, reloadTrigger]);

  // 2) Cargar avatares
  useEffect(() => {
    let ignore = false;
    const run = async () => {
      if (!items.length || !token) return;
      const ids = items.map(i => i.id).filter(Boolean);
      const qs = encodeURIComponent(ids.join(','));
      try {
        const r = await fetch(`/api/users/avatars?ids=${qs}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!r.ok) throw new Error((await r.text()) || `HTTP ${r.status}`);
        const map = await r.json();
        if (!ignore) setAvatarMap(map || {});
      } catch (e) {
        console.warn('[favorites-model] avatars error:', e?.message);
      }
    };
    run();
    return () => { ignore = true; };
  }, [items, token]);

  // 3) Cargar resumen de conversaciones
  useEffect(() => {
    let ignore = false;

    const loadUnread = async () => {
      if (!token) return;
      try {
        const res = await fetch('/api/messages/conversations', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) throw new Error((await res.text()) || `HTTP ${res.status}`);
        const data = await res.json();

        if (ignore) return;

        console.log('[favorites-model] conversations:', data);

        const map = {};
        (data || []).forEach(conv => {
          const peerId = Number(conv.peer ?? conv.peerId);
          const unread = Number(conv.unreadCount ?? conv.unread_count ?? 0);
          if (Number.isFinite(peerId) && unread > 0) {
            map[peerId] = true;
          }
        });

        console.log('[favorites-model] unreadMap built:', map);
        setUnreadMap(map);
      } catch (e) {
        console.warn('[favorites-model] unread load error:', e?.message);
        if (!ignore) setUnreadMap({});
      }
    };

    loadUnread();
    return () => { ignore = true; };
  }, [token, reloadTrigger]);


  if (loading) return <StateRow>Cargando…</StateRow>;
  if (!items.length) return <StateRow>No tienes favoritos todavía.</StateRow>;

  const handleRemove = async (user) => {
    const inv = String(user?.invited || '').toLowerCase();
    if (inv === 'pending' || inv === 'sent') {
      alert('No puedes eliminar favoritos mientras la solicitud está en proceso.');
      return;
    }

    if (!user?.id) return;
    const ok = window.confirm(`¿Eliminar a ${user.nickname || `Usuario #${user.id}`} de tus favoritos?`);
    if (!ok) return;

    try {
      const res = await fetch(`/api/favorites/clients/${user.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || `HTTP ${res.status}`);
      }
      // actualización optimista
      setItems(prev => prev.filter(i => Number(i.id) !== Number(user.id)));
    } catch (e) {
      alert(e.message || 'No se pudo eliminar de favoritos.');
    }
  };

  return (
    <List>
      {items.map(u => (
        <FavListItem
          key={u.id}
          user={u}
          avatarUrl={avatarMap?.[u.id] || null}
          onSelect={onSelect}
          onRemove={handleRemove}
          onContextMenu={onContextMenu}
          selected={Number(u.id) === Number(selectedId)}
          hasUnread={!!unreadMap[u.id]}
        />
      ))}
    </List>
  );
}
