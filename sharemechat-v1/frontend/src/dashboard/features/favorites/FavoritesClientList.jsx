import React, { useEffect, useState } from 'react';

export default function FavoritesClientList({ onSelect, reloadTrigger = 0 }) {
  const [items, setItems] = useState([]);
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
        if (!res.ok) throw new Error(await res.text() || `HTTP ${res.status}`);
        // Esperamos: [{ user:{id,nickname,profilePic|urlPic,role,userType}, status, invited }]
        const data = await res.json();
        if (!ignore) {
          const mapped = (data || []).map(d => {
            const u = d?.user || {};
            return {
              ...u,
              profilePic: u.profilePic || u.urlPic || null,
              invited: d?.invited,
              status: d?.status,
              role: u.role || 'MODEL',
              userType: u.userType || 'MODEL',
            };
          });

          // Solo pendientes o aceptados
          const filtered = mapped.filter(item => {
            const v = String(item.invited || '').toLowerCase();
            return v === 'pending' || v === 'accepted';
          });

          setItems(filtered);
        }
      } catch (e) {
        if (!ignore) setItems([]);
      } finally {
        if (!ignore) setLoading(false);
      }
    };
    load();
    return () => { ignore = true; };
  }, [token, reloadTrigger]);

  if (loading) return <div className="list-group-item">Cargando…</div>;

  if (!items.length) return (
    <div className="list-group-item">No tienes favoritos todavía.</div>
  );

  return (
    <ul className="list-group list-group-flush">
      {items.map(u => (
        <li key={u.id}
            className="list-group-item d-flex align-items-center justify-content-between"
            style={{ cursor:'pointer' }}
            onClick={() => onSelect?.(u)}
        >
          <div className="d-flex align-items-center">
            <img src={u.profilePic || '/img/avatar.png'} alt=""
                 width="28" height="28"
                 style={{ borderRadius: '50%', objectFit:'cover', marginRight:8 }} />
            <div>
              <div style={{ fontWeight: 600 }}>{u.nickname || `Usuario ${u.id}`}</div>
              <div style={{ fontSize:12, color:'#6c757d' }}>
                {u.userType || 'MODEL'}
              </div>
            </div>
          </div>
          <div className="d-flex" style={{ gap:6 }}>
            <span className="badge bg-secondary">{u.status}</span>
            <span className={
                u.invited === 'pending' ? 'badge bg-warning text-dark'
              : u.invited === 'rejected' ? 'badge bg-danger'
              : 'badge bg-success'
            }>
              {u.invited}
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}
