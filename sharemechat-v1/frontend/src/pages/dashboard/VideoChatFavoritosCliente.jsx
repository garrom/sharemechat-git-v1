// src/pages/dashboard/VideoChatFavoritosCliente.jsx
import React,{useEffect,useRef,useState,useMemo} from 'react';
import i18n from '../../i18n';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowLeft, faPhoneSlash, faVideo, faPaperPlane, faGift, faExpand } from '@fortawesome/free-solid-svg-icons';
import FavoritesClientList from '../favorites/FavoritesClientList';
import SupportMessageBubble from '../../components/support/SupportMessageBubble';
import SessionHUD from '../../components/SessionHUD';
import { useTranslationSettings } from '../../hooks/useTranslationSettings';
import { useMessageTranslations } from '../../hooks/useMessageTranslations';
import { StyledCenter,StyledFavoritesShell,StyledFavoritesColumns,StyledCenterPanel,StyledCenterBody,
    StyledChatScroller,StyledChatDock,StyledChatInput,StyledVideoArea,StyledRemoteVideo,StyledVideoTitle,
    StyledTitleAvatar,StyledLocalVideo,StyledTopActions,StyledChatWhatsApp,StyledChatContainer,StyledRemoteVideoBlur,
    StyledChatList,StyledChatMessageRow,StyledGiftMessage,StyledGiftIcon,StyledPreCallCenter,StyledHelperLine,
    StyledBottomActionsMobile,StyledMobile3ColBar,StyledTopCenter,StyledConnectedText,StyledFloatingHangup,
    StyledCallCardDesktop,StyledCallChatColumn,StyledCallChatColHeader,StyledCallChatColScroll,StyledCallFooterDesktop,StyledCallVideoArea,StyledCallStage,StyledCallTopBar,
    StyledCallTopMeta,StyledCallTopMetaText,StyledCallTopActions,StyledCallLocalVideo,
    StyledCallComposer,StyledGiftsPanel,StyledGiftGrid,
    StyledGiftCatalog,StyledGiftSection,StyledGiftSectionTitle,StyledChatMessagesInner,StyledChatDockMessageComposer,StyledChatDockActions,
    StyledGiftBar,StyledGiftTrack,StyledGiftChip,StyledGiftFxLayer,
    StyledCallOverlayBar,StyledCallOverlayControls,StyledCallOverlayGifts,
    StyledGiftConfirmOverlay,StyledGiftConfirmCard,StyledGiftConfirmActions
} from '../../styles/pages-styles/VideochatStyles';
import GiftIcon, { resolveGiftSlug, isFaceGiftCode } from '../../components/gifts/GiftIcon';
import GiftIconDefs from '../../components/gifts/GiftIconDefs';
import EmojiTextPicker from '../../components/EmojiTextPicker';
import { isSingleEmoji } from '../../utils/emojiUtils';
import { ButtonLlamar,ButtonColgar,ButtonAceptar,ButtonRechazar,ButtonEnviar,ButtonRegalo,ButtonActivarCam,
    ButtonActivarCamMobile,ButtonVolver,ActionButton,BtnRoundVideo,BtnHangup,BtnCallDanger,BtnCallGhost,BtnSend
} from '../../styles/ButtonStyles';

// Keyframes de los efectos al enviar/recibir regalo (Fase 3). Se inyectan
// una vez via <style>; las particulas referencian estos nombres globales.
const GIFT_FX_KEYFRAMES = `
@keyframes gfxFloat{0%{transform:translateY(0) scale(.6);opacity:0}15%{opacity:1}100%{transform:translateY(-220px) translateX(var(--dx)) scale(1.05) rotate(var(--rot));opacity:0}}
@keyframes gfxFall{0%{transform:translateY(-30px) rotate(0);opacity:0}12%{opacity:1}100%{transform:translateY(var(--fall,420px)) translateX(var(--dx)) rotate(var(--rot));opacity:0}}
@keyframes gfxGlow{0%{transform:scale(.2);opacity:.85}100%{transform:scale(2.6);opacity:0}}
@keyframes gfxBigNorm{0%{transform:scale(.3);opacity:0}30%{transform:scale(2.6);opacity:1}70%{transform:scale(1);opacity:1}100%{transform:scale(1);opacity:0}}
`;

export default function VideoChatFavoritosCliente(props){
  const t = (key, options) => i18n.t(key, options);

  const {
      isMobile,handleOpenChatFromFavorites,favReload,selectedContactId,hasActiveDetail,hasCallTarget,setCtxUser,setCtxPos,centerChatPeerId,peerPresence,
      centerChatPeerName,centerMessages,centerLoading,centerListRef,chatEndRef,centerInput,setCenterInput,
      sendCenterMessage,allowChat,isPendingPanel,isSentPanel,acceptInvitation,rejectInvitation,gifts,giftRenderReady,
      fmtEUR,showCenterGifts,setShowCenterGifts,sendGiftMsg,contactMode,enterCallMode,callStatus,callCameraActive,
      callPeerId,callPeerName,callPeerAvatar,callRemoteVideoRef,callLocalVideoRef,callRemoteWrapRef,callListRef,
      handleCallActivateCamera,handleCallInvite,handleCallAccept,handleCallReject,handleCallEnd,toggleFullscreen,
      callError,backToList,user,
      currentModelRate,currentSaldo} = props;

  const baseBalanceRef = useRef(null);
  useEffect(() => {
    if (callStatus === 'in-call') {
      if (baseBalanceRef.current == null && Number.isFinite(Number(currentSaldo))) {
        baseBalanceRef.current = Number(currentSaldo);
      }
    } else {
      baseBalanceRef.current = null;
    }
  }, [callStatus, currentSaldo]);

  // Fase 1 rediseño: barra de regalos siempre visible con TODOS los regalos
  // activos en una sola fila (gratis de objeto + de pago); modal de
  // confirmacion para los de pago.
  const [confirmGift, setConfirmGift] = useState(null);

  // Presencia REAL del peer del chat: llega por prop desde DashboardClient,
  // que la deriva del listado VISIBLE (left column), misma fuente Redis que
  // el punto de estado del contacto. (No usar el listado interno de este
  // componente: se desmonta al abrir el chat en desktop.)
  const peerPresenceNorm = String(peerPresence || 'offline').toLowerCase();

  // Fase 3: efectos al aparecer un mensaje-regalo NUEVO (lo ven emisor y
  // receptor, cada uno al aparecer el mensaje en su chat).
  const fxRef = useRef(null);
  const prevIdsRef = useRef(new Set());
  // Backdrop borroso del vídeo remoto en llamada (rediseño streaming). Se
  // sincroniza el srcObject desde el vídeo principal en su onPlaying (el
  // stream lo engancha el padre vía callRemoteVideoRef).
  const callBlurVideoRef = useRef(null);

  useEffect(() => {
    prevIdsRef.current = new Set();
  }, [centerChatPeerId]);

  useEffect(() => {
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const msgs = centerMessages || [];
    const prev = prevIdsRef.current;
    const wasEmpty = prev.size === 0;
    const newMsgs = msgs.filter((m) => m.id != null && !prev.has(m.id));
    prevIdsRef.current = new Set(msgs.map((m) => m.id).filter((x) => x != null));
    // carga inicial/historial (veniamos de vacio) o recarga masiva -> sin efecto.
    if (wasEmpty || newMsgs.length === 0 || newMsgs.length > 3 || reduce) return;
    newMsgs.forEach((m) => {
      const gd = normalizeGiftMessage(m);
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

    // Premium: glow + regalo grande->normal + confeti + serpentinas.
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

  const normalizeGiftTier = (gift) =>
    String(gift?.tier || 'QUICK').toUpperCase() === 'PREMIUM' ? 'PREMIUM' : 'QUICK';

  // Regalos gratis de OBJETO (se excluyen las caritas: ya viven en el selector
  // de emojis del composer).
  const quickGifts = gifts.filter(
    (gift) => normalizeGiftTier(gift) === 'QUICK' && !isFaceGiftCode(gift.code)
  );
  const premiumGifts = gifts.filter((gift) => normalizeGiftTier(gift) === 'PREMIUM');

  const renderGiftSection = (title, items) => {
    if (!items.length) return null;

    return (
      <StyledGiftSection>
        <StyledGiftSectionTitle>{title}</StyledGiftSectionTitle>
        <StyledGiftGrid>
          {items.map(g=>(
            <button key={g.id} type="button" onClick={()=>sendGiftMsg(g.id)}>
              {g.featured === true && <span className="gift-card__badge">Featured</span>}
              <div className="gift-card__media">
                <img src={g.icon} alt={g.name}/>
              </div>
              <div className="gift-card__meta">
                <div className="gift-card__name">{g.name}</div>
                <div className="gift-card__cost">{fmtEUR(g.cost)}</div>
              </div>
            </button>
          ))}
        </StyledGiftGrid>
      </StyledGiftSection>
    );
  };

  const renderGiftPicker = () => (
    <StyledGiftsPanel>
      <StyledGiftCatalog>
        {renderGiftSection('Quick', quickGifts)}
        {renderGiftSection('Premium', premiumGifts)}
      </StyledGiftCatalog>
    </StyledGiftsPanel>
  );

  // Barra de regalos siempre visible (Fase 1). Gratis -> envio directo;
  // pago -> abre modal de confirmacion.
  const handleGiftChipClick = (g) => {
    if (!allowChat) return;
    if (normalizeGiftTier(g) === 'PREMIUM') setConfirmGift(g);
    else sendGiftMsg(g.id);
  };

  // Dos filas (2026-08-09): fila superior = regalos de PAGO (premium), fila
  // inferior = regalos GRATIS de objeto (quick). Cada fila es un track con
  // scroll horizontal propio. Comportamiento por chip: PREMIUM abre modal,
  // QUICK envia directo (via handleGiftChipClick).
  const renderGiftChip = (g) => (
    <StyledGiftChip
      key={g.id}
      type="button"
      disabled={!allowChat}
      title={g.name}
      aria-label={g.name}
      onClick={() => handleGiftChipClick(g)}
    >
      <GiftIcon code={g.code} iconUrl={g.icon} alt={g.name || ''} size={24} />
      {normalizeGiftTier(g) === 'PREMIUM' && <span className="gift-chip__price">{fmtEUR(g.cost)}</span>}
    </StyledGiftChip>
  );

  // UNA sola fila con TODOS los regalos (gratis primero, luego pago), tanto en
  // el chat puro como en la barra sobre el vídeo (surface 'video-overlay', que
  // añade el estilo pill semitransparente).
  const renderGiftBar = (surface) => {
    const allGifts = [...quickGifts, ...premiumGifts];
    if (allGifts.length === 0) return null;
    return (
      <StyledGiftBar
        data-kind="favorites-gift-bar"
        data-surface={surface === 'video-overlay' ? 'video-overlay' : undefined}
      >
        <StyledGiftTrack data-row="all">
          {allGifts.map((g) => renderGiftChip(g))}
        </StyledGiftTrack>
      </StyledGiftBar>
    );
  };

  // Barra inferior única sobre el vídeo (rediseño llamada favoritos, portado de
  // VideoChatRandomCliente): IZQUIERDA control(es) de la llamada (colgar),
  // CENTRO barra de regalos (gratis + pago). La llamada de favoritos NO tiene
  // reportar/bloquear, así que se omite la zona derecha. El botón de colgar va
  // ~34px vía style inline para NO tocar el tamaño global de BtnCall*.
  const OVERLAY_CTRL_STYLE = { width: 34, height: 34, minWidth: 34, minHeight: 34, fontSize: 13 };
  const renderCallOverlayBar = () => (
    <StyledCallOverlayBar>
      <StyledCallOverlayControls>
        <BtnCallDanger
          onClick={() => handleCallEnd(false)}
          style={OVERLAY_CTRL_STYLE}
          title={t('dashboardClient.videoChatFavoritosCliente.actions.hangup')}
          aria-label={t('dashboardClient.videoChatFavoritosCliente.actions.hangup')}
        >
          <FontAwesomeIcon icon={faPhoneSlash} />
        </BtnCallDanger>
      </StyledCallOverlayControls>

      <StyledCallOverlayGifts>
        {renderGiftBar('video-overlay')}
      </StyledCallOverlayGifts>
    </StyledCallOverlayBar>
  );

  const renderGiftConfirmModal = () => {
    if (!confirmGift) return null;
    const cost = Number(confirmGift.cost || 0);
    const saldo = Number(currentSaldo || 0);
    const insufficient = cost > saldo;
    const close = () => setConfirmGift(null);
    const confirm = () => {
      if (insufficient) return;
      sendGiftMsg(confirmGift.id);
      close();
    };
    return (
      <StyledGiftConfirmOverlay onClick={(e) => { if (e.target === e.currentTarget) close(); }}>
        <StyledGiftConfirmCard>
          <GiftIcon code={confirmGift.code} iconUrl={confirmGift.icon} alt={confirmGift.name || ''} size={92} />
          <h3>{confirmGift.name}</h3>
          <div className="gift-confirm__price">{fmtEUR(confirmGift.cost)}</div>
          <div className="gift-confirm__to">
            {t('dashboardClient.videoChatFavoritosCliente.gifts.to', 'Para')} <strong>{centerChatPeerName || ''}</strong>
          </div>
          <div className="gift-confirm__bal" data-insufficient={insufficient}>
            {insufficient
              ? t('dashboardClient.videoChatFavoritosCliente.gifts.insufficient', 'Saldo insuficiente')
              : `${t('dashboardClient.videoChatFavoritosCliente.gifts.balance', 'Saldo')} ${fmtEUR(saldo)} · ${t('dashboardClient.videoChatFavoritosCliente.gifts.remaining', 'te quedarán')} ${fmtEUR(saldo - cost)}`}
          </div>
          <StyledGiftConfirmActions>
            <button type="button" data-role="cancel" onClick={close}>
              {t('common.cancel', 'Cancelar')}
            </button>
            <button type="button" data-role="confirm" disabled={insufficient} onClick={confirm}>
              {t('dashboardClient.videoChatFavoritosCliente.gifts.send', 'Enviar regalo')}
            </button>
          </StyledGiftConfirmActions>
        </StyledGiftConfirmCard>
      </StyledGiftConfirmOverlay>
    );
  };

  // Cabecera del chat (rediseño favoritos): contacto actual (avatar+nombre)
  // arriba + toggle "Ver original" a la derecha. Sustituye al toggle flotante.
  // El estado (en línea/ocupado/desconectado) usa la presencia REAL del peer,
  // tomada del listado (peerPresence), igual que el punto del contacto.
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

  const normalizeGiftMessage = (message) => {
    if (!message) return null;

    if (message.gift) {
      return {
        giftId: Number(message.gift.giftId ?? message.gift.id),
        id: Number(message.gift.giftId ?? message.gift.id),
        code: message.gift.code ?? null,
        name: message.gift.name ?? '',
        icon: message.gift.icon ?? null,
        cost: message.gift.cost ?? null,
        tier: message.gift.tier ?? null,
        featured: message.gift.featured ?? null,
      };
    }

    if (
      typeof message.body === 'string' &&
      message.body.startsWith('[[GIFT:') &&
      message.body.endsWith(']]')
    ) {
      try {
        const parts = message.body.slice(2, -2).split(':');
        if (parts.length >= 3 && parts[0] === 'GIFT') {
          return {
            giftId: Number(parts[1]),
            id: Number(parts[1]),
            name: parts.slice(2).join(':'),
            icon: null,
            cost: null,
            tier: null,
            featured: null,
          };
        }
      } catch {}
    }

    return null;
  };

  const getGiftVisualSrc = (giftData) => {
    if (!giftData) return null;

    if (giftData.icon) return giftData.icon;
    if (!giftRenderReady) return null;

    const lookupId = Number(giftData.giftId ?? giftData.id);
    const found = gifts.find(gg => Number(gg.id) === lookupId);
    return found?.icon || null;
  };

  const renderGiftVisual = (giftData) => {
    if (!giftData) return null;

    // code del snapshot del mensaje, o resuelto por id desde el catalogo.
    let code = giftData.code || null;
    if (!code) {
      const lookupId = Number(giftData.giftId ?? giftData.id);
      const found = gifts.find(gg => Number(gg.id) === lookupId);
      code = found?.code || null;
    }
    const src = getGiftVisualSrc(giftData); // fallback al icono remoto
    const tier = String(giftData.tier || '').toUpperCase();
    const isPremium = tier === 'PREMIUM';

    if (!code && !src) return null;

    return (
      <StyledGiftMessage $premium={isPremium} style={{ minWidth: 0 }}>
        <GiftIcon code={code} iconUrl={src} alt={giftData.name || ''} size={isPremium ? 36 : 34} />
      </StyledGiftMessage>
    );
  };

  // Fase 1 estilos: chat P2P reutiliza SupportMessageBubble con variantes
  // P2P_ME / P2P_PEER. Los mensajes de regalo mantienen su renderizado
  // WhatsApp-like (StyledGiftMessage) sin cambio. El fondo beige, la
  // textarea negra, las reactions y el boton regalo del cliente quedan
  // intactos: solo cambia la burbuja de texto.
  // Fase 1.1: SupportMessageBubble recibe peerNickname / userNickname
  // para renderizar avatar circular con inicial + timestamp bajo cada
  // burbuja, igual que las burbujas del chat de soporte.
  // renderChatMessage acepta opts.transparent para forzar burbujas
  // transparentes (overlay del video). Se usa desde renderCallMessages
  // — el chat normal de favoritos (fuera de llamada) mantiene burbujas
  // opacas.
  // pending-hardening §5.3: traduccion automatica chat P2P cross-language.
  // useTranslationSettings sirve la config global (feature enabled + toggle
  // showOriginal persistido en localStorage). useMessageTranslations hace
  // batch fetch de traducciones al viewerLang para mensajes recibidos.
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

  const renderChatMessage = (m, opts = {}) => {
    const { transparent = false } = opts;
    const giftData = normalizeGiftMessage(m);
    const isMe = Number(m.senderId) === Number(user?.id);
    if (giftData) {
      // Alinea el regalo igual que las burbujas de texto (SupportMessageBubble),
      // que llevan un avatar de 32px + gap 10px = 42px en el lado del emisor.
      // Sin este padding el regalo sobresale ~42px respecto al texto.
      return (
        <StyledChatMessageRow
          key={m.id}
          $side={isMe ? 'me' : 'peer'}
          style={isMe ? { paddingRight: 42 } : { paddingLeft: 42 }}
        >
          {renderGiftVisual(giftData)}
        </StyledChatMessageRow>
      );
    }
    // Un solo emoji -> grande y sin globo (estilo WhatsApp).
    if (isSingleEmoji(m.body)) {
      return (
        <StyledChatMessageRow key={m.id} $side={isMe ? 'me' : 'peer'} style={isMe ? { paddingRight: 42 } : { paddingLeft: 42 }}>
          <span role="img" aria-label={(m.body || '').trim()} style={{ fontSize: 34, lineHeight: 1 }}>
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
          sender: isMe ? 'P2P_ME' : 'P2P_PEER',
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

  // Toggle "Ver original / Ver traduccion" que se renderiza en la cabecera
  // del chat cuando la feature esta habilitada y hay al menos un mensaje del
  // peer. Persistente en localStorage via useTranslationSettings.
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

  // 2026-08-08: el chat overlay durante llamada 1a1 debe comportarse como
  // el chat random: SOLO muestra los mensajes escritos DURANTE la llamada,
  // no todo el historial P2P (que se ve al salir de la llamada en el chat
  // WhatsApp completo).
  //
  // Snapshot de IDs conocidos al entrar en 'in-call' (no timestamp: el
  // backend serializa LocalDateTime sin zone info y comparar con Date.now()
  // provoca discrepancias horarias que dejaban el filtro rechazando todos
  // los mensajes). Los mensajes nuevos tienen id > cualquiera del snapshot.
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

  const renderCallMessages = () => callMessages.map((m) => renderChatMessage(m, { transparent: true }));

  // Toggle overlay call (posicionado top-left del video peer para no
  // solapar con StyledLocalVideo top-right ni con hangup center-bottom).
  const shouldShowCallTranslationToggle = translationEnabled && viewerLang && callMessages.some(
    (m) => Number(m?.senderId) !== Number(user?.id) && !m?.gift
  );

  return(<>
    <GiftIconDefs />
    <style dangerouslySetInnerHTML={{ __html: GIFT_FX_KEYFRAMES }} />
    {renderGiftConfirmModal()}
    {!isMobile &&(
      <StyledFavoritesShell>
        <StyledFavoritesColumns>
          <StyledCenterPanel>
            {!hasActiveDetail?(
              <div style={{color:'#adb5bd',textAlign:'center'}}>{t('dashboardClient.videoChatFavoritosCliente.empty.selectFavorite')}</div>
            ):(
              <>
                <StyledCenterBody>
                  {isPendingPanel&&(
                    <div style={{flex:1,minHeight:0,display:'flex',alignItems:'center',justifyContent:'center',border:'1px solid #333',borderRadius:8,padding:16,background:'rgba(0,0,0,0.2)'}}>
                      <div style={{textAlign:'center'}}>
                        <p style={{color:'#fff',marginBottom:16}}>{t('dashboardClient.videoChatFavoritosCliente.invitation.pendingMessage', { name: centerChatPeerName })}</p>
                        <div style={{display:'flex',gap:12,justifyContent:'center'}}>
                          <ButtonAceptar onClick={acceptInvitation}>{t('dashboardClient.videoChatFavoritosCliente.actions.accept')}</ButtonAceptar>
                          <ButtonRechazar onClick={rejectInvitation} style={{backgroundColor:'#dc3545'}}>{t('dashboardClient.videoChatFavoritosCliente.actions.reject')}</ButtonRechazar>
                        </div>
                      </div>
                    </div>
                  )}

                  {isSentPanel&&(
                    <div style={{flex:1,minHeight:0,display:'flex',alignItems:'center',justifyContent:'center',border:'1px solid #333',borderRadius:8,padding:16,background:'rgba(0,0,0,0.2)'}}>
                      <div style={{textAlign:'center',color:'#e9ecef'}}>
                        <p style={{marginBottom:8}}>{t('dashboardClient.videoChatFavoritosCliente.invitation.sentMessage', { name: centerChatPeerName })}</p>
                        <p style={{fontSize:12,color:'#adb5bd'}}>{t('dashboardClient.videoChatFavoritosCliente.invitation.sentHint')}</p>
                      </div>
                    </div>
                  )}

                  {!isPendingPanel&&!isSentPanel&&contactMode==='call'&&(
                    <div style={{flex:1,minHeight:0,display:'flex',flexDirection:'column',justifyContent:'center',alignItems:'center'}}>
                      {callError&&<p style={{color:'orange',marginTop:6}}>[CALL] {callError}</p>}

                      <StyledTopActions style={{gap:8,display:'flex',justifyContent:'center',alignItems:'center',flexDirection:'column'}}>
                        {!callCameraActive&&callStatus!=='incoming'&&(
                          <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:6,marginTop:8}}>
                            <ButtonActivarCam
                              onClick={handleCallActivateCamera}
                              disabled={callStatus==='idle'?!allowChat:false}
                              title={callStatus==='idle'?(allowChat?t('dashboardClient.videoChatFavoritosCliente.actions.activateCameraHint'):t('dashboardClient.videoChatFavoritosCliente.call.acceptedFavoritesRequired')):t('dashboardClient.videoChatFavoritosCliente.actions.activateCameraHint')}
                            >{t('dashboardClient.videoChatFavoritosCliente.actions.activateCamera')}</ButtonActivarCam>
                            <StyledHelperLine style={{color:'#000'}}>
                              <FontAwesomeIcon icon={faVideo}/>
                              {t('dashboardClient.videoChatFavoritosCliente.hints.activateCamera')}
                            </StyledHelperLine>
                          </div>
                        )}

                        {callCameraActive&&callStatus!=='in-call'&&callStatus!=='ringing'&&callStatus!=='connecting'&&(
                          <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:6,marginTop:8}}>
                            <BtnRoundVideo
                              onClick={handleCallInvite}
                              disabled={!allowChat||!callPeerId}
                              title={!allowChat?t('dashboardClient.videoChatFavoritosCliente.call.acceptedFavoritesRequired'):(!callPeerId?t('dashboardClient.videoChatFavoritosCliente.call.selectContact'):t('dashboardClient.videoChatFavoritosCliente.call.callName', { name: callPeerName||callPeerId }))}
                              aria-label={t('dashboardClient.videoChatFavoritosCliente.actions.call')}
                            ><FontAwesomeIcon icon={faVideo}/></BtnRoundVideo>
                            <StyledHelperLine style={{color:'#000'}}>
                              <FontAwesomeIcon icon={faVideo}/>
                              {t('dashboardClient.videoChatFavoritosCliente.hints.startVideoCall')}
                            </StyledHelperLine>
                          </div>
                        )}

                        {(callStatus==='ringing'||callStatus==='connecting')&&(
                          <div style={{display:'flex',flexDirection:'column',justifyContent:'center',alignItems:'center',gap:8,marginTop:8}}>
                            <div style={{color:'#fff',textAlign:'center'}}>
                              {callStatus==='ringing'
                                ? t('dashboardClient.videoChatFavoritosCliente.call.ringing', { name: callPeerName||t('dashboardClient.videoChatFavoritosCliente.labels.userDefault') })
                                : t('dashboardClient.videoChatFavoritosCliente.call.connecting')}
                            </div>
                            <BtnHangup onClick={()=>handleCallEnd(false)} title={t('dashboardClient.videoChatFavoritosCliente.actions.hangup')} aria-label={t('dashboardClient.videoChatFavoritosCliente.actions.hangup')}>
                              <FontAwesomeIcon icon={faPhoneSlash}/>
                            </BtnHangup>
                          </div>
                        )}
                      </StyledTopActions>

                      {callStatus==='in-call'&&(
                        <StyledCallCardDesktop data-full="true" data-chat-side="true">
                          <StyledCallVideoArea>
                            <StyledRemoteVideo ref={callRemoteWrapRef} style={{position:'relative',width:'100%',height:'100%',borderRadius:0,overflow:'hidden',background:'#000'}}>
                              <StyledCallStage>
                                <StyledCallTopBar>
                                  <StyledCallTopMeta>
                                    <StyledTitleAvatar src={callPeerAvatar||'/img/avatarChica.png'} alt=""/>
                                    <StyledCallTopMetaText>
                                      {callPeerName||t('dashboardClient.videoChatFavoritosCliente.labels.remote')}
                                    </StyledCallTopMetaText>
                                    <SessionHUD
                                      variant="client"
                                      active={callStatus==='in-call'}
                                      ratePerMin={currentModelRate}
                                      baseBalance={baseBalanceRef.current}
                                      externalBalance={currentSaldo}
                                      inline
                                    />
                                  </StyledCallTopMeta>
                                  <StyledCallTopActions>
                                    <BtnCallGhost
                                      type="button"
                                      onClick={()=>toggleFullscreen(callRemoteWrapRef.current)}
                                      title={t('dashboardClient.videoChatFavoritosCliente.actions.fullscreen')}
                                      aria-label={t('dashboardClient.videoChatFavoritosCliente.actions.fullscreen')}
                                      style={{ width: 36, height: 36, padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%' }}
                                    >
                                      <FontAwesomeIcon icon={faExpand} />
                                    </BtnCallGhost>
                                  </StyledCallTopActions>
                                </StyledCallTopBar>

                                <StyledRemoteVideoBlur ref={callBlurVideoRef} $ready autoPlay playsInline muted aria-hidden="true" />

                                <video
                                  ref={callRemoteVideoRef}
                                  style={{width:'100%',height:'100%',objectFit:'contain',display:'block',position:'relative',zIndex:1,background:'transparent'}}
                                  autoPlay
                                  playsInline
                                  onPlaying={(e)=>{ const s=e.currentTarget.srcObject; if(callBlurVideoRef.current && callBlurVideoRef.current.srcObject!==s) callBlurVideoRef.current.srcObject=s; }}
                                  onDoubleClick={()=>toggleFullscreen(callRemoteWrapRef.current)}
                                />

                                <StyledCallLocalVideo data-compact="true">
                                  <video
                                    ref={callLocalVideoRef}
                                    muted
                                    autoPlay
                                    playsInline
                                    style={{width:'100%',height:'100%',objectFit:'cover',display:'block'}}
                                  />
                                </StyledCallLocalVideo>

                                {/* Barra inferior única sobre el vídeo:
                                    control(es) de llamada (izq) + regalos gratis
                                    y de pago (centro). Sin reportar/bloquear en
                                    favoritos. "Ver original" NO va aquí: vive en
                                    la cabecera de la columna de chat. */}
                                <StyledGiftFxLayer ref={fxRef} />
                                {renderCallOverlayBar()}
                              </StyledCallStage>
                            </StyledRemoteVideo>
                          </StyledCallVideoArea>

                          <StyledCallChatColumn>
                            <StyledCallChatColHeader>
                              <StyledTitleAvatar src={callPeerAvatar||'/img/avatarChica.png'} alt="" style={{ width: 28, height: 28 }} />
                              <div style={{ minWidth: 0, flex: 1 }}>
                                <div style={{ fontSize: 13, fontWeight: 600, color: '#e7ebf0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {callPeerName||t('dashboardClient.videoChatFavoritosCliente.labels.remote')}
                                </div>
                              </div>
                              {/* "Ver original" como botón normal en la cabecera
                                  del chat (movido desde el overlay del vídeo). */}
                              {shouldShowCallTranslationToggle && <TranslationToggleButton />}
                            </StyledCallChatColHeader>

                            <StyledCallChatColScroll ref={callListRef}>
                              {callMessages.map((m) => renderChatMessage(m, { transparent: false }))}
                            </StyledCallChatColScroll>

                          <StyledCallFooterDesktop>
                            {/* Composer de la llamada: emoji + texto + enviar.
                                El botón de regalo ya no vive aquí: los regalos
                                están en la barra inferior sobre el vídeo. */}
                            <StyledCallComposer>
                              <EmojiTextPicker onInsert={(e) => setCenterInput((v) => (v || '') + e)} disabled={!allowChat} />
                              <StyledChatInput
                                type="text"
                                value={centerInput}
                                onChange={e=>setCenterInput(e.target.value)}
                                placeholder={t('dashboardClient.videoChatFavoritosCliente.placeholders.message')}
                                autoComplete="off"
                                onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendCenterMessage();}}}
                                onFocus={()=>setTimeout(()=>chatEndRef.current?.scrollIntoView({block:'end'}),50)}
                              />

                              <BtnSend type="button" onClick={sendCenterMessage} aria-label={t('common.sendMessage')} title={t('common.sendMessage')}>
                                <FontAwesomeIcon icon={faPaperPlane}/>
                              </BtnSend>
                            </StyledCallComposer>
                          </StyledCallFooterDesktop>
                          </StyledCallChatColumn>
                        </StyledCallCardDesktop>
                      )}

                      {callStatus==='incoming'&&(
                        <div style={{marginTop:12,padding:12,border:'1px solid #333',borderRadius:8,background:'rgba(0,0,0,0.35)',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',alignSelf:'center'}}>
                          <div style={{color:'#fff',marginBottom:8,textAlign:'center'}}>Te está llamando <strong>{callPeerName||'Usuario'}</strong>.</div>
                          <div style={{display:'flex',gap:10,justifyContent:'center',alignItems:'center'}}>
                            <ButtonAceptar onClick={handleCallAccept}>{t('dashboardClient.videoChatFavoritosCliente.actions.accept')}</ButtonAceptar>
                            <ButtonRechazar onClick={handleCallReject} style={{backgroundColor:'#dc3545'}}>{t('dashboardClient.videoChatFavoritosCliente.actions.reject')}</ButtonRechazar>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Desktop chat normal */}
                  {!isPendingPanel&&!isSentPanel&&contactMode!=='call'&&(
                    <StyledChatWhatsApp style={{position:'relative'}}>
                      <StyledGiftFxLayer ref={fxRef} />
                      {renderFavChatHeader()}
                      <StyledChatScroller ref={centerListRef} data-bg="whatsapp" data-kind="favorites-chat">
                        <StyledChatMessagesInner>
                          {centerLoading&&<div style={{color:'#adb5bd'}}>{t('dashboardClient.videoChatFavoritosCliente.loading.history')}</div>}
                          {!centerLoading&&centerMessages.length===0&&(
                            <div style={{color:'#adb5bd'}}>
                              {allowChat?t('dashboardClient.videoChatFavoritosCliente.empty.noMessages'):t('dashboardClient.videoChatFavoritosCliente.empty.chatInactive')}
                            </div>
                          )}
                          {centerMessages.map(renderChatMessage)}
                        </StyledChatMessagesInner>
                      </StyledChatScroller>

                      {renderGiftBar()}

                      <StyledChatDockMessageComposer data-kind="favorites-chat">
                        <EmojiTextPicker onInsert={(e) => setCenterInput((v) => (v || '') + e)} disabled={!allowChat} />
                        <StyledChatInput
                          value={centerInput}
                          onChange={e=>setCenterInput(e.target.value)}
                          placeholder={allowChat?t('dashboardClient.videoChatFavoritosCliente.placeholders.message'):t('dashboardClient.videoChatFavoritosCliente.empty.chatInactiveShort')}
                          onKeyDown={e=>{if(e.key==='Enter'&&allowChat)sendCenterMessage();}}
                          disabled={!allowChat}
                          onFocus={()=>{setTimeout(()=>chatEndRef.current?.scrollIntoView({block:'end'}),50);}}
                        />
                        <StyledChatDockActions>
                          <ButtonLlamar
                            onClick={enterCallMode}
                            disabled={!hasCallTarget||!allowChat}
                            title={t('dashboardClient.videoChatFavoritosCliente.actions.call')}
                            aria-label={t('dashboardClient.videoChatFavoritosCliente.actions.call')}
                          >
                            <FontAwesomeIcon icon={faVideo}/>
                          </ButtonLlamar>
                        </StyledChatDockActions>
                        {showCenterGifts&&allowChat&&renderGiftPicker()}
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

    {/* === Móvil Favoritos ALL (SIN TOCAR) === */}
    {isMobile&&(
      <>
        {!hasActiveDetail&&(
          <div style={{display:'flex',flexDirection:'column',flex:1,minHeight:0,background:'linear-gradient(180deg,#161a20 0%,#111418 100%)'}}>
            <div style={{flex:1,minHeight:0,overflowY:'auto'}}>
              <FavoritesClientList
                onSelect={handleOpenChatFromFavorites}
                reloadTrigger={favReload}
                selectedId={selectedContactId}
                onContextMenu={(user,pos)=>{setCtxUser(user);setCtxPos(pos);}}
              />
            </div>
          </div>
        )}

        {hasActiveDetail&&(
          <div style={{display:'flex',flexDirection:'column',flex:1,minHeight:0}}>
            {contactMode!=='call'&&(
              <StyledMobile3ColBar>
                <ButtonVolver type="button" onClick={backToList} aria-label={t('dashboardClient.videoChatFavoritosCliente.actions.backToList')} title={t('common.back')}>
                  <FontAwesomeIcon icon={faArrowLeft}/>
                </ButtonVolver>
                <StyledTopCenter>
                  {allowChat&&(
                    <ButtonLlamar onClick={enterCallMode} title={t('dashboardClient.videoChatFavoritosCliente.actions.call')} aria-label={t('dashboardClient.videoChatFavoritosCliente.actions.call')}>
                      {t('dashboardClient.videoChatFavoritosCliente.actions.startVideoChat')}
                    </ButtonLlamar>
                  )}
                </StyledTopCenter>
                <StyledConnectedText>{centerChatPeerName}</StyledConnectedText>
              </StyledMobile3ColBar>
            )}

            {contactMode==='call'&&(
              <>
                {!callCameraActive&&callStatus!=='incoming'&&(
                  <StyledPreCallCenter>
                    <div>
                      <ButtonActivarCamMobile
                        onClick={handleCallActivateCamera}
                        disabled={callStatus==='idle'?!allowChat:false}
                        title={callStatus==='idle'
                          ?(allowChat?'Activa tu cámara':'Debéis ser favoritos aceptados para poder llamar')
                          :'Activa tu cámara'}
                      >{t('dashboardClient.videoChatFavoritosCliente.actions.activateCamera')}</ButtonActivarCamMobile>
                      <StyledHelperLine>
                        <FontAwesomeIcon icon={faVideo}/>
                        {t('dashboardClient.videoChatFavoritosCliente.hints.activateCamera')}
                      </StyledHelperLine>
                    </div>
                  </StyledPreCallCenter>
                )}

                {!callCameraActive&&callStatus==='incoming'&&(
                  <StyledPreCallCenter>
                    <div style={{display:'flex',gap:10,justifyContent:'center'}}>
                      <ButtonAceptar onClick={handleCallAccept}>{t('dashboardClient.videoChatFavoritosCliente.actions.accept')}</ButtonAceptar>
                      <ButtonRechazar onClick={handleCallReject}>{t('dashboardClient.videoChatFavoritosCliente.actions.reject')}</ButtonRechazar>
                    </div>
                  </StyledPreCallCenter>
                )}

                {callCameraActive&&(callStatus!=='in-call'&&callStatus!=='ringing'&&callStatus!=='connecting')&&(
                  <StyledBottomActionsMobile>
                    <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:4}}>
                      <BtnRoundVideo
                        onClick={handleCallInvite}
                        disabled={!allowChat||!callPeerId}
                        title={!allowChat
                          ?t('dashboardClient.videoChatFavoritosCliente.call.acceptedFavoritesRequired')
                          :(!callPeerId?t('dashboardClient.videoChatFavoritosCliente.call.selectContact'):t('dashboardClient.videoChatFavoritosCliente.call.callName', { name: callPeerName||callPeerId }))}
                        aria-label={t('dashboardClient.videoChatFavoritosCliente.actions.call')}
                      >
                        <FontAwesomeIcon icon={faVideo}/>
                      </BtnRoundVideo>
                      <StyledHelperLine style={{marginTop:4}}>
                        <FontAwesomeIcon icon={faVideo}/>
                        {t('dashboardClient.videoChatFavoritosCliente.hints.startCall')}
                      </StyledHelperLine>
                    </div>
                  </StyledBottomActionsMobile>
                )}
              </>
            )}

            {contactMode==='call'&&(
              <div style={{margin:0,display:'flex',flexDirection:'column',flex:1,minHeight:0}}>
                <StyledVideoArea style={{display:callStatus==='in-call'?'block':'none',position:'relative'}}>
                  <StyledRemoteVideo ref={callRemoteWrapRef}>
                    <StyledVideoTitle>
                      <StyledTitleAvatar src={callPeerAvatar||'/img/avatarChico.png'} alt=""/>
                      {callPeerName||t('dashboardClient.videoChatFavoritosCliente.labels.remote')}
                    </StyledVideoTitle>
                    <video ref={callRemoteVideoRef} autoPlay playsInline style={{width:'100%',height:'100%',objectFit:'cover'}}/>
                  </StyledRemoteVideo>

                  <StyledLocalVideo>
                    <video ref={callLocalVideoRef} muted autoPlay playsInline style={{width:'100%',height:'100%',objectFit:'cover',display:'block',border:'none'}}/>
                  </StyledLocalVideo>

                  {callStatus==='in-call'&&(
                    <StyledFloatingHangup>
                      <BtnHangup onClick={()=>handleCallEnd(false)} title={t('dashboardClient.videoChatFavoritosCliente.actions.hangup')} aria-label={t('dashboardClient.videoChatFavoritosCliente.actions.hangup')}>
                        <FontAwesomeIcon icon={faPhoneSlash}/>
                      </BtnHangup>
                    </StyledFloatingHangup>
                  )}

                  <StyledChatContainer data-wide="true" style={{display:'flex',flexDirection:'column',justifyContent:'flex-end',zIndex:5}}>
                    <StyledChatList ref={callListRef} style={{width:'100%'}}>
                      {centerMessages.map((m) => renderChatMessage(m, { transparent: true }))}
                    </StyledChatList>
                  </StyledChatContainer>
                </StyledVideoArea>

                <StyledChatDock data-surface="call-dark" style={{display:callStatus==='in-call'?'flex':'none'}}>
                  <StyledChatInput
                    type="text"
                    value={centerInput}
                    onChange={e=>setCenterInput(e.target.value)}
                    placeholder={t('dashboardClient.videoChatFavoritosCliente.placeholders.message')}
                    autoComplete="off"
                    onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendCenterMessage();}}}
                    onFocus={()=>setTimeout(()=>chatEndRef.current?.scrollIntoView({block:'end'}),50)}
                  />
                  <ButtonRegalo
                    data-gift-button="true"
                    title={t('dashboardClient.videoChatFavoritosCliente.actions.sendGift')}
                    onClick={()=>setShowCenterGifts(s=>!s)}
                    aria-label={t('dashboardClient.videoChatFavoritosCliente.actions.sendGift')}
                  >
                    <FontAwesomeIcon icon={faGift}/>
                  </ButtonRegalo>

                  {showCenterGifts&&renderGiftPicker()}
                </StyledChatDock>

                {(callStatus==='connecting'||callStatus==='ringing'||callStatus==='incoming')&&(
                  <p style={{color:'#000',textAlign:'center',margin:'6px 0'}}>
                    {callStatus==='connecting'&&'Conectando…'}
                    {callStatus==='ringing'&&`Llamando a ${callPeerName||'usuario'}…`}
                    {callStatus==='incoming'&&`Te está llamando ${callPeerName||'usuario'}…`}
                  </p>
                )}
              </div>
            )}

            <StyledCenterBody data-call={contactMode==='call'?'true':undefined}>
              {isPendingPanel&&(
                <div style={{flex:1,minHeight:0,display:'flex',alignItems:'center',justifyContent:'center',border:'1px solid #333',borderRadius:8,padding:16,background:'rgba(0,0,0,0.2)'}}>
                  <div style={{textAlign:'center'}}>
                    <p style={{color:'#fff',marginBottom:16}}>{centerChatPeerName} te ha invitado a favoritos. Acepta para habilitar el chat.</p>
                    <div style={{display:'flex',gap:12,justifyContent:'center'}}>
                      <ButtonAceptar onClick={acceptInvitation}>{t('dashboardClient.videoChatFavoritosCliente.actions.accept')}</ButtonAceptar>
                      <ButtonRechazar onClick={rejectInvitation}>{t('dashboardClient.videoChatFavoritosCliente.actions.reject')}</ButtonRechazar>
                    </div>
                  </div>
                </div>
              )}

              {isSentPanel&&(
                <div style={{flex:1,minHeight:0,display:'flex',alignItems:'center',justifyContent:'center',border:'1px solid #333',borderRadius:8,padding:16,background:'rgba(0,0,0,0.2)'}}>
                  <div style={{textAlign:'center',color:'#e9ecef'}}>
                    <p style={{marginBottom:8}}>Invitación enviada. Esperando respuesta de <strong>{centerChatPeerName}</strong>.</p>
                    <p style={{fontSize:12,color:'#adb5bd'}}>El chat se habilitará cuando acepte tu invitación.</p>
                  </div>
                </div>
              )}

              {!isPendingPanel&&!isSentPanel&&contactMode!=='call'&&(
                <StyledChatWhatsApp style={{position:'relative'}}>
                  <StyledGiftFxLayer ref={fxRef} />
                  <StyledChatScroller ref={centerListRef} data-bg="whatsapp" data-kind="favorites-chat">
                    <StyledChatMessagesInner>
                      {centerLoading&&<div style={{color:'#adb5bd'}}>{t('dashboardClient.videoChatFavoritosCliente.loading.history')}</div>}
                      {!centerLoading&&centerMessages.length===0&&(
                        <div style={{color:'#adb5bd'}}>
                          {allowChat?'No hay mensajes todavía. ¡Escribe el primero!':'Este chat no está activo.'}
                        </div>
                      )}
                      {centerMessages.map(renderChatMessage)}
                    </StyledChatMessagesInner>
                  </StyledChatScroller>

                  {renderGiftBar()}

                  <StyledChatDockMessageComposer data-kind="favorites-chat">
                    <EmojiTextPicker onInsert={(e) => setCenterInput((v) => (v || '') + e)} disabled={!allowChat} />
                    <StyledChatInput
                      value={centerInput}
                      onChange={e=>setCenterInput(e.target.value)}
                      placeholder={allowChat ? t('common.chat.placeholders.message') : t('common.chat.placeholders.inactive')}
                      onKeyDown={e=>{if(e.key==='Enter'&&allowChat)sendCenterMessage();}}
                      disabled={!allowChat}
                      onFocus={()=>{setTimeout(()=>chatEndRef.current?.scrollIntoView({block:'end'}),50);}}
                    />
                    {showCenterGifts&&allowChat&&renderGiftPicker()}
                  </StyledChatDockMessageComposer>
                </StyledChatWhatsApp>
              )}
            </StyledCenterBody>
          </div>
        )}
      </>
    )}
  </>);
}
