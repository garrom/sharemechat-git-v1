import React, { useEffect, useState } from 'react';
import {
  List, StateRow, ItemCard, Avatar, Info, Name, Badges, Badge
} from '../../../styles/features/FavoritesStyles';

function FavListItem({ user, avatarUrl, onSelect }) {
  const placeholder = '/img/avatar.png';
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
    <ItemCard $clickable onClick={() => onSelect?.(user)}>
      <Avatar src={imgSrc} alt="" $size={28} />
      <Info>
        <Name>{user.nickname || `Usuario #${user.id}`}</Name>
      </Info>
      <Badges>
        <Badge $variant={invitedVariant}>{user.invited}</Badge>
      </Badges>
    </ItemCard>
  );
}

export default function FavoritesModelList({ onSelect, reloadTrigger = 0 }) {
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
              role: u.role || 'CLIENT',
              userType: u.userType || 'CLIENT',
            };
          });
          const filtered = mapped.filter(item => {
            const v = String(item.invited || '').toLowerCase();
            return v === 'pending' || v === 'accepted';
          });
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

  return (
    <List>
      {items.map(u => (
        <FavListItem
          key={u.id}
          user={u}
          avatarUrl={avatarMap?.[u.id] || null}
          onSelect={onSelect}
        />
      ))}
    </List>
  );
}
