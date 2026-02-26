// src/pages/dashboard/VideoChatRandomCliente.jsx
import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import BlurredPreview from '../../components/BlurredPreview';
import {
  faUserPlus,
  faVideo,
  faPhoneSlash,
  faForward,
  faPaperPlane,
  faGift,
  faChevronLeft,
  faChevronRight,
  faBan,
  faFlag
} from '@fortawesome/free-solid-svg-icons';
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
  StyledLocalVideo,
  StyledLocalVideoDesktop,
  StyledGiftsPanel,
  StyledGiftGrid,
  StyledGiftIcon,
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
  StyledTeaserCenter,
  StyledTeaserInner,
  StyledTeaserCard,
  StyledTeaserMediaButton
} from '../../styles/pages-styles/VideochatStyles';
import {
  ButtonActivarCam,
  ButtonActivarCamMobile,
  ButtonBuscar,
  ButtonNext,
  ButtonAddFavorite,
  ButtonRegalo,
  BtnSend,
  BtnHangup,
  BtnBlock
} from '../../styles/ButtonStyles';
import PromoVideoLightbox from '../../components/PromoVideoLightbox';
import { useSession } from '../../components/SessionProvider';
import { apiFetch } from '../../config/http';

export default function VideoChatRandomCliente(props) {
  const {
    isMobile,
    cameraActive,
    remoteStream,
    localVideoRef,
    remoteVideoRef,
    vcListRef,
    messages,
    modelNickname,
    giftRenderReady,
    getGiftIcon,
    chatInput,
    setChatInput,
    sendChatMessage,
    showGifts,
    setShowGifts,
    gifts,
    sendGiftMatch,
    fmtEUR,
    searching,
    stopAll,
    handleStartMatch,
    handleNext,
    handleAddFavorite,
    error,
    toggleFullscreen,
    remoteVideoWrapRef,
    modelAvatar,
    handleActivateCamera,
    handleBlockPeer,
    matchGraceRef,
    nextDisabled,
    handleReportPeer
  } = props;

  const { user: sessionUser, loading: sessionLoading } = useSession();

  const [promoVideos, setPromoVideos] = useState([]);
  const [activePromoIndex, setActivePromoIndex] = useState(null);
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoError, setPromoError] = useState('');
  const [currentPromoIndex, setCurrentPromoIndex] = useState(0);

  const fetchTeasers = async () => {
    setPromoLoading(true);
    setPromoError('');
    try {
      const data = await apiFetch('/models/teasers?page=0&size=20');

      const mapped = (Array.isArray(data) ? data : []).map(item => ({
        id: item.modelId,
        title: `${item.modelName} · teaser`,
        modelName: item.modelName,
        thumb: item.avatarUrl || '/img/avatarChica.png',
        src: item.videoUrl,
        durationSec: null,
      }));

      setPromoVideos(mapped);
      if (mapped.length > 0) setCurrentPromoIndex(0);
    } catch (e) {
      setPromoError(e?.message || 'Error cargando vídeos de modelos');
    } finally {
      setPromoLoading(false);
    }
  };

  useEffect(() => {
    if (sessionLoading) return;
    if (!sessionUser) return;

    fetchTeasers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionLoading, sessionUser]);

  const handleOpenPromo = (index) => {
    setActivePromoIndex(index);
  };

  const handleClosePromo = () => {
    setActivePromoIndex(null);
  };

  const handlePrevPromo = () => {
    setActivePromoIndex(idx => (idx > 0 ? idx - 1 : idx));
  };

  const handleNextPromo = () => {
    setActivePromoIndex(idx => (idx < promoVideos.length - 1 ? idx + 1 : idx));
  };

  const goPrevCard = () => {
    if (promoVideos.length === 0) return;
    setCurrentPromoIndex(idx => (idx > 0 ? idx - 1 : promoVideos.length - 1));
  };

  const goNextCard = () => {
    if (promoVideos.length === 0) return;
    setCurrentPromoIndex(idx => (idx < promoVideos.length - 1 ? idx + 1 : 0));
  };

  const currentPromo =
    promoVideos.length > 0 ? promoVideos[Math.min(currentPromoIndex, promoVideos.length - 1)] : null;

  const handleAddFavoriteFromTeaser = (promoVideo) => {
    if (!promoVideo || !promoVideo.id) return;
    if (typeof handleAddFavorite === 'function') {
      handleAddFavorite(promoVideo.id);
    }
  };

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

        {/* PANE DERECHO (REMOTO + CONTROLES / TEASERS) */}
        <StyledPane
          data-side="right"
          data-view={cameraActive ? 'call' : 'thumbs'}
          style={{position:'relative'}}
        >
          {!cameraActive ? (
            <>
              {promoLoading && (
                <div style={{color:'#e9ecef',padding:'8px 12px',fontSize:'0.9rem'}}>
                  Cargando vídeos de modelos…
                </div>
              )}

              {promoError && (
                <div style={{color:'#ffb3b3',padding:'8px 12px',fontSize:'0.9rem'}}>
                  {promoError}
                </div>
              )}

              {currentPromo && (
                <StyledTeaserCenter>
                  <StyledTeaserInner>
                    <StyledTeaserCard>
                      <button
                        type="button"
                        onClick={goPrevCard}
                        aria-label="Modelo anterior"
                        title="Modelo anterior"
                        style={{position:'absolute',left:10,top:'50%',transform:'translateY(-50%)',width:44,height:44,border:'none',background:'transparent',display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontSize:26,cursor:'pointer',zIndex:3}}
                      >
                        <FontAwesomeIcon icon={faChevronLeft} />
                      </button>

                      <StyledTeaserMediaButton
                        type="button"
                        onClick={() => handleOpenPromo(currentPromoIndex)}
                        title={currentPromo.title || 'Ver teaser'}
                        style={{width:'100%',height:'100%'}}
                      >
                        <BlurredPreview
                          type="video"
                          src={currentPromo.src}
                          poster={currentPromo.thumb || '/img/avatarChica.png'}
                          muted={true}
                          autoPlay={true}
                          loop={true}
                          playsInline={true}
                          controls={false}
                          showVignette={true}
                          style={{width:'100%',height:'100%'}}
                        />
                      </StyledTeaserMediaButton>

                      <div style={{position:'absolute',right:12,bottom:12,zIndex:4}}>
                        <ButtonAddFavorite
                          type="button"
                          onClick={() => currentPromo && handleAddFavorite(currentPromo.id)}
                          aria-label="Añadir a favoritos"
                          title="Añadir a favoritos"
                          style={{width:44,height:44,borderRadius:'999px',padding:0,display:'flex',alignItems:'center',justifyContent:'center',background:'#fff',color:'#000',border:'1px solid rgba(255,255,255,0.4)'}}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = '#000';
                            e.currentTarget.style.color = '#fff';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = '#fff';
                            e.currentTarget.style.color = '#000';
                          }}
                        >
                          <FontAwesomeIcon icon={faUserPlus} />
                        </ButtonAddFavorite>
                      </div>

                      <button
                        type="button"
                        onClick={goNextCard}
                        aria-label="Siguiente modelo"
                        title="Siguiente modelo"
                        style={{position:'absolute',right:10,top:'50%',transform:'translateY(-50%)',width:44,height:44,border:'none',background:'transparent',display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontSize:26,cursor:'pointer',zIndex:3}}
                      >
                        <FontAwesomeIcon icon={faChevronRight} />
                      </button>
                    </StyledTeaserCard>
                  </StyledTeaserInner>
                </StyledTeaserCenter>
              )}

              {!promoLoading && !promoError && promoVideos.length === 0 && (
                <div style={{color:'#e9ecef',padding:'8px 12px',fontSize:'0.9rem'}}>
                  No hay vídeos promocionales disponibles por el momento.
                </div>
              )}

              {isMobile && (
                <StyledPreCallCenter style={{position:'absolute',top:'70%',left:0,right:0,transform:'translateY(-50%)'}}>
                  <div>
                    <ButtonActivarCamMobile onClick={handleActivateCamera}>
                      Activar cámara
                    </ButtonActivarCamMobile>
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
              {/* CONTROLES BUSCAR / BUSCANDO (SIN REMOTO) */}
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
                        <StyledSearchHint>Buscando modelo disponible…</StyledSearchHint>
                        <div style={{marginTop:8,display:'flex',justifyContent:'center'}}>
                          <BtnHangup
                            onClick={stopAll}
                            title="Detener búsqueda"
                            aria-label="Detener búsqueda"
                            style={{width:44,height:44,borderRadius:'999px',display:'flex',alignItems:'center',justifyContent:'center',padding:0,background:'#dc3545',color:'#fff',border:'1px solid rgba(255,255,255,0.4)'}}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = '#fff';
                              e.currentTarget.style.color = '#dc3545';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = '#dc3545';
                              e.currentTarget.style.color = '#fff';
                            }}
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
                  <StyledVideoArea style={{width:'100%',height:'calc(100vh - 180px)',maxHeight:'calc(100vh - 180px)'}}>
                    <StyledRemoteVideo
                      ref={remoteVideoWrapRef}
                      style={{position:'relative',width:'100%',height:'100%',borderRadius:'16px',overflow:'hidden',background:'#000'}}
                    >
                      <StyledVideoTitle>
                        <StyledTitleAvatar src={modelAvatar || '/img/avatarChica.png'} alt="" />
                        {modelNickname || 'Modelo'}
                        <button
                          type="button"
                          onClick={() => toggleFullscreen(remoteVideoWrapRef.current)}
                          title="Pantalla completa"
                          style={{marginLeft:8,padding:'2px 8px',borderRadius:6,border:'1px solid rgba(255,255,255,0.6)',background:'rgba(0,0,0,0.25)',color:'#fff',cursor:'pointer'}}
                        >
                          Pantalla completa
                        </button>
                      </StyledVideoTitle>

                      <video
                        ref={remoteVideoRef}
                        onPlaying={() => {
                          if (matchGraceRef) matchGraceRef.current = false;
                        }}
                        style={{width:'100%',height:'100%',objectFit:'cover',display:'block'}}
                        autoPlay
                        playsInline
                        onDoubleClick={() => toggleFullscreen(remoteVideoWrapRef.current)}
                      />

                      {!isMobile && cameraActive && (
                        <div style={{position:'absolute',top:0,right:0,width:'24%',maxWidth:260,height:'auto',overflow:'hidden',zIndex:8}}>
                          <video
                            ref={localVideoRef}
                            muted
                            autoPlay
                            playsInline
                            style={{width:'100%',height:'100%',objectFit:'cover',display:'block'}}
                          />
                        </div>
                      )}

                      {!isMobile && cameraActive && (
                        <div style={{position:'absolute',bottom:16,left:16,right:16,zIndex:9}}>
                          <div style={{position:'relative',height:44}}>
                            <div style={{position:'absolute',left:'50%',top:0,transform:'translateX(-50%)',display:'flex',alignItems:'center',justifyContent:'center',gap:8}}>
                              <BtnHangup
                                onClick={stopAll}
                                title="Colgar"
                                aria-label="Colgar"
                                style={{width:44,height:44,borderRadius:'999px',display:'flex',alignItems:'center',justifyContent:'center',padding:0,background:'#dc3545',color:'#fff',border:'1px solid rgba(255,255,255,0.4)'}}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.background = '#fff';
                                  e.currentTarget.style.color = '#dc3545';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.background = '#dc3545';
                                  e.currentTarget.style.color = '#fff';
                                }}
                              >
                                <FontAwesomeIcon icon={faPhoneSlash} />
                              </BtnHangup>

                              {remoteStream && (
                                <>
                                  <ButtonNext
                                    onClick={handleNext}
                                    disabled={!!nextDisabled}
                                    aria-disabled={!!nextDisabled}
                                    style={{width:44,height:44,borderRadius:'999px',display:'flex',alignItems:'center',justifyContent:'center',padding:0,background:'#fff',color:'#000',border:'1px solid rgba(255,255,255,0.4)',opacity:nextDisabled?0.55:1,cursor:nextDisabled?'not-allowed':'pointer'}}
                                    onMouseEnter={(e) => {
                                      if (nextDisabled) return;
                                      e.currentTarget.style.background = '#000';
                                      e.currentTarget.style.color = '#fff';
                                    }}
                                    onMouseLeave={(e) => {
                                      if (nextDisabled) return;
                                      e.currentTarget.style.background = '#fff';
                                      e.currentTarget.style.color = '#000';
                                    }}
                                  >
                                    <FontAwesomeIcon icon={faForward} />
                                  </ButtonNext>

                                  <ButtonAddFavorite
                                    aria-label="Añadir a favoritos"
                                    onClick={() => handleAddFavorite && handleAddFavorite()}
                                    title="Añadir a favoritos"
                                    style={{width:44,height:44,borderRadius:'999px',display:'flex',alignItems:'center',justifyContent:'center',padding:0,background:'#fff',color:'#000',border:'1px solid rgba(255,255,255,0.4)'}}
                                    onMouseEnter={(e) => {
                                      e.currentTarget.style.background = '#000';
                                      e.currentTarget.style.color = '#fff';
                                    }}
                                    onMouseLeave={(e) => {
                                      e.currentTarget.style.background = '#fff';
                                      e.currentTarget.style.color = '#000';
                                    }}
                                  >
                                    <FontAwesomeIcon icon={faUserPlus} />
                                  </ButtonAddFavorite>
                                </>
                              )}
                            </div>

                            {remoteStream && (
                              <div style={{position:'absolute',right:0,top:0,display:'flex',alignItems:'center',justifyContent:'flex-end',gap:8}}>
                                <BtnBlock
                                  type="button"
                                  onClick={() => handleReportPeer && handleReportPeer()}
                                  aria-label="Reportar"
                                  title="Reportar abuso"
                                  style={{width:44,height:44}}
                                >
                                  <FontAwesomeIcon icon={faFlag} />
                                </BtnBlock>

                                <BtnBlock
                                  type="button"
                                  onClick={() => handleBlockPeer && handleBlockPeer()}
                                  aria-label="Bloquear"
                                  title="Bloquear"
                                  style={{width:44,height:44}}
                                >
                                  <FontAwesomeIcon icon={faBan} />
                                </BtnBlock>
                              </div>
                            )}
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
                                    {giftRenderReady &&
                                      (() => {
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
                      onChange={(e) => setChatInput(e.target.value)}
                      placeholder="Escribe un mensaje…"
                      autoComplete="off"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          sendChatMessage();
                        }
                      }}
                    />
                    <BtnSend type="button" onClick={sendChatMessage} aria-label="Enviar mensaje">
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
                  </StyledCallFooterDesktop>
                </StyledCallCardDesktop>
              )}

              {/* MÓVIL: REMOTO + CHAT OVERLAY + PIP + CONTROLES */}
              {remoteStream && isMobile && (
                <StyledVideoArea>
                  <StyledRemoteVideo
                    ref={remoteVideoWrapRef}
                    style={{position:'relative',width:'100%',overflow:'hidden',background:'#000'}}
                  >
                    <StyledVideoTitle>
                      <StyledTitleAvatar src={modelAvatar || '/img/avatarChica.png'} alt="" />
                      {modelNickname || 'Modelo'}
                    </StyledVideoTitle>

                    <video
                      ref={remoteVideoRef}
                      onPlaying={() => {
                        if (matchGraceRef) matchGraceRef.current = false;
                      }}
                      style={{width:'100%',height:'100%',objectFit:'cover',display:'block'}}
                      autoPlay
                      playsInline
                      onDoubleClick={() => toggleFullscreen(remoteVideoWrapRef.current)}
                    />

                    {cameraActive && (
                      <StyledLocalVideo>
                        <video
                          ref={localVideoRef}
                          muted
                          autoPlay
                          playsInline
                          style={{width:'100%',objectFit:'cover',display:'block'}}
                        />
                      </StyledLocalVideo>
                    )}

                    {cameraActive && (
                      <div style={{position:'absolute',left:12,right:12,bottom:'72px',zIndex:8}}>
                        <div style={{position:'relative',height:44}}>
                          <div style={{position:'absolute',left:'50%',top:0,transform:'translateX(-50%)',display:'flex',alignItems:'center',justifyContent:'center',gap:'12px'}}>
                            <BtnHangup onClick={stopAll} title="Colgar" aria-label="Colgar">
                              <FontAwesomeIcon icon={faPhoneSlash} />
                            </BtnHangup>

                            <ButtonNext
                              onClick={handleNext}
                              disabled={!!nextDisabled}
                              aria-disabled={!!nextDisabled}
                              style={{width:44,height:44,borderRadius:'999px',padding:0,display:'flex',alignItems:'center',justifyContent:'center',background:'#fff',color:'#000',border:'1px solid rgba(255,255,255,0.4)',opacity:nextDisabled?0.55:1,cursor:nextDisabled?'not-allowed':'pointer'}}
                              onMouseEnter={(e) => {
                                if (nextDisabled) return;
                                e.currentTarget.style.background = '#000';
                                e.currentTarget.style.color = '#fff';
                              }}
                              onMouseLeave={(e) => {
                                if (nextDisabled) return;
                                e.currentTarget.style.background = '#fff';
                                e.currentTarget.style.color = '#000';
                              }}
                            >
                              <FontAwesomeIcon icon={faForward} />
                            </ButtonNext>

                            <ButtonAddFavorite
                              onClick={() => handleAddFavorite && handleAddFavorite()}
                              style={{width:44,height:44,borderRadius:'999px',padding:0,display:'flex',alignItems:'center',justifyContent:'center',background:'#fff',color:'#000',border:'1px solid rgba(255,255,255,0.4)'}}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background = '#000';
                                e.currentTarget.style.color = '#fff';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = '#fff';
                                e.currentTarget.style.color = '#000';
                              }}
                            >
                              <FontAwesomeIcon icon={faUserPlus} />
                            </ButtonAddFavorite>
                          </div>

                          <div style={{position:'absolute',right:0,top:0,display:'flex',alignItems:'center',justifyContent:'flex-end',gap:8}}>
                            <BtnBlock
                              type="button"
                              onClick={() => handleReportPeer && handleReportPeer()}
                              aria-label="Reportar"
                              title="Reportar abuso"
                              style={{width:44,height:44}}
                            >
                              <FontAwesomeIcon icon={faFlag} />
                            </BtnBlock>

                            <BtnBlock
                              type="button"
                              onClick={() => handleBlockPeer && handleBlockPeer()}
                              aria-label="Bloquear"
                              title="Bloquear"
                              style={{width:44,height:44}}
                            >
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
                                  {giftRenderReady &&
                                    (() => {
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
            <video
              ref={localVideoRef}
              muted
              autoPlay
              playsInline
              style={{width:'100%',height:'100%',objectFit:'cover',display:'block'}}
            />
          </StyledLocalVideoDesktop>
        )}
      </StyledSplit2>

      {/* DOCK CHAT SOLO MÓVIL EN LLAMADA */}
      {remoteStream && isMobile && (
        <StyledChatDock>
          <StyledChatInput
            type="text"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            placeholder="Escribe un mensaje…"
            autoComplete="off"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendChatMessage();
              }
            }}
          />

          <BtnSend type="button" onClick={sendChatMessage} aria-label="Enviar mensaje">
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

      {error && <p style={{color:'red',marginTop:'10px'}}>{error}</p>}

      {activePromoIndex != null && (
        <PromoVideoLightbox
          videos={promoVideos}
          activeIndex={activePromoIndex}
          onClose={handleClosePromo}
          onPrev={handlePrevPromo}
          onNext={handleNextPromo}
          onAddFavorite={handleAddFavoriteFromTeaser}
        />
      )}
    </StyledCenterVideochat>
  );
}