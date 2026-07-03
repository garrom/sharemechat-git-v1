// Chat con el Agente IA (B.2.1b).
// Página propia bajo /support (RequireRole en App.jsx). Envía mensajes por
// REST síncrono al backend (POST /api/support/message) y carga historial al
// montar. Sin WebSocket. El bot es un "favorito virtual" desde la vista de
// favoritos, pero el chat en sí vive aquí.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faHeadset, faPaperPlane, faUserTie } from '@fortawesome/free-solid-svg-icons';
import i18n from '../../i18n';
import useSupportChat from '../../hooks/useSupportChat';
import SupportEscalateModal from './SupportEscalateModal';

const MAX_INPUT = 4000;
const WARN_MSGS_THRESHOLD = 5;
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

const avatarStyle = {
  width: 40,
  height: 40,
  borderRadius: '50%',
  background: '#f97316',
  color: '#fff',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '1.1rem',
  flexShrink: 0,
};

const badgeStyle = {
  fontSize: '0.7rem',
  fontWeight: 700,
  padding: '2px 8px',
  borderRadius: 10,
  background: '#dcfce7',
  color: '#166534',
  marginLeft: 8,
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

const bubbleBase = {
  padding: '10px 14px',
  borderRadius: 12,
  maxWidth: '80%',
  wordBreak: 'break-word',
  whiteSpace: 'pre-wrap',
  fontSize: '0.95rem',
  lineHeight: 1.4,
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

const sendBtnStyle = {
  background: '#f97316',
  color: '#fff',
  border: 'none',
  borderRadius: 8,
  padding: '10px 18px',
  fontSize: '0.95rem',
  fontWeight: 700,
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  height: 44,
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
      <header style={headerStyle}>
        <div style={avatarStyle} aria-hidden="true">
          <FontAwesomeIcon icon={faHeadset} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <strong>{i18n.t('support.chat.agentName')}</strong>
          <span style={{ fontSize: '0.8rem', color: '#6b7280' }}>
            {i18n.t('support.chat.headerBadge')}
          </span>
        </div>
        <span style={badgeStyle}>{i18n.t('support.chat.headerBadge')}</span>

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
              <div>{m.content}</div>
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
          style={{ ...sendBtnStyle, opacity: canSend ? 1 : 0.6, cursor: canSend ? 'pointer' : 'not-allowed' }}
          onClick={handleSend}
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
