import React, { useEffect, useState } from 'react';
import {
  List, StateRow, ItemCard, Avatar, Info, Name, Badges,DotWrap,StatusDot
} from '../../styles/FavoritesStyles';
import StatusBadge from '../../widgets/StatusBadge';


function FavListItem({ user, avatarUrl, onSelect, onRemove, onContextMenu, selected = false }) {
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
      data-selected={selected ? 'true' : 'false'}
      aria-selected={selected ? 'true' : 'false'}
      onClick={() => onSelect?.(user)}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        const inv = String(user?.invited || '').toLowerCase();
        if (inv === 'pending' || inv === 'sent') return; // no abrir menú si no se puede borrar
        onContextMenu?.(user, { x: e.clientX, y: e.clientY });
      }}

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

    </ItemCard>
  );
}

export default function FavoritesModelList({ onSelect, reloadTrigger = 0, selectedId = null, onContextMenu  }) {
  const [items, setItems] = useState([]);
  const [avatarMap, setAvatarMap] = useState({});
  const [loading, setLoading] = useState(false);
  const token = localStorage.getItem('token');

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
      // opcional: feedback
      // alert('Eliminado de favoritos.');
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
        />
      ))}
    </List>
  );


}
