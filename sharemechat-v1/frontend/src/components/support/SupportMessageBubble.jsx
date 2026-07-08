import React from 'react';
import styled from 'styled-components';
import ReactMarkdown from 'react-markdown';

// Frente B.3.3 (ADR-046). Burbuja de mensaje compartida entre la surface
// admin (AdminSupportPanel > Conversations > Detail) y la surface product
// (SupportChat.jsx del cliente).
//
// Variantes por sender:
// - USER: burbuja gris claro izquierda, avatar inicial del email.
// - LLM: burbuja azul claro izquierda, emoji robot. Markdown DEGRADADO
//        (safety net): la BdC del bot instruye texto plano; si el LLM emite
//        markdown por error, no rompemos la UX. Cada componente se degrada
//        a span/div sin margen ni padding.
// - HUMAN: burbuja verde derecha, avatar del sentByProfileDisplayName, firma
//        "display_name (category) · ts". Markdown CON estilos: los humanos si
//        formatean intencionadamente.
// - SYSTEM: banner amarillo centrado italic, sin avatar. Renderiza `content`
//        literal (sin markdown) porque el texto viene del backend ya
//        pre-formateado y localizado.
//
// Fix menor B.3.3: `min-width: 120px` para que burbujas de texto corto ("ok")
// no queden encogidas a 3 caracteres. Preserva `max-width: 72%` para textos
// largos.

const Row = styled.div`
  display: flex;
  gap: 10px;
  margin: 8px 0;
  align-items: flex-end;
  justify-content: ${(p) => (p.$side === 'right' ? 'flex-end' : 'flex-start')};
`;

// Fix bug 3 post-B.3.3: max-width en el wrapper columnar (flex-child del
// Row), no en Bubble. Antes el max-width vivia en Bubble pero su padre
// inmediato (este wrapper) se auto-dimensionaba al contenido, asi que
// 72% de "wrapper corto" quedaba corto y el Bubble no podia crecer aunque
// el Row tuviera espacio. Con max-width aqui, el limite es respecto al
// Row (full-width) via flex-basis del wrapper. min-width se preserva en
// Bubble para el fix previo de texto corto.
const ColumnWrap = styled.div`
  display: flex;
  flex-direction: column;
  max-width: 80%;
  align-items: ${(p) => (p.$side === 'right' ? 'flex-end' : 'flex-start')};
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
  min-width: 120px;
  padding: 10px 14px;
  border-radius: 14px;
  background: ${(p) => p.$bg};
  color: ${(p) => p.$fg || '#1f2937'};
  border: 1px solid ${(p) => p.$border || 'transparent'};
  line-height: 1.4;
  font-size: 0.9rem;
  word-wrap: break-word;
  overflow-wrap: break-word;

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

// Safety net para LLM: degradar toda etiqueta markdown a span/div sin
// margen ni padding. Preserva contenido, elimina formato visual. La BdC del
// bot ya prohibe markdown; esto es cinturon + tirantes.
const LLM_RESET_STYLE = { margin: 0, padding: 0 };
const LLM_MD_COMPONENTS = {
  h1: ({ node, ...props }) => <span {...props} style={LLM_RESET_STYLE} />,
  h2: ({ node, ...props }) => <span {...props} style={LLM_RESET_STYLE} />,
  h3: ({ node, ...props }) => <span {...props} style={LLM_RESET_STYLE} />,
  h4: ({ node, ...props }) => <span {...props} style={LLM_RESET_STYLE} />,
  h5: ({ node, ...props }) => <span {...props} style={LLM_RESET_STYLE} />,
  h6: ({ node, ...props }) => <span {...props} style={LLM_RESET_STYLE} />,
  strong: ({ node, ...props }) => <span {...props} />,
  em: ({ node, ...props }) => <span {...props} />,
  code: ({ node, inline, ...props }) => <span {...props} />,
  ul: ({ node, ...props }) => <div {...props} style={LLM_RESET_STYLE} />,
  ol: ({ node, ...props }) => <div {...props} style={LLM_RESET_STYLE} />,
  li: ({ node, ...props }) => <div {...props} style={LLM_RESET_STYLE} />,
  p: ({ node, ...props }) => <p {...props} style={LLM_RESET_STYLE} />,
  br: ({ node, ...props }) => <br {...props} style={{ lineHeight: 1, margin: 0 }} />,
  a: ({ node, ...props }) => (
    <a
      {...props}
      target="_blank"
      rel="noopener noreferrer"
      style={{ color: '#2563eb', textDecoration: 'underline' }}
    />
  ),
  hr: () => null,
};

// Preprocess del texto LLM: colapsa multiples \n consecutivos en uno solo,
// hace trim por linea, une con hard-break markdown ("  \n") para que
// react-markdown renderice <br/> dentro del mismo <p>. Junto a los
// components degradados, garantiza espaciado cero visual.
const preprocessLlmContent = (raw) => (raw || '')
  .replace(/\n{2,}/g, '\n')
  .split('\n')
  .map((s) => s.trim())
  .filter((s) => s.length > 0)
  .join('  \n')
  .trim();

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

const SupportMessageBubble = ({
  message,
  userEmail,
  pending = false,
  agentLabel = 'Agente IA',
}) => {
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
          <ColumnWrap $side="left">
            <Bubble $bg="#f1f5f9" $fg="#0f172a" $border="#e2e8f0">
              <ReactMarkdown>{content}</ReactMarkdown>
            </Bubble>
            <MetaLine $side="left">
              {userEmail ? `${userEmail} · ` : ''}{ts}
              {pending ? <PendingTag>enviando…</PendingTag> : null}
            </MetaLine>
          </ColumnWrap>
        </Row>
      </div>
    );
  }

  if (sender === 'LLM') {
    return (
      <div>
        <Row $side="left">
          <Avatar $bg="#3b82f6">🤖</Avatar>
          <ColumnWrap $side="left">
            <Bubble $bg="#eff6ff" $fg="#1e3a8a" $border="#bfdbfe">
              <ReactMarkdown components={LLM_MD_COMPONENTS} skipHtml>
                {preprocessLlmContent(content)}
              </ReactMarkdown>
            </Bubble>
            <MetaLine $side="left">{agentLabel} · {ts}</MetaLine>
          </ColumnWrap>
        </Row>
      </div>
    );
  }

  if (sender === 'HUMAN') {
    const profileName = message.sentByProfileDisplayName || 'Soporte';
    const profileCategory = message.sentByProfileCategory || '';
    const signature = profileCategory
      ? `${profileName} (${profileCategory})`
      : profileName;
    return (
      <div>
        <Row $side="right">
          <ColumnWrap $side="right">
            <Bubble $bg="#dcfce7" $fg="#14532d" $border="#86efac">
              <ReactMarkdown>{content}</ReactMarkdown>
            </Bubble>
            <MetaLine $side="right">
              {signature} · {ts}
              {pending ? <PendingTag>enviando…</PendingTag> : null}
            </MetaLine>
          </ColumnWrap>
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
