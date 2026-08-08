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
    StyledTitleAvatar,StyledLocalVideo,StyledTopActions,StyledChatWhatsApp,StyledChatContainer,
    StyledChatList,StyledChatMessageRow,StyledGiftMessage,StyledGiftIcon,StyledPreCallCenter,StyledHelperLine,
    StyledBottomActionsMobile,StyledMobile3ColBar,StyledTopCenter,StyledConnectedText,StyledFloatingHangup,
    StyledCallCardDesktop,StyledCallFooterDesktop,StyledCallVideoArea,StyledCallStage,StyledCallTopBar,
    StyledCallTopMeta,StyledCallTopMetaText,StyledCallTopActions,StyledCallLocalVideo,StyledCallBottomBar,
    StyledCallBottomInner,StyledCallPrimaryActions,StyledCallComposer,StyledGiftsPanel,StyledGiftGrid,
    StyledGiftCatalog,StyledGiftSection,StyledGiftSectionTitle,StyledChatMessagesInner,StyledChatDockMessageComposer,StyledChatDockActions,
    StyledGiftBar,StyledGiftSeg,StyledGiftTrack,StyledGiftChip,StyledGiftMore,
    StyledGiftConfirmOverlay,StyledGiftConfirmCard,StyledGiftConfirmActions
} from '../../styles/pages-styles/VideochatStyles';
import GiftIcon from '../../components/gifts/GiftIcon';
import GiftIconDefs from '../../components/gifts/GiftIconDefs';
import { ButtonLlamar,ButtonColgar,ButtonAceptar,ButtonRechazar,ButtonEnviar,ButtonRegalo,ButtonActivarCam,
    ButtonActivarCamMobile,ButtonVolver,ActionButton,BtnRoundVideo,BtnHangup,BtnCallDanger,BtnCallGhost,BtnSend
} from '../../styles/ButtonStyles';

export default function VideoChatFavoritosCliente(props){
  const t = (key, options) => i18n.t(key, options);

  const {
      isMobile,handleOpenChatFromFavorites,favReload,selectedContactId,hasActiveDetail,hasCallTarget,setCtxUser,setCtxPos,centerChatPeerId,
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

  // Fase 1 rediseño: barra de regalos siempre visible (segmento gratis/pago)
  // + modal de confirmacion para los de pago.
  const [giftCat, setGiftCat] = useState('free'); // 'free' | 'paid'
  const [confirmGift, setConfirmGift] = useState(null);

  const normalizeGiftTier = (gift) =>
    String(gift?.tier || 'QUICK').toUpperCase() === 'PREMIUM' ? 'PREMIUM' : 'QUICK';

  const quickGifts = gifts.filter((gift) => normalizeGiftTier(gift) === 'QUICK');
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
  // pago -> abre modal de confirmacion. El "+" abre el catalogo completo.
  const handleGiftChipClick = (g) => {
    if (!allowChat) return;
    if (normalizeGiftTier(g) === 'PREMIUM') setConfirmGift(g);
    else sendGiftMsg(g.id);
  };

  const renderGiftBar = () => {
    const items = giftCat === 'paid' ? premiumGifts : quickGifts;
    return (
      <StyledGiftBar data-kind="favorites-gift-bar">
        <StyledGiftSeg>
          <button type="button" data-active={giftCat === 'free'} onClick={() => setGiftCat('free')}>
            {t('dashboardClient.videoChatFavoritosCliente.gifts.free', 'Gratis')}
          </button>
          <button type="button" data-active={giftCat === 'paid'} data-kind="paid" onClick={() => setGiftCat('paid')}>
            {t('dashboardClient.videoChatFavoritosCliente.gifts.paid', 'Regalos')}
          </button>
        </StyledGiftSeg>
        <StyledGiftTrack>
          {items.map((g) => (
            <StyledGiftChip
              key={g.id}
              type="button"
              disabled={!allowChat}
              title={g.name}
              aria-label={g.name}
              onClick={() => handleGiftChipClick(g)}
            >
              <GiftIcon code={g.code} iconUrl={g.icon} alt={g.name || ''} size={32} />
              {giftCat === 'paid' && <span className="gift-chip__price">{fmtEUR(g.cost)}</span>}
            </StyledGiftChip>
          ))}
        </StyledGiftTrack>
        <StyledGiftMore
          type="button"
          title={t('dashboardClient.videoChatFavoritosCliente.gifts.more', 'Ver catálogo')}
          aria-label={t('dashboardClient.videoChatFavoritosCliente.gifts.more', 'Ver catálogo')}
          disabled={!allowChat}
          onClick={() => setShowCenterGifts((s) => !s)}
        >
          +
        </StyledGiftMore>
      </StyledGiftBar>
    );
  };

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

    const src = getGiftVisualSrc(giftData);
    const tier = String(giftData.tier || '').toUpperCase();
    const isPremium = tier === 'PREMIUM';

    return src ? (
      <StyledGiftMessage $premium={isPremium}>
        <StyledGiftIcon src={src} alt={giftData.name || ''} $premium={isPremium}/>
      </StyledGiftMessage>
    ) : null;
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
      return (
        <StyledChatMessageRow key={m.id} $side={isMe ? 'me' : 'peer'}>
          {renderGiftVisual(giftData)}
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
                        <StyledCallCardDesktop>
                          <StyledCallVideoArea>
                            <StyledRemoteVideo ref={callRemoteWrapRef} style={{position:'relative',width:'100%',height:'100%',borderRadius:'18px 18px 0 0',overflow:'hidden',background:'#000'}}>
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

                                <video
                                  ref={callRemoteVideoRef}
                                  style={{width:'100%',height:'100%',objectFit:'cover',display:'block'}}
                                  autoPlay
                                  playsInline
                                  onDoubleClick={()=>toggleFullscreen(callRemoteWrapRef.current)}
                                />

                                <StyledCallLocalVideo>
                                  <video
                                    ref={callLocalVideoRef}
                                    muted
                                    autoPlay
                                    playsInline
                                    style={{width:'100%',height:'100%',objectFit:'cover',display:'block'}}
                                  />
                                </StyledCallLocalVideo>

                                <StyledCallBottomBar>
                                  <StyledCallBottomInner>
                                    <StyledCallPrimaryActions>
                                      <BtnCallDanger onClick={()=>handleCallEnd(false)} title={t('dashboardClient.videoChatFavoritosCliente.actions.hangup')} aria-label={t('dashboardClient.videoChatFavoritosCliente.actions.hangup')}>
                                        <FontAwesomeIcon icon={faPhoneSlash}/>
                                      </BtnCallDanger>
                                    </StyledCallPrimaryActions>
                                  </StyledCallBottomInner>
                                </StyledCallBottomBar>

                                <StyledChatContainer data-wide="true">
                                  {shouldShowCallTranslationToggle && (
                                    <div style={{position:'absolute',top:12,right:280,zIndex:100,pointerEvents:'auto'}}>
                                      <TranslationToggleButton />
                                    </div>
                                  )}
                                  <StyledChatList ref={callListRef} style={{width:'100%',maxHeight:'40%',overflowY:'auto'}}>
                                    {renderCallMessages()}
                                  </StyledChatList>
                                </StyledChatContainer>
                              </StyledCallStage>
                            </StyledRemoteVideo>
                          </StyledCallVideoArea>

                          <StyledCallFooterDesktop>
                            <StyledCallComposer>
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

                              <ButtonRegalo type="button" onClick={()=>setShowCenterGifts(s=>!s)} title={t('dashboardClient.videoChatFavoritosCliente.actions.sendGift')} aria-label={t('dashboardClient.videoChatFavoritosCliente.actions.sendGift')}>
                                <FontAwesomeIcon icon={faGift}/>
                              </ButtonRegalo>

                              {showCenterGifts&&(
                                renderGiftPicker()
                              )}
                            </StyledCallComposer>
                          </StyledCallFooterDesktop>
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
                      {shouldShowTranslationToggle && (
                        <div style={{position:'absolute',top:6,right:12,zIndex:5}}>
                          <TranslationToggleButton />
                        </div>
                      )}
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

                      {allowChat && renderGiftBar()}

                      <StyledChatDockMessageComposer data-kind="favorites-chat">
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
          <div style={{display:'flex',flexDirection:'column',flex:1,minHeight:0}}>
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
                <StyledChatWhatsApp>
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

                  {allowChat && renderGiftBar()}

                  <StyledChatDockMessageComposer data-kind="favorites-chat">
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
