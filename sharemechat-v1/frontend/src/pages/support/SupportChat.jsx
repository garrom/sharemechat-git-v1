// Chat con el Agente IA (B.2.1b) + panel humano (B.3.3).
// Panel embebido en /client|/model (StyledCenter). REST sincrono contra
// POST /api/support/message + GET /api/support/conversations/{id}/messages
// + POST /api/support/conversations/{id}/escalate-manual. Sin WebSocket.
//
// B.3.3: cuando el bot escala y un agente humano hace claim, el status pasa
// a HUMAN_HANDLING y el hook useSupportChat activa polling REST del historial
// para reflejar en tiempo real los mensajes del humano y el mensaje SYSTEM
// de asignacion. El boton "Hablar con un tecnico" se deshabilita en ese
// estado (ya hay humano atendiendo). Estilos unificados con el admin via
// SupportMessageBubble compartido.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPaperPlane, faUserTie } from '@fortawesome/free-solid-svg-icons';
import i18n from '../../i18n';
import useSupportChat from '../../hooks/useSupportChat';
import SupportMessageBubble from '../../components/support/SupportMessageBubble';
import SupportEscalateModal from './SupportEscalateModal';

const MAX_INPUT = 4000;
const WARN_MSGS_THRESHOLD = 5;
const WARN_TOKENS_THRESHOLD = 10000;

// Calculo de horas restantes hasta proxima medianoche UTC.
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

const containerStyle = {
  width: '100%',
  height: '100%',
  padding: '12px 12px 12px',
  display: 'flex',
  flexDirection: 'column',
  boxSizing: 'border-box',
  minHeight: 0,
};

// Fase 1 estilos: header adelgazado. Antes 72x72 avatar + padding 12px
// hacia una banda pesada que ocupaba demasiado alto y robaba espacio al
// hilo. Ahora avatar 40x40 + padding 6px 12px + gap 10px. Reduccion
// visible del alto de la banda superior sin perder identidad del bot.
const headerStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '6px 12px',
  background: '#f9fafb',
  border: '1px solid #e5e7eb',
  borderRadius: 8,
  marginBottom: 8,
};

const avatarImgStyle = {
  width: 40,
  height: 40,
  display: 'block',
  objectFit: 'contain',
  flexShrink: 0,
};

const escalateBtnStyle = (disabled) => ({
  marginLeft: 'auto',
  background: disabled ? '#f3f4f6' : '#ffffff',
  color: disabled ? '#9ca3af' : '#374151',
  border: '1px solid #d1d5db',
  borderRadius: 6,
  padding: '8px 14px',
  fontSize: '0.9rem',
  fontWeight: 600,
  cursor: disabled ? 'not-allowed' : 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
});

const messagesAreaStyle = {
  flex: 1,
  overflowY: 'auto',
  padding: '8px 6px',
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
};

// Fix Subpasada 2D: layout estructural del input row del chat. Antes el
// `textarea` con `flex: 1` sin `minWidth: 0` no podia colapsar por debajo
// de su ancho intrinseco (placeholder + font-metrics) en viewports
// estrechos, empujando el boton "Enviar" fuera del viewport. El fix
// root-cause es asegurar que el textarea puede shrink hasta 0
// (`minWidth: 0`) y que el boton NUNCA se comprime (`flexShrink: 0` +
// `whiteSpace: 'nowrap'`). Se agrega `width: '100%'` + `boxSizing:
// border-box` al container para blindar contra padding del padre.
const inputRowStyle = {
  display: 'flex',
  gap: 8,
  alignItems: 'flex-end',
  paddingTop: 8,
  borderTop: '1px solid #e5e7eb',
  width: '100%',
  boxSizing: 'border-box',
  flexWrap: 'nowrap',
  minWidth: 0,
};

const textareaStyle = {
  flex: '1 1 auto',
  minWidth: 0,
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
  width: '100%',
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
  flexShrink: 0,
  whiteSpace: 'nowrap',
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

const typingBubbleStyle = {
  alignSelf: 'flex-start',
  padding: '8px 12px',
  borderRadius: 12,
  background: '#eff6ff',
  color: '#1e3a8a',
  border: '1px solid #bfdbfe',
  fontStyle: 'italic',
  opacity: 0.85,
  fontSize: '0.85rem',
  maxWidth: '60%',
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

  // Auto-scroll al final cuando llegan mensajes o el LLM esta pensando.
  useEffect(() => {
    const el = messagesRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, sending]);

  const rateLimited = !!rateLimitState.rateLimited;
  const humanHandling = resolutionStatus === 'HUMAN_HANDLING';

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
  const canEscalate = !sending && !!conversationId && !humanHandling;
  const escalateTooltip = humanHandling
    ? i18n.t('support.escalate.alreadyHumanHandling')
    : i18n.t('support.escalate.button');

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
        <img
          src="/img/icono-agente-ia.png"
          alt=""
          style={avatarImgStyle}
        />
        <strong>{i18n.t('support.chat.agentName')}</strong>

        <button
          type="button"
          style={escalateBtnStyle(!canEscalate)}
          onClick={() => setEscalateOpen(true)}
          disabled={!canEscalate}
          title={escalateTooltip}
        >
          <FontAwesomeIcon icon={faUserTie} />
          <span>{i18n.t('support.escalate.button')}</span>
        </button>
      </header>

      {humanHandling && (
        <div style={bannerInfo} role="status">
          {i18n.t('support.chat.systemAssigned.bannerHint')}
        </div>
      )}
      {!humanHandling && escalated && (
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
          // Fallback textual para SYSTEM sin content (defensa; el backend
          // siempre envia un mensaje literal ya localizado desde
          // buildAssignmentMessage).
          const rendered = (m.sender === 'SYSTEM' && !(m.content && m.content.trim()))
            ? { ...m, content: i18n.t('support.chat.systemAssigned.fallback') }
            : m;
          return (
            <SupportMessageBubble
              key={String(m.id)}
              message={rendered}
              pending={!!m.pending}
              agentLabel={i18n.t('support.chat.agentName')}
            />
          );
        })}
        {sending && (
          <div style={typingBubbleStyle}>{i18n.t('support.chat.typing')}</div>
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
