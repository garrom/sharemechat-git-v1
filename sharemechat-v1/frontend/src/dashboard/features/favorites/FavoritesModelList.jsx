import React, { useEffect, useState } from 'react';
import FavoriteItem from './FavoriteItem';

const FavoritesModelList = ({ onSelect, onOpenChat }) => {
  const token = localStorage.getItem('token');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [removingId, setRemovingId] = useState(null);

  const load = async () => {
    if (!token) return;
    setLoading(true);
    setErr('');
    try {
      const res = await fetch('/api/favorites/clients', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error((await res.text()) || `Error ${res.status}`);
      const data = await res.json();
      setItems(data || []);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line
  }, []);

  const removeOne = async (user) => {
    if (!token) return;
    setRemovingId(user.id);
    try {
      const res = await fetch(`/api/favorites/clients/${user.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error((await res.text()) || `Error ${res.status}`);
      setItems((prev) => prev.filter(i => i.id !== user.id));
    } catch (e) {
      alert(e.message || 'Error al quitar favorito');
    } finally {
      setRemovingId(null);
    }
  };

  // handler que pasamos al ítem — si el padre no lo pasa, el ítem hará fallback
  const handleOpenChat = (u) => {
    if (onOpenChat) onOpenChat(u);
  };

  return (
    <div>
      <h4 style={{ marginBottom: 10 }}>Tus clientes favoritos</h4>
      {loading && <p>Cargando…</p>}
      {err && <p style={{ color: 'red' }}>{err}</p>}
      {!loading && !err && items.length === 0 && <p>No tienes favoritos aún.</p>}
      {!loading && !err && items.map(u => (
        <FavoriteItem
          key={u.id}
          user={u}
          onClick={onSelect}
          onRemove={removeOne}
          removing={removingId === u.id}
          onChat={handleOpenChat}
        />
      ))}
    </div>
  );
};

export default FavoritesModelList;
