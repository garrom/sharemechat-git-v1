import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import styled from 'styled-components';
import i18n from '../../../i18n';
import { apiFetch } from '../../../config/http';
import { useSession } from '../../../components/SessionProvider';
import useConversationPolling from '../../../hooks/useConversationPolling';
import PillStatus from './components/PillStatus';
import SupportButton from './components/SupportButton';
import SupportMessageBubble from '../../../components/support/SupportMessageBubble';
import SupportClaimModal from './components/SupportClaimModal';
import SupportResolveConfirmModal from './components/SupportResolveConfirmModal';

// Frente B.3.2 (ADR-046). Detalle de una conversacion: hilo + metadata + acciones.
// Layout 72/28 sticky en desktop, stack vertical en mobile.

const Wrap = styled.div`
  padding: 12px 4px;
`;

const HeaderRow = styled.div`
  display: flex;
  gap: 12px;
  align-items: center;
  margin-bottom: 12px;
  flex-wrap: wrap;
`;

const BackLink = styled.button`
  background: none;
  border: none;
  color: #1e3a8a;
  cursor: pointer;
  font-size: 0.9rem;
  font-weight: 600;
  padding: 0;
`;

const Layout = styled.div`
  display: flex;
  gap: 20px;
  align-items: flex-start;

  @media (max-width: 900px) {
    flex-direction: column;
    gap: 12px;
  }
`;

const ThreadWrap = styled.div`
  flex: 3;
  min-width: 0;

  @media (max-width: 900px) {
    flex: initial;
    width: 100%;
    order: 2;
  }
`;

const SidebarWrap = styled.div`
  flex: 1;
  min-width: 260px;
  position: sticky;
  top: 16px;

  @media (max-width: 900px) {
    position: static;
    order: 1;
    width: 100%;
  }
`;

const MetaCard = styled.div`
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 14px 16px;
`;

const MetaBlock = styled.div`
  margin-bottom: 12px;
`;

const MetaLabel = styled.div`
  font-size: 0.72rem;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  font-weight: 700;
  margin-bottom: 2px;
`;

const MetaValue = styled.div`
  font-size: 0.9rem;
  color: #0f172a;
`;

const ActionRow = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 16px;
`;

const OtherAgentBanner = styled.div`
  background: #fff7ed;
  border: 1px solid #fed7aa;
  border-radius: 10px;
  padding: 10px 14px;
  color: #9a3412;
  font-size: 0.9rem;
  margin-bottom: 12px;
`;

const ThreadBox = styled.div`
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  background: #fff;
  padding: 14px;
  max-height: 60vh;
  overflow-y: auto;
`;

const InputCard = styled.div`
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  background: #fff;
  padding: 12px;
  margin-top: 12px;
`;

const TextArea = styled.textarea`
  width: 100%;
  min-height: 90px;
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid #d1d5db;
  font-family: inherit;
  font-size: 0.9rem;
  resize: vertical;
  box-sizing: border-box;
  &:focus { outline: none; border-color: #1e3a8a; }
`;

const InputMeta = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 8px;
  font-size: 0.75rem;
  color: #64748b;
`;

const ErrorLine = styled.div`
  padding: 8px 12px;
  background: #fef2f2;
  color: #991b1b;
  border-radius: 6px;
  border: 1px solid #fecaca;
  margin: 8px 0;
  font-size: 0.85rem;
`;

const formatIso = (s) => {
  if (!s) return '—';
  try {
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return '—';
    const yyyy = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${yyyy}-${mo}-${dd} ${hh}:${mm}`;
  } catch {
    return '—';
  }
};

const MAX_LEN = 4000;

const SupportConversationDetailView = ({ conversationId, onBack, onActionRefresh }) => {
  const t = (key, opts) => i18n.t(key, opts);
  const { user } = useSession();
  const currentUserId = user?.id || null;

  const [pending, setPending] = useState([]);   // optimistic HUMAN outbox
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [actionErr, setActionErr] = useState('');
  const [showClaim, setShowClaim] = useState(false);
  const [showResolve, setShowResolve] = useState(false);
  const threadRef = useRef(null);
  const lastMsgIdRef = useRef(null);

  // El polling solo aplica cuando la conv esta HUMAN_HANDLING y ME pertenece.
  const [prevConv, setPrevConv] = useState(null);
  const pollingEnabled = useMemo(() => {
    const conv = prevConv;
    if (!conv) return false;
    return conv.resolutionStatus === 'HUMAN_HANDLING'
      && Number(conv.assignedAgentId) === Number(currentUserId);
  }, [prevConv, currentUserId]);

  const {
    data,
    error: fetchError,
    refresh,
  } = useConversationPolling(conversationId, { enabled: pollingEnabled, pollingSec: 8 });

  useEffect(() => {
    if (data?.conversation) setPrevConv(data.conversation);
  }, [data]);

  // Auto-scroll al bottom si el user esta cerca del bottom (evita romper scroll
  // durante lectura de contexto viejo).
  useEffect(() => {
    const el = threadRef.current;
    if (!el) return;
    const msgs = data?.messages || [];
    const lastId = msgs.length > 0 ? msgs[msgs.length - 1].id : null;
    if (lastId === lastMsgIdRef.current) return;
    lastMsgIdRef.current = lastId;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (distanceFromBottom < 180) {
      el.scrollTop = el.scrollHeight;
    }
  }, [data]);

  // Al recibir mensajes reales que colapsen los pending, purgar los pending
  // que ya aparezcan como HUMAN en el servidor (heuristica por content match
  // + sender=HUMAN + sentByUserId=currentUserId).
  useEffect(() => {
    if (!data?.messages || pending.length === 0) return;
    const serverHumans = data.messages.filter(
      (m) => m.sender === 'HUMAN' && Number(m.sentByUserId) === Number(currentUserId),
    );
    if (serverHumans.length === 0) return;
    setPending((prev) => prev.filter((p) => !serverHumans.some((s) => s.content === p.content)));
  }, [data, pending.length, currentUserId]);

  const conv = data?.conversation || prevConv;
  const messages = data?.messages || [];

  const isMineClaimed = conv
    && conv.resolutionStatus === 'HUMAN_HANDLING'
    && Number(conv.assignedAgentId) === Number(currentUserId);
  const isOtherClaimed = conv
    && conv.resolutionStatus === 'HUMAN_HANDLING'
    && Number(conv.assignedAgentId) !== Number(currentUserId)
    && conv.assignedAgentId != null;
  const isEscalatedUnassigned = conv
    && conv.resolutionStatus === 'ESCALATED'
    && conv.assignedAgentId == null;

  const handleClaimSuccess = useCallback(() => {
    setShowClaim(false);
    refresh();
    if (onActionRefresh) onActionRefresh();
  }, [refresh, onActionRefresh]);

  const handleResolveSuccess = useCallback(() => {
    setShowResolve(false);
    refresh();
    if (onActionRefresh) onActionRefresh();
  }, [refresh, onActionRefresh]);

  const handleRelease = useCallback(async () => {
    setActionErr('');
    try {
      await apiFetch(`/admin/support/conversations/${conversationId}/release`, {
        method: 'POST',
      });
      refresh();
      if (onActionRefresh) onActionRefresh();
    } catch (e) {
      setActionErr(e?.message || 'Error');
    }
  }, [conversationId, refresh, onActionRefresh]);

  const handleSend = useCallback(async () => {
    const clean = String(input || '').trim();
    if (!clean || clean.length > MAX_LEN || sending) return;
    setSending(true);
    setActionErr('');
    const optimistic = {
      id: `tmp-${Date.now()}`,
      sender: 'HUMAN',
      content: clean,
      createdAt: new Date().toISOString(),
      sentByUserId: currentUserId,
      sentByProfileId: conv?.assignedProfileId,
      sentByProfileDisplayName: conv?.assignedProfileDisplayName,
      __pending: true,
    };
    setPending((prev) => [...prev, optimistic]);
    setInput('');
    try {
      await apiFetch(`/admin/support/conversations/${conversationId}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: clean }),
      });
      refresh();
    } catch (e) {
      setActionErr(e?.message || 'Error');
      // Marcar el pending como fallido para poder revertir/reintentar.
      setPending((prev) => prev.map((p) => (
        p.id === optimistic.id ? { ...p, __failed: true } : p
      )));
    } finally {
      setSending(false);
    }
  }, [input, sending, conversationId, currentUserId, conv, refresh]);

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!conv) {
    return (
      <Wrap>
        <HeaderRow>
          <BackLink type="button" onClick={onBack}>{t('admin.support.detail.back')}</BackLink>
        </HeaderRow>
        <div style={{ color: '#64748b', padding: 20 }}>
          {fetchError ? fetchError.message : t('admin.support.common.loading')}
        </div>
      </Wrap>
    );
  }

  return (
    <Wrap>
      <HeaderRow>
        <BackLink type="button" onClick={onBack}>{t('admin.support.detail.back')}</BackLink>
        <PillStatus
          status={conv.resolutionStatus}
          label={t(`admin.support.status.${conv.resolutionStatus}`, { defaultValue: conv.resolutionStatus })}
        />
        <span style={{ color: '#64748b', fontSize: '0.85rem' }}>
          #{conv.id}
        </span>
      </HeaderRow>

      {isOtherClaimed ? (
        <OtherAgentBanner>
          {t('admin.support.detail.attendedBy', {
            displayName: conv.assignedProfileDisplayName || '—',
            when: formatIso(conv.assignedAt),
          })}
        </OtherAgentBanner>
      ) : null}

      {actionErr ? <ErrorLine>{actionErr}</ErrorLine> : null}

      <Layout>
        <ThreadWrap>
          <ThreadBox ref={threadRef}>
            {messages.length === 0 ? (
              <div style={{ padding: 12, color: '#64748b' }}>
                {t('admin.support.detail.empty')}
              </div>
            ) : (
              messages.map((m) => (
                <SupportMessageBubble
                  key={m.id}
                  message={m}
                  userEmail={conv.userEmail}
                />
              ))
            )}
            {pending.map((p) => (
              <SupportMessageBubble
                key={p.id}
                message={p}
                userEmail={conv.userEmail}
                pending
              />
            ))}
          </ThreadBox>

          {isMineClaimed ? (
            <InputCard>
              <TextArea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder={t('admin.support.detail.inputPlaceholder')}
                maxLength={MAX_LEN}
              />
              <InputMeta>
                <span>{t('admin.support.detail.chars', { count: input.length, max: MAX_LEN })}</span>
                <SupportButton
                  variant="primary"
                  size="md"
                  onClick={handleSend}
                  disabled={sending || !input.trim() || input.length > MAX_LEN}
                >
                  {sending ? t('admin.support.detail.sending') : t('admin.support.actions.send')}
                </SupportButton>
              </InputMeta>
            </InputCard>
          ) : null}
        </ThreadWrap>

        <SidebarWrap>
          <MetaCard>
            <MetaBlock>
              <MetaLabel>{t('admin.support.detail.metadata.user')}</MetaLabel>
              <MetaValue>{conv.userEmail || `#${conv.userId}`}</MetaValue>
              <MetaValue style={{ fontSize: '0.78rem', color: '#64748b' }}>{conv.userRole}</MetaValue>
            </MetaBlock>
            <MetaBlock>
              <MetaLabel>{t('admin.support.detail.metadata.escalatedAt')}</MetaLabel>
              <MetaValue>
                {conv.escalatedByLlm ? '🤖 ' : conv.escalatedByLlm === false && conv.escalatedAt ? '👤 ' : ''}
                {formatIso(conv.escalatedAt)}
              </MetaValue>
            </MetaBlock>
            {conv.escalationReason ? (
              <MetaBlock>
                <MetaLabel>{t('admin.support.detail.metadata.reason')}</MetaLabel>
                <MetaValue style={{ fontSize: '0.85rem' }}>{conv.escalationReason}</MetaValue>
              </MetaBlock>
            ) : null}
            {conv.assignedAgentId ? (
              <MetaBlock>
                <MetaLabel>{t('admin.support.detail.metadata.assignedTo')}</MetaLabel>
                <MetaValue>
                  {conv.assignedProfileDisplayName || `#${conv.assignedAgentId}`}
                </MetaValue>
                <MetaValue style={{ fontSize: '0.78rem', color: '#64748b' }}>
                  {formatIso(conv.assignedAt)}
                </MetaValue>
              </MetaBlock>
            ) : null}
            <MetaBlock>
              <MetaLabel>{t('admin.support.detail.metadata.msgsCount')}</MetaLabel>
              <MetaValue>{conv.messageCount || 0}</MetaValue>
            </MetaBlock>

            <ActionRow>
              {isEscalatedUnassigned ? (
                <SupportButton variant="primary" onClick={() => setShowClaim(true)}>
                  {t('admin.support.actions.claim')}
                </SupportButton>
              ) : null}
              {isMineClaimed ? (
                <>
                  <SupportButton variant="secondary" onClick={handleRelease}>
                    {t('admin.support.actions.release')}
                  </SupportButton>
                  <SupportButton variant="success" onClick={() => setShowResolve(true)}>
                    {t('admin.support.actions.resolve')}
                  </SupportButton>
                </>
              ) : null}
            </ActionRow>
          </MetaCard>
        </SidebarWrap>
      </Layout>

      {showClaim ? (
        <SupportClaimModal
          conversationId={conv.id}
          onClose={() => setShowClaim(false)}
          onClaimed={handleClaimSuccess}
        />
      ) : null}
      {showResolve ? (
        <SupportResolveConfirmModal
          conversationId={conv.id}
          onClose={() => setShowResolve(false)}
          onResolved={handleResolveSuccess}
        />
      ) : null}
    </Wrap>
  );
};

export default SupportConversationDetailView;
