// src/pages/dashboard/VideoChatFavoritosCliente.jsx
import React,{useEffect,useRef} from 'react';
import i18n from '../../i18n';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowLeft, faPhoneSlash, faVideo, faPaperPlane, faGift } from '@fortawesome/free-solid-svg-icons';
import FavoritesClientList from '../favorites/FavoritesClientList';
import { StyledCenter,StyledFavoritesShell,StyledFavoritesColumns,StyledCenterPanel,StyledCenterBody,
    StyledChatScroller,StyledChatDock,StyledChatInput,StyledVideoArea,StyledRemoteVideo,StyledVideoTitle,
    StyledTitleAvatar,StyledLocalVideo,StyledTopActions,StyledChatWhatsApp,StyledChatContainer,
    StyledChatList,StyledChatMessageRow,StyledChatBubble,StyledGiftMessage,StyledGiftIcon,StyledPreCallCenter,StyledHelperLine,
    StyledBottomActionsMobile,StyledMobile3ColBar,StyledTopCenter,StyledConnectedText,StyledFloatingHangup,
    StyledCallCardDesktop,StyledCallFooterDesktop,StyledCallVideoArea,StyledCallStage,StyledCallTopBar,
    StyledCallTopMeta,StyledCallTopMetaText,StyledCallTopActions,StyledCallLocalVideo,StyledCallBottomBar,
    StyledCallBottomInner,StyledCallPrimaryActions,StyledCallComposer,StyledGiftsPanel,StyledGiftGrid,
    StyledGiftCatalog,StyledGiftSection,StyledGiftSectionTitle,StyledChatMessagesInner,StyledChatDockMessageComposer,StyledChatDockActions
} from '../../styles/pages-styles/VideochatStyles';
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
      callError,backToList,user} = props;

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

  const renderCallMessages = () => (
    centerMessages.map(m => {
      const giftData = normalizeGiftMessage(m);
      const isMe = Number(m.senderId) === Number(user?.id);
      const variant = isMe ? 'me' : 'peer';

      return (
        <StyledChatMessageRow key={m.id}>
          {giftData ? (
            renderGiftVisual(giftData)
          ) : (
            <StyledChatBubble $variant={variant}>{m.body}</StyledChatBubble>
          )}
        </StyledChatMessageRow>
      );
    })
  );

  return(<>
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
                                  </StyledCallTopMeta>
                                  <StyledCallTopActions>
                                    <BtnCallGhost
                                      type="button"
                                      onClick={()=>toggleFullscreen(callRemoteWrapRef.current)}
                                      title={t('dashboardClient.videoChatFavoritosCliente.actions.fullscreen')}
                                      aria-label={t('dashboardClient.videoChatFavoritosCliente.actions.fullscreen')}
                                    >
                                      {t('dashboardClient.videoChatFavoritosCliente.actions.fullscreen')}
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
                            <ButtonAceptar onClick={handleCallAccept}>Aceptar</ButtonAceptar>
                            <ButtonRechazar onClick={handleCallReject} style={{backgroundColor:'#dc3545'}}>Rechazar</ButtonRechazar>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Desktop chat normal */}
                  {!isPendingPanel&&!isSentPanel&&contactMode!=='call'&&(
                    <StyledChatWhatsApp>
                      <StyledChatScroller ref={centerListRef} data-bg="whatsapp" data-kind="favorites-chat">
                        <StyledChatMessagesInner>
                          {centerLoading&&<div style={{color:'#adb5bd'}}>{t('dashboardClient.videoChatFavoritosCliente.loading.history')}</div>}
                          {!centerLoading&&centerMessages.length===0&&(
                            <div style={{color:'#adb5bd'}}>
                              {allowChat?t('dashboardClient.videoChatFavoritosCliente.empty.noMessages'):t('dashboardClient.videoChatFavoritosCliente.empty.chatInactive')}
                            </div>
                          )}
                          {centerMessages.map(m => {
                            const giftData = normalizeGiftMessage(m);
                            const isMe = Number(m.senderId) === Number(user?.id);
                            const variant = isMe ? 'me' : 'peer';

                            return (
                              <StyledChatMessageRow key={m.id} $side={variant}>
                                {giftData ? (
                                  renderGiftVisual(giftData)
                                ) : (
                                  <StyledChatBubble $variant={variant} $column>
                                    {m.body}
                                  </StyledChatBubble>
                                )}
                              </StyledChatMessageRow>
                            );
                          })}
                        </StyledChatMessagesInner>
                      </StyledChatScroller>

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
                          <ButtonRegalo
                            onClick={()=>setShowCenterGifts(s=>!s)}
                            title={t('dashboardClient.videoChatFavoritosCliente.actions.sendGift')}
                            disabled={!allowChat}
                            aria-label={t('dashboardClient.videoChatFavoritosCliente.actions.sendGift')}
                          >
                            <FontAwesomeIcon icon={faGift}/>
                          </ButtonRegalo>
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
                    <ButtonLlamar onClick={enterCallMode} title="Llamar" aria-label="Llamar">
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
                      {centerMessages.map(m => {
                        const giftData = normalizeGiftMessage(m);
                        const isMe = Number(m.senderId) === Number(user?.id);
                        const variant = isMe ? 'me' : 'peer';

                        return (
                          <StyledChatMessageRow key={m.id}>
                            {giftData ? (
                              renderGiftVisual(giftData)
                            ) : (
                              <StyledChatBubble $variant={variant}>{m.body}</StyledChatBubble>
                            )}
                          </StyledChatMessageRow>
                        );
                      })}
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
                      <ButtonAceptar onClick={acceptInvitation}>Aceptar</ButtonAceptar>
                      <ButtonRechazar onClick={rejectInvitation}>Rechazar</ButtonRechazar>
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
                      {centerLoading&&<div style={{color:'#adb5bd'}}>Cargando historial…</div>}
                      {!centerLoading&&centerMessages.length===0&&(
                        <div style={{color:'#adb5bd'}}>
                          {allowChat?'No hay mensajes todavía. ¡Escribe el primero!':'Este chat no está activo.'}
                        </div>
                      )}
                      {centerMessages.map(m => {
                        const giftData = normalizeGiftMessage(m);
                        const isMe = Number(m.senderId) === Number(user?.id);
                        const variant = isMe ? 'me' : 'peer';

                        return (
                          <StyledChatMessageRow key={m.id} $side={variant}>
                            {giftData ? (
                              renderGiftVisual(giftData)
                            ) : (
                              <StyledChatBubble $variant={variant} $column>
                                {m.body}
                              </StyledChatBubble>
                            )}
                          </StyledChatMessageRow>
                        );
                      })}
                    </StyledChatMessagesInner>
                  </StyledChatScroller>

                  <StyledChatDockMessageComposer data-kind="favorites-chat">
                    <StyledChatInput
                      value={centerInput}
                      onChange={e=>setCenterInput(e.target.value)}
                      placeholder={allowChat ? t('common.chat.placeholders.message') : t('common.chat.placeholders.inactive')}
                      onKeyDown={e=>{if(e.key==='Enter'&&allowChat)sendCenterMessage();}}
                      disabled={!allowChat}
                      onFocus={()=>{setTimeout(()=>chatEndRef.current?.scrollIntoView({block:'end'}),50);}}
                    />
                    <StyledChatDockActions>
                      <ButtonRegalo
                        onClick={()=>setShowCenterGifts(s=>!s)}
                        title="Enviar regalo"
                        disabled={!allowChat}
                        aria-label="Enviar regalo"
                      >
                        <FontAwesomeIcon icon={faGift}/>
                      </ButtonRegalo>
                    </StyledChatDockActions>
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
