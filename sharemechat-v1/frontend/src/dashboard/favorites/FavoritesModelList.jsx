import React, { useEffect, useState } from 'react';
import {
  List, StateRow, ItemCard, Avatar, Info, Name, Badges
} from '../../styles/FavoritesStyles';
import StatusBadge from '../../widgets/StatusBadge';


function FavListItem({ user, avatarUrl, onSelect, onRemove, selected = false }) {
  const placeholder = '/img/avatarChico.png';
  const [imgSrc, setImgSrc] = useState(placeholder);

  // Solo actualiza si llega una URL válida; si no hay URL, permanece el placeholder (sin flicker)
  useEffect(() => {
    if (avatarUrl && typeof avatarUrl === 'string') {
      setImgSrc(avatarUrl);
    }
    // si no hay avatarUrl, no tocamos el src para evitar repaints
  }, [avatarUrl]);

  const invited = String(user.invited || '').trim().toLowerCase();
  const status  = String(user.status  || '').trim().toLowerCase();


  return (
    <ItemCard
      $clickable
      data-selected={selected ? 'true' : 'false'}
      aria-selected={selected ? 'true' : 'false'}
      onClick={() => onSelect?.(user)}
      style={selected ? { background: '#e7f1ff', borderColor: '#b6d4fe' } : undefined}
    >

      <Avatar
        src={imgSrc}
        alt=""
        $size={28}
        onError={(e) => { e.currentTarget.src = '/img/avatarChico.png'; }}
      />
      <Info>
        <Name>{user.nickname || `Usuario #${user.id}`}</Name>
      </Info>
      <Badges>
        <StatusBadge
          value={invited}
          title={invited === 'sent' ? 'enviado' : invited}
          size={16}
        />
        <StatusBadge
          value={status}
          title={status}
          size={16}
        />
      </Badges>


      <button
        type="button"
        title="Eliminar de favoritos"
        onClick={(e) => { e.stopPropagation(); onRemove?.(user); }}
        style={{
          marginLeft: 8,
          padding: 6,
          width: 32,
          height: 32,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 6,
          border: '1px solid #dc3545',
          background: 'transparent',
          color: '#dc3545',
          cursor: 'pointer'
        }}
        aria-label="Eliminar de favoritos"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M9 3h6a1 1 0 0 1 1 1v1h4v2h-1v12a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V7H4V5h4V4a1 1 0 0 1 1-1zm1 2v0h4V5h-4zM7 7v12h10V7H7zm3 3h2v8h-2v-8zm4 0h2v8h-2v-8z"/>
        </svg>
      </button>


    </ItemCard>
  );
}

export default function FavoritesModelList({ onSelect, reloadTrigger = 0, selectedId = null }) {
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
          selected={Number(u.id) === Number(selectedId)}
        />
      ))}
    </List>
  );


}
