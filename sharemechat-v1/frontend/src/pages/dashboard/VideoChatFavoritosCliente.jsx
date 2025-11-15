import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowLeft, faPhone, faPhoneSlash, faVideo, faPaperPlane, faGift } from '@fortawesome/free-solid-svg-icons';
import FavoritesClientList from '../favorites/FavoritesClientList';
import {
  StyledCenter,
  StyledFavoritesShell, StyledFavoritesColumns, StyledCenterPanel,
  StyledCenterBody, StyledChatScroller, StyledChatDock, StyledChatInput,
  StyledVideoArea, StyledRemoteVideo, StyledVideoTitle,
  StyledTitleAvatar, StyledLocalVideo, StyledTopActions,
  StyledChatContainer, StyledChatList, StyledChatMessageRow, StyledChatBubble,
  StyledPreCallCenter, StyledHelperLine, StyledBottomActionsMobile,
  StyledMobile3ColBar, StyledTopCenter, StyledConnectedText, StyledFloatingHangup
} from '../../styles/pages-styles/VideochatStyles';

import {
  ButtonLlamar, ButtonColgar, ButtonAceptar, ButtonRechazar,
  ButtonEnviar, ButtonRegalo, ButtonActivarCam, ButtonActivarCamMobile,
  ButtonVolver, ActionButton, BtnRoundVideo, BtnHangup, BtnSend
} from '../../styles/ButtonStyles';

// Este componente solo renderiza la pestaña FAVORITOS (desktop + móvil),
export default function VideoChatFavoritosCliente(props) {
  const {
    isMobile,
    // móvil: lista y selección
    handleOpenChatFromFavorites,
    favReload,
    selectedContactId,
    setCtxUser, setCtxPos,
    // chat persistente
    centerChatPeerId, centerChatPeerName,
    centerMessages, centerLoading,
    centerListRef, chatEndRef,
    centerInput, setCenterInput,
    sendCenterMessage,
    // estado favorito/invitaciones
    allowChat, isPendingPanel, isSentPanel,
    acceptInvitation, rejectInvitation,
    // gifts chat persistente
    gifts, giftRenderReady, fmtEUR,
    showCenterGifts, setShowCenterGifts,
    sendGiftMsg,
    // llamada 1-a-1
    contactMode, enterCallMode,
    callStatus, callCameraActive,
    callPeerId, callPeerName, callPeerAvatar,
    callRemoteVideoRef, callLocalVideoRef,
    callRemoteWrapRef, callListRef,
    handleCallActivateCamera, handleCallInvite,
    handleCallAccept, handleCallReject,
    handleCallEnd, toggleFullscreen,
    callError,
    // utilidades móviles (para botón Volver)
    backToList,
    // user (para pintar “me”/peer en mensajes)
    user,
  } = props;

  return (
    <>
      {/* === Desktop Favoritos ALL === */}
      <>
        {!isMobile && (
          <StyledFavoritesShell>
            <StyledFavoritesColumns>
              <StyledCenterPanel>
                {!centerChatPeerId ? (
                  <div style={{ color:'#adb5bd' }}>Selecciona un favorito y pulsa <em>Chatear</em> para abrir la conversación aquí.</div>
                ) : (
                  <>
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:8, padding:'4px 0 10px' }}>
                      <div style={{ display:'flex', gap:8 }}>
                        <ButtonLlamar
                          onClick={enterCallMode}
                          disabled={!centerChatPeerId || contactMode === 'call'}
                          title="Llamar"
                          aria-label="Llamar"
                          style={contactMode === 'call' ? { display:'none' } : undefined}
                        >
                          <FontAwesomeIcon icon={faVideo} style={{ marginRight:6 }} />
                          Iniciar VideoChat
                        </ButtonLlamar>

                      </div>
                    </div>

                    <StyledCenterBody>
                      {isPendingPanel && (
                        <div style={{ flex:1, minHeight:0, display:'flex', alignItems:'center', justifyContent:'center', border:'1px solid #333', borderRadius:8, padding:16, background:'rgba(0,0,0,0.2)' }}>
                          <div style={{ textAlign:'center' }}>
                            <p style={{ color:'#fff', marginBottom:16 }}>{centerChatPeerName} te ha invitado a favoritos. Acepta para habilitar el chat.</p>
                            <div style={{ display:'flex', gap:12, justifyContent:'center' }}>
                              <ButtonAceptar onClick={acceptInvitation}>Aceptar</ButtonAceptar>
                              <ButtonRechazar onClick={rejectInvitation} style={{ backgroundColor:'#dc3545' }}>Rechazar</ButtonRechazar>
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

                      {/* Desktop Favoritos Calling */}
                      {!isPendingPanel && !isSentPanel && contactMode === 'call' && (
                        <>
                          {callError && <p style={{ color:'orange', marginTop:6 }}>[CALL] {callError}</p>}
                          {/* estado oculto en desktop */}
                          <StyledTopActions style={{ gap:8 }}>
                            {!callCameraActive && callStatus !== 'incoming' && (
                              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:6, marginTop:8 }}>
                                <ButtonActivarCam
                                  onClick={handleCallActivateCamera}
                                  disabled={callStatus === 'idle' ? !allowChat : false}
                                  title={callStatus === 'idle' ? (allowChat ? 'Activa tu cámara' : 'Debéis ser favoritos aceptados para poder llamar') : 'Activa tu cámara'}
                                >
                                  Activar cámara
                                </ButtonActivarCam>

                                <StyledHelperLine style={{ color:'#000' }}>
                                  <FontAwesomeIcon icon={faVideo} />
                                  activar cámara para iniciar videochat
                                </StyledHelperLine>
                              </div>
                            )}

                            {callCameraActive && callStatus !== 'in-call' && callStatus !== 'ringing' && callStatus !== 'connecting' && (
                              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:6, marginTop:8 }}>
                                <BtnRoundVideo
                                  onClick={handleCallInvite}
                                  disabled={!allowChat || !callPeerId}
                                  title={!allowChat ? 'Debéis ser favoritos aceptados para poder llamar' : (!callPeerId ? 'Selecciona un contacto para llamar' : `Llamar a ${callPeerName || callPeerId}`)}
                                  aria-label="Llamar"
                                >
                                  <FontAwesomeIcon icon={faVideo} />
                                </BtnRoundVideo>
                                <StyledHelperLine style={{ color:'#000' }}>
                                  <FontAwesomeIcon icon={faVideo} />
                                  pulsar botón para iniciar videollamada
                                </StyledHelperLine>
                              </div>
                            )}

                            {(callStatus === 'ringing' || callStatus === 'in-call' || callStatus === 'connecting') && (
                              <ButtonColgar onClick={() => handleCallEnd(false)} title="Colgar" aria-label="Colgar">
                                <FontAwesomeIcon icon={faPhoneSlash} />
                              </ButtonColgar>
                            )}
                          </StyledTopActions>

                          {/* Desktop Favoritos video + chat en llamada */}
                          <StyledVideoArea style={{ display: callStatus === 'in-call' ? 'block' : 'none' }}>
                            <StyledRemoteVideo ref={callRemoteWrapRef}>
                              <StyledVideoTitle>
                                <StyledTitleAvatar src={callPeerAvatar || '/img/avatarChica.png'} alt="" />
                                {callPeerName || 'Remoto'}
                                <button
                                  type="button"
                                  onClick={() => toggleFullscreen(callRemoteWrapRef.current)}
                                  title="Pantalla completa"
                                  style={{ marginLeft:8, padding:'2px 8px', borderRadius:6, border:'1px solid rgba(255,255,255,.6)', background:'rgba(0,0,0,.25)', color:'#fff', cursor:'pointer' }}
                                >
                                  Full Screen
                                </button>
                              </StyledVideoTitle>
                              <video
                                ref={callRemoteVideoRef}
                                style={{ width:'100%', height:'100%', objectFit:'cover' }}
                                autoPlay
                                playsInline
                                onDoubleClick={() => toggleFullscreen(callRemoteWrapRef.current)}
                              />
                            </StyledRemoteVideo>

                            <StyledLocalVideo>
                              <h5 style={{ color:'white', margin:0, fontSize:12 }}>Tu Cámara</h5>
                              <video ref={callLocalVideoRef} style={{ width:'100%', display:'block', border:'1px solid rgba(255,255,255,0.25)' }} muted autoPlay playsInline />
                            </StyledLocalVideo>

                            <StyledChatContainer data-wide="true" style={{ maxHeight:'70vh' }}>
                              <StyledChatList ref={callListRef}>
                                {centerMessages.map(m => {
                                  let giftData = m.gift;
                                  if (!giftData && typeof m.body === 'string' && m.body.startsWith('[[GIFT:') && m.body.endsWith(']]')) {
                                    try {
                                      const parts = m.body.slice(2, -2).split(':');
                                      giftData = { id:Number(parts[1]), name:parts.slice(2).join(':') };
                                    } catch {}
                                  }
                                  const isMe = Number(m.senderId) === Number(user?.id);
                                  const variant = isMe ? 'me' : 'peer';
                                  const prefix = isMe ? 'me' : (callPeerName || 'Usuario');
                                  return (
                                    <StyledChatMessageRow key={m.id}>
                                      {giftData ? (
                                        giftRenderReady && (() => {
                                          const src = gifts.find(gg => Number(gg.id) === Number(giftData.id))?.icon || null;
                                          return src ? (
                                            <StyledChatBubble $variant={variant}>
                                              <strong>{prefix} :</strong>{' '}
                                              <img src={src} alt="" style={{ width:24, height:24, verticalAlign:'middle' }} />
                                            </StyledChatBubble>
                                          ) : null;
                                        })()
                                      ) : (
                                        <StyledChatBubble $variant={variant}>
                                          <strong>{prefix} :</strong> {m.body}
                                        </StyledChatBubble>
                                      )}
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
                              onChange={e => setCenterInput(e.target.value)}
                              placeholder="Escribe un mensaje…"
                              autoComplete="off"
                              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendCenterMessage(); } }}
                              onFocus={() => setTimeout(() => chatEndRef.current?.scrollIntoView({ block:'end' }), 50)}
                            />
                            <BtnSend type="button" onClick={sendCenterMessage} aria-label="Enviar">
                              <FontAwesomeIcon icon={faPaperPlane} />
                            </BtnSend>
                            <ButtonRegalo
                              type="button"
                              onClick={() => setShowCenterGifts(s => !s)}
                              title="Enviar regalo"
                              aria-label="Enviar regalo"
                            >
                              <FontAwesomeIcon icon={faGift} />
                            </ButtonRegalo>
                            {showCenterGifts && (
                              <div style={{ position:'absolute', bottom:44, right:0, background:'rgba(0,0,0,0.85)', padding:10, borderRadius:8, zIndex:10, border:'1px solid #333' }}>
                                <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 80px)', gap:8, maxHeight:240, overflowY:'auto' }}>
                                  {gifts.map(g => (
                                    <button
                                      key={g.id}
                                      onClick={() => sendGiftMsg(g.id)}
                                      style={{ background:'transparent', border:'1px solid #555', borderRadius:8, padding:6, cursor:'pointer', color:'#fff' }}
                                    >
                                      <img src={g.icon} alt={g.name} style={{ width:32, height:32, display:'block', margin:'0 auto' }} />
                                      <div style={{ fontSize:12 }}>{g.name}</div>
                                      <div style={{ fontSize:12, opacity:.8 }}>{fmtEUR(g.cost)}</div>
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                          </StyledChatDock>

                          {callStatus === 'incoming' && (
                            <div style={{ marginTop:12, padding:12, border:'1px solid #333', borderRadius:8, background:'rgba(0,0,0,0.35)' }}>
                              <div style={{ color:'#fff', marginBottom:8 }}>Te está llamando <strong>{callPeerName || 'Usuario'}</strong>.</div>
                              <div style={{ display:'flex', gap:10 }}>
                                <ButtonAceptar onClick={handleCallAccept}>Aceptar</ButtonAceptar>
                                <ButtonRechazar onClick={handleCallReject} style={{ backgroundColor:'#dc3545' }}>Rechazar</ButtonRechazar>
                              </div>
                            </div>
                          )}
                          {callStatus === 'ringing' && (
                            <div style={{ marginTop:12, color:'#fff' }}>Llamando a {callPeerName || 'Usuario'}… (sonando)</div>
                          )}
                        </>
                      )}

                      {/* Desktop Favoritos chat normal */}
                      {!isPendingPanel && !isSentPanel && contactMode !== 'call' && (
                        <>
                          <StyledChatScroller ref={centerListRef}>
                            {centerLoading && <div style={{ color:'#adb5bd' }}>Cargando historial…</div>}
                            {!centerLoading && centerMessages.length === 0 && (
                              <div style={{ color:'#adb5bd' }}>
                                {allowChat ? 'No hay mensajes todavía. ¡Escribe el primero!' : 'Este chat no está activo.'}
                              </div>
                            )}
                            {centerMessages.map(m => {
                              let giftData = m.gift;
                              if (!giftData && typeof m.body === 'string' && m.body.startsWith('[[GIFT:') && m.body.endsWith(']]')) {
                                try {
                                  const parts = m.body.slice(2, -2).split(':');
                                  giftData = { id:Number(parts[1]), name:parts.slice(2).join(':') };
                                } catch {}
                              }
                              const isMe = Number(m.senderId) === Number(user?.id);
                              const variant = isMe ? 'me' : 'peer';
                              const prefix = isMe ? 'me' : (centerChatPeerName || 'Usuario');
                              return (
                                <StyledChatMessageRow key={m.id}>
                                  <StyledChatBubble $variant={variant}>
                                    {giftData ? (
                                      <>
                                        <strong>{prefix} :</strong>{' '}
                                        {giftRenderReady && (() => {
                                          const src = (gifts.find(gg => Number(gg.id) === Number(giftData.id))?.icon) || null;
                                          return src ? <img src={src} alt="" style={{ width:24, height:24, verticalAlign:'middle' }} /> : null;
                                        })()}
                                      </>
                                    ) : (
                                      <>
                                        <strong>{prefix} :</strong> {m.body}
                                      </>
                                    )}
                                  </StyledChatBubble>
                                </StyledChatMessageRow>
                              );
                            })}
                          </StyledChatScroller>

                          <StyledChatDock>
                            <StyledChatInput
                              value={centerInput}
                              onChange={e => setCenterInput(e.target.value)}
                              placeholder={allowChat ? 'Escribe un mensaje…' : 'Chat inactivo'}
                              onKeyDown={e => { if (e.key === 'Enter' && allowChat) sendCenterMessage(); }}
                              disabled={!allowChat}
                              onFocus={() => { setTimeout(() => chatEndRef.current?.scrollIntoView({ block:'end' }), 50); }}
                            />
                            <BtnSend type="button" onClick={sendCenterMessage} disabled={!allowChat} aria-label="Enviar">
                              <FontAwesomeIcon icon={faPaperPlane} />
                            </BtnSend>
                            <ButtonRegalo
                              onClick={() => setShowCenterGifts(s => !s)}
                              title="Enviar regalo"
                              disabled={!allowChat}
                              aria-label="Enviar regalo"
                            >
                              <FontAwesomeIcon icon={faGift} />
                            </ButtonRegalo>
                            {showCenterGifts && allowChat && (
                              <div style={{ position:'absolute', bottom:44, right:0, background:'rgba(0,0,0,0.85)', padding:10, borderRadius:8, zIndex:10, border:'1px solid #333' }}>
                                <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 80px)', gap:8, maxHeight:240, overflowY:'auto' }}>
                                  {gifts.map(g => (
                                    <button
                                      key={g.id}
                                      onClick={() => sendGiftMsg(g.id)}
                                      style={{ background:'transparent', border:'1px solid #555', borderRadius:8, padding:6, cursor:'pointer', color:'#fff' }}
                                    >
                                      <img src={g.icon} alt={g.name} style={{ width:32, height:32, display:'block', margin:'0 auto' }} />
                                      <div style={{ fontSize:12 }}>{g.name}</div>
                                      <div style={{ fontSize:12, opacity:.8 }}>{fmtEUR(g.cost)}</div>
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                          </StyledChatDock>
                        </>
                      )}
                    </StyledCenterBody>
                  </>
                )}
              </StyledCenterPanel>
            </StyledFavoritesColumns>
          </StyledFavoritesShell>
        )}

        {/* === Móvil Favoritos ALL === */}
        {isMobile && (
          <>
            {!centerChatPeerId && (
              <div style={{ display:'flex', flexDirection:'column', flex:1, minHeight:0 }}>
                <div style={{ flex:1, minHeight:0, overflowY:'auto' }}>
                  <FavoritesClientList
                    onSelect={handleOpenChatFromFavorites}
                    reloadTrigger={favReload}
                    selectedId={selectedContactId}
                    onContextMenu={(user, pos) => { setCtxUser(user); setCtxPos(pos); }}
                  />
                </div>
              </div>
            )}

            {centerChatPeerId && (
              <div style={{ display:'flex', flexDirection:'column', flex:1, minHeight:0 }}>
                {/* Header móvil: SOLO volver + iniciar (centrado) + texto; NO aparece en llamada */}
                {contactMode !== 'call' && (
                  <StyledMobile3ColBar>
                    <ButtonVolver type="button" onClick={backToList} aria-label="Volver a la lista" title="Volver">
                      <FontAwesomeIcon icon={faArrowLeft} />
                    </ButtonVolver>

                    <StyledTopCenter>
                      {allowChat && (
                        <ButtonLlamar onClick={enterCallMode} title="Llamar" aria-label="Llamar">
                          Iniciar VideoChat
                        </ButtonLlamar>
                      )}
                    </StyledTopCenter>

                    <StyledConnectedText>{centerChatPeerName}</StyledConnectedText>
                  </StyledMobile3ColBar>
                )}

                {/* === CONTROLES DE LLAMADA EN MÓVIL === */}
                {contactMode === 'call' && (
                  <>
                    {/* PRE-CALL: Activar cámara */}
                    {!callCameraActive && callStatus !== 'incoming' && (
                      <StyledPreCallCenter>
                        <div>
                          <ButtonActivarCamMobile
                            onClick={handleCallActivateCamera}
                            disabled={callStatus === 'idle' ? !allowChat : false}
                            title={callStatus === 'idle'
                              ? (allowChat ? 'Activa tu cámara' : 'Debéis ser favoritos aceptados para poder llamar')
                              : 'Activa tu cámara'}
                          >
                            Activar cámara
                          </ButtonActivarCamMobile>

                          <StyledHelperLine>
                            <FontAwesomeIcon icon={faVideo} />
                            activar cámara para iniciar videochat
                          </StyledHelperLine>
                        </div>
                      </StyledPreCallCenter>
                    )}

                    {/* INCOMING (móvil): SOLO Aceptar/Rechazar */}
                    {!callCameraActive && callStatus === 'incoming' && (
                      <StyledPreCallCenter>
                        <div style={{ display:'flex', gap:10, justifyContent:'center' }}>
                          <ButtonAceptar onClick={handleCallAccept}>Aceptar</ButtonAceptar>
                          <ButtonRechazar onClick={handleCallReject}>Rechazar</ButtonRechazar>
                        </div>
                      </StyledPreCallCenter>
                    )}

                    {/* Botón LLAMAR (verde) SOLO cuando cámara activa y no hay conexión */}
                    {callCameraActive && (callStatus !== 'in-call' && callStatus !== 'ringing' && callStatus !== 'connecting') && (
                      <StyledBottomActionsMobile>
                        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:4 }}>
                          <BtnRoundVideo
                            onClick={handleCallInvite}
                            disabled={!allowChat || !callPeerId}
                            title={!allowChat
                              ? 'Debéis ser favoritos aceptados para poder llamar'
                              : (!callPeerId ? 'Selecciona un contacto para llamar' : `Llamar a ${callPeerName || callPeerId}`)}
                            aria-label="Llamar"
                          >
                            <FontAwesomeIcon icon={faVideo} />
                          </BtnRoundVideo>

                          <StyledHelperLine style={{ marginTop:4 }}>
                            <FontAwesomeIcon icon={faVideo} />
                            pulsar botón para iniciar llamada
                          </StyledHelperLine>
                        </div>
                      </StyledBottomActionsMobile>
                    )}
                  </>
                )}

                {/* Área de vídeo + chat en llamada (móvil) */}
                {contactMode === 'call' && (
                  <div style={{ margin:0, display:'flex', flexDirection:'column', flex:1, minHeight:0 }}>
                    <StyledVideoArea style={{ display: callStatus === 'in-call' ? 'block' : 'none', position:'relative' }}>
                      <StyledRemoteVideo ref={callRemoteWrapRef}>
                        <StyledVideoTitle>
                          <StyledTitleAvatar src={callPeerAvatar || '/img/avatarChico.png'} alt="" />
                          {callPeerName || 'Remoto'}
                          <button
                            type="button"
                            onClick={() => toggleFullscreen(callRemoteWrapRef.current)}
                            title="Pantalla completa"
                            style={{ marginLeft:8, padding:'2px 8px', borderRadius:6, border:'1px solid rgba(255,255,255,.6)', background:'rgba(0,0,0,.25)', color:'#fff', cursor:'pointer' }}
                          >
                            Full Screen
                          </button>
                        </StyledVideoTitle>
                        <video ref={callRemoteVideoRef} autoPlay playsInline style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                      </StyledRemoteVideo>

                      <StyledLocalVideo>
                        <h5 style={{ color:'#fff', margin:0, fontSize:12 }}>Tu Cámara</h5>
                        <video ref={callLocalVideoRef} muted autoPlay playsInline style={{ width:'100%', display:'block', border:'1px solid rgba(255,255,255,0.25)' }} />
                      </StyledLocalVideo>

                      {/* Botón Colgar flotante sobre el streaming (móvil) */}
                      {callStatus === 'in-call' && (
                        <StyledFloatingHangup>
                          <BtnHangup onClick={() => handleCallEnd(false)} title="Colgar" aria-label="Colgar">
                            <FontAwesomeIcon icon={faPhoneSlash} />
                          </BtnHangup>
                        </StyledFloatingHangup>
                      )}

                      {/* Chat overlay durante la llamada */}
                      <StyledChatContainer data-wide="true">
                        <StyledChatList ref={callListRef}>
                          {centerMessages.map(m => {
                            let giftData = m.gift;
                            if (!giftData && typeof m.body === 'string' && m.body.startsWith('[[GIFT:') && m.body.endsWith(']]')) {
                              try {
                                const parts = m.body.slice(2, -2).split(':');
                                giftData = { id:Number(parts[1]), name:parts.slice(2).join(':') };
                              } catch {}
                            }
                            const isMe = Number(m.senderId) === Number(user?.id);
                            const variant = isMe ? 'me' : 'peer';
                            const prefix  = isMe ? 'me' : (callPeerName || 'Usuario');
                            return (
                              <StyledChatMessageRow key={m.id}>
                                {giftData ? (
                                  giftRenderReady && (() => {
                                    const src = (gifts.find(gg => Number(gg.id) === Number(giftData.id))?.icon) || null;
                                    return src ? (
                                      <StyledChatBubble $variant={variant}>
                                        <strong>{prefix} :</strong>{' '}
                                        <img src={src} alt="" style={{ width:24, height:24, verticalAlign:'middle' }} />
                                      </StyledChatBubble>
                                    ) : null;
                                  })()
                                ) : (
                                  <StyledChatBubble $variant={variant}>
                                    <strong>{prefix} :</strong> {m.body}
                                  </StyledChatBubble>
                                )}
                              </StyledChatMessageRow>
                            );
                          })}
                        </StyledChatList>
                      </StyledChatContainer>
                    </StyledVideoArea>

                    {/* Input chat solo en llamada + Gift (móvil) */}
                    <StyledChatDock style={{ display: callStatus === 'in-call' ? 'flex' : 'none' }}>
                      <StyledChatInput
                        type="text"
                        value={centerInput}
                        onChange={e => setCenterInput(e.target.value)}
                        placeholder="Escribe un mensaje…"
                        autoComplete="off"
                        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendCenterMessage(); } }}
                        onFocus={() => setTimeout(() => chatEndRef.current?.scrollIntoView({ block:'end' }), 50)}
                      />
                      <BtnSend type="button" onClick={sendCenterMessage} aria-label="Enviar">
                        <FontAwesomeIcon icon={faPaperPlane} />
                      </BtnSend>
                      <ButtonRegalo
                        title="Enviar regalo"
                        onClick={() => setShowCenterGifts(s => !s)}
                        aria-label="Enviar regalo"
                      >
                        <FontAwesomeIcon icon={faGift} />
                      </ButtonRegalo>

                      {showCenterGifts && (
                        <div style={{ position:'absolute', bottom:44, right:0, background:'rgba(0,0,0,0.85)', padding:10, borderRadius:8, zIndex:10, border:'1px solid #333' }}>
                          <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 80px)', gap:8, maxHeight:240, overflowY:'auto' }}>
                            {gifts.map(g => (
                              <button
                                key={g.id}
                                onClick={() => sendGiftMsg(g.id)}
                                style={{ background:'transparent', border:'1px solid #555', borderRadius:8, padding:6, cursor:'pointer', color:'#fff' }}
                              >
                                <img src={g.icon} alt={g.name} style={{ width:32, height:32, display:'block', margin:'0 auto' }} />
                                <div style={{ fontSize:12 }}>{g.name}</div>
                                <div style={{ fontSize:12, opacity:.8 }}>{fmtEUR(g.cost)}</div>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </StyledChatDock>

                    {(callStatus === 'connecting' || callStatus === 'ringing' || callStatus === 'incoming') && (
                      <p style={{ color:'#000', textAlign:'center', margin:'6px 0' }}>
                        {callStatus === 'connecting' && 'Conectando…'}
                        {callStatus === 'ringing' && `Llamando a ${callPeerName || 'usuario'}…`}
                        {callStatus === 'incoming' && `Te está llamando ${callPeerName || 'usuario'}…`}
                      </p>
                    )}
                  </div>
                )}

                {/* Chat persistente cuando NO estás en llamada (móvil) */}
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

                  {!isPendingPanel && !isSentPanel && contactMode !== 'call' && (
                    <>
                      <StyledChatScroller ref={centerListRef}>
                        {centerLoading && <div style={{ color:'#adb5bd' }}>Cargando historial…</div>}
                        {!centerLoading && centerMessages.length === 0 && (
                          <div style={{ color:'#adb5bd' }}>
                            {allowChat ? 'No hay mensajes todavía. ¡Escribe el primero!' : 'Este chat no está activo.'}
                          </div>
                        )}
                        {centerMessages.map(m => {
                          let giftData = m.gift;
                          if (!giftData && typeof m.body === 'string' && m.body.startsWith('[[GIFT:') && m.body.endsWith(']]')) {
                            try {
                              const parts = m.body.slice(2, -2).split(':');
                              giftData = { id:Number(parts[1]), name:parts.slice(2).join(':') };
                            } catch {}
                          }
                          const isMe = Number(m.senderId) === Number(user?.id);
                          const variant = isMe ? 'me' : 'peer';
                          const prefix = isMe ? 'me' : (centerChatPeerName || 'Usuario');
                          return (
                            <StyledChatMessageRow key={m.id}>
                              <StyledChatBubble $variant={variant}>
                                {giftData ? (
                                  <>
                                    <strong>{prefix} :</strong>{' '}
                                    {giftRenderReady && (() => {
                                      const src = (gifts.find(gg => Number(gg.id) === Number(giftData.id))?.icon) || null;
                                      return src ? <img src={src} alt="" style={{ width:24, height:24, verticalAlign:'middle' }} /> : null;
                                    })()}
                                  </>
                                ) : (
                                  <>
                                    <strong>{prefix} :</strong> {m.body}
                                  </>
                                )}
                              </StyledChatBubble>
                            </StyledChatMessageRow>
                          );
                        })}
                      </StyledChatScroller>

                      <StyledChatDock>
                        <StyledChatInput
                          value={centerInput}
                          onChange={e => setCenterInput(e.target.value)}
                          placeholder={allowChat ? 'Escribe un mensaje…' : 'Chat inactivo'}
                          onKeyDown={e => { if (e.key === 'Enter' && allowChat) sendCenterMessage(); }}
                          disabled={!allowChat}
                          onFocus={() => { setTimeout(() => chatEndRef.current?.scrollIntoView({ block:'end' }), 50); }}
                        />
                        <BtnSend type="button" onClick={sendCenterMessage} disabled={!allowChat} aria-label="Enviar">
                          <FontAwesomeIcon icon={faPaperPlane} />
                        </BtnSend>
                        <ButtonRegalo
                          onClick={() => setShowCenterGifts(s => !s)}
                          title="Enviar regalo"
                          disabled={!allowChat}
                          aria-label="Enviar regalo"
                        >
                          <FontAwesomeIcon icon={faGift} />
                        </ButtonRegalo>
                        {showCenterGifts && allowChat && (
                          <div style={{ position:'absolute', bottom:44, right:0, background:'rgba(0,0,0,0.85)', padding:10, borderRadius:8, zIndex:10, border:'1px solid #333' }}>
                            <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 80px)', gap:8, maxHeight:240, overflowY:'auto' }}>
                              {gifts.map(g => (
                                <button
                                  key={g.id}
                                  onClick={() => sendGiftMsg(g.id)}
                                  style={{ background:'transparent', border:'1px solid #555', borderRadius:8, padding:6, cursor:'pointer', color:'#fff' }}
                                >
                                  <img src={g.icon} alt={g.name} style={{ width:32, height:32, display:'block', margin:'0 auto' }} />
                                  <div style={{ fontSize:12 }}>{g.name}</div>
                                  <div style={{ fontSize:12, opacity:.8 }}>{fmtEUR(g.cost)}</div>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </StyledChatDock>
                    </>
                  )}
                </StyledCenterBody>
              </div>
            )}
          </>
        )}
      </>
    </>
  );
}
