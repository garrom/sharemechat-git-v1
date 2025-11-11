// src/pages/dashboard/VideoChatFavoritosModelo.jsx
import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowLeft,faPhone, faPhoneSlash } from '@fortawesome/free-solid-svg-icons';
import FavoritesModelList from '../favorites/FavoritesModelList';
import {
  StyledFavoritesShell, StyledFavoritesColumns, StyledCenterPanel, StyledCenterBody, StyledChatScroller,
  StyledVideoArea, StyledRemoteVideo, StyledVideoTitle, StyledTitleAvatar, StyledLocalVideo,
  StyledChatContainer, StyledChatList, StyledChatMessageRow, StyledChatBubble, StyledChatDock, StyledChatInput
} from '../../styles/pages-styles/VideochatStyles';

import {
  ButtonEnviar, ButtonLlamar, ButtonActivarCam, ButtonActivarCamMobile,
  ButtonAceptar, ButtonRechazar, ButtonColgar, ButtonVolver,ActionButton
} from '../../styles/ButtonStyles';

export default function VideoChatFavoritosModelo(props) {
  const {
    // flags
    isMobile, allowChat, isPendingPanel, isSentPanel, contactMode, openChatWith,
    // nombres/ids
    centerChatPeerName, callPeerName, callPeerId, callPeerAvatar,
    // estados llamada/chat
    callError, callStatus, callCameraActive, centerMessages, centerInput,
    // refs
    callRemoteWrapRef, callRemoteVideoRef, callListRef, modelCenterListRef, callLocalVideoRef,
    // handlers de chat central
    setContactMode, enterCallMode, sendCenterMessage, setCenterInput,
    acceptInvitation, rejectInvitation,
    // handlers de llamada
    handleCallActivateCamera, handleCallInvite, handleCallEnd, toggleFullscreen,
    // data para regalos/yo
    user, gifts, giftRenderReady,
    // móvil: lista favoritos
    handleOpenChatFromFavorites, favReload, selectedContactId, setCtxUser, setCtxPos,
    // móvil: volver atrás
    setTargetPeerId, setTargetPeerName, setSelectedFav
  } = props;

  {/* === FICHERO SOLO DE FAVORITOS === */}
  return (
    <>
      {/* === Desktop Favoritos ALL === */}
      {!isMobile && (
        <StyledFavoritesShell>
          <StyledFavoritesColumns>
            <StyledCenterPanel>
              {!openChatWith ? (
                <div style={{ color:'#adb5bd' }}>Selecciona un favorito y pulsa <em>Chatear</em> para abrir la conversación aquí.</div>
              ) : (
                <>
                  {/* Header con acciones */}
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:8 }}>
                    <h5 style={{ margin:0, color: allowChat ? '#20c997' : (isPendingPanel || isSentPanel ? '#ffc107' : '#ff0000') }}>
                      {isPendingPanel ? `Invitación de ${centerChatPeerName}` : isSentPanel ? `Invitación enviada a ${centerChatPeerName}` : `Contacto: ${centerChatPeerName}`}
                    </h5>
                    <div style={{ display:'flex', gap:8 }}>
                      <ButtonLlamar onClick={enterCallMode} disabled={!openChatWith || !allowChat} title="Llamar" aria-label="Llamar">
                        <FontAwesomeIcon icon={faPhone} />
                      </ButtonLlamar>
                    </div>
                  </div>

                  {/* Cuerpo + dock */}
                  <StyledCenterBody>
                    {/* Pendiente / Enviada */}
                    {isPendingPanel && (
                      <div style={{ flex:1, minHeight:0, display:'flex', alignItems:'center', justifyContent:'center', border:'1px solid #333', borderRadius:8, padding:16, background:'rgba(0,0,0,0.2)' }}>
                        <div style={{ textAlign:'center', maxWidth:520 }}>
                          <p style={{ color:'#e9ecef', marginBottom:16 }}><strong>{centerChatPeerName}</strong> te ha invitado a ser favoritos mutuos. Acepta para habilitar el chat.</p>
                          <div style={{ display:'flex', gap:12, justifyContent:'center' }}>
                            <ButtonAceptar onClick={acceptInvitation} title="Aceptar invitación">Aceptar</ButtonAceptar>
                            <ButtonRechazar onClick={rejectInvitation} title="Rechazar invitación">Rechazar</ButtonRechazar>
                          </div>
                        </div>
                      </div>
                    )}

                    {isSentPanel && (
                      <div style={{ flex:1, minHeight:0, display:'flex', alignItems:'center', justifyContent:'center', border:'1px solid #333', borderRadius:8, padding:16, background:'rgba(0,0,0,0.2)' }}>
                        <div style={{ textAlign:'center', maxWidth:520, color:'#e9ecef' }}>
                          <p style={{ marginBottom:8 }}>Invitación enviada. Esperando respuesta de <strong>{centerChatPeerName}</strong>.</p>
                          <p style={{ fontSize:12, color:'#adb5bd' }}>El chat se habilitará cuando acepte tu invitación.</p>
                        </div>
                      </div>
                    )}

                    {/* Desktop Favoritos Calling */}
                    {!isPendingPanel && !isSentPanel && contactMode === 'call' && (
                      <>
                        {callError && <p style={{ color:'orange', marginTop:6 }}>[CALL] {callError}</p>}
                        <div style={{ color:'#9bd' }}>Estado: <strong>{callStatus}</strong>{callPeerName ? ` | Con: ${callPeerName} (#${callPeerId || ''})` : ''}</div>

                        <div style={{ display:'flex', gap:8 }}>
                          {!callCameraActive && (
                            <ButtonActivarCam onClick={handleCallActivateCamera} disabled={false} title="Activa tu cámara">Activar Cámara para Llamar</ButtonActivarCam>
                          )}
                          {callCameraActive && callStatus !== 'in-call' && callStatus !== 'ringing' && (
                            <ButtonLlamar
                              onClick={handleCallInvite}
                              disabled={!callPeerId}
                              title={callPeerId ? `Llamar a ${callPeerName || callPeerId}` : 'Selecciona un contacto'}
                              aria-label="Llamar"
                            >
                              <FontAwesomeIcon icon={faPhone} />
                            </ButtonLlamar>
                          )}
                          {(callStatus === 'ringing' || callStatus === 'in-call' || callStatus === 'connecting') && (
                            <ButtonColgar onClick={() => handleCallEnd(false)} title="Colgar" aria-label="Colgar">
                              <FontAwesomeIcon icon={faPhoneSlash} />
                            </ButtonColgar>
                          )}
                        </div>

                        {/* Desktop Favoritos Chat in calling */}
                        <StyledVideoArea style={{ display:(callStatus === 'in-call') ? 'block' : 'none' }}>
                          <StyledRemoteVideo ref={callRemoteWrapRef}>
                            <StyledVideoTitle>
                              <StyledTitleAvatar src={callPeerAvatar || '/img/avatarChico.png'} alt="" />
                              {callPeerName || 'Remoto'}
                              <button type="button" onClick={() => toggleFullscreen(callRemoteWrapRef.current)} title="Pantalla completa" style={{ marginLeft:8, padding:'2px 8px', borderRadius:6, border:'1px solid rgba(255,255,255,.6)', background:'rgba(0,0,0,0.25)', color:'#fff', cursor:'pointer' }}>⤢</button>
                            </StyledVideoTitle>
                            <video ref={callRemoteVideoRef} style={{ width:'100%', height:'100%', objectFit:'cover' }} autoPlay playsInline onDoubleClick={() => toggleFullscreen(callRemoteWrapRef.current)} />
                          </StyledRemoteVideo>

                          <StyledLocalVideo>
                            <h5 style={{ color:'white', margin:0, fontSize:12 }}>Tu Cámara</h5>
                            <video ref={callLocalVideoRef} style={{ width:'100%', display:'block', border:'1px solid rgba(255,255,255,0.25)' }} muted autoPlay playsInline />
                          </StyledLocalVideo>

                          {/* Desktop Favoritos Chat in calling  */}
                          <StyledChatContainer data-wide="true">
                            <StyledChatList ref={callListRef}>
                              {centerMessages.map((m) => {
                                let giftData = m.gift;
                                if (!giftData && typeof m.body === 'string' && m.body.startsWith('[[GIFT:') && m.body.endsWith(']]')) { try { const parts = m.body.slice(2,-2).split(':'); giftData = { id:Number(parts[1]), name:parts.slice(2).join(':') }; } catch {} }
                                const isMe = Number(m.senderId) === Number(user?.id);
                                const variant = isMe ? 'peer' : 'me'; // modelo=rosa, cliente=azul
                                const prefix = isMe ? 'me' : (callPeerName || `Usuario ${callPeerId || ''}`);
                                return (
                                  <StyledChatMessageRow key={m.id}>
                                    <StyledChatBubble $variant={variant}>
                                      <strong>{prefix} :</strong>{' '}
                                      {giftData ? (giftRenderReady && (() => { const src = (gifts.find(gg => Number(gg.id) === Number(giftData.id))?.icon) || null; return src ? <img src={src} alt="" style={{ width:24, height:24, verticalAlign:'middle' }} /> : null; })()) : m.body}
                                    </StyledChatBubble>
                                  </StyledChatMessageRow>
                                );
                              })}
                            </StyledChatList>
                          </StyledChatContainer>
                        </StyledVideoArea>

                        <StyledChatDock style={{ display:(callStatus === 'in-call') ? 'flex' : 'none' }}>
                          <StyledChatInput value={centerInput} onChange={(e)=>setCenterInput(e.target.value)} placeholder="Escribe un mensaje…" onKeyDown={(e)=>{ if (e.key === 'Enter') sendCenterMessage(); }} />
                          <ActionButton type="button" onClick={sendCenterMessage}>Enviar</ActionButton>
                        </StyledChatDock>

                        {callStatus === 'incoming' && (
                          <div style={{ marginTop:12, padding:12, border:'1px solid #333', borderRadius:8, background:'rgba(0,0,0,0.35)' }}>
                            <div style={{ color:'#fff', marginBottom:8 }}>Te está llamando <strong>{callPeerName || `Usuario ${callPeerId}`}</strong>.</div>
                            <div style={{ display:'flex', gap:10 }}>
                              <ButtonAceptar onClick={props.handleCallAccept}>Aceptar</ButtonAceptar>
                              <ButtonRechazar onClick={props.handleCallReject}>Rechazar</ButtonRechazar>
                            </div>
                          </div>
                        )}
                        {callStatus === 'ringing' && <div style={{ marginTop:12, color:'#fff' }}>Llamando a {callPeerName || `Usuario ${callPeerId}`}… (sonando)</div>}
                      </>
                    )}

                    {/* Desktop Favoritos chat */}
                    {!isPendingPanel && !isSentPanel && contactMode !== 'call' && (
                      <>
                        <StyledChatScroller ref={modelCenterListRef}>
                          {centerMessages.length === 0 && <div style={{ color:'#adb5bd' }}>{allowChat ? 'No hay mensajes todavía. ¡Escribe el primero!' : 'Este chat no está activo.'}</div>}
                          {centerMessages.map(m => {
                            let giftData = m.gift;
                            if (!giftData && typeof m.body === 'string' && m.body.startsWith('[[GIFT:') && m.body.endsWith(']]')) { try { const parts = m.body.slice(2,-2).split(':'); giftData = { id:Number(parts[1]), name:parts.slice(2).join(':') }; } catch {} }
                            const isMe = Number(m.senderId) === Number(user?.id);
                            const variant = isMe ? 'me' : 'peer';
                            const prefix = isMe ? 'me' : (centerChatPeerName || `Usuario ${openChatWith || ''}`);
                            return (
                              <StyledChatMessageRow key={m.id}>
                                <StyledChatBubble $variant={variant}>
                                  {giftData ? (<><strong>{prefix} :</strong>{' '}{giftRenderReady && (() => { const src = (gifts.find(gg => Number(gg.id) === Number(giftData.id))?.icon) || null; return src ? <img src={src} alt="" style={{ width:24, height:24, verticalAlign:'middle' }} /> : null; })()}</>) : (<><strong>{prefix} :</strong> {m.body}</>)}
                                </StyledChatBubble>
                              </StyledChatMessageRow>
                            );
                          })}
                        </StyledChatScroller>

                        <div style={{ display:'flex', gap:8, marginTop:10 }}>
                          <input value={centerInput} onChange={(e)=>setCenterInput(e.target.value)} placeholder={allowChat ? 'Escribe un mensaje…' : 'Chat inactivo'} onKeyDown={(e)=>{ if (e.key === 'Enter' && allowChat) sendCenterMessage(); }} disabled={!allowChat} style={{ flex:1, borderRadius:6, border:'1px solid #333', padding:'8px', background:'rgba(255,255,255,0.9)' }} />
                          <ButtonEnviar onClick={sendCenterMessage} disabled={!allowChat}>Enviar</ButtonEnviar>
                        </div>
                      </>
                    )}
                  </StyledCenterBody>
                </>
              )}
            </StyledCenterPanel>
          </StyledFavoritesColumns>
        </StyledFavoritesShell>
      )}

      {/* Movil Favoritos ALL  */}
      {isMobile && (
        <>
          {!openChatWith && (
            <div style={{ display:'flex', flexDirection:'column', flex:1, minHeight:0 }}>
              <div style={{ flex:1, minHeight:0, overflowY:'auto' }}>
                <FavoritesModelList
                  onSelect={handleOpenChatFromFavorites}
                  reloadTrigger={favReload}
                  selectedId={selectedContactId}
                  onContextMenu={(user, pos) => { setCtxUser(user); setCtxPos(pos); }}
                />
              </div>
            </div>
          )}

          {openChatWith && (
            <div style={{ display:'flex', flexDirection:'column', flex:1, minHeight:0 }}>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
                <ButtonVolver
                  type="button"
                  onClick={() => { setTargetPeerId(null); setTargetPeerName(''); setSelectedFav(null); setContactMode('chat'); }}
                  aria-label="Volver a la lista"
                  title="Volver"
                >
                  <FontAwesomeIcon icon={faArrowLeft} />
                </ButtonVolver>
                <h5 style={{ margin:0, color: allowChat ? '#20c997' : (isPendingPanel || isSentPanel ? '#ffc107' : '#ff0000') }}>
                  {isPendingPanel ? `Invitación de ${centerChatPeerName}` : isSentPanel ? `Invitación enviada a ${centerChatPeerName}` : `Contacto: ${centerChatPeerName}`}
                </h5>
              </div>

              {/*  Movil Favoritos Calling */}
              {!isPendingPanel && !isSentPanel && (
                <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:8 }}>
                  {contactMode !== 'call' && allowChat &&
                      <ButtonLlamar onClick={enterCallMode} title="Llamar">Iniciar VideoChat</ButtonLlamar>}
                  {contactMode === 'call' && (
                    <>
                      {!callCameraActive && (
                        <ButtonActivarCamMobile onClick={handleCallActivateCamera} title="Activa tu cámara">Activar cámara</ButtonActivarCamMobile>
                      )}
                      {callCameraActive && (callStatus !== 'in-call' && callStatus !== 'ringing' && callStatus !== 'connecting') && (
                        <ButtonLlamar onClick={handleCallInvite} disabled={!callPeerId} title={callPeerId ? `Llamar a ${callPeerName || callPeerId}` : 'Selecciona un contacto para llamar'}>
                          {callPeerId ? `Llamar a ${callPeerName || callPeerId}` : 'Llamar'}
                        </ButtonLlamar>
                      )}
                      {(callStatus === 'ringing' || callStatus === 'connecting' || callStatus === 'in-call') &&
                        <ButtonColgar onClick={() => handleCallEnd(false)} title="Colgar" aria-label="Colgar">
                          <FontAwesomeIcon icon={faPhoneSlash} />
                        </ButtonColgar>
                      }
                      {callStatus === 'incoming' && (<><ButtonAceptar onClick={props.handleCallAccept}>Aceptar</ButtonAceptar><ButtonRechazar onClick={props.handleCallReject}>Rechazar</ButtonRechazar></>)}
                    </>
                  )}
                </div>
              )}

              {/* Área de videollamada móvil */}
              {contactMode === 'call' && (
                <>
                  {callError && <p style={{ color:'orange', marginTop:6 }}>[CALL] {callError}</p>}
                  <div style={{ color:'#9bd', marginBottom:8 }}>Estado: <strong>{callStatus}</strong>{callPeerName ? ` | Con: ${callPeerName} (#${callPeerId || ''})` : ''}</div>
                  <StyledVideoArea style={{ flex:1, minHeight:0 }}>
                    <StyledRemoteVideo ref={callRemoteWrapRef}>
                      <StyledVideoTitle>
                        <StyledTitleAvatar src={callPeerAvatar || '/img/avatarChico.png'} alt="" />
                        {callPeerName || 'Remoto'}
                        <button type="button" onClick={() => toggleFullscreen(callRemoteWrapRef.current)} title="Pantalla completa" style={{ marginLeft:8, padding:'2px 8px', borderRadius:6, border:'1px solid rgba(255,255,255,.6)', background:'rgba(0,0,0,0.25)', color:'#fff', cursor:'pointer' }}>⤢</button>
                      </StyledVideoTitle>
                      <video ref={callRemoteVideoRef} style={{ width:'100%', height:'100%', objectFit:'cover', display:(callStatus === 'in-call') ? 'block' : 'none' }} autoPlay playsInline onDoubleClick={() => toggleFullscreen(callRemoteWrapRef.current)} />
                      {callStatus !== 'in-call' && (
                        <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', color:'#dee2e6', background:'rgba(0,0,0,0.2)' }}>
                          {callCameraActive ? 'Conectando…' : 'Activa tu cámara para iniciar la llamada'}
                        </div>
                      )}
                    </StyledRemoteVideo>

                    <StyledLocalVideo>
                      <h5 style={{ color:'#fff', margin:0, fontSize:12 }}>Tu Cámara</h5>
                      <video ref={callLocalVideoRef} style={{ width:'100%', display:'block', border:'1px solid rgba(255,255,255,0.25)' }} muted autoPlay playsInline />
                    </StyledLocalVideo>

                    <StyledChatContainer data-wide="true">
                      <StyledChatList ref={callListRef}>
                        {centerMessages.map((m) => {
                          let giftData = m.gift;
                          if (!giftData && typeof m.body === 'string' && m.body.startsWith('[[GIFT:') && m.body.endsWith(']]')) { try { const parts = m.body.slice(2,-2).split(':'); giftData = { id:Number(parts[1]), name:parts.slice(2).join(':') }; } catch {} }
                          const isMe = Number(m.senderId) === Number(user?.id);
                          const variant = isMe ? 'peer' : 'me';
                          const prefix  = isMe ? 'me' : (callPeerName || `Usuario ${callPeerId || ''}`);
                          return (
                            <StyledChatMessageRow key={m.id}>
                              <StyledChatBubble $variant={variant}>
                                <strong>{prefix} :</strong>{' '}
                                {giftData ? (giftRenderReady && (() => { const src = (gifts.find(gg => Number(gg.id) === Number(giftData.id))?.icon) || null; return src ? <img src={src} alt="" style={{ width:24, height:24, verticalAlign:'middle' }} /> : null; })()) : m.body}
                              </StyledChatBubble>
                            </StyledChatMessageRow>
                          );
                        })}
                      </StyledChatList>
                    </StyledChatContainer>
                  </StyledVideoArea>

                  <StyledChatDock style={{ display:(callStatus === 'in-call') ? 'flex' : 'none' }}>
                    <StyledChatInput value={centerInput} onChange={(e)=>setCenterInput(e.target.value)} placeholder="Escribe un mensaje…" onKeyDown={(e)=>{ if (e.key === 'Enter') sendCenterMessage(); }} />
                    <ActionButton type="button" onClick={sendCenterMessage}>Enviar</ActionButton>
                  </StyledChatDock>
                </>
              )}

              {/* Chat normal móvil (oculto en modo call) */}
              <StyledCenterBody data-call={contactMode === 'call' ? 'true' : undefined}>
                {isPendingPanel && (
                  <div style={{ flex:1, minHeight:0, display:'flex', alignItems:'center', justifyContent:'center', border:'1px solid #333', borderRadius:8, padding:16, background:'rgba(0,0,0,0.2)' }}>
                    <div style={{ textAlign:'center' }}>
                      <p style={{ color:'#fff', marginBottom:16 }}>{centerChatPeerName} te ha invitado a favoritos. Acepta para habilitar el chat.</p>
                      <div style={{ display:'flex', gap:12, justifyContent:'center' }}>
                        <ButtonAceptar onClick={acceptInvitation}>Aceptar</ButtonAceptar>
                        <ButtonRechazar onClick={rejectInvitation}>Rechazar</ButtonRechazar>
                      </div>
                    </div>
                  </div>
                )}

                {isSentPanel && (
                  <div style={{ flex:1, minHeight:0, display:'flex', alignItems:'center', justifyContent:'center', border:'1px solid #333', borderRadius:8, padding:16, background:'rgba(0,0,0,0.2)' }}>
                    <div style={{ textAlign:'center', color:'#e9ecef' }}>
                      <p style={{ marginBottom:8 }}>Invitación enviada. Esperando respuesta de <strong>{centerChatPeerName}</strong>.</p>
                      <p style={{ fontSize:12, color:'#adb5bd' }}>El chat se habilitará cuando acepte tu invitación.</p>
                    </div>
                  </div>
                )}

                {/* Movil Favoritos Chat */}
                {!isPendingPanel && !isSentPanel && contactMode !== 'call' && (
                  <>
                    <StyledChatScroller ref={modelCenterListRef}>
                      {centerMessages.length === 0 && <div style={{ color:'#adb5bd' }}>{allowChat ? 'No hay mensajes todavía. ¡Escribe el primero!' : 'Este chat no está activo.'}</div>}
                      {centerMessages.map(m => {
                        let giftData = m.gift;
                        if (!giftData && typeof m.body === 'string' && m.body.startsWith('[[GIFT:') && m.body.endsWith(']]')) { try { const parts = m.body.slice(2,-2).split(':'); giftData = { id:Number(parts[1]), name:parts.slice(2).join(':') }; } catch {} }
                        const isMe = Number(m.senderId) === Number(user?.id);
                        const variant = isMe ? 'me' : 'peer';
                        const prefix = isMe ? 'me' : (centerChatPeerName || `Usuario ${openChatWith || ''}`);
                        return (
                          <StyledChatMessageRow key={m.id}>
                            <StyledChatBubble $variant={variant}>
                              {giftData ? (<><strong>{prefix} :</strong>{' '}{giftRenderReady && (() => { const src = (gifts.find(gg => Number(gg.id) === Number(giftData.id))?.icon) || null; return src ? <img src={src} alt="" style={{ width:24, height:24, verticalAlign:'middle' }} /> : null; })()}</>) : (<><strong>{prefix} :</strong> {m.body}</>)}
                            </StyledChatBubble>
                          </StyledChatMessageRow>
                        );
                      })}
                    </StyledChatScroller>

                    <StyledChatDock>
                      <StyledChatInput value={centerInput} onChange={(e)=>setCenterInput(e.target.value)} placeholder={allowChat ? 'Escribe un mensaje…' : 'Chat inactivo'} onKeyDown={(e)=>{ if (e.key === 'Enter' && allowChat) sendCenterMessage(); }} disabled={!allowChat} />
                      <ButtonEnviar onClick={sendCenterMessage} disabled={!allowChat}>Enviar</ButtonEnviar>
                    </StyledChatDock>
                  </>
                )}
              </StyledCenterBody>
            </div>
          )}
        </>
      )}
    </>
  );
}
