import React, { useEffect, useState } from 'react';

const resolveProfilePic = (user = {}, ctx = 'FavoritesModelList') => {
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

  try { console.debug(`[avatar][${ctx}]`, { userId: user?.id, chosen: result, picks: pick }); } catch {}
  return result;
};

export default function FavoritesModelList({ onSelect, reloadTrigger = 0 }) {
  const [items, setItems] = useState([]);
  const [avatarMap, setAvatarMap] = useState({}); // id -> url
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
        if (!res.ok) throw new Error(await res.text() || `HTTP ${res.status}`);
        const data = await res.json();
        if (!ignore) {
          console.debug('[favorites-model][raw]', data);
          const mapped = (data || []).map(d => {
            const u = d?.user || {};
            return {
              ...u,
              invited: d?.invited,
              status: d?.status,
              role: u.role || 'CLIENT',
              userType: u.userType || 'CLIENT',
              documents: d?.documents || d?.clientDocuments || d?.modelDocuments || u?.documents || null,
              modelDocuments: d?.modelDocuments || u?.modelDocuments || null,
              clientDocuments: d?.clientDocuments || u?.clientDocuments || null,
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

  // batch avatars
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
        if (!r.ok) throw new Error(await r.text() || `HTTP ${r.status}`);
        const map = await r.json(); // { "12": "/uploads/...", "34": null, ... }
        if (!ignore) {
          console.debug('[favorites-model][avatars-batch]', map);
          setAvatarMap(map || {});
        }
      } catch (e) {
        console.warn('[favorites-model] avatars error:', e?.message);
      }
    };
    run();
    return () => { ignore = true; };
  }, [items, token]);

  if (loading) return <div className="list-group-item">Cargando…</div>;
  if (!items.length) return <div className="list-group-item">No tienes favoritos todavía.</div>;

  return (
    <ul className="list-group list-group-flush">
      {items.map(u => {
        const fromBatch = avatarMap?.[u.id] || null;
        const fallbackResolved = resolveProfilePic(u, 'FavoritesModelList->render');
        const avatar = fromBatch || fallbackResolved || '/img/avatar.png';

        return (
          <li key={u.id}
              className="list-group-item d-flex align-items-center justify-content-between"
              style={{ cursor:'pointer' }}
              onClick={() => onSelect?.(u)}
          >
            <div className="d-flex align-items-center">
              <img
                src={avatar}
                alt=""
                width="28"
                height="28"
                onError={(e) => { e.currentTarget.src = '/img/avatar.png'; }}
                style={{ borderRadius: '50%', objectFit:'cover', marginRight:8 }}
              />
              <div>
                <div style={{ fontWeight: 600 }}>{u.nickname || `Usuario #${u.id}`}</div>
                <div style={{ fontSize:12, color:'#6c757d' }}>
                  {u.userType || 'CLIENT'}
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
        );
      })}
    </ul>
  );
}
