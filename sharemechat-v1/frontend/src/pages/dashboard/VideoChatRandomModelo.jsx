import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUserPlus, faVideo, faPhoneSlash, faForward, faPaperPlane, faBan } from '@fortawesome/free-solid-svg-icons';
import {
  StyledCenterVideochat,
  StyledSplit2,
  StyledPane,
  StyledVideoArea,
  StyledChatContainer,
  StyledChatList,
  StyledChatMessageRow,
  StyledChatBubble,
  StyledChatDock,
  StyledChatInput,
  StyledGiftIcon,
  StyledLocalVideo,
  StyledLocalVideoDesktop,
  StyledRemoteVideo,
  StyledVideoTitle,
  StyledTitleAvatar,
  StyledPreCallCenter,
  StyledHelperLine,
  StyledRandomSearchControls,
  StyledRandomSearchCol,
  StyledSearchHint,
  StyledCallCardDesktop,
  StyledCallFooterDesktop,
  StyledStatsPrecallCard,
  StyledStatsCard,
  StyledStatsCardLabel,
  StyledStatsCardValue,
  StyledStatsPrecallGrid,
  StyledStatsInline,
} from '../../styles/pages-styles/VideochatStyles';

import {
  ButtonActivarCam,
  ButtonActivarCamMobile,
  ButtonBuscar,
  ButtonNext,
  ButtonAddFavorite,
  BtnSend,
  BtnHangup,
  BtnBlock,
} from '../../styles/ButtonStyles';

export default function VideoChatRandomModelo(props) {
  const {
    cameraActive,
    handleActivateCamera,
    localVideoRef,
    vcListRef,
    messages,
    giftRenderReady,
    getGiftIcon,
    remoteStream,
    isMobile,
    remoteVideoWrapRef,
    stopAll,
    searching,
    handleNext,
    currentClientId,
    handleAddFavorite,
    clientAvatar,
    clientNickname,
    remoteVideoRef,
    toggleFullscreen,
    handleStartMatch,
    chatInput,
    setChatInput,
    sendChatMessage,
    handleBlockPeer,
    error,
    modelStatsSummary
  } = props;

  return (
    <StyledCenterVideochat>
      <StyledSplit2 data-mode={!isMobile && remoteStream ? 'full-remote' : 'split'}>
        {/* PANE IZQUIERDO (LOCAL / CTA) */}
        <StyledPane data-side="left">
          {!isMobile && (
            !cameraActive ? (
              <div style={{width:'100%',height:'100%',display:'flex',alignItems:'center',justifyContent:'center'}}>
                <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:8}}>
                  <ButtonActivarCam onClick={handleActivateCamera}>Activar cámara</ButtonActivarCam>
                  <StyledHelperLine style={{color:'#fff',justifyContent:'center'}}>
                    <FontAwesomeIcon icon={faVideo} />
                    activar cámara para iniciar videochat
                  </StyledHelperLine>
                </div>
              </div>
            ) : (
              <StyledVideoArea />
            )
          )}
        </StyledPane>

        {/* PANE DERECHO (REMOTO + CONTROLES) */}
        <StyledPane data-side="right" style={{position:'relative'}}>
          {!cameraActive ? (
            <>
              <StyledStatsPrecallCard>
                <StyledStatsCard>
                  <StyledStatsCardLabel>Tier (snapshot)</StyledStatsCardLabel>
                  <StyledStatsCardValue>{modelStatsSummary?.tierName || '—'}</StyledStatsCardValue>

                  <StyledStatsInline>
                    <div>Fecha: <b>{modelStatsSummary?.snapshotDate || '—'}</b></div>
                  </StyledStatsInline>
                </StyledStatsCard>

                <StyledStatsPrecallGrid>
                  <StyledStatsCard>
                    <StyledStatsCardLabel>Minutos (30d)</StyledStatsCardLabel>
                    <StyledStatsCardValue>{Number(modelStatsSummary?.billedMinutes30d || 0)}</StyledStatsCardValue>

                    <StyledStatsInline>
                      <div>Horas: <b>{modelStatsSummary?.billedHours30d || '—'}</b></div>
                    </StyledStatsInline>
                  </StyledStatsCard>

                  <StyledStatsCard>
                    <StyledStatsCardLabel>Tarifas tier</StyledStatsCardLabel>

                    <StyledStatsInline>
                      <div>1º min: <b>€{modelStatsSummary?.firstMinuteEURPerMin || '0.0000'}/min</b></div>
                      <div>Sig.: <b>€{modelStatsSummary?.nextMinutesEURPerMin || '0.0000'}/min</b></div>
                    </StyledStatsInline>
                  </StyledStatsCard>
                </StyledStatsPrecallGrid>
              </StyledStatsPrecallCard>

              {isMobile && (
                <StyledPreCallCenter style={{position:'absolute',top:'70%',left:0,right:0,transform:'translateY(-50%)'}}>
                  <div>
                    <ButtonActivarCamMobile onClick={handleActivateCamera}>Activar cámara</ButtonActivarCamMobile>
                    <StyledHelperLine style={{color:'#fff'}}>
                      <FontAwesomeIcon icon={faVideo} />
                      activar cámara para iniciar videochat
                    </StyledHelperLine>
                  </div>
                </StyledPreCallCenter>
              )}
            </>
          ) : (
            <>
              {/* CONTROLES BUSCAR / BUSCANDO (sin remoto) */}
              {!remoteStream && (
                <StyledRandomSearchControls>
                  <StyledRandomSearchCol>
                    {!searching ? (
                      <>
                        <ButtonBuscar onClick={handleStartMatch}>Buscar</ButtonBuscar>
                        <StyledSearchHint>Pulsa “Buscar” para empezar.</StyledSearchHint>
                      </>
                    ) : (
                      <>
                        <StyledSearchHint>Buscando cliente disponible…</StyledSearchHint>
                        <div style={{marginTop:8,display:'flex',justifyContent:'center'}}>
                          <BtnHangup
                            onClick={stopAll}
                            title="Detener búsqueda"
                            aria-label="Detener búsqueda"
                            style={{width:44,height:44,borderRadius:'999px',padding:0,display:'flex',alignItems:'center',justifyContent:'center',background:'#dc3545',color:'#fff',border:'1px solid rgba(255,255,255,0.4)'}}
                            onMouseEnter={(e)=>{e.currentTarget.style.background='#fff';e.currentTarget.style.color='#dc3545';}}
                            onMouseLeave={(e)=>{e.currentTarget.style.background='#dc3545';e.currentTarget.style.color='#fff';}}
                          >
                            <FontAwesomeIcon icon={faPhoneSlash} />
                          </BtnHangup>
                        </div>
                      </>
                    )}
                  </StyledRandomSearchCol>
                </StyledRandomSearchControls>
              )}

              {/* DESKTOP: REMOTO + CARD */}
              {remoteStream && !isMobile && (
                <StyledCallCardDesktop>
                  <StyledVideoArea style={{height:'calc(100vh - 180px)',maxHeight:'calc(100vh - 180px)'}}>
                    <StyledRemoteVideo ref={remoteVideoWrapRef} style={{position:'relative',width:'100%',height:'100%',borderRadius:'12px',overflow:'hidden',background:'#000'}}>
                      <StyledVideoTitle>
                        <StyledTitleAvatar src={clientAvatar || '/img/avatarChico.png'} alt="" />
                        {clientNickname || 'Cliente'}
                        <button
                          type="button"
                          onClick={()=>toggleFullscreen(remoteVideoWrapRef.current)}
                          title="Pantalla completa"
                          style={{marginLeft:8,padding:'2px 8px',borderRadius:6,border:'1px solid rgba(255,255,255,0.6)',background:'rgba(0,0,0,0.25)',color:'#fff',cursor:'pointer'}}
                        >
                          Pantalla completa
                        </button>
                      </StyledVideoTitle>

                      <video
                        ref={remoteVideoRef}
                        style={{width:'100%',height:'100%',objectFit:'cover',display:'block'}}
                        autoPlay
                        playsInline
                        onDoubleClick={()=>toggleFullscreen(remoteVideoWrapRef.current)}
                      />

                      {cameraActive && (
                        <div style={{position:'absolute',top:0,right:0,width:'24%',maxWidth:260,height:'auto',overflow:'hidden',zIndex:8}}>
                          <video ref={localVideoRef} muted autoPlay playsInline style={{width:'100%',height:'100%',objectFit:'cover',display:'block'}} />
                        </div>
                      )}

                      {/* CONTROLES (CENTRADOS) + BLOQUEAR (DERECHA) */}
                      {cameraActive && (
                        <div style={{position:'absolute',left:16,right:16,bottom:16,zIndex:9}}>
                          <div style={{position:'relative',height:44}}>
                            <div style={{position:'absolute',left:'50%',top:0,transform:'translateX(-50%)',display:'flex',alignItems:'center',justifyContent:'center',gap:8}}>
                              <BtnHangup
                                onClick={stopAll}
                                title="Colgar"
                                aria-label="Colgar"
                                style={{width:44,height:44,borderRadius:'999px',padding:0,display:'flex',alignItems:'center',justifyContent:'center',background:'#dc3545',color:'#fff',border:'1px solid rgba(255,255,255,0.4)'}}
                                onMouseEnter={(e)=>{e.currentTarget.style.background='#fff';e.currentTarget.style.color='#dc3545';}}
                                onMouseLeave={(e)=>{e.currentTarget.style.background='#dc3545';e.currentTarget.style.color='#fff';}}
                              >
                                <FontAwesomeIcon icon={faPhoneSlash} />
                              </BtnHangup>

                              <ButtonNext
                                onClick={()=>handleNext && handleNext()}
                                style={{width:44,height:44,borderRadius:'999px',padding:0,display:'flex',alignItems:'center',justifyContent:'center',background:'#fff',color:'#000',border:'1px solid rgba(255,255,255,0.4)'}}
                                onMouseEnter={(e)=>{e.currentTarget.style.background='#000';e.currentTarget.style.color='#fff';}}
                                onMouseLeave={(e)=>{e.currentTarget.style.background='#fff';e.currentTarget.style.color='#000';}}
                              >
                                <FontAwesomeIcon icon={faForward} />
                              </ButtonNext>

                              {currentClientId && (
                                <ButtonAddFavorite
                                  aria-label="Añadir a favoritos"
                                  onClick={handleAddFavorite}
                                  title="Añadir a favoritos"
                                  style={{width:44,height:44,borderRadius:'999px',padding:0,display:'flex',alignItems:'center',justifyContent:'center',background:'#fff',color:'#000',border:'1px solid rgba(255,255,255,0.4)'}}
                                  onMouseEnter={(e)=>{e.currentTarget.style.background='#000';e.currentTarget.style.color='#fff';}}
                                  onMouseLeave={(e)=>{e.currentTarget.style.background='#fff';e.currentTarget.style.color='#000';}}
                                >
                                  <FontAwesomeIcon icon={faUserPlus} />
                                </ButtonAddFavorite>
                              )}
                            </div>

                            <div style={{position:'absolute',right:0,top:0,display:'flex',alignItems:'center',justifyContent:'flex-end'}}>
                              <BtnBlock type="button" onClick={()=>handleBlockPeer&&handleBlockPeer()} aria-label="Bloquear" title="Bloquear" style={{width:44,height:44}}>
                                <FontAwesomeIcon icon={faBan} />
                              </BtnBlock>
                            </div>
                          </div>
                        </div>
                      )}

                      <StyledChatContainer data-wide="true">
                        <StyledChatList ref={vcListRef}>
                          {messages.map((msg, index) => {
                            const isMe = msg.from === 'me';
                            const variant = isMe ? 'me' : 'peer';
                            return (
                              <StyledChatMessageRow key={index}>
                                {msg.gift ? (
                                  <StyledChatBubble $variant={variant}>
                                    {giftRenderReady && (() => {
                                      const src = getGiftIcon(msg.gift);
                                      return src ? <StyledGiftIcon src={src} alt="" /> : null;
                                    })()}
                                  </StyledChatBubble>
                                ) : (
                                  <StyledChatBubble $variant={variant}>{msg.text}</StyledChatBubble>
                                )}
                              </StyledChatMessageRow>
                            );
                          })}
                        </StyledChatList>
                      </StyledChatContainer>
                    </StyledRemoteVideo>
                  </StyledVideoArea>

                  <StyledCallFooterDesktop style={{margin:'8px 0 0',padding:'0 0px',display:'flex',alignItems:'center',gap:8}}>
                    <StyledChatInput
                      type="text"
                      value={chatInput}
                      onChange={(e)=>setChatInput(e.target.value)}
                      placeholder="Escribe un mensaje…"
                      autoComplete="off"
                      onKeyDown={(e)=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendChatMessage();}}}
                    />
                    <BtnSend type="button" onClick={sendChatMessage} aria-label="Enviar mensaje">
                      <FontAwesomeIcon icon={faPaperPlane} />
                    </BtnSend>
                  </StyledCallFooterDesktop>
                </StyledCallCardDesktop>
              )}

              {/* MÓVIL: REMOTO + CHAT OVERLAY + PIP + CONTROLES */}
              {remoteStream && isMobile && (
                <StyledVideoArea>
                  <StyledRemoteVideo ref={remoteVideoWrapRef} style={{position:'relative',width:'100%',overflow:'hidden',background:'#000'}}>
                    <StyledVideoTitle>
                      <StyledTitleAvatar src={clientAvatar || '/img/avatarChico.png'} alt="" />
                      {clientNickname || 'Cliente'}
                    </StyledVideoTitle>

                    <video
                      ref={remoteVideoRef}
                      style={{width:'100%',height:'100%',objectFit:'cover',display:'block'}}
                      autoPlay
                      playsInline
                      onDoubleClick={()=>toggleFullscreen(remoteVideoWrapRef.current)}
                    />

                    {cameraActive && (
                      <StyledLocalVideo>
                        <video ref={localVideoRef} muted autoPlay playsInline style={{width:'100%',objectFit:'cover',display:'block'}} />
                      </StyledLocalVideo>
                    )}

                    {/* CONTROLES MÓVIL (CENTRADOS) + BLOQUEAR (DERECHA) */}
                    {cameraActive && (
                      <div style={{position:'absolute',left:12,right:12,bottom:'72px',zIndex:8}}>
                        <div style={{position:'relative',height:44}}>
                          <div style={{position:'absolute',left:'50%',top:0,transform:'translateX(-50%)',display:'flex',alignItems:'center',justifyContent:'center',gap:'12px'}}>
                            <BtnHangup onClick={stopAll} title="Colgar" aria-label="Colgar">
                              <FontAwesomeIcon icon={faPhoneSlash} />
                            </BtnHangup>

                            <ButtonNext
                              onClick={()=>handleNext && handleNext()}
                              style={{width:44,height:44,borderRadius:'999px',padding:0,display:'flex',alignItems:'center',justifyContent:'center',background:'#fff',color:'#000',border:'1px solid rgba(255,255,255,0.4)'}}
                              onMouseEnter={(e)=>{e.currentTarget.style.background='#000';e.currentTarget.style.color='#fff';}}
                              onMouseLeave={(e)=>{e.currentTarget.style.background='#fff';e.currentTarget.style.color='#000';}}
                            >
                              <FontAwesomeIcon icon={faForward} />
                            </ButtonNext>

                            {currentClientId && (
                              <ButtonAddFavorite
                                aria-label="Añadir a favoritos"
                                onClick={handleAddFavorite}
                                title="Añadir a favoritos"
                                style={{width:44,height:44,borderRadius:'999px',padding:0,display:'flex',alignItems:'center',justifyContent:'center',background:'#fff',color:'#000',border:'1px solid rgba(255,255,255,0.4)'}}
                                onMouseEnter={(e)=>{e.currentTarget.style.background='#000';e.currentTarget.style.color='#fff';}}
                                onMouseLeave={(e)=>{e.currentTarget.style.background='#fff';e.currentTarget.style.color='#000';}}
                              >
                                <FontAwesomeIcon icon={faUserPlus} />
                              </ButtonAddFavorite>
                            )}
                          </div>

                          <div style={{position:'absolute',right:0,top:0,display:'flex',alignItems:'center',justifyContent:'flex-end'}}>
                            <BtnBlock type="button" onClick={()=>handleBlockPeer&&handleBlockPeer()} aria-label="Bloquear" title="Bloquear" style={{width:44,height:44}}>
                              <FontAwesomeIcon icon={faBan} />
                            </BtnBlock>
                          </div>
                        </div>
                      </div>
                    )}

                    <StyledChatContainer data-wide="true">
                      <StyledChatList ref={vcListRef}>
                        {messages.map((msg, index) => {
                          const isMe = msg.from === 'me';
                          const variant = isMe ? 'me' : 'peer';
                          return (
                            <StyledChatMessageRow key={index}>
                              {msg.gift ? (
                                <StyledChatBubble $variant={variant}>
                                  {giftRenderReady && (() => {
                                    const src = getGiftIcon(msg.gift);
                                    return src ? <StyledGiftIcon src={src} alt="" /> : null;
                                  })()}
                                </StyledChatBubble>
                              ) : (
                                <StyledChatBubble $variant={variant}>{msg.text}</StyledChatBubble>
                              )}
                            </StyledChatMessageRow>
                          );
                        })}
                      </StyledChatList>
                    </StyledChatContainer>
                  </StyledRemoteVideo>
                </StyledVideoArea>
              )}
            </>
          )}
        </StyledPane>

        {/* LOCAL DESKTOP: PRE-CALL GRANDE */}
        {!isMobile && cameraActive && !remoteStream && (
          <StyledLocalVideoDesktop data-has-remote="false">
            <video ref={localVideoRef} muted autoPlay playsInline style={{width:'100%',height:'100%',objectFit:'cover',display:'block'}} />
          </StyledLocalVideoDesktop>
        )}
      </StyledSplit2>

      {/* DOCK CHAT SOLO MÓVIL EN LLAMADA */}
      {remoteStream && isMobile && (
        <StyledChatDock>
          <StyledChatInput
            type="text"
            value={chatInput}
            onChange={(e)=>setChatInput(e.target.value)}
            placeholder="Escribe un mensaje…"
            autoComplete="off"
            onKeyDown={(e)=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendChatMessage();}}}
          />
          <BtnSend type="button" onClick={sendChatMessage} aria-label="Enviar mensaje">
            <FontAwesomeIcon icon={faPaperPlane} />
          </BtnSend>
        </StyledChatDock>
      )}

      {error && <p style={{color:'red',marginTop:'10px'}}>{error}</p>}
    </StyledCenterVideochat>
  );
}
