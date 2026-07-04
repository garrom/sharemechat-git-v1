// Chat con el Agente IA (B.2.1b).
// Página propia bajo /support (RequireRole en App.jsx). Envía mensajes por
// REST síncrono al backend (POST /api/support/message) y carga historial al
// montar. Sin WebSocket. El bot es un "favorito virtual" desde la vista de
// favoritos, pero el chat en sí vive aquí.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPaperPlane, faUserTie } from '@fortawesome/free-solid-svg-icons';
import ReactMarkdown from 'react-markdown';
import i18n from '../../i18n';
import useSupportChat from '../../hooks/useSupportChat';
import SupportEscalateModal from './SupportEscalateModal';

const MAX_INPUT = 4000;
const WARN_MSGS_THRESHOLD = 5;

// Safety net: la BdC instruye al LLM a NO usar markdown y respetar
// espaciado cero. Si aun así devuelve markdown, cada componente se
// degrada a span/div/p sin margen ni padding. La regla CSS con !important
// (styleTag mas abajo) actua como red final por si algun CSS global pisara
// el inline style.
const RESET_STYLE = { margin: 0, padding: 0 };

const MD_COMPONENTS = {
  h1: ({ node, ...props }) => <span {...props} style={RESET_STYLE} />,
  h2: ({ node, ...props }) => <span {...props} style={RESET_STYLE} />,
  h3: ({ node, ...props }) => <span {...props} style={RESET_STYLE} />,
  h4: ({ node, ...props }) => <span {...props} style={RESET_STYLE} />,
  h5: ({ node, ...props }) => <span {...props} style={RESET_STYLE} />,
  h6: ({ node, ...props }) => <span {...props} style={RESET_STYLE} />,
  strong: ({ node, ...props }) => <span {...props} />,
  em: ({ node, ...props }) => <span {...props} />,
  code: ({ node, inline, ...props }) => <span {...props} />,
  ul: ({ node, ...props }) => <div {...props} style={RESET_STYLE} />,
  ol: ({ node, ...props }) => <div {...props} style={RESET_STYLE} />,
  li: ({ node, ...props }) => <div {...props} style={RESET_STYLE} />,
  p: ({ node, ...props }) => <p {...props} style={RESET_STYLE} />,
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

// Safety net final: CSS con !important para evitar que reglas globales
// (styled-components de Poppins, index.css, etc.) pisen los inline styles
// del ReactMarkdown. Se inyecta una sola vez como <style> global.
const SUPPORT_MD_CSS = `
.support-md,
.support-md p,
.support-md div,
.support-md span,
.support-md ul,
.support-md ol,
.support-md li {
  margin: 0 !important;
  padding: 0 !important;
  line-height: 1.2 !important;
}
.support-md br {
  line-height: 1 !important;
  margin: 0 !important;
}
`;
const WARN_TOKENS_THRESHOLD = 10000;

// Cálculo de horas restantes hasta próxima medianoche UTC.
const hoursUntilUtcMidnight = () => {
  const now = new Date();
  const nextMidnightUtc = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1,
    0, 0, 0, 0
  );
  const msLeft = nextMidnightUtc - now.getTime();
  return Math.max(1, Math.ceil(msLeft / (60 * 60 * 1000)));
};

// Layout de panel embebido: el chat con el Agente IA se monta dentro del
// panel central de /client|/model (StyledCenter). Ocupamos todo el alto
// disponible del padre para que el input quede pegado al bottom del panel.
const containerStyle = {
  width: '100%',
  height: '100%',
  padding: '12px 12px 12px',
  display: 'flex',
  flexDirection: 'column',
  boxSizing: 'border-box',
  minHeight: 0,
};

const headerStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  padding: '12px 14px',
  background: '#f9fafb',
  border: '1px solid #e5e7eb',
  borderRadius: 8,
  marginBottom: 12,
};

const avatarImgStyle = {
  width: 72,
  height: 72,
  display: 'block',
  objectFit: 'contain',
  flexShrink: 0,
};

const escalateBtnStyle = {
  marginLeft: 'auto',
  background: '#ffffff',
  color: '#374151',
  border: '1px solid #d1d5db',
  borderRadius: 6,
  padding: '8px 14px',
  fontSize: '0.9rem',
  fontWeight: 600,
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
};

const messagesAreaStyle = {
  flex: 1,
  overflowY: 'auto',
  padding: '8px 6px',
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
};

// Fix bold universal: el body global usa var(--font-nav) = Poppins, y en
// index.html solo se cargan pesos 600/700/800 (look "Azar"). Cualquier texto
// con font-weight 400 cae al fallback más cercano disponible (600), y todo
// el chat se veía semibold. En las burbujas forzamos var(--font-sans)
// (Inter, que sí carga en 400 regular) y fontWeight 400 explícito para
// romper la herencia.
const bubbleBase = {
  padding: '3px 10px',
  borderRadius: 12,
  maxWidth: '80%',
  wordBreak: 'break-word',
  whiteSpace: 'pre-wrap',
  fontSize: '0.95rem',
  lineHeight: 1.2,
  fontFamily: 'var(--font-sans), Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  fontWeight: 400,
};

const userBubble = {
  ...bubbleBase,
  alignSelf: 'flex-end',
  background: '#2563eb',
  color: '#fff',
  borderBottomRightRadius: 4,
};

const llmBubble = {
  ...bubbleBase,
  alignSelf: 'flex-start',
  background: '#f3f4f6',
  color: '#111827',
  borderBottomLeftRadius: 4,
};

const systemBubble = {
  ...bubbleBase,
  alignSelf: 'center',
  background: '#fef3c7',
  color: '#78350f',
  fontSize: '0.85rem',
  fontStyle: 'italic',
  maxWidth: '90%',
  textAlign: 'center',
};

const timestampStyle = {
  fontSize: '0.7rem',
  opacity: 0.75,
  marginTop: 4,
};

const inputRowStyle = {
  display: 'flex',
  gap: 8,
  alignItems: 'flex-end',
  paddingTop: 8,
  borderTop: '1px solid #e5e7eb',
};

const textareaStyle = {
  flex: 1,
  minHeight: 44,
  maxHeight: 160,
  padding: '10px 12px',
  border: '1px solid #d1d5db',
  borderRadius: 8,
  fontFamily: 'inherit',
  fontSize: '0.95rem',
  resize: 'none',
  boxSizing: 'border-box',
  outline: 'none',
};

const sendBtnBase = {
  border: '1px solid #000',
  borderRadius: 8,
  padding: '10px 18px',
  fontSize: '0.95rem',
  fontWeight: 700,
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  height: 44,
  transition: 'background 120ms ease, color 120ms ease',
};

const sendBtnResolvedStyle = (hover, disabled) => {
  if (disabled) {
    return {
      ...sendBtnBase,
      background: '#333',
      color: '#fff',
      cursor: 'not-allowed',
      opacity: 0.5,
    };
  }
  if (hover) {
    return { ...sendBtnBase, background: '#fff', color: '#000' };
  }
  return { ...sendBtnBase, background: '#000', color: '#fff' };
};

const bannerBase = {
  padding: '10px 14px',
  borderRadius: 6,
  marginBottom: 10,
  fontSize: '0.9rem',
};

const bannerWarning = { ...bannerBase, background: '#fef9c3', color: '#854d0e', border: '1px solid #fde047' };
const bannerDanger  = { ...bannerBase, background: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5' };
const bannerInfo    = { ...bannerBase, background: '#dbeafe', color: '#1e40af', border: '1px solid #93c5fd' };

const emptyStateStyle = {
  padding: '24px 16px',
  textAlign: 'center',
  color: '#6b7280',
  fontSize: '0.95rem',
  alignSelf: 'center',
  maxWidth: 520,
};

const typingStyle = {
  ...llmBubble,
  fontStyle: 'italic',
  opacity: 0.8,
};

const formatTime = (iso) => {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
};

export default function SupportChat() {
  const {
    messages,
    conversationId,
    loading,
    sending,
    error,
    rateLimitState,
    resolutionStatus,
    escalated,
    sendMessage,
    requestEscalation,
  } = useSupportChat();

  const [input, setInput] = useState('');
  const [escalateOpen, setEscalateOpen] = useState(false);
  const [sendHover, setSendHover] = useState(false);
  const messagesRef = useRef(null);

  // Auto-scroll al final cuando llegan mensajes o el LLM está pensando.
  useEffect(() => {
    const el = messagesRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, sending]);

  const rateLimited = !!rateLimitState.rateLimited;
  const warningBanner = useMemo(() => {
    if (rateLimited) return null;
    const { messagesRemainingToday: msgs, tokensRemainingToday: toks } = rateLimitState;
    if (msgs == null && toks == null) return null;
    if ((msgs != null && msgs <= WARN_MSGS_THRESHOLD)
      || (toks != null && toks <= WARN_TOKENS_THRESHOLD)) {
      return i18n.t('support.rateLimit.warningYellow', { count: msgs ?? 0 });
    }
    return null;
  }, [rateLimited, rateLimitState]);

  const dangerBanner = rateLimited
    ? i18n.t('support.rateLimit.exceededRed', { hours: hoursUntilUtcMidnight() })
    : null;

  const canSend = !sending && !rateLimited && input.trim().length > 0;

  const handleSend = async () => {
    if (!canSend) return;
    const text = input;
    setInput('');
    await sendMessage(text);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleEscalate = async (reason) => {
    await requestEscalation(reason);
  };

  return (
    <div style={containerStyle}>
      <style>{SUPPORT_MD_CSS}</style>
      <header style={headerStyle}>
        <img
          src="/img/icono-agente-ia.png"
          alt=""
          style={avatarImgStyle}
        />
        <strong>{i18n.t('support.chat.agentName')}</strong>

        <button
          type="button"
          style={escalateBtnStyle}
          onClick={() => setEscalateOpen(true)}
          disabled={sending || !conversationId}
          title={i18n.t('support.escalate.button')}
        >
          <FontAwesomeIcon icon={faUserTie} />
          <span>{i18n.t('support.escalate.button')}</span>
        </button>
      </header>

      {escalated && (
        <div style={bannerInfo} role="status">
          {i18n.t('support.escalate.success')}
        </div>
      )}
      {dangerBanner && (
        <div style={bannerDanger} role="alert">{dangerBanner}</div>
      )}
      {!dangerBanner && warningBanner && (
        <div style={bannerWarning} role="status">{warningBanner}</div>
      )}
      {error && (
        <div style={bannerDanger} role="alert">{error}</div>
      )}

      <div style={messagesAreaStyle} ref={messagesRef}>
        {loading && (
          <div style={emptyStateStyle}>…</div>
        )}
        {!loading && messages.length === 0 && (
          <div style={emptyStateStyle}>
            {i18n.t('support.chat.emptyState')}
          </div>
        )}
        {messages.map((m) => {
          const isUser = m.sender === 'USER';
          const isLlm = m.sender === 'LLM';
          const style = isUser ? userBubble : (isLlm ? llmBubble : systemBubble);
          return (
            <div key={String(m.id)} style={style}>
              {isLlm ? (
                <div className="support-md" style={{ margin: 0, padding: 0 }}>
                  <ReactMarkdown
                    components={MD_COMPONENTS}
                    skipHtml
                  >
                    {/* Espaciado cero absoluto (no confiar en el LLM):
                        (a) colapsa multiples \n consecutivos en uno solo;
                        (b) divide por linea, hace trim de cada una, elimina
                            lineas vacias intermedias (por si el LLM emite
                            \n\n\n o lineas con solo espacios);
                        (c) une con hard break markdown ("  \n") para que
                            react-markdown renderice <br/> DENTRO del mismo
                            <p>, no como parrafo nuevo.
                        Junto al MD_COMPONENTS con margin:0 y el CSS con
                        !important, garantiza que puntos y aparte del LLM
                        no introducen espaciado visual. */}
                    {(m.content || '')
                      .replace(/\n{2,}/g, '\n')
                      .split('\n')
                      .map((s) => s.trim())
                      .filter((s) => s.length > 0)
                      .join('  \n')
                      .trim()}
                  </ReactMarkdown>
                </div>
              ) : (
                <div>{m.content}</div>
              )}
              {m.createdAt && (
                <div style={timestampStyle}>{formatTime(m.createdAt)}</div>
              )}
            </div>
          );
        })}
        {sending && (
          <div style={typingStyle}>{i18n.t('support.chat.typing')}</div>
        )}
      </div>

      <div style={inputRowStyle}>
        <textarea
          style={textareaStyle}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={i18n.t('support.chat.inputPlaceholder')}
          maxLength={MAX_INPUT}
          rows={1}
          disabled={rateLimited || sending}
          aria-label={i18n.t('support.chat.inputPlaceholder')}
        />
        <button
          type="button"
          style={sendBtnResolvedStyle(sendHover, !canSend)}
          onClick={handleSend}
          onMouseEnter={() => setSendHover(true)}
          onMouseLeave={() => setSendHover(false)}
          onFocus={() => setSendHover(true)}
          onBlur={() => setSendHover(false)}
          disabled={!canSend}
        >
          <FontAwesomeIcon icon={faPaperPlane} />
          <span>{i18n.t('support.chat.sendButton')}</span>
        </button>
      </div>

      <SupportEscalateModal
        open={escalateOpen}
        onClose={() => setEscalateOpen(false)}
        onConfirm={handleEscalate}
      />
    </div>
  );
}
