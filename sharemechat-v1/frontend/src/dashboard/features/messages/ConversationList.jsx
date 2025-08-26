import React, { useEffect, useState } from 'react';

const ConversationList = ({ onSelect, selectedId }) => {
  const token = localStorage.getItem('token');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  useEffect(() => {
    const load = async () => {
      if (!token) return;
      setLoading(true); setErr('');
      try {
        // TODO: cambiar a /api/conversations/partners cuando el backend esté
        // const res = await fetch('/api/conversations/partners', { headers: { Authorization: `Bearer ${token}` }});
        // if (!res.ok) throw new Error((await res.text()) || `Error ${res.status}`);
        // const data = await res.json();
        // setItems(data || []);

        setItems([]); // por ahora vacío
      } catch (e) {
        setErr(e.message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [token]);

  return (
    <div>
      <h4 style={{ marginBottom: 10 }}>Mensajes</h4>
      {loading && <p>Cargando…</p>}
      {err && <p style={{ color: 'red' }}>{err}</p>}
      {!loading && !err && items.length === 0 && <p>No hay conversaciones aún.</p>}
      {!loading && !err && items.map((c) => (
        <div
          key={c.partner.id}
          onClick={() => onSelect && onSelect(c.partner)}
          style={{
            padding: '8px 10px',
            border: '1px solid #eee',
            borderRadius: 10,
            marginBottom: 8,
            background: selectedId === c.partner.id ? '#eef5ff' : '#fff',
            cursor: 'pointer'
          }}
        >
          <div style={{ fontWeight: 600 }}>{c.partner.nickname || c.partner.email}</div>
          <div style={{ fontSize: 12, color: '#6c757d' }}>{c.lastSnippet || ''}</div>
        </div>
      ))}
    </div>
  );
};

export default ConversationList;
