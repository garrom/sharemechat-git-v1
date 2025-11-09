// src/pages/dashboard/VideoChatRandomModelo.jsx
import React from 'react';
import {
  StyledCenterVideochat, StyledSplit2, StyledPane, StyledVideoArea,
  StyledChatContainer, StyledChatList, StyledChatMessageRow, StyledChatBubble,
  StyledGiftIcon, StyledThumbsGrid, StyledRemoteVideo, StyledVideoTitle,
  StyledTitleAvatar, StyledChatDock, StyledChatInput, StyledActionButton
} from '../../styles/pages-styles/ModelStyles';
import {
  ButtonActivarCam, ButtonActivarCamMobile, ButtonStop, ButtonNext,
  ButtonAddFavorite, ButtonBuscarCliente
} from '../../styles/ButtonStyles';


export default function VideoChatRandomModelo(props) {
    // Usa los props del padre
  const {
      cameraActive, handleActivateCamera,localVideoRef, vcListRef,
      messages, giftRenderReady, getGiftIcon, remoteStream,
      isMobile,remoteVideoWrapRef, stopAll,searching,
      handleNext, currentClientId,handleAddFavorite,clientAvatar,
      clientNickname,remoteVideoRef,toggleFullscreen,handleStartMatch,
      chatInput, setChatInput, sendChatMessage, error
  } = props;

  return (
    <StyledCenterVideochat>
      <StyledSplit2>

        {/* ================== PANE IZQUIERDO ================== */}
        <StyledPane data-side="left">
          {!cameraActive ? (
            <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <ButtonActivarCam onClick={handleActivateCamera}>Activar cámara</ButtonActivarCam>
            </div>
          ) : (
            <StyledVideoArea>
              {/* Video Local SIEMPRE aquí (izquierda) */}
              <div style={{ position:'relative', width:'100%', height:'100%' }}>
                <video
                  ref={localVideoRef}
                  muted
                  autoPlay
                  playsInline
                  style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }}
                />
                {!isMobile && (
                  <>
                    {/* Overlay de mensajes SOBRE la cámara local */}
                    <StyledChatContainer data-wide="true">
                      <StyledChatList ref={vcListRef}>
                        {messages.map((msg, index) => {
                          const isMe = msg.from === 'me';
                          const variant = isMe ? 'peer' : 'me';
                          const prefix = isMe ? 'me' : (clientNickname || 'Cliente');
                          return (
                            <StyledChatMessageRow key={index}>
                              {msg.gift ? (
                                <StyledChatBubble $variant={variant}>
                                  <strong>{prefix} :</strong>{' '}
                                  {giftRenderReady && (() => { const src = getGiftIcon(msg.gift); return src ? (<StyledGiftIcon src={src} alt="" />) : (<span>{msg.gift.name || '🎁'}</span>); })()}
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
                  </>
                )}

              </div>
            </StyledVideoArea>
          )}
        </StyledPane>

        {/* ========= PANE DERECHO (REMOTO + CTA) ========= */}
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

              {/* CTA flotante SOLO MÓVIL cuando NO hay cámara */}
              {isMobile && (
                <div style={{ position:'absolute', bottom:12, left:12, right:12, zIndex:5, display:'flex', justifyContent:'center' }}>
                  <ButtonActivarCamMobile onClick={handleActivateCamera}>Activar cámara</ButtonActivarCamMobile>
                </div>
              )}
            </>
          ) : (
            <>
              {/* Controles superiores (anclados al Pane) - SOLO con remoto */}
              {remoteStream && (
                <div style={{ position:'absolute', top:12, left:12, right:12, display:'flex', gap:8, alignItems:'center', flexWrap:'wrap', zIndex:5 }}>
                  <ButtonStop onClick={stopAll}>Stop</ButtonStop>
                  {!searching && (
                    <>
                      <ButtonNext onClick={handleNext}>Next</ButtonNext>
                      {currentClientId && <ButtonAddFavorite onClick={handleAddFavorite}>+ Favorito</ButtonAddFavorite>}
                    </>
                  )}
                </div>
              )}

              {remoteStream ? (
                <StyledVideoArea>
                  <StyledRemoteVideo ref={remoteVideoWrapRef}>
                    <StyledVideoTitle>
                      <StyledTitleAvatar src={clientAvatar || '/img/avatarChico.png'} alt="" />
                      {clientNickname}
                      <button
                        type="button"
                        onClick={() => toggleFullscreen(remoteVideoWrapRef.current)}
                        title="Pantalla completa"
                        style={{ marginLeft:8, padding:'2px 8px', borderRadius:6, border:'1px solid rgba(255,255,255,.6)', background:'rgba(0,0,0,.25)', color:'#fff', cursor:'pointer' }}
                      >⤢</button>
                    </StyledVideoTitle>
                    <video
                      ref={remoteVideoRef}
                      style={{ width:'100%', height:'100%', objectFit:'cover' }}
                      autoPlay
                      playsInline
                      onDoubleClick={() => toggleFullscreen(remoteVideoWrapRef.current)}
                    />

                    {isMobile && (
                      <StyledChatContainer data-wide="true">
                        <StyledChatList ref={vcListRef}>
                          {messages.map((msg, index) => {
                            const isMe = msg.from === 'me';
                            const variant = isMe ? 'peer' : 'me';
                            const prefix = isMe ? 'me' : (clientNickname || 'Cliente');
                            return (
                              <StyledChatMessageRow key={index}>
                                {msg.gift ? (
                                  <StyledChatBubble $variant={variant}>
                                    <strong>{prefix} :</strong>{' '}
                                    {giftRenderReady && (() => { const src = getGiftIcon(msg.gift); return src ? (<StyledGiftIcon src={src} alt="" />) : (<span>{msg.gift.name || '🎁'}</span>); })()}
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

                  </StyledRemoteVideo>
                </StyledVideoArea>
              ) : (
                <>
                  {/* Controles centrados (sin remoto) */}
                  <div style={{ display:'flex', justifyContent:'center', gap:8, alignItems:'center', marginBottom:12 }}>
                    {!searching ? (
                      <ButtonBuscarCliente onClick={handleStartMatch}>Buscar Cliente</ButtonBuscarCliente>
                    ) : (
                      <p style={{ margin:0 }}>Buscando cliente...</p>
                    )}
                    <ButtonStop onClick={stopAll}>Stop</ButtonStop>
                  </div>
                  <div style={{ color:'#6c757d', textAlign:'center' }}>Pulsa “Buscar Cliente” para empezar.</div>
                </>
              )}
            </>
          )}
        </StyledPane>

      </StyledSplit2>

      {/* Dock de entrada (debajo de ambas columnas, solo con remoto) */}
      {remoteStream && (
        <StyledChatDock>
          <StyledChatInput
            type="text"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            placeholder="Escribe un mensaje…"
            autoComplete="off"
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChatMessage(); } }}
          />
          <StyledActionButton type="button" onClick={sendChatMessage}>Enviar</StyledActionButton>
        </StyledChatDock>
      )}

      {error && <p style={{ color:'red', marginTop:'10px' }}>{error}</p>}
    </StyledCenterVideochat>
  );
};


