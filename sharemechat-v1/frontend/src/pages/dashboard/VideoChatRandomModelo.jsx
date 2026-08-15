import React, { useMemo } from 'react';
import i18n from '../../i18n';
import SessionHUD from '../../components/SessionHUD';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUserPlus, faHeart, faVideo, faPhoneSlash, faForward, faPaperPlane, faBan, faFlag, faExpand } from '@fortawesome/free-solid-svg-icons';
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
  StyledPreCallCenter,
  StyledHelperLine,
  StyledRandomSearchControls,
  StyledRandomSearchCol,
  StyledSearchHint,
  StyledCallCardDesktop,
  StyledCallChatColumn,
  StyledCallChatColHeader,
  StyledCallChatColScroll,
  StyledCallVideoArea,
  StyledCallFooterDesktop,
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
  StyledGiftFxLayer,
  StyledGiftBar,
  StyledGiftTrack,
  StyledGiftChip,
  StyledStatsPrecallCard,
  StyledStatsInline,
  StyledTierProgressCard,
  StyledTierProgressRow,
  StyledTierKpiCol,
  StyledTierKpiTitle,
  StyledTierKpiLine,
  StyledTierBarWrap,
  StyledTierBarTrack,
  StyledTierBarFill,
  StyledTierBarLegend,
  StyledTierPercentCol,
  StyledTierPercentValue,
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
} from '../../styles/ButtonStyles';
import { useSession } from '../../components/SessionProvider';
import { useTranslationSettings } from '../../hooks/useTranslationSettings';
import { useMessageTranslations } from '../../hooks/useMessageTranslations';
import GiftIcon, { resolveGiftSlug, isFaceGiftCode, OBJECT_CODE_TO_EMOJI } from '../../components/gifts/GiftIcon';
import GiftIconDefs from '../../components/gifts/GiftIconDefs';
import EmojiTextPicker from '../../components/EmojiTextPicker';
import { isSingleEmoji } from '../../utils/emojiUtils';

// Keyframes de los efectos al recibir un regalo (portado de random cliente /
// favoritos). El modelo es RECEPTOR de regalos en el flujo random (el backend
// solo permite CLIENT -> MODEL, ver MatchingHandlerSupport.handleGiftInMatch),
// asi que estos efectos se disparan cuando el CLIENTE le envia un regalo.
// Se inyectan una vez via <style>; las particulas referencian estos nombres
// globales. Va a nivel de modulo para no romper import/first.
const GIFT_FX_KEYFRAMES = `
@keyframes gfxFloat{0%{transform:translateY(0) scale(.6);opacity:0}15%{opacity:1}100%{transform:translateY(-220px) translateX(var(--dx)) scale(1.05) rotate(var(--rot));opacity:0}}
@keyframes gfxFall{0%{transform:translateY(-30px) rotate(0);opacity:0}12%{opacity:1}100%{transform:translateY(var(--fall,420px)) translateX(var(--dx)) rotate(var(--rot));opacity:0}}
@keyframes gfxGlow{0%{transform:scale(.2);opacity:.85}100%{transform:scale(2.6);opacity:0}}
@keyframes gfxBigNorm{0%{transform:scale(.3);opacity:0}30%{transform:scale(2.6);opacity:1}70%{transform:scale(1);opacity:1}100%{transform:scale(1);opacity:0}}
`;

export default function VideoChatRandomModelo(props) {
  const t = (key, options) => i18n.t(key, options);

  const {
    cameraActive,
    handleActivateCamera,
    localVideoRef,
    vcListRef,
    messages,
    gifts,
    giftRenderReady,
    getGiftIcon,
    remoteStream,
    isMobile,
    remoteVideoWrapRef,
    stopAll,
    searching,
    currentClientId,
    handleAddFavorite,
    clientAvatar,
    clientNickname,
    remoteVideoRef,
    sendRandomMediaReady,
    toggleFullscreen,
    handleStartMatch,
    chatInput,
    setChatInput,
    sendChatMessage,
    sendRandomGiftEmoji,
    handleBlockPeer,
    handleReportPeer,
    error,
    modelEconomics,
    clientSaldo,
    clientSaldoLoading,
    handleNext,
    nextDisabled,
    // ADR-037 Bloque 5 Paso 1: TRIAL | PAID | null (sin peer). Cuando es TRIAL
    // pintamos badge FREE sobre el video del cliente para avisar que la
    // moderacion trial-only aplicara si muestra contenido explicito.
    currentClientAccessTier,
  } = props;

  const showTrialBadge = currentClientAccessTier === 'TRIAL';

  // ADR-037 Bloque 5 Paso 1 + ADR-052 Superficie 2 fase 2 (2026-07-25):
  // TrialBadge se integra INLINE dentro del StyledCallTopBar (a la
  // izquierda del avatar), no como overlay flotante, para no solaparse
  // con el HUD de sesion + saldo cliente + nickname que ya ocupan la
  // topbar. Formato compacto pill con el titulo unicamente; el subtitulo
  // pasa a tooltip (title) para no crecer verticalmente.
  const TrialBadge = () => (
    <span
      role="note"
      title={t('videochat.trial.modelBadge.subtitle')}
      aria-label={t('videochat.trial.modelBadge.subtitle')}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '3px 10px',
        borderRadius: 999,
        background: 'rgba(0,0,0,0.55)',
        border: '1px solid #22c55e',
        color: '#ffffff',
        fontSize: '0.78rem',
        fontWeight: 800,
        letterSpacing: 0.4,
        userSelect: 'none',
        pointerEvents: 'none',
        whiteSpace: 'nowrap',
      }}
    >
      {t('videochat.trial.modelBadge.title')}
    </span>
  );

  const [isDesktopRemoteVideoReady, setIsDesktopRemoteVideoReady] = React.useState(false);

  // Fase 0 streaming: backdrop borroso del vídeo remoto. Vídeo secundario mudo
  // con el mismo MediaStream; rellena el letterbox del vídeo apaisado con blur.
  const blurVideoRef = React.useRef(null);
  React.useEffect(() => {
    const el = blurVideoRef.current;
    if (!el) return;
    if (el.srcObject !== (remoteStream || null)) el.srcObject = remoteStream || null;
  }, [remoteStream, isMobile]);

  // Capa de efectos sobre el vídeo (portada de random cliente). El modelo la ve
  // cuando el CLIENTE le envia un regalo: corazones para gratis, glow + confeti
  // + serpentinas para pago.
  const fxRef = React.useRef(null);
  // Diff por CONTADOR (los regalos random no traen id de mensaje a nivel raiz);
  // dispara efecto solo para los recien anadidos.
  const prevCountRef = React.useRef(0);

  const playGiftFx = (gd) => {
    const layer = fxRef.current;
    if (!layer || !gd) return;

    let tier = gd.tier;
    let code = gd.code;
    if (!tier || !code) {
      const found = Array.isArray(gifts)
        ? gifts.find((g) => Number(g.id) === Number(gd.giftId ?? gd.id))
        : null;
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
  // los recien anadidos. Guardas: sin efecto si es 1a poblacion masiva (>3), si
  // no hubo altas, o si el usuario prefiere movimiento reducido.
  React.useEffect(() => {
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const msgs = messages || [];
    const prevCount = prevCountRef.current;
    const added = msgs.length - prevCount;
    prevCountRef.current = msgs.length;
    if (added <= 0 || added > 3 || reduce) return;
    const newMsgs = msgs.slice(msgs.length - added);
    newMsgs.forEach((m) => {
      const gd = m.gift ? normalizeGift(m.gift) : null;
      if (gd) playGiftFx(gd);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages]);

  // ADR-052 Superficie 2 (2026-07-25): acumulador local de ganancia por
  // regalos en la sesion activa. El WS trae el `cost` bruto del regalo;
  // aplicamos el %reparto vigente del tramo (modelEconomics.modelSharePct)
  // para reflejar lo que efectivamente ganara la modelo. Se resetea al
  // arrancar cada nueva llamada (remoteStream vira null -> stream).
  const [giftsSumEur, setGiftsSumEur] = React.useState(0);
  const seenGiftKeysRef = React.useRef(new Set());
  const sessionStartRef = React.useRef(null);

  React.useEffect(() => {
    if (remoteStream) {
      if (sessionStartRef.current == null) {
        sessionStartRef.current = Date.now();
        seenGiftKeysRef.current = new Set();
        setGiftsSumEur(0);
      }
    } else {
      sessionStartRef.current = null;
      seenGiftKeysRef.current = new Set();
      setGiftsSumEur(0);
    }
  }, [remoteStream]);

  React.useEffect(() => {
    if (!remoteStream) return;
    // Los regalos se reparten con `gift.model-share` (property backend,
    // default 0.90 = 90%), NO con el %reparto del tramo T1-T4. El backend
    // lo expone en modelEconomics.giftModelSharePct para no duplicar la
    // constante en frontend. Si no viene (compat rara), fallback a 90.
    const pctRaw = modelEconomics?.giftModelSharePct;
    const pct = Number.isFinite(Number(pctRaw)) && Number(pctRaw) > 0
      ? Number(pctRaw)
      : 90;
    if (!Array.isArray(messages)) return;
    let addedThisPass = 0;
    messages.forEach((m, idx) => {
      const g = m?.gift;
      if (!g) return;
      if (m.from !== 'peer') return;
      const cost = Number(g.cost);
      if (!Number.isFinite(cost) || cost <= 0) return;
      const key = `${idx}:${g.giftId ?? g.code ?? cost}`;
      if (seenGiftKeysRef.current.has(key)) return;
      seenGiftKeysRef.current.add(key);
      addedThisPass += (cost * pct) / 100;
    });
    if (addedThisPass > 0) {
      setGiftsSumEur((prev) => prev + addedThisPass);
    }
  }, [messages, remoteStream, modelEconomics?.giftModelSharePct]);

  React.useEffect(() => {
    if (!remoteStream || isMobile || !cameraActive) {
      setIsDesktopRemoteVideoReady(false);
      return;
    }

    setIsDesktopRemoteVideoReady(false);
  }, [cameraActive, isMobile, remoteStream]);

  // ADR-052 sub-frente 3.C iter.2 (2026-07-25): tierProgress reescrito
  // para hablar del nuevo regimen (T0-T3 + facturacion bruta EUR + %reparto)
  // en vez del sistema tier viejo por minutos. Consume `modelEconomics`
  // (ModelEconomicsDTO servido por PricingService.getEconomics).
  const tierProgress = React.useMemo(() => {
    if (!modelEconomics) {
      return {
        hasData: false,
        tierCode: null,
        modelSharePct: 0,
        billedGrossEur30d: 0,
        nextTierCode: null,
        nextTierMinBilledGrossEur30d: 0,
        remainingEur: 0,
        pct: 0,
      };
    }
    const billedGross = Number(modelEconomics.billedGrossEur30d || 0);
    const nextMin = Number(modelEconomics.nextTierMinBilledGrossEur30d || 0);
    const nextTier = modelEconomics.nextTierCode;
    const remainingEur = nextTier ? Math.max(0, nextMin - billedGross) : 0;
    const pct = nextTier
      ? Math.max(0, Math.min(100, (billedGross / Math.max(1, nextMin)) * 100))
      : 100;

    return {
      hasData: true,
      tierCode: modelEconomics.tierCode || null,
      modelSharePct: Number(modelEconomics.modelSharePct || 0),
      billedGrossEur30d: billedGross,
      nextTierCode: nextTier,
      nextTierMinBilledGrossEur30d: nextMin,
      remainingEur,
      pct,
    };
  }, [modelEconomics]);

  const normalizeGift = (gift) => {
    if (!gift) return null;

    const giftId = Number(gift.giftId ?? gift.id);
    if (!Number.isFinite(giftId) || giftId <= 0) return null;

    return {
      id: giftId,
      giftId,
      code: gift.code ?? null,
      name: gift.name || '',
      icon: gift.icon || null,
      cost: gift.cost ?? null,
      tier: String(gift.tier || 'QUICK').toUpperCase() === 'PREMIUM' ? 'PREMIUM' : 'QUICK',
      featured: gift.featured ?? null,
    };
  };

  const getGiftRenderData = (gift) => {
    const normalized = normalizeGift(gift);
    if (!normalized) return null;

    const fallbackIcon =
      !normalized.icon && giftRenderReady && typeof getGiftIcon === 'function'
        ? getGiftIcon(normalized)
        : null;
    return {
      ...normalized,
      icon: normalized.icon || fallbackIcon || null,
      isPremium: normalized.tier === 'PREMIUM',
    };
  };

  // Pinta el regalo con GiftIcon (por CODE), igual que random cliente: resolver
  // por code evita imagenes rotas de objetos sin URL; el iconUrl remoto queda
  // como fallback de retrocompat. Los emojis-carita gratis se pintan como emoji
  // nativo (GiftIcon los mapea por code).
  const renderGiftMessage = (gift) => {
    const renderData = getGiftRenderData(gift);
    if (!renderData) return null;

    let code = renderData.code || null;
    if (!code && Array.isArray(gifts)) {
      const lookupId = Number(renderData.giftId ?? renderData.id);
      code = gifts.find((gg) => Number(gg.id) === lookupId)?.code || null;
    }
    const src = renderData.icon || null;
    if (!code && !src) return null;

    return (
      <StyledGiftMessage $premium={renderData.isPremium} style={{ minWidth: 0 }}>
        <GiftIcon code={code} iconUrl={src} alt={renderData.name || ''} size={42} />
      </StyledGiftMessage>
    );
  };

  // pending-hardening §5.3 (2026-08-08): traduccion automatica chat random.
  // Ver equivalente en VideoChatRandomCliente.
  const { user: sessionUser } = useSession();
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

  const renderMessages = () => (
    messages.map((msg, index) => {
      const isMe = msg.from === 'me';
      const variant = isMe ? 'me' : 'peer';
      const giftData = getGiftRenderData(msg.gift);
      const translation = !isMe && msg.id ? getTranslation(msg.id) : null;
      const hasTranslation = typeof translation === 'string' && translation.trim() !== '' && translation !== msg.text;

      // Un solo emoji -> grande y sin globo (estilo WhatsApp). Solo cuando no
      // es regalo y no hay traduccion que mostrar debajo.
      if (!giftData && !hasTranslation && isSingleEmoji(msg.text)) {
        return (
          <StyledChatMessageRow key={msg.id || index} $side={variant}>
            <span role="img" aria-label={(msg.text || '').trim()} style={{ fontSize: 34, lineHeight: 1 }}>
              {(msg.text || '').trim()}
            </span>
          </StyledChatMessageRow>
        );
      }

      return (
        <StyledChatMessageRow key={msg.id || index} $side={variant}>
          {giftData ? (
            renderGiftMessage(giftData)
          ) : (
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
          )}
        </StyledChatMessageRow>
      );
    })
  );

  const shouldShowTranslationToggle = translationEnabled && viewerLang && messages.some(
    (m) => m.from === 'peer' && m.id && !m.gift
  );
  // floating=true -> pill absoluta sobre el vídeo (móvil, chat overlay).
  // floating=false (default) -> botón normal para la cabecera de la columna de
  // chat (desktop), igual que el random cliente.
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

  const renderClientBalance = () => (
    clientSaldoLoading ? (
      <span>{t('dashboardModel.videoChatRandomModelo.labels.balance')} ...</span>
    ) : Number.isFinite(Number(clientSaldo)) ? (
      <span>{t('dashboardModel.videoChatRandomModelo.labels.balance')} EUR {Number(clientSaldo).toFixed(2)}</span>
    ) : (
      <span>{t('dashboardModel.videoChatRandomModelo.labels.balance')} -</span>
    )
  );

  const renderCallActions = () => (
    <StyledCallBottomBar>
      <StyledCallBottomInner>
        <StyledCallPrimaryActions>
          <BtnCallDanger
            onClick={stopAll}
            title={t('common.hangup')}
            aria-label={t('common.hangup')}
          >
            <FontAwesomeIcon icon={faPhoneSlash} />
          </BtnCallDanger>

          <BtnCallLight
            onClick={() => handleNext && handleNext()}
            disabled={!!nextDisabled}
            aria-disabled={!!nextDisabled}
            title={t('home.hero.nextAria')}
            aria-label={t('home.hero.nextAria')}
          >
            <FontAwesomeIcon icon={faForward} />
          </BtnCallLight>

          {currentClientId && (
            <BtnCallLight
              onClick={handleAddFavorite}
              aria-label={t('common.actions.addToFavorites')}
              title={t('common.actions.addToFavorites')}
            >
              <FontAwesomeIcon icon={faUserPlus} />
            </BtnCallLight>
          )}
        </StyledCallPrimaryActions>

        <StyledCallSecondaryActions>
          <BtnCallAlert
            type="button"
            onClick={() => handleReportPeer && handleReportPeer()}
            aria-label={t('modals.report.title')}
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

  // Barra inferior única sobre el vídeo (desktop): [controles izq] + [barra de
  // regalos GRATIS del modelo, centro] + [reportar/bloquear der].
  // IMPORTANTE: en random el canal de REGALO real (SVG, con transacción) es solo
  // CLIENT -> MODEL a nivel backend (MatchingHandlerSupport.handleGiftInMatch).
  // Por eso los gratis del modelo NO van por ese canal, sino por CHAT: al pulsar
  // un chip se envía su emoji unicode como mensaje (mismo canal que el botón 😊),
  // sin tocar backend; se renderiza como emoji grande en el chat del cliente.
  // Los botones de control van más pequeños que el global (44px) via style inline.
  const OVERLAY_CTRL_STYLE = { width: 34, height: 34, minWidth: 34, minHeight: 34, fontSize: 13 };
  const OVERLAY_RB_STYLE = { width: 32, height: 32, minWidth: 32, minHeight: 32, fontSize: 12 };

  // Regalos gratis del modelo -> emoji unicode (se envían por chat, no por el
  // canal de regalos). Solo objetos; las caritas ya viven en el botón 😊. Se usa
  // OBJECT_CODE_TO_EMOJI (fuente única compartida con GiftIcon) para que el
  // objeto se vea IDÉNTICO al que pinta el cliente.
  const modelFreeGifts = Array.isArray(gifts)
    ? gifts.filter((g) => {
        const code = String(g?.code || '').toLowerCase();
        const isPremium = String(g?.tier || 'QUICK').toUpperCase() === 'PREMIUM';
        return !isPremium && !isFaceGiftCode(code) && !!OBJECT_CODE_TO_EMOJI[code];
      })
    : [];
  const renderModelFreeGiftBar = (surface) => {
    if (modelFreeGifts.length === 0) return null;
    const isOverlay = surface === 'video-overlay';
    return (
      <StyledGiftBar
        data-kind="random-gift-bar"
        {...(isOverlay ? { 'data-surface': 'video-overlay' } : {})}
      >
        <StyledGiftTrack {...(isOverlay ? { 'data-row': 'all' } : {})}>
          {modelFreeGifts.map((g) => (
            <StyledGiftChip
              key={g.id}
              type="button"
              title={g.name}
              aria-label={g.name}
              onClick={() => { if (sendRandomGiftEmoji) sendRandomGiftEmoji(OBJECT_CODE_TO_EMOJI[String(g.code).toLowerCase()]); }}
            >
              <GiftIcon code={g.code} iconUrl={g.icon} alt={g.name || ''} size={24} />
            </StyledGiftChip>
          ))}
        </StyledGiftTrack>
      </StyledGiftBar>
    );
  };
  const renderCallOverlayBar = () => (
    <StyledCallOverlayBar>
      <StyledCallOverlayControls>
        <BtnCallDanger
          onClick={stopAll}
          style={OVERLAY_CTRL_STYLE}
          title={t('common.hangup')}
          aria-label={t('common.hangup')}
        >
          <FontAwesomeIcon icon={faPhoneSlash} />
        </BtnCallDanger>

        <BtnCallLight
          onClick={() => handleNext && handleNext()}
          disabled={!!nextDisabled}
          aria-disabled={!!nextDisabled}
          style={OVERLAY_CTRL_STYLE}
          title={t('home.hero.nextAria')}
          aria-label={t('home.hero.nextAria')}
        >
          <FontAwesomeIcon icon={faForward} />
        </BtnCallLight>

        {currentClientId && (
          <BtnCallLight
            onClick={handleAddFavorite}
            style={OVERLAY_CTRL_STYLE}
            aria-label={t('common.actions.addToFavorites')}
            title={t('common.actions.addToFavorites')}
          >
            <FontAwesomeIcon icon={faHeart} />
          </BtnCallLight>
        )}
      </StyledCallOverlayControls>

      {/* Centro: barra de regalos GRATIS del modelo (envío por chat/emoji, no
          por el canal de regalos). Mismo layout de 3 zonas que el cliente. */}
      <StyledCallOverlayGifts>
        {renderModelFreeGiftBar('video-overlay')}
      </StyledCallOverlayGifts>

      <StyledCallOverlayRb>
        <BtnCallAlert
          type="button"
          onClick={() => handleReportPeer && handleReportPeer()}
          style={OVERLAY_RB_STYLE}
          aria-label={t('modals.report.title')}
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

  const renderCallTopMeta = (hud = null) => (
    <StyledCallTopMeta>
      {showTrialBadge && <TrialBadge />}
      <StyledTitleAvatar src={clientAvatar || '/img/avatarChico.png'} alt="" />
      <div style={{display:'flex',flexDirection:'column',minWidth:0,lineHeight:1.15}}>
        <StyledCallTopMetaText>
          {clientNickname || t('dashboardModel.videoChatRandomModelo.labels.clientDefault')}
        </StyledCallTopMetaText>
        <div style={{fontSize:12,opacity:0.9,marginTop:2,color:'rgba(255,255,255,0.82)'}}>
          {renderClientBalance()}
        </div>
      </div>
      {hud}
    </StyledCallTopMeta>
  );

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
      role: 'model',
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
      <StyledSplit2 data-mode={!isMobile && remoteStream ? 'full-remote' : 'split'}>
        <StyledPane data-side="left">
          {!isMobile && (
            !cameraActive ? (
              <StyledPaneCenter>
                <StyledPaneCenterStack>
                  <ButtonActivarCam onClick={handleActivateCamera}>
                    {t('dashboardModel.videoChatRandomModelo.actions.activateCamera')}
                  </ButtonActivarCam>
                  <StyledHelperLine style={{color:'#fff',justifyContent:'center'}}>
                    <FontAwesomeIcon icon={faVideo} />
                    {t('dashboardModel.videoChatRandomModelo.hints.activateCamera')}
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
                      style={{width:'100%',height:'100%',objectFit:'cover',display:'block'}}
                    />
                  </StyledPrecallLocalStage>
                </StyledPrecallVideoArea>
              )
            )
          )}
        </StyledPane>

        <StyledPane
          data-side="right"
          data-view={!cameraActive && !isMobile ? 'precall-stats' : (cameraActive ? 'call' : 'thumbs')}
          style={{position:'relative'}}
        >
          {!cameraActive ? (
            <>
              <StyledStatsPrecallCard>
                <div style={{display:'flex',flexDirection:'column',gap:8}}>
                  <div style={{fontWeight:900,fontSize:16,color:'#fff',letterSpacing:'.2px'}}>
                    {t('dashboardModel.videoChatRandomModelo.stats.progressTitle')}
                  </div>
                </div>

                <StyledTierProgressCard>
                  {!tierProgress.hasData ? (
                    <StyledStatsInline>
                      <div>{t('dashboardModel.videoChatRandomModelo.stats.noTierData')}</div>
                    </StyledStatsInline>
                  ) : (
                    <>
                      <StyledTierProgressRow>
                        <StyledTierKpiCol>
                          <StyledTierKpiTitle>{t('dashboardModel.videoChatRandomModelo.stats.yourSituation')}</StyledTierKpiTitle>
                          <StyledTierKpiLine>
                            {t('dashboardModel.videoChatRandomModelo.stats.currentTramo')} <b>{tierProgress.tierCode || '—'}</b>
                          </StyledTierKpiLine>
                        </StyledTierKpiCol>

                        <StyledTierKpiCol>
                          <StyledTierKpiTitle>{t('dashboardModel.videoChatRandomModelo.stats.nextGoal')}</StyledTierKpiTitle>
                          {tierProgress.nextTierCode ? (
                            <StyledTierKpiLine>
                              {t('dashboardModel.videoChatRandomModelo.stats.nextTramo')} <b>{tierProgress.nextTierCode}</b>
                            </StyledTierKpiLine>
                          ) : (
                            <StyledTierKpiLine>
                              {t('dashboardModel.videoChatRandomModelo.stats.maxTier')}
                            </StyledTierKpiLine>
                          )}
                        </StyledTierKpiCol>

                        {tierProgress.nextTierCode && (
                          <StyledTierPercentCol>
                            <StyledTierPercentValue>
                              {tierProgress.pct.toLocaleString(undefined,{minimumFractionDigits:1,maximumFractionDigits:1})}%
                            </StyledTierPercentValue>
                          </StyledTierPercentCol>
                        )}
                      </StyledTierProgressRow>

                      <StyledTierBarWrap>
                        <StyledTierBarTrack>
                          <StyledTierBarFill style={{width:`${tierProgress.pct}%`}} />
                        </StyledTierBarTrack>
                      </StyledTierBarWrap>
                    </>
                  )}
                </StyledTierProgressCard>
              </StyledStatsPrecallCard>

              {isMobile && (
                <StyledPreCallCenter style={{position:'absolute',top:'70%',left:0,right:0,transform:'translateY(-50%)'}}>
                  <div>
                    <ButtonActivarCamMobile onClick={handleActivateCamera}>
                      {t('dashboardModel.videoChatRandomModelo.actions.activateCamera')}
                    </ButtonActivarCamMobile>
                    <StyledHelperLine style={{color:'#fff'}}>
                      <FontAwesomeIcon icon={faVideo} />
                      {t('dashboardModel.videoChatRandomModelo.hints.activateCamera')}
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
                        <ButtonBuscar onClick={handleStartMatch}>{t('common.actions.search')}</ButtonBuscar>
                        <StyledSearchHint>{t('dashboardModel.videoChatRandomModelo.hints.search')}</StyledSearchHint>
                      </>
                    ) : (
                      <>
                        <StyledSearchHint>{t('dashboardModel.videoChatRandomModelo.loading.searchingClient')}</StyledSearchHint>
                        <div style={{marginTop:8,display:'flex',justifyContent:'center'}}>
                          <BtnCallDanger
                            onClick={stopAll}
                            title={t('dashboardModel.videoChatRandomModelo.actions.stopSearch')}
                            aria-label={t('dashboardModel.videoChatRandomModelo.actions.stopSearch')}
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
                      style={{position:'relative',width:'100%',height:'100%',borderRadius:0,overflow:'hidden',background:'#000'}}
                    >
                      <StyledCallStage>
                        <StyledCallTopBar>
                          {renderCallTopMeta(
                            <SessionHUD
                              variant="model"
                              active={!!remoteStream}
                              ratePerMin={Number(modelEconomics?.chosenRateEurPerMin)}
                              modelSharePct={Number(modelEconomics?.modelSharePct)}
                              giftsSum={giftsSumEur}
                              inline
                            />
                          )}
                          <StyledCallTopActions>
                            <BtnCallGhost
                              type="button"
                              onClick={() => toggleFullscreen(remoteVideoWrapRef.current)}
                              title={t('common.fullscreen')}
                              aria-label={t('common.fullscreen')}
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
                            console.log(`[RANDOM_TRACE_MEDIA] ts=${Date.now()} role=model action=remoteVideoLoadedMetadata readyState=${el?.readyState ?? 'null'} networkState=${el?.networkState ?? 'null'} paused=${el?.paused ?? 'null'} currentTime=${el?.currentTime ?? 'null'}`);
                          }}
                          onCanPlay={(e) => {
                            const el = e.currentTarget;
                            console.log(`[RANDOM_TRACE_MEDIA] ts=${Date.now()} role=model action=remoteVideoCanPlay readyState=${el?.readyState ?? 'null'} networkState=${el?.networkState ?? 'null'} paused=${el?.paused ?? 'null'} currentTime=${el?.currentTime ?? 'null'}`);
                          }}
                          onPlaying={(e) => {
                            const el = e.currentTarget;
                            setIsDesktopRemoteVideoReady(true);
                            console.log(`[RANDOM_TRACE_MEDIA] ts=${Date.now()} role=model action=remoteVideoPlaying readyState=${el?.readyState ?? 'null'} networkState=${el?.networkState ?? 'null'} paused=${el?.paused ?? 'null'} currentTime=${el?.currentTime ?? 'null'}`);
                            sendRandomMediaReady?.();
                          }}
                          onError={(e) => {
                            const el = e.currentTarget;
                            console.warn(`[RANDOM_TRACE_MEDIA] ts=${Date.now()} role=model action=remoteVideoError readyState=${el?.readyState ?? 'null'} networkState=${el?.networkState ?? 'null'} mediaError=${el?.error?.message || el?.error?.code || 'unknown'}`);
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
                              style={{width:'100%',height:'100%',objectFit:'cover',display:'block'}}
                            />
                          </StyledCallLocalVideo>
                        )}

                        {/* Barra inferior única sobre el vídeo: controles (izq)
                            + spacer (centro) + reportar/bloquear (der). La capa
                            de efectos vive aqui (sobre el vídeo) para que el
                            modelo vea los efectos al RECIBIR regalos del cliente.
                            "Ver original" va en la cabecera de la columna de chat. */}
                        <StyledGiftFxLayer ref={fxRef} />
                        {cameraActive && renderCallOverlayBar()}
                      </StyledCallStage>
                    </StyledRemoteVideo>
                  </StyledCallVideoArea>

                  <StyledCallChatColumn>
                    <StyledCallChatColHeader>
                      <StyledTitleAvatar src={clientAvatar || '/img/avatarChico.png'} alt="" style={{ width: 28, height: 28 }} />
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#e7ebf0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {clientNickname || t('dashboardModel.videoChatRandomModelo.labels.clientDefault')}
                        </div>
                      </div>
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
                        placeholder={t('dashboardModel.videoChatRandomModelo.placeholders.message')}
                        autoComplete="off"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            sendChatMessage();
                          }
                        }}
                      />
                      <BtnSend type="button" onClick={sendChatMessage} aria-label={t('common.sendMessage')} title={t('common.sendMessage')}>
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
                    style={{position:'relative',width:'100%',overflow:'hidden',background:'#000'}}
                  >
                    <StyledCallStage>
                      <SessionHUD
                        variant="model"
                        active={!!remoteStream}
                        ratePerMin={Number(modelEconomics?.chosenRateEurPerMin)}
                        modelSharePct={Number(modelEconomics?.modelSharePct)}
                        giftsSum={giftsSumEur}
                      />
                      <StyledCallTopBar>
                        {renderCallTopMeta()}
                      </StyledCallTopBar>

                      <video
                        ref={remoteVideoRef}
                        onLoadedMetadata={(e) => {
                          const el = e.currentTarget;
                          console.log(`[RANDOM_TRACE_MEDIA] ts=${Date.now()} role=model action=remoteVideoLoadedMetadata readyState=${el?.readyState ?? 'null'} networkState=${el?.networkState ?? 'null'} paused=${el?.paused ?? 'null'} currentTime=${el?.currentTime ?? 'null'}`);
                        }}
                        onCanPlay={(e) => {
                          const el = e.currentTarget;
                          console.log(`[RANDOM_TRACE_MEDIA] ts=${Date.now()} role=model action=remoteVideoCanPlay readyState=${el?.readyState ?? 'null'} networkState=${el?.networkState ?? 'null'} paused=${el?.paused ?? 'null'} currentTime=${el?.currentTime ?? 'null'}`);
                        }}
                        onPlaying={(e) => {
                          const el = e.currentTarget;
                          console.log(`[RANDOM_TRACE_MEDIA] ts=${Date.now()} role=model action=remoteVideoPlaying readyState=${el?.readyState ?? 'null'} networkState=${el?.networkState ?? 'null'} paused=${el?.paused ?? 'null'} currentTime=${el?.currentTime ?? 'null'}`);
                          sendRandomMediaReady?.();
                        }}
                        onError={(e) => {
                          const el = e.currentTarget;
                          console.warn(`[RANDOM_TRACE_MEDIA] ts=${Date.now()} role=model action=remoteVideoError readyState=${el?.readyState ?? 'null'} networkState=${el?.networkState ?? 'null'} mediaError=${el?.error?.message || el?.error?.code || 'unknown'}`);
                        }}
                        style={{width:'100%',height:'100%',objectFit:'cover',display:'block'}}
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
                            style={{width:'100%',height:'100%',objectFit:'cover',display:'block'}}
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

      {remoteStream && isMobile && (
        <>
          {renderModelFreeGiftBar()}
          <StyledChatDock data-surface="call-dark">
            <EmojiTextPicker onInsert={(e) => setChatInput((v) => (v || '') + e)} />
            <StyledChatInput
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder={t('dashboardModel.videoChatRandomModelo.placeholders.message')}
              autoComplete="off"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendChatMessage();
                }
              }}
            />
            <BtnSend data-send-button="true" type="button" onClick={sendChatMessage} aria-label={t('common.sendMessage')} title={t('common.sendMessage')}>
              <FontAwesomeIcon icon={faPaperPlane} />
            </BtnSend>
          </StyledChatDock>
        </>
      )}

      {error && <p style={{color:'red',marginTop:'10px'}}>{error}</p>}
    </StyledCenterVideochat>
  );
}
