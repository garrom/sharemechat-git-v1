// src/pages/dashboard/VideoChatFavoritosCliente.jsx
import React,{useEffect,useRef} from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowLeft, faPhoneSlash, faVideo, faPaperPlane, faGift } from '@fortawesome/free-solid-svg-icons';
import FavoritesClientList from '../favorites/FavoritesClientList';
import { StyledCenter,StyledFavoritesShell,StyledFavoritesColumns,StyledCenterPanel,StyledCenterBody,
    StyledChatScroller,StyledChatDock,StyledChatInput,StyledVideoArea,StyledRemoteVideo,StyledVideoTitle,
    StyledTitleAvatar,StyledLocalVideo,StyledTopActions,StyledChatWhatsApp,StyledChatContainer,
    StyledChatList,StyledChatMessageRow,StyledChatBubble,StyledPreCallCenter,StyledHelperLine,
    StyledBottomActionsMobile,StyledMobile3ColBar,StyledTopCenter,StyledConnectedText,StyledFloatingHangup,
    StyledCallCardDesktop,StyledCallFooterDesktop
} from '../../styles/pages-styles/VideochatStyles';
import { ButtonLlamar,ButtonColgar,ButtonAceptar,ButtonRechazar,ButtonEnviar,ButtonRegalo,ButtonActivarCam,
    ButtonActivarCamMobile,ButtonVolver,ActionButton,BtnRoundVideo,BtnHangup
} from '../../styles/ButtonStyles';

export default function VideoChatFavoritosCliente(props){
  const {
      isMobile,handleOpenChatFromFavorites,favReload,selectedContactId,setCtxUser,setCtxPos,centerChatPeerId,
      centerChatPeerName,centerMessages,centerLoading,centerListRef,chatEndRef,centerInput,setCenterInput,
      sendCenterMessage,allowChat,isPendingPanel,isSentPanel,acceptInvitation,rejectInvitation,gifts,giftRenderReady,
      fmtEUR,showCenterGifts,setShowCenterGifts,sendGiftMsg,contactMode,enterCallMode,callStatus,callCameraActive,
      callPeerId,callPeerName,callPeerAvatar,callRemoteVideoRef,callLocalVideoRef,callRemoteWrapRef,callListRef,
      handleCallActivateCamera,handleCallInvite,handleCallAccept,handleCallReject,handleCallEnd,toggleFullscreen,
      callError,backToList,user} = props;

  return(<>
    {!isMobile &&(
      <StyledFavoritesShell>
        <StyledFavoritesColumns>
          <StyledCenterPanel>
            {!centerChatPeerId?(
              <div style={{color:'#adb5bd'}}>Selecciona un favorito y pulsa <em>Chatear</em> para abrir la conversación aquí.</div>
            ):(
              <>
                <StyledCenterBody>
                  {isPendingPanel&&(
                    <div style={{flex:1,minHeight:0,display:'flex',alignItems:'center',justifyContent:'center',border:'1px solid #333',borderRadius:8,padding:16,background:'rgba(0,0,0,0.2)'}}>
                      <div style={{textAlign:'center'}}>
                        <p style={{color:'#fff',marginBottom:16}}>{centerChatPeerName} te ha invitado a favoritos. Acepta para habilitar el chat.</p>
                        <div style={{display:'flex',gap:12,justifyContent:'center'}}>
                          <ButtonAceptar onClick={acceptInvitation}>Aceptar</ButtonAceptar>
                          <ButtonRechazar onClick={rejectInvitation} style={{backgroundColor:'#dc3545'}}>Rechazar</ButtonRechazar>
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

                  {!isPendingPanel&&!isSentPanel&&contactMode==='call'&&(
                    <div style={{flex:1,minHeight:0,display:'flex',flexDirection:'column',justifyContent:'center',alignItems:'center'}}>
                      {callError&&<p style={{color:'orange',marginTop:6}}>[CALL] {callError}</p>}

                      <StyledTopActions style={{gap:8,display:'flex',justifyContent:'center',alignItems:'center',flexDirection:'column'}}>
                        {!callCameraActive&&callStatus!=='incoming'&&(
                          <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:6,marginTop:8}}>
                            <ButtonActivarCam
                              onClick={handleCallActivateCamera}
                              disabled={callStatus==='idle'?!allowChat:false}
                              title={callStatus==='idle'?(allowChat?'Activa tu cámara':'Debéis ser favoritos aceptados para poder llamar'):'Activa tu cámara'}
                            >Activar cámara</ButtonActivarCam>
                            <StyledHelperLine style={{color:'#000'}}>
                              <FontAwesomeIcon icon={faVideo}/>
                              activar cámara para iniciar videochat
                            </StyledHelperLine>
                          </div>
                        )}

                        {callCameraActive&&callStatus!=='in-call'&&callStatus!=='ringing'&&callStatus!=='connecting'&&(
                          <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:6,marginTop:8}}>
                            <BtnRoundVideo
                              onClick={handleCallInvite}
                              disabled={!allowChat||!callPeerId}
                              title={!allowChat?'Debéis ser favoritos aceptados para poder llamar':(!callPeerId?'Selecciona un contacto para llamar':`Llamar a ${callPeerName||callPeerId}`)}
                              aria-label="Llamar"
                            ><FontAwesomeIcon icon={faVideo}/></BtnRoundVideo>
                            <StyledHelperLine style={{color:'#000'}}>
                              <FontAwesomeIcon icon={faVideo}/>
                              pulsar botón para iniciar videollamada
                            </StyledHelperLine>
                          </div>
                        )}

                        {(callStatus==='ringing'||callStatus==='connecting')&&(
                          <div style={{display:'flex',flexDirection:'column',justifyContent:'center',alignItems:'center',gap:8,marginTop:8}}>
                            <div style={{color:'#fff',textAlign:'center'}}>
                              {callStatus==='ringing'
                                ? `Llamando a ${callPeerName||'Usuario'}… (sonando)`
                                : 'Conectando…'}
                            </div>
                            <BtnHangup onClick={()=>handleCallEnd(false)} title="Colgar" aria-label="Colgar">
                              <FontAwesomeIcon icon={faPhoneSlash}/>
                            </BtnHangup>
                          </div>
                        )}
                      </StyledTopActions>

                      {callStatus==='in-call'&&(
                        <StyledCallCardDesktop>
                          <StyledVideoArea style={{height:'calc(100vh - 220px)',maxHeight:'calc(100vh - 220px)',position:'relative'}}>
                            <StyledRemoteVideo ref={callRemoteWrapRef} style={{position:'relative',width:'100%',height:'100%',borderRadius:'12px',overflow:'hidden',background:'#000'}}>
                              <StyledVideoTitle>
                                <StyledTitleAvatar src={callPeerAvatar||'/img/avatarChica.png'} alt=""/>
                                {callPeerName||'Remoto'}
                                <button
                                  type="button"
                                  onClick={()=>toggleFullscreen(callRemoteWrapRef.current)}
                                  title="Pantalla completa"
                                  style={{marginLeft:8,padding:'2px 8px',borderRadius:6,border:'1px solid rgba(255,255,255,.6)',background:'rgba(0,0,0,0.25)',color:'#fff',cursor:'pointer'}}
                                >Full Screen</button>
                              </StyledVideoTitle>

                              <video
                                ref={callRemoteVideoRef}
                                style={{width:'100%',height:'100%',objectFit:'cover',display:'block'}}
                                autoPlay
                                playsInline
                                onDoubleClick={()=>toggleFullscreen(callRemoteWrapRef.current)}
                              />

                              <StyledLocalVideo>
                                <video
                                  ref={callLocalVideoRef}
                                  muted
                                  autoPlay
                                  playsInline
                                  style={{width:'100%',height:'100%',objectFit:'cover',display:'block',border:'1px solid rgba(255,255,255,0.25)'}}
                                />
                              </StyledLocalVideo>

                              <div style={{position:'absolute',left:0,right:0,bottom:16,display:'flex',justifyContent:'center',zIndex:10}}>
                                <BtnHangup onClick={()=>handleCallEnd(false)} title="Colgar" aria-label="Colgar">
                                  <FontAwesomeIcon icon={faPhoneSlash}/>
                                </BtnHangup>
                              </div>

                              <StyledChatContainer data-wide="true" style={{maxHeight:'70vh'}}>
                                <StyledChatList ref={callListRef}>
                                  {centerMessages.map(m=>{
                                    let giftData=m.gift;
                                    if(!giftData&&typeof m.body==='string'&&m.body.startsWith('[[GIFT:')&&m.body.endsWith(']]')){
                                      try{
                                        const parts=m.body.slice(2,-2).split(':');giftData={id:Number(parts[1]),name:parts.slice(2).join(':')};
                                      }catch{}
                                    }
                                    const isMe=Number(m.senderId)===Number(user?.id);const variant=isMe?'me':'peer';
                                    return(
                                      <StyledChatMessageRow key={m.id}>
                                        {giftData?(
                                          giftRenderReady&&(()=>{
                                            const src=gifts.find(gg=>Number(gg.id)===Number(giftData.id))?.icon||null;
                                            return src?(
                                              <StyledChatBubble $variant={variant} style={{margin:'0 6px'}}>
                                                <img src={src} alt="" style={{width:24,height:24,verticalAlign:'middle'}}/>
                                              </StyledChatBubble>
                                            ):null;
                                          })()
                                        ):(
                                          <StyledChatBubble $variant={variant}>{m.body}</StyledChatBubble>
                                        )}
                                      </StyledChatMessageRow>
                                    );
                                  })}
                                </StyledChatList>
                              </StyledChatContainer>
                            </StyledRemoteVideo>
                          </StyledVideoArea>

                          <StyledCallFooterDesktop style={{margin:'8px 0 0',padding:'0 0px',display:'flex',alignItems:'center',gap:8}}>
                            <StyledChatDock>
                              <StyledChatInput
                                type="text"
                                value={centerInput}
                                onChange={e=>setCenterInput(e.target.value)}
                                placeholder="Escribe un mensaje…"
                                autoComplete="off"
                                onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendCenterMessage();}}}
                                onFocus={()=>setTimeout(()=>chatEndRef.current?.scrollIntoView({block:'end'}),50)}

                              />

                              <ButtonRegalo type="button" onClick={()=>setShowCenterGifts(s=>!s)} title="Enviar regalo" aria-label="Enviar regalo">
                                <FontAwesomeIcon icon={faGift}/>
                              </ButtonRegalo>
                              {showCenterGifts&&(
                                <div style={{position:'absolute',bottom:44,right:0,background:'rgba(0,0,0,0.85)',padding:10,borderRadius:8,zIndex:10,border:'1px solid #333'}}>
                                  <div style={{display:'grid',gridTemplateColumns:'repeat(3, 80px)',gap:8,maxHeight:240,overflowY:'auto'}}>
                                    {gifts.map(g=>(
                                      <button key={g.id} onClick={()=>sendGiftMsg(g.id)} style={{background:'transparent',border:'1px solid #555',borderRadius:8,padding:6,cursor:'pointer',color:'#fff'}}>
                                        <img src={g.icon} alt={g.name} style={{width:32,height:32,display:'block',margin:'0 auto'}}/>
                                        <div style={{fontSize:12}}>{g.name}</div>
                                        <div style={{fontSize:12,opacity:.8}}>{fmtEUR(g.cost)}</div>
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </StyledChatDock>
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
                      <StyledChatScroller ref={centerListRef} data-bg="whatsapp">
                        {centerLoading&&<div style={{color:'#adb5bd'}}>Cargando historial…</div>}
                        {!centerLoading&&centerMessages.length===0&&(
                          <div style={{color:'#adb5bd'}}>
                            {allowChat?'No hay mensajes todavía. ¡Escribe el primero!':'Este chat no está activo.'}
                          </div>
                        )}
                        {centerMessages.map(m=>{
                          let giftData=m.gift;
                          if(!giftData&&typeof m.body==='string'&&m.body.startsWith('[[GIFT:')&&m.body.endsWith(']]')){
                            try{
                              const parts=m.body.slice(2,-2).split(':');giftData={id:Number(parts[1]),name:parts.slice(2).join(':')};
                            }catch{}
                          }
                          const isMe=Number(m.senderId)===Number(user?.id);const variant=isMe?'me':'peer';
                          return(
                            <StyledChatMessageRow key={m.id} style={{justifyContent:isMe?'flex-end':'flex-start'}}>
                              <StyledChatBubble $variant={variant} style={{margin:'0 6px'}}>
                                {giftData?(
                                  giftRenderReady&&(()=>{
                                    const src=gifts.find(gg=>Number(gg.id)===Number(giftData.id))?.icon||null;
                                    return src?<img src={src} alt="" style={{width:24,height:24,verticalAlign:'middle'}}/>:null;
                                  })()
                                ):(
                                  m.body
                                )}
                              </StyledChatBubble>
                            </StyledChatMessageRow>
                          );
                        })}
                      </StyledChatScroller>

                      <StyledChatDock>
                        <StyledChatInput
                          value={centerInput}
                          onChange={e=>setCenterInput(e.target.value)}
                          placeholder={allowChat?'Escribe un mensaje…':'Chat inactivo'}
                          onKeyDown={e=>{if(e.key==='Enter'&&allowChat)sendCenterMessage();}}
                          disabled={!allowChat}
                          onFocus={()=>{setTimeout(()=>chatEndRef.current?.scrollIntoView({block:'end'}),50);}}
                        />
                        <ButtonRegalo
                          onClick={()=>setShowCenterGifts(s=>!s)}
                          title="Enviar regalo"
                          disabled={!allowChat}
                          aria-label="Enviar regalo"

                        >
                          <FontAwesomeIcon icon={faGift}/>
                        </ButtonRegalo>
                        <ButtonLlamar
                          onClick={enterCallMode}
                          disabled={!centerChatPeerId||!allowChat}
                          title="Llamar"
                          aria-label="Llamar"
                          style={{marginRight:16, marginLeft:4,width:40,height:40,borderRadius:'999px',padding:0,display:'flex',alignItems:'center',justifyContent:'center'}}
                        >
                          <FontAwesomeIcon icon={faVideo}/>
                        </ButtonLlamar>
                        {showCenterGifts&&allowChat&&(
                          <div style={{position:'absolute',bottom:44,right:0,background:'rgba(0,0,0,0.85)',padding:10,borderRadius:8,zIndex:10,border:'1px solid #333'}}>
                            <div style={{display:'grid',gridTemplateColumns:'repeat(3, 80px)',gap:8,maxHeight:240,overflowY:'auto'}}>
                              {gifts.map(g=>(
                                <button key={g.id} onClick={()=>sendGiftMsg(g.id)} style={{background:'transparent',border:'1px solid #555',borderRadius:8,padding:6,cursor:'pointer',color:'#fff'}}>
                                  <img src={g.icon} alt={g.name} style={{width:32,height:32,display:'block',margin:'0 auto'}}/>
                                  <div style={{fontSize:12}}>{g.name}</div>
                                  <div style={{fontSize:12,opacity:.8}}>{fmtEUR(g.cost)}</div>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
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

    {/* === Móvil Favoritos ALL (SIN TOCAR) === */}
    {isMobile&&(
      <>
        {!centerChatPeerId&&(
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

        {centerChatPeerId&&(
          <div style={{display:'flex',flexDirection:'column',flex:1,minHeight:0}}>
            {contactMode!=='call'&&(
              <StyledMobile3ColBar>
                <ButtonVolver type="button" onClick={backToList} aria-label="Volver a la lista" title="Volver">
                  <FontAwesomeIcon icon={faArrowLeft}/>
                </ButtonVolver>
                <StyledTopCenter>
                  {allowChat&&(
                    <ButtonLlamar onClick={enterCallMode} title="Llamar" aria-label="Llamar">
                      Iniciar VideoChat
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
                      >Activar cámara</ButtonActivarCamMobile>
                      <StyledHelperLine>
                        <FontAwesomeIcon icon={faVideo}/>
                        activar cámara para iniciar videochat
                      </StyledHelperLine>
                    </div>
                  </StyledPreCallCenter>
                )}

                {!callCameraActive&&callStatus==='incoming'&&(
                  <StyledPreCallCenter>
                    <div style={{display:'flex',gap:10,justifyContent:'center'}}>
                      <ButtonAceptar onClick={handleCallAccept}>Aceptar</ButtonAceptar>
                      <ButtonRechazar onClick={handleCallReject}>Rechazar</ButtonRechazar>
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
                          ?'Debéis ser favoritos aceptados para poder llamar'
                          :(!callPeerId?'Selecciona un contacto para llamar':`Llamar a ${callPeerName||callPeerId}`)}
                        aria-label="Llamar"
                      >
                        <FontAwesomeIcon icon={faVideo}/>
                      </BtnRoundVideo>
                      <StyledHelperLine style={{marginTop:4}}>
                        <FontAwesomeIcon icon={faVideo}/>
                        pulsar botón para iniciar llamada
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
                      {callPeerName||'Remoto'}
                    </StyledVideoTitle>
                    <video ref={callRemoteVideoRef} autoPlay playsInline style={{width:'100%',height:'100%',objectFit:'cover'}}/>
                  </StyledRemoteVideo>

                  <StyledLocalVideo>
                    <video ref={callLocalVideoRef} muted autoPlay playsInline style={{width:'100%',display:'block',border:'none'}}/>
                  </StyledLocalVideo>

                  {callStatus==='in-call'&&(
                    <StyledFloatingHangup>
                      <BtnHangup onClick={()=>handleCallEnd(false)} title="Colgar" aria-label="Colgar">
                        <FontAwesomeIcon icon={faPhoneSlash}/>
                      </BtnHangup>
                    </StyledFloatingHangup>
                  )}

                  <StyledChatContainer data-wide="true">
                    <StyledChatList ref={callListRef}>
                      {centerMessages.map(m=>{
                        let giftData=m.gift;
                        if(!giftData&&typeof m.body==='string'&&m.body.startsWith('[[GIFT:')&&m.body.endsWith(']]')){
                          try{
                            const parts=m.body.slice(2,-2).split(':');giftData={id:Number(parts[1]),name:parts.slice(2).join(':')};
                          }catch{}
                        }
                        const isMe=Number(m.senderId)===Number(user?.id);const variant=isMe?'me':'peer';
                        return(
                          <StyledChatMessageRow key={m.id}>
                            {giftData?(
                              giftRenderReady&&(()=>{
                                const src=gifts.find(gg=>Number(gg.id)===Number(giftData.id))?.icon||null;
                                return src?(
                                  <StyledChatBubble $variant={variant} style={{margin:'0 6px'}}>
                                    <img src={src} alt="" style={{width:24,height:24,verticalAlign:'middle'}}/>
                                  </StyledChatBubble>
                                ):null;
                              })()
                            ):(
                              <StyledChatBubble $variant={variant}>{m.body}</StyledChatBubble>
                            )}
                          </StyledChatMessageRow>
                        );
                      })}
                    </StyledChatList>
                  </StyledChatContainer>
                </StyledVideoArea>

                <StyledChatDock style={{display:callStatus==='in-call'?'flex':'none'}}>
                  <StyledChatInput
                    type="text"
                    value={centerInput}
                    onChange={e=>setCenterInput(e.target.value)}
                    placeholder="Escribe un mensaje…"
                    autoComplete="off"
                    onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendCenterMessage();}}}
                    onFocus={()=>setTimeout(()=>chatEndRef.current?.scrollIntoView({block:'end'}),50)}
                  />
                  <ButtonRegalo
                    title="Enviar regalo"
                    onClick={()=>setShowCenterGifts(s=>!s)}
                    aria-label="Enviar regalo"
                  >
                    <FontAwesomeIcon icon={faGift}/>
                  </ButtonRegalo>

                  {showCenterGifts&&(
                    <div style={{position:'absolute',bottom:44,right:0,background:'rgba(0,0,0,0.85)',padding:10,borderRadius:8,zIndex:10,border:'1px solid #333'}}>
                      <div style={{display:'grid',gridTemplateColumns:'repeat(3, 80px)',gap:8,maxHeight:240,overflowY:'auto'}}>
                        {gifts.map(g=>(
                          <button key={g.id} onClick={()=>sendGiftMsg(g.id)} style={{background:'transparent',border:'1px solid #555',borderRadius:8,padding:6,cursor:'pointer',color:'#fff'}}>
                            <img src={g.icon} alt={g.name} style={{width:32,height:32,display:'block',margin:'0 auto'}}/>
                            <div style={{fontSize:12}}>{g.name}</div>
                            <div style={{fontSize:12,opacity:.8}}>{fmtEUR(g.cost)}</div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
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
                  <StyledChatScroller ref={centerListRef} data-bg="whatsapp">
                    {centerLoading&&<div style={{color:'#adb5bd'}}>Cargando historial…</div>}
                    {!centerLoading&&centerMessages.length===0&&(
                      <div style={{color:'#adb5bd'}}>
                        {allowChat?'No hay mensajes todavía. ¡Escribe el primero!':'Este chat no está activo.'}
                      </div>
                    )}
                    {centerMessages.map(m=>{
                      let giftData=m.gift;
                      if(!giftData&&typeof m.body==='string'&&m.body.startsWith('[[GIFT:')&&m.body.endsWith(']]')){
                        try{
                          const parts=m.body.slice(2,-2).split(':');giftData={id:Number(parts[1]),name:parts.slice(2).join(':')};
                        }catch{}
                      }
                      const isMe=Number(m.senderId)===Number(user?.id);const variant=isMe?'me':'peer';
                      return(
                        <StyledChatMessageRow key={m.id} style={{justifyContent:isMe?'flex-end':'flex-start'}}>
                          <StyledChatBubble $variant={variant} style={{margin:'0 6px'}}>
                            {giftData?(
                              giftRenderReady&&(()=>{
                                const src=gifts.find(gg=>Number(gg.id)===Number(giftData.id))?.icon||null;
                                return src?<img src={src}alt=""style={{width:24,height:24,verticalAlign:'middle'}}/>:null;
                              })()
                            ):(
                              m.body
                            )}
                          </StyledChatBubble>
                        </StyledChatMessageRow>
                      );
                    })}
                  </StyledChatScroller>

                  <StyledChatDock>
                    <StyledChatInput
                      value={centerInput}
                      onChange={e=>setCenterInput(e.target.value)}
                      placeholder={allowChat?'Escribe un mensaje…':'Chat inactivo'}
                      onKeyDown={e=>{if(e.key==='Enter'&&allowChat)sendCenterMessage();}}
                      disabled={!allowChat}
                      onFocus={()=>{setTimeout(()=>chatEndRef.current?.scrollIntoView({block:'end'}),50);}}
                    />
                    <ButtonRegalo
                      onClick={()=>setShowCenterGifts(s=>!s)}
                      title="Enviar regalo"
                      disabled={!allowChat}
                      aria-label="Enviar regalo"
                    >
                      <FontAwesomeIcon icon={faGift}/>
                    </ButtonRegalo>
                    {showCenterGifts&&allowChat&&(
                      <div style={{position:'absolute',bottom:44,right:0,background:'rgba(0,0,0,0.85)',padding:10,borderRadius:8,zIndex:10,border:'1px solid #333'}}>
                        <div style={{display:'grid',gridTemplateColumns:'repeat(3, 80px)',gap:8,maxHeight:240,overflowY:'auto'}}>
                          {gifts.map(g=>(
                            <button key={g.id} onClick={()=>sendGiftMsg(g.id)} style={{background:'transparent',border:'1px solid #555',borderRadius:8,padding:6,cursor:'pointer',color:'#fff'}}>
                              <img src={g.icon} alt={g.name} style={{width:32,height:32,display:'block',margin:'0 auto'}}/>
                              <div style={{fontSize:12}}>{g.name}</div>
                              <div style={{fontSize:12,opacity:.8}}>{fmtEUR(g.cost)}</div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </StyledChatDock>
                </StyledChatWhatsApp>
              )}
            </StyledCenterBody>
          </div>
        )}
      </>
    )}
  </>);
}
