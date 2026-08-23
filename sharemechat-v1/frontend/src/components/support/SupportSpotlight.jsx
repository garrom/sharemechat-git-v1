// 3ª columna del chat de Soporte (2026-08-23). Espejo funcional de
// ModelSpotlight, pero para el bot/soporte: avatar grande, identidad, dos
// "pills" (Asistente IA / Soporte Humano) que indican quién atiende, botón
// "Hablar con un técnico" (escalado, movido aquí desde la cabecera del chat),
// estado en vivo de la conversación y un "cómo funciona". Consume el estado
// compartido vía useSupportChatCtx (misma instancia que el centro, sin
// doble-polling). Identidad en rojo rosado, igual que SupportAvatar.

import React, { useState } from 'react';
import i18n from '../../i18n';
import { useSupportChatCtx } from './SupportChatContext';
import SupportEscalateModal from '../../pages/support/SupportEscalateModal';

const wrap = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 14,
  padding: '20px 16px',
  width: '100%',
  boxSizing: 'border-box',
};

const avatarWrap = {
  width: 58,
  height: 58,
  borderRadius: '50%',
  background: 'linear-gradient(135deg, #ff5470, #d61f4e)',
  border: '1.5px solid rgba(255,255,255,0.30)',
  display: 'grid',
  placeItems: 'center',
  boxShadow: '0 4px 14px rgba(214,31,78,0.30)',
  flexShrink: 0,
};

const nameStyle = { fontSize: 16, fontWeight: 700, color: '#f3f5f8', margin: '4px 0 0', textAlign: 'center' };
const roleStyle = { fontSize: 12, color: '#8b93a0', margin: 0, textAlign: 'center' };

const pillsRow = { display: 'flex', gap: 8, marginTop: 2, flexWrap: 'wrap', justifyContent: 'center' };
const pillBase = { display: 'inline-flex', alignItems: 'center', gap: 7, padding: '6px 13px', borderRadius: 999, fontSize: 12.5, fontWeight: 600 };
const pillOn = { ...pillBase, background: 'rgba(214,31,78,0.16)', color: '#ff8fa3', border: '1px solid rgba(214,31,78,0.55)' };
const pillOff = { ...pillBase, background: 'rgba(255,255,255,0.03)', color: '#6b7280', border: '1px solid rgba(255,255,255,0.07)' };
const dotOn = { width: 8, height: 8, borderRadius: '50%', background: '#ff5470', boxShadow: '0 0 8px #ff5470' };
const dotOff = { width: 8, height: 8, borderRadius: '50%', background: '#4b5563' };

const escBtnBase = {
  width: '100%',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  borderRadius: 10,
  padding: '11px 14px',
  fontSize: 13,
  fontWeight: 600,
};
const escBtnEnabled = { ...escBtnBase, background: 'rgba(255,255,255,0.04)', color: '#dfe4ea', border: '1px solid rgba(255,255,255,0.12)', cursor: 'pointer' };
const escBtnDisabled = { ...escBtnBase, background: 'rgba(255,255,255,0.02)', color: '#5b636e', border: '1px solid rgba(255,255,255,0.06)', cursor: 'not-allowed' };

const cardStyle = { width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '12px 14px', boxSizing: 'border-box' };
const cardTitle = { margin: '0 0 9px', fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#8b93a0', fontWeight: 700 };
const rowStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13, padding: '4px 0', gap: 12 };
const rowK = { color: '#9aa2ad' };
const rowV = { color: '#e7ebf0', fontWeight: 600, textAlign: 'right' };

const stepsWrap = { display: 'flex', flexDirection: 'column', gap: 10 };
const stepStyle = { display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 12.5, color: '#c4cad2', lineHeight: 1.4 };
const stepNum = { flex: '0 0 20px', width: 20, height: 20, borderRadius: '50%', background: 'rgba(214,31,78,0.18)', color: '#ff8fa3', fontSize: 11, fontWeight: 700, display: 'grid', placeItems: 'center' };

// Auricular blanco (mismo trazo que SupportAvatar/IconSupport), grande.
const HeadsetGlyph = () => (
  <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
    <path d="M4 14v-2a8 8 0 0116 0v2" />
    <rect x="2.2" y="14" width="4.2" height="6.6" rx="1.8" fill="#fff" stroke="none" />
    <rect x="17.6" y="14" width="4.2" height="6.6" rx="1.8" fill="#fff" stroke="none" />
    <path d="M19 20.6a5 5 0 01-5 3h-2" />
  </svg>
);

export default function SupportSpotlight() {
  const {
    resolutionStatus,
    escalated,
    rateLimitState,
    conversationId,
    requestEscalation,
    sending,
  } = useSupportChatCtx();

  const [escalateOpen, setEscalateOpen] = useState(false);

  const humanHandling = resolutionStatus === 'HUMAN_HANDLING';
  const requested = humanHandling || escalated || resolutionStatus === 'ESCALATED';
  const resolved = resolutionStatus === 'RESOLVED';
  const aiActive = !requested && !resolved;

  const canEscalate = !sending && !!conversationId && !requested && !resolved;
  const msgsLeft = rateLimitState ? rateLimitState.messagesRemainingToday : null;

  const estadoLabel = resolved
    ? i18n.t('support.spotlight.status.resolved')
    : humanHandling
    ? i18n.t('support.spotlight.status.human')
    : requested
    ? i18n.t('support.spotlight.status.waiting')
    : i18n.t('support.spotlight.status.ai');

  const handleEscalate = async (reason) => {
    await requestEscalation(reason);
    setEscalateOpen(false);
  };

  return (
    <div style={wrap}>
      <div style={avatarWrap}>
        <HeadsetGlyph />
      </div>

      <div>
        <p style={nameStyle}>{i18n.t('support.spotlight.name')}</p>
        <p style={roleStyle}>{i18n.t('support.spotlight.subtitle')}</p>
      </div>

      <div style={pillsRow}>
        <span style={aiActive ? pillOn : pillOff}>
          <span style={aiActive ? dotOn : dotOff} />
          {i18n.t('support.spotlight.pill.ai')}
        </span>
        <span style={requested ? pillOn : pillOff}>
          <span style={requested ? dotOn : dotOff} />
          {i18n.t('support.spotlight.pill.human')}
        </span>
      </div>

      <button
        type="button"
        style={canEscalate ? escBtnEnabled : escBtnDisabled}
        onClick={() => canEscalate && setEscalateOpen(true)}
        disabled={!canEscalate}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M12 12a5 5 0 100-10 5 5 0 000 10zm0 2c-5 0-9 2.5-9 6v2h18v-2c0-3.5-4-6-9-6z" />
        </svg>
        {i18n.t('support.escalate.button')}
      </button>

      <div style={cardStyle}>
        <h4 style={cardTitle}>{i18n.t('support.spotlight.statusCard')}</h4>
        <div style={rowStyle}>
          <span style={rowK}>{i18n.t('support.spotlight.rowStatus')}</span>
          <span style={rowV}>{estadoLabel}</span>
        </div>
        {msgsLeft != null && (
          <div style={rowStyle}>
            <span style={rowK}>{i18n.t('support.spotlight.rowMessages')}</span>
            <span style={rowV}>{i18n.t('support.spotlight.rowMessagesValue', { count: msgsLeft })}</span>
          </div>
        )}
        {conversationId && (
          <div style={rowStyle}>
            <span style={rowK}>{i18n.t('support.spotlight.rowConversation')}</span>
            <span style={rowV}>#{conversationId}</span>
          </div>
        )}
      </div>

      <div style={cardStyle}>
        <h4 style={cardTitle}>{i18n.t('support.spotlight.howTitle')}</h4>
        <div style={stepsWrap}>
          <div style={stepStyle}><span style={stepNum}>1</span><span>{i18n.t('support.spotlight.how1')}</span></div>
          <div style={stepStyle}><span style={stepNum}>2</span><span>{i18n.t('support.spotlight.how2')}</span></div>
          <div style={stepStyle}><span style={stepNum}>3</span><span>{i18n.t('support.spotlight.how3')}</span></div>
        </div>
      </div>

      <SupportEscalateModal
        open={escalateOpen}
        onClose={() => setEscalateOpen(false)}
        onConfirm={handleEscalate}
      />
    </div>
  );
}
