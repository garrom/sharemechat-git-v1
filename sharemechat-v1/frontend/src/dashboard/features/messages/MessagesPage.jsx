import React, { useEffect, useMemo, useRef, useState } from 'react';

const MessagesPage = ({ token, meId, msgSocketRef, openWithUserId=null }) => {
  const [convs, setConvs] = useState([]);
  const [activePeer, setActivePeer] = useState(openWithUserId);
  const [history, setHistory] = useState([]);
  const [input, setInput] = useState('');

  const fetchJSON = async (url, opts={}) => {
    const res = await fetch(url, {
      ...opts,
      headers: { 'Content-Type':'application/json', Authorization: `Bearer ${token}`, ...(opts.headers||{}) }
    });
    if (!res.ok) throw new Error(await res.text() || `Error ${res.status}`);
    return res.json();
  };

  useEffect(() => {
    const load = async () => {
      try { setConvs(await fetchJSON('/api/messages/conversations')); }
      catch (e) { console.error(e); }
    };
    load();
  }, []);

  useEffect(() => {
    if (!activePeer) return;
    const load = async () => {
      try {
        const data = await fetchJSON(`/api/messages/with/${activePeer}`);
        setHistory(data.reverse()); // mostramos ascendente
        await fetchJSON(`/api/messages/with/${activePeer}/read`, { method:'POST' });
      } catch (e) { console.error(e); }
    };
    load();
  }, [activePeer]);

  useEffect(() => {
    const s = msgSocketRef?.current;
    if (!s) return;
    const onMsg = (ev) => {
      try {
        const data = JSON.parse(ev.data);
        if (data.type === 'msg:new') {
          const m = data.message;
          if (activePeer && (m.senderId === activePeer || m.recipientId === activePeer)) {
            setHistory((prev) => [...prev, m]);
          }
        }
      } catch {}
    };
    s.addEventListener('message', onMsg);
    return () => s.removeEventListener('message', onMsg);
  }, [activePeer]);

  const handleSend = () => {
    if (!input.trim() || !activePeer) return;
    const s = msgSocketRef?.current;
    if (s && s.readyState === WebSocket.OPEN) {
      const payload = { type:'msg:send', to: activePeer, body: input.trim() };
      s.send(JSON.stringify(payload));
      setHistory(prev => [...prev, {
        id: Date.now(), senderId: meId, recipientId: activePeer, body: input.trim(), createdAt: new Date().toISOString(), readAt: null
      }]);
      setInput('');
    }
  };

  return (
    <div style={{ display:'grid', gridTemplateColumns:'280px 1fr', gap:'16px', height:'100%' }}>
      <div style={{ borderRight:'1px solid #333', overflowY:'auto' }}>
        <div style={{ padding:'8px 12px', fontWeight:600 }}>Conversaciones</div>
        {convs.map(c => (
          <div key={c.conversationKey}
               onClick={() => setActivePeer(c.peer)}
               style={{ padding:'10px 12px', cursor:'pointer', background: activePeer===c.peer?'#1f1f1f':'transparent' }}>
            <div>Con: {c.peer}</div>
            <div style={{ fontSize:12, opacity:.7, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{c.lastBody}</div>
            {c.unreadCount>0 && <div style={{ fontSize:11, color:'#0dcaf0' }}>{c.unreadCount} nuevos</div>}
          </div>
        ))}
      </div>

      <div style={{ display:'flex', flexDirection:'column', height:'100%' }}>
        <div style={{ flex:1, overflowY:'auto', padding:'8px 12px' }}>
          {history.map(m => (
            <div key={m.id} style={{ textAlign: m.senderId===meId ? 'right':'left', margin:'6px 0' }}>
              <span style={{ display:'inline-block', padding:'6px 10px', borderRadius:'10px', background: m.senderId===meId ? '#0d6efd' : '#343a40', color:'#fff' }}>
                {m.body}
              </span>
            </div>
          ))}
        </div>
        <div style={{ display:'flex', gap:'8px', padding:'10px 12px' }}>
          <input value={input} onChange={e=>setInput(e.target.value)} placeholder="Escribe un mensaje..."
                 style={{ flex:1, borderRadius:'6px', border:'1px solid #333', padding:'8px' }} />
          <button onClick={handleSend} style={{ padding:'8px 14px', borderRadius:'6px', border:'none', background:'#0d6efd', color:'#fff' }}>
            Enviar
          </button>
        </div>
      </div>
    </div>
  );
};

export default MessagesPage;
