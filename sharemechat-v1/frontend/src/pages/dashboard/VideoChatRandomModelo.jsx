import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUserPlus, faVideo, faPhoneSlash, faForward, faPaperPlane, faBan, faFlag } from '@fortawesome/free-solid-svg-icons';
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
  StyledTierProgressCard,
  StyledTierProgressRow,
  StyledTierKpiCol,
  StyledTierKpiTitle,
  StyledTierKpiLine,
  StyledTierBarWrap,
  StyledTierBarTrack,
  StyledTierBarFill,
  StyledTierBarLegend,
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
    handleReportPeer,
    error,
    modelStatsSummary,
    modelStatsTiers,
    clientSaldo,
    clientSaldoLoading,
    handleNext,
    nextDisabled,
  } = props;

  const tierProgress = React.useMemo(() => {
    const billed = Number(modelStatsSummary?.billedMinutes30d || 0);

    const tiers = Array.isArray(modelStatsTiers) ? modelStatsTiers : [];
    const ordered = [...tiers]
      .filter((t) => t && (t.active === true || t.active === false))
      .sort((a, b) => Number(a?.minBilledMinutes || 0) - Number(b?.minBilledMinutes || 0));

    if (!ordered.length) {
      return { billed, hasTiers: false, currentTier: null, nextTier: null, remaining: 0, pct: 0 };
    }

    const byName = ordered.find((t) => String(t?.name || '') === String(modelStatsSummary?.tierName || ''));

    let byMinutes = null;
    for (const t of ordered) {
      if (Number(t?.minBilledMinutes || 0) <= billed) byMinutes = t;
    }

    const currentTier = byName || byMinutes || ordered[0] || null;
    const currentMin = Number(currentTier?.minBilledMinutes || 0);

    const nextTier = ordered.find((t) => Number(t?.minBilledMinutes || 0) > currentMin) || null;
    const nextMin = Number(nextTier?.minBilledMinutes || 0);

    const remaining = nextTier ? Math.max(0, nextMin - billed) : 0;

    const pct = nextTier
      ? Math.max(0, Math.min(100, (billed / Math.max(1, nextMin)) * 100))
      : 100;

    return { billed, hasTiers: true, currentTier, nextTier, remaining, pct };
  }, [modelStatsSummary, modelStatsTiers]);



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
                <div style={{display:'flex',flexDirection:'column',gap:8}}>
                  <div style={{fontWeight:900,fontSize:16,color:'#fff',letterSpacing:'.2px'}}>
                    Progreso hacia el siguiente tier
                  </div>
                  <div style={{fontSize:14,color:'rgba(255,255,255,.85)'}}>
                    Basado en tus minutos facturados (30 días).
                  </div>
                </div>

                <StyledTierProgressCard>
                  {!tierProgress.hasTiers ? (
                    <StyledStatsInline>
                      <div>No hay datos de tiers disponibles para calcular el progreso.</div>
                      <div>Minutos actuales (30d): <b>{Number(modelStatsSummary?.billedMinutes30d || 0)}</b></div>
                    </StyledStatsInline>
                  ) : (
                    <>
                      <StyledTierProgressRow>
                        <StyledTierKpiCol>
                          <StyledTierKpiTitle>Tu situación</StyledTierKpiTitle>
                          <StyledTierKpiLine>
                            Minutos actuales: <b>{tierProgress.billed}</b>
                          </StyledTierKpiLine>
                          <StyledTierKpiLine>
                            Tier detectado: <b>{tierProgress.currentTier?.name || modelStatsSummary?.tierName || '—'}</b>
                          </StyledTierKpiLine>
                        </StyledTierKpiCol>

                        <StyledTierKpiCol>
                          <StyledTierKpiTitle>Siguiente objetivo</StyledTierKpiTitle>
                          {tierProgress.nextTier ? (
                            <>
                              <StyledTierKpiLine>
                                Siguiente tier: <b>{tierProgress.nextTier?.name || '—'}</b>
                              </StyledTierKpiLine>
                              <StyledTierKpiLine>
                                Requisito: <b>{Number(tierProgress.nextTier?.minBilledMinutes || 0)}</b> min
                              </StyledTierKpiLine>
                              <StyledTierKpiLine>
                                Te faltan: <b>{tierProgress.remaining}</b> min
                              </StyledTierKpiLine>
                            </>
                          ) : (
                            <StyledTierKpiLine>
                              Ya estás en el tier máximo (o no hay siguiente tier configurado).
                            </StyledTierKpiLine>
                          )}
                        </StyledTierKpiCol>
                      </StyledTierProgressRow>

                      <StyledTierBarWrap>
                        <StyledTierBarTrack>
                          <StyledTierBarFill style={{width:`${tierProgress.pct}%`}} />
                        </StyledTierBarTrack>

                        <StyledTierBarLegend>
                          <span>{tierProgress.billed} min</span>
                          <span>
                            {tierProgress.nextTier ? `${Number(tierProgress.nextTier?.minBilledMinutes || 0)} min` : '—'}
                          </span>
                        </StyledTierBarLegend>
                      </StyledTierBarWrap>
                    </>
                  )}
                </StyledTierProgressCard>
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
                        <div style={{display:'flex',alignItems:'center',gap:10}}>
                          <StyledTitleAvatar src={clientAvatar || '/img/avatarChico.png'} alt="" />
                          <div style={{display:'flex',flexDirection:'column',lineHeight:1.15}}>
                            <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
                              <span>{clientNickname || 'Cliente'}</span>

                              <button
                                type="button"
                                onClick={()=>toggleFullscreen(remoteVideoWrapRef.current)}
                                title="Pantalla completa"
                                style={{padding:'2px 8px',borderRadius:6,border:'1px solid rgba(255,255,255,0.6)',background:'rgba(0,0,0,0.25)',color:'#fff',cursor:'pointer'}}
                              >
                                Pantalla completa
                              </button>
                            </div>

                            <div style={{fontSize:12,opacity:0.9,marginTop:2}}>
                              {clientSaldoLoading ? (
                                <span>Saldo: …</span>
                              ) : Number.isFinite(Number(clientSaldo)) ? (
                                <span>Saldo: €{Number(clientSaldo).toFixed(2)}</span>
                              ) : (
                                <span>Saldo: —</span>
                              )}
                            </div>
                          </div>
                        </div>
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
                                disabled={!!nextDisabled}
                                aria-disabled={!!nextDisabled}
                                style={{width:44,height:44,borderRadius:'999px',padding:0,display:'flex',alignItems:'center',justifyContent:'center',background:'#fff',color:'#000',border:'1px solid rgba(255,255,255,0.4)',opacity:nextDisabled?0.55:1,cursor:nextDisabled?'not-allowed':'pointer'}}
                                onMouseEnter={(e)=>{if(nextDisabled)return;e.currentTarget.style.background='#000';e.currentTarget.style.color='#fff';}}
                                onMouseLeave={(e)=>{if(nextDisabled)return;e.currentTarget.style.background='#fff';e.currentTarget.style.color='#000';}}
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

                            <div style={{position:'absolute',right:0,top:0,display:'flex',alignItems:'center',justifyContent:'flex-end',gap:8}}>
                              <BtnBlock
                                type="button"
                                onClick={()=>handleReportPeer && handleReportPeer()}
                                aria-label="Reportar"
                                title="Reportar"
                                style={{width:44,height:44}}
                              >
                                <FontAwesomeIcon icon={faFlag} />
                              </BtnBlock>

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
                      <div style={{display:'flex',alignItems:'center',gap:10}}>
                        <StyledTitleAvatar src={clientAvatar || '/img/avatarChico.png'} alt="" />
                        <div style={{display:'flex',flexDirection:'column',lineHeight:1.15}}>
                          <div>{clientNickname || 'Cliente'}</div>

                          <div style={{fontSize:12,opacity:0.9,marginTop:2}}>
                            {clientSaldoLoading ? (
                              <span>Saldo: …</span>
                            ) : Number.isFinite(Number(clientSaldo)) ? (
                              <span>Saldo: €{Number(clientSaldo).toFixed(2)}</span>
                            ) : (
                              <span>Saldo: —</span>
                            )}
                          </div>
                        </div>
                      </div>
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
                              disabled={!!nextDisabled}
                              aria-disabled={!!nextDisabled}
                              style={{width:44,height:44,borderRadius:'999px',padding:0,display:'flex',alignItems:'center',justifyContent:'center',background:'#fff',color:'#000',border:'1px solid rgba(255,255,255,0.4)',opacity:nextDisabled?0.55:1,cursor:nextDisabled?'not-allowed':'pointer'}}
                              onMouseEnter={(e)=>{if(nextDisabled)return;e.currentTarget.style.background='#000';e.currentTarget.style.color='#fff';}}
                              onMouseLeave={(e)=>{if(nextDisabled)return;e.currentTarget.style.background='#fff';e.currentTarget.style.color='#000';}}
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

                          <div style={{position:'absolute',right:0,top:0,display:'flex',alignItems:'center',justifyContent:'flex-end',gap:8}}>
                            <BtnBlock
                              type="button"
                              onClick={()=>handleReportPeer && handleReportPeer()}
                              aria-label="Reportar"
                              title="Reportar"
                              style={{width:44,height:44}}
                            >
                              <FontAwesomeIcon icon={faFlag} />
                            </BtnBlock>

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