import React, { useMemo, useState, useEffect, useRef } from 'react';
import i18n from '../../i18n';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowLeft, faPhoneSlash, faVideo, faPaperPlane, faGift, faExpand } from '@fortawesome/free-solid-svg-icons';
import SessionHUD from '../../components/SessionHUD';
import FavoritesModelList from '../favorites/FavoritesModelList';
import SupportMessageBubble from '../../components/support/SupportMessageBubble';
import { useTranslationSettings } from '../../hooks/useTranslationSettings';
import { useMessageTranslations } from '../../hooks/useMessageTranslations';
import {
  StyledFavoritesShell,
  StyledFavoritesColumns,
  StyledCenterPanel,
  StyledCenterBody,
  StyledChatScroller,
  StyledChatDock,
  StyledChatInput,
  StyledVideoArea,
  StyledRemoteVideo,
  StyledVideoTitle,
  StyledTitleAvatar,
  StyledLocalVideo,
  StyledTopActions,
  StyledChatWhatsApp,
  StyledChatContainer,
  StyledChatList,
  StyledRemoteVideoBlur,
  StyledChatMessageRow,
  StyledGiftMessage,
  StyledGiftIcon,
  StyledPreCallCenter,
  StyledHelperLine,
  StyledBottomActionsMobile,
  StyledMobile3ColBar,
  StyledTopCenter,
  StyledConnectedText,
  StyledFloatingHangup,
  StyledCallCardDesktop,
  StyledCallChatColumn,
  StyledCallChatColHeader,
  StyledCallChatColScroll,
  StyledCallFooterDesktop,
  StyledCallVideoArea,
  StyledCallStage,
  StyledCallTopBar,
  StyledCallTopMeta,
  StyledCallTopMetaText,
  StyledCallTopActions,
  StyledCallLocalVideo,
  StyledCallBottomBar,
  StyledCallBottomInner,
  StyledCallPrimaryActions,
  StyledCallComposer,
  StyledChatMessagesInner,
  StyledChatDockMessageComposer,
  StyledChatDockActions,
  StyledGiftsPanel,
  StyledGiftGrid,
  StyledGiftCatalog,
  StyledGiftSection,
  StyledGiftSectionTitle,
  StyledGiftFxLayer,
  StyledGiftBar,
  StyledGiftTrack,
  StyledGiftChip,
} from '../../styles/pages-styles/VideochatStyles';
import GiftIcon, { resolveGiftSlug, isFaceGiftCode } from '../../components/gifts/GiftIcon';
import GiftIconDefs from '../../components/gifts/GiftIconDefs';
import EmojiTextPicker from '../../components/EmojiTextPicker';
import { isSingleEmoji } from '../../utils/emojiUtils';
import {
  ButtonLlamar,
  ButtonRegalo,
  ButtonAceptar,
  ButtonRechazar,
  ButtonActivarCam,
  ButtonActivarCamMobile,
  ButtonVolver,
  BtnRoundVideo,
  BtnHangup,
  BtnCallDanger,
  BtnCallGhost,
  BtnSend,
} from '../../styles/ButtonStyles';

// Keyframes de los efectos al enviar/recibir regalo (Fase 3). Se inyectan
// una vez via <style>; las particulas referencian estos nombres globales.
const GIFT_FX_KEYFRAMES = `
@keyframes gfxFloat{0%{transform:translateY(0) scale(.6);opacity:0}15%{opacity:1}100%{transform:translateY(-220px) translateX(var(--dx)) scale(1.05) rotate(var(--rot));opacity:0}}
@keyframes gfxFall{0%{transform:translateY(-30px) rotate(0);opacity:0}12%{opacity:1}100%{transform:translateY(var(--fall,420px)) translateX(var(--dx)) rotate(var(--rot));opacity:0}}
@keyframes gfxGlow{0%{transform:scale(.2);opacity:.85}100%{transform:scale(2.6);opacity:0}}
@keyframes gfxBigNorm{0%{transform:scale(.3);opacity:0}30%{transform:scale(2.6);opacity:1}70%{transform:scale(1);opacity:1}100%{transform:scale(1);opacity:0}}
`;

export default function VideoChatFavoritosModelo(props) {
  const t = (key, options) => i18n.t(key, options);

  const {
    isMobile,
    modelEconomics,
    allowChat,
    isPendingPanel,
    isSentPanel,
    contactMode,
    openChatWith,
    centerChatPeerName,
    peerPresence,
    callPeerName,
    callPeerId,
    callPeerAvatar,
    callError,
    callStatus,
    callCameraActive,
    centerMessages,
    centerInput,
    callRemoteWrapRef,
    callRemoteVideoRef,
    callListRef,
    modelCenterListRef,
    callLocalVideoRef,
    setContactMode,
    enterCallMode,
    sendCenterMessage,
    setCenterInput,
    acceptInvitation,
    rejectInvitation,
    handleCallActivateCamera,
    handleCallInvite,
    handleCallEnd,
    toggleFullscreen,
    handleCallAccept,
    handleCallReject,
    user,
    gifts,
    giftRenderReady,
    handleOpenChatFromFavorites,
    favReload,
    selectedContactId,
    hasActiveDetail,
    hasCallTarget,
    backToList,
    callClientSaldo,
    callClientSaldoLoading,
    // Fase 2: picker de FREE_EMOJI en chat WhatsApp del modelo.
    // Solo aplica en la vista chat de favoritos (no en modo call, MVP).
    showCenterGifts,
    setShowCenterGifts,
    sendGiftMsg,
    fmtEUR,
  } = props;

  const normalizeGiftFromMessage = (giftData) => {
    if (!giftData) return null;

    const giftId = Number(giftData.giftId ?? giftData.id);
    if (!Number.isFinite(giftId) || giftId <= 0) return null;

    return {
      giftId,
      id: giftId,
      code: giftData.code ?? null,
      name: giftData.name ?? '',
      icon: giftData.icon ?? null,
      cost: giftData.cost ?? null,
      tier: giftData.tier ?? null,
      featured: typeof giftData.featured === 'boolean' ? giftData.featured : null,
    };
  };

  const buildLegacyGiftFromBody = (body) => {
    if (typeof body !== 'string') return null;
    if (!body.startsWith('[[GIFT:') || !body.endsWith(']]')) return null;

    try {
      const parts = body.slice(2, -2).split(':');
      if (parts.length < 3 || parts[0] !== 'GIFT') return null;

      const giftId = Number(parts[1]);
      if (!Number.isFinite(giftId) || giftId <= 0) return null;

      const catalogGift = gifts.find((gg) => Number(gg.id) === giftId);

      return {
        giftId,
        id: giftId,
        code: catalogGift?.code ?? null,
        name: catalogGift?.name ?? parts.slice(2).join(':'),
        icon: catalogGift?.icon ?? null,
        cost: catalogGift?.cost ?? null,
        tier: catalogGift?.tier ?? null,
        featured: typeof catalogGift?.featured === 'boolean' ? catalogGift.featured : null,
      };
    } catch {
      return null;
    }
  };

  const resolveGiftData = (message) => {
    const structuredGift = normalizeGiftFromMessage(message?.gift);
    if (structuredGift) return structuredGift;
    return buildLegacyGiftFromBody(message?.body);
  };

  // Fase 3: efectos al aparecer un mensaje-regalo NUEVO (lado modelo; lo ve
  // el modelo cuando el cliente le envia un regalo).
  const fxRef = useRef(null);
  // Backdrop borroso del vídeo remoto en llamada (rediseño streaming).
  const callBlurVideoRef = useRef(null);

  // Contador de ganancia del modelo en llamada (paridad con random-modelo):
  // suma de regalos recibidos del cliente durante la llamada, con el %reparto
  // de regalos (modelEconomics.giftModelSharePct, fallback 90). Se resetea al
  // terminar la llamada. La acumulación real vive tras definir callMessages.
  const [giftsSumEur, setGiftsSumEur] = React.useState(0);
  const seenGiftKeysRef = React.useRef(new Set());
  React.useEffect(() => {
    if (callStatus !== 'in-call') {
      seenGiftKeysRef.current = new Set();
      setGiftsSumEur(0);
    }
  }, [callStatus]);
  const prevIdsRef = useRef(new Set());

  useEffect(() => {
    prevIdsRef.current = new Set();
  }, [selectedContactId]);

  useEffect(() => {
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const msgs = centerMessages || [];
    const prev = prevIdsRef.current;
    const wasEmpty = prev.size === 0;
    const newMsgs = msgs.filter((m) => m.id != null && !prev.has(m.id));
    prevIdsRef.current = new Set(msgs.map((m) => m.id).filter((x) => x != null));
    // carga inicial/historial o recarga masiva -> sin efecto (bug confeti masivo).
    if (wasEmpty || newMsgs.length === 0 || newMsgs.length > 3 || reduce) return;
    newMsgs.forEach((m) => {
      const gd = resolveGiftData(m);
      if (gd) playGiftFx(gd);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [centerMessages]);

  const playGiftFx = (gd) => {
    const layer = fxRef.current;
    if (!layer || !gd) return;

    let tier = gd.tier;
    let code = gd.code;
    if (!tier || !code) {
      const found = gifts.find((g) => Number(g.id) === Number(gd.giftId ?? gd.id));
      tier = tier || found?.tier;
      code = code || found?.code;
    }
    const isPremium = String(tier || '').toUpperCase() === 'PREMIUM';

    const W = layer.clientWidth || 0;
    const H = layer.clientHeight || 0;
    const cx = W * 0.72;
    const cy = H - 24;
    const rnd = (a, b) => a + (b - a) * Math.random();
    const COLS = ['#ff5c8a', '#f5b942', '#5cc8ff', '#a78bfa', '#35d29b', '#ff7a1a'];

    const spawn = (html, style, dur) => {
      const el = document.createElement('div');
      el.className = 'gfx-p';
      if (html) el.innerHTML = html;
      Object.keys(style).forEach((k) => {
        if (k.charAt(0) === '-') el.style.setProperty(k, style[k]);
        else el.style[k] = style[k];
      });
      layer.appendChild(el);
      setTimeout(() => { if (el.parentNode) el.parentNode.removeChild(el); }, dur);
    };

    if (!isPremium) {
      for (let i = 0; i < 8; i++) {
        setTimeout(() => spawn('❤️', {
          left: (cx + rnd(-34, 20)) + 'px', top: cy + 'px', fontSize: rnd(16, 28) + 'px',
          '--dx': rnd(-40, 40) + 'px', '--rot': rnd(-30, 30) + 'deg',
          animation: `gfxFloat ${rnd(1.1, 1.7)}s ease-out forwards`,
        }, 1800), i * 80);
      }
      return;
    }

    spawn('', {
      left: (cx - 65) + 'px', top: (cy - 90) + 'px', width: '130px', height: '130px',
      borderRadius: '50%', background: 'radial-gradient(circle,rgba(255,220,140,.7),transparent 65%)',
      animation: 'gfxGlow .9s ease-out forwards',
    }, 900);

    const slug = resolveGiftSlug(code);
    if (slug) {
      spawn(`<svg><use href="#gi-${slug}"/></svg>`, {
        left: (cx - 45) + 'px', top: (cy - 120) + 'px', width: '90px', height: '90px',
        transformOrigin: 'bottom center', animation: 'gfxBigNorm 1.1s cubic-bezier(.22,1.4,.4,1) forwards',
      }, 1200);
    }

    for (let c = 0; c < 40; c++) {
      setTimeout(() => {
        const w = rnd(6, 11);
        spawn('', {
          left: rnd(0, W) + 'px', top: '-20px', width: w + 'px', height: (w * 1.7) + 'px',
          borderRadius: '2px', background: COLS[c % COLS.length],
          '--dx': rnd(-40, 40) + 'px', '--rot': rnd(180, 620) + 'deg', '--fall': (H + 40) + 'px',
          animation: `gfxFall ${rnd(1.4, 2.4)}s linear forwards`,
        }, 2600);
      }, c * 22);
    }
    for (let s = 0; s < 14; s++) {
      setTimeout(() => {
        const h = rnd(46, 90);
        spawn('', {
          left: rnd(0, W) + 'px', top: (-h - 10) + 'px', width: rnd(5, 8) + 'px', height: h + 'px',
          borderRadius: '6px', background: COLS[s % COLS.length], opacity: '0.9',
          '--dx': rnd(-70, 70) + 'px', '--rot': rnd(120, 420) + 'deg', '--fall': (H + 40) + 'px',
          animation: `gfxFall ${rnd(1.8, 2.8)}s cubic-bezier(.4,.1,.6,1) forwards`,
        }, 2900);
      }, s * 40);
    }
  };

  const renderGiftVisual = (giftData) => {
    const normalizedGift = normalizeGiftFromMessage(giftData);
    if (!normalizedGift) return null;

    let code = normalizedGift.code || null;
    if (!code) {
      code = gifts.find((gg) => Number(gg.id) === Number(normalizedGift.id))?.code || null;
    }
    const fallbackIcon =
      !normalizedGift.icon && giftRenderReady
        ? gifts.find((gg) => Number(gg.id) === Number(normalizedGift.id))?.icon || null
        : null;
    const src = normalizedGift.icon || fallbackIcon || null;
    const tier = String(normalizedGift.tier || '').toUpperCase();
    const isPremium = tier === 'PREMIUM';

    if (!code && !src) return null;

    return (
      <StyledGiftMessage $premium={isPremium}>
        <GiftIcon code={code} iconUrl={src} alt={normalizedGift.name || ''} size={isPremium ? 88 : 48} />
      </StyledGiftMessage>
    );
  };

  // Fase 2 chat P2P: picker de FREE_EMOJI para el modelo. El catalogo
  // `gifts` ya viene filtrado desde /available (solo tier=QUICK para MODEL),
  // pero como cinturon + tirantes agrupamos solo por Quick y no
  // renderizamos ninguna seccion Premium por si el backend cambia.
  const normalizeGiftTier = (gift) =>
    String(gift?.tier || 'QUICK').toUpperCase() === 'PREMIUM' ? 'PREMIUM' : 'QUICK';
  // Solo objetos gratis: se excluyen las caritas (ya viven en el selector de
  // emojis del composer, boton 😊).
  const modelQuickGifts = Array.isArray(gifts)
    ? gifts.filter((g) => normalizeGiftTier(g) === 'QUICK' && !isFaceGiftCode(g.code))
    : [];

  const renderGiftPicker = () => (
    <StyledGiftsPanel>
      <StyledGiftCatalog>
        {modelQuickGifts.length > 0 ? (
          <StyledGiftSection>
            <StyledGiftSectionTitle>Quick</StyledGiftSectionTitle>
            <StyledGiftGrid>
              {modelQuickGifts.map((g) => (
                <button key={g.id} type="button" onClick={() => sendGiftMsg && sendGiftMsg(g.id)}>
                  {g.featured === true && <span className="gift-card__badge">Featured</span>}
                  <div className="gift-card__media">
                    <img src={g.icon} alt={g.name} />
                  </div>
                  <div className="gift-card__meta">
                    <div className="gift-card__name">{g.name}</div>
                    <div className="gift-card__cost">{typeof fmtEUR === 'function' ? fmtEUR(g.cost) : ''}</div>
                  </div>
                </button>
              ))}
            </StyledGiftGrid>
          </StyledGiftSection>
        ) : null}
      </StyledGiftCatalog>
    </StyledGiftsPanel>
  );

  // Barra de emojis GRATIS siempre visible (modelo solo tiene free). Sin
  // segmento ni "+"; misma zona que el cliente. Envio directo.
  const renderModelGiftBar = () => (
    <StyledGiftBar data-kind="favorites-gift-bar">
      <StyledGiftTrack>
        {modelQuickGifts.map((g) => (
          <StyledGiftChip
            key={g.id}
            type="button"
            disabled={!allowChat}
            title={g.name}
            aria-label={g.name}
            onClick={() => { if (allowChat && sendGiftMsg) sendGiftMsg(g.id); }}
          >
            <GiftIcon code={g.code} iconUrl={g.icon} alt={g.name || ''} size={32} />
          </StyledGiftChip>
        ))}
      </StyledGiftTrack>
    </StyledGiftBar>
  );

  // Fase 1 estilos: chat P2P reutiliza SupportMessageBubble con variantes
  // P2P_ME / P2P_PEER. Los mensajes de regalo mantienen su renderizado
  // WhatsApp-like sin cambio. Dos variantes de helper:
  //   - renderChatMessage (convencion estandar isMe -> P2P_ME derecha):
  //     usado en las vistas de chat WhatsApp de favoritos.
  //   - renderChatMessageInverted (invierte isMe/peer): usado en las
  //     vistas call originales del modelo donde variant era
  //     `isMe ? 'peer' : 'me'` para que los mensajes propios del modelo
  //     aparezcan a la izquierda. Preservamos esa peculiaridad
  //     historica sin unificarla (fuera de scope).
  // buildBubble acepta opts.transparent para forzar burbujas transparentes
  // sobre el video de streaming en Favoritos-Call. Se propaga desde los
  // renderers de call (renderDesktopCallMessages y equivalente mobile).
  // pending-hardening §5.3: traduccion automatica chat P2P cross-language.
  // Ver equivalente en VideoChatFavoritosCliente.jsx.
  const {
    enabled: translationEnabled,
    viewerLang,
    showOriginal,
    toggleShowOriginal,
  } = useTranslationSettings(user);
  const { getTranslation } = useMessageTranslations({
    messages: centerMessages,
    viewerId: user?.id,
    viewerLang,
    enabled: translationEnabled,
    showOriginal,
  });

  const buildBubble = (m, isMe, senderMe, senderPeer, opts = {}) => {
    const { transparent = false } = opts;
    const giftData = resolveGiftData(m);
    if (giftData) {
      return (
        <StyledChatMessageRow key={m.id} $side={isMe ? senderMe.side : senderPeer.side}>
          {renderGiftVisual(giftData)}
        </StyledChatMessageRow>
      );
    }
    // Un solo emoji -> grande y sin globo (estilo WhatsApp).
    if (isSingleEmoji(m.body)) {
      return (
        <StyledChatMessageRow key={m.id} $side={isMe ? senderMe.side : senderPeer.side}>
          <span role="img" aria-label={(m.body || '').trim()} style={{ fontSize: 40, lineHeight: 1 }}>
            {(m.body || '').trim()}
          </span>
        </StyledChatMessageRow>
      );
    }
    return (
      <SupportMessageBubble
        key={m.id}
        message={{
          id: m.id,
          sender: isMe ? senderMe.sender : senderPeer.sender,
          content: m.body,
          createdAt: m.createdAt,
        }}
        peerNickname={centerChatPeerName || ''}
        userNickname={user?.nickname || ''}
        transparent={transparent}
        translation={isMe ? null : getTranslation(m.id)}
      />
    );
  };

  const shouldShowTranslationToggle = translationEnabled && viewerLang && (centerMessages || []).some(
    (m) => Number(m?.senderId) !== Number(user?.id) && !m?.gift
  );
  const TranslationToggleButton = () => shouldShowTranslationToggle ? (
    <button
      type="button"
      onClick={toggleShowOriginal}
      title={showOriginal
        ? i18n.t('chat.translation.showTranslations', 'Mostrar traducciones')
        : i18n.t('chat.translation.showOriginal', 'Ver original')}
      style={{
        background: showOriginal ? '#fff' : '#dbeafe',
        color: '#1e3a8a',
        border: '1px solid #bfdbfe',
        borderRadius: 999,
        padding: '4px 10px',
        fontSize: 12,
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        userSelect: 'none',
      }}
    >
      <span>↻</span>
      <span>
        {showOriginal
          ? i18n.t('chat.translation.showTranslations', 'Mostrar traducciones')
          : i18n.t('chat.translation.showOriginal', 'Ver original')}
      </span>
    </button>
  ) : null;

  // Presencia REAL del peer del chat: llega por prop desde DashboardModel,
  // que la deriva del listado VISIBLE (left column), misma fuente Redis que
  // el punto de estado del contacto. (No usar el listado interno de este
  // componente: se desmonta al abrir el chat en desktop.)
  const peerPresenceNorm = String(peerPresence || 'offline').toLowerCase();

  // Cabecera del chat (rediseño favoritos): contacto actual (avatar+nombre)
  // arriba + toggle "Ver original" a la derecha. Igual que el lado cliente.
  // El estado usa la presencia real del peer (peerPresenceNorm), no placeholder.
  const renderFavChatHeader = () => {
    const pMeta = peerPresenceNorm === 'online'
      ? { c: '#22c55e', label: t('common.presence.online', 'en línea') }
      : peerPresenceNorm === 'busy'
      ? { c: '#f59e0b', label: t('common.presence.busy', 'ocupado') }
      : { c: '#9ca3af', label: t('common.presence.offline', 'desconectado') };
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', background: '#111418', borderBottom: '1px solid rgba(255,255,255,0.08)', flexShrink: 0, position: 'relative', zIndex: 6 }}>
        <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'linear-gradient(135deg,#ff5c8a,#a78bfa)', display: 'grid', placeItems: 'center', fontSize: 13, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
          {(centerChatPeerName || '?').charAt(0).toUpperCase()}
        </div>
        <div style={{ minWidth: 0, lineHeight: 1.25 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#e7ebf0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {centerChatPeerName || ''}
          </div>
          <div style={{ fontSize: 11, color: pMeta.c }}>● {pMeta.label}</div>
        </div>
        <div style={{ marginLeft: 'auto' }}>
          {shouldShowTranslationToggle && <TranslationToggleButton />}
        </div>
      </div>
    );
  };

  const renderChatMessage = (m, opts) => {
    const isMe = Number(m.senderId) === Number(user?.id);
    return buildBubble(
      m,
      isMe,
      { sender: 'P2P_ME', side: 'me' },
      { sender: 'P2P_PEER', side: 'peer' },
      opts,
    );
  };

  const renderChatMessageInverted = (m, opts) => {
    const isMe = Number(m.senderId) === Number(user?.id);
    return buildBubble(
      m,
      isMe,
      { sender: 'P2P_PEER', side: 'peer' },
      { sender: 'P2P_ME', side: 'me' },
      opts,
    );
  };

  // 2026-08-08: chat overlay durante llamada 1a1 solo muestra mensajes de la
  // llamada actual (no el historial P2P completo). Simetrico al Cliente.
  // Snapshot de IDs conocidos al entrar en 'in-call' (evita bug de zona
  // horaria si se usara timestamp comparado con Date.now).
  const [callStartSnapshotIds, setCallStartSnapshotIds] = useState(null);
  useEffect(() => {
    if (callStatus === 'in-call' && callStartSnapshotIds == null) {
      const ids = new Set((centerMessages || []).map((m) => m?.id).filter((x) => x != null));
      setCallStartSnapshotIds(ids);
    } else if (callStatus === 'idle' || callStatus === undefined || callStatus === null) {
      if (callStartSnapshotIds != null) setCallStartSnapshotIds(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callStatus]);
  const callMessages = useMemo(() => {
    if (callStartSnapshotIds == null) return [];
    return (centerMessages || []).filter((m) => m?.id != null && !callStartSnapshotIds.has(m.id));
  }, [centerMessages, callStartSnapshotIds]);

  // Acumulación de regalos del cliente durante la llamada (para el SessionHUD
  // del modelo). Solo cuenta los mensajes-regalo del peer (cliente), una vez
  // cada uno; coste del propio regalo o del catálogo `gifts`.
  React.useEffect(() => {
    if (callStatus !== 'in-call') return;
    if (!Array.isArray(callMessages)) return;
    const pctRaw = modelEconomics?.giftModelSharePct;
    const pct = Number.isFinite(Number(pctRaw)) && Number(pctRaw) > 0 ? Number(pctRaw) : 90;
    let added = 0;
    callMessages.forEach((m, idx) => {
      if (Number(m?.senderId) === Number(user?.id)) return; // solo regalos del cliente
      const gd = resolveGiftData(m);
      if (!gd) return;
      let cost = Number(gd.cost);
      if (!Number.isFinite(cost) || cost <= 0) {
        const cat = (gifts || []).find((x) => Number(x.id) === Number(gd.giftId));
        cost = Number(cat?.cost);
      }
      if (!Number.isFinite(cost) || cost <= 0) return;
      const key = `${idx}:${gd.giftId ?? gd.code ?? cost}`;
      if (seenGiftKeysRef.current.has(key)) return;
      seenGiftKeysRef.current.add(key);
      added += (cost * pct) / 100;
    });
    if (added > 0) setGiftsSumEur((prev) => prev + added);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callMessages, callStatus, modelEconomics?.giftModelSharePct]);

  const renderDesktopCallMessages = () => callMessages.map((m) => renderChatMessageInverted(m, { transparent: true }));

  const shouldShowCallTranslationToggle = translationEnabled && viewerLang && callMessages.some(
    (m) => Number(m?.senderId) !== Number(user?.id) && !m?.gift
  );

  const renderCallClientBalance = () => (
    callClientSaldoLoading ? (
      <span>{t('dashboardModel.favorites.balanceLabel')} ...</span>
    ) : Number.isFinite(Number(callClientSaldo)) ? (
      <span>{t('dashboardModel.favorites.balanceLabel')} EUR {Number(callClientSaldo).toFixed(2)}</span>
    ) : (
      <span>{t('dashboardModel.favorites.balanceLabel')} -</span>
    )
  );

  return (
    <>
      <GiftIconDefs />
      <style dangerouslySetInnerHTML={{ __html: GIFT_FX_KEYFRAMES }} />
      {!isMobile && (
        <StyledFavoritesShell>
          <StyledFavoritesColumns>
            <StyledCenterPanel>
              {!hasActiveDetail ? (
                <div style={{ color: '#adb5bd', textAlign: 'center' }}>
                  {t('dashboardModel.favorites.selectFavorite')}
                </div>
              ) : (
                <>
                  <StyledCenterBody>
                    {isPendingPanel && (
                      <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #333', borderRadius: 8, padding: 16, background: 'rgba(0,0,0,0.2)' }}>
                        <div style={{ textAlign: 'center', maxWidth: 520 }}>
                          <p style={{ color: '#e9ecef', marginBottom: 16 }}>
                            <strong>{centerChatPeerName}</strong> {t('dashboardModel.favorites.pendingInvitationMessage')}
                          </p>
                          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                            <ButtonAceptar onClick={acceptInvitation} title={t('dashboardModel.favorites.acceptInvitation')}>
                              {t('dashboardModel.favorites.acceptInvitation')}
                            </ButtonAceptar>
                            <ButtonRechazar onClick={rejectInvitation} title={t('dashboardModel.favorites.rejectInvitation')}>
                              {t('dashboardModel.favorites.rejectInvitation')}
                            </ButtonRechazar>
                          </div>
                        </div>
                      </div>
                    )}

                    {isSentPanel && (
                      <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #333', borderRadius: 8, padding: 16, background: 'rgba(0,0,0,0.2)' }}>
                        <div style={{ textAlign: 'center', maxWidth: 520, color: '#e9ecef' }}>
                          <p style={{ marginBottom: 8 }}>
                            {t('dashboardModel.favorites.invitationSent', { name: centerChatPeerName })}
                          </p>
                          <p style={{ fontSize: 12, color: '#adb5bd' }}>
                            {t('dashboardModel.favorites.chatEnabledWhenAccepted')}
                          </p>
                        </div>
                      </div>
                    )}

                    {!isPendingPanel && !isSentPanel && contactMode === 'call' && (
                      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
                        {callError && <p style={{ color: 'orange', marginTop: 6 }}>[CALL] {callError}</p>}

                        <StyledTopActions style={{ gap: 8, display: 'flex', justifyContent: 'center', alignItems: 'center', flexDirection: 'column' }}>
                          {!callCameraActive && callStatus !== 'incoming' && (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 8 }}>
                              <ButtonActivarCam
                                onClick={handleCallActivateCamera}
                                disabled={callStatus === 'idle' ? !allowChat : false}
                                title={callStatus === 'idle' ? (allowChat ? t('dashboardModel.favorites.call.activateCamera') : t('dashboardModel.favorites.call.acceptedRequired')) : t('dashboardModel.favorites.call.activateCamera')}
                              >
                                {t('dashboardModel.favorites.call.activateCamera')}
                              </ButtonActivarCam>
                              <StyledHelperLine style={{ color: '#000' }}>
                                <FontAwesomeIcon icon={faVideo} />
                                {t('dashboardModel.favorites.call.activateCameraHint')}
                              </StyledHelperLine>
                            </div>
                          )}

                          {callCameraActive && callStatus !== 'in-call' && callStatus !== 'ringing' && callStatus !== 'connecting' && (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 8 }}>
                              <BtnRoundVideo
                                onClick={handleCallInvite}
                                disabled={!allowChat || !callPeerId}
                                title={!allowChat ? t('dashboardModel.favorites.call.acceptedRequired') : !callPeerId ? t('dashboardModel.favorites.call.selectContactFirst') : t('dashboardModel.favorites.call.callUser', { name: callPeerName || t('dashboardModel.favorites.call.defaultUser') })}
                                aria-label={t('dashboardModel.favorites.call.call')}
                              >
                                <FontAwesomeIcon icon={faVideo} />
                              </BtnRoundVideo>
                              <StyledHelperLine style={{ color: '#000' }}>
                                <FontAwesomeIcon icon={faVideo} />
                                {t('dashboardModel.favorites.call.startVideoCallHint')}
                              </StyledHelperLine>
                            </div>
                          )}

                          {(callStatus === 'ringing' || callStatus === 'connecting') && (
                            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 8 }}>
                              <div style={{ color: '#fff', textAlign: 'center' }}>
                                {callStatus === 'ringing'
                                  ? t('dashboardModel.favorites.call.callingRinging', { name: callPeerName || t('dashboardModel.favorites.call.defaultUser') })
                                  : t('dashboardModel.favorites.call.connecting')}
                              </div>
                              <BtnHangup onClick={() => handleCallEnd(false)} title={t('common.hangup')} aria-label={t('common.hangup')}>
                                <FontAwesomeIcon icon={faPhoneSlash} />
                              </BtnHangup>
                            </div>
                          )}
                        </StyledTopActions>

                        {callStatus === 'in-call' && (
                          <StyledCallCardDesktop data-full="true" data-chat-side="true">
                            <StyledCallVideoArea>
                              <StyledRemoteVideo ref={callRemoteWrapRef} style={{ position: 'relative', width: '100%', height: '100%', borderRadius: 0, overflow: 'hidden', background: '#000' }}>
                                <StyledCallStage>
                                  <StyledCallTopBar>
                                    <StyledCallTopMeta>
                                      <StyledTitleAvatar src={callPeerAvatar || '/img/avatarChico.png'} alt="" />
                                      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, lineHeight: 1.15 }}>
                                        <StyledCallTopMetaText>
                                          {callPeerName || t('dashboardModel.favorites.call.remote')}
                                        </StyledCallTopMetaText>
                                        <div style={{ fontSize: 12, opacity: 0.9, marginTop: 2, color: 'rgba(255,255,255,0.82)' }}>
                                          {renderCallClientBalance()}
                                        </div>
                                      </div>
                                      <SessionHUD
                                        variant="model"
                                        active={callStatus === 'in-call'}
                                        ratePerMin={Number(modelEconomics?.chosenRateEurPerMin)}
                                        modelSharePct={Number(modelEconomics?.modelSharePct)}
                                        giftsSum={giftsSumEur}
                                        inline
                                      />
                                    </StyledCallTopMeta>

                                    <StyledCallTopActions>
                                      <BtnCallGhost
                                        type="button"
                                        onClick={() => toggleFullscreen(callRemoteWrapRef.current)}
                                        title={t('common.fullscreen')}
                                        aria-label={t('common.fullscreen')}
                                        style={{ width: 36, height: 36, padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%' }}
                                      >
                                        <FontAwesomeIcon icon={faExpand} />
                                      </BtnCallGhost>
                                    </StyledCallTopActions>
                                  </StyledCallTopBar>

                                  <StyledRemoteVideoBlur ref={callBlurVideoRef} $ready autoPlay playsInline muted aria-hidden="true" />

                                  <video
                                    ref={callRemoteVideoRef}
                                    style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block', position: 'relative', zIndex: 1, background: 'transparent' }}
                                    autoPlay
                                    playsInline
                                    onPlaying={(e)=>{ const s=e.currentTarget.srcObject; if(callBlurVideoRef.current && callBlurVideoRef.current.srcObject!==s) callBlurVideoRef.current.srcObject=s; }}
                                    onDoubleClick={() => toggleFullscreen(callRemoteWrapRef.current)}
                                  />

                                  <StyledCallLocalVideo data-compact="true">
                                    <video
                                      ref={callLocalVideoRef}
                                      muted
                                      autoPlay
                                      playsInline
                                      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                                    />
                                  </StyledCallLocalVideo>

                                  <StyledCallBottomBar>
                                    <StyledCallBottomInner>
                                      <StyledCallPrimaryActions>
                                        <BtnCallDanger onClick={() => handleCallEnd(false)} title={t('common.hangup')} aria-label={t('common.hangup')}>
                                          <FontAwesomeIcon icon={faPhoneSlash} />
                                        </BtnCallDanger>
                                      </StyledCallPrimaryActions>
                                    </StyledCallBottomInner>
                                  </StyledCallBottomBar>
                                </StyledCallStage>
                              </StyledRemoteVideo>
                            </StyledCallVideoArea>

                            <StyledCallChatColumn>
                              <StyledCallChatColHeader>
                                <StyledTitleAvatar src={callPeerAvatar || '/img/avatarChico.png'} alt="" style={{ width: 28, height: 28 }} />
                                <div style={{ minWidth: 0, flex: 1 }}>
                                  <div style={{ fontSize: 13, fontWeight: 600, color: '#e7ebf0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {callPeerName || t('dashboardModel.favorites.call.remote')}
                                  </div>
                                  <div style={{ fontSize: 10, color: 'rgba(231,235,240,0.6)' }}>
                                    {renderCallClientBalance()}
                                  </div>
                                </div>
                                {shouldShowCallTranslationToggle && <TranslationToggleButton />}
                              </StyledCallChatColHeader>

                              <StyledCallChatColScroll ref={callListRef}>
                                {callMessages.map((m) => renderChatMessageInverted(m, { transparent: false }))}
                              </StyledCallChatColScroll>

                            <StyledCallFooterDesktop>
                              <StyledCallComposer>
                                <StyledChatInput
                                  type="text"
                                  value={centerInput}
                                  onChange={(e) => setCenterInput(e.target.value)}
                                  placeholder={t('dashboardModel.favorites.messagePlaceholder')}
                                  autoComplete="off"
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                      e.preventDefault();
                                      sendCenterMessage();
                                    }
                                  }}
                                />
                                <BtnSend type="button" onClick={sendCenterMessage} aria-label={t('common.sendMessage')} title={t('common.sendMessage')}>
                                  <FontAwesomeIcon icon={faPaperPlane} />
                                </BtnSend>
                              </StyledCallComposer>
                            </StyledCallFooterDesktop>
                            </StyledCallChatColumn>
                          </StyledCallCardDesktop>
                        )}

                        {callStatus === 'incoming' && (
                          <div style={{ marginTop: 12, padding: 12, border: '1px solid #333', borderRadius: 8, background: 'rgba(0,0,0,0.35)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', alignSelf: 'center' }}>
                            <div style={{ color: '#fff', marginBottom: 8, textAlign: 'center' }}>
                              {t('dashboardModel.favorites.incomingCall', { name: callPeerName || t('dashboardModel.favorites.call.defaultUser') })}
                            </div>
                            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', alignItems: 'center' }}>
                              <ButtonAceptar onClick={handleCallAccept}>{t('dashboardModel.favorites.acceptInvitation')}</ButtonAceptar>
                              <ButtonRechazar onClick={handleCallReject} style={{ backgroundColor: '#dc3545' }}>
                                {t('dashboardModel.favorites.rejectInvitation')}
                              </ButtonRechazar>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {!isPendingPanel && !isSentPanel && contactMode !== 'call' && (
                      <StyledChatWhatsApp style={{position:'relative'}}>
                        <StyledGiftFxLayer ref={fxRef} />
                        {renderFavChatHeader()}
                        <StyledChatScroller ref={modelCenterListRef} data-bg="whatsapp" data-kind="favorites-chat">
                          <StyledChatMessagesInner>
                            {centerMessages.length === 0 && (
                              <div style={{ color: '#adb5bd' }}>
                                {allowChat ? t('dashboardModel.favorites.noMessagesYet') : t('dashboardModel.favorites.chatInactive')}
                              </div>
                            )}
                            {centerMessages.map(renderChatMessage)}
                          </StyledChatMessagesInner>
                        </StyledChatScroller>

                        {allowChat && renderModelGiftBar()}

                        <StyledChatDockMessageComposer data-kind="favorites-chat">
                          <EmojiTextPicker onInsert={(e) => setCenterInput((v) => (v || '') + e)} disabled={!allowChat} />
                          <StyledChatInput
                            value={centerInput}
                            onChange={(e) => setCenterInput(e.target.value)}
                            placeholder={allowChat ? t('dashboardModel.favorites.messagePlaceholder') : t('dashboardModel.favorites.chatInactive')}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && !e.shiftKey && allowChat) {
                                e.preventDefault();
                                sendCenterMessage();
                              }
                            }}
                            disabled={!allowChat}
                          />
                          <StyledChatDockActions>
                            <ButtonLlamar
                              onClick={enterCallMode}
                              disabled={!hasCallTarget || !allowChat}
                              title={t('dashboardModel.favorites.call.call')}
                              aria-label={t('dashboardModel.favorites.call.call')}
                            >
                              <FontAwesomeIcon icon={faVideo} />
                            </ButtonLlamar>
                          </StyledChatDockActions>
                        </StyledChatDockMessageComposer>
                      </StyledChatWhatsApp>
                    )}
                  </StyledCenterBody>
                </>
              )}
            </StyledCenterPanel>
          </StyledFavoritesColumns>
        </StyledFavoritesShell>
      )}

      {isMobile && (
        <>
          {!hasActiveDetail && (
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, background: 'linear-gradient(180deg,#161a20 0%,#111418 100%)' }}>
              <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
                <FavoritesModelList
                  onSelect={handleOpenChatFromFavorites}
                  reloadTrigger={favReload}
                  selectedId={selectedContactId}
                />
              </div>
            </div>
          )}

          {hasActiveDetail && (
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
              {contactMode !== 'call' && (
                <StyledMobile3ColBar>
                  <ButtonVolver
                    type="button"
                    onClick={backToList}
                    aria-label={t('dashboardModel.favorites.backToList')}
                    title={t('common.back')}
                  >
                    <FontAwesomeIcon icon={faArrowLeft} />
                  </ButtonVolver>

                  <StyledTopCenter>
                    {allowChat && (
                      <ButtonLlamar onClick={enterCallMode} title={t('dashboardModel.favorites.call.call')} aria-label={t('dashboardModel.favorites.call.call')}>
                        <FontAwesomeIcon icon={faVideo} />
                        {t('dashboardModel.favorites.startVideoChat')}
                      </ButtonLlamar>
                    )}
                  </StyledTopCenter>

                  <StyledConnectedText>{centerChatPeerName}</StyledConnectedText>
                </StyledMobile3ColBar>
              )}

              {contactMode === 'call' && (
                <>
                  {!callCameraActive && callStatus !== 'incoming' && (
                    <StyledPreCallCenter>
                      <div>
                        <ButtonActivarCamMobile
                          onClick={handleCallActivateCamera}
                          disabled={callStatus === 'idle' ? !allowChat : false}
                          title={callStatus === 'idle' ? (allowChat ? t('dashboardModel.favorites.call.activateCamera') : t('dashboardModel.favorites.call.acceptedRequired')) : t('dashboardModel.favorites.call.activateCamera')}
                        >
                          {t('dashboardModel.favorites.call.activateCamera')}
                        </ButtonActivarCamMobile>
                        <StyledHelperLine>
                          <FontAwesomeIcon icon={faVideo} />
                          {t('dashboardModel.favorites.call.activateCameraHint')}
                        </StyledHelperLine>
                      </div>
                    </StyledPreCallCenter>
                  )}

                  {!callCameraActive && callStatus === 'incoming' && (
                    <StyledPreCallCenter>
                      <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                        <ButtonAceptar onClick={handleCallAccept}>{t('dashboardModel.favorites.acceptInvitation')}</ButtonAceptar>
                        <ButtonRechazar onClick={handleCallReject}>{t('dashboardModel.favorites.rejectInvitation')}</ButtonRechazar>
                      </div>
                    </StyledPreCallCenter>
                  )}

                  {callCameraActive && callStatus !== 'in-call' && callStatus !== 'ringing' && callStatus !== 'connecting' && (
                    <StyledBottomActionsMobile>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                        <BtnRoundVideo
                          onClick={handleCallInvite}
                          disabled={!allowChat || !callPeerId}
                          title={!allowChat ? t('dashboardModel.favorites.call.acceptedRequired') : !callPeerId ? t('dashboardModel.favorites.call.selectContactFirst') : t('dashboardModel.favorites.call.callUser', { name: callPeerName || t('dashboardModel.favorites.call.defaultUser') })}
                          aria-label={t('dashboardModel.favorites.call.call')}
                        >
                          <FontAwesomeIcon icon={faVideo} />
                        </BtnRoundVideo>
                        <StyledHelperLine style={{ marginTop: 4 }}>
                          <FontAwesomeIcon icon={faVideo} />
                          {t('dashboardModel.favorites.call.startCallHint')}
                        </StyledHelperLine>
                      </div>
                    </StyledBottomActionsMobile>
                  )}
                </>
              )}

              {contactMode === 'call' && (
                <div style={{ margin: 0, display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
                  <StyledVideoArea style={{ display: callStatus === 'in-call' ? 'block' : 'none', position: 'relative' }}>
                    <StyledRemoteVideo ref={callRemoteWrapRef}>
                      <StyledVideoTitle>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <StyledTitleAvatar src={callPeerAvatar || '/img/avatarChico.png'} alt="" />

                          <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.15, minWidth: 0 }}>
                            <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {callPeerName || t('dashboardModel.favorites.call.remote')}
                            </div>

                            <div style={{ fontSize: 12, opacity: 0.9, marginTop: 2 }}>
                              {callClientSaldoLoading ? (
                                <span>{t('dashboardModel.favorites.balanceLabel')} ...</span>
                              ) : Number.isFinite(Number(callClientSaldo)) ? (
                                <span>{t('dashboardModel.favorites.balanceLabel')} EUR {Number(callClientSaldo).toFixed(2)}</span>
                              ) : (
                                <span>{t('dashboardModel.favorites.balanceLabel')} -</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </StyledVideoTitle>

                      <video ref={callRemoteVideoRef} autoPlay playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </StyledRemoteVideo>

                    <StyledLocalVideo>
                      <video ref={callLocalVideoRef} muted autoPlay playsInline style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', border: '1px solid rgba(255,255,255,0.25)' }} />
                    </StyledLocalVideo>

                    {callStatus === 'in-call' && (
                      <StyledFloatingHangup>
                        <BtnHangup onClick={() => handleCallEnd(false)} title={t('common.hangup')} aria-label={t('common.hangup')}>
                          <FontAwesomeIcon icon={faPhoneSlash} />
                        </BtnHangup>
                      </StyledFloatingHangup>
                    )}

                    <StyledChatContainer data-wide="true" style={{display:'flex',flexDirection:'column',justifyContent:'flex-end',zIndex:5}}>
                      <StyledChatList ref={callListRef} style={{ width: '100%' }}>
                        {centerMessages.map((m) => renderChatMessageInverted(m, { transparent: true }))}
                      </StyledChatList>
                    </StyledChatContainer>
                  </StyledVideoArea>

                  <StyledChatDock data-surface="call-dark" style={{ display: callStatus === 'in-call' ? 'flex' : 'none' }}>
                    <StyledChatInput
                      type="text"
                      value={centerInput}
                      onChange={(e) => setCenterInput(e.target.value)}
                      placeholder={t('dashboardModel.favorites.messagePlaceholder')}
                      autoComplete="off"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          sendCenterMessage();
                        }
                      }}
                    />
                  </StyledChatDock>

                  {(callStatus === 'connecting' || callStatus === 'ringing' || callStatus === 'incoming') && (
                    <p style={{ color: '#000', textAlign: 'center', margin: '6px 0' }}>
                      {callStatus === 'connecting' && t('dashboardModel.favorites.call.connecting')}
                      {callStatus === 'ringing' && t('dashboardModel.favorites.call.callingUser', { name: callPeerName || t('dashboardModel.favorites.call.defaultUser') })}
                      {callStatus === 'incoming' && t('dashboardModel.favorites.incomingCall', { name: callPeerName || t('dashboardModel.favorites.call.defaultUser') })}
                    </p>
                  )}
                </div>
              )}

              <StyledCenterBody data-call={contactMode === 'call' ? 'true' : undefined}>
                {isPendingPanel && (
                  <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #333', borderRadius: 8, padding: 16, background: 'rgba(0,0,0,0.2)' }}>
                    <div style={{ textAlign: 'center' }}>
                      <p style={{ color: '#fff', marginBottom: 16 }}>
                        {t('dashboardModel.favorites.pendingInvitationMobile', { name: centerChatPeerName })}
                      </p>
                      <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                        <ButtonAceptar onClick={acceptInvitation}>{t('dashboardModel.favorites.acceptInvitation')}</ButtonAceptar>
                        <ButtonRechazar onClick={rejectInvitation}>{t('dashboardModel.favorites.rejectInvitation')}</ButtonRechazar>
                      </div>
                    </div>
                  </div>
                )}

                {isSentPanel && (
                  <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #333', borderRadius: 8, padding: 16, background: 'rgba(0,0,0,0.2)' }}>
                    <div style={{ textAlign: 'center', color: '#e9ecef' }}>
                      <p style={{ marginBottom: 8 }}>
                        {t('dashboardModel.favorites.invitationSent', { name: centerChatPeerName })}
                      </p>
                      <p style={{ fontSize: 12, color: '#adb5bd' }}>
                        {t('dashboardModel.favorites.chatEnabledWhenAccepted')}
                      </p>
                    </div>
                  </div>
                )}

                {!isPendingPanel && !isSentPanel && contactMode !== 'call' && (
                  <StyledChatWhatsApp style={{position:'relative'}}>
                    <StyledGiftFxLayer ref={fxRef} />
                    {shouldShowTranslationToggle && (
                      <div style={{position:'absolute',top:6,right:12,zIndex:5}}>
                        <TranslationToggleButton />
                      </div>
                    )}
                    <StyledChatScroller ref={modelCenterListRef} data-bg="whatsapp" data-kind="favorites-chat">
                      <StyledChatMessagesInner>
                        {centerMessages.length === 0 && (
                          <div style={{ color: '#adb5bd' }}>
                            {allowChat ? t('dashboardModel.favorites.noMessagesYet') : t('dashboardModel.favorites.chatInactive')}
                          </div>
                        )}
                        {centerMessages.map(renderChatMessage)}
                      </StyledChatMessagesInner>
                    </StyledChatScroller>

                    {allowChat && renderModelGiftBar()}

                    <StyledChatDockMessageComposer data-kind="favorites-chat">
                      <EmojiTextPicker onInsert={(e) => setCenterInput((v) => (v || '') + e)} disabled={!allowChat} />
                      <StyledChatInput
                        value={centerInput}
                        onChange={(e) => setCenterInput(e.target.value)}
                        placeholder={allowChat ? t('dashboardModel.favorites.messagePlaceholder') : t('dashboardModel.favorites.chatInactive')}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey && allowChat) {
                            e.preventDefault();
                            sendCenterMessage();
                          }
                        }}
                        disabled={!allowChat}
                        onFocus={() => { setTimeout(() => modelCenterListRef.current?.scrollIntoView({ block: 'end' }), 50); }}
                      />
                    </StyledChatDockMessageComposer>
                  </StyledChatWhatsApp>
                )}
              </StyledCenterBody>
            </div>
          )}
        </>
      )}
    </>
  );
}
