import React from 'react';
import {
  StyledCenterVideochat, StyledSplit2, StyledPane, StyledVideoArea,
  StyledChatContainer, StyledChatList, StyledChatMessageRow, StyledChatBubble,
  StyledChatDock, StyledChatInput, StyledActionButton, StyledGiftToggle,
  StyledGiftsPanel, StyledGiftGrid, StyledGiftIcon, StyledThumbsGrid,
  StyledRemoteVideo, StyledVideoTitle, StyledTitleAvatar
} from '../../styles/pages-styles/ClientStyles';
import {
  ButtonActivarCam, ButtonActivarCamMobile, ButtonBuscarModelo, ButtonStop,
  ButtonNext, ButtonAddFavorite
} from '../../styles/ButtonStyles';

export default function VideoChatRandomCliente(props) {
  // Usa los props del padre
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
        {/* ---- Pane IZQUIERDO (CTA / PREVIEW LOCAL) ---- */}
        <StyledPane data-side="left">
          {!cameraActive ? (
            <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <ButtonActivarCam onClick={handleActivateCamera}>Activar cámara</ButtonActivarCam>
            </div>
          ) : (
            <>
              <StyledVideoArea>
                <div style={{ position:'relative', width:'100%', height:'100%', borderRadius:'12px', overflow:'hidden', background:'#000' }}>
                  <video ref={localVideoRef} muted autoPlay playsInline style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }} />
                  {remoteStream && (
                    <StyledChatContainer data-wide="true">
                      <StyledChatList ref={vcListRef}>
                        {messages.map((msg, index) => {
                          const isMe = msg.from === 'me';
                          const variant = isMe ? 'me' : 'peer';
                          const prefix = isMe ? 'me' : (modelNickname || 'Modelo');
                          return (
                            <StyledChatMessageRow key={index}>
                              {msg.gift ? (
                                <StyledChatBubble $variant={variant}>
                                  <strong>{prefix} :</strong>{' '}
                                  {giftRenderReady && (() => {
                                    const src = getGiftIcon(msg.gift);
                                    return src ? (<StyledGiftIcon src={src} alt="" />) : null;
                                  })()}
                                </StyledChatBubble>
                              ) : (
                                <StyledChatBubble $variant={variant}>
                                  <strong>{prefix} :</strong> {msg.text}
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
            </>
          )}
        </StyledPane>

        {/* ---- PANE DERECHO (REMOTO + PIP + OVERLAY + DOCK) ---- */}
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
                <div style={{ position:'absolute', bottom:12, left:12, right:12, zIndex:5, display:'flex', justifyContent:'center' }}>
                  <ButtonActivarCamMobile onClick={handleActivateCamera}>Activar cámara</ButtonActivarCamMobile>
                </div>
              )}
            </>
          ) : (
            <>
              <div style={{ position:'absolute', top:12, left:12, right:12, display:'flex', gap:8, alignItems:'center', flexWrap:'wrap', zIndex:3 }}>
                {!searching && <ButtonBuscarModelo onClick={handleStartMatch}>Buscar Modelo</ButtonBuscarModelo>}
                {searching && <p style={{ margin:0 }}>Buscando modelo...</p>}
                <ButtonStop onClick={stopAll}>Stop</ButtonStop>
                {remoteStream && !searching && (
                  <>
                    <ButtonNext onClick={handleNext}>Next</ButtonNext>
                    <ButtonAddFavorite onClick={handleAddFavorite}>+ Favorito</ButtonAddFavorite>
                  </>
                )}
              </div>

              {remoteStream ? (
                <>
                  <StyledVideoArea>
                    <StyledRemoteVideo ref={remoteVideoWrapRef} style={{ position:'relative', width:'100%', height:'100%', borderRadius:'12px', overflow:'hidden', background:'#000' }}>
                      <StyledVideoTitle>
                        <StyledTitleAvatar src={modelAvatar || '/img/avatarChica.png'} alt="" />
                        {modelNickname || 'Modelo'}
                        <button type="button" onClick={() => toggleFullscreen(remoteVideoWrapRef.current)} title="Pantalla completa" style={{ marginLeft:8, padding:'2px 8px', borderRadius:6, border:'1px solid rgba(255,255,255,.6)', background:'rgba(0,0,0,.25)', color:'#fff', cursor:'pointer' }}>Pantalla completa</button>
                      </StyledVideoTitle>
                      <video ref={remoteVideoRef} style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }} autoPlay playsInline onDoubleClick={() => toggleFullscreen(remoteVideoWrapRef.current)} />
                    </StyledRemoteVideo>
                  </StyledVideoArea>
                </>
              ) : (
                <div style={{ color:'#6c757d' }}>Pulsa “Buscar Modelo” para empezar.</div>
              )}
            </>
          )}
        </StyledPane>
      </StyledSplit2>

      {remoteStream && (
        <StyledChatDock>
          <StyledChatInput type="text" value={chatInput} onChange={e => setChatInput(e.target.value)} placeholder="Escribe un mensaje…" autoComplete="off" onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChatMessage(); } }} />
          <StyledActionButton type="button" onClick={sendChatMessage}>Enviar</StyledActionButton>
          <StyledGiftToggle type="button" onClick={() => setShowGifts(s => !s)} title="Enviar regalo">Gift</StyledGiftToggle>
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



