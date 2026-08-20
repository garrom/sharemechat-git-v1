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
import SupportAvatar from '../../components/support/SupportAvatar';
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

/**
 * @param {object} props
 * @param {number|null} [props.pinnedConversationId] - si viene, el chat
 *   queda scoped a esa conversacion (uso: vista de detalle del ticket
 *   ADR-054 D8). Sin prop, comportamiento historico (conv activa cacheada).
 * @param {boolean} [props.readOnly] - si true, oculta el input y el boton
 *   escalar (uso: ticket resuelto — historico consultable pero no
 *   editable). Backend no permite escribir en tickets resueltos porque
 *   `sendMessage` va a la conv activa, no a la pinned; el guard visual
 *   evita que el user pierda su mensaje.
 */
// Fondo oscuro del chat (rediseño favoritos Fase 2): mismo carbón + glow rojo +
// trama que StyledChatScroller, para que el chat de Agente IA en favoritos case
// con los demás chats. Solo se aplica con la prop `dark` (no en tickets).
const DARK_CHAT_BG = {
  backgroundColor: '#0d1015',
  backgroundImage: [
    'radial-gradient(130% 62% at 84% -10%, rgba(234,29,29,0.22), transparent 58%)',
    'radial-gradient(80% 55% at 6% 108%, rgba(234,29,29,0.10), transparent 55%)',
    'radial-gradient(90% 50% at -5% 2%, rgba(167,139,250,0.08), transparent 55%)',
    "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='34' height='34' viewBox='0 0 34 34'><g fill='none' stroke='%23ffffff' stroke-opacity='0.045' stroke-width='1'><path d='M17 5 L23 17 L17 29 L11 17 Z'/><circle cx='17' cy='17' r='1.1' fill='%23ffffff' fill-opacity='0.05' stroke='none'/></g></svg>\")",
  ].join(', '),
  backgroundRepeat: 'no-repeat, no-repeat, no-repeat, repeat',
};

export default function SupportChat({ pinnedConversationId, readOnly, ticketContext, dark = false } = {}) {
  const {
    messages,
    conversationId,
    loading,
    sending,
    error,
    rateLimitState,
    resolutionStatus,
    escalated,
    meta,
    sendMessage,
    requestEscalation,
  } = useSupportChat({ pinnedConversationId });

  const [input, setInput] = useState('');
  const [escalateOpen, setEscalateOpen] = useState(false);
  const [sendHover, setSendHover] = useState(false);
  const messagesRef = useRef(null);

  // Estilos oscuros (variante `dark`, chat Agente IA en favoritos). Sin dark,
  // se conservan los claros originales (tickets, admin).
  const cStyle = dark ? { ...containerStyle, ...DARK_CHAT_BG } : containerStyle;
  const hStyle = dark ? { ...headerStyle, background: '#14171d', border: '1px solid rgba(255,255,255,0.08)', color: '#e7ebf0' } : headerStyle;
  const mStyle = dark ? { ...messagesAreaStyle, background: 'transparent' } : messagesAreaStyle;
  const iRowStyle = dark ? { ...inputRowStyle, borderTop: '1px solid rgba(255,255,255,0.08)' } : inputRowStyle;
  const tStyle = dark ? { ...textareaStyle, background: 'rgba(255,255,255,0.08)', color: '#f8fafc', border: '1px solid transparent' } : textareaStyle;
  const eStyle = dark ? { ...emptyStateStyle, color: '#9aa2ad' } : emptyStateStyle;

  // Auto-scroll al final cuando llegan mensajes o el LLM esta pensando.
  useEffect(() => {
    const el = messagesRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, sending]);

  const rateLimited = !!rateLimitState.rateLimited;
  const humanHandling = resolutionStatus === 'HUMAN_HANDLING';
  // El botón "Hablar con un técnico" debe quedar deshabilitado desde que se
  // solicita (ESCALATED) hasta que se resuelva / nueva conversación, no solo
  // cuando un humano ya reclamó (HUMAN_HANDLING). Antes se podía re-escalar en
  // bucle mientras estaba en cola sin que el técnico hubiera intervenido.
  const alreadyRequestedHuman = humanHandling || escalated || resolutionStatus === 'ESCALATED';

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
  const canEscalate = !sending && !!conversationId && !alreadyRequestedHuman;
  const escalateTooltip = alreadyRequestedHuman
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
    <div style={cStyle}>
      {/* Header solo en modo unpinned (chat casual /client Soporte). En modo
          pinned (ticket) 2026-08-07: no aporta — el título "Conversación con
          el equipo" fuera del chat ya identifica el contexto; el avatar bot
          confunde porque en tickets el bot está silenciado; "Hablar con un
          técnico" es escalado dentro de escalado, redundante. La info del
          técnico asignado se propaga al banner de status humano abajo. */}
      {!pinnedConversationId && (
        <header style={hStyle}>
          <SupportAvatar size={40} />
          <strong>{i18n.t('support.chat.agentName')}</strong>
          {!readOnly && (
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
          )}
        </header>
      )}

      {/* Banner con nombre del técnico en modo pinned + humano asignado real.
          2026-08-07: solo se muestra si hay técnico REAL asignado (assignedToHuman +
          assignedProfileDisplayName con valor). En modo pinned SIN asignación real
          el banner genérico "un técnico está atendiendo" era engañoso (la conv de
          ticket nace con status HUMAN_HANDLING desde TicketService.openTicket pero
          sin agent asignado hasta que un admin la reclama). El contexto del ticket
          + SLA se comunica en el empty state contextual del ticketEmptyState. */}
      {pinnedConversationId && meta && meta.assignedToHuman && meta.assignedProfileDisplayName && (
        <div style={bannerInfo} role="status">
          {i18n.t('support.chat.assignedByName', { name: meta.assignedProfileDisplayName })}
        </div>
      )}
      {humanHandling && !pinnedConversationId && (
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

      <div style={mStyle} ref={messagesRef}>
        {loading && (
          <div style={eStyle}>…</div>
        )}
        {!loading && messages.length === 0 && (
          <div style={eStyle}>
            {ticketContext
              ? i18n.t('support.chat.ticketEmptyState', {
                  name: ticketContext.userName || '',
                  ticketId: ticketContext.ticketId,
                })
              : i18n.t('support.chat.emptyState')}
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

      {readOnly ? (
        <div style={{ ...bannerInfo, marginTop: 8 }} role="status">
          {i18n.t('support.chat.readOnlyBanner')}
        </div>
      ) : (
        <div style={iRowStyle}>
          <textarea
            style={tStyle}
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
      )}

      {!readOnly && (
        <SupportEscalateModal
          open={escalateOpen}
          onClose={() => setEscalateOpen(false)}
          onConfirm={handleEscalate}
        />
      )}
    </div>
  );
}
