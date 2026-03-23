import React from 'react';
import i18n from '../../i18n';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowLeft, faPhoneSlash, faVideo, faPaperPlane } from '@fortawesome/free-solid-svg-icons';
import FavoritesModelList from '../favorites/FavoritesModelList';
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
  StyledChatMessageRow,
  StyledChatBubble,
  StyledPreCallCenter,
  StyledHelperLine,
  StyledBottomActionsMobile,
  StyledMobile3ColBar,
  StyledTopCenter,
  StyledConnectedText,
  StyledFloatingHangup,
  StyledCallCardDesktop,
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
} from '../../styles/pages-styles/VideochatStyles';
import {
  ButtonLlamar,
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

export default function VideoChatFavoritosModelo(props) {
  const t = (key, options) => i18n.t(key, options);

  const {
    isMobile,
    allowChat,
    isPendingPanel,
    isSentPanel,
    contactMode,
    openChatWith,
    centerChatPeerName,
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
    setTargetPeerId,
    setTargetPeerName,
    setSelectedFav,
    callClientSaldo,
    callClientSaldoLoading,
  } = props;

  const renderDesktopCallMessages = () => (
    centerMessages.map((m) => {
      let giftData = m.gift;
      if (!giftData && typeof m.body === 'string' && m.body.startsWith('[[GIFT:') && m.body.endsWith(']]')) {
        try {
          const parts = m.body.slice(2, -2).split(':');
          giftData = { id: Number(parts[1]), name: parts.slice(2).join(':') };
        } catch {}
      }
      const isMe = Number(m.senderId) === Number(user?.id);
      const variant = isMe ? 'peer' : 'me';
      return (
        <StyledChatMessageRow key={m.id}>
          <StyledChatBubble $variant={variant} style={{margin:'0 6px'}}>
            {giftData
              ? giftRenderReady &&
                (() => {
                  const src = gifts.find((gg) => Number(gg.id) === Number(giftData.id))?.icon || null;
                  return src ? <img src={src} alt="" style={{ width: 24, height: 24, verticalAlign: 'middle' }} /> : null;
                })()
              : m.body}
          </StyledChatBubble>
        </StyledChatMessageRow>
      );
    })
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
      {!isMobile && (
        <StyledFavoritesShell>
          <StyledFavoritesColumns>
            <StyledCenterPanel>
              {!openChatWith ? (
                <div style={{ color: '#adb5bd', textAlign:'center' }}>
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
                      <div style={{flex:1,minHeight:0,display:'flex',flexDirection:'column',justifyContent:'center',alignItems:'center'}}>
                        {callError && <p style={{ color: 'orange', marginTop: 6 }}>[CALL] {callError}</p>}

                        <StyledTopActions style={{gap:8,display:'flex',justifyContent:'center',alignItems:'center',flexDirection:'column'}}>
                          {!callCameraActive && callStatus !== 'incoming' && (
                            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:6, marginTop:8 }}>
                              <ButtonActivarCam
                                onClick={handleCallActivateCamera}
                                disabled={callStatus === 'idle' ? !allowChat : false}
                                title={callStatus === 'idle' ? (allowChat ? t('dashboardModel.favorites.call.activateCamera') : t('dashboardModel.favorites.call.acceptedRequired')) : t('dashboardModel.favorites.call.activateCamera')}
                              >
                                {t('dashboardModel.favorites.call.activateCamera')}
                              </ButtonActivarCam>
                              <StyledHelperLine style={{ color:'#000' }}>
                                <FontAwesomeIcon icon={faVideo} />
                                {t('dashboardModel.favorites.call.activateCameraHint')}
                              </StyledHelperLine>
                            </div>
                          )}

                          {callCameraActive && callStatus !== 'in-call' && callStatus !== 'ringing' && callStatus !== 'connecting' && (
                            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:6, marginTop:8 }}>
                              <BtnRoundVideo
                                onClick={handleCallInvite}
                                disabled={!allowChat || !callPeerId}
                                title={!allowChat ? t('dashboardModel.favorites.call.acceptedRequired') : !callPeerId ? t('dashboardModel.favorites.call.selectContactFirst') : t('dashboardModel.favorites.call.callUser', { name: callPeerName || t('dashboardModel.favorites.call.defaultUser') })}
                                aria-label={t('dashboardModel.favorites.call.call')}
                              >
                                <FontAwesomeIcon icon={faVideo} />
                              </BtnRoundVideo>
                              <StyledHelperLine style={{ color:'#000' }}>
                                <FontAwesomeIcon icon={faVideo} />
                                {t('dashboardModel.favorites.call.startVideoCallHint')}
                              </StyledHelperLine>
                            </div>
                          )}

                          {(callStatus === 'ringing' || callStatus === 'connecting') && (
                            <div style={{display:'flex',flexDirection:'column',justifyContent:'center',alignItems:'center',gap:8,marginTop:8}}>
                              <div style={{color:'#fff',textAlign:'center'}}>
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
                          <StyledCallCardDesktop>
                            <StyledCallVideoArea>
                              <StyledRemoteVideo ref={callRemoteWrapRef} style={{ position: 'relative', width: '100%', height: '100%', borderRadius: '18px 18px 0 0', overflow: 'hidden', background: '#000' }}>
                                <StyledCallStage>
                                  <StyledCallTopBar>
                                    <StyledCallTopMeta>
                                      <StyledTitleAvatar src={callPeerAvatar || '/img/avatarChico.png'} alt="" />
                                      <div style={{display:'flex',flexDirection:'column',minWidth:0,lineHeight:1.15}}>
                                        <StyledCallTopMetaText>
                                          {callPeerName || t('dashboardModel.favorites.call.remote')}
                                        </StyledCallTopMetaText>
                                        <div style={{fontSize:12,opacity:0.9,marginTop:2,color:'rgba(255,255,255,0.82)'}}>
                                          {renderCallClientBalance()}
                                        </div>
                                      </div>
                                    </StyledCallTopMeta>

                                    <StyledCallTopActions>
                                      <BtnCallGhost
                                        type="button"
                                        onClick={() => toggleFullscreen(callRemoteWrapRef.current)}
                                        title={t('common.fullscreen')}
                                        aria-label={t('common.fullscreen')}
                                      >
                                        {t('common.fullscreen')}
                                      </BtnCallGhost>
                                    </StyledCallTopActions>
                                  </StyledCallTopBar>

                                  <video
                                    ref={callRemoteVideoRef}
                                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                                    autoPlay
                                    playsInline
                                    onDoubleClick={() => toggleFullscreen(callRemoteWrapRef.current)}
                                  />

                                  <StyledCallLocalVideo>
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

                                  <StyledChatContainer data-wide="true">
                                    <StyledChatList ref={callListRef}>
                                      {renderDesktopCallMessages()}
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
                          </StyledCallCardDesktop>
                        )}

                        {callStatus === 'incoming' && (
                          <div style={{marginTop:12,padding:12,border:'1px solid #333',borderRadius:8,background:'rgba(0,0,0,0.35)',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',alignSelf:'center'}}>
                            <div style={{ color:'#fff', marginBottom:8, textAlign:'center' }}>
                              {t('dashboardModel.favorites.incomingCall', { name: callPeerName || t('dashboardModel.favorites.call.defaultUser') })}
                            </div>
                            <div style={{ display:'flex', gap:10, justifyContent:'center', alignItems:'center' }}>
                              <ButtonAceptar onClick={handleCallAccept}>{t('dashboardModel.favorites.acceptInvitation')}</ButtonAceptar>
                              <ButtonRechazar onClick={handleCallReject} style={{ backgroundColor:'#dc3545' }}>
                                {t('dashboardModel.favorites.rejectInvitation')}
                              </ButtonRechazar>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {!isPendingPanel && !isSentPanel && contactMode !== 'call' && (
                      <StyledChatWhatsApp>
                        <StyledChatScroller ref={modelCenterListRef} data-bg="whatsapp">
                          {centerMessages.length === 0 && (
                            <div style={{ color: '#adb5bd' }}>
                              {allowChat ? t('dashboardModel.favorites.noMessagesYet') : t('dashboardModel.favorites.chatInactive')}
                            </div>
                          )}
                          {centerMessages.map((m) => {
                            let giftData = m.gift;
                            if (!giftData && typeof m.body === 'string' && m.body.startsWith('[[GIFT:') && m.body.endsWith(']]')) {
                              try {
                                const parts = m.body.slice(2, -2).split(':');
                                giftData = { id: Number(parts[1]), name: parts.slice(2).join(':') };
                              } catch {}
                            }
                            const isMe = Number(m.senderId) === Number(user?.id);
                            const variant = isMe ? 'me' : 'peer';
                            return (
                              <StyledChatMessageRow key={m.id} style={{ justifyContent: isMe ? 'flex-end' : 'flex-start' }}>
                                <StyledChatBubble $variant={variant} style={{margin:'0 6px'}}>
                                  {giftData
                                    ? giftRenderReady &&
                                      (() => {
                                        const src = gifts.find((gg) => Number(gg.id) === Number(giftData.id))?.icon || null;
                                        return src ? <img src={src} alt="" style={{ width: 24, height: 24, verticalAlign: 'middle' }} /> : null;
                                      })()
                                    : m.body}
                                </StyledChatBubble>
                              </StyledChatMessageRow>
                            );
                          })}
                        </StyledChatScroller>

                        <StyledChatDock>
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

                          <ButtonLlamar
                            onClick={enterCallMode}
                            disabled={!openChatWith || !allowChat}
                            title={t('dashboardModel.favorites.call.call')}
                            aria-label={t('dashboardModel.favorites.call.call')}
                            style={{marginRight:16, marginLeft:4,width:40,height:40,borderRadius:'999px',padding:0,display:'flex',alignItems:'center',justifyContent:'center'}}
                          >
                            <FontAwesomeIcon icon={faVideo} />
                          </ButtonLlamar>
                        </StyledChatDock>
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
          {!openChatWith && (
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
              <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
                <FavoritesModelList
                  onSelect={handleOpenChatFromFavorites}
                  reloadTrigger={favReload}
                  selectedId={selectedContactId}
                />
              </div>
            </div>
          )}

          {openChatWith && (
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
              {contactMode !== 'call' && (
                <StyledMobile3ColBar>
                  <ButtonVolver
                    type="button"
                    onClick={() => {
                      setTargetPeerId(null);
                      setTargetPeerName('');
                      setSelectedFav(null);
                      setContactMode('chat');
                    }}
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
                        <div style={{display:'flex',alignItems:'center',gap:10}}>
                          <StyledTitleAvatar src={callPeerAvatar || '/img/avatarChico.png'} alt="" />

                          <div style={{display:'flex',flexDirection:'column',lineHeight:1.15,minWidth:0}}>
                            <div style={{whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>
                              {callPeerName || t('dashboardModel.favorites.call.remote')}
                            </div>

                            <div style={{fontSize:12,opacity:0.9,marginTop:2}}>
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
                      <video ref={callLocalVideoRef} muted autoPlay playsInline style={{ width: '100%', display: 'block', border: '1px solid rgba(255,255,255,0.25)' }} />
                    </StyledLocalVideo>

                    {callStatus === 'in-call' && (
                      <StyledFloatingHangup>
                        <BtnHangup onClick={() => handleCallEnd(false)} title={t('common.hangup')} aria-label={t('common.hangup')}>
                          <FontAwesomeIcon icon={faPhoneSlash} />
                        </BtnHangup>
                      </StyledFloatingHangup>
                    )}

                    <StyledChatContainer data-wide="true">
                      <StyledChatList ref={callListRef}>
                        {centerMessages.map((m) => {
                          let giftData = m.gift;
                          if (!giftData && typeof m.body === 'string' && m.body.startsWith('[[GIFT:') && m.body.endsWith(']]')) {
                            try {
                              const parts = m.body.slice(2, -2).split(':');
                              giftData = { id: Number(parts[1]), name: parts.slice(2).join(':') };
                            } catch {}
                          }
                          const isMe = Number(m.senderId) === Number(user?.id);
                          const variant = isMe ? 'peer' : 'me';
                          return (
                            <StyledChatMessageRow key={m.id}>
                              <StyledChatBubble $variant={variant} style={{margin:'0 6px'}}>
                                {giftData
                                  ? giftRenderReady &&
                                    (() => {
                                      const src = gifts.find((gg) => Number(gg.id) === Number(giftData.id))?.icon || null;
                                      return src ? <img src={src} alt="" style={{ width: 24, height: 24, verticalAlign: 'middle' }} /> : null;
                                    })()
                                  : m.body}
                              </StyledChatBubble>
                            </StyledChatMessageRow>
                          );
                        })}
                      </StyledChatList>
                    </StyledChatContainer>
                  </StyledVideoArea>

                  <StyledChatDock style={{ display: callStatus === 'in-call' ? 'flex' : 'none' }}>
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
                  <StyledChatWhatsApp>
                    <StyledChatScroller ref={modelCenterListRef} data-bg="whatsapp">
                      {centerMessages.length === 0 && (
                        <div style={{ color: '#adb5bd' }}>
                          {allowChat ? t('dashboardModel.favorites.noMessagesYet') : t('dashboardModel.favorites.chatInactive')}
                        </div>
                      )}
                      {centerMessages.map((m) => {
                        let giftData = m.gift;
                        if (!giftData && typeof m.body === 'string' && m.body.startsWith('[[GIFT:') && m.body.endsWith(']]')) {
                          try {
                            const parts = m.body.slice(2, -2).split(':');
                            giftData = { id: Number(parts[1]), name: parts.slice(2).join(':') };
                          } catch {}
                        }
                        const isMe = Number(m.senderId) === Number(user?.id);
                        const variant = isMe ? 'me' : 'peer';
                        return (
                          <StyledChatMessageRow key={m.id} style={{ justifyContent: isMe ? 'flex-end' : 'flex-start' }}>
                            <StyledChatBubble $variant={variant} style={{margin:'0 6px'}}>
                              {giftData
                                ? giftRenderReady &&
                                  (() => {
                                    const src = gifts.find((gg) => Number(gg.id) === Number(giftData.id))?.icon || null;
                                    return src ? <img src={src} alt="" style={{ width: 24, height: 24, verticalAlign: 'middle' }} /> : null;
                                  })()
                                : m.body}
                            </StyledChatBubble>
                          </StyledChatMessageRow>
                        );
                      })}
                    </StyledChatScroller>

                    <StyledChatDock>
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
                        onFocus={() => { setTimeout(() => modelCenterListRef.current?.scrollIntoView({block:'end'}), 50); }}
                      />
                    </StyledChatDock>
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
