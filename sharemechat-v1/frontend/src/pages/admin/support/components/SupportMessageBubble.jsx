import React from 'react';
import styled from 'styled-components';
import ReactMarkdown from 'react-markdown';

// Frente B.3.2 (ADR-046). Burbuja de mensaje del hilo admin. Variantes:
// - USER: burbuja gris claro izquierda, avatar inicial del email.
// - LLM: burbuja azul claro izquierda, emoji robot.
// - HUMAN: burbuja verde derecha, avatar del sentByProfileDisplayName, firma
//         pequena "display_name (category)". Markdown CON estilos (NO safety
//         net como en SupportChat.jsx del cliente): los humanos si formatean.
// - SYSTEM: banner amarillo centrado italic, sin burbuja, ancho reducido.
// Reusa react-markdown@8.0.7 ya presente en package.json.

const Row = styled.div`
  display: flex;
  gap: 10px;
  margin: 8px 0;
  align-items: flex-end;
  justify-content: ${(p) => (p.$side === 'right' ? 'flex-end' : 'flex-start')};
`;

const Avatar = styled.div`
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: ${(p) => p.$bg || '#94a3b8'};
  color: #fff;
  font-weight: 700;
  font-size: 13px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
`;

const Bubble = styled.div`
  max-width: 72%;
  padding: 10px 14px;
  border-radius: 14px;
  background: ${(p) => p.$bg};
  color: ${(p) => p.$fg || '#1f2937'};
  border: 1px solid ${(p) => p.$border || 'transparent'};
  line-height: 1.4;
  font-size: 0.9rem;
  word-wrap: break-word;

  p { margin: 0 0 6px 0; }
  p:last-child { margin-bottom: 0; }
  ul, ol { margin: 4px 0 4px 20px; padding: 0; }
  li { margin: 0; }
  code {
    background: rgba(0, 0, 0, 0.08);
    padding: 1px 4px;
    border-radius: 4px;
    font-size: 0.85em;
  }
  a { color: #2563eb; text-decoration: underline; }
`;

const MetaLine = styled.div`
  font-size: 0.7rem;
  color: #64748b;
  margin: 2px 4px 0 4px;
  text-align: ${(p) => (p.$side === 'right' ? 'right' : 'left')};
`;

const SystemBanner = styled.div`
  align-self: center;
  max-width: 70%;
  background: #fef9c3;
  color: #713f12;
  border: 1px solid #fde68a;
  border-radius: 10px;
  padding: 6px 12px;
  font-style: italic;
  font-size: 0.82rem;
  text-align: center;
  margin: 12px auto;
`;

const PendingTag = styled.span`
  display: inline-block;
  margin-left: 6px;
  color: #64748b;
  font-style: italic;
  font-size: 0.72rem;
`;

const initialOf = (s) => {
  if (!s) return '?';
  const trimmed = String(s).trim();
  if (!trimmed) return '?';
  return trimmed.charAt(0).toUpperCase();
};

const formatTime = (isoStr) => {
  if (!isoStr) return '';
  try {
    const d = new Date(isoStr);
    if (Number.isNaN(d.getTime())) return '';
    const now = new Date();
    const sameDay = d.getFullYear() === now.getFullYear()
      && d.getMonth() === now.getMonth()
      && d.getDate() === now.getDate();
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    if (sameDay) return `${hh}:${mm}`;
    const yyyy = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mo}-${dd} ${hh}:${mm}`;
  } catch {
    return '';
  }
};

const SupportMessageBubble = ({ message, userEmail, pending = false }) => {
  if (!message) return null;
  const sender = message.sender;
  const content = message.content || '';
  const ts = formatTime(message.createdAt);

  if (sender === 'SYSTEM') {
    return <SystemBanner>{content}</SystemBanner>;
  }

  if (sender === 'USER') {
    return (
      <div>
        <Row $side="left">
          <Avatar $bg="#94a3b8">{initialOf(userEmail || 'U')}</Avatar>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <Bubble $bg="#f1f5f9" $fg="#0f172a" $border="#e2e8f0">
              <ReactMarkdown>{content}</ReactMarkdown>
            </Bubble>
            <MetaLine $side="left">
              {userEmail ? `${userEmail} · ` : ''}{ts}
              {pending ? <PendingTag>enviando…</PendingTag> : null}
            </MetaLine>
          </div>
        </Row>
      </div>
    );
  }

  if (sender === 'LLM') {
    return (
      <div>
        <Row $side="left">
          <Avatar $bg="#3b82f6">🤖</Avatar>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <Bubble $bg="#eff6ff" $fg="#1e3a8a" $border="#bfdbfe">
              <ReactMarkdown>{content}</ReactMarkdown>
            </Bubble>
            <MetaLine $side="left">Agente IA · {ts}</MetaLine>
          </div>
        </Row>
      </div>
    );
  }

  if (sender === 'HUMAN') {
    const profileName = message.sentByProfileDisplayName || 'Soporte';
    return (
      <div>
        <Row $side="right">
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
            <Bubble $bg="#dcfce7" $fg="#14532d" $border="#86efac">
              <ReactMarkdown>{content}</ReactMarkdown>
            </Bubble>
            <MetaLine $side="right">
              {profileName} · {ts}
              {pending ? <PendingTag>enviando…</PendingTag> : null}
            </MetaLine>
          </div>
          <Avatar $bg="#15803d">{initialOf(profileName)}</Avatar>
        </Row>
      </div>
    );
  }

  // Sender desconocido: fallback neutro.
  return (
    <div>
      <Row $side="left">
        <Avatar $bg="#6b7280">?</Avatar>
        <Bubble $bg="#f3f4f6">{content}</Bubble>
      </Row>
    </div>
  );
};

export default SupportMessageBubble;
