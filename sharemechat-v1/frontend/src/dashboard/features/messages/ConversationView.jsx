import React, { useEffect, useRef, useState } from 'react';
import MessageBubble from './MessageBubble';

const ConversationView = ({ partner, onBack }) => {
  const token = localStorage.getItem('token');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const scrollerRef = useRef(null);

  useEffect(() => {
    const load = async () => {
      if (!partner || !token) return;
      setLoading(true); setErr('');
      try {
        // TODO: cambiar a /api/conversations/{partnerId}/messages?page=0&size=50
        // const res = await fetch(`/api/conversations/${partner.id}/messages?page=0&size=50`, {
        //   headers: { Authorization: `Bearer ${token}` }
        // });
        // if (!res.ok) throw new Error((await res.text()) || `Error ${res.status}`);
        // const page = await res.json();
        // setMessages(page.content || []);

        setMessages([]); // por ahora vacío
      } catch (e) {
        setErr(e.message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [partner, token]);

  useEffect(() => {
    if (scrollerRef.current) {
      scrollerRef.current.scrollTop = scrollerRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || !partner) return;
    // TODO: cuando tengamos endpoint/WS de mensajes fuera de streaming
    // De momento, solo lo añadimos localmente para previsualizar UI
    setMessages((prev) => [...prev, { id: `tmp-${Date.now()}`, senderId: 0, content: input, createdAt: new Date().toISOString() }]);
    setInput('');
  };

  if (!partner) {
    return (
      <div style={{ padding: 12 }}>
        <h3>Selecciona una conversación</h3>
        <p>El chat aparecerá aquí.</p>
      </div>
    );
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#fff', border: '1px solid #eee', borderRadius: 10 }}>
      <div style={{ padding: 12, borderBottom: '1px solid #eee', display: 'flex', alignItems: 'center', gap: 10 }}>
        {onBack && (
          <button onClick={onBack} style={{ padding: '6px 10px', border: '1px solid #ddd', background: '#fff', borderRadius: 8, cursor: 'pointer' }}>
            Volver
          </button>
        )}
        <strong>{partner.nickname || partner.email || `Usuario ${partner.id}`}</strong>
      </div>

      <div ref={scrollerRef} style={{ flex: 1, padding: 12, overflowY: 'auto' }}>
        {loading && <p>Cargando…</p>}
        {err && <p style={{ color: 'red' }}>{err}</p>}
        {!loading && messages.map((m) => (
          <MessageBubble
            key={m.id}
            me={false /* TODO: comparar con userId actual */}
            text={m.content}
            time={new Date(m.createdAt).toLocaleString()}
          />
        ))}
      </div>

      <div style={{ padding: 12, borderTop: '1px solid #eee', display: 'flex', gap: 8 }}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Escribe un mensaje…"
          style={{ flex: 1, padding: 10, border: '1px solid #ccc', borderRadius: 8 }}
        />
        <button
          onClick={handleSend}
          style={{ padding: '10px 16px', background: '#007bff', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' }}
        >
          Enviar
        </button>
      </div>
    </div>
  );
};

export default ConversationView;
