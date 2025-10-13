import React, { useEffect, useState } from 'react';
import {
  List, StateRow, ItemCard, Avatar, Info, Name, Badges, Badge
} from '../../../styles/features/FavoritesStyles';

function FavListItem({ user, avatarUrl, onSelect, selected = false }) {
  const placeholder = '/img/avatarChica.png';
  const [imgSrc, setImgSrc] = useState(placeholder);

  // Solo actualiza si llega una URL válida; si no hay URL, permanece el placeholder (sin flicker)
  useEffect(() => {
    if (avatarUrl && typeof avatarUrl === 'string') {
      setImgSrc(avatarUrl);
    }
    // si no hay avatarUrl, no tocamos el src para evitar repaints
  }, [avatarUrl]);

  const invited = String(user.invited || '').toLowerCase();
  const invitedVariant =
    invited === 'pending' ? 'warning' :
    invited === 'rejected' ? 'danger' : 'success';

  return (
    <ItemCard
      $clickable
      data-selected={selected ? 'true' : 'false'}
      aria-selected={selected ? 'true' : 'false'}
      onClick={() => onSelect?.(user)}
      /* Fallback visual inmediato por si tus estilos aún no contemplan data-selected */
      style={selected ? { background: '#e7f1ff', borderColor: '#b6d4fe' } : undefined}
    >

      <Avatar
        src={imgSrc}
        alt=""
        $size={28}
        onError={(e) => { e.currentTarget.src = '/img/avatarChica.png'; }}
      />
      <Info>
        <Name>{user.nickname || `Usuario #${user.id}`}</Name>
      </Info>
      <Badges>
        <Badge $variant={invitedVariant}>{user.invited}</Badge>
      </Badges>
    </ItemCard>
  );
}

export default function FavoritesClientList({ onSelect, reloadTrigger = 0, selectedId = null }) {
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
        const res = await fetch('/api/favorites/models/meta', {
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
              role: u?.role || 'MODEL',
              userType: u?.userType || 'MODEL',
            };
          });
          const filtered = mapped.filter(item => {
            const v = String(item.invited || '').toLowerCase();
            return v === 'pending' || v === 'accepted';
          });
          setItems(filtered);
        }
      } catch (e) {
        console.warn('[favorites] load error:', e?.message);
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
        console.warn('[favorites] avatars error:', e?.message);
      }
    };
    run();
    return () => { ignore = true; };
  }, [items, token]);

  if (loading) return <StateRow>Cargando…</StateRow>;
  if (!items.length) return <StateRow>No tienes favoritos todavía.</StateRow>;

  return (
    <List>
     {items.map(u => (
       <FavListItem
         key={u.id}
         user={u}
         avatarUrl={avatarMap?.[u.id] || null}
         onSelect={onSelect}
         selected={Number(u.id) === Number(selectedId)}
       />
     ))}

    </List>
  );
}
