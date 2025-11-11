// src/pages/dashboard/VideoChatRandomModelo.jsx
import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faStop, faUserPlus } from '@fortawesome/free-solid-svg-icons';
import {
  StyledCenterVideochat, StyledSplit2, StyledPane, StyledVideoArea,
  StyledChatContainer, StyledChatList, StyledChatMessageRow, StyledChatBubble,
  StyledGiftIcon, StyledThumbsGrid, StyledRemoteVideo, StyledVideoTitle,
  StyledTitleAvatar, StyledChatDock, StyledChatInput
} from '../../styles/pages-styles/VideochatStyles';
import {
  ButtonActivarCam, ButtonActivarCamMobile, ButtonStop, ButtonNext,
  ButtonAddFavorite, ButtonBuscar, ActionButton
} from '../../styles/ButtonStyles';

export default function VideoChatRandomModelo(props) {
  // Usa los props del padre
  const {
    cameraActive, handleActivateCamera, localVideoRef, vcListRef,
    messages, giftRenderReady, getGiftIcon, remoteStream,
    isMobile, remoteVideoWrapRef, stopAll, searching,
    handleNext, currentClientId, handleAddFavorite, clientAvatar,
    clientNickname, remoteVideoRef, toggleFullscreen, handleStartMatch,
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
              {/* ====== CONTROLES INFERIORES, CENTRADOS ====== */}
              {remoteStream ? (
                // En streaming: NO mostrar "Buscar"; solo Stop / Next / +Favorito
                <div style={{ position:'absolute', bottom:12, left:12, right:12, display:'flex', justifyContent:'center', alignItems:'center', gap:8, zIndex:5 }}>
                  <ButtonStop aria-label="Detener" onClick={stopAll} title="Detener">
                    <FontAwesomeIcon icon={faStop} />
                  </ButtonStop>
                  {!searching && (
                    <>
                      <ButtonNext onClick={handleNext}>Next</ButtonNext>
                      {currentClientId && (
                        <ButtonAddFavorite aria-label="Añadir a favoritos" onClick={handleAddFavorite} title="Añadir a favoritos">
                          <FontAwesomeIcon icon={faUserPlus} />
                        </ButtonAddFavorite>
                      )}
                    </>
                  )}
                </div>
              ) : (
                // Sin streaming: Mostrar Buscar / Stop abajo y centrados
                <div style={{ position:'absolute', bottom:12, left:12, right:12, display:'flex', justifyContent:'center', alignItems:'center', gap:8, zIndex:5 }}>
                  {!searching ? (
                    <ButtonBuscar onClick={handleStartMatch}>Buscar</ButtonBuscar>
                  ) : (
                    <span style={{ color:'#e9ecef' }}>Buscando...</span>
                  )}
                  <ButtonStop aria-label="Detener" onClick={stopAll} title="Detener">
                    <FontAwesomeIcon icon={faStop} />
                  </ButtonStop>
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
                  <div style={{ color:'#6c757d', textAlign:'center' }}>Pulsa “Buscar” para empezar.</div>
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
          <ActionButton type="button" onClick={sendChatMessage}>Enviar</ActionButton>
        </StyledChatDock>
      )}

      {error && <p style={{ color:'red', marginTop:'10px' }}>{error}</p>}
    </StyledCenterVideochat>
  );
};
