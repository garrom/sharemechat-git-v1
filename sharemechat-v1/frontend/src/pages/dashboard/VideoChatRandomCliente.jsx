import React, { useEffect, useRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUserPlus, faVideo, faPhoneSlash, faForward, faPaperPlane, faGift } from '@fortawesome/free-solid-svg-icons';
import {
  StyledCenterVideochat, StyledSplit2, StyledPane, StyledVideoArea,
  StyledChatContainer, StyledChatList, StyledChatMessageRow, StyledChatBubble,
  StyledChatDock, StyledChatInput,StyledLocalVideo,
  StyledGiftsPanel, StyledGiftGrid, StyledGiftIcon, StyledThumbsGrid,
  StyledRemoteVideo, StyledVideoTitle, StyledTitleAvatar,
  StyledPreCallCenter, StyledHelperLine, StyledRandomSearchControls,
  StyledRandomSearchCol, StyledSearchHint, StyledFloatingHangup
} from '../../styles/pages-styles/VideochatStyles';
import {
  ButtonActivarCam, ButtonActivarCamMobile, ButtonBuscar,
  ButtonNext, ButtonAddFavorite,
  ButtonRegalo, BtnSend, BtnHangup
} from '../../styles/ButtonStyles';

export default function VideoChatRandomCliente(props) {
  const {
    isMobile, cameraActive, remoteStream, localVideoRef, remoteVideoRef,
    vcListRef, messages, modelNickname, giftRenderReady, getGiftIcon,
    chatInput, setChatInput, sendChatMessage, showGifts, setShowGifts,
    gifts, sendGiftMatch, fmtEUR, searching, stopAll, handleStartMatch,
    handleNext, handleAddFavorite, error, toggleFullscreen, remoteVideoWrapRef,
    modelAvatar, handleActivateCamera
  } = props;

  return (
    <StyledCenterVideochat>
      <StyledSplit2>
        {/* ---- Pane IZQUIERDO (LOCAL) ---- */}
        <StyledPane data-side="left">
          {!isMobile && (
            !cameraActive ? (
              <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center' }}>
                <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:8 }}>
                  <ButtonActivarCam onClick={handleActivateCamera}>Activar cámara</ButtonActivarCam>
                  <StyledHelperLine style={{ color:'#fff', justifyContent:'center' }}>
                    <FontAwesomeIcon icon={faVideo} />
                    activar cámara para iniciar videochat
                  </StyledHelperLine>
                </div>
              </div>
            ) : (
              <StyledVideoArea>
                <div style={{ position:'relative', width:'100%', height:'100%', borderRadius:'12px', overflow:'hidden', background:'#000' }}>
                  <video
                    ref={localVideoRef}
                    muted
                    autoPlay
                    playsInline
                    style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }}
                  />
                  {!isMobile && remoteStream && (
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
                                    return src ? (<StyledGiftIcon src={src} alt="" />) : null;
                                  })()}
                                </StyledChatBubble>
                              ) : (
                                <StyledChatBubble $variant={variant}>
                                  {msg.text}
                                </StyledChatBubble>
                              )}
                            </StyledChatMessageRow>
                          );
                        })}
                      </StyledChatList>
                    </StyledChatContainer>
                  )}
                </div>
              </StyledVideoArea>
            )
          )}
        </StyledPane>


        {/* ---- PANE DERECHO (REMOTO + CTA CÁMARA / CONTROLES) ---- */}
        <StyledPane data-side="right" style={{ position:'relative' }}>
          {!cameraActive ? (
            <>
              <StyledThumbsGrid>
                <img className="thumb" src="https://picsum.photos/seed/a/300/400" alt="" />
                <img className="thumb" src="https://picsum.photos/seed/b/300/400" alt="" />
                <img className="thumb" src="https://picsum.photos/seed/c/300/400" alt="" />
                <img className="thumb" src="https://picsum.photos/seed/d/300/400" alt="" />
                <img className="thumb" src="https://picsum.photos/seed/e/300/400" alt="" />
                <img className="thumb" src="https://picsum.photos/seed/f/300/400" alt="" />
              </StyledThumbsGrid>

              {isMobile && (
                <StyledPreCallCenter style={{ position:'absolute', top:'70%', left:0, right:0, transform:'translateY(-50%)' }}>
                  <div>
                    <ButtonActivarCamMobile onClick={handleActivateCamera}>Activar cámara</ButtonActivarCamMobile>
                    <StyledHelperLine style={{ color:'#fff' }}>
                      <FontAwesomeIcon icon={faVideo} />
                      activar cámara para iniciar videochat
                    </StyledHelperLine>
                  </div>
                </StyledPreCallCenter>
              )}
            </>
          ) : (
            <>
              {/* ====== CONTROLES INFERIORES, CENTRADOS ====== */}
              {cameraActive && (remoteStream || searching) && (
                <div style={{ position:'absolute', bottom:12, left:12, right:12, display:'flex', justifyContent:'center', alignItems:'center', gap:8, zIndex:5 }}>
                  {!isMobile && (
                    <BtnHangup
                      onClick={stopAll}
                      title="Colgar"
                      aria-label="Colgar"
                      style={{ width:44, height:44, borderRadius:'999px', display:'flex', alignItems:'center', justifyContent:'center', padding:0, background:'#dc3545', color:'#fff', border:'1px solid rgba(255,255,255,0.4)' }}
                      onMouseEnter={e => { e.currentTarget.style.background='#fff'; e.currentTarget.style.color='#dc3545'; }}
                      onMouseLeave={e => { e.currentTarget.style.background='#dc3545'; e.currentTarget.style.color='#fff'; }}
                    >
                      <FontAwesomeIcon icon={faPhoneSlash} />
                    </BtnHangup>
                  )}

                  {remoteStream && (
                    <>
                      <ButtonNext
                        onClick={handleNext}
                        style={{ width:44, height:44, borderRadius:'999px', display:'flex', alignItems:'center', justifyContent:'center', padding:0, background:'#fff', color:'#000', border:'1px solid rgba(255,255,255,0.4)' }}
                        onMouseEnter={e => { e.currentTarget.style.background='#000'; e.currentTarget.style.color='#fff'; }}
                        onMouseLeave={e => { e.currentTarget.style.background='#fff'; e.currentTarget.style.color='#000'; }}
                      >
                        <FontAwesomeIcon icon={faForward} />
                      </ButtonNext>

                      <ButtonAddFavorite
                        aria-label="Añadir a favoritos"
                        onClick={handleAddFavorite}
                        title="Añadir a favoritos"
                        style={{ width:44, height:44, borderRadius:'999px', display:'flex', alignItems:'center', justifyContent:'center', padding:0, background:'#fff', color:'#000', border:'1px solid rgba(255,255,255,0.4)' }}
                        onMouseEnter={e => { e.currentTarget.style.background='#000'; e.currentTarget.style.color='#fff'; }}
                        onMouseLeave={e => { e.currentTarget.style.background='#fff'; e.currentTarget.style.color='#000'; }}
                      >
                        <FontAwesomeIcon icon={faUserPlus} />
                      </ButtonAddFavorite>
                    </>
                  )}
                </div>
              )}

              {!remoteStream && (
                // Sin streaming: solo botón Buscar centrado a media altura
                <StyledRandomSearchControls>
                  <StyledRandomSearchCol>
                    {!searching ? (
                      <>
                        <ButtonBuscar onClick={handleStartMatch}>Buscar</ButtonBuscar>
                        <StyledSearchHint>Pulsa “Buscar” para empezar.</StyledSearchHint>
                      </>
                    ) : (
                      <StyledSearchHint>Buscando...</StyledSearchHint>
                    )}
                  </StyledRandomSearchCol>
                </StyledRandomSearchControls>
              )}

              {remoteStream ? (
                <StyledVideoArea>
                  <StyledRemoteVideo
                    ref={remoteVideoWrapRef}
                    style={{ position:'relative', width:'100%', height:'100%', borderRadius:'12px', overflow:'hidden', background:'#000' }}
                  >
                    <StyledVideoTitle>
                      <StyledTitleAvatar src={modelAvatar || '/img/avatarChica.png'} alt="" />
                      {modelNickname || 'Modelo'}
                      <button
                        type="button"
                        onClick={() => toggleFullscreen(remoteVideoWrapRef.current)}
                        title="Pantalla completa"
                        style={{ marginLeft:8, padding:'2px 8px', borderRadius:6, border:'1px solid rgba(255,255,255,.6)', background:'rgba(0,0,0,.25)', color:'#fff', cursor:'pointer' }}
                      >
                        Pantalla completa
                      </button>
                    </StyledVideoTitle>

                    <video
                      ref={remoteVideoRef}
                      style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }}
                      autoPlay
                      playsInline
                      onDoubleClick={() => toggleFullscreen(remoteVideoWrapRef.current)}
                    />

                    {isMobile && (
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
                                      return src ? (<StyledGiftIcon src={src} alt="" />) : null;
                                    })()}
                                  </StyledChatBubble>
                                ) : (
                                  <StyledChatBubble $variant={variant}>
                                    {msg.text}
                                  </StyledChatBubble>
                                )}
                              </StyledChatMessageRow>
                            );
                          })}
                        </StyledChatList>
                      </StyledChatContainer>
                    )}
                  </StyledRemoteVideo>
                </StyledVideoArea>
              ) : null}

              {/* PiP móvil: cámara local SIEMPRE que haya cámara activa, haya o no remoto */}
              {isMobile && cameraActive && (
                <StyledLocalVideo>
                  <video
                    ref={localVideoRef}
                    muted
                    autoPlay
                    playsInline
                    style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }}
                  />
                </StyledLocalVideo>
              )}
              {isMobile && cameraActive && (
                <div style={{position:'absolute',left:0,right:0,bottom:'72px',zIndex:8,display:'flex',justifyContent:'center',alignItems:'center',gap:'12px'}}>
                  <BtnHangup onClick={stopAll} title="Colgar" aria-label="Colgar">
                    <FontAwesomeIcon icon={faPhoneSlash}/>
                  </BtnHangup>
                  {remoteStream && (
                    <>
                      <ButtonNext
                        onClick={handleNext}
                        style={{width:44,height:44,borderRadius:'999px',padding:0,display:'flex',alignItems:'center',justifyContent:'center',background:'#fff',color:'#000',border:'1px solid rgba(255,255,255,0.4)'}}
                      >
                        <FontAwesomeIcon icon={faForward}/>
                      </ButtonNext>
                      <ButtonAddFavorite
                        onClick={handleAddFavorite}
                        style={{width:44,height:44,borderRadius:'999px',padding:0,display:'flex',alignItems:'center',justifyContent:'center',background:'#fff',color:'#000',border:'1px solid rgba(255,255,255,0.4)'}}
                      >
                        <FontAwesomeIcon icon={faUserPlus}/>
                      </ButtonAddFavorite>
                    </>
                  )}
                </div>
              )}

            </>
          )}
        </StyledPane>
      </StyledSplit2>

      {remoteStream && (
        <StyledChatDock>
          <StyledChatInput
            type="text"
            value={chatInput}
            onChange={e => setChatInput(e.target.value)}
            placeholder="Escribe un mensaje…"
            autoComplete="off"
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChatMessage(); } }}
          />
          <BtnSend
            type="button"
            onClick={sendChatMessage}
            aria-label="Enviar mensaje"
          >
            <FontAwesomeIcon icon={faPaperPlane} />
          </BtnSend>
          <ButtonRegalo
            type="button"
            onClick={() => setShowGifts(s => !s)}
            title="Enviar regalo"
            aria-label="Enviar regalo"
          >
            <FontAwesomeIcon icon={faGift} />
          </ButtonRegalo>
          {showGifts && (
            <StyledGiftsPanel>
              <StyledGiftGrid>
                {gifts.map(g => (
                  <button key={g.id} onClick={() => sendGiftMatch(g.id)}>
                    <img src={g.icon} alt={g.name} />
                    <div>{g.name}</div>
                    <div>{fmtEUR(g.cost)}</div>
                  </button>
                ))}
              </StyledGiftGrid>
            </StyledGiftsPanel>
          )}
        </StyledChatDock>
      )}

      {error && <p style={{ color:'red', marginTop:'10px' }}>{error}</p>}
    </StyledCenterVideochat>
  );
}
