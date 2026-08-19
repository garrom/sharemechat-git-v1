import React, { useState, useEffect, useMemo, useRef } from 'react';
import i18n from '../../i18n';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import BlurredPreview from '../../components/BlurredPreview';
import LikeHeart from '../../components/LikeHeart';
import {
  faUserPlus,
  faVideo,
  faPhoneSlash,
  faForward,
  faPaperPlane,
  faChevronLeft,
  faChevronRight,
  faBan,
  faFlag,
  faExpand
} from '@fortawesome/free-solid-svg-icons';
import {
  StyledCenterVideochat,
  StyledSplit2,
  StyledPane,
  StyledVideoArea,
  StyledPrecallVideoArea,
  StyledPrecallLocalStage,
  StyledChatContainer,
  StyledChatList,
  StyledChatMessageRow,
  StyledChatBubble,
  StyledChatDock,
  StyledChatInput,
  StyledGiftMessage,
  StyledRemoteVideo,
  StyledRemoteVideoMedia,
  StyledRemoteVideoBlur,
  StyledRemoteVideoPlaceholder,
  StyledTitleAvatar,
  StyledPaneCenter,
  StyledPaneCenterStack,
  StyledStatusText,
  StyledPreCallCenter,
  StyledHelperLine,
  StyledRandomSearchControls,
  StyledRandomSearchCol,
  StyledSearchHint,
  StyledCallCardDesktop,
  StyledCallVideoArea,
  StyledCallFooterDesktop,
  StyledCallChatColumn,
  StyledCallChatColHeader,
  StyledCallChatColScroll,
  StyledCallStage,
  StyledCallTopBar,
  StyledCallTopMeta,
  StyledCallTopMetaText,
  StyledCallTopActions,
  StyledCallLocalVideo,
  StyledCallBottomBar,
  StyledCallBottomInner,
  StyledCallPrimaryActions,
  StyledCallSecondaryActions,
  StyledCallOverlayBar,
  StyledCallOverlayControls,
  StyledCallOverlayGifts,
  StyledCallOverlayRb,
  StyledCallComposer,
  StyledTeaserCenter,
  StyledTeaserInner,
  StyledTeaserCard,
  StyledTeaserMediaButton,
  StyledTeaserNavSlot,
  StyledTeaserFavoriteSlot,
  StyledGiftBar,
  StyledGiftTrack,
  StyledGiftChip,
  StyledGiftFxLayer,
  StyledGiftConfirmOverlay,
  StyledGiftConfirmCard,
  StyledGiftConfirmActions
} from '../../styles/pages-styles/VideochatStyles';
import {
  ButtonActivarCam,
  ButtonActivarCamMobile,
  ButtonBuscar,
  BtnSend,
  BtnCallDanger,
  BtnCallLight,
  BtnCallAlert,
  BtnCallGhost,
  BtnTeaserPrev,
  BtnTeaserNext
} from '../../styles/ButtonStyles';
import PromoVideoLightbox from '../../components/PromoVideoLightbox';
import SessionHUD from '../../components/SessionHUD';
import { useSession } from '../../components/SessionProvider';
import { apiFetch } from '../../config/http';
import { useTranslationSettings } from '../../hooks/useTranslationSettings';
import { useMessageTranslations } from '../../hooks/useMessageTranslations';
import GiftIcon, { resolveGiftSlug, isFaceGiftCode } from '../../components/gifts/GiftIcon';
import GiftIconDefs from '../../components/gifts/GiftIconDefs';
import EmojiTextPicker from '../../components/EmojiTextPicker';
import SupportMessageBubble from '../../components/support/SupportMessageBubble';
import { isSingleEmoji } from '../../utils/emojiUtils';

// Keyframes de los efectos al enviar/recibir regalo (portado de favoritos).
// Se inyectan una vez via <style>; las particulas referencian estos nombres
// globales. Va a nivel de modulo (tras los imports) para no romper import/first.
const GIFT_FX_KEYFRAMES = `
@keyframes gfxFloat{0%{transform:translateY(0) scale(.6);opacity:0}15%{opacity:1}100%{transform:translateY(-220px) translateX(var(--dx)) scale(1.05) rotate(var(--rot));opacity:0}}
@keyframes gfxFall{0%{transform:translateY(-30px) rotate(0);opacity:0}12%{opacity:1}100%{transform:translateY(var(--fall,420px)) translateX(var(--dx)) rotate(var(--rot));opacity:0}}
@keyframes gfxGlow{0%{transform:scale(.2);opacity:.85}100%{transform:scale(2.6);opacity:0}}
@keyframes gfxBigNorm{0%{transform:scale(.3);opacity:0}30%{transform:scale(2.6);opacity:1}70%{transform:scale(1);opacity:1}100%{transform:scale(1);opacity:0}}
`;

export default function VideoChatRandomCliente(props) {
  const t = (key, options) => i18n.t(key, options);

  const {
    isMobile,
    cameraActive,
    remoteStream,
    localVideoRef,
    remoteVideoRef,
    vcListRef,
    messages,
    modelNickname,
    giftRenderReady,
    getGiftIcon,
    chatInput,
    setChatInput,
    sendChatMessage,
    gifts,
    sendGiftMatch,
    fmtEUR,
    searching,
    stopAll,
    handleStartMatch,
    handleNext,
    handleAddFavorite,
    error,
    toggleFullscreen,
    remoteVideoWrapRef,
    modelAvatar,
    handleActivateCamera,
    handleBlockPeer,
    matchGraceRef,
    sendRandomMediaReady,
    nextDisabled,
    handleReportPeer,
    onViewProfile,
    randomModelId,
    currentModelRate,
    currentSaldo,
  } = props;

  const [baseBalanceAtCallStart, setBaseBalanceAtCallStart] = useState(null);

  useEffect(() => {
    if (remoteStream) {
      if (baseBalanceAtCallStart == null && Number.isFinite(Number(currentSaldo))) {
        setBaseBalanceAtCallStart(Number(currentSaldo));
      }
    } else {
      setBaseBalanceAtCallStart(null);
    }
  }, [remoteStream, currentSaldo, baseBalanceAtCallStart]);

  const { user: sessionUser, loading: sessionLoading } = useSession();

  const [promoVideos, setPromoVideos] = useState([]);
  const [activePromoIndex, setActivePromoIndex] = useState(null);
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoError, setPromoError] = useState('');
  const [currentPromoIndex, setCurrentPromoIndex] = useState(0);
  const [isDesktopRemoteVideoReady, setIsDesktopRemoteVideoReady] = useState(false);

  // Rediseño regalos (portado de VideoChatFavoritosCliente): barra siempre
  // visible con TODOS los regalos activos en una sola fila (gratis de objeto +
  // de pago) + modal de confirmacion para PREMIUM, y efectos
  // (serpentinas/confeti para pago, corazones para gratis) al enviar y recibir.
  const [confirmGift, setConfirmGift] = useState(null);
  const fxRef = useRef(null);
  // Adaptacion al flujo random: los mensajes-regalo se pushean SIN id de
  // mensaje a nivel raiz (solo gift.id, ver DashboardClient onGiftMessage), y
  // el chat es append-only (nunca carga historial). Por eso el detector de
  // "mensaje nuevo" se basa en el CONTADOR de la lista (no en un Set de ids
  // como favoritos) y dispara efectos solo para los recien anadidos.
  const prevCountRef = useRef(0);

  useEffect(() => {
    if (!remoteStream || isMobile || !cameraActive) {
      setIsDesktopRemoteVideoReady(false);
      return;
    }

    setIsDesktopRemoteVideoReady(false);
  }, [cameraActive, isMobile, remoteStream]);

  // Fase 0 streaming: backdrop borroso del vídeo remoto. Vídeo secundario mudo
  // que reproduce el MISMO MediaStream; rellena el letterbox del vídeo apaisado
  // con un blur del propio stream. Enganche aislado (no toca la plumbing del
  // vídeo nítido, que engancha el padre vía remoteVideoRef).
  const blurVideoRef = useRef(null);
  useEffect(() => {
    const el = blurVideoRef.current;
    if (!el) return;
    if (el.srcObject !== (remoteStream || null)) el.srcObject = remoteStream || null;
  }, [remoteStream, isMobile]);

  const fetchTeasers = async () => {
    setPromoLoading(true);
    setPromoError('');
    try {
      const data = await apiFetch('/models/teasers?page=0&size=20');

      const mapped = (Array.isArray(data) ? data : []).map((item) => ({
        id: item.modelId,
        title: t('dashboardClient.videoChatRandomCliente.promoTeaserTitle', { name: item.modelName }),
        modelName: item.modelName,
        thumb: item.avatarUrl || '/img/avatarChica.png',
        src: item.videoUrl,
        durationSec: null,
        // ADR-052 Superficie 2 (2026-07-25): precio por minuto elegido
        // por la modelo dentro del rango de su tramo. Rango 1-9 EUR/min.
        chosenRateEurPerMin: item.chosenRateEurPerMin,
      }));

      setPromoVideos(mapped);
      if (mapped.length > 0) setCurrentPromoIndex(0);
    } catch (e) {
      setPromoError(e?.message || t('dashboardClient.videoChatRandomCliente.errors.loadPromoVideos'));
    } finally {
      setPromoLoading(false);
    }
  };

  useEffect(() => {
    if (sessionLoading) return;
    if (!sessionUser?.id) return;

    fetchTeasers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionLoading, sessionUser?.id]);

  const handleOpenPromo = (index) => {
    setActivePromoIndex(index);
  };

  const handleClosePromo = () => {
    setActivePromoIndex(null);
  };

  const handlePrevPromo = () => {
    setActivePromoIndex((idx) => (idx > 0 ? idx - 1 : idx));
  };

  const handleNextPromo = () => {
    setActivePromoIndex((idx) => (idx < promoVideos.length - 1 ? idx + 1 : idx));
  };

  const goPrevCard = () => {
    if (promoVideos.length === 0) return;
    setCurrentPromoIndex((idx) => (idx > 0 ? idx - 1 : promoVideos.length - 1));
  };

  const goNextCard = () => {
    if (promoVideos.length === 0) return;
    setCurrentPromoIndex((idx) => (idx < promoVideos.length - 1 ? idx + 1 : 0));
  };

  const currentPromo =
    promoVideos.length > 0 ? promoVideos[Math.min(currentPromoIndex, promoVideos.length - 1)] : null;

  const handleAddFavoriteFromTeaser = (promoVideo) => {
    if (!promoVideo || !promoVideo.id) return;
    if (typeof handleAddFavorite === 'function') {
      handleAddFavorite(promoVideo.id);
    }
  };

  const normalizeGiftTier = (gift) =>
    String(gift?.tier || 'QUICK').toUpperCase() === 'PREMIUM' ? 'PREMIUM' : 'QUICK';

  const normalizeMessageGift = (gift) => {
    if (!gift) return null;

    const giftId = Number(gift.giftId ?? gift.id);
    const safeId = Number.isFinite(giftId) ? giftId : null;

    return {
      id: safeId,
      giftId: safeId,
      code: gift.code ?? null,
      name: gift.name ?? '',
      icon: gift.icon ?? null,
      cost: gift.cost ?? null,
      tier: gift.tier ?? null,
      featured: gift.featured ?? null,
    };
  };

  // Pinta el regalo del mensaje con el componente GiftIcon (por CODE), igual
  // que VideoChatFavoritosCliente. Resolver por code evita imagenes rotas de
  // objetos sin URL (p.ej. "Destello"/sparkle, cuyo icon remoto es placeholder
  // inexistente); el iconUrl remoto queda solo como fallback de retrocompat.
  const renderGiftVisual = (gift) => {
    const normalized = normalizeMessageGift(gift);
    if (!normalized) return null;

    // code del snapshot del mensaje, o resuelto por id desde el catalogo.
    let code = normalized.code || null;
    if (!code) {
      const lookupId = Number(normalized.giftId ?? normalized.id);
      code = gifts.find((gg) => Number(gg.id) === lookupId)?.code || null;
    }

    const directIcon = normalized.icon || null;
    const fallbackIcon =
      !directIcon && giftRenderReady && typeof getGiftIcon === 'function'
        ? getGiftIcon(normalized)
        : null;
    const src = directIcon || fallbackIcon || null;

    const isPremium = normalizeGiftTier(normalized) === 'PREMIUM';

    if (!code && !src) return null;

    return (
      <StyledGiftMessage $premium={isPremium} style={{ minWidth: 0 }}>
        <GiftIcon code={code} iconUrl={src} alt={normalized.name || ''} size={42} />
      </StyledGiftMessage>
    );
  };

  // Efectos al aparecer un regalo (portado de favoritos). Premium -> glow +
  // regalo grande->normal + confeti + serpentinas; gratis -> corazones.
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

  // Detecta mensajes-regalo NUEVOS (append-only) y dispara el efecto solo para
  // los recien anadidos. Diff por contador (los regalos random no traen id de
  // mensaje). Guardas: sin efecto si es la 1a poblacion masiva (>3), si no hubo
  // altas, o si el usuario prefiere movimiento reducido.
  useEffect(() => {
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const msgs = messages || [];
    const prevCount = prevCountRef.current;
    const added = msgs.length - prevCount;
    prevCountRef.current = msgs.length;
    if (added <= 0 || added > 3 || reduce) return;
    const newMsgs = msgs.slice(msgs.length - added);
    newMsgs.forEach((m) => {
      const gd = m.gift ? normalizeMessageGift(m.gift) : null;
      if (gd) playGiftFx(gd);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages]);

  // pending-hardening §5.3 (2026-08-08): traduccion automatica chat random.
  // Los mensajes random van a BD (MatchingHandlerSupport:chat handler los
  // persiste con messageService.send), el WS envia msgId; DashboardClient
  // retiene id + senderId al pushear. Aqui mapeamos {from,text,id,senderId}
  // al formato que espera useMessageTranslations ({id,body,senderId,gift}).
  const {
    enabled: translationEnabled,
    viewerLang,
    showOriginal,
    toggleShowOriginal,
  } = useTranslationSettings(sessionUser);
  // useMemo obligatorio: sin el, esta expresion crea NUEVA referencia en
  // cada render y useMessageTranslations lo tiene en su deps del useEffect
  // → loop de re-render + fetch. Con useMemo se recalcula solo cuando
  // messages (state estable de useState en el padre) cambia realmente.
  const messagesForTranslation = useMemo(() => messages.map((m) => ({
    id: m.id,
    body: m.text || '',
    senderId: m.from === 'me' ? sessionUser?.id : (m.senderId ?? -1),
    gift: m.gift,
  })), [messages, sessionUser?.id]);
  const { getTranslation } = useMessageTranslations({
    messages: messagesForTranslation,
    viewerId: sessionUser?.id,
    viewerLang,
    enabled: translationEnabled,
    showOriginal,
  });

  const renderMessages = () =>
    messages.map((msg, index) => {
      const isMe = msg.from === 'me';
      const variant = isMe ? 'me' : 'peer';
      const giftVisual = msg.gift ? renderGiftVisual(msg.gift) : null;
      const translation = !isMe && msg.id ? getTranslation(msg.id) : null;
      const hasTranslation = typeof translation === 'string' && translation.trim() !== '' && translation !== msg.text;

      // Un solo emoji -> grande y sin globo (estilo WhatsApp). Solo cuando no
      // es regalo y no hay traduccion que mostrar debajo.
      if (!giftVisual && !hasTranslation && isSingleEmoji(msg.text)) {
        return (
          <StyledChatMessageRow key={msg.id || index} $side={variant}>
            <span role="img" aria-label={(msg.text || '').trim()} style={{ fontSize: 34, lineHeight: 1 }}>
              {(msg.text || '').trim()}
            </span>
          </StyledChatMessageRow>
        );
      }

      // Regalo -> fila alineada.
      if (giftVisual) {
        return (
          <StyledChatMessageRow key={msg.id || index} $side={variant}>
            {giftVisual}
          </StyledChatMessageRow>
        );
      }

      // Texto en MÓVIL: misma burbuja con inicial de alias que favoritos
      // (SupportMessageBubble; con transparent va todo a la izquierda con
      // avatar-inicial). En desktop, la burbuja simple de siempre.
      if (isMobile) {
        return (
          <SupportMessageBubble
            key={msg.id || index}
            message={{ id: msg.id, sender: isMe ? 'P2P_ME' : 'P2P_PEER', content: msg.text, createdAt: msg.createdAt }}
            peerNickname={modelNickname || ''}
            userNickname={sessionUser?.nickname || ''}
            transparent
            translation={isMe ? null : translation}
          />
        );
      }

      return (
        <StyledChatMessageRow key={msg.id || index} $side={variant}>
          <StyledChatBubble $variant={variant}>
            {msg.text}
            {hasTranslation && (
              <div style={{
                marginTop: 6,
                paddingTop: 6,
                borderTop: '1px dashed rgba(15, 23, 42, 0.15)',
                fontSize: '0.82rem',
                opacity: 0.75,
                display: 'flex',
                gap: 6,
                alignItems: 'flex-start',
              }}>
                <span style={{ color: '#3b82f6', fontSize: '0.9rem', lineHeight: 1, flexShrink: 0, marginTop: 1 }}>↻</span>
                <span>{translation}</span>
              </div>
            )}
          </StyledChatBubble>
        </StyledChatMessageRow>
      );
    });

  const shouldShowTranslationToggle = translationEnabled && viewerLang && messages.some(
    (m) => m.from === 'peer' && m.id && !m.gift
  );
  // floating=true -> pill absoluta sobre el vídeo (móvil, chat overlay).
  // floating=false (default) -> botón normal para la cabecera de la columna de
  // chat (desktop), igual que el chat puro de favoritos.
  const TranslationToggleButton = ({ floating = false }) => shouldShowTranslationToggle ? (
    <button
      type="button"
      onClick={toggleShowOriginal}
      title={showOriginal
        ? i18n.t('chat.translation.showTranslations', 'Mostrar traducciones')
        : i18n.t('chat.translation.showOriginal', 'Ver original')}
      style={{
        ...(floating ? {
          position: 'absolute',
          bottom: 12,
          left: 12,
          zIndex: 30,
          pointerEvents: 'auto',
        } : {}),
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

  const renderCallActions = () => (
    <StyledCallBottomBar>
      <StyledCallBottomInner>
        <StyledCallPrimaryActions>
          <BtnCallDanger
            onClick={stopAll}
            title={t('dashboardClient.videoChatRandomCliente.actions.hangup')}
            aria-label={t('dashboardClient.videoChatRandomCliente.actions.hangup')}
          >
            <FontAwesomeIcon icon={faPhoneSlash} />
          </BtnCallDanger>

          <BtnCallLight
            onClick={handleNext}
            disabled={!!nextDisabled}
            aria-disabled={!!nextDisabled}
            title={t('home.hero.nextAria')}
            aria-label={t('home.hero.nextAria')}
          >
            <FontAwesomeIcon icon={faForward} />
          </BtnCallLight>

          <BtnCallLight
            onClick={() => handleAddFavorite && handleAddFavorite()}
            aria-label={t('common.actions.addToFavorites')}
            title={t('common.actions.addToFavorites')}
          >
            <FontAwesomeIcon icon={faUserPlus} />
          </BtnCallLight>
        </StyledCallPrimaryActions>

        <StyledCallSecondaryActions>
          <BtnCallAlert
            type="button"
            onClick={() => handleReportPeer && handleReportPeer()}
            aria-label={t('dashboardUserClient.report.title')}
            title={t('modals.report.title')}
          >
            <FontAwesomeIcon icon={faFlag} />
          </BtnCallAlert>

          <BtnCallAlert
            type="button"
            onClick={() => handleBlockPeer && handleBlockPeer()}
            aria-label={t('modals.block.title')}
            title={t('modals.block.title')}
          >
            <FontAwesomeIcon icon={faBan} />
          </BtnCallAlert>
        </StyledCallSecondaryActions>
      </StyledCallBottomInner>
    </StyledCallBottomBar>
  );

  // Regalos gratis de OBJETO (se excluyen las caritas: ya viven en el selector
  // de emojis del composer).
  const quickGifts = gifts.filter(
    (gift) => normalizeGiftTier(gift) === 'QUICK' && !isFaceGiftCode(gift.code)
  );
  const premiumGifts = gifts.filter((gift) => normalizeGiftTier(gift) === 'PREMIUM');

  // Barra de regalos siempre visible (portada de favoritos). Gratis -> envio
  // directo; pago -> abre modal de confirmacion.
  const handleGiftChipClick = (g) => {
    if (normalizeGiftTier(g) === 'PREMIUM') setConfirmGift(g);
    else sendGiftMatch(g.id);
  };

  // Dos filas (2026-08-09): fila superior = regalos de PAGO (premium), fila
  // inferior = regalos GRATIS de objeto (quick). Cada fila es un track con
  // scroll horizontal propio. Comportamiento por chip: PREMIUM abre modal,
  // QUICK envia directo (via handleGiftChipClick).
  const renderGiftChip = (g) => (
    <StyledGiftChip
      key={g.id}
      type="button"
      title={g.name}
      aria-label={g.name}
      onClick={() => handleGiftChipClick(g)}
    >
      <GiftIcon code={g.code} iconUrl={g.icon} alt={g.name || ''} size={24} />
      {normalizeGiftTier(g) === 'PREMIUM' && <span className="gift-chip__price">{fmtEUR(g.cost)}</span>}
    </StyledGiftChip>
  );

  // surface 'video-overlay' (desktop, barra inferior sobre el vídeo): UNA sola
  // fila con TODOS los regalos (gratis primero, luego pago). Por defecto (móvil,
  // barra en su sitio): DOS filas (pago arriba, gratis abajo), cada una con su
  // scroll horizontal.
  const renderGiftBar = (surface) => {
    if (surface === 'video-overlay') {
      const allGifts = [...quickGifts, ...premiumGifts];
      if (allGifts.length === 0) return null;
      return (
        <StyledGiftBar data-kind="random-gift-bar" data-surface="video-overlay">
          <StyledGiftTrack data-row="all">
            {allGifts.map((g) => renderGiftChip(g))}
          </StyledGiftTrack>
        </StyledGiftBar>
      );
    }
    return (
      <StyledGiftBar data-kind="random-gift-bar">
        {premiumGifts.length > 0 && (
          <StyledGiftTrack data-row="paid">
            {premiumGifts.map((g) => renderGiftChip(g))}
          </StyledGiftTrack>
        )}
        {quickGifts.length > 0 && (
          <StyledGiftTrack data-row="free">
            {quickGifts.map((g) => renderGiftChip(g))}
          </StyledGiftTrack>
        )}
      </StyledGiftBar>
    );
  };

  // Barra inferior única sobre el vídeo (desktop): [controles izq] + [regalos
  // centro] + [reportar/bloquear der] en una sola fila. Los botones de llamada
  // van más pequeños que el tamaño global (44px) vía style inline, para NO
  // tocar BtnCall* que también usan las llamadas de favoritos.
  const OVERLAY_CTRL_STYLE = { width: 34, height: 34, minWidth: 34, minHeight: 34, fontSize: 13 };
  const OVERLAY_RB_STYLE = { width: 32, height: 32, minWidth: 32, minHeight: 32, fontSize: 12 };
  const renderCallOverlayBar = () => (
    <StyledCallOverlayBar>
      <StyledCallOverlayControls>
        <BtnCallDanger
          onClick={stopAll}
          style={OVERLAY_CTRL_STYLE}
          title={t('dashboardClient.videoChatRandomCliente.actions.hangup')}
          aria-label={t('dashboardClient.videoChatRandomCliente.actions.hangup')}
        >
          <FontAwesomeIcon icon={faPhoneSlash} />
        </BtnCallDanger>

        <BtnCallLight
          onClick={handleNext}
          disabled={!!nextDisabled}
          aria-disabled={!!nextDisabled}
          style={OVERLAY_CTRL_STYLE}
          title={t('home.hero.nextAria')}
          aria-label={t('home.hero.nextAria')}
        >
          <FontAwesomeIcon icon={faForward} />
        </BtnCallLight>

        <BtnCallLight
          onClick={() => handleAddFavorite && handleAddFavorite()}
          style={OVERLAY_CTRL_STYLE}
          aria-label={t('common.actions.addToFavorites')}
          title={t('common.actions.addToFavorites')}
        >
          <FontAwesomeIcon icon={faUserPlus} />
        </BtnCallLight>
      </StyledCallOverlayControls>

      <StyledCallOverlayGifts>
        {renderGiftBar('video-overlay')}
      </StyledCallOverlayGifts>

      <StyledCallOverlayRb>
        <BtnCallAlert
          type="button"
          onClick={() => handleReportPeer && handleReportPeer()}
          style={OVERLAY_RB_STYLE}
          aria-label={t('dashboardUserClient.report.title')}
          title={t('modals.report.title')}
        >
          <FontAwesomeIcon icon={faFlag} />
        </BtnCallAlert>

        <BtnCallAlert
          type="button"
          onClick={() => handleBlockPeer && handleBlockPeer()}
          style={OVERLAY_RB_STYLE}
          aria-label={t('modals.block.title')}
          title={t('modals.block.title')}
        >
          <FontAwesomeIcon icon={faBan} />
        </BtnCallAlert>
      </StyledCallOverlayRb>
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
      sendGiftMatch(confirmGift.id);
      close();
    };
    return (
      <StyledGiftConfirmOverlay onClick={(e) => { if (e.target === e.currentTarget) close(); }}>
        <StyledGiftConfirmCard>
          <GiftIcon code={confirmGift.code} iconUrl={confirmGift.icon} alt={confirmGift.name || ''} size={92} />
          <h3>{confirmGift.name}</h3>
          <div className="gift-confirm__price">{fmtEUR(confirmGift.cost)}</div>
          <div className="gift-confirm__to">
            {t('dashboardClient.videoChatRandomCliente.gifts.to', 'Para')} <strong>{modelNickname || ''}</strong>
          </div>
          <div className="gift-confirm__bal" data-insufficient={insufficient}>
            {insufficient
              ? t('dashboardClient.videoChatRandomCliente.gifts.insufficient', 'Saldo insuficiente')
              : `${t('dashboardClient.videoChatRandomCliente.gifts.balance', 'Saldo')} ${fmtEUR(saldo)} · ${t('dashboardClient.videoChatRandomCliente.gifts.remaining', 'te quedarán')} ${fmtEUR(saldo - cost)}`}
          </div>
          <StyledGiftConfirmActions>
            <button type="button" data-role="cancel" onClick={close}>
              {t('common.cancel', 'Cancelar')}
            </button>
            <button type="button" data-role="confirm" disabled={insufficient} onClick={confirm}>
              {t('dashboardClient.videoChatRandomCliente.gifts.send', 'Enviar regalo')}
            </button>
          </StyledGiftConfirmActions>
        </StyledGiftConfirmCard>
      </StyledGiftConfirmOverlay>
    );
  };

  const logLocalVideoEvent = (eventName, videoEl) => {
    const stream = videoEl?.srcObject || null;
    const tracks = Array.isArray(stream?.getTracks?.()) ? stream.getTracks() : [];
    const trackSummary = tracks.map((track) => ({
      kind: track.kind,
      enabled: track.enabled,
      muted: track.muted,
      readyState: track.readyState,
    }));

    console.log('[RANDOM_TRACE_LOCAL_VIDEO]', {
      role: 'client',
      event: eventName,
      readyState: videoEl?.readyState ?? null,
      networkState: videoEl?.networkState ?? null,
      paused: videoEl?.paused ?? null,
      currentTime: videoEl?.currentTime ?? null,
      trackCount: tracks.length,
      tracks: trackSummary,
    });
  };

  return (
    <StyledCenterVideochat>
      <GiftIconDefs />
      <style dangerouslySetInnerHTML={{ __html: GIFT_FX_KEYFRAMES }} />
      {renderGiftConfirmModal()}
      <StyledSplit2 data-mode={!isMobile && remoteStream ? 'full-remote' : 'split'}>
        <StyledPane data-side="left">
          {!isMobile &&
            (!cameraActive ? (
              <StyledPaneCenter>
                <StyledPaneCenterStack>
                  <ButtonActivarCam onClick={handleActivateCamera}>
                    {t('dashboardClient.videoChatRandomCliente.actions.activateCamera')}
                  </ButtonActivarCam>
                  <StyledHelperLine style={{ color: '#fff', justifyContent: 'center' }}>
                    <FontAwesomeIcon icon={faVideo} />
                    {t('dashboardClient.videoChatRandomCliente.hints.activateCamera')}
                  </StyledHelperLine>
                </StyledPaneCenterStack>
              </StyledPaneCenter>
            ) : (
              !remoteStream && (
                <StyledPrecallVideoArea>
                  <StyledPrecallLocalStage>
                    <video
                      ref={localVideoRef}
                      muted
                      autoPlay
                      playsInline
                      onLoadedMetadata={(e) => logLocalVideoEvent('localVideoLoadedMetadata', e.currentTarget)}
                      onCanPlay={(e) => logLocalVideoEvent('localVideoCanPlay', e.currentTarget)}
                      onPlaying={(e) => logLocalVideoEvent('localVideoPlaying', e.currentTarget)}
                      onPause={(e) => logLocalVideoEvent('localVideoPause', e.currentTarget)}
                      onError={(e) => logLocalVideoEvent('localVideoError', e.currentTarget)}
                      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                    />
                  </StyledPrecallLocalStage>
                </StyledPrecallVideoArea>
              )
            ))}
        </StyledPane>

        <StyledPane
          data-side="right"
          data-view={cameraActive ? 'call' : 'thumbs'}
          style={{ position: 'relative' }}
        >
          {!cameraActive ? (
            <>
              {promoLoading && promoVideos.length === 0 && (
                <StyledStatusText>
                  {t('dashboardClient.videoChatRandomCliente.loading.promoVideos')}
                </StyledStatusText>
              )}

              {promoError && (
                <StyledStatusText $tone="error">{promoError}</StyledStatusText>
              )}

              {currentPromo && (
                <StyledTeaserCenter>
                  <StyledTeaserInner>
                    <StyledTeaserCard>
                      <StyledTeaserNavSlot $side="left">
                        <BtnTeaserPrev
                          type="button"
                          onClick={goPrevCard}
                          aria-label={t('home.hero.prevAria')}
                          title={t('home.hero.prevAria')}
                        >
                          <FontAwesomeIcon icon={faChevronLeft} />
                        </BtnTeaserPrev>
                      </StyledTeaserNavSlot>

                      <StyledTeaserMediaButton
                        type="button"
                        onClick={() => (onViewProfile
                          ? onViewProfile({ id: currentPromo.id, nickname: currentPromo.modelName })
                          : handleOpenPromo(currentPromoIndex))}
                        title={currentPromo.title || t('dashboardClient.videoChatRandomCliente.actions.viewTeaser')}
                      >
                        <BlurredPreview
                          type="video"
                          src={currentPromo.src}
                          poster={currentPromo.thumb || '/img/avatarChica.png'}
                          muted={true}
                          autoPlay={true}
                          loop={true}
                          playsInline={true}
                          controls={false}
                          showVignette={true}
                          style={{ width: '100%', height: '100%' }}
                        />
                      </StyledTeaserMediaButton>

                      {/* Card 1 Fase B: like a la modelo del teaser (abajo-izquierda). */}
                      {currentPromo.id && (
                        <div style={{ position: 'absolute', left: 12, bottom: 12, zIndex: 4 }}>
                          <LikeHeart modelUserId={currentPromo.id} />
                        </div>
                      )}

                      <StyledTeaserFavoriteSlot>
                        <BtnCallLight
                          type="button"
                          onClick={() => currentPromo && handleAddFavorite(currentPromo.id)}
                          aria-label={t('common.actions.addToFavorites')}
                          title={t('common.actions.addToFavorites')}
                        >
                          <FontAwesomeIcon icon={faUserPlus} />
                        </BtnCallLight>
                      </StyledTeaserFavoriteSlot>

                      <StyledTeaserNavSlot $side="right">
                        <BtnTeaserNext
                          type="button"
                          onClick={goNextCard}
                          aria-label={t('home.hero.nextAria')}
                          title={t('home.hero.nextAria')}
                        >
                          <FontAwesomeIcon icon={faChevronRight} />
                        </BtnTeaserNext>
                      </StyledTeaserNavSlot>
                    </StyledTeaserCard>
                  </StyledTeaserInner>
                </StyledTeaserCenter>
              )}

              {!promoLoading && !promoError && promoVideos.length === 0 && (
                <StyledStatusText>
                  {t('dashboardClient.videoChatRandomCliente.empty.promoVideos')}
                </StyledStatusText>
              )}

              {isMobile && (
                <StyledPreCallCenter
                  style={{ position: 'absolute', top: '70%', left: 0, right: 0, transform: 'translateY(-50%)' }}
                >
                  <div>
                    <ButtonActivarCamMobile onClick={handleActivateCamera}>
                      {t('dashboardClient.videoChatRandomCliente.actions.activateCamera')}
                    </ButtonActivarCamMobile>
                    <StyledHelperLine style={{ color: '#fff' }}>
                      <FontAwesomeIcon icon={faVideo} />
                      {t('dashboardClient.videoChatRandomCliente.hints.activateCamera')}
                    </StyledHelperLine>
                  </div>
                </StyledPreCallCenter>
              )}
            </>
          ) : (
            <>
              {!remoteStream && (
                <StyledRandomSearchControls>
                  <StyledRandomSearchCol>
                    {!searching ? (
                      <>
                        <ButtonBuscar onClick={handleStartMatch}>
                          {t('dashboardClient.videoChatRandomCliente.actions.search')}
                        </ButtonBuscar>
                        <StyledSearchHint>
                          {t('dashboardClient.videoChatRandomCliente.hints.search')}
                        </StyledSearchHint>
                      </>
                    ) : (
                      <>
                        <StyledSearchHint>
                          {t('dashboardClient.videoChatRandomCliente.loading.searchingModel')}
                        </StyledSearchHint>
                        <div style={{ marginTop: 8, display: 'flex', justifyContent: 'center' }}>
                          <BtnCallDanger
                            onClick={stopAll}
                            title={t('dashboardClient.videoChatRandomCliente.actions.stopSearch')}
                            aria-label={t('dashboardClient.videoChatRandomCliente.actions.stopSearch')}
                          >
                            <FontAwesomeIcon icon={faPhoneSlash} />
                          </BtnCallDanger>
                        </div>
                      </>
                    )}
                  </StyledRandomSearchCol>
                </StyledRandomSearchControls>
              )}

              {remoteStream && !isMobile && (
                <StyledCallCardDesktop data-full="true" data-chat-side="true">
                  <StyledCallVideoArea>
                    <StyledRemoteVideo
                      ref={remoteVideoWrapRef}
                      style={{ position: 'relative', width: '100%', height: '100%', borderRadius: 0, overflow: 'hidden', background: '#000' }}
                    >
                      <StyledCallStage>
                        <StyledCallTopBar>
                          <StyledCallTopMeta>
                            <StyledTitleAvatar src={modelAvatar || '/img/avatarChica.png'} alt="" />
                            <StyledCallTopMetaText>
                              {modelNickname || t('dashboardUserClient.report.displayName')}
                            </StyledCallTopMetaText>
                            <SessionHUD
                              variant="client"
                              active={!!remoteStream}
                              ratePerMin={currentModelRate}
                              baseBalance={baseBalanceAtCallStart}
                              externalBalance={currentSaldo}
                              inline
                            />
                          </StyledCallTopMeta>
                          <StyledCallTopActions>
                            <BtnCallGhost
                              type="button"
                              onClick={() => toggleFullscreen(remoteVideoWrapRef.current)}
                              title={t('dashboardClient.videoChatRandomCliente.actions.fullscreen')}
                              aria-label={t('dashboardClient.videoChatRandomCliente.actions.fullscreen')}
                              style={{ width: 36, height: 36, padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%' }}
                            >
                              <FontAwesomeIcon icon={faExpand} />
                            </BtnCallGhost>
                          </StyledCallTopActions>
                        </StyledCallTopBar>

                        <StyledRemoteVideoBlur
                          ref={blurVideoRef}
                          $ready={isDesktopRemoteVideoReady}
                          autoPlay
                          playsInline
                          muted
                          aria-hidden="true"
                        />

                        <StyledRemoteVideoMedia
                          ref={remoteVideoRef}
                          $ready={isDesktopRemoteVideoReady}
                          $contain
                          onLoadedMetadata={(e) => {
                            const el = e.currentTarget;
                            console.log(`[RANDOM_TRACE_MEDIA] ts=${Date.now()} role=client action=remoteVideoLoadedMetadata readyState=${el?.readyState ?? 'null'} networkState=${el?.networkState ?? 'null'} paused=${el?.paused ?? 'null'} currentTime=${el?.currentTime ?? 'null'}`);
                          }}
                          onCanPlay={(e) => {
                            const el = e.currentTarget;
                            console.log(`[RANDOM_TRACE_MEDIA] ts=${Date.now()} role=client action=remoteVideoCanPlay readyState=${el?.readyState ?? 'null'} networkState=${el?.networkState ?? 'null'} paused=${el?.paused ?? 'null'} currentTime=${el?.currentTime ?? 'null'}`);
                          }}
                          onPlaying={() => {
                            const el = remoteVideoRef?.current;
                            setIsDesktopRemoteVideoReady(true);
                            console.log(`[RANDOM_TRACE_MEDIA] ts=${Date.now()} role=client action=remoteVideoPlaying readyState=${el?.readyState ?? 'null'} networkState=${el?.networkState ?? 'null'} paused=${el?.paused ?? 'null'} currentTime=${el?.currentTime ?? 'null'}`);
                            sendRandomMediaReady?.();
                            if (matchGraceRef) matchGraceRef.current = false;
                          }}
                          onError={(e) => {
                            const el = e.currentTarget;
                            console.warn(`[RANDOM_TRACE_MEDIA] ts=${Date.now()} role=client action=remoteVideoError readyState=${el?.readyState ?? 'null'} networkState=${el?.networkState ?? 'null'} mediaError=${el?.error?.message || el?.error?.code || 'unknown'}`);
                          }}
                          autoPlay
                          playsInline
                          onDoubleClick={() => toggleFullscreen(remoteVideoWrapRef.current)}
                        />

                        {!isDesktopRemoteVideoReady && (
                          <StyledRemoteVideoPlaceholder>
                            Conectando...
                          </StyledRemoteVideoPlaceholder>
                        )}

                        {cameraActive && (
                          <StyledCallLocalVideo data-compact="true">
                            <video
                              ref={localVideoRef}
                              muted
                              autoPlay
                              playsInline
                              onLoadedMetadata={(e) => logLocalVideoEvent('localVideoLoadedMetadata', e.currentTarget)}
                              onCanPlay={(e) => logLocalVideoEvent('localVideoCanPlay', e.currentTarget)}
                              onPlaying={(e) => logLocalVideoEvent('localVideoPlaying', e.currentTarget)}
                              onPause={(e) => logLocalVideoEvent('localVideoPause', e.currentTarget)}
                              onError={(e) => logLocalVideoEvent('localVideoError', e.currentTarget)}
                              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                            />
                          </StyledCallLocalVideo>
                        )}

                        {/* Barra inferior única sobre el vídeo: controles
                            (izq) + regalos (centro) + reportar/bloquear (der).
                            "Ver original" ya NO va aquí: vuelve a la cabecera
                            de la columna de chat como botón normal. */}
                        {/* Card 1 Fase B: like a la modelo abajo-derecha, sobre el vídeo remoto (encima de la barra). */}
                        {randomModelId && (
                          <div style={{ position: 'absolute', right: 20, bottom: 100, zIndex: 6 }}>
                            <LikeHeart modelUserId={randomModelId} />
                          </div>
                        )}
                        <StyledGiftFxLayer ref={fxRef} />
                        {cameraActive && renderCallOverlayBar()}
                      </StyledCallStage>
                    </StyledRemoteVideo>
                  </StyledCallVideoArea>

                  <StyledCallChatColumn>
                    <StyledCallChatColHeader>
                      <StyledTitleAvatar src={modelAvatar || '/img/avatarChica.png'} alt="" style={{ width: 28, height: 28 }} />
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#e7ebf0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {modelNickname || t('dashboardUserClient.report.displayName')}
                        </div>
                      </div>
                      {/* "Ver original" como botón normal en la cabecera del
                          chat (igual que el chat puro de favoritos). */}
                      <TranslationToggleButton />
                    </StyledCallChatColHeader>

                    <StyledCallChatColScroll ref={vcListRef}>
                      {renderMessages()}
                    </StyledCallChatColScroll>

                  <StyledCallFooterDesktop>
                    <StyledCallComposer>
                      <EmojiTextPicker onInsert={(e) => setChatInput((v) => (v || '') + e)} />
                      <StyledChatInput
                        type="text"
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        placeholder={t('dashboardClient.videoChatRandomCliente.placeholders.message')}
                        autoComplete="off"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            sendChatMessage();
                          }
                        }}
                      />
                      <BtnSend
                        type="button"
                        onClick={sendChatMessage}
                        aria-label={t('dashboardClient.videoChatRandomCliente.actions.sendMessage')}
                        title={t('dashboardClient.videoChatRandomCliente.actions.sendMessage')}
                      >
                        <FontAwesomeIcon icon={faPaperPlane} />
                      </BtnSend>
                    </StyledCallComposer>
                  </StyledCallFooterDesktop>
                  </StyledCallChatColumn>
                </StyledCallCardDesktop>
              )}

              {remoteStream && isMobile && (
                <StyledVideoArea>
                  <StyledRemoteVideo
                    ref={remoteVideoWrapRef}
                    style={{ position: 'relative', width: '100%', overflow: 'hidden', background: '#000' }}
                  >
                    <StyledCallStage>
                      <SessionHUD
                        variant="client"
                        active={!!remoteStream}
                        ratePerMin={currentModelRate}
                        baseBalance={baseBalanceAtCallStart}
                        externalBalance={currentSaldo}
                      />
                      <StyledCallTopBar>
                        <StyledCallTopMeta>
                          <StyledTitleAvatar src={modelAvatar || '/img/avatarChica.png'} alt="" />
                          <StyledCallTopMetaText>
                            {modelNickname || t('dashboardUserClient.report.displayName')}
                          </StyledCallTopMetaText>
                        </StyledCallTopMeta>
                      </StyledCallTopBar>

                      {/* Card 1 Fase B: like a la modelo del random (móvil, streaming activo). */}
                      {randomModelId && (
                        <div style={{ position: 'absolute', left: 10, bottom: 80, zIndex: 5 }}>
                          <LikeHeart modelUserId={randomModelId} />
                        </div>
                      )}

                      <video
                        ref={remoteVideoRef}
                        onLoadedMetadata={(e) => {
                          const el = e.currentTarget;
                          console.log(`[RANDOM_TRACE_MEDIA] ts=${Date.now()} role=client action=remoteVideoLoadedMetadata readyState=${el?.readyState ?? 'null'} networkState=${el?.networkState ?? 'null'} paused=${el?.paused ?? 'null'} currentTime=${el?.currentTime ?? 'null'}`);
                        }}
                        onCanPlay={(e) => {
                          const el = e.currentTarget;
                          console.log(`[RANDOM_TRACE_MEDIA] ts=${Date.now()} role=client action=remoteVideoCanPlay readyState=${el?.readyState ?? 'null'} networkState=${el?.networkState ?? 'null'} paused=${el?.paused ?? 'null'} currentTime=${el?.currentTime ?? 'null'}`);
                        }}
                        onPlaying={() => {
                          const el = remoteVideoRef?.current;
                          console.log(`[RANDOM_TRACE_MEDIA] ts=${Date.now()} role=client action=remoteVideoPlaying readyState=${el?.readyState ?? 'null'} networkState=${el?.networkState ?? 'null'} paused=${el?.paused ?? 'null'} currentTime=${el?.currentTime ?? 'null'}`);
                          sendRandomMediaReady?.();
                          if (matchGraceRef) matchGraceRef.current = false;
                        }}
                        onError={(e) => {
                          const el = e.currentTarget;
                          console.warn(`[RANDOM_TRACE_MEDIA] ts=${Date.now()} role=client action=remoteVideoError readyState=${el?.readyState ?? 'null'} networkState=${el?.networkState ?? 'null'} mediaError=${el?.error?.message || el?.error?.code || 'unknown'}`);
                        }}
                        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                        autoPlay
                        playsInline
                        onDoubleClick={() => toggleFullscreen(remoteVideoWrapRef.current)}
                      />

                      {cameraActive && (
                        <StyledCallLocalVideo data-compact="true">
                          <video
                            ref={localVideoRef}
                            muted
                            autoPlay
                            playsInline
                            onLoadedMetadata={(e) => logLocalVideoEvent('localVideoLoadedMetadata', e.currentTarget)}
                            onCanPlay={(e) => logLocalVideoEvent('localVideoCanPlay', e.currentTarget)}
                            onPlaying={(e) => logLocalVideoEvent('localVideoPlaying', e.currentTarget)}
                            onPause={(e) => logLocalVideoEvent('localVideoPause', e.currentTarget)}
                            onError={(e) => logLocalVideoEvent('localVideoError', e.currentTarget)}
                            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                          />
                        </StyledCallLocalVideo>
                      )}

                      {cameraActive && renderCallActions()}

                      <StyledChatContainer data-wide="true">
                        <TranslationToggleButton floating />
                        <StyledChatList ref={vcListRef}>
                          {renderMessages()}
                        </StyledChatList>
                      </StyledChatContainer>
                    </StyledCallStage>
                  </StyledRemoteVideo>
                </StyledVideoArea>
              )}
            </>
          )}
        </StyledPane>
      </StyledSplit2>

      {/* Movil: barra de regalos nueva + composer con emoji picker. No se
          monta capa de efectos (StyledGiftFxLayer) aqui porque el chat movil
          va superpuesto sobre el video; los efectos quedan solo en desktop. */}
      {remoteStream && isMobile && (
        <>
          {renderGiftBar()}
          <StyledChatDock data-surface="call-dark">
            <EmojiTextPicker onInsert={(e) => setChatInput((v) => (v || '') + e)} />
            <StyledChatInput
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder={t('dashboardClient.videoChatRandomCliente.placeholders.message')}
              autoComplete="off"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendChatMessage();
                }
              }}
            />

            <BtnSend
              data-send-button="true"
              type="button"
              onClick={sendChatMessage}
              aria-label={t('dashboardClient.videoChatRandomCliente.actions.sendMessage')}
              title={t('dashboardClient.videoChatRandomCliente.actions.sendMessage')}
            >
              <FontAwesomeIcon icon={faPaperPlane} />
            </BtnSend>
          </StyledChatDock>
        </>
      )}

      {error && <p style={{ color: 'red', marginTop: '10px' }}>{error}</p>}

      {activePromoIndex != null && (
        <PromoVideoLightbox
          videos={promoVideos}
          activeIndex={activePromoIndex}
          onClose={handleClosePromo}
          onPrev={handlePrevPromo}
          onNext={handleNextPromo}
          onAddFavorite={handleAddFavoriteFromTeaser}
        />
      )}
    </StyledCenterVideochat>
  );
}
